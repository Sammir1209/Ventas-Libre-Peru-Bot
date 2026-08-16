const db = require('../../database/postgres');

// ══════════════════════════════════════════════════════
// ⟡ Sistema de Calificación de Admins
// ══════════════════════════════════════════════════════

/**
 * Registra una calificación para un admin.
 */
async function rateAdmin(dealId, adminId, raterId, stars) {
  return db.addRating(dealId, adminId, raterId, stars);
}

/**
 * Obtiene la reputación promedio de un admin.
 */
async function getReputation(adminId) {
  const result = await db.getAdminAvgRating(adminId);
  return {
    avgRating: parseFloat(result.avg_rating) || 0,
    totalRatings: parseInt(result.total_ratings) || 0,
  };
}

module.exports = {
  rateAdmin,
  getReputation,
};
