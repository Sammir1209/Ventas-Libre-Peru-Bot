// ══════
// ⟡ Web Controller: Estadísticas y Telemetría del Sistema
// ══════

const db = require('../../database/postgres');

async function getStats(req, res) {
  try {
    const [groups, users, staff, deals, burned] = await Promise.all([
      db.getAllGroups().catch(() => []),
      db.getAllUsers().catch(() => []),
      db.getAllStaff().catch(() => []),
      db.getAllDeals().catch(() => []),
      db.getAllBurnedUsers().catch(() => []),
    ]);

    const activeDeals = deals.filter(d => ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(d.status));
    const completedDeals = deals.filter(d => d.status === 'COMPLETED');

    res.json({
      ok: true,
      stats: {
        totalGroups: groups.length,
        totalUsers: users.length,
        totalStaff: staff.length,
        totalDeals: deals.length,
        activeDealsCount: activeDeals.length,
        completedDealsCount: completedDeals.length,
        totalBurned: burned.length,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  getStats,
};
