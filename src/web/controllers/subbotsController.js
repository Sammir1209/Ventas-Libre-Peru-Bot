// ══════
// ⟡ Web Controller: Sub-Bots SaaS Multi-Tenant
// ══════

const subbotService = require('../services/subbotService');

async function getSubBotsList(req, res) {
  try {
    const bots = await subbotService.listSubBots();
    res.json({ ok: true, subbots: bots });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getSubBot(req, res) {
  try {
    const bot = await subbotService.getSubBot(req.params.id);
    if (!bot) {
      return res.status(404).json({ ok: false, error: 'Sub-bot no encontrado.' });
    }
    res.json({ ok: true, subbot: bot });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function createSubBot(req, res) {
  try {
    const newBot = await subbotService.createSubBot(req.body);
    res.status(201).json({ ok: true, message: 'Sub-bot registrado e inicializado con éxito.', subbot: newBot });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function updateSubBot(req, res) {
  try {
    const updated = await subbotService.updateSubBot(req.params.id, req.body);
    res.json({ ok: true, message: 'Configuración de sub-bot actualizada.', subbot: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function executeAction(req, res) {
  try {
    const action = req.body?.action || req.params.action;
    const result = await subbotService.executeAction(req.params.id, action);
    res.json({ ok: true, message: `Acción '${action}' ejecutada exitosamente.`, data: result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function deleteSubBot(req, res) {
  try {
    await subbotService.deleteSubBot(req.params.id);
    res.json({ ok: true, message: 'Sub-bot eliminado del sistema.' });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

module.exports = {
  getSubBotsList,
  getSubBot,
  createSubBot,
  updateSubBot,
  executeAction,
  deleteSubBot,
};
