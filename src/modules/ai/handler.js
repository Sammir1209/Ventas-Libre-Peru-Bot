const { SYM } = require('../../config/constants');
const config = require('../../config/env');
const { generateAiResponse } = require('./service');
const { getSessionHistory, addMessageToSession, clearSession } = require('./memory');
const redisDb = require('../../database/redis');
const db = require('../../database/postgres');

// ── Mensajes Variados y Dinámicos de Espera (Estilo Barrio / Comunidad) ──
const THINKING_MESSAGES = [
  '✍️ <i>Aguanta mano, te estoy redactando ...</i>',
  '🧠 <i>Pensando qué decirte, causa...</i>',
  '🇵🇪 <i>Procesando con la batería seria...</i>',
  '⚡ <i>Buscando en la data al toque...</i>',
  '💭 <i>A ver qué me estás preguntando, choche...</i>',
  '🔍 <i>Chequeando el archivo de la gente...</i>',
];

function getRandomThinkingMessage() {
  return THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];
}

/**
 * Verifica si el mensaje actual proviene de un grupo o hilo de Trato Admin (Escrow) o Staff.
 * La IA queda completamente DESACTIVADA en estos espacios para no interrumpir negociaciones.
 */
async function isEscrowOrStaffContext(ctx) {
  const chatId = ctx.chat?.id;
  const threadId = ctx.message?.message_thread_id;

  if (!chatId) return false;

  // 1. Grupo oficial de Escrow / Tratos
  if (config.ESCROW_GROUP_ID && chatId === config.ESCROW_GROUP_ID) {
    return true;
  }

  // 2. Chat configurado en base de datos como grupo de tratos
  try {
    const savedEscrowId = (await redisDb.getCache('escrow_group_id')) || (await db.getSetting('escrow_group_id'));
    if (savedEscrowId && Number(savedEscrowId) === chatId) {
      return true;
    }
  } catch {}

  // 3. Hilo específico registrado como sala de un trato activo
  if (threadId) {
    try {
      const dealId = await redisDb.getCache(`thread_deal:${threadId}`);
      if (dealId) return true;
    } catch {}
  }

  // 4. Grupo o Hilos de Staff
  if (config.STAFF_CHAT_ID && chatId === config.STAFF_CHAT_ID) {
    return true;
  }

  try {
    const savedStaffChat = await db.getSetting('staff_chat_id');
    if (savedStaffChat && Number(savedStaffChat) === chatId) {
      return true;
    }
  } catch {}

  return false;
}

