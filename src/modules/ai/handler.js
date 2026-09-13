const { SYM } = require('../../config/constants');
const config = require('../../config/env');
const { generateAiResponse } = require('./service');
const { getSessionHistory, addMessageToSession, clearSession } = require('./memory');
const { createCachineroWarningCard, createFaltosoWarningCard } = require('../../utils/aesthetic');
const redisDb = require('../../database/redis');
const db = require('../../database/postgres');
const logger = require('../moderation/logger');
const { InlineKeyboard } = require('grammy');

// ── Mensajes Variados y Dinámicos de Espera ──
const THINKING_MESSAGES = [
  '⟡ <i>Aguanta mano, te estoy redactando con cordura...</i>',
  '⟡ <i>Procesando con la batería seria de Ventas Libres Perú...</i>',
  '⟡ <i>Chequeando el archivo y las normas de la comunidad...</i>',
  '⟡ <i>A ver qué me estás comentando, causa...</i>',
  '⟡ <i>Consultando el radar al toque nomás...</i>',
];

function getRandomThinkingMessage() {
  return THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];
}

/**
 * Verifica si el usuario actual tiene permisos de Staff (Owner, Co-Owner, Admin, Trato Admin).
 */
async function isUserStaff(userId) {
  if (config.OWNER_IDS.includes(userId)) return true;
  try {
    const member = await db.getStaffMember(userId);
    return !!(member && member.role);
  } catch {
    return false;
  }
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

/**
 * Convierte y limpia Markdown a HTML compatible estrictamente con Telegram.
 */
function formatAiReply(raw) {
  if (!raw) return '';
  let text = raw;

  // 1. Limpieza de etiquetas no permitidas
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p.*?>/gi, '');
  text = text.replace(/<\/?(div|span|ul|ol|li).*?>/gi, '');
  text = text.replace(/&nbsp;/gi, ' ');

  // 2. Encabezados Markdown a Negrita Estética
  text = text.replace(/^#{1,3}\s+(.+)$/gm, '<b>$1</b>');

  // 3. Separadores Markdown a Separador Unicode Estético
  text = text.replace(/^---+$/gm, '────────────────────────────────────────');

  // 4. Enlaces Markdown [texto](url)
  text = text.replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<a href="$2">$1</a>');

  // 5. Bloques de código ```bloque``` y código en línea `codigo`
  text = text.replace(/```(?:[a-z0-9]+)?\n([\s\S]*?)```/gi, '<pre><code>$1</code></pre>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 6. Negrita **texto**
  text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

  // 7. Cursiva *texto* o _texto_
  text = text.replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, '<i>$1</i>');
  text = text.replace(/(?<!_)_([^_]+)_(?!_)/g, '<i>$1</i>');

  return text.trim();
}

function register(bot) {
  let botUsername = 'ventas_libres_peru_Bot';
  bot.api.getMe().then((me) => {
    if (me?.username) botUsername = me.username;
  }).catch(() => { });

  // ── Función Central para Procesar Consultas de IA ──
  async function handleAiQuery(ctx, promptText) {
    if (ctx.tenant) return;
    if (await isEscrowOrStaffContext(ctx)) return;

    const userId = ctx.from.id;
    const cleanPrompt = promptText.trim();
    if (!cleanPrompt) return;

    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

    // 1. Acción de "escribiendo..." en el chat
    try {
      await ctx.replyWithChatAction('typing');
    } catch {}

    // 2. Mensaje de espera dinámico
    let placeholder = null;
    try {
      placeholder = await ctx.reply(getRandomThinkingMessage(), {
        parse_mode: 'HTML',
        reply_parameters: { message_id: ctx.message.message_id },
      });
    } catch {
      try {
        placeholder = await ctx.reply('✍️ <i>Procesando consulta...</i>', { parse_mode: 'HTML' });
      } catch {}
    }

    try {
      // 3. Historial de sesión
      const history = await getSessionHistory(userId);

      // 4. Datos del usuario
      const isOwner = config.OWNER_IDS.includes(userId);
      const userInfo = {
        userId,
        username: ctx.from.username || null,
        firstName: ctx.from.first_name || '',
        lastName: ctx.from.last_name || '',
        isOwner,
      };

      // 5. Generar respuesta con la IA Multi-Proveedor
      let rawAiReply = await generateAiResponse(cleanPrompt, history, userInfo);

      // 6. Detección de intenciones especiales (Faltoso o Cachinero)
      let intent = null;
      if (rawAiReply.includes('<!-- INTENT:CACHINERO -->')) {
        intent = 'CACHINERO';
      } else if (rawAiReply.includes('<!-- INTENT:FALTOSO -->')) {
        intent = 'FALTOSO';
      }

      // Eliminar las marcas internas
      rawAiReply = rawAiReply.replace(/<!--\s*INTENT:[A-Z_]+\s*-->/gi, '').trim();

      // Formatear a HTML de Telegram
      let formattedReply = formatAiReply(rawAiReply);

      // Teclado interactivo opcional para advertencias
      let replyMarkup = undefined;

      // 7. Si se detectó en un grupo, adjuntar la tarjeta estética de advertencia oficial
      if (isGroup && intent) {
        if (intent === 'CACHINERO') {
          formattedReply += createCachineroWarningCard({
            username: ctx.from.username,
            userId: ctx.from.id,
            firstName: ctx.from.first_name,
          });
        } else if (intent === 'FALTOSO') {
          formattedReply += createFaltosoWarningCard({
            username: ctx.from.username,
            userId: ctx.from.id,
            firstName: ctx.from.first_name,
          });
        }

        // Botón exclusivo para que el Staff aplique un warn oficial con un solo toque
        const kb = new InlineKeyboard();
        kb.text('⚠️ Aplicar Warn Oficial (Staff)', `ai_warn:${ctx.from.id}:${intent.toLowerCase()}`).row();
        if (config.CHANNELS_TO_VERIFY && config.CHANNELS_TO_VERIFY[0]) {
          const ruleLink = config.CHANNELS_TO_VERIFY[0].startsWith('http')
            ? config.CHANNELS_TO_VERIFY[0]
            : `https://t.me/${config.CHANNELS_TO_VERIFY[0].replace('@', '')}`;
          kb.url('📜 Ver Normas de Comercio', ruleLink);
        }
        replyMarkup = kb;
      }

      // 8. Guardar en memoria de sesión
      await addMessageToSession(userId, 'user', cleanPrompt);
      await addMessageToSession(userId, 'model', formattedReply);

      // 9. Enviar o editar el mensaje con la respuesta final
      if (placeholder) {
        try {
          await ctx.api.editMessageText(
            ctx.chat.id,
            placeholder.message_id,
            formattedReply,
            {
              parse_mode: 'HTML',
              ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
            }
          );
        } catch (htmlErr) {
          // Fallback seguro a texto plano si alguna etiqueta quedó desbalanceada
          try {
            await ctx.api.editMessageText(
              ctx.chat.id,
              placeholder.message_id,
              rawAiReply,
              { ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }
            );
          } catch {
            await ctx.reply(formattedReply, {
              parse_mode: 'HTML',
              reply_parameters: { message_id: ctx.message.message_id },
              ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
            });
          }
        }
      } else {
        await ctx.reply(formattedReply, {
          parse_mode: 'HTML',
          reply_parameters: { message_id: ctx.message.message_id },
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        });
      }
    } catch (err) {
      console.error('⟡ Error en Asistente IA:', err.message);
      const errMsg = `${SYM.CROSS} <i>Disculpa causa, hubo una saturación momentánea en el procesamiento. Intenta de nuevo en unos segundos.</i>`;
      if (placeholder) {
        try {
          await ctx.api.editMessageText(ctx.chat.id, placeholder.message_id, errMsg, { parse_mode: 'HTML' });
        } catch {}
      } else {
        await ctx.reply(errMsg, { parse_mode: 'HTML' });
      }
    }
  }

  // ── Callback Query: Aplicación Rápida de Warn por Staff ante Cachinero/Faltoso ──
  bot.callbackQuery(/^ai_warn:(\d+):([a-z_]+)$/, async (ctx) => {
    const targetUserId = parseInt(ctx.match[1]);
    const reasonKey = ctx.match[2];
    const clickerId = ctx.from.id;

    // Verificar si quien presiona es Staff
    const isStaff = await isUserStaff(clickerId);
    if (!isStaff) {
      return ctx.answerCallbackQuery({
        text: '❌ Solo los miembros autorizados del Staff pueden aplicar warns oficiales.',
        show_alert: true,
      });
    }

    try {
      const reason = reasonKey === 'cachinero'
        ? 'Cachineo / Desvalorización agresiva de precios en grupo'
        : 'Falta de respeto / Trato insolente hacia la comunidad';

      // 1. Agregar advertencia en base de datos
      await db.addWarning(targetUserId, ctx.chat.id, clickerId, reason);

      // 2. Obtener total de advertencias acumuladas
      const currentWarns = await db.getWarnings(targetUserId, ctx.chat.id);
      const warnCount = currentWarns.length;

      // 3. Notificar en el chat
      let actionResultText = `⚠️ <b>WARN OFICIAL APLICADO POR EL STAFF</b>\n`;
      actionResultText += `══════════════════════════════════════════════════════\n`;
      actionResultText += `▸ <b>Infractor:</b> <code>${targetUserId}</code>\n`;
      actionResultText += `▸ <b>Staff Responsable:</b> @${ctx.from.username || ctx.from.first_name}\n`;
      actionResultText += `▸ <b>Motivo:</b> ${reason}\n`;
      actionResultText += `▸ <b>Advertencias Acumuladas:</b> <b>${warnCount} / 3</b>\n`;

      if (warnCount >= 3 && (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group')) {
        try {
          await ctx.api.banChatMember(ctx.chat.id, targetUserId);
          actionResultText += `──────────────────────────────────────────────────────\n`;
          actionResultText += `🚨 <b>SANCIÓN MÁXIMA:</b> El usuario alcanzó el límite de 3 advertencias y ha sido <b>EXPULSADO</b> del grupo.\n`;
        } catch (banErr) {
          actionResultText += `\n⚠️ <i>No se pudo expulsar automáticamente (verificar permisos del bot).</i>`;
        }
      }

      await ctx.reply(actionResultText, { parse_mode: 'HTML' });

      // 4. Registrar en logs oficiales
      await db.addModLog('WARN', clickerId, targetUserId, ctx.chat.id, `Warn #${warnCount}: ${reason}`);
      await logger.sendLog(ctx.api, 'WARN', ctx.from, targetUserId, ctx.chat.title || 'Grupo', `Warn #${warnCount}: ${reason}`);

      await ctx.answerCallbackQuery({ text: `✓ Warn #${warnCount} aplicado con éxito.` });
    } catch (err) {
      console.error('⟡ Error aplicando warn desde IA:', err.message);
      await ctx.answerCallbackQuery({ text: '❌ Error al aplicar advertencia en base de datos.', show_alert: true });
    }
  });

  // ── Comando /ask /ia /ai [pregunta] ──
  bot.command(['ask', 'ia', 'ai'], async (ctx) => {
    const text = ctx.message.text || '';
    const parts = text.split(/\s+/);
    let prompt = parts.slice(1).join(' ').trim();

    if (!prompt && ctx.message.reply_to_message?.text) {
      prompt = ctx.message.reply_to_message.text;
    }

    if (!prompt) {
      return ctx.reply(
        `⟡ <b>ASISTENTE INTELIGENTE</b> ⊱ <code>VENTAS LIBRES PERÚ</code> ⊰\n` +
        `══════════════════════════════════════════════════════\n\n` +
        `▸ <b>Uso:</b> <code>/ask [tu pregunta o duda]</code>\n` +
        `▸ <b>Ejemplo Serio:</b> <code>/ask Habla con cordura: ¿Cómo inicio un trato seguro?</code>\n` +
        `▸ <b>Ejemplo Charla:</b> <code>/ask Habla causa, ¿qué cuentas recomiendas?</code>\n\n` +
        `──────────────────────────────────────────────────────\n` +
        `💡 <i>También puedes mencionarme con @${botUsername} en cualquier grupo oficial o escribirme directamente al privado.</i>`,
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
        `⟡ <b>MEMORIA REINICIADA</b> ⊱ <code>SESIÓN IA</code> ⊰\n` +
        `══════════════════════════════════════════════════════\n` +
        `✓ Tu historial conversacional ha sido restablecido a cero.\n` +
        `Empezaremos una nueva charla limpia. 🔄`,
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

    if (ctx.tenant) return next();
    if (text.startsWith('/')) return next();

    // 1. En chat privado (DM): responder como asistente si no está en un formulario activo
    if (isPrivate) {
      try {
        const burnState = await redisDb.getBurnState(userId);
        if (burnState && burnState.step && burnState.step !== 'IDLE') {
          return next();
        }
        const dealForm = await redisDb.getCache(`deal_form:${userId}`);
        if (dealForm) {
          return next();
        }
      } catch {}

      await handleAiQuery(ctx, text);
      return;
    }

    // 2. En grupos: responder si mencionan al bot o responden a un mensaje del bot
    if (await isEscrowOrStaffContext(ctx)) {
      return next();
    }

    const isBotMentioned = text.toLowerCase().includes(`@${botUsername.toLowerCase()}`);
    const isReplyToBot = ctx.message.reply_to_message?.from?.is_bot && ctx.message.reply_to_message?.from?.username?.toLowerCase() === botUsername.toLowerCase();

    if (isBotMentioned || isReplyToBot) {
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
