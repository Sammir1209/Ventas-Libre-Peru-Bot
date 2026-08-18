const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const { requireOwner } = require('../../middleware/auth');
const { InlineKeyboard } = require('grammy');
const { mentionFromData, formatId, escapeHtml } = require('../../utils/formatting');

function register(bot) {
  // ── Comando /search [nombre, @username o ID] (Solo Owners) ──
  bot.command(['search', 'buscar'], requireOwner(), async (ctx) => {
    try {
      const text = ctx.message.text || '';
      const parts = text.split(/\s+/);
      const query = parts.slice(1).join(' ').trim();

      if (!query) {
        return ctx.reply(
          `${SYM.DIVIDER}\n` +
          `🔍 <b>RADAR DE BÚSQUEDA DE USUARIOS</b>\n` +
          `${SYM.DIVIDER}\n\n` +
          `➜ <b>Uso:</b> <code>/search [nombre, @username o ID]</code>\n\n` +
          `💡 <i>Permite rastrear usuarios incluso si no tienen @username registrado en Telegram, localizando su ID y estado en la comunidad.</i>\n\n` +
          `${SYM.THIN_LINE}\n` +
          `➜ <b>Ejemplo:</b> <code>/search Coder</code>\n` +
          `➜ <b>Ejemplo:</b> <code>/search @cinefastperu</code>\n` +
          `➜ <b>Ejemplo:</b> <code>/search 7794982496</code>`,
          { parse_mode: 'HTML' }
        );
      }

      await ctx.replyWithChatAction('typing');

      // 1. Buscar en Base de Datos
      let results = await db.searchUsers(query);

      // 2. Si no hubo en BD pero es un ID numérico o @username válido, intentar resolver en Telegram
      if ((!results || results.length === 0)) {
        try {
          let chatInfo = null;
          if (/^\d+$/.test(query)) {
            chatInfo = await ctx.api.getChat(Number(query));
          } else if (query.startsWith('@')) {
            chatInfo = await ctx.api.getChat(query);
          }

          if (chatInfo && chatInfo.id) {
            const burned = await db.isUserBurned(chatInfo.id, chatInfo.username);
            results = [{
              user_id: chatInfo.id,
              username: chatInfo.username || null,
              first_name: chatInfo.first_name || 'Usuario Telegram',
              is_burned: !!burned,
            }];
          }
        } catch {}
      }

      if (!results || results.length === 0) {
        return ctx.reply(
          `${SYM.DIVIDER}\n` +
          `🔍 <b>RESULTADO DE BÚSQUEDA</b>\n` +
          `${SYM.DIVIDER}\n\n` +
          `${SYM.CROSS} No se encontraron coincidencias para: <code>${escapeHtml(query)}</code>\n\n` +
          `<i>Verifica que el nombre o ID esté bien escrito.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      // Enviar resultados (hasta 5 tarjetas para evitar mensajes gigantes)
      const topResults = results.slice(0, 5);

      for (const user of topResults) {
        const userMention = mentionFromData(user.user_id, user.username, user.first_name);
        const usernameDisplay = user.username ? `@${user.username}` : '<i>(Sin @username)</i>';
        const statusBadge = user.is_burned ? '🔴 <b>QUEMADO / ESTAFADOR</b>' : '🟢 <b>LIMPIO</b>';

        const kb = new InlineKeyboard()
          .text('🔍 Verificar', `info_profile:${user.user_id}`)
          .text('🔥 Quemar (GBan)', `search_gban:${user.user_id}`);

        await ctx.reply(
          `${SYM.DIVIDER}\n` +
          `👤 <b>USUARIO ENCONTRADO</b>\n` +
          `${SYM.DIVIDER}\n\n` +
          `➜ <b>Nombre:</b> ${escapeHtml(user.first_name || 'Sin nombre')}\n` +
          `➜ <b>Username:</b> ${usernameDisplay}\n` +
          `➜ <b>ID:</b> <code>${user.user_id}</code>\n` +
          `➜ <b>Mención:</b> ${userMention}\n` +
          `➜ <b>Estado:</b> ${statusBadge}\n\n` +
          `${SYM.THIN_LINE}`,
          {
            parse_mode: 'HTML',
            reply_markup: kb,
          }
        );
      }

      if (results.length > 5) {
        await ctx.reply(`<i>... y ${results.length - 5} resultados más. Sé más específico en tu búsqueda.</i>`, { parse_mode: 'HTML' });
      }
    } catch (err) {
      console.error('⟡ Error en /search:', err.message);
      await ctx.reply(`✗ Error en búsqueda: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Callback: Confirmar Quemar (GBan) desde Search ──
  bot.callbackQuery(/^search_gban:(\d+)$/, requireOwner(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1]);
      await ctx.answerCallbackQuery();

      const user = await db.getUser(targetId) || { user_id: targetId };
      const userMention = mentionFromData(targetId, user.username, user.first_name);

      const kb = new InlineKeyboard()
        .text('🔥 Sí, Quemar y GBan', `search_gban_confirm:${targetId}`).danger()
        .text('✗ Cancelar', 'info_close').primary();

      await ctx.reply(
        `${SYM.DIVIDER}\n` +
        `⚠️ <b>CONFIRMAR QUEMADO Y GBAN</b>\n` +
        `${SYM.DIVIDER}\n\n` +
        `➜ <b>Objetivo:</b> ${userMention}\n` +
        `➜ <b>ID:</b> <code>${targetId}</code>\n\n` +
        `🚨 <b>Acción:</b> Se registrará como Estafador en la Lista Negra y será baneado globalmente de todos los grupos y canales.\n\n` +
        `${SYM.THIN_LINE}\n` +
        `¿Deseas proceder?`,
        {
          parse_mode: 'HTML',
          reply_markup: kb,
        }
      );
    } catch (err) {
      console.error('⟡ Error en search_gban callback:', err.message);
    }
  });

  // ── Callback: Ejecutar Quemado y GBan Definitivo ──
  bot.callbackQuery(/^search_gban_confirm:(\d+)$/, requireOwner(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1]);
      await ctx.answerCallbackQuery({ text: '🔥 Ejecutando GBan...' });

      const user = await db.getUser(targetId) || { user_id: targetId };
      const adminMention = mentionFromData(ctx.from.id, ctx.from.username, ctx.from.first_name);
      const userMention = mentionFromData(targetId, user.username, user.first_name);

      // 1. Quemar en BD
      await db.burnUser(
        targetId,
        user.username || null,
        user.first_name || 'Estafador',
        'Fichado por Owner mediante /search',
        `Owner (${ctx.from.id})`
      );

      // 2. Banear en todos los grupos registrados
      const groups = await db.getAllGroups();
      let bannedCount = 0;
      for (const grp of groups) {
        if (grp.chat_id && grp.type !== 'channel') {
          try {
            await ctx.api.banChatMember(grp.chat_id, targetId);
            bannedCount++;
          } catch {}
        }
      }

      await ctx.editMessageText(
        `${SYM.DIVIDER}\n` +
        `🔥 <b>USUARIO QUEMADO Y BANEADO GLOBALMENTE</b>\n` +
        `${SYM.DIVIDER}\n\n` +
        `➜ <b>Estafador:</b> ${userMention}\n` +
        `➜ <b>ID:</b> <code>${targetId}</code>\n` +
        `➜ <b>Grupos Baneados:</b> ${bannedCount}\n` +
        `➜ <b>Estado:</b> 🔴 LISTA NEGRA PERMANENTE\n\n` +
        `${SYM.THIN_LINE}\n` +
        `<i>Ejecutado por: ${adminMention}</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en search_gban_confirm callback:', err.message);
    }
  });
}

module.exports = {
  register,
};
