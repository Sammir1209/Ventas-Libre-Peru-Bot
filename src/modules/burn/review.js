const db = require('../../database/postgres');
const config = require('../../config/env');
const templates = require('../../utils/templates');
const { CB, SYM } = require('../../config/constants');
const { forEachGroup, delay } = require('../../utils/helpers');
const { escapeHtml } = require('../../utils/formatting');
const { InputFile, InputMediaBuilder } = require('grammy');
const https = require('https');

// ══════════════════════════════════════════════════════
// ⟡ Módulo 4: Panel de Revisión del Staff
// ══════════════════════════════════════════════════════

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
      }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function safeEditStaffMessage(ctx, newText) {
  try {
    await ctx.editMessageCaption({ caption: newText, parse_mode: 'HTML' });
  } catch {
    try {
      await ctx.editMessageText(newText, { parse_mode: 'HTML' });
    } catch {}
  }
}

function register(bot) {
  // ── Callback: Aprobar y Quemar ──
  bot.callbackQuery(/^burn_approve:(\d+)$/, async (ctx) => {
    try {
      const reportId = parseInt(ctx.match[1]);
      const reviewerId = ctx.from.id;

      // Verificar permisos (staff o owner)
      const isOwner = config.OWNER_IDS.includes(reviewerId);
      const staffMember = await db.getStaffMember(reviewerId);
      if (!isOwner && !staffMember) {
        return ctx.answerCallbackQuery({
          text: '✗ No tienes permisos de Staff.',
          show_alert: true,
        });
      }

      // Obtener reporte
      const report = await db.getBurnReport(reportId);
      if (!report) {
        return ctx.answerCallbackQuery({
          text: '✗ Reporte no encontrado.',
          show_alert: true,
        });
      }

      if (report.status !== 'PENDING') {
        return ctx.answerCallbackQuery({
          text: '✗ Este reporte ya fue procesado.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery({ text: '🔥 Procesando baneo y registro oficial...' });

      // 1. Aprobar reporte en base de datos
      await db.approveBurnReport(reportId, reviewerId);

      // 2. Obtener información actualizada del estafador en Telegram
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

        // Registrar estafador quemado
        await db.burnUser(
          report.target_id,
          report.reporter_id,
          report.context,
          reviewerId,
          targetUsername,
          targetName
        );
      }

      // 3. Log de moderación
      await db.addModLog('BURN', reviewerId, report.target_id, null, report.context);

      // 4. Ban global en TODOS los grupos registrados
      const groups = await db.getAllGroups();
      const banResults = await forEachGroup(groups, async (group) => {
        await ctx.api.banChatMember(group.chat_id, report.target_id);
      });

      const successCount = banResults.filter((r) => r.success).length;
      const failCount = banResults.filter((r) => !r.success).length;

      // 5. Broadcast de alerta en todos los grupos oficiales
      await delay(400);
      await forEachGroup(groups, async (group) => {
        try {
          await ctx.api.sendMessage(
            group.chat_id,
            templates.burnAlertBroadcast(report.target_id, report.context),
            { parse_mode: 'HTML' }
          );
        } catch {}
      });

      // 6. Generar Banner Visual y Publicar en Canal Oficial de Quemados
      (async () => {
        try {
          const { generateScammerCard } = require('../../utils/scammerCard');
          const cardBuffer = await generateScammerCard({
            name: targetName,
            username: targetUsername,
            id: report.target_id,
            bio: targetBio,
            avatarBuffer: avatarBuffer,
          });

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

          if (pubChannel) {
            const cardFile = new InputFile(cardBuffer, 'perfil_estafador.png');
            const targetChannelId = Number(pubChannel);

            if (report.proof_file_ids && report.proof_file_ids.length > 0) {
              const media = [
                InputMediaBuilder.photo(cardFile, { caption: publicCaption, parse_mode: 'HTML' }),
                ...report.proof_file_ids.slice(0, 9).map((fId) => InputMediaBuilder.photo(fId)),
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
          }
        } catch (cardErr) {
          console.error('⟡ Error publicando en canal de quemados:', cardErr.message);
        }
      })();

      // 7. Actualizar mensaje del panel en Staff
      const reviewerMention = ctx.from.username ? `@${ctx.from.username}` : 'Staff';
      const staffApprovedText =
        `${SYM.DIVIDER}\n` +
        `🔥 <b>REPORTE #${reportId} — APROBADO Y QUEMADO</b> 🔥\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CHECK} <b>Acusado:</b> <code>${report.target_id}</code> (${escapeHtml(targetName)})\n` +
        `${SYM.ARROW} <b>Grupos Baneados:</b> <b>${successCount}</b> (${failCount} fallos)\n` +
        `${SYM.ARROW} <b>Aprobado por:</b> <b>${reviewerMention}</b>\n` +
        `${SYM.ARROW} <b>Estado:</b> Baneo global y publicación oficial ejecutadas.\n\n` +
        `${SYM.THIN_LINE}`;

      await safeEditStaffMessage(ctx, staffApprovedText);

      // 8. Notificar al reportante en DM
      try {
        await ctx.api.sendMessage(
          report.reporter_id,
          `${SYM.DIVIDER}\n` +
          `${SYM.CHECK} <b>TU REPORTE #${reportId} FUE APROBADO</b>\n` +
          `${SYM.DIVIDER}\n\n` +
          `El usuario ha sido <b>baneado permanentemente</b> de todos los grupos y registrado en la <b>Lista Negra Oficial</b>.\n\n` +
          `<i>Gracias por colaborar en la seguridad de la comunidad. 🇵🇪</i>`,
          { parse_mode: 'HTML' }
        );
      } catch {}

      // 9. Log al canal del owner
      if (config.LOG_CHANNEL_ID) {
        await ctx.api.sendMessage(
          config.LOG_CHANNEL_ID,
          templates.modLogEntry(
            'BURN',
            reviewerMention,
            report.target_id,
            'Global',
            report.context
          ),
          { parse_mode: 'HTML' }
        );
      }
    } catch (err) {
      console.error('⟡ Burn Review: Error en burn_approve:', err.message);
    }
  });

  // ── Callback: Rechazar Reporte ──
  bot.callbackQuery(/^burn_reject:(\d+)$/, async (ctx) => {
    try {
      const reportId = parseInt(ctx.match[1]);
      const reviewerId = ctx.from.id;

      const isOwner = config.OWNER_IDS.includes(reviewerId);
      const staffMember = await db.getStaffMember(reviewerId);
      if (!isOwner && !staffMember) {
        return ctx.answerCallbackQuery({
          text: '✗ No tienes permisos de Staff.',
          show_alert: true,
        });
      }

      const report = await db.getBurnReport(reportId);
      if (!report || report.status !== 'PENDING') {
        return ctx.answerCallbackQuery({
          text: '✗ Reporte no encontrado o ya procesado.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery({ text: 'Reporte rechazado.' });
      await db.rejectBurnReport(reportId, reviewerId);

      const reviewerMention = ctx.from.username ? `@${ctx.from.username}` : 'Staff';
      const staffRejectedText =
        `${SYM.DIVIDER}\n` +
        `✗ <b>REPORTE #${reportId} — RECHAZADO</b> ✗\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CROSS} El reporte ha sido rechazado.\n` +
        `${SYM.ARROW} <b>Revisado por:</b> <b>${reviewerMention}</b>\n` +
        `${SYM.ARROW} <b>Motivo:</b> Pruebas insuficientes o caso no verificado.\n\n` +
        `${SYM.THIN_LINE}`;

      await safeEditStaffMessage(ctx, staffRejectedText);

      // Notificar al reportante
      try {
        await ctx.api.sendMessage(
          report.reporter_id,
          `${SYM.DIVIDER}\n` +
          `${SYM.CROSS} <b>TU REPORTE #${reportId} FUE RECHAZADO</b>\n` +
          `${SYM.DIVIDER}\n\n` +
          `Tras la revisión del Staff, se determinó que las pruebas adjuntas no fueron concluyentes o el caso no cumple los requisitos para sanción global.\n\n` +
          `<i>Si tienes más pruebas, puedes iniciar un nuevo reporte con <code>/quemar</code>.</i>`,
          { parse_mode: 'HTML' }
        );
      } catch {}
    } catch (err) {
      console.error('⟡ Burn Review: Error en burn_reject:', err.message);
    }
  });

  // ── Callback: Banear Reportante Falso ──
  bot.callbackQuery(/^burn_ban_reporter:(\d+)$/, async (ctx) => {
    try {
      const reportId = parseInt(ctx.match[1]);
      const reviewerId = ctx.from.id;

      const isOwner = config.OWNER_IDS.includes(reviewerId);
      if (!isOwner) {
        return ctx.answerCallbackQuery({
          text: '✗ Solo Owners pueden sancionar reportantes.',
          show_alert: true,
        });
      }

      const report = await db.getBurnReport(reportId);
      if (!report) {
        return ctx.answerCallbackQuery({
          text: '✗ Reporte no encontrado.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery({ text: 'Baneando reportante falso...' });

      // Rechazar reporte
      await db.rejectBurnReport(reportId, reviewerId);

      // Ban global del reportante
      const groups = await db.getAllGroups();
      const banResults = await forEachGroup(groups, async (group) => {
        await ctx.api.banChatMember(group.chat_id, report.reporter_id);
      });

      const successCount = banResults.filter((r) => r.success).length;

      // Registrar en Lista Negra
      await db.burnUser(
        report.reporter_id,
        reviewerId,
        'Reporte falso / Intento de desprestigio malicioso',
        reviewerId
      );

      // Log
      await db.addModLog('BAN_REPORTER', reviewerId, report.reporter_id, null, 'Reporte falso');

      const reviewerMention = ctx.from.username ? `@${ctx.from.username}` : 'Staff';
      const staffBanText =
        `${SYM.DIVIDER}\n` +
        `🚨 <b>REPORTE #${reportId} — REPORTANTE BANEADO</b> 🚨\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CROSS} Reportante <code>${report.reporter_id}</code> baneado globalmente.\n` +
        `${SYM.ARROW} <b>Grupos Baneados:</b> <b>${successCount}</b>\n` +
        `${SYM.ARROW} <b>Motivo:</b> Reporte falso / acusación maliciosa.\n` +
        `${SYM.ARROW} <b>Ejecutado por:</b> <b>${reviewerMention}</b>\n\n` +
        `${SYM.THIN_LINE}`;

      await safeEditStaffMessage(ctx, staffBanText);
    } catch (err) {
      console.error('⟡ Burn Review: Error en burn_ban_reporter:', err.message);
    }
  });
}

module.exports = { register };
