const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const { getEffectiveOwners } = require('../../middleware/auth');
const { InlineKeyboard } = require('grammy');
const { mentionFromData, escapeHtml } = require('../../utils/formatting');
const userbot = require('../../userbot/client');

/**
 * Comprueba si el usuario tiene autorización para utilizar el radar de búsqueda
 * (Owner del bot principal, Owner del sub-bot o Staff autorizado con rol administrativo).
 */
async function isAuthorizedForSearch(ctx) {
  const userId = ctx.from?.id;
  if (!userId) return false;

  const effectiveOwners = getEffectiveOwners(ctx);
  if (Array.isArray(effectiveOwners) && effectiveOwners.some(id => Number(id) === Number(userId))) {
    return true;
  }

  const tenantId = ctx.tenant?.id || null;
  const member = await db.getStaffMember(userId, tenantId);
  if (member && member.role) {
    const rolesUpper = member.role.toUpperCase();
    if (rolesUpper.includes('OWNER') || rolesUpper.includes('ADMIN') || rolesUpper.includes('MOD') || rolesUpper.includes('TRATO')) {
      return true;
    }
  }

  // Si se ejecuta dentro de un grupo oficial, permitir a los administradores del grupo
  if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
    try {
      const chatMember = await ctx.api.getChatMember(ctx.chat.id, userId);
      if (['creator', 'administrator'].includes(chatMember.status)) {
        return true;
      }
    } catch {}
  }

  return false;
}

/**
 * Limpia y extrae el nombre, @username o ID eliminando cualquier frase o prefijo en español
 */
function cleanSearchQuery(rawText) {
  let q = (rawText || '').trim();

  // Quitar prefijos de comandos si vinieron con /buscar o /radar
  q = q.replace(/^\/(?:buscar|radar)\s*/i, '');

  // Quitar frases de lenguaje natural comunes
  q = q.replace(/^(?:b[uú]scame\s+a\s+el\s+usuario|b[uú]scame\s+al\s+usuario|busca\s+a\s+el\s+usuario|busca\s+al\s+usuario|b[uú]scame\s+a|busca\s+a|b[uú]scame|buscar\s+a|ub[ií]came\s+a|rastrea\s+a)\s+/i, '');
  q = q.replace(/^(?:el\s+usuario\s+|al\s+usuario\s+|a\s+)/i, '');
  return q.trim();
}

/**
 * Radar de Detección de Multicuentas y Clones en la Comunidad Aislada
 */
async function executeMultiRadar(ctx) {
  const tenantId = ctx.tenant?.id || null;
  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';

  await ctx.replyWithChatAction('typing');

  const { groups, totalUsersAnalyzed } = await db.findMultiAccounts(tenantId);

  if (!groups || groups.length === 0) {
    return ctx.reply(
      `⟡ <b>RADAR DE DETECCIÓN</b> ⊱ <code>MULTICUENTAS Y CLONES</code> ⊰\n` +
      `══════\n\n` +
      `▸ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n` +
      `▸ <b>Cuentas Analizadas:</b> <code>${totalUsersAnalyzed}</code>\n\n` +
      `✓ <i>No se detectaron cuentas sospechosas de duplicidad o nombres clonados en la comunidad activa.</i>`,
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }
    );
  }

  let text =
    `⟡ <b>RADAR DE DETECCIÓN</b> ⊱ <code>MULTICUENTAS Y CLONES</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n` +
    `▸ <b>Cuentas Analizadas:</b> <code>${totalUsersAnalyzed}</code>\n` +
    `▸ <b>Patrones Detectados:</b> <b>${groups.length} grupos sospechosos</b>\n\n` +
    `──────\n\n`;

  // Limitar a los 10 grupos más notorios para no exceder límites de Telegram
  const displayGroups = groups.slice(0, 10);

  for (let idx = 0; idx < displayGroups.length; idx++) {
    const grp = displayGroups[idx];
    text += `◈ <b>Grupo #${idx + 1}:</b> Patrón "<code>${escapeHtml(grp.pattern)}</code>" ⊱ <b>${grp.users.length} cuentas</b> ⊰\n`;
    text += `  ▪ <i>Motivo: ${escapeHtml(grp.reason)}</i>\n`;

    for (let uIdx = 0; uIdx < grp.users.length; uIdx++) {
      const u = grp.users[uIdx];
      const userAt = u.username ? `@${escapeHtml(u.username)}` : '<i>Sin @</i>';
      const uName = escapeHtml(u.first_name || 'Sin nombre');
      text += `  ▸ <b>${uIdx + 1}.</b> ${userAt} | <code>${u.user_id}</code> ⊰ (${uName})\n`;
    }
    text += `\n`;
  }

  if (groups.length > 10) {
    text += `▪ <i>... y ${groups.length - 10} patrones adicionales detectados.</i>\n\n`;
  }

  text += `══════\n▪ <i>Verificado en la comunidad exclusiva. Monitorea o investiga los usuarios sospechosos.</i>`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

