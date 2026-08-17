const redisDb = require('../../database/redis');
const db = require('../../database/postgres');
const supabaseStorage = require('../../database/supabase');
const config = require('../../config/env');
const templates = require('../../utils/templates');
const { escapeHtml } = require('../../utils/formatting');
const { CB, SYM } = require('../../config/constants');
const {
  burnTargetTypeKeyboard,
  burnProofUploadKeyboard,
  burnSummaryKeyboard,
  burnEditMenuKeyboard,
  burnStaffKeyboard,
} = require('./keyboard');
const { InlineKeyboard, InputFile, InputMediaBuilder } = require('grammy');
const https = require('https');

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
          `${SYM.DIVIDER}\n` +
          `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFADORES (/QUEMAR)</b> ${SYM.DIAMOND}\n` +
          `${SYM.DIVIDER}\n\n` +
          `${SYM.ARROW} Por motivos de <b>seguridad y confidencialidad</b>, los reportes de estafa se realizan <b>exclusivamente por mensaje privado (DM)</b> con el bot.\n\n` +
          `${SYM.THIN_LINE}\n` +
          `${SYM.STAR} Pulsa el botón de abajo para iniciar tu reporte de forma segura:`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard().url(
              `${SYM.DIAMOND} Iniciar Reporte en Privado`,
              `https://t.me/${botUsername}?start=quemar`
            ).primary(),
          }
        );
      }

      const userId = ctx.from.id;

      // Iniciar estado en Redis
      await redisDb.setBurnState(userId, {
        step: BURN_STATES.CHOOSE_TYPE,
        targetId: null,
        targetUsername: null,
        targetLabel: null,
        context: null,
        proofs: [],
        proofUrls: [],
      });

      await ctx.reply(templates.burnInitialPrompt(), {
        parse_mode: 'HTML',
        reply_markup: burnTargetTypeKeyboard(),
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
      await redisDb.setBurnState(userId, state);

      await ctx.editMessageText(templates.burnAskIdPrompt(), {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text(`${SYM.CROSS} Cancelar`, 'burn_cancel').danger(),
      });
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
      await redisDb.setBurnState(userId, state);

      await ctx.editMessageText(templates.burnAskUsernamePrompt(), {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text(`${SYM.CROSS} Cancelar`, 'burn_cancel').danger(),
      });
    } catch (err) {
      console.error('⟡ Burn: Error en burn_type:username:', err.message);
    }
  });

  // ── Cancelar Reporte ──
  bot.callbackQuery('burn_cancel', async (ctx) => {
    try {
      const userId = ctx.from.id;
      await redisDb.clearBurnState(userId);
      await ctx.answerCallbackQuery({ text: 'Reporte cancelado.' });
      await ctx.editMessageText(
        `${SYM.DIVIDER}\n` +
        `${SYM.CROSS} <b>REPORTE CANCELADO</b> ${SYM.CROSS}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.STAR} La operación fue cancelada. Puedes iniciar una nueva en cualquier momento con <code>/quemar</code>.`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Burn: Error en burn_cancel:', err.message);
    }
  });

  // ── Listener de Mensajes de Texto y Fotos (Flujo Conversacional) ──
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

    try {
      switch (state.step) {
        // ── Paso 1A: Recibir ID Numérico ──
        case BURN_STATES.AWAIT_ID: {
          const text = ctx.message.text?.trim();
          if (!text || !/^\d+$/.test(text)) {
            return ctx.reply(
              `${SYM.CROSS} El ID debe contener <b>únicamente números</b>.\n` +
              `<i>Ejemplo: <code>8579513055</code></i>`,
              { parse_mode: 'HTML' }
            );
          }

          const targetId = parseInt(text);
          if (targetId === userId) {
            return ctx.reply(`${SYM.CROSS} No puedes reportarte a ti mismo.`, { parse_mode: 'HTML' });
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
            : (targetName ? `<code>${targetId}</code> (${targetName})` : `<code>${targetId}</code>`);

          state.targetId = targetId;
          state.targetUsername = targetUsername;
          state.targetName = targetName;
          state.targetLabel = targetLabel;
          state.step = BURN_STATES.AWAIT_CONTEXT;
          await redisDb.setBurnState(userId, state);

          await ctx.reply(templates.burnContextPrompt(state.targetLabel), {
            parse_mode: 'HTML',
          });
          break;
        }

        // ── Paso 1B: Recibir @Username ──
        case BURN_STATES.AWAIT_USERNAME: {
          const text = ctx.message.text?.trim();
          if (!text) {
            return ctx.reply(`${SYM.CROSS} Por favor, ingresa el <b>@Username</b> del acusado.`, { parse_mode: 'HTML' });
          }

          const cleanUser = text.replace(/^@/, '');
          let targetId = null;
          let targetName = null;

          // Buscar en BD Supabase
          try {
            const dbUser = await db.getUserByUsername(cleanUser);
            if (dbUser && dbUser.user_id) {
              targetId = dbUser.user_id;
              targetName = [dbUser.first_name, dbUser.last_name].filter(Boolean).join(' ') || null;
            }
          } catch {}

          // Intentar resolver via Telegram API
          try {
            const chatInfo = await ctx.api.getChat(`@${cleanUser}`);
            if (chatInfo && chatInfo.id) {
              targetId = chatInfo.id;
              const tgName = [chatInfo.first_name, chatInfo.last_name].filter(Boolean).join(' ');
              if (tgName) targetName = tgName;
            }
          } catch {}

          if (targetId && targetId === userId) {
            return ctx.reply(`${SYM.CROSS} No puedes reportarte a ti mismo.`, { parse_mode: 'HTML' });
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

          await ctx.reply(templates.burnContextPrompt(state.targetLabel), {
            parse_mode: 'HTML',
          });
          break;
        }

        // ── Paso 2: Recibir Descripción de los Hechos ──
        case BURN_STATES.AWAIT_CONTEXT: {
          const text = ctx.message.text?.trim();
          if (!text || text.length < 15) {
            return ctx.reply(
              `${SYM.CROSS} La descripción debe tener al menos <b>15 caracteres</b>.\n` +
              `${SYM.ARROW} Por favor, explica lo sucedido con claridad.`,
              { parse_mode: 'HTML' }
            );
          }

          state.context = text;
          state.step = BURN_STATES.AWAIT_PROOF;
          await redisDb.setBurnState(userId, state);

          await ctx.reply(templates.burnProofPrompt(state.targetLabel, state.proofs?.length || 0), {
            parse_mode: 'HTML',
            reply_markup: burnProofUploadKeyboard(),
          });
          break;
        }

        // ── Paso 3: Recibir Capturas / Fotos de Pruebas ──
        case BURN_STATES.AWAIT_PROOF: {
          let fileId = null;

          if (ctx.message.photo) {
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            fileId = photo.file_id;
          } else if (ctx.message.document) {
            fileId = ctx.message.document.file_id;
          }

          if (!fileId) {
            return ctx.reply(
              `${SYM.CROSS} Debes enviar una <b>imagen / captura de pantalla</b>.\n` +
              `» Cuando termines de enviar todas tus capturas, presiona el botón <b>[ Listo, revisar reporte ]</b>.`,
              {
                parse_mode: 'HTML',
                reply_markup: burnProofUploadKeyboard(),
              }
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

          await ctx.reply(
            `${SYM.CHECK} <b>Captura #${state.proofs.length} recibida con éxito ✓</b>\n\n` +
            `${SYM.ARROW} Puedes enviar más capturas o presionar <b>[ Listo, revisar reporte ]</b>.`,
            {
              parse_mode: 'HTML',
              reply_markup: burnProofUploadKeyboard(),
            }
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

  // ── Callback: Revisar Reporte (Genera el Resumen con botones Editar, Cancelar, Quemar) ──
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

      // Validar que tenga al menos 1 prueba
      const proofCount = state.proofs?.length || 0;
      if (proofCount === 0) {
        return ctx.answerCallbackQuery({
          text: '⚠️ Es obligatorio adjuntar al menos 1 imagen o captura de prueba antes de continuar.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery();
      state.step = BURN_STATES.SUMMARY;
      await redisDb.setBurnState(userId, state);

      await ctx.reply(
        templates.burnSummaryMessage(state.targetLabel, state.context, proofCount),
        {
          parse_mode: 'HTML',
          reply_markup: burnSummaryKeyboard(),
        }
      );
    } catch (err) {
      console.error('⟡ Burn: Error en burn_review:', err.message);
    }
  });

  // ── Callback: Menú de Edición ──
  bot.callbackQuery('burn_edit_menu', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        `${SYM.DIVIDER}\n` +
        `${SYM.DIAMOND} <b>MENÚ DE EDICIÓN DEL REPORTE</b> ${SYM.DIAMOND}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.STAR} ¿Qué campo deseas modificar?`,
        {
          parse_mode: 'HTML',
          reply_markup: burnEditMenuKeyboard(),
        }
      );
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

      await ctx.editMessageText(
        `${SYM.DIVIDER}\n` +
        `${SYM.DIAMOND} <b>EDITAR ACUSADO</b> ${SYM.DIAMOND}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.STAR} Selecciona el nuevo método de identificación:`,
        {
          parse_mode: 'HTML',
          reply_markup: burnTargetTypeKeyboard(),
        }
      );
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

      await ctx.editMessageText(templates.burnContextPrompt(state.targetLabel || 'Acusado'), {
        parse_mode: 'HTML',
      });
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

      await ctx.editMessageText(
        `${SYM.DIVIDER}\n` +
        `${SYM.DIAMOND} <b>REEMPLAZAR PRUEBAS</b> ${SYM.DIAMOND}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.STAR} Las capturas anteriores fueron borradas.\n` +
        `${SYM.ARROW} Envía las nuevas imágenes o capturas ahora:`,
        {
          parse_mode: 'HTML',
          reply_markup: burnProofUploadKeyboard(),
        }
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

      await ctx.editMessageText(
        templates.burnSummaryMessage(state.targetLabel, state.context, state.proofs?.length || 0),
        {
          parse_mode: 'HTML',
          reply_markup: burnSummaryKeyboard(),
        }
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

      await ctx.answerCallbackQuery({ text: '🔥 Enviando reporte al Staff...' });

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
          proofUrls
        );
      } catch {
        report = { id: Date.now() };
      }

      // Limpiar estado
      await redisDb.clearBurnState(userId);

      // Confirmar al usuario en DM
      await ctx.editMessageText(templates.burnSentMessage(), { parse_mode: 'HTML' });

      // Enviar al canal/hilo de Staff / Quemar
      const burnDestChat = config.BURN_CHAT_ID || config.STAFF_CHAT_ID;
      const burnDestThread = config.BURN_THREAD_ID || (burnDestChat === config.STAFF_CHAT_ID ? config.STAFF_THREAD_ID : null);

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

        const reportCaption = templates.burnStaffReport(report.id, reporterMention, state.targetLabel, state.context) + extraProofUrls;
        const staffKb = burnStaffKeyboard(report.id);

        // Envío Inteligente: Si hay 1 sola captura, enviamos 1 ÚNICO mensaje fotográfico con caption y botones
        if (proofFileIds.length === 1) {
          try {
            await ctx.api.sendPhoto(burnDestChat, proofFileIds[0], {
              caption: reportCaption,
              parse_mode: 'HTML',
              reply_markup: staffKb,
              ...(burnDestThread ? { message_thread_id: burnDestThread } : {}),
            });
          } catch (pErr) {
            console.warn('⟡ Error enviando foto con caption a staff, usando texto:', pErr.message);
            await ctx.api.sendMessage(burnDestChat, reportCaption, {
              parse_mode: 'HTML',
              reply_markup: staffKb,
              ...(burnDestThread ? { message_thread_id: burnDestThread } : {}),
            });
          }
        } else if (proofFileIds.length > 1) {
          // Si hay varias capturas, enviamos el álbum primero y el panel de control abajo
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

  // ── Callbacks de Moderación para el Staff ──
  bot.callbackQuery(/^burn_approve:(\d+)$/, async (ctx) => {
    try {
      const reportId = parseInt(ctx.match[1]);
      const reviewerId = ctx.from.id;

      // Verificar que sea Staff u Owner
      const isOwner = config.OWNER_IDS.includes(reviewerId);
      const staffMember = await db.getStaffMember(reviewerId);
      if (!isOwner && !staffMember) {
        return ctx.answerCallbackQuery({ text: '✗ No tienes permisos.', show_alert: true });
      }

      await ctx.answerCallbackQuery({ text: '🔥 Aprobando reporte y quemando estafador...' });

      const report = await db.getBurnReport(reportId);
      if (!report || report.status !== 'PENDING') {
        return ctx.editMessageText('⚠️ Este reporte ya fue procesado.', { parse_mode: 'HTML' });
      }

      await db.updateBurnReportStatus(reportId, 'APPROVED', reviewerId);

      // ── Generar Banner Visual de Perfil del Estafador y Publicar ──
      (async () => {
        try {
          let targetName = 'Estafador';
          let targetUsername = null;
          let targetBio = null;
          let avatarBuffer = null;

          if (report.target_id) {
            try {
              const chatInfo = await ctx.api.getChat(report.target_id);
              targetName = [chatInfo.first_name, chatInfo.last_name].filter(Boolean).join(' ') || 'Estafador';
              targetUsername = chatInfo.username || null;
              targetBio = chatInfo.bio || null;
            } catch {}

            try {
              const userPhotos = await ctx.api.getUserProfilePhotos(report.target_id, { limit: 1 });
              if (userPhotos && userPhotos.total_count > 0) {
                const largestPhoto = userPhotos.photos[0][userPhotos.photos[0].length - 1];
                const { buffer } = await downloadTelegramFile(ctx.api, largestPhoto.file_id);
                avatarBuffer = buffer;
              }
            } catch {}

            // Guardar en burned_users con username y nombre
            await db.burnUser(report.target_id, report.reporter_id, report.context, reviewerId, targetUsername, targetName);
          }

          // Generar Tarjeta Visual de Perfil
          const { generateScammerCard } = require('../../utils/scammerCard');
          const cardBuffer = await generateScammerCard({
            name: targetName,
            username: targetUsername,
            id: report.target_id,
            bio: targetBio,
            avatarBuffer: avatarBuffer,
          });

          // Texto de Publicación Oficial
          const publicCaption =
            `${SYM.DIVIDER}\n` +
            `🚨 <b>NUEVO ESTAFADOR QUEMADO Y REGISTRADO</b> 🚨\n` +
            `${SYM.DIVIDER}\n\n` +
            `👤 <b>Nombre:</b> <b>${escapeHtml(targetName)}</b>\n` +
            (targetUsername ? `🔗 <b>Username:</b> @${targetUsername}\n` : '') +
            `🆔 <b>ID de Telegram:</b> <code>${report.target_id}</code>\n\n` +
            `📝 <b>Motivo / Hechos:</b>\n` +
            `<i>${escapeHtml(report.context || 'Estafa comprobada')}</i>\n\n` +
            `${SYM.THIN_LINE}\n` +
            `⚖️ <b>Sanción:</b> Baneo Permanente y Registro en Lista Negra Oficial.\n` +
            `🛡️ <i>Ventas Libres Perú — Tu seguridad es nuestra prioridad.</i>`;

          let pubChannel = config.PUBLIC_BURN_CHANNEL_ID;
          let pubThread = config.PUBLIC_BURN_THREAD_ID;

          if (!pubChannel) {
            try {
              const savedChan = await db.getSetting('public_burn_channel_id');
              if (savedChan) pubChannel = Number(savedChan);
              const savedTh = await db.getSetting('public_burn_thread_id');
              if (savedTh) pubThread = Number(savedTh);
            } catch {}
          }

          // Publicar en Canal Oficial de Quemados
          if (pubChannel) {
            try {
              const cardFile = new InputFile(cardBuffer, 'perfil_estafador.png');
              const targetChannelId = Number(pubChannel);

              if (report.proof_file_ids && report.proof_file_ids.length > 0) {
                const media = [
                  InputMediaBuilder.photo(cardFile, { caption: publicCaption, parse_mode: 'HTML' }),
                  ...report.proof_file_ids.slice(0, 9).map(fId => InputMediaBuilder.photo(fId)),
                ];

                await ctx.api.sendMediaGroup(targetChannelId, media, {
                  ...(pubThread ? { message_thread_id: Number(pubThread) } : {}),
                });
              } else {
                await ctx.api.sendPhoto(targetChannelId, cardFile, {
                  caption: publicCaption,
                  parse_mode: 'HTML',
                  ...(pubThread ? { message_thread_id: Number(pubThread) } : {}),
                });
              }
              console.log(`✓ Reporte #${reportId} publicado con Banner de Perfil en canal oficial de quemados (${pubChannel}).`);
            } catch (pubErr) {
              console.warn('⟡ Error publicando en canal de quemados:', pubErr.message);
            }
          }
        } catch (cardErr) {
          console.error('⟡ Error en background scammer card generator:', cardErr.message);
        }
      })();

      const approvedBanner =
        `${SYM.DIVIDER}\n` +
        `🔥 <b>ESTAFADOR QUEMADO Y REGISTRADO EN LISTA NEGRA</b> 🔥\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CHECK} <b>Reporte:</b> #${reportId}\n` +
        `${SYM.CHECK} <b>Aprobado por:</b> @${ctx.from.username || ctx.from.first_name}\n` +
        `${SYM.ARROW} <b>Estado:</b> Baneo global, banner de perfil generado y publicado en el canal oficial.\n\n` +
        `${SYM.THIN_LINE}`;

      try {
        await ctx.editMessageCaption({ caption: approvedBanner, parse_mode: 'HTML' });
      } catch {
        try {
          await ctx.editMessageText(approvedBanner, { parse_mode: 'HTML' });
        } catch {}
      }
    } catch (err) {
      console.error('⟡ Error en burn_approve:', err.message);
    }
  });

  bot.callbackQuery(/^burn_reject:(\d+)$/, async (ctx) => {
    try {
      const reportId = parseInt(ctx.match[1]);
      const reviewerId = ctx.from.id;

      const isOwner = config.OWNER_IDS.includes(reviewerId);
      const staffMember = await db.getStaffMember(reviewerId);
      if (!isOwner && !staffMember) {
        return ctx.answerCallbackQuery({ text: '✗ No tienes permisos.', show_alert: true });
      }

      await ctx.answerCallbackQuery({ text: 'Reporte rechazado.' });
      await db.updateBurnReportStatus(reportId, 'REJECTED', reviewerId);

      const rejectedBanner =
        `${SYM.DIVIDER}\n` +
        `✗ <b>REPORTE DE ESTAFA RECHAZADO</b> ✗\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.ARROW} <b>Reporte:</b> #${reportId}\n` +
        `${SYM.ARROW} <b>Revisado por:</b> @${ctx.from.username || ctx.from.first_name}\n` +
        `${SYM.ARROW} <b>Motivo:</b> Pruebas insuficientes o caso no verificado.\n\n` +
        `${SYM.THIN_LINE}`;

      try {
        await ctx.editMessageCaption({ caption: rejectedBanner, parse_mode: 'HTML' });
      } catch {
        try {
          await ctx.editMessageText(rejectedBanner, { parse_mode: 'HTML' });
        } catch {}
      }
    } catch (err) {
      console.error('⟡ Error en burn_reject:', err.message);
    }
  });

  bot.callbackQuery(/^burn_ban_reporter:(\d+)$/, async (ctx) => {
    try {
      const reportId = parseInt(ctx.match[1]);
      const reviewerId = ctx.from.id;

      const isOwner = config.OWNER_IDS.includes(reviewerId);
      if (!isOwner) {
        return ctx.answerCallbackQuery({ text: '✗ Solo Owners pueden sancionar reportantes.', show_alert: true });
      }

      const report = await db.getBurnReport(reportId);
      if (!report) return ctx.answerCallbackQuery({ text: 'Reporte no encontrado.' });

      await db.updateBurnReportStatus(reportId, 'REJECTED', reviewerId);
      await db.burnUser(report.reporter_id, reviewerId, 'Falso reporte / intento de desprestigio', reviewerId);

      await ctx.answerCallbackQuery({ text: 'Reportante sancionado y quemado.' });
      const bannedBanner = `⚠️ <b>Reportante sancionado por reporte falso.</b>`;
      try {
        await ctx.editMessageCaption({ caption: bannedBanner, parse_mode: 'HTML' });
      } catch {
        try {
          await ctx.editMessageText(bannedBanner, { parse_mode: 'HTML' });
        } catch {}
      }
    } catch (err) {
      console.error('⟡ Error en burn_ban_reporter:', err.message);
    }
  });

  // ── /banner [ID / @username / Responder] (Previsualizar banner de prueba de estafador) ──
  bot.command(['banner', 'canvas', 'card', 'perfil'], async (ctx) => {
    try {
      const { resolveTarget } = require('../../utils/helpers');
      const { generateScammerCard } = require('../../utils/scammerCard');

      let targetUser = await resolveTarget(ctx);

      // Si no especificó argumento ni respondió, usar el propio usuario que ejecutó el comando
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
      let targetBio = null;
      let avatarBuffer = null;

      try {
        const chatInfo = await ctx.api.getChat(targetUser.userId);
        if (chatInfo) {
          const fullName = [chatInfo.first_name, chatInfo.last_name].filter(Boolean).join(' ');
          if (fullName) targetName = fullName;
          if (chatInfo.username) targetUsername = chatInfo.username;
          if (chatInfo.bio) targetBio = chatInfo.bio;
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

      const cardBuffer = await generateScammerCard({
        name: targetName,
        username: targetUsername,
        id: targetUser.userId,
        bio: targetBio,
        avatarBuffer: avatarBuffer,
      });

      const cardFile = new InputFile(cardBuffer, 'preview_perfil.png');

      await ctx.replyWithPhoto(cardFile, {
        caption:
          `🖼️ <b>VISTA PREVIA DEL BANNER DE PERFIL</b>\n\n` +
          `👤 <b>Usuario:</b> <b>${escapeHtml(targetName)}</b>\n` +
          (targetUsername ? `🔗 <b>Username:</b> @${targetUsername}\n` : '') +
          `🆔 <b>ID:</b> <code>${targetUser.userId}</code>\n` +
          (targetBio ? `📝 <b>Bio:</b> <i>${escapeHtml(targetBio)}</i>\n` : '') +
          `\n${SYM.STAR} <i>Este es el formato exacto con el que se publica en el canal oficial de quemados.</i>`,
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

      // Si es un comando (/...), dejar que lo manejen los handlers de comandos
      if (text.startsWith('/')) {
        return next();
      }

      // Normalizar texto sin acentos para coincidencia precisa
      const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

      const matched = SCAM_PATTERNS.some((pattern) => pattern.test(normalized));
      if (matched) {
        const userId = ctx.from.id;
        const chatId = ctx.chat.id;
        const cooldownKey = `scam_reply_cd:${chatId}:${userId}`;

        // Cooldown de 60 segundos por usuario en el grupo para evitar saturación
        const inCooldown = await redisDb.getCache(cooldownKey);
        if (!inCooldown) {
          await redisDb.setCache(cooldownKey, true, 60);

          let botUsername = 'ventas_libres_peru_Bot';
          try {
            const botInfo = await ctx.api.getMe();
            botUsername = botInfo.username;
          } catch {}

          const kb = new InlineKeyboard().url(
            `🚨 Iniciar Reporte Anti-Estafa`,
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
