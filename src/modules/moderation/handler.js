const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const { requireStaff } = require('../../middleware/auth');
const { extractTarget } = require('../../utils/helpers');
const { formatId, escapeHtml } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');
const logger = require('./logger');

// ══════════════════════════════════════════════════════
// ⟡ Módulo 5: Comandos de Moderación Base
// ══════════════════════════════════════════════════════

function register(bot) {
  // ── 🛡️ CAPA 2 BLACKLIST DINÁMICO: Interceptor en Tiempo Real de Mensajes ──
  bot.on('message', async (ctx, next) => {
    try {
      if (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group') {
        const sender = ctx.from;
        if (sender && !sender.is_bot) {
          const isBurned = await db.isUserBurned(sender.id, sender.username);
          if (isBurned) {
            console.warn(`🚨 [BLACKLIST DINÁMICO] Mensaje interceptado de estafador: ${sender.id} (@${sender.username}) en ${ctx.chat.id}`);
            try {
              await ctx.deleteMessage();
            } catch {}
            try {
              await ctx.api.banChatMember(ctx.chat.id, sender.id);
            } catch {}
            return; // Cortar el flujo por completo
          }
        }
      }
    } catch {}
    return next();
  });

  // ── /ban ──
  bot.command('ban', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(
          `${SYM.CROSS} Este comando solo funciona en grupos.`,
          { parse_mode: 'HTML' }
        );
      }

      const target = extractTarget(ctx);
      if (!target || !target.userId) {
        return ctx.reply(
          `${SYM.DIAMOND} <b>Uso:</b> <code>/ban [ID o responder a mensaje]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      // Extraer razón (todo después del primer argumento)
      const text = ctx.message.text || '';
      const parts = text.split(/\s+/);
      const reason = parts.slice(2).join(' ') || 'Sin especificar';

      await ctx.api.banChatMember(ctx.chat.id, target.userId);

      await ctx.reply(
        `${SYM.DIAMOND} <b>Usuario Baneado</b>\n\n` +
        `${SYM.ARROW} ID: ${formatId(target.userId)}\n` +
        `${SYM.ARROW} Razón: ${reason}`,
        { parse_mode: 'HTML' }
      );

      // Log en BD y canal
      await db.addModLog('BAN', ctx.from.id, target.userId, ctx.chat.id, reason);
      await logger.sendLog(ctx.api, 'BAN', ctx.from, target.userId, ctx.chat.title, reason);
    } catch (err) {
      console.error('⟡ Mod: Error en /ban:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al banear: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /unban ──
  bot.command('unban', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(
          `${SYM.CROSS} Este comando solo funciona en grupos.`,
          { parse_mode: 'HTML' }
        );
      }

      const target = extractTarget(ctx);
      if (!target || !target.userId) {
        return ctx.reply(
          `${SYM.DIAMOND} <b>Uso:</b> <code>/unban [ID o responder a mensaje]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      await ctx.api.unbanChatMember(ctx.chat.id, target.userId, { only_if_banned: true });

      await ctx.reply(
        `${SYM.DIAMOND} <b>Usuario Desbaneado</b>\n\n` +
        `${SYM.CHECK} ${formatId(target.userId)} puede volver a unirse.`,
        { parse_mode: 'HTML' }
      );

      await db.addModLog('UNBAN', ctx.from.id, target.userId, ctx.chat.id, null);
      await logger.sendLog(ctx.api, 'UNBAN', ctx.from, target.userId, ctx.chat.title, null);
    } catch (err) {
      console.error('⟡ Mod: Error en /unban:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al desbanear: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /mute ──
  bot.command('mute', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(
          `${SYM.CROSS} Este comando solo funciona en grupos.`,
          { parse_mode: 'HTML' }
        );
      }

      const target = extractTarget(ctx);
      if (!target || !target.userId) {
        return ctx.reply(
          `${SYM.DIAMOND} <b>Uso:</b> <code>/mute [ID o responder a mensaje]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      const text = ctx.message.text || '';
      const parts = text.split(/\s+/);
      const reason = parts.slice(2).join(' ') || 'Sin especificar';

      await ctx.api.restrictChatMember(ctx.chat.id, target.userId, {
        permissions: {
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
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
          can_manage_topics: false,
        },
      });

      await ctx.reply(
        `${SYM.DIAMOND} <b>Usuario Silenciado</b>\n\n` +
        `${SYM.ARROW} ID: ${formatId(target.userId)}\n` +
        `${SYM.ARROW} Razón: ${reason}`,
        { parse_mode: 'HTML' }
      );

      await db.addModLog('MUTE', ctx.from.id, target.userId, ctx.chat.id, reason);
      await logger.sendLog(ctx.api, 'MUTE', ctx.from, target.userId, ctx.chat.title, reason);
    } catch (err) {
      console.error('⟡ Mod: Error en /mute:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al silenciar: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /unmute ──
  bot.command('unmute', requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(
          `${SYM.CROSS} Este comando solo funciona en grupos.`,
          { parse_mode: 'HTML' }
        );
      }

      const target = extractTarget(ctx);
      if (!target || !target.userId) {
        return ctx.reply(
          `${SYM.DIAMOND} <b>Uso:</b> <code>/unmute [ID o responder a mensaje]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      await ctx.api.restrictChatMember(ctx.chat.id, target.userId, {
        permissions: {
          can_send_messages: true,
          can_send_audios: true,
          can_send_documents: true,
          can_send_photos: true,
          can_send_videos: true,
          can_send_video_notes: true,
          can_send_voice_notes: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
          can_change_info: false,
          can_invite_users: true,
          can_pin_messages: false,
          can_manage_topics: false,
        },
      });

      await ctx.reply(
        `${SYM.DIAMOND} <b>Silencio Removido</b>\n\n` +
        `${SYM.CHECK} ${formatId(target.userId)} puede escribir nuevamente.`,
        { parse_mode: 'HTML' }
      );

      await db.addModLog('UNMUTE', ctx.from.id, target.userId, ctx.chat.id, null);
      await logger.sendLog(ctx.api, 'UNMUTE', ctx.from, target.userId, ctx.chat.title, null);
    } catch (err) {
      console.error('⟡ Mod: Error en /unmute:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al remover silencio: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /gban (Baneo Global Permanente de todos los grupos y lista negra) ──
  bot.command('gban', requireStaff(), async (ctx) => {
    try {
      const { resolveTarget } = require('../../utils/helpers');
      const target = await resolveTarget(ctx);

      if (!target || !target.userId) {
        return ctx.reply(
          `${SYM.DIAMOND} <b>Uso:</b> <code>/gban [ID / @username / Responder] [Motivo]</code>\n\n` +
          `${SYM.ARROW} Banea al usuario <b>permanentemente de todos los grupos oficiales</b> y lo añade a la lista negra.`,
          { parse_mode: 'HTML' }
        );
      }

      // Evitar auto-gban y gban a Owners
      if (config.OWNER_IDS.includes(target.userId)) {
        return ctx.reply(`${SYM.CROSS} No se puede aplicar baneo global a un Owner del sistema.`, {
          parse_mode: 'HTML',
        });
      }

      // Extraer razón
      const text = ctx.message.text || '';
      const parts = text.split(/\s+/);
      const reason = parts.slice(2).join(' ') || 'Sanción por estafa / infracción grave';

      // 1. Obtener todos los grupos oficiales
      const groups = await db.getAllGroups();
      let bannedCount = 0;

      // Banear en el chat actual si es grupo
      if (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group') {
        try {
          await ctx.api.banChatMember(ctx.chat.id, target.userId);
          bannedCount++;
        } catch {}
      }

      // Banear en todos los demás grupos registrados
      for (const grp of groups) {
        if (grp.chat_id !== ctx.chat.id) {
          try {
            await ctx.api.banChatMember(grp.chat_id, target.userId);
            bannedCount++;
          } catch {}
        }
      }

      // 2. Guardar en lista negra permanente (burned_users)
      await db.burnUser(target.userId, ctx.from.id, `GBAN: ${reason}`, ctx.from.id);

      // 3. Registrar log
      await db.addModLog('GBAN', ctx.from.id, target.userId, ctx.chat.id, reason);
      await logger.sendLog(ctx.api, 'GBAN', ctx.from, target.userId, ctx.chat.title || 'Global', reason);

      const targetMention = target.username ? `@${target.username}` : `<code>${target.userId}</code>`;

      await ctx.reply(
        `${SYM.DIVIDER}\n` +
        `${SYM.CROSS} <b>BANEO GLOBAL APLICADO (GBAN)</b> ${SYM.CROSS}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CROSS} <b>Usuario:</b> ${targetMention}\n` +
        `${SYM.ARROW} <b>ID:</b> <code>${target.userId}</code>\n` +
        `${SYM.ARROW} <b>Motivo:</b> <i>${reason}</i>\n` +
        `${SYM.CHECK} <b>Grupos Sancionados:</b> <code>${bannedCount}</code>\n` +
        `${SYM.CROSS} <b>Estado:</b> <b>LISTA NEGRA PERMANENTE 🔴</b>\n\n` +
        `${SYM.THIN_LINE}\n` +
        `${SYM.STAR} El usuario no podrá unirse ni participar en ningún grupo de Ventas Libres Perú.`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Mod: Error en /gban:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al aplicar baneo global: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /ungban (Remover Baneo Global y Desbanear de todos los grupos) ──
  bot.command(['ungban', 'unburn', 'desquemar'], requireStaff(), async (ctx) => {
    try {
      const { resolveTarget } = require('../../utils/helpers');
      const target = await resolveTarget(ctx);

      if (!target || !target.userId) {
        return ctx.reply(
          `${SYM.DIAMOND} <b>Uso:</b> <code>/ungban [ID / @username / Responder]</code>\n` +
          `o también: <code>/desquemar [ID / @username]</code>\n\n` +
          `${SYM.ARROW} Quita al usuario de la lista negra y le permite volver a ingresar a los grupos.`,
          { parse_mode: 'HTML' }
        );
      }

      // 1. Remover de la lista negra en base de datos
      await db.unburnUser(target.userId);

      // 2. Desbanear de todos los grupos registrados
      const groups = await db.getAllGroups();
      let unbannedCount = 0;

      if (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group') {
        try {
          await ctx.api.unbanChatMember(ctx.chat.id, target.userId, { only_if_banned: true });
          unbannedCount++;
        } catch {}
      }

      for (const grp of groups) {
        if (grp.chat_id !== ctx.chat.id) {
          try {
            await ctx.api.unbanChatMember(grp.chat_id, target.userId, { only_if_banned: true });
            unbannedCount++;
          } catch {}
        }
      }

      // 3. Log
      await db.addModLog('UNGBAN', ctx.from.id, target.userId, ctx.chat.id, 'Removido de lista negra');
      await logger.sendLog(ctx.api, 'UNGBAN', ctx.from, target.userId, ctx.chat.title || 'Global', 'Rehabilitado');

      const targetMention = target.username ? `@${target.username}` : `<code>${target.userId}</code>`;

      await ctx.reply(
        `${SYM.DIVIDER}\n` +
        `${SYM.CHECK} <b>USUARIO REHABILITADO / REMOVIDO DE LISTA NEGRA</b> ${SYM.CHECK}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CHECK} <b>Usuario:</b> ${targetMention}\n` +
        `${SYM.ARROW} <b>ID:</b> <code>${target.userId}</code>\n` +
        `${SYM.CHECK} <b>Estado:</b> <b>LIMPIO 🟢</b>\n` +
        `${SYM.ARROW} <b>Grupos Desbloqueados:</b> <code>${unbannedCount}</code>\n\n` +
        `${SYM.THIN_LINE}\n` +
        `${SYM.STAR} El usuario ha sido eliminado de la lista de estafadores y puede volver a participar.`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Mod: Error en /ungban:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al rehabilitar usuario: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /listanegra / /blacklist / /quemados / /estafadores (Panel Interactivo de Lista Negra) ──
  bot.command(['listanegra', 'blacklist', 'quemados', 'estafadores', 'burned'], async (ctx) => {
    try {
      const text = ctx.message.text || '';
      const parts = text.trim().split(/\s+/);

      // Si se pasó una página como número: /listanegra 2
      let targetPage = 1;
      if (parts[1] && /^\d+$/.test(parts[1])) {
        targetPage = parseInt(parts[1]);
      }

      const { text: msgText, keyboard } = await renderBlacklistPage(targetPage, ctx.from.id);
      await ctx.reply(msgText, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (err) {
      console.error('⟡ Mod: Error en /listanegra:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al consultar la lista negra: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Callbacks de Paginación de Lista Negra (Protegidos por Usuario) ──
  bot.callbackQuery(/^blacklist_page:(\d+)(?::(\d+))?$/, async (ctx) => {
    try {
      const page = parseInt(ctx.match[1]);
      const ownerId = ctx.match[2] ? parseInt(ctx.match[2]) : null;

      if (ownerId && ctx.from.id !== ownerId) {
        return ctx.answerCallbackQuery({
          text: '⚠️ Este panel fue abierto por otro usuario. Ejecuta /listanegra para abrir el tuyo.',
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
      const ownerId = ctx.match[1] ? parseInt(ctx.match[1]) : null;

      if (ownerId && ctx.from.id !== ownerId) {
        return ctx.answerCallbackQuery({
          text: '⚠️ Este panel fue abierto por otro usuario. Ejecuta /listanegra para abrir el tuyo.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery();
      try {
        await ctx.deleteMessage();
      } catch {
        await ctx.editMessageText('🔒 <i>Panel de lista negra cerrado.</i>', { parse_mode: 'HTML' });
      }
    } catch (err) {
      console.error('⟡ Mod: Error en callback blacklist_close:', err.message);
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

  if (totalCount === 0 || users.length === 0) {
    return {
      text:
        `${SYM.DIVIDER}\n` +
        `🛡️ <b>LISTA NEGRA OFICIAL — VENTAS LIBRES PERÚ</b> 🛡️\n` +
        `${SYM.DIVIDER}\n\n` +
        `✓ <b>Estado de la Comunidad:</b> Limpia.\n` +
        `✓ Actualmente no hay estafadores registrados en la lista negra.\n\n` +
        `${SYM.THIN_LINE}`,
      keyboard: new InlineKeyboard().text(`${SYM.CROSS} Cerrar`, closePayload).danger(),
    };
  }

  let text =
    `${SYM.DIVIDER}\n` +
    `🚨 <b>LISTA NEGRA OFICIAL DE ESTAFADORES</b> 🚨\n` +
    `${SYM.DIVIDER}\n\n` +
    `📊 <b>Total de Estafadores Registrados:</b> <code>${totalCount}</code>\n` +
    `📑 <b>Página:</b> <code>${currentPage} / ${totalPages}</code>\n\n` +
    `${SYM.THIN_LINE}\n\n`;

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const itemNum = offset + i + 1;
    const userTag = u.username ? `@${u.username}` : (u.first_name ? `${u.first_name}` : 'Sin @Username');
    const dateFormatted = formatPeruDate(u.burned_at);
    const reason = (u.context || 'Estafa comprobada').slice(0, 150);

    text +=
      `⛔ <b>#${itemNum} | ${userTag}</b>\n` +
      `🆔 <b>ID:</b> <code>${u.user_id}</code>\n` +
      (u.username ? `🔗 <b>Username:</b> @${u.username}\n` : '') +
      `📅 <b>Fecha y Hora:</b> <code>${dateFormatted}</code>\n` +
      `📝 <b>Motivo / Hechos:</b> <i>${escapeHtml(reason)}</i>\n\n` +
      `───────────────────────\n`;
  }

  text += `🛡️ <i>Para ver el expediente individual de un usuario, escribe: <code>/info [ID o @user]</code></i>`;

  const kb = new InlineKeyboard();

  const prevPayload = ownerId ? `blacklist_page:${currentPage - 1}:${ownerId}` : `blacklist_page:${currentPage - 1}`;
  const currPayload = ownerId ? `blacklist_page:${currentPage}:${ownerId}` : `blacklist_page:${currentPage}`;
  const nextPayload = ownerId ? `blacklist_page:${currentPage + 1}:${ownerId}` : `blacklist_page:${currentPage + 1}`;

  // Fila 1: Paginación
  if (currentPage > 1) {
    kb.text('« Anterior', prevPayload).primary();
  }
  if (currentPage < totalPages) {
    kb.text('Siguiente »', nextPayload).primary();
  }

  // Fila 2: Indicador y Cerrar
  kb.row();
  kb.text(`📄 ${currentPage}/${totalPages}`, currPayload);
  kb.text(`${SYM.CROSS} Cerrar`, closePayload).danger();

  return { text, keyboard: kb };
}

module.exports = { register };
