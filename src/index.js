// ══════════════════════════════════════════════════════
// ⟡ Bot Ventas Libres Perú — Entry Point
// ══════════════════════════════════════════════════════

const http = require('http');
const https = require('https');
const { Bot } = require('grammy');
const config = require('./config/env');
const db = require('./database/postgres');
const redisDb = require('./database/redis');
const supabaseStorage = require('./database/supabase');
const userbot = require('./userbot/client');
const { SYM } = require('./config/constants');

// ── Módulos ──
const verificationHandler = require('./modules/verification/handler');
const escrowHandler = require('./modules/escrow/handler');
const staffHandler = require('./modules/staff/handler');
const staffList = require('./modules/staff/list');
const burnHandler = require('./modules/burn/handler');
const burnReview = require('./modules/burn/review');
const moderationHandler = require('./modules/moderation/handler');
const groupsHandler = require('./modules/moderation/groups');
const infoHandler = require('./modules/info/handler');
const helpHandler = require('./modules/help/handler');

// ── Middleware ──
const { antiSpam } = require('./middleware/antiSpam');

// ══════════════════════════════════════════════════════
// ⟡ Inicialización
// ══════════════════════════════════════════════════════

async function main() {
  console.log('');
  console.log('⊱ ────── ⊰');
  console.log('⟡ VENTAS LIBRES PERÚ — Iniciando Bot...');
  console.log('⊱ ────── ⊰');
  console.log('');

  // 1. Conectar Supabase (Base de Datos Oficial)
  let dbReady = false;
  try {
    await db.initialize();
    dbReady = true;

    // Cargar configuraciones guardadas de grupos e hilos (Topics)
    try {
      const savedEscrow = await db.getSetting('escrow_group_id');
      if (savedEscrow) {
        config.ESCROW_GROUP_ID = Number(savedEscrow);
        console.log(`✓ Supabase: Grupo oficial de tratos cargado: ${savedEscrow}`);
      }

      const savedStaff = await db.getSetting('staff_chat_id');
      if (savedStaff) {
        config.STAFF_CHAT_ID = Number(savedStaff);
        console.log(`✓ Supabase: Destino Tratos Admin cargado: ${savedStaff}`);
      }
      const savedStaffThread = await db.getSetting('staff_thread_id');
      if (savedStaffThread) {
        config.STAFF_THREAD_ID = Number(savedStaffThread);
        console.log(`✓ Supabase: Hilo/Topic Tratos Admin cargado: ${savedStaffThread}`);
      }

      const savedLogs = await db.getSetting('log_channel_id');
      if (savedLogs) {
        config.LOG_CHANNEL_ID = Number(savedLogs);
        console.log(`✓ Supabase: Destino Logs cargado: ${savedLogs}`);
      }
      const savedLogsThread = await db.getSetting('log_thread_id');
      if (savedLogsThread) {
        config.LOG_THREAD_ID = Number(savedLogsThread);
        console.log(`✓ Supabase: Hilo/Topic Logs cargado: ${savedLogsThread}`);
      }

      const savedBurn = await db.getSetting('burn_chat_id');
      if (savedBurn) {
        config.BURN_CHAT_ID = Number(savedBurn);
        console.log(`✓ Supabase: Destino Quemar cargado: ${savedBurn}`);
      }
      const savedBurnThread = await db.getSetting('burn_thread_id');
      if (savedBurnThread) {
        config.BURN_THREAD_ID = Number(savedBurnThread);
        console.log(`✓ Supabase: Hilo/Topic Quemar cargado: ${savedBurnThread}`);
      }

      const savedPubBurn = await db.getSetting('public_burn_channel_id');
      if (savedPubBurn) {
        config.PUBLIC_BURN_CHANNEL_ID = Number(savedPubBurn);
        console.log(`✓ Supabase: Canal Público de Quemados cargado: ${savedPubBurn}`);
      }
      const savedPubBurnThread = await db.getSetting('public_burn_thread_id');
      if (savedPubBurnThread) {
        config.PUBLIC_BURN_THREAD_ID = Number(savedPubBurnThread);
        console.log(`✓ Supabase: Hilo Canal Quemados cargado: ${savedPubBurnThread}`);
      }
    } catch {}
  } catch (err) {
    console.warn('⟡ Supabase no disponible:', err.message);
    console.warn('  » Las funciones que requieran BD no estarán operativas.');
  }

  // 2. Conectar Redis
  let redisReady = false;
  try {
    await redisDb.initialize();
    console.log('✓ Redis conectado.');
    redisReady = true;
  } catch (err) {
    console.warn('⟡ Redis no disponible:', err.message);
    console.warn('  » Cola de tratos, anti-spam y flujo /quemar no operativos.');
  }

  // 3. Inicializar Userbot MTProto
  try {
    await userbot.initialize();
    if (userbot.isConnected()) {
      console.log('✓ Userbot MTProto conectado.');
    } else {
      console.log('⟡ Userbot MTProto deshabilitado (sin credenciales).');
    }
  } catch (err) {
    console.error('⟡ Userbot MTProto no disponible:', err.message);
  }

  // 4. Inicializar Supabase (Storage para pruebas /quemar)
  try {
    supabaseStorage.initialize();
    if (supabaseStorage.isEnabled()) {
      await supabaseStorage.ensureBucket();
      console.log('✓ Supabase Storage listo.');
    } else {
      console.log('⟡ Supabase: Deshabilitado (sin credenciales).');
    }
  } catch (err) {
    console.error('⟡ Supabase: Error:', err.message);
  }

  // 5. Crear instancia del bot
  const bot = new Bot(config.BOT_TOKEN);

  // ── Middleware Global: Anti-Spam ──
  bot.use(antiSpam());

  // ── Comando /start ──
  bot.command('start', async (ctx) => {
    const isPrivate = ctx.chat.type === 'private';
    if (!isPrivate) return;

    const payload = ctx.match?.trim();

    // Deep linking para tratoadm
    if (payload === 'tratoadm') {
      const templates = require('./utils/templates');
      const { dealMainKeyboard } = require('./modules/escrow/keyboard');
      return ctx.reply(templates.dealMainMenuMessage(), {
        parse_mode: 'HTML',
        reply_markup: dealMainKeyboard(),
      });
    }

    // Deep linking para quemar
    if (payload === 'quemar') {
      const templates = require('./utils/templates');
      const { burnTargetTypeKeyboard } = require('./modules/burn/keyboard');
      await redisDb.setBurnState(ctx.from.id, {
        step: 'CHOOSE_TYPE',
        targetId: null,
        targetUsername: null,
        targetLabel: null,
        context: null,
        proofs: [],
        proofUrls: [],
      });
      return ctx.reply(templates.burnInitialPrompt(), {
        parse_mode: 'HTML',
        reply_markup: burnTargetTypeKeyboard(),
      });
    }

    await ctx.reply(
      `${SYM.DIVIDER}\n` +
      `${SYM.DIAMOND} <b>VENTAS LIBRES PERÚ</b> ${SYM.DIAMOND}\n` +
      `${SYM.DIVIDER}\n\n` +
      `${SYM.STAR} Bienvenido al Bot oficial de la comunidad.\n\n` +
      `${SYM.ARROW} <b>Comandos disponibles:</b>\n\n` +
      `${SYM.BULLET} /tratoadm — Sistema de Tratos Admin (Escrow)\n` +
      `${SYM.BULLET} /info [id/@user] — Perfil y consulta de antecedentes\n` +
      `${SYM.BULLET} /quemar — Reportar estafador (solo DM)\n` +
      `${SYM.BULLET} /staff — Ver equipo del Staff\n` +
      `${SYM.BULLET} /help — Guía y protocolos según tu rol\n\n` +
      `${SYM.THIN_LINE}\n` +
      `${SYM.ARROW} <b>Staff & Owners:</b>\n` +
      `${SYM.BULLET} /promote [id/@user] — Ascender rango con panel interactivo\n` +
      `${SYM.BULLET} /demote [id/@user] — Degradar rango con panel interactivo\n` +
      `${SYM.BULLET} /gban [id/@user] — Baneo global de todos los grupos\n` +
      `${SYM.BULLET} /ungban [id/@user] — Quitar baneo global / desquemar\n` +
      `${SYM.BULLET} /verify — Activar/desactivar verificación en el grupo\n` +
      `${SYM.BULLET} /ban, /unban, /mute, /unmute\n` +
      `${SYM.BULLET} /set_grupo_tratos (Configurar grupo con temas)\n\n` +
      `${SYM.DIVIDER}`,
      { parse_mode: 'HTML' }
    );
  });

  // ── Registrar todos los módulos ──
  verificationHandler.register(bot);
  escrowHandler.register(bot);
  staffHandler.register(bot);
  staffList.register(bot);
  infoHandler.register(bot);
  burnHandler.register(bot);
  burnReview.register(bot);
  moderationHandler.register(bot);
  groupsHandler.register(bot);
  helpHandler.register(bot);

  // ── Error handler global ──
  bot.catch((err) => {
    console.error('⟡ Bot Error:', err.message);
    if (err.ctx) {
      console.error('  Context:', err.ctx.update?.update_id);
    }
  });

  // 5. Servidor HTTP de Mantención 24/7 para Render y UptimeRobot
  const httpServer = http.createServer((req, res) => {
    // Responder 200 OK a cualquier ping o comprobación de salud
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({
      status: 'ok',
      bot: 'Ventas Libres Perú',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      userbot: userbot.isConnected() ? 'connected' : 'disconnected',
    }));
  });

  const port = process.env.PORT || config.PORT || 10000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`✓ HTTP Server escuchando en puerto ${port} (Render / UptimeRobot 24/7).`);
  });

  // Self-ping preventivo cada 10 minutos si se detecta URL de Render
  const renderUrl = process.env.RENDER_EXTERNAL_URL || 'https://ventas-libre-peru-bot.onrender.com';
  if (renderUrl) {
    setInterval(() => {
      try {
        const client = renderUrl.startsWith('https') ? https : http;
        client.get(`${renderUrl}/health`, () => {}).on('error', () => {});
      } catch {}
    }, 10 * 60 * 1000);
  }

  // 6. Iniciar bot con long polling
  await bot.start({
    onStart: (botInfo) => {
      console.log('');
      console.log('⊱ ────── ⊰');
      console.log(`⟡ Bot @${botInfo.username} iniciado correctamente.`);
      console.log(`⟡ ID: ${botInfo.id}`);
      console.log(`⟡ Owners: ${config.OWNER_IDS.join(', ')}`);
      console.log(`⟡ Canales a verificar: ${config.CHANNELS_TO_VERIFY.length}`);
      console.log(`⟡ Userbot: ${userbot.isConnected() ? 'Activo' : 'Inactivo'}`);
      console.log('⊱ ────── ⊰');
      console.log('');
    },
  });
}

// ── Manejo de señales de cierre ──
process.on('SIGINT', async () => {
  console.log('\n⟡ Cerrando bot...');
  await db.close();
  await redisDb.close();
  await userbot.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⟡ SIGTERM recibido. Cerrando...');
  await db.close();
  await redisDb.close();
  await userbot.close();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('⟡ Unhandled Rejection:', reason);
});

// ── Ejecutar ──
main().catch((err) => {
  console.error('⟡ Error fatal:', err);
  process.exit(1);
});
