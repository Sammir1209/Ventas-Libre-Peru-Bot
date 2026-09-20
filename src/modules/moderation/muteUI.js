const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM, ROLES } = require('../../config/constants');
const { getEffectiveOwners } = require('../../middleware/auth');
const { InlineKeyboard } = require('grammy');
const { mentionFromData, staffMention, formatId, escapeHtml } = require('../../utils/formatting');
const { searchCandidatesInCommunity, resolveTarget } = require('../../utils/helpers');
const sentinel = require('./sentinel');
const logger = require('./logger');

const { parseDuration } = sentinel;

// ══════
// ⟡ Módulo: Silenciamiento Directo y Notificación en Logs (Mute UI)
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
 * Ejecuta el silenciamiento en el chat de Telegram y devuelve la confirmación limpia (sin botones).
 * Toda la auditoría detallada se envía a los canales de logs y base de datos.
 */
async function executeMute(ctx, targetUser, durationStr = '1d', reason = 'Moderación') {
  const rawId = targetUser.userId || targetUser.user_id || targetUser.id;
  const userId = Number(rawId);

  if (!userId || isNaN(userId)) {
    throw new Error('ID de usuario no válido.');
  }

  if (isOwnerTarget(userId, ctx)) {
    throw new Error('No se puede silenciar a un Propietario (Owner) del sistema.');
  }

  if (ctx.chat.type === 'private') {
    throw new Error('Esta acción solo puede aplicarse dentro de un grupo o comunidad.');
  }

  // 0. Comprobar si el usuario es miembro del grupo actual
  let member = null;
  try {
    member = await ctx.api.getChatMember(ctx.chat.id, userId);
  } catch (err) {
    if (err.message?.includes('PARTICIPANT_ID_INVALID') || err.message?.includes('USER_NOT_PARTICIPANT')) {
      throw new Error('El usuario no es participante de este grupo.');
    }
  }

  if (member) {
    if (member.status === 'left' || member.status === 'kicked') {
      throw new Error('El usuario no está presente en este grupo (ha salido o fue expulsado).');
    }
    if (member.status === 'administrator' || member.status === 'creator') {
      throw new Error('No se puede silenciar a un administrador o propietario del grupo.');
    }
  }

  let durationInfo;
  if (typeof durationStr === 'object' && durationStr !== null && durationStr.seconds) {
    durationInfo = {
      seconds: durationStr.seconds,
      humanReadable: durationStr.humanReadable || `${durationStr.seconds}s`,
      untilDate: durationStr.untilDate || (Math.floor(Date.now() / 1000) + durationStr.seconds),
    };
  } else if (typeof durationStr === 'string' && (durationStr.toLowerCase() === 'perm' || durationStr.toLowerCase() === 'permanente')) {
    durationInfo = {
      seconds: 365 * 86400,
      humanReadable: 'Indefinido / Permanente',
      untilDate: Math.floor(Date.now() / 1000) + 365 * 86400,
    };
  } else {
    durationInfo = parseDuration(String(durationStr || '1d')) || parseDuration('1d');
  }

  // 1. Ejecutar restricción en Telegram API con captura de errores descriptivos
  try {
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
  } catch (apiErr) {
    if (apiErr.message?.includes('PARTICIPANT_ID_INVALID')) {
      throw new Error('El usuario no es participante activo de este grupo.');
    } else if (apiErr.message?.includes('CHAT_ADMIN_REQUIRED')) {
      throw new Error('El bot requiere permisos de administrador para restringir miembros.');
    } else if (apiErr.message?.includes('USER_ADMIN_INVALID')) {
      throw new Error('No se puede restringir a un administrador del grupo.');
    }
    throw apiErr;
  }

  const targetUsername = targetUser.username || null;
  const targetFirstName = targetUser.firstName || targetUser.first_name || 'Usuario';
  const targetMention = mentionFromData(userId, targetUsername, targetFirstName);
  const adminName = staffMention(ctx.from.id, ctx.from.username, ctx.from.first_name);
  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
  const botLabel = communityName.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || 'Ventas Libres';
  const dateFormatted = getSuperscriptDate();

  // Plantilla limpia sin botones molestos en el chat
  const text =
    `<b>⟡ [${escapeHtml(botLabel)} BOT] USUARIO SILENCIADO</b>\n` +
    `──────\n\n` +
    `▸ <b>Usuario:</b> ${targetMention}\n` +
    `▸ <b>ID:</b> <code>${userId}</code>\n` +
    `▸ <b>Duración:</b> <code>${durationInfo.humanReadable}</code>\n` +
    `▸ <b>Motivo:</b> <i>${escapeHtml(reason)}</i>\n` +
    `▸ <b>Moderador:</b> ${adminName}\n\n` +
    `──────\n` +
    `🤐 <i>Permisos de envío de mensajes suspendidos.</i>\n` +
    `${dateFormatted}`;

  // 2. Notificación en canal de logs y registro en BD
  db.addModLog('MUTE', ctx.from.id, userId, ctx.chat.id, `[${durationInfo.humanReadable}] ${reason}`).catch(() => {});
  logger.sendLog(ctx.api, 'MUTE', ctx.from, userId, ctx.chat.title, `[${durationInfo.humanReadable}] ${reason}`).catch(() => {});

  return { text };
}

