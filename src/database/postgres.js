const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const config = require('../config/env');

// ══════
// ⟡ Capa de Base de Datos Híbrida: Supabase REST + PostgreSQL Directo
// ══════

let supabase = null;
let pool = null;
let useSupabase = false;

// Inicializar cliente Supabase si las credenciales están presentes
if (config.SUPABASE_URL && config.SUPABASE_SERVICE_KEY) {
  supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  useSupabase = true;
}

// Inicializar pool Postgres como fallback si POSTGRES_URL es válido
if (config.POSTGRES_URL && !config.POSTGRES_URL.includes('localhost')) {
  pool = new Pool({
    connectionString: config.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
  });
}

// ══════
// ⟡ CRUD — Usuarios
// ══════

async function upsertUser(userId, username, firstName) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('users')
      .upsert(
        { user_id: userId, username: username || null, first_name: firstName || null },
        { onConflict: 'user_id' }
      )
      .select()
      .maybeSingle();
    if (error) console.error('⟡ Supabase upsertUser error:', error.message);
    return data;
  }
  if (pool) {
    const res = await pool.query(
      `INSERT INTO users (user_id, username, first_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET username = $2, first_name = $3
       RETURNING *`,
      [userId, username, firstName]
    );
    return res.rows[0];
  }
  return null;
}

async function getUserByUsername(username) {
  if (!username) return null;
  const clean = username.replace(/^@/, '').toLowerCase().trim();
  if (useSupabase && supabase) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .ilike('username', clean)
      .maybeSingle();
    return data || null;
  }
  if (pool) {
    const res = await pool.query(`SELECT * FROM users WHERE LOWER(username) = LOWER($1)`, [clean]);
    return res.rows[0] || null;
  }
  return null;
}

async function verifyUser(userId) {
  if (useSupabase && supabase) {
    const { error } = await supabase
      .from('users')
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) console.error('⟡ Supabase verifyUser error:', error.message);
    return;
  }
  if (pool) {
    await pool.query(
      `UPDATE users SET verified = TRUE, verified_at = NOW() WHERE user_id = $1`,
      [userId]
    );
  }
}

async function getAllUsers(page = 1, limit = 50, search = '') {
  const offset = (Math.max(1, page) - 1) * limit;
  if (useSupabase && supabase) {
    let query = supabase.from('users').select('*', { count: 'exact' });

    if (search && search.trim()) {
      const q = search.trim().replace(/^@/, '');
      if (/^\d+$/.test(q)) {
        query = query.eq('user_id', Number(q));
      } else {
        query = query.or(`username.ilike.%${q}%,first_name.ilike.%${q}%`);
      }
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) console.error('⟡ Supabase getAllUsers error:', error.message);
    return { users: data || [], total: count || 0 };
  }
  if (pool) {
    let whereClause = '';
    const params = [];
    if (search && search.trim()) {
      const q = search.trim().replace(/^@/, '');
      if (/^\d+$/.test(q)) {
        params.push(Number(q));
        whereClause = `WHERE user_id = $1`;
      } else {
        params.push(`%${q}%`);
        whereClause = `WHERE username ILIKE $1 OR first_name ILIKE $1`;
      }
    }
    const countRes = await pool.query(`SELECT COUNT(*) as total FROM users ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const listParams = [...params, limit, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const listRes = await pool.query(
      `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      listParams
    );
    return { users: listRes.rows, total };
  }
  return { users: [], total: 0 };
}

async function toggleUserVerification(userId, status) {
  const verified = Boolean(status);
  const now = verified ? new Date().toISOString() : null;
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('users')
      .update({ verified, is_verified: verified, verified_at: now })
      .eq('user_id', userId)
      .select()
      .maybeSingle();
    if (error) console.error('⟡ Supabase toggleUserVerification error:', error.message);
    return data;
  }
  if (pool) {
    const res = await pool.query(
      `UPDATE users SET verified = $1, is_verified = $1, verified_at = $2 WHERE user_id = $3 RETURNING *`,
      [verified, now, userId]
    );
    return res.rows[0] || null;
  }
  return null;
}

// ══════
// ⟡ CRUD — Verificaciones Pendientes (Nuevos Miembros)
// ══════

async function addPendingVerification(chatId, userId, username, firstName, welcomeMsgId = null) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('pending_verifications')
      .upsert(
        {
          chat_id: chatId,
          user_id: userId,
          username: username || null,
          first_name: firstName || null,
          welcome_msg_id: welcomeMsgId,
          joined_at: new Date().toISOString(),
        },
        { onConflict: 'chat_id,user_id' }
      )
      .select()
      .maybeSingle();
    if (error) console.error('⟡ Supabase addPendingVerification error:', error.message);
    return data;
  }
  if (pool) {
    const res = await pool.query(
      `INSERT INTO pending_verifications (chat_id, user_id, username, first_name, welcome_msg_id, joined_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (chat_id, user_id) DO UPDATE SET
         username = $3, first_name = $4, welcome_msg_id = $5, joined_at = NOW()
       RETURNING *`,
      [chatId, userId, username, firstName, welcomeMsgId]
    );
    return res.rows[0];
  }
  return null;
}

async function removePendingVerification(chatId, userId) {
  if (useSupabase && supabase) {
    let q = supabase.from('pending_verifications').delete().eq('user_id', userId);
    if (chatId) q = q.eq('chat_id', chatId);
    const { error } = await q;
    if (error) console.error('⟡ Supabase removePendingVerification error:', error.message);
    return;
  }
  if (pool) {
    if (chatId) {
      await pool.query(`DELETE FROM pending_verifications WHERE chat_id = $1 AND user_id = $2`, [chatId, userId]);
    } else {
      await pool.query(`DELETE FROM pending_verifications WHERE user_id = $1`, [userId]);
    }
  }
}

async function getPendingVerification(chatId, userId) {
  if (useSupabase && supabase) {
    let q = supabase.from('pending_verifications').select('*').eq('user_id', userId);
    if (chatId) q = q.eq('chat_id', chatId);
    const { data, error } = await q.maybeSingle();
    if (error) console.error('⟡ Supabase getPendingVerification error:', error.message);
    return data || null;
  }
  if (pool) {
    const query = chatId
      ? `SELECT * FROM pending_verifications WHERE chat_id = $1 AND user_id = $2`
      : `SELECT * FROM pending_verifications WHERE user_id = $1`;
    const params = chatId ? [chatId, userId] : [userId];
    const res = await pool.query(query, params);
    return res.rows[0] || null;
  }
  return null;
}

async function getUser(userId) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) console.error('⟡ Supabase getUser error:', error.message);
    return data || null;
  }
  if (pool) {
    const res = await pool.query(`SELECT * FROM users WHERE user_id = $1`, [userId]);
    return res.rows[0] || null;
  }
  return null;
}

// ══════
// ⟡ Registro y Aislamiento de Miembros de Comunidad por Tenant
// ══════
const tenantUsersMemory = new Map(); // tenantId -> Map<userId, userObject>
let tenantUsersDirty = new Set();
let persistTenantTimer = null;

/**
 * Registra o actualiza la actividad de un usuario dentro de un tenant específico.
 */
async function recordTenantUser(tenantId, userId, username, firstName) {
  if (!userId) return;
  const numId = Number(userId);

  // Asegurar siempre el registro base en users
  upsertUser(numId, username, firstName).catch(() => {});

  if (!tenantId) {
    return; // Para el bot oficial principal, la tabla users es la fuente directa
  }

  // Para sub-bots, registrar en su mapa en memoria
  if (!tenantUsersMemory.has(tenantId)) {
    tenantUsersMemory.set(tenantId, new Map());
  }
  const tMap = tenantUsersMemory.get(tenantId);
  tMap.set(numId, {
    user_id: numId,
    username: username || null,
    first_name: firstName || null,
    last_seen: new Date().toISOString(),
  });

  tenantUsersDirty.add(tenantId);
  if (!persistTenantTimer) {
    persistTenantTimer = setTimeout(async () => {
      persistTenantTimer = null;
      const toPersist = Array.from(tenantUsersDirty);
      tenantUsersDirty.clear();
      for (const tId of toPersist) {
        try {
          const map = tenantUsersMemory.get(tId);
          if (map) {
            const arr = Array.from(map.values()).slice(-2000);
            await setSetting('community_users', JSON.stringify(arr), tId);
          }
        } catch {}
      }
    }, 5000);
  }
}

