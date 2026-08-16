const redisDb = require('../../database/redis');
const db = require('../../database/postgres');
const { DEAL_STATUS } = require('../../config/constants');

// ══════════════════════════════════════════════════════
// ⟡ Cola de Tratos (Redis + Supabase)
// ══════════════════════════════════════════════════════

/**
 * Crea un nuevo trato y lo añade a la cola con datos enriquecidos.
 */
async function enqueueDeal(creatorId, creatorUsername, role, counterpart, description) {
  // Crear en PostgreSQL / Supabase
  const deal = await db.createDeal(creatorId);

  // Añadir a cola Redis
  await redisDb.addDealToQueue(deal.id, {
    id: deal.id,
    creatorId,
    creatorUsername,
    role: role || 'N/A',
    counterpart: counterpart || 'N/A',
    description: description || 'Sin descripción',
    status: DEAL_STATUS.PENDING,
    createdAt: new Date().toISOString(),
  });

  return deal;
}

/**
 * Un admin acepta un trato de la cola.
 */
async function assignDealToAdmin(dealId, adminId) {
  // Actualizar PostgreSQL
  await db.assignDeal(dealId, adminId);

  // Actualizar estado en Redis
  const dealState = await redisDb.getDealState(dealId);
  if (dealState) {
    dealState.adminId = adminId;
    dealState.status = DEAL_STATUS.ASSIGNED;
    await redisDb.updateDealState(dealId, dealState);
  }
}

/**
 * Marca un trato como en progreso (grupo creado).
 */
async function setDealInProgress(dealId, groupChatId, inviteLink) {
  await db.updateDealGroup(dealId, groupChatId, inviteLink);

  const dealState = await redisDb.getDealState(dealId);
  if (dealState) {
    dealState.status = DEAL_STATUS.IN_PROGRESS;
    dealState.groupChatId = groupChatId;
    dealState.inviteLink = inviteLink;
    await redisDb.updateDealState(dealId, dealState);
  }
}

/**
 * Completa un trato.
 */
async function completeDeal(dealId) {
  await db.updateDealStatus(dealId, DEAL_STATUS.COMPLETED);
  await redisDb.removeDealFromQueue(dealId);
}

/**
 * Cancela un trato.
 */
async function cancelDeal(dealId) {
  await db.updateDealStatus(dealId, DEAL_STATUS.CANCELLED);
  await redisDb.removeDealFromQueue(dealId);
}

module.exports = {
  enqueueDeal,
  assignDealToAdmin,
  setDealInProgress,
  completeDeal,
  cancelDeal,
};
