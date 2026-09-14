// ══════
// ⟡ Rutas de Sub-Bots SaaS Multi-Tenant
// ══════

const { Router } = require('express');
const subbotsController = require('../controllers/subbotsController');
const { requireAdminAuth } = require('../middlewares/auth');

const router = Router();

router.use(requireAdminAuth);

router.get('/', subbotsController.getSubBotsList);
router.post('/', subbotsController.createSubBot);
router.get('/:id', subbotsController.getSubBot);
router.put('/:id', subbotsController.updateSubBot);
router.delete('/:id', subbotsController.deleteSubBot);
router.post('/:id/action', subbotsController.executeAction);

module.exports = router;
