const { requireStaff } = require('../../middleware/auth');
const config = require('../../config/env');
const db = require('../../database/postgres');
const { SYM } = require('../../config/constants');
const { escapeHtml } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');

const antiRaid = require('./antiRaid');
const antiFlood = require('./antiFlood');
const locksModule = require('./locks');

// ══════════════════════════════════════════════════════
// ⟡ Módulo de Comandos: Seguridad, Anti-Raid & Locks
// ══════════════════════════════════════════════════════

function register(bot) {
  // ── Interceptor Global de Mensajes (Anti-Flood & Locks) ──
  bot.on('message', async (ctx, next) => {
    try {
      if (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group') {
        // 1. Evaluar Bloqueos Selectivos de Contenido (Locks)
        const lockEval = await locksModule.evaluateMessageLocks(ctx);
        if (lockEval.shouldDelete) {
          try {
            await ctx.deleteMessage();
          } catch {}
          return; // Detener flujo
        }

        // 2. Evaluar Anti-Flood en tiempo real
        const floodCheck = await antiFlood.checkMessageFlood(ctx);
        if (floodCheck.isFlood) {
          await antiFlood.handleFloodViolation(ctx, floodCheck.reason, floodCheck.history);
          return; // Detener flujo
        }
      }
    } catch (err) {
      console.error('⟡ Error en interceptor de seguridad:', err.message);
    }
    return next();
  });

  // ── Interceptor de Nuevos Miembros (Detección de Bots intrusos en Locks) ──
  bot.on('message:new_chat_members', async (ctx, next) => {
    try {
      if (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group') {
        const locks = await locksModule.getGroupLocks(ctx.chat.id);
        if (locks.bots) {
          const members = ctx.message.new_chat_members || [];
          for (const m of members) {
            if (m.is_bot && m.id !== ctx.me.id) {
              // Expulsar bot no autorizado
              try {
                await ctx.api.banChatMember(ctx.chat.id, m.id);
                await ctx.api.unbanChatMember(ctx.chat.id, m.id, { only_if_banned: true });
                console.log(`🛡️ Bot intruso expulsado por Lock Bots: @${m.username || m.id}`);
              } catch {}
            }
          }
        }
      }
    } catch {}
    return next();
  });

  // ── /panico o /lockdown [on|off] — Modo Pánico Inmediato ──
  bot.command(['panico', 'lockdown', 'defcon'], requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`${SYM.CROSS} Este comando solo se utiliza en grupos.`, { parse_mode: 'HTML' });
      }

      const parts = (ctx.message.text || '').trim().split(/\s+/);
      const sub = parts[1]?.toLowerCase();
      const chatId = ctx.chat.id;

      const currentlyLocked = await antiRaid.isLockdownActive(chatId);

      if (sub === 'off' || (currentlyLocked && !sub)) {
        await antiRaid.disableLockdown(ctx.api, chatId);
        return ctx.reply(
          `${SYM.DIVIDER}\n` +
          `🟢 <b>MODO PÁNICO DESACTIVADO — CHAT RESTAURADO</b>\n` +
          `${SYM.DIVIDER}\n\n` +
          `➜ <b>Estado:</b> Permisos de escritura normalizados.\n` +
          `➜ <b>Operación:</b> Los miembros pueden volver a escribir con normalidad.\n\n` +
          `${SYM.THIN_LINE}`,
          { parse_mode: 'HTML' }
        );
      }

      // Activar Lockdown
      await antiRaid.triggerLockdown(ctx.api, chatId, ctx.chat.title, `Activado manualmente por ${ctx.from.first_name}`);
      return ctx.reply(
        `${SYM.DIVIDER}\n` +
        `🚨 <b>MODO PÁNICO ACTIVADO (DEFCON 1)</b> 🚨\n` +
        `${SYM.DIVIDER}\n\n` +
        `➜ <b>Estado:</b> 🔴 <b>CHAT CERRADO AL 100%</b>\n` +
        `➜ <b>Seguridad:</b> Se revocó el permiso de envío a todos los miembros regulares.\n` +
        `➜ <b>Bienvenidas:</b> Suspendidas para evitar saturación de Telegram.\n\n` +
        `<i>Para abrir el grupo nuevamente, escribe: <code>/panico off</code></i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /panico:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al modificar modo pánico: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /antiraid [on|off|sensibilidad] ──
  bot.command('antiraid', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`${SYM.CROSS} Este comando es para grupos.`, { parse_mode: 'HTML' });
      }

      const parts = (ctx.message.text || '').trim().split(/\s+/);
      const sub = parts[1]?.toLowerCase();
      const chatId = ctx.chat.id;
      const conf = await antiRaid.getAntiRaidConfig(chatId);

      if (sub === 'on') {
        conf.enabled = true;
        await antiRaid.setAntiRaidConfig(chatId, conf);
        return ctx.reply(`🛡️ <b>Anti-Raid: ACTIVADO 🟢</b> (Umbral: ${conf.threshold} usuarios en ${conf.windowMs / 1000}s).`, { parse_mode: 'HTML' });
      }

      if (sub === 'off') {
        conf.enabled = false;
        await antiRaid.setAntiRaidConfig(chatId, conf);
        return ctx.reply(`🛡️ <b>Anti-Raid: DESACTIVADO 🔴</b>`, { parse_mode: 'HTML' });
      }

      if (sub === 'alta' || sub === 'high') {
        conf.threshold = 3;
        conf.windowMs = 10000;
        await antiRaid.setAntiRaidConfig(chatId, conf);
        return ctx.reply(`🛡️ <b>Sensibilidad Anti-Raid: ALTA</b> (Se activa con 3 ingresos en 10s).`, { parse_mode: 'HTML' });
      }

      if (sub === 'media' || sub === 'medium') {
        conf.threshold = 6;
        conf.windowMs = 10000;
        await antiRaid.setAntiRaidConfig(chatId, conf);
        return ctx.reply(`🛡️ <b>Sensibilidad Anti-Raid: MEDIA</b> (Se activa con 6 ingresos en 10s).`, { parse_mode: 'HTML' });
      }

      if (sub === 'baja' || sub === 'low') {
        conf.threshold = 10;
        conf.windowMs = 10000;
        await antiRaid.setAntiRaidConfig(chatId, conf);
        return ctx.reply(`🛡️ <b>Sensibilidad Anti-Raid: BAJA</b> (Se activa con 10 ingresos en 10s).`, { parse_mode: 'HTML' });
      }

      const text =
        `${SYM.DIVIDER}\n` +
        `🛡️ <b>CONFIGURACIÓN DEL ESCUDO ANTI-RAID</b>\n` +
        `${SYM.DIVIDER}\n\n` +
        `➜ <b>Estado:</b> <b>${conf.enabled ? 'ACTIVADO 🟢' : 'DESACTIVADO 🔴'}</b>\n` +
        `➜ <b>Umbral de Detección:</b> <code>${conf.threshold}</code> ingresos\n` +
        `➜ <b>Ventana de Análisis:</b> <code>${conf.windowMs / 1000}s</code>\n` +
        `➜ <b>Acción Automática:</b> <b>${conf.action}</b>\n\n` +
        `${SYM.THIN_LINE}\n` +
        `<b>Opciones de ajuste:</b>\n` +
        `• <code>/antiraid on</code> / <code>/antiraid off</code>\n` +
        `• <code>/antiraid alta</code> (3 usuarios en 10s)\n` +
        `• <code>/antiraid media</code> (6 usuarios en 10s)\n` +
        `• <code>/antiraid baja</code> (10 usuarios en 10s)`;

      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Error en /antiraid:', err.message);
    }
  });

  // ── /antiflood [on|off|mensajes] ──
  bot.command('antiflood', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`${SYM.CROSS} Este comando es para grupos.`, { parse_mode: 'HTML' });
      }

      const parts = (ctx.message.text || '').trim().split(/\s+/);
      const sub = parts[1]?.toLowerCase();
      const chatId = ctx.chat.id;
      const conf = await antiFlood.getAntiFloodConfig(chatId);

      if (sub === 'on') {
        conf.enabled = true;
        await antiFlood.setAntiFloodConfig(chatId, conf);
        return ctx.reply(`🌊 <b>Anti-Flood: ACTIVADO 🟢</b> (Límite: ${conf.msgLimit} msgs en ${conf.windowMs / 1000}s).`, { parse_mode: 'HTML' });
      }

      if (sub === 'off') {
        conf.enabled = false;
        await antiFlood.setAntiFloodConfig(chatId, conf);
        return ctx.reply(`🌊 <b>Anti-Flood: DESACTIVADO 🔴</b>`, { parse_mode: 'HTML' });
      }

      if (/^\d+$/.test(sub)) {
        conf.msgLimit = Math.max(3, Math.min(20, parseInt(sub, 10)));
        await antiFlood.setAntiFloodConfig(chatId, conf);
        return ctx.reply(`🌊 <b>Límite de Anti-Flood fijado a:</b> <code>${conf.msgLimit} mensajes</code>`, { parse_mode: 'HTML' });
      }

      const text =
        `${SYM.DIVIDER}\n` +
        `🌊 <b>SISTEMA ANTI-FLOOD EN TIEMPO REAL</b>\n` +
        `${SYM.DIVIDER}\n\n` +
        `➜ <b>Estado:</b> <b>${conf.enabled ? 'ACTIVADO 🟢' : 'DESACTIVADO 🔴'}</b>\n` +
        `➜ <b>Límite de Mensajes:</b> <code>${conf.msgLimit}</code> mensajes\n` +
        `➜ <b>Ventana de Tiempo:</b> <code>${conf.windowMs / 1000}s</code>\n` +
        `➜ <b>Repetición Idéntica:</b> <code>${conf.repeatLimit}</code> veces\n` +
        `➜ <b>Sanción Aplicada:</b> Mute por <b>${conf.muteTime}</b>\n\n` +
        `${SYM.THIN_LINE}\n` +
        `<b>Comandos:</b>\n` +
        `• <code>/antiflood on</code> | <code>/antiflood off</code>\n` +
        `• <code>/antiflood [número]</code> (ej. <code>/antiflood 4</code>)`;

      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Error en /antiflood:', err.message);
    }
  });

  // ── /lock [tipo] & /unlock [tipo] & /locks ──
  bot.command('locks', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`${SYM.CROSS} Este comando es para grupos.`, { parse_mode: 'HTML' });
      }

      const locks = await locksModule.getGroupLocks(ctx.chat.id);
      let text =
        `${SYM.DIVIDER}\n` +
        `🔒 <b>BLOQUEOS DE CONTENIDO ACTIVOS (LOCKS)</b>\n` +
        `${SYM.DIVIDER}\n\n`;

      for (const item of locksModule.SUPPORTED_LOCKS) {
        const isLocked = locks[item] === true;
        text += `• <b>${item.toUpperCase()}:</b> ${isLocked ? '🔴 BLOQUEADO' : '🟢 PERMITIDO'}\n`;
      }

      text +=
        `\n${SYM.THIN_LINE}\n` +
        `💡 <b>Uso:</b>\n` +
        `• Bloquear: <code>/lock [tipo]</code> (ej. <code>/lock links</code>)\n` +
        `• Desbloquear: <code>/unlock [tipo]</code> (ej. <code>/unlock stickers</code>)`;

      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Error en /locks:', err.message);
    }
  });

  bot.command('lock', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') return;
      const parts = (ctx.message.text || '').trim().split(/\s+/);
      const targetLock = parts[1]?.toLowerCase();

      if (!targetLock || !locksModule.SUPPORTED_LOCKS.includes(targetLock)) {
        return ctx.reply(
          `🔒 <b>Tipos disponibles para bloquear:</b>\n\n` +
          locksModule.SUPPORTED_LOCKS.map((l) => `• <code>${l}</code>`).join('\n') +
          `\n\nEjemplo: <code>/lock links</code>`,
          { parse_mode: 'HTML' }
        );
      }

      const locks = await locksModule.getGroupLocks(ctx.chat.id);
      locks[targetLock] = true;
      await locksModule.setGroupLocks(ctx.chat.id, locks);

      await ctx.reply(`🔒 <b>Bloqueo activado:</b> <code>${targetLock.toUpperCase()}</code> ahora está prohibido para usuarios regulares.`, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Error en /lock:', err.message);
    }
  });

  bot.command('unlock', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') return;
      const parts = (ctx.message.text || '').trim().split(/\s+/);
      const targetLock = parts[1]?.toLowerCase();

      if (!targetLock || !locksModule.SUPPORTED_LOCKS.includes(targetLock)) {
        return ctx.reply(
          `🔓 <b>Tipos disponibles para desbloquear:</b>\n\n` +
          locksModule.SUPPORTED_LOCKS.map((l) => `• <code>${l}</code>`).join('\n'),
          { parse_mode: 'HTML' }
        );
      }

      const locks = await locksModule.getGroupLocks(ctx.chat.id);
      locks[targetLock] = false;
      await locksModule.setGroupLocks(ctx.chat.id, locks);

      await ctx.reply(`🔓 <b>Bloqueo desactivado:</b> <code>${targetLock.toUpperCase()}</code> ahora está permitido.`, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Error en /unlock:', err.message);
    }
  });

  // ── /purge [1-100] — Limpieza ultra-rápida de mensajes spam ──
  bot.command(['purge', 'limpiar', 'del'], requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') return;

      const replyTo = ctx.message.reply_to_message;
      let count = 20; // default

      const parts = (ctx.message.text || '').trim().split(/\s+/);
      if (parts[1] && /^\d+$/.test(parts[1])) {
        count = Math.min(100, Math.max(1, parseInt(parts[1], 10)));
      }

      const startMsgId = replyTo ? replyTo.message_id : ctx.message.message_id;
      const msgsToDelete = [];

      for (let i = 0; i <= count; i++) {
        msgsToDelete.push(startMsgId - i);
      }

      // Borrar comando inicial
      try {
        await ctx.deleteMessage();
      } catch {}

      // Borrar por lotes
      let deleted = 0;
      for (const mId of msgsToDelete) {
        try {
          await ctx.api.deleteMessage(ctx.chat.id, mId);
          deleted++;
        } catch {}
      }

      const confirmation = await ctx.reply(`🧹 <i>Limpieza completada: ${deleted} mensajes eliminados.</i>`, { parse_mode: 'HTML' });
      setTimeout(async () => {
        try {
          await ctx.api.deleteMessage(ctx.chat.id, confirmation.message_id);
        } catch {}
      }, 5000);
    } catch (err) {
      console.error('⟡ Error en /purge:', err.message);
    }
  });

  // ── Callbacks de Alerta de Staff Anti-Raid ──
  bot.callbackQuery(/^antiraid_unlock:(-?\d+)$/, requireStaff(), async (ctx) => {
    try {
      const targetChatId = parseInt(ctx.match[1], 10);
      await ctx.answerCallbackQuery({ text: 'Normalizando grupo...' });
      await antiRaid.disableLockdown(ctx.api, targetChatId);
      await ctx.editMessageText(
        ctx.callbackQuery.message.text + '\n\n✅ <b>LOCKDOWN LEVANTADO POR EL STAFF</b>',
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      await ctx.answerCallbackQuery({ text: `Error: ${err.message}`, show_alert: true });
    }
  });

  bot.callbackQuery(/^antiraid_purge:(-?\d+)$/, requireStaff(), async (ctx) => {
    try {
      const targetChatId = parseInt(ctx.match[1], 10);
      await ctx.answerCallbackQuery({ text: 'Expulsando atacantes...' });

      const raiders = antiRaid.getActiveRaiders(targetChatId);
      let bannedCount = 0;

      for (const r of raiders) {
        try {
          await ctx.api.banChatMember(targetChatId, r.id || r.userId);
          bannedCount++;
        } catch {}
      }

      await ctx.reply(`🛡️ <b>Purga completada:</b> <code>${bannedCount}</code> cuentas del raid expulsadas permanentemente.`, { parse_mode: 'HTML' });
    } catch (err) {
      await ctx.answerCallbackQuery({ text: `Error: ${err.message}`, show_alert: true });
    }
  });
}

module.exports = { register };
