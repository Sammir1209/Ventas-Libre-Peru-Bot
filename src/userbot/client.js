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
    console.log('⟡ Userbot: Conectado correctamente vía MTProto.');
  } catch (err) {
    console.error('⟡ Userbot: Error al conectar:', err.message);
    client = null;
  }
}

// ══════════════════════════════════════════════════════
// ⟡ Crear Grupo Temporal para Trato
// ══════════════════════════════════════════════════════

async function createDealGroup(dealId, botId) {
  if (!client) {
    throw new Error('Userbot no está conectado. Verifica las credenciales MTProto.');
  }

  try {
    // 1. Crear grupo básico con el bot como participante
    const title = `⟡ Trato #${dealId} ⊱ Ventas Libres`;

    const result = await client.invoke(
      new Api.messages.CreateChat({
        users: [botId.toString()],
        title: title,
      })
    );

    // Extraer el chat ID del resultado
    const chat = result.chats ? result.chats[0] : null;
    if (!chat) {
      throw new Error('No se pudo obtener el chat creado.');
    }

    const chatId = chat.id;

    // 2. Generar enlace de invitación
    const inviteResult = await client.invoke(
      new Api.messages.ExportChatInvite({
        peer: chatId,
        title: `Invitación Trato #${dealId}`,
        usageLimit: 2, // Solo 2 personas pueden unirse
      })
    );

    const inviteLink = inviteResult.link;

    console.log(`⟡ Userbot: Grupo creado para Trato #${dealId} | Link: ${inviteLink}`);

    return {
      chatId: -chatId, // Negativo para formato de Bot API
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
  return client !== null && client.connected;
}

async function close() {
  if (client) {
    await client.disconnect();
    console.log('⟡ Userbot: Desconectado.');
  }
}


async function resolveUser(usernameOrId) {
  if (!client || !client.connected) return null;
  try {
    const target = typeof usernameOrId === 'string' ? usernameOrId.replace(/^@/, '') : usernameOrId;
    const entity = await client.getEntity(target);
    if (entity) {
      return {
        userId: Number(entity.id),
        username: entity.username || (typeof target === 'string' && !/^\d+$/.test(target) ? target : null),
        firstName: entity.firstName || entity.title || null,
        lastName: entity.lastName || null,
      };
    }
  } catch (err) {
    console.error('⟡ Userbot: Error resolviendo ' + usernameOrId + ':', err.message);
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