/**
 * Obtiene todos los usuarios pertenecientes exclusivamente a la comunidad especificada (Multi-Tenant).
 * Si tenantId es null, retorna los usuarios de la comunidad principal de Ventas Libres Perú.
 * Si tenantId es provisto, retorna ÚNICAMENTE los usuarios del sub-bot (jamás se mezclan).
 */
async function getCommunityUsers(tenantId = null) {
  if (tenantId) {
    // ── Comunidad de Sub-Bot ──
    let tMap = tenantUsersMemory.get(tenantId);
    if (!tMap || tMap.size === 0) {
      try {
        const raw = await getSetting('community_users', tenantId);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            tMap = new Map();
            for (const u of parsed) {
              if (u && u.user_id) tMap.set(Number(u.user_id), u);
            }
            tenantUsersMemory.set(tenantId, tMap);
          }
        }
      } catch {}
    }

    const resultMap = new Map(tMap ? tMap.entries() : []);

    // Enriquecer con Staff exclusivo de este sub-bot
    try {
      const staffList = await getAllStaff(tenantId);
      for (const s of staffList) {
        const uid = Number(s.user_id);
        if (!resultMap.has(uid)) {
          resultMap.set(uid, {
            user_id: uid,
            username: s.username || null,
            first_name: s.first_name || null,
          });
        }
      }
    } catch {}

    // Enriquecer con Tratos de este sub-bot
    try {
      const dealsList = await getAllDeals(tenantId);
      for (const d of dealsList) {
        if (d.creator_id && !resultMap.has(Number(d.creator_id))) {
          const u = await getUser(d.creator_id);
          if (u) resultMap.set(Number(d.creator_id), u);
        }
        if (d.admin_id && !resultMap.has(Number(d.admin_id))) {
          const u = await getUser(d.admin_id);
          if (u) resultMap.set(Number(d.admin_id), u);
        }
      }
    } catch {}

    return Array.from(resultMap.values());
  }

  // ── Comunidad Oficial Principal (Ventas Libres Perú) ──
  let allUsers = [];
  if (useSupabase && supabase) {
    const { data, error } = await supabase.from('users').select('*').limit(3000);
    if (!error && data) allUsers = data;
  } else if (pool) {
    try {
      const res = await pool.query(`SELECT * FROM users LIMIT 3000`);
      allUsers = res.rows || [];
    } catch {}
  }

  // Asegurar que usuarios registrados en sub-bots que no pertenecen a la principal no se filtren
  return allUsers;
}

/**
 * Distancia de Levenshtein para similitud tipográfica entre nombres
 */
function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;
  const prev = [];
  for (let i = 0; i <= s2.length; i++) prev[i] = i;
  for (let i = 0; i < s1.length; i++) {
    const current = [i + 1];
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      current[j + 1] = Math.min(
        current[j] + 1,
        prev[j + 1] + 1,
        prev[j] + cost
      );
    }
    for (let k = 0; k <= s2.length; k++) prev[k] = current[k];
  }
  return prev[s2.length];
}

/**
 * Limpia y normaliza el texto completo de un nombre.
 */
