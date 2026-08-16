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
// ⟡ Crear Grupo Temporal para Trato (Opcional si no se usa Topics)
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

module.exports = {
  resolveUser,
  initialize,
  createDealGroup,
  isConnected,
  close,
};
