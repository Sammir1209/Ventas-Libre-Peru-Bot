const config = require('../../config/env');
const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const templates = require('../../utils/templates');

// ── Intervalo de Publicación: 20 Minutos ──
const NOTICE_INTERVAL_MS = 20 * 60 * 1000;

/**
 * Inicia el temporizador en background para publicar el aviso de seguridad cada 20 minutos en todos los grupos oficiales.
 */
function startPeriodicNoticeScheduler(bot) {
  async function broadcastNotice() {
    try {
      let botUsername = 'ventas_libres_peru_Bot';
      try {
        const me = await bot.api.getMe();
        if (me?.username) botUsername = me.username;
      } catch {}

      // 1. Obtener todos los grupos registrados
      const groups = await db.getAllGroups();
      const groupList = Array.isArray(groups) ? [...groups] : [];

      // Incluir grupo principal si no está en la lista
      const mainChatId = -1003538147715;
      if (!groupList.some(g => Number(g.chat_id) === mainChatId)) {
        groupList.push({ chat_id: mainChatId, title: 'Comunidad Principal' });
      }

      for (const grp of groupList) {
        const chatId = Number(grp.chat_id);
        if (!chatId) continue;

        // No enviar a grupos de Escrow o Staff privado
        if (chatId === config.ESCROW_GROUP_ID || chatId === config.STAFF_CHAT_ID) {
          continue;
        }

        try {
          // Eliminar aviso anterior para no acumular mensajes en el chat
          const lastMsgId = await redisDb.getCache(`last_notice_msg:${chatId}`);
          if (lastMsgId) {
            try {
              await bot.api.deleteMessage(chatId, Number(lastMsgId));
            } catch {}
          }

          // Enviar nuevo aviso
          const sent = await bot.api.sendMessage(
            chatId,
            templates.periodicSecurityNotice(),
            {
              parse_mode: 'HTML',
              reply_markup: templates.periodicNoticeKeyboard(botUsername),
            }
          );

          if (sent?.message_id) {
            await redisDb.setCache(`last_notice_msg:${chatId}`, sent.message_id, 86400);
          }
        } catch (grpErr) {
          // Silenciar si no tiene permisos en ese grupo específico
        }
      }
    } catch (err) {
      console.error('⟡ Error en periodicNoticeScheduler:', err.message);
    }
  }

  // Primer envío tras 1 minuto de haber iniciado el bot
  setTimeout(() => {
    broadcastNotice().catch(() => {});
  }, 60 * 1000);

  // Programación fija cada 20 minutos
  setInterval(() => {
    broadcastNotice().catch(() => {});
  }, NOTICE_INTERVAL_MS);

  console.log('✓ Aviso Periódico de Seguridad: Programado automáticamente cada 20 minutos.');
}

module.exports = {
  startPeriodicNoticeScheduler,
};
