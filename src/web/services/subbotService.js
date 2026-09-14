// ══════
// ⟡ Web Service: Orquestación SaaS de Sub-Bots Multi-Tenant
// ══════

const db = require('../../database/postgres');
const botManager = require('../../core/botManager');
const { validateBotToken } = require('./telegramSyncService');

function maskToken(token) {
  if (!token || typeof token !== 'string') return 'N/A';
  if (token.length < 15) return '***';
  const prefix = token.slice(0, 10);
  const suffix = token.slice(-4);
  return `${prefix}...${suffix}`;
}

async function listSubBots() {
  const bots = await db.getAllSubBots();
  const activeBotsMap = botManager.getActiveSubBots ? botManager.getActiveSubBots() : new Map();

  return (bots || []).map(b => {
    const isRunning = activeBotsMap.has(b.id);
    const runtimeInfo = activeBotsMap.get(b.id);
    return {
      ...b,
      bot_token_masked: maskToken(b.bot_token),
      is_running: isRunning,
      started_at: runtimeInfo ? runtimeInfo.startedAt : null,
    };
  });
}

async function getSubBot(id) {
  const b = await db.getSubBotById(id);
  if (!b) return null;

  const activeBotsMap = botManager.getActiveSubBots ? botManager.getActiveSubBots() : new Map();
  const isRunning = activeBotsMap.has(b.id);
  const runtimeInfo = activeBotsMap.get(b.id);

  return {
    ...b,
    bot_token_masked: maskToken(b.bot_token),
    is_running: isRunning,
    started_at: runtimeInfo ? runtimeInfo.startedAt : null,
  };
}

async function createSubBot(data) {
  const token = data.botToken?.trim();
  if (!token) throw new Error('Token de BotFather requerido.');

  // 1. Validar Token contra Telegram API (getMe)
  const validation = await validateBotToken(token);
  if (!validation.valid) {
    throw new Error(`Token de Telegram inválido o revocado: ${validation.error}`);
  }

  const botUsername = validation.botInfo.username;
  const botFirstName = validation.botInfo.first_name;

  // 2. Guardar en Base de Datos
  const newBot = await db.createSubBot({
    botToken: token,
    botUsername,
    communityName: data.communityName || botFirstName || 'Comunidad Afiliada',
    ownerIds: data.ownerIds || [],
    channelsToVerify: data.channelsToVerify || [],
    groupsFolderLink: data.groupsFolderLink || null,
    staffChatId: data.staffChatId || null,
    logChannelId: data.logChannelId || null,
    burnChatId: data.burnChatId || null,
    publicBurnChannelId: data.publicBurnChannelId || null,
    escrowGroupId: data.escrowGroupId || null,
  });

  // 3. Iniciar instancia automáticamente si se solicita
  if (data.autoStart !== false) {
    try {
      await botManager.startSubBot(newBot);
    } catch (startErr) {
      console.warn(`⟡ Sub-bot creado pero no pudo arrancar de inmediato:`, startErr.message);
    }
  }

  return await getSubBot(newBot.id);
}

async function updateSubBot(id, updates = {}) {
  const existing = await db.getSubBotById(id);
  if (!existing) {
    throw new Error(`Sub-bot ${id} no encontrado.`);
  }

  // Si cambia el token, revalidar
  if (updates.botToken && updates.botToken !== existing.bot_token) {
    const val = await validateBotToken(updates.botToken);
    if (!val.valid) throw new Error(`Nuevo token inválido: ${val.error}`);
    updates.botUsername = val.botInfo.username;
  }

  const updated = await db.updateSubBot(id, updates);

  // Si estaba corriendo, reiniciar para aplicar cambios
  const activeBotsMap = botManager.getActiveSubBots ? botManager.getActiveSubBots() : new Map();
  if (activeBotsMap.has(id)) {
    try {
      await botManager.restartSubBot(id);
    } catch {}
  }

  return await getSubBot(id);
}

async function executeAction(id, action) {
  const existing = await db.getSubBotById(id);
  if (!existing) throw new Error(`Sub-bot ${id} no encontrado.`);

  let result = false;
  switch (action) {
    case 'start':
      result = await botManager.startSubBot(existing);
      break;
    case 'stop':
      result = await botManager.stopSubBot(id);
      break;
    case 'restart':
      result = await botManager.restartSubBot(id);
      break;
    default:
      throw new Error(`Acción desconocida: ${action}. Acciones válidas: start, stop, restart.`);
  }

  return {
    success: !!result,
    action,
    subBot: await getSubBot(id),
  };
}

async function deleteSubBot(id) {
  // Detener si estaba corriendo
  try {
    await botManager.stopSubBot(id);
  } catch {}

  return await db.deleteSubBot(id);
}

module.exports = {
  listSubBots,
  getSubBot,
  createSubBot,
  updateSubBot,
  executeAction,
  deleteSubBot,
};
