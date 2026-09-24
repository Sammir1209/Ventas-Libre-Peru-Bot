const { requireStaff } = require('../../middleware/auth');
const config = require('../../config/env');
const db = require('../../database/postgres');
const { SYM } = require('../../config/constants');
const { escapeHtml, getSuperscriptDate } = require('../../utils/formatting');
const { toMathBold } = require('../../utils/aesthetic');
const { InlineKeyboard } = require('grammy');

const antiRaid = require('./antiRaid');
const antiFlood = require('./antiFlood');
const locksModule = require('./locks');
const panelHandler = require('./panelHandler');

// ══════
// ⟡ Módulo de Comandos: Seguridad, Anti-Raid & Locks
// ══════

function register(bot) {
  // Registrar comando /panel
  panelHandler.register(bot);
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

  // ── Interceptor de Miembros que Salen (Clean Service) ──
  bot.on('message:left_chat_member', async (ctx, next) => {
    try {
      if (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group') {
        const locks = await locksModule.getGroupLocks(ctx.chat.id);
        if (locks.service) {
          try {
            await ctx.deleteMessage();
          } catch {}
        }
      }
    } catch {}
    return next();
  });

  // ── /panico o /lockdown [on|off] — Modo Pánico Inmediato ──
  bot.command(['panico', 'lockdown', 'defcon'], requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`⟡ ✗ <i>Este comando solo puede ejecutarse dentro de un grupo oficial.</i>`, { parse_mode: 'HTML' });
      }

      const parts = (ctx.message.text || '').trim().split(/\s+/);
      const sub = parts[1]?.toLowerCase();
      const chatId = ctx.chat.id;

      const currentlyLocked = await antiRaid.isLockdownActive(chatId);

      if (sub === 'off' || (currentlyLocked && !sub)) {
        await antiRaid.disableLockdown(ctx.api, chatId);
        const dateFormatted = getSuperscriptDate();
        return ctx.reply(
          `<b>⟡ [SISTEMA DE SEGURIDAD] MODO PÁNICO DESACTIVADO</b>\n` +
          `──────\n\n` +
          `〖☾〗 <b>Estado:</b> ⊱ <code>CHAT RESTAURADO 🟢</code> ⊰\n` +
          `〖❖〗 <b>Operación:</b> Permisos de escritura normalizados.\n\n` +
          `──────\n` +
          `🛡️ <i>Escudo perimetral estabilizado.</i>\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      // Activar Lockdown
      await antiRaid.triggerLockdown(ctx.api, chatId, ctx.chat.title, `Activado manualmente por ${ctx.from.first_name}`);
      const dateFormatted = getSuperscriptDate();
      return ctx.reply(
        `<b>⟡ [PROTOCOLO DE EMERGENCIA] DEFCON 1</b>\n` +
        `──────\n\n` +
        `〖☾〗 <b>Estado:</b> ⊱ <code>CHAT CERRADO AL 100% (LOCKDOWN) 🔴</code> ⊰\n` +
        `〖🛡️〗 <b>Seguridad:</b> Revocados los permisos de envío a todos los miembros regulares.\n` +
        `〖❖〗 <b>Tráfico entrante:</b> Bienvenidas suspendidas para evitar saturación.\n\n` +
        `──────\n` +
        `💡 <i>Para reabrir el grupo, escribe: <code>/panico off</code></i>\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /panico:', err.message);
      await ctx.reply(`⟡ ✗ Error al modificar modo pánico: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /antiraid [on|off|sensibilidad] ──
  bot.command('antiraid', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`⟡ ✗ <i>Este comando solo puede ejecutarse dentro de un grupo oficial.</i>`, { parse_mode: 'HTML' });
      }

      const parts = (ctx.message.text || '').trim().split(/\s+/);
      const sub = parts[1]?.toLowerCase();
      const chatId = ctx.chat.id;
      const conf = await antiRaid.getAntiRaidConfig(chatId);
      const dateFormatted = getSuperscriptDate();

      if (sub === 'on') {
        conf.enabled = true;
        await antiRaid.setAntiRaidConfig(chatId, conf);
        return ctx.reply(
          `<b>⟡ [ESCUDO ANTI-RAID] MONITOREO ACTIVADO</b>\n` +
          `──────\n\n` +
          `〖☾〗 <b>Estado:</b> ⊱ <code>ACTIVADO 🟢</code> ⊰\n` +
          `〖⏱️〗 <b>Umbral:</b> <code>${conf.threshold} usuarios</code> en <code>${conf.windowMs / 1000}s</code>\n` +
          `〖⚡〗 <b>Acción Automática:</b> <b>${conf.action}</b>\n\n` +
          `──────\n` +
          `🛡️ <i>Monitoreo perimetral en tiempo real habilitado.</i>\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      if (sub === 'off') {
        conf.enabled = false;
        await antiRaid.setAntiRaidConfig(chatId, conf);
        return ctx.reply(
          `<b>⟡ [ESCUDO ANTI-RAID] DESACTIVADO</b>\n` +
          `──────\n\n` +
          `〖☾〗 <b>Estado:</b> ⊱ <code>DESACTIVADO 🔴</code> ⊰\n` +
          `〖⚠️〗 <b>Aviso:</b> Desprotegido ante ingresos masivos simultáneos.\n\n` +
          `──────\n` +
          `💡 <i>Reactiva con <code>/antiraid on</code> para asegurar la comunidad.</i>\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      if (sub === 'alta' || sub === 'high') {
        conf.threshold = 3;
        conf.windowMs = 10000;
        await antiRaid.setAntiRaidConfig(chatId, conf);
        return ctx.reply(
          `<b>⟡ [ESCUDO ANTI-RAID] SENSIBILIDAD ALTA</b>\n` +
          `──────\n\n` +
          `〖⏱️〗 <b>Ajuste:</b> Se activa con <code>3 ingresos</code> en <code>10s</code>.\n\n` +
          `──────\n` +
          `🛡️ <i>Sensibilidad máxima ante incursiones botnet.</i>\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      if (sub === 'media' || sub === 'medium') {
        conf.threshold = 6;
        conf.windowMs = 10000;
        await antiRaid.setAntiRaidConfig(chatId, conf);
        return ctx.reply(
          `<b>⟡ [ESCUDO ANTI-RAID] SENSIBILIDAD MEDIA</b>\n` +
          `──────\n\n` +
          `〖⏱️〗 <b>Ajuste:</b> Se activa con <code>6 ingresos</code> en <code>10s</code>.\n\n` +
          `──────\n` +
          `🛡️ <i>Balance equilibrado para grupos con flujo regular.</i>\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      if (sub === 'baja' || sub === 'low') {
        conf.threshold = 10;
        conf.windowMs = 10000;
        await antiRaid.setAntiRaidConfig(chatId, conf);
        return ctx.reply(
          `<b>⟡ [ESCUDO ANTI-RAID] SENSIBILIDAD BAJA</b>\n` +
          `──────\n\n` +
          `〖⏱️〗 <b>Ajuste:</b> Se activa con <code>10 ingresos</code> en <code>10s</code>.\n\n` +
          `──────\n` +
          `🛡️ <i>Tolerancia extendida para eventos o picos altos.</i>\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      const text =
        `<b>⟡ [ESCUDO ANTI-RAID] CONFIGURACIÓN</b>\n` +
        `──────\n\n` +
        `〖☾〗 <b>Estado:</b> <b>${conf.enabled ? 'ACTIVADO 🟢' : 'DESACTIVADO 🔴'}</b>\n` +
        `〖⏱️〗 <b>Umbral de Detección:</b> <code>${conf.threshold}</code> ingresos\n` +
        `〖⏱️〗 <b>Ventana de Análisis:</b> <code>${conf.windowMs / 1000}s</code>\n` +
        `〖⚡〗 <b>Acción Automática:</b> <b>${conf.action}</b>\n\n` +
        `──────\n` +
        `〖❖〗 <b>Comandos de calibración:</b>\n` +
        `  • <code>/antiraid on</code> | <code>/antiraid off</code>\n` +
        `  • <code>/antiraid alta</code> (3 usuarios en 10s)\n` +
        `  • <code>/antiraid media</code> (6 usuarios en 10s)\n` +
        `  • <code>/antiraid baja</code> (10 usuarios en 10s)\n\n` +
        `──────\n` +
        `${dateFormatted}`;

      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Error en /antiraid:', err.message);
    }
  });

  // ── /antiflood [on|off|mensajes] ──
  bot.command('antiflood', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`⟡ ✗ <i>Este comando solo puede ejecutarse dentro de un grupo oficial.</i>`, { parse_mode: 'HTML' });
      }

      const parts = (ctx.message.text || '').trim().split(/\s+/);
      const sub = parts[1]?.toLowerCase();
      const chatId = ctx.chat.id;
      const conf = await antiFlood.getAntiFloodConfig(chatId);
      const dateFormatted = getSuperscriptDate();

      if (sub === 'on') {
        conf.enabled = true;
        await antiFlood.setAntiFloodConfig(chatId, conf);
        return ctx.reply(
          `<b>⟡ [SISTEMA ANTI-FLOOD] ACTIVADO</b>\n` +
          `──────\n\n` +
          `〖☾〗 <b>Estado:</b> ⊱ <code>ACTIVADO 🟢</code> ⊰\n` +
          `〖⏱️〗 <b>Límite:</b> <code>${conf.msgLimit} mensajes</code> en <code>${conf.windowMs / 1000}s</code>\n\n` +
          `──────\n` +
          `🛡️ <i>Protección contra saturación por spam activo.</i>\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      if (sub === 'off') {
        conf.enabled = false;
        await antiFlood.setAntiFloodConfig(chatId, conf);
        return ctx.reply(
          `<b>⟡ [SISTEMA ANTI-FLOOD] DESACTIVADO</b>\n` +
          `──────\n\n` +
          `〖☾〗 <b>Estado:</b> ⊱ <code>DESACTIVADO 🔴</code> ⊰\n\n` +
          `──────\n` +
          `💡 <i>Reactiva con <code>/antiflood on</code>.</i>\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      if (/^\d+$/.test(sub)) {
        conf.msgLimit = Math.max(3, Math.min(20, parseInt(sub, 10)));
        await antiFlood.setAntiFloodConfig(chatId, conf);
        return ctx.reply(
          `<b>⟡ [SISTEMA ANTI-FLOOD] LÍMITE CALIBRADO</b>\n` +
          `──────\n\n` +
          `〖⏱️〗 <b>Nuevo Límite:</b> <code>${conf.msgLimit} mensajes</code> en <code>${conf.windowMs / 1000}s</code>\n\n` +
          `──────\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      const text =
        `<b>⟡ [SISTEMA ANTI-FLOOD] TIEMPO REAL</b>\n` +
        `──────\n\n` +
        `〖☾〗 <b>Estado:</b> <b>${conf.enabled ? 'ACTIVADO 🟢' : 'DESACTIVADO 🔴'}</b>\n` +
        `〖⏱️〗 <b>Límite de Mensajes:</b> <code>${conf.msgLimit}</code> mensajes\n` +
        `〖⏱️〗 <b>Ventana de Tiempo:</b> <code>${conf.windowMs / 1000}s</code>\n` +
        `〖🔁〗 <b>Repetición Idéntica:</b> <code>${conf.repeatLimit}</code> veces\n` +
        `〖⚖️〗 <b>Sanción Aplicada:</b> Mute por <b>${conf.muteTime}</b>\n\n` +
        `──────\n` +
        `〖❖〗 <b>Comandos:</b>\n` +
        `  • <code>/antiflood on</code> | <code>/antiflood off</code>\n` +
        `  • <code>/antiflood [número]</code> (ej. <code>/antiflood 4</code>)\n\n` +
        `──────\n` +
        `${dateFormatted}`;

      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Error en /antiflood:', err.message);
    }
  });

  // ── /lock [tipo] & /unlock [tipo] & /locks ──
  bot.command('locks', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`⟡ ✗ <i>Este comando solo puede ejecutarse dentro de un grupo oficial.</i>`, { parse_mode: 'HTML' });
      }

      const locks = await locksModule.getGroupLocks(ctx.chat.id);
      const dateFormatted = getSuperscriptDate();
      let text =
        `<b>⟡ [BLOQUEOS DE CONTENIDO] LOCKS ACTIVOS</b>\n` +
        `──────\n\n`;

      for (const item of locksModule.SUPPORTED_LOCKS) {
        const isLocked = locks[item] === true;
        text += `${isLocked ? '〖🔒〗' : '〖🔓〗'} <b>${item.toUpperCase()}:</b> ${isLocked ? '🔴 BLOQUEADO' : '🟢 PERMITIDO'}\n`;
      }

      text +=
        `\n──────\n` +
        `💡 <b>Comandos de gestión:</b>\n` +
        `  • Bloquear: <code>/lock [tipo]</code> (ej. <code>/lock links</code>)\n` +
        `  • Desbloquear: <code>/unlock [tipo]</code> (ej. <code>/unlock stickers</code>)\n\n` +
        `──────\n` +
        `${dateFormatted}`;

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
      const dateFormatted = getSuperscriptDate();

      if (!targetLock || !locksModule.SUPPORTED_LOCKS.includes(targetLock)) {
        return ctx.reply(
          `<b>⟡ [BLOQUEOS DISPONIBLES] CONFIGURACIÓN</b>\n` +
          `──────\n\n` +
          locksModule.SUPPORTED_LOCKS.map((l) => `  • <code>${l}</code>`).join('\n') +
          `\n\n──────\n` +
          `💡 <i>Ejemplo de activación: <code>/lock links</code></i>\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      const locks = await locksModule.getGroupLocks(ctx.chat.id);
      locks[targetLock] = true;
      await locksModule.setGroupLocks(ctx.chat.id, locks);

      await ctx.reply(
        `<b>⟡ [BLOQUEO ACTIVADO] ${targetLock.toUpperCase()}</b>\n` +
        `──────\n\n` +
        `〖🔒〗 <b>Restricción:</b> 🔴 <code>${targetLock.toUpperCase()}</code> queda prohibido para miembros regulares.\n\n` +
        `──────\n` +
        `🛡️ <i>Cualquier contenido detectado será purgado al instante.</i>\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /lock:', err.message);
    }
  });

  bot.command('unlock', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') return;
      const parts = (ctx.message.text || '').trim().split(/\s+/);
      const targetLock = parts[1]?.toLowerCase();
      const dateFormatted = getSuperscriptDate();

      if (!targetLock || !locksModule.SUPPORTED_LOCKS.includes(targetLock)) {
        return ctx.reply(
          `<b>⟡ [DESBLOQUEOS DISPONIBLES] CONFIGURACIÓN</b>\n` +
          `──────\n\n` +
          locksModule.SUPPORTED_LOCKS.map((l) => `  • <code>${l}</code>`).join('\n') +
          `\n\n──────\n` +
          `💡 <i>Ejemplo: <code>/unlock stickers</code></i>\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      const locks = await locksModule.getGroupLocks(ctx.chat.id);
      locks[targetLock] = false;
      await locksModule.setGroupLocks(ctx.chat.id, locks);

      await ctx.reply(
        `<b>⟡ [BLOQUEO DESACTIVADO] ${targetLock.toUpperCase()}</b>\n` +
        `──────\n\n` +
        `〖🔓〗 <b>Estado:</b> 🟢 <code>${targetLock.toUpperCase()}</code> ahora está permitido.\n\n` +
        `──────\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /unlock:', err.message);
    }
  });

  // ── /cleanservice [on|off] — Atajo directo para limpieza de mensajes de servicio de Telegram ──
  bot.command(['cleanservice', 'cleanservices', 'limpiarservicio'], requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') return;
      const parts = (ctx.message.text || '').trim().split(/\s+/);
      const sub = parts[1]?.toLowerCase();
      const locks = await locksModule.getGroupLocks(ctx.chat.id);
      const dateFormatted = getSuperscriptDate();

      if (sub === 'on') {
        locks.service = true;
        await locksModule.setGroupLocks(ctx.chat.id, locks);
        return ctx.reply(
          `<b>⟡ [LIMPIEZA DE SERVICIO] ACTIVADO</b>\n` +
          `──────\n\n` +
          `〖☾〗 <b>Modo:</b> ⊱ <code>ACTIVADO 🟢</code> ⊰\n` +
          `〖🧹〗 <b>Acción:</b> Avisos de miembros que entran/salen, cambios de foto o título serán purgados al instante.\n\n` +
          `──────\n` +
          `<i>Chat limpio y sin saturación visual.</i>\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      if (sub === 'off') {
        locks.service = false;
        await locksModule.setGroupLocks(ctx.chat.id, locks);
        return ctx.reply(
          `<b>⟡ [LIMPIEZA DE SERVICIO] DESACTIVADO</b>\n` +
          `──────\n\n` +
          `〖☾〗 <b>Modo:</b> ⊱ <code>DESACTIVADO 🔴</code> ⊰\n` +
          `〖❖〗 <b>Acción:</b> Telegram mostrará uniones, salidas y cambios de chat con normalidad.\n\n` +
          `──────\n` +
          `💡 <i>Para reactivar escribe <code>/cleanservice on</code></i>\n` +
          `${dateFormatted}`,
          { parse_mode: 'HTML' }
        );
      }

      return ctx.reply(
        `<b>⟡ [LIMPIEZA DE SERVICIO] CLEAN SERVICE</b>\n` +
        `──────\n\n` +
        `〖☾〗 <b>Estado actual:</b> ${locks.service ? '🟢 ACTIVADO (Modo Limpio)' : '🔴 DESACTIVADO'}\n` +
        `〖🧹〗 <b>Descripción:</b> Elimina automáticamente avisos de entradas, salidas y modificaciones del grupo para mantener el feed limpio.\n\n` +
        `──────\n` +
        `〖❖〗 <b>Comandos:</b>\n` +
        `  • <code>/cleanservice on</code> (Activar auto-limpieza)\n` +
        `  • <code>/cleanservice off</code> (Desactivar auto-limpieza)\n\n` +
        `──────\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /cleanservice:', err.message);
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

      const dateFormatted = getSuperscriptDate();
      const confirmation = await ctx.reply(
        `<b>⟡ [LIMPIEZA DE CHAT] PURGA COMPLETADA</b>\n` +
        `──────\n\n` +
        `〖🧹〗 <b>Mensajes purgados:</b> <code>${deleted} mensajes</code>\n\n` +
        `──────\n` +
        `<i>Se limpió el rastro de spam exitosamente.</i>\n` +
        `${dateFormatted}`,
        { parse_mode: 'HTML' }
      );
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
