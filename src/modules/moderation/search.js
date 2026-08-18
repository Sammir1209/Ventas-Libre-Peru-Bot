const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const { requireOwner } = require('../../middleware/auth');
const { InlineKeyboard } = require('grammy');
const { mentionFromData, formatId, escapeHtml } = require('../../utils/formatting');

/**
 * Limpia y extrae el nombre, @username o ID eliminando cualquier frase o prefijo en español
 */
function cleanSearchQuery(rawText) {
  let q = (rawText || '').trim();

  // Quitar frases de lenguaje natural comunes
  q = q.replace(/^(?:b[uú]scame\s+a\s+el\s+usuario|b[uú]scame\s+al\s+usuario|busca\s+a\s+el\s+usuario|busca\s+al\s+usuario|b[uú]scame\s+a|busca\s+a|b[uú]scame|buscar\s+a|ub[ií]came\s+a|rastrea\s+a)\s+/i, '');
  q = q.replace(/^(?:el\s+usuario\s+|al\s+usuario\s+|a\s+)/i, '');
  return q.trim();
}

/**
 * Ejecución del Radar de Búsqueda de Usuarios
 */
async function executeSearch(ctx, rawQuery) {
  const query = cleanSearchQuery(rawQuery);

  if (!query) {
    return ctx.reply(
      `${SYM.DIVIDER}\n` +
      `🔍 <b>RADAR DE RASTREO DE USUARIOS</b>\n` +
      `${SYM.DIVIDER}\n\n` +
      `➜ <b>Uso Natural:</b> <code>Búscame a [nombre, @user o ID]</code>\n` +
      `➜ <b>O también:</b> <code>Busca a el usuario [nombre, @user o ID]</code>\n\n` +
      `💡 <i>Especialmente optimizado para localizar estafadores que no tienen @username en su cuenta de Telegram.</i>\n\n` +
      `${SYM.THIN_LINE}\n` +
      `➜ <b>Ejemplo:</b> <code>Búscame a exotic</code>\n` +
      `➜ <b>Ejemplo:</b> <code>Busca a el usuario Carlos</code>\n` +
      `➜ <b>Ejemplo:</b> <code>Búscame a @cinefastperu</code>\n` +
      `➜ <b>Ejemplo:</b> <code>Busca a 7794982496</code>`,
      { parse_mode: 'HTML' }
    );
  }

  await ctx.replyWithChatAction('typing');

  const cleanNoAt = query.replace(/^@/, '').trim();

  // 1. Buscar en Base de Datos por Nombre, Username o ID
  let results = await db.searchUsers(cleanNoAt);

  // 2. Si no hubo coincidencias en BD, intentar resolver en Telegram (por @username o ID)
  if (!results || results.length === 0) {
    try {
      let chatInfo = null;

      // Si es ID numérico
      if (/^\d+$/.test(cleanNoAt)) {
        try {
          chatInfo = await ctx.api.getChat(Number(cleanNoAt));
        } catch {}
      }

      // Si es @username o texto
      if (!chatInfo) {
        try {
          chatInfo = await ctx.api.getChat(`@${cleanNoAt}`);
        } catch {}
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

  // 3. Si sigue sin encontrar, revisar en la Lista Negra / Quemados por nombre
  if (!results || results.length === 0) {
    try {
      const burnedInfo = await db.getBurnedUserInfo(cleanNoAt);
      if (burnedInfo) {
        results = [{
          user_id: burnedInfo.user_id,
          username: burnedInfo.username || null,
          first_name: burnedInfo.first_name || 'Estafador Fichado',
          is_burned: true,
        }];
      }
    } catch {}
  }

  if (!results || results.length === 0) {
    return ctx.reply(
      `${SYM.DIVIDER}\n` +
      `🔍 <b>RADAR DE RASTREO — RESULTADO</b>\n` +
      `${SYM.DIVIDER}\n\n` +
      `${SYM.CROSS} No se encontraron coincidencias para: <code>${escapeHtml(query)}</code>\n\n` +
      `💡 <i>Verifica que el nombre, @username o ID numérico esté bien escrito.</i>`,
      { parse_mode: 'HTML' }
    );
  }

  // Enviar hasta 5 tarjetas de usuario encontradas
  const topResults = results.slice(0, 5);

  for (const user of topResults) {
    const userMention = mentionFromData(user.user_id, user.username, user.first_name);
    const usernameDisplay = user.username 
      ? `@${user.username}` 
      : '<i>⚠️ Sin @username (Cuenta Anónima)</i>';
    const statusBadge = user.is_burned 
      ? '🔴 <b>QUEMADO / ESTAFADOR</b>' 
      : '🟢 <b>LIMPIO</b>';

    const kb = new InlineKeyboard()
      .text('🔍 Verificar Info', `info_profile:${user.user_id}`)
      .text('🔥 Quemar (GBan)', `search_gban:${user.user_id}`);

    await ctx.reply(
      `${SYM.DIVIDER}\n` +
      `👤 <b>USUARIO LOCALIZADO EN EL RADAR</b>\n` +
      `${SYM.DIVIDER}\n\n` +
      `➜ <b>Nombre:</b> ${escapeHtml(user.first_name || 'Sin nombre registrado')}\n` +
      `➜ <b>Username:</b> ${usernameDisplay}\n` +
      `➜ <b>ID Numérico:</b> <code>${user.user_id}</code>\n` +
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
}

function register(bot) {
  // ── Listener de Lenguaje Natural Exclusivo para Owners ("Buscame a ...", "Busca a el usuario ...") ──
  bot.on('message:text', async (ctx, next) => {
    const userId = ctx.from?.id;
    if (config.OWNER_IDS.includes(userId)) {
      const text = (ctx.message?.text || '').trim();
      const isSearchPattern = /^(?:b[uú]scame\s+a\s+el\s+usuario|b[uú]scame\s+al\s+usuario|busca\s+a\s+el\s+usuario|busca\s+al\s+usuario|b[uú]scame\s+a|busca\s+a|b[uú]scame|buscar\s+a|ub[ií]came\s+a|rastrea\s+a)\s+/i.test(text);

      if (isSearchPattern) {
        try {
          await executeSearch(ctx, text);
          return;
        } catch (err) {
          console.error('⟡ Error en natural search:', err.message);
        }
      }
    }
    return next();
  });

  // ── Callback: Confirmar Quemar (GBan) desde el Radar ──
  bot.callbackQuery(/^search_gban:(\d+)$/, requireOwner(), async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1]);
      await ctx.answerCallbackQuery();

      const user = await db.getUser(targetId) || { user_id: targetId };
      const userMention = mentionFromData(targetId, user.username, user.first_name);

      const kb = new InlineKeyboard()
        .text('🔥 Sí, Quemar y GBan', `search_gban_confirm:${targetId}`).danger()
        .text('❌ Cancelar', 'info_close').primary();

      await ctx.reply(
        `${SYM.DIVIDER}\n` +
        `⚠️ <b>CONFIRMAR QUEMADO Y BANEO GLOBAL (GBAN)</b>\n` +
        `${SYM.DIVIDER}\n\n` +
        `➜ <b>Objetivo:</b> ${userMention}\n` +
        `➜ <b>ID:</b> <code>${targetId}</code>\n\n` +
        `🚨 <b>Acción:</b> El usuario será expulsado y bloqueado de <b>TODOS los grupos y canales oficiales</b> y quedará registrado en la Lista Negra permanentemente.\n\n` +
        `${SYM.THIN_LINE}\n` +
        `¿Estás seguro de que deseas proceder?`,
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
        'Fichado por Owner mediante radar de búsqueda',
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
