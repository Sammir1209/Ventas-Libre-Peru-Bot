const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const config = require('../../config/env');
const { isGlobalOwner, resolveOwnerIds } = require('../../utils/tenantContext');
const { SYM } = require('../../config/constants');
const { mentionFromData, formatId, escapeHtml } = require('../../utils/formatting');
const logger = require('./logger');
const { InlineKeyboard } = require('grammy');

// ── Homóglifos comunes (Cirílico, Griego, Símbolos) a caracteres latinos ──
const HOMOGLYPHS = {
  'а': 'a', 'a': 'a', 'а́': 'a', 'ɑ': 'a', 'α': 'a', '@': 'a', '4': 'a',
  'б': 'b', 'b': 'b', '8': 'b', 'в': 'b', 'ß': 'b',
  'с': 'c', 'c': 'c', 'с́': 'c', 'ϲ': 'c', 'ç': 'c', '©': 'c',
  'д': 'd', 'd': 'd',
  'е': 'e', 'e': 'e', 'е́': 'e', 'ё': 'e', 'є': 'e', 'ε': 'e', '3': 'e', '€': 'e',
  'г': 'g', 'g': 'g', '9': 'g',
  'н': 'h', 'h': 'h',
  'і': 'i', 'i': 'i', 'ї': 'i', 'ι': 'i', '1': 'i', '!': 'i', '|': 'i', 'l': 'i', 'I': 'i',
  'ј': 'j', 'j': 'j',
  'к': 'k', 'k': 'k', 'κ': 'k',
  'м': 'm', 'm': 'm',
  'п': 'n', 'n': 'n',
  'о': 'o', 'o': 'o', 'о́': 'o', 'ο': 'o', '0': 'o', 'ø': 'o',
  'р': 'p', 'p': 'p', 'ρ': 'p',
  'г': 'r', 'r': 'r',
  's': 's', 'ѕ': 's', '5': 's', '$': 's',
  'т': 't', 't': 't', '7': 't', '+': 't',
  'у': 'u', 'u': 'u', 'υ': 'u', 'µ': 'u',
  'v': 'v', 'ν': 'v',
  'х': 'x', 'x': 'x', 'χ': 'x', '×': 'x',
  'у': 'y', 'y': 'y', 'γ': 'y',
  'z': 'z', '2': 'z',
  '_': '', '-': '', '.': '', ' ': '',
};

/**
 * Normaliza un texto convirtiendo homóglifos, números, símbolos y tipografías matemáticas Unicode
 */
function normalizeString(str) {
  if (!str) return '';
  // NFKD descompone caracteres matemáticos / negritas / cursivas Unicode a letras ASCII
  let clean = String(str).normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '');
  let out = '';
  for (const char of clean) {
    out += HOMOGLYPHS[char] !== undefined ? HOMOGLYPHS[char] : char;
  }
  return out.replace(/[^a-z0-9]/g, '');
}

/**
 * Algoritmo Levenshtein para calcular distancia de edición
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // sustitución
          matrix[i][j - 1] + 1,     // inserción
          matrix[i - 1][j] + 1      // eliminación
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calcula porcentaje de similitud (0.0 a 1.0)
 */
function calculateSimilarity(str1, str2) {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;

  const distance = levenshteinDistance(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 1.0;
  return (maxLen - distance) / maxLen;
}

/**
 * Obtiene la lista oficial de Staff y Owners a proteger
 */
async function getProtectedStaffList(botApi) {
  const cached = await redisDb.getCache('protected_staff_list');
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return cached;
  }

  const list = [];
  const registeredIds = new Set();

  // 1. Owners configurados en la plataforma
  const ownerIds = resolveOwnerIds();
  for (const ownerId of ownerIds) {
    if (!registeredIds.has(ownerId)) {
      list.push({
        userId: ownerId,
        username: null,
        firstName: 'Owner',
        role: 'Propietario / Desarrollador',
      });
      registeredIds.add(ownerId);
    }
  }

  // 2. Staff de Base de Datos
  try {
    const staffMembers = await db.getAllStaff();
    for (const m of staffMembers) {
      if (!registeredIds.has(m.user_id)) {
        list.push({
          userId: m.user_id,
          username: m.username || null,
          firstName: m.first_name || 'Staff',
          role: m.role || 'Staff',
        });
        registeredIds.add(m.user_id);
      }
    }
  } catch {}

  // Guardar en caché 5 minutos
  await redisDb.setCache('protected_staff_list', list, 300);
  return list;
}

/**
 * Analiza a un usuario y determina si está intentando suplantar a un Admin/Owner
 */
