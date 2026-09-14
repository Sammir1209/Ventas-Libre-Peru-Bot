// ══════
// ⟡ Web Controller: GBan y Lista Negra de Estafadores
// ══════

const gbanService = require('../services/gbanService');

async function getBurnedList(req, res) {
  try {
    const burned = await gbanService.listBurnedUsers();
    res.json({ ok: true, burned });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getBurnedUser(req, res) {
  try {
    const user = await gbanService.getBurnedUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado en la lista negra.' });
    }
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function addBurnedUser(req, res) {
  try {
    const newBurned = await gbanService.addBurnedUser({
      ...req.body,
      approvedBy: req.sessionUser?.userId || 1,
    });
    res.status(201).json({ ok: true, message: 'Usuario registrado exitosamente en la lista negra (GBan).', user: newBurned });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function updateBurnedUser(req, res) {
  try {
    const updated = await gbanService.updateBurnedUser(req.params.userId, req.body);
    res.json({ ok: true, message: 'Ficha de estafador actualizada correctamente.', user: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function removeBurnedUser(req, res) {
  try {
    await gbanService.removeBurnedUser(req.params.userId, req.sessionUser?.userId || 1);
    res.json({ ok: true, message: 'Usuario removido de la lista negra (GBan revocado).' });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function enforceGban(req, res) {
  try {
    const mainBot = req.app.get('mainBot');
    const result = await gbanService.enforceGbanInGroups(req.params.userId, mainBot);
    res.json({ ok: true, message: `Expulsión forzada en ${result.bannedCount} de ${result.totalGroups} grupos oficiales.`, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  getBurnedList,
  getBurnedUser,
  addBurnedUser,
  updateBurnedUser,
  removeBurnedUser,
  enforceGban,
};
