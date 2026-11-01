  // ══════════════════════════════════════════════════════════
// ⟡ Módulo de Juegos & Quizz Interactivo con Premios Reales
//   Control: /quizzon, /quizzoff, /quizz, /claim, /stock
//   Plantillas Concisas Adaptadas a Móvil (Estándar VLP)
// ══════════════════════════════════════════════════════════

const crypto = require('crypto');
let InlineKeyboard = null;
let InputFile = null;
try {
  const grammy = require('grammy');
  InlineKeyboard = grammy.InlineKeyboard;
  InputFile = grammy.InputFile;
} catch {
  InputFile = class InputFile {
    constructor(file, filename) {
      this.file = file;
      this.filename = filename;
    }
  };
  InlineKeyboard = class InlineKeyboard {
    constructor() {
      this.inline_keyboard = [[]];
    }
    text(label, data) { return this; }
    row() { return this; }
    url(label, url) { return this; }
  };
}
const db = require('../../database/postgres');
const config = require('../../config/env');
const { requireStaff } = require('../../middleware/auth');
const { escapeHtml, getSuperscriptDate } = require('../../utils/formatting');
const { btn, toMathBold } = require('../../utils/aesthetic');
const { getRandomQuiz, normalizeAnswer } = require('./quizBank');

// Mapa de temporizadores activos por chat_id: chatId -> NodeJS.Timeout
const activeIntervals = new Map();
// Cache de sesión en memoria activa: chatId -> quizSession
const activeSessionsMem = new Map();

/**
 * Genera un token único de canje con formato VLP-<HEX12>.
 */
function generateClaimToken() {
  return 'VLP-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

/**
 * Parsea y formatea credenciales directas de cuenta (JSON, user:pass o texto plano).
 * Retorna { username, password, extra, formattedText }.
 */
function formatAccountCredentials(accountData, accountTitle = '', category = '') {
  let username = '';
  let password = '';
  let extra = '';

  let raw = typeof accountData === 'string' ? accountData.trim() : (accountData ? JSON.stringify(accountData) : '');

  // 1. Ingesta de JSON u objeto
  if (typeof accountData === 'object' && accountData !== null) {
    username = accountData.email || accountData.username || accountData.user || accountData.correo || accountData.login || '';
    password = accountData.password || accountData.pass || accountData.contraseña || accountData.clave || '';
    const extraParts = [];
    if (accountData.pin) extraParts.push(`PIN: ${accountData.pin}`);
    if (accountData.profile || accountData.perfil) extraParts.push(`Perfil: ${accountData.profile || accountData.perfil}`);
    if (accountData.details || accountData.detalles || accountData.extra) extraParts.push(accountData.details || accountData.detalles || accountData.extra);
    extra = extraParts.join(' | ');
  } else if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      username = parsed.email || parsed.username || parsed.user || parsed.correo || parsed.login || '';
      password = parsed.password || parsed.pass || parsed.contraseña || parsed.clave || '';
      const extraParts = [];
      if (parsed.pin) extraParts.push(`PIN: ${parsed.pin}`);
      if (parsed.profile || parsed.perfil) extraParts.push(`Perfil: ${parsed.profile || parsed.perfil}`);
      if (parsed.details || parsed.detalles || parsed.extra) extraParts.push(parsed.details || parsed.detalles || parsed.extra);
      extra = extraParts.join(' | ');
    } catch {}
  }

  // 2. Ingesta de formato multilínea o delimitado por dos puntos
  if (!username && !password && raw) {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const details = [];

    for (const line of lines) {
      const uMatch = line.match(/^(?:usuario|correo|email|user|login)\s*[:=]\s*(.+)$/i);
      if (uMatch && !username) {
        username = uMatch[1].trim();
        continue;
      }
      const pMatch = line.match(/^(?:contrase[ñn]a|password|clave|pass)\s*[:=]\s*(.+)$/i);
      if (pMatch && !password) {
        password = pMatch[1].trim();
        continue;
      }
      const pinMatch = line.match(/^(?:pin|perfil|profile|detalles?|extra)\s*[:=]\s*(.+)$/i);
      if (pinMatch) {
        details.push(line);
        continue;
      }
      const colonMatch = line.match(/^([^\s:]+@[^\s:]+):([^\s:]+)(?::(.*))?$/) ||
                         line.match(/^([a-zA-Z0-9._-]+):([^\s:]+)(?::(.*))?$/);
      if (colonMatch && !username && !password) {
        username = colonMatch[1].trim();
        password = colonMatch[2].trim();
        if (colonMatch[3]) details.push(colonMatch[3].trim());
        continue;
      }
      if (!line.startsWith('#') && !line.includes('\t')) {
        details.push(line);
      }
    }
    if (details.length > 0) {
      extra = details.join(' | ');
    }
  }

  // 3. Fallback para volcados de cookies legacy
  if (!username && !password) {
    if (raw.includes('Netscape HTTP Cookie File') || raw.includes('\t')) {
      const profileMatch = raw.match(/Profile:\s*([^|\n]+)/i);
      const planMatch = raw.match(/Plan:\s*([^|\n]+)/i);
      const regionMatch = raw.match(/Region:\s*([^|\n]+)/i);

      username = profileMatch ? `Perfil: ${profileMatch[1].trim()}` : (accountTitle || 'Cuenta Activa');
      password = '[Acceso Tokenizado / Pre-activado]';
      const parts = [];
      if (planMatch) parts.push(`Plan: ${planMatch[1].trim()}`);
      if (regionMatch) parts.push(`Región: ${regionMatch[1].trim()}`);
      if (accountTitle) parts.push(accountTitle);
      extra = parts.join(' | ');
    } else {
      username = accountTitle || 'Usuario VLP';
      password = raw.length < 100 ? raw : '[Credenciales en Panel]';
      extra = accountTitle ? `Referencia: ${accountTitle}` : '';
    }
  }

  if (!username) username = accountTitle || 'Cuenta VLP';
  if (!password) password = '[Sin Contraseña Requerida]';

  const uEsc = escapeHtml(username);
  const pEsc = escapeHtml(password);
  const eEsc = escapeHtml(extra);

  let formattedText =
    `• <b>Usuario / Correo:</b> <code>${uEsc}</code>\n` +
    `• <b>Contraseña:</b> <code>${pEsc}</code>`;
  if (extra) {
    formattedText += `\n• <b>Detalles:</b> <code>${eEsc}</code>`;
  }

  return { username, password, extra, formattedText };
}

