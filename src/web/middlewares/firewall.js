// ══════
// ⟡ Web Middleware: Firewall & Cabeceras de Seguridad OWASP
// ══════

const ipRecords = new Map();
const blockedIps = new Map(); // IP -> timestamp expira

function securityFirewall(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.connection?.remoteAddress || 'unknown';
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

  // 3. Rate limiting por IP (ventana deslizante de 60s)
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

  // 4. Inyección de Cabeceras de Seguridad Extremas
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

module.exports = {
  securityFirewall,
};
