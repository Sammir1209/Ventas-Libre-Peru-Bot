const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const { getEffectiveOwners } = require('../../middleware/auth');
const { InlineKeyboard } = require('grammy');
const { mentionFromData, escapeHtml } = require('../../utils/formatting');
const userbot = require('../../userbot/client');

// ── Cache en Memoria de Membresía Activa en Grupos Oficiales (TTL: 10 minutos) ──
const groupMembershipCache = new Map(); // `${chatId}:${userId}` -> { isMember: boolean, groupTitle: string, expires: number }

function markMemberInGroup(chatId, userId, isMember, groupTitle = null) {
  if (!chatId || !userId) return;
  groupMembershipCache.set(`${chatId}:${userId}`, {
    isMember: !!isMember,
    groupTitle: groupTitle || null,
    expires: Date.now() + 10 * 60 * 1000,
  });
}

function getCachedMembership(chatId, userId) {
  const entry = groupMembershipCache.get(`${chatId}:${userId}`);
  if (entry && entry.expires > Date.now()) {
    return entry;
  }
  return null;
}

/**
 * Comprueba si un usuario es miembro activo de al menos uno de los grupos oficiales provistos.
 */
async function checkUserInOfficialGroups(api, groups, userId) {
  for (const grp of groups) {
    if (!grp.chat_id) continue;
    const cached = getCachedMembership(grp.chat_id, userId);
    if (cached) {
      if (cached.isMember) {
        return { inGroup: true, groupTitle: cached.groupTitle || grp.title || 'Grupo Oficial' };
      }
      continue;
    }

    try {
      const member = await api.getChatMember(grp.chat_id, userId);
      const isMember = ['member', 'administrator', 'creator', 'restricted'].includes(member.status);
      markMemberInGroup(grp.chat_id, userId, isMember, grp.title);
      if (isMember) {
        return { inGroup: true, groupTitle: grp.title || 'Grupo Oficial' };
      }
    } catch {
      markMemberInGroup(grp.chat_id, userId, false, grp.title);
    }
  }
  return { inGroup: false, groupTitle: null };
}

/**
 * Filtra concurrentemente una lista de usuarios candidatos para conservar ÚNICAMENTE
 * a aquellos que están presentes dentro de al menos un grupo oficial del tenant.
 */
async function getActiveMembersInCommunity(api, groups, candidates) {
  if (!groups || groups.length === 0 || !candidates || candidates.length === 0) return [];
  const activeMembers = [];
  const BATCH_SIZE = 15;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const chunk = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      chunk.map(async (u) => {
        const { inGroup, groupTitle } = await checkUserInOfficialGroups(api, groups, u.user_id);
        if (inGroup) {
          return {
            ...u,
            isInActiveGroup: true,
            detectedGroupName: groupTitle,
          };
        }
        return null;
      })
    );

    for (const res of results) {
      if (res) activeMembers.push(res);
    }
  }

  return activeMembers;
}

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
 * Radar de Detección de Multicuentas y Clones en la Comunidad Aislada.
 * Filtra estrictamente solo usuarios que estén dentro de los grupos oficiales.
 */
