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

function parseOwnerIds(val) {
  if (Array.isArray(val)) return val.map(Number).filter(Boolean);
  if (typeof val === 'string') {
    return val.split(',').map(s => Number(s.trim())).filter(Boolean);
  }
  if (typeof val === 'number') return [val];
  return [];
}

function parseChannels(val) {
  if (Array.isArray(val)) return val.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof val === 'string') {
    return val.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function parseChatId(val) {
  if (val === undefined || val === null || val === '') return null;
  const str = String(val).trim();
  if (!str) return null;
  const num = Number(str);
  return isNaN(num) ? null : num;
}

async function createSubBot(data) {
  const token = (data.botToken || data.bot_token)?.trim();
  if (!token) throw new Error('Token de BotFather requerido.');

  // 1. Validar Token contra Telegram API (getMe)
  const validation = await validateBotToken(token);
  if (!validation.valid) {
    throw new Error(`Token de Telegram inválido o revocado: ${validation.error}`);
  }

  const botUsername = validation.botInfo.username;
  const botFirstName = validation.botInfo.first_name;

  // 2. Extraer custom_settings
  const customSettings = {
    escrow_commission: data.escrowCommission !== undefined ? Number(data.escrowCommission) : 10,
    escrow_terms: data.escrowTerms || data.custom_settings?.escrow_terms || '',
    defcon_level: data.defconLevel || data.custom_settings?.defcon_level || 'NORMAL',
    anti_spam: data.antiSpam !== undefined ? Boolean(data.antiSpam) : true,
    anti_flood: data.antiFlood !== undefined ? Boolean(data.antiFlood) : true,
    anti_links: data.antiLinks !== undefined ? Boolean(data.antiLinks) : true,
    welcome_message: data.welcomeMessage || data.custom_settings?.welcome_message || '',
    verify_web_url: data.verifyWebUrl || data.custom_settings?.verify_web_url || '',
  };

  // 3. Guardar en Base de Datos con todos los campos completos
  const newBot = await db.createSubBot({
    bot_token: token,
    bot_username: botUsername,
    community_name: data.communityName || data.community_name || botFirstName || 'Comunidad Afiliada',
    owner_ids: parseOwnerIds(data.ownerIds || data.owner_ids),
    plan_status: data.planStatus || data.plan_status || 'ACTIVE',
    expires_at: data.expiresAt || data.expires_at || null,
    channels_to_verify: parseChannels(data.channelsToVerify || data.channels_to_verify),
    groups_folder_link: data.groupsFolderLink || data.groups_folder_link || null,
    staff_chat_id: parseChatId(data.staffChatId || data.staff_chat_id),
    staff_thread_id: parseChatId(data.staffThreadId || data.staff_thread_id),
    log_channel_id: parseChatId(data.logChannelId || data.log_channel_id),
    log_thread_id: parseChatId(data.logThreadId || data.log_thread_id),
    burn_chat_id: parseChatId(data.burnChatId || data.burn_chat_id),
    burn_thread_id: parseChatId(data.burnThreadId || data.burn_thread_id),
    public_burn_channel_id: parseChatId(data.publicBurnChannelId || data.public_burn_channel_id),
    public_burn_thread_id: parseChatId(data.publicBurnThreadId || data.public_burn_thread_id),
    escrow_group_id: parseChatId(data.escrowGroupId || data.escrow_group_id),
    custom_settings: customSettings,
  });

  // 4. Iniciar instancia automáticamente si se solicita
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

  const payload = {};

  // Token
  const incomingToken = (updates.botToken || updates.bot_token)?.trim();
  if (incomingToken && incomingToken !== existing.bot_token) {
    const val = await validateBotToken(incomingToken);
    if (!val.valid) throw new Error(`Nuevo token inválido: ${val.error}`);
    payload.bot_token = incomingToken;
    payload.bot_username = val.botInfo.username;
  }

  // Nombre de comunidad
  if (updates.communityName !== undefined || updates.community_name !== undefined) {
    payload.community_name = (updates.communityName || updates.community_name || '').trim();
  }

  // Owners
  if (updates.ownerIds !== undefined || updates.owner_ids !== undefined) {
    payload.owner_ids = parseOwnerIds(updates.ownerIds || updates.owner_ids);
  }

  // Estado del Plan y Expiración
  if (updates.planStatus !== undefined || updates.plan_status !== undefined) {
    payload.plan_status = updates.planStatus || updates.plan_status;
  }
  if (updates.expiresAt !== undefined || updates.expires_at !== undefined) {
    payload.expires_at = updates.expiresAt || updates.expires_at || null;
  }

  // Canales & Enlaces
  if (updates.channelsToVerify !== undefined || updates.channels_to_verify !== undefined) {
    payload.channels_to_verify = parseChannels(updates.channelsToVerify || updates.channels_to_verify);
  }
  if (updates.groupsFolderLink !== undefined || updates.groups_folder_link !== undefined) {
    payload.groups_folder_link = (updates.groupsFolderLink || updates.groups_folder_link || '').trim() || null;
  }

  // Chats operativos
  if (updates.staffChatId !== undefined || updates.staff_chat_id !== undefined) {
    payload.staff_chat_id = parseChatId(updates.staffChatId ?? updates.staff_chat_id);
  }
  if (updates.staffThreadId !== undefined || updates.staff_thread_id !== undefined) {
    payload.staff_thread_id = parseChatId(updates.staffThreadId ?? updates.staff_thread_id);
  }
  if (updates.logChannelId !== undefined || updates.log_channel_id !== undefined) {
    payload.log_channel_id = parseChatId(updates.logChannelId ?? updates.log_channel_id);
  }
  if (updates.logThreadId !== undefined || updates.log_thread_id !== undefined) {
    payload.log_thread_id = parseChatId(updates.logThreadId ?? updates.log_thread_id);
  }

  // GBan & Reportes
  if (updates.burnChatId !== undefined || updates.burn_chat_id !== undefined) {
    payload.burn_chat_id = parseChatId(updates.burnChatId ?? updates.burn_chat_id);
  }
  if (updates.burnThreadId !== undefined || updates.burn_thread_id !== undefined) {
    payload.burn_thread_id = parseChatId(updates.burnThreadId ?? updates.burn_thread_id);
  }
  if (updates.publicBurnChannelId !== undefined || updates.public_burn_channel_id !== undefined) {
    payload.public_burn_channel_id = parseChatId(updates.publicBurnChannelId ?? updates.public_burn_channel_id);
  }
  if (updates.publicBurnThreadId !== undefined || updates.public_burn_thread_id !== undefined) {
    payload.public_burn_thread_id = parseChatId(updates.publicBurnThreadId ?? updates.public_burn_thread_id);
  }

  // Escrow
  if (updates.escrowGroupId !== undefined || updates.escrow_group_id !== undefined) {
    payload.escrow_group_id = parseChatId(updates.escrowGroupId ?? updates.escrow_group_id);
  }

  // Custom settings combinados
  const existingSettings = existing.custom_settings || {};
  const updatedSettings = {
    ...existingSettings,
    ...(updates.customSettings || updates.custom_settings || {}),
  };

  if (updates.escrowCommission !== undefined) updatedSettings.escrow_commission = Number(updates.escrowCommission);
  if (updates.escrowTerms !== undefined) updatedSettings.escrow_terms = updates.escrowTerms;
  if (updates.defconLevel !== undefined) updatedSettings.defcon_level = updates.defconLevel;
  if (updates.antiSpam !== undefined) updatedSettings.anti_spam = Boolean(updates.antiSpam);
  if (updates.antiFlood !== undefined) updatedSettings.anti_flood = Boolean(updates.antiFlood);
  if (updates.antiLinks !== undefined) updatedSettings.anti_links = Boolean(updates.antiLinks);
  if (updates.welcomeMessage !== undefined) updatedSettings.welcome_message = updates.welcomeMessage;
  if (updates.verifyWebUrl !== undefined) updatedSettings.verify_web_url = updates.verifyWebUrl;

  payload.custom_settings = updatedSettings;

  await db.updateSubBot(id, payload);

  // Si estaba corriendo, reiniciar para aplicar los nuevos ajustes en memoria
  const activeBotsMap = botManager.getActiveSubBots ? botManager.getActiveSubBots() : new Map();
  if (activeBotsMap.has(id)) {
    try {
      await botManager.restartSubBot(id);
    } catch (err) {
      console.warn(`⟡ Error al reiniciar sub-bot ${id} tras actualización:`, err.message);
    }
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
