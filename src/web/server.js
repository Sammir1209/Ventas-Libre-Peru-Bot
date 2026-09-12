const express = require('express');
const path = require('path');
const db = require('../database/postgres');
const botManager = require('../core/botManager');
const config = require('../config/env');
const https = require('https');

// ══════════════════════════════════════════════════════
// ⟡ Servidor Web y API REST Blindada — SaaS Dashboard
// ══════════════════════════════════════════════════════

function telegramApiCall(token, method, params = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(params);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.ok) {
            resolve(json.result);
          } else {
            reject(new Error(json.description || 'Error en llamada a Telegram API'));
          }
        } catch {
          reject(new Error('Respuesta inválida de Telegram'));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

function maskToken(token) {
  if (!token || typeof token !== 'string') return 'N/A';
  if (token.length < 15) return '***';
  const prefix = token.slice(0, 10);
  const suffix = token.slice(-4);
  return `${prefix}...${suffix}`;
}

// ── Rate Limiter Simple en Memoria (Anti-Bruteforce) ──
const ipAttempts = new Map();
function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minuto
  const maxRequests = 60;

  let record = ipAttempts.get(ip);
  if (!record || now - record.startTime > windowMs) {
    record = { count: 1, startTime: now };
    ipAttempts.set(ip, record);
  } else {
    record.count++;
    if (record.count > maxRequests) {
      return res.status(429).json({
        ok: false,
        error: 'Demasiadas peticiones. Bloqueo temporal por seguridad.',
      });
    }
  }
  next();
}

function createWebApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(rateLimiter);

  const dashboardPath = config.DASHBOARD_PATH || '/vlp-master-portal-7849';
  const apiPrefix = config.API_SECRET_PREFIX || '/api-sec-vlp';

  // ── Middleware de Autenticación de Admin (Anti-Dumpeo) ──
  const requireAdminAuth = (req, res, next) => {
    const key = req.headers['x-admin-key'] || req.query.key || req.body?.admin_key;
    const expectedKey = config.ADMIN_KEY || 'vlp_master_key_99x_2026_sec';

    if (!key || key !== expectedKey) {
      return res.status(401).json({
        ok: false,
        error: 'Acceso no autorizado. Clave de seguridad requerida.',
      });
    }
    next();
  };

  // ── 1. Ruta Pública Raíz: Cloaking / Anti-Escaneo ──
  app.get('/', (req, res) => {
    res.json({
      status: 'ok',
      bot: 'Ventas Libres Perú',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // ── 2. Health Check Endpoint (Render & UptimeRobot) ──
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      bot: 'Ventas Libres Perú SaaS',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // ── 2.5. Mini-Web Pública de Verificación Responsive ──
  app.get(['/verificar', '/verify', '/canales'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'verify.html'));
  });

  // ── 3. Servir Panel Web Exclusivamente en Ruta Secreta ──
  app.use(dashboardPath, express.static(path.join(__dirname, 'public')));

  app.get(dashboardPath, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // ── 4. Endpoints de la API Secreta ──

  // Configuración inicial de frontend
  app.get(`${apiPrefix}/config`, (req, res) => {
    res.json({
      ok: true,
      apiPrefix: apiPrefix,
    });
  });

  // ── Login de Owner con ID de Telegram + Master Key ──
  app.post(`${apiPrefix}/auth-owner`, async (req, res) => {
    try {
      const { key, telegramId } = req.body;
      const expectedKey = config.ADMIN_KEY || 'vlp_master_key_99x_2026_sec';

      if (!key || key !== expectedKey) {
        return res.status(401).json({ ok: false, error: 'Clave de seguridad incorrecta.' });
      }

      const numId = Number(telegramId);
      if (!numId || isNaN(numId)) {
        return res.status(400).json({ ok: false, error: 'ID de Telegram inválido.' });
      }

      // Validar si el ID es Owner o Staff Autorizado
      const isOwnerHardcoded = config.OWNER_IDS.includes(numId) || numId === 7794982496 || numId === 7849224682;
      const staffMember = await db.getStaffMember(numId);
      const isStaffOwner = staffMember && (staffMember.role.includes('OWNER') || staffMember.role.includes('CO-OWNER'));

      if (!isOwnerHardcoded && !isStaffOwner) {
        return res.status(403).json({
          ok: false,
          error: 'El ID proporcionado no tiene rango de Owner o Co-Owner autorizado.',
        });
      }

      // Obtener datos del perfil de Telegram usando el bot principal
      let profileName = staffMember?.first_name || 'Owner Oficial';
      let profileUsername = staffMember?.username || '';
      let avatarUrl = null;

      try {
        const chatInfo = await telegramApiCall(config.BOT_TOKEN, 'getChat', { chat_id: numId });
        profileName = chatInfo.first_name ? `${chatInfo.first_name} ${chatInfo.last_name || ''}`.trim() : profileName;
        profileUsername = chatInfo.username || profileUsername;

        const photos = await telegramApiCall(config.BOT_TOKEN, 'getUserProfilePhotos', { user_id: numId, limit: 1 });
        if (photos.total_count > 0 && photos.photos[0]?.length > 0) {
          const fileId = photos.photos[0][0].file_id;
          const fileInfo = await telegramApiCall(config.BOT_TOKEN, 'getFile', { file_id: fileId });
          if (fileInfo.file_path) {
            avatarUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${fileInfo.file_path}`;
          }
        }
      } catch (tgErr) {
        console.warn('⟡ Error obteniendo perfil de Telegram para avatar:', tgErr.message);
      }

      res.json({
        ok: true,
        user: {
          id: numId,
          name: profileName,
          username: profileUsername,
          avatarUrl,
          role: isOwnerHardcoded ? 'OWNER SUPREMO' : staffMember.role,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Probar y Validar Token de BotFather ──
  app.post(`${apiPrefix}/test-token`, requireAdminAuth, async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ ok: false, error: 'Token requerido' });

      const botInfo = await telegramApiCall(token.trim(), 'getMe');
      res.json({ ok: true, bot: botInfo });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ── Verificar Grupo Oficial Chat con Telegram API (por ID, @username o Enlace de Invitación https://t.me/+...) ──
  app.post(`${apiPrefix}/verify-chat`, requireAdminAuth, async (req, res) => {
    try {
      const { token, chatId } = req.body;
      const botToken = token?.trim() || config.BOT_TOKEN;

      if (!chatId) {
        return res.status(400).json({ ok: false, error: 'ID o enlace del grupo requerido.' });
      }

      let input = String(chatId).trim();
      const botInfo = await telegramApiCall(botToken, 'getMe');

      let chatInfo = null;
      let isAdm = false;
      let memberInfo = null;

      // 1. Si es enlace de invitación privado (https://t.me/+... o https://t.me/joinchat/...)
      if (input.includes('t.me/+') || input.includes('t.me/joinchat/') || input.startsWith('+')) {
        let fullLink = input;
        if (!fullLink.startsWith('http')) {
          fullLink = `https://t.me/${input.replace(/^\//, '')}`;
        }

        try {
          const inviteData = await telegramApiCall(botToken, 'checkChatInviteLink', { invite_link: fullLink });
          if (inviteData && inviteData.chat) {
            chatInfo = inviteData.chat;
          } else if (inviteData && inviteData.title) {
            chatInfo = {
              id: inviteData.chat?.id || null,
              title: inviteData.title,
              type: inviteData.type || 'supergroup',
              member_count: inviteData.member_count,
            };
          }
        } catch (inviteErr) {
          throw new Error(`Enlace de invitación inválido o expirado: ${inviteErr.message}`);
        }
      }
      // 2. Si es enlace público https://t.me/username
      else if (input.includes('t.me/')) {
        const parts = input.split('t.me/');
        const cleanUser = `@${parts[1].replace('/', '')}`;
        chatInfo = await telegramApiCall(botToken, 'getChat', { chat_id: cleanUser });
      }
      // 3. Si es @username o ID numérico
      else {
        let target = input;
        if (!target.startsWith('@') && !isNaN(Number(target))) {
          target = Number(target);
        }
        chatInfo = await telegramApiCall(botToken, 'getChat', { chat_id: target });
      }

      if (!chatInfo) {
        return res.status(400).json({ ok: false, error: 'No se pudo obtener información del chat.' });
      }

      // Si tenemos chat.id, consultar permisos del bot
      if (chatInfo.id) {
        try {
          memberInfo = await telegramApiCall(botToken, 'getChatMember', {
            chat_id: chatInfo.id,
            user_id: botInfo.id,
          });
          isAdm = memberInfo.status === 'administrator' || memberInfo.status === 'creator';
        } catch {}
      }

      res.json({
        ok: true,
        chat: {
          id: chatInfo.id,
          title: chatInfo.title || 'Grupo',
          type: chatInfo.type || 'group',
          username: chatInfo.username ? `@${chatInfo.username}` : null,
          memberCount: chatInfo.member_count || null,
          isBotAdmin: isAdm,
          botStatus: memberInfo?.status || 'desconocido',
          canRestrictMembers: isAdm ? memberInfo?.can_restrict_members !== false : false,
          canDeleteMessages: isAdm ? memberInfo?.can_delete_messages !== false : false,
        },
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: `No se pudo verificar el grupo: ${err.message}. Asegúrate de que el enlace o ID sea válido y que el bot esté en el chat.`,
      });
    }
  });

  // ── Verificar Canal de Verificación 1 por 1 con Telegram API ──
  app.post(`${apiPrefix}/verify-channel`, requireAdminAuth, async (req, res) => {
    try {
      const { token, channelIdentifier } = req.body;
      const botToken = token?.trim() || config.BOT_TOKEN;

      if (!channelIdentifier) {
        return res.status(400).json({ ok: false, error: 'Identificador del canal requerido.' });
      }

      let cleanTarget = channelIdentifier.trim();
      if (cleanTarget.includes('t.me/')) {
        const parts = cleanTarget.split('t.me/');
        cleanTarget = `@${parts[1].replace('/', '')}`;
      } else if (!cleanTarget.startsWith('@') && !cleanTarget.startsWith('-100')) {
        cleanTarget = `@${cleanTarget}`;
      }

      const botInfo = await telegramApiCall(botToken, 'getMe');
      const chatInfo = await telegramApiCall(botToken, 'getChat', { chat_id: cleanTarget });
      
      let isAdm = false;
      try {
        const memberInfo = await telegramApiCall(botToken, 'getChatMember', {
          chat_id: chatInfo.id,
          user_id: botInfo.id,
        });
        isAdm = memberInfo.status === 'administrator' || memberInfo.status === 'creator';
      } catch {}

      res.json({
        ok: true,
        channel: {
          id: chatInfo.id,
          title: chatInfo.title,
          username: chatInfo.username ? `@${chatInfo.username}` : cleanTarget,
          type: chatInfo.type,
          isBotAdmin: isAdm,
        },
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: `No se pudo verificar el canal: ${err.message}. Asegúrate de que el canal sea público o que el bot sea Administrador.`,
      });
    }
  });

  // ── Métricas y Estadísticas del Sistema ──
  app.get(`${apiPrefix}/system-stats`, requireAdminAuth, async (req, res) => {
    try {
      const bots = await db.getAllSubBots();
      const burnedCount = await db.getBurnedUsersCount();
      const groups = await db.getAllGroups();
      const live = botManager.getLiveStatus();

      res.json({
        ok: true,
        stats: {
          totalSubBots: bots.length,
          onlineSubBots: live.length,
          totalGroups: groups.length,
          totalBurnedScammers: burnedCount,
          uptimeSeconds: Math.floor(process.uptime()),
          memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Listar Sub-Bots con Tokens Enmascarados (Protección Anti-Dumpeo) ──
  app.get(`${apiPrefix}/subbots`, requireAdminAuth, async (req, res) => {
    try {
      const bots = await db.getAllSubBots();
      const liveStatus = botManager.getLiveStatus();
      const liveMap = new Map(liveStatus.map((s) => [s.id, s]));

      const enriched = bots.map((b) => {
        const live = liveMap.get(b.id);
        return {
          id: b.id,
          bot_username: b.bot_username,
          community_name: b.community_name,
          owner_ids: b.owner_ids,
          plan_status: b.plan_status,
          expires_at: b.expires_at,
          channels_to_verify: b.channels_to_verify,
          groups_folder_link: b.groups_folder_link,
          escrow_group_id: b.escrow_group_id,
          staff_chat_id: b.staff_chat_id,
          bot_token_masked: maskToken(b.bot_token),
          isOnline: !!live,
          liveStatus: live ? live.status : 'OFFLINE',
          startedAt: live ? live.startedAt : null,
          created_at: b.created_at,
        };
      });

      res.json({ ok: true, bots: enriched });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Crear Nuevo Sub-Bot ──
  app.post(`${apiPrefix}/subbots`, requireAdminAuth, async (req, res) => {
    try {
      const {
        bot_token,
        community_name,
        owner_id,
        channels_to_verify,
        official_chat_id,
        groups_folder_link,
        duration_days,
        staff_chat_id,
        escrow_group_id,
        log_channel_id,
        burn_chat_id,
        public_burn_channel_id,
      } = req.body;

      if (!bot_token) {
        return res.status(400).json({ ok: false, error: 'El Token de BotFather es obligatorio.' });
      }

      // Validar token en Telegram
      const botInfo = await telegramApiCall(bot_token.trim(), 'getMe');

      // Calcular expiración
      let expiresAt = null;
      if (duration_days && Number(duration_days) > 0) {
        const d = new Date();
        d.setDate(d.getDate() + Number(duration_days));
        expiresAt = d.toISOString();
      }

      const ownerIds = owner_id ? [Number(owner_id)] : [];

      let channelsArray = [];
      if (channels_to_verify) {
        if (Array.isArray(channels_to_verify)) {
          channelsArray = channels_to_verify;
        } else if (typeof channels_to_verify === 'string') {
          channelsArray = channels_to_verify.split(',').map((c) => c.trim()).filter(Boolean);
        }
      }

      const newBotData = {
        bot_token: bot_token.trim(),
        bot_username: botInfo.username,
        community_name: community_name?.trim() || `Comunidad de @${botInfo.username}`,
        owner_ids: ownerIds,
        plan_status: 'ACTIVE',
        expires_at: expiresAt,
        channels_to_verify: channelsArray,
        groups_folder_link: groups_folder_link?.trim() || null,
        staff_chat_id: staff_chat_id ? Number(staff_chat_id) : null,
        escrow_group_id: escrow_group_id ? Number(escrow_group_id) : null,
        log_channel_id: log_channel_id ? Number(log_channel_id) : null,
        burn_chat_id: burn_chat_id ? Number(burn_chat_id) : null,
        public_burn_channel_id: public_burn_channel_id ? Number(public_burn_channel_id) : null,
        custom_settings: {
          official_chat_id: official_chat_id ? Number(official_chat_id) : null,
        },
      };

      const saved = await db.createSubBot(newBotData);

      // Iniciar instancia automáticamente en vivo
      if (saved && saved.id) {
        try {
          await botManager.startSubBot(saved);
        } catch (startErr) {
          console.warn('⟡ No se pudo iniciar el sub-bot en vivo inmediatamente:', startErr.message);
        }
      }

      res.json({ ok: true, subBot: saved });
    } catch (err) {
      console.error('⟡ Error creando sub-bot:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Iniciar Sub-Bot ──
  app.post(`${apiPrefix}/subbots/:id/start`, requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const subBot = await db.getSubBotById(id);
      if (!subBot) return res.status(404).json({ ok: false, error: 'Sub-bot no encontrado.' });

      await botManager.startSubBot(subBot);
      await db.updateSubBot(id, { plan_status: 'ACTIVE' });

      res.json({ ok: true, message: 'Sub-bot iniciado exitosamente.' });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Detener Sub-Bot ──
  app.post(`${apiPrefix}/subbots/:id/stop`, requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await botManager.stopSubBot(id);
      await db.updateSubBot(id, { plan_status: 'SUSPENDED' });

      res.json({ ok: true, message: 'Sub-bot detenido.' });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Reiniciar Sub-Bot ──
  app.post(`${apiPrefix}/subbots/:id/restart`, requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await botManager.restartSubBot(id);
      await db.updateSubBot(id, { plan_status: 'ACTIVE' });

      res.json({ ok: true, message: 'Sub-bot reiniciado.' });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Eliminar Sub-Bot ──
  app.delete(`${apiPrefix}/subbots/:id`, requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await botManager.stopSubBot(id);
      await db.deleteSubBot(id);

      res.json({ ok: true, message: 'Sub-bot eliminado.' });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return app;
}

module.exports = { createWebApp };
