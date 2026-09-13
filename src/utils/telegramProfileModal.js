const { createCanvas, loadImage, GlobalFonts, Path2D } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════
// ⟡ Carga y Registro Universal de Fuentes
// ══════════════════════════════════════════════════════

const FONTS_DIR = path.join(__dirname, '../assets/fonts');

function loadBundledFonts() {
  const fontDefinitions = [
    { file: 'segoeui.ttf', family: 'Segoe UI' },
    { file: 'segoeuib.ttf', family: 'Segoe UI Bold' },
    { file: 'seguiemj.ttf', family: 'Segoe UI Emoji' },
    { file: 'seguisym.ttf', family: 'Segoe UI Symbol' },
    { file: 'seguihis.ttf', family: 'Segoe UI Historic' },
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

  try {
    if (fs.existsSync('C:/Windows/Fonts/seguihis.ttf')) {
      GlobalFonts.registerFromPath('C:/Windows/Fonts/seguihis.ttf', 'Segoe UI Historic');
    }
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

const FONT_STACK = '"Segoe UI Historic", "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", Arial, sans-serif';

/**
 * Trunca texto y limpia caracteres o glifos no soportados para que siempre se visualice nítido
 */
function cleanText(str, max = 36) {
  if (!str) return '';
  let s = str
    .replace(/[\u{13288}\u{3010}\u{300E}\u{300C}\u{FF3B}\u{27E6}\u{27EA}\u{3016}]/gu, '[')
    .replace(/[\u{13289}\u{3011}\u{300F}\u{300D}\u{FF3D}\u{27E7}\u{27EB}\u{3017}]/gu, ']')
    .replace(/[\u{25A0}-\u{25A9}\u{25FD}\u{25FE}]/gu, '');
  
  const arr = Array.from(s.normalize('NFKD'));
  if (arr.length <= max) return arr.join('');
  return arr.slice(0, max).join('') + '...';
}

/**
 * Dibuja un rectángulo con esquinas redondeadas
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Flecha volver nativa de Telegram Mobile
 */
function drawBackArrow(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 14, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x + 6, y - 6);
  ctx.moveTo(x, y);
  ctx.lineTo(x + 6, y + 6);
  ctx.stroke();
  ctx.restore();
}

/**
 * Tres puntos verticales nativos de Telegram Mobile
 */
function drawMoreDots(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (let offset of [-7, 0, 7]) {
    ctx.beginPath();
    ctx.arc(x, y + offset, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Insignia oficial de verificado de Telegram (Estrella azul con check blanco)
 */
function drawTelegramVerifiedBadge(ctx, x, y, size = 20) {
  ctx.save();
  ctx.translate(x, y);

  const scaleFactor = size / 26;
  ctx.scale(scaleFactor, scaleFactor);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(6, 6, 14, 14);

  ctx.fillStyle = '#248bcf';
  const starPath = new Path2D(
    'M14.38 1.51L16.2 3.33C16.57 3.7 17.06 3.9 17.58 3.9H20.15C21.16 3.9 22 4.67 22.09 5.66L22.1 5.85V8.42C22.1 8.94 22.31 9.43 22.67 9.8L24.49 11.62C25.2 12.33 25.25 13.46 24.62 14.23L24.49 14.38L22.67 16.2C22.3 16.57 22.1 17.06 22.1 17.58V20.15C22.1 21.16 21.33 22 20.34 22.09L20.15 22.1H17.58C17.06 22.1 16.57 22.31 16.2 22.67L14.38 24.49C13.67 25.2 12.54 25.25 11.77 24.62L11.62 24.49L9.8 22.67C9.43 22.3 8.94 22.1 8.42 22.1H5.85C4.84 22.1 4 21.33 3.91 20.34L3.9 20.15V17.58C3.9 17.06 3.69 16.57 3.33 16.2L1.51 14.38C0.8 13.67 0.75 12.54 1.38 11.77L1.51 11.62L3.33 9.8C3.7 9.43 3.9 8.94 3.9 8.42V5.85C3.9 4.77 4.77 3.9 5.85 3.9H8.42C8.94 3.9 9.43 3.69 9.8 3.33L11.62 1.51C12.38 0.75 13.62 0.75 14.38 1.51Z'
  );
  ctx.fill(starPath);

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
 * Icono Mensaje (burbuja de chat con cola inferior)
 */
function drawMessageIcon(ctx, cx, cy) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  roundRect(ctx, cx - 10, cy - 8, 20, 14, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy + 5);
  ctx.lineTo(cx - 10, cy + 9);
  ctx.lineTo(cx - 3, cy + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Icono Silenciar (campana con badajo)
 */
function drawBellIcon(ctx, cx, cy) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 1.5, cy - 6);
  ctx.bezierCurveTo(cx - 5, cy - 5, cx - 7, cy - 2, cx - 7, cy + 3.5);
  ctx.lineTo(cx - 8.5, cy + 6);
  ctx.lineTo(cx + 8.5, cy + 6);
  ctx.lineTo(cx + 7, cy + 3.5);
  ctx.bezierCurveTo(cx + 7, cy - 2, cx + 5, cy - 5, cx + 1.5, cy - 6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + 7, 2.2, 0, Math.PI);
  ctx.fill();
  ctx.restore();
}

/**
 * Icono Llamar (auricular de teléfono inclinado)
 */
function drawPhoneIcon(ctx, cx, cy) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);
  roundRect(ctx, -7, -9, 14, 4.5, 2);
  ctx.fill();
  roundRect(ctx, -3, -6, 6, 12, 1.5);
  ctx.fill();
  roundRect(ctx, -7, 4.5, 14, 4.5, 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Icono Video (cámara con lente trapezoidal)
 */
function drawVideoIcon(ctx, cx, cy) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, cx - 11, cy - 7, 14, 14, 3.5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 4, cy - 4.5);
  ctx.lineTo(cx + 10, cy - 7);
  ctx.lineTo(cx + 10, cy + 7);
  ctx.lineTo(cx + 4, cy + 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Icono QR nativo de Telegram (4 cuadritos agrupados)
 */
function drawQrGrid(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#8fa2b4';
  const s = 6.5;
  const g = 3;
  ctx.fillRect(x, y, s, s);
  ctx.fillRect(x + s + g, y, s, s);
  ctx.fillRect(x, y + s + g, s, s);
  ctx.fillRect(x + s + g, y + s + g, s, s);

  ctx.fillStyle = '#141920';
  ctx.fillRect(x + 2, y + 2, 2.5, 2.5);
  ctx.fillRect(x + s + g + 2, y + 2, 2.5, 2.5);
  ctx.fillRect(x + 2, y + s + g + 2, 2.5, 2.5);
  ctx.fillRect(x + s + g + 2, y + s + g + 2, 2.5, 2.5);
  ctx.restore();
}

/**
 * Icono de Credencial / ID oficial de Telegram
 */
function drawIdCardIcon(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#8fa2b4';
  ctx.fillStyle = '#8fa2b4';
  ctx.lineWidth = 1.6;
  roundRect(ctx, x, y, 18, 14, 2.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 5, y + 5, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 9, y + 5);
  ctx.lineTo(x + 14, y + 5);
  ctx.moveTo(x + 9, y + 8.5);
  ctx.lineTo(x + 14, y + 8.5);
  ctx.stroke();
  ctx.restore();
}

/**
 * Icono de Añadir a Contactos (+👤)
 */
function drawAddContactIcon(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#8fa2b4';
  ctx.fillStyle = '#8fa2b4';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 5, y);
  ctx.lineTo(x + 3, y);
  ctx.moveTo(x - 1, y - 4);
  ctx.lineTo(x - 1, y + 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 13, y - 3.5, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 13, y + 8, 6.5, Math.PI * 1.15, Math.PI * 1.85, false);
  ctx.stroke();
  ctx.restore();
}

/**
 * Divide el texto de la biografía en líneas
 */
function splitBioLines(text, maxChars = 34, maxLines = 4) {
  if (!text) return ['Sin biografía pública.'];
  const rawLines = text.split('\n');
  const result = [];

  for (const line of rawLines) {
    if (!line.trim()) continue;
    const words = line.split(' ');
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length <= maxChars) {
        cur = (cur + ' ' + w).trim();
      } else {
        if (cur) result.push(cur);
        cur = w;
        if (result.length >= maxLines) break;
      }
    }
    if (cur && result.length < maxLines) result.push(cur);
    if (result.length >= maxLines) break;
  }
  return result.length ? result : ['Sin biografía pública.'];
}

/**
 * Genera la Tarjeta idéntica al Perfil Nativo de Telegram Mobile (Android)
 * Recrea fielmente la interfaz del cliente oficial de Telegram:
 * - Fondo oscuro profundo AMOLED (#080b0f)
 * - Barra superior con flecha ← y menú vertical ⋮
 * - Avatar circular HD en tamaño completo (con iniciales en gradiente nativo o foto real)
 * - Nombre de usuario en tipografía bold con badge verificado
 * - Estado de conexión "online" o "últ. vez hace poco / recientemente"
 * - 4 Botones de acción flotantes cuadrados redondeados: [Mensaje], [Silenciar], [Llamar], [Video]
 * - Tarjeta principal con bordes redondeados conteniendo:
 *   • Biografía con resaltado de enlaces
 *   • Nombre de usuario (@) con botón QR
 *   • ID Oficial de Telegram con icono de credencial
 *   • Respaldo de comunidad / Tratos completados si aplica
 * - Tarjeta secundaria "Añadir a Contactos"
 */
async function generateTelegramProfileModal({
  name = 'Usuario',
  username = null,
  id = '',
  bio = null,
  avatarBuffer = null,
  isOnline = true,
  isVerified = false,
  statusSubtitle = null,
  musicTrack = null,
  isBurned = false,
  burnReason = null,
  dealsCount = 0,
  role = null,
  rating = '5.0',
  totalRatings = 0,
}) {
  const scale = 2; // Ultra HD 2x Retina
  const baseW = 380;

  let effectiveBio = bio;
  if (!effectiveBio) {
    if (role) {
      effectiveBio = `Staff Oficial: ${role}\nTratos: ${dealsCount} completados`;
    } else {
      effectiveBio = `Usuario de la Comunidad\nTratos: ${dealsCount} completados`;
    }
  }

  const bioLines = splitBioLines(effectiveBio, 34, 4);

  // Cálculo vertical proporcional
  const bioH = bioLines.length * 20 + 26;
  const usernameH = 58;
  const idH = 58;
  const hasCommunityRow = dealsCount > 0 || role;
  const communityH = hasCommunityRow ? 54 : 0;

  const cardH = bioH + usernameH + idH + communityH;
  const cardY = 314;
  const secY = cardY + cardH + 14;
  const baseH = secY + 46 + 24;

  const canvas = createCanvas(baseW * scale, baseH * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // 1. Fondo de la Pantalla AMOLED
  ctx.fillStyle = '#080b0f';
  ctx.fillRect(0, 0, baseW, baseH);

  // 2. Barra Superior (← y ⋮)
  drawBackArrow(ctx, 24, 36);
  drawMoreDots(ctx, baseW - 28, 36);

  // 3. Avatar Circular de Telegram
  const avX = baseW / 2;
  const avY = 112;
  const avR = 52;

  ctx.save();
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
    const colorPalettes = [
      ['#e57373', '#ff8a65'], // Coral
      ['#64b5f6', '#42a5f5'], // Azul
      ['#81c784', '#4db6ac'], // Verde / Turquesa
      ['#ba68c8', '#9575cd'], // Violeta
      ['#ffd54f', '#ffb74d'], // Ámbar
      ['#4dd0e1', '#26c6da'], // Cian
      ['#f06292', '#ba68c8'], // Rosa
    ];

    const charCodeSum = Array.from(String(id || name || 'U')).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const chosenGrad = colorPalettes[charCodeSum % colorPalettes.length];

    const avGrad = ctx.createLinearGradient(avX - avR, avY - avR, avX + avR, avY + avR);
    avGrad.addColorStop(0, chosenGrad[0]);
    avGrad.addColorStop(1, chosenGrad[1]);
    ctx.fillStyle = avGrad;
    ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);

    const cleanAlpha = String(name || 'U').replace(/[^\p{Script=Latin}\p{N}\s]/gu, ' ').trim();
    const words = cleanAlpha.split(/\s+/).filter(Boolean);
    let initials = '';
    if (words.length >= 2) {
      initials = Array.from(words[0])[0] + Array.from(words[words.length - 1])[0];
    } else if (words.length === 1) {
      initials = Array.from(words[0])[0];
    } else {
      initials = 'U';
    }
    initials = initials.toUpperCase();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${initials.length > 1 ? 38 : 44}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, avX, avY + 2);
  }
  ctx.restore();

  // 4. Nombre Completo centrado debajo del avatar
  const cleanName = cleanText(name || 'Usuario', 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isVerified || (role && role.includes('OWNER'))) {
    const nameWidth = ctx.measureText(cleanName).width;
    const totalW = nameWidth + 24;
    const startX = avX - totalW / 2;
    ctx.textAlign = 'left';
    ctx.fillText(cleanName, startX, 190);
    drawTelegramVerifiedBadge(ctx, startX + nameWidth + 6, 179, 20);
    ctx.textAlign = 'center';
  } else {
    ctx.fillText(cleanName, avX, 190);
  }

  // 5. Subtítulo de Estado
  const stateLabel = statusSubtitle || (isOnline ? 'online' : 'últ. vez hace poco');
  ctx.fillStyle = isOnline ? '#64b5f6' : '#788a9c';
  ctx.font = `13.5px ${FONT_STACK}`;
  ctx.fillText(stateLabel, avX, 214);

  // 6. Fila de los 4 Botones de Acción de Telegram Mobile
  const btnY = 238;
  const btnW = 76;
  const btnH = 58;
  const btnGap = 12;
  const startBtnX = 20;

  const actionButtons = [
    { draw: drawMessageIcon, label: 'Mensaje' },
    { draw: drawBellIcon, label: 'Silenciar' },
    { draw: drawPhoneIcon, label: 'Llamar' },
    { draw: drawVideoIcon, label: 'Video' },
  ];

  actionButtons.forEach((b, i) => {
    const bx = startBtnX + i * (btnW + btnGap);
    roundRect(ctx, bx, btnY, btnW, btnH, 16);
    ctx.fillStyle = '#171e25';
    ctx.fill();

    b.draw(ctx, bx + btnW / 2, btnY + 21);

    ctx.fillStyle = '#ffffff';
    ctx.font = `11px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, bx + btnW / 2, btnY + 44);
  });

  // 7. Tarjeta Principal de Información (#141920 con esquinas redondeadas)
  const cardW = 340;
  const cardX = 20;
  roundRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fillStyle = '#141920';
  ctx.fill();

  // Fila 1: Biografía
  ctx.textAlign = 'left';
  let curY = cardY + 24;
  for (let line of bioLines) {
    ctx.font = `15px ${FONT_STACK}`;
    ctx.fillStyle = line.startsWith('http') ? '#64b5f6' : '#ffffff';
    ctx.fillText(line, cardX + 18, curY);
    curY += 20;
  }
  ctx.font = `12px ${FONT_STACK}`;
  ctx.fillStyle = '#728394';
  ctx.fillText('Biografía', cardX + 18, curY);
  curY += 16;

  // Separador 1
  ctx.strokeStyle = '#1e2630';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 18, curY);
  ctx.lineTo(cardX + cardW - 18, curY);
  ctx.stroke();

  // Fila 2: Nombre de usuario
  curY += 24;
  const displayUsername = username ? (username.startsWith('@') ? username : `@${username}`) : 'Sin @username';
  ctx.font = `bold 15px ${FONT_STACK}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(displayUsername, cardX + 18, curY);
  ctx.font = `12px ${FONT_STACK}`;
  ctx.fillStyle = '#728394';
  ctx.fillText('Nombre de usuario', cardX + 18, curY + 18);
  drawQrGrid(ctx, cardX + cardW - 36, curY + 2);
  curY += 34;

  // Separador 2
  ctx.beginPath();
  ctx.moveTo(cardX + 18, curY);
  ctx.lineTo(cardX + cardW - 18, curY);
  ctx.stroke();

  // Fila 3: ID de Telegram Oficial
  curY += 24;
  const displayNumericId = String(id || 'No identificado');
  ctx.font = `bold 15px ${FONT_STACK}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(displayNumericId, cardX + 18, curY);
  ctx.font = `12px ${FONT_STACK}`;
  ctx.fillStyle = '#728394';
  ctx.fillText('ID de Telegram Oficial', cardX + 18, curY + 18);
  drawIdCardIcon(ctx, cardX + cardW - 38, curY + 2);
  curY += 34;

  // Fila 4: Comunidad & Tratos (si aplica)
  if (hasCommunityRow) {
    ctx.beginPath();
    ctx.moveTo(cardX + 18, curY);
    ctx.lineTo(cardX + cardW - 18, curY);
    ctx.stroke();

    curY += 22;
    ctx.font = `14px ${FONT_STACK}`;
    ctx.fillStyle = '#ffffff';
    const commText = role ? `Staff: ${role} (${dealsCount} tratos)` : `Ventas Libres Perú — ${dealsCount} tratos`;
    ctx.fillText(cleanText(commText, 32), cardX + 18, curY);
    ctx.font = `12px ${FONT_STACK}`;
    ctx.fillStyle = '#728394';
    ctx.fillText('Comunidad & Respaldo Oficial', cardX + 18, curY + 17);
  }

  // 8. Tarjeta Secundaria de Acción (Añadir a Contactos)
  roundRect(ctx, cardX, secY, cardW, 46, 16);
  ctx.fillStyle = '#141920';
  ctx.fill();

  drawAddContactIcon(ctx, cardX + 22, secY + 23);
  ctx.fillStyle = '#ffffff';
  ctx.font = `14px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Añadir a Contactos', cardX + 50, secY + 23);

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateTelegramProfileModal,
};
