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
  console.log('\n⊱ ──────────────────────────────────────── ⊰');
  console.log('⟡ INICIANDO VENTAS LIBRES PERÚ BOT (RENDER 24/7)');
  console.log('⊱ ──────────────────────────────────────── ⊰\n');

  // 1. Conectar Supabase
  try {
    await db.initialize();

    // Cargar configuraciones guardadas de grupos e hilos (Topics)
    try {
      const savedEscrow = await db.getSetting('escrow_group_id');
      if (savedEscrow) config.ESCROW_GROUP_ID = Number(savedEscrow);

      const savedStaff = await db.getSetting('staff_chat_id');
      if (savedStaff) config.STAFF_CHAT_ID = Number(savedStaff);

      const savedStaffThread = await db.getSetting('staff_thread_id');
      if (savedStaffThread) config.STAFF_THREAD_ID = Number(savedStaffThread);

      const savedLogs = await db.getSetting('log_channel_id');
      if (savedLogs) config.LOG_CHANNEL_ID = Number(savedLogs);

      const savedLogsThread = await db.getSetting('log_thread_id');
      if (savedLogsThread) config.LOG_THREAD_ID = Number(savedLogsThread);

      const savedBurn = await db.getSetting('burn_chat_id');
      if (savedBurn) config.BURN_CHAT_ID = Number(savedBurn);

      const savedBurnThread = await db.getSetting('burn_thread_id');
      if (savedBurnThread) config.BURN_THREAD_ID = Number(savedBurnThread);

      const savedPubBurn = await db.getSetting('public_burn_channel_id');
      if (savedPubBurn) config.PUBLIC_BURN_CHANNEL_ID = Number(savedPubBurn);

      const savedPubBurnThread = await db.getSetting('public_burn_thread_id');
      if (savedPubBurnThread) config.PUBLIC_BURN_THREAD_ID = Number(savedPubBurnThread);

      console.log('✓ Supabase: Base de datos y configuraciones cargadas con éxito.');
    } catch {}
  } catch (err) {
    console.warn('⟡ Supabase no disponible:', err.message);
  }

  // 2. Conectar Caché Redis
  try {
    await redisDb.initialize();
    console.log('✓ Redis / Caché en memoria conectado.');
  } catch (err) {
    console.warn('⟡ Redis: En memoria.');
  }

  // 3. Conectar Userbot MTProto
  try {
    await userbot.initialize();
  } catch (err) {
    console.warn('⟡ Userbot:', err.message);
  }

  // 4. Inicializar Supabase Storage para capturas
  try {
    await supabaseStorage.initialize();
    console.log('✓ Supabase Storage listo (bucket "burn-proofs").');
  } catch (err) {
    console.warn('⟡ Supabase Storage:', err.message);
  }

  // 5. Instanciar Bot de Telegram con grammY
  const bot = new Bot(config.BOT_TOKEN);

  // ── Middleware global ──
  bot.use(antiSpam());

  // ── Auto-registro de usuarios y grupos ──
  bot.use(async (ctx, next) => {
    try {
      if (ctx.from && !ctx.from.is_bot) {
        await db.upsertUser(
          ctx.from.id,
          ctx.from.username || null,
          ctx.from.first_name || null
        );
      }
      if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup' || ctx.chat.type === 'channel')) {
        await db.registerOfficialGroup(
          ctx.chat.id,
          ctx.chat.title || 'Sin título',
          ctx.chat.type,
          ctx.chat.username || null
        );
      }
    } catch {}
    return next();
  });

  // ── Registrar módulos ──
  verificationHandler.register(bot);
  escrowHandler.register(bot);
  staffHandler.register(bot);
  staffList.register(bot);
  burnHandler.register(bot);
  burnReview.register(bot);
  moderationHandler.register(bot);
  groupsHandler.register(bot);
  helpHandler.register(bot);
  infoHandler.register(bot);

  // ── Temporizador Periódico: Avisos de Seguridad cada 20 min ──
  const { startPeriodicNoticeScheduler } = require('./modules/moderation/scheduler');
  startPeriodicNoticeScheduler(bot);

  // ── Error handler global ──
  bot.catch((err) => {
    console.error('⟡ Bot Catch Error:', err.message);
  });

  // 6. Servidor HTTP de Mantención 24/7 para Render y UptimeRobot
  const httpServer = http.createServer((req, res) => {
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
    console.log(`✓ Servidor HTTP activo en puerto ${port} (UptimeRobot / Health OK).`);
  });

  // Self-ping preventivo cada 10 minutos
  const renderUrl = process.env.RENDER_EXTERNAL_URL || 'https://ventas-libre-peru-bot.onrender.com';
  if (renderUrl) {
    setInterval(() => {
      try {
        const client = renderUrl.startsWith('https') ? https : http;
        client.get(`${renderUrl}/health`, () => {}).on('error', () => {});
      } catch {}
    }, 10 * 60 * 1000);
  }

  // 7. Iniciar bot con long polling y diagnóstico de permisos
  async function startBotWithRetry() {
    while (true) {
      try {
        await bot.start({
          drop_pending_updates: true,
          allowed_updates: ['message', 'callback_query', 'chat_member', 'my_chat_member', 'channel_post', 'chat_join_request'],
          onStart: async (botInfo) => {
            console.log('\n⊱ ──────────────────────────────────────── ⊰');
            console.log(`⟡ Bot @${botInfo.username} (ID: ${botInfo.id}) iniciado con éxito.`);
            console.log(`⟡ Owners: ${config.OWNER_IDS.join(', ')}`);
            console.log(`⟡ Userbot MTProto: ${userbot.isConnected() ? 'Activo (@cf_4chan)' : 'Inactivo'}`);
            console.log('⊱ ──────────────────────────────────────── ⊰');

            // Ejecutar Diagnóstico de Permisos en Grupos y Canales
            await runPermissionsDiagnostics(bot, botInfo);
          },
        });
        break;
      } catch (err) {
        if (err.error_code === 409 || err.message?.includes('409') || err.message?.includes('Conflict')) {
          console.warn('⟡ Relevo de Render en proceso (reintentando en 4s)...');
          await new Promise((r) => setTimeout(r, 4000));
        } else {
          console.error('⟡ Error en bot.start:', err.message);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }
  }

  await startBotWithRetry();
}

/**
 * Diagnóstico automático en vivo de permisos del bot en todos los canales y grupos
 */
async function runPermissionsDiagnostics(bot, botInfo) {
  const targetChats = [
    { name: 'Grupo Principal (Chat)', id: -1003538147715 },
    { name: 'Grupo Oficial de Tratos', id: config.ESCROW_GROUP_ID || -1004243437464 },
    { name: 'Canal Público de Quemados', id: config.PUBLIC_BURN_CHANNEL_ID || -1003905787584 },
    { name: 'Destino Staff / Tratos Admin', id: config.STAFF_CHAT_ID || -1003937265207 },
  ];

  console.log('\n⊱ ──────────────────────────────────────────────── ⊰');
  console.log('⟡ COMPROBACIÓN DE PERMISOS DE ADMINISTRADOR ⟡');
  console.log('⊱ ──────────────────────────────────────────────── ⊰');

  for (const item of targetChats) {
    if (!item.id) continue;
    try {
      const chat = await bot.api.getChat(item.id);
      const member = await bot.api.getChatMember(item.id, botInfo.id);

      const isAdm = member.status === 'administrator' || member.status === 'creator';
      const canRestrict = isAdm ? (member.can_restrict_members !== false) : false;
      const canDelete = isAdm ? (member.can_delete_messages !== false) : false;
      const canPost = isAdm ? (member.can_post_messages !== false) : false;

      console.log(`\n📌 ${item.name}`);
      console.log(`   » Nombre: ${chat.title || 'Chat'} | ID: ${item.id}`);
      console.log(`   » Tipo: ${chat.type} | Rol: [${member.status.toUpperCase()}]`);

      if (!isAdm) {
        console.log(`   » ⚠️ ALERTA: El bot NO es Administrador en este chat.`);
      } else {
        if (chat.type === 'group' || chat.type === 'supergroup') {
          console.log(`   » Restringir/Desmutear miembros: ${canRestrict ? '✓ ACTIVO' : '❌ DESACTIVADO'}`);
          console.log(`   » Eliminar mensajes: ${canDelete ? '✓ ACTIVO' : '❌ DESACTIVADO'}`);
          if (!canRestrict) {
            console.log(`   » ⚠️ ACCIÓN REQUERIDA: Activa "Restringir miembros" (Ban/Restrict Users) en los permisos de Administrador de este grupo.`);
          }
        } else if (chat.type === 'channel') {
          console.log(`   » Publicar en el canal: ${canPost ? '✓ ACTIVO' : '❌ DESACTIVADO'}`);
        }
      }
    } catch (err) {
      console.log(`\n📌 ${item.name} (${item.id})`);
      console.log(`   » ❌ No se pudo consultar: ${err.message} (Verifica que el bot esté añadido al chat).`);
    }
  }
  console.log('\n⊱ ──────────────────────────────────────────────── ⊰\n');
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
