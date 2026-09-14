const redisDb = require('../../database/redis');
const db = require('../../database/postgres');
const { DEAL_STATUS } = require('../../config/constants');

// ══════
// ⟡ Cola de Tratos (Redis + Supabase)
// ══════

/**
 * Crea un nuevo trato y lo añade a la cola con datos enriquecidos.
 */
async function enqueueDeal(creatorId, creatorUsername, role, counterpart, description, tenantId = null) {
  // Crear en PostgreSQL / Supabase
  const deal = await db.createDeal(creatorId, {
    role,
    counterpart,
    description,
    creatorUsername,
    tenantId,
  });

  const dealPayload = {
    id: deal.id,
    creatorId,
    creatorUsername: creatorUsername || null,
    role: role || 'Solicitante',
    counterpart: counterpart || 'Sin especificar',
    description: description || 'Sin especificar',
    status: DEAL_STATUS.PENDING,
    createdAt: new Date().toISOString(),
  };

  // Añadir a cola Redis y guardar estado persistente
  await redisDb.addDealToQueue(deal.id, dealPayload);
  await redisDb.setCache(`deal_full_info:${deal.id}`, dealPayload, 86400 * 7);

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
async function setDealInProgress(dealId, groupChatId, inviteLink, threadId = null) {
  await db.updateDealGroup(dealId, groupChatId, inviteLink, threadId);

  const dealState = await redisDb.getDealState(dealId);
  if (dealState) {
    dealState.status = DEAL_STATUS.IN_PROGRESS;
    dealState.groupChatId = groupChatId;
    dealState.inviteLink = inviteLink;
    dealState.threadId = threadId;
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
