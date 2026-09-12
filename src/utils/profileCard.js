const { createCanvas, loadImage, GlobalFonts, Path2D } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════
// ⟡ Carga y Registro de Fuentes Tipográficas
// ══════════════════════════════════════════════════════

const FONTS_DIR = path.join(__dirname, '../assets/fonts');

function loadBundledFonts() {
  const fontDefinitions = [
    { file: 'segoeui.ttf', family: 'Segoe UI' },
    { file: 'segoeuib.ttf', family: 'Segoe UI Bold' },
    { file: 'seguiemj.ttf', family: 'Segoe UI Emoji' },
    { file: 'seguisym.ttf', family: 'Segoe UI Symbol' },
    { file: 'arial.ttf', family: 'Arial' },
    { file: 'arialbd.ttf', family: 'Arial Bold' },
  ];

  for (const item of fontDefinitions) {
    const fullPath = path.join(FONTS_DIR, item.file);
    if (fs.existsSync(fullPath)) {
      try {
        GlobalFonts.registerFromPath(fullPath, item.family);
      } catch {}
    }
  }

  // Soporte de respaldo si está en Windows
  try {
    if (fs.existsSync('C:/Windows/Fonts/seguiemj.ttf')) {
      GlobalFonts.registerFromPath('C:/Windows/Fonts/seguiemj.ttf', 'Segoe UI Emoji');
    }
    if (fs.existsSync('C:/Windows/Fonts/segoeui.ttf')) {
      GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeui.ttf', 'Segoe UI');
    }
    if (fs.existsSync('C:/Windows/Fonts/segoeuib.ttf')) {
      GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeuib.ttf', 'Segoe UI Bold');
    }
  } catch {}
}

loadBundledFonts();

const FONT_STACK = '"Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", Arial, sans-serif';

/**
 * Trunca texto manteniendo caracteres legibles y emojis
 */
function truncateText(str, maxChars = 28) {
  if (!str) return '';
  const arr = Array.from(str.normalize('NFKD'));
  if (arr.length <= maxChars) return arr.join('');
  return arr.slice(0, maxChars).join('') + '...';
}

/**
 * Dibuja la insignia oficial vectorial de Verificado de Telegram
 * (Estrella de 8 puntas azul redondeada con check blanco)
 */
function drawTelegramVerifiedBadge(ctx, x, y, size = 26) {
  ctx.save();
  ctx.translate(x, y);

  // Escalar para ajustar a size (original del path: 26x26)
  const scaleFactor = size / 26;
  ctx.scale(scaleFactor, scaleFactor);

  // Fondo blanco del check interior
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(6, 6, 14, 14);

  // Estrella dentada azul de Telegram
  ctx.fillStyle = '#248bcf';
  const starPath = new Path2D(
    'M14.38 1.51L16.2 3.33C16.57 3.7 17.06 3.9 17.58 3.9H20.15C21.16 3.9 22 4.67 22.09 5.66L22.1 5.85V8.42C22.1 8.94 22.31 9.43 22.67 9.8L24.49 11.62C25.2 12.33 25.25 13.46 24.62 14.23L24.49 14.38L22.67 16.2C22.3 16.57 22.1 17.06 22.1 17.58V20.15C22.1 21.16 21.33 22 20.34 22.09L20.15 22.1H17.58C17.06 22.1 16.57 22.31 16.2 22.67L14.38 24.49C13.67 25.2 12.54 25.25 11.77 24.62L11.62 24.49L9.8 22.67C9.43 22.3 8.94 22.1 8.42 22.1H5.85C4.84 22.1 4 21.33 3.91 20.34L3.9 20.15V17.58C3.9 17.06 3.69 16.57 3.33 16.2L1.51 14.38C0.8 13.67 0.75 12.54 1.38 11.77L1.51 11.62L3.33 9.8C3.7 9.43 3.9 8.94 3.9 8.42V5.85C3.9 4.77 4.77 3.9 5.85 3.9H8.42C8.94 3.9 9.43 3.69 9.8 3.33L11.62 1.51C12.38 0.75 13.62 0.75 14.38 1.51Z'
  );
  ctx.fill(starPath);

  // Check blanco en el centro
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#ffffff';
  ctx.moveTo(8, 13.2);
  ctx.lineTo(11.4, 16.8);
  ctx.lineTo(18.5, 9.5);
  ctx.stroke();

  ctx.restore();
}