function register(bot) {
  let botUsername = 'ventas_libres_peru_Bot';
  bot.api.getMe().then((me) => {
    if (me?.username) botUsername = me.username;
  }).catch(() => { });

  // ── Función Central para Procesar Consultas de IA ──
  async function handleAiQuery(ctx, promptText) {
    // 0. Bloqueo estricto: silenciar IA si se encuentra en un hilo/grupo de Trato Admin o Staff
    if (await isEscrowOrStaffContext(ctx)) {
      return;
    }

    const userId = ctx.from.id;
    const cleanPrompt = promptText.trim();
    if (!cleanPrompt) return;

    // 1. Enviar acción de "escribiendo..." en el chat
    try {
      await ctx.replyWithChatAction('typing');
    } catch { }

    // 2. Enviar mensaje de espera dinámico y variado
    let placeholder = null;
    try {
      placeholder = await ctx.reply(getRandomThinkingMessage(), {
        parse_mode: 'HTML',
        reply_parameters: { message_id: ctx.message.message_id },
      });
    } catch {
      try {
        placeholder = await ctx.reply('✍️ Escribiendo...');
      } catch { }
    }

    try {
      // 3. Obtener historial aislado de este usuario
      const history = await getSessionHistory(userId);

      // 4. Identificar al usuario que habla
      const isOwner = config.OWNER_IDS.includes(userId);
      const userInfo = {
        userId,
        username: ctx.from.username || null,
        firstName: ctx.from.first_name || '',
        lastName: ctx.from.last_name || '',
        isOwner,
      };

      // 5. Generar respuesta con Gemini o Groq
      let aiReply = await generateAiResponse(cleanPrompt, history, userInfo);

      // Limpiar etiquetas HTML no compatibles con Telegram y convertir Markdown a HTML
      aiReply = aiReply.replace(/<br\s*\/?>/gi, '\n');
      aiReply = aiReply.replace(/<\/p>/gi, '\n\n');
      aiReply = aiReply.replace(/<p.*?>/gi, '');
      aiReply = aiReply.replace(/<h\d.*?>/gi, '<b>');
      aiReply = aiReply.replace(/<\/h\d>/gi, '</b>\n');
      aiReply = aiReply.replace(/<\/?(div|span|ul|ol|li).*?>/gi, '');
      aiReply = aiReply.replace(/&nbsp;/gi, ' ');

      // Convertir Markdown Links a HTML
      aiReply = aiReply.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

      // Convertir bloques de código Markdown a HTML
      aiReply = aiReply.replace(/```(?:[a-z0-9]+)?\n([\s\S]*?)```/gi, '<pre><code>$1</code></pre>');
      aiReply = aiReply.replace(/`(.*?)`/g, '<code>$1</code>');

      // Convertir Markdown (asteriscos) a HTML para Telegram
      aiReply = aiReply.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      aiReply = aiReply.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');
      
      aiReply = aiReply.trim();

      // 6. Guardar en memoria de sesión
      await addMessageToSession(userId, 'user', cleanPrompt);
      await addMessageToSession(userId, 'model', aiReply);

      // 6. Editar el mensaje de espera en tiempo real con la respuesta final
      if (placeholder) {
        try {
          await ctx.api.editMessageText(
            ctx.chat.id,
            placeholder.message_id,
            aiReply,
            { parse_mode: 'HTML' }
          );
        } catch (htmlErr) {
          // Fallback a texto plano si alguna etiqueta HTML no cerró
          try {
            await ctx.api.editMessageText(
              ctx.chat.id,
              placeholder.message_id,
              aiReply
            );
          } catch {
            await ctx.reply(aiReply, {
              reply_parameters: { message_id: ctx.message.message_id },
            });
          }
        }
      } else {
        await ctx.reply(aiReply, {
          parse_mode: 'HTML',
          reply_parameters: { message_id: ctx.message.message_id },
        });
      }
    } catch (err) {
      console.error('⟡ Error en Asistente IA:', err.message);
      if (placeholder) {
        try {
          await ctx.api.editMessageText(
            ctx.chat.id,
            placeholder.message_id,
            `${SYM.CROSS} <i>Disculpa, hubo un problema momentáneo al procesar tu consulta. Intenta de nuevo en unos segundos.</i>`,
            { parse_mode: 'HTML' }
          );
        } catch { }
      } else {
        await ctx.reply(
          `${SYM.CROSS} <i>Disculpa, hubo un problema momentáneo al procesar tu consulta. Intenta de nuevo en unos segundos.</i>`,
          { parse_mode: 'HTML' }
        );
      }
    }
  }

  // ── Comando /ask /ia /ai [pregunta] ──
  bot.command(['ask', 'ia', 'ai'], async (ctx) => {
    const text = ctx.message.text || '';
    const parts = text.split(/\s+/);
    let prompt = parts.slice(1).join(' ').trim();

    // Si no hay texto, pero se respondió a un mensaje
    if (!prompt && ctx.message.reply_to_message?.text) {
      prompt = ctx.message.reply_to_message.text;
    }

    if (!prompt) {
      return ctx.reply(
        `${SYM.DIVIDER}\n` +
        `🤖 <b>ASISTENTE IA — VENTAS LIBRES PERÚ</b>\n` +
        `${SYM.DIVIDER}\n\n` +
        `➜ <b>Uso:</b> <code>/ask [tu pregunta o duda]</code>\n` +
        `➜ <b>Ejemplo:</b> <code>/ask ¿Qué hago si me estafaron?</code>\n` +
        `➜ <b>Ejemplo:</b> <code>/ask ¿Quién te creó?</code>\n\n` +
        `${SYM.THIN_LINE}\n` +
        `<i>También puedes mencionarme con @${botUsername} en cualquier grupo o hablarme por privado.</i>`,
        { parse_mode: 'HTML' }
      );
    }

    await handleAiQuery(ctx, prompt);
  });

  // ── Comando /reset_ai /borrar_ia (Reiniciar Memoria de Sesión) ──
  bot.command(['reset_ai', 'borrar_ia', 'limpiar_ia'], async (ctx) => {
    try {
      await clearSession(ctx.from.id);
      await ctx.reply(
        `${SYM.CHECK} <b>Memoria Reiniciada:</b> Tu sesión conversacional con la IA ha sido limpiada con éxito. Empezaremos desde cero. 🔄`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /reset_ai:', err.message);
    }
  });

  // ── Listener para Menciones en Grupos y Mensajes en Privado ──
  bot.on('message:text', async (ctx, next) => {
    const text = ctx.message?.text || '';
    const userId = ctx.from?.id;
    const isPrivate = ctx.chat.type === 'private';

    // Ignorar si es un comando que empieza con '/'
    if (text.startsWith('/')) {
      return next();
    }

    // 1. En chat privado (DM): responder como asistente inteligente si no está en un formulario
    if (isPrivate) {
      // Validar si el usuario está en flujo /quemar o /tratoadm
      try {
        const burnState = await redisDb.getBurnState(userId);
        if (burnState && burnState.step && burnState.step !== 'IDLE') {
          return next();
        }
        const dealForm = await redisDb.getCache(`deal_form:${userId}`);
        if (dealForm) {
          return next();
        }
      } catch { }

      await handleAiQuery(ctx, text);
      return;
    }

    // 2. En grupos: responder si mencionan al bot o responden a un mensaje del bot
    // Ignorar si el mensaje se envió dentro de un grupo o hilo de Trato Admin o Staff
    if (await isEscrowOrStaffContext(ctx)) {
      return next();
    }

    const isBotMentioned = text.toLowerCase().includes(`@${botUsername.toLowerCase()}`);
    const isReplyToBot = ctx.message.reply_to_message?.from?.is_bot && ctx.message.reply_to_message?.from?.username?.toLowerCase() === botUsername.toLowerCase();

    if (isBotMentioned || isReplyToBot) {
      // Limpiar la mención @botUsername del prompt
      const regex = new RegExp(`@${botUsername}`, 'gi');
      const cleanPrompt = text.replace(regex, '').trim();

      if (cleanPrompt) {
        await handleAiQuery(ctx, cleanPrompt);
        return;
      }
    }

    return next();
  });
}

module.exports = {
  register,
};
