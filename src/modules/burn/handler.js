const redisDb = require('../../database/redis');
const db = require('../../database/postgres');
const supabaseStorage = require('../../database/supabase');
const config = require('../../config/env');
const templates = require('../../utils/templates');
const { escapeHtml, mentionFromData } = require('../../utils/formatting');
const { CB, SYM } = require('../../config/constants');
const {
  burnTargetTypeKeyboard,
  burnCancelOnlyKeyboard,
  burnProofUploadKeyboard,
  burnSummaryKeyboard,
  burnEditMenuKeyboard,
  burnStaffKeyboard,
} = require('./keyboard');
const { InlineKeyboard, InputFile, InputMediaBuilder } = require('grammy');
const https = require('https');
const userbot = require('../../userbot/client');

// Estados del flujo /quemar
const BURN_STATES = {
  CHOOSE_TYPE: 'CHOOSE_TYPE',
  AWAIT_ID: 'AWAIT_ID',
  AWAIT_USERNAME: 'AWAIT_USERNAME',
  AWAIT_CONTEXT: 'AWAIT_CONTEXT',
  AWAIT_PROOF: 'AWAIT_PROOF',
  SUMMARY: 'SUMMARY',
};

/**
 * Descarga un archivo de Telegram por file_id y retorna un Buffer.
 */
