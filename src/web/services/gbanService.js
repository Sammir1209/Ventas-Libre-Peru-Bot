// ══════
// ⟡ Web Service: Administración de GBan y Defensa Comunitaria
// ══════

const db = require('../../database/postgres');

async function listBurnedUsers() {
  const burned = await db.getAllBurnedUsers();
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

  // Registrar en tabla de quemados
  await db.burnUser(userId, reportedBy, context, approvedBy);

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

async function removeBurnedUser(userId, executedBy = 1) {
  const numId = Number(userId);
  const result = await db.unburnUser(numId);
  
  try {
    await db.addModLog('UNGBAN', executedBy, numId, null, 'Revocado desde portal web');
  } catch {}

  return result;
}

/**
 * Expulsa al estafador de todos los grupos oficiales registrados en la base de datos
 */
async function enforceGbanInGroups(userId, mainBot) {
  const numId = Number(userId);
  if (!mainBot) throw new Error('Instancia del bot de Telegram no disponible para expulsión.');

  const groups = await db.getAllGroups();
  const results = {
    totalGroups: groups.length,
    bannedCount: 0,
    errors: [],
  };

  for (const g of groups) {
    try {
      await mainBot.api.banChatMember(g.chat_id, numId);
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
