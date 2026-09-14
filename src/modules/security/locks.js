const db = require('../../database/postgres');
const config = require('../../config/env');

// ══════
// ⟡ MOTOR DE BLOQUEOS SELECTIVOS DE CONTENIDO (LOCKS)
// ══════

// Lista de tipos de bloqueos soportados
const SUPPORTED_LOCKS = [
  'links',     // Enlaces http / https / t.me
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
    forwards: false,
    stickers: false,
    gifs: false,
    audio: false,
    voice: false,
    video: false,
    docs: false,
    bots: true, // Bloqueo de bots agresivos activo por defecto
    arab: false,
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

  // 1. Lock Forwards
  if (locks.forwards) {
    if (ctx.message?.forward_origin || ctx.message?.forward_from || ctx.message?.forward_from_chat) {
      return { shouldDelete: true, reason: 'Reenvío de mensajes bloqueado en este grupo.' };
    }
  }

  // 2. Lock Stickers
  if (locks.stickers && ctx.message?.sticker) {
    return { shouldDelete: true, reason: 'Stickers bloqueados en este grupo.' };
  }

  // 3. Lock GIFs
  if (locks.gifs && ctx.message?.animation) {
    return { shouldDelete: true, reason: 'Animaciones (GIFs) bloqueadas en este grupo.' };
  }

  // 4. Lock Audio
  if (locks.audio && ctx.message?.audio) {
    return { shouldDelete: true, reason: 'Archivos de audio bloqueados en este grupo.' };
  }

  // 5. Lock Voice
  if (locks.voice && ctx.message?.voice) {
    return { shouldDelete: true, reason: 'Notas de voz bloqueadas en este grupo.' };
  }

  // 6. Lock Video
  if (locks.video && (ctx.message?.video || ctx.message?.video_note)) {
    return { shouldDelete: true, reason: 'Videos bloqueados en este grupo.' };
  }

  // 7. Lock Documents
  if (locks.docs && ctx.message?.document && !ctx.message?.animation) {
    return { shouldDelete: true, reason: 'Documentos adjuntos bloqueados en este grupo.' };
  }

  // 8. Lock Links
  if (locks.links) {
    const text = ctx.message?.text || ctx.message?.caption || '';
    const entities = [...(ctx.message?.entities || []), ...(ctx.message?.caption_entities || [])];
    const hasUrlEntity = entities.some((e) => e.type === 'url' || e.type === 'text_link');
    const hasRawLink = /(https?:\/\/|t\.me\/|telegram\.me\/|wa\.me\/)/i.test(text);

    if (hasUrlEntity || hasRawLink) {
      return { shouldDelete: true, reason: 'Enlaces externos bloqueados en este grupo.' };
    }
  }

  // 9. Lock Arab / RTL Scripts
  if (locks.arab) {
    const text = ctx.message?.text || ctx.message?.caption || '';
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
