// ══════
// ⟡ Rutas de Staff y Sincronización
// ══════

const { Router } = require('express');
const staffController = require('../controllers/staffController');
const { requireAdminAuth } = require('../middlewares/auth');

const router = Router();

router.use(requireAdminAuth);

router.get('/', staffController.getStaffList);
router.post('/', staffController.addStaff);
router.get('/:id', staffController.getStaffMember);
router.put('/:id', staffController.updateStaff);
router.post('/:id/sync', staffController.syncStaffTelegram);
router.delete('/:id', staffController.deleteStaff);

module.exports = router;