/**
 * Formatea la plantilla estética de entrega privada de una recompensa.
 */
function buildRewardKeyboard(rewardId, category = '', title = '') {
  const { getPlatformUrl } = require('./cookieConverter');
  const platformUrl = getPlatformUrl(category, title);
  return new InlineKeyboard()
    .text(btn('Convertidor Cookie', '◈', '◈'), `cookie_hub:${rewardId}`)
    .row()
    .text(btn('Tutorial Movil', '⌥', '⌥'), `cookie_tut_mobile:${rewardId}`)
    .text(btn('Tutorial PC', '⌘', '⌘'), `cookie_tut_pc:${rewardId}`)
    .row()
    .url(btn('Entrar a Plataforma', '❖', '❖'), platformUrl);
}

function renderPrivateRewardCard(user, reward) {
  const dateFormatted = getSuperscriptDate();
  const userName = escapeHtml(user.first_name || 'Ganador');
  const title = escapeHtml(reward.account_title || reward.category || 'Cuenta Premium');
  const cat = escapeHtml(reward.category || 'STREAMING');

  return (
    `<b>【 𝗩𝗘𝗡𝗧𝗔𝗦 𝗟𝗜𝗕𝗥𝗘𝗦 𝗣𝗘𝗥𝗨 】 ⟡ 『 𝗣𝗥𝗘𝗠𝗜𝗢 𝗢𝗙𝗜𝗖𝗜𝗔𝗟 』</b>\n` +
    `────── // ───\n\n` +
    `▸ <b>Ganador:</b> <b>${userName}</b>\n` +
    `▸ <b>Premio:</b> <code>${title}</code>\n` +
    `▸ <b>Categoría:</b> <code>〔 ${cat} 〕</code>\n` +
    `▸ <b>Estado:</b> <code>〔 𝗘𝗡𝗧𝗥𝗘𝗚𝗔𝗗𝗢 〕</code>\n\n` +
    `↳ <i>Tu archivo de cookies original .txt está adjunto abajo.</i>\n` +
    `◈ <i>¿Deseas formato JSON para Cookie-Editor o no sabes cómo usarlo? Presiona el botón <b>CONVERTIDOR COOKIE</b>.</i>\n\n` +
    `────── // ───\n` +
    `${dateFormatted}`
  );
}