/**
 * Dibuja un badge / píldora con fondo y borde estilizado
 */
function drawPillBadge(ctx, x, y, text, options = {}) {
  const {
    bg = 'rgba(36, 139, 207, 0.15)',
    border = 'rgba(36, 139, 207, 0.4)',
    color = '#40a7e3',
    icon = '',
    fontSize = 13,
  } = options;

  ctx.save();
  ctx.font = `bold ${fontSize}px ${FONT_STACK}`;
  const fullText = icon ? `${icon}  ${text}` : text;
  const textMetrics = ctx.measureText(fullText);
  const padX = 14;
  const h = fontSize + 14;
  const w = textMetrics.width + padX * 2;
  const r = h / 2;

  // Fondo
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = bg;
  ctx.fill();

  // Borde
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Texto
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(fullText, x + padX, y + h / 2);

  ctx.restore();
  return w;
}

/**
 * Genera la Tarjeta de Perfil en Alta Definición (Ultra HD 2x Retina)
 * Basada en el diseño moderno y limpio de telegram-card (Malith-Rukshan).
 *
 * @param {Object} data
 * @param {string} data.name - Nombre del usuario
 * @param {string} [data.username] - @username de Telegram
 * @param {number|string} data.id - ID numérico de Telegram
 * @param {Buffer} [data.avatarBuffer] - Buffer de la foto de perfil en HD
 * @param {boolean} [data.isVerified] - Si tiene verificado oficial
 * @param {string} [data.role] - Rol en el staff (OWNER, ADMIN, TRATO ADMIN, etc.)
 * @param {string} [data.customTitle] - Título en grupos
 * @param {number} [data.dealsCount] - Cantidad de tratos completados
 * @param {string|number} [data.rating] - Calificación de mediador (ej. "5.0")
 * @param {number} [data.totalRatings] - Número de reseñas
 * @param {boolean} [data.isBurned] - Si es un usuario quemado / scammer
 * @param {string} [data.burnReason] - Motivo de la quema
 * @param {string} [data.burnedDate] - Fecha de sanción
 * @returns {Promise<Buffer>} Buffer PNG listo para enviar a Telegram
 */
