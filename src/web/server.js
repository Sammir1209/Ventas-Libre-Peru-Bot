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

// ── Rate Limiter Avanzado en Memoria con Ventana Deslizante y Blacklist de IPs Maliciosas ──
const ipRecords = new Map();
const blockedIps = new Map(); // IP -> timestamp expira

function securityFirewall(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  // 1. Comprobar si la IP está bloqueada por conducta abusiva
  const blockExpiry = blockedIps.get(ip);
  if (blockExpiry) {
    if (now < blockExpiry) {
      return res.status(403).json({
        ok: false,
        error: 'Tu dirección IP ha sido temporalmente restringida por actividad sospechosa.',
      });
    } else {
      blockedIps.delete(ip);
    }
  }

  // 2. Bloqueo de scanners automáticos (wp-admin, .env, phpmyadmin, etc.)
  const suspiciousPaths = [
    /\.env/i, /\.git/i, /wp-admin/i, /phpmyadmin/i, /shell/i,
    /\/api\/v1\/pods/i, /actuator/i, /swagger/i, /\/console/i,
    /\/admin\.php/i, /\/config\.json/i, /\/\.aws/i
  ];
  if (suspiciousPaths.some(pattern => pattern.test(req.originalUrl))) {
    console.warn(`🛡️ [Web Firewall] Intento de escaneo malicioso bloqueado desde IP ${ip}: ${req.originalUrl}`);
    blockedIps.set(ip, now + 15 * 60 * 1000); // 15 min ban
    return res.status(404).end();
  }

  // 3. Rate limiting por IP: máximo 120 peticiones por minuto en general, 20 peticiones para endpoints auth
  const windowMs = 60 * 1000;
  let record = ipRecords.get(ip);
  if (!record || now - record.startTime > windowMs) {
    record = { count: 1, authCount: 0, startTime: now };
    ipRecords.set(ip, record);
  } else {
    record.count++;
    if (req.path.includes('/auth') || req.path.includes('/login')) {
      record.authCount++;
      if (record.authCount > 10) {
        blockedIps.set(ip, now + 10 * 60 * 1000); // 10 min ban para fuerza bruta
        return res.status(429).json({
          ok: false,
          error: 'Demasiados intentos de acceso. IP bloqueada temporalmente.',
        });
      }
    }
    if (record.count > 150) {
      blockedIps.set(ip, now + 5 * 60 * 1000);
      return res.status(429).json({
        ok: false,
        error: 'Demasiadas solicitudes por minuto. Por favor espera antes de volver a intentarlo.',
      });
    }
  }

  // 4. Inyección de Cabeceras de Seguridad Extremas (Helmet / OWASP Top 10)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.removeHeader('X-Powered-By');

  next();
}

