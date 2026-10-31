// ══════
// ⟡ Sub-Agente 5: AntiBypassGatekeeperAgent (Guardián Anti-Bypass Permanente)
//   Detecta e intercepta mensajes de usuarios no verificados: borra, mutea y notifica
// ══════

const redisDb = require('../../../database/redis');
const db = require('../../../database/postgres');
const config = require('../../../config/env');
const SentinelAgent = require('./sentinelAgent');
const UIAgent = require('./uiAgent');

class AntiBypassGatekeeperAgent {
  /**
   * Evalúa si un mensaje proviene de un usuario no verificado en un grupo protegido.
   * Si detecta bypass: elimina el mensaje, aplica mute preventivo y envía aviso HUD.
   */
  static async handleIncomingMessage(ctx, next) {
    if (!ctx.chat || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {
      return next();
    }

    const chatId = ctx.chat.id;
    const userId = ctx.from?.id;
    if (!userId || ctx.from.is_bot) return next();

    // 1. Eximir canales especiales de administración o escrow
    if (chatId === config.ESCROW_GROUP_ID || chatId === config.STAFF_CHAT_ID) {
      return next();
    }

    // 2. Comprobar si la verificación está desactivada expresamente en este grupo
    const verifyDisabledKey = `verify_disabled:${chatId}`;
    let isDisabled = await redisDb.getCache(verifyDisabledKey);
    if (isDisabled === null || isDisabled === undefined) {
      const saved = await db.getSetting(`verify_disabled_${chatId}`);
      isDisabled = saved === 'true';
      if (isDisabled) await redisDb.setCache(verifyDisabledKey, true, 86400 * 365);
    }
    if (isDisabled) {
      return next();
    }

    // 3. Evaluar con SentinelAgent si el usuario está verificado o exento (Staff/Owner)
    const tenantId = ctx.tenant?.id || null;
    const isVerified = await SentinelAgent.isUserVerified(userId, tenantId);
    if (isVerified) {
      return next();
    }

    // ── INFRACCIÓN / BYPASS DETECTADO ──
    // El usuario no está verificado y ha logrado enviar un mensaje en el grupo.

    // A) Eliminar inmediatamente el mensaje infractor
    await ctx.deleteMessage().catch(() => {});

    // B) Aplicar mute preventivo forzoso
    await SentinelAgent.applyPreventiveMute(ctx.api, chatId, userId);

    // C) Evitar saturación de avisos con un debounce de 20 segundos por usuario
    const warnThrottleKey = `antibypass_warned:${chatId}:${userId}`;
    const alreadyWarned = await redisDb.getCache(warnThrottleKey);
    if (alreadyWarned) {
      return; // Ya fue avisado hace unos segundos, solo se borró y muteó
    }
    await redisDb.setCache(warnThrottleKey, true, 20);

    // D) Si había un mensaje de aviso previo, eliminarlo para no dejar basura
    const prevMsgKey = `antibypass_msg:${chatId}:${userId}`;
    try {
      const prevMsgId = await redisDb.getCache(prevMsgKey);
      if (prevMsgId) {
        await ctx.api.deleteMessage(chatId, Number(prevMsgId)).catch(() => {});
      }
    } catch {}

    // E) Enviar aviso HUD interactivo con botones
    const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
    const folderLink = ctx.tenant?.groups_folder_link || config.GROUPS_FOLDER_LINK || 'https://t.me/addlist/PodUrc_gHJs2ZjNh';
    const welcomeText = UIAgent.renderWelcomeMessage(ctx.from, communityName);
    const keyboard = UIAgent.renderWelcomeKeyboard(userId, folderLink);

    try {
      const warnMsg = await ctx.reply(welcomeText, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });

      if (warnMsg && warnMsg.message_id) {
        await redisDb.setCache(prevMsgKey, warnMsg.message_id, 86400);
      }
    } catch (sendErr) {
      console.warn('⟡ [AntiBypassGatekeeperAgent] Advertencia al enviar aviso:', sendErr.message);
    }
  }
}

module.exports = AntiBypassGatekeeperAgent;
