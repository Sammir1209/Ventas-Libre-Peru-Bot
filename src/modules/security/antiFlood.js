const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const { parseDuration } = require('../moderation/sentinel');

// ══════
// ⟡ MOTOR ANTI-FLOOD EN MEMORIA ULTRA-RÁPIDO
// ══════

// Ring buffer de mensajes por usuario: Map<"chatId:userId", Array<{ time, text, mediaType }>>
const userMsgHistory = new Map();

// Configuración por defecto
const DEFAULT_FLOOD = {
  MSG_LIMIT: 5,        // 5 mensajes
  WINDOW_MS: 3500,     // En 3.5 segundos
  REPEAT_LIMIT: 3,     // El mismo texto pegado 3 veces
  ACTION: 'MUTE',      // 'MUTE' | 'KICK' | 'DELETE'
  MUTE_TIME: '1h',     // 1 hora de silencio
};

/**
 * Obtiene la configuración de Anti-Flood para un chat.
 */
async function getAntiFloodConfig(chatId) {
  try {
    const raw = await db.getSetting(`antiflood_conf_${chatId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    enabled: true,
    msgLimit: DEFAULT_FLOOD.MSG_LIMIT,
    windowMs: DEFAULT_FLOOD.WINDOW_MS,
    repeatLimit: DEFAULT_FLOOD.REPEAT_LIMIT,
    action: DEFAULT_FLOOD.ACTION,
    muteTime: DEFAULT_FLOOD.MUTE_TIME,
  };
}

/**
 * Guarda la configuración de Anti-Flood.
 */
async function setAntiFloodConfig(chatId, conf) {
  await db.setSetting(`antiflood_conf_${chatId}`, JSON.stringify(conf));
}

/**
 * Evalúa un mensaje para detectar flood o spam repetido.
 * Retorna { isFlood: boolean, reason: string }
 */
async function checkMessageFlood(ctx) {
  if (!ctx.chat || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {
    return { isFlood: false };
  }

  const userId = ctx.from?.id;
  if (!userId) return { isFlood: false };

  // Eximir Owners y Staff
  if (config.OWNER_IDS.includes(userId)) return { isFlood: false };
  try {
    const staff = await db.getStaffMember(userId);
    if (staff) return { isFlood: false };
  } catch {}

  const chatId = ctx.chat.id;
  const conf = await getAntiFloodConfig(chatId);
  if (!conf.enabled) return { isFlood: false };

  const key = `${chatId}:${userId}`;
  const now = Date.now();

  let history = userMsgHistory.get(key) || [];
  const cutoff = now - conf.windowMs;
  history = history.filter((m) => m.time > cutoff);

  const textContent = (ctx.message?.text || ctx.message?.caption || '').trim().toLowerCase();
  const isSticker = !!ctx.message?.sticker;
  const isAnimation = !!ctx.message?.animation;

  history.push({
    time: now,
    text: textContent,
    msgId: ctx.message?.message_id,
    isMedia: isSticker || isAnimation,
  });
  userMsgHistory.set(key, history);

  // 1. Detección por exceso de mensajes en poco tiempo
  if (history.length >= conf.msgLimit) {
    return {
      isFlood: true,
      reason: `Envío masivo: ${history.length} mensajes en ${(conf.windowMs / 1000).toFixed(1)}s`,
      history,
    };
  }

  // 2. Detección por repetición idéntica de texto
  if (textContent.length > 3) {
    const sameTextCount = history.filter((m) => m.text === textContent).length;
    if (sameTextCount >= conf.repeatLimit) {
      return {
        isFlood: true,
        reason: `Repetición de texto idéntico (${sameTextCount} veces consecutivas)`,
        history,
      };
    }
  }

  // 3. Detección de ráfaga de stickers / GIFs
  const mediaCount = history.filter((m) => m.isMedia).length;
  if (mediaCount >= 4) {
    return {
      isFlood: true,
      reason: `Lluvia masiva de stickers o GIFs (${mediaCount} consecutivos)`,
      history,
    };
  }

  return { isFlood: false };
}

/**
 * Ejecuta la penalización por flood de forma limpia.
 */
async function handleFloodViolation(ctx, reason, history = []) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const conf = await getAntiFloodConfig(chatId);

  // 1. Eliminar mensajes recientes del flood
  for (const item of history) {
    if (item.msgId) {
      try {
        await ctx.api.deleteMessage(chatId, item.msgId);
      } catch {}
    }
  }

  // 2. Aplicar sanción configurada
  const parsedDur = parseDuration(conf.muteTime || '1h');
  try {
    if (conf.action === 'KICK') {
      await ctx.api.banChatMember(chatId, userId);
      await ctx.api.unbanChatMember(chatId, userId, { only_if_banned: true });
    } else if (conf.action === 'BAN') {
      await ctx.api.banChatMember(chatId, userId);
    } else {
      // MUTE
      await ctx.api.restrictChatMember(
        chatId,
        userId,
        {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_other_messages: false,
        },
        {
          until_date: parsedDur.untilDate,
          use_independent_chat_permissions: true,
        }
      );
    }
  } catch (err) {
    console.warn('⟡ AntiFlood: Error al aplicar sanción:', err.message);
  }

  // 3. Mensaje disuasivo auto-destructible en 15 segundos
  try {
    const notice = await ctx.reply(
      `⚠️ <b>Anti-Flood Activado:</b> El usuario <code>${userId}</code> fue silenciado por <b>${parsedDur.humanReadable}</b>.\n` +
      `<i>Motivo: ${reason}</i>`,
      { parse_mode: 'HTML' }
    );
    setTimeout(async () => {
      try {
        await ctx.api.deleteMessage(chatId, notice.message_id);
      } catch {}
    }, 15000);
  } catch {}

  // 4. Limpiar historial
  userMsgHistory.delete(`${chatId}:${userId}`);
}

module.exports = {
  getAntiFloodConfig,
  setAntiFloodConfig,
  checkMessageFlood,
  handleFloodViolation,
};
