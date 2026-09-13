const db = require('../../database/postgres');
const config = require('../../config/env');
const templates = require('../../utils/templates');
const { CB, SYM } = require('../../config/constants');
const { forEachGroup, delay } = require('../../utils/helpers');
const { escapeHtml } = require('../../utils/formatting');
const { InputFile, InputMediaBuilder } = require('grammy');
const https = require('https');
const { publishBurnAlert, extractTargetInfo } = require('./publisher');

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

      // 2. Extraer metadatos del acusado
      const { targetId, targetUsername, targetName, cleanContext } = extractTargetInfo(report);

      let successCount = 0;
      let failCount = 0;

      // 3. Ban global en TODOS los grupos registrados si existe ID numérico
      if (targetId && targetId > 0) {
        const groups = await db.getAllGroups();
        const banResults = await forEachGroup(groups, async (group) => {
          await ctx.api.banChatMember(group.chat_id, targetId);
        });
        successCount = banResults.filter((r) => r.success).length;
        failCount = banResults.filter((r) => !r.success).length;

        // Registrar en base de datos de estafadores
        await db.burnUser(
          targetId,
          report.reporter_id,
          cleanContext,
          reviewerId,
          targetUsername,
          targetName
        );
        await db.addModLog('BURN', reviewerId, targetId, null, cleanContext);
      } else {
        await db.addModLog('BURN', reviewerId, 0, null, `${targetUsername ? `[@${targetUsername}] ` : ''}${cleanContext}`);
      }

      // 4. Publicar la alerta visual con Banner Modal y álbum de pruebas en TODOS los canales y grupos oficiales
      let pubResult = { broadcastCount: 0, displayName: targetName || (targetUsername ? `@${targetUsername}` : 'Estafador') };
      try {
        pubResult = await publishBurnAlert(ctx.api, report);
      } catch (pubErr) {
        console.error('⟡ Error en broadcast de quemado:', pubErr.message);
      }

      // 5. Actualizar mensaje del panel en Staff
      const reviewerMention = ctx.from.username ? `@${ctx.from.username}` : 'Staff';
      const staffApprovedText =
        `${SYM.DIVIDER}\n` +
        `🔥 <b>REPORTE #${reportId} — APROBADO Y QUEMADO</b> 🔥\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CHECK} <b>Acusado:</b> <b>${escapeHtml(pubResult.displayName)}</b>\n` +
        (pubResult.targetUsername ? `🔗 <b>Username:</b> @${pubResult.targetUsername}\n` : '') +
        (pubResult.targetId && pubResult.targetId > 0
          ? `🆔 <b>ID Telegram:</b> <code>${pubResult.targetId}</code>\n`
          : `🆔 <b>ID Telegram:</b> <i>Identificado por @alias oficial</i>\n`) +
        `${SYM.ARROW} <b>Grupos Baneados:</b> <b>${successCount}</b>\n` +
        `📢 <b>Difusión:</b> Publicado en <b>${pubResult.broadcastCount}</b> canales y grupos\n` +
        `${SYM.ARROW} <b>Aprobado por:</b> <b>${reviewerMention}</b>\n\n` +
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

  // ── Comandos para Owners: Re-publicar reportes de estafadores con formato completo ──
  bot.command('republicar_quemado', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const isOwner = (config.OWNER_IDS || []).includes(userId);
      if (!isOwner) return ctx.reply('✗ Comando exclusivo para Owners.');

      const args = ctx.message.text.trim().split(/\s+/);
      const reportId = parseInt(args[1]);
      if (!reportId) return ctx.reply('ℹ️ Uso: <code>/republicar_quemado [id]</code>\nEjemplo: <code>/republicar_quemado 7</code>', { parse_mode: 'HTML' });

      const report = await db.getBurnReport(reportId);
      if (!report) return ctx.reply(`✗ Reporte #${reportId} no encontrado en la base de datos.`);

      const statusMsg = await ctx.reply(`⏳ Re-publicando Reporte #${reportId} con diseño de perfil y pruebas en todos los canales y grupos...`);
      const res = await publishBurnAlert(ctx.api, report);

      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `✓ <b>Reporte #${reportId} re-publicado exitosamente</b>\n\n` +
        `👤 <b>Acusado:</b> <b>${escapeHtml(res.displayName)}</b>\n` +
        (res.targetUsername ? `🔗 <b>Username:</b> @${res.targetUsername}\n` : '') +
        (res.targetId && res.targetId > 0
          ? `🆔 <b>ID Telegram:</b> <code>${res.targetId}</code>\n`
          : `🆔 <b>ID Telegram:</b> <i>Identificado por Alias (@${res.targetUsername || 'estafador'})</i>\n`) +
        `📢 <b>Difusión:</b> Publicado en <b>${res.broadcastCount}</b> grupos y canales oficiales.\n\n` +
        `🛡️ <i>Ventas Libres Perú</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /republicar_quemado:', err.message);
      ctx.reply(`✗ Error al re-publicar: ${err.message}`);
    }
  });

  bot.command('republicar_quemados', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const isOwner = (config.OWNER_IDS || []).includes(userId);
      if (!isOwner) return ctx.reply('✗ Comando exclusivo para Owners.');

      const statusMsg = await ctx.reply('⏳ Re-publicando todos los reportes de estafadores (#6 y #7)...');
      const rep6 = await db.getBurnReport(6);
      const rep7 = await db.getBurnReport(7);

      let totalPublished = 0;
      if (rep6) {
        await publishBurnAlert(ctx.api, rep6);
        totalPublished++;
      }
      if (rep7) {
        await publishBurnAlert(ctx.api, rep7);
        totalPublished++;
      }

      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `✓ <b>${totalPublished} reportes quemados (#6 y #7) re-publicados con éxito con modal y pruebas en todos los grupos y canales oficiales.</b>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      ctx.reply(`✗ Error al re-publicar quemados: ${err.message}`);
    }
  });
}

module.exports = { register };
