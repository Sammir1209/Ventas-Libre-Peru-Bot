const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const config = require('../../config/env');
const { ROLES, SYM } = require('../../config/constants');
const { requireOwner } = require('../../middleware/auth');
const { extractTarget } = require('../../utils/helpers');
const { mentionFromData, escapeHtml } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');

// ══════════════════════════════════════════════════════
// ⟡ Módulo 3: Staff — Sistema de Roles Múltiples y Tags Dinámicos
// ══════════════════════════════════════════════════════

const AVAILABLE_ROLES = ['OWNER', 'CO-OWNER', 'ADMIN', 'TRATO ADMIN'];

function getRolePresetTag(role) {
  const upper = (role || '').toUpperCase();
  if (upper === 'OWNER') return 'Owner';
  if (upper === 'CO-OWNER' || upper === 'COOWNER') return 'Co-Owner';
  if (upper === 'ADMIN') return 'Admin';
  if (upper === 'TRATO ADMIN' || upper === 'TRATOADMIN') return 'Trato Admin';
  return 'Staff';
}

function buildRolesKeyboard(targetId, selectedRoles) {
  const kb = new InlineKeyboard();

  AVAILABLE_ROLES.forEach((r, idx) => {
    const isSelected = selectedRoles.includes(r);
    const label = isSelected ? `${r} [SELECCIONADO]` : r;
    if (isSelected) {
      kb.text(label, `staff_toggle:${targetId}:${r}`).success();
    } else {
      kb.text(label, `staff_toggle:${targetId}:${r}`).primary();
    }
    if (idx % 2 === 1) kb.row();
  });

  if (AVAILABLE_ROLES.length % 2 !== 0) kb.row();

  if (selectedRoles.length > 0) {
    kb.text('CONTINUAR', `staff_roles_continue:${targetId}`).success();
    kb.row();
  }

  kb.text('REMOVER STAFF', `staff_remove_confirm:${targetId}`).danger();
  kb.text('CANCELAR', 'staff_cancel').danger();

  return kb;
}

function buildTagKeyboard(targetId, selectedRoles) {
  const kb = new InlineKeyboard();

  selectedRoles.forEach((r) => {
    kb.text(`TAG: ${r}`, `staff_set_preset_tag:${targetId}:${r}`).primary();
    kb.row();
  });

  kb.text('PERSONALIZAR TAG', `staff_custom_tag_prompt:${targetId}`).primary();
  kb.row();
  kb.text('VOLVER A ROLES', `staff_back_roles:${targetId}`).primary();
  kb.text('CANCELAR', 'staff_cancel').danger();

  return kb;
}

async function applyTelegramAdminRights(api, chatId, userId, customTag) {
  try {
    const title = (customTag || 'Staff').slice(0, 16);

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
      try {
        await api.setChatAdministratorCustomTitle(chatId, userId, title);
      } catch { }
      return true;
    }

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

    try {
      await api.setChatAdministratorCustomTitle(chatId, userId, title);
    } catch { }
    return true;
  } catch {
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
    if (targetMember.status === 'creator') return false;

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
  } catch {
    return false;
  }
}

