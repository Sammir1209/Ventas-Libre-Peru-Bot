// ══════════════════════════════════════════════════════════
// ⟡ Módulo de Juegos & Quizz Interactivo con Premios Reales
//   Control: /quizzon, /quizzoff, /quizz, /claim, /stock, /addstock
// ══════════════════════════════════════════════════════════

const crypto = require('crypto');
const { InputFile } = require('grammy');
const db = require('../../database/postgres');
const config = require('../../config/env');
const { requireStaff } = require('../../middleware/auth');
const { escapeHtml, getSuperscriptDate } = require('../../utils/formatting');
const { toMathBold } = require('../../utils/aesthetic');
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
  const userTag = user.username ? `@${escapeHtml(user.username)}` : `ID: ${user.id}`;
  const title = escapeHtml(reward.account_title || reward.category || 'Cuenta Premium');

  return (
    `╔══════════════════════════════════════╗\n` +
    `   ❖ <b>VENTAS LIBRES PERÚ - PREMIO OFICIAL</b> ❖\n` +
    `╚══════════════════════════════════════╝\n\n` +
    `⟡ <b>Ganador:</b> <b>${userName}</b> (${userTag})\n` +
    `⟡ <b>Premio:</b> <code>${title}</code>\n` +
    `⟡ <b>Estado:</b> <code>[ ENTREGADO Y VÁLIDO ]</code>\n` +
    `══════\n` +
    `↳ <b>GUÍA DE ACCESO Y USO:</b>\n` +
    `• Te hemos adjuntado el archivo de cookies <code>.txt</code> descargable abajo.\n` +
    `• Puedes importarlo en tu navegador usando la extensión <b>Cookie-Editor</b> o <b>J2TEAM Cookies</b>.\n` +
    `• Esta cuenta ha sido asignada exclusivamente a ti y retirada del pool para evitar duplicaciones.\n\n` +
    `<i>¡Felicidades por ganar el Quizz de la comunidad!</i>\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

/**
 * Lanza un Quizz interactivo en un chat específico.
 */
async function triggerQuiz(bot, chatId) {
  try {
    const cId = Number(chatId);

    // 1. Validar que no haya una sesión ya activa en el chat
    const existing = activeSessionsMem.get(cId) || await db.getActiveQuizSession(cId);
    if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
      return { success: false, reason: 'ALREADY_ACTIVE' };
    }

    // 2. Validar que existan recompensas en stock
    const stock = await db.getAvailableRewardsCount();
    if (stock.total <= 0) {
      // Auto-apagar quizz en este chat por falta de stock
      await db.updateQuizSettings(cId, { enabled: false });
      stopQuizTimer(cId);
      await bot.api.sendMessage(
        cId,
        `⟡ ⚠️ <b>[QUIZZ PAUSADO]:</b> <i>El sistema de trivias automáticas se ha detenido porque el stock de cuentas se encuentra agotado (0 cuentas disponibles). El staff reanudará el servicio pronto.</i>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
      return { success: false, reason: 'NO_STOCK' };
    }

    // 3. Obtener pregunta aleatoria
    const quiz = getRandomQuiz();
    const sessionId = crypto.randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + 65 * 1000); // 65 segundos

    const dateFormatted = getSuperscriptDate();
    const quizText =
      `╔══════════════════════════════════════╗\n` +
      `     ❖ <b>QUIZZ INTERACTIVO VLP</b> ❖\n` +
      `╚══════════════════════════════════════╝\n\n` +
      `⟡ <b>Categoría:</b> <code>${quiz.category}</code>\n` +
      `⟡ <b>Premio:</b> <code>Cuenta Premium (Prime Video / YouTube)</code>\n` +
      `⟡ <b>Stock Disponible:</b> <code>[ ${stock.total} Cuentas ]</code>\n` +
      `══════\n` +
      `▸ <b>PREGUNTA:</b>\n` +
      `<b>${escapeHtml(quiz.question)}</b>\n\n` +
      `💡 <i>Pista: ${escapeHtml(quiz.hint)}</i>\n` +
      `══════\n` +
      `⟡ <b>¿Cómo ganar?</b>\n` +
      `↳ <b>Responde directamente (Reply)</b> a este mensaje con la respuesta correcta.\n` +
      `↳ El primero en acertar se lleva la cuenta al instante.\n` +
      `⏱️ <b>Tiempo límite:</b> <code>60 segundos</code>\n` +
      `──────\n` +
      `${dateFormatted}`;

    const sentMsg = await bot.api.sendMessage(cId, quizText, { parse_mode: 'HTML' });

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

    // Temporizador de expiración (65s)
    setTimeout(async () => {
      const current = activeSessionsMem.get(cId);
      if (current && current.id === sessionId && current.status === 'ACTIVE') {
        current.status = 'EXPIRED';
        activeSessionsMem.delete(cId);
        await db.expireQuizSession(sessionId);

        const expText =
          `⟡ ⌛ <b>[QUIZZ FINALIZADO - TIEMPO AGOTADO]</b>\n` +
          `══════\n` +
          `Nadie logró responder a tiempo. La respuesta correcta era: <b>${escapeHtml(quiz.rawAnswers[0].toUpperCase())}</b>.\n` +
          `<i>¡Prepárense para la siguiente trivia!</i>`;

        await bot.api.sendMessage(cId, expText, {
          parse_mode: 'HTML',
          reply_parameters: { message_id: sentMsg.message_id }
        }).catch(() => {});
      }
    }, 65 * 1000);

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

    // Intentar envío por DM
    await bot.api.sendMessage(user.id, text, { parse_mode: 'HTML' });
    await bot.api.sendDocument(user.id, new InputFile(buffer, fileName), {
      caption: `⟡ Archivo de sesión/cookies para <b>${escapeHtml(reward.account_title)}</b>.` ,
      parse_mode: 'HTML'
    });
    return { deliveredDirectly: true };
  } catch (dmErr) {
    // Si el usuario no tiene chat iniciado o bloqueó al bot, guardar en pending_claims
    console.log(`⟡ No se pudo enviar DM a ${user.id} (${dmErr.message}). Registrando en pending_claims.`);
    await db.setPendingClaim(user.id, reward.id, quizId, reward.category);
    return { deliveredDirectly: false };
  }
}