function createWebApp() {
  const app = express();

  // Limitar tamaño de payloads para prevenir ataques de denegación de servicio por memoria
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(securityFirewall);

  const dashboardPath = config.DASHBOARD_PATH || '/vlp-master-portal-7849';
  const apiPrefix = config.API_SECRET_PREFIX || '/api-sec-vlp';
  const panelHandler = require('../modules/security/panelHandler');

  // ── Middleware de Autenticación Unificado (Master Key o Token de Sesión /panel) ──
  const requireAdminAuth = async (req, res, next) => {
    const key = req.headers['x-admin-key'] || req.query.key || req.body?.admin_key;
    const authToken = req.headers['x-auth-token'] || req.query.auth_token || req.body?.auth_token;
    const expectedKey = config.ADMIN_KEY || 'vlp_master_key_99x_2026_sec';

    // 1. Clave Maestra
    if (key && key === expectedKey) {
      return next();
    }

    // 2. Token de Sesión Temporal de /panel
    if (authToken) {
      try {
        const session = await panelHandler.validatePanelSession(authToken);
        if (session && session.userId) {
          req.sessionUser = session;
          return next();
        }
      } catch (err) {
        console.warn('⟡ Error validando sesión de panel:', err.message);
      }
    }

    return res.status(401).json({
      ok: false,
      error: 'Acceso no autorizado. Inicia sesión con /panel en Telegram o ingresa tu clave.',
    });
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
  app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

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

  // ── Obtener Info de Sesión (tema, branding, permisos) ──
  app.get(`${apiPrefix}/session-info`, requireAdminAuth, async (req, res) => {
    try {
      const session = req.sessionUser || {};
      const userId = session.userId;
      const isGlobalOwner = session.isGlobalOwner || false;
      const isDev = userId === 7849224682;

      // Determinar tema
      let theme = session.theme || 'owner';
      if (isDev) theme = 'owner-dev';
      else if (isGlobalOwner) theme = 'owner';
      else if (session.tenantId) theme = 'client';

      // Si es cliente, traer branding fresco del DB
      let branding = session.branding || {};
      if (session.tenantId) {
        try {
          const subBot = await db.getSubBotById(session.tenantId);
          if (subBot) {
            branding = subBot.branding || subBot.custom_settings?.branding || {};
            branding.community_display_name = branding.community_display_name || subBot.community_name;
          }
        } catch {}
      }

      res.json({
        ok: true,
        session: {
          userId,
          role: session.role || 'STAFF',
          isGlobalOwner,
          isDev,
          tenantId: session.tenantId || null,
          communityName: session.communityName || 'Ventas Libres Perú',
          theme,
          branding,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Guardar Branding de un Sub-Bot (logo, nombre, color) ──
  app.post(`${apiPrefix}/branding/:tenantId?`, requireAdminAuth, async (req, res) => {
    try {
      const session = req.sessionUser || {};
      const targetTenantId = req.params.tenantId || req.body.tenantId || session.tenantId;

      if (!targetTenantId) {
        return res.status(400).json({ ok: false, error: 'ID de sub-bot (tenantId) no especificado.' });
      }

      const userId = session.userId;
      const isGlobalOwner = session.isGlobalOwner || false;
      const subBot = await db.getSubBotById(targetTenantId);
      if (!subBot) return res.status(404).json({ ok: false, error: 'Sub-bot no encontrado.' });

      const ownerIds = Array.isArray(subBot.owner_ids) ? subBot.owner_ids : [];
      if (!isGlobalOwner && !ownerIds.includes(userId)) {
        return res.status(403).json({ ok: false, error: 'No tienes permisos para editar este sub-bot.' });
      }

      const { logo_url, community_display_name, accent_color } = req.body;
      const existingBranding = subBot.branding || subBot.custom_settings?.branding || {};
      const newBranding = {
        ...existingBranding,
        logo_url: logo_url !== undefined ? logo_url : (existingBranding.logo_url || ''),
        community_display_name: community_display_name || existingBranding.community_display_name || subBot.community_name,
        accent_color: accent_color || existingBranding.accent_color || '#ffffff',
        theme: 'client',
      };

      const currentCustom = (typeof subBot.custom_settings === 'object' && subBot.custom_settings !== null) ? subBot.custom_settings : {};
      const updatedCustom = { ...currentCustom, branding: newBranding };

      await db.updateSubBot(targetTenantId, { custom_settings: updatedCustom });

      res.json({ ok: true, branding: newBranding });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
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

      const isDev = numId === 7849224682;
      const theme = isDev ? 'owner-dev' : 'owner';

      res.json({
        ok: true,
        user: {
          id: numId,
          name: profileName,
          username: profileUsername,
          avatarUrl,
          role: isOwnerHardcoded ? (isDev ? 'DEVELOPER SUPREMO' : 'OWNER SUPREMO') : staffMember.role,
          isGlobalOwner: isOwnerHardcoded,
          isDev,
          theme,
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

  // ══════════════════════════════════════════════════════
  // ⟡ NUEVOS ENDPOINTS: GESTIÓN DE GRUPOS & SEGURIDAD EN TIEMPO REAL
  // ══════════════════════════════════════════════════════

  const antiRaid = require('../modules/security/antiRaid');
  const antiFlood = require('../modules/security/antiFlood');
  const locksModule = require('../modules/security/locks');

  // ── 1. Listar Grupos en Vivo (con Miembros y Permisos de Admin) ──
  app.get(`${apiPrefix}/bot/groups`, requireAdminAuth, async (req, res) => {
    try {
      const { botId } = req.query;
      let token = config.BOT_TOKEN;

      // Si se pasa botId (es un sub-bot)
      if (botId && botId !== 'main') {
        const subBot = await db.getSubBotById(botId);
        if (subBot && subBot.bot_token) {
          token = subBot.bot_token;
        }
      }

      // Obtener info del bot actual
      const me = await telegramApiCall(token, 'getMe');

      // Consultar grupos registrados en base de datos
      const rawGroups = await db.getAllGroups();

      // Enriquecer cada grupo consultando Telegram API
      const enriched = await Promise.all(
        rawGroups.map(async (grp) => {
          let memberCount = null;
          let isAdm = false;
          let permissions = {};
          let realTitle = grp.title;

          try {
            const chat = await telegramApiCall(token, 'getChat', { chat_id: grp.chat_id });
            realTitle = chat.title || grp.title;

            try {
              memberCount = await telegramApiCall(token, 'getChatMemberCount', { chat_id: grp.chat_id });
            } catch {}

            try {
              const botMember = await telegramApiCall(token, 'getChatMember', { chat_id: grp.chat_id, user_id: me.id });
              isAdm = botMember.status === 'administrator' || botMember.status === 'creator';
              if (isAdm) {
                permissions = {
                  can_delete_messages: botMember.can_delete_messages !== false,
                  can_restrict_members: botMember.can_restrict_members !== false,
                  can_invite_users: botMember.can_invite_users !== false,
                  can_pin_messages: botMember.can_pin_messages !== false,
                };
              }
            } catch {}
          } catch (e) {
            // El bot probablemente ya no esté en ese chat
          }

          const isLockedDown = await antiRaid.isLockdownActive(grp.chat_id);

          return {
            chat_id: grp.chat_id,
            title: realTitle,
            type: grp.type || 'supergroup',
            username: grp.username,
            memberCount: memberCount || 'N/D',
            isBotAdmin: isAdm,
            permissions,
            isLockedDown,
          };
        })
      );

      res.json({
        ok: true,
        bot: { id: me.id, username: me.username, name: me.first_name },
        groups: enriched,
      });
    } catch (err) {
      console.error('⟡ Error obteniendo grupos:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── 2. Obtener Ajustes de Seguridad de un Grupo ──
  app.get(`${apiPrefix}/group-settings/:chatId`, requireAdminAuth, async (req, res) => {
    try {
      const chatId = Number(req.params.chatId);
      const raidConf = await antiRaid.getAntiRaidConfig(chatId);
      const floodConf = await antiFlood.getAntiFloodConfig(chatId);
      const locks = await locksModule.getGroupLocks(chatId);
      const isLockedDown = await antiRaid.isLockdownActive(chatId);

      // Verificación
      const isVerifyDisabled = (await db.getSetting(`verify_disabled_${chatId}`)) === 'true';

      res.json({
        ok: true,
        chatId,
        settings: {
          antiRaid: raidConf,
          antiFlood: floodConf,
          locks: locks,
          isLockedDown,
          verifyEnabled: !isVerifyDisabled,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── 3. Guardar Ajustes de Seguridad de un Grupo en Tiempo Real ──
  app.post(`${apiPrefix}/group-settings/:chatId`, requireAdminAuth, async (req, res) => {
    try {
      const chatId = Number(req.params.chatId);
      const { antiRaid: newRaid, antiFlood: newFlood, locks: newLocks, verifyEnabled } = req.body;

      if (newRaid) {
        await antiRaid.setAntiRaidConfig(chatId, newRaid);
      }
      if (newFlood) {
        await antiFlood.setAntiFloodConfig(chatId, newFlood);
      }
      if (newLocks) {
        await locksModule.setGroupLocks(chatId, newLocks);
      }
      if (verifyEnabled !== undefined) {
        await db.setSetting(`verify_disabled_${chatId}`, verifyEnabled ? 'false' : 'true');
      }

      res.json({ ok: true, message: 'Configuración actualizada y aplicada en vivo.' });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── 4. Botón de Emergencia: Disparar / Levantar Modo Pánico (Lockdown) ──
  app.post(`${apiPrefix}/group/:chatId/panic`, requireAdminAuth, async (req, res) => {
    try {
      const chatId = Number(req.params.chatId);
      const { action, botId } = req.body; // 'activate' | 'deactivate'

      let token = config.BOT_TOKEN;
      if (botId && botId !== 'main') {
        const subBot = await db.getSubBotById(botId);
        if (subBot?.bot_token) token = subBot.bot_token;
      }

      // Dummy api object compatible con telegramApiCall
      const apiWrapper = {
        setChatPermissions: (cId, perms) => telegramApiCall(token, 'setChatPermissions', { chat_id: cId, permissions: perms }),
        sendMessage: (cId, txt, opts = {}) => telegramApiCall(token, 'sendMessage', { chat_id: cId, text: txt, ...opts }),
      };

      if (action === 'activate') {
        await antiRaid.triggerLockdown(apiWrapper, chatId, 'Chat Grupal', 'Lockdown disparado desde el Dashboard Web');
        res.json({ ok: true, isLockedDown: true, message: 'Modo Pánico activado. Chat cerrado en 1 segundo.' });
      } else {
        await antiRaid.disableLockdown(apiWrapper, chatId);
        res.json({ ok: true, isLockedDown: false, message: 'Modo Pánico levantado. Permisos de chat normalizados.' });
      }
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── 5. Gestión Integral de Staff en Tiempo Real (Nekotina style) ──
  app.get(`${apiPrefix}/staff`, requireAdminAuth, async (req, res) => {
    try {
      const { tenantId } = req.query;
      const staffList = await db.getAllStaff(tenantId || null);
      
      // Enriquecer con info de dueños fijados si aplica
      const enriched = await Promise.all(
        staffList.map(async (st) => {
          let avatarUrl = null;
          try {
            const photos = await telegramApiCall(config.BOT_TOKEN, 'getUserProfilePhotos', { user_id: st.user_id, limit: 1 });
            if (photos.total_count > 0 && photos.photos[0]?.length > 0) {
              const fileId = photos.photos[0][0].file_id;
              const fileInfo = await telegramApiCall(config.BOT_TOKEN, 'getFile', { file_id: fileId });
              if (fileInfo.file_path) {
                avatarUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${fileInfo.file_path}`;
              }
            }
          } catch {}
          return {
            ...st,
            avatarUrl,
          };
        })
      );

      res.json({ ok: true, staff: enriched, owners: config.OWNER_IDS });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Asignar o actualizar rol de Staff
  app.post(`${apiPrefix}/staff`, requireAdminAuth, async (req, res) => {
    try {
      const { userId, role, customTitle, tenantId, promoteInGroups } = req.body;
      if (!userId || !role) {
        return res.status(400).json({ ok: false, error: 'userId y role son requeridos.' });
      }

      const numId = Number(userId);
      let username = null;
      let firstName = 'Staff Member';

      // Obtener datos del usuario desde Telegram
      try {
        const chatInfo = await telegramApiCall(config.BOT_TOKEN, 'getChat', { chat_id: numId });
        username = chatInfo.username || null;
        firstName = chatInfo.first_name ? `${chatInfo.first_name} ${chatInfo.last_name || ''}`.trim() : 'Staff';
      } catch {}

      const assignedBy = req.sessionUser?.userId || 7849224682;
      const result = await db.setStaffRole(
        numId,
        username,
        firstName,
        role,
        assignedBy,
        customTitle || null,
        tenantId || null
      );

      // Si se solicita promover en todos los grupos donde el bot es admin
      if (promoteInGroups) {
        try {
          const groups = await db.getAllGroups();
          for (const grp of groups) {
            try {
              await telegramApiCall(config.BOT_TOKEN, 'promoteChatMember', {
                chat_id: grp.chat_id,
                user_id: numId,
                can_manage_chat: true,
                can_delete_messages: true,
                can_restrict_members: true,
                can_invite_users: true,
                can_pin_messages: true,
                can_manage_topics: true,
              });
              if (customTitle) {
                await telegramApiCall(config.BOT_TOKEN, 'setChatAdministratorCustomTitle', {
                  chat_id: grp.chat_id,
                  user_id: numId,
                  custom_title: customTitle.slice(0, 16),
                });
              }
            } catch {}
          }
        } catch (e) {
          console.warn('⟡ Error promoviendo staff en grupos:', e.message);
        }
      }

      res.json({ ok: true, message: `Rol [${role}] asignado correctamente a ${firstName}.`, staff: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Remover staff
  app.delete(`${apiPrefix}/staff/:userId`, requireAdminAuth, async (req, res) => {
    try {
      const numId = Number(req.params.userId);
      const { tenantId, demoteInGroups } = req.body || {};

      await db.removeStaff(numId, tenantId || null);

      if (demoteInGroups) {
        try {
          const groups = await db.getAllGroups();
          for (const grp of groups) {
            try {
              await telegramApiCall(config.BOT_TOKEN, 'promoteChatMember', {
                chat_id: grp.chat_id,
                user_id: numId,
                can_manage_chat: false,
                can_delete_messages: false,
                can_restrict_members: false,
                can_invite_users: false,
                can_pin_messages: false,
              });
            } catch {}
          }
        } catch {}
      }

      res.json({ ok: true, message: `Usuario ${numId} removido del Staff.` });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── 6. Canales de Verificación Obligatoria ──
  app.get(`${apiPrefix}/config/verification-channels`, requireAdminAuth, async (req, res) => {
    try {
      let channels = [];
      const saved = await db.getSetting('channels_to_verify');
      if (saved) {
        try { channels = JSON.parse(saved); } catch {}
      }
      if (!channels.length) {
        channels = config.CHANNELS_TO_VERIFY || [];
      }

      // Probar estado de cada canal en Telegram
      const enrichedChannels = await Promise.all(
        channels.map(async (ch) => {
          let title = ch;
          let isValid = false;
          let memberCount = null;
          let isBotAdmin = false;

          try {
            if (ch.startsWith('@') || /^-?\d+$/.test(ch)) {
              const chat = await telegramApiCall(config.BOT_TOKEN, 'getChat', { chat_id: ch });
              title = chat.title || ch;
              isValid = true;
              try { memberCount = await telegramApiCall(config.BOT_TOKEN, 'getChatMemberCount', { chat_id: ch }); } catch {}
              try {
                const me = await telegramApiCall(config.BOT_TOKEN, 'getMe');
                const botM = await telegramApiCall(config.BOT_TOKEN, 'getChatMember', { chat_id: ch, user_id: me.id });
                isBotAdmin = botM.status === 'administrator' || botM.status === 'creator';
              } catch {}
            } else {
              isValid = true;
            }
          } catch (e) {
            isValid = false;
          }

          return {
            target: ch,
            title,
            isValid,
            memberCount,
            isBotAdmin,
          };
        })
      );

      res.json({ ok: true, channels: enrichedChannels });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post(`${apiPrefix}/config/verification-channels`, requireAdminAuth, async (req, res) => {
    try {
      const { channels } = req.body;
      if (!Array.isArray(channels)) {
        return res.status(400).json({ ok: false, error: 'Formato de canales inválido.' });
      }

      await db.setSetting('channels_to_verify', JSON.stringify(channels));
      config.CHANNELS_TO_VERIFY = channels;

      res.json({ ok: true, message: 'Canales de verificación actualizados correctamente.', channels });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── 7. Ajustes Maestros de la Comunidad (/set_grupo_tratos, /set_logs, /set_burn_channel, etc) ──
  app.get(`${apiPrefix}/config/community`, requireAdminAuth, async (req, res) => {
    try {
      const escrowGroupId = (await db.getSetting('escrow_group_id')) || config.ESCROW_GROUP_ID;
      const staffChatId = (await db.getSetting('staff_chat_id')) || config.STAFF_CHAT_ID;
      const staffThreadId = (await db.getSetting('staff_thread_id')) || config.STAFF_THREAD_ID;
      const logChannelId = (await db.getSetting('log_channel_id')) || config.LOG_CHANNEL_ID;
      const logThreadId = (await db.getSetting('log_thread_id')) || config.LOG_THREAD_ID;
      const publicBurnChannelId = (await db.getSetting('public_burn_channel_id')) || config.PUBLIC_BURN_CHANNEL_ID;
      const publicBurnThreadId = (await db.getSetting('public_burn_thread_id')) || config.PUBLIC_BURN_THREAD_ID;
      const groupsFolderLink = (await db.getSetting('groups_folder_link')) || config.GROUPS_FOLDER_LINK;

      res.json({
        ok: true,
        settings: {
          escrow_group_id: escrowGroupId,
          staff_chat_id: staffChatId,
          staff_thread_id: staffThreadId,
          log_channel_id: logChannelId,
          log_thread_id: logThreadId,
          public_burn_channel_id: publicBurnChannelId,
          public_burn_thread_id: publicBurnThreadId,
          groups_folder_link: groupsFolderLink,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post(`${apiPrefix}/config/community`, requireAdminAuth, async (req, res) => {
    try {
      const {
        escrow_group_id,
        staff_chat_id,
        staff_thread_id,
        log_channel_id,
        log_thread_id,
        public_burn_channel_id,
        public_burn_thread_id,
        groups_folder_link,
      } = req.body;

      if (escrow_group_id !== undefined) {
        await db.setSetting('escrow_group_id', String(escrow_group_id));
        config.ESCROW_GROUP_ID = Number(escrow_group_id);
      }
      if (staff_chat_id !== undefined) {
        await db.setSetting('staff_chat_id', String(staff_chat_id));
        config.STAFF_CHAT_ID = Number(staff_chat_id);
      }
      if (staff_thread_id !== undefined) {
        await db.setSetting('staff_thread_id', String(staff_thread_id));
        config.STAFF_THREAD_ID = Number(staff_thread_id);
      }
      if (log_channel_id !== undefined) {
        await db.setSetting('log_channel_id', String(log_channel_id));
        config.LOG_CHANNEL_ID = Number(log_channel_id);
      }
      if (log_thread_id !== undefined) {
        await db.setSetting('log_thread_id', String(log_thread_id));
        config.LOG_THREAD_ID = Number(log_thread_id);
      }
      if (public_burn_channel_id !== undefined) {
        await db.setSetting('public_burn_channel_id', String(public_burn_channel_id));
        config.PUBLIC_BURN_CHANNEL_ID = Number(public_burn_channel_id);
      }
      if (public_burn_thread_id !== undefined) {
        await db.setSetting('public_burn_thread_id', String(public_burn_thread_id));
        config.PUBLIC_BURN_THREAD_ID = Number(public_burn_thread_id);
      }
      if (groups_folder_link !== undefined) {
        await db.setSetting('groups_folder_link', String(groups_folder_link));
        config.GROUPS_FOLDER_LINK = String(groups_folder_link);
      }

      res.json({ ok: true, message: 'Ajustes maestros de canales y grupos actualizados con éxito.' });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return app;
}

module.exports = { createWebApp };