async function downloadTelegramFile(api, fileId) {
  const file = await api.getFile(fileId);
  const filePath = file.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${filePath}`;

  return new Promise((resolve, reject) => {
    https.get(downloadUrl, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        filePath: filePath,
        mimeType: getMimeType(filePath),
      }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function getMimeType(filePath) {
  if (!filePath) return 'image/jpeg';
  const ext = filePath.split('.').pop()?.toLowerCase();
  const mimeMap = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
    gif: 'image/gif',
  };
  return mimeMap[ext] || 'image/jpeg';
}

/**
 * Edita el mensaje maestro in-place para no generar spam ni múltiples mensajes en el chat.
 */
async function updateMasterMessage(ctx, state, text, keyboard) {
  const chatId = ctx.chat.id;
  const messageId = state?.masterMessageId;

  if (messageId) {
    try {
      await ctx.api.editMessageText(chatId, messageId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      return messageId;
    } catch (err) {
      if (!err.message?.includes('message is not modified')) {
        console.warn('⟡ Error editando master message de quemar:', err.message);
      } else {
        return messageId;
      }
    }
  }

  const newMsg = await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });

  if (state) {
    state.masterMessageId = newMsg.message_id;
    await redisDb.setBurnState(ctx.from.id, state);
  }

  return newMsg.message_id;
}

function register(bot) {
  // ── Comando /quemar (Chat Privado o Redirección) ──
  bot.command('quemar', async (ctx) => {
    try {
      const isPrivate = ctx.chat.type === 'private';

      // Si se ejecuta en un grupo, redirigir al privado con botón
      if (!isPrivate) {
        let botUsername = 'ventas_libres_peru_Bot';
        try {
          const botInfo = await ctx.api.getMe();
          botUsername = botInfo.username;
        } catch {}

        return ctx.reply(
          `⟡ <b>SISTEMA ANTI-FRAUDE</b> ⊱ <code>DENUNCIAS</code> ⊰\n` +
          `══════\n\n` +
          `Por protocolos de <b>seguridad y confidencialidad pericial</b>, los reportes de estafa se realizan <b>exclusivamente por mensaje privado</b> con el bot.\n\n` +
          `──────\n` +
          `▪ <i>Pulsa el botón oficial de abajo para iniciar tu denuncia con pruebas:</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard().url(
              'INICIAR REPORTE EN PRIVADO',
              `https://t.me/${botUsername}?start=quemar`
            ).primary(),
          }
        );
      }

      const userId = ctx.from.id;

      const initialMsg = await ctx.reply(templates.burnInitialPrompt(), {
        parse_mode: 'HTML',
        reply_markup: burnTargetTypeKeyboard(),
      });

      // Iniciar estado en Redis guardando el ID del mensaje maestro
      await redisDb.setBurnState(userId, {
        step: BURN_STATES.CHOOSE_TYPE,
        targetId: null,
        targetUsername: null,
        targetName: null,
        targetLabel: null,
        context: null,
        proofs: [],
        proofUrls: [],
        masterMessageId: initialMsg.message_id,
        chatId: ctx.chat.id,
      });
    } catch (err) {
      console.error('⟡ Burn: Error en /quemar:', err.message);
    }
  });

  // ── Callbacks de Selección de Tipo de Identificación ──
  bot.callbackQuery('burn_type:id', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = (await redisDb.getBurnState(userId)) || {};
      state.step = BURN_STATES.AWAIT_ID;
      state.masterMessageId = ctx.callbackQuery.message?.message_id || state.masterMessageId;
      await redisDb.setBurnState(userId, state);

      await updateMasterMessage(ctx, state, templates.burnAskIdPrompt(), burnCancelOnlyKeyboard());
    } catch (err) {
      console.error('⟡ Burn: Error en burn_type:id:', err.message);
    }
  });

  bot.callbackQuery('burn_type:username', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = (await redisDb.getBurnState(userId)) || {};
      state.step = BURN_STATES.AWAIT_USERNAME;
      state.masterMessageId = ctx.callbackQuery.message?.message_id || state.masterMessageId;
      await redisDb.setBurnState(userId, state);

      await updateMasterMessage(ctx, state, templates.burnAskUsernamePrompt(), burnCancelOnlyKeyboard());
    } catch (err) {
      console.error('⟡ Burn: Error en burn_type:username:', err.message);
    }
  });

  // ── Cancelar Reporte ──
  bot.callbackQuery('burn_cancel', async (ctx) => {
    try {
      const userId = ctx.from.id;
      await redisDb.clearBurnState(userId);
      await ctx.answerCallbackQuery({ text: '⟡ Reporte cancelado.' });

      const cancelText = templates.burnCancelledMessage();

      try {
        await ctx.editMessageText(cancelText, { parse_mode: 'HTML' });
      } catch {
        await ctx.reply(cancelText, { parse_mode: 'HTML' });
      }
    } catch (err) {
      console.error('⟡ Burn: Error en burn_cancel:', err.message);
    }
  });

  // ── Listener de Mensajes de Texto y Fotos (Flujo Conversacional con Auto-Limpieza) ──
  bot.on('message', async (ctx, next) => {
    if (ctx.chat.type !== 'private') return next();

    const userId = ctx.from.id;
    let state;
    try {
      state = await redisDb.getBurnState(userId);
    } catch {
      return next();
    }
    if (!state) return next();

    // Borrar el mensaje del usuario de inmediato para mantener limpio el chat
    try {
      await ctx.deleteMessage();
    } catch {}

    try {
      switch (state.step) {
        // ── Paso 1A: Recibir ID Numérico ──
        case BURN_STATES.AWAIT_ID: {
          const text = ctx.message.text?.trim();
          if (!text || !/^\d+$/.test(text)) {
            const errPrompt =
              `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFAS — REPORTE</b>\n\n` +
              `⚠️ <b>Error:</b> El ID debe contener <b>únicamente números</b>.\n` +
              `<i>Ejemplo: <code>8579513055</code></i>`;
            return updateMasterMessage(ctx, state, errPrompt, burnCancelOnlyKeyboard());
          }

          const targetId = parseInt(text);
          if (targetId === userId) {
            const errSelf =
              `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFAS — REPORTE</b>\n\n` +
              `⚠️ No puedes reportarte a ti mismo.\n` +
              `Ingresa el ID del usuario acusado:`;
            return updateMasterMessage(ctx, state, errSelf, burnCancelOnlyKeyboard());
          }

          // Resolver automáticamente username y nombre asociado al ID
          let targetUsername = null;
          let targetName = null;

          try {
            const dbUser = await db.getUser(targetId);
            if (dbUser) {
              targetUsername = dbUser.username || null;
              targetName = [dbUser.first_name, dbUser.last_name].filter(Boolean).join(' ') || null;
            }
          } catch {}

          // Intentar resolver via Userbot MTProto si no hay username
          if (!targetUsername) {
            try {
              if (userbot.isConnected()) {
                const ubRes = await userbot.resolveUser(targetId);
                if (ubRes) {
                  if (ubRes.username) targetUsername = ubRes.username;
                  const ubName = [ubRes.firstName, ubRes.lastName].filter(Boolean).join(' ');
                  if (ubName && (!targetName || targetName === 'Estafador')) targetName = ubName;
                }
              }
            } catch {}
          }

          try {
            const chatInfo = await ctx.api.getChat(targetId);
            if (chatInfo) {
              if (chatInfo.username) targetUsername = chatInfo.username;
              const tgName = [chatInfo.first_name, chatInfo.last_name].filter(Boolean).join(' ');
              if (tgName) targetName = tgName;
            }
          } catch {}

          const targetLabel = targetUsername
            ? `@${targetUsername} (<code>${targetId}</code>)`
            : (targetName ? `<code>${targetId}</code> (${escapeHtml(targetName)})` : `<code>${targetId}</code>`);

          state.targetId = targetId;
          state.targetUsername = targetUsername;
          state.targetName = targetName;
          state.targetLabel = targetLabel;
          state.step = BURN_STATES.AWAIT_CONTEXT;
          await redisDb.setBurnState(userId, state);

          await updateMasterMessage(
            ctx,
            state,
            templates.burnContextPrompt(state.targetLabel),
            burnCancelOnlyKeyboard()
          );
          break;
        }

        // ── Paso 1B: Recibir @Username ──
        case BURN_STATES.AWAIT_USERNAME: {
          const text = ctx.message.text?.trim();
          if (!text) {
            const errUser =
              `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFAS — REPORTE</b>\n\n` +
              `⚠️ Por favor, ingresa el <b>@Username</b> del acusado:`;
            return updateMasterMessage(ctx, state, errUser, burnCancelOnlyKeyboard());
          }

          const cleanUser = text.replace(/^@/, '');
          let targetId = null;
          let targetName = null;

          // 1. Buscar en BD Supabase
          try {
            const dbUser = await db.getUserByUsername(cleanUser);
            if (dbUser && dbUser.user_id) {
              targetId = dbUser.user_id;
              targetName = [dbUser.first_name, dbUser.last_name].filter(Boolean).join(' ') || null;
            }
          } catch {}

          // 2. Intentar resolver vía Userbot MTProto (resuelve CUALQUIER usuario de Telegram sin restricción)
          if (!targetId) {
            try {
              if (userbot.isConnected()) {
                const ubRes = await userbot.resolveUser(cleanUser);
                if (ubRes && ubRes.userId) {
                  targetId = ubRes.userId;
                  const ubName = [ubRes.firstName, ubRes.lastName].filter(Boolean).join(' ');
                  if (ubName) targetName = ubName;
                }
              }
            } catch {}
          }

          // 3. Intentar resolver via Telegram Bot API
          if (!targetId) {
            try {
              const chatInfo = await ctx.api.getChat(`@${cleanUser}`);
              if (chatInfo && chatInfo.id) {
                targetId = chatInfo.id;
                const tgName = [chatInfo.first_name, chatInfo.last_name].filter(Boolean).join(' ');
                if (tgName) targetName = tgName;
              }
            } catch {}
          }

          if (targetId && targetId === userId) {
            const errSelf =
              `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFAS — REPORTE</b>\n\n` +
              `⚠️ No puedes reportarte a ti mismo.\n` +
              `Ingresa el @Username del acusado:`;
            return updateMasterMessage(ctx, state, errSelf, burnCancelOnlyKeyboard());
          }

          const targetLabel = targetId
            ? `@${cleanUser} (<code>${targetId}</code>)`
            : `@${cleanUser}`;

          state.targetId = targetId || 0;
          state.targetUsername = cleanUser;
          state.targetName = targetName;
          state.targetLabel = targetLabel;
          state.step = BURN_STATES.AWAIT_CONTEXT;
          await redisDb.setBurnState(userId, state);

          await updateMasterMessage(
            ctx,
            state,
            templates.burnContextPrompt(state.targetLabel),
            burnCancelOnlyKeyboard()
          );
          break;
        }

        // ── Paso 2: Recibir Descripción de los Hechos ──
        case BURN_STATES.AWAIT_CONTEXT: {
          const text = ctx.message.text?.trim();
          if (!text || text.length < 15) {
            const errLen =
              `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFAS — REPORTE</b>\n\n` +
              `▸ <b>Acusado:</b> ${state.targetLabel}\n\n` +
              `▪ <b>Texto demasiado corto.</b> La descripción debe tener al menos <b>15 caracteres</b>.\n\n` +
              `Describe detalladamente qué sucedió (monto, método de pago, engaño):`;
            return updateMasterMessage(ctx, state, errLen, burnCancelOnlyKeyboard());
          }

          state.context = text.slice(0, 400);
          state.step = BURN_STATES.AWAIT_PROOF;
          await redisDb.setBurnState(userId, state);

          await updateMasterMessage(
            ctx,
            state,
            templates.burnProofPrompt(state.targetLabel, state.context, state.proofs?.length || 0),
            burnProofUploadKeyboard(state.proofs?.length > 0)
          );
          break;
        }

        // ── Paso 3: Recibir Capturas / Fotos de Pruebas ──
        case BURN_STATES.AWAIT_PROOF: {
          let fileId = null;

          if (ctx.message.photo) {
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            fileId = photo.file_id;
          } else if (ctx.message.document && ctx.message.document.mime_type?.startsWith('image/')) {
            fileId = ctx.message.document.file_id;
          }

          if (!fileId) {
            const errPhoto =
              `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFAS — REPORTE</b>\n\n` +
              `▸ <b>Acusado:</b> ${state.targetLabel}\n\n` +
              `▪ Por favor, envía una <b>imagen o captura de pantalla</b> válida.\n` +
              `▸ <b>Capturas subidas:</b> <b>${state.proofs?.length || 0}</b>`;
            return updateMasterMessage(
              ctx,
              state,
              errPhoto,
              burnProofUploadKeyboard(state.proofs?.length > 0)
            );
          }

          if (!state.proofs) state.proofs = [];
          if (!state.proofUrls) state.proofUrls = [];

          state.proofs.push(fileId);

          // Subir a Supabase Storage en segundo plano
          if (supabaseStorage.isEnabled()) {
            try {
              const { buffer, filePath, mimeType } = await downloadTelegramFile(ctx.api, fileId);
              const ext = filePath.split('.').pop() || 'jpg';
              const fileName = `report_${userId}_${Date.now()}_${state.proofs.length}.${ext}`;
              const publicUrl = await supabaseStorage.uploadProof(buffer, fileName, mimeType);
              if (publicUrl) state.proofUrls.push(publicUrl);
            } catch (upErr) {
              console.warn('⟡ Error subiendo captura a Supabase:', upErr.message);
            }
          }

          await redisDb.setBurnState(userId, state);

          await updateMasterMessage(
            ctx,
            state,
            templates.burnProofPrompt(state.targetLabel, state.context, state.proofs.length),
            burnProofUploadKeyboard(true)
          );
          break;
        }

        default:
          return next();
      }
    } catch (err) {
      console.error('⟡ Burn: Error en listener de mensajes:', err.message);
      return next();
    }
  });

  // ── Callback: Revisar Reporte (Resumen Final In-Place) ──
  bot.callbackQuery('burn_review', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const state = await redisDb.getBurnState(userId);

      if (!state || !state.context) {
        return ctx.answerCallbackQuery({
          text: '✗ Faltan datos en tu reporte.',
          show_alert: true,
        });
      }

      const proofCount = state.proofs?.length || 0;
      if (proofCount === 0) {
        return ctx.answerCallbackQuery({
          text: '⚠️ Es obligatorio adjuntar al menos 1 captura de prueba antes de continuar.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery();
      state.step = BURN_STATES.SUMMARY;
      state.masterMessageId = ctx.callbackQuery.message?.message_id || state.masterMessageId;
      await redisDb.setBurnState(userId, state);

      await updateMasterMessage(
        ctx,
        state,
        templates.burnSummaryMessage(state.targetLabel, state.context, proofCount),
        burnSummaryKeyboard()
      );
    } catch (err) {
      console.error('⟡ Burn: Error en burn_review:', err.message);
    }
  });

  // ── Callback: Menú de Edición In-Place ──
  bot.callbackQuery('burn_edit_menu', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = (await redisDb.getBurnState(userId)) || {};

      const editMenuText =
        `${SYM.DIVIDER}\n` +
        `${SYM.DIAMOND} <b>EDICIÓN DEL REPORTE</b> ${SYM.DIAMOND}\n` +
        `${SYM.DIVIDER}\n\n` +
        `Selecciona el dato que deseas modificar:`;

      await updateMasterMessage(ctx, state, editMenuText, burnEditMenuKeyboard());
    } catch (err) {
      console.error('⟡ Burn: Error en burn_edit_menu:', err.message);
    }
  });

  bot.callbackQuery('burn_edit:target', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = (await redisDb.getBurnState(userId)) || {};
      state.step = BURN_STATES.CHOOSE_TYPE;
      await redisDb.setBurnState(userId, state);

      await updateMasterMessage(ctx, state, templates.burnInitialPrompt(), burnTargetTypeKeyboard());
    } catch (err) {
      console.error('⟡ Burn: Error en burn_edit:target:', err.message);
    }
  });

  bot.callbackQuery('burn_edit:context', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = (await redisDb.getBurnState(userId)) || {};
      state.step = BURN_STATES.AWAIT_CONTEXT;
      await redisDb.setBurnState(userId, state);

      await updateMasterMessage(
        ctx,
        state,
        templates.burnContextPrompt(state.targetLabel || 'Acusado'),
        burnCancelOnlyKeyboard()
      );
    } catch (err) {
      console.error('⟡ Burn: Error en burn_edit:context:', err.message);
    }
  });

  bot.callbackQuery('burn_edit:proofs', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = (await redisDb.getBurnState(userId)) || {};
      state.proofs = [];
      state.proofUrls = [];
      state.step = BURN_STATES.AWAIT_PROOF;
      await redisDb.setBurnState(userId, state);

      const resetProofPrompt =
        `${SYM.DIAMOND} <b>REEMPLAZAR CAPTURAS</b>\n\n` +
        `Las capturas anteriores fueron eliminadas.\n` +
        `Envía las nuevas imágenes ahora:\n\n` +
        `▸ <b>Capturas subidas:</b> <b>0</b>`;

      await updateMasterMessage(
        ctx,
        state,
        resetProofPrompt,
        burnProofUploadKeyboard(false)
      );
    } catch (err) {
      console.error('⟡ Burn: Error en burn_edit:proofs:', err.message);
    }
  });

  bot.callbackQuery('burn_edit:back', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = await redisDb.getBurnState(userId);
      if (!state) return;

      state.step = BURN_STATES.SUMMARY;
      await redisDb.setBurnState(userId, state);

      await updateMasterMessage(
        ctx,
        state,
        templates.burnSummaryMessage(state.targetLabel, state.context, state.proofs?.length || 0),
        burnSummaryKeyboard()
      );
    } catch (err) {
      console.error('⟡ Burn: Error en burn_edit:back:', err.message);
    }
  });

  // ── Callback: Quemar (Confirmación Final y Envío al Staff) ──
  bot.callbackQuery('burn_confirm_send', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const state = await redisDb.getBurnState(userId);

      if (!state || !state.targetLabel || !state.context || !state.proofs?.length) {
        return ctx.answerCallbackQuery({
          text: '✗ Faltan datos o no has adjuntado pruebas.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery({ text: '⟡ Enviando reporte al Staff...' });

      const proofUrls = state.proofUrls || [];
      const proofFileIds = state.proofs || [];
      const resolvedTargetId = state.targetId || 0;

      // Guardar en Supabase
      let report;
      try {
        report = await db.createBurnReport(
          userId,
          resolvedTargetId,
          state.context,
          proofFileIds,
          proofUrls,
          state.targetUsername,
          state.targetName
        );
      } catch {
        report = { id: Date.now() };
      }

      // Limpiar estado en Redis
      await redisDb.clearBurnState(userId);

      // Confirmar al usuario en DM actualizando su mensaje maestro
      await updateMasterMessage(ctx, state, templates.burnSentMessage(report.id), undefined);

      // Enviar al canal/hilo de Staff (priorizando configuración del Sub-Bot si existe)
      const burnDestChat = ctx.tenant?.burn_chat_id || config.BURN_CHAT_ID || ctx.tenant?.staff_chat_id || config.STAFF_CHAT_ID;
      const burnDestThread = ctx.tenant?.burn_thread_id || config.BURN_THREAD_ID || (burnDestChat === (ctx.tenant?.staff_chat_id || config.STAFF_CHAT_ID) ? (ctx.tenant?.staff_thread_id || config.STAFF_THREAD_ID) : null);

      if (burnDestChat) {
        const reporterMention = ctx.from.username
          ? `@${ctx.from.username}`
          : `<a href="tg://user?id=${userId}">${ctx.from.first_name || 'Usuario'}</a>`;

        let extraProofUrls = '';
        if (proofUrls.length > 0) {
          extraProofUrls = `\n\n${SYM.STAR} <b>Pruebas en la Nube (${proofUrls.length}):</b>\n`;
          proofUrls.forEach((url, i) => {
            extraProofUrls += `${SYM.BULLET} <a href="${url}">Ver Prueba #${i + 1}</a>\n`;
          });
        }

        const reportCaption = templates.burnStaffReport(
          report.id,
          reporterMention,
          state.targetLabel,
          state.context,
          proofFileIds.length
        ) + extraProofUrls;

        const staffKb = burnStaffKeyboard(report.id);

        if (proofFileIds.length === 1) {
          try {
            await ctx.api.sendPhoto(burnDestChat, proofFileIds[0], {
              caption: reportCaption,
              parse_mode: 'HTML',
              reply_markup: staffKb,
              ...(burnDestThread ? { message_thread_id: burnDestThread } : {}),
            });
          } catch (pErr) {
            console.warn('⟡ Error enviando foto a staff, usando texto:', pErr.message);
            await ctx.api.sendMessage(burnDestChat, reportCaption, {
              parse_mode: 'HTML',
              reply_markup: staffKb,
              ...(burnDestThread ? { message_thread_id: burnDestThread } : {}),
            });
          }
        } else if (proofFileIds.length > 1) {
          const mediaGroup = proofFileIds.slice(0, 10).map((fId) => ({
            type: 'photo',
            media: fId,
          }));

          try {
            await ctx.api.sendMediaGroup(burnDestChat, mediaGroup, {
              ...(burnDestThread ? { message_thread_id: burnDestThread } : {}),
            });
          } catch {}

          await ctx.api.sendMessage(burnDestChat, reportCaption, {
            parse_mode: 'HTML',
            reply_markup: staffKb,
            ...(burnDestThread ? { message_thread_id: burnDestThread } : {}),
          });
        }
      }
    } catch (err) {
      console.error('⟡ Burn: Error en burn_confirm_send:', err.message);
    }
  });

  // ── /banner /canvas (Previsualizar banner de perfil y advertencia) ──
  bot.command(['banner', 'canvas', 'card'], async (ctx) => {
    try {
      const { resolveTarget } = require('../../utils/helpers');
      const { generateProfileCard } = require('../../utils/profileCard');

      let targetUser = await resolveTarget(ctx);

      if (!targetUser || !targetUser.userId) {
        targetUser = {
          userId: ctx.from.id,
          username: ctx.from.username || null,
          firstName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'Usuario',
        };
      }

      const statusMsg = await ctx.reply('⏳ <i>Generando vista previa del banner de perfil...</i>', { parse_mode: 'HTML' });

      let targetName = targetUser.firstName || 'Usuario';
      let targetUsername = targetUser.username || null;
      let avatarBuffer = null;

      try {
        const chatInfo = await ctx.api.getChat(targetUser.userId);
        if (chatInfo) {
          const fullName = [chatInfo.first_name, chatInfo.last_name].filter(Boolean).join(' ');
          if (fullName) targetName = fullName;
          if (chatInfo.username) targetUsername = chatInfo.username;
        }
      } catch {}

      try {
        const userPhotos = await ctx.api.getUserProfilePhotos(targetUser.userId, { limit: 1 });
        if (userPhotos && userPhotos.total_count > 0) {
          const largestPhoto = userPhotos.photos[0][userPhotos.photos[0].length - 1];
          const { buffer } = await downloadTelegramFile(ctx.api, largestPhoto.file_id);
          avatarBuffer = buffer;
        }
      } catch {}

      // Comprobar si es quemado para mostrar banner temático
      let burnInfo = null;
      try {
        burnInfo = await db.getBurnedUserInfo(targetUser.userId) || (targetUsername ? await db.getBurnedUserInfo(targetUsername) : null);
      } catch {}

      const isBurned = !!burnInfo;

      const { generateTelegramProfileModal } = require('../../utils/telegramProfileModal');
      const cardBuffer = await generateTelegramProfileModal({
        name: targetName,
        username: targetUsername,
        id: targetUser.userId,
        bio: isBurned ? `[ LISTA NEGRA ] ${burnInfo.context || 'Estafa comprobada'}` : 'Usuario de la Comunidad Ventas Libres Perú',
        avatarBuffer: avatarBuffer,
        isOnline: !isBurned,
        isBurned: isBurned,
        burnReason: isBurned ? (burnInfo.context || 'Estafa comprobada') : null,
      });

      const cardFile = new InputFile(cardBuffer, 'preview_perfil.png');

      await ctx.replyWithPhoto(cardFile, {
        caption:
          `⟡ <b>FICHA DE IDENTIFICACIÓN</b> ⊱ <code>CANVAS TELEGRAM</code> ⊰\n` +
          `══════\n\n` +
          `▸ <b>Nombre:</b> <b>${escapeHtml(targetName)}</b>\n` +
          (targetUsername ? `▸ <b>Username:</b> @${targetUsername}\n` : '') +
          `▸ <b>ID de Usuario:</b> <code>${targetUser.userId}</code>\n` +
          (isBurned ? `▸ <b>Antecedentes:</b> <b>[ LISTA NEGRA ] ESTAFADOR QUEMADO</b>\n` : '') +
          `──────\n` +
          `▪ <i>Renderizado forense nativo en ultra definición.</i>`,
        parse_mode: 'HTML',
      });

      try {
        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
      } catch {}
    } catch (err) {
      console.error('⟡ Error en /canvas:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al generar el canvas: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Auto-Respuesta a Palabras Clave de Estafa y Reporte en Grupos ──
  const SCAM_PATTERNS = [
    /\b(alguien\s+me\s+estafo|me\s+estafaron|me\s+estafo|fui\s+estafado|me\s+acaban\s+de\s+estafar)\b/i,
    /\b(quiero\s+quemar|quiero\s+reportar|como\s+reporto|como\s+quemo|como\s+quemar|donde\s+reporto|donde\s+quemo|reportar\s+a\s+alguien|para\s+quemar|para\s+reportar|como\s+hago\s+para\s+quemar)\b/i,
    /\b(me\s+robo|me\s+robaron|fui\s+robado|hacer\s+un\s+reporte|iniciar\s+reporte)\b/i,
  ];

  bot.on('message:text', async (ctx, next) => {
    try {
      const text = ctx.message?.text;
      if (!text || ctx.chat.type === 'private' || ctx.from?.is_bot) {
        return next();
      }

      if (text.startsWith('/')) {
        return next();
      }

      const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const matched = SCAM_PATTERNS.some((pattern) => pattern.test(normalized));

      if (matched) {
        const userId = ctx.from.id;
        const chatId = ctx.chat.id;
        const cooldownKey = `scam_reply_cd:${chatId}:${userId}`;

        const inCooldown = await redisDb.getCache(cooldownKey);
        if (!inCooldown) {
          await redisDb.setCache(cooldownKey, true, 60);

          let botUsername = 'ventas_libres_peru_Bot';
          try {
            const botInfo = await ctx.api.getMe();
            botUsername = botInfo.username;
          } catch {}

          const kb = new InlineKeyboard().url(
            'REPORTAR ESTAFA',
            `https://t.me/${botUsername}?start=quemar`
          );

          await ctx.reply(templates.scamKeywordReply(ctx.from.first_name, ctx.from.username), {
            parse_mode: 'HTML',
            reply_to_message_id: ctx.message.message_id,
            reply_markup: kb,
          });
        }
      }
    } catch (err) {
      console.error('⟡ Error en auto-reply de palabras clave de estafa:', err.message);
    }
    return next();
  });
}

module.exports = { register };