async function checkImpersonation(user, botApi) {
  if (!user || user.is_bot) return null;

  const staffList = await getProtectedStaffList(botApi);
  const userId = user.id;

  // Si el usuario es miembro legítimo del Staff o es Owner, NO es un clon
  const isLegitStaff = staffList.some(s => s.userId === userId);
  if (isLegitStaff || isGlobalOwner(userId)) {
    return null;
  }

  const userUsername = user.username || '';
  const userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

  for (const staff of staffList) {
    // 1. Comparar Username (si ambos tienen username)
    if (userUsername && staff.username) {
      const usernameSim = calculateSimilarity(userUsername, staff.username);
      // Detección directa de homóglifo o similitud >= 80%
      if (usernameSim >= 0.80) {
        return {
          targetStaff: staff,
          similarity: Math.round(usernameSim * 100),
          matchType: 'Username Clónico',
          matchedString: `@${userUsername} vs @${staff.username}`,
        };
      }
    }

    // 2. Comparar Nombre Completo
    if (userFullName && staff.firstName) {
      const nameSim = calculateSimilarity(userFullName, staff.firstName);
      if (nameSim >= 0.85 && normalizeString(staff.firstName).length >= 4) {
        return {
          targetStaff: staff,
          similarity: Math.round(nameSim * 100),
          matchType: 'Nombre Clónico',
          matchedString: `"${userFullName}" vs "${staff.firstName}"`,
        };
      }
    }

    // 3. Caso crítico: Intento de suplantar a Coder (@S_14xx) o Agar con variaciones
    const normUser = normalizeString(userUsername || userFullName);
    if (normUser.includes('s14xx') || normUser.includes('coder') && userFullName.toLowerCase().includes('coder')) {
      if (!isGlobalOwner(userId)) {
        return {
          targetStaff: staffList[0] || { firstName: 'Coder', role: 'Creador' },
          similarity: 95,
          matchType: 'Suplantación Directa de Creador (Coder)',
          matchedString: `${userFullName} (@${userUsername || 'sin_user'})`,
        };
      }
    }
  }

  return null;
}

/**
 * Aplica la sanción automática y envía las alertas pertinentes
 */
async function handleImpersonator(ctx, chat, user, detection) {
  const chatId = chat.id;
  const userId = user.id;

  console.warn(`🚨 [ANTI-IMPERSONATOR] Clon detectado: ID ${userId} (@${user.username || 'sin_user'}) suplantando a ${detection.targetStaff.firstName} (${detection.similarity}%)`);

  // 1. Expulsión / Baneo inmediato del grupo
  try {
    await ctx.api.banChatMember(chatId, userId);
  } catch (banErr) {
    console.error('⟡ Error baneando clon detectado:', banErr.message);
  }

  // 2. Registrar en Lista Negra
  try {
    await db.burnUser({
      userId,
      username: user.username || null,
      firstName: user.first_name || 'Clon / Suplantador',
      context: `Auto-Ban: Intento de suplantación de ${detection.targetStaff.firstName} (${detection.matchType}, ${detection.similarity}%)`,
      reportedBy: 0,
      approvedBy: 0,
    });
  } catch {}

  const userMention = mentionFromData(userId, user.username, user.first_name);
  const targetMention = mentionFromData(
    detection.targetStaff.userId,
    detection.targetStaff.username,
    detection.targetStaff.firstName
  );

  // 3. Alerta pública en el Grupo
  try {
    const alertMsg =
      `${SYM.DIVIDER}\n` +
      `🛡️ <b>GUARDIÁN ANTI-IMPERSONATOR</b> 🚨\n` +
      `${SYM.DIVIDER}\n\n` +
      `${SYM.CROSS} <b>Intruso Expulsado:</b> ${userMention}\n` +
      `${SYM.ARROW} <b>ID Numérico:</b> <code>${userId}</code>\n` +
      `${SYM.ALERT} <b>Objetivo Suplantado:</b> ${targetMention} (<i>${escapeHtml(detection.targetStaff.role)}</i>)\n` +
      `${SYM.ARROW} <b>Tipo de Clonación:</b> <code>${escapeHtml(detection.matchType)}</code>\n` +
      `${SYM.ARROW} <b>Similitud Calculada:</b> <b>${detection.similarity}%</b>\n\n` +
      `${SYM.THIN_LINE}\n` +
      `${SYM.SHIELD} <i>El clon ha sido neutralizado y añadido a la Lista Negra para proteger a los miembros de estafas por privado.</i>`;

    await ctx.api.sendMessage(chatId, alertMsg, { parse_mode: 'HTML' });
  } catch {}

  // 4. Reporte detallado al Canal de Logs del Staff
  try {
    await logger.sendLog(
      ctx.api,
      'ANTI_CLON_BAN',
      { id: 0, first_name: 'Guardián Anti-Impersonator', username: 'bot' },
      userId,
      chat.title || 'Grupo Oficial',
      `Suplantación de ${detection.targetStaff.firstName} (${detection.similarity}% similitud)`
    );
  } catch {}
}

/**
 * Escanea la comunidad en busca de clones o suplantadores de un nombre o usuario específico
 */
