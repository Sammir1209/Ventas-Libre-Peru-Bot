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
      `⟡ <b>RADAR DE RASTREO DE USUARIOS</b> ⊱ <code>BÚSQUEDA</code> ⊰\n` +
      `${SYM.DIVIDER}\n\n` +
      `▸ <b>Uso Natural:</b> <code>Búscame a [nombre, @user o ID]</code>\n` +
      `▸ <b>O también:</b> <code>Busca a el usuario [nombre, @user o ID]</code>\n\n` +
      `▪ <i>Especialmente optimizado para localizar estafadores que no tienen @username en su cuenta de Telegram.</i>\n\n` +
      `${SYM.THIN_LINE}\n` +
      `▸ <b>Ejemplo:</b> <code>Búscame a exotic</code>\n` +
      `▸ <b>Ejemplo:</b> <code>Busca a el usuario Carlos</code>\n` +
      `▸ <b>Ejemplo:</b> <code>Búscame a @cinefastperu</code>\n` +
      `▸ <b>Ejemplo:</b> <code>Busca a 7794982496</code>`,
      { parse_mode: 'HTML' }
    );
  }

  await ctx.replyWithChatAction('typing');

  const cleanNoAt = query.replace(/^@/, '').trim();

  // 1. Buscar en Base de Datos por Nombre, Username o ID (con búsqueda tokenizada insensible a espacios)
  let results = await db.searchUsers(cleanNoAt);

  // 1.5. Si no hay en BD o hay pocos resultados, buscar usando el Userbot nativo MTProto
  if (userbot.isConnected()) {
    try {
      const ubResults = await userbot.searchCommunityUsers(cleanNoAt);
      if (ubResults && ubResults.length > 0) {
        for (const u of ubResults) {
          // Registrar en base de datos para futuras consultas rápidas
          db.upsertUser(u.user_id, u.username, u.first_name).catch(() => {});
          if (!results.some((r) => Number(r.user_id) === Number(u.user_id))) {
            results.push(u);
          }
        }
      }
    } catch (err) {
      console.warn('⟡ Error usando userbot search:', err.message);
    }
  }

  // 2. Revisar en la Lista Negra / Quemados por nombre si no se encontró
  if (!results || results.length === 0) {
    try {
      const burnedInfo = await db.getBurnedUserInfo(cleanNoAt);
      if (burnedInfo) {
        results = [{
          user_id: Number(burnedInfo.user_id),
          username: burnedInfo.username || null,
          first_name: burnedInfo.first_name || 'Estafador Fichado',
          is_burned: true,
          in_database: true,
        }];
      }
    } catch {}
  }

  if (!results || results.length === 0) {
    return ctx.reply(
      `⟡ <b>RADAR DE RASTREO</b> ⊱ <code>SIN RESULTADOS</code> ⊰\n` +
      `══════\n\n` +
      `✗ <i>No se localizaron coincidencias para:</i> <code>${escapeHtml(query)}</code>\n\n` +
      `──────\n` +
      `▪ <i>Verifica que el nombre o @username esté bien escrito. Puedes buscar por nombre completo, alias (@user) o ID numérico.</i>`,
      { parse_mode: 'HTML' }
    );
  }

  // Enriquecer resultados con estado de pertenencia a la comunidad
  const groups = await db.getAllGroups().catch(() => []);
  const finalResults = [];
  
  for (const user of results) {
    let isInActiveGroup = false;
    let detectedGroupName = null;

    for (const grp of groups) {
      if (!grp.chat_id) continue;
      try {
        const member = await ctx.api.getChatMember(grp.chat_id, user.user_id);
        if (['member', 'administrator', 'creator', 'restricted'].includes(member.status)) {
          isInActiveGroup = true;
          detectedGroupName = grp.group_name || null;
          break;
        }
      } catch {}
    }

    let isDbUser = !!user.in_database;
    if (!isDbUser) {
      try {
        const existing = await db.getUser(user.user_id);
        if (existing) isDbUser = true;
      } catch {}
    }

    // Determinar etiqueta clara de pertenencia a la comunidad
    let communityStatus = '';
    let communityShortStatus = '';
    if (isInActiveGroup) {
      communityStatus = `[ ACTIVO ] (Miembro en: <code>${escapeHtml(detectedGroupName || 'Grupo Oficial')}</code>)`;
      communityShortStatus = '✓ En Comunidad';
    } else if (isDbUser) {
      communityStatus = '[ REGISTRADO ] (Base de Datos Oficial)';
      communityShortStatus = '✓ En Comunidad';
    } else if (user.is_burned) {
      communityStatus = '[ LISTA NEGRA ] (Fichado como Estafador)';
      communityShortStatus = '✗ Lista Negra';
    } else {
      communityStatus = '[ EXTERNO ] (Usuario Externo de Telegram)';
      communityShortStatus = 'Externo';
    }

    if (!finalResults.find((u) => Number(u.user_id) === Number(user.user_id))) {
      finalResults.push({
        ...user,
        isInActiveGroup,
        detectedGroupName,
        isDbUser,
        communityStatus,
        communityShortStatus,
      });
    }
  }

  // Ordenar con algoritmo de relevancia inteligente:
  // Prioriza coincidencias exactas en nombre/alias, miembros de la comunidad y personas reales sobre bots
  const cleanNorm = query.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const queryWords = cleanNorm.split(/\s+/).filter(Boolean);
  const queryNoSpaces = cleanNorm.replace(/[\s_\-\.]+/g, '');

  function calculateUserScore(u) {
    let s = 0;
    const normFirst = (u.first_name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normUser = (u.username || '').toLowerCase();
    const normFirstNoSpaces = normFirst.replace(/[\s_\-\.]+/g, '');
    const normUserNoSpaces = normUser.replace(/[\s_\-\.]+/g, '');

    // Coincidencia de nombre
    if (normFirstNoSpaces.startsWith(queryNoSpaces)) s += 150;
    if (normFirstNoSpaces.includes(queryNoSpaces)) s += 80;
    if (queryWords.length > 1 && queryWords.every((w) => normFirst.includes(w) || normFirstNoSpaces.includes(w))) s += 100;
    if (normUserNoSpaces.startsWith(queryNoSpaces)) s += 40;

    // Pertenencia a la comunidad
    if (u.isInActiveGroup) s += 80;
    if (u.isDbUser) s += 50;
    if (u.is_burned) s += 30;

    // Penalizar bots
    if (normUser.endsWith('bot')) s -= 120;

    return s;
  }

  finalResults.sort((a, b) => calculateUserScore(b) - calculateUserScore(a));

  // Mostrar el primer resultado con el diseño exacto de Modo Furtivo
  const firstUser = finalResults[0];
  const requesterName = ctx.from?.first_name || 'amigo';
  const targetName = escapeHtml(firstUser.first_name || 'Sin nombre registrado');
  const targetUsername = firstUser.username 
    ? `@${escapeHtml(firstUser.username)}` 
    : '<i>Sin @username</i>';

  let matchNote = '';
  if (finalResults.length > 1) {
    matchNote = `\n\n▸ Coincidencias encontradas: ${finalResults.length}. Mostrando la primera.`;
  } else {
    matchNote = `\n\n▸ Se encontró 1 coincidencia.`;
  }

  const replyText =
    `Lo encontré para ti <b>${escapeHtml(requesterName)}</b>, toma:\n\n` +
    `<b>☰ [ MODO FURTIVO ]</b>\n` +
    `──────\n\n` +
    `▸ <b>Nombre:</b> ${targetName}\n` +
    `▸ <b>ID:</b> <code>${firstUser.user_id}</code>\n` +
    `▸ <b>User:</b> ${targetUsername}\n` +
    `▸ <b>Link:</b> <a href="tg://user?id=${firstUser.user_id}">Presiona aquí</a>` +
    matchNote;

  await ctx.reply(replyText, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
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
        .text('✓ Sí, Quemar y GBan', `search_gban_confirm:${targetId}`).danger()
        .text('✗ Cancelar', 'info_close').primary();

      await ctx.reply(
        `${SYM.DIVIDER}\n` +
        `⟡ <b>CONFIRMAR QUEMADO Y BANEO GLOBAL (GBAN)</b>\n` +
        `${SYM.DIVIDER}\n\n` +
        `▸ <b>Objetivo:</b> ${userMention}\n` +
        `▸ <b>ID:</b> <code>${targetId}</code>\n\n` +
        `▸ <b>Acción:</b> El usuario será expulsado y bloqueado de <b>TODOS los grupos y canales oficiales</b> y quedará registrado en la Lista Negra permanentemente.\n\n` +
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
      await ctx.answerCallbackQuery({ text: '⟡ Ejecutando GBan...' });

      const user = await db.getUser(targetId) || { user_id: targetId };
      const adminMention = mentionFromData(ctx.from.id, ctx.from.username, ctx.from.first_name);
      const userMention = mentionFromData(targetId, user.username, user.first_name);

      // 1. Quemar en BD
      await db.burnUser({
        userId: targetId,
        username: user.username || null,
        firstName: user.first_name || 'Estafador',
        context: 'Fichado mediante radar de búsqueda',
        reportedBy: ctx.from.id,
        approvedBy: ctx.from.id,
      });

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
        `⟡ <b>[ LISTA NEGRA OFICIAL ] USUARIO QUEMADO Y BANEADO</b>\n` +
        `${SYM.DIVIDER}\n\n` +
        `▸ <b>Estafador:</b> ${userMention}\n` +
        `▸ <b>ID:</b> <code>${targetId}</code>\n` +
        `▸ <b>Grupos Baneados:</b> ${bannedCount}\n` +
        `▸ <b>Estado:</b> ⊱ <code>LISTA NEGRA PERMANENTE</code> ⊰\n\n` +
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
