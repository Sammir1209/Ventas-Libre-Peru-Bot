  // ══════════════════════════════════════════════════════════
// ⟡ Módulo de Juegos & Quizz Interactivo con Premios Reales
//   Control: /quizzon, /quizzoff, /quizz, /claim, /stock
//   Plantillas Concisas Adaptadas a Móvil (Estándar VLP)
// ══════════════════════════════════════════════════════════

const crypto = require('crypto');
const { InputFile } = require('grammy');
const db = require('../../database/postgres');
const config = require('../../config/env');
const { requireStaff } = require('../../middleware/auth');
const { escapeHtml, getSuperscriptDate } = require('../../utils/formatting');
const { getRandomQuiz, normalizeAnswer } = require('./quizBank');

// Mapa de temporizadores activos por chat_id: chatId -> NodeJS.Timeout
const activeIntervals = new Map();
// Cache de sesión en memoria activa: chatId -> quizSession
const activeSessionsMem = new Map();

/**
 * Formatea la plantilla estética de entrega privada de una recompensa.
 */
function renderPrivateRewardCard(user, reward) {
  const dateFormatted = getSuperscriptDate();
  const userName = escapeHtml(user.first_name || 'Ganador');
  const title = escapeHtml(reward.account_title || reward.category || 'Cuenta Premium');

  return (
    `<b>⟡ [VENTAS LIBRES PERÚ] PREMIO OFICIAL</b>\n` +
    `──────\n\n` +
    `• <b>Ganador:</b> <b>${userName}</b>\n` +
    `• <b>Premio:</b> <code>${title}</code>\n` +
    `• <b>Estado:</b> <code>[ ENTREGADO ]</code>\n\n` +
    `↳ <i>Tu archivo de cookies .txt está adjunto para importar en Cookie-Editor.</i>\n\n` +
    `──────\n` +
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
      `<b>⟡ [QUIZZ VLP] TRIVIA EN VIVO</b>\n` +
      `──────\n\n` +
      `• <b>Categoría:</b> <code>${quiz.category}</code>\n` +
      `• <b>Premio:</b> <code>Cuenta Streaming (Prime / YouTube)</code>\n\n` +
      `<b>${escapeHtml(quiz.question)}</b>\n\n` +
      `💡 <i>Pista: ${escapeHtml(quiz.hint)}</i>\n\n` +
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

    await bot.api.sendMessage(user.id, text, { parse_mode: 'HTML' });
    await bot.api.sendDocument(user.id, new InputFile(buffer, fileName), {
      caption: `⟡ Cookies para <b>${escapeHtml(reward.account_title)}</b>.` ,
      parse_mode: 'HTML'
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
  }, 10 * 1000);
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

  // ── 4. Comando /claim (Privado) ──
  bot.command('claim', async (ctx) => {
    try {
      if (ctx.chat.type !== 'private') {
        return ctx.reply('⟡ ✗ <i>El comando <code>/claim</code> solo funciona en chat privado con el bot.</i>', { parse_mode: 'HTML' });
      }

      const pending = await db.getPendingClaim(ctx.from.id);
      if (!pending) {
        return ctx.reply(
          `<b>⟡ [RECOMPENSAS] SIN PREMIOS PENDIENTES</b>\n` +
          `──────\n\n` +
          `No tienes ninguna cuenta pendiente por retirar.\n` +
          `<i>¡Responde los quizzes en el grupo para ganar!</i>\n\n` +
          `──────\n` +
          `${getSuperscriptDate()}`,
          { parse_mode: 'HTML' }
        );
      }

      const reward = {
        id: pending.reward_id,
        category: pending.reward_category || pending.category || 'CUENTA',
        account_title: pending.account_title || 'Cuenta Premium Oficial',
        account_data: pending.account_data || '# Sin credenciales'
      };

      const text = renderPrivateRewardCard(ctx.from, reward);
      const fileName = `cuenta_${reward.category.toLowerCase()}_vlp.txt`;
      const buffer = Buffer.from(reward.account_data, 'utf8');

      await ctx.reply(text, { parse_mode: 'HTML' });
      await ctx.replyWithDocument(new InputFile(buffer, fileName), {
        caption: `⟡ Cookies para <b>${escapeHtml(reward.account_title)}</b>.`,
        parse_mode: 'HTML'
      });

      await db.clearPendingClaim(ctx.from.id);
    } catch (err) {
      console.error('⟡ Error en /claim:', err.message);
      ctx.reply(`⟡ ✗ Error al procesar tu reclamo: ${err.message}`);
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

      const replyText = (replyTo.text || replyTo.caption || '').toUpperCase();
      const isQuizCard = replyText.includes('QUIZZ') || replyText.includes('TRIVIA');

      const chatId = ctx.chat.id;
      let session = activeSessionsMem.get(chatId) || await db.getActiveQuizSession(chatId);

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

      // Respuesta correcta
      session.status = 'SOLVED';
      activeSessionsMem.delete(chatId);

      // Desfijar mensaje para mantener el chat limpio
      try {
        await ctx.api.unpinChatMessage(chatId, session.message_id);
      } catch {}

      const winner = ctx.from;
      const winnerName = escapeHtml(winner.first_name || 'Ganador');
      const winnerUser = winner.username ? `@${escapeHtml(winner.username)}` : `ID: ${winner.id}`;

      const reward = await db.acquireRewardAtomic(winner.id, winner.username, session.id);

      let deliveryStatus = false;
      if (reward) {
        await db.solveQuizSession(session.id, winner.id, winner.username, reward.id);
        const deliveryResult = await deliverRewardToWinner(bot, winner, reward, session.id);
        deliveryStatus = deliveryResult.deliveredDirectly;
      }

      const botUsername = ctx.me?.username || 'ventas_libres_peru_Bot';
      const dateFormatted = getSuperscriptDate();

      const winMessage =
        `<b>⟡ [QUIZZ] ¡GANADOR DETECTADO!</b>\n` +
        `──────\n\n` +
        `• <b>Ganador:</b> <b>${winnerName}</b> (${winnerUser})\n` +
        `• <b>Respuesta:</b> <b>${escapeHtml(ctx.message.text.toUpperCase())}</b>\n` +
        `• <b>Premio:</b> <code>${escapeHtml(reward ? reward.account_title : 'Cuenta Streaming')}</code>\n\n` +
        (deliveryStatus
          ? `✓ <i>Premio enviado a tu chat privado con el bot.</i>\n`
          : `⚠️ <i>Abre chat con @${botUsername} y envía <code>/claim</code> para retirar tu cuenta.</i>\n`) +
        `──────\n` +
        `${dateFormatted}`;

      await ctx.reply(winMessage, {
        parse_mode: 'HTML',
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
  }, 5000);
}

module.exports = {
  register,
  triggerQuiz,
  startQuizTimer,
  stopQuizTimer
};
