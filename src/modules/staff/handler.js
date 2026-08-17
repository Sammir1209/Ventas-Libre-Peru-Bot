const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const config = require('../../config/env');
const { ROLES, SYM } = require('../../config/constants');
const { requireOwner } = require('../../middleware/auth');
const { extractTarget } = require('../../utils/helpers');
const { mentionFromData, formatId, escapeHtml } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');

// ══════════════════════════════════════════════════════
// ⟡ Módulo 3: Staff — Sistema de Promote & Demote por Jerarquía
// ══════════════════════════════════════════════════════

// Jerarquía de rangos (de menor a mayor)
const ROLE_HIERARCHY = [
  { level: 0, key: 'USER', label: 'USER (Sin Rango)' },
  { level: 1, key: 'TRATO ADMIN', label: 'TRATO ADMIN' },
  { level: 2, key: 'ADMIN', label: 'ADMIN' },
  { level: 3, key: 'CO-OWNER', label: 'CO-OWNER' },
  { level: 4, key: 'OWNER', label: 'OWNER' },
];

function getRoleLevel(roleName) {
  if (!roleName) return 0;
  const upper = roleName.toUpperCase();
  if (upper === 'OWNER') return 4;
  if (upper === 'CO-OWNER' || upper === 'COOWNER') return 3;
  if (upper === 'ADMIN' || upper === 'ADMINISTRADOR') return 2;
  if (upper === 'TRATO ADMIN' || upper === 'TRATOADMIN') return 1;
  return 0;
}

function getRoleKeyFromLevel(level) {
  const item = ROLE_HIERARCHY.find(r => r.level === level);
  return item ? item.key : 'USER';
}

