const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const config = require('../config/env');

let client = null;

// ══════
// ⟡ Inicialización del Userbot MTProto
// ══════

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
    client.setLogLevel('error');

    await client.connect();
    const me = await client.getMe();
    const myName = me ? (me.username ? `@${me.username}` : me.firstName || 'Userbot') : 'Conectado';
    console.log(`⟡ Userbot: Conectado correctamente vía MTProto (${myName}).`);

    // Cachear entidades (grupos/canales) al inicio para que getEntity(chatId) no falle con CHANNEL_INVALID
    try {
      await client.getDialogs({}); // Sin límite, descarga todos los chats activos del userbot
      console.log('⟡ Userbot: Entidades cacheadas correctamente.');
    } catch (dErr) {
      console.warn('⟡ Userbot: Aviso al cachear diálogos:', dErr.message);
    }
  } catch (err) {
    console.error('⟡ Userbot: Error al conectar:', err.message);
    if (client) {
      try { await client.disconnect(); } catch {}
      try { await client.destroy(); } catch {}
    }
    client = null;
  }
}

// ══════
// ⟡ Crear Grupo Temporal para Trato
// ══════

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

// ══════
// ⟡ Utilidades del Userbot
// ══════

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
 * Resuelve cualquier @username o ID de Telegram a través de MTProto directamente.
 * Obtiene nombre completo, username, ID numérico, biografía (about) y estado.
 */
async function resolveUser(usernameOrId) {
  if (!client || !isConnected()) return null;
  try {
    const target = typeof usernameOrId === 'string' ? usernameOrId.replace(/^@/, '') : usernameOrId;
    const entity = await client.getEntity(target);
    if (entity) {
      const rawId = entity.id ? (entity.id.value !== undefined ? entity.id.value : entity.id) : null;
      const userId = Number(rawId);

      let bio = null;
      let isOnline = false;

      // Intentar obtener el perfil completo (GetFullUser) para extraer biografía y estado real
      try {
        const full = await client.invoke(new Api.users.GetFullUser({ id: entity }));
        if (full) {
          const userFull = full.fullUser || full;
          if (userFull && userFull.about) {
            bio = userFull.about;
          }
        }
      } catch (fullErr) {
        // En caso de usuarios con privacidad estricta, continuar con entity básica
      }

      if (entity.status) {
        isOnline = entity.status.className === 'UserStatusOnline';
      }

      return {
        userId: userId,
        username: entity.username || (typeof target === 'string' && !/^\d+$/.test(target) ? target : null),
        firstName: entity.firstName || entity.title || null,
        lastName: entity.lastName || null,
        bio: bio,
        isOnline: isOnline,
      };
    }
  } catch (err) {
    console.warn(`⟡ Userbot: No se pudo resolver ${usernameOrId} vía MTProto:`, err.message);
  }
  return null;
}

/**
 * Descarga la foto de perfil de cualquier usuario o chat vía MTProto a un Buffer
 */
async function downloadProfilePhoto(usernameOrId) {
  if (!client || !isConnected()) return null;
  try {
    const target = typeof usernameOrId === 'string' ? usernameOrId.replace(/^@/, '') : usernameOrId;
    const entity = await client.getEntity(target);
    if (entity) {
      const buffer = await client.downloadProfilePhoto(entity);
      return buffer || null;
    }
  } catch (err) {
    console.warn(`⟡ Userbot: No se pudo descargar foto de ${usernameOrId}:`, err.message);
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
 * Busca usuarios directamente en Telegram usando el motor nativo MTProto.
 * Combina búsqueda global de contactos/usuarios y escaneo en los grupos activos del userbot.
 * Soporta fuentes decorativas, unicodes, nombres partidos con/sin espacios y usuarios sin username.
 */
async function searchCommunityUsers(query, chatIds = []) {
  if (!client || !isConnected() || !query) return [];
  const resultsMap = new Map();

  const cleanNorm = query
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  const words = cleanNorm.split(/\s+/).filter(Boolean);
  const noSpaces = cleanNorm.replace(/[\s_\-\.]+/g, '');

  // 1. Búsqueda Nativa Global MTProto (contacts.Search)
  const searchVariants = [query, noSpaces];
  if (words.length > 1) searchVariants.push(words[0]);

  for (const qVar of searchVariants) {
    if (!qVar || qVar.length < 2) continue;
    try {
      const globalRes = await client.invoke(new Api.contacts.Search({ q: qVar, limit: 15 }));
      if (globalRes && globalRes.users) {
        for (const u of globalRes.users) {
          const uid = Number(u.id?.value || u.id);
          const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Usuario';
          const normName = fullName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const normUser = (u.username || '').toLowerCase();
          const normNameNoSpaces = normName.replace(/[\s_\-\.]+/g, '');
          const normUserNoSpaces = normUser.replace(/[\s_\-\.]+/g, '');

          const directMatch = normName.includes(cleanNorm) || normUser.includes(cleanNorm);
          const noSpacesMatch = noSpaces.length >= 2 && (normNameNoSpaces.includes(noSpaces) || normUserNoSpaces.includes(noSpaces));
          const wordsMatch = words.length > 1 && words.every((w) => normName.includes(w) || normUser.includes(w) || normNameNoSpaces.includes(w));

          if (directMatch || noSpacesMatch || wordsMatch) {
            if (!resultsMap.has(uid)) {
              resultsMap.set(uid, {
                user_id: uid,
                username: u.username || null,
                first_name: fullName,
                is_burned: false,
              });
            }
          }
        }
      }
    } catch {}
  }

  // 2. Búsqueda en los diálogos reales y accesibles del Userbot
  try {
    const dialogs = await client.getDialogs({ limit: 40 });
    for (const d of dialogs) {
      if (!d.isGroup && !d.isChannel) continue;
      try {
        const participants = await client.getParticipants(d.entity, {
          search: query,
          limit: 30,
        });

        for (const p of participants) {
          const uid = Number(p.id?.value || p.id);
          const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.title || 'Usuario';
          const normName = fullName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const normUser = (p.username || '').toLowerCase();
          const normNameNoSpaces = normName.replace(/[\s_\-\.]+/g, '');
          const normUserNoSpaces = normUser.replace(/[\s_\-\.]+/g, '');

          const directMatch = normName.includes(cleanNorm) || normUser.includes(cleanNorm);
          const noSpacesMatch = noSpaces.length >= 2 && (normNameNoSpaces.includes(noSpaces) || normUserNoSpaces.includes(noSpaces));
          const wordsMatch = words.length > 1 && words.every((w) => normName.includes(w) || normUser.includes(w) || normNameNoSpaces.includes(w));

          if (directMatch || noSpacesMatch || wordsMatch) {
            if (!resultsMap.has(uid)) {
              resultsMap.set(uid, {
                user_id: uid,
                username: p.username || null,
                first_name: fullName,
                is_burned: false,
              });
            }
          }
        }
      } catch {}
    }
  } catch {}

  return Array.from(resultsMap.values());
}

module.exports = {
  resolveUser,
  downloadProfilePhoto,
  unrestrictUser,
  searchCommunityUsers,
  initialize,
  createDealGroup,
  isConnected,
  getClient: () => client,
  close,
};
