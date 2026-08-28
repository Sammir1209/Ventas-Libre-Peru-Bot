const config = require('../../config/env');
const db = require('../../database/postgres');
const templates = require('../../utils/templates');
const { SYM } = require('../../config/constants');
const { InlineKeyboard } = require('grammy');

/**
 * Genera el teclado con botones interactivos (.primary) para cada registro de log
 */
function buildLogKeyboard(action, targetId) {
  if (!targetId || targetId === 0) return undefined;

  const kb = new InlineKeyboard();
  const act = (action || '').toUpperCase();

  if (act === 'BAN' || act === 'GBAN' || act === 'ANTI_CLON_BAN') {
    kb.text('UNBAN', `log_unban:${targetId}`).primary();
    kb.text('INFO', `log_info:${targetId}`).primary();
  } else if (act === 'MUTE') {
    kb.text('UNMUTE', `log_unmute:${targetId}`).primary();
    kb.text('INFO', `log_info:${targetId}`).primary();
  } else if (act === 'WARN') {
    kb.text('BAN', `log_ban:${targetId}`).danger();
    kb.text('INFO', `log_info:${targetId}`).primary();
  } else {
    kb.text('INFO', `log_info:${targetId}`).primary();
  }

  return kb;
}

/**
 * Envía un log formateado con botones interactivos al canal de logs del Staff.
 */
async function sendLog(api, action, moderator, targetId, chatTitle, reason) {
  if (!config.LOG_CHANNEL_ID) return;

  const moderatorMention = moderator.username
    ? `@${moderator.username}`
    : `<a href="tg://user?id=${moderator.id}">${moderator.first_name || 'Mod'}</a>`;

  const keyboard = buildLogKeyboard(action, targetId);

  try {
    await api.sendMessage(
      config.LOG_CHANNEL_ID,
      templates.modLogEntry(action, moderatorMention, targetId, chatTitle, reason),
      {
        parse_mode: 'HTML',
        ...(config.LOG_THREAD_ID ? { message_thread_id: config.LOG_THREAD_ID } : {}),
        ...(keyboard ? { reply_markup: keyboard } : {}),
      }
    );
  } catch (err) {
    console.error('⟡ Logger: Error enviando log con botones:', err.message);
  }
}

module.exports = {
  sendLog,
  buildLogKeyboard,
};
