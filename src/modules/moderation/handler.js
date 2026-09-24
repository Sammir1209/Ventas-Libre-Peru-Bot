const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const { requireStaff } = require('../../middleware/auth');
const { isEffectiveOwner } = require('../../utils/tenantContext');
const { mentionFromData, staffMention, formatId, escapeHtml, getSuperscriptDate } = require('../../utils/formatting');
const { toMathBold } = require('../../utils/aesthetic');
const { InlineKeyboard } = require('grammy');
const logger = require('./logger');
const sentinel = require('./sentinel');
const { resolveTargetAndArgs, parseDuration } = sentinel;
const muteUI = require('./muteUI');
const dynamicBlacklist = require('./dynamicBlacklist');
const scamAutoResponder = require('./scamAutoResponder');
const profileImageScanner = require('./profileImageScanner');
const dataHandler = require('./dataHandler');

// ══════
// ⟡ Módulo: Comandos de Moderación Universal y Seguridad
// ══════

function register(bot) {
  // Registrar subsistema Centinela
  sentinel.register(bot);

  // Registrar panel rápido /data
  dataHandler.register(bot);

  // Registrar Lista Negra Dinámica & Reactive Defense
  dynamicBlacklist.register(bot);

  // Registrar Auto-Respuestas Preventivas de Estafadores
  scamAutoResponder.register(bot);

  // Registrar Scanner Visual de Perfiles por Imagen
  profileImageScanner.register(bot);

  // ── 🛡️ CAPA 2 BLACKLIST DINÁMICO: Interceptor en Tiempo Real de Mensajes ──
  bot.on('message', async (ctx, next) => {
    try {
      if (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group') {
        const sender = ctx.from;
        if (sender) {
          // 1. Blacklist Dinámico
          const isBurned = await db.isUserBurned(sender.id, sender.username);
          if (isBurned) {
            console.warn(`🚨 [BLACKLIST DINÁMICO] Mensaje interceptado de estafador: ${sender.id} (@${sender.username}) en ${ctx.chat.id}`);
            try {
              await ctx.deleteMessage();
            } catch {}
            try {
              await ctx.api.banChatMember(ctx.chat.id, sender.id);
            } catch {}
            return; // Cortar el flujo
          }

          // 2. Anti-Impersonator en Tiempo Real
          try {
            const { checkImpersonation, handleImpersonator } = require('./antiImpersonator');
            const cloneDetection = await checkImpersonation(sender, ctx.api);
            if (cloneDetection) {
              try {
                await ctx.deleteMessage();
              } catch {}
              await handleImpersonator(ctx, ctx.chat, sender, cloneDetection);
              return;
            }
          } catch (impErr) {
            console.error('⟡ Error en checkImpersonation en mensaje:', impErr.message);
          }
        }
      }
    } catch {}
    return next();
  });

  // ── /ban [@user / ID / Responder] [Motivo] ──
  bot.command('ban', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`${SYM.CROSS} Este comando solo funciona en grupos o comunidades.`, { parse_mode: 'HTML' });
      }

      const { target, reason, error } = await resolveTargetAndArgs(ctx, { hasDuration: false });

      if (!target || target.unresolved) {
        return ctx.reply(
          `${SYM.DIAMOND} <b>Uso:</b> <code>/ban [@usuario / ID / Responder] [Motivo]</code>\n\n` +
          `Ejemplos:\n` +
          `• <code>/ban @usuario Spam masivo</code>\n` +
          `• <code>/ban 12345678 Conducta inapropiada</code>\n` +
          `• Respondiendo a un mensaje: <code>/ban Estafador</code>`,
          { parse_mode: 'HTML' }
        );
      }

      if (isEffectiveOwner(target.userId, ctx)) {
        return ctx.reply(`${SYM.CROSS} No se puede sancionar a un Propietario (Owner) del sistema.`, { parse_mode: 'HTML' });
      }

      await ctx.api.banChatMember(ctx.chat.id, target.userId);

      const targetMention = mentionFromData(target.userId, target.username, target.firstName);
      const adminMention = staffMention(ctx.from.id, ctx.from.username, ctx.from.first_name);
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
      const botLabel = communityName.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || 'Ventas Libres';
      const dateFormatted = getSuperscriptDate();

      await ctx.reply(
        `<b>⟡ [${escapeHtml(botLabel.toUpperCase())} BOT] USUARIO BANEADO</b>\n` +
        `──────\n\n` +
        `〖☁〗 <b>Usuario:</b> ${targetMention}\n` +
        `〖ϟ〗 <b>ID:</b> <code>${target.userId}</code>\n` +
        `〖⚖️〗 <b>Motivo:</b> <i>${escapeHtml(reason)}</i>\n` +
        `〖🛡️〗 <b>Moderador:</b> ${adminMention}\n\n` +
        `──────\n` +
        `🚫 <i>El usuario ha sido expulsado y bloqueado definitivamente del grupo.</i>\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );

      await db.addModLog('BAN', ctx.from.id, target.userId, ctx.chat.id, reason);
      await logger.sendLog(ctx.api, 'BAN', ctx.from, target.userId, ctx.chat.title, reason);
    } catch (err) {
      console.error('⟡ Mod: Error en /ban:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al banear: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /unban [@user / ID / Responder] ──
  bot.command('unban', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`${SYM.CROSS} Este comando solo funciona en grupos o comunidades.`, { parse_mode: 'HTML' });
      }

      const { target } = await resolveTargetAndArgs(ctx, { hasDuration: false });

      if (!target || target.unresolved) {
        return ctx.reply(
          `<b>⟡ [MODERACIÓN] DESBANEAR USUARIO</b>\n` +
          `──────\n\n` +
          `〖❖〗 <b>Uso:</b> <code>/unban [@usuario / ID / Responder]</code>\n\n` +
          `──────\n` +
          `${getSuperscriptDate()}`,
          { parse_mode: 'HTML' }
        );
      }

      await ctx.api.unbanChatMember(ctx.chat.id, target.userId, { only_if_banned: true });

      const targetMention = mentionFromData(target.userId, target.username, target.firstName);
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
      const botLabel = communityName.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || 'Ventas Libres';
      const dateFormatted = getSuperscriptDate();

      await ctx.reply(
        `<b>⟡ [${escapeHtml(botLabel.toUpperCase())} BOT] USUARIO DESBANEADO</b>\n` +
        `──────\n\n` +
        `〖☁〗 <b>Usuario:</b> ${targetMention}\n` +
        `〖ϟ〗 <b>ID:</b> <code>${target.userId}</code>\n` +
        `〖🛡️〗 <b>Moderador:</b> ${staffMention(ctx.from.id, ctx.from.username, ctx.from.first_name)}\n\n` +
        `──────\n` +
        `✓ <i>El usuario puede volver a unirse a la comunidad.</i>\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );

      await db.addModLog('UNBAN', ctx.from.id, target.userId, ctx.chat.id, null);
      await logger.sendLog(ctx.api, 'UNBAN', ctx.from, target.userId, ctx.chat.title, null);
    } catch (err) {
      console.error('⟡ Mod: Error en /unban:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al desbanear: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /mute, /silencia, /silenciame, /muteale [@user/id/reply] [tiempo] [motivo] ──
  bot.command(['mute', 'silencia', 'silenciame', 'muteale'], requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`${SYM.CROSS} Este comando solo funciona en grupos o comunidades.`, { parse_mode: 'HTML' });
      }

      const { target, duration, reason } = await resolveTargetAndArgs(ctx, { hasDuration: true });

      if (!target || target.unresolved) {
        return ctx.reply(
          `⟡ <b>SILENCIAR USUARIO</b> ⊱ <code>MODO MUTE</code> ⊰\n` +
          `══════\n\n` +
          `▸ <b>Uso Directo:</b> <code>/silencia [@usuario / ID / Responder] [Tiempo] [Motivo]</code>\n` +
          `▸ <b>Modo Interactivo:</b> <code>/silencia @usuario</code> (despliega botones interactivos)\n\n` +
          `⏱️ <b>Formatos de Tiempo Soportados:</b>\n` +
          `• <code>15m</code>, <code>1h</code>, <code>12h</code>, <code>1d</code>, <code>7d</code>, <code>1w</code>\n\n` +
          `──────\n` +
          `💡 <i>Ejemplo: <code>/silencia @usuario 1h Spam en el chat</code></i>`,
          { parse_mode: 'HTML' }
        );
      }

      if (isEffectiveOwner(target.userId, ctx)) {
        return ctx.reply(`${SYM.CROSS} No se puede silenciar a un Propietario (Owner) del sistema.`, { parse_mode: 'HTML' });
      }

      // Aplicar de inmediato y mostrar mensaje limpio en el chat (el reporte completo va a los logs)
      const durStr = duration || '1d';
      const { text } = await muteUI.executeMute(ctx, target, durStr, reason || 'Moderación');
      return await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Mod: Error en /mute:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al silenciar: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /unmute, /desilencia, /desilenciar [@user / ID / Responder] ──
  bot.command(['unmute', 'desilencia', 'desilenciar'], requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`${SYM.CROSS} Este comando solo funciona en grupos o comunidades.`, { parse_mode: 'HTML' });
      }

      const { target } = await resolveTargetAndArgs(ctx, { hasDuration: false });

      if (!target || target.unresolved) {
        return ctx.reply(
          `⟡ <b>DESILENCIAR USUARIO</b> ⊱ <code>USO DEL COMANDO</code> ⊰\n` +
          `══════\n` +
          `▸ <b>Uso:</b> <code>/unmute [@usuario / ID / Responder]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      const { text } = await muteUI.executeUnmute(ctx, target);
      return await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Mod: Error en /unmute:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al desilenciar: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /kick [@user / ID / Responder] [Motivo] ──
  bot.command('kick', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`${SYM.CROSS} Este comando solo funciona en grupos o comunidades.`, { parse_mode: 'HTML' });
      }

      const { target, reason } = await resolveTargetAndArgs(ctx, { hasDuration: false });

      if (!target || target.unresolved) {
        return ctx.reply(
          `⟡ <b>EXPULSAR USUARIO</b> ⊱ <code>KICK</code> ⊰\n` +
          `══════\n` +
          `▸ <b>Uso:</b> <code>/kick [@usuario / ID / Responder] [Motivo]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      if (isEffectiveOwner(target.userId, ctx)) {
        return ctx.reply(`${SYM.CROSS} No se puede expulsar a un Propietario (Owner) del sistema.`, { parse_mode: 'HTML' });
      }

      await ctx.api.banChatMember(ctx.chat.id, target.userId);
      await ctx.api.unbanChatMember(ctx.chat.id, target.userId, { only_if_banned: true });

      const targetMention = mentionFromData(target.userId, target.username, target.firstName);
      const adminMention = staffMention(ctx.from.id, ctx.from.username, ctx.from.first_name);
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
      const botLabel = communityName.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || 'Ventas Libres';
      const dateFormatted = getSuperscriptDate();

      await ctx.reply(
        `<b>⟡ [${escapeHtml(botLabel.toUpperCase())} BOT] USUARIO EXPULSADO</b>\n` +
        `──────\n\n` +
        `〖☁〗 <b>Usuario:</b> ${targetMention}\n` +
        `〖ϟ〗 <b>ID:</b> <code>${target.userId}</code>\n` +
        `〖⚖️〗 <b>Motivo:</b> <i>${escapeHtml(reason)}</i>\n` +
        `〖🛡️〗 <b>Moderador:</b> ${adminMention}\n\n` +
        `──────\n` +
        `⚡ <i>El usuario fue removido del chat. Puede reingresar con enlace oficial.</i>\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );

      await db.addModLog('KICK', ctx.from.id, target.userId, ctx.chat.id, reason);
      await logger.sendLog(ctx.api, 'KICK', ctx.from, target.userId, ctx.chat.title, reason);
    } catch (err) {
      console.error('⟡ Mod: Error en /kick:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al expulsar: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /warn [@user / ID / Responder] [Motivo] ──
  bot.command('warn', requireStaff(), async (ctx) => {
    try {
      const { target, reason } = await resolveTargetAndArgs(ctx, { hasDuration: false });

      if (!target || target.unresolved) {
        return ctx.reply(
          `<b>⟡ [MODERACIÓN] ADVERTIR USUARIO</b>\n` +
          `──────\n\n` +
          `〖❖〗 <b>Uso:</b> <code>/warn [@usuario / ID / Responder] [Motivo]</code>\n\n` +
          `──────\n` +
          `${getSuperscriptDate()}`,
          { parse_mode: 'HTML' }
        );
      }

      if (isEffectiveOwner(target.userId, ctx)) {
        return ctx.reply(`${SYM.CROSS} No se puede advertir a un Propietario (Owner) del sistema.`, { parse_mode: 'HTML' });
      }

      await db.addWarning(target.userId, ctx.chat.id, ctx.from.id, reason);
      const warns = await db.getWarnings(target.userId, ctx.chat.id);
      const warnCount = warns.length;

      const targetMention = mentionFromData(target.userId, target.username, target.firstName);
      const adminMention = staffMention(ctx.from.id, ctx.from.username, ctx.from.first_name);
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
      const botLabel = communityName.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || 'Ventas Libres';
      const dateFormatted = getSuperscriptDate();

      let text =
        `<b>⟡ [${escapeHtml(botLabel.toUpperCase())} BOT] ADVERTENCIA APLICADA</b>\n` +
        `──────\n\n` +
        `〖☁〗 <b>Usuario:</b> ${targetMention}\n` +
        `〖ϟ〗 <b>ID:</b> <code>${target.userId}</code>\n` +
        `〖⚠️〗 <b>Acumulado:</b> <b>${warnCount} / 3 advertencias</b>\n` +
        `〖⚖️〗 <b>Motivo:</b> <i>${escapeHtml(reason)}</i>\n` +
        `〖🛡️〗 <b>Moderador:</b> ${adminMention}\n\n`;

      if (warnCount >= 3 && (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group')) {
        text +=
          `──────\n` +
          `🚨 <b>LÍMITE ALCANZADO (3/3):</b> El usuario ha sido silenciado automáticamente por 24 horas.\n\n`;
        try {
          const muteDuration = parseDuration('1d');
          await ctx.api.restrictChatMember(
            ctx.chat.id,
            target.userId,
            {
              can_send_messages: false,
              can_send_audios: false,
              can_send_documents: false,
              can_send_photos: false,
              can_send_videos: false,
              can_send_video_notes: false,
              can_send_voice_notes: false,
              can_send_polls: false,
              can_send_other_messages: false,
              can_add_web_page_previews: false,
            },
            { until_date: muteDuration.untilDate, use_independent_chat_permissions: true }
          );
        } catch {}
      }

      text += `──────\n` +
              `⚠️ <i>Al acumular 3 advertencias oficiales se aplican sanciones automáticas.</i>\n` +
              `${dateFormatted}`;

      await ctx.reply(text, { parse_mode: 'HTML' });
      await db.addModLog('WARN', ctx.from.id, target.userId, ctx.chat.id, `Warn #${warnCount}: ${reason}`);
      await logger.sendLog(ctx.api, 'WARN', ctx.from, target.userId, ctx.chat.title, `Warn #${warnCount}: ${reason}`);
    } catch (err) {
      console.error('⟡ Mod: Error en /warn:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al aplicar advertencia: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /unwarn o /clearwarns [@user / ID / Responder] ──
  bot.command(['unwarn', 'clearwarns', 'desadvertir'], requireStaff(), async (ctx) => {
    try {
      const { target } = await resolveTargetAndArgs(ctx, { hasDuration: false });

      if (!target || target.unresolved) {
        return ctx.reply(
          `<b>⟡ [MODERACIÓN] LIMPIAR ADVERTENCIAS</b>\n` +
          `──────\n\n` +
          `〖❖〗 <b>Uso:</b> <code>/unwarn [@usuario / ID / Responder]</code>\n\n` +
          `──────\n` +
          `${getSuperscriptDate()}`,
          { parse_mode: 'HTML' }
        );
      }

      await db.clearWarnings(target.userId, ctx.chat.id);
      const targetMention = mentionFromData(target.userId, target.username, target.firstName);
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
      const botLabel = communityName.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || 'Ventas Libres';
      const dateFormatted = getSuperscriptDate();

      await ctx.reply(
        `<b>⟡ [${escapeHtml(botLabel.toUpperCase())} BOT] ADVERTENCIAS RESTABLECIDAS</b>\n` +
        `──────\n\n` +
        `〖☁〗 <b>Usuario:</b> ${targetMention}\n` +
        `〖ϟ〗 <b>ID:</b> <code>${target.userId}</code>\n` +
        `〖⚠️〗 <b>Estado:</b> ⊱ <code>0 / 3 ADVERTENCIAS 🟢</code> ⊰\n` +
        `〖🛡️〗 <b>Moderador:</b> ${staffMention(ctx.from.id, ctx.from.username, ctx.from.first_name)}\n\n` +
        `──────\n` +
        `✓ <i>Se han limpiado todas las advertencias en este chat.</i>\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Mod: Error en /unwarn:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al limpiar advertencias: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /warns [@user / ID / Responder] ──
  bot.command(['warns', 'advertencias'], async (ctx) => {
    try {
      let { target } = await resolveTargetAndArgs(ctx, { hasDuration: false });
      if (!target) {
        target = {
          userId: ctx.from.id,
          username: ctx.from.username || null,
          firstName: ctx.from.first_name || 'Usuario',
        };
      }

      const warns = await db.getWarnings(target.userId, ctx.chat.id);
      const targetMention = mentionFromData(target.userId, target.username, target.firstName);
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
      const botLabel = communityName.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || 'Ventas Libres';
      const dateFormatted = getSuperscriptDate();

      let text =
        `<b>⟡ [${escapeHtml(botLabel.toUpperCase())} BOT] HISTORIAL DE ADVERTENCIAS</b>\n` +
        `──────\n\n` +
        `〖☁〗 <b>Usuario:</b> ${targetMention}\n` +
        `〖ϟ〗 <b>ID:</b> <code>${target.userId}</code>\n` +
        `〖⚠️〗 <b>Total Acumulado:</b> <b>${warns.length} / 3</b>\n\n`;

      if (warns.length === 0) {
        text += `✓ <i>El usuario no registra advertencias activas en este grupo.</i>\n\n`;
      } else {
        warns.forEach((w, idx) => {
          text += `〖⚠️〗 <b>#${idx + 1}:</b> <i>${escapeHtml(w.reason || 'Sin motivo')}</i>\n`;
        });
        text += '\n';
      }

      text += `──────\n${dateFormatted}`;
      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Mod: Error en /warns:', err.message);
    }
  });
    } catch (err) {
      console.error('⟡ Mod: Error en /warns:', err.message);
    }
  });

  // ── /gban [@user / ID / Responder] [Motivo] ──
  bot.command('gban', requireStaff(), async (ctx) => {
    try {
      const { target, reason } = await resolveTargetAndArgs(ctx, { hasDuration: false });

      if (!target || target.unresolved) {
        return ctx.reply(
          `<b>⟡ [MODERACIÓN] BANEO GLOBAL (GBAN)</b>\n` +
          `──────\n\n` +
          `〖❖〗 <b>Uso:</b> <code>/gban [@usuario / ID / Responder] [Motivo]</code>\n\n` +
          `──────\n` +
          `🔥 <i>Banea permanentemente de todos los grupos y ficha en la Lista Negra.</i>\n` +
          `${getSuperscriptDate()}`,
          { parse_mode: 'HTML' }
        );
      }

      if (config.OWNER_IDS.includes(target.userId)) {
        return ctx.reply(`${SYM.CROSS} No se puede aplicar baneo global a un Propietario (Owner) del sistema.`, {
          parse_mode: 'HTML',
        });
      }

      const redisDb = require('../../database/redis');
      await redisDb.setCache(
        `gban_pending:${target.userId}`,
        {
          userId: target.userId,
          username: target.username || null,
          firstName: target.firstName || null,
          reason,
          issuerId: ctx.from.id,
        },
        300
      );

      const targetMention = mentionFromData(target.userId, target.username, target.firstName);
      const dateFormatted = getSuperscriptDate();

      const kb = new InlineKeyboard()
        .text(toMathBold('CONFIRMAR GBAN'), `gban_confirm:${target.userId}`).danger()
        .text(toMathBold('CANCELAR'), 'gban_cancel').primary();

      await ctx.reply(
        `<b>⟡ [SISTEMA DE SEGURIDAD] CONFIRMACIÓN DE GBAN</b>\n` +
        `──────\n\n` +
        `〖☁〗 <b>Objetivo:</b> ${targetMention}\n` +
        `〖ϟ〗 <b>ID:</b> <code>${target.userId}</code>\n` +
        `〖⚖️〗 <b>Motivo:</b> <i>${escapeHtml(reason)}</i>\n\n` +
        `──────\n` +
        `⚠️ <i>Esta acción expulsará al usuario de <b>TODAS las comunidades</b> y lo fichará de forma irreversible en la base de datos oficial.</i>\n\n` +
        `¿Confirmas la ejecución?\n` +
        `${dateFormatted}`,
        {
          parse_mode: 'HTML',
          reply_markup: kb,
        }
      );
    } catch (err) {
      console.error('⟡ Mod: Error en /gban:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al solicitar baneo global: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Callback: Confirmar y Ejecutar GBan ──
  bot.callbackQuery(/^gban_confirm:(\d+)$/, requireStaff(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1], 10);
      const redisDb = require('../../database/redis');
      const pending = (await redisDb.getCache(`gban_pending:${targetId}`)) || {};
      const reason = pending.reason || 'Sanción por estafa / infracción grave';
      const username = pending.username || null;
      const firstName = pending.firstName || null;

      await ctx.answerCallbackQuery({ text: '🔥 Ejecutando GBan Global...' });

      // 1. Guardar en Lista Negra permanente (burned_users) usando firma estructurada y segura
      await db.burnUser({
        userId: targetId,
        username,
        firstName,
        context: `GBAN: ${reason}`,
        reportedBy: ctx.from.id,
        approvedBy: ctx.from.id,
      });

      await redisDb.clearCache(`gban_pending:${targetId}`);

      // 2. Banear en todos los grupos registrados mediante Motor Centinela
      const { affectedCount } = await sentinel.syncPenaltyAcrossGroups(ctx.api, targetId, 'GBAN');

      // Banear en el chat actual si es grupo
      if (ctx.chat?.type === 'supergroup' || ctx.chat?.type === 'group') {
        try {
          await ctx.api.banChatMember(ctx.chat.id, targetId);
        } catch {}
      }

      // 3. Registrar mod log
      await db.addModLog('GBAN', ctx.from.id, targetId, ctx.chat?.id || 0, reason);
      await logger.sendLog(ctx.api, 'GBAN', ctx.from, targetId, ctx.chat?.title || 'Global', reason);

      const targetMention = mentionFromData(targetId, username, firstName);
      const adminMention = staffMention(ctx.from.id, ctx.from.username, ctx.from.first_name);
      const dateFormatted = getSuperscriptDate();

      await ctx.editMessageText(
        `<b>⟡ [LISTA NEGRA OFICIAL] BANEO GLOBAL APLICADO</b>\n` +
        `──────\n\n` +
        `〖☁〗 <b>Usuario:</b> ${targetMention}\n` +
        `〖ϟ〗 <b>ID:</b> <code>${targetId}</code>\n` +
        `〖⚖️〗 <b>Motivo:</b> <i>${escapeHtml(reason)}</i>\n` +
        `〖❖〗 <b>Grupos Sancionados:</b> <code>${affectedCount} comunidades</code>\n` +
        `〖🔥〗 <b>Estado:</b> ⊱ <code>LISTA NEGRA PERMANENTE 🔴</code> ⊰\n` +
        `〖🛡️〗 <b>Moderador:</b> ${adminMention}\n\n` +
        `──────\n` +
        `🚫 <i>Usuario fichado y expulsado de la red oficial.</i>\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en gban_confirm callback:', err.message);
      await ctx.answerCallbackQuery({ text: `✗ Error: ${err.message}`, show_alert: true });
    }
  });

  // ── Callback: Cancelar GBan ──
  bot.callbackQuery('gban_cancel', async (ctx) => {
    try {
      await ctx.answerCallbackQuery({ text: 'Operación cancelada.' });
      const dateFormatted = getSuperscriptDate();
      await ctx.editMessageText(
        `<b>⟡ [GBAN DECLINADO] OPERACIÓN CANCELADA</b>\n` +
        `──────\n\n` +
        `<i>No se aplicó ninguna sanción al usuario.</i>\n\n` +
        `──────\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );
    } catch {}
  });

  // ── /ungban [@user / ID / Responder] ──
  bot.command(['ungban', 'unburn', 'desquemar'], requireStaff(), async (ctx) => {
    try {
      const { target } = await resolveTargetAndArgs(ctx, { hasDuration: false });

      if (!target || target.unresolved) {
        return ctx.reply(
          `<b>⟡ [MODERACIÓN] REHABILITAR USUARIO</b>\n` +
          `──────\n\n` +
          `〖❖〗 <b>Uso:</b> <code>/ungban [@usuario / ID / Responder]</code>\n` +
          `〖✦〗 <b>Alternativa:</b> <code>/desquemar [ID / @usuario]</code>\n\n` +
          `──────\n` +
          `🔓 <i>Remueve de la lista negra y permite el reingreso a los grupos oficiales.</i>\n` +
          `${getSuperscriptDate()}`,
          { parse_mode: 'HTML' }
        );
      }

      // 1. Remover de la lista negra en base de datos
      await db.unburnUser(target.userId);

      // 2. Desbanear en todos los grupos registrados
      const { affectedCount } = await sentinel.syncPenaltyAcrossGroups(ctx.api, target.userId, 'UNGBAN');

      if (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group') {
        try {
          await ctx.api.unbanChatMember(ctx.chat.id, target.userId, { only_if_banned: true });
        } catch {}
      }

      // 3. Log
      await db.addModLog('UNGBAN', ctx.from.id, target.userId, ctx.chat.id, 'Removido de lista negra');
      await logger.sendLog(ctx.api, 'UNGBAN', ctx.from, target.userId, ctx.chat.title || 'Global', 'Rehabilitado');

      const targetMention = mentionFromData(target.userId, target.username, target.firstName);
      const dateFormatted = getSuperscriptDate();

      await ctx.reply(
        `<b>⟡ [LISTA NEGRA REMOVIDA] USUARIO REHABILITADO</b>\n` +
        `──────\n\n` +
        `〖☁〗 <b>Usuario:</b> ${targetMention}\n` +
        `〖ϟ〗 <b>ID:</b> <code>${target.userId}</code>\n` +
        `〖☾〗 <b>Estado:</b> ⊱ <code>LIMPIO 🟢</code> ⊰\n` +
        `〖❖〗 <b>Grupos Desbloqueados:</b> <code>${affectedCount} comunidades</code>\n` +
        `〖🛡️〗 <b>Moderador:</b> ${staffMention(ctx.from.id, ctx.from.username, ctx.from.first_name)}\n\n` +
        `──────\n` +
        `✓ <i>El usuario ha sido eliminado de la lista de estafadores y puede volver a participar.</i>\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Mod: Error en /ungban:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al rehabilitar usuario: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /gbanlist / /gbans / /listagban / /listanegra / /blacklist / /quemados ──
  bot.command(['gbanlist', 'gbans', 'listagban', 'panelgban', 'listanegra', 'blacklist', 'quemados', 'estafadores', 'burned'], async (ctx) => {
    try {
      const text = ctx.message.text || '';
      const parts = text.trim().split(/\s+/);

      // Si se pasa un @user o ID como argumento: /gbanlist 12345 o /gbanlist @user
      if (parts[1] && (!/^\d+$/.test(parts[1]) || parts[1].length > 4)) {
        const query = parts[1];
        const burnInfo = await db.getBurnedUserInfo(query);
        if (burnInfo) {
          const { buildUserProfile } = require('../info/handler');
          const { text: profileText, keyboard } = await buildUserProfile(ctx, { userId: Number(burnInfo.user_id), username: burnInfo.username });
          return ctx.reply(profileText, { parse_mode: 'HTML', reply_markup: keyboard });
        } else {
          return ctx.reply(`${SYM.CHECK} <b>No se encontraron registros de GBAN / Lista Negra para <code>${escapeHtml(query)}</code>.</b>`, { parse_mode: 'HTML' });
        }
      }

      let targetPage = 1;
      if (parts[1] && /^\d+$/.test(parts[1])) {
        targetPage = parseInt(parts[1], 10);
      }

      const { text: msgText, keyboard } = await renderBlacklistPage(targetPage, ctx.from.id);
      await ctx.reply(msgText, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (err) {
      console.error('⟡ Mod: Error en /gbanlist:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al consultar la lista negra: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Callbacks de Paginación de Lista Negra ──
  bot.callbackQuery(/^blacklist_page:(\d+)(?::(\d+))?$/, async (ctx) => {
    try {
      const page = parseInt(ctx.match[1], 10);
      const ownerId = ctx.match[2] ? parseInt(ctx.match[2], 10) : null;

      if (ownerId && ctx.from.id !== ownerId) {
        return ctx.answerCallbackQuery({
          text: '⚠️ Este panel fue abierto por otro usuario. Ejecuta /gbanlist para abrir el tuyo.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery();
      const { text, keyboard } = await renderBlacklistPage(page, ownerId || ctx.from.id);

      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      } catch {}
    } catch (err) {
      console.error('⟡ Mod: Error en callback blacklist_page:', err.message);
    }
  });

  bot.callbackQuery(/^blacklist_close(?::(\d+))?$/, async (ctx) => {
    try {
      const ownerId = ctx.match[1] ? parseInt(ctx.match[1], 10) : null;

      if (ownerId && ctx.from.id !== ownerId) {
        return ctx.answerCallbackQuery({
          text: '⚠️ Este panel fue abierto por otro usuario. Ejecuta /gbanlist para abrir el tuyo.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery();
      try {
        await ctx.deleteMessage();
      } catch {
        await ctx.editMessageText('🔒 <i>Panel de Lista Negra cerrado.</i>', { parse_mode: 'HTML' });
      }
    } catch (err) {
      console.error('⟡ Mod: Error en callback blacklist_close:', err.message);
    }
  });

  // ── Callbacks de Logs ──
  bot.callbackQuery(/^log_unban:(\d+)$/, requireStaff(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1], 10);
      await ctx.answerCallbackQuery({ text: '🔓 Desbaneando usuario...' });

      await db.unburnUser(targetId);
      const { affectedCount } = await sentinel.syncPenaltyAcrossGroups(ctx.api, targetId, 'UNBAN');

      await db.addModLog('UNBAN_LOG_BTN', ctx.from.id, targetId, ctx.chat?.id || 0, 'Desbaneado desde botón de log');
      await ctx.reply(`✓ <b>Usuario <code>${targetId}</code> desbaneado con éxito</b> (${affectedCount} grupos).`, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Error en log_unban callback:', err.message);
      await ctx.answerCallbackQuery({ text: `✗ Error: ${err.message}`, show_alert: true });
    }
  });

  bot.callbackQuery(/^log_unmute:(\d+)$/, requireStaff(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1], 10);
      await ctx.answerCallbackQuery({ text: '🔊 Desmuteando usuario...' });

      const { affectedCount } = await sentinel.syncPenaltyAcrossGroups(ctx.api, targetId, 'UNMUTE');
      await ctx.reply(`✓ <b>Usuario <code>${targetId}</code> desmuteado con éxito</b> (${affectedCount} grupos).`, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Error en log_unmute callback:', err.message);
      await ctx.answerCallbackQuery({ text: `✗ Error: ${err.message}`, show_alert: true });
    }
  });

  bot.callbackQuery(/^log_ban:(\d+)$/, requireStaff(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1], 10);
      await ctx.answerCallbackQuery();

      const user = (await db.getUser(targetId)) || { user_id: targetId };
      const userMention = mentionFromData(targetId, user.username, user.first_name);

      const kb = new InlineKeyboard()
        .text(toMathBold('BANEAR GBAN'), `gban_confirm:${targetId}`).danger()
        .text(toMathBold('CANCELAR'), 'gban_cancel').primary();

      await ctx.reply(
        `<b>⟡ [LOGS DE SEGURIDAD] CONFIRMAR BANEO</b>\n` +
        `──────\n\n` +
        `〖☁〗 <b>Objetivo:</b> ${userMention}\n` +
        `〖ϟ〗 <b>ID:</b> <code>${targetId}</code>\n\n` +
        `──────\n` +
        `¿Deseas aplicar baneo global a este usuario?\n` +
        `${getSuperscriptDate()}`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    } catch (err) {
      console.error('⟡ Error en log_ban callback:', err.message);
    }
  });

  bot.callbackQuery(/^log_info:(\d+)$/, async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1], 10);
      await ctx.answerCallbackQuery();

      const { buildUserProfile } = require('../info/handler');
      const { text, keyboard } = await buildUserProfile(ctx, { userId: targetId });

      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (err) {
      console.error('⟡ Error en log_info callback:', err.message);
    }
  });
}

function formatPeruDate(isoString) {
  if (!isoString) return 'Fecha no registrada';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Fecha no registrada';
  }
}

async function renderBlacklistPage(page = 1, ownerId = null) {
  const PAGE_SIZE = 5;
  const totalCount = await db.getBurnedUsersCount();
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const users = await db.getAllBurnedUsers(PAGE_SIZE, offset);
  const closePayload = ownerId ? `blacklist_close:${ownerId}` : 'blacklist_close';
  const dateFormatted = getSuperscriptDate();

  if (totalCount === 0 || users.length === 0) {
    return {
      text:
        `<b>⟡ [VENTAS LIBRES PERÚ] LISTA NEGRA OFICIAL</b>\n` +
        `──────\n\n` +
        `✓ <b>Estado de la Comunidad:</b> ⊱ <code>LIMPIA 🟢</code> ⊰\n` +
        `Actualmente no hay estafadores registrados en la lista negra.\n\n` +
        `──────\n` +
        `${dateFormatted}`,
      keyboard: new InlineKeyboard().text(toMathBold('CERRAR'), closePayload).danger(),
    };
  }

  let text =
    `<b>⟡ [VENTAS LIBRES PERÚ] LISTA NEGRA OFICIAL</b>\n` +
    `──────\n\n` +
    `〖🔥〗 <b>Total Fichados:</b> <code>${totalCount} estafadores</code>\n` +
    `〖📄〗 <b>Página Actual:</b> <code>${currentPage} / ${totalPages}</code>\n\n` +
    `──────\n\n`;

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const itemNum = offset + i + 1;
    let userHeader = '';
    if (u.username) {
      userHeader = `@${u.username}` + (u.first_name ? ` (${escapeHtml(u.first_name)})` : '');
    } else if (u.first_name) {
      userHeader = escapeHtml(u.first_name);
    } else {
      userHeader = `Usuario [${u.user_id}]`;
    }

    const regDate = formatPeruDate(u.burned_at);
    const reason = (u.context || 'Estafa comprobada').slice(0, 150);

    text +=
      `⛔ <b>#${itemNum} | ${userHeader}</b>\n` +
      `〖ϟ〗 <b>ID:</b> <code>${u.user_id}</code>\n` +
      `〖♝〗 <b>Username:</b> ${u.username ? `<code>@${u.username}</code>` : '<i>Sin @username</i>'}\n` +
      `〖⏱️〗 <b>Registro:</b> <code>${regDate}</code>\n` +
      `〖⚖️〗 <b>Motivo:</b>\n  ↳ <i>${escapeHtml(reason)}</i>\n\n` +
      `──────\n`;
  }

  text += `<i>Para ver el expediente completo, escribe: <code>/info [ID o @user]</code></i>\n${dateFormatted}`;

  const kb = new InlineKeyboard();

  const prevPayload = ownerId ? `blacklist_page:${currentPage - 1}:${ownerId}` : `blacklist_page:${currentPage - 1}`;
  const currPayload = ownerId ? `blacklist_page:${currentPage}:${ownerId}` : `blacklist_page:${currentPage}`;
  const nextPayload = ownerId ? `blacklist_page:${currentPage + 1}:${ownerId}` : `blacklist_page:${currentPage + 1}`;

  // Fila 1: Paginación
  if (currentPage > 1) {
    kb.text(toMathBold('ANTERIOR'), prevPayload).primary();
  }
  if (currentPage < totalPages) {
    kb.text(toMathBold('SIGUIENTE'), nextPayload).primary();
  }

  // Fila 2: Indicador de página y Cerrar
  kb.row();
  kb.text(toMathBold(`PÁGINA ${currentPage} / ${totalPages}`), currPayload);
  kb.text(toMathBold('CERRAR'), closePayload).danger();

  return { text, keyboard: kb };
}

module.exports = { register };
