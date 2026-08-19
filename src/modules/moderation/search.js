const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const { requireOwner } = require('../../middleware/auth');
const { InlineKeyboard } = require('grammy');
const { mentionFromData, formatId, escapeHtml } = require('../../utils/formatting');
const userbot = require('../../userbot/client');

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

  // 1.5. Si no hay en BD, buscar usando el Userbot nativo (soporta fuentes raras y usuarios invisibles)
  if ((!results || results.length === 0) && userbot.isConnected()) {
    try {
      const groups = await db.getAllGroups();
      const chatIds = groups.map((g) => g.chat_id).filter(Boolean);
      results = await userbot.searchCommunityUsers(cleanNoAt, chatIds);

      // Guardar en base de datos para que quede registrado
      if (results && results.length > 0) {
        for (const u of results) {
          db.upsertUser(u.user_id, u.username, u.first_name).catch(() => {});
        }
      }
    } catch (err) {
      console.error('⟡ Error usando userbot search:', err.message);
    }
  }

  // 2. Revisar en la Lista Negra / Quemados por nombre si no se encontró en BD ni Userbot
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
      `${SYM.CROSS} No se encontraron coincidencias para el nombre: <code>${escapeHtml(query)}</code>\n\n` +
      `💡 <i>Verifica que el nombre esté bien escrito. Este comando busca exclusivamente por nombre (First Name) dentro de la comunidad.</i>`,
      { parse_mode: 'HTML' }
    );
  }

  // Filtrar resultados para asegurar que solo pertenecen a la comunidad
  const groups = await db.getAllGroups();
  const communityResults = [];
  
  for (const user of results) {
    let isInCommunity = false;
    for (const grp of groups) {
      if (!grp.chat_id) continue;
      try {
        const member = await ctx.api.getChatMember(grp.chat_id, user.user_id);
        if (['member', 'administrator', 'creator', 'restricted'].includes(member.status)) {
          isInCommunity = true;
          break; // Está en la comunidad
        }
      } catch {}
    }
    
    if (isInCommunity || user.is_burned) {
      // Evitar duplicados
      if (!communityResults.find(u => u.user_id === user.user_id)) {
        communityResults.push(user);
      }
    }
    
    // Limitar a máximo 6 resultados para mostrar el primero + 5 en lista
    if (communityResults.length >= 6) break;
  }

  if (communityResults.length === 0) {
    return ctx.reply(
      `${SYM.DIVIDER}\n` +
      `🔍 <b>RADAR DE RASTREO — RESULTADO</b>\n` +
      `${SYM.DIVIDER}\n\n` +
      `${SYM.CROSS} El usuario existe globalmente, pero <b>no pertenece a la comunidad</b> ni está en la base de datos de estafadores.\n\n` +
      `💡 <i>El radar está restringido para buscar solo dentro de nuestros grupos y canales oficiales.</i>`,
      { parse_mode: 'HTML' }
    );
  }

  // Mostrar el primer resultado en una tarjeta grande
  const firstUser = communityResults[0];
  const userMention = mentionFromData(firstUser.user_id, firstUser.username, firstUser.first_name);
  const usernameDisplay = firstUser.username 
    ? `@${firstUser.username}` 
    : '<i>⚠️ Sin @username (Cuenta Anónima)</i>';
  const statusBadge = firstUser.is_burned 
    ? '🔴 <b>QUEMADO / ESTAFADOR</b>' 
    : '🟢 <b>LIMPIO</b>';

  const kb = new InlineKeyboard()
    .text('🔍 Verificar Info', `info_profile:${firstUser.user_id}`)
    .text('🔥 Quemar (GBan)', `search_gban:${firstUser.user_id}`);

  let replyText = 
    `${SYM.DIVIDER}\n` +
    `👤 <b>USUARIO LOCALIZADO EN EL RADAR</b>\n` +
    `${SYM.DIVIDER}\n\n` +
    `➜ <b>Nombre:</b> ${escapeHtml(firstUser.first_name || 'Sin nombre registrado')}\n` +
    `➜ <b>Username:</b> ${usernameDisplay}\n` +
    `➜ <b>ID Numérico:</b> <code>${firstUser.user_id}</code>\n` +
    `➜ <b>Mención:</b> ${userMention}\n` +
    `➜ <b>Estado:</b> ${statusBadge}\n\n` +
    `${SYM.THIN_LINE}`;

  // Si hay más personas con nombres similares, ponerlos en una lista abajo
  if (communityResults.length > 1) {
    replyText += `\n\n👥 <b>Otros posibles resultados (${communityResults.length - 1}):</b>\n`;
    for (let i = 1; i < communityResults.length; i++) {
      const u = communityResults[i];
      const otherMention = mentionFromData(u.user_id, u.username, u.first_name);
      replyText += `• ${otherMention} (<code>${u.user_id}</code>)\n`;
    }
  }

  await ctx.reply(replyText, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
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
