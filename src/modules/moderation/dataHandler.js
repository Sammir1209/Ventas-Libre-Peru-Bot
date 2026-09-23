const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const { isEffectiveOwner } = require('../../utils/tenantContext');
const { escapeHtml } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');
const sentinel = require('./sentinel');
const activityTracker = require('./activityTracker');
const logger = require('./logger');
const { toMathBold } = require('../../utils/aesthetic');

/**
 * Convierte la fecha actual a formato superíndice ²³⁻⁰⁹⁻²⁰²⁶
 */
function getSuperscriptDate(date = new Date()) {
  const digits = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻',
  };
  const dStr = date.toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');
  return dStr.split('').map((ch) => digits[ch] || ch).join('');
}

/**
 * Formatea una fecha al estilo: 16/07/2026 23:52:05
 */
function formatDate(d) {
  const date = d ? new Date(d) : new Date();
  if (isNaN(date.getTime())) return 'Desconocido';
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Determina el estado del usuario en el chat / sistema
 */
async function resolveUserStatus(ctx, userId, username) {
  // 1. ¿Está quemado / lista negra?
  try {
    const isBurned = await db.isUserBurned(userId, username);
    if (isBurned) return '🔥 Lista Negra / Quemado';
  } catch {}

  // 2. ¿Es Owner del bot o sub-bot?
  if (isEffectiveOwner(userId, ctx)) {
    return '👑 Propietario / Owner';
  }

  // 3. ¿Es Staff del bot?
  try {
    const staff = await db.getStaffMember(userId, ctx.tenant?.id || null);
    if (staff && staff.role) {
      return `🛡️ Staff (${staff.role})`;
    }
  } catch {}

  // 4. ¿Estado en el grupo de Telegram?
  if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
    try {
      const member = await ctx.api.getChatMember(ctx.chat.id, userId);
      if (member.status === 'creator') return '👑 Creador del Grupo';
      if (member.status === 'administrator') return '🛡️ Administrador';
      if (member.status === 'restricted') return '🔇 Silenciado';
      if (member.status === 'kicked') return '🚫 Baneado';
      if (member.status === 'left') return '🚪 No está en el grupo';
      return '👤 Miembro';
    } catch {}
  }

  return '👤 Miembro';
}

/**
 * Verifica si quien ejecuta el comando o presiona un botón tiene permisos de Staff/Admin
 */
async function canModerate(ctx, senderId) {
  if (!senderId) return false;
  if (isEffectiveOwner(senderId, ctx)) return true;
  try {
    const staff = await db.getStaffMember(senderId, ctx.tenant?.id || null);
    if (staff) return true;
  } catch {}
  if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
    try {
      const member = await ctx.api.getChatMember(ctx.chat.id, senderId);
      if (['creator', 'administrator'].includes(member.status)) return true;
    } catch {}
  }
  return false;
}

