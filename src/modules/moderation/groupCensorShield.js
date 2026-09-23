const { escapeHtml, userMention } = require('../../utils/formatting');

// ══════════════════════════════════════════════════════════
// ⟡ Módulo: Escudo Anti-Ban de Grupos (ShieldGuard)
// Elimina términos de alto riesgo para evitar que Telegram baje
// el grupo y educa al usuario con ejemplos camuflados / leetspeak.
// ══════════════════════════════════════════════════════════

// Diccionario de reglas y ejemplos camuflados (términos de bypass reales sugeridos por la comunidad)
const CENSOR_RULES = [
  {
    category: 'G5 / Billetes Falsos',
    regex: /\b(?:g5|g-5|billetes?\s+falsos?|billetes?\s+g5|plata\s+falsa|clon\s+de\s+billete)\b/i,
    examples: '<code>B1ll3t3 F4ls0</code>, <code>g-5</code>, <code>f4ls0s</code>, <code>cl0n3s</code>, <code>pap3l</code>',
  },
  {
    category: 'BIN / Carding',
    regex: /\b(?:bins?|carding|dumps?)\b/i,
    examples: '<code>b1n</code>, <code>vino</code>, <code>b-i-n</code>, <code>binsit0</code>, <code>v1n0</code>',
  },
  {
    category: 'DOXEO / Datos Personales',
    regex: /\b(?:doxe[ao]r?|doxxe[ao]r?|doxxing|sacar\s+datos|datos\s+reniec|base\s+reniec|buscar\s+datos)\b/i,
    examples: '<code>d0x</code>, <code>d-o-x-e-o</code>, <code>d0x30</code>, <code>d0xeo</code>, <code>inf0</code>',
  },
  {
    category: 'CC / Tarjetas',
    regex: /\b(?:ccs?|live\s+cc|tarjetas?\s+clonadas?)\b/i,
    examples: '<code>c-c</code>, <code>c.c</code>, <code>tarj3ta</code>, <code>pl4stic0</code>, <code>c-c-s</code>',
  },
  {
    category: 'Cuentas Clonadas / Deface',
    regex: /\b(?:clonadas?|cuentas?\s+hackeadas?|deface|combos?\s+hit)\b/i,
    examples: '<code>cu3ntas</code>, <code>cl0n</code>, <code>c-l-o-n</code>, <code>cu3ntitas</code>, <code>cl0n3s</code>',
  },
];

/**
 * Escanea un texto en busca de palabras prohibidas por Telegram
 */
function checkRiskyWords(text) {
  if (!text || typeof text !== 'string') return null;
  for (const rule of CENSOR_RULES) {
    const match = text.match(rule.regex);
    if (match) {
      return {
        matchedWord: match[0],
        category: rule.category,
        examples: rule.examples,
      };
    }
  }
  return null;
}

/**
 * Registra el middleware protector en el bot
 */
function register(bot) {
  bot.on(['message:text', 'message:caption'], async (ctx, next) => {
    try {
      // Solo en grupos y supergrupos
      if (!ctx.chat || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {
        return next();
      }

      // No censurar a bots
      if (ctx.from?.is_bot) {
        return next();
      }

      const text = ctx.message?.text || ctx.message?.caption || '';
      if (!text) {
        return next();
      }

      const detection = checkRiskyWords(text);
      if (!detection) {
        return next();
      }

      const chatId = ctx.chat.id;
      const messageId = ctx.message.message_id;
      const fromUser = ctx.from;
      const mention = fromUser ? userMention(fromUser.id, fromUser.first_name) : 'Usuario';

      // 1. Borrar inmediatamente el mensaje riesgoso para proteger el grupo de Telegram
      await ctx.deleteMessage().catch(() => {});

      // 2. Enviar advertencia amigable con ejemplos camuflados
      const warningText =
        `🛡️ <b>[ESCUDO ANTI-BAN] MENSAJE ELIMINADO</b>\n` +
        `──────\n\n` +
        `Hola ${mention}, eliminamos tu mensaje para <b>evitar que Telegram baje o sancione el grupo</b>.\n\n` +
        `⚠️ <b>Término riesgoso detectado:</b> <code>${escapeHtml(detection.matchedWord)}</code>\n` +
        `💡 <b>Usa variantes como estas para que Telegram no baje el grupo:</b>\n` +
        `↳ ${detection.examples}\n\n` +
        `──────\n` +
        `⏳ <i>Este aviso se autodestruirá en 25 segundos para mantener el grupo limpio.</i>`;

      const alertMsg = await ctx.reply(warningText, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }).catch(() => null);

      // 3. Autodestrucción del aviso a los 25 segundos
      if (alertMsg && alertMsg.message_id) {
        setTimeout(async () => {
          try {
            await ctx.api.deleteMessage(chatId, alertMsg.message_id);
          } catch {}
        }, 25000);
      }

      // Detener la propagación del mensaje prohibido
      return;
    } catch (err) {
      console.error('⟡ Error en groupCensorShield:', err.message);
      return next();
    }
  });
}

module.exports = {
  register,
  checkRiskyWords,
  CENSOR_RULES,
};
