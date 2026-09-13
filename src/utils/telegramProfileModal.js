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
    if (fs.existsSync('C:/Windows/Fonts/seguisym.ttf')) {
      GlobalFonts.registerFromPath('C:/Windows/Fonts/seguisym.ttf', 'Segoe UI Symbol');
    }
  } catch {}
}

loadBundledFonts();

const FONT_STACK = '"Segoe UI Historic", "Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", Arial, sans-serif';

/**
 * Trunca texto y limpia caracteres o glifos no soportados para que siempre se visualice nítido
 */
function cleanText(str, max = 32) {
  if (!str) return '';
  // Normalizar corchetes decorativos / jeroglíficos a corchetes estándar legibles
  let s = str
    .replace(/[\u{13288}\u{3010}\u{300E}\u{300C}\u{FF3B}\u{27E6}\u{27EA}\u{3016}]/gu, '[')
    .replace(/[\u{13289}\u{3011}\u{300F}\u{300D}\u{FF3D}\u{27E7}\u{27EB}\u{3017}]/gu, ']')
    .replace(/[\u{25A0}-\u{25A9}\u{25FD}\u{25FE}]/gu, ''); // Eliminar cajas cuadradas vacías si las hay
  
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
 * Dibuja la insignia oficial vectorial de Verificado de Telegram
 * (Estrella dentada azul redondeada con check blanco)
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
 * Dibuja el icono nativo de Telegram Web para Username (arroba lineal perfecta con centro alineado en #8da0b0)
 */
function drawUsernameIcon(ctx, x, y, size = 26) {
  ctx.save();
  ctx.translate(x, y);
  const scaleFactor = size / 24;
  ctx.scale(scaleFactor, scaleFactor);

  ctx.strokeStyle = '#8fa2b4';
  ctx.lineWidth = 2.0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Círculo central @
  ctx.beginPath();
  ctx.arc(12, 12, 4.2, 0, Math.PI * 2);
  ctx.stroke();

  // Arco envolvente exterior
  const atArc = new Path2D('M16.2 7.8v5.2a3.1 3.1 0 0 0 6.2 0v-1a10.4 10.4 0 1 0-4.2 8.3');
  ctx.stroke(atArc);

  ctx.restore();
}

/**
 * Dibuja el icono nativo de Telegram Web para Bio (círculo lineal con 'i' interior en #8da0b0)
 */
function drawBioIcon(ctx, x, y, size = 26) {
  ctx.save();
  ctx.strokeStyle = '#8fa2b4';
  ctx.fillStyle = '#8fa2b4';
  ctx.lineWidth = 1.9;
  ctx.lineCap = 'round';

  const cx = x + size / 2;
  const cy = y + size / 2;

  // Círculo exterior
  ctx.beginPath();
  ctx.arc(cx, cy, 10.5, 0, Math.PI * 2);
  ctx.stroke();

  // Punto de la i
  ctx.beginPath();
  ctx.arc(cx, cy - 4.5, 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Cuerpo de la i
  ctx.beginPath();
  ctx.moveTo(cx, cy - 1);
  ctx.lineTo(cx, cy + 5);
  ctx.stroke();

  ctx.restore();
}

/**
 * Dibuja el icono nativo de Telegram Web para Notifications (campana lineal limpia en #8da0b0)
 */
function drawBellIcon(ctx, x, y, size = 26) {
  ctx.save();
  ctx.strokeStyle = '#8fa2b4';
  ctx.fillStyle = '#8fa2b4';
  ctx.lineWidth = 1.9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cx = x + size / 2;
  const cy = y + size / 2 - 1;

  // Silueta de campana
  ctx.beginPath();
  ctx.moveTo(cx - 1.5, cy - 8.5);
  ctx.bezierCurveTo(cx - 5.5, cy - 7, cx - 7, cy - 3, cx - 7, cy + 3.5);
  ctx.lineTo(cx - 9, cy + 6.5);
  ctx.lineTo(cx + 9, cy + 6.5);
  ctx.lineTo(cx + 7, cy + 3.5);
  ctx.bezierCurveTo(cx + 7, cy - 3, cx + 5.5, cy - 7, cx + 1.5, cy - 8.5);
  ctx.stroke();

  // Badajo inferior
  ctx.beginPath();
  ctx.arc(cx, cy + 7, 2.5, 0, Math.PI);
  ctx.stroke();

  ctx.restore();
}

/**
 * Dibuja el icono nativo de Telegram Web para ID (tarjeta de identidad / credencial con foto lineal en #8da0b0)
 */
function drawIdIcon(ctx, x, y, size = 26) {
  ctx.save();
  ctx.strokeStyle = '#8fa2b4';
  ctx.fillStyle = '#8fa2b4';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cx = x + size / 2;
  const cy = y + size / 2;

  // Rectángulo redondeado exterior (tarjeta/badge de usuario)
  roundRect(ctx, cx - 11, cy - 8.5, 22, 17, 3);
  ctx.stroke();

  // Silueta de avatar en la tarjeta: cabeza y hombros
  ctx.beginPath();
  ctx.arc(cx - 4.5, cy - 3, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx - 4.5, cy + 4, 3.8, Math.PI, 0, false);
  ctx.stroke();

  // Líneas de texto / credencial a la derecha
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy - 3);
  ctx.lineTo(cx + 7.5, cy - 3);
  ctx.moveTo(cx + 2, cy + 1);
  ctx.lineTo(cx + 7.5, cy + 1);
  ctx.moveTo(cx + 2, cy + 5);
  ctx.lineTo(cx + 5.5, cy + 5);
  ctx.stroke();

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
 * - Tarjeta flotante inferior oscura (#181d24) con esquinas redondeadas
 * - Fila de Username con icono @ y código QR a la derecha
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

  // Si tiene biografía o motivo de quemado, formatear
  let effectiveBio = bio;
  if (isBurned) {
    effectiveBio = `🚨 LISTA NEGRA: ${burnReason || 'Estafa comprobada'}\nID: ${id}`;
  } else if (!effectiveBio) {
    if (role) {
      effectiveBio = `Staff Oficial: ${role}\nTratos: ${dealsCount} completados`;
    } else {
      effectiveBio = `Comunidad Ventas Libres Perú\nTratos: ${dealsCount} completados`;
    }
  }

  const bioLines = splitBioLines(effectiveBio, 32, 4);

  // Cálculo proporcional de altura con espaciado generoso
  // Cabecera hasta inicio de tarjeta: 294px
  // Padding superior e inferior de tarjeta: 22px + 24px
  // Fila Username: 52px
  // Gap Username -> Bio: 18px
  // Fila Bio: bioLines.length * 20 + 22px
  // Gap Bio -> Notifications: 18px
  // Fila Notifications: 44px
  // Gap Notifications -> ID: 18px
  // Fila ID: 44px
  const bioContentHeight = bioLines.length * 20 + 22;
  const innerCardContentHeight = 22 + 52 + 18 + bioContentHeight + 18 + 44 + 18 + 44 + 24;
  const cardH = innerCardContentHeight;
  const cardY = 294;
  const baseH = cardY + cardH + 20;

  const canvas = createCanvas(baseW * scale, baseH * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // 1. Fondo de la Pantalla / Cabecera (Azul pizarra oscuro Telegram profundo con viñeta de iluminación)
  const headerGrad = ctx.createLinearGradient(0, 0, 0, baseH);
  if (isBurned) {
    headerGrad.addColorStop(0, '#2d151a');
    headerGrad.addColorStop(0.45, '#1e0e12');
    headerGrad.addColorStop(1, '#14090c');
  } else {
    headerGrad.addColorStop(0, '#384852');
    headerGrad.addColorStop(0.45, '#263238');
    headerGrad.addColorStop(1, '#1b2327');
  }
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, baseW, baseH);

  // Viñeta radial sutil de profundidad detrás del avatar
  const avRadialGlow = ctx.createRadialGradient(baseW / 2, 118, 10, baseW / 2, 118, 160);
  if (isBurned) {
    avRadialGlow.addColorStop(0, 'rgba(239, 68, 68, 0.18)');
    avRadialGlow.addColorStop(1, 'transparent');
  } else {
    avRadialGlow.addColorStop(0, 'rgba(64, 167, 227, 0.15)');
    avRadialGlow.addColorStop(1, 'transparent');
  }
  ctx.fillStyle = avRadialGlow;
  ctx.fillRect(0, 0, baseW, 250);

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

    // Obtener iniciales alfanuméricas limpias (evitando símbolos raros para que queden nítidas)
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

  // 4. Nombre Completo debajo del Avatar (con Insignia de Verificado si corresponde)
  const cleanName = cleanText(name || 'Usuario', 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 20px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isVerified || (role && role.includes('OWNER'))) {
    // Dibujar nombre y check centrado
    const nameWidth = ctx.measureText(cleanName).width;
    const totalW = nameWidth + 24;
    const startX = avX - totalW / 2;
    ctx.textAlign = 'left';
    ctx.fillText(cleanName, startX, 198);
    drawTelegramVerifiedBadge(ctx, startX + nameWidth + 6, 187, 20);
    ctx.textAlign = 'center';
  } else {
    ctx.fillText(cleanName, avX, 198);
  }

  // 5. Estado del usuario ("online" o "últ. vez recientemente")
  const stateLabel = isBurned
    ? '🚨 ALERTA: USUARIO QUEMADO'
    : (statusSubtitle || (isOnline ? 'online' : 'últ. vez recientemente'));

  ctx.fillStyle = isBurned ? '#ff6b6b' : (isOnline ? '#64b5f6' : '#90a4ae');
  ctx.font = `13px ${FONT_STACK}`;
  ctx.fillText(stateLabel, avX, 222);

  // 6. Barra Horizontal de Canción / Estado de Telegram
  const barY = 244;
  ctx.fillStyle = isBurned ? 'rgba(239, 68, 68, 0.22)' : 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(0, barY, baseW, 36);

  ctx.font = `13px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isBurned) {
    ctx.fillStyle = '#ff8a80';
    ctx.fillText('⚠️ REGISTRADO EN LISTA NEGRA OFICIAL', avX, barY + 18);
  } else {
    ctx.fillStyle = '#eceff1';
    let trackName = musicTrack;
    if (!trackName) {
      const isMediator = role && (role.includes('TRATO') || role.includes('MEDIADOR'));
      const isOwner = role && role.includes('OWNER');
      const isCoOwner = role && (role.includes('CO-OWNER') || role.includes('COOWNER'));
      const isAdmin = role && (role.includes('ADMIN') || role.includes('ADMINISTRADOR'));
      const isMod = role && (role.includes('MOD') || role.includes('MODERADOR'));

      if (isMediator) {
        trackName = `⭐ Mediador Oficial ${rating}/5.0 (${dealsCount} tratos)`;
      } else if (isOwner) {
        trackName = dealsCount > 0
          ? `Ventas Libres Perú — ${dealsCount} tratos completados`
          : `👑 Staff Oficial (Owner)`;
      } else if (isCoOwner) {
        trackName = dealsCount > 0
          ? `⚜️ Co-Owner Oficial (${dealsCount} tratos)`
          : `⚜️ Co-Owner Oficial`;
      } else if (isAdmin) {
        trackName = dealsCount > 0
          ? `⚔️ Administrador Oficial (${dealsCount} tratos)`
          : `⚔️ Administrador Oficial`;
      } else if (isMod) {
        trackName = dealsCount > 0
          ? `🛡️ Moderador Oficial (${dealsCount} tratos)`
          : `🛡️ Moderador Oficial`;
      } else {
        trackName = `Ventas Libres Perú — ${dealsCount} tratos completados`;
      }
    }
    const cleanTrack = cleanText(trackName, 36);
    ctx.fillText(`♬ ${cleanTrack} ❯`, avX, barY + 18);
  }

  // 7. Tarjeta Inferior Flotante Oscura (#181d24 con sombra y borde sutil)
  const cardX = 14;
  const cardW = baseW - 28;

  // Sombra de profundidad
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fillStyle = isBurned ? '#1a1014' : '#181d24';
  ctx.fill();
  ctx.restore();

  // Borde fino de cristal
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.strokeStyle = isBurned ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  let curY = cardY + 22;
  const rowPadX = cardX + 16;
  const textLeftX = rowPadX + 44;

  // ── Fila 1: Username ──
  drawUsernameIcon(ctx, rowPadX, curY + 6, 26);

  const displayUser = username ? username : 'Sin username';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 15px ${FONT_STACK}`;
  ctx.fillText(displayUser, textLeftX, curY + 2);

  ctx.fillStyle = '#78909c';
  ctx.font = `12.5px ${FONT_STACK}`;
  ctx.fillText('Username', textLeftX, curY + 24);

  // Icono QR a la derecha centrado con la fila
  drawQrGrid(ctx, cardX + cardW - 36, curY + 13);

  curY += 52 + 18;

  // ── Fila 2: Bio ──
  drawBioIcon(ctx, rowPadX, curY + 4, 26);

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
    ctx.fillText(line, textLeftX, curY + i * 20);
  }

  const bioBottomY = curY + bioLines.length * 20 + 3;
  ctx.fillStyle = '#78909c';
  ctx.font = `12.5px ${FONT_STACK}`;
  ctx.fillText('Bio', textLeftX, bioBottomY);

  curY = bioBottomY + 18 + 18;

  // ── Fila 3: Notifications ──
  drawBellIcon(ctx, rowPadX, curY + 6, 26);

  ctx.fillStyle = '#ffffff';
  ctx.font = `15px ${FONT_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Notifications', textLeftX, curY + 19);

  drawToggleSwitch(ctx, cardX + cardW - 58, curY + 6, 46, 26, true);

  curY += 44 + 18;

  // ── Fila 4: ID de Telegram Oficial ──
  drawIdIcon(ctx, rowPadX, curY + 6, 26);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 15px ${FONT_STACK}`;
  ctx.textBaseline = 'top';
  ctx.fillText(String(id || 'N/A'), textLeftX, curY + 2);

  ctx.fillStyle = '#78909c';
  ctx.font = `12.5px ${FONT_STACK}`;
  ctx.fillText('ID de Telegram Oficial', textLeftX, curY + 24);

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateTelegramProfileModal,
};

