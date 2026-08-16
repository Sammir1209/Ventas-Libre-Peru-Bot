const config = require('../../config/env');
const db = require('../../database/postgres');
const templates = require('../../utils/templates');
const { SYM } = require('../../config/constants');

// ══════════════════════════════════════════════════════
// ⟡ Logger de Moderación (Canal Privado del Owner)
// ══════════════════════════════════════════════════════

/**
 * Envía un log silencioso al canal de logs.
 */
async function sendLog(api, action, moderator, targetId, chatTitle, reason) {
  if (!config.LOG_CHANNEL_ID) return;

  const moderatorMention = moderator.username
    ? `@${moderator.username}`
    : `<a href="tg://user?id=${moderator.id}">${moderator.first_name || 'Mod'}</a>`;

  try {
    await api.sendMessage(
      config.LOG_CHANNEL_ID,
      templates.modLogEntry(action, moderatorMention, targetId, chatTitle, reason),
      {
        parse_mode: 'HTML',
        ...(config.LOG_THREAD_ID ? { message_thread_id: config.LOG_THREAD_ID } : {}),
      }
    );
  } catch (err) {
    console.error('⟡ Logger: Error enviando log:', err.message);
  }
}

module.exports = { sendLog };