/**
 * Comprueba si un mensaje de Telegram sigue existiendo o fue borrado para todos.
 */
async function isMessageAlive(bot, chatId, messageId) {
  try {
    await bot.api.editMessageReplyMarkup(chatId, Number(messageId));
    return true;
  } catch (err) {
    const errStr = (err.message || err.description || '').toLowerCase();
    if (errStr.includes('not modified')) {
      return true; // Mensaje vivo
    }
    if (errStr.includes('not found') || errStr.includes('message to edit not found')) {
      return false; // Mensaje borrado para todos por el admin
    }
    return true;
  }
}

/**
 * Lanza un Quizz interactivo en un chat específico.
 * @param {boolean} force - Si es true, reemplaza de inmediato cualquier quizz activo previo.
 */
async function triggerQuiz(bot, chatId, force = false) {
  try {
    const cId = Number(chatId);

    // 1. Validar que no haya una sesión ya activa en el chat
    const existing = activeSessionsMem.get(cId) || await db.getActiveQuizSession(cId);
    if (existing && existing.status === 'ACTIVE') {
      if (force) {
        // Reemplazo forzado: expirar anterior y continuar
        activeSessionsMem.delete(cId);
        await db.expireQuizSession(existing.id);
        try {
          await bot.api.unpinChatMessage(cId, Number(existing.message_id));
        } catch {}
      } else {
        // En loop automático: comprobar si el mensaje anterior fue borrado para todos
        const alive = await isMessageAlive(bot, cId, existing.message_id);
        if (!alive) {
          console.log(`⟡ [Quizz] Mensaje anterior ${existing.message_id} fue borrado en chat ${cId}. Auto-renovando sesión.`);
          activeSessionsMem.delete(cId);
          await db.expireQuizSession(existing.id);
        } else {
          return { success: false, reason: 'ALREADY_ACTIVE' };
        }
      }
    }

    // 2. Validar que existan recompensas en stock
    const stock = await db.getAvailableRewardsCount();
    if (stock.total <= 0) {
      await db.updateQuizSettings(cId, { enabled: false });
      stopQuizTimer(cId);
      await bot.api.sendMessage(
        cId,
        `<b>⟡ [QUIZZ PAUSADO] STOCK AGOTADO</b>\n` +
        `──────\n\n` +
        `<i>El quizz se ha detenido porque no quedan cuentas disponibles en stock.</i>\n\n` +
        `──────\n` +
        `${getSuperscriptDate()}`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
      return { success: false, reason: 'NO_STOCK' };
    }

    // 3. Obtener pregunta aleatoria
    const quiz = getRandomQuiz();
    const sessionId = crypto.randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + 365 * 24 * 3600 * 1000); // Activo indefinidamente hasta que alguien responda

    const dateFormatted = getSuperscriptDate();
    const quizText =
      `<b>【 𝗤𝗨𝗜𝗭𝗭 𝗩𝗟𝗣 】 ⟡ 「 𝗧𝗥𝗜𝗩𝗜𝗔 𝗘𝗡 𝗩𝗜𝗩𝗢 」</b>\n` +
      `──────\n\n` +
      `• <b>Categoría:</b> <code>${quiz.category}</code>\n` +
      `• <b>Premio:</b> <code>Cuenta Streaming (Prime / YouTube)</code>\n\n` +
      `<b>${escapeHtml(quiz.question)}</b>\n\n` +
      `⟡ <i>Pista: ${escapeHtml(quiz.hint)}</i>\n\n` +
      `↳ <b>Responde (Reply) a este mensaje para ganar.</b>\n` +
      `──────\n` +
      `${dateFormatted}`;

    const sentMsg = await bot.api.sendMessage(cId, quizText, { parse_mode: 'HTML' });

    // Fijar mensaje para alertar a todos los miembros del grupo
    try {
      await bot.api.pinChatMessage(cId, sentMsg.message_id, { disable_notification: false });
    } catch (pinErr) {
      console.warn('⟡ Error fijando mensaje de quizz:', pinErr.message);
    }

    const sessionObj = {
      id: sessionId,
      chat_id: cId,
      message_id: sentMsg.message_id,
      category: quiz.category,
      question: quiz.question,
      normalized_answers: quiz.normalizedAnswers,
      status: 'ACTIVE',
      expires_at: expiresAt.toISOString()
    };

    activeSessionsMem.set(cId, sessionObj);
    await db.createQuizSession({
      id: sessionId,
      chatId: cId,
      messageId: sentMsg.message_id,
      category: quiz.category,
      question: quiz.question,
      normalizedAnswers: quiz.normalizedAnswers,
      expiresAt
    });

    return { success: true, sessionId };
  } catch (err) {
    console.error('⟡ Error en triggerQuiz:', err.message);
    return { success: false, reason: err.message };
  }
}