async function scanCommunityForClones(targetQuery, tenantId = null) {
  const normTarget = normalizeString(targetQuery);
  if (!normTarget || normTarget.length < 3) {
    return { error: 'Nombre o consulta demasiado corta para analizar similitud.' };
  }

  let allUsers = [];
  try {
    if (db.pool) {
      const q = tenantId
        ? 'SELECT user_id, username, first_name FROM users WHERE tenant_id = $1 OR tenant_id IS NULL ORDER BY user_id DESC LIMIT 2000'
        : 'SELECT user_id, username, first_name FROM users ORDER BY user_id DESC LIMIT 2000';
      const res = await db.pool.query(q, tenantId ? [tenantId] : []);
      allUsers = res.rows || [];
    }
  } catch (err) {
    console.warn('⟡ Error obteniendo usuarios para scanCommunityForClones:', err.message);
  }

  const matches = [];
  const seenIds = new Set();

  for (const u of allUsers) {
    if (seenIds.has(u.user_id)) continue;

    const uNameNorm = normalizeString(u.first_name || '');
    const uUserNorm = normalizeString(u.username || '');

    const nameSim = calculateSimilarity(u.first_name || '', targetQuery);
    const userSim = u.username ? calculateSimilarity(u.username, targetQuery) : 0;
    const maxSim = Math.max(nameSim, userSim);

    const isExact = (uNameNorm === normTarget || uUserNorm === normTarget);

    if (isExact || maxSim >= 0.70) {
      seenIds.add(u.user_id);
      matches.push({
        user_id: u.user_id,
        username: u.username || null,
        first_name: u.first_name || 'Usuario',
        similarity: isExact ? 100 : Math.round(maxSim * 100),
        matchType: isExact ? 'Nombre Normalizado Idéntico' : 'Alta Similitud Fonética / Gráfica',
      });
    }
  }

  matches.sort((a, b) => b.similarity - a.similarity);

  return {
    targetQuery,
    normalizedTarget: normTarget,
    matches: matches.slice(0, 10),
  };
}

/**
 * Escanea la comunidad en busca de colisiones masivas de nombres duplicados
 */
async function scanAllCollisions(tenantId = null) {
  let allUsers = [];
  try {
    if (db.pool) {
      const q = tenantId
        ? 'SELECT user_id, username, first_name FROM users WHERE tenant_id = $1 OR tenant_id IS NULL ORDER BY user_id DESC LIMIT 1500'
        : 'SELECT user_id, username, first_name FROM users ORDER BY user_id DESC LIMIT 1500';
      const res = await db.pool.query(q, tenantId ? [tenantId] : []);
      allUsers = res.rows || [];
    }
  } catch {}

  const groups = new Map();
  for (const u of allUsers) {
    const norm = normalizeString(u.first_name || '');
    if (!norm || norm.length < 4) continue;

    if (!groups.has(norm)) {
      groups.set(norm, []);
    }
    groups.get(norm).push(u);
  }

  const collisionList = [];
  for (const [normName, users] of groups.entries()) {
    if (users.length > 1) {
      collisionList.push({
        normName,
        count: users.length,
        users,
      });
    }
  }

  collisionList.sort((a, b) => b.count - a.count);
  return collisionList.slice(0, 6);
}

/**
 * Construye la ficha estética de reporte del Radar de Clones
 */
function buildClonesReport(result, communityName = 'Ventas Libres Perú') {
  if (result.error) {
    return { text: `⟡ ⚠️ ${result.error}`, keyboard: null };
  }

  const { targetQuery, normalizedTarget, matches } = result;

  let text =
    `<b>🛡️ [RADAR DE CLONES] DETECCIÓN DE SUPLANTACIÓN</b>\n` +
    `──────\n\n` +
    `▸ <b>Objetivo Analizado:</b> <code>${escapeHtml(targetQuery)}</code>\n` +
    `▸ <b>Desofuscación NFKD:</b> <code>${escapeHtml(normalizedTarget)}</code>\n` +
    `▸ <b>Comunidad:</b> <i>${escapeHtml(communityName)}</i>\n\n`;

  if (matches.length === 0) {
    text +=
      `──────\n` +
      `✓ <i>No se detectaron perfiles duplicados ni suplantadores de este nombre en la base de datos de la red.</i>`;
    return { text, keyboard: null };
  }

  text += `<b>⚠️ Coincidencias y Posibles Clones Detectados (${matches.length}):</b>\n\n`;

  const kb = new InlineKeyboard();

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const uMention = mentionFromData(m.user_id, m.username, m.first_name);
    const badge = m.similarity === 100 ? '🔴 [IDÉNTICO]' : `⚠️ [${m.similarity}%]`;

    text +=
      `▸ <b>${i + 1}.</b> ${uMention} ⊰ <code>${m.user_id}</code>\n` +
      `  ↳ Similitud: <b>${badge}</b> (${escapeHtml(m.matchType)})\n`;

    // Botones interactivos para los primeros 3
    if (i < 3) {
      kb.text(`👤 Ver #${i + 1}`, `perfil_card:${m.user_id}`);
      kb.text(`🚫 Banear`, `mod_ban_direct:${m.user_id}`).row();
    }
  }

  text +=
    `\n──────\n` +
    `💡 <i>Compara siempre los IDs numéricos antes de pactar acuerdos para evitar estafas.</i>`;

  kb.text('✖ Cerrar Radar', 'info_close');

  return { text, keyboard: kb };
}

module.exports = {
  checkImpersonation,
  handleImpersonator,
  calculateSimilarity,
  normalizeString,
  scanCommunityForClones,
  scanAllCollisions,
  buildClonesReport,
};
