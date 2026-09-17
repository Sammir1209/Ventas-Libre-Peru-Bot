const db = require('../../database/postgres');
const config = require('../../config/env');

// ══════
// ⟡ MOTOR DE BLOQUEOS SELECTIVOS DE CONTENIDO (LOCKS)
// ══════

// Lista de tipos de bloqueos soportados
const SUPPORTED_LOCKS = [
  'links',     // Enlaces http / https generales
  'invites',   // Enlaces de invitación de Telegram (t.me/+, t.me/joinchat, addlist)
  'channels',  // Menciones o enlaces a canales externos (@canal, t.me/canal)
  'service',   // Mensajes de servicio de Telegram (unirse, salir, fotos de grupo)
  'forwards',  // Mensajes reenviados de canales / bots
  'stickers',  // Stickers convencionales
  'gifs',      // Animaciones / gifs
  'audio',     // Archivos de audio mp3 / m4a
  'voice',     // Notas de voz
  'video',     // Videos y videomensajes
  'docs',      // Archivos / documentos adjuntos
  'bots',      // Nuevos bots agregados al grupo
  'arab',      // Nombres o mensajes en árabe / scripts RTL
];

/**
 * Obtiene los locks activos de un grupo.
 */
async function getGroupLocks(chatId) {
  try {
    const raw = await db.getSetting(`locks_${chatId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    links: false,
    invites: true,    // Bloqueo de enlaces de invitación a otros grupos por defecto
    channels: false,
    service: true,    // Limpieza de mensajes de servicio activa por defecto
    forwards: false,
    stickers: false,
    gifs: false,
    audio: false,
    voice: false,
    video: false,
    docs: false,
    bots: true,       // Bloqueo de bots intrusos activo por defecto
    arab: true,       // Anti-scripts árabes / raid activo por defecto
  };
}

/**
 * Actualiza los locks de un grupo.
 */
async function setGroupLocks(chatId, locksObj) {
  await db.setSetting(`locks_${chatId}`, JSON.stringify(locksObj));
}

/**
 * Detecta caracteres árabes, persas o hebreos (scripts RTL usados en raids).
 */
function containsArabicOrRtl(text) {
  if (!text) return false;
  // Rango unicode para árabe, persa, hebreo
  const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/;
  return rtlRegex.test(text);
}

/**
 * Evalúa un mensaje entrante contra los locks activos del grupo.
 * Retorna { shouldDelete: boolean, reason: string }
 */
async function evaluateMessageLocks(ctx) {
  if (!ctx.chat || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {
    return { shouldDelete: false };
  }

  const userId = ctx.from?.id;
  if (!userId) return { shouldDelete: false };

  // Eximir Owners y Staff de cualquier bloqueo
  if (config.OWNER_IDS.includes(userId)) return { shouldDelete: false };
  try {
    const staff = await db.getStaffMember(userId);
    if (staff) return { shouldDelete: false };
  } catch {}

  const chatId = ctx.chat.id;
  const locks = await getGroupLocks(chatId);

  // 1. Lock Service Messages (uniones, salidas, fotos de grupo cambiadas, etc.)
  if (locks.service) {
    if (
      ctx.message?.new_chat_members ||
      ctx.message?.left_chat_member ||
      ctx.message?.new_chat_title ||
      ctx.message?.new_chat_photo ||
      ctx.message?.delete_chat_photo ||
      ctx.message?.group_chat_created ||
      ctx.message?.supergroup_chat_created ||
      ctx.message?.pinned_message
    ) {
      return { shouldDelete: true, reason: 'Mensaje de servicio eliminado (Modo Limpio).' };
    }
  }

  // 2. Lock Forwards
  if (locks.forwards) {
    if (ctx.message?.forward_origin || ctx.message?.forward_from || ctx.message?.forward_from_chat) {
      return { shouldDelete: true, reason: 'Reenvío de mensajes bloqueado en este grupo.' };
    }
  }

  // 3. Lock Stickers
  if (locks.stickers && ctx.message?.sticker) {
    return { shouldDelete: true, reason: 'Stickers bloqueados en este grupo.' };
  }

  // 4. Lock GIFs
  if (locks.gifs && ctx.message?.animation) {
    return { shouldDelete: true, reason: 'Animaciones (GIFs) bloqueadas en este grupo.' };
  }

  // 5. Lock Audio
  if (locks.audio && ctx.message?.audio) {
    return { shouldDelete: true, reason: 'Archivos de audio bloqueados en este grupo.' };
  }

  // 6. Lock Voice
  if (locks.voice && ctx.message?.voice) {
    return { shouldDelete: true, reason: 'Notas de voz bloqueadas en este grupo.' };
  }

  // 7. Lock Video
  if (locks.video && (ctx.message?.video || ctx.message?.video_note)) {
    return { shouldDelete: true, reason: 'Videos bloqueados en este grupo.' };
  }

  // 8. Lock Documents
  if (locks.docs && ctx.message?.document && !ctx.message?.animation) {
    return { shouldDelete: true, reason: 'Documentos adjuntos bloqueados en este grupo.' };
  }

  const text = ctx.message?.text || ctx.message?.caption || '';
  const entities = [...(ctx.message?.entities || []), ...(ctx.message?.caption_entities || [])];

  // 9. Lock Invites (t.me/+, t.me/joinchat, addlist, telegram.me/+)
  if (locks.invites) {
    const isInvite = /(t\.me\/(?:\+|joinchat\/|addlist\/)|telegram\.me\/(?:\+|joinchat\/))/i.test(text);
    if (isInvite) {
      return { shouldDelete: true, reason: 'Enlaces de invitación a otros grupos bloqueados (Anti-Spam).' };
    }
  }

  // 10. Lock Channels (@canal_externo o t.me/canal)
  if (locks.channels) {
    const hasMentionEntity = entities.some((e) => e.type === 'mention');
    const isChannelUrl = /(t\.me\/[a-zA-Z0-9_]{4,32})/i.test(text);
    if (hasMentionEntity || isChannelUrl) {
      return { shouldDelete: true, reason: 'Canales y menciones externas bloqueadas en este grupo.' };
    }
  }

  // 11. Lock General Links
  if (locks.links) {
    const hasUrlEntity = entities.some((e) => e.type === 'url' || e.type === 'text_link');
    const hasRawLink = /(https?:\/\/|t\.me\/|telegram\.me\/|wa\.me\/)/i.test(text);

    if (hasUrlEntity || hasRawLink) {
      return { shouldDelete: true, reason: 'Enlaces externos bloqueados en este grupo.' };
    }
  }

  // 12. Lock Arab / RTL Scripts
  if (locks.arab) {
    const senderName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ');
    if (containsArabicOrRtl(text) || containsArabicOrRtl(senderName)) {
      return { shouldDelete: true, reason: 'Caracteres árabes o scripts no autorizados (Anti-Raid).' };
    }
  }

  return { shouldDelete: false };
}

module.exports = {
  SUPPORTED_LOCKS,
  getGroupLocks,
  setGroupLocks,
  containsArabicOrRtl,
  evaluateMessageLocks,
};
