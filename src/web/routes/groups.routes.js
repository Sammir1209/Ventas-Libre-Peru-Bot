// ══════
// ⟡ Rutas de Grupos Oficiales y Seguridad
// ══════

const { Router } = require('express');
const groupsController = require('../controllers/groupsController');
const { requireAdminAuth } = require('../middlewares/auth');

const router = Router();

router.use(requireAdminAuth);

router.get('/', groupsController.getGroupsList);
router.get('/available', groupsController.getAvailableChats);
router.get('/:chatId/security', groupsController.getGroupSecurity);
router.put('/:chatId/security', groupsController.updateGroupSecurity);

module.exports = router;
