require('dotenv').config();

// ── Parseo seguro de arrays JSON desde env ──
function parseJsonArray(envVar, fallback = []) {
  if (!envVar) return fallback;
  try {
    const parsed = JSON.parse(envVar);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// ── Validación de variables obligatorias ──
function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.error(`⟡ ERROR: Variable de entorno "${name}" es obligatoria.`);
    process.exit(1);
  }
  return value.trim();
}

// ── Exportación de configuración ──
const config = {
  // Bot
  BOT_TOKEN: requireEnv('BOT_TOKEN'),
  OWNER_IDS: parseJsonArray(process.env.OWNER_IDS, [7794982496]),

  // Verificación
  CHANNELS_TO_VERIFY: parseJsonArray(process.env.CHANNELS_TO_VERIFY, []),
  GROUPS_FOLDER_LINK: process.env.GROUPS_FOLDER_LINK || '',

  // PostgreSQL
  POSTGRES_URL: process.env.POSTGRES_URL || 'postgresql://localhost:5432/ventas_libres',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Userbot MTProto
  USERBOT_API_ID: parseInt(process.env.USERBOT_API_ID) || 0,
  USERBOT_API_HASH: process.env.USERBOT_API_HASH || '',
  USERBOT_SESSION: process.env.USERBOT_SESSION || '',
  get USERBOT_ENABLED() {
    return !!(this.USERBOT_API_ID && this.USERBOT_API_HASH && this.USERBOT_SESSION);
  },

  // Staff, Logs, Burn & Tratos
  STAFF_CHAT_ID: process.env.STAFF_CHAT_ID ? Number(process.env.STAFF_CHAT_ID) : null,
  STAFF_THREAD_ID: process.env.STAFF_THREAD_ID ? Number(process.env.STAFF_THREAD_ID) : null,
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID ? Number(process.env.LOG_CHANNEL_ID) : null,
  LOG_THREAD_ID: process.env.LOG_THREAD_ID ? Number(process.env.LOG_THREAD_ID) : null,
  BURN_CHAT_ID: process.env.BURN_CHAT_ID ? Number(process.env.BURN_CHAT_ID) : null,
  BURN_THREAD_ID: process.env.BURN_THREAD_ID ? Number(process.env.BURN_THREAD_ID) : null,
  PUBLIC_BURN_CHANNEL_ID: process.env.PUBLIC_BURN_CHANNEL_ID ? Number(process.env.PUBLIC_BURN_CHANNEL_ID) : null,
  PUBLIC_BURN_THREAD_ID: process.env.PUBLIC_BURN_THREAD_ID ? Number(process.env.PUBLIC_BURN_THREAD_ID) : null,
  ESCROW_GROUP_ID: process.env.ESCROW_GROUP_ID ? Number(process.env.ESCROW_GROUP_ID) : null,

  // Render HTTP
  PORT: parseInt(process.env.PORT) || 10000,

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
};

// ── Validar que el userbot tenga credenciales si se necesitan ──
config.USERBOT_ENABLED = !!(config.USERBOT_API_ID && config.USERBOT_API_HASH && config.USERBOT_SESSION);
config.SUPABASE_ENABLED = !!(config.SUPABASE_URL && config.SUPABASE_SERVICE_KEY);

module.exports = config;
