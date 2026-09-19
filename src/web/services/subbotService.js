// ══════
// ⟡ Web Service: Orquestación SaaS de Sub-Bots Multi-Tenant
// ══════

const db = require('../../database/postgres');
const botManager = require('../../core/botManager');
const { validateBotToken } = require('./telegramSyncService');
const config = require('../../config/env');

function maskToken(token) {
  if (!token || typeof token !== 'string') return 'N/A';
  if (token.length < 15) return '***';
  const prefix = token.slice(0, 10);
  const suffix = token.slice(-4);
  return `${prefix}...${suffix}`;
}

async function enrichBotOwners(b) {
  if (!b) return b;
  const activeBotsMap = botManager.getActiveSubBots ? botManager.getActiveSubBots() : new Map();
  const isRunning = activeBotsMap.has(b.id);
  const runtimeInfo = activeBotsMap.get(b.id);

  const ownersDetails = [];
  if (Array.isArray(b.owner_ids) && b.owner_ids.length > 0) {
    for (const oid of b.owner_ids) {
      try {
        const u = await db.getUser(oid);
        const staff = (await db.getStaffMember(oid, b.id)) || (await db.getStaffMember(oid, null));
        ownersDetails.push({
          user_id: oid,
          username: u?.username || staff?.username || null,
          first_name: u?.first_name || staff?.first_name || null,
          custom_title: staff?.custom_title || null,
          display: u?.username ? `@${u.username}` : (u?.first_name || String(oid)),
        });
      } catch {
        ownersDetails.push({ user_id: oid, display: String(oid) });
      }
    }
  }

  return {
    ...b,
    bot_token_masked: maskToken(b.bot_token),
    staff_invite_link: b.custom_settings?.staff_invite_link || null,
    is_running: isRunning,
    started_at: runtimeInfo ? runtimeInfo.startedAt : null,
    owners_details: ownersDetails,
  };
}

async function listSubBots() {
  const bots = await db.getAllSubBots();
  const enriched = [];
  for (const b of bots || []) {
    enriched.push(await enrichBotOwners(b));
  }
  return enriched;
}

async function getSubBot(id) {
  const b = await db.getSubBotById(id);
  if (!b) return null;
  return await enrichBotOwners(b);
}

async function resolveOwnerIds(val) {
  if (!val && val !== 0) return [];
  let rawList = [];
  if (Array.isArray(val)) rawList = val;
  else if (typeof val === 'number') rawList = [val];
  else if (typeof val === 'string') rawList = val.split(/[\s,]+/);

  const resolved = [];
  for (const item of rawList) {
    if (!item && item !== 0) continue;
    const str = String(item).trim();
    if (!str) continue;

    // Si es numérico
    if (/^\d+$/.test(str)) {
      resolved.push(Number(str));
      continue;
    }

    // Si es un username (ej: @kingFakingz o kingFakingz)
    const cleanUser = str.replace(/^@/, '');
    try {
      const u = await db.getUserByUsername(cleanUser);
      if (u && u.user_id) {
        resolved.push(Number(u.user_id));
        continue;
      }
      const userbot = require('../../userbot/client');
      if (userbot?.isConnected && userbot.isConnected()) {
        const ub = await userbot.resolveUser(cleanUser);
        if (ub && ub.userId) {
          await db.upsertUser(ub.userId, ub.username, ub.firstName);
          resolved.push(Number(ub.userId));
          continue;
        }
      }
    } catch {}
  }
  return [...new Set(resolved)];
}

