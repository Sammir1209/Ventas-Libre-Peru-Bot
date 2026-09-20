const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const { SYM } = require('../../config/constants');
const { mentionFromData, escapeHtml } = require('../../utils/formatting');
const logger = require('./logger');

// ══════
// ⟡ Módulo: Lista Negra Dinámica & Reactive Defense
// Detección y expulsión automática inmediata de estafadores
// ══════

// Caché local en memoria de IDs quemados para resolución en 0 ms
const localBurnedCache = new Set();
let lastCacheSync = 0;

/**
 * Sincroniza la caché en memoria de usuarios quemados desde la base de datos
 */
async function syncBurnedCache() {
  const now = Date.now();
  // Sincronizar máximo cada 5 minutos
  if (now - lastCacheSync < 300000 && localBurnedCache.size > 0) {
    return;
  }

  try {
    const list = await db.getAllBurnedUsers();
    if (Array.isArray(list)) {
      localBurnedCache.clear();
      for (const b of list) {
        if (b.user_id) localBurnedCache.add(Number(b.user_id));
      }
      lastCacheSync = now;
    }
  } catch (err) {
    // Si falla getAllBurnedUsers, no romper el ciclo
  }
}

/**
 * Comprueba rápidamente si un usuario está en la lista negra
 */
async function checkIsBurned(userId, username) {
  if (!userId && !username) return false;

  const numId = Number(userId);
  if (numId && localBurnedCache.has(numId)) {
    return true;
  }

  return await db.isUserBurned(numId, username);
}

/**
 * Neutraliza a un usuario de la lista negra detectado en un grupo
 */
async function neutralizarIntruso(ctx, chat, user, triggerEvent = 'JOIN') {
  if (!chat || !user || user.is_bot) return false;
  if (chat.type !== 'group' && chat.type !== 'supergroup') return false;

  const chatId = chat.id;
  const userId = user.id;
  const username = user.username || null;
  const firstName = user.first_name || 'Usuario';

  const isBurned = await checkIsBurned(userId, username);
  if (!isBurned) return false;

  console.warn(`🚨 [LISTA NEGRA DINÁMICA] Intruso detectado (${triggerEvent}): ID ${userId} (@${username}) en ${chatId}`);

  // 1. Añadir inmediatamente a la caché en memoria
  localBurnedCache.add(Number(userId));

  // 2. Expulsar y bloquear de inmediato
  try {
    await ctx.api.banChatMember(chatId, userId);
  } catch (err) {
    console.error(`⟡ [LISTA NEGRA] Error al banear en ${chatId}:`, err.message);
  }

  // 3. Borrar mensaje de servicio o mensaje que activó el trigger
  try {
    if (ctx.message) {
      await ctx.deleteMessage();
    }
  } catch {}

  // 4. Publicar advertencia en el grupo
  try {
    const userMention = mentionFromData(userId, username, firstName);
    const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';

    const text =
      `<b>⟡ [LISTA NEGRA DINÁMICA] INTRUSO NEUTRALIZADO</b>\n` +
      `──────\n\n` +
      `▸ <b>Usuario:</b> ${userMention}\n` +
      `▸ <b>ID:</b> <code>${userId}</code>\n` +
      `▸ <b>Estado:</b> ⊱ <code>ESTAFADOR FICHADO 🔴</code> ⊰\n` +
      `▸ <b>Detección:</b> <i>Intentó ingresar vía ${escapeHtml(triggerEvent)}</i>\n` +
      `▸ <b>Acción:</b> <i>Expulsado y bloqueado automáticamente por seguridad.</i>\n\n` +
      `──────\n` +
      `🛡️ <i>Protección reactiva de ${escapeHtml(communityName)}.</i>`;

    await ctx.api.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  } catch (msgErr) {
    console.warn('⟡ [LISTA NEGRA] No se pudo enviar alerta pública:', msgErr.message);
  }

  // 5. Notificar al canal de logs del staff
  try {
    await logger.sendLog(
      ctx.api,
      'BLACKLIST_REACTIVE',
      { id: 0, first_name: 'Lista Negra Dinámica', username: 'defensor' },
      userId,
      chat.title || 'Comunidad Oficial',
      `Intento de ingreso neutralizado vía ${triggerEvent}`
    );
  } catch {}

  return true;
}

/**
 * Registra los interceptores de eventos de la Lista Negra Dinámica
 */
function register(bot) {
  // Inicializar caché de fondo
  syncBurnedCache().catch(() => {});

  // ── Evento A: chat_member (Captura uniones furtivas en supergrupos con mensajes ocultos) ──
  bot.on('chat_member', async (ctx, next) => {
    try {
      const update = ctx.chatMember;
      if (!update) return next();

      const botId = ctx.me?.id;
      if (update.from && botId && update.from.id === botId) return next();

      const oldStatus = update.old_chat_member?.status;
      const newStatus = update.new_chat_member?.status;
      const user = update.new_chat_member?.user;

      // Detectar ingreso desde el exterior hacia 'member'
      if ((oldStatus === 'left' || oldStatus === 'kicked' || !oldStatus) && newStatus === 'member') {
        const handled = await neutralizarIntruso(ctx, update.chat, user, 'CHAT_MEMBER_JOIN');
        if (handled) return;
      }
    } catch (err) {
      console.error('⟡ Error en dynamicBlacklist chat_member:', err.message);
    }
    return next();
  });

  // ── Evento B: message:new_chat_members (Uniones convencionales) ──
  bot.on('message:new_chat_members', async (ctx, next) => {
    try {
      const newMembers = ctx.message?.new_chat_members || [];
      for (const member of newMembers) {
        const handled = await neutralizarIntruso(ctx, ctx.chat, member, 'NEW_CHAT_MEMBERS');
        if (handled) return;
      }
    } catch (err) {
      console.error('⟡ Error en dynamicBlacklist new_chat_members:', err.message);
    }
    return next();
  });

  // ── Evento C: chat_join_request (Solicitudes de ingreso a grupos con enlace de aprobación) ──
  bot.on('chat_join_request', async (ctx, next) => {
    try {
      const req = ctx.chatJoinRequest;
      if (!req) return next();

      const isBurned = await checkIsBurned(req.from.id, req.from.username);
      if (isBurned) {
        console.warn(`🚨 [LISTA NEGRA] Solicitud de ingreso rechazada para estafador: ${req.from.id} (@${req.from.username})`);
        try {
          await ctx.api.declineChatJoinRequest(req.chat.id, req.from.id);
        } catch {}
        return;
      }
    } catch (err) {
      console.error('⟡ Error en dynamicBlacklist chat_join_request:', err.message);
    }
    return next();
  });
}

module.exports = {
  register,
  checkIsBurned,
  neutralizarIntruso,
  syncBurnedCache,
};