function register(bot) {
  // ── Comando /data [@user | ID | Responder] ──
  bot.command(['data', 'user_data', 'datos'], async (ctx) => {
    try {
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      const senderId = ctx.from.id;

      // Restricción: Solo Administradores y Owners
      const isAuth = await canModerate(ctx, senderId);
      if (!isAuth) {
        if (isGroup) {
          try { await ctx.deleteMessage(); } catch {}
          return;
        }
        return ctx.reply('⚠️ <i>Este comando es de uso exclusivo para Administradores y Owners.</i>', { parse_mode: 'HTML' });
      }

      // Resolver usuario objetivo
      const { target } = await sentinel.resolveTargetAndArgs(ctx, { hasDuration: false });

      if (!target || target.unresolved) {
        return ctx.reply(
          `🖲 <b>PANEL DE CONTROL RÁPIDO</b>\n` +
          `──────\n` +
          `<b>Uso:</b> <code>/data [@usuario | ID | responder]</code>\n\n` +
          `<i>Permite inspeccionar a un miembro con acciones inmediatas de moderación.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      const targetId = target.userId;
      const targetUser = target.username ? `@${target.username}` : 'Sin username';
      const targetName = target.firstName || 'Usuario';

      // Enlace directo al perfil
      const profileLink = target.username
        ? `https://t.me/${target.username}`
        : `tg://user?id=${targetId}`;

      // Estado del usuario
      const status = await resolveUserStatus(ctx, targetId, target.username);

      // Fecha de ingreso o registro
      let joinedDate = new Date();
      try {
        const pending = await db.getPendingVerification(ctx.chat.id, targetId);
        if (pending && pending.joined_at) {
          joinedDate = new Date(pending.joined_at);
        } else {
          const userRec = await db.getUser(targetId);
          if (userRec && userRec.created_at) {
            joinedDate = new Date(userRec.created_at);
          }
        }
      } catch {}
      // Actividad en mensajes
      const activity = await activityTracker.getUserActivity(ctx.chat.id, targetId);

      // Título de la comunidad
      const communityName = (ctx.tenant?.community_name || 'VENTAS LIBRES PERÚ').toUpperCase();
      const dateFormatted = getSuperscriptDate();

      // Construcción del mensaje con estética oficial de corchetes unicode
      const messageText =
        `🖲 <b>[${escapeHtml(communityName)} - PANEL DE CONTROL]</b>\n` +
        `══════════════════════════════\n\n` +
        `〖☁〗 <b>Nombre:</b> ${escapeHtml(targetName)}\n` +
        `〖ϟ〗 <b>ID:</b> <code>${targetId}</code>\n` +
        `〖♝〗 <b>User:</b> ${escapeHtml(targetUser)}\n` +
        `〖✦〗 <b>Link:</b> <a href="${profileLink}">Presiona aquí</a>\n` +
        `〖☾〗 <b>Estado:</b> ${status}\n` +
        `〖⏱️〗 <b>Unido:</b> ${formatDate(joinedDate)}\n` +
        `〖✉️〗 <b>Mensajes:</b> ${activity.count}\n` +
        `〖💬〗 <b>Último Mensaje:</b> ${escapeHtml(activity.lastMessage)}\n\n` +
        `──────────────────\n` +
        `🔰 <b>Panel de control rápido:</b>\n\n` +
        `──────\n` +
        `${dateFormatted}`;

      // Botones con estilo de letra negrita matemática y colores nativos (primary, success, danger)
      const kb = new InlineKeyboard()
        .url(`👤 ${toMathBold('Perfil ↗')}`, profileLink).primary()
        .text(`🛡️ ${toMathBold('Verificar')}`, `data_act:verify:${targetId}`).success()
        .row()
        .text(`🔇 ${toMathBold('Mutear')}`, `data_act:mute:${targetId}`).primary()
        .text(`🚫 ${toMathBold('Ban')}`, `data_act:ban:${targetId}`).danger()
        .row()
        .text(`⚠️ ${toMathBold('Blacklist')}`, `data_act:burn:${targetId}`).primary();

      await ctx.reply(messageText, {
        parse_mode: 'HTML',
        reply_markup: kb,
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      console.error('⟡ Error en comando /data:', err.message);
    }
  });

  // ── Botón: Verificar antecedentes ──
  bot.callbackQuery(/^data_act:verify:(\d+)$/, async (ctx) => {
    try {
      const targetId = Number(ctx.match[1]);
      const isBurned = await db.isUserBurned(targetId);

      if (isBurned) {
        const burnedInfo = await db.getBurnedUserInfo(targetId);
        const reason = burnedInfo?.reason || 'Estafador reportado en lista negra';
        return ctx.answerCallbackQuery({
          text: `🚨 ¡ALERTA! Usuario FICHADO en Lista Negra / GBan.\nMotivo: ${reason.slice(0, 100)}`,
          show_alert: true,
        });
      }

      const warnings = await db.getWarnings(targetId, ctx.chat.id);
      const warnCount = warnings?.length || 0;

      return ctx.answerCallbackQuery({
        text: `✓ Usuario LIMPIO: Sin registros de estafa en la red comunitaria.\nAdvertencias activas en este grupo: ${warnCount}`,
        show_alert: true,
      });
    } catch (err) {
      console.warn('⟡ Error en data_act:verify:', err.message);
      await ctx.answerCallbackQuery({ text: 'Error al verificar antecedentes.' });
    }
  });

  // ── Botón: Mutear ──
  bot.callbackQuery(/^data_act:mute:(\d+)$/, async (ctx) => {
    try {
      const callerId = ctx.from.id;
      const targetId = Number(ctx.match[1]);

      // Verificar permisos del moderador
      const canMod = await canModerate(ctx, callerId);
      if (!canMod) {
        return ctx.answerCallbackQuery({ text: '❌ No tienes permisos para moderar.', show_alert: true });
      }

      // No sancionar a Owners
      if (isEffectiveOwner(targetId, ctx)) {
        return ctx.answerCallbackQuery({ text: '❌ No se puede sancionar a un Propietario (Owner).', show_alert: true });
      }

      // Aplicar mute en Telegram
      await ctx.api.restrictChatMember(ctx.chat.id, targetId, {
        can_send_messages: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
      });

      await ctx.answerCallbackQuery({ text: `🔇 Usuario (${targetId}) silenciado con éxito.`, show_alert: true });
      await db.addModLog('MUTE', callerId, targetId, ctx.chat.id, 'Silenciado desde panel /data');
      await logger.sendLog(ctx.api, 'MUTE', ctx.from, targetId, ctx.chat.title, 'Silenciado desde panel rápido /data');
    } catch (err) {
      console.warn('⟡ Error en data_act:mute:', err.message);
      await ctx.answerCallbackQuery({ text: `❌ Error al silenciar: ${err.message}`, show_alert: true });
    }
  });

  // ── Botón: Ban ──
  bot.callbackQuery(/^data_act:ban:(\d+)$/, async (ctx) => {
    try {
      const callerId = ctx.from.id;
      const targetId = Number(ctx.match[1]);

      const canMod = await canModerate(ctx, callerId);
      if (!canMod) {
        return ctx.answerCallbackQuery({ text: '❌ No tienes permisos para moderar.', show_alert: true });
      }

      if (isEffectiveOwner(targetId, ctx)) {
        return ctx.answerCallbackQuery({ text: '❌ No se puede sancionar a un Propietario (Owner).', show_alert: true });
      }

      await ctx.api.banChatMember(ctx.chat.id, targetId);
      await ctx.answerCallbackQuery({ text: `🚫 Usuario (${targetId}) expulsado y bloqueado del grupo.`, show_alert: true });
      await db.addModLog('BAN', callerId, targetId, ctx.chat.id, 'Baneado desde panel /data');
      await logger.sendLog(ctx.api, 'BAN', ctx.from, targetId, ctx.chat.title, 'Baneado desde panel rápido /data');
    } catch (err) {
      console.warn('⟡ Error en data_act:ban:', err.message);
      await ctx.answerCallbackQuery({ text: `❌ Error al banear: ${err.message}`, show_alert: true });
    }
  });

  // ── Botón: Blacklist / Quemar ──
  bot.callbackQuery(/^data_act:burn:(\d+)$/, async (ctx) => {
    try {
      const callerId = ctx.from.id;
      const targetId = Number(ctx.match[1]);

      const canMod = await canModerate(ctx, callerId);
      if (!canMod) {
        return ctx.answerCallbackQuery({ text: '❌ No tienes permisos para moderar.', show_alert: true });
      }

      const isBurned = await db.isUserBurned(targetId);
      if (isBurned) {
        return ctx.answerCallbackQuery({
          text: `⚠️ Este usuario ya se encuentra registrado en la Lista Negra / GBan.`,
          show_alert: true,
        });
      }

      return ctx.answerCallbackQuery({
        text: `⚠️ Para registrar a este usuario con pruebas oficiales, usa el comando:\n/quemar ${targetId}`,
        show_alert: true,
      });
    } catch (err) {
      console.warn('⟡ Error en data_act:burn:', err.message);
      await ctx.answerCallbackQuery({ text: 'Error al consultar lista negra.' });
    }
  });
}

module.exports = {
  register,
};
