const redisDb = require('../../database/redis');
const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const { escapeHtml } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');

// ══════
// ⟡ ESCUDO ANTI-RAID & LOCKDOWN EN TIEMPO REAL (DEFCON 1)
// ══════

// Ring buffer en memoria para detección a velocidad de milisegundos
const joinHistory = new Map(); // chatId -> Array of timestamps { time, userId, username, firstName }
const activeRaids = new Map(); // chatId -> { startedAt, raiders: [], alertMsgId }

// Configuración por defecto
const DEFAULT_CONFIG = {
  THRESHOLD: 6,       // Más de 6 usuarios
  WINDOW_MS: 10000,   // En 10 segundos
  LOCKDOWN_TTL: 300,  // 5 minutos de auto-lockdown
};

/**
 * Obtiene la configuración de Anti-Raid para un chat específico.
 */
async function getAntiRaidConfig(chatId) {
  try {
    const raw = await db.getSetting(`antiraid_conf_${chatId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    enabled: true,
    threshold: DEFAULT_CONFIG.THRESHOLD,
    windowMs: DEFAULT_CONFIG.WINDOW_MS,
    action: 'MUTE', // 'MUTE' | 'KICK' | 'BAN'
  };
}

/**
 * Guarda la configuración de Anti-Raid para un chat.
 */
async function setAntiRaidConfig(chatId, conf) {
  await db.setSetting(`antiraid_conf_${chatId}`, JSON.stringify(conf));
}

/**
 * Verifica si un chat está actualmente en modo Lockdown (bloqueo por raid).
 */
async function isLockdownActive(chatId) {
  if (activeRaids.has(chatId)) return true;
  const inRedis = await redisDb.getCache(`lockdown:${chatId}`);
  return !!inRedis;
}

/**
 * Activa manualmente o automáticamente el modo Lockdown.
 */
async function triggerLockdown(api, chatId, chatTitle, reason = 'Ataque coordinado de usuarios masivo (Raid)') {
  const ttl = DEFAULT_CONFIG.LOCKDOWN_TTL;
  await redisDb.setCache(`lockdown:${chatId}`, true, ttl);

  if (!activeRaids.has(chatId)) {
    activeRaids.set(chatId, {
      startedAt: Date.now(),
      raiders: [],
      alertMsgId: null,
    });
  }

  // Cerrar permisos de escritura en el chat para usuarios comunes (Group Permissions)
  try {
    await api.setChatPermissions(chatId, {
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
    });
  } catch (err) {
    console.warn(`⟡ AntiRaid: No se pudieron restringir permisos del grupo ${chatId}:`, err.message);
  }

  // Notificar al Staff Channel
  try {
    const staffChatId = config.STAFF_CHAT_ID;
    if (staffChatId) {
      const kb = new InlineKeyboard()
        .text('DESACTIVAR LOCKDOWN', `antiraid_unlock:${chatId}`).success()
        .row()
        .text('EXPULSAR ATACANTES', `antiraid_purge:${chatId}`).danger();

      const text =
        `${SYM.DIVIDER}\n` +
        `🚨 <b>¡ALERTA DEFCON 1: RAID MASIVO DETECTADO!</b> 🚨\n` +
        `${SYM.DIVIDER}\n\n` +
        `➜ <b>Comunidad / Grupo:</b> ${escapeHtml(chatTitle || String(chatId))}\n` +
        `➜ <b>ID:</b> <code>${chatId}</code>\n` +
        `➜ <b>Diagnóstico:</b> <i>${escapeHtml(reason)}</i>\n\n` +
        `⚡ <b>Contramedidas Automáticas Activadas:</b>\n` +
        `• <i>Chat cerrado temporalmente a nivel permisos</i>\n` +
        `• <i>Mensajes de bienvenida suspendidos (Anti-FloodWait)</i>\n` +
        `• <i>Nuevos intrusos silenciados de inmediato</i>\n\n` +
        `${SYM.THIN_LINE}\n` +
        `<i>El chat se normalizará tras verificar el estado o con los botones de abajo.</i>`;

      const sentAlert = await api.sendMessage(staffChatId, text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });

      const current = activeRaids.get(chatId);
      if (current) current.alertMsgId = sentAlert.message_id;
    }
  } catch (alertErr) {
    console.error('⟡ AntiRaid: Error notificando al Staff:', alertErr.message);
  }

  // Registrar en logs de moderación
  try {
    await db.addModLog('ANTI_RAID_LOCKDOWN', 0, 0, chatId, reason);
  } catch {}
}

/**
 * Desactiva el modo Lockdown y normaliza los permisos del chat.
 */
async function disableLockdown(api, chatId) {
  await redisDb.clearCache(`lockdown:${chatId}`);
  activeRaids.delete(chatId);
  joinHistory.delete(chatId);

  // Restaurar permisos normales de grupo
  try {
    await api.setChatPermissions(chatId, {
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
    });
    return true;
  } catch (err) {
    console.error(`⟡ AntiRaid: Error restaurando permisos en ${chatId}:`, err.message);
    return false;
  }
}

/**
 * Registra un nuevo ingreso y comprueba si constituye un ataque Raid.
 * Retorna { isRaid: boolean, shouldWelcome: boolean }
 */
async function processJoinEvent(api, chat, user) {
  const chatId = chat.id;
  const now = Date.now();

  const raidConf = await getAntiRaidConfig(chatId);
  if (!raidConf.enabled) {
    return { isRaid: false, shouldWelcome: true };
  }

  // Si ya estamos en Lockdown activo:
  if (await isLockdownActive(chatId)) {
    const raidState = activeRaids.get(chatId);
    if (raidState) {
      raidState.raiders.push({
        id: user.id,
        username: user.username,
        name: [user.first_name, user.last_name].filter(Boolean).join(' '),
        joinedAt: now,
      });
    }

    // Auto-sanción silenciosa al invasor
    try {
      if (raidConf.action === 'KICK') {
        await api.banChatMember(chatId, user.id);
        await api.unbanChatMember(chatId, user.id, { only_if_banned: true });
      } else if (raidConf.action === 'BAN') {
        await api.banChatMember(chatId, user.id);
      } else {
        // MUTE por defecto
        await api.restrictChatMember(chatId, user.id, {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_other_messages: false,
        });
      }
    } catch {}

    // NO enviar bienvenida individual para salvar al bot de FloodWait
    return { isRaid: true, shouldWelcome: false };
  }

  // Gestión de Ring Buffer de ingresos
  let history = joinHistory.get(chatId) || [];
  const cutoff = now - (raidConf.windowMs || DEFAULT_CONFIG.WINDOW_MS);
  history = history.filter((item) => item.time > cutoff);

  history.push({
    time: now,
    userId: user.id,
    username: user.username || null,
    firstName: user.first_name || 'Usuario',
  });
  joinHistory.set(chatId, history);

  // ¿Superó el umbral de raid?
  if (history.length >= (raidConf.threshold || DEFAULT_CONFIG.THRESHOLD)) {
    console.warn(`🚨 [DEFCON 1] Raid masivo detectado en ${chatId} (${chat.title}): ${history.length} usuarios en ${raidConf.windowMs / 1000}s`);

    // Iniciar Lockdown
    await triggerLockdown(
      api,
      chatId,
      chat.title,
      `Tasa anómala: ${history.length} cuentas ingresando en menos de ${raidConf.windowMs / 1000} segundos.`
    );

    // Guardar raiders iniciales
    const raidState = activeRaids.get(chatId);
    if (raidState) {
      raidState.raiders = [...history];
    }

    // Silenciar a todos los del lote detectado
    for (const member of history) {
      try {
        await api.restrictChatMember(chatId, member.userId, {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
        });
      } catch {}
    }

    return { isRaid: true, shouldWelcome: false };
  }

  return { isRaid: false, shouldWelcome: true };
}

/**
 * Obtiene la lista de atacantes capturados en el raid actual.
 */
function getActiveRaiders(chatId) {
  const r = activeRaids.get(chatId);
  return r ? r.raiders : [];
}

module.exports = {
  getAntiRaidConfig,
  setAntiRaidConfig,
  isLockdownActive,
  triggerLockdown,
  disableLockdown,
  processJoinEvent,
  getActiveRaiders,
};
