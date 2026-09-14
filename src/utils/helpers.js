const config = require('../config/env');
const db = require('../database/postgres');
const userbot = require('../userbot/client');

// ══════
// ⟡ Utilidades Generales — Ventas Libres Perú
// ══════

/**
 * Verifica si un userId es Owner del bot.
 */
function isOwner(userId) {
  return config.OWNER_IDS.includes(userId);
}

/**
 * Extrae el target user de un comando.
 * Soporta: reply al mensaje, ID numérico, o @username como argumento.
 */
function extractTarget(ctx) {
  // 1. Si es reply a un mensaje
  if (ctx.message?.reply_to_message?.from) {
    const from = ctx.message.reply_to_message.from;
    return {
      userId: from.id,
      username: from.username || null,
      firstName: from.first_name || null,
    };
  }

  // 2. Extraer del texto del comando
  const text = ctx.message?.text || '';
  const parts = text.split(/\s+/);

  if (parts.length < 2) return null;

  const arg = parts[1];

  // Es un ID numérico
  if (/^\d+$/.test(arg)) {
    return {
      userId: parseInt(arg),
      username: null,
      firstName: null,
    };
  }

  // Es un @username
  if (arg.startsWith('@')) {
    return {
      userId: null,
      username: arg.substring(1),
      firstName: null,
    };
  }

  // Es un username sin arroba
  if (/^[a-zA-Z0-9_]{3,32}$/.test(arg)) {
    return {
      userId: null,
      username: arg,
      query: arg,
      firstName: null,
    };
  }

  // 3. Consulta de búsqueda por nombre o frase (ej: "arthur fso", "Carlos", etc.)
  const fullQuery = parts.slice(1).join(' ').trim();
  if (fullQuery) {
    return {
      userId: null,
      username: fullQuery.startsWith('@') ? fullQuery.slice(1) : null,
      query: fullQuery,
      firstName: null,
    };
  }

  return null;
}

/**
 * Resuelve de forma completa un target (ID, username, nombre o reply) buscando en Userbot, API y BD.
 */
async function resolveTarget(ctx) {
  const target = extractTarget(ctx);
  if (!target) return null;

  // Si ya tenemos userId (de reply o número)
  if (target.userId) {
    if (!target.username) {
      try {
        const chatInfo = await ctx.api.getChat(target.userId);
        target.username = chatInfo.username || null;
        target.firstName = chatInfo.first_name || null;
      } catch {}
    }
    return target;
  }

  const query = target.query || target.username;
  if (!query) return null;

  const cleanUsername = query.replace(/^@/, '').trim();

  // 1. Intentar resolver vía Userbot MTProto si es username o ID
  if (userbot.isConnected() && !cleanUsername.includes(' ')) {
    try {
      const ubUser = await userbot.resolveUser(cleanUsername);
      if (ubUser && ubUser.userId) {
        return ubUser;
      }
    } catch (err) {}
  }

  // 2. Intentar resolver via Telegram API getChat (si no tiene espacios)
  if (!cleanUsername.includes(' ')) {
    try {
      const chatInfo = await ctx.api.getChat(`@${cleanUsername}`);
      if (chatInfo && chatInfo.id) {
        return {
          userId: chatInfo.id,
          username: chatInfo.username || cleanUsername,
          firstName: chatInfo.first_name || null,
        };
      }
    } catch {}
  }

  // 3. Buscar en la base de datos de usuarios registrados (por username exacto o búsqueda tokenizada)
  try {
    const dbUser = await db.getUserByUsername(cleanUsername);
    if (dbUser && dbUser.user_id) {
      return {
        userId: Number(dbUser.user_id),
        username: dbUser.username || cleanUsername,
        firstName: dbUser.first_name || null,
      };
    }

    const searchMatches = await db.searchUsers(query);
    if (searchMatches && searchMatches.length > 0) {
      const match = searchMatches[0];
      return {
        userId: Number(match.user_id),
        username: match.username || null,
        firstName: match.first_name || null,
      };
    }
  } catch {}

  // 4. Búsqueda inteligente con Userbot MTProto (contacts.Search y grupos)
  if (userbot.isConnected()) {
    try {
      const ubMatches = await userbot.searchCommunityUsers(query);
      if (ubMatches && ubMatches.length > 0) {
        const match = ubMatches[0];
        db.upsertUser(match.user_id, match.username, match.first_name).catch(() => {});
        return {
          userId: Number(match.user_id),
          username: match.username || null,
          firstName: match.first_name || null,
        };
      }
    } catch {}
  }

  // 5. Retornar con el username para indicar que no pudo resolverse
  return {
    userId: null,
    username: cleanUsername,
    firstName: null,
    unresolved: true,
  };
}