/**
 * Remueve el silencio y reactiva los permisos de mensajería del usuario.
 */
async function executeUnmute(ctx, targetUser) {
  const rawId = targetUser.userId || targetUser.user_id || targetUser.id;
  const userId = Number(rawId);

  if (!userId || isNaN(userId)) {
    throw new Error('ID de usuario no válido.');
  }

  if (ctx.chat.type === 'private') {
    throw new Error('Esta acción solo puede aplicarse dentro de un grupo o comunidad.');
  }

  try {
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
  } catch (apiErr) {
    if (apiErr.message?.includes('PARTICIPANT_ID_INVALID')) {
      throw new Error('El usuario no es participante de este grupo.');
    } else if (apiErr.message?.includes('CHAT_ADMIN_REQUIRED')) {
      throw new Error('El bot requiere permisos de administrador para modificar permisos.');
    }
    throw apiErr;
  }

  const targetUsername = targetUser.username || null;
  const targetFirstName = targetUser.firstName || targetUser.first_name || 'Usuario';
  const targetMention = mentionFromData(userId, targetUsername, targetFirstName);
  const adminName = staffMention(ctx.from.id, ctx.from.username, ctx.from.first_name);
  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
  const botLabel = communityName.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || 'Ventas Libres';
  const dateFormatted = getSuperscriptDate();

  const text =
    `<b>⟡ [${escapeHtml(botLabel)} BOT] SILENCIO REMOVIDO</b>\n` +
    `──────\n\n` +
    `▸ <b>Usuario:</b> ${targetMention}\n` +
    `▸ <b>ID:</b> <code>${userId}</code>\n` +
    `▸ <b>Moderador:</b> ${adminName}\n\n` +
    `──────\n` +
    `✓ <i>El usuario puede participar y enviar mensajes nuevamente.</i>\n` +
    `${dateFormatted}`;

  db.addModLog('UNMUTE', ctx.from.id, userId, ctx.chat.id, null).catch(() => {});
  logger.sendLog(ctx.api, 'UNMUTE', ctx.from, userId, ctx.chat.title, null).catch(() => {});

  return { text };
}

/**
 * Desglosa argumentos de texto ("silencia a Carlos 2h spam").
 */
