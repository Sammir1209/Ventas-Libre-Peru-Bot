// ══════
// ⟡ Web Service: Gestión de Tratos Escrow y Mediaciones
// ══════

const db = require('../../database/postgres');

async function listDeals(tenantId = null) {
  const deals = await db.getAllDeals(tenantId);
  return deals || [];
}

async function getDeal(id) {
  const numId = Number(id);
  const deal = await db.getDeal(numId);
  return deal || null;
}

async function updateDeal(id, updates = {}) {
  const numId = Number(id);
  const existing = await db.getDeal(numId);
  if (!existing) {
    throw new Error(`Trato #${numId} no encontrado.`);
  }

  // 1. Reasignación de Mediador (admin_id)
  if (updates.adminId !== undefined) {
    const newAdminId = updates.adminId ? Number(updates.adminId) : null;
    await db.assignDeal(numId, newAdminId);
  }

  // 2. Cambio de Estado (status)
  if (updates.status && updates.status !== existing.status) {
    await db.updateDealStatus(numId, updates.status);
  }

  // 3. Modificación de Datos de Contraparte, Rol o Descripción
  try {
    if (db.pool) {
      const allowedCols = ['role', 'counterpart', 'description', 'invite_link', 'group_chat_id', 'thread_id'];
      const setClauses = [];
      const values = [numId];
      let idx = 2;

      for (const col of allowedCols) {
        if (updates[col] !== undefined) {
          setClauses.push(`${col} = $${idx}`);
          values.push(updates[col]);
          idx++;
        }
      }

      if (setClauses.length > 0) {
        await db.pool.query(
          `UPDATE deals SET ${setClauses.join(', ')} WHERE id = $1`,
          values
        );
      }
    }
  } catch (err) {
    console.warn('⟡ Error actualizando campos extendidos del trato:', err.message);
  }

  return await db.getDeal(numId);
}

async function createDeal(data) {
  const creatorId = Number(data.creatorId);
  if (!creatorId) throw new Error('ID del creador inválido.');

  const deal = await db.createDeal(creatorId, {
    role: data.role,
    counterpart: data.counterpart,
    description: data.description,
    creatorUsername: data.creatorUsername,
    tenantId: data.tenantId || null,
  });
  if (!deal) throw new Error('No se pudo crear el trato en la base de datos.');

  if (data.adminId || data.status || data.counterpart || data.description) {
    return await updateDeal(deal.id, data);
  }

  return deal;
}

async function deleteDeal(id) {
  const numId = Number(id);
  if (db.pool) {
    await db.pool.query(`DELETE FROM deals WHERE id = $1`, [numId]);
    return true;
  }
  return false;
}

module.exports = {
  listDeals,
  getDeal,
  updateDeal,
  createDeal,
  deleteDeal,
};