function cleanFullText(str) {
  if (!str) return '';
  return String(str)
    .replace(/\p{Extended_Pictographic}/gu, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Extrae los segmentos de un nombre separados por delimitadores de tags/teams (| / • - ~ [ ] ( ) : ; « »)
 */
function extractNameSegments(name) {
  if (!name) return [];
  const parts = String(name).split(/[|/•\-~[\]():;«»]/);
  const segments = [];
  for (const part of parts) {
    const cleaned = cleanFullText(part);
    if (cleaned.length >= 2) {
      segments.push(cleaned);
    }
  }
  return segments;
}

/**
 * Extrae la raíz base de un @username (remueve números finales y sufijos típicos como ofc, ofx, bot, vip, peru)
 */
function getBaseUsername(username) {
  if (!username) return '';
  let u = String(username).toLowerCase().replace(/^@/, '');
  u = u.replace(/[\d_-]+$/g, '');
  u = u.replace(/(?:ofc|ofx|bot|vip|peru|pe)$/g, '');
  u = u.replace(/[\d_-]+$/g, '');
  return u.trim();
}

/**
 * Radar de Detección de Multicuentas y Clones en la Comunidad Activa.
 * Discrimina etiquetas de team/clan para evitar falsos positivos entre compañeros de comunidad.
 */
async function findMultiAccounts(tenantId = null) {
  const users = await getCommunityUsers(tenantId);
  if (!users || users.length === 0) {
    return { groups: [], totalUsersAnalyzed: 0 };
  }

  const processed = users.map(u => ({
    ...u,
    fullNameClean: cleanFullText(u.first_name || ''),
    segments: extractNameSegments(u.first_name || ''),
    baseUser: getBaseUsername(u.username || '')
  })).filter(u => u.fullNameClean.length >= 2 || u.baseUser.length >= 3);

  // 1. Identificar tags de team / clan que comparten múltiples usuarios con diferentes nombres
  const segmentUsers = new Map();
  for (const u of processed) {
    for (const s of u.segments) {
      if (!segmentUsers.has(s)) segmentUsers.set(s, new Set());
      segmentUsers.get(s).add(u.baseUser || u.fullNameClean);
    }
  }

  const teamTagSet = new Set();
  const knownTagWords = ['team', 'clan', 'peru', 'desperupe', 'shieldgram', 'cmpe', 'sabuesos', 'redconpe', 'bloodcipher', 'santa', 'rdp', 'dox', 'fbi', 'ink', 'bitperu', 'oficial', 'official', 'staff', 'ventas'];
  for (const [seg, userSet] of segmentUsers.entries()) {
    if (userSet.size >= 2 || knownTagWords.some(w => seg.includes(w))) {
      teamTagSet.add(seg);
    }
  }

  const clusters = [];
  const assignedUserIds = new Set();

  // 1. Coincidencia EXACTA de nombre completo normalizado (ej: AgarMaker vs AgarMaker, BLACK/APOLO/BLACK)
  const fullMap = new Map();
  for (const u of processed) {
    if (u.fullNameClean.length >= 3 && !teamTagSet.has(u.fullNameClean)) {
      if (!fullMap.has(u.fullNameClean)) fullMap.set(u.fullNameClean, []);
      fullMap.get(u.fullNameClean).push(u);
    }
  }

  for (const [key, grp] of fullMap.entries()) {
    if (grp.length >= 2) {
      clusters.push({
        pattern: key,
        reason: 'Nombre idéntico (normalizado)',
        users: grp
      });
      for (const u of grp) assignedUserIds.add(Number(u.user_id));
    }
  }

  // 2. Clones por Alias / @Username derivado (ej: @APOLO_686 y @APOLO_636, @Alisson9841 y @Alisson2564)
  const remaining = processed.filter(u => !assignedUserIds.has(Number(u.user_id)));
  const userMap = new Map();
  for (const u of remaining) {
    if (u.baseUser && u.baseUser.length >= 4 && !teamTagSet.has(u.baseUser)) {
      if (!userMap.has(u.baseUser)) userMap.set(u.baseUser, []);
      userMap.get(u.baseUser).push(u);
    }
  }

  for (const [base, grp] of userMap.entries()) {
    if (grp.length >= 2) {
      clusters.push({
        pattern: `@${base}*`,
        reason: 'Alias (@user) clonado o derivado',
        users: grp
      });
      for (const u of grp) assignedUserIds.add(Number(u.user_id));
    }
  }

  // 3. Clones por nombre personal idéntico (ignorando los tags de clan compartidos)
  const stillRemaining = processed.filter(u => !assignedUserIds.has(Number(u.user_id)));
  for (let i = 0; i < stillRemaining.length; i++) {
    const u1 = stillRemaining[i];
    if (assignedUserIds.has(Number(u1.user_id))) continue;

    const personalSegs1 = u1.segments.filter(s => !teamTagSet.has(s) && s.length >= 3);
    if (personalSegs1.length === 0) continue;

    const segGroup = [u1];

    for (let j = i + 1; j < stillRemaining.length; j++) {
      const u2 = stillRemaining[j];
      if (assignedUserIds.has(Number(u2.user_id))) continue;

      const personalSegs2 = u2.segments.filter(s => !teamTagSet.has(s) && s.length >= 3);
      if (personalSegs2.length === 0) continue;

      // Comparar el segmento de nombre personal real
      const sharesPersonal = personalSegs1.some(s1 => personalSegs2.some(s2 => s1 === s2));
      if (sharesPersonal) {
        segGroup.push(u2);
      }
    }

    if (segGroup.length >= 2) {
      clusters.push({
        pattern: personalSegs1.join(' '),
        reason: 'Mismo nombre personal (con tags de clan)',
        users: segGroup
      });
      for (const u of segGroup) assignedUserIds.add(Number(u.user_id));
    }
  }

  clusters.sort((a, b) => b.users.length - a.users.length);

  return {
    groups: clusters,
    totalUsersAnalyzed: users.length,
  };
}

/**
 * Obtiene los usuarios de la comunidad que no tienen @username asignado
 */
async function getUsersWithoutUsername(tenantId = null, limit = 30) {
  const users = await getCommunityUsers(tenantId);
  const withoutAt = users.filter((u) => !u.username || String(u.username).trim() === '');
  return {
    users: withoutAt.slice(0, limit),
    total: withoutAt.length,
    totalCommunity: users.length,
  };
}

/**
 * Búsqueda inteligente de usuarios en la comunidad aislada.
 * Soporta IDs numéricos, @usernames, nombres completos y palabras cortas (>= 2 caracteres).
 */
async function searchUsers(query, tenantId = null) {
  if (!query) return [];
  const clean = query.replace(/^@/, '').trim();
  const isNumeric = /^\d+$/.test(clean);

  const cleanNormalized = clean
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  const words = cleanNormalized.split(/\s+/).filter(Boolean);
  const cleanNoSpaces = cleanNormalized.replace(/[\s_\-\.]+/g, '');

  let communityUsers = await getCommunityUsers(tenantId);

  // Filtrado inicial sobre los miembros de la comunidad activa
  let results = communityUsers.filter((u) => {
    const uidStr = String(u.user_id || '');
    if (isNumeric) {
      return uidStr === clean || uidStr.includes(clean);
    }

    const normFirst = (u.first_name || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const normUser = (u.username || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const normFirstNoSpaces = normFirst.replace(/[\s_\-\.]+/g, '');
    const normUserNoSpaces = normUser.replace(/[\s_\-\.]+/g, '');

    const directMatch = normFirst.includes(cleanNormalized) || normUser.includes(cleanNormalized);
    const startsMatch = normFirst.startsWith(cleanNormalized) || normUser.startsWith(cleanNormalized);
    const noSpacesMatch = cleanNoSpaces.length >= 2 && (normFirstNoSpaces.includes(cleanNoSpaces) || normUserNoSpaces.includes(cleanNoSpaces));
    const wordsMatch = words.length > 1 && words.every((w) => normFirst.includes(w) || normUser.includes(w) || normFirstNoSpaces.includes(w));

    return directMatch || startsMatch || noSpacesMatch || wordsMatch;
  });

  // Si es la comunidad principal y hay pocos resultados, consultar en la base de datos completa
  if (!tenantId && results.length === 0) {
    if (useSupabase && supabase) {
      let q = supabase.from('users').select('*');
      if (isNumeric) {
        q = q.or(`user_id.eq.${clean},first_name.ilike.%${clean}%,username.ilike.%${clean}%`);
      } else {
        q = q.or(`first_name.ilike.%${clean}%,username.ilike.%${clean}%,first_name.ilike.%${cleanNoSpaces}%,username.ilike.%${cleanNoSpaces}%`);
      }
      const { data } = await q.limit(20);
      if (data && data.length > 0) results = data;
    } else if (pool) {
      if (isNumeric) {
        const res = await pool.query(
          `SELECT * FROM users WHERE user_id = $1 OR first_name ILIKE $2 OR username ILIKE $2 LIMIT 20`,
          [Number(clean), `%${clean}%`]
        );
        results = res.rows || [];
      } else {
        const res = await pool.query(
          `SELECT * FROM users 
           WHERE first_name ILIKE $1 OR username ILIKE $1 
              OR first_name ILIKE $2 OR username ILIKE $2 
              OR REPLACE(first_name, ' ', '') ILIKE $2
           LIMIT 20`,
          [`%${clean}%`, `%${cleanNoSpaces}%`]
        );
        results = res.rows || [];
      }
    }
  }

  // Comprobar estado de estafa y marcar registro
  for (const u of results) {
    u.in_database = true;
    if (u.is_burned === undefined) {
      try {
        const burned = await isUserBurned(u.user_id, u.username);
        u.is_burned = !!burned;
      } catch {
        u.is_burned = false;
      }
    }
  }

  return results.slice(0, 20);
}

async function isUserBurned(userId, username = null) {
  if (!userId && !username) return false;

  // 1. Comprobar por ID
  if (userId) {
    if (useSupabase && supabase) {
      const { data } = await supabase
        .from('burned_users')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) return true;
    }
    if (pool) {
      const res = await pool.query(`SELECT user_id FROM burned_users WHERE user_id = $1`, [userId]);
      if (res.rows.length > 0) return true;
    }
  }

  // 2. Comprobar por Username
  if (username) {
    const clean = username.replace(/^@/, '').toLowerCase().trim();
    if (useSupabase && supabase) {
      const { data } = await supabase
        .from('burned_users')
        .select('user_id')
        .ilike('username', clean)
        .maybeSingle();
      if (data) return true;
    }
    if (pool) {
      const res = await pool.query(`SELECT user_id FROM burned_users WHERE LOWER(username) = LOWER($1)`, [clean]);
      if (res.rows.length > 0) return true;
    }
  }

  return false;
}

async function unburnUser(userId) {
  if (useSupabase && supabase) {
    const { error } = await supabase
      .from('burned_users')
      .delete()
      .eq('user_id', userId);
    if (error) console.error('⟡ Supabase unburnUser error:', error.message);
    return;
  }
  if (pool) {
    await pool.query(`DELETE FROM burned_users WHERE user_id = $1`, [userId]);
  }
}

// ══════
// ⟡ CRUD — Staff
// ══════

async function setStaffRole(userId, username, firstName, role, assignedBy, customTitle = null, tenantId = null) {
  if (useSupabase && supabase) {
    const basePayload = {
      user_id: userId,
      username: username || null,
      first_name: firstName || null,
      role,
      assigned_by: assignedBy,
      assigned_at: new Date().toISOString(),
      tenant_id: tenantId || null,
    };

    let res = await supabase
      .from('staff')
      .upsert(customTitle ? { ...basePayload, custom_title: customTitle } : basePayload, { onConflict: 'user_id' })
      .select()
      .maybeSingle();

    if (res.error && (res.error.message.includes('custom_title') || res.error.message.includes('tenant_id'))) {
      const fallbackPayload = { ...basePayload };
      delete fallbackPayload.tenant_id;
      res = await supabase
        .from('staff')
        .upsert(fallbackPayload, { onConflict: 'user_id' })
        .select()
        .maybeSingle();
    }

    if (res.error) console.error('⟡ Supabase setStaffRole error:', res.error.message);
    return res.data;
  }
  if (pool) {
    const res = await pool.query(
      `INSERT INTO staff (user_id, username, first_name, role, assigned_by, tenant_id, assigned_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         username = $2, first_name = $3, role = $4, assigned_by = $5, tenant_id = $6, assigned_at = NOW()
       RETURNING *`,
      [userId, username, firstName, role, assignedBy, tenantId]
    );
    return res.rows[0];
  }
  return null;
}

async function removeStaff(userId, tenantId = null) {
  if (useSupabase && supabase) {
    let query = supabase.from('staff').delete().eq('user_id', userId);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    else query = query.is('tenant_id', null);
    const { error } = await query;
    if (error) console.error('⟡ Supabase removeStaff error:', error.message);
    return;
  }
  if (pool) {
    if (tenantId) {
      await pool.query(`DELETE FROM staff WHERE user_id = $1 AND tenant_id = $2`, [userId, tenantId]);
    } else {
      await pool.query(`DELETE FROM staff WHERE user_id = $1 AND tenant_id IS NULL`, [userId]);
    }
  }
}

async function getStaffMember(userId, tenantId = null) {
  if (useSupabase && supabase) {
    let query = supabase.from('staff').select('*').eq('user_id', userId);
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    } else {
      query = query.is('tenant_id', null);
    }
    const { data, error } = await query.maybeSingle();
    if (error && !error.message.includes('tenant_id')) {
      console.error('⟡ Supabase getStaffMember error:', error.message);
    }
    if (!data && !tenantId) {
      // Fallback si la columna tenant_id no se ha migrado aún
      const fb = await supabase.from('staff').select('*').eq('user_id', userId).maybeSingle();
      return fb.data || null;
    }
    return data || null;
  }
  if (pool) {
    let res;
    if (tenantId) {
      res = await pool.query(`SELECT * FROM staff WHERE user_id = $1 AND tenant_id = $2`, [userId, tenantId]);
    } else {
      res = await pool.query(`SELECT * FROM staff WHERE user_id = $1 AND tenant_id IS NULL`, [userId]);
    }
    return res.rows[0] || null;
  }
  return null;
}

async function getAllStaff(tenantId = null) {
  if (useSupabase && supabase) {
    let query = supabase.from('staff').select('*').order('role').order('username');
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    } else {
      query = query.is('tenant_id', null);
    }
    const { data, error } = await query;
    if (error && !error.message.includes('tenant_id')) {
      console.error('⟡ Supabase getAllStaff error:', error.message);
    }
    if (!data && !tenantId) {
      const fb = await supabase.from('staff').select('*').order('role').order('username');
      return fb.data || [];
    }
    return data || [];
  }
  if (pool) {
    let res;
    if (tenantId) {
      res = await pool.query(`SELECT * FROM staff WHERE tenant_id = $1 ORDER BY role, username`, [tenantId]);
    } else {
      res = await pool.query(`SELECT * FROM staff WHERE tenant_id IS NULL ORDER BY role, username`);
    }
    return res.rows;
  }
  return [];
}

async function getStaffByRole(role, tenantId = null) {
  if (useSupabase && supabase) {
    let query = supabase.from('staff').select('*').ilike('role', `%${role}%`);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    else query = query.is('tenant_id', null);
    const { data, error } = await query;
    if (error && !error.message.includes('tenant_id')) {
      console.error('⟡ Supabase getStaffByRole error:', error.message);
    }
    if (!data && !tenantId) {
      const fb = await supabase.from('staff').select('*').ilike('role', `%${role}%`);
      return fb.data || [];
    }
    return data || [];
  }
  if (pool) {
    let res;
    if (tenantId) {
      res = await pool.query(`SELECT * FROM staff WHERE role ILIKE $1 AND tenant_id = $2`, [`%${role}%`, tenantId]);
    } else {
      res = await pool.query(`SELECT * FROM staff WHERE role ILIKE $1 AND (tenant_id IS NULL OR tenant_id = '')`, [`%${role}%`]);
    }
    return res.rows;
  }
  return [];
}

// ══════
// ⟡ CRUD — Tratos (Deals)
// ══════

async function createDeal(creatorId, dealInfo = {}) {
  const role = dealInfo.role || null;
  const counterpart = dealInfo.counterpart || null;
  const description = dealInfo.description || null;
  const creatorUsername = dealInfo.creatorUsername || null;
  const tenantId = dealInfo.tenantId || null;

  if (useSupabase && supabase) {
    const payload = { creator_id: creatorId };
    if (role) payload.role = role;
    if (counterpart) payload.counterpart = counterpart;
    if (description) payload.description = description;
    if (creatorUsername) payload.creator_username = creatorUsername;
    if (tenantId) payload.tenant_id = tenantId;

    let { data, error } = await supabase
      .from('deals')
      .insert(payload)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('⟡ Supabase createDeal full payload warning:', error.message);
      const fbPayload = { creator_id: creatorId };
      if (tenantId) fbPayload.tenant_id = tenantId;
      const fb = await supabase.from('deals').insert(fbPayload).select().maybeSingle();
      data = fb.data || { id: Date.now(), creator_id: creatorId, status: 'PENDING' };
    }
    return {
      ...data,
      role: data?.role || role,
      counterpart: data?.counterpart || counterpart,
      description: data?.description || description,
      creator_username: data?.creator_username || creatorUsername,
    };
  }
  if (pool) {
    try {
      const res = await pool.query(
        `INSERT INTO deals (creator_id, role, counterpart, description, creator_username, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [creatorId, role, counterpart, description, creatorUsername, tenantId]
      );
      return res.rows[0];
    } catch {
      const res = await pool.query(
        `INSERT INTO deals (creator_id) VALUES ($1) RETURNING *`,
        [creatorId]
      );
      return {
        ...res.rows[0],
        role,
        counterpart,
        description,
        creator_username: creatorUsername,
      };
    }
  }
  return { id: Date.now(), creator_id: creatorId, role, counterpart, description, creator_username: creatorUsername, status: 'PENDING' };
}

async function getDeal(dealId) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .maybeSingle();
    if (error) console.error('⟡ Supabase getDeal error:', error.message);
    return data || null;
  }
  if (pool) {
    const res = await pool.query(`SELECT * FROM deals WHERE id = $1`, [dealId]);
    return res.rows[0] || null;
  }
  return null;
}

async function assignDeal(dealId, adminId) {
  if (useSupabase && supabase) {
    const { error } = await supabase
      .from('deals')
      .update({
        admin_id: adminId,
        status: 'ASSIGNED',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', dealId);
    if (error) console.error('⟡ Supabase assignDeal error:', error.message);
    return;
  }
  if (pool) {
    await pool.query(
      `UPDATE deals SET admin_id = $1, status = 'ASSIGNED', assigned_at = NOW()
       WHERE id = $2`,
      [adminId, dealId]
    );
  }
}

async function updateDealStatus(dealId, status) {
  const updateObj = { status };
  if (status === 'COMPLETED') updateObj.completed_at = new Date().toISOString();

  if (useSupabase && supabase) {
    const { error } = await supabase.from('deals').update(updateObj).eq('id', dealId);
    if (error) console.error('⟡ Supabase updateDealStatus error:', error.message);
    return;
  }
  if (pool) {
    const extras = status === 'COMPLETED' ? ', completed_at = NOW()' : '';
    await pool.query(`UPDATE deals SET status = $1${extras} WHERE id = $2`, [status, dealId]);
  }
}

async function updateDealGroup(dealId, groupChatId, inviteLink, threadId = null) {
  if (useSupabase && supabase) {
    const updateObj = {
      group_chat_id: groupChatId,
      invite_link: inviteLink,
      status: 'IN_PROGRESS',
    };
    if (threadId) updateObj.thread_id = threadId;

    const { error } = await supabase
      .from('deals')
      .update(updateObj)
      .eq('id', dealId);

    if (error) {
      console.warn('⟡ Supabase updateDealGroup warning:', error.message);
      await supabase.from('deals').update({ group_chat_id: groupChatId, invite_link: inviteLink, status: 'IN_PROGRESS' }).eq('id', dealId);
    }
    return;
  }
  if (pool) {
    try {
      await pool.query(
        `UPDATE deals SET group_chat_id = $1, invite_link = $2, thread_id = $3, status = 'IN_PROGRESS'
         WHERE id = $4`,
        [groupChatId, inviteLink, threadId, dealId]
      );
    } catch {
      await pool.query(
        `UPDATE deals SET group_chat_id = $1, invite_link = $2, status = 'IN_PROGRESS'
         WHERE id = $3`,
        [groupChatId, inviteLink, dealId]
      );
    }
  }
}

async function getUserDeals(userId) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) console.error('⟡ Supabase getUserDeals error:', error.message);
    return data || [];
  }
  if (pool) {
    const res = await pool.query(
      `SELECT * FROM deals WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );
    return res.rows;
  }
  return [];
}

async function getAllDeals(tenantId = null) {
  if (useSupabase && supabase) {
    let q = supabase.from('deals').select('*').order('created_at', { ascending: false });
    if (tenantId) {
      q = q.eq('tenant_id', tenantId);
    } else {
      q = q.is('tenant_id', null);
    }
    const { data, error } = await q;
    if (error && !error.message.includes('tenant_id')) {
      console.error('⟡ Supabase getAllDeals error:', error.message);
    }
    if (!data && !tenantId) {
      const fb = await supabase.from('deals').select('*').order('created_at', { ascending: false });
      return fb.data || [];
    }
    return data || [];
  }
  if (pool) {
    let res;
    if (tenantId) {
      res = await pool.query(`SELECT * FROM deals WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    } else {
      res = await pool.query(`SELECT * FROM deals WHERE tenant_id IS NULL ORDER BY created_at DESC`);
    }
    return res.rows;
  }
  return [];
}

// ══════
// ⟡ CRUD — Calificaciones
// ══════

async function addRating(dealId, adminId, raterId, stars) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('ratings')
      .upsert(
        { deal_id: dealId, admin_id: adminId, rater_id: raterId, stars },
        { onConflict: 'deal_id,rater_id' }
      )
      .select()
      .maybeSingle();
    if (error) console.error('⟡ Supabase addRating error:', error.message);
    return data;
  }
  if (pool) {
    const res = await pool.query(
      `INSERT INTO ratings (deal_id, admin_id, rater_id, stars)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (deal_id, rater_id) DO UPDATE SET stars = $4
       RETURNING *`,
      [dealId, adminId, raterId, stars]
    );
    return res.rows[0];
  }
  return null;
}

async function getAdminStats(adminId) {
  if (useSupabase && supabase) {
    try {
      const { data: deals } = await supabase
        .from('deals')
        .select('id')
        .eq('admin_id', adminId)
        .eq('status', 'COMPLETED');

      const { data: ratings } = await supabase
        .from('ratings')
        .select('stars')
        .eq('admin_id', adminId);

      const dealsCount = deals?.length || 0;
      const ratingsCount = ratings?.length || 0;
      const totalStars = ratings?.reduce((acc, r) => acc + (r.stars || 5), 0) || (ratingsCount * 5);

      return {
        deals_count: dealsCount,
        ratings_count: ratingsCount,
        total_stars: totalStars,
      };
    } catch {}
  }
  return { deals_count: 0, ratings_count: 0, total_stars: 0 };
}

async function getAdminAvgRating(adminId) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('ratings')
      .select('stars')
      .eq('admin_id', adminId);
    if (error) {
      console.error('⟡ Supabase getAdminAvgRating error:', error.message);
      return { avg_rating: 0, total_ratings: 0 };
    }
    if (!data || data.length === 0) return { avg_rating: 0, total_ratings: 0 };
    const total = data.length;
    const sum = data.reduce((acc, row) => acc + (row.stars || 0), 0);
    return { avg_rating: (sum / total).toFixed(1), total_ratings: total };
  }
  if (pool) {
    const res = await pool.query(
      `SELECT COALESCE(ROUND(AVG(stars)::numeric, 1), 0) as avg_rating,
              COUNT(*) as total_ratings
       FROM ratings WHERE admin_id = $1`,
      [adminId]
    );
    return res.rows[0] || { avg_rating: 0, total_ratings: 0 };
  }
  return { avg_rating: 0, total_ratings: 0 };
}

// ══════
// ⟡ CRUD — Grupos Oficiales
// ══════

async function registerGroup(chatId, title, type = 'supergroup', username = null, tenantId = null) {
  if (useSupabase && supabase) {
    const payload = { chat_id: chatId, title, type, username };
    if (tenantId) payload.tenant_id = tenantId;
    const { data, error } = await supabase
      .from('official_groups')
      .upsert(payload, { onConflict: 'chat_id' })
      .select()
      .maybeSingle();
    if (error) console.error('⟡ Supabase registerGroup error:', error.message);
    return data;
  }
  if (pool) {
    const res = await pool.query(
      `INSERT INTO official_groups (chat_id, title, type, username, tenant_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (chat_id) DO UPDATE SET title = $2, type = $3, username = $4, tenant_id = $5
       RETURNING *`,
      [chatId, title, type, username, tenantId]
    );
    return res.rows[0];
  }
  return null;
}

const registerOfficialGroup = registerGroup;

async function removeGroup(chatId, tenantId = null) {
  if (useSupabase && supabase) {
    let q = supabase.from('official_groups').delete().eq('chat_id', chatId);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { error } = await q;
    if (error) console.error('⟡ Supabase removeGroup error:', error.message);
    return;
  }
  if (pool) {
    if (tenantId) {
      await pool.query(`DELETE FROM official_groups WHERE chat_id = $1 AND tenant_id = $2`, [chatId, tenantId]);
    } else {
      await pool.query(`DELETE FROM official_groups WHERE chat_id = $1`, [chatId]);
    }
  }
}

async function getAllGroups(tenantId = null) {
  if (useSupabase && supabase) {
    let q = supabase.from('official_groups').select('*').order('added_at');
    if (tenantId) {
      q = q.eq('tenant_id', tenantId);
    } else {
      q = q.is('tenant_id', null);
    }
    const { data, error } = await q;
    if (error && !error.message.includes('tenant_id')) {
      console.error('⟡ Supabase getAllGroups error:', error.message);
    }
    if (!data && !tenantId) {
      const fb = await supabase.from('official_groups').select('*').order('added_at');
      return fb.data || [];
    }
    return data || [];
  }
  if (pool) {
    let res;
    if (tenantId) {
      res = await pool.query(`SELECT * FROM official_groups WHERE tenant_id = $1 ORDER BY added_at`, [tenantId]);
    } else {
      res = await pool.query(`SELECT * FROM official_groups WHERE tenant_id IS NULL ORDER BY added_at`);
    }
    return res.rows;
  }
  return [];
}

const fs = require('fs');
const path = require('path');
const SETTINGS_FILE = path.resolve(__dirname, '../../data/settings.json');

function loadLocalSettings() {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveLocalSettings(settings) {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch {}
}

async function setSetting(key, value, tenantId = null) {
  // Aislamiento Multi-Tenant: Si es un Sub-Bot, guardar en su propio registro
  if (tenantId) {
    const subBot = await getSubBotById(tenantId);
    if (subBot) {
      const custom = (typeof subBot.custom_settings === 'object' && subBot.custom_settings) ? { ...subBot.custom_settings } : {};
      custom[key] = value.toString();
      const updates = { custom_settings: custom };
      if (['escrow_group_id', 'staff_chat_id', 'staff_thread_id', 'log_channel_id', 'log_thread_id', 'burn_chat_id', 'burn_thread_id', 'public_burn_channel_id', 'public_burn_thread_id', 'groups_folder_link'].includes(key)) {
        updates[key] = /^-?\d+$/.test(value) ? Number(value) : value;
      }
      await updateSubBot(tenantId, updates);
      return;
    }
  }

  // 1. Guardar en archivo local JSON (Bot Principal)
  const local = loadLocalSettings();
  local[key] = value.toString();
  saveLocalSettings(local);

  // 2. Guardar en Supabase bot_settings (Bot Principal)
  if (useSupabase && supabase) {
    try {
      await supabase
        .from('bot_settings')
        .upsert({ key, value: value.toString() }, { onConflict: 'key' });
    } catch {}
    return;
  }
}

async function getSetting(key, tenantId = null) {
  // Aislamiento Multi-Tenant: Si es un Sub-Bot, leer de su registro exclusivo
  if (tenantId) {
    const subBot = await getSubBotById(tenantId);
    if (subBot) {
      if (subBot[key] !== undefined && subBot[key] !== null) return String(subBot[key]);
      if (subBot.custom_settings && subBot.custom_settings[key] !== undefined) return String(subBot.custom_settings[key]);
    }
    return null;
  }

  // Bot Principal: Intentar desde Supabase
  if (useSupabase && supabase) {
    try {
      const { data } = await supabase
        .from('bot_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (data && data.value) return data.value;
    } catch {}
  }

  // Fallback a archivo local JSON
  const local = loadLocalSettings();
  if (local[key]) return local[key];

  return null;
}

// ══════
// ⟡ CRUD — Estafadores & Reportes
// ══════

async function createBurnReport(reporterId, targetId, context, proofFileIds, proofUrls, targetUsername = null, targetName = null) {
  let enrichedContext = context || '';
  if (targetUsername && (!targetId || Number(targetId) === 0)) {
    const cleanUser = targetUsername.replace(/^@/, '');
    if (!enrichedContext.includes('[ACUSADO:')) {
      enrichedContext = `[ACUSADO: @${cleanUser}${targetName ? ` | ${targetName}` : ''}]\n${enrichedContext}`;
    }
  }

  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('burn_reports')
      .insert({
        reporter_id: reporterId,
        target_id: targetId || 0,
        context: enrichedContext,
        proof_file_ids: proofFileIds,
        proof_urls: proofUrls || [],
      })
      .select()
      .single();
    if (error) console.error('⟡ Supabase createBurnReport error:', error.message);
    return data || { id: Date.now() };
  }
  if (pool) {
    const res = await pool.query(
      `INSERT INTO burn_reports (reporter_id, target_id, context, proof_file_ids, proof_urls)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [reporterId, targetId || 0, enrichedContext, proofFileIds, proofUrls || []]
    );
    return res.rows[0];
  }
  return { id: Date.now() };
}

async function getBurnReport(reportId) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('burn_reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle();
    if (error) console.error('⟡ Supabase getBurnReport error:', error.message);
    return data || null;
  }
  if (pool) {
    const res = await pool.query(`SELECT * FROM burn_reports WHERE id = $1`, [reportId]);
    return res.rows[0] || null;
  }
  return null;
}

async function approveBurnReport(reportId, reviewerId) {
  if (useSupabase && supabase) {
    const { error } = await supabase
      .from('burn_reports')
      .update({
        status: 'APPROVED',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reportId);
    if (error) console.error('⟡ Supabase approveBurnReport error:', error.message);
    return;
  }
  if (pool) {
    await pool.query(
      `UPDATE burn_reports SET status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2`,
      [reviewerId, reportId]
    );
  }
}

async function rejectBurnReport(reportId, reviewerId) {
  if (useSupabase && supabase) {
    const { error } = await supabase
      .from('burn_reports')
      .update({
        status: 'REJECTED',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reportId);
    if (error) console.error('⟡ Supabase rejectBurnReport error:', error.message);
    return;
  }
  if (pool) {
    await pool.query(
      `UPDATE burn_reports SET status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2`,
      [reviewerId, reportId]
    );
  }
}

async function updateBurnReportStatus(reportId, status, reviewerId) {
  if (status === 'APPROVED') {
    return approveBurnReport(reportId, reviewerId);
  } else {
    return rejectBurnReport(reportId, reviewerId);
  }
}

async function getAllBurnReports(status = null) {
  if (useSupabase && supabase) {
    let q = supabase.from('burn_reports').select('*').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status.toUpperCase());
    const { data, error } = await q;
    if (error) console.error('⟡ Supabase getAllBurnReports error:', error.message);
    return data || [];
  }
  if (pool) {
    let query = `SELECT * FROM burn_reports`;
    const params = [];
    if (status) {
      query += ` WHERE status = $1`;
      params.push(status.toUpperCase());
    }
    query += ` ORDER BY created_at DESC`;
    const res = await pool.query(query, params);
    return res.rows;
  }
  return [];
}

async function burnUser(target, reportedBy = null, context = null, approvedBy = null, username = null, firstName = null) {
  let userId, rBy, ctxText, aBy, uName, fName;

  if (typeof target === 'object' && target !== null && !Array.isArray(target) && (target.userId !== undefined || target.user_id !== undefined)) {
    // Objeto estructurado
    userId = Number(target.userId || target.user_id);
    uName = target.username || null;
    fName = target.firstName || target.first_name || null;
    ctxText = target.context || target.reason || 'Sancionado en lista negra / GBAN';
    rBy = target.reportedBy || target.reported_by || target.moderatorId || null;
    aBy = target.approvedBy || target.approved_by || target.moderatorId || null;
  } else {
    // Argumentos posicionales
    userId = Number(target);

    const isNum = (v) => v !== null && v !== undefined && /^\d+$/.test(String(v).trim());

    // Si reportedBy no es numérico (ej: username o string), ajustarlo
    if (!isNum(reportedBy) && typeof reportedBy === 'string' && reportedBy.length > 0 && !uName) {
      uName = reportedBy.replace(/^@/, '');
    }

    if (typeof context === 'string') {
      ctxText = context;
    } else if (typeof approvedBy === 'string') {
      ctxText = approvedBy;
    } else {
      ctxText = 'Sanción oficial de lista negra / GBAN';
    }

    const parseNumericId = (val) => {
      if (!val) return null;
      if (typeof val === 'number') return val;
      const digits = String(val).replace(/\D/g, '');
      return digits.length > 0 ? parseInt(digits, 10) : null;
    };

    rBy = parseNumericId(reportedBy) || parseNumericId(approvedBy) || userId || 0;
    aBy = parseNumericId(approvedBy) || parseNumericId(reportedBy) || userId || 0;
    if (!uName && typeof username === 'string') uName = username.replace(/^@/, '');
    if (!fName && typeof firstName === 'string') fName = firstName;
  }

  if (uName) uName = uName.replace(/^@/, '').trim();

  // Si faltan datos de usuario, resolverlos desde users
  if (!uName || !fName) {
    try {
      const u = await getUser(userId);
      if (u) {
        if (!uName) uName = u.username;
        if (!fName) fName = u.first_name;
      }
    } catch {}
  }

  if (useSupabase && supabase) {
    const payload = {
      user_id: userId,
      username: uName || null,
      first_name: fName || null,
      reported_by: Number(rBy) || 0,
      context: ctxText || 'Sancionado en lista negra / GBAN',
      approved_by: Number(aBy) || Number(rBy) || 0,
      burned_at: new Date().toISOString(),
    };

    let { data, error } = await supabase
      .from('burned_users')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .maybeSingle();

    if (error && error.message && error.message.includes('first_name')) {
      delete payload.first_name;
      const retry = await supabase
        .from('burned_users')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) console.error('⟡ Supabase burnUser error:', error.message);
    return data;
  }

  if (pool) {
    const res = await pool.query(
      `INSERT INTO burned_users (user_id, username, first_name, reported_by, context, approved_by, burned_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         username = COALESCE(EXCLUDED.username, burned_users.username),
         first_name = COALESCE(EXCLUDED.first_name, burned_users.first_name),
         context = EXCLUDED.context,
         reported_by = EXCLUDED.reported_by,
         approved_by = EXCLUDED.approved_by,
         burned_at = NOW()
       RETURNING *`,
      [userId, uName, fName, Number(rBy) || 0, ctxText, Number(aBy) || 0]
    );
    return res.rows[0];
  }
  return null;
}

async function isUserBurned(userId, username = null) {
  if (!userId && !username) return false;

  const redisDb = require('./redis');

  // 1. Verificar primero en caché de memoria ultra-rápida (Redis)
  if (userId) {
    const cached = await redisDb.getCache(`is_burned:${userId}`);
    if (cached !== null && cached !== undefined) return Boolean(cached);
  }
  if (username) {
    const cleanUser = String(username).replace(/^@/, '').toLowerCase().trim();
    const cached = await redisDb.getCache(`is_burned:@${cleanUser}`);
    if (cached !== null && cached !== undefined) return Boolean(cached);
  }

  let burned = false;

  // 2. Consulta en Supabase
  if (useSupabase && supabase) {
    try {
      if (userId) {
        const { data } = await supabase
          .from('burned_users')
          .select('id')
          .eq('user_id', Number(userId))
          .limit(1);
        if (data && data.length > 0) burned = true;
      }
      if (!burned && username) {
        const cleanUser = String(username).replace(/^@/, '').toLowerCase().trim();
        const { data } = await supabase
          .from('burned_users')
          .select('id')
          .ilike('username', cleanUser)
          .limit(1);
        if (data && data.length > 0) burned = true;
      }
    } catch {}
  }

  // 3. Fallback PostgreSQL directo
  if (!burned && pool) {
    try {
      if (userId) {
        const res = await pool.query(`SELECT 1 FROM burned_users WHERE user_id = $1 LIMIT 1`, [Number(userId)]);
        if (res.rows.length > 0) burned = true;
      }
      if (!burned && username) {
        const cleanUser = String(username).replace(/^@/, '').toLowerCase().trim();
        const res = await pool.query(`SELECT 1 FROM burned_users WHERE LOWER(username) = LOWER($1) LIMIT 1`, [cleanUser]);
        if (res.rows.length > 0) burned = true;
      }
    } catch {}
  }

  // 4. Guardar en caché Redis (60 segundos si no está quemado, 2 horas si está quemado)
  const ttl = burned ? 7200 : 60;
  if (userId) await redisDb.setCache(`is_burned:${userId}`, burned, ttl);
  if (username) {
    const cleanUser = String(username).replace(/^@/, '').toLowerCase().trim();
    await redisDb.setCache(`is_burned:@${cleanUser}`, burned, ttl);
  }

  return burned;
}

async function isBurned(userId) {
  return isUserBurned(userId);
}

async function getBurnedUserInfo(identifier) {
  if (!identifier) return null;
  const isNumeric = /^\d+$/.test(String(identifier).trim());

  if (isNumeric) {
    const userId = parseInt(String(identifier).trim(), 10);
    if (useSupabase && supabase) {
      const { data } = await supabase
        .from('burned_users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) return data;
    }
    if (pool) {
      const res = await pool.query(`SELECT * FROM burned_users WHERE user_id = $1`, [userId]);
      if (res.rows.length > 0) return res.rows[0];
    }
  }

  // Buscar por username
  const cleanUsername = String(identifier).replace(/^@/, '').toLowerCase().trim();
  if (cleanUsername) {
    if (useSupabase && supabase) {
      const { data } = await supabase
        .from('burned_users')
        .select('*')
        .ilike('username', cleanUsername)
        .maybeSingle();
      if (data) return data;
    }
    if (pool) {
      const res = await pool.query(`SELECT * FROM burned_users WHERE LOWER(username) = LOWER($1)`, [cleanUsername]);
      if (res.rows.length > 0) return res.rows[0];
    }
  }

  return null;
}

// ── Gestión de Advertencias (Warnings) ──
async function addWarning(userId, chatId, moderatorId, reason) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('warnings')
      .insert({
        user_id: userId,
        chat_id: chatId,
        moderator_id: moderatorId,
        reason: reason || 'Advertencia del Staff',
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();
    if (!error && data) return data;
  }
  if (pool) {
    try {
      const res = await pool.query(
        `INSERT INTO warnings (user_id, chat_id, moderator_id, reason, created_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [userId, chatId, moderatorId, reason || 'Advertencia del Staff']
      );
      return res.rows[0];
    } catch {}
  }
  // Fallback con mod_logs
  return addModLog('WARN', moderatorId, userId, chatId, reason);
}

async function getWarnings(userId, chatId = null) {
  if (useSupabase && supabase) {
    let query = supabase.from('warnings').select('*').eq('user_id', userId);
    if (chatId) query = query.eq('chat_id', chatId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) return data;
  }
  if (pool) {
    try {
      let q = `SELECT * FROM warnings WHERE user_id = $1`;
      const params = [userId];
      if (chatId) {
        q += ` AND chat_id = $2`;
        params.push(chatId);
      }
      q += ` ORDER BY created_at DESC`;
      const res = await pool.query(q, params);
      if (res.rows.length > 0) return res.rows;
    } catch {}
  }
  // Fallback con mod_logs
  if (useSupabase && supabase) {
    const { data } = await supabase
      .from('mod_logs')
      .select('*')
      .eq('target_id', userId)
      .eq('action', 'WARN');
    return data || [];
  }
  return [];
}

async function clearWarnings(userId, chatId = null) {
  if (useSupabase && supabase) {
    let query = supabase.from('warnings').delete().eq('user_id', userId);
    if (chatId) query = query.eq('chat_id', chatId);
    await query;
    return true;
  }
  if (pool) {
    try {
      if (chatId) {
        await pool.query(`DELETE FROM warnings WHERE user_id = $1 AND chat_id = $2`, [userId, chatId]);
      } else {
        await pool.query(`DELETE FROM warnings WHERE user_id = $1`, [userId]);
      }
      return true;
    } catch {}
  }
  return true;
}

async function getAllBurnedUsers(limit = 50, offset = 0) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('burned_users')
      .select('*')
      .order('burned_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) console.error('⟡ Supabase getAllBurnedUsers error:', error.message);
    return data || [];
  }
  if (pool) {
    const res = await pool.query(
      `SELECT * FROM burned_users ORDER BY burned_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.rows;
  }
  return [];
}

async function getBurnedUsersCount() {
  if (useSupabase && supabase) {
    const { count, error } = await supabase
      .from('burned_users')
      .select('*', { count: 'exact', head: true });
    if (error) console.error('⟡ Supabase getBurnedUsersCount error:', error.message);
    return count || 0;
  }
  if (pool) {
    const res = await pool.query(`SELECT COUNT(*) as count FROM burned_users`);
    return parseInt(res.rows[0]?.count || 0);
  }
  return 0;
}

async function getUserDealsCount(userId) {
  if (useSupabase && supabase) {
    const { count } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .or(`creator_id.eq.${userId},admin_id.eq.${userId}`);
    return count || 0;
  }
  if (pool) {
    const res = await pool.query(
      `SELECT COUNT(*) as count FROM deals WHERE creator_id = $1 OR admin_id = $1`,
      [userId]
    );
    return parseInt(res.rows[0]?.count || 0);
  }
  return 0;
}

// ══════
// ⟡ CRUD — Logs de Moderación
// ══════

async function addModLog(action, moderatorId, targetId, chatId, reason) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('mod_logs')
      .insert({
        action,
        moderator_id: moderatorId,
        target_id: targetId,
        chat_id: chatId,
        reason,
      })
      .select()
      .maybeSingle();
    if (error) console.error('⟡ Supabase addModLog error:', error.message);
    return data;
  }
  if (pool) {
    const res = await pool.query(
      `INSERT INTO mod_logs (action, moderator_id, target_id, chat_id, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [action, moderatorId, targetId, chatId, reason]
    );
    return res.rows[0];
  }
  return null;
}

async function getAuditLogs({ page = 1, limit = 25, action = null, search = '', tenantId = null } = {}) {
  const offset = (page - 1) * limit;

  if (useSupabase && supabase) {
    let q = supabase
      .from('mod_logs')
      .select('*', { count: 'exact' });

    if (action && action !== 'ALL') {
      q = q.eq('action', action);
    }

    if (search && search.trim()) {
      const term = search.trim();
      const num = Number(term);
      if (!isNaN(num) && num > 0) {
        q = q.or(`target_id.eq.${num},moderator_id.eq.${num},chat_id.eq.${num}`);
      } else {
        q = q.ilike('reason', `%${term}%`);
      }
    }

    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await q;
    if (error) {
      console.error('⟡ Supabase getAuditLogs error:', error.message);
      return { logs: [], total: 0, page, totalPages: 0 };
    }

    // Cache local de grupos y usuarios para enriquecer rápido
    const groups = await getAllGroups(tenantId);
    const groupsMap = new Map(groups.map((g) => [Number(g.chat_id), g.title]));

    const staffList = await getAllStaff(tenantId);
    const staffMap = new Map(staffList.map((s) => [Number(s.user_id), s.first_name || s.username]));

    const enriched = (data || []).map((log) => {
      const chatTitle = groupsMap.get(Number(log.chat_id)) || (log.chat_id ? `Grupo #${log.chat_id}` : 'Global / Sistema');
      const modName = staffMap.get(Number(log.moderator_id)) || (log.moderator_id ? `Admin #${log.moderator_id}` : 'Bot Automático');

      return {
        ...log,
        chat_title: chatTitle,
        moderator_name: modName,
      };
    });

    return {
      logs: enriched,
      total: count || enriched.length,
      page,
      limit,
      totalPages: Math.ceil((count || enriched.length) / limit),
    };
  }

  if (pool) {
    let whereClauses = [];
    let params = [];

    if (action && action !== 'ALL') {
      params.push(action);
      whereClauses.push(`action = $${params.length}`);
    }

    if (search && search.trim()) {
      const term = search.trim();
      const num = Number(term);
      if (!isNaN(num) && num > 0) {
        params.push(num);
        whereClauses.push(`(target_id = $${params.length} OR moderator_id = $${params.length} OR chat_id = $${params.length})`);
      } else {
        params.push(`%${term}%`);
        whereClauses.push(`reason ILIKE $${params.length}`);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM mod_logs ${whereSql}`, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    params.push(limit, offset);
    const logsRes = await pool.query(
      `SELECT * FROM mod_logs ${whereSql} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      logs: logsRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  return { logs: [], total: 0, page, totalPages: 0 };
}

// ══════
// ⟡ Inicialización
// ══════

async function syncGbanLogsToBurnedUsers() {
  try {
    if (useSupabase && supabase) {
      const { data: logs } = await supabase.from('mod_logs').select('*').eq('action', 'GBAN');
      if (logs && logs.length > 0) {
        for (const log of logs) {
          const targetId = Number(log.target_id);
          const isRegistered = await isUserBurned(targetId);
          if (!isRegistered) {
            await burnUser({
              userId: targetId,
              context: log.reason || 'GBAN previo registrado en logs',
              reportedBy: Number(log.moderator_id) || 0,
              approvedBy: Number(log.moderator_id) || 0,
            });
          }
        }
      }
    }
  } catch {}
}

async function initialize() {
  if (useSupabase && supabase) {
    // Probar conexión con Supabase
    const { error } = await supabase.from('users').select('user_id').limit(1);
    if (error) {
      console.warn('⟡ Supabase: Tablas pendientes de creación en SQL Editor:', error.message);
    } else {
      console.log('✓ Supabase: Base de datos conectada y accesible.');
      // Auto-sincronización de seguridad de logs antiguos de GBAN a burned_users
      syncGbanLogsToBurnedUsers().catch(() => {});
    }
    return;
  }

  if (pool) {
    try {
      const fs = require('fs');
      const path = require('path');
      const migrationPath = path.join(__dirname, 'migrations', '001_initial.sql');
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const client = await pool.connect();
      try {
        await client.query(sql);
        console.log('⟡ PostgreSQL: Migración ejecutada correctamente.');
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('⟡ PostgreSQL: Error en migración:', err.message);
      throw err;
    }
  }
}

// ══════
// ⟡ CRUD — Sub-Bots (Plataforma SaaS Multi-Tenant)
// ══════

async function createSubBot(data) {
  const payload = {
    bot_token: data.bot_token || data.botToken,
    bot_username: data.bot_username || data.botUsername || null,
    community_name: data.community_name || data.communityName || 'Ventas Libres Perú',
    owner_ids: Array.isArray(data.owner_ids || data.ownerIds) ? (data.owner_ids || data.ownerIds) : [],
    plan_status: data.plan_status || data.planStatus || 'ACTIVE',
    expires_at: data.expires_at || data.expiresAt || null,
    channels_to_verify: Array.isArray(data.channels_to_verify || data.channelsToVerify) ? (data.channels_to_verify || data.channelsToVerify) : [],
    groups_folder_link: data.groups_folder_link || data.groupsFolderLink || null,
    staff_chat_id: (data.staff_chat_id || data.staffChatId) ? Number(data.staff_chat_id || data.staffChatId) : null,
    staff_thread_id: (data.staff_thread_id || data.staffThreadId) ? Number(data.staff_thread_id || data.staffThreadId) : null,
    log_channel_id: (data.log_channel_id || data.logChannelId) ? Number(data.log_channel_id || data.logChannelId) : null,
    log_thread_id: (data.log_thread_id || data.logThreadId) ? Number(data.log_thread_id || data.logThreadId) : null,
    burn_chat_id: (data.burn_chat_id || data.burnChatId) ? Number(data.burn_chat_id || data.burnChatId) : null,
    burn_thread_id: (data.burn_thread_id || data.burnThreadId) ? Number(data.burn_thread_id || data.burnThreadId) : null,
    public_burn_channel_id: (data.public_burn_channel_id || data.publicBurnChannelId) ? Number(data.public_burn_channel_id || data.publicBurnChannelId) : null,
    public_burn_thread_id: (data.public_burn_thread_id || data.publicBurnThreadId) ? Number(data.public_burn_thread_id || data.publicBurnThreadId) : null,
    escrow_group_id: (data.escrow_group_id || data.escrowGroupId) ? Number(data.escrow_group_id || data.escrowGroupId) : null,
    custom_settings: data.custom_settings || data.customSettings || {},
  };

  if (useSupabase && supabase) {
    const { data: res, error } = await supabase
      .from('sub_bots')
      .insert(payload)
      .select()
      .maybeSingle();
    if (error) console.error('⟡ Supabase createSubBot error:', error.message);
    return res;
  }
  if (pool) {
    const res = await pool.query(
      `INSERT INTO sub_bots (
        bot_token, bot_username, community_name, owner_ids, plan_status, expires_at,
        channels_to_verify, groups_folder_link, staff_chat_id, staff_thread_id,
        log_channel_id, log_thread_id, burn_chat_id, burn_thread_id,
        public_burn_channel_id, public_burn_thread_id, escrow_group_id, custom_settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        payload.bot_token,
        payload.bot_username,
        payload.community_name,
        payload.owner_ids,
        payload.plan_status,
        payload.expires_at,
        JSON.stringify(payload.channels_to_verify),
        payload.groups_folder_link,
        payload.staff_chat_id,
        payload.staff_thread_id,
        payload.log_channel_id,
        payload.log_thread_id,
        payload.burn_chat_id,
        payload.burn_thread_id,
        payload.public_burn_channel_id,
        payload.public_burn_thread_id,
        payload.escrow_group_id,
        JSON.stringify(payload.custom_settings),
      ]
    );
    return res.rows[0];
  }
  return null;
}

async function getAllSubBots() {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('sub_bots')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('⟡ Supabase getAllSubBots error:', error.message);
    return data || [];
  }
  if (pool) {
    const res = await pool.query(`SELECT * FROM sub_bots ORDER BY created_at DESC`);
    return res.rows || [];
  }
  return [];
}

async function getSubBotById(id) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('sub_bots')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) console.error('⟡ Supabase getSubBotById error:', error.message);
    return data;
  }
  if (pool) {
    const res = await pool.query(`SELECT * FROM sub_bots WHERE id = $1`, [id]);
    return res.rows[0] || null;
  }
  return null;
}

async function getSubBotByToken(token) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('sub_bots')
      .select('*')
      .eq('bot_token', token)
      .maybeSingle();
    if (error) console.error('⟡ Supabase getSubBotByToken error:', error.message);
    return data;
  }
  if (pool) {
    const res = await pool.query(`SELECT * FROM sub_bots WHERE bot_token = $1`, [token]);
    return res.rows[0] || null;
  }
  return null;
}

async function updateSubBot(id, updates) {
  const cleanUpdates = { ...updates };
  cleanUpdates.updated_at = new Date().toISOString();

  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('sub_bots')
      .update(cleanUpdates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) console.error('⟡ Supabase updateSubBot error:', error.message);
    return data;
  }
  if (pool) {
    if (cleanUpdates.channels_to_verify && typeof cleanUpdates.channels_to_verify !== 'string') {
      cleanUpdates.channels_to_verify = JSON.stringify(cleanUpdates.channels_to_verify);
    }
    if (cleanUpdates.custom_settings && typeof cleanUpdates.custom_settings !== 'string') {
      cleanUpdates.custom_settings = JSON.stringify(cleanUpdates.custom_settings);
    }
    const keys = Object.keys(cleanUpdates);
    const setClause = keys.map((k, idx) => `${k} = $${idx + 2}`).join(', ');
    const values = Object.values(cleanUpdates);
    const res = await pool.query(`UPDATE sub_bots SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...values]);
    return res.rows[0] || null;
  }
  return null;
}

async function deleteSubBot(id) {
  if (useSupabase && supabase) {
    const { error } = await supabase.from('sub_bots').delete().eq('id', id);
    if (error) console.error('⟡ Supabase deleteSubBot error:', error.message);
    return true;
  }
  if (pool) {
    await pool.query(`DELETE FROM sub_bots WHERE id = $1`, [id]);
    return true;
  }
  return false;
}

async function close() {
  if (pool) {
    await pool.end();
  }
}

module.exports = {
  initialize,
  close,
  // Users
  upsertUser,
  verifyUser,
  toggleUserVerification,
  getAllUsers,
  getUser,
  getUserByUsername,
  searchUsers,
  recordTenantUser,
  getCommunityUsers,
  findMultiAccounts,
  getUsersWithoutUsername,
  // Verificaciones Pendientes
  addPendingVerification,
  removePendingVerification,
  getPendingVerification,
  // Staff
  setStaffRole,
  removeStaff,
  getStaffMember,
  getAllStaff,
  getStaffByRole,
  // Deals
  createDeal,
  getDeal,
  assignDeal,
  updateDealStatus,
  updateDealGroup,
  getUserDeals,
  getAllDeals,
  getUserDealsCount,
  // Ratings
  addRating,
  getAdminStats,
  getAdminAvgRating,
  // Groups
  registerGroup,
  registerOfficialGroup,
  removeGroup,
  getAllGroups,
  setSetting,
  getSetting,
  // Burn / Lista Negra
  createBurnReport,
  getBurnReport,
  getAllBurnReports,
  approveBurnReport,
  rejectBurnReport,
  updateBurnReportStatus,
  burnUser,
  unburnUser,
  isUserBurned,
  getBurnedUserInfo,
  getAllBurnedUsers,
  getBurnedUsersCount,
  // Logs & Warnings
  addModLog,
  getAuditLogs,
  addWarning,
  getWarnings,
  clearWarnings,
  // SaaS Multi-Tenant Sub-Bots
  createSubBot,
  getAllSubBots,
  getSubBotById,
  getSubBotByToken,
  updateSubBot,
  deleteSubBot,
};
