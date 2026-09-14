// ══════
// ⟡ Web Service: Gestión Integral de Staff y Sincronización
// ══════

const db = require('../../database/postgres');
const { syncUserWithTelegram } = require('./telegramSyncService');

async function listStaff() {
  const staff = await db.getAllStaff();
  return staff || [];
}

async function getStaff(userId) {
  const member = await db.getStaffMember(userId);
  return member || null;
}

async function updateStaff(userId, updates = {}) {
  const numId = Number(userId);
  const existing = await db.getStaffMember(numId);
  if (!existing) {
    throw new Error(`El usuario con ID ${numId} no se encuentra registrado en el Staff.`);
  }

  // 1. Si cambia el rol o título personalizado
  const role = updates.role || existing.role;
  const customTitle = updates.customTitle !== undefined ? updates.customTitle : (existing.custom_title || null);
  const username = updates.username !== undefined ? updates.username?.replace('@', '').trim() : existing.username;
  const firstName = updates.firstName !== undefined ? updates.firstName : existing.first_name;

  // Actualizar en tabla staff
  await db.setStaffRole(numId, role, updates.assignedBy || null);

  // Actualizar username y first_name en users y staff
  if (db.upsertUser) {
    await db.upsertUser(numId, username || null, firstName || null);
  }

  // Si Supabase / PG directo permite actualizar campos extra
  try {
    if (db.pool) {
      await db.pool.query(
        `UPDATE staff SET username = $1, first_name = $2, custom_title = $3 WHERE user_id = $4`,
        [username || null, firstName || null, customTitle, numId]
      );
    }
  } catch (err) {
    console.warn('⟡ Error actualizando metadatos de staff:', err.message);
  }

  return await db.getStaffMember(numId);
}

async function syncStaffTelegram(userId) {
  const numId = Number(userId);
  const syncResult = await syncUserWithTelegram(numId);
  
  if (!syncResult.success) {
    throw new Error(`Telegram API no pudo localizar al usuario: ${syncResult.error}`);
  }

  const existing = await db.getStaffMember(numId);
  if (!existing) {
    throw new Error(`El usuario ${numId} no pertenece al Staff.`);
  }

  // Guardar datos actualizados de Telegram
  await updateStaff(numId, {
    username: syncResult.username,
    firstName: syncResult.firstName,
  });

  return {
    userId: numId,
    username: syncResult.username,
    firstName: syncResult.firstName,
    photoUrl: syncResult.photoUrl,
    syncedAt: new Date().toISOString(),
  };
}

async function addStaff(data) {
  const numId = Number(data.userId);
  if (!numId) throw new Error('ID de usuario inválido.');

  const role = (data.role || 'ADMIN').toUpperCase();
  const username = data.username ? data.username.replace('@', '').trim() : null;
  const firstName = data.firstName || 'Staff';

  // Guardar rol
  await db.setStaffRole(numId, role, data.assignedBy || null);

  // Guardar usuario
  if (db.upsertUser) {
    await db.upsertUser(numId, username, firstName);
  }

  // Sincronizar con Telegram automáticamente para obtener datos frescos
  try {
    const tg = await syncUserWithTelegram(numId);
    if (tg.success) {
      await updateStaff(numId, {
        username: tg.username || username,
        firstName: tg.firstName || firstName,
        customTitle: data.customTitle || null,
      });
    }
  } catch {}

  return await db.getStaffMember(numId);
}

async function deleteStaff(userId) {
  const numId = Number(userId);
  return await db.removeStaff(numId);
}

module.exports = {
  listStaff,
  getStaff,
  updateStaff,
  syncStaffTelegram,
  addStaff,
  deleteStaff,
};
