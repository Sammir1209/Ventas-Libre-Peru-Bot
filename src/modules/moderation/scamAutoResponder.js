const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const { mentionFromData, escapeHtml, formatDate } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');

// ══════
// ⟡ Módulo: Auto-Respuestas Preventivas de Estafadores (Anti-Scam Auto-Alert)
// Detecta consultas o menciones de usuarios quemados y alerta proactivamente en el chat
// ══════

// Cooldown de 60 segundos por estafador por grupo para evitar flood
const alertCooldowns = new Map();
const COOLDOWN_MS = 60 * 1000;

/**
 * Extrae menciones (@username, t.me/user e IDs numéricos) de un texto
 */
function extractMentionedTargets(text) {
  if (!text || typeof text !== 'string') return [];
  const targets = [];
  const seen = new Set();

  // 1. @usernames
  const atMatches = text.match(/@([a-zA-Z0-9_]{3,32})\b/g) || [];
  for (const m of atMatches) {
    const clean = m.replace(/^@/, '').toLowerCase();
    if (!seen.has(clean)) {
      seen.add(clean);
      targets.push({ type: 'username', value: clean });
    }
  }

  // 2. Enlaces t.me/usuario
  const linkMatches = text.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{3,32})\b/gi) || [];
  for (const l of linkMatches) {
    const parts = l.split('/');
    const user = (parts[parts.length - 1] || '').toLowerCase();
    if (user && !['joinchat', 'c', 'share'].includes(user) && !seen.has(user)) {
      seen.add(user);
      targets.push({ type: 'username', value: user });
    }
  }

  // 3. IDs numéricos sueltos (de 6 a 14 dígitos)
  const idMatches = text.match(/\b([1-9]\d{5,13})\b/g) || [];
  for (const idStr of idMatches) {
    const num = Number(idStr);
    if (!seen.has(num)) {
      seen.add(num);
      targets.push({ type: 'id', value: num });
    }
  }

  return targets;
}

/**
 * Consulta la ficha del estafador en la base de datos
 */
async function getBurnedDetails(target) {
  try {
    if (target.type === 'id') {
      const res = await db.pool?.query(
        'SELECT * FROM burned_users WHERE user_id = $1 LIMIT 1',
        [target.value]
      );
      if (res && res.rows && res.rows.length > 0) return res.rows[0];
    } else if (target.type === 'username') {
      const res = await db.pool?.query(
        'SELECT * FROM burned_users WHERE LOWER(username) = LOWER($1) LIMIT 1',
        [target.value]
      );
      if (res && res.rows && res.rows.length > 0) return res.rows[0];
    }
  } catch {}

  // Fallback comprobación básica
  const isBurned = await db.isUserBurned(
    target.type === 'id' ? target.value : null,
    target.type === 'username' ? target.value : null
  );

  if (isBurned) {
    return {
      user_id: target.type === 'id' ? target.value : 'Fichado',
      username: target.type === 'username' ? target.value : null,
      context: 'Estafa registrada y comprobada en la comunidad',
      burned_at: new Date(),
    };
  }

  return null;
}

/**
 * Registra el detector de menciones de estafadores
 */
function register(bot) {
  bot.on(['message:text', 'message:caption'], async (ctx, next) => {
    try {
      // Solo en grupos y supergrupos
      if (!ctx.chat || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {
        return next();
      }

      const text = ctx.message?.text || ctx.message?.caption || '';
      if (!text || text.startsWith('/')) {
        return next();
      }

      // No alertar si el emisor es bot
      if (ctx.from?.is_bot) {
        return next();
      }

      const targets = extractMentionedTargets(text);
      if (targets.length === 0) {
        return next();
      }

      const chatId = ctx.chat.id;
      const now = Date.now();

      for (const target of targets) {
        const burned = await getBurnedDetails(target);
        if (burned) {
          const scamKey = `${chatId}:${burned.user_id || target.value}`;
          const lastAlert = alertCooldowns.get(scamKey) || 0;

          // Cooldown de 60s para no saturar el chat
          if (now - lastAlert < COOLDOWN_MS) {
            continue;
          }
          alertCooldowns.set(scamKey, now);

          const scamMention = mentionFromData(burned.user_id, burned.username, burned.first_name || 'Estafador');
          const contextMsg = burned.context || 'Reporte de estafa confirmado';
          const dateStr = formatDate(burned.burned_at || new Date());
          const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';

          const alertText =
            `<b>⚠️ ¡ALERTA DE SEGURIDAD! USUARIO EN LISTA NEGRA ⚠️</b>\n` +
            `──────\n\n` +
            `El usuario que mencionas está registrado como <b>ESTAFADOR CONFIRMADO</b>:\n\n` +
            `▸ <b>Usuario:</b> ${scamMention}\n` +
            `▸ <b>ID:</b> <code>${burned.user_id}</code>\n` +
            `▸ <b>Estado:</b> ⊱ <code>LISTA NEGRA OFICIAL 🔴</code> ⊰\n` +
            `▸ <b>Motivo:</b> <i>${escapeHtml(contextMsg)}</i>\n` +
            `▸ <b>Fecha de Registro:</b> <code>${dateStr}</code>\n\n` +
            `──────\n` +
            `🚫 <b>ADVERTENCIA DE ${escapeHtml(communityName).toUpperCase()}:</b>\n` +
            `<i>Bajo ninguna circunstancia realices tratos directos, envíes dinero o entregues productos/cuentas a esta persona.</i>`;

          const kb = new InlineKeyboard();
          const burnChannelId = config.PUBLIC_BURN_CHANNEL_ID;
          if (burnChannelId) {
            const cleanChannel = String(burnChannelId).replace('-100', '');
            kb.url('🚨 Ver Canal de Quemados', `https://t.me/c/${cleanChannel}/1`).row();
          }
          kb.text('✖ Entendido / Cerrar', 'info_close');

          await ctx.reply(alertText, {
            parse_mode: 'HTML',
            reply_parameters: { message_id: ctx.message.message_id },
            reply_markup: kb,
            link_preview_options: { is_disabled: true },
          });

          // Solo alertar por el primer estafador encontrado por mensaje
          break;
        }
      }
    } catch (err) {
      console.error('⟡ Error en scamAutoResponder:', err.message);
    }

    return next();
  });
}

module.exports = {
  register,
  extractMentionedTargets,
  getBurnedDetails,
};
