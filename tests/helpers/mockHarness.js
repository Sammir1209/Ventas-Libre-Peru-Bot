// ══════════════════════════════════════════════════════════
// ⟡ Test Helper: Mock Telegram Bot & Context Harness
//   Zero external dependencies. Native Node.js execution.
// ══════════════════════════════════════════════════════════

const Module = require('module');

// 1. Ensure minimal env variables for src/config/env.js
process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456789:MOCK_TOKEN_FOR_TESTS_VLP';
process.env.DEV_USER_ID = process.env.DEV_USER_ID || '7794982496';
process.env.OWNER_IDS = process.env.OWNER_IDS || '[7849224682, 7794982496]';

// 2. Intercept 'grammy' require if node_modules is not installed
try {
  require.resolve('grammy');
} catch {
  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'grammy') {
      return {
        InputFile: class InputFile {
          constructor(file, filename) {
            this.file = file;
            this.filename = filename;
          }
        },
        InlineKeyboard: class InlineKeyboard {
          constructor() {
            this.inline_keyboard = [[]];
          }
          text(label, data) { return this; }
          row() { return this; }
          url(label, url) { return this; }
        },
        Bot: class Bot {
          constructor(token) {
            this.token = token;
            this.api = {};
          }
        }
      };
    }
    return origLoad.apply(this, arguments);
  };
}

/**
 * Mock Context class representing Telegram update context in grammY.
 */
class MockCtx {
  constructor(options = {}, botInstance = null) {
    this._bot = botInstance;
    this.chat = Object.assign(
      {
        id: -1001001,
        type: 'supergroup',
        title: 'Grupo Oficial Ventas Libres Perú'
      },
      options.chat || {}
    );
    this.from = Object.assign(
      {
        id: 7794982496, // default to owner/staff
        username: 'admin_vlp',
        first_name: 'Admin',
        is_bot: false
      },
      options.from || {}
    );
    this.message = Object.assign(
      {
        message_id: options.messageId || Math.floor(Math.random() * 100000) + 1,
        text: options.text || '',
        chat: this.chat,
        from: this.from,
        date: Math.floor(Date.now() / 1000)
      },
      options.message || {}
    );
    if (options.reply_to_message) {
      this.message.reply_to_message = options.reply_to_message;
    }

    this.match = options.match !== undefined
      ? options.match
      : this._extractMatch(this.message.text);

    this.me = Object.assign(
      {
        id: 999999999,
        username: 'ventas_libres_peru_Bot',
        first_name: 'VLP Bot'
      },
      options.me || {}
    );

    this.replies = [];
    this.documents = [];

    this.api = botInstance ? botInstance.api : {
      sendMessage: async () => ({ message_id: 1 }),
      sendDocument: async () => ({ message_id: 2 }),
      pinChatMessage: async () => true,
      unpinChatMessage: async () => true,
      editMessageReplyMarkup: async () => true
    };
  }

  _extractMatch(text) {
    if (!text || typeof text !== 'string') return '';
    const parts = text.trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }

  async reply(text, options = {}) {
    const record = {
      message_id: Math.floor(Math.random() * 100000) + 10,
      text,
      options,
      timestamp: Date.now()
    };
    this.replies.push(record);
    if (this._bot) {
      this._bot.recordedReplies.push(record);
    }
    return record;
  }

  async replyWithDocument(document, options = {}) {
    const record = {
      message_id: Math.floor(Math.random() * 100000) + 20,
      document,
      options,
      timestamp: Date.now()
    };
    this.documents.push(record);
    if (this._bot) {
      this._bot.recordedDocuments.push(record);
    }
    return record;
  }

  getLastReply() {
    return this.replies.length > 0 ? this.replies[this.replies.length - 1].text : null;
  }

  getAllReplies() {
    return this.replies.map(r => r.text);
  }

  getDocuments() {
    return this.documents;
  }
}

/**
 * Mock Bot class that captures commands, listeners, and executes update pipelines.
 */
