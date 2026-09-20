const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM, ROLES } = require('../../config/constants');
const { getEffectiveOwners } = require('../../middleware/auth');
const { InlineKeyboard } = require('grammy');
const { mentionFromData, formatId, escapeHtml } = require('../../utils/formatting');
const { searchCandidatesInCommunity, resolveTarget } = require('../../utils/helpers');
const sentinel = require('./sentinel');
const logger = require('../../utils/logger');
const userbot = require('../../userbot/client');

const { parseDuration } = sentinel;

// ══════
// ⟡ Módulo: Gestión Estética e Interactiva de Silencio (Mute UI)
// ══════

/**
 * Convierte los dígitos de una fecha (DDMMYYYY) a caracteres superíndice Unicode.
 */
function getSuperscriptDate(date = new Date()) {
  const digits = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  };
  const dStr = date.toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\D/g, '');

  return dStr.split('').map((ch) => digits[ch] || ch).join('');
}

/**
 * Comprueba si un usuario es staff o propietario autorizado para moderar.
 */
async function isAuthorizedStaff(ctx) {
  const userId = ctx.from?.id;
  if (!userId) return false;

  const effectiveOwners = getEffectiveOwners(ctx);
  if (Array.isArray(effectiveOwners) && effectiveOwners.some((id) => Number(id) === Number(userId))) {
    return true;
  }

  const tenantId = ctx.tenant?.id || null;
  const staff = await db.getStaffMember(userId, tenantId);
  return !!(staff && staff.role);
}

/**
 * Comprueba si el objetivo es un Propietario (Owner) que no puede ser silenciado.
 */
function isOwnerTarget(userId, ctx) {
  const effectiveOwners = getEffectiveOwners(ctx);
  return effectiveOwners.some((id) => Number(id) === Number(userId));
}

/**
 * Construye el panel interactivo con opciones de tiempo para silenciar a un usuario.
 */
async function buildMutePanel(ctx, targetUser) {
  const userId = Number(targetUser.userId);
  let username = targetUser.username;
  let firstName = targetUser.firstName;

  if (!username || !firstName) {
    try {
      const u = await db.getUser(userId);
      if (u) {
        if (!username) username = u.username || null;
        if (!firstName) firstName = u.first_name || null;
      }
    } catch {}
  }
  if (!username || !firstName) {
    try {
      const chat = await ctx.api.getChat(userId);
      if (chat) {
        if (!username) username = chat.username || null;
        if (!firstName) firstName = chat.first_name || null;
      }
    } catch {}
  }

  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
  const botLabel = communityName.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || 'Ventas Libres';
  const chatTitle = ctx.chat?.title || 'Grupo Actual';
  const dateFormatted = getSuperscriptDate();

  const nameDisplay = escapeHtml(firstName || 'Usuario');
  const userDisplay = username ? `@${escapeHtml(username)}` : '<i>Sin @username</i>';

  const text =
    `<b>⟡ [${escapeHtml(botLabel)} BOT] GESTIÓN DE SILENCIO (MUTE)</b>\n` +
    `──────\n\n` +
    `👤 <b>Usuario:</b> ${nameDisplay}\n` +
    `🆔 <b>ID:</b> <code>${userId}</code>\n` +
    `🆀 <b>User:</b> ${userDisplay}\n` +
    `📍 <b>Chat:</b> <code>${escapeHtml(chatTitle)}</code>\n\n` +
    `<i>Selecciona la duración para suspender sus permisos de chat:</i>\n` +
    `──────\n` +
    `${dateFormatted}`;

  const kb = new InlineKeyboard()
    .text('⏱ 15m', `mod_mute_exec:${userId}:15m`)
    .text('⏱ 1h', `mod_mute_exec:${userId}:1h`)
    .text('⏱ 12h', `mod_mute_exec:${userId}:12h`)
    .row()
    .text('⏱ 1d', `mod_mute_exec:${userId}:1d`)
    .text('⏱ 7d', `mod_mute_exec:${userId}:7d`)
    .text('🚫 Indefinido', `mod_mute_exec:${userId}:perm`)
    .row()
    .text('🔊 Desilenciar', `mod_unmute_exec:${userId}`)
    .text('✖ Cancelar', 'info_close');

  return { text, keyboard: kb };
}

