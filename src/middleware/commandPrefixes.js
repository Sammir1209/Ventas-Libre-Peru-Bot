// ══════
// ⟡ Middleware: Normalizador Multi-Prefijo de Comandos (. $ ! ? /)
// Soporte unificado para el Bot Principal y Sub-Bots SaaS Multi-Tenant
// ══════

let config = null;
try {
  config = require('../config/env');
} catch {}

// Prefijos alternativos reconocidos
const ALTERNATIVE_PREFIXES = ['.', '$', '!', '?'];

// Expresión regular:
// Inicia con uno de los prefijos alternativos
// Captura el nombre del comando: inicia con letra y continúa con caracteres alfanuméricos/guiones bajos
// Opcionalmente captura el @targetBot
// Captura el resto de la cadena (argumentos posteriores)
const PREFIX_REGEX = /^([.$!?])([a-zA-Z][a-zA-Z0-9_]*)(?:@([a-zA-Z0-9_]+))?(.*)$/s;

/**
 * Middleware de normalización de prefijos.
 * Transforma mensajes que inician con '.', '$', '!', '?' en comandos nativos de Telegram Bot API ('/').
 * Inyecta la entidad 'bot_command' requerida por grammY para que bot.command(...) y ctx.match
 * operen con total transparencia.
 */
function commandPrefixes() {
  return async (ctx, next) => {
    const text = ctx.message?.text;
    if (!text || text.length < 2) {
      return next();
    }

    const firstChar = text[0];
    if (!ALTERNATIVE_PREFIXES.includes(firstChar)) {
      return next();
    }

    const match = text.match(PREFIX_REGEX);
    if (!match) {
      return next();
    }

    const [, , cmdName, targetBot, remainder] = match;

    // Obtener username del bot en este contexto (ctx.me en grammY o fallback a config)
    const currentBotUsername = (
      ctx.me?.username ||
      ctx.tenant?.bot_username ||
      config.BOT_USERNAME ||
      'ventas_libres_peru_Bot'
    ).toLowerCase().replace(/^@/, '');

    // Si el comando especifica un bot (@otro_bot), verificar que sea para nosotros
    if (targetBot) {
      const targetClean = targetBot.toLowerCase().replace(/^@/, '');
      if (targetClean !== currentBotUsername) {
        return next();
      }
    }

    // Reconstruir el texto con prefijo nativo '/'
    const reconstructedBotTag = targetBot ? `@${targetBot}` : '';
    const newText = `/${cmdName}${reconstructedBotTag}${remainder || ''}`;
    const commandEntityLength = 1 + cmdName.length + (targetBot ? 1 + targetBot.length : 0);

    // Actualizar ctx.message.text
    ctx.message.text = newText;

    // Inyectar o actualizar la entidad 'bot_command' en la posición 0
    const originalEntities = Array.isArray(ctx.message.entities) ? [...ctx.message.entities] : [];
    
    // Filtrar cualquier entidad existente que se superponga con el inicio
    const nonOverlapping = originalEntities.filter((e) => e.offset >= commandEntityLength);

    const commandEntity = {
      type: 'bot_command',
      offset: 0,
      length: commandEntityLength,
    };

    ctx.message.entities = [commandEntity, ...nonOverlapping];

    return next();
  };
}

module.exports = {
  commandPrefixes,
  ALTERNATIVE_PREFIXES,
  PREFIX_REGEX,
};