async function executeMultiRadar(ctx) {
  const tenantId = ctx.tenant?.id || null;
  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
  const groups = await db.getAllGroups(tenantId).catch(() => []);

  if (!groups || groups.length === 0) {
    return ctx.reply(
      `⟡ <b>RADAR DE DETECCIÓN</b> ⊱ <code>MULTICUENTAS Y CLONES</code> ⊰\n` +
      `══════\n\n` +
      `▸ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n\n` +
      `✗ <i>No hay grupos oficiales registrados para esta comunidad. Registra grupos con /addgrupo.</i>`,
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
    );
  }

  await ctx.replyWithChatAction('typing');

  // 1. Obtener candidatos y filtrar ÚNICAMENTE a los que están físicamente en los grupos oficiales
  const candidates = await db.getCommunityUsers(tenantId);
  const activeMembersInGroups = await getActiveMembersInCommunity(ctx.api, groups, candidates);

  const { groups: multiGroups, totalUsersAnalyzed } = await db.findMultiAccounts(tenantId, activeMembersInGroups);

  if (!multiGroups || multiGroups.length === 0) {
    return ctx.reply(
      `⟡ <b>RADAR DE DETECCIÓN</b> ⊱ <code>MULTICUENTAS Y CLONES</code> ⊰\n` +
      `══════\n\n` +
      `▸ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n` +
      `▸ <b>Grupos Oficiales Analizados:</b> <code>${groups.length}</code>\n` +
      `▸ <b>Miembros en Grupos Analizados:</b> <code>${totalUsersAnalyzed}</code>\n\n` +
      `✓ <i>No se detectaron cuentas sospechosas de multicuentas entre los miembros activos de los grupos de la comunidad.</i>`,
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
    `▸ <b>Grupos Oficiales:</b> <code>${groups.length}</code>\n` +
    `▸ <b>Miembros en Grupos Analizados:</b> <code>${totalUsersAnalyzed}</code>\n` +
    `▸ <b>Patrones Detectados:</b> <b>${multiGroups.length} grupos sospechosos</b>\n\n` +
    `──────\n\n`;

  const displayGroups = multiGroups.slice(0, 10);

  for (let idx = 0; idx < displayGroups.length; idx++) {
    const grp = displayGroups[idx];
    text += `◈ <b>Grupo #${idx + 1}:</b> Patrón "<code>${escapeHtml(grp.pattern)}</code>" ⊱ <b>${grp.users.length} cuentas</b> ⊰\n`;
    text += `  ▪ <i>Motivo: ${escapeHtml(grp.reason)}</i>\n`;

    for (let uIdx = 0; uIdx < grp.users.length; uIdx++) {
      const u = grp.users[uIdx];
      const userAt = u.username ? `@${escapeHtml(u.username)}` : '<i>Sin @</i>';
      const uName = escapeHtml(u.first_name || 'Sin nombre');
      const grpInfo = u.detectedGroupName ? ` | Grupo: <code>${escapeHtml(u.detectedGroupName)}</code>` : '';
      text += `  ▸ <b>${uIdx + 1}.</b> ${userAt} | <code>${u.user_id}</code> ⊰ (${uName}${grpInfo})\n`;
    }
    text += `\n`;
  }

  if (multiGroups.length > 10) {
    text += `▪ <i>... y ${multiGroups.length - 10} patrones adicionales detectados en los grupos.</i>\n\n`;
  }

  text += `══════\n▪ <i>Verificado exclusivamente entre usuarios presentes en los grupos oficiales de la comunidad.</i>`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

/**
 * Radar de Rastrear Cuentas sin @ (Ghost / Burner accounts).
 * Filtra estrictamente solo usuarios que estén dentro de los grupos oficiales.
 */
async function executeNoUsernameRadar(ctx) {
  const tenantId = ctx.tenant?.id || null;
  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
  const groups = await db.getAllGroups(tenantId).catch(() => []);

  if (!groups || groups.length === 0) {
    return ctx.reply(
      `⟡ <b>RADAR DE RASTREO</b> ⊱ <code>USUARIOS SIN ALIAS (@)</code> ⊰\n` +
      `══════\n\n` +
      `▸ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n\n` +
      `✗ <i>No hay grupos oficiales registrados para esta comunidad.</i>`,
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
    );
  }

  await ctx.replyWithChatAction('typing');

  // 1. Obtener candidatos y filtrar ÚNICAMENTE a los que están físicamente en los grupos oficiales
  const candidates = await db.getCommunityUsers(tenantId);
  const activeMembersInGroups = await getActiveMembersInCommunity(ctx.api, groups, candidates);

  const { users, total, totalCommunity } = await db.getUsersWithoutUsername(tenantId, 25, activeMembersInGroups);

  if (!users || users.length === 0) {
    return ctx.reply(
      `⟡ <b>RADAR DE RASTREO</b> ⊱ <code>USUARIOS SIN ALIAS (@)</code> ⊰\n` +
      `══════\n\n` +
      `▸ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n` +
      `▸ <b>Total Miembros en Grupos:</b> <code>${totalCommunity}</code>\n\n` +
      `✓ <i>Todos los miembros presentes en los grupos oficiales cuentan con un @username público asignado.</i>`,
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
    `▸ <b>Miembros en Grupos sin @:</b> <b>${total}</b> (de <code>${totalCommunity}</code> miembros activos)\n\n` +
    `──────\n\n`;

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const targetName = escapeHtml(u.first_name || 'Sin nombre registrado');
    const grpInfo = u.detectedGroupName ? ` | Grupo: <code>${escapeHtml(u.detectedGroupName)}</code>` : '';
    text += `▸ <b>${i + 1}.</b> ${targetName} | <code>${u.user_id}</code> ⊰${grpInfo}\n`;
    text += `  ↳ <a href="tg://user?id=${u.user_id}">Ver Perfil en Telegram</a>\n`;
  }

  if (total > users.length) {
    text += `\n▪ <i>Mostrando los primeros ${users.length} de ${total} miembros sin @username dentro de los grupos.</i>\n`;
  }

  text += `\n══════\n▪ <i>Verificado exclusivamente entre usuarios presentes en los grupos oficiales de la comunidad.</i>`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

/**
 * Ejecución del Radar de Búsqueda Individual o por Palabras Cortas.
 * Filtra estrictamente solo usuarios que estén dentro de los grupos oficiales.
 */
async function executeSearch(ctx, rawQuery) {
  const query = cleanSearchQuery(rawQuery);
  const tenantId = ctx.tenant?.id || null;
  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
  const groups = await db.getAllGroups(tenantId).catch(() => []);

  if (!query) {
    return ctx.reply(
      `${SYM.DIVIDER}\n` +
      `⟡ <b>RADAR DE RASTREO DE USUARIOS</b> ⊱ <code>${escapeHtml(communityName)}</code> ⊰\n` +
      `${SYM.DIVIDER}\n\n` +
      `▸ <b>Búsqueda Natural:</b> <code>Búscame a [nombre, @user o ID]</code>\n` +
      `▸ <b>Multicuentas:</b> <code>Búscame a todas las cuentas multis que hay</code>\n` +
      `▸ <b>Cuentas sin @:</b> <code>Búscame a todo los que no tienen @</code>\n\n` +
      `▪ <i>Exclusivo para miembros presentes en los grupos oficiales registrados (${groups.length} grupos).</i>\n\n` +
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

  // 1. Buscar coincidencias en la Comunidad Aislada (respetando tenantId)
  let results = await db.searchUsers(cleanNoAt, tenantId);

  // 1.5. Si no hay en BD o hay pocos resultados y estamos en el BOT PRINCIPAL, usar Userbot MTProto
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

  if (!results || results.length === 0) {
    return ctx.reply(
      `⟡ <b>RADAR DE RASTREO</b> ⊱ <code>SIN RESULTADOS</code> ⊰\n` +
      `══════\n\n` +
      `✗ <i>No se localizaron coincidencias para:</i> <code>${escapeHtml(query)}</code>\n` +
      `▸ <b>Comunidad analizada:</b> <code>${escapeHtml(communityName)}</code>\n\n` +
      `──────\n` +
      `▪ <i>Verifica que el nombre o @username esté bien escrito.</i>`,
      { parse_mode: 'HTML' }
    );
  }

  // 2. Comprobar membresía activa: ÚNICAMENTE usuarios presentes en los grupos oficiales
  const finalResults = [];

  for (const user of results) {
    const { inGroup, groupTitle } = await checkUserInOfficialGroups(ctx.api, groups, user.user_id);

    // REGLA ESTRICTA: Ignorar a cualquiera que no esté dentro de ningún grupo oficial de este tenant
    if (!inGroup) {
      continue;
    }

    if (!finalResults.find((u) => Number(u.user_id) === Number(user.user_id))) {
      finalResults.push({
        ...user,
        isInActiveGroup: true,
        detectedGroupName: groupTitle,
        communityShortStatus: '✓ En Grupo Oficial',
      });
    }
  }

  if (finalResults.length === 0) {
    return ctx.reply(
      `⟡ <b>RADAR DE RASTREO</b> ⊱ <code>SIN RESULTADOS EN GRUPOS</code> ⊰\n` +
      `══════\n\n` +
      `✗ <i>No se localizó a ningún miembro activo <b>dentro de los grupos oficiales</b> para:</i> <code>${escapeHtml(query)}</code>\n` +
      `▸ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n` +
      `▸ <b>Grupos Verificados:</b> <code>${groups.length}</code>\n\n` +
      `──────\n` +
      `▪ <i>El radar únicamente muestra usuarios que pertenezcan activamente a los grupos oficiales de la comunidad.</i>`,
      { parse_mode: 'HTML' }
    );
  }

  // Ordenar por relevancia inteligente
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

    // Penalizar cuentas de bot
    if (normUser.endsWith('bot')) s -= 120;

    return s;
  }

  finalResults.sort((a, b) => calculateUserScore(b) - calculateUserScore(a));

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
    `▸ <b>Ubicación:</b> <code>${escapeHtml(firstUser.detectedGroupName || 'Grupo Oficial')}</code>\n` +
    `▸ <b>Estado:</b> <i>${firstUser.communityShortStatus || '✓ En Grupo'}</i>\n` +
    `▸ <b>Link:</b> <a href="tg://user?id=${firstUser.user_id}">Presiona aquí</a>`;

  if (finalResults.length > 1) {
    replyText += `\n\n${SYM.THIN_LINE}\n▸ <b>Otras coincidencias en los grupos (${finalResults.length - 1}):</b>\n`;
    const others = finalResults.slice(1, 6);
    for (const other of others) {
      const oName = escapeHtml(other.first_name || 'Sin nombre');
      const oUser = other.username ? `@${escapeHtml(other.username)}` : '<i>Sin @</i>';
      replyText += `• ${oName} | ${oUser} | <code>${other.user_id}</code> ⊰\n`;
    }
    if (finalResults.length > 6) {
      replyText += `▪ <i>... y ${finalResults.length - 6} coincidencias más dentro de los grupos.</i>\n`;
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

  const isMultiQuery = /(?:cuentas?\s+multis?|multicuentas|multis|clones|posibles\s+clones)/i.test(text);
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
    // Si el mensaje se envió en un grupo oficial, cachear de inmediato al emisor como miembro activo
    if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') && ctx.from?.id) {
      markMemberInGroup(ctx.chat.id, ctx.from.id, true, ctx.chat.title);
    }

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
  markMemberInGroup,
};
