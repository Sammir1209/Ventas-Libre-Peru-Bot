const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const config = require('../config/env');

// ══════════════════════════════════════════════════════
// ⟡ Capa de Base de Datos Híbrida: Supabase REST + PostgreSQL Directo
// ══════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════
// ⟡ CRUD — Usuarios
// ══════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════
// ⟡ CRUD — Staff
// ══════════════════════════════════════════════════════

async function setStaffRole(userId, username, firstName, role, assignedBy) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('staff')
      .upsert(
        {
          user_id: userId,
          username: username || null,
          first_name: firstName || null,
          role,
          assigned_by: assignedBy,
          assigned_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .maybeSingle();
    if (error) console.error('⟡ Supabase setStaffRole error:', error.message);
    return data;
  }
  if (pool) {
    const res = await pool.query(
      `INSERT INTO staff (user_id, username, first_name, role, assigned_by, assigned_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         username = $2, first_name = $3, role = $4, assigned_by = $5, assigned_at = NOW()
       RETURNING *`,
      [userId, username, firstName, role, assignedBy]
    );
    return res.rows[0];
  }
  return null;
}

async function removeStaff(userId) {
  if (useSupabase && supabase) {
    const { error } = await supabase.from('staff').delete().eq('user_id', userId);
    if (error) console.error('⟡ Supabase removeStaff error:', error.message);
    return;
  }
  if (pool) {
    await pool.query(`DELETE FROM staff WHERE user_id = $1`, [userId]);
  }
}

async function getStaffMember(userId) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) console.error('⟡ Supabase getStaffMember error:', error.message);
    return data || null;
  }
  if (pool) {
    const res = await pool.query(`SELECT * FROM staff WHERE user_id = $1`, [userId]);
    return res.rows[0] || null;
  }
  return null;
}

async function getAllStaff() {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('role')
      .order('username');
    if (error) console.error('⟡ Supabase getAllStaff error:', error.message);
    return data || [];
  }
  if (pool) {
    const res = await pool.query(`SELECT * FROM staff ORDER BY role, username`);
    return res.rows;
  }
  return [];
}

async function getStaffByRole(role) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('role', role);
    if (error) console.error('⟡ Supabase getStaffByRole error:', error.message);
    return data || [];
  }
  if (pool) {
    const res = await pool.query(`SELECT * FROM staff WHERE role = $1`, [role]);
    return res.rows;
  }
  return [];
}

// ══════════════════════════════════════════════════════
// ⟡ CRUD — Tratos (Deals)
// ══════════════════════════════════════════════════════

async function createDeal(creatorId) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('deals')
      .insert({ creator_id: creatorId })
      .select()
      .single();
    if (error) console.error('⟡ Supabase createDeal error:', error.message);
    return data;
  }
  if (pool) {
    const res = await pool.query(
      `INSERT INTO deals (creator_id) VALUES ($1) RETURNING *`,
      [creatorId]
    );
    return res.rows[0];
  }
  return { id: Date.now(), creator_id: creatorId, status: 'PENDING' };
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

async function updateDealGroup(dealId, groupChatId, inviteLink) {
  if (useSupabase && supabase) {
    const { error } = await supabase
      .from('deals')
      .update({
        group_chat_id: groupChatId,
        invite_link: inviteLink,
        status: 'IN_PROGRESS',
      })
      .eq('id', dealId);
    if (error) console.error('⟡ Supabase updateDealGroup error:', error.message);
    return;
  }
  if (pool) {
    await pool.query(
      `UPDATE deals SET group_chat_id = $1, invite_link = $2, status = 'IN_PROGRESS'
       WHERE id = $3`,
      [groupChatId, inviteLink, dealId]
    );
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

// ══════════════════════════════════════════════════════
// ⟡ CRUD — Calificaciones
// ══════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════
// ⟡ CRUD — Grupos Oficiales
// ══════════════════════════════════════════════════════

async function registerGroup(chatId, title) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('official_groups')
      .upsert({ chat_id: chatId, title }, { onConflict: 'chat_id' })
      .select()
      .maybeSingle();
    if (error) console.error('⟡ Supabase registerGroup error:', error.message);
    return data;
  }
  if (pool) {
    const res = await pool.query(
      `INSERT INTO official_groups (chat_id, title)
       VALUES ($1, $2)
       ON CONFLICT (chat_id) DO UPDATE SET title = $2
       RETURNING *`,
      [chatId, title]
    );
    return res.rows[0];
  }
  return null;
}

