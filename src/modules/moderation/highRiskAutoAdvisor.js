// ══════
// ⟡ Detector y Asesor Automático de Servicios de Alto Riesgo (G5 & Call Box 50%)
// ══════

const { InlineKeyboard } = require('grammy');
const { escapeHtml, userMention, formatDate, normalizeUnicodeText } = require('../../utils/formatting');
const { toMathBold } = require('../../utils/aesthetic');
const config = require('../../config/env');

// Cooldown en memoria: Map<"chatId:userId:category", timestamp>
const cooldownMap = new Map();
const COOLDOWN_MS = 45000; // 45 segundos por usuario/categoría

// Limpieza periódica de cooldowns
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of cooldownMap.entries()) {
    if (now - timestamp > COOLDOWN_MS * 2) {
      cooldownMap.delete(key);
    }
  }
}, 60000);

// Patrones de Detección de Alto Riesgo
const HIGH_RISK_PATTERNS = {
  G5: [
    /\b(g\s*[-_.]?\s*5)\b/i,
    /\b(billetes?|plata|dinero)\s+(fals[oa]s?|clonad[oa]s?|g\s*[-_.]?\s*5)\b/i,
    /\b(fals[oa]s?|clonad[oa]s?)\s+(billetes?|plata|dinero)\b/i,
    /\bpapel\s+(g\s*[-_.]?\s*5|falso|clonado)\b/i,
    /\b(vendo|compro|busco|alguien|quien)\s+(g\s*[-_.]?\s*5|billetes?\s+clonados?)\b/i,
  ],
  CALLBOX_50: [
    /\b(call\s*box|callbox)\b/i,
    /\b(celulares?|iphones?|equipos?|cosas?|productos?|ropa|zapatillas?|pedidos?)\s+al\s+50\s*%/i,
    /\b(al|todo\s+al)\s+50\s*%/i,
    /\b50\s*%\s*(de\s*descuento)?\s*(en\s*)?(celulares?|iphones?|callbox|compras|tiendas)\b/i,
    /\b(vendo|compro|busco|alguien|quien|servicio)\s+(call\s*box|callbox)\b/i,
  ],
};

/**
 * Evalúa si el texto coincide con alguna categoría de alto riesgo.
 * Retorna { category, categoryTitle, categoryShort } o null.
 */
function detectHighRiskCategory(text) {
  if (!text) return null;
  const normalized = normalizeUnicodeText(text);

  // 1. Evaluar G5 / Billetes clonados
  for (const regex of HIGH_RISK_PATTERNS.G5) {
    if (regex.test(text) || regex.test(normalized)) {
      return {
        category: 'G5',
        categoryTitle: 'G5 / Billetes Clonados & Falsificados',
        categoryShort: 'G5 y Billetes Clonados',
      };
    }
  }

  // 2. Evaluar Call Box / Celulares & Cosas al 50%
  for (const regex of HIGH_RISK_PATTERNS.CALLBOX_50) {
    if (regex.test(text) || regex.test(normalized)) {
      return {
        category: 'COLLBOX_50',
        categoryTitle: 'Coll Box / Celulares & Compras al 50%',
        categoryShort: 'Coll Box y Artículos al 50%',
      };
    }
  }

  return null;
}

/**
 * Construye el mensaje de alerta preventiva estético (Zero Emojis).
 */
function buildHighRiskWarning(user, detectedInfo) {
  const mention = userMention(user);
  const nowFormatted = formatDate(new Date());

  return (
    `⟡ <b>[ALERTA PREVENTIVA DE SEGURIDAD]</b> ⊱ <code>SERVICIO DE ALTO RIESGO</code> ⊰\n` +
    `══════\n` +
    `▸ <b>Usuario:</b> ${mention}\n` +
    `▸ <b>Servicio Detectado:</b> <b>${escapeHtml(detectedInfo.categoryTitle)}</b>\n` +
    `══════\n\n` +
    `<b>Advertencia Oficial de la Comunidad:</b>\n` +
    `• En operaciones de <b>${escapeHtml(detectedInfo.categoryShort)}</b> se registra un índice crítico de estafas por vendedores fraudulentos.\n` +
    `• <b>NUNCA transfieras dinero directamente</b> (Yape, Plin, Transferencia o Cripto) por chat privado sin respaldo oficial.\n` +
    `• <b>EXIGE SIEMPRE Trato Administrativo Oficial (/tratoadm)</b> antes de enviar cualquier importe.\n\n` +
    `<i>El Staff custodiará el dinero en garantía neutral hasta que recibas y verifiques tu pedido. Si el vendedor se niega a usar Trato Admin, es 100% un estafador.</i>\n` +
    `──────\n` +
    `⟡ <i>Registro: ${nowFormatted}</i>`
  );
}

