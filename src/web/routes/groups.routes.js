// ══════
// ⟡ Rutas de Grupos Oficiales y Seguridad
// ══════

const { Router } = require('express');
const groupsController = require('../controllers/groupsController');
const { requireAdminAuth } = require('../middlewares/auth');

const router = Router();

router.use(requireAdminAuth);

router.get('/', groupsController.getGroupsList);
router.post('/', groupsController.addGroup);
router.delete('/:chatId', groupsController.removeGroup);
router.get('/available', groupsController.getAvailableChats);
router.get('/primary', groupsController.getPrimaryGroup);
router.post('/primary', groupsController.setPrimaryGroup);
router.get('/:chatId/security', groupsController.getGroupSecurity);
router.put('/:chatId/security', groupsController.updateGroupSecurity);
router.post('/:chatId/reverify', groupsController.reverifyGroup);

module.exports = router;