/**
 * Inicia el loop de temporizador para un chat según su intervalo configurado.
 */
function startQuizTimer(bot, chatId, intervalMinutes = 5) {
  const cId = Number(chatId);
  stopQuizTimer(cId);

  const ms = Math.max(1, intervalMinutes) * 60 * 1000;
  console.log(`⟡ [Quizz] Programado en chat ${cId} cada ${intervalMinutes} minutos.`);

  const timer = setInterval(async () => {
    try {
      const settings = await db.getQuizSettings(cId);
      if (!settings || !settings.enabled) {
        stopQuizTimer(cId);
        return;
      }
      await triggerQuiz(bot, cId);
    } catch (err) {
      console.warn('⟡ Error en timer de quizz:', err.message);
    }
  }, ms);

  activeIntervals.set(cId, timer);
}

/**
 * Detiene el temporizador de Quizz de un chat.
 */
function stopQuizTimer(chatId) {
  const cId = Number(chatId);
  const t = activeIntervals.get(cId);
  if (t) {
    clearInterval(t);
    activeIntervals.delete(cId);
  }
}

/**
 * Entrega segura de recompensa al ganador.
 */
async function deliverRewardToWinner(bot, user, reward, quizId) {
  try {
    const text = renderPrivateRewardCard(user, reward);
    const fileName = `cuenta_${reward.category.toLowerCase()}_vlp.txt`;
    const buffer = Buffer.from(reward.account_data || '# Sin contenido', 'utf8');

    const kb = buildRewardKeyboard(reward.id, reward.category, reward.account_title);
    await bot.api.sendMessage(user.id, text, { parse_mode: 'HTML', reply_markup: kb });
    await bot.api.sendDocument(user.id, new InputFile(buffer, fileName), {
      caption: `【 𝗖𝗢𝗢𝗞𝗜𝗘𝗦 】 ⟡ <b>${escapeHtml(reward.account_title)}</b>.`,
      parse_mode: 'HTML',
      reply_markup: kb
    });
    return { deliveredDirectly: true };
  } catch (dmErr) {
    console.log(`⟡ No se pudo enviar DM a ${user.id} (${dmErr.message}). Registrando en pending_claims.`);
    await db.setPendingClaim(user.id, reward.id, quizId, reward.category);
    return { deliveredDirectly: false };
  }
}

// ── Monitor de Auto-Detección de Mensajes de Quizz Borrados por Admins ──
let deleteWatcherStarted = false;
function startDeleteWatcher(bot) {
  if (deleteWatcherStarted) return;
  deleteWatcherStarted = true;

  setInterval(async () => {
    try {
      if (activeSessionsMem.size === 0) return;
      for (const [cId, session] of Array.from(activeSessionsMem.entries())) {
        if (!session || session.status !== 'ACTIVE') continue;
        const alive = await isMessageAlive(bot, cId, session.message_id);
        if (!alive) {
          console.log(`⟡ [Quizz] Mensaje de Quizz ${session.message_id} fue eliminado por un admin en ${cId}. Auto-renovando...`);
          activeSessionsMem.delete(cId);
          await db.expireQuizSession(session.id);

          // Si el quizz está habilitado en este chat, auto-generar uno nuevo al instante
          const settings = await db.getQuizSettings(cId);
          if (settings && settings.enabled) {
            await triggerQuiz(bot, cId, true);
          }
        }
      }
    } catch {}
  }, 10 * 1000).unref?.();
}

/**
 * Registro de Handlers y Listeners en el Bot.
 */