/**
 * Ejecuta el silenciamiento en el chat de Telegram y devuelve la tarjeta de confirmación.
 */
async function executeMute(ctx, targetUser, durationStr = '1d', reason = 'Moderación') {
  const userId = Number(targetUser.userId);

  if (isOwnerTarget(userId, ctx)) {
    throw new Error('No se puede silenciar a un Propietario (Owner) del sistema.');
  }

  if (ctx.chat.type === 'private') {
    throw new Error('Esta acción solo puede aplicarse dentro de un grupo o comunidad.');
  }

  let durationInfo;
  if (durationStr === 'perm' || durationStr === 'permanente') {
    durationInfo = {
      seconds: 365 * 86400,
      humanReadable: 'Indefinido / Permanente',
      untilDate: Math.floor(Date.now() / 1000) + 365 * 86400,
    };
  } else {
    durationInfo = parseDuration(durationStr) || parseDuration('1d');
  }

  // Ejecutar restricción en Telegram API
  await ctx.api.restrictChatMember(
    ctx.chat.id,
    userId,
    {
      can_send_messages: false,
      can_send_audios: false,
      can_send_documents: false,
      can_send_photos: false,
      can_send_videos: false,
      can_send_video_notes: false,
      can_send_voice_notes: false,
      can_send_polls: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false,
      can_change_info: false,
      can_invite_users: false,
      can_pin_messages: false,
      can_manage_topics: false,
    },
    {
      until_date: durationInfo.untilDate,
      use_independent_chat_permissions: true,
    }
  );

  const targetMention = mentionFromData(userId, targetUser.username, targetUser.firstName);
  const adminName = ctx.from.username ? `@${escapeHtml(ctx.from.username)}` : escapeHtml(ctx.from.first_name || 'Admin');
  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
  const botLabel = communityName.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || 'Ventas Libres';
  const dateFormatted = getSuperscriptDate();

  const text =
    `<b>⟡ [${escapeHtml(botLabel)} BOT] USUARIO SILENCIADO [ ÉXITO ]</b>\n` +
    `──────\n\n` +
    `▸ <b>Usuario:</b> ${targetMention}\n` +
    `▸ <b>ID:</b> <code>${userId}</code>\n` +
    `▸ <b>Duración:</b> <code>${durationInfo.humanReadable}</code>\n` +
    `▸ <b>Motivo:</b> <i>${escapeHtml(reason)}</i>\n` +
    `▸ <b>Moderador:</b> ${adminName}\n\n` +
    `──────\n` +
    `🤐 <i>Permisos de envío de mensajes suspendidos temporalmente.</i>\n` +
    `${dateFormatted}`;

  const kb = new InlineKeyboard()
    .text('🔊 Desilenciar', `mod_unmute_exec:${userId}`)
    .text('👤 Ver Perfil', `info_profile:${userId}`)
    .row()
    .text('✖ Cerrar', 'info_close');

  // Registrar logs de auditoría
  db.addModLog('MUTE', ctx.from.id, userId, ctx.chat.id, `[${durationInfo.humanReadable}] ${reason}`).catch(() => {});
  logger.sendLog(ctx.api, 'MUTE', ctx.from, userId, ctx.chat.title, `[${durationInfo.humanReadable}] ${reason}`).catch(() => {});

  return { text, keyboard: kb };
}

/**
 * Remueve el silencio y reactiva los permisos de mensajería del usuario.
 */
