const config = require('../config/env');
const db = require('../database/postgres');
const redisDb = require('../database/redis');

// ══════════════════════════════════════════════════════
// ⟡ Middleware Anti-Spam (Con Bypass para Owners y Staff)
// ══════════════════════════════════════════════════════

function antiSpam(windowSeconds = 10, maxActions = 20) {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    // 1. Owners tienen bypass total
    if (config.OWNER_IDS.includes(userId)) {
      return next();
    }

    // 2. Staff tiene bypass total
    try {
      const staff = await db.getStaffMember(userId);
      if (staff) return next();
    } catch {}

    // 3. Rate limiting fluido para usuarios regulares
    try {
      const allowed = await redisDb.checkRateLimit(userId, windowSeconds, maxActions);
      if (!allowed) {
        if (ctx.callbackQuery) {
          return ctx.answerCallbackQuery({
            text: '⚠️ Estás realizando acciones muy rápido. Espera unos segundos.',
            show_alert: true,
          });
        }
        return ctx.reply(
          '⟡ <b>Demasiadas solicitudes</b>\n\n' +
          `✧ Por favor espera unos segundos antes de enviar más mensajes.`,
          { parse_mode: 'HTML' }
        );
      }
    } catch {
      // Si falla la caché, permitir la solicitud
    }

    return next();
  };
}

module.exports = { antiSpam };
