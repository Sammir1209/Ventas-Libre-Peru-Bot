const redisDb = require('../../database/redis');

// ── Parámetros de Memoria Conversacional ──
const SESSION_TTL = 1800; // 30 minutos de inactividad
const MAX_HISTORY_MESSAGES = 10; // Máximo 10 mensajes (5 turnos de ida y vuelta)

/**
 * Obtiene el historial de mensajes de la sesión del usuario.
 */
async function getSessionHistory(userId) {
  if (!userId) return [];
  const key = `ai_session:${userId}`;
  const history = await redisDb.getCache(key);
  return Array.isArray(history) ? history : [];
}

/**
 * Agrega un mensaje (user o model) al historial del usuario y renueva el TTL de 30 min.
 */
async function addMessageToSession(userId, role, text) {
  if (!userId || !text) return;
  const key = `ai_session:${userId}`;
  let history = await getSessionHistory(userId);

  // Normalizar estructura esperada por Gemini
  history.push({
    role: role === 'user' ? 'user' : 'model',
    parts: [{ text: text.trim() }],
  });

  // Mantener solo los últimos MAX_HISTORY_MESSAGES
  if (history.length > MAX_HISTORY_MESSAGES) {
    history = history.slice(-MAX_HISTORY_MESSAGES);
  }

  await redisDb.setCache(key, history, SESSION_TTL);
}

/**
 * Borra la sesión conversacional de un usuario (para reiniciar contexto).
 */
async function clearSession(userId) {
  if (!userId) return;
  const key = `ai_session:${userId}`;
  await redisDb.clearCache(key);
}

module.exports = {
  getSessionHistory,
  addMessageToSession,
  clearSession,
};