async function executeUnmute(ctx, targetUser) {
  const userId = Number(targetUser.userId);

  if (ctx.chat.type === 'private') {
    throw new Error('Esta acción solo puede aplicarse dentro de un grupo o comunidad.');
  }

  await ctx.api.restrictChatMember(
    ctx.chat.id,
    userId,
    {
      can_send_messages: true,
      can_send_audios: true,
      can_send_documents: true,
      can_send_photos: true,
      can_send_videos: true,
      can_send_video_notes: true,
      can_send_voice_notes: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
      can_invite_users: true,
    },
    {
      use_independent_chat_permissions: true,
    }
  );

  const targetMention = mentionFromData(userId, targetUser.username, targetUser.firstName);
  const adminName = ctx.from.username ? `@${escapeHtml(ctx.from.username)}` : escapeHtml(ctx.from.first_name || 'Admin');
  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
  const botLabel = communityName.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || 'Ventas Libres';
  const dateFormatted = getSuperscriptDate();

  const text =
    `<b>⟡ [${escapeHtml(botLabel)} BOT] SILENCIO REMOVIDO [ ÉXITO ]</b>\n` +
    `──────\n\n` +
    `▸ <b>Usuario:</b> ${targetMention}\n` +
    `▸ <b>ID:</b> <code>${userId}</code>\n` +
    `▸ <b>Moderador:</b> ${adminName}\n\n` +
    `──────\n` +
    `✓ <i>El usuario puede participar y enviar mensajes nuevamente.</i>\n` +
    `${dateFormatted}`;

  const kb = new InlineKeyboard()
    .text('🔇 Volver a Silenciar', `mod_mute_prompt:${userId}`)
    .text('👤 Ver Perfil', `info_profile:${userId}`)
    .row()
    .text('✖ Cerrar', 'info_close');

  db.addModLog('UNMUTE', ctx.from.id, userId, ctx.chat.id, null).catch(() => {});
  logger.sendLog(ctx.api, 'UNMUTE', ctx.from, userId, ctx.chat.title, null).catch(() => {});

  return { text, keyboard: kb };
}

/**
 * Desglosa una consulta en lenguaje natural ("silencia a Carlos 2h spam")
 * para separar el nombre del objetivo, duración y motivo opcional.
 */
function parseMuteArguments(rawText) {
  if (!rawText) return { targetQuery: '', duration: null, reason: 'Moderación' };

  // Remover palabras conectoras iniciales
  let text = rawText
    .replace(/^(?:sil[eé]nciame(?:\s+a)?|silencia(?:\s+a)?|muteale(?:\s+a)?|mutea(?:\s+a)?|mutear(?:\s+a)?|silenciar(?:\s+a)?)\s+/i, '')
    .trim();

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { targetQuery: '', duration: null, reason: 'Moderación' };

  let targetQuery = parts[0];
  let duration = null;
  let reasonParts = [];

  // Revisar si el segundo token es una duración (ej. 15m, 1h, 2d, etc.)
  if (parts.length > 1) {
    const durParsed = parseDuration(parts[1]);
    if (durParsed) {
      duration = parts[1];
      reasonParts = parts.slice(2);
    } else {
      // Podría ser un nombre compuesto ("Carlos Gomez 1h spam")
      // Buscamos si algún token coincide con formato de duración
      let durIndex = -1;
      for (let i = 1; i < parts.length; i++) {
        if (parseDuration(parts[i])) {
          durIndex = i;
          break;
        }
      }
      if (durIndex !== -1) {
        targetQuery = parts.slice(0, durIndex).join(' ');
        duration = parts[durIndex];
        reasonParts = parts.slice(durIndex + 1);
      } else {
        targetQuery = parts.join(' ');
      }
    }
  }

  return {
    targetQuery: targetQuery.trim(),
    duration,
    reason: reasonParts.join(' ') || 'Moderación',
  };
}

/**
 * Atiende comandos en lenguaje natural para silenciar usuarios:
 * "silenciame a ...", "silencia a ...", "muteale a ...", responder "silencia", etc.
 */
