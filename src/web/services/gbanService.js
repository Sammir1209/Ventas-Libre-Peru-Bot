// ══════
// ⟡ Web Service: Administración de GBan y Defensa Comunitaria
// ══════

const db = require('../../database/postgres');

async function listBurnedUsers(tenantId = null) {
  const burned = await db.getAllBurnedUsers(50, 0, tenantId);
  return burned || [];
}

async function getBurnedUser(userId) {
  const numId = Number(userId);
  return await db.getBurnedUserInfo(numId);
}

async function addBurnedUser(data) {
  const userId = Number(data.userId);
  if (!userId) throw new Error('ID de usuario inválido.');

  const reportedBy = Number(data.reportedBy) || 1;
  const approvedBy = Number(data.approvedBy) || 1;
  const context = data.context || 'Registrado desde portal web';
  const username = data.username ? data.username.replace('@', '').trim() : null;
  const firstName = data.firstName || 'Usuario';
  const tenantId = data.tenantId || null;

  // Registrar en tabla de quemados con aislamiento multi-tenant
  await db.burnUser(userId, reportedBy, context, approvedBy, username, firstName, tenantId);

  // Asegurar username y first_name
  if (db.pool) {
    try {
      await db.pool.query(
        `UPDATE burned_users SET username = $1, first_name = $2 WHERE user_id = $3`,
        [username, firstName, userId]
      );
    } catch {}
  }

  // Si se adjuntaron URLs de prueba o reporte previo
  if (data.proofUrls && Array.isArray(data.proofUrls)) {
    try {
      await db.createBurnReport(reportedBy, userId, context, [], data.proofUrls);
    } catch {}
  }

  // Registrar en log de auditoría
  try {
    await db.addModLog('GBAN', approvedBy, userId, null, context);
  } catch {}

  return await db.getBurnedUserInfo(userId);
}

async function updateBurnedUser(userId, updates = {}) {
  const numId = Number(userId);
  const existing = await db.getBurnedUserInfo(numId);
  if (!existing) {
    throw new Error(`El usuario con ID ${numId} no se encuentra en la lista negra.`);
  }

  const context = updates.context !== undefined ? updates.context : existing.context;
  const username = updates.username !== undefined ? updates.username?.replace('@', '').trim() : existing.username;
  const firstName = updates.firstName !== undefined ? updates.firstName : existing.first_name;

  if (db.pool) {
    await db.pool.query(
      `UPDATE burned_users SET context = $1, username = $2, first_name = $3 WHERE user_id = $4`,
      [context, username, firstName, numId]
    );
  }

  return await db.getBurnedUserInfo(numId);
}

async function removeBurnedUser(userId, executedBy = 1, tenantId = null) {
  const numId = Number(userId);
  // Soporte para firma sobrecargada removeBurnedUser(userId, tenantId)
  let resolvedTenantId = tenantId;
  let resolvedExecutedBy = executedBy;
  if (typeof executedBy === 'string' && executedBy.length > 10 && !tenantId) {
    resolvedTenantId = executedBy;
    resolvedExecutedBy = 1;
  }

  const result = await db.unburnUser(numId, resolvedTenantId);
  
  try {
    await db.addModLog('UNGBAN', resolvedExecutedBy, numId, null, 'Revocado desde portal web');
  } catch {}

  return result;
}

/**
 * Expulsa al estafador de los grupos oficiales registrados para el tenant
 */
async function enforceGbanInGroups(userId, botInstance, tenantId = null) {
  const numId = Number(userId);
  if (!botInstance) throw new Error('Instancia del bot de Telegram no disponible para expulsión.');

  const groups = await db.getAllGroups(tenantId);
  const results = {
    totalGroups: groups.length,
    bannedCount: 0,
    errors: [],
  };

  for (const g of groups) {
    try {
      await botInstance.api.banChatMember(g.chat_id, numId);
      results.bannedCount++;
    } catch (err) {
      // Registrar solo si no es error de usuario no encontrado en el chat
      if (!err.message?.includes('user not found') && !err.message?.includes('PARTICIPANT_ID_INVALID')) {
        results.errors.push({ chatId: g.chat_id, groupTitle: g.title, error: err.message });
      }
    }
  }

  return results;
}

module.exports = {
  listBurnedUsers,
  getBurnedUser,
  addBurnedUser,
  updateBurnedUser,
  removeBurnedUser,
  enforceGbanInGroups,
  // Alias de compatibilidad
  listBurned: listBurnedUsers,
  burnUser: addBurnedUser,
  removeBurned: removeBurnedUser,
};
