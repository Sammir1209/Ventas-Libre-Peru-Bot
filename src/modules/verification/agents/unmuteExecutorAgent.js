// ══════
// ⟡ Sub-Agente 4: UnmuteExecutorAgent (Ejecutor de Desmuteo & Persistencia)
//   Desmuteo multi-método (Telegram 6.5+), registro en Postgres y auto-limpieza
// ══════

const db = require('../../../database/postgres');
const redisDb = require('../../../database/redis');

class UnmuteExecutorAgent {
  /**
   * Ejecuta el desmuteo del miembro utilizando permisos independientes y fallback.
   */
  static async executeUnmute(api, chatId, userId) {
    if (!chatId || !userId) return false;

    const fullPermissions = {
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
    };

    // 1. Intento principal con permisos independientes
    try {
      await api.restrictChatMember(chatId, userId, fullPermissions, {
        use_independent_chat_permissions: true,
      });
      return true;
    } catch (err1) {
      console.warn(`⟡ [UnmuteExecutorAgent] Intento 1 falló (${err1.message}). Probando fallback...`);
    }

    // 2. Intento de respaldo estándar
    try {
      await api.restrictChatMember(chatId, userId, fullPermissions);
      return true;
    } catch (err2) {
      console.warn(`⟡ [UnmuteExecutorAgent] Intento 2 falló (${err2.message})`);
      return false;
    }
  }

  /**
   * Registra y persiste la verificación en Base de Datos y Caché.
   */
  static async persistVerification(userId, tenantId = null) {
    const tenantKey = tenantId || 'global';
    try {
      // Guardar en Redis por 30 días
      await redisDb.setCache(`verified_user:${tenantKey}:${userId}`, true, 86400 * 30);
      if (tenantKey === 'global') {
        await redisDb.setCache(`verified_user:${userId}`, true, 86400 * 30);
      }
      // Marcar en PostgreSQL
      await db.verifyUser(userId);
    } catch (err) {
      console.warn('⟡ [UnmuteExecutorAgent] Error persistiendo verificación:', err.message);
    }
  }

  /**
   * Programa el auto-borrado de un mensaje temporal para mantener limpios los grupos.
   */
  static scheduleMessageDeletion(api, chatId, messageId, delayMs = 15000) {
    if (!api || !chatId || !messageId) return;
    setTimeout(async () => {
      try {
        await api.deleteMessage(chatId, messageId);
      } catch {}
    }, delayMs);
  }
}

module.exports = UnmuteExecutorAgent;