async function removeGroup(chatId) {
  if (useSupabase && supabase) {
    const { error } = await supabase.from('official_groups').delete().eq('chat_id', chatId);
    if (error) console.error('⟡ Supabase removeGroup error:', error.message);
    return;
  }
  if (pool) {
    await pool.query(`DELETE FROM official_groups WHERE chat_id = $1`, [chatId]);
  }
}

async function getAllGroups() {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('official_groups')
      .select('*')
      .order('added_at');
    if (error) console.error('⟡ Supabase getAllGroups error:', error.message);
    return data || [];
  }
  if (pool) {
    const res = await pool.query(`SELECT * FROM official_groups ORDER BY added_at`);
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

async function setSetting(key, value) {
  // 1. Guardar en archivo local JSON
  const local = loadLocalSettings();
  local[key] = value.toString();
  saveLocalSettings(local);

  // 2. Guardar en Supabase
  if (useSupabase && supabase) {
    try {
      await supabase
        .from('bot_settings')
        .upsert({ key, value: value.toString() }, { onConflict: 'key' });
    } catch {}
    return;
  }
}

async function getSetting(key) {
  // 1. Intentar desde Supabase
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

  // 2. Fallback a archivo local JSON
  const local = loadLocalSettings();
  if (local[key]) return local[key];

  return null;
}

// ══════════════════════════════════════════════════════
// ⟡ CRUD — Estafadores & Reportes
// ══════════════════════════════════════════════════════

async function createBurnReport(reporterId, targetId, context, proofFileIds, proofUrls) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('burn_reports')
      .insert({
        reporter_id: reporterId,
        target_id: targetId,
        context,
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
      [reporterId, targetId, context, proofFileIds, proofUrls || []]
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

async function burnUser(userId, reportedBy, context, approvedBy, username = null, firstName = null) {
  let finalUsername = username;
  let finalFirstName = firstName;
  if (!finalUsername || !finalFirstName) {
    try {
      const u = await getUser(userId);
      if (u) {
        if (!finalUsername) finalUsername = u.username;
        if (!finalFirstName) finalFirstName = u.first_name;
      }
    } catch {}
  }

  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('burned_users')
      .upsert(
        {
          user_id: userId,
          username: finalUsername,
          first_name: finalFirstName,
          reported_by: reportedBy,
          context,
          approved_by: approvedBy,
          burned_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .maybeSingle();
    if (error) console.error('⟡ Supabase burnUser error:', error.message);
    return data;
  }
  if (pool) {
    const res = await pool.query(
      `INSERT INTO burned_users (user_id, username, first_name, reported_by, context, approved_by, burned_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         username = EXCLUDED.username,
         first_name = EXCLUDED.first_name,
         context = EXCLUDED.context,
         reported_by = EXCLUDED.reported_by,
         approved_by = EXCLUDED.approved_by,
         burned_at = NOW()
       RETURNING *`,
      [userId, finalUsername, finalFirstName, reportedBy, context, approvedBy]
    );
    return res.rows[0];
  }
  return null;
}

async function isBurned(userId) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('burned_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    return !!data;
  }
  if (pool) {
    const res = await pool.query(`SELECT 1 FROM burned_users WHERE user_id = $1`, [userId]);
    return res.rows.length > 0;
  }
  return false;
}

async function getBurnedUserInfo(userId) {
  if (useSupabase && supabase) {
    const { data } = await supabase
      .from('burned_users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return data || null;
  }
  if (pool) {
    const res = await pool.query(`SELECT * FROM burned_users WHERE user_id = $1`, [userId]);
    return res.rows[0] || null;
  }
  return null;
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

// ══════════════════════════════════════════════════════
// ⟡ CRUD — Logs de Moderación
// ══════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════
// ⟡ Inicialización
// ══════════════════════════════════════════════════════

async function initialize() {
  if (useSupabase && supabase) {
    // Probar conexión con Supabase
    const { error } = await supabase.from('users').select('user_id').limit(1);
    if (error) {
      console.warn('⟡ Supabase: Tablas pendientes de creación en SQL Editor:', error.message);
    } else {
      console.log('✓ Supabase: Base de datos conectada y accesible.');
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
  getUser,
  getUserByUsername,
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
  getUserDealsCount,
  // Ratings
  addRating,
  getAdminStats,
  getAdminAvgRating,
  // Groups
  registerGroup,
  removeGroup,
  getAllGroups,
  setSetting,
  getSetting,
  // Burn / Lista Negra
  createBurnReport,
  getBurnReport,
  approveBurnReport,
  rejectBurnReport,
  updateBurnReportStatus,
  burnUser,
  unburnUser,
  isUserBurned,
  getBurnedUserInfo,
  getAllBurnedUsers,
  getBurnedUsersCount,
  // Logs
  addModLog,
};