async function handleNaturalMute(ctx, rawText) {
  const isReply = Boolean(ctx.message?.reply_to_message?.from);
  const text = (rawText || ctx.message?.text || '').trim();

  const isReplyTrigger = isReply && /^(?:sil[eé]nciame|silencia|sil[eé]ncial[oa]|muteale|mutea|mut[eé]al[oa]|mutear|silenciar)(?:\s+(.+))?$/i.test(text);
  const isMutePattern = /^(?:sil[eé]nciame(?:\s+a)?|silencia(?:\s+a)?|muteale(?:\s+a)?|mutea(?:\s+a)?|mutear(?:\s+a)?|silenciar(?:\s+a)?)\b(?:\s+(.+))?/i.test(text);

  if (!isReplyTrigger && !isMutePattern) return false;

  // Comprobar autorización del emisor (Staff o Propietario)
  if (!await isAuthorizedStaff(ctx)) {
    return false;
  }

  if (ctx.chat.type === 'private') {
    await ctx.reply('⟡ Este comando de moderación solo funciona dentro de un grupo o comunidad.', { parse_mode: 'HTML' });
    return true;
  }

  await ctx.replyWithChatAction('typing');

  // 1. Caso A: Respuesta directa a un mensaje
  if (isReply) {
    const from = ctx.message.reply_to_message.from;
    const argsMatch = text.match(/^(?:sil[eé]nciame|silencia|sil[eé]ncial[oa]|muteale|mutea|mut[eé]al[oa]|mutear|silenciar)(?:\s+(.+))?$/i);
    const subText = argsMatch && argsMatch[1] ? argsMatch[1].trim() : '';
    const parts = subText.split(/\s+/).filter(Boolean);

    let duration = null;
    let reason = 'Moderación';
    if (parts.length > 0 && parseDuration(parts[0])) {
      duration = parts[0];
      reason = parts.slice(1).join(' ') || 'Moderación';
    } else if (parts.length > 0) {
      reason = parts.join(' ');
    }

    const targetUser = {
      userId: from.id,
      username: from.username || null,
      firstName: from.first_name || 'Usuario',
    };

    if (duration) {
      const { text: resText, keyboard } = await executeMute(ctx, targetUser, duration, reason);
      await ctx.reply(resText, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      const { text: panelText, keyboard } = await buildMutePanel(ctx, targetUser);
      await ctx.reply(panelText, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    return true;
  }

  // 2. Caso B: Por argumento en texto ("silencia a @usuario", "muteale a Carlos", etc.)
  const { targetQuery, duration, reason } = parseMuteArguments(text);

  if (!targetQuery) {
    await ctx.reply(
      `⟡ <b>COMANDO DE SILENCIO (MUTE)</b>\n` +
      `──────\n\n` +
      `▸ <b>Uso Natural:</b> <code>Silencia a [nombre, @user o ID] [tiempo] [motivo]</code>\n` +
      `▸ <b>Ejemplo:</b> <code>Silencia a @usuario 2h Spam</code>\n` +
      `▸ <b>O simplemente:</b> <code>Silenciame a Carlos</code> (para elegir duración con botones)\n\n` +
      `──────\n` +
      `▪ <i>También puedes responder a un mensaje y escribir simplemente: <code>silencia</code></i>`,
      { parse_mode: 'HTML' }
    );
    return true;
  }

  const cleanNoAt = targetQuery.replace(/^@/, '').trim();
  const tenantId = ctx.tenant?.id || null;

  // PRIORIDAD 1: Buscar candidatos en la comunidad
  const communityCandidates = await searchCandidatesInCommunity(cleanNoAt, tenantId);

  // Múltiples coincidencias en la comunidad -> Desplegar menú de selección
  if (communityCandidates.length > 1 && !/^\d+$/.test(cleanNoAt)) {
    const kb = new InlineKeyboard();
    for (const u of communityCandidates.slice(0, 8)) {
      const uLabel = `${u.firstName || 'Usuario'}${u.username ? ` (@${u.username})` : ` [${u.userId}]`}`;
      kb.text(`👤 ${uLabel.slice(0, 30)}`, `mod_mute_prompt:${u.userId}`).row();
    }
    kb.text('✖ Cancelar', 'info_close');

    await ctx.reply(
      `👥 <b>SELECCIÓN DE USUARIO A SILENCIAR</b>\n` +
      `══════\n\n` +
      `Se encontraron <b>${communityCandidates.length}</b> coincidencias en la comunidad para: <code>${escapeHtml(cleanNoAt)}</code>\n\n` +
      `<i>Selecciona a quién deseas silenciar:</i>\n` +
      `──────`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
    return true;
  }

  // Exactamente 1 coincidencia en la comunidad
  if (communityCandidates.length === 1) {
    const targetUser = communityCandidates[0];
    if (duration) {
      const { text: resText, keyboard } = await executeMute(ctx, targetUser, duration, reason);
      await ctx.reply(resText, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      const { text: panelText, keyboard } = await buildMutePanel(ctx, targetUser);
      await ctx.reply(panelText, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    return true;
  }

  // PRIORIDAD 2: Fallback Global (si no está en la base local de la comunidad)
  const resolved = await resolveTarget(ctx, { tenantId });
  if (resolved && resolved.userId && !resolved.unresolved) {
    if (duration) {
      const { text: resText, keyboard } = await executeMute(ctx, resolved, duration, reason);
      await ctx.reply(resText, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      const { text: panelText, keyboard } = await buildMutePanel(ctx, resolved);
      await ctx.reply(panelText, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    return true;
  }

  await ctx.reply(
    `⟡ ✗ No se encontró a ningún usuario para: <code>${escapeHtml(cleanNoAt)}</code> dentro del grupo ni en la red oficial.`,
    { parse_mode: 'HTML' }
  );
  return true;
}

/**
 * Registra los callbacks interactivos para gestionar y ejecutar silencios.
 */
function registerCallbacks(bot) {
  // Callback: Desplegar panel de opciones de duración
  bot.callbackQuery(/^mod_mute_prompt:(\d+)$/, async (ctx) => {
    try {
      if (!await isAuthorizedStaff(ctx)) {
        return ctx.answerCallbackQuery({ text: '⟡ Requiere permisos de Staff.', show_alert: true });
      }

      const targetId = Number(ctx.match[1]);
      await ctx.answerCallbackQuery();

      const { text, keyboard } = await buildMutePanel(ctx, { userId: targetId });
      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      } catch (err) {
        if (!err.message?.includes('message is not modified')) {
          await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
      }
    } catch (err) {
      console.error('⟡ Error en mod_mute_prompt:', err.message);
    }
  });

  // Callback: Ejecutar silencio con duración elegida
  bot.callbackQuery(/^mod_mute_exec:(\d+):([a-z0-9]+)$/, async (ctx) => {
    try {
      if (!await isAuthorizedStaff(ctx)) {
        return ctx.answerCallbackQuery({ text: '⟡ Requiere permisos de Staff.', show_alert: true });
      }

      const targetId = Number(ctx.match[1]);
      const durationStr = ctx.match[2];
      await ctx.answerCallbackQuery({ text: '⟡ Aplicando silencio...' });

      const targetUser = { userId: targetId };
      const { text, keyboard } = await executeMute(ctx, targetUser, durationStr, 'Panel de Moderación');

      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      } catch (err) {
        if (!err.message?.includes('message is not modified')) {
          await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
      }
    } catch (err) {
      console.error('⟡ Error en mod_mute_exec:', err.message);
      await ctx.answerCallbackQuery({ text: `✗ Error: ${err.message}`, show_alert: true });
    }
  });

  // Callback: Desilenciar
  bot.callbackQuery(/^mod_unmute_exec:(\d+)$/, async (ctx) => {
    try {
      if (!await isAuthorizedStaff(ctx)) {
        return ctx.answerCallbackQuery({ text: '⟡ Requiere permisos de Staff.', show_alert: true });
      }

      const targetId = Number(ctx.match[1]);
      await ctx.answerCallbackQuery({ text: '⟡ Removiendo silencio...' });

      const targetUser = { userId: targetId };
      const { text, keyboard } = await executeUnmute(ctx, targetUser);

      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      } catch (err) {
        if (!err.message?.includes('message is not modified')) {
          await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
      }
    } catch (err) {
      console.error('⟡ Error en mod_unmute_exec:', err.message);
      await ctx.answerCallbackQuery({ text: `✗ Error: ${err.message}`, show_alert: true });
    }
  });
}

module.exports = {
  buildMutePanel,
  executeMute,
  executeUnmute,
  handleNaturalMute,
  parseMuteArguments,
  registerCallbacks,
  getSuperscriptDate,
};