function register(bot) {
  // ── Comando /promote [ID, @username o reply] ──
  bot.command('promote', requireOwner(), async (ctx) => {
    try {
      const target = await resolveTarget(ctx);

      if (!target) {
        return ctx.reply(
          `${SYM.DIVIDER}\n` +
          `${SYM.DIAMOND} <b>COMANDO /PROMOTE</b> ${SYM.DIAMOND}\n` +
          `${SYM.DIVIDER}\n\n` +
          `${SYM.ARROW} <b>Uso:</b> <code>/promote [ID, @username o responder a mensaje]</code>\n\n` +
          `${SYM.STAR} Despliega un panel interactivo con los rangos superiores disponibles para ascender al usuario.`,
          { parse_mode: 'HTML' }
        );
      }

      if (target.unresolved) {
        return ctx.reply(
          `${SYM.CROSS} No se pudo obtener el ID de <b>@${target.username}</b> automáticamente.\n\n` +
          `${SYM.ARROW} Esto ocurre si el usuario nunca ha iniciado el bot o su cuenta es privada.\n\n` +
          `${SYM.STAR} <b>Soluciones:</b>\n` +
          `${SYM.BULLET} Pídele que le envíe <code>/start</code> al bot una sola vez.\n` +
          `${SYM.BULLET} O usa su <b>ID numérico</b>: <code>/promote [ID]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      // Obtener rol actual
      const currentRole = await getUserCurrentRole(target.userId);
      const currentLevel = getRoleLevel(currentRole);

      if (currentLevel >= 4) {
        return ctx.reply(
          `${SYM.STAR} El usuario <b>${mentionFromData(target.userId, target.username, target.firstName)}</b> ya cuenta con el rango máximo (<b>OWNER</b>).`,
          { parse_mode: 'HTML' }
        );
      }

      // Guardar datos temporales en caché para el callback
      await redisDb.setCache(`staff_target:${target.userId}`, {
        userId: target.userId,
        username: target.username,
        firstName: target.firstName,
        currentRole: getRoleKeyFromLevel(currentLevel),
      }, 300);

      // Generar botones solo para rangos SUPERIORES al actual en 2 columnas
      const higherRoles = ROLE_HIERARCHY.filter(r => r.level > currentLevel);
      const kb = new InlineKeyboard();

      for (let i = 0; i < higherRoles.length; i++) {
        const r = higherRoles[i];
        kb.text(`${SYM.DIAMOND} ${r.label}`, `promote_to:${target.userId}:${r.key}`).primary();
        if (i % 2 === 1 && i < higherRoles.length - 1) {
          kb.row();
        }
      }
      kb.row().text(`${SYM.CROSS} Cancelar`, 'staff_cancel').danger();

      const userMention = mentionFromData(target.userId, target.username, target.firstName);
      await ctx.reply(
        `${SYM.DIVIDER}\n` +
        `${SYM.DIAMOND} <b>PANEL DE PROMOCIÓN DE STAFF</b> ${SYM.DIAMOND}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.ARROW} <b>Usuario:</b> ${userMention}\n` +
        `${SYM.ARROW} <b>ID:</b> <code>${target.userId}</code>\n` +
        `${SYM.ARROW} <b>Rango Actual:</b> <b>${getRoleKeyFromLevel(currentLevel)}</b>\n\n` +
        `${SYM.THIN_LINE}\n` +
        `${SYM.STAR} Selecciona el rango al que deseas <b>promoverlo</b>:`,
        {
          parse_mode: 'HTML',
          reply_markup: kb,
        }
      );
    } catch (err) {
      console.error('⟡ Error en /promote:', err.message);
      await ctx.reply(`⟡ ✗ Error: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Comando /demote [ID, @username o reply] ──
  bot.command('demote', requireOwner(), async (ctx) => {
    try {
      const target = await resolveTarget(ctx);

      if (!target) {
        return ctx.reply(
          `${SYM.DIVIDER}\n` +
          `${SYM.DIAMOND} <b>COMANDO /DEMOTE</b> ${SYM.DIAMOND}\n` +
          `${SYM.DIVIDER}\n\n` +
          `${SYM.ARROW} <b>Uso:</b> <code>/demote [ID, @username o responder a mensaje]</code>\n\n` +
          `${SYM.STAR} Despliega un panel interactivo con los rangos inferiores para degradar al usuario o removerlo del staff.`,
          { parse_mode: 'HTML' }
        );
      }

      if (target.unresolved) {
        return ctx.reply(
          `${SYM.CROSS} No se pudo obtener el ID de <b>@${target.username}</b> automáticamente.\n\n` +
          `${SYM.ARROW} Esto ocurre si el usuario nunca ha iniciado el bot o su cuenta es privada.\n\n` +
          `${SYM.STAR} <b>Soluciones:</b>\n` +
          `${SYM.BULLET} Pídele que le envíe <code>/start</code> al bot una sola vez.\n` +
          `${SYM.BULLET} O usa su <b>ID numérico</b>: <code>/demote [ID]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      // Obtener rol actual
      const currentRole = await getUserCurrentRole(target.userId);
      const currentLevel = getRoleLevel(currentRole);

      if (currentLevel === 0) {
        return ctx.reply(
          `${SYM.STAR} El usuario <b>${mentionFromData(target.userId, target.username, target.firstName)}</b> no tiene ningún rango de Staff asignado (es <b>USER</b>).`,
          { parse_mode: 'HTML' }
        );
      }

      // Guardar datos temporales en caché para el callback
      await redisDb.setCache(`staff_target:${target.userId}`, {
        userId: target.userId,
        username: target.username,
        firstName: target.firstName,
        currentRole: getRoleKeyFromLevel(currentLevel),
      }, 300);

      // Generar botones solo para rangos INFERIORES al actual en 2 columnas
      const lowerRoles = ROLE_HIERARCHY.filter(r => r.level < currentLevel).sort((a, b) => b.level - a.level);
      const kb = new InlineKeyboard();

      for (let i = 0; i < lowerRoles.length; i++) {
        const r = lowerRoles[i];
        const btnText = r.level === 0 ? `${SYM.CROSS} Remover Staff` : `${SYM.ARROW} ${r.label}`;
        kb.text(btnText, `demote_to:${target.userId}:${r.key}`).danger();
        if (i % 2 === 1 && i < lowerRoles.length - 1) {
          kb.row();
        }
      }
      kb.row().text(`${SYM.CROSS} Cancelar`, 'staff_cancel');

      const userMention = mentionFromData(target.userId, target.username, target.firstName);
      await ctx.reply(
        `${SYM.DIVIDER}\n` +
        `${SYM.DIAMOND} <b>PANEL DE DEGRADACIÓN DE STAFF</b> ${SYM.DIAMOND}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.ARROW} <b>Usuario:</b> ${userMention}\n` +
        `${SYM.ARROW} <b>ID:</b> <code>${target.userId}</code>\n` +
        `${SYM.ARROW} <b>Rango Actual:</b> <b>${getRoleKeyFromLevel(currentLevel)}</b>\n\n` +
        `${SYM.THIN_LINE}\n` +
        `${SYM.STAR} Selecciona la acción a realizar:`,
        {
          parse_mode: 'HTML',
          reply_markup: kb,
        }
      );
    } catch (err) {
      console.error('⟡ Error en /demote:', err.message);
      await ctx.reply(`⟡ ✗ Error: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

function getCustomTitle(role) {
  const upper = (role || '').toUpperCase();
  if (upper === 'OWNER') return '♔ Owner';
  if (upper === 'CO-OWNER' || upper === 'COOWNER') return '♕ Co-Owner';
  if (upper === 'ADMIN') return '⚔ Admin';
  if (upper === 'TRATO ADMIN' || upper === 'TRATOADMIN') return '㉿ Trato Admin';
  return 'Staff';
}

async function applyTelegramAdminRights(api, chatId, userId, role) {
  try {
    const title = getCustomTitle(role);

    // 1. Validar que el chat no sea canal
    const chat = await api.getChat(chatId);
    if (chat.type === 'channel') return false;

    // 2. Verificar permisos del bot
    const me = await api.getMe();
    const botMember = await api.getChatMember(chatId, me.id);
    if (botMember.status !== 'administrator' && botMember.status !== 'creator') {
      return false;
    }
    if (botMember.status === 'administrator' && !botMember.can_promote_members) {
      return false;
    }

    // 3. Verificar estado del usuario a promover
    const targetMember = await api.getChatMember(chatId, userId);
    if (targetMember.status === 'creator') {
      try {
        await api.setChatAdministratorCustomTitle(chatId, userId, title);
      } catch {}
      return true;
    }

    // 4. Promover a Administrador
    await api.promoteChatMember(chatId, userId, {
      can_manage_chat: true,
      can_delete_messages: true,
      can_restrict_members: true,
      can_invite_users: true,
      can_pin_messages: true,
      can_manage_topics: true,
      can_manage_video_chats: true,
      is_anonymous: false,
    });

    // 5. Asignar Tag / Custom Title oficial
    try {
      await api.setChatAdministratorCustomTitle(chatId, userId, title);
    } catch {}
    return true;
  } catch (err) {
    return false;
  }
}

async function revokeTelegramAdminRights(api, chatId, userId) {
  try {
    const chat = await api.getChat(chatId);
    if (chat.type === 'channel') return false;

    const me = await api.getMe();
    const botMember = await api.getChatMember(chatId, me.id);
    if (botMember.status !== 'administrator' && botMember.status !== 'creator') {
      return false;
    }
    if (botMember.status === 'administrator' && !botMember.can_promote_members) {
      return false;
    }

    const targetMember = await api.getChatMember(chatId, userId);
    if (targetMember.status === 'creator') {
      return false;
    }

    await api.promoteChatMember(chatId, userId, {
      can_manage_chat: false,
      can_change_info: false,
      can_delete_messages: false,
      can_invite_users: false,
      can_restrict_members: false,
      can_pin_messages: false,
      can_promote_members: false,
      can_manage_video_chats: false,
      can_manage_topics: false,
      can_post_stories: false,
      can_edit_stories: false,
      can_delete_stories: false,
      is_anonymous: false,
    });
    return true;
  } catch (err) {
    return false;
  }
}

  // ── Callback: Ejecutar Promoción ──
  bot.callbackQuery(/^promote_to:(\d+):(.+)$/, requireOwner(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1]);
      const newRole = ctx.match[2];

      const cached = (await redisDb.getCache(`staff_target:${targetId}`)) || {};
      const username = cached.username || null;
      const firstName = cached.firstName || null;
      const oldRole = cached.currentRole || 'USER';

      // 1. Asignar en Supabase / BD
      await db.setStaffRole(targetId, username, firstName, newRole, ctx.from.id);
      await redisDb.clearCache(`staff_target:${targetId}`);

      // 2. Aplicar permisos de Administrador reales y Tag en Telegram
      const targetChatId = ctx.chat?.id;
      if (ctx.chat?.type === 'supergroup' || ctx.chat?.type === 'group') {
        await applyTelegramAdminRights(ctx.api, targetChatId, targetId, newRole);
      }

      // También aplicar en grupos oficiales registrados
      try {
        const groups = await db.getAllGroups();
        for (const grp of groups) {
          if (grp.chat_id && grp.chat_id !== targetChatId && grp.type !== 'channel') {
            await applyTelegramAdminRights(ctx.api, grp.chat_id, targetId, newRole);
          }
        }
      } catch {}

      await ctx.answerCallbackQuery({ text: `✓ Promovido a ${newRole} con tag ${getCustomTitle(newRole)}` });

      const userMention = mentionFromData(targetId, username, firstName);
      const adminMention = mentionFromData(ctx.from.id, ctx.from.username, ctx.from.first_name);

      await ctx.editMessageText(
        `${SYM.DIVIDER}\n` +
        `${SYM.CROWN} <b>PROMOCIÓN DE STAFF COMPLETADA</b> ${SYM.BADGE}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CHECK} <b>Usuario:</b> ${userMention}\n` +
        `${SYM.ARROW} <b>ID:</b> <code>${targetId}</code>\n` +
        `${SYM.ARROW} <b>Rango Anterior:</b> ${oldRole}\n` +
        `${SYM.STAR} <b>Nuevo Rango:</b> <b>${newRole}</b>\n` +
        `🏷️ <b>Tag en Telegram:</b> <code>${getCustomTitle(newRole)}</code>\n` +
        `🛡️ <b>Permisos de Admin:</b> ✓ ACTIVOS EN TELEGRAM\n\n` +
        `${SYM.THIN_LINE}\n` +
        `${SYM.ARROW} <i>Promovido por: ${adminMention}</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en promote_to callback:', err.message);
      await ctx.answerCallbackQuery({ text: `✗ Error: ${err.message}`, show_alert: true });
    }
  });

  // ── Callback: Ejecutar Degradación ──
  bot.callbackQuery(/^demote_to:(\d+):(.+)$/, requireOwner(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1]);
      const newRole = ctx.match[2];

      const cached = (await redisDb.getCache(`staff_target:${targetId}`)) || {};
      const username = cached.username || null;
      const firstName = cached.firstName || null;
      const oldRole = cached.currentRole || 'STAFF';

      const targetChatId = ctx.chat?.id;

      if (newRole === 'USER') {
        // 1. Remover del staff en BD
        await db.removeStaff(targetId);

        // 2. Revocar permisos de Administrador reales en Telegram
        if (ctx.chat?.type === 'supergroup' || ctx.chat?.type === 'group') {
          await revokeTelegramAdminRights(ctx.api, targetChatId, targetId);
        }
        try {
          const groups = await db.getAllGroups();
          for (const grp of groups) {
            if (grp.chat_id && grp.chat_id !== targetChatId && grp.type !== 'channel') {
              await revokeTelegramAdminRights(ctx.api, grp.chat_id, targetId);
            }
          }
        } catch {}
      } else {
        // 1. Asignar nuevo rango inferior en BD
        await db.setStaffRole(targetId, username, firstName, newRole, ctx.from.id);

        // 2. Actualizar tag en Telegram
        if (ctx.chat?.type === 'supergroup' || ctx.chat?.type === 'group') {
          await applyTelegramAdminRights(ctx.api, targetChatId, targetId, newRole);
        }
        try {
          const groups = await db.getAllGroups();
          for (const grp of groups) {
            if (grp.chat_id && grp.chat_id !== targetChatId && grp.type !== 'channel') {
              await applyTelegramAdminRights(ctx.api, grp.chat_id, targetId, newRole);
            }
          }
        } catch {}
      }

      await redisDb.clearCache(`staff_target:${targetId}`);
      await ctx.answerCallbackQuery({ text: newRole === 'USER' ? '✓ Removido del Staff y Admin' : `✓ Degradado a ${newRole}` });

      const userMention = mentionFromData(targetId, username, firstName);
      const adminMention = mentionFromData(ctx.from.id, ctx.from.username, ctx.from.first_name);

      await ctx.editMessageText(
        `${SYM.DIVIDER}\n` +
        `${SYM.SWORD} <b>DEGRADACIÓN DE STAFF COMPLETADA</b> ${SYM.SHIELD}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CHECK} <b>Usuario:</b> ${userMention}\n` +
        `${SYM.ARROW} <b>ID:</b> <code>${targetId}</code>\n` +
        `${SYM.ARROW} <b>Rango Anterior:</b> ${oldRole}\n` +
        `${SYM.STAR} <b>Nuevo Rango:</b> <b>${newRole === 'USER' ? 'USUARIO (Permisos Revocados)' : newRole}</b>\n` +
        (newRole !== 'USER' ? `🏷️ <b>Tag en Telegram:</b> <code>${getCustomTitle(newRole)}</code>\n` : `🛡️ <b>Permisos de Admin:</b> ❌ REMOVIDOS EN TELEGRAM\n`) +
        `\n${SYM.THIN_LINE}\n` +
        `${SYM.ARROW} <i>Modificado por: ${adminMention}</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en demote_to callback:', err.message);
      await ctx.answerCallbackQuery({ text: `✗ Error: ${err.message}`, show_alert: true });
    }
  });

  // ── Callback: Cancelar Operación de Staff ──
  bot.callbackQuery('staff_cancel', async (ctx) => {
    try {
      await ctx.answerCallbackQuery({ text: '⟡ Operación cancelada.' });
      await ctx.editMessageText(
        `${SYM.DIVIDER}\n` +
        `${SYM.CROSS} <b>OPERACIÓN CANCELADA</b>\n` +
        `${SYM.DIVIDER}\n\n` +
        `» No se realizaron cambios en el equipo de Staff.`,
        { parse_mode: 'HTML' }
      );
    } catch {}
  });
}

/**
 * Consulta el rol actual de un usuario en base de datos y env.
 */
async function getUserCurrentRole(userId) {
  if (config.OWNER_IDS.includes(userId)) return 'OWNER';
  try {
    const member = await db.getStaffMember(userId);
    if (member && member.role) return member.role;
  } catch {}
  return 'USER';
}

/**
 * Resuelve el target desde reply, ID o @username.
 */
async function resolveTarget(ctx) {
  const target = extractTarget(ctx);
  if (!target) return null;

  // Si ya tenemos userId (de reply o número)
  if (target.userId) {
    if (!target.username) {
      try {
        const chatInfo = await ctx.api.getChat(target.userId);
        target.username = chatInfo.username || null;
        target.firstName = chatInfo.first_name || null;
      } catch {}
    }
    return target;
  }

  // Si tenemos username (ej: cinefastperu)
  if (target.username) {
    const cleanUsername = target.username.replace(/^@/, '');

    // 1. Intentar resolver via Telegram API getChat
    try {
      const chatInfo = await ctx.api.getChat(`@${cleanUsername}`);
      if (chatInfo && chatInfo.id) {
        return {
          userId: chatInfo.id,
          username: chatInfo.username || cleanUsername,
          firstName: chatInfo.first_name || null,
        };
      }
    } catch {}

    // 2. Buscar en la base de datos de usuarios registrados
    try {
      const dbUser = await db.getUserByUsername(cleanUsername);
      if (dbUser && dbUser.user_id) {
        return {
          userId: Number(dbUser.user_id),
          username: dbUser.username || cleanUsername,
          firstName: dbUser.first_name || null,
        };
      }
    } catch {}

    // 3. Retornar con el username para indicar qué falta
    return {
      userId: null,
      username: cleanUsername,
      firstName: null,
      unresolved: true,
    };
  }

  return null;
}

module.exports = { register };
