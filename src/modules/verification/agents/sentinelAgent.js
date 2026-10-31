// ══════
// ⟡ Sub-Agente 1: SentinelAgent (Gatekeeper & Escudo Perimetral)
//   Evaluación instantánea, filtrado anti-estafadores y silenciamiento preventivo
// ══════

const db = require('../../../database/postgres');
const redisDb = require('../../../database/redis');
const config = require('../../../config/env');

class SentinelAgent {
  /**
   * Determina si el usuario ya está verificado y debe tener paso libre sin interrupción.
   */
  static async isUserVerified(userId, tenantId = null) {
    if (!userId) return false;

    // 1. Owners y Staff tienen pase directo
    if (config.OWNER_IDS.includes(userId)) return true;
    try {
      const staff = await db.getStaffMember(userId, tenantId);
      if (staff) return true;
    } catch {}

    // 2. Caché rápida de verificación
    const tenantKey = tenantId || 'global';
    const cached = await redisDb.getCache(`verified_user:${tenantKey}:${userId}`) ||
                   (tenantKey === 'global' && await redisDb.getCache(`verified_user:${userId}`));
    if (cached) return true;

    // 3. Consulta en PostgreSQL
    try {
      const user = await db.getUser(userId);
      if (user && (user.verified || user.is_verified)) {
        await redisDb.setCache(`verified_user:${tenantKey}:${userId}`, true, 86400 * 30);
        return true;
      }
    } catch {}

    return false;
  }

  /**
   * Evalúa si el usuario es un estafador fichado en la Lista Negra / GBan.
   */
  static async checkBlacklist(userId, username = null) {
    try {
      const burned = (await db.getBurnedUserInfo(userId)) ||
                     (username ? await db.getBurnedUserInfo(username) : null);
      return burned || null;
    } catch (err) {
      console.warn('⟡ [SentinelAgent] Error consultando lista negra:', err.message);
      return null;
    }
  }

  /**
   * Aplica silenciamiento preventivo inmediato al nuevo miembro en el chat.
   */
  static async applyPreventiveMute(api, chatId, userId) {
    try {
      await api.restrictChatMember(
        chatId,
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
          can_invite_users: false,
          can_change_info: false,
          can_pin_messages: false,
          can_manage_topics: false,
        },
        {
          use_independent_chat_permissions: true,
        }
      );
      return true;
    } catch (err) {
      console.warn(`⟡ [SentinelAgent] Aviso al aplicar mute preventivo a ${userId} en ${chatId}:`, err.message);
      return false;
    }
  }

  /**
   * Expulsa y bloquea permanentemente a un estafador fichado.
   */
  static async banScammer(api, chatId, userId, reason = 'Fichado en Lista Negra Global') {
    try {
      await api.banChatMember(chatId, userId);
      return true;
    } catch (err) {
      console.warn(`⟡ [SentinelAgent] Error expulsando estafador ${userId}:`, err.message);
      return false;
    }
  }
}

module.exports = SentinelAgent;

