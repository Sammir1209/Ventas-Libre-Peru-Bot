const config = require('../config/env');
const db = require('../database/postgres');

// ══════════════════════════════════════════════════════
// ⟡ Utilidades Generales — Ventas Libres Perú
// ══════════════════════════════════════════════════════

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
      firstName: null,
    };
  }

  return null;
}

/**
 * Resuelve de forma completa un target (ID, username o reply) buscando en API y BD.
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

  // Si tenemos username (ej: cinefastperu)
  if (target.username) {
    const cleanUsername = target.username.replace(/^@/, '');

    // 1. Intentar resolver via Telegram API getChat
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

    // 2. Buscar en la base de datos de usuarios registrados
    try {
      const dbUser = await db.getUserByUsername(cleanUsername);
      if (dbUser && dbUser.user_id) {
        return {
          userId: Number(dbUser.user_id),
          username: dbUser.username || cleanUsername,
          firstName: dbUser.first_name || null,
        };
      }
    } catch {}

    // 3. Retornar con el username para indicar qué falta
    return {
      userId: null,
      username: cleanUsername,
      firstName: null,
      unresolved: true,
    };
  }

  return null;
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

module.exports = {
  isOwner,
  extractTarget,
  resolveTarget,
  delay,
  forEachGroup,
};