/**
 * Delay helper.
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ejecuta una acción en todos los grupos oficiales de forma segura.
 */
async function forEachGroup(groups, action) {
  const results = [];
  for (const group of groups) {
    try {
      await action(group);
      results.push({ chatId: group.chat_id, success: true });
    } catch (err) {
      results.push({ chatId: group.chat_id, success: false, error: err.message });
    }
    await delay(200);
  }
  return results;
}

/**
 * Edita un mensaje de forma segura, ignorando el error 400 cuando el texto/teclado no cambió.
 */
async function safeEditMessage(ctx, text, options = {}) {
  try {
    return await ctx.editMessageText(text, options);
  } catch (err) {
    if (
      err.message?.includes('message is not modified') ||
      err.description?.includes('message is not modified') ||
      err.error_code === 400
    ) {
      // Ignorar de forma limpia
      return null;
    }
    throw err;
  }
}

/**
 * Resuelve todos los detalles de un miembro del Staff u Owner con resiliencia multi-capa:
 * 1. Base de datos Staff (específico de tenant o global)
 * 2. Base de datos Users (global)
 * 3. Telegram Bot API (getChat)
 * 4. Userbot MTProto (resolveUser)
 * 5. Auto-cache en BD si se encontraron datos nuevos
 */
async function resolveStaffUserDetails(userId, tenantId = null, ctx = null) {
  if (!userId) return null;
  const numId = Number(userId);
  if (isNaN(numId) || numId <= 0) return null;

  let username = null;
  let firstName = null;
  let customTitle = null;

  // 1. Verificar en tabla staff del tenant
  try {
    const staffMember = await db.getStaffMember(numId, tenantId);
    if (staffMember) {
      if (staffMember.username) username = staffMember.username.replace(/^@/, '');
      if (staffMember.first_name) firstName = staffMember.first_name;
      if (staffMember.custom_title) customTitle = staffMember.custom_title;
    }
  } catch {}

  // Si no se encontró en staff del tenant o faltan datos, chequear registro staff global
  if (tenantId && (!username || !firstName || !customTitle)) {
    try {
      const globalStaff = await db.getStaffMember(numId, null);
      if (globalStaff) {
        if (!username && globalStaff.username) username = globalStaff.username.replace(/^@/, '');
        if (!firstName && globalStaff.first_name) firstName = globalStaff.first_name;
        if (!customTitle && globalStaff.custom_title) customTitle = globalStaff.custom_title;
      }
    } catch {}
  }

  // 2. Verificar en tabla users (global)
  if (!username || !firstName) {
    try {
      const user = await db.getUser(numId);
      if (user) {
        if (!username && user.username) username = user.username.replace(/^@/, '');
        if (!firstName && user.first_name) firstName = user.first_name;
      }
    } catch {}
  }

  // 3. Consultar Telegram Bot API (getChat)
  if ((!username || !firstName) && ctx?.api) {
    try {
      const chatInfo = await ctx.api.getChat(numId);
      if (chatInfo) {
        if (!username && chatInfo.username) username = chatInfo.username.replace(/^@/, '');
        if (!firstName && chatInfo.first_name) firstName = chatInfo.first_name;
      }
    } catch {}
  }

  // 4. Consultar MTProto Userbot
  if ((!username || !firstName) && userbot?.isConnected && userbot.isConnected()) {
    try {
      const ub = await userbot.resolveUser(numId);
      if (ub) {
        if (!username && ub.username) username = ub.username.replace(/^@/, '');
        if (!firstName && ub.firstName) firstName = ub.firstName;
      }
    } catch {}
  }

  // 5. Cachear/actualizar en users para que futuros accesos sean inmediatos
  if (username || firstName) {
    try {
      await db.upsertUser(numId, username, firstName);
    } catch {}
  }

  return {
    user_id: numId,
    username: username || null,
    first_name: (firstName && firstName !== 'Owner' && firstName !== 'Propietario') ? firstName : null,
    custom_title: customTitle || null,
  };
}

module.exports = {
  isOwner,
  extractTarget,
  resolveTarget,
  resolveStaffUserDetails,
  delay,
  forEachGroup,
  safeEditMessage,
};
