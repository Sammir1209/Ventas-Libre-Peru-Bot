// ══════
// ⟡ Enrutador Maestro de API REST Modular
// ══════

const { Router } = require('express');
const staffRoutes = require('./staff.routes');
const dealsRoutes = require('./deals.routes');
const gbanRoutes = require('./gban.routes');
const subbotsRoutes = require('./subbots.routes');
const groupsRoutes = require('./groups.routes');
const statsRoutes = require('./stats.routes');
const portalRoutes = require('./portal.routes');

const router = Router();

// Sub-rutas modulares
router.use('/staff', staffRoutes);
router.use('/deals', dealsRoutes);
router.use('/gban', gbanRoutes);
router.use('/subbots', subbotsRoutes);
router.use('/groups', groupsRoutes);
router.use('/stats', statsRoutes);
router.use('/portal', portalRoutes);

module.exports = router;
