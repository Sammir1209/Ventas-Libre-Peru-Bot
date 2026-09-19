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
const { isGlobalOwner, DEFAULT_COMMUNITY_NAME } = require('../utils/tenantContext');

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

  // ── 0. Servir estáticos de Next.js (_next) prioritariamente con headers de inmutabilidad ──
  const nextStaticDir = path.join(staticRoot, '_next');
  if (fs.existsSync(nextStaticDir)) {
    app.use('/_next', express.static(nextStaticDir, {
      maxAge: '30d',
      immutable: true,
      fallthrough: true,
    }));
  }

  // Prevenir que requests a archivos de _next inexistentes caigan en catch-alls y devuelvan text/html
  app.use('/_next', (req, res) => {
    if (req.path.endsWith('.css')) {
      return res.status(404).type('text/css').send('/* Stylesheet chunk updated */');
    }
    if (req.path.endsWith('.js')) {
      return res.status(404).type('application/javascript').send('/* JS chunk updated */');
    }
    res.status(404).type('text/plain').send('Asset not found');
  });

  // Función auxiliar para enviar HTML con no-cache (evita que el navegador cachee bundles viejos)
  const sendFreshHtml = (res, filePath) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(filePath);
  };

  // ── 1. Ruta Pública Raíz: Landing Page para navegadores / JSON para monitores ──
  app.get('/', (req, res, next) => {
    if (req.accepts('html')) {
      const indexPath = path.join(staticRoot, 'index.html');
      if (fs.existsSync(indexPath)) {
        return sendFreshHtml(res, indexPath);
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
    // Redirigir a la nueva versión en Next.js
    res.redirect(302, '/portal/default');
  });

  // ── 4. Montar la Nueva API REST Modular ──
  app.use('/api', apiRoutes);
  app.use(apiPrefix, apiRoutes); // Alias para compatibilidad con scripts existentes

  // ── 4.1 Portal de Sub-Bots Next.js (Público de Canales y Admin B&W) ──
  app.use(['/portal', '/c'], (req, res) => {
    const portalHtml = path.join(staticRoot, 'portal', 'index.html');
    const portalDirectHtml = path.join(staticRoot, 'portal.html');
    const indexHtml = path.join(staticRoot, 'index.html');

    if (fs.existsSync(portalHtml)) {
      return sendFreshHtml(res, portalHtml);
    }
    if (fs.existsSync(portalDirectHtml)) {
      return sendFreshHtml(res, portalDirectHtml);
    }
    if (fs.existsSync(indexHtml)) {
      return sendFreshHtml(res, indexHtml);
    }
    sendFreshHtml(res, path.join(publicDir, 'index.html'));
  });

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
      const isGlobalOwnerFlag = session.isGlobalOwner || false;

      let theme = session.theme || 'owner';
      if (isGlobalOwnerFlag) theme = 'owner';
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
          isGlobalOwner: isGlobalOwnerFlag,
          tenantId: session.tenantId || null,
          communityName: session.communityName || DEFAULT_COMMUNITY_NAME,
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

      const isOwnerAuthed = isGlobalOwner(numId);
      const staffMember = await db.getStaffMember(numId);
      const isStaffOwner = staffMember && (staffMember.role.includes('OWNER') || staffMember.role.includes('CO-OWNER'));

      if (!isOwnerAuthed && !isStaffOwner) {
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