function register(bot) {
  startDeleteWatcher(bot);
  // ── 1. Comando /quizzon ──
  bot.command('quizzon', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply('⟡ ✗ <i>Este comando debe ejecutarse dentro del grupo oficial.</i>', { parse_mode: 'HTML' });
      }

      const stock = await db.getAvailableRewardsCount();
      if (stock.total <= 0) {
        return ctx.reply(
          `<b>⟡ [QUIZZ] NO SE PUEDE ACTIVAR</b>\n` +
          `──────\n\n` +
          `• <b>Stock disponible:</b> <code>[ 0 Cuentas ]</code>\n` +
          `• <b>Causa:</b> No hay cuentas activas en la base de datos.\n\n` +
          `──────\n` +
          `${getSuperscriptDate()}`,
          { parse_mode: 'HTML' }
        );
      }

      const settings = await db.getQuizSettings(ctx.chat.id);
      const interval = settings?.interval_minutes || 5;

      await db.updateQuizSettings(ctx.chat.id, { enabled: true, interval_minutes: interval });
      startQuizTimer(bot, ctx.chat.id, interval);

      const dateFormatted = getSuperscriptDate();
      await ctx.reply(
        `<b>⟡ [QUIZZ] SISTEMA ACTIVADO</b>\n` +
        `──────\n\n` +
        `• <b>Estado:</b> <code>[ EN EJECUCIÓN ]</code>\n` +
        `• <b>Frecuencia:</b> <code>Cada ${interval} min</code>\n` +
        `• <b>Stock:</b> <code>${stock.total} cuentas (${stock.primeVideo} Prime, ${stock.youtube} YouTube)</code>\n\n` +
        `──────\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /quizzon:', err.message);
      ctx.reply(`⟡ ✗ Error: ${err.message}`);
    }
  });

  // ── 2. Comando /quizzoff ──
  bot.command('quizzoff', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply('⟡ ✗ <i>Este comando debe ejecutarse dentro del grupo oficial.</i>', { parse_mode: 'HTML' });
      }

      await db.updateQuizSettings(ctx.chat.id, { enabled: false });
      stopQuizTimer(ctx.chat.id);

      // Si había un quizz activo, cancelarlo y desfijar el mensaje
      const active = activeSessionsMem.get(ctx.chat.id);
      if (active) {
        active.status = 'EXPIRED';
        activeSessionsMem.delete(ctx.chat.id);
        await db.expireQuizSession(active.id);
        try {
          await ctx.api.unpinChatMessage(ctx.chat.id, active.message_id);
        } catch {}
      }

      const dateFormatted = getSuperscriptDate();
      await ctx.reply(
        `<b>⟡ [QUIZZ] SISTEMA DETENIDO</b>\n` +
        `──────\n\n` +
        `• <b>Estado:</b> <code>[ APAGADO ]</code>\n` +
        `• <b>Grupo:</b> <b>${escapeHtml(ctx.chat.title || 'Oficial')}</b>\n\n` +
        `──────\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /quizzoff:', err.message);
      ctx.reply(`⟡ ✗ Error: ${err.message}`);
    }
  });

  // ── 3. Comando /quizz (Disparo Inmediato Forzado) ──
  bot.command('quizz', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply('⟡ ✗ <i>Este comando debe ejecutarse dentro de un grupo oficial.</i>', { parse_mode: 'HTML' });
      }

      // force = true reemplaza cualquier quizz previo sin bloquear
      const res = await triggerQuiz(bot, ctx.chat.id, true);
      if (!res.success) {
        if (res.reason === 'NO_STOCK') {
          return ctx.reply('⟡ ✗ <i>No hay cuentas en stock para lanzar el Quizz.</i>', { parse_mode: 'HTML' });
        }
        return ctx.reply(`⟡ ✗ Error: ${res.reason}`, { parse_mode: 'HTML' });
      }
    } catch (err) {
      console.error('⟡ Error en /quizz:', err.message);
      ctx.reply(`⟡ ✗ Error: ${err.message}`);
    }
  });

  // ── 4. Comando /claim (Privado con Validación de Código) ──
  bot.command('claim', async (ctx) => {
    try {
      // 1. Intercepción de chats de grupo / supergrupo
      if (ctx.chat.type !== 'private') {
        const botUsername = ctx.me?.username || 'ventas_libres_peru_Bot';
        const kb = new InlineKeyboard().url(btn('Abrir Chat Privado', '◈', '◈'), `https://t.me/${botUsername}`);
        return ctx.reply(
          `<b>⟡ [SEGURIDAD] CANJE PRIVADO</b>\n` +
          `──────\n\n` +
          `<i>El comando <code>/claim</code> únicamente puede ejecutarse en chat privado con el bot para proteger tus credenciales.</i>\n\n` +
          `↳ Inicia un chat privado con @${botUsername} y canjea tu código allí.\n\n` +
          `──────\n` +
          `${getSuperscriptDate()}`,
          { parse_mode: 'HTML', reply_markup: kb }
        );
      }

      // 2. Parseo del código de argumento
      const code = (ctx.match || '').trim();
      if (!code) {
        return ctx.reply(
          `<b>⟡ [RECOMPENSAS] SINTAXIS DE CANJE</b>\n` +
          `──────\n\n` +
          `<i>Debes especificar el código de canje que ganaste en el grupo.</i>\n\n` +
          `▸ <b>Uso:</b> <code>/claim &lt;código&gt;</code>\n` +
          `▸ <b>Ejemplo:</b> <code>/claim VLP-A1B2C3D4E5F6</code>\n\n` +
          `──────\n` +
          `${getSuperscriptDate()}`,
          { parse_mode: 'HTML' }
        );
      }

      // 3. Canje atómico en base de datos
      const claimResult = await db.redeemClaimAtomic(code, ctx.from.id);

      if (!claimResult || !claimResult.success) {
        const reason = claimResult?.reason || 'UNKNOWN';
        const dateFormatted = getSuperscriptDate();

        if (reason === 'NOT_FOUND') {
          return ctx.reply(
            `<b>⟡ [RECOMPENSAS] CÓDIGO INVÁLIDO</b>\n` +
            `──────\n\n` +
            `<i>Código inválido o inexistente.</i>\n` +
            `Verifica haber escrito correctamente tu código de reclamo.\n\n` +
            `──────\n` +
            `${dateFormatted}`,
            { parse_mode: 'HTML' }
          );
        }

        if (reason === 'UNAUTHORIZED') {
          return ctx.reply(
            `<b>⟡ [SEGURIDAD] CANJE NO AUTORIZADO</b>\n` +
            `──────\n\n` +
            `<i>Este código fue emitido para otro usuario.</i>\n` +
            `Solo el usuario que acertó la trivia en el grupo puede canjear este premio.\n\n` +
            `──────\n` +
            `${dateFormatted}`,
            { parse_mode: 'HTML' }
          );
        }

        if (reason === 'ALREADY_CLAIMED') {
          return ctx.reply(
            `<b>⟡ [RECOMPENSAS] CÓDIGO YA CANJEADO</b>\n` +
            `──────\n\n` +
            `<i>Este código ya fue canjeado previamente.</i>\n` +
            `Cada código es de un solo uso.\n\n` +
            `──────\n` +
            `${dateFormatted}`,
            { parse_mode: 'HTML' }
          );
        }

        if (reason === 'EXPIRED') {
          return ctx.reply(
            `<b>⟡ [RECOMPENSAS] CÓDIGO EXPIRADO</b>\n` +
            `──────\n\n` +
            `<i>Este código ha expirado.</i>\n` +
            `Los códigos de reclamo tienen una validez de 15 minutos desde su emisión.\n\n` +
            `──────\n` +
            `${dateFormatted}`,
            { parse_mode: 'HTML' }
          );
        }

        return ctx.reply(
          `<b>⟡ [RECOMPENSAS] ERROR DE CANJE</b>\n` +
          `──────\n\n` +
          `<i>No se pudo procesar tu reclamo: ${escapeHtml(reason)}</i>\n\n` +
          `──────\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      // 4. Entrega directa de credenciales sin cookies ni adjuntos
      const reward = claimResult.reward || {};
      const { username, password, extra } = formatAccountCredentials(
        reward.account_data,
        reward.account_title,
        reward.category
      );

      const userName = escapeHtml(ctx.from.first_name || 'Ganador');
      const title = escapeHtml(reward.account_title || reward.category || 'Cuenta Premium Oficial');
      const cat = escapeHtml(reward.category || 'STREAMING');
      const dateFormatted = getSuperscriptDate();

      const deliveryMessage =
        `<b>【 𝗩𝗘𝗡𝗧𝗔𝗦 𝗟𝗜𝗕𝗥𝗘𝗦 𝗣𝗘𝗥𝗨 】 ⟡ 『 𝗣𝗥𝗘𝗠𝗜𝗢 𝗢𝗙𝗜𝗖𝗜𝗔𝗟 』</b>\n` +
        `────── // ───\n\n` +
        `▸ <b>Ganador:</b> <b>${userName}</b>\n` +
        `▸ <b>Premio:</b> <code>${title}</code>\n` +
        `▸ <b>Categoría:</b> <code>〔 ${cat} 〕</code>\n` +
        `▸ <b>Estado:</b> <code>〔 𝗘𝗡𝗧𝗥𝗘𝗚𝗔𝗗𝗢 〕</code>\n\n` +
        `<b>✦ DATOS DE ACCESO:</b>\n` +
        `• <b>Usuario / Correo:</b> <code>${escapeHtml(username)}</code>\n` +
        `• <b>Contraseña:</b> <code>${escapeHtml(password)}</code>\n` +
        (extra ? `• <b>Detalles:</b> <code>${escapeHtml(extra)}</code>\n` : '') +
        `\n` +
        `! <i>Prohibido modificar contraseña o perfiles. Cuenta sujeta a monitoreo oficial.</i>\n\n` +
        `────── // ───\n` +
        `${dateFormatted}`;

      await ctx.reply(deliveryMessage, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Error en /claim:', err.message);
      ctx.reply(`⟡ ✗ Error al procesar tu reclamo: ${escapeHtml(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  // ── 5. Comando /stock (Staff) ──
  bot.command('stock', requireStaff(), async (ctx) => {
    try {
      const stock = await db.getAvailableRewardsCount();
      const dateFormatted = getSuperscriptDate();

      const text =
        `<b>⟡ [INVENTARIO] STOCK DISPONIBLE</b>\n` +
        `──────\n\n` +
        `• <b>Total:</b> <code>${stock.total} cuentas</code>\n` +
        `• <b>Prime Video:</b> <code>${stock.primeVideo}</code>\n` +
        `• <b>YouTube Premium:</b> <code>${stock.youtube}</code>\n\n` +
        `──────\n` +
        `${dateFormatted}`;

      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (err) {
      ctx.reply(`⟡ ✗ Error consultando stock: ${err.message}`);
    }
  });

  // ── 6. Listener de Respuestas (Reply Matcher) ──
  bot.on('message:text', async (ctx, next) => {
    try {
      const replyTo = ctx.message.reply_to_message;
      if (!replyTo) return next();

      const rawReply = (replyTo.text || replyTo.caption || '');
      const replyText = rawReply.toUpperCase();
      const isQuizCard = replyText.includes('QUIZZ') || replyText.includes('TRIVIA') ||
                         rawReply.includes('𝗤𝗨𝗜𝗭𝗭') || rawReply.includes('𝗧𝗥𝗜𝗩𝗜𝗔');

      const chatId = ctx.chat.id;
      let session = activeSessionsMem.get(chatId);
      if (!session) {
        session = await db.getActiveQuizSession(chatId);
        if (session) {
          const mem = activeSessionsMem.get(chatId);
          if (mem) {
            session = mem;
          } else if (session.status === 'ACTIVE') {
            activeSessionsMem.set(chatId, session);
          }
        }
      }

      const matchesSession = session && Number(session.message_id) === Number(replyTo.message_id);

      if (!matchesSession && !isQuizCard) {
        return next();
      }

      // Si responde a un Quizz pero ya fue resuelto o no hay sesión activa:
      if (!session || session.status !== 'ACTIVE') {
        return; // Detener flujo para evitar que la IA intervenga
      }

      // Normalizar respuestas posibles (soporta array JS o formato array de Postgres)
      let validAnswers = session.normalized_answers || [];
      if (typeof validAnswers === 'string') {
        validAnswers = validAnswers.replace(/^\{|\}$/g, '').split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      }

      const normalizedUserText = normalizeAnswer(ctx.message.text);
      const isCorrect = validAnswers.some(ans => {
        const normAns = normalizeAnswer(ans);
        return normalizedUserText === normAns ||
               normalizedUserText.includes(normAns) ||
               (normAns.length > 3 && normAns.includes(normalizedUserText));
      });

      if (!isCorrect) {
        // Respuesta errónea: detener flujo para que la IA NO responda a este mensaje
        return;
      }

      // Candado atómico sincrónico: verificar si la sesión sigue activa
      const currentMem = activeSessionsMem.get(chatId);
      if (session.status !== 'ACTIVE' || (currentMem && currentMem.status !== 'ACTIVE')) {
        return;
      }

      // Respuesta correcta: Bloqueo sincrónico inmediato para evitar race condition
      session.status = 'SOLVED';
      activeSessionsMem.set(chatId, session);

      // Desfijar mensaje para mantener el chat limpio
      try {
        await ctx.api.unpinChatMessage(chatId, session.message_id);
      } catch {}

      const winner = ctx.from;
      const winnerName = escapeHtml(winner.first_name || 'Ganador');
      const winnerUser = winner.username ? `@${escapeHtml(winner.username)}` : `ID: ${winner.id}`;

      // Adquisición atómica de stock
      const reward = await db.acquireRewardAtomic(winner.id, winner.username, session.id);

      if (!reward) {
        await db.solveQuizSession(session.id, winner.id, winner.username, null);
        return ctx.reply(
          `<b>【 𝗤𝗨𝗜𝗭𝗭 】 ⟡ 「 𝗚𝗔𝗡𝗔𝗗𝗢𝗥 𝗗𝗘𝗧𝗘𝗖𝗧𝗔𝗗𝗢 」</b>\n` +
          `────── // ───\n\n` +
          `▸ <b>Ganador:</b> <b>${winnerName}</b> (${winnerUser})\n` +
          `▸ <b>Respuesta:</b> <b>${escapeHtml(ctx.message.text.toUpperCase())}</b>\n\n` +
          `! <i>¡Respuesta correcta! Sin embargo, el stock de cuentas se ha agotado en este momento. Por favor contacta al Staff.</i>\n\n` +
          `────── // ───\n` +
          `${getSuperscriptDate()}`,
          {
            parse_mode: 'HTML',
            reply_parameters: { message_id: ctx.message.message_id }
          }
        );
      }

      await db.solveQuizSession(session.id, winner.id, winner.username, reward.id);

      // Generar token único y registrar reclamo en BD con 15 minutos de TTL
      const generatedCode = generateClaimToken();
      const tokenRecord = await db.createClaimToken({
        claimCode: generatedCode,
        userId: winner.id,
        rewardId: reward.id,
        quizId: session.id,
        category: reward.category,
        ttlMinutes: 15
      });
      const claimCode = tokenRecord?.claimCode || generatedCode;

      const botUsername = ctx.me?.username || 'ventas_libres_peru_Bot';
      const dateFormatted = getSuperscriptDate();
      const rewardTitle = escapeHtml(reward.account_title || reward.category || 'Cuenta Streaming');
      const userAnswer = escapeHtml(ctx.message.text.toUpperCase());

      // Anuncio en grupo con mención, respuesta, código y comando /claim <code>
      const winMessage =
        `<b>【 𝗤𝗨𝗜𝗭𝗭 】 ⟡ 「 𝗚𝗔𝗡𝗔𝗗𝗢𝗥 𝗗𝗘𝗧𝗘𝗖𝗧𝗔𝗗𝗢 」</b>\n` +
        `────── // ───\n\n` +
        `▸ <b>Ganador:</b> <b>${winnerName}</b> (${winnerUser})\n` +
        `▸ <b>Respuesta:</b> <b>${userAnswer}</b>\n` +
        `▸ <b>Premio:</b> <code>${rewardTitle}</code>\n\n` +
        `<b>✦ CÓDIGO DE RECLAMO:</b>\n` +
        `<code>${claimCode}</code>\n\n` +
        `◈ <i>Canjea tu cuenta por chat privado con @${botUsername} usando:</i>\n` +
        `<code>/claim ${claimCode}</code>\n\n` +
        `⟡ <i>El código vence en 15 minutos y está vinculado exclusivamente a tu usuario.</i>\n` +
        `────── // ───\n` +
        `${dateFormatted}`;

      const claimKb = new InlineKeyboard()
        .url(btn('CANJEAR EN PRIVADO', '◈', '◈'), `https://t.me/${botUsername}`);

      await ctx.reply(winMessage, {
        parse_mode: 'HTML',
        reply_markup: claimKb,
        reply_parameters: { message_id: ctx.message.message_id }
      });

      return;
    } catch (err) {
      console.error('⟡ Error en evaluador de respuestas de quizz:', err.message);
    }
    return next();
  });

  // 7. Auto-inicialización al arranque de chats con quizz habilitado
  setTimeout(async () => {
    try {
      const activeChats = await db.getAllActiveQuizChats();
      for (const chat of activeChats) {
        startQuizTimer(bot, chat.chat_id, chat.interval_minutes || 5);
      }
    } catch (initErr) {
      console.warn('⟡ Error iniciando timers de quizz al arranque:', initErr.message);
    }
  }, 5000).unref?.();
}

module.exports = {
  register,
  buildRewardKeyboard,
  renderPrivateRewardCard,
  triggerQuiz,
  startQuizTimer,
  stopQuizTimer,
  formatAccountCredentials,
  generateClaimToken
};
