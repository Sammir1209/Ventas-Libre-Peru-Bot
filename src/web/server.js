// ══════
// ⟡ Servidor Web Modular & API REST Enterprise — Ventas Libres Perú
// ══════

const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../database/postgres');
const config = require('../config/env');
const { securityFirewall } = require('./middlewares/firewall');
const { requireAdminAuth } = require('./middlewares/auth');
const apiRoutes = require('./routes');
const { telegramApiCall } = require('./services/telegramSyncService');

function createWebApp(mainBot = null) {
  const app = express();

  // Guardar instancia de bot para llamadas de expulsión / broadcasting
  if (mainBot) {
    app.set('mainBot', mainBot);
  }

  // ── Middlewares Globales ──
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(securityFirewall);

  const dashboardPath = config.DASHBOARD_PATH || '/vlp-master-portal-7849';
  const apiPrefix = config.API_SECRET_PREFIX || '/api-sec-vlp';

  // Servir estáticos Next.js (dashboard/out) o fallback público
  const nextOutDir = path.join(__dirname, '..', '..', 'dashboard', 'out');
  const publicDir = path.join(__dirname, 'public');
  const staticRoot = fs.existsSync(nextOutDir) ? nextOutDir : publicDir;

  // ── 1. Ruta Pública Raíz: Landing Page para navegadores / JSON para monitores ──
  app.get('/', (req, res, next) => {
    if (req.accepts('html')) {
      const indexPath = path.join(staticRoot, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }
    res.json({
      status: 'ok',
      bot: 'Ventas Libres Perú Enterprise',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // ── 2. Health Check Endpoint (Render & Uptime Ping) ──
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      bot: 'Ventas Libres Perú Platform',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // ── 3. Mini-Web Pública de Verificación Responsive ──
  app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

  app.get(['/verificar', '/verify', '/canales'], (req, res) => {
    const verifyFile = path.join(__dirname, 'public', 'verify.html');
    if (fs.existsSync(verifyFile)) {
      res.sendFile(verifyFile);
    } else {
      res.status(404).send('Portal de verificación no disponible');
    }
  });

  // ── 3.1 Portal de Sub-Bots Next.js (Público de Canales y Admin B&W) ──
  app.get(['/portal', '/portal/*', '/c/:slug'], (req, res) => {
    const portalHtml = path.join(staticRoot, 'portal', 'index.html');
    const portalDirectHtml = path.join(staticRoot, 'portal.html');
    const indexHtml = path.join(staticRoot, 'index.html');

    if (fs.existsSync(portalHtml)) {
      return res.sendFile(portalHtml);
    }
    if (fs.existsSync(portalDirectHtml)) {
      return res.sendFile(portalDirectHtml);
    }
    if (fs.existsSync(indexHtml)) {
      return res.sendFile(indexHtml);
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // ── 4. Montar la Nueva API REST Modular ──
  app.use('/api', apiRoutes);
  app.use(apiPrefix, apiRoutes); // Alias para compatibilidad con scripts existentes

  // ── 5. Endpoints Especiales de Autenticación y Branding ──

  app.get(`${apiPrefix}/config`, (req, res) => {
    res.json({
      ok: true,
      apiPrefix,
    });
  });

  app.get(`${apiPrefix}/session-info`, requireAdminAuth, async (req, res) => {
    try {
      const session = req.sessionUser || {};
      const userId = session.userId;
      const isGlobalOwner = session.isGlobalOwner || false;
      const isDev = userId === 7849224682;

      let theme = session.theme || 'owner';
      if (isDev) theme = 'owner-dev';
      else if (isGlobalOwner) theme = 'owner';
      else if (session.tenantId) theme = 'client';

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

  // Login de Owner con ID de Telegram + Master Key
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

      const isOwnerHardcoded = config.OWNER_IDS.includes(numId) || numId === 7794982496 || numId === 7849224682;
      const staffMember = await db.getStaffMember(numId);
      const isStaffOwner = staffMember && (staffMember.role.includes('OWNER') || staffMember.role.includes('CO-OWNER'));

      if (!isOwnerHardcoded && !isStaffOwner) {
        return res.status(403).json({
          ok: false,
          error: 'El ID proporcionado no tiene rango de Owner o Co-Owner autorizado.',
        });
      }

      let profileName = staffMember?.first_name || 'Owner Oficial';
      let profileUsername = staffMember?.username || '';
      let avatarUrl = null;

      try {
        const chatInfo = await telegramApiCall(config.BOT_TOKEN, 'getChat', { chat_id: numId });
        if (chatInfo) {
          profileName = chatInfo.first_name || profileName;
          profileUsername = chatInfo.username || profileUsername;
        }

        const photos = await telegramApiCall(config.BOT_TOKEN, 'getUserProfilePhotos', { user_id: numId, limit: 1 });
        if (photos && photos.total_count > 0 && photos.photos[0] && photos.photos[0].length > 0) {
          const fileId = photos.photos[0][0].file_id;
          const fileInfo = await telegramApiCall(config.BOT_TOKEN, 'getFile', { file_id: fileId });
          if (fileInfo && fileInfo.file_path) {
            avatarUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${fileInfo.file_path}`;
          }
        }
      } catch {}

      const panelHandler = require('../modules/security/panelHandler');
      const token = await panelHandler.generatePanelToken(numId, 'OWNER SUPREMO', true);

      res.json({
        ok: true,
        token,
        user: {
          id: numId,
          first_name: profileName,
          username: profileUsername,
          role: 'OWNER SUPREMO',
          isGlobalOwner: true,
          avatarUrl,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── 6. Servir Frontend: Next.js Export (dashboard/out) o Public Clásico ──
  // Servir estáticos en ruta secreta y en raíz
  app.use(dashboardPath, express.static(staticRoot));
  app.use(express.static(staticRoot));

  // Servir SPA index.html en cualquier subruta del portal administrativo
  app.use(dashboardPath, (req, res) => {
    const indexPath = path.join(staticRoot, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

module.exports = {
  createWebApp,
};
