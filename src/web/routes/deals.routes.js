// ══════
// ⟡ Rutas de Tratos Escrow
// ══════

const { Router } = require('express');
const dealsController = require('../controllers/dealsController');
const { requireAdminAuth } = require('../middlewares/auth');

const router = Router();

router.use(requireAdminAuth);

router.get('/', dealsController.getDealsList);
router.post('/', dealsController.createDeal);
router.get('/:id', dealsController.getDealById);
router.put('/:id', dealsController.updateDeal);
router.delete('/:id', dealsController.deleteDeal);

module.exports = router;
