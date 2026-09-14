// ══════
// ⟡ Rutas de GBan y Lista Negra
// ══════

const { Router } = require('express');
const gbanController = require('../controllers/gbanController');
const { requireAdminAuth } = require('../middlewares/auth');

const router = Router();

router.use(requireAdminAuth);

router.get('/', gbanController.getBurnedList);
router.post('/', gbanController.addBurnedUser);
router.get('/:userId', gbanController.getBurnedUser);
router.put('/:userId', gbanController.updateBurnedUser);
router.delete('/:userId', gbanController.removeBurnedUser);
router.post('/:userId/enforce', gbanController.enforceGban);

module.exports = router;
