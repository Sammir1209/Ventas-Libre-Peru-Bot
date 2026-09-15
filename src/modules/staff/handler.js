const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const config = require('../../config/env');
const { ROLES, SYM } = require('../../config/constants');
const { requireOwner } = require('../../middleware/auth');
const { extractTarget, safeEditMessage } = require('../../utils/helpers');
const { mentionFromData, escapeHtml } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');

// ══════
// ⟡ Módulo 3: Staff — Sistema de Roles Múltiples y Tags Dinámicos
// ══════

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

  selectedRoles.forEach((r, idx) => {
    kb.text(`TAG: ${r}`, `staff_set_preset_tag:${targetId}:${r}`).primary();
    if (idx % 2 === 1) {
      kb.row();
    }
  });

  if (selectedRoles.length % 2 !== 0) {
    kb.row();
  }

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

      // Obtener roles actuales del usuario en BD respetando el tenant del bot actual
      let currentRoles = [];
      let currentTitle = null;
      const tenantId = ctx.tenant?.id || null;
      try {
        const staffMember = await db.getStaffMember(target.userId, tenantId);
        if (staffMember && staffMember.role) {
          currentRoles = staffMember.role
            .split(',')
            .map((r) => r.trim().toUpperCase())
            .filter((r) => AVAILABLE_ROLES.includes(r));
          currentTitle = staffMember.custom_title || null;
        }
      } catch { }

      // Si no tiene roles y es owner en este bot/sub-bot
      const effectiveOwners = ctx.tenant?.owner_ids || config.OWNER_IDS || [];
      if (currentRoles.length === 0 && effectiveOwners.some((id) => Number(id) === Number(target.userId))) {
        currentRoles = ['OWNER'];
      }

      const initialSelected = currentRoles.length > 0 ? [...currentRoles] : [];

      const userTag = target.username ? `<code>@${target.username}</code>` : '<i>Sin @username</i>';
      const nameFormatted = escapeHtml(target.firstName || 'Usuario');
      const rolesDisplay = initialSelected.length > 0 ? initialSelected.join(', ') : 'Ninguno (Usuario)';

      const cardText =
        `⟡ <b>GESTIÓN DE STAFF</b> ⊱ <code>ASIGNACIÓN DE ROLES</code> ⊰\n` +
        `══════\n\n` +
        `▸ <b>Usuario:</b> ${userTag} (<b>${nameFormatted}</b>)\n` +
        `▸ <b>ID Numérico:</b> <code>${target.userId}</code>\n` +
        `▸ <b>Roles Seleccionados:</b> <b>${rolesDisplay}</b>\n\n` +
        `──────\n` +
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
          tenantId: tenantId,
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
          `⟡ <b>DEGRADACIÓN DE STAFF</b> ⊱ <code>USO DEL COMANDO</code> ⊰\n` +
          `══════\n\n` +
          `▸ <b>Uso:</b> <code>/demote [ID, @username o responder a mensaje]</code>`,
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
        `⟡ <b>REVOCACIÓN DE STAFF</b> ⊱ <code>CONFIRMACIÓN</code> ⊰\n` +
        `══════\n\n` +
        `▸ <b>Usuario:</b> ${userTag} (<b>${nameFormatted}</b>)\n` +
        `▸ <b>ID Numérico:</b> <code>${target.userId}</code>\n\n` +
        `──────\n` +
        `¿Deseas revocar todos los permisos de Administrador y remover al usuario del Staff?`,
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
      await safeEditMessage(ctx, cardText, { parse_mode: 'HTML', reply_markup: kb });
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
        `⟡ <b>DISTINTIVO OFICIAL</b> ⊱ <code>TAG EN GRUPOS</code> ⊰\n` +
        `══════\n\n` +
        `▸ <b>Usuario:</b> ${userTag} (<b>${nameFormatted}</b>)\n` +
        `▸ <b>Jerarquía:</b> <b>${rolesDisplay}</b>\n\n` +
        `──────\n` +
        `<i>Selecciona el título oficial que se mostrará en los grupos o escribe uno personalizado:</i>`;

      const kb = buildTagKeyboard(targetId, selected);
      await safeEditMessage(ctx, cardText, { parse_mode: 'HTML', reply_markup: kb });
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
      await safeEditMessage(ctx, cardText, { parse_mode: 'HTML', reply_markup: kb });
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
      wizard.masterMessageId = ctx.callbackQuery?.message?.message_id || wizard.masterMessageId;
      wizard.chatId = ctx.chat?.id || wizard.chatId;
      await redisDb.setCache(`staff_wizard:${adminId}`, wizard, 600);

      await ctx.answerCallbackQuery();

      const userTag = wizard.username ? `<code>@${wizard.username}</code>` : '<i>Sin @username</i>';
      const nameFormatted = escapeHtml(wizard.firstName || 'Usuario');

      const cardText =
        `✍️ <b>ESCRIBE EL TAG PERSONALIZADO</b>\n\n` +
        `• <b>Usuario:</b> ${userTag} (<b>${nameFormatted}</b>)\n` +
        `• <b>Roles:</b> <b>${(wizard.selectedRoles || []).join(', ')}</b>\n\n` +
        `Envía por este chat el texto del tag para los grupos (máximo 16 caracteres, ej: <code>Co-Owner & Mediador</code> o <code>Trato Admin</code>).\n\n` +
        `<i>(Tu mensaje será eliminado automáticamente para mantener limpio el chat).</i>`;

      const kb = new InlineKeyboard()
        .text('VOLVER A OPCIONES', `staff_roles_continue:${targetId}`).primary()
        .row()
        .text('CANCELAR', 'staff_cancel').danger();

      await safeEditMessage(ctx, cardText, { parse_mode: 'HTML', reply_markup: kb });
    } catch (err) {
      console.error('⟡ Error en staff_custom_tag_prompt:', err.message);
    }
  });

  // ── Listener de Texto para Tag Personalizado (Con Auto-Limpieza en Grupos y Privado) ──
  bot.on('message:text', async (ctx, next) => {
    try {
      const adminId = ctx.from?.id;
      if (!adminId) return next();

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

      await safeEditMessage(
        ctx,
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
      const tenantId = ctx.tenant?.id || null;

      await ctx.answerCallbackQuery({ text: 'Removiendo del Staff...' });

      // 1. Eliminar de base de datos aislada
      await db.removeStaff(targetId, tenantId);

      // 2. Revocar permisos de Administrador en grupos registrados de este bot
      try {
        const groups = await db.getAllGroups(tenantId);
        for (const grp of groups) {
          if (grp.chat_id && grp.type !== 'channel') {
            await revokeTelegramAdminRights(ctx.api, grp.chat_id, targetId);
          }
        }
      } catch { }

      await redisDb.clearCache(`staff_wizard:${adminId}`);

      const adminMention = mentionFromData(ctx.from.id, ctx.from.username, ctx.from.first_name);

      await safeEditMessage(
        ctx,
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

  // ── Comando /web y /panel: Acceso al Portal Web Secreto para Owners ──
  bot.command(['web', 'panel', 'dashboard'], async (ctx) => {
    try {
      const senderId = ctx.from.id;
      const tenantId = ctx.tenant?.id || null;
      const domain = process.env.RENDER_EXTERNAL_URL || 'https://ventas-libre-peru-bot.onrender.com';

      // ── MODO SUB-BOT: Acceso al Portal Dedicado en Blanco y Negro ──
      if (tenantId && ctx.tenant) {
        const effectiveOwners = ctx.tenant.owner_ids || [];
        const isTenantOwner = effectiveOwners.some((id) => Number(id) === Number(senderId));
        let hasTenantPerm = isTenantOwner;

        if (!hasTenantPerm) {
          const staffMember = await db.getStaffMember(senderId, tenantId);
          if (staffMember && (staffMember.role.includes('OWNER') || staffMember.role.includes('CO-OWNER'))) {
            hasTenantPerm = true;
          }
        }

        if (ctx.chat.type !== 'private') {
          try { await ctx.deleteMessage(); } catch {}
        }

        if (!hasTenantPerm) {
          if (ctx.chat.type === 'private') {
            return ctx.reply('⚠️ <i>Este comando es exclusivo para los Owners autorizados de este sub-bot.</i>', { parse_mode: 'HTML' });
          }
          return;
        }

        // Generar credenciales con Zero-Trust para el portal del sub-bot
        const panelHandler = require('../security/panelHandler');
        const { sessionToken, tempPassword } = await panelHandler.generatePanelSession(senderId, 'OWNER SUB-BOT', {
          isGlobalOwner: false,
          tenantId: tenantId,
          communityName: ctx.tenant.community_name || 'Mi Comunidad',
          theme: 'client',
        });

        const subBotSlug = ctx.tenant.bot_username ? ctx.tenant.bot_username.replace(/^@/, '') : ctx.tenant.id;
        const tenantAdminUrl = `${domain}/portal/?slug=${subBotSlug}&token=${sessionToken}&view=admin`;

        const subBotMsg =
          `⟡ <b>PANEL DE CONTROL ADMINISTRATIVO</b> ⊱ <code>${escapeHtml(ctx.tenant.community_name)}</code> ⊰\n` +
          `══════\n\n` +
          `Hola <b>${escapeHtml(ctx.from.first_name)}</b>, se han generado tus credenciales exclusivas de administración:\n\n` +
          `🌐 <b>Enlace de tu Panel de Control:</b>\n` +
          `<code>${tenantAdminUrl}</code>\n\n` +
          `🆔 <b>Tu ID de Telegram:</b>\n` +
          `<code>${senderId}</code>\n\n` +
          `🔑 <b>Tu Contraseña Temporal:</b>\n` +
          `<code>${tempPassword}</code>\n\n` +
          `⏱️ <b>Vigencia de Sesión:</b> <code>24 Horas</code>\n` +
          `──────\n` +
          `🔐 <i>Usa el botón de abajo para ingresar con 1 toque o ingresa con tu ID y Contraseña en la web.</i>`;

        const kb = new InlineKeyboard().url('🚀 ABRIR MI PANEL DE CONTROL', tenantAdminUrl);

        try {
          await ctx.api.sendMessage(senderId, subBotMsg, {
            parse_mode: 'HTML',
            reply_markup: kb,
            link_preview_options: { is_disabled: true },
          });
          if (ctx.chat.type !== 'private') {
            const sent = await ctx.reply(`👑 <i>${escapeHtml(ctx.from.first_name)}, te he enviado las credenciales de tu Panel Web por privado.</i>`, { parse_mode: 'HTML' });
            setTimeout(() => ctx.api.deleteMessage(ctx.chat.id, sent.message_id).catch(() => {}), 6000);
          }
        } catch {
          if (ctx.chat.type !== 'private') {
            await ctx.reply(`⚠️ <i>No pude enviarte los datos por privado. Inicia el bot en privado primero (/start) y vuelve a ejecutar /panel.</i>`, { parse_mode: 'HTML' });
          } else {
            await ctx.reply(subBotMsg, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
          }
        }
        return;
      }

      // ── MODO BOT PRINCIPAL: Portal Maestro Ventas Libres Perú ──
      const isOwner = config.OWNER_IDS.includes(senderId) || senderId === 7849224682 || senderId === 7794982496;
      let hasPerm = isOwner;

      if (!hasPerm) {
        const staffMember = await db.getStaffMember(senderId, null);
        if (staffMember && (staffMember.role.includes('OWNER') || staffMember.role.includes('CO-OWNER'))) {
          hasPerm = true;
        }
      }

      // Si se envía en un grupo, borrar el mensaje para no dejar rastro
      if (ctx.chat.type !== 'private') {
        try { await ctx.deleteMessage(); } catch {}
      }

      if (!hasPerm) {
        if (ctx.chat.type === 'private') {
          return ctx.reply('⚠️ <i>Este comando es exclusivo para los Owners oficiales del sistema.</i>', { parse_mode: 'HTML' });
        }
        return;
      }

      const secretUrl = `${domain}${config.DASHBOARD_PATH}`;
      const masterKey = config.ADMIN_KEY;

      const webMessage =
        `🔐 <b>ACCESO AL PANEL WEB SAAS — VENTAS LIBRES PERÚ</b>\n\n` +
        `Hola, <b>${escapeHtml(ctx.from.first_name)}</b>. Aquí tienes tus credenciales de acceso seguro al gestor de sub-bots:\n\n` +
        `🌐 <b>URL del Portal Secreto:</b>\n` +
        `<code>${secretUrl}</code>\n\n` +
        `🆔 <b>Tu ID de Telegram:</b>\n` +
        `<code>${senderId}</code>\n\n` +
        `🔑 <b>Clave Maestra (Master Key):</b>\n` +
        `<code>${masterKey}</code>\n\n` +
        `⚠️ <b>Seguridad:</b> <i>No compartas este enlace ni tu clave con nadie. El acceso está protegido por IP y rate limiting.</i>`;

      // Enviar por privado
      try {
        await ctx.api.sendMessage(senderId, webMessage, { parse_mode: 'HTML' });
        if (ctx.chat.type !== 'private') {
          const sent = await ctx.reply(`👑 <i>${escapeHtml(ctx.from.first_name)}, te he enviado los datos de acceso al Panel Web por privado.</i>`, { parse_mode: 'HTML' });
          setTimeout(() => ctx.api.deleteMessage(ctx.chat.id, sent.message_id).catch(() => {}), 6000);
        }
      } catch (dmErr) {
        if (ctx.chat.type !== 'private') {
          await ctx.reply(`⚠️ <i>No pude enviarte los datos por privado. Inicia el bot en privado primero (/start) y vuelve a ejecutar /web.</i>`, { parse_mode: 'HTML' });
        } else {
          await ctx.reply(webMessage, { parse_mode: 'HTML' });
        }
      }
    } catch (err) {
      console.error('⟡ Error en comando /web:', err.message);
    }
  });

  // ── Callback: Cancelar ──
  bot.callbackQuery('staff_cancel', async (ctx) => {
    try {
      const adminId = ctx.from.id;
      await redisDb.clearCache(`staff_wizard:${adminId}`);
      await ctx.answerCallbackQuery({ text: 'Operación cancelada.' });
      await safeEditMessage(ctx, `✗ <b>Operación de Staff cancelada.</b>`, { parse_mode: 'HTML' });
    } catch { }
  });

  // ── Evento: Bienvenida Oficial al Staff cuando entra un nuevo miembro promovido ──
  bot.on(['message:new_chat_members', 'chat_member'], async (ctx, next) => {
    try {
      const chatId = ctx.chat?.id;
      // Solo actuar si el evento ocurre en el grupo oficial del Staff
      if (!config.STAFF_CHAT_ID || chatId !== config.STAFF_CHAT_ID) {
        return next();
      }

      let membersToCheck = [];
      if (ctx.message?.new_chat_members) {
        membersToCheck = ctx.message.new_chat_members;
      } else if (ctx.chatMember) {
        const update = ctx.chatMember;
        const oldStatus = update.old_chat_member?.status;
        const newStatus = update.new_chat_member?.status;
        if ((oldStatus === 'left' || oldStatus === 'kicked' || !oldStatus) && newStatus === 'member') {
          if (update.new_chat_member?.user) {
            membersToCheck.push(update.new_chat_member.user);
          }
        }
      }

      if (membersToCheck.length === 0) return next();

      for (const member of membersToCheck) {
        if (member.is_bot) continue;

        // Comprobar si fue promovido recientemente
        let promoData = await redisDb.getCache(`recent_staff_promoted:${member.id}`);

        // Si no está en redis, verificar si tiene rol de staff registrado en BD
        if (!promoData) {
          const dbStaff = await db.getStaffMember(member.id);
          if (dbStaff && dbStaff.role) {
            promoData = {
              userId: member.id,
              username: member.username || dbStaff.username,
              firstName: member.first_name || dbStaff.first_name,
              roles: dbStaff.role,
              customTag: dbStaff.custom_title || 'Staff',
              promotedBy: null,
            };
          }
        }

        if (promoData) {
          // Candado de debounce para no duplicar la bienvenida en el staff
          const greetedKey = `greeted_staff:${chatId}:${member.id}`;
          const alreadyGreeted = await redisDb.getCache(greetedKey);
          if (alreadyGreeted) continue;
          await redisDb.setCache(greetedKey, true, 86400 * 30); // 30 días

          const userTag = promoData.username ? `@${promoData.username}` : `<b>${escapeHtml(promoData.firstName || member.first_name)}</b>`;
          const communityTitle = escapeHtml(ctx.chat.title || 'Ventas Libres Perú');
          const rolesStr = promoData.roles || 'Staff';
          const tagStr = escapeHtml(promoData.customTag || 'Staff');

          let promotedByText = '';
          if (promoData.promotedBy && promoData.promotedBy.name) {
            const adminTag = promoData.promotedBy.username ? `@${promoData.promotedBy.username}` : `<b>${escapeHtml(promoData.promotedBy.name)}</b>`;
            promotedByText = `• <b>Promovido por:</b> ${adminTag}\n`;
          }

          const staffWelcomeCard =
            `${SYM.DIVIDER}\n` +
            `👑 <b>¡NUEVO INTEGRANTE EN EL EQUIPO OFICIAL!</b> 👑\n` +
            `${SYM.DIVIDER}\n\n` +
            `Demos una gran bienvenida a la familia de <b>${communityTitle}</b>:\n\n` +
            `• <b>Miembro:</b> ${userTag} (<code>${member.id}</code>)\n` +
            `• <b>Rango / Rol:</b> <b>${rolesStr}</b>\n` +
            `• <b>Tag en Grupos:</b> <code>${tagStr}</code>\n` +
            `${promotedByText}\n` +
            `${SYM.THIN_LINE}\n` +
            `⚔ <i>Un honor tenerte en las filas de la administración. La seguridad y transparencia de la comunidad están en nuestras manos. ¡Éxitos!</i> ✨`;

          const sendOpts = { parse_mode: 'HTML' };
          if (config.STAFF_THREAD_ID) {
            sendOpts.message_thread_id = config.STAFF_THREAD_ID;
          }

          try {
            await ctx.api.sendMessage(chatId, staffWelcomeCard, sendOpts);
          } catch (sendErr) {
            // Fallback sin thread_id si el topic fue cerrado o no aplica
            await ctx.api.sendMessage(chatId, staffWelcomeCard, { parse_mode: 'HTML' });
          }
        }
      }

      return next();
    } catch (err) {
      console.error('⟡ Error en bienvenida de nuevo staff al grupo:', err.message);
      return next();
    }
  });
}

/**
 * Guarda los roles y tag en BD, aplica permisos en grupos y edita el mensaje principal.
 */
async function finishStaffAssignment(ctx, targetId, username, firstName, selectedRoles, customTag, customMasterId = null) {
  const adminId = ctx.from.id;
  const rolesStr = selectedRoles.join(', ');
  const tenantId = ctx.tenant?.id || null;

  // 1. Guardar en Base de Datos aislada por tenant
  await db.setStaffRole(targetId, username, firstName, rolesStr, adminId, customTag, tenantId);

  // 2. Aplicar permisos en grupos registrados de este tenant
  try {
    const groups = await db.getAllGroups(tenantId);
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
    `⟡ <b>ASIGNACIÓN DE STAFF</b> ⊱ <code>CONFIGURACIÓN COMPLETADA</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Usuario:</b> ${userTag} (<b>${nameFormatted}</b>)\n` +
    `▸ <b>ID Numérico:</b> <code>${targetId}</code>\n` +
    `▸ <b>Jerarquía Asignada:</b> <b>${rolesStr}</b>\n` +
    `▸ <b>Distintivo Oficial:</b> <code>${escapeHtml(customTag)}</code>\n` +
    `▸ <b>Permisos de Administrador:</b> ⊱ <code>ACTIVOS EN TELEGRAM ✓</code> ⊰\n\n` +
    `──────\n` +
    `🛡️ <i>Promovido por: ${adminMention}</i>`;

  // 3. Determinar enlace del grupo de Staff y nombre de la comunidad
  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
  let staffInviteLink = null;
  if (tenantId && ctx.tenant) {
    staffInviteLink = ctx.tenant.custom_settings?.staff_invite_link || ctx.tenant.groups_folder_link || null;
  } else {
    staffInviteLink = config.STAFF_INVITE_LINK || 'https://t.me/+IEooR3P_yHVhZTc0';
  }

  // 4. Registrar en Redis al nuevo promovido para bienvenida al entrar
  await redisDb.setCache(
    `recent_staff_promoted:${targetId}`,
    {
      userId: targetId,
      username,
      firstName,
      roles: rolesStr,
      customTag,
      promotedBy: {
        id: ctx.from.id,
        name: ctx.from.first_name,
        username: ctx.from.username,
      },
      promotedAt: new Date().toISOString(),
    },
    86400 * 7 // Disponible durante 7 días
  );

  // 5. Enviar Mensaje Directo (DM / MD) de Bienvenida con enlace oficial de staff correspondiente
  try {
    let dmWelcome =
      `⟡ <b>EQUIPO OFICIAL</b> ⊱ <code>BIENVENIDA AL STAFF</code> ⊰\n` +
      `══════\n\n` +
      `Hola <b>${nameFormatted}</b>, has sido designado oficialmente como parte del equipo de administración de <b>${escapeHtml(communityName)}</b>.\n\n` +
      `▸ <b>Jerarquía / Roles:</b> <code>${rolesStr}</code>\n` +
      `▸ <b>Distintivo Oficial:</b> <code>${escapeHtml(customTag)}</code>\n` +
      `▸ <b>Asignado por:</b> ${adminMention}\n\n` +
      `──────\n`;

    const dmKeyboard = new InlineKeyboard();
    if (staffInviteLink) {
      dmWelcome +=
        `🛡️ <b>Únete de inmediato al Grupo Oficial del Staff:</b>\n` +
        `👉 <a href="${staffInviteLink}"><b>[ ENTRAR AL GRUPO DE STAFF ]</b></a>\n\n`;
      dmKeyboard.url('🛡️ UNIRSE AL GRUPO DE STAFF', staffInviteLink);
    }

    dmWelcome += `<i>¡Bienvenido al Staff de ${escapeHtml(communityName)}! Compromiso, honorabilidad y seguridad para la comunidad.</i>`;

    await ctx.api.sendMessage(targetId, dmWelcome, {
      parse_mode: 'HTML',
      reply_markup: dmKeyboard.inline_keyboard.length > 0 ? dmKeyboard : undefined,
    });
  } catch (dmErr) {
    console.warn(`⟡ Staff DM: No se pudo enviar MD de bienvenida a ${targetId}:`, dmErr.message);
  }

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
