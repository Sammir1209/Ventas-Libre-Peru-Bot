const redisDb = require('../../database/redis');

// Memoria local como fallback inmediato de alta velocidad
const activityMem = new Map();

/**
 * Registra un mensaje enviado por un usuario en un grupo
 */
async function trackActivity(chatId, userId, text = '') {
  if (!chatId || !userId) return;
  const key = `${chatId}:${userId}`;
  const now = new Date();
  const cleanSnippet = (text || '').replace(/\s+/g, ' ').trim().slice(0, 100) || '(Multimedia / Archivo)';

  // 1. En memoria local
  const current = activityMem.get(key) || { count: 0, lastMessage: '', lastDate: now };
  current.count += 1;
  current.lastMessage = cleanSnippet;
  current.lastDate = now;
  activityMem.set(key, current);

  // 2. En Redis / Caché si está disponible
  try {
    if (redisDb.setCache) {
      await redisDb.setCache(`user_act:${key}`, {
        count: current.count,
        lastMessage: current.lastMessage,
        lastDate: now.toISOString(),
      }, 86400 * 30); // 30 días
    }
  } catch {}
}

/**
 * Obtiene la actividad registrada de un usuario en un grupo
 */
async function getUserActivity(chatId, userId) {
  if (!chatId || !userId) return { count: 1, lastMessage: 'No registrado', lastDate: new Date() };
  const key = `${chatId}:${userId}`;

  // 1. Revisar memoria local
  if (activityMem.has(key)) {
    return activityMem.get(key);
  }

  // 2. Revisar caché persistente
  try {
    if (redisDb.getCache) {
      const cached = await redisDb.getCache(`user_act:${key}`);
      if (cached) {
        activityMem.set(key, {
          count: cached.count || 1,
          lastMessage: cached.lastMessage || 'No registrado',
          lastDate: cached.lastDate ? new Date(cached.lastDate) : new Date(),
        });
        return activityMem.get(key);
      }
    }
  } catch {}

  return {
    count: 1,
    lastMessage: 'Sin registros previos en esta sesión',
    lastDate: new Date(),
  };
}

module.exports = {
  trackActivity,
  getUserActivity,
};