class MockBot {
  constructor() {
    this.commands = new Map();
    this.eventListeners = [];
    this.middlewares = [];
    this.recordedReplies = [];
    this.recordedDocuments = [];
    this.recordedApiMessages = [];
    this.recordedApiDocuments = [];
    this.pinnedMessages = [];
    this.unpinnedMessages = [];

    let msgIdCounter = 1000;

    this.api = {
      sendMessage: async (chatId, text, options = {}) => {
        const msg = {
          message_id: ++msgIdCounter,
          chat_id: chatId,
          text,
          options,
          timestamp: Date.now()
        };
        this.recordedApiMessages.push(msg);
        return msg;
      },
      sendDocument: async (chatId, document, options = {}) => {
        const doc = {
          message_id: ++msgIdCounter,
          chat_id: chatId,
          document,
          options,
          timestamp: Date.now()
        };
        this.recordedApiDocuments.push(doc);
        return doc;
      },
      pinChatMessage: async (chatId, messageId, options = {}) => {
        this.pinnedMessages.push({ chatId, messageId, options });
        return true;
      },
      unpinChatMessage: async (chatId, messageId) => {
        this.unpinnedMessages.push({ chatId, messageId });
        return true;
      },
      editMessageReplyMarkup: async (chatId, messageId) => {
        return true;
      }
    };
  }

  use(...middlewares) {
    this.middlewares.push(...middlewares);
    return this;
  }

  command(name, ...handlers) {
    const list = this.commands.get(name) || [];
    list.push(...handlers);
    this.commands.set(name, list);
    return this;
  }

  on(filter, ...handlers) {
    this.eventListeners.push({ filter, handlers });
    return this;
  }

  catch(errHandler) {
    this.errorHandler = errHandler;
    return this;
  }

  async _runPipeline(handlers, ctx) {
    let index = 0;
    const next = async () => {
      if (index < handlers.length) {
        const fn = handlers[index++];
        return await fn(ctx, next);
      }
    };
    return await next();
  }

  async simulateCommand(name, ctxOptions = {}) {
    const handlers = this.commands.get(name);
    if (!handlers || handlers.length === 0) {
      throw new Error(`Command '/${name}' is not registered on MockBot.`);
    }
    const ctx = new MockCtx(ctxOptions, this);
    await this._runPipeline(handlers, ctx);
    return ctx;
  }

  async simulateMessage(ctxOptions = {}) {
    const ctx = new MockCtx(ctxOptions, this);
    for (const listener of this.eventListeners) {
      if (listener.filter === 'message:text' && ctx.message.text) {
        await this._runPipeline(listener.handlers, ctx);
      }
    }
    return ctx;
  }

  clearRecordings() {
    this.recordedReplies = [];
    this.recordedDocuments = [];
    this.recordedApiMessages = [];
    this.recordedApiDocuments = [];
    this.pinnedMessages = [];
    this.unpinnedMessages = [];
  }
}

/**
 * Reset and initialize database in-memory stock for deterministic testing.
 */
async function resetDatabaseState(db) {
  // Clear any existing active claims/sessions
  if (db.expireStaleClaims) {
    await db.expireStaleClaims();
  }

  // Ensure available stock items exist in DB
  const stock = await db.getAvailableRewardsCount();
  if (stock.total < 5) {
    await db.insertReward({
      category: 'PRIME_VIDEO',
      account_title: 'Amazon Prime Video 1 Mes',
      account_data: JSON.stringify({
        email: 'test_prime_user@vlp.pe',
        password: 'PrimeTestPassword2026!',
        pin: '1234',
        extra: 'Perfil 1 - No cambiar clave'
      }),
      status: 'AVAILABLE'
    });

    await db.insertReward({
      category: 'YOUTUBE_PREMIUM',
      account_title: 'YouTube Premium Familiar',
      account_data: 'yt_user@vlp.pe:YoutubeClaveSegura123',
      status: 'AVAILABLE'
    });
  }
}

module.exports = {
  MockBot,
  MockCtx,
  resetDatabaseState
};
