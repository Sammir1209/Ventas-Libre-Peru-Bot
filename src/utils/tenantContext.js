// ══════
// ⟡ Contexto Multi-Tenant Centralizado — Resolución de Identidad y Permisos
// ══════
//
// Este módulo centraliza TODA la lógica de resolución de identidad, permisos y
// configuración para garantizar aislamiento completo entre el bot principal y
// los sub-bots SaaS. NINGÚN módulo debería acceder directamente a config.OWNER_IDS,
// hardcodear IDs de usuario, ni utilizar literales de marca.

const config = require('../config/env');
const db = require('../database/postgres');

// ── Constantes de Marca por Defecto (ÚNICO lugar donde aparecen) ──
const DEFAULT_COMMUNITY_NAME = 'Ventas Libres Perú';
const DEFAULT_BOT_USERNAME = 'ventas_libres_peru_Bot';

// ══════════════════════════════════════════════════════
// ⟡ RESOLUCIÓN DE IDENTIDAD
// ══════════════════════════════════════════════════════

/**
 * Resuelve el nombre de la comunidad para el contexto activo.
 * Prioridad: tenant.community_name > chat.title > DEFAULT
 */
function resolveCommunityName(ctx) {
  if (ctx?.tenant?.community_name) {
    return ctx.tenant.community_name;
  }
  if (ctx?.chat?.title) {
    return ctx.chat.title;
  }
  return DEFAULT_COMMUNITY_NAME;
}

/**
 * Resuelve el username del bot activo.
 * Prioridad: ctx.me.username > tenant.bot_username > DEFAULT
 */
function resolveBotUsername(ctx) {
  if (ctx?.me?.username) {
    return ctx.me.username;
  }
  if (ctx?.tenant?.bot_username) {
    return ctx.tenant.bot_username;
  }
  return DEFAULT_BOT_USERNAME;
}

/**
 * Resuelve el username del bot desde una instancia de API (sin ctx).
 * Usado en funciones como executeReverify que reciben `api` directamente.
 */
async function resolveBotUsernameFromApi(api, tenant = null) {
  if (tenant?.bot_username) {
    return tenant.bot_username;
  }
  try {
    const me = await api.getMe();
    if (me?.username) return me.username;
  } catch {}
  return DEFAULT_BOT_USERNAME;
}

// ══════════════════════════════════════════════════════
// ⟡ RESOLUCIÓN DE PERMISOS Y OWNERSHIP
// ══════════════════════════════════════════════════════

/**
 * Determina si un userId es Owner GLOBAL de la plataforma (config.OWNER_IDS).
 * Esto aplica al bot principal y otorga permisos de super-admin en toda la plataforma.
 */
function isGlobalOwner(userId) {
  if (!userId) return false;
  const numId = Number(userId);
  return config.OWNER_IDS.includes(numId);
}

/**
 * Determina si un userId es Owner EFECTIVO en el contexto actual.
 * Para sub-bots: usa tenant.owner_ids.
 * Para bot principal: usa config.OWNER_IDS.
 * Los global owners SIEMPRE tienen acceso en todas las instancias.
 */
function isEffectiveOwner(userId, ctx = null) {
  if (!userId) return false;
  const numId = Number(userId);

  // Global owners siempre tienen acceso
  if (config.OWNER_IDS.includes(numId)) return true;

  // Si hay tenant, verificar owners del tenant
  if (ctx?.tenant?.owner_ids && Array.isArray(ctx.tenant.owner_ids)) {
    return ctx.tenant.owner_ids.includes(numId);
  }

  return false;
}

/**
 * Resuelve la lista de Owner IDs efectivos para el contexto actual.
 */
function resolveOwnerIds(ctx = null) {
  if (ctx?.tenant?.owner_ids && Array.isArray(ctx.tenant.owner_ids) && ctx.tenant.owner_ids.length > 0) {
    // Fusionar owners del tenant con global owners (sin duplicados)
    const merged = new Set([...ctx.tenant.owner_ids.map(Number), ...config.OWNER_IDS]);
    return [...merged];
  }
  return [...config.OWNER_IDS];
}

/**
 * Determina si un userId es Staff EFECTIVO en el contexto actual.
 * Verifica: global owner → tenant owner → staff en BD (por tenantId).
 */
