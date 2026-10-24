const redisDb = require('../../database/redis');
const db = require('../../database/postgres');
const { DEAL_STATUS } = require('../../config/constants');

// ══════
// ⟡ Cola de Tratos (Redis + Supabase)
// ══════

/**
 * Crea un nuevo trato y lo añade a la cola con datos enriquecidos.
 */
async function enqueueDeal(creatorId, creatorUsername, role, counterpart, description, tenantId = null, extraData = {}) {
  const amount = extraData.amount ? Number(extraData.amount) : null;
  const currency = extraData.currency || 'PEN';
  const fee = extraData.fee ? Number(extraData.fee) : (amount ? Number((amount * 0.10).toFixed(2)) : null);
  const category = extraData.category || 'OTRO';
  const paymentMethod = extraData.paymentMethod || extraData.payment_method || 'A_COORDINAR';
  const phase = extraData.phase || 'AGREEMENT';

  // Crear en PostgreSQL / Supabase
  const deal = await db.createDeal(creatorId, {
    role,
    counterpart,
    description,
    creatorUsername,
    tenantId,
    amount,
    currency,
    fee,
    category,
    paymentMethod,
    phase,
  });

  const dealPayload = {
    id: deal.id,
    creatorId,
    creatorUsername: creatorUsername || null,
    role: role || 'Solicitante',
    counterpart: counterpart || 'Sin especificar',
    description: description || 'Sin especificar',
    amount,
    currency,
    fee,
    category,
    paymentMethod,
    phase,
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
  const dealState = (await redisDb.getDealState(dealId)) || (await redisDb.getCache(`deal_full_info:${dealId}`)) || {};
  dealState.adminId = adminId;
  dealState.status = DEAL_STATUS.ASSIGNED;
  await redisDb.updateDealState(dealId, dealState);
  await redisDb.setCache(`deal_full_info:${dealId}`, dealState, 86400 * 7);
}

/**
 * Marca un trato como en progreso (grupo creado).
 */
async function setDealInProgress(dealId, groupChatId, inviteLink, threadId = null) {
  await db.updateDealGroup(dealId, groupChatId, inviteLink, threadId);

  const dealState = (await redisDb.getDealState(dealId)) || (await redisDb.getCache(`deal_full_info:${dealId}`)) || {};
  dealState.status = DEAL_STATUS.IN_PROGRESS;
  dealState.groupChatId = groupChatId;
  dealState.inviteLink = inviteLink;
  dealState.threadId = threadId;
  await redisDb.updateDealState(dealId, dealState);
  await redisDb.setCache(`deal_full_info:${dealId}`, dealState, 86400 * 7);
}

/**
 * Actualiza la fase del trato (AGREEMENT -> FUNDS_DEPOSITED -> DELIVERY -> RELEASED, etc.)
 */
async function setDealPhase(dealId, phase) {
  await db.updateDealPhase(dealId, phase);

  const dealState = (await redisDb.getDealState(dealId)) || (await redisDb.getCache(`deal_full_info:${dealId}`)) || {};
  dealState.phase = phase;
  await redisDb.updateDealState(dealId, dealState);
  await redisDb.setCache(`deal_full_info:${dealId}`, dealState, 86400 * 7);
}

/**
 * Completa un trato.
 */
async function completeDeal(dealId) {
  await db.updateDealStatus(dealId, DEAL_STATUS.COMPLETED);
  await db.updateDealPhase(dealId, 'COMPLETED');
  await redisDb.removeDealFromQueue(dealId);
  const dealState = (await redisDb.getDealState(dealId)) || (await redisDb.getCache(`deal_full_info:${dealId}`)) || {};
  dealState.status = DEAL_STATUS.COMPLETED;
  dealState.phase = 'COMPLETED';
  await redisDb.setCache(`deal_full_info:${dealId}`, dealState, 86400 * 7);
}

/**
 * Cancela un trato.
 */
async function cancelDeal(dealId) {
  await db.updateDealStatus(dealId, DEAL_STATUS.CANCELLED);
  await db.updateDealPhase(dealId, 'CANCELLED');
  await redisDb.removeDealFromQueue(dealId);
  const dealState = (await redisDb.getDealState(dealId)) || (await redisDb.getCache(`deal_full_info:${dealId}`)) || {};
  dealState.status = DEAL_STATUS.CANCELLED;
  dealState.phase = 'CANCELLED';
  await redisDb.setCache(`deal_full_info:${dealId}`, dealState, 86400 * 7);
}

module.exports = {
  enqueueDeal,
  assignDealToAdmin,
  setDealInProgress,
  setDealPhase,
  completeDeal,
  cancelDeal,
};
