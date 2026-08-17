const config = require('../../config/env');
const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const templates = require('../../utils/templates');

// ── Configuración del Programador Inteligente ──
const NOTICE_INTERVAL_MS = 20 * 60 * 1000; // Cada 20 minutos
const MIN_ACTIVITY_MESSAGES = 10; // Mínimo 10 mensajes de usuarios reales

/**
 * Inicia el temporizador en background para publicar el aviso de seguridad cada 20 minutos
 * ÚNICAMENTE si el grupo registra actividad real de conversación (>= 10 mensajes).
 */
function startPeriodicNoticeScheduler(bot) {
  // ── Rastreador de Actividad de Chat (Mensajes reales) ──
  bot.on('message', async (ctx, next) => {
    try {
      if (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group') {
        const sender = ctx.from;
        if (sender && !sender.is_bot) {
          const countKey = `chat_activity_count:${ctx.chat.id}`;
          const current = (await redisDb.getCache(countKey)) || 0;
          await redisDb.setCache(countKey, Number(current) + 1, 86400);
        }
      }
    } catch {}
    return next();
  });

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
            continue;
          }

          // ── FILTRO INTELIGENTE ANTI-SPAM: Verificar si hay conversación activa (>= 10 mensajes) ──
          const countKey = `chat_activity_count:${chatId}`;
          const activityCount = Number((await redisDb.getCache(countKey)) || 0);

          if (activityCount < MIN_ACTIVITY_MESSAGES) {
            console.log(`⟡ Aviso Seguridad: Omitido en ${chatId} (${activityCount}/${MIN_ACTIVITY_MESSAGES} mensajes — Chat sin actividad suficiente para evitar spam).`);
            continue;
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
            // Reiniciar el contador de actividad para el siguiente ciclo
            await redisDb.setCache(countKey, 0, 86400);
            console.log(`✓ Aviso Seguridad enviado en ${chatId} (Actividad: ${activityCount} mensajes procesados).`);
          }
        } catch (grpErr) {
          // Silenciar si no tiene permisos o si falló la entrega
        }
      }
    } catch (err) {
      console.error('⟡ Error en periodicNoticeScheduler:', err.message);
    }
  }

  // Programación fija cada 20 minutos
  setInterval(() => {
    broadcastNotice().catch(() => {});
  }, NOTICE_INTERVAL_MS);

  console.log('✓ Aviso Periódico de Seguridad: Programado cada 20 min con filtro anti-spam (requiere >= 10 mensajes activos).');
}

module.exports = {
  startPeriodicNoticeScheduler,
};
