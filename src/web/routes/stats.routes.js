// ══════
// ⟡ Rutas de Estadísticas y KPIs
// ══════

const { Router } = require('express');
const statsController = require('../controllers/statsController');
const { requireAdminAuth } = require('../middlewares/auth');

const router = Router();

router.use(requireAdminAuth);

router.get('/', statsController.getStats);

module.exports = router;