async function isEffectiveStaff(userId, ctx = null) {
  if (!userId) return false;
  const numId = Number(userId);

  // Global owners siempre son staff
  if (config.OWNER_IDS.includes(numId)) return true;

  // Tenant owners son staff en su comunidad
  if (ctx?.tenant?.owner_ids && Array.isArray(ctx.tenant.owner_ids)) {
    if (ctx.tenant.owner_ids.includes(numId)) return true;
  }

  // Verificar staff en BD
  const tenantId = ctx?.tenant?.id || null;
  const staff = await db.getStaffMember(numId, tenantId);
  return !!(staff && staff.role);
}

// ══════════════════════════════════════════════════════
// ⟡ RESOLUCIÓN DE CONFIGURACIÓN POR TENANT
// ══════════════════════════════════════════════════════

/**
 * Resuelve el ID del grupo de Staff para el contexto actual.
 * Prioridad: tenant.staff_chat_id > config.STAFF_CHAT_ID
 */
function resolveStaffChatId(ctx = null) {
  if (ctx?.tenant?.custom_settings?.staff_chat_id) {
    return Number(ctx.tenant.custom_settings.staff_chat_id);
  }
  if (ctx?.tenant?.staff_chat_id) {
    return Number(ctx.tenant.staff_chat_id);
  }
  return config.STAFF_CHAT_ID || null;
}

/**
 * Resuelve el ID del grupo de Escrow/Tratos para el contexto actual.
 * Prioridad: tenant.escrow_group_id > config.ESCROW_GROUP_ID
 */
function resolveEscrowGroupId(ctx = null) {
  if (ctx?.tenant?.escrow_group_id) {
    return Number(ctx.tenant.escrow_group_id);
  }
  return config.ESCROW_GROUP_ID || null;
}

/**
 * Resuelve el ID del canal de logs para el contexto actual.
 */
function resolveLogChannelId(ctx = null) {
  if (ctx?.tenant?.custom_settings?.log_channel_id) {
    return Number(ctx.tenant.custom_settings.log_channel_id);
  }
  return config.LOG_CHANNEL_ID || null;
}

/**
 * Resuelve el ID del canal público de quemados para el contexto actual.
 */
function resolveBurnChatId(ctx = null) {
  if (ctx?.tenant?.custom_settings?.burn_chat_id) {
    return Number(ctx.tenant.custom_settings.burn_chat_id);
  }
  return config.BURN_CHAT_ID || null;
}

/**
 * Determina si un chatId es un grupo de infraestructura interna
 * (staff, escrow, logs, burn) que debe ser eximido de verificación y filtros.
 */
function isInfrastructureChat(chatId, ctx = null) {
  if (!chatId) return false;
  const numId = Number(chatId);
  const infraIds = new Set([
    resolveStaffChatId(ctx),
    resolveEscrowGroupId(ctx),
    resolveLogChannelId(ctx),
    resolveBurnChatId(ctx),
    config.PUBLIC_BURN_CHANNEL_ID,
  ].filter(Boolean).map(Number));

  return infraIds.has(numId);
}

/**
 * Determina si la instancia actual es un sub-bot (tenant) o el bot principal.
 */
function isSubBot(ctx) {
  return !!(ctx?.tenant && ctx.tenant.id);
}

// ══════════════════════════════════════════════════════
// ⟡ UTILIDADES DE CACHE CON PREFIJO TENANT
// ══════════════════════════════════════════════════════

/**
 * Genera una clave de cache con prefijo de tenant para evitar colisiones.
 */
function tenantCacheKey(baseKey, ctx = null) {
  const tenantId = ctx?.tenant?.id || 'global';
  return `${tenantId}:${baseKey}`;
}

module.exports = {
  // Constantes
  DEFAULT_COMMUNITY_NAME,
  DEFAULT_BOT_USERNAME,

  // Identidad
  resolveCommunityName,
  resolveBotUsername,
  resolveBotUsernameFromApi,

  // Permisos
  isGlobalOwner,
  isEffectiveOwner,
  resolveOwnerIds,
  isEffectiveStaff,

  // Configuración por Tenant
  resolveStaffChatId,
  resolveEscrowGroupId,
  resolveLogChannelId,
  resolveBurnChatId,
  isInfrastructureChat,
  isSubBot,

  // Cache
  tenantCacheKey,
};
