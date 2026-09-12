const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
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
 * Trunca texto y limpia
 */
function cleanText(str, max = 32) {
  if (!str) return '';
  const arr = Array.from(str.normalize('NFKD'));
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
 * Dibuja el anillo de historia de Telegram (segmentado en colores cian / esmeralda / azul)
 */
function drawStoryRing(ctx, cx, cy, radius, isBurned = false) {
  ctx.save();
  const segments = 4;
  const gap = 0.18; // radianes de separación
  const segAngle = (Math.PI * 2) / segments;

  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';

  for (let i = 0; i < segments; i++) {
    ctx.beginPath();
    const start = i * segAngle + gap / 2;
    const end = (i + 1) * segAngle - gap / 2;
    ctx.arc(cx, cy, radius, start, end);

    if (isBurned) {
      // Anillo rojo fuego de estafador
      ctx.strokeStyle = i % 2 === 0 ? '#ef4444' : '#b91c1c';
    } else {
      // Anillo oficial multicolor de historias Telegram (Cian, Turquesa, Azul)
      const colors = ['#29b6f6', '#26a69a', '#66bb6a', '#0288d1'];
      ctx.strokeStyle = colors[i % colors.length];
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Dibuja el icono cuadrado redondeado de @ en Username
 */
function drawUsernameIcon(ctx, x, y, size = 38) {
  ctx.save();
  roundRect(ctx, x, y, size, size, 12);
  ctx.fillStyle = '#248bcf';
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('@', x + size / 2, y + size / 2 - 1);
  ctx.restore();
}

/**
 * Dibuja el icono cuadrado redondeado de Bio (i de información)
 */
function drawBioIcon(ctx, x, y, size = 38) {
  ctx.save();
  roundRect(ctx, x, y, size, size, 12);
  ctx.fillStyle = '#6c7a89';
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 18px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('i', x + size / 2, y + size / 2);
  ctx.restore();
}

/**
 * Dibuja el icono de notificaciones (Campana naranja/roja)
 */
function drawBellIcon(ctx, x, y, size = 38) {
  ctx.save();
  roundRect(ctx, x, y, size, size, 12);
  ctx.fillStyle = '#ff6b6b';
  ctx.fill();

  // Campana blanca estilizada
  const bx = x + size / 2;
  const by = y + size / 2 - 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(bx, by - 2, 6, Math.PI, 0, false);
  ctx.lineTo(bx + 8, by + 5);
  ctx.lineTo(bx - 8, by + 5);
  ctx.closePath();
  ctx.fill();

  // badajo
  ctx.beginPath();
  ctx.arc(bx, by + 7.5, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Dibuja el Switch / Toggle de Notificaciones (ON estilo iOS/Telegram morado)
 */
function drawToggleSwitch(ctx, x, y, width = 48, height = 28, isOn = true) {
  ctx.save();
  const radius = height / 2;
  roundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = isOn ? '#7b68ee' : '#3e4a59'; // Morado Telegram
  ctx.fill();

  // Círculo blanco del switch
  const knobX = isOn ? x + width - radius : x + radius;
  ctx.beginPath();
  ctx.arc(knobX, y + radius, radius - 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

/**
 * Dibuja el icono QR de 4 cuadritos agrupados
 */
function drawQrGrid(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#a0adb9';
  const s = 7;
  const g = 3;
  ctx.fillRect(x, y, s, s);
  ctx.fillRect(x + s + g, y, s, s);
  ctx.fillRect(x, y + s + g, s, s);
  ctx.fillRect(x + s + g, y + s + g, s, s);

  // Puntos centrales tipo qr
  ctx.fillStyle = '#1e2329';
  ctx.fillRect(x + 2, y + 2, 3, 3);
  ctx.fillRect(x + s + g + 2, y + 2, 3, 3);
  ctx.fillRect(x + 2, y + s + g + 2, 3, 3);
  ctx.fillRect(x + s + g + 2, y + s + g + 2, 3, 3);
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
 * Genera la Tarjeta idéntica al Modal de Perfil de Telegram (User Info)
 * Recrea fielmente la captura nativa:
 * - Cabecera azul pizarra oscura con botón ✕ y título "User Info"
 * - Avatar circular grande con anillo segmentado de historias (Cian/Verde o Rojo si es Quemado)
 * - Nombre con soporte a tipografías, formatos y emojis
 * - Estado "online" o "últ. vez recientemente"
 * - Barra horizontal de estado/música nativa
 * - Tarjeta flotante inferior oscura (#1c1e22) con esquinas redondeadas
 * - Fila de Username con icono azul @ y código QR a la derecha
 * - Fila de Bio con enlaces en morado/azul y descripción
 * - Fila de Notifications con toggle morado encendido
 * - Fila adicional con ID de Telegram
 */
async function generateTelegramProfileModal({
  name = 'Usuario',
  username = null,
  id = '',
  bio = null,
  avatarBuffer = null,
  isOnline = true,
  statusSubtitle = null,
  musicTrack = null,
  isBurned = false,
  burnReason = null,
  dealsCount = 0,
  role = null,
}) {
  const scale = 2; // Ultra HD 2x Retina
  const baseW = 380;

  // Si tiene biografía o motivo de quemado, formatear
  let effectiveBio = bio;
  if (isBurned) {
    effectiveBio = `🚨 LISTA NEGRA: ${burnReason || 'Estafa comprobada'}\nID: ${id}`;
  } else if (!effectiveBio) {
    if (role) {
      effectiveBio = `Oficial: ${role}\nTratos: ${dealsCount} completados`;
    } else {
      effectiveBio = `Comunidad Ventas Libres Perú\nTratos: ${dealsCount} completados`;
    }
  }

  const bioLines = splitBioLines(effectiveBio, 32, 4);

  // Altura dinámica según líneas de biografía
  const bioBlockHeight = bioLines.length * 20;
  const baseH = 590 + Math.max(0, bioBlockHeight - 40);

  const canvas = createCanvas(baseW * scale, baseH * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // 1. Fondo de la Pantalla / Cabecera (Azul pizarra oscuro Telegram #37474f a #2d3840)
  const headerGrad = ctx.createLinearGradient(0, 0, 0, 240);
  if (isBurned) {
    headerGrad.addColorStop(0, '#3a1f26');
    headerGrad.addColorStop(1, '#25161a');
  } else {
    headerGrad.addColorStop(0, '#455a64');
    headerGrad.addColorStop(1, '#37474f');
  }
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, baseW, baseH);

  // 2. Barra Superior: Botón ✕ y Título "User Info"
  // Botón cerrar ✕
  ctx.save();
  ctx.strokeStyle = '#cfd8dc';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  const closeX = 36;
  const closeY = 32;
  ctx.beginPath();
  ctx.moveTo(closeX - 7, closeY - 7);
  ctx.lineTo(closeX + 7, closeY + 7);
  ctx.moveTo(closeX + 7, closeY - 7);
  ctx.lineTo(closeX - 7, closeY + 7);
  ctx.stroke();
  ctx.restore();

  // Título "User Info"
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 19px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('User Info', 64, closeY);

  // 3. Avatar Circular de Telegram con Anillo de Historias
  const avX = baseW / 2;
  const avY = 118;
  const avR = 52;

  // Anillo de historias segmentado
  drawStoryRing(ctx, avX, avY, avR + 6, isBurned);

  // Recorte del avatar
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
    // Generar gradiente y 1 o 2 iniciales estilo nativo de Telegram
    const colorPalettes = [
      ['#e57373', '#ff8a65'], // Coral
      ['#64b5f6', '#42a5f5'], // Azul
      ['#81c784', '#4db6ac'], // Verde / Turquesa
      ['#ba68c8', '#9575cd'], // Violeta
      ['#ffd54f', '#ffb74d'], // Ámbar
      ['#4dd0e1', '#26c6da'], // Cian
      ['#f06292', '#ba68c8'], // Rosa
    ];

    let chosenGrad = colorPalettes[0];
    if (isBurned) {
      chosenGrad = ['#d32f2f', '#7f1d1d'];
    } else {
      const charCodeSum = Array.from(String(id || name || 'U')).reduce((acc, c) => acc + c.charCodeAt(0), 0);
      chosenGrad = colorPalettes[charCodeSum % colorPalettes.length];
    }

    const avGrad = ctx.createLinearGradient(avX - avR, avY - avR, avX + avR, avY + avR);
    avGrad.addColorStop(0, chosenGrad[0]);
    avGrad.addColorStop(1, chosenGrad[1]);
    ctx.fillStyle = avGrad;
    ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);

    // Obtener iniciales (hasta 2 letras: ej. "Sammir Contreras" -> "SC")
    const words = String(name || 'U').trim().split(/\s+/).filter(Boolean);
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

  // 4. Nombre Completo debajo del Avatar
  const cleanName = cleanText(name || 'Usuario', 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 20px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cleanName, avX, 198);

  // 5. Estado del usuario ("online" o "últ. vez recientemente")
  const stateLabel = isBurned
    ? '🚨 ALERTA: USUARIO QUEMADO'
    : (statusSubtitle || (isOnline ? 'online' : 'últ. vez recientemente'));

  ctx.fillStyle = isBurned ? '#ff6b6b' : (isOnline ? '#64b5f6' : '#90a4ae');
  ctx.font = `13px ${FONT_STACK}`;
  ctx.fillText(stateLabel, avX, 222);

  // 6. Barra Horizontal de Canción / Estado de Telegram
  const barY = 244;
  ctx.fillStyle = isBurned ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 0, 0, 0.22)';
  ctx.fillRect(0, barY, baseW, 36);

  ctx.font = `13px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isBurned) {
    ctx.fillStyle = '#ff8a80';
    ctx.fillText('⚠️ REGISTRADO EN LISTA NEGRA OFICIAL', avX, barY + 18);
  } else {
    ctx.fillStyle = '#eceff1';
    const trackName = cleanText(musicTrack || 'Ventas Libres Perú — Seguridad & Confianza', 36);
    ctx.fillText(`♬ ${trackName} ❯`, avX, barY + 18);
  }

  // 7. Tarjeta Inferior Flotante Oscura (#181c20 / #15181c)
  const cardX = 14;
  const cardY = 294;
  const cardW = baseW - 28;
  const cardH = baseH - cardY - 20;

  roundRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fillStyle = isBurned ? '#1b1215' : '#1a1e24';
  ctx.fill();

  let curY = cardY + 22;
  const rowPadX = cardX + 16;
  const textLeftX = rowPadX + 48;

  // ── Fila 1: Username ──
  drawUsernameIcon(ctx, rowPadX, curY);

  const displayUser = username ? username : 'Sin username';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 15px ${FONT_STACK}`;
  ctx.fillText(displayUser, textLeftX, curY + 2);

  ctx.fillStyle = '#78909c';
  ctx.font = `12.5px ${FONT_STACK}`;
  ctx.fillText('Username', textLeftX, curY + 22);

  // Icono QR a la derecha
  drawQrGrid(ctx, cardX + cardW - 36, curY + 10);

  curY += 56;

  // ── Fila 2: Bio ──
  drawBioIcon(ctx, rowPadX, curY);

  ctx.fillStyle = '#ffffff';
  ctx.font = `13.5px ${FONT_STACK}`;
  ctx.textBaseline = 'top';

  for (let i = 0; i < bioLines.length; i++) {
    const line = bioLines[i];
    // Colorear enlaces y menciones en violeta/azul cielo
    if (line.includes('http') || line.includes('@') || line.includes('t.me')) {
      ctx.fillStyle = '#818cf8';
    } else {
      ctx.fillStyle = '#eceff1';
    }
    ctx.fillText(line, textLeftX, curY + i * 18);
  }

  const bioBottomY = curY + bioLines.length * 18 + 2;
  ctx.fillStyle = '#78909c';
  ctx.font = `12px ${FONT_STACK}`;
  ctx.fillText('Bio', textLeftX, bioBottomY);

  curY = bioBottomY + 30;

  // ── Fila 3: Notifications ──
  drawBellIcon(ctx, rowPadX, curY);

  ctx.fillStyle = '#ffffff';
  ctx.font = `15px ${FONT_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Notifications', textLeftX, curY + 19);

  drawToggleSwitch(ctx, cardX + cardW - 58, curY + 5, 46, 26, true);

  curY += 54;

  // ── Fila 4: ID de Telegram & Verificación ──
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(textLeftX, curY - 10);
  ctx.lineTo(cardX + cardW - 16, curY - 10);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 14px ${FONT_STACK}`;
  ctx.textBaseline = 'top';
  ctx.fillText(`ID: ${id || 'N/A'}`, textLeftX, curY);

  ctx.fillStyle = '#78909c';
  ctx.font = `11.5px ${FONT_STACK}`;
  ctx.fillText('ID de Telegram Oficial', textLeftX, curY + 18);

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateTelegramProfileModal,
};