/**
 * Construye el teclado interactivo con enlaces y botón de descarte.
 */
function buildWarningKeyboard(botUsername) {
  const kb = new InlineKeyboard();
  const username = botUsername || config.BOT_USERNAME || 'VentasLibrePeruBot';

  kb.url(
    `✦ ${toMathBold('Solicitar Trato Administrativo')}`,
    `https://t.me/${username}?start=tratoadm`
  );
  kb.row();
  kb.url(
    `❖ ${toMathBold('Guía de Seguridad y Garantía')}`,
    `https://t.me/${username}?start=guiatrato`
  );
  kb.row();
  kb.text(`✕ ${toMathBold('Entendido / Cerrar')}`, 'hr_close');

  return kb;
}

/**
 * Registra el módulo en el bot.
 */
function register(bot) {
  // Listener de mensajes y subtítulos en grupos
  bot.on(['message:text', 'message:caption'], async (ctx, next) => {
    try {
      // Solo en grupos y supergrupos
      if (!ctx.chat || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {
        return next();
      }

      // Ignorar mensajes enviados por bots
      if (ctx.from && ctx.from.is_bot) {
        return next();
      }

      const text = ctx.message.text || ctx.message.caption || '';
      if (!text || text.length < 2) {
        return next();
      }

      // Detectar coincidencia
      const detected = detectHighRiskCategory(text);
      if (!detected) {
        return next();
      }

      const chatId = ctx.chat.id;
      const userId = ctx.from ? ctx.from.id : 0;
      const cooldownKey = `${chatId}:${userId}:${detected.category}`;

      const lastSent = cooldownMap.get(cooldownKey) || 0;
      const now = Date.now();

      if (now - lastSent < COOLDOWN_MS) {
        // En cooldown, no saturar el grupo
        return next();
      }

      // Actualizar cooldown
      cooldownMap.set(cooldownKey, now);

      const botUsername = ctx.me?.username || config.BOT_USERNAME || 'VentasLibrePeruBot';
      const warningMessage = buildHighRiskWarning(ctx.from, detected);
      const keyboard = buildWarningKeyboard(botUsername);

      const sentMsg = await ctx.reply(warningMessage, {
        parse_mode: 'HTML',
        reply_to_message_id: ctx.message.message_id,
        reply_markup: keyboard,
        disable_web_page_preview: true,
      });

      // Auto-destrucción preventiva a los 90 segundos para no saturar el chat
      if (sentMsg && sentMsg.message_id) {
        setTimeout(async () => {
          try {
            await ctx.api.deleteMessage(chatId, sentMsg.message_id);
          } catch { }
        }, 90000);
      }
    } catch (err) {
      console.warn('⟡ Error en highRiskAutoAdvisor:', err.message);
    }

    return next();
  });

  // Callback para cerrar / eliminar el aviso preventivo
  bot.callbackQuery('hr_close', async (ctx) => {
    try {
      await ctx.answerCallbackQuery({ text: 'Aviso cerrado. ¡Opera seguro con Trato Administrativo!' });
      await ctx.deleteMessage().catch(() => { });
    } catch (err) {
      try {
        await ctx.answerCallbackQuery().catch(() => { });
      } catch { }
    }
  });
}

module.exports = {
  register,
  detectHighRiskCategory,
  buildHighRiskWarning,
  buildWarningKeyboard,
};