/**
 * Radar de Rastrear Cuentas sin @ (Ghost / Burner accounts)
 */
async function executeNoUsernameRadar(ctx) {
  const tenantId = ctx.tenant?.id || null;
  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';

  await ctx.replyWithChatAction('typing');

  const { users, total, totalCommunity } = await db.getUsersWithoutUsername(tenantId, 25);

  if (!users || users.length === 0) {
    return ctx.reply(
      `⟡ <b>RADAR DE RASTREO</b> ⊱ <code>USUARIOS SIN ALIAS (@)</code> ⊰\n` +
      `══════\n\n` +
      `▸ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n` +
      `▸ <b>Total Comunidad:</b> <code>${totalCommunity}</code>\n\n` +
      `✓ <i>Todos los usuarios registrados en esta comunidad cuentan con un @username público asignado.</i>`,
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }
    );
  }

  let text =
    `⟡ <b>RADAR DE RASTREO</b> ⊱ <code>USUARIOS SIN ALIAS (@)</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n` +
    `▸ <b>Total sin @:</b> <b>${total}</b> (de <code>${totalCommunity}</code> miembros)\n\n` +
    `──────\n\n`;

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const targetName = escapeHtml(u.first_name || 'Sin nombre registrado');
    text += `▸ <b>${i + 1}.</b> ${targetName} | <code>${u.user_id}</code> ⊰\n`;
    text += `  ↳ <a href="tg://user?id=${u.user_id}">Ver Perfil en Telegram</a>\n`;
  }

  if (total > users.length) {
    text += `\n▪ <i>Mostrando los primeros ${users.length} de ${total} usuarios sin @username.</i>\n`;
  }

  text += `\n══════\n▪ <i>Las cuentas sin @ son comúnmente empleadas como burner accounts para evasión de radar.</i>`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

/**
 * Ejecución del Radar de Búsqueda Individual o por Palabras Cortas
 */