/**
 * Registro de Handlers y Listeners en el Bot.
 */
function register(bot) {
  // ── 1. Comando /quizzon ──
  bot.command('quizzon', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply('⟡ ✗ <i>Este comando debe ejecutarse dentro del grupo oficial.</i>', { parse_mode: 'HTML' });
      }

      const stock = await db.getAvailableRewardsCount();
      if (stock.total <= 0) {
        return ctx.reply(
          `⟡ ✗ <b>NO SE PUEDE ACTIVAR EL QUIZZ AUTOMÁTICO</b>\n` +
          `══════\n` +
          `▸ <b>Stock disponible:</b> <code>[ 0 Cuentas ]</code>\n` +
          `▸ <b>Causa:</b> No hay cuentas activas en la base de datos para entregar a los ganadores.\n\n` +
          `<i>Carga nuevas cuentas con el comando <code>/addstock</code> o ejecuta el script de ingesta para continuar.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      const settings = await db.getQuizSettings(ctx.chat.id);
      const interval = settings?.interval_minutes || 5;

      await db.updateQuizSettings(ctx.chat.id, { enabled: true, interval_minutes: interval });
      startQuizTimer(bot, ctx.chat.id, interval);

      const dateFormatted = getSuperscriptDate();
      await ctx.reply(
        `╔══════════════════════════════════════╗\n` +
        `     ❖ <b>SISTEMA DE QUIZZ ACTIVADO [✓]</b> ❖\n` +
        `╚══════════════════════════════════════╝\n\n` +
        `▸ <b>Estado:</b> <code>[ EN EJECUCIÓN ]</code>\n` +
        `▸ <b>Frecuencia:</b> <code>Cada ${interval} minutos</code>\n` +
        `▸ <b>Stock Disponible:</b> <code>${stock.total} Cuentas (${stock.primeVideo} Prime, ${stock.youtube} YouTube)</code>\n` +
        `══════\n` +
        `<i>El primer Quizz se lanzará en el próximo ciclo programado. También puedes forzar uno de inmediato con <code>/quizz</code>.</i>\n` +
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

      const dateFormatted = getSuperscriptDate();
      await ctx.reply(
        `⟡ 🛑 <b>[QUIZZ AUTOMÁTICO APAGADO]</b>\n` +
        `══════\n` +
        `▸ <b>Estado:</b> <code>[ DETENIDO ]</code>\n` +
        `▸ <b>Grupo:</b> <b>${escapeHtml(ctx.chat.title || 'Oficial')}</b>\n` +
        `<i>No se enviarán más trivias automáticas hasta que vuelvas a usar <code>/quizzon</code>.</i>\n` +
        `──────\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /quizzoff:', err.message);
      ctx.reply(`⟡ ✗ Error: ${err.message}`);
    }
  });

  // ── 3. Comando /quizz (Disparo Inmediato) ──
  bot.command('quizz', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply('⟡ ✗ <i>Este comando debe ejecutarse dentro de un grupo oficial.</i>', { parse_mode: 'HTML' });
      }

      const res = await triggerQuiz(bot, ctx.chat.id);
      if (!res.success) {
        if (res.reason === 'ALREADY_ACTIVE') {
          return ctx.reply('⟡ ⚠️ <i>Ya hay un Quizz activo en este momento. Espera a que termine o expire.</i>', { parse_mode: 'HTML' });
        }
        if (res.reason === 'NO_STOCK') {
          return ctx.reply('⟡ ✗ <i>No hay stock de cuentas disponibles en la base de datos para lanzar el Quizz.</i>', { parse_mode: 'HTML' });
        }
        return ctx.reply(`⟡ ✗ No se pudo iniciar el Quizz: ${res.reason}`, { parse_mode: 'HTML' });
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
        return ctx.reply('⟡ ✗ <i>Por seguridad, el comando <code>/claim</code> solo funciona en chat privado con el bot.</i>', { parse_mode: 'HTML' });
      }

      const pending = await db.getPendingClaim(ctx.from.id);
      if (!pending) {
        return ctx.reply(
          `⟡ ℹ️ <b>[SIN RECOMPENSAS PENDIENTES]</b>\n` +
          `══════\n` +
          `No tienes ninguna cuenta pendiente por retirar en este momento.\n` +
          `<i>¡Participa y sé el más rápido en responder los quizzes en el grupo para ganar cuentas de streaming!</i>`,
          { parse_mode: 'HTML' }
        );
      }

      // Preparar entrega
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
        caption: `⟡ Archivo de sesión/cookies para <b>${escapeHtml(reward.account_title)}</b>.`,
        parse_mode: 'HTML'
      });

      // Limpiar de pending_claims para que no reclame doble
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
        `╔══════════════════════════════════════╗\n` +
        `    ❖ <b>INVENTARIO DE RECOMPENSAS VLP</b> ❖\n` +
        `╚══════════════════════════════════════╝\n\n` +
        `▸ <b>Stock Total Disponible:</b> <code>[ ${stock.total} Cuentas ]</code>\n` +
        `══════\n` +
        `• <b>Amazon Prime Video:</b> <code>${stock.primeVideo} disponibles</code>\n` +
        `• <b>YouTube Premium:</b> <code>${stock.youtube} disponibles</code>\n` +
        `══════\n` +
        `↳ <i>Cada cuenta entregada se retira automáticamente para evitar duplicaciones.</i>\n` +
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

      const chatId = ctx.chat.id;
      const session = activeSessionsMem.get(chatId) || await db.getActiveQuizSession(chatId);

      // Si no hay sesión activa o no responde al mensaje del Quizz, continuar
      if (!session || session.status !== 'ACTIVE' || session.message_id !== replyTo.message_id) {
        return next();
      }

      // Validar si el tiempo expiró
      if (new Date(session.expires_at).getTime() <= Date.now()) {
        session.status = 'EXPIRED';
        activeSessionsMem.delete(chatId);
        return next();
      }

      // Normalizar texto enviado
      const normalizedUserText = normalizeAnswer(ctx.message.text);
      const isCorrect = (session.normalized_answers || []).some(ans => {
        return normalizedUserText === ans || (ans.length > 3 && normalizedUserText.includes(ans));
      });

      if (!isCorrect) {
        // Respuesta incorrecta -> dejamos que sigan intentando
        return next();
      }

      // ── ¡RESPUESTA CORRECTA! ──
      // 1. Bloqueo inmediato para evitar condiciones de carrera
      session.status = 'SOLVED';
      activeSessionsMem.delete(chatId);

      const winner = ctx.from;
      const winnerName = escapeHtml(winner.first_name || 'Ganador');
      const winnerUser = winner.username ? `@${escapeHtml(winner.username)}` : `ID: ${winner.id}`;

      // 2. Extraer y bloquear atómicamente una cuenta del stock
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
        `╔══════════════════════════════════════╗\n` +
        `    ❖ <b>¡TENEMOS UN GANADOR DEL QUIZZ!</b> ❖\n` +
        `╚══════════════════════════════════════╝\n\n` +
        `⟡ <b>Ganador:</b> <b>${winnerName}</b> (${winnerUser})\n` +
        `⟡ <b>Respuesta Correcta:</b> <b>${escapeHtml(ctx.message.text.toUpperCase())}</b>\n` +
        `⟡ <b>Premio:</b> <code>${escapeHtml(reward ? reward.account_title : 'Cuenta Premium Oficial')}</code>\n` +
        `══════\n` +
        (deliveryStatus
          ? `✓ <i>¡Tus datos de acceso y archivo de cookies ya han sido enviados a tu <b>chat privado con el bot</b>!</i>\n`
          : `⚠️ <i>No pudimos enviarte mensaje privado directo. Entra a @${botUsername} y escribe el comando <code>/claim</code> para retirar tu cuenta ganada.</i>\n`) +
        `──────\n` +
        `${dateFormatted}`;

      await ctx.reply(winMessage, {
        parse_mode: 'HTML',
        reply_parameters: { message_id: ctx.message.message_id }
      });

      return; // Detener flujo, ya se atendió el Quizz
    } catch (err) {
      console.error('⟡ Error en evaluador de respuestas de quizz:', err.message);
    }
    return next();
  });

  // 7. Auto-inicialización al arranque de chats que tenían el quizz habilitado
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
