const db = require('../../database/postgres');
const config = require('../../config/env');
const templates = require('../../utils/templates');
const { CB, SYM } = require('../../config/constants');
const { forEachGroup, delay } = require('../../utils/helpers');

// ══════════════════════════════════════════════════════
// ⟡ Módulo 4: Panel de Revisión del Staff
// ══════════════════════════════════════════════════════

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

      await ctx.answerCallbackQuery({ text: '⟡ Procesando...' });

      // 1. Aprobar reporte
      await db.approveBurnReport(reportId, reviewerId);

      // 2. Registrar estafador quemado
      await db.burnUser(report.target_id, report.reporter_id, report.context, reviewerId);

      // 3. Log de moderación
      await db.addModLog('BURN', reviewerId, report.target_id, null, report.context);

      // 4. Ban global en TODOS los grupos registrados
      const groups = await db.getAllGroups();
      const banResults = await forEachGroup(groups, async (group) => {
        await ctx.api.banChatMember(group.chat_id, report.target_id);
      });

      const successCount = banResults.filter(r => r.success).length;
      const failCount = banResults.filter(r => !r.success).length;

      // 5. Broadcast de alerta en todos los grupos
      await delay(500);
      await forEachGroup(groups, async (group) => {
        try {
          await ctx.api.sendMessage(
            group.chat_id,
            templates.burnAlertBroadcast(report.target_id, report.context),
            { parse_mode: 'HTML' }
          );
        } catch {
          // Grupo no accesible
        }
      });

      // 6. Actualizar mensaje del panel
      const reviewerMention = ctx.from.username ? `@${ctx.from.username}` : 'Staff';
      await ctx.editMessageText(
        `${SYM.DIAMOND} <b>REPORTE #${reportId} — APROBADO</b>\n\n` +
        `${SYM.CHECK} Estafador <code>${report.target_id}</code> quemado.\n` +
        `${SYM.ARROW} Baneado de: <b>${successCount}</b> grupos (${failCount} fallos)\n` +
        `${SYM.ARROW} Aprobado por: <b>${reviewerMention}</b>\n` +
        `${SYM.ARROW} Alerta broadcast enviada.`,
        { parse_mode: 'HTML' }
      );

      // 7. Notificar al reportante
      try {
        await ctx.api.sendMessage(
          report.reporter_id,
          `${SYM.DIAMOND} <b>Tu Reporte #${reportId} fue Aprobado</b>\n\n` +
          `${SYM.CHECK} El estafador ha sido baneado permanentemente de todos los grupos oficiales.\n` +
          `${SYM.ARROW} Gracias por mantener segura la comunidad.`,
          { parse_mode: 'HTML' }
        );
      } catch {
        // Reportante no accesible
      }

      // 8. Log al canal del owner
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

      await ctx.answerCallbackQuery({ text: '⟡ Reporte rechazado.' });
      await db.rejectBurnReport(reportId, reviewerId);

      const reviewerMention = ctx.from.username ? `@${ctx.from.username}` : 'Staff';
      await ctx.editMessageText(
        `${SYM.DIAMOND} <b>REPORTE #${reportId} — RECHAZADO</b>\n\n` +
        `${SYM.CROSS} El reporte ha sido rechazado.\n` +
        `${SYM.ARROW} Rechazado por: <b>${reviewerMention}</b>`,
        { parse_mode: 'HTML' }
      );

      // Notificar al reportante
      try {
        await ctx.api.sendMessage(
          report.reporter_id,
          `${SYM.DIAMOND} <b>Tu Reporte #${reportId} fue Rechazado</b>\n\n` +
          `${SYM.CROSS} Tras revisión, el Staff ha determinado que\n` +
          `el reporte no cumple los requisitos.`,
          { parse_mode: 'HTML' }
        );
      } catch {
        // Reportante no accesible
      }
    } catch (err) {
      console.error('⟡ Burn Review: Error en burn_reject:', err.message);
    }
  });

  // ── Callback: Banear Reportante ──
  bot.callbackQuery(/^burn_ban_reporter:(\d+)$/, async (ctx) => {
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
      if (!report) {
        return ctx.answerCallbackQuery({
          text: '✗ Reporte no encontrado.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery({ text: '⟡ Baneando reportante falso...' });

      // Rechazar reporte
      await db.rejectBurnReport(reportId, reviewerId);

      // Ban global del reportante
      const groups = await db.getAllGroups();
      const banResults = await forEachGroup(groups, async (group) => {
        await ctx.api.banChatMember(group.chat_id, report.reporter_id);
      });

      const successCount = banResults.filter(r => r.success).length;

      // Log
      await db.addModLog('BAN_REPORTER', reviewerId, report.reporter_id, null, 'Reporte falso');

      const reviewerMention = ctx.from.username ? `@${ctx.from.username}` : 'Staff';
      await ctx.editMessageText(
        `${SYM.DIAMOND} <b>REPORTE #${reportId} — REPORTANTE BANEADO</b>\n\n` +
        `${SYM.CROSS} Reportante <code>${report.reporter_id}</code> baneado globalmente.\n` +
        `${SYM.ARROW} Baneado de: <b>${successCount}</b> grupos.\n` +
        `${SYM.ARROW} Motivo: Reporte falso.\n` +
        `${SYM.ARROW} Ejecutado por: <b>${reviewerMention}</b>`,
        { parse_mode: 'HTML' }
      );

      // Log al canal del owner
      if (config.LOG_CHANNEL_ID) {
        await ctx.api.sendMessage(
          config.LOG_CHANNEL_ID,
          templates.modLogEntry(
            'BAN_REPORTER',
            reviewerMention,
            report.reporter_id,
            'Global',
            'Reporte falso de /quemar'
          ),
          { parse_mode: 'HTML' }
        );
      }
    } catch (err) {
      console.error('⟡ Burn Review: Error en burn_ban_reporter:', err.message);
    }
  });
}

module.exports = { register };
