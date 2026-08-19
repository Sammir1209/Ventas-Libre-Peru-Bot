const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const config = require('../config/env');

let client = null;

// ══════════════════════════════════════════════════════
// ⟡ Inicialización del Userbot MTProto
// ══════════════════════════════════════════════════════

async function initialize() {
  if (!config.USERBOT_ENABLED) {
    console.log('⟡ Userbot: Deshabilitado (credenciales MTProto no configuradas).');
    return;
  }

  try {
    const session = new StringSession(config.USERBOT_SESSION);
    client = new TelegramClient(session, config.USERBOT_API_ID, config.USERBOT_API_HASH, {
      connectionRetries: 5,
    });

    await client.connect();
    const me = await client.getMe();
    const myName = me ? (me.username ? `@${me.username}` : me.firstName || 'Userbot') : 'Conectado';
    console.log(`⟡ Userbot: Conectado correctamente vía MTProto (${myName}).`);
  } catch (err) {
    console.error('⟡ Userbot: Error al conectar:', err.message);
    client = null;
  }
}

// ══════════════════════════════════════════════════════
// ⟡ Crear Grupo Temporal para Trato
// ══════════════════════════════════════════════════════

async function createDealGroup(dealId, botId) {
  if (!client || !isConnected()) {
    throw new Error('Userbot no está conectado. Verifica las credenciales MTProto.');
  }

  try {
    const title = `⟡ Trato #${dealId} ⊱ Ventas Libres`;

    const result = await client.invoke(
      new Api.messages.CreateChat({
        users: [botId.toString()],
        title: title,
      })
    );

    const chat = result.chats ? result.chats[0] : null;
    if (!chat) {
      throw new Error('No se pudo obtener el chat creado.');
    }

    const chatId = chat.id;

    const inviteResult = await client.invoke(
      new Api.messages.ExportChatInvite({
        peer: chatId,
        title: `Invitación Trato #${dealId}`,
        usageLimit: 2,
      })
    );

    const inviteLink = inviteResult.link;
    console.log(`⟡ Userbot: Grupo creado para Trato #${dealId} | Link: ${inviteLink}`);

    return {
      chatId: -chatId,
      inviteLink,
      title,
    };
  } catch (err) {
    console.error(`⟡ Userbot: Error creando grupo para Trato #${dealId}:`, err.message);
    throw err;
  }
}

// ══════════════════════════════════════════════════════
// ⟡ Utilidades del Userbot
// ══════════════════════════════════════════════════════

function isConnected() {
  return client !== null && (client.connected || client._connected);
}

async function close() {
  if (client) {
    await client.disconnect();
    console.log('⟡ Userbot: Desconectado.');
  }
}

/**
 * Resuelve cualquier @username o ID de Telegram a través de MTProto directamente
 */
async function resolveUser(usernameOrId) {
  if (!client || !isConnected()) return null;
  try {
    const target = typeof usernameOrId === 'string' ? usernameOrId.replace(/^@/, '') : usernameOrId;
    const entity = await client.getEntity(target);
    if (entity) {
      const rawId = entity.id ? (entity.id.value !== undefined ? entity.id.value : entity.id) : null;
      const userId = Number(rawId);

      return {
        userId: userId,
        username: entity.username || (typeof target === 'string' && !/^\d+$/.test(target) ? target : null),
        firstName: entity.firstName || entity.title || null,
        lastName: entity.lastName || null,
      };
    }
  } catch (err) {
    console.warn(`⟡ Userbot: No se pudo resolver ${usernameOrId} vía MTProto:`, err.message);
  }
  return null;
}

/**
 * Desmutea y remueve todas las restricciones de un usuario vía MTProto directamente
 */
async function unrestrictUser(chatId, userId) {
  if (!client || !isConnected()) return false;
  try {
    const chatEntity = await client.getEntity(chatId);
    const userEntity = await client.getEntity(userId);
    if (chatEntity && userEntity) {
      await client.invoke(
        new Api.channels.EditBanned({
          channel: chatEntity,
          participant: userEntity,
          bannedRights: new Api.ChatBannedRights({
            untilDate: 0,
            viewMessages: false,
            sendMessages: false,
            sendMedia: false,
            sendStickers: false,
            sendGifs: false,
            sendGames: false,
            sendInline: false,
            embedLinks: false,
            sendPolls: false,
            changeInfo: false,
            inviteUsers: false,
            pinMessages: false,
            manageTopics: false,
            sendPhotos: false,
            sendVideos: false,
            sendRoundvideos: false,
            sendAudios: false,
            sendVoices: false,
            sendDocs: false,
            sendPlain: false,
          }),
        })
      );
      console.log(`✓ Userbot MTProto: Restricciones levantadas exitosamente para ${userId} en ${chatId}`);
      return true;
    }
  } catch (err) {
    // Si el userbot no es admin en ese chat, el bot oficial lo hace vía Bot API
  }
  return false;
}

/**
 * Busca usuarios directamente en los grupos usando el motor nativo de Telegram (MTProto).
 * Esto permite encontrar usuarios por nombre, soporte completo de unicodes y gente que nunca ha hablado.
 */
async function searchCommunityUsers(query, chatIds) {
  if (!client || !isConnected()) return [];
  const resultsMap = new Map();

  for (const chatId of chatIds) {
    try {
      const entity = await client.getEntity(chatId);
      const participants = await client.getParticipants(entity, {
        search: query,
        limit: 10,
      });

      for (const p of participants) {
        const id = Number(p.id?.value || p.id);
        if (!resultsMap.has(id)) {
          resultsMap.set(id, {
            user_id: id,
            username: p.username || null,
            first_name: p.firstName || p.title || 'Usuario',
            is_burned: false,
          });
        }
      }
    } catch (err) {
      console.warn(`⟡ Userbot: Error buscando en chat ${chatId}:`, err.message);
    }
  }

  return Array.from(resultsMap.values());
}

module.exports = {
  resolveUser,
  unrestrictUser,
  searchCommunityUsers,
  initialize,
  createDealGroup,
  isConnected,
  close,
};