function parseMuteArguments(rawText) {
  if (!rawText) return { targetQuery: '', duration: null, reason: 'Moderación' };

  let text = rawText
    .replace(/^(?:sil[eé]nciame(?:\s+a)?|silencia(?:\s+a)?|muteale(?:\s+a)?|mutea(?:\s+a)?|mutear(?:\s+a)?|silenciar(?:\s+a)?)\s+/i, '')
    .trim();

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { targetQuery: '', duration: null, reason: 'Moderación' };

  let targetQuery = parts[0];
  let duration = null;
  let reasonParts = [];

  if (parts.length > 1) {
    const durParsed = parseDuration(parts[1]);
    if (durParsed) {
      duration = parts[1];
      reasonParts = parts.slice(2);
    } else {
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
 * Procesa órdenes de silencio en lenguaje natural ("silencia a...", "silénciame a...", reply "silencia").
 * Silencia directamente sin llenar el chat de botones innecesarios.
 */
async function handleNaturalMute(ctx, rawText) {
  const isReply = Boolean(ctx.message?.reply_to_message?.from);
  const text = (rawText || ctx.message?.text || '').trim();

  const isReplyTrigger = isReply && /^(?:sil[eé]nciame|silencia|sil[eé]ncial[oa]|muteale|mutea|mut[eé]al[oa]|mutear|silenciar)(?:\s+(.+))?$/i.test(text);
  const isMutePattern = /^(?:sil[eé]nciame(?:\s+a)?|silencia(?:\s+a)?|muteale(?:\s+a)?|mutea(?:\s+a)?|mutear(?:\s+a)?|silenciar(?:\s+a)?)\b(?:\s+(.+))?/i.test(text);

  if (!isReplyTrigger && !isMutePattern) return false;

  // Solo Staff o Propietarios
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

    let duration = '1d';
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

    try {
      const { text: resText } = await executeMute(ctx, targetUser, duration, reason);
      await ctx.reply(resText, { parse_mode: 'HTML' });
    } catch (err) {
      await ctx.reply(`⟡ ✗ Error al silenciar: ${err.message}`, { parse_mode: 'HTML' });
    }
    return true;
  }

  // 2. Caso B: Por argumento en texto ("silencia a @usuario", "muteale a Carlos", etc.)
  const { targetQuery, duration, reason } = parseMuteArguments(text);

  if (!targetQuery) {
    await ctx.reply(
      `⟡ <b>COMANDO DE SILENCIO</b>\n` +
      `──────\n\n` +
      `▸ <b>Uso:</b> <code>Silencia a [nombre, @user o ID] [tiempo opcional] [motivo]</code>\n` +
      `▸ <b>Ejemplo:</b> <code>Silencia a @usuario 2h Spam</code>\n` +
      `▸ <b>O simplemente:</b> <code>Silencia a @usuario</code> (1 día por defecto)\n\n` +
      `──────\n` +
      `▪ <i>O responde al mensaje de un usuario y escribe: <code>silencia</code></i>`,
      { parse_mode: 'HTML' }
    );
    return true;
  }

  const cleanNoAt = targetQuery.replace(/^@/, '').trim();
  const tenantId = ctx.tenant?.id || null;
  const durToApply = duration || '1d';

  // PRIORIDAD 1: Buscar candidatos en la comunidad
  const communityCandidates = await searchCandidatesInCommunity(cleanNoAt, tenantId);

  // Múltiples coincidencias en la comunidad -> Botones simples ÚNICAMENTE para elegir cuál usuario
  if (communityCandidates.length > 1 && !/^\d+$/.test(cleanNoAt)) {
    const kb = new InlineKeyboard();
    for (const u of communityCandidates.slice(0, 6)) {
      const uLabel = `${u.firstName || 'Usuario'}${u.username ? ` (@${u.username})` : ` [${u.userId || u.user_id}]`}`;
      const uid = u.userId || u.user_id;
      kb.text(`👤 ${uLabel.slice(0, 30)}`, `mod_mute_direct:${uid}:${durToApply}`).row();
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

  // Exactamente 1 coincidencia en la comunidad -> Silenciar de inmediato
  if (communityCandidates.length === 1) {
    const targetUser = communityCandidates[0];
    try {
      const { text: resText } = await executeMute(ctx, targetUser, durToApply, reason);
      await ctx.reply(resText, { parse_mode: 'HTML' });
    } catch (err) {
      await ctx.reply(`⟡ ✗ Error al silenciar: ${err.message}`, { parse_mode: 'HTML' });
    }
    return true;
  }

  // PRIORIDAD 2: Fallback Global
  const resolved = await resolveTarget(ctx, { tenantId });
  if (resolved && (resolved.userId || resolved.user_id) && !resolved.unresolved) {
    try {
      const { text: resText } = await executeMute(ctx, resolved, durToApply, reason);
      await ctx.reply(resText, { parse_mode: 'HTML' });
    } catch (err) {
      await ctx.reply(`⟡ ✗ Error al silenciar: ${err.message}`, { parse_mode: 'HTML' });
    }
    return true;
  }

  await ctx.reply(
    `⟡ ✗ No se encontró a ningún usuario para: <code>${escapeHtml(cleanNoAt)}</code> dentro de la comunidad.`,
    { parse_mode: 'HTML' }
  );
  return true;
}

/**
 * Registra los callbacks de ejecución directa para moderadores.
 */
function registerCallbacks(bot) {
  // Callback de silenciamiento directo desde lista de candidatos o botón de búscame
  bot.callbackQuery(/^mod_mute_direct:(\d+)(?::([a-z0-9]+))?$/, async (ctx) => {
    try {
      if (!await isAuthorizedStaff(ctx)) {
        return ctx.answerCallbackQuery({ text: '⟡ Requiere permisos de Staff.', show_alert: true });
      }

      const targetId = Number(ctx.match[1]);
      const durationStr = ctx.match[2] || '1d';

      let targetUser = await db.getUser(targetId);
      if (!targetUser) {
        try {
          const chat = await ctx.api.getChat(targetId);
          targetUser = {
            userId: chat.id,
            username: chat.username || null,
            firstName: chat.first_name || 'Usuario',
          };
        } catch {}
      }
      if (!targetUser) {
        targetUser = { userId: targetId };
      }

      const { text } = await executeMute(ctx, targetUser, durationStr, 'Acción de Moderación');
      await ctx.answerCallbackQuery({ text: '✓ Usuario silenciado.' });

      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML' });
      } catch (err) {
        if (!err.message?.includes('message is not modified')) {
          await ctx.reply(text, { parse_mode: 'HTML' });
        }
      }
    } catch (err) {
      console.error('⟡ Error en mod_mute_direct:', err.message);
      await ctx.answerCallbackQuery({ text: `✗ Error: ${err.message}`, show_alert: true });
    }
  });
}

module.exports = {
  executeMute,
  executeUnmute,
  handleNaturalMute,
  parseMuteArguments,
  registerCallbacks,
  getSuperscriptDate,
};
