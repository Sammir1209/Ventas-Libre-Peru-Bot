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

      // IDs excluidos explícitamente (Canales públicos, Logs, Staff y Escrow)
      const excludedIds = new Set([
        Number(config.ESCROW_GROUP_ID),
        Number(config.STAFF_CHAT_ID),
        Number(config.BURN_CHAT_ID),
        Number(config.LOG_CHANNEL_ID),
        Number(config.PUBLIC_BURN_CHANNEL_ID),
        -1003905787584, // Canal Público de Quemados
        -1003937265207, // Grupo de Staff / Tratos
      ].filter(Boolean));

      // Grupo de Chat Oficial de la Comunidad
      const mainChatId = -1003538147715;

      // Filtrar lista para incluir únicamente grupos/supergrupos de chat oficial
      const targetChats = [];
      
      // Asegurar que el chat principal esté en la lista
      targetChats.push(mainChatId);

      for (const grp of groupList) {
        const chatId = Number(grp.chat_id);
        if (!chatId) continue;
        if (excludedIds.has(chatId)) continue;
        if (grp.type === 'channel') continue; // PROHIBIDO enviar a canales
        if (!targetChats.includes(chatId)) {
          targetChats.push(chatId);
        }
      }

      for (const chatId of targetChats) {
        if (excludedIds.has(chatId)) continue;

        try {
          // Validar que el tipo de chat sea grupo/supergrupo y NO canal
          const chatInfo = await bot.api.getChat(chatId);
          if (chatInfo.type === 'channel') {
            excludedIds.add(chatId);
            continue; // Saltar si es un canal
          }

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
          // Silenciar si no tiene permisos o si falló la entrega
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
