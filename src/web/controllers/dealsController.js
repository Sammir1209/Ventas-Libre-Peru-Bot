// ══════
// ⟡ Web Controller: Tratos Escrow y Mediaciones
// ══════

const dealService = require('../services/dealService');

async function getDealsList(req, res) {
  try {
    const deals = await dealService.listDeals();
    res.json({ ok: true, deals });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getDealById(req, res) {
  try {
    const deal = await dealService.getDeal(req.params.id);
    if (!deal) {
      return res.status(404).json({ ok: false, error: 'Trato no encontrado.' });
    }
    res.json({ ok: true, deal });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function updateDeal(req, res) {
  try {
    const updated = await dealService.updateDeal(req.params.id, req.body);
    res.json({ ok: true, message: 'Trato actualizado exitosamente.', deal: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function createDeal(req, res) {
  try {
    const newDeal = await dealService.createDeal(req.body);
    res.status(201).json({ ok: true, message: 'Trato creado exitosamente.', deal: newDeal });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function deleteDeal(req, res) {
  try {
    await dealService.deleteDeal(req.params.id);
    res.json({ ok: true, message: 'Trato eliminado del registro.' });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

module.exports = {
  getDealsList,
  getDealById,
  updateDeal,
  createDeal,
  deleteDeal,
};
