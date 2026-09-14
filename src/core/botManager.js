const { Bot } = require('grammy');
const { autoRetry } = require('@grammyjs/auto-retry');
const { apiThrottler } = require('@grammyjs/transformer-throttler');
const db = require('../database/postgres');
const { antiSpam } = require('../middleware/antiSpam');

// Módulos del bot
const verificationHandler = require('../modules/verification/handler');
const escrowHandler = require('../modules/escrow/handler');
const staffHandler = require('../modules/staff/handler');
const staffList = require('../modules/staff/list');
const burnHandler = require('../modules/burn/handler');
const burnReview = require('../modules/burn/review');
const moderationHandler = require('../modules/moderation/handler');
const groupsHandler = require('../modules/moderation/groups');
const infoHandler = require('../modules/info/handler');
const helpHandler = require('../modules/help/handler');
const aiHandler = require('../modules/ai/handler');
const searchHandler = require('../modules/moderation/search');
const setupHandler = require('../modules/setup/handler');
const securityHandler = require('../modules/security/handler');

// ══════
// ⟡ Motor Multi-Instancia de Sub-Bots (Plataforma SaaS)
// ══════

class BotManager {
  constructor() {
    this.instances = new Map(); // subBotId -> { bot, tenant, status, startedAt }
  }

  /**
   * Configura y registra todos los manejadores en una instancia de bot.
   */
  setupBotInstance(bot, tenant) {
    bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 10 }));
    bot.api.config.use(apiThrottler());

    // Inyectar contexto multi-tenant en cada request
    bot.use(async (ctx, next) => {
      ctx.tenant = tenant;
      return next();
    });

    // Middleware Anti-Spam
    bot.use(antiSpam());

    // Registro de todos los módulos
    verificationHandler.register(bot);
    escrowHandler.register(bot);
    staffHandler.register(bot);
    staffList.register(bot);
    burnHandler.register(bot);
    burnReview.register(bot);
    moderationHandler.register(bot);
    groupsHandler.register(bot);
    infoHandler.register(bot);
    helpHandler.register(bot);
    aiHandler.register(bot);
    searchHandler.register(bot);
    setupHandler.register(bot);
    securityHandler.register(bot);

    bot.catch((err) => {
      console.error(`⟡ [Sub-Bot: ${tenant.community_name}] Error no controlado:`, err.message);
    });
  }

  /**
   * Inicia una nueva instancia de sub-bot.
   */
  async startSubBot(tenantOrId) {
    let tenant = tenantOrId;
    if (typeof tenantOrId === 'string' || typeof tenantOrId === 'number') {
      tenant = await db.getSubBotById(tenantOrId);
    }

    if (!tenant || !tenant.bot_token) {
      throw new Error('Token de bot no proporcionado o sub-bot no encontrado en el sistema.');
    }

    const subBotId = tenant.id || tenant.bot_token;

    // Si ya está corriendo, detener primero
    if (this.instances.has(subBotId)) {
      await this.stopSubBot(subBotId);
    }

    const bot = new Bot(tenant.bot_token);
    this.setupBotInstance(bot, tenant);

    let botInfo = null;
    try {
      botInfo = await bot.api.getMe();
    } catch (apiErr) {
      throw new Error(`Token inválido en Telegram: ${apiErr.message}`);
    }

    // Iniciar long-polling en segundo plano con reintento ante 409 (rolling deploys)
    const startPollingWithBackoff = async () => {
      while (this.instances.has(subBotId)) {
        try {
          await bot.start({
            drop_pending_updates: true,
            allowed_updates: ['message', 'callback_query', 'chat_member', 'my_chat_member', 'channel_post', 'chat_join_request'],
            onStart: (info) => {
              console.log(`✓ [SaaS Sub-Bot] @${info.username} iniciado para "${tenant.community_name}"`);
            },
          });
          break;
        } catch (pollErr) {
          const isConflict = pollErr.error_code === 409 || pollErr.message?.includes('409') || pollErr.message?.includes('Conflict');
          if (isConflict) {
            console.warn(`⟡ [SaaS Sub-Bot] @${botInfo.username}: Relevo de instancia detectado (409). Esperando 4s...`);
            await new Promise((r) => setTimeout(r, 4000));
          } else {
            console.error(`⟡ [SaaS Sub-Bot] Error en polling de @${botInfo.username}:`, pollErr.message);
            this.instances.delete(subBotId);
            break;
          }
        }
      }
    };

    startPollingWithBackoff();

    this.instances.set(subBotId, {
      bot,
      tenant,
      botInfo,
      status: 'ONLINE',
      startedAt: new Date(),
    });

    return {
      subBotId,
      botUsername: botInfo.username,
      status: 'ONLINE',
    };
  }

  /**
   * Detiene todas las instancias de sub-bots activas (para apagado limpio en Render).
   */
  async stopAll() {
    console.log(`⟡ [SaaS Sub-Bot] Deteniendo ${this.instances.size} sub-bots activos...`);
    const stopPromises = [];
    for (const [id] of this.instances.entries()) {
      stopPromises.push(this.stopSubBot(id));
    }
    await Promise.allSettled(stopPromises);
    this.instances.clear();
    console.log('✓ [SaaS Sub-Bot] Todos los sub-bots fueron detenidos.');
  }

  /**
   * Detiene una instancia activa de sub-bot.
   */
  async stopSubBot(subBotId) {
    const instance = this.instances.get(subBotId);
    if (!instance) return false;

    try {
      await instance.bot.stop();
      console.log(`✓ [SaaS Sub-Bot] Sub-bot ${subBotId} detenido.`);
    } catch (err) {
      console.warn(`⟡ [SaaS Sub-Bot] Error al detener ${subBotId}:`, err.message);
    }

    this.instances.delete(subBotId);
    return true;
  }

  /**
   * Reinicia una instancia de sub-bot.
   */
  async restartSubBot(subBotId) {
    const instance = this.instances.get(subBotId);
    const dbTenant = await db.getSubBotById(subBotId);
    const tenantToRun = dbTenant || instance?.tenant;
    if (!tenantToRun) {
      throw new Error('Sub-bot no encontrado en el sistema.');
    }

    if (instance) {
      await this.stopSubBot(subBotId);
    }
    return await this.startSubBot(tenantToRun);
  }

  /**
   * Inicializa todos los sub-bots activos guardados en la BD al arrancar.
   */
  async initAllActiveSubBots() {
    try {
      const activeBots = await db.getAllSubBots();
      console.log(`⟡ [SaaS Manager] Cargando ${activeBots.length} sub-bots registrados en BD...`);

      for (const t of activeBots) {
        if (t.plan_status === 'ACTIVE') {
          try {
            await this.startSubBot(t);
          } catch (err) {
            console.error(`⟡ [SaaS Manager] Error iniciando sub-bot ${t.id} (${t.community_name}):`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('⟡ [SaaS Manager] Error en initAllActiveSubBots:', err.message);
    }
  }

  /**
   * Retorna el estado en vivo de todas las instancias.
   */
  getLiveStatus() {
    const list = [];
    for (const [id, inst] of this.instances.entries()) {
      list.push({
        id,
        communityName: inst.tenant.community_name,
        botUsername: inst.botInfo?.username,
        status: inst.status,
        startedAt: inst.startedAt,
      });
    }
    return list;
  }

  /**
   * Retorna el mapa en memoria de instancias activas.
   */
  getActiveSubBots() {
    return this.instances;
  }
}

// Instancia única (Singleton)
const botManager = new BotManager();

module.exports = botManager;