async function executeSearch(ctx, rawQuery) {
  const query = cleanSearchQuery(rawQuery);
  const tenantId = ctx.tenant?.id || null;
  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';

  if (!query) {
    return ctx.reply(
      `${SYM.DIVIDER}\n` +
      `⟡ <b>RADAR DE RASTREO DE USUARIOS</b> ⊱ <code>${escapeHtml(communityName)}</code> ⊰\n` +
      `${SYM.DIVIDER}\n\n` +
      `▸ <b>Búsqueda Natural:</b> <code>Búscame a [nombre, @user o ID]</code>\n` +
      `▸ <b>Multicuentas:</b> <code>Búscame a todas las cuentas multis que hay</code>\n` +
      `▸ <b>Cuentas sin @:</b> <code>Búscame a todo los que no tienen @</code>\n\n` +
      `▪ <i>Optimizado con tolerancia a palabras cortas, nombres parciales y detección multi-tenant aislada.</i>\n\n` +
      `${SYM.THIN_LINE}\n` +
      `▸ <b>Comandos Directos:</b>\n` +
      `• <code>/buscar [nombre, @ o ID]</code>\n` +
      `• <code>/multis</code> — Radar de multicuentas\n` +
      `• <code>/sinusername</code> — Radar de usuarios sin @`,
      { parse_mode: 'HTML' }
    );
  }

  await ctx.replyWithChatAction('typing');

  const cleanNoAt = query.replace(/^@/, '').trim();

  // 1. Buscar en la Comunidad Aislada (respetando tenantId)
  let results = await db.searchUsers(cleanNoAt, tenantId);

  // 1.5. Si no hay en BD o hay pocos resultados y estamos en el BOT PRINCIPAL, usar Userbot MTProto
  // (IMPORTANTE: Nunca ejecutar userbot en sub-bots para preservar aislamiento estricto)
  if (!tenantId && userbot.isConnected()) {
    try {
      const ubResults = await userbot.searchCommunityUsers(cleanNoAt);
      if (ubResults && ubResults.length > 0) {
        for (const u of ubResults) {
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

  // 2. Revisar en la Lista Negra / Quemados si no se encontró en la comunidad
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
      `✗ <i>No se localizaron coincidencias para:</i> <code>${escapeHtml(query)}</code>\n` +
      `▸ <b>Comunidad analizada:</b> <code>${escapeHtml(communityName)}</code>\n\n` +
      `──────\n` +
      `▪ <i>Verifica que el nombre o @username esté bien escrito. Puedes buscar por nombre, alias (@user), palabra clave o ID numérico.</i>`,
      { parse_mode: 'HTML' }
    );
  }

  // Enriquecer resultados con estado de pertenencia a los grupos de este tenant
  const groups = await db.getAllGroups(tenantId).catch(() => []);
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
          detectedGroupName = grp.title || grp.group_name || null;
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

    let communityStatus = '';
    let communityShortStatus = '';
    if (isInActiveGroup) {
      communityStatus = `[ ACTIVO ] (Miembro en: <code>${escapeHtml(detectedGroupName || 'Grupo Oficial')}</code>)`;
      communityShortStatus = '✓ En Comunidad';
    } else if (isDbUser) {
      communityStatus = '[ REGISTRADO ] (Base de Datos)';
      communityShortStatus = '✓ Registrado';
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

  // Ordenar por relevancia inteligente (coincidencia de prefijo, exacto, pertenencia a comunidad)
  const cleanNorm = query.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const queryWords = cleanNorm.split(/\s+/).filter(Boolean);
  const queryNoSpaces = cleanNorm.replace(/[\s_\-\.]+/g, '');

  function calculateUserScore(u) {
    let s = 0;
    const normFirst = (u.first_name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normUser = (u.username || '').toLowerCase();
    const normFirstNoSpaces = normFirst.replace(/[\s_\-\.]+/g, '');
    const normUserNoSpaces = normUser.replace(/[\s_\-\.]+/g, '');

    // Coincidencia exacta
    if (normFirst === cleanNorm || normUser === cleanNorm) s += 200;

    // Coincidencia de prefijo
    if (normFirstNoSpaces.startsWith(queryNoSpaces)) s += 150;
    if (normUserNoSpaces.startsWith(queryNoSpaces)) s += 120;

    // Contiene subcadena
    if (normFirstNoSpaces.includes(queryNoSpaces)) s += 80;
    if (normUserNoSpaces.includes(queryNoSpaces)) s += 60;

    if (queryWords.length > 1 && queryWords.every((w) => normFirst.includes(w) || normFirstNoSpaces.includes(w))) s += 100;

    // Pertenencia a la comunidad
    if (u.isInActiveGroup) s += 80;
    if (u.isDbUser) s += 50;
    if (u.is_burned) s += 30;

    // Penalizar cuentas de bot
    if (normUser.endsWith('bot')) s -= 120;

    return s;
  }

  finalResults.sort((a, b) => calculateUserScore(b) - calculateUserScore(a));

  // Mostrar el primer resultado en Modo Furtivo con detalles completos
  const firstUser = finalResults[0];
  const requesterName = ctx.from?.first_name || 'amigo';
  const targetName = escapeHtml(firstUser.first_name || 'Sin nombre registrado');
  const targetUsername = firstUser.username 
    ? `@${escapeHtml(firstUser.username)}` 
    : '<i>Sin @username</i>';

  let replyText =
    `Lo encontré para ti <b>${escapeHtml(requesterName)}</b>, toma:\n\n` +
    `<b>☰ [ MODO FURTIVO ] ⊱ ${escapeHtml(communityName)} ⊰</b>\n` +
    `──────\n\n` +
    `▸ <b>Nombre:</b> ${targetName}\n` +
    `▸ <b>ID:</b> <code>${firstUser.user_id}</code>\n` +
    `▸ <b>User:</b> ${targetUsername}\n` +
    `▸ <b>Estado:</b> <i>${firstUser.communityShortStatus || 'Registrado'}</i>\n` +
    `▸ <b>Link:</b> <a href="tg://user?id=${firstUser.user_id}">Presiona aquí</a>`;

  // Si hay más coincidencias, desplegar lista compacta de las demás encontradas
  if (finalResults.length > 1) {
    replyText += `\n\n${SYM.THIN_LINE}\n▸ <b>Otras coincidencias encontradas (${finalResults.length - 1}):</b>\n`;
    const others = finalResults.slice(1, 6);
    for (const other of others) {
      const oName = escapeHtml(other.first_name || 'Sin nombre');
      const oUser = other.username ? `@${escapeHtml(other.username)}` : '<i>Sin @</i>';
      replyText += `• ${oName} | ${oUser} | <code>${other.user_id}</code> ⊰\n`;
    }
    if (finalResults.length > 6) {
      replyText += `▪ <i>... y ${finalResults.length - 6} coincidencias adicionales.</i>\n`;
    }
  }

  await ctx.reply(replyText, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

/**
 * Enrutador de consultas de búsqueda
 */
async function routeSearch(ctx, rawText) {
  const text = (rawText || '').trim();

  // Patrón de Multicuentas y Clones
  const isMultiQuery = /(?:cuentas?\s+multis?|multicuentas|multis|clones|posibles\s+clones)/i.test(text);

  // Patrón de Cuentas sin @
  const isNoAtQuery = /(?:sin\s*@|sin\s+arroba|sin\s+username|sin\s+alias|que\s+no\s+tienen\s+@)/i.test(text);

  if (isMultiQuery) {
    return executeMultiRadar(ctx);
  }

  if (isNoAtQuery) {
    return executeNoUsernameRadar(ctx);
  }

  return executeSearch(ctx, text);
}

function register(bot) {
  // ── Comandos Slash Directos (/buscar, /radar, /multis, /sinusername, /sinat) ──
  bot.command(['buscar', 'radar'], async (ctx) => {
    if (!await isAuthorizedForSearch(ctx)) return;
    const args = ctx.message?.text?.split(/\s+/).slice(1).join(' ').trim();
    if (!args) {
      return executeSearch(ctx, '');
    }
    await routeSearch(ctx, args);
  });

  bot.command(['multis', 'clones'], async (ctx) => {
    if (!await isAuthorizedForSearch(ctx)) return;
    await executeMultiRadar(ctx);
  });

  bot.command(['sinusername', 'sinat'], async (ctx) => {
    if (!await isAuthorizedForSearch(ctx)) return;
    await executeNoUsernameRadar(ctx);
  });

  // ── Listener de Lenguaje Natural Exclusivo para Owners y Staff Autorizado ──
  bot.on('message:text', async (ctx, next) => {
    const text = (ctx.message?.text || '').trim();
    if (!text || text.startsWith('/')) return next();

    // Detección de intenciones de búsqueda en lenguaje natural
    const isMultiQuery = /^(?:b[uú]scame\s+(?:a\s+)?(?:todas?\s+)?(?:las?\s+)?cuentas?\s+multis?|b[uú]scame\s+(?:a\s+)?(?:las?\s+)?multis?|busca\s+(?:a\s+)?(?:todas?\s+)?(?:las?\s+)?cuentas?\s+multis?|busca\s+(?:a\s+)?(?:las?\s+)?multis?|cuentas?\s+multis?|multicuentas|posibles\s+clones|clones|radar\s+multis?)/i.test(text);

    const isNoAtQuery = /^(?:b[uú]scame\s+a\s+tod[oa]s?\s+los?\s+que\s+no\s+tienen\s+@|b[uú]scame\s+a\s+los?\s+que\s+no\s+tienen\s+@|b[uú]scame\s+a\s+los?\s+sin\s+@|busca\s+a\s+tod[oa]s?\s+los?\s+que\s+no\s+tienen\s+@|busca\s+a\s+los?\s+que\s+no\s+tienen\s+@|busca\s+a\s+los?\s+sin\s+@|usuarios?\s+sin\s+@|usuarios?\s+sin\s+alias|sin\s+@|sin\s+arroba|sin\s+username|radar\s+sin\s+@)/i.test(text);

    const isSearchPattern = /^(?:b[uú]scame\s+a\s+el\s+usuario|b[uú]scame\s+al\s+usuario|busca\s+a\s+el\s+usuario|busca\s+al\s+usuario|b[uú]scame\s+a|busca\s+a|b[uú]scame|buscar\s+a|ub[ií]came\s+a|rastrea\s+a)\s+/i.test(text);

    if (isMultiQuery || isNoAtQuery || isSearchPattern) {
      if (!await isAuthorizedForSearch(ctx)) return next();
      try {
        if (isMultiQuery) {
          await executeMultiRadar(ctx);
          return;
        }
        if (isNoAtQuery) {
          await executeNoUsernameRadar(ctx);
          return;
        }
        await executeSearch(ctx, text);
        return;
      } catch (err) {
        console.error('⟡ Error en natural search:', err.message);
      }
    }

    return next();
  });

  // ── Callback: Confirmar Quemar (GBan) desde el Radar ──
  bot.callbackQuery(/^search_gban:(\d+)$/, async (ctx, next) => {
    if (!await isAuthorizedForSearch(ctx)) {
      return ctx.answerCallbackQuery({ text: '⟡ Acción exclusiva para Owners / Staff autorizado.', show_alert: true });
    }
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
  bot.callbackQuery(/^search_gban_confirm:(\d+)$/, async (ctx, next) => {
    if (!await isAuthorizedForSearch(ctx)) {
      return ctx.answerCallbackQuery({ text: '⟡ Acción exclusiva para Owners / Staff autorizado.', show_alert: true });
    }
    try {
      const targetId = parseInt(ctx.match[1]);
      const tenantId = ctx.tenant?.id || null;
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

      // 2. Banear en los grupos registrados del tenant correspondiente
      const groups = await db.getAllGroups(tenantId);
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
  executeSearch,
  executeMultiRadar,
  executeNoUsernameRadar,
};
