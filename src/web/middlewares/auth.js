// ══════
// ⟡ Web Middleware: Autenticación Dual (Master Key & Telegram /panel)
// ══════

const config = require('../../config/env');
const panelHandler = require('../../modules/security/panelHandler');

const requireAdminAuth = async (req, res, next) => {
  const key = req.headers['x-admin-key'] || req.query.key || req.body?.admin_key;
  const authToken = req.headers['x-auth-token'] || req.query.auth_token || req.body?.auth_token;
  const expectedKey = config.ADMIN_KEY || 'vlp_master_key_99x_2026_sec';

  // 1. Clave Maestra de Administrador
  if (key && key === expectedKey) {
    req.authType = 'master_key';
    return next();
  }

  // 2. Token de Sesión Temporal de Telegram (/panel)
  if (authToken) {
    try {
      const session = await panelHandler.validatePanelSession(authToken);
      if (session && session.userId) {
        req.sessionUser = session;
        req.authType = 'panel_session';
        return next();
      }
    } catch (err) {
      console.warn('⟡ Error validando sesión de panel:', err.message);
    }
  }

  return res.status(401).json({
    ok: false,
    error: 'Acceso no autorizado. Inicia sesión con /panel en Telegram o proporciona tu clave de administración.',
  });
};

module.exports = {
  requireAdminAuth,
};
