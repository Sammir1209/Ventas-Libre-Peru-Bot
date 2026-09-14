// ══════
// ⟡ Web Controller: Staff y Sincronización de Identidad
// ══════

const staffService = require('../services/staffService');

async function getStaffList(req, res) {
  try {
    const staff = await staffService.listStaff();
    res.json({ ok: true, staff });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getStaffMember(req, res) {
  try {
    const member = await staffService.getStaff(req.params.id);
    if (!member) {
      return res.status(404).json({ ok: false, error: 'Staff no encontrado' });
    }
    res.json({ ok: true, member });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function updateStaff(req, res) {
  try {
    const updated = await staffService.updateStaff(req.params.id, req.body);
    res.json({ ok: true, message: 'Datos del staff actualizados correctamente.', member: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function syncStaffTelegram(req, res) {
  try {
    const result = await staffService.syncStaffTelegram(req.params.id);
    res.json({ ok: true, message: 'Identidad y @username sincronizados exitosamente con Telegram.', data: result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function addStaff(req, res) {
  try {
    const newMember = await staffService.addStaff({
      ...req.body,
      assignedBy: req.sessionUser?.userId || null,
    });
    res.status(201).json({ ok: true, message: 'Miembro agregado al staff oficial.', member: newMember });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function deleteStaff(req, res) {
  try {
    await staffService.deleteStaff(req.params.id);
    res.json({ ok: true, message: 'Miembro removido del staff.' });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

module.exports = {
  getStaffList,
  getStaffMember,
  updateStaff,
  syncStaffTelegram,
  addStaff,
  deleteStaff,
};
