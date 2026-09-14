// ══════
// ⟡ Web Controller: Grupos Oficiales y Seguridad
// ══════

const groupsService = require('../services/groupsService');

async function getGroupsList(req, res) {
  try {
    const groups = await groupsService.listGroups();
    res.json({ ok: true, groups });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getGroupSecurity(req, res) {
  try {
    const security = await groupsService.getGroupSecurity(req.params.chatId);
    res.json({ ok: true, security });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function updateGroupSecurity(req, res) {
  try {
    const updated = await groupsService.updateGroupSecurity(req.params.chatId, req.body);
    res.json({ ok: true, message: 'Ajustes de seguridad actualizados.', security: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

module.exports = {
  getGroupsList,
  getGroupSecurity,
  updateGroupSecurity,
};