async function syncOwnersToStaff(tenantId, ownerIds) {
  if (!tenantId || !Array.isArray(ownerIds)) return;
  for (const ownerId of ownerIds) {
    try {
      const numId = Number(ownerId);
      if (!numId) continue;
      const u = await db.getUser(numId);
      const globalStaff = await db.getStaffMember(numId, null);
      const currentStaff = await db.getStaffMember(numId, tenantId);
      const customTitle = currentStaff?.custom_title || globalStaff?.custom_title || 'OWNER';
      const username = u?.username || globalStaff?.username || null;
      const firstName = u?.first_name || globalStaff?.first_name || 'Propietario';

      await db.setStaffRole(
        numId,
        username,
        firstName,
        'OWNER',
        numId,
        customTitle,
        tenantId
      );
    } catch (err) {
      console.warn(`⟡ [SaaS] Error sincronizando owner ${ownerId} a staff:`, err.message);
    }
  }
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
    staff_invite_link: (data.staffInviteLink || data.staff_invite_link || data.custom_settings?.staff_invite_link || '').trim() || null,
  };

  const resolvedOwnerIds = await resolveOwnerIds(data.ownerIds || data.owner_ids);

  // 3. Guardar en Base de Datos con todos los campos completos
  const newBot = await db.createSubBot({
    bot_token: token,
    bot_username: botUsername,
    community_name: data.communityName || data.community_name || botFirstName || 'Comunidad Afiliada',
    owner_ids: resolvedOwnerIds,
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

  // 4. Sincronizar Owners a la tabla staff del sub-bot
  await syncOwnersToStaff(newBot.id, resolvedOwnerIds);

  // 5. Iniciar instancia automáticamente si se solicita
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
    payload.owner_ids = await resolveOwnerIds(updates.ownerIds || updates.owner_ids);
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
  if (updates.staffInviteLink !== undefined || updates.staff_invite_link !== undefined) {
    updatedSettings.staff_invite_link = (updates.staffInviteLink || updates.staff_invite_link || '').trim() || null;
  }

  payload.custom_settings = updatedSettings;

  await db.updateSubBot(id, payload);

  if (payload.owner_ids && payload.owner_ids.length > 0) {
    await syncOwnersToStaff(id, payload.owner_ids);
  }

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

/**
 * Busca un sub-bot por slug (id o bot_username con o sin @)
 */
async function getSubBotBySlug(slug) {
  if (!slug) return null;
  const clean = String(slug).trim().replace(/^@/, '').toLowerCase();
  
  // Soporte para sub-bot por defecto o activo, o el BOT PRINCIPAL de entorno
  if (clean === 'default' || clean === 'main') {
    // Retornamos SIEMPRE el Bot Principal (Ventas Libres Perú) si se usa 'default' o 'main'
    return {
      id: 'default',
      bot_username: config.DEV_USERNAME || 'VentasLibresPeru',
      community_name: 'Ventas Libres Perú',
      channels_to_verify: config.CHANNELS_TO_VERIFY,
      groups_folder_link: config.GROUPS_FOLDER_LINK,
      bot_token: config.BOT_TOKEN,
      owner_ids: config.OWNER_IDS,
      is_active: true,
      custom_settings: {
        welcome_message: 'Bienvenido a Ventas Libres Perú'
      }
    };
  }

  if (clean === 'active' || clean === 'current') {
    const all = await db.getAllSubBots();
    const active = all.find(b => b.is_active) || all[0];
    if (active) return await enrichBotOwners(active);
    return null;
  }

  // Buscar por ID si es UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
    const b = await db.getSubBotById(clean);
    if (b) return await enrichBotOwners(b);
  }

  const all = await db.getAllSubBots();
  for (const b of all) {
    const uname = (b.bot_username || '').replace(/^@/, '').toLowerCase();
    if (uname === clean || b.id === clean) {
      return await enrichBotOwners(b);
    }
  }
  return null;
}

/**
 * Retorna la información pública para la Landing de Verificación en Blanco y Negro del Sub-Bot
 */
async function getPublicLandingData(slug) {
  const b = await getSubBotBySlug(slug);
  if (!b) return null;

  const rawChannels = Array.isArray(b.channels_to_verify) ? b.channels_to_verify : [];
  const channels = [];

  // Obtener instancia del bot si está corriendo para consultar getChat en Telegram
  let runningBot = botManager.getBot ? botManager.getBot(b.id) : null;
  if (!runningBot && b.bot_token) {
    try {
      const { Bot } = require('grammy');
      runningBot = new Bot(b.bot_token);
    } catch {}
  }

  for (let i = 0; i < rawChannels.length; i++) {
    const ch = rawChannels[i];
    const chStr = String(ch).trim();
    if (!chStr) continue;

    let url = chStr;
    let name = chStr;

    // 1. Canales conocidos con enlaces fijos
    if (chStr.includes('3My6QWWVjMw2Mzc8') || chStr === '-1002561445231' || chStr.toUpperCase().includes('MADRE')) {
      name = 'MADRE DE LAS VENTAS TV2';
      url = 'https://t.me/+3My6QWWVjMw2Mzc8';
    } else if (chStr === '-1002623471175') {
      name = 'KEVIN ARMY 🦆';
      url = 'https://t.me/+D5T9V4G3T-A2YzZh';
    } else if (chStr.startsWith('@')) {
      const handle = chStr.replace(/^@/, '');
      url = `https://t.me/${handle}`;
      name = `@${handle}`;
    } else if (chStr.startsWith('http')) {
      url = chStr;
      name = `Canal Oficial #${i + 1}`;
    }

    // 2. Si no tiene nombre amigable o URL válida (IDs numéricos), consultar API de Telegram
    if (name === chStr || (!url.startsWith('http') && !chStr.startsWith('@'))) {
      if (runningBot) {
        try {
          const chat = await runningBot.api.getChat(chStr);
          if (chat && chat.title) name = chat.title;
          if (chat && chat.invite_link) url = chat.invite_link;
          else if (chat && chat.username) url = `https://t.me/${chat.username}`;
        } catch {}
      }
    }

    // Si aún tiene solo @ en name y es drockzerisback, estilizar
    if (chStr.includes('drockzerisback')) {
      name = '𝘿𝙍𝙊𝘾𝙆𝙕𝙀𝙍 𝙎𝙏𝙊𝙍𝙀';
      url = 'https://t.me/drockzerisback';
    }

    // Asegurar URL bien formateada
    if (!url.startsWith('http')) {
      url = `https://t.me/${url.replace(/^@/, '')}`;
    }

    // Asegurar nombre limpio y no un ID negativo feo
    if (name.startsWith('-100')) {
      name = `Canal Oficial #${i + 1}`;
    }

    channels.push({
      identifier: chStr,
      name: name,
      url: url,
    });
  }

  return {
    ok: true,
    id: b.id,
    bot_username: b.bot_username,
    community_name: b.community_name || 'Comunidad Oficial',
    channels: channels,
    groups_folder_link: b.groups_folder_link || null,
    welcome_message: b.custom_settings?.welcome_message || null,
    staff_invite_link: b.custom_settings?.staff_invite_link || null,
  };
}

/**
 * Obtiene el staff de un sub-bot
 */
async function getTenantStaff(tenantId) {
  if (!tenantId) return [];
  const staff = await db.getAllStaff(tenantId);
  return staff || [];
}

/**
 * Actualiza o agrega un miembro al staff del sub-bot
 */
async function updateTenantStaff(tenantId, { userId, username, firstName, role, customTitle, assignedBy }) {
  if (!tenantId || !userId) throw new Error('Tenant ID y User ID son requeridos.');
  const numId = Number(userId);
  const staff = await db.setStaffRole(
    numId,
    username || null,
    firstName || 'Staff',
    role || 'ADMIN',
    assignedBy || numId,
    customTitle || role || 'Staff',
    tenantId
  );
  return staff;
}

/**
 * Remueve a un miembro del staff de este sub-bot
 */
async function removeTenantStaff(tenantId, userId) {
  if (!tenantId || !userId) throw new Error('Tenant ID y User ID son requeridos.');
  await db.removeStaff(Number(userId), tenantId);
  return true;
}

module.exports = {
  listSubBots,
  getSubBot,
  createSubBot,
  updateSubBot,
  executeAction,
  deleteSubBot,
  getSubBotBySlug,
  getPublicLandingData,
  getTenantStaff,
  updateTenantStaff,
  removeTenantStaff,
};
