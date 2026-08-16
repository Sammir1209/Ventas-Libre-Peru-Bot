const Redis = require('ioredis');
const config = require('../config/env');

// ══════════════════════════════════════════════════════
// ⟡ Redis con Fallback en Memoria (Zero-Crash)
// ══════════════════════════════════════════════════════

let redis = null;
let isRedisConnected = false;

// Almacenamiento en memoria para fallback
const memStore = new Map();
const memQueues = new Map();
const memRate = new Map();

try {
  redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 2) return null; // No insistir si no hay servidor local
      return Math.min(times * 200, 1000);
    },
    lazyConnect: true,
    connectTimeout: 2000,
    enableOfflineQueue: false,
  });

  redis.on('error', () => {
    isRedisConnected = false;
  });

  redis.on('connect', () => {
    isRedisConnected = true;
    console.log('✓ Redis: Conectado.');
  });
} catch {
  isRedisConnected = false;
}

// ══════════════════════════════════════════════════════
// ⟡ Estado temporal de menús (Flujo /quemar)
// ══════════════════════════════════════════════════════

const BURN_STATE_PREFIX = 'burn_state:';
const BURN_TTL = 600; // 10 minutos

async function setBurnState(userId, state) {
  if (isRedisConnected && redis) {
    try {
      await redis.set(`${BURN_STATE_PREFIX}${userId}`, JSON.stringify(state), 'EX', BURN_TTL);
      return;
    } catch {
      // Fallback
    }
  }
  memStore.set(`${BURN_STATE_PREFIX}${userId}`, {
    data: state,
    expiresAt: Date.now() + BURN_TTL * 1000,
  });
}

async function getBurnState(userId) {
  if (isRedisConnected && redis) {
    try {
      const data = await redis.get(`${BURN_STATE_PREFIX}${userId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      // Fallback
    }
  }
  const item = memStore.get(`${BURN_STATE_PREFIX}${userId}`);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memStore.delete(`${BURN_STATE_PREFIX}${userId}`);
    return null;
  }
  return item.data;
}

async function clearBurnState(userId) {
  if (isRedisConnected && redis) {
    try {
      await redis.del(`${BURN_STATE_PREFIX}${userId}`);
      return;
    } catch {
      // Fallback
    }
  }
  memStore.delete(`${BURN_STATE_PREFIX}${userId}`);
}

// ══════════════════════════════════════════════════════
// ⟡ Cola de Tratos Activos
// ══════════════════════════════════════════════════════

const DEAL_QUEUE_KEY = 'deal_queue';
const DEAL_STATE_PREFIX = 'deal_state:';
const DEAL_TTL = 86400; // 24 horas

async function addDealToQueue(dealId, dealData) {
  if (isRedisConnected && redis) {
    try {
      await redis.lpush(DEAL_QUEUE_KEY, dealId.toString());
      await redis.set(`${DEAL_STATE_PREFIX}${dealId}`, JSON.stringify(dealData), 'EX', DEAL_TTL);
      return;
    } catch {
      // Fallback
    }
  }
  if (!memQueues.has(DEAL_QUEUE_KEY)) memQueues.set(DEAL_QUEUE_KEY, []);
  memQueues.get(DEAL_QUEUE_KEY).unshift(dealId.toString());
  memStore.set(`${DEAL_STATE_PREFIX}${dealId}`, {
    data: dealData,
    expiresAt: Date.now() + DEAL_TTL * 1000,
  });
}

async function getDealState(dealId) {
  if (isRedisConnected && redis) {
    try {
      const data = await redis.get(`${DEAL_STATE_PREFIX}${dealId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      // Fallback
    }
  }
  const item = memStore.get(`${DEAL_STATE_PREFIX}${dealId}`);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memStore.delete(`${DEAL_STATE_PREFIX}${dealId}`);
    return null;
  }
  return item.data;
}

async function updateDealState(dealId, dealData) {
  if (isRedisConnected && redis) {
    try {
      await redis.set(`${DEAL_STATE_PREFIX}${dealId}`, JSON.stringify(dealData), 'EX', DEAL_TTL);
      return;
    } catch {
      // Fallback
    }
  }
  memStore.set(`${DEAL_STATE_PREFIX}${dealId}`, {
    data: dealData,
    expiresAt: Date.now() + DEAL_TTL * 1000,
  });
}

async function removeDealFromQueue(dealId) {
  if (isRedisConnected && redis) {
    try {
      await redis.lrem(DEAL_QUEUE_KEY, 0, dealId.toString());
      await redis.del(`${DEAL_STATE_PREFIX}${dealId}`);
      return;
    } catch {
      // Fallback
    }
  }
  const q = memQueues.get(DEAL_QUEUE_KEY) || [];
  memQueues.set(DEAL_QUEUE_KEY, q.filter(id => id !== dealId.toString()));
  memStore.delete(`${DEAL_STATE_PREFIX}${dealId}`);
}

async function getPendingDealsCount() {
  if (isRedisConnected && redis) {
    try {
      return await redis.llen(DEAL_QUEUE_KEY);
    } catch {
      // Fallback
    }
  }
  return (memQueues.get(DEAL_QUEUE_KEY) || []).length;
}

// ══════════════════════════════════════════════════════
// ⟡ Anti-Spam / Rate Limiting
// ══════════════════════════════════════════════════════

const RATE_PREFIX = 'rate:';

async function checkRateLimit(userId, windowSeconds, maxCommands) {
  if (isRedisConnected && redis) {
    try {
      const key = `${RATE_PREFIX}${userId}`;
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }
      return current <= maxCommands;
    } catch {
      // Fallback
    }
  }

  const now = Date.now();
  const entry = memRate.get(userId) || { count: 0, resetAt: now + windowSeconds * 1000 };
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + windowSeconds * 1000;
  } else {
    entry.count += 1;
  }
  memRate.set(userId, entry);
  return entry.count <= maxCommands;
}

// ══════════════════════════════════════════════════════
// ⟡ Caché general
// ══════════════════════════════════════════════════════

async function setCache(key, value, ttlSeconds = 300) {
  if (isRedisConnected && redis) {
    try {
      await redis.set(`cache:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    } catch {
      // Fallback
    }
  }
  memStore.set(`cache:${key}`, {
    data: value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

async function getCache(key) {
  if (isRedisConnected && redis) {
    try {
      const data = await redis.get(`cache:${key}`);
      return data ? JSON.parse(data) : null;
    } catch {
      // Fallback
    }
  }
  const item = memStore.get(`cache:${key}`);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memStore.delete(`cache:${key}`);
    return null;
  }
  return item.data;
}

async function clearCache(key) {
  if (isRedisConnected && redis) {
    try {
      await redis.del(`cache:${key}`);
      return;
    } catch {
      // Fallback
    }
  }
  memStore.delete(`cache:${key}`);
}

// ── Inicialización y cierre ──

async function initialize() {
  if (redis) {
    try {
      await redis.connect();
    } catch {
      console.log('⟡ Redis: Servidor externo no disponible. Usando caché en memoria de alta velocidad.');
    }
  }
}

async function close() {
  if (isRedisConnected && redis) {
    try {
      await redis.disconnect();
    } catch {}
  }
}

module.exports = {
  redis,
  initialize,
  close,
  // Burn
  setBurnState,
  getBurnState,
  clearBurnState,
  // Deals
  addDealToQueue,
  getDealState,
  updateDealState,
  removeDealFromQueue,
  getPendingDealsCount,
  // Rate Limit
  checkRateLimit,
  // Cache
  setCache,
  getCache,
  clearCache,
};