function register(bot) {
  // ── Comando /promote o /setstaff [ID, @username o reply] ──
  bot.command(['promote', 'setstaff', 'staff_set', 'asignar_rol'], requireOwner(), async (ctx) => {
    try {
      const target = await resolveTarget(ctx);

      if (!target) {
        return ctx.reply(
          `${SYM.DIVIDER}\n` +
          `👑 <b>ASIGNACIÓN Y GESTIÓN DE STAFF</b>\n` +
          `${SYM.DIVIDER}\n\n` +
          `• <b>Uso:</b> <code>/promote [ID, @username o responder a mensaje]</code>\n\n` +
          `<i>Permite asignar uno o múltiples roles simultáneos (ej: CO-OWNER + TRATO ADMIN) y definir el tag oficial en grupos.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      if (target.unresolved) {
        return ctx.reply(
          `${SYM.CROSS} No se pudo obtener el ID de <b>@${target.username}</b> automáticamente.\n\n` +
          `• El usuario debe haber iniciado el bot al menos una vez.\n` +
          `• O usa directamente su <b>ID numérico</b>: <code>/promote [ID]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      // Obtener roles actuales del usuario en BD
      let currentRoles = [];
      let currentTitle = null;
      try {
        const staffMember = await db.getStaffMember(target.userId);
        if (staffMember && staffMember.role) {
          currentRoles = staffMember.role
            .split(',')
            .map((r) => r.trim().toUpperCase())
            .filter((r) => AVAILABLE_ROLES.includes(r));
          currentTitle = staffMember.custom_title || null;
        }
      } catch { }

      // Si no tiene roles y es owner en .env
      if (currentRoles.length === 0 && config.OWNER_IDS.includes(target.userId)) {
        currentRoles = ['OWNER'];
      }

      const initialSelected = currentRoles.length > 0 ? [...currentRoles] : [];

      const userTag = target.username ? `<code>@${target.username}</code>` : '<i>Sin @username</i>';
      const nameFormatted = escapeHtml(target.firstName || 'Usuario');
      const rolesDisplay = initialSelected.length > 0 ? initialSelected.join(', ') : 'Ninguno (Usuario)';

      const cardText =
        `👑 <b>PANEL DE ASIGNACIÓN DE STAFF</b>\n\n` +
        `• <b>Usuario:</b> ${userTag} (<b>${nameFormatted}</b>)\n` +
        `• <b>ID:</b> <code>${target.userId}</code>\n` +
        `• <b>Roles Seleccionados:</b> <b>${rolesDisplay}</b>\n\n` +
        `${SYM.THIN_LINE}\n` +
        `<i>Toca los roles que deseas activar o desactivar:</i>`;

      const kb = buildRolesKeyboard(target.userId, initialSelected);
      const masterMsg = await ctx.reply(cardText, { parse_mode: 'HTML', reply_markup: kb });

      // Guardar estado del asistente
      await redisDb.setCache(
        `staff_wizard:${ctx.from.id}`,
        {
          targetId: target.userId,
          username: target.username,
          firstName: target.firstName,
          selectedRoles: initialSelected,
          masterMessageId: masterMsg.message_id,
          chatId: ctx.chat.id,
          step: 'SELECT_ROLES',
        },
        600
      );
    } catch (err) {
      console.error('⟡ Error en /promote:', err.message);
      await ctx.reply(`✗ Error: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Comando /demote [ID, @username o reply] ──
  bot.command('demote', requireOwner(), async (ctx) => {
    try {
      const target = await resolveTarget(ctx);

      if (!target) {
        return ctx.reply(
          `🛡️ <b>DEGRADACIÓN DE STAFF</b>\n\n` +
          `• <b>Uso:</b> <code>/demote [ID, @username o responder a mensaje]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      if (target.unresolved) {
        return ctx.reply(
          `✗ No se pudo obtener el ID de <b>@${target.username}</b>. Usa su ID numérico: <code>/demote [ID]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      const userTag = target.username ? `<code>@${target.username}</code>` : '<i>Sin @username</i>';
      const nameFormatted = escapeHtml(target.firstName || 'Usuario');

      const kb = new InlineKeyboard()
        .text('CONFIRMAR REMOVER STAFF', `staff_remove_do:${target.userId}`).danger()
        .row()
        .text('CANCELAR', 'staff_cancel').primary();

      await ctx.reply(
        `⚠️ <b>CONFIRMAR REMOCIÓN DE STAFF</b>\n\n` +
        `• <b>Usuario:</b> ${userTag} (<b>${nameFormatted}</b>)\n` +
        `• <b>ID:</b> <code>${target.userId}</code>\n\n` +
        `¿Deseas revocar todos los permisos de Administrador y eliminar del Staff oficial?`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    } catch (err) {
      console.error('⟡ Error en /demote:', err.message);
      await ctx.reply(`✗ Error: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Callback: Toggle Roles (Multi-Select) ──
  bot.callbackQuery(/^staff_toggle:(\d+):(.+)$/, requireOwner(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1]);
      const roleToToggle = ctx.match[2].toUpperCase();
      const adminId = ctx.from.id;

      let wizard = (await redisDb.getCache(`staff_wizard:${adminId}`)) || {};
      let selected = wizard.selectedRoles || [];

      if (selected.includes(roleToToggle)) {
        selected = selected.filter((r) => r !== roleToToggle);
      } else {
        selected.push(roleToToggle);
      }

      wizard.selectedRoles = selected;
      wizard.step = 'SELECT_ROLES';
      await redisDb.setCache(`staff_wizard:${adminId}`, wizard, 600);

      await ctx.answerCallbackQuery({ text: selected.includes(roleToToggle) ? `+ ${roleToToggle}` : `- ${roleToToggle}` });

      const userTag = wizard.username ? `<code>@${wizard.username}</code>` : '<i>Sin @username</i>';
      const nameFormatted = escapeHtml(wizard.firstName || 'Usuario');
      const rolesDisplay = selected.length > 0 ? selected.join(', ') : 'Ninguno (Usuario)';

      const cardText =
        `👑 <b>PANEL DE ASIGNACIÓN DE STAFF</b>\n\n` +
        `• <b>Usuario:</b> ${userTag} (<b>${nameFormatted}</b>)\n` +
        `• <b>ID:</b> <code>${targetId}</code>\n` +
        `• <b>Roles Seleccionados:</b> <b>${rolesDisplay}</b>\n\n` +
        `${SYM.THIN_LINE}\n` +
        `<i>Toca los roles que deseas activar o desactivar:</i>`;

      const kb = buildRolesKeyboard(targetId, selected);
      await ctx.editMessageText(cardText, { parse_mode: 'HTML', reply_markup: kb });
    } catch (err) {
      console.error('⟡ Error en staff_toggle:', err.message);
    }
  });

  // ── Callback: Continuar a Selección de Tag ──
  bot.callbackQuery(/^staff_roles_continue:(\d+)$/, requireOwner(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1]);
      const adminId = ctx.from.id;

      const wizard = (await redisDb.getCache(`staff_wizard:${adminId}`)) || {};
      const selected = wizard.selectedRoles || [];

      if (selected.length === 0) {
        return ctx.answerCallbackQuery({ text: 'Selecciona al menos un rol o presiona Remover Staff.', show_alert: true });
      }

      wizard.step = 'SELECT_TAG';
      await redisDb.setCache(`staff_wizard:${adminId}`, wizard, 600);
      await ctx.answerCallbackQuery();

      const userTag = wizard.username ? `<code>@${wizard.username}</code>` : '<i>Sin @username</i>';
      const nameFormatted = escapeHtml(wizard.firstName || 'Usuario');
      const rolesDisplay = selected.join(', ');

      const cardText =
        `🏷️ <b>SELECCIÓN DE TAG OFICIAL PARA GRUPOS</b>\n\n` +
        `• <b>Usuario:</b> ${userTag} (<b>${nameFormatted}</b>)\n` +
        `• <b>Roles:</b> <b>${rolesDisplay}</b>\n\n` +
        `${SYM.THIN_LINE}\n` +
        `<i>Selecciona qué título/tag oficial debe mostrar este miembro en los grupos o escribe uno personalizado:</i>`;

      const kb = buildTagKeyboard(targetId, selected);
      await ctx.editMessageText(cardText, { parse_mode: 'HTML', reply_markup: kb });
    } catch (err) {
      console.error('⟡ Error en staff_roles_continue:', err.message);
    }
  });

  // ── Callback: Volver a Roles ──
  bot.callbackQuery(/^staff_back_roles:(\d+)$/, requireOwner(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1]);
      const adminId = ctx.from.id;

      const wizard = (await redisDb.getCache(`staff_wizard:${adminId}`)) || {};
      const selected = wizard.selectedRoles || [];

      wizard.step = 'SELECT_ROLES';
      await redisDb.setCache(`staff_wizard:${adminId}`, wizard, 600);
      await ctx.answerCallbackQuery();

      const userTag = wizard.username ? `<code>@${wizard.username}</code>` : '<i>Sin @username</i>';
      const nameFormatted = escapeHtml(wizard.firstName || 'Usuario');
      const rolesDisplay = selected.length > 0 ? selected.join(', ') : 'Ninguno (Usuario)';

      const cardText =
        `👑 <b>PANEL DE ASIGNACIÓN DE STAFF</b>\n\n` +
        `• <b>Usuario:</b> ${userTag} (<b>${nameFormatted}</b>)\n` +
        `• <b>ID:</b> <code>${targetId}</code>\n` +
        `• <b>Roles Seleccionados:</b> <b>${rolesDisplay}</b>\n\n` +
        `${SYM.THIN_LINE}\n` +
        `<i>Toca los roles que deseas activar o desactivar:</i>`;

      const kb = buildRolesKeyboard(targetId, selected);
      await ctx.editMessageText(cardText, { parse_mode: 'HTML', reply_markup: kb });
    } catch (err) {
      console.error('⟡ Error en staff_back_roles:', err.message);
    }
  });

  // ── Callback: Asignar Tag Predefinido y Guardar ──
  bot.callbackQuery(/^staff_set_preset_tag:(\d+):(.+)$/, requireOwner(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1]);
      const selectedRoleTag = ctx.match[2].toUpperCase();
      const adminId = ctx.from.id;

      const wizard = (await redisDb.getCache(`staff_wizard:${adminId}`)) || {};
      const selectedRoles = wizard.selectedRoles || [selectedRoleTag];
      const customTag = getRolePresetTag(selectedRoleTag);

      await finishStaffAssignment(ctx, targetId, wizard.username, wizard.firstName, selectedRoles, customTag);
    } catch (err) {
      console.error('⟡ Error en staff_set_preset_tag:', err.message);
    }
  });

  // ── Callback: Pedir Tag Personalizado por Texto ──
  bot.callbackQuery(/^staff_custom_tag_prompt:(\d+)$/, requireOwner(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1]);
      const adminId = ctx.from.id;

      const wizard = (await redisDb.getCache(`staff_wizard:${adminId}`)) || {};
      wizard.step = 'INPUT_CUSTOM_TAG';
      await redisDb.setCache(`staff_wizard:${adminId}`, wizard, 600);

      await ctx.answerCallbackQuery();

      const userTag = wizard.username ? `<code>@${wizard.username}</code>` : '<i>Sin @username</i>';
      const nameFormatted = escapeHtml(wizard.firstName || 'Usuario');

      const cardText =
        `✍️ <b>ESCRIBE EL TAG PERSONALIZADO</b>\n\n` +
        `• <b>Usuario:</b> ${userTag} (<b>${nameFormatted}</b>)\n` +
        `• <b>Roles:</b> <b>${wizard.selectedRoles.join(', ')}</b>\n\n` +
        `Envía por este chat el texto del tag para los grupos (máximo 16 caracteres, ej: <code>Co-Owner & Mediador</code> o <code>Trato Admin</code>).\n\n` +
        `<i>(Tu mensaje será eliminado automáticamente para mantener limpio el chat).</i>`;

      const kb = new InlineKeyboard()
        .text('VOLVER A OPCIONES', `staff_roles_continue:${targetId}`).primary()
        .row()
        .text('CANCELAR', 'staff_cancel').danger();

      await ctx.editMessageText(cardText, { parse_mode: 'HTML', reply_markup: kb });
    } catch (err) {
      console.error('⟡ Error en staff_custom_tag_prompt:', err.message);
    }
  });

  // ── Listener de Texto para Tag Personalizado (Con Auto-Limpieza) ──
  bot.on('message:text', async (ctx, next) => {
    try {
      const adminId = ctx.from?.id;
      if (!adminId || ctx.chat.type !== 'private') return next();

      const wizard = await redisDb.getCache(`staff_wizard:${adminId}`);
      if (!wizard || wizard.step !== 'INPUT_CUSTOM_TAG') return next();

      const text = (ctx.message.text || '').trim();
      if (text.startsWith('/')) return next();

      // Borrar mensaje del admin para mantener chat limpio
      try {
        await ctx.deleteMessage();
      } catch { }

      const cleanTag = text.slice(0, 16);
      const targetId = wizard.targetId;
      const selectedRoles = wizard.selectedRoles || [];

      await finishStaffAssignment(
        ctx,
        targetId,
        wizard.username,
        wizard.firstName,
        selectedRoles,
        cleanTag,
        wizard.masterMessageId
      );
    } catch (err) {
      console.error('⟡ Error en listener de tag personalizado:', err.message);
      return next();
    }
  });

  // ── Callback: Confirmar Remover Staff ──
  bot.callbackQuery(/^staff_remove_confirm:(\d+)$/, requireOwner(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1]);
      const adminId = ctx.from.id;

      const wizard = (await redisDb.getCache(`staff_wizard:${adminId}`)) || {};
      const userTag = wizard.username ? `<code>@${wizard.username}</code>` : '<i>Sin @username</i>';
      const nameFormatted = escapeHtml(wizard.firstName || 'Usuario');

      const kb = new InlineKeyboard()
        .text('CONFIRMAR REMOVER STAFF', `staff_remove_do:${targetId}`).danger()
        .row()
        .text('VOLVER', `staff_back_roles:${targetId}`).primary();

      await ctx.editMessageText(
        `⚠️ <b>CONFIRMAR REMOCIÓN DE STAFF</b>\n\n` +
        `• <b>Usuario:</b> ${userTag} (<b>${nameFormatted}</b>)\n` +
        `• <b>ID:</b> <code>${targetId}</code>\n\n` +
        `¿Deseas remover a este usuario del Staff oficial y revocar todos sus permisos de Administrador en los grupos?`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    } catch (err) {
      console.error('⟡ Error en staff_remove_confirm:', err.message);
    }
  });

  // ── Callback: Ejecutar Remoción Definitiva de Staff ──
  bot.callbackQuery(/^staff_remove_do:(\d+)$/, requireOwner(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1]);
      const adminId = ctx.from.id;

      await ctx.answerCallbackQuery({ text: 'Removiendo del Staff...' });

      // 1. Eliminar de base de datos
      await db.removeStaff(targetId);

      // 2. Revocar permisos de Administrador en grupos registrados
      try {
        const groups = await db.getAllGroups();
        for (const grp of groups) {
          if (grp.chat_id && grp.type !== 'channel') {
            await revokeTelegramAdminRights(ctx.api, grp.chat_id, targetId);
          }
        }
      } catch { }

      await redisDb.clearCache(`staff_wizard:${adminId}`);

      const adminMention = mentionFromData(ctx.from.id, ctx.from.username, ctx.from.first_name);

      await ctx.editMessageText(
        `🛡️ <b>STAFF REMOVIDO CON ÉXITO</b>\n\n` +
        `• <b>ID:</b> <code>${targetId}</code>\n` +
        `• <b>Estado:</b> Usuario Normal (Permisos de Administrador revocados)\n\n` +
        `${SYM.THIN_LINE}\n` +
        `<i>Modificado por: ${adminMention}</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en staff_remove_do:', err.message);
    }
  });

  // ── Callback: Cancelar ──
  bot.callbackQuery('staff_cancel', async (ctx) => {
    try {
      const adminId = ctx.from.id;
      await redisDb.clearCache(`staff_wizard:${adminId}`);
      await ctx.answerCallbackQuery({ text: 'Operación cancelada.' });
      await ctx.editMessageText(`✗ <b>Operación de Staff cancelada.</b>`, { parse_mode: 'HTML' });
    } catch { }
  });
}

/**
 * Guarda los roles y tag en BD, aplica permisos en grupos y edita el mensaje principal.
 */
async function finishStaffAssignment(ctx, targetId, username, firstName, selectedRoles, customTag, customMasterId = null) {
  const adminId = ctx.from.id;
  const rolesStr = selectedRoles.join(', ');

  // 1. Guardar en Base de Datos
  await db.setStaffRole(targetId, username, firstName, rolesStr, adminId, customTag);

  // 2. Aplicar permisos en grupos registrados
  try {
    const groups = await db.getAllGroups();
    for (const grp of groups) {
      if (grp.chat_id && grp.type !== 'channel') {
        await applyTelegramAdminRights(ctx.api, grp.chat_id, targetId, customTag);
      }
    }
  } catch { }

  await redisDb.clearCache(`staff_wizard:${adminId}`);

  const userTag = username ? `<code>@${username}</code>` : '<i>Sin @username</i>';
  const nameFormatted = escapeHtml(firstName || 'Usuario');
  const adminMention = mentionFromData(ctx.from.id, ctx.from.username, ctx.from.first_name);

  const confirmationText =
    `👑 <b>ASIGNACIÓN DE STAFF COMPLETADA</b> 👑\n\n` +
    `• <b>Usuario:</b> ${userTag} (<b>${nameFormatted}</b>)\n` +
    `• <b>ID:</b> <code>${targetId}</code>\n` +
    `• <b>Roles Asignados:</b> <b>${rolesStr}</b>\n` +
    `• <b>Tag en Grupos:</b> <code>${escapeHtml(customTag)}</code>\n` +
    `• <b>Permisos de Admin:</b> ✓ ACTIVOS EN TELEGRAM\n\n` +
    `${SYM.THIN_LINE}\n` +
    `<i>Promovido por: ${adminMention}</i>`;

  if (customMasterId) {
    try {
      await ctx.api.editMessageText(ctx.chat.id, customMasterId, confirmationText, { parse_mode: 'HTML' });
      return;
    } catch { }
  }

  try {
    await ctx.editMessageText(confirmationText, { parse_mode: 'HTML' });
  } catch {
    await ctx.reply(confirmationText, { parse_mode: 'HTML' });
  }
}

/**
 * Resuelve el target desde reply, ID o @username.
 */
async function resolveTarget(ctx) {
  const target = extractTarget(ctx);
  if (!target) return null;

  if (target.userId) {
    if (!target.username) {
      try {
        const chatInfo = await ctx.api.getChat(target.userId);
        target.username = chatInfo.username || null;
        target.firstName = chatInfo.first_name || null;
      } catch { }
    }
    return target;
  }

  if (target.username) {
    const cleanUsername = target.username.replace(/^@/, '');

    try {
      const chatInfo = await ctx.api.getChat(`@${cleanUsername}`);
      if (chatInfo && chatInfo.id) {
        return {
          userId: chatInfo.id,
          username: chatInfo.username || cleanUsername,
          firstName: chatInfo.first_name || null,
        };
      }
    } catch { }

    try {
      const dbUser = await db.getUserByUsername(cleanUsername);
      if (dbUser && dbUser.user_id) {
        return {
          userId: Number(dbUser.user_id),
          username: dbUser.username || cleanUsername,
          firstName: dbUser.first_name || null,
        };
      }
    } catch { }

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
