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

async function getAvailableChats(req, res) {
  try {
    const mainBot = req.app.get('mainBot');
    const chats = await groupsService.listAvailableChats(mainBot, null);
    res.json({ ok: true, chats });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function addGroup(req, res) {
  try {
    const mainBot = req.app.get('mainBot');
    const result = await groupsService.addGroup({
      ...req.body,
      tenantId: null,
      botInstance: mainBot,
    });
    res.status(201).json({
      ok: true,
      message: result.warning || 'Canal o grupo vinculado exitosamente a la red.',
      group: result.group,
      isAdmin: result.isAdmin,
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function removeGroup(req, res) {
  try {
    await groupsService.removeGroup(req.params.chatId, null);
    res.json({ ok: true, message: 'Canal o grupo desvinculado con éxito.' });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function reverifyGroup(req, res) {
  try {
    const mainBot = req.app.get('mainBot');
    const { mode } = req.body;
    const result = await groupsService.reverifyGroup({
      chatId: req.params.chatId,
      mode: mode || 'lock',
      tenantId: null,
      botInstance: mainBot,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function getPrimaryGroup(req, res) {
  try {
    const primaryChatId = await groupsService.getPrimaryVerificationChat(null);
    res.json({ ok: true, primaryChatId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function setPrimaryGroup(req, res) {
  try {
    const { chatId } = req.body;
    const assigned = await groupsService.setPrimaryVerificationChat(chatId, null);
    res.json({
      ok: true,
      message: chatId ? 'Grupo principal de verificación asignado exitosamente.' : 'Grupo principal de verificación desvinculado.',
      primaryChatId: assigned,
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

module.exports = {
  getGroupsList,
  getGroupSecurity,
  updateGroupSecurity,
  getAvailableChats,
  addGroup,
  removeGroup,
  reverifyGroup,
  getPrimaryGroup,
  setPrimaryGroup,
};