async function generateProfileCard({
  name = 'Usuario',
  username = null,
  id = '',
  avatarBuffer = null,
  isVerified = false,
  role = null,
  customTitle = null,
  dealsCount = 0,
  rating = '5.0',
  totalRatings = 0,
  isBurned = false,
  burnReason = null,
  burnedDate = null,
}) {
  const scale = 2; // Retina 2x para máxima nitidez en Telegram Desktop y Móvil
  const baseW = 700;
  const baseH = 260;

  const width = baseW * scale;
  const height = baseH * scale;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // ── Paleta de Colores Dinámica según Estado ──
  let cardBg = '#141b26';
  let cornerGlowColor = 'rgba(0, 136, 204, 0.14)';
  let accentColor = '#3daaf2';
  let avatarRingColor = 'rgba(64, 167, 227, 0.5)';

  if (isBurned) {
    cardBg = '#190e12';
    cornerGlowColor = 'rgba(239, 68, 68, 0.22)';
    accentColor = '#ff4d4d';
    avatarRingColor = 'rgba(239, 68, 68, 0.7)';
  } else if (role && (role.includes('OWNER') || role.includes('CO-OWNER'))) {
    cornerGlowColor = 'rgba(245, 158, 11, 0.2)';
    accentColor = '#fbbf24';
    avatarRingColor = 'rgba(245, 158, 11, 0.6)';
  } else if (role && (role.includes('ADMIN') || role.includes('TRATO'))) {
    cornerGlowColor = 'rgba(16, 185, 129, 0.18)';
    accentColor = '#34d399';
    avatarRingColor = 'rgba(16, 185, 129, 0.6)';
  }

  // 1. Fondo Principal de la Tarjeta con Esquinas Redondeadas
  const cardRadius = 24;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(14, 14, baseW - 28, baseH - 28, cardRadius);
  ctx.fillStyle = cardBg;
  ctx.fill();

  // Borde sutil exterior estilo cristal
  ctx.strokeStyle = isBurned ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.clip(); // Limitar efectos internos a la tarjeta redondeada

  // 2. Gradientes Radiales de Iluminación y Profundidad (telegram-card aesthetic)
  // Gradiente esquina inferior derecha
  const cornerGrad = ctx.createRadialGradient(baseW, baseH, 10, baseW, baseH, 240);
  cornerGrad.addColorStop(0, cornerGlowColor);
  cornerGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = cornerGrad;
  ctx.fillRect(baseW - 260, baseH - 260, 260, 260);

  // Resplandor superior suave
  const topGlow = ctx.createLinearGradient(0, 0, baseW, 0);
  topGlow.addColorStop(0, isBurned ? 'rgba(239, 68, 68, 0.05)' : 'rgba(36, 139, 207, 0.06)');
  topGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, baseW, 90);

  ctx.restore(); // Termina clip de la tarjeta

  // 3. Avatar Circular a la Izquierda con Halo
  const avX = 98;
  const avY = baseH / 2;
  const avR = 56;

  // Anillo de brillo exterior del avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR + 4, 0, Math.PI * 2);
  ctx.strokeStyle = avatarRingColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Imagen del Avatar o Predeterminado
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  let avatarDrawn = false;
  if (avatarBuffer) {
    try {
      const img = await loadImage(avatarBuffer);
      ctx.drawImage(img, avX - avR, avY - avR, avR * 2, avR * 2);
      avatarDrawn = true;
    } catch {}
  }

  if (!avatarDrawn) {
    // Avatar con gradiente suave y primera letra
    const gradAv = ctx.createLinearGradient(avX - avR, avY - avR, avX + avR, avY + avR);
    if (isBurned) {
      gradAv.addColorStop(0, '#7f1d1d');
      gradAv.addColorStop(1, '#b91c1c');
    } else {
      gradAv.addColorStop(0, '#1e3a8a');
      gradAv.addColorStop(1, '#2563eb');
    }
    ctx.fillStyle = gradAv;
    ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 42px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const letter = Array.from(name || '?')[0].toUpperCase();
    ctx.fillText(letter, avX, avY + 2);
  }
  ctx.restore();

  // 4. Bloque de Contenido y Datos (A la derecha del avatar)
  const contentX = 186;
  let curY = 62;

  // Fila 1: Nombre + Insignia Verificado (o Sello de Quemado)
  const cleanName = truncateText(name || 'Usuario', 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 24px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(cleanName, contentX, curY);

  const nameWidth = ctx.measureText(cleanName).width;

  if (isBurned) {
    // Sello o alerta de estafador junto al nombre
    drawPillBadge(ctx, contentX + nameWidth + 14, curY - 14, 'LISTA NEGRA', {
      bg: 'rgba(239, 68, 68, 0.2)',
      border: 'rgba(239, 68, 68, 0.6)',
      color: '#ff4d4d',
      icon: '🚨',
      fontSize: 11,
    });
  } else if (isVerified || (role && role.includes('OWNER'))) {
    // Insignia oficial de verificado de Telegram
    drawTelegramVerifiedBadge(ctx, contentX + nameWidth + 10, curY - 13, 24);
  }

  // Fila 2: @username + ID
  curY += 32;
  const tagText = username ? `@${username}` : 'Sin @username público';
  ctx.fillStyle = '#94a3b8';
  ctx.font = `15px ${FONT_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(tagText, contentX, curY);

  const tagWidth = ctx.measureText(tagText).width;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillText('•', contentX + tagWidth + 12, curY);

  ctx.fillStyle = '#64748b';
  ctx.font = `14px ${FONT_STACK}`;
  ctx.fillText(`ID: ${id || 'N/A'}`, contentX + tagWidth + 26, curY);

  // Fila 3: Badges / Píldoras Informativas Estilizadas
  curY += 38;

  if (isBurned) {
    // Alerta de Quemado con motivo y fecha
    const reasonText = truncateText(burnReason || 'Estafa comprobada / Falta grave', 42);
    drawPillBadge(ctx, contentX, curY - 12, reasonText, {
      bg: 'rgba(239, 68, 68, 0.15)',
      border: 'rgba(239, 68, 68, 0.4)',
      color: '#fca5a5',
      icon: '⚠️',
      fontSize: 12,
    });

    curY += 34;
    ctx.fillStyle = '#ef4444';
    ctx.font = `bold 12.5px ${FONT_STACK}`;
    const dateText = burnedDate ? `Sancionado el: ${burnedDate}` : 'Baneado permanentemente de la red oficial';
    ctx.fillText(`⛔  ${dateText}`, contentX, curY);

  } else {
    // Usuario o Miembro del Staff
    let nextX = contentX;

    if (role) {
      // Badge de Rol
      let roleIcon = '🛡️';
      let roleBg = 'rgba(16, 185, 129, 0.15)';
      let roleBorder = 'rgba(16, 185, 129, 0.4)';
      let roleColor = '#34d399';

      if (role.includes('OWNER')) {
        roleIcon = '👑';
        roleBg = 'rgba(245, 158, 11, 0.15)';
        roleBorder = 'rgba(245, 158, 11, 0.4)';
        roleColor = '#fbbf24';
      } else if (role.includes('TRATO')) {
        roleIcon = '🤝';
        roleBg = 'rgba(59, 130, 246, 0.15)';
        roleBorder = 'rgba(59, 130, 246, 0.4)';
        roleColor = '#60a5fa';
      }

      const badgeWidth = drawPillBadge(ctx, nextX, curY - 12, role, {
        bg: roleBg,
        border: roleBorder,
        color: roleColor,
        icon: roleIcon,
        fontSize: 12,
      });
      nextX += badgeWidth + 10;
    } else {
      // Badge de Usuario Comunitario
      const userStatus = isVerified ? 'Verificado Oficial' : 'Usuario Comunitario';
      const badgeWidth = drawPillBadge(ctx, nextX, curY - 12, userStatus, {
        bg: isVerified ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)',
        border: isVerified ? 'rgba(34, 197, 94, 0.4)' : 'rgba(148, 163, 184, 0.3)',
        color: isVerified ? '#4ade80' : '#cbd5e1',
        icon: isVerified ? '🟢' : '👤',
        fontSize: 12,
      });
      nextX += badgeWidth + 10;
    }

    // Badge de Tratos o Reputación
    if (role && (role.includes('TRATO') || role.includes('ADMIN'))) {
      drawPillBadge(ctx, nextX, curY - 12, `⭐ ${rating} (${totalRatings} reviews • ${dealsCount} tratos)`, {
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.3)',
        color: '#fcd34d',
        fontSize: 12,
      });
    } else {
      drawPillBadge(ctx, nextX, curY - 12, `${dealsCount} tratos completados`, {
        bg: 'rgba(36, 139, 207, 0.12)',
        border: 'rgba(36, 139, 207, 0.3)',
        color: '#38bdf8',
        icon: '📦',
        fontSize: 12,
      });
    }

    // Fila 4: Pie de Seguridad / Comunidad
    curY += 34;
    ctx.fillStyle = '#64748b';
    ctx.font = `12px ${FONT_STACK}`;
    const subText = customTitle
      ? `🏷️ Tag Oficial: ${customTitle}  •  Ventas Libres Perú`
      : '🛡️ Identidad y Reputación Protegida  •  Ventas Libres Perú';
    ctx.fillText(subText, contentX, curY);
  }

  // 5. Marca de Agua Sutil Oficial en Esquina Inferior Derecha
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.font = `bold 10px ${FONT_STACK}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('VENTAS LIBRES PERÚ ©', baseW - 32, baseH - 24);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateProfileCard,
  drawTelegramVerifiedBadge,
};
