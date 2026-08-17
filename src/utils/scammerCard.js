const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════
// ⟡ Carga y Registro Universal de Fuentes (Linux & Windows)
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
    { file: 'calibri.ttf', family: 'Calibri' },
  ];

  for (const item of fontDefinitions) {
    const fullPath = path.join(FONTS_DIR, item.file);
    if (fs.existsSync(fullPath)) {
      try {
        GlobalFonts.registerFromPath(fullPath, item.family);
      } catch (err) {
        console.warn(`⟡ Canvas: No se pudo registrar fuente ${item.file}:`, err.message);
      }
    }
  }

  // Respaldo para entorno local Windows si faltasen archivos
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
 * Limpia y normaliza texto para asegurar compatibilidad total sin caracteres corruptos ni cuadrados
 */
function cleanAndNormalize(str, maxChars = 32) {
  if (!str) return '';
  // Normalizar caracteres matemáticos/góticos a su equivalente legible manteniendo emojis
  const normalized = str.normalize('NFKD');
  const arr = Array.from(normalized);
  if (arr.length <= maxChars) return arr.join('');
  return arr.slice(0, maxChars).join('') + '...';
}

/**
 * Recrea exactamente la captura del modal de perfil de Telegram Desktop en Ultra HD (2x Retina).
 * @param {Object} data - { name, username, id, bio, avatarBuffer }
 * @returns {Promise<Buffer>} - Buffer PNG HD idéntico a Telegram Desktop
 */
async function generateScammerCard({ name, username, id, bio, avatarBuffer }) {
  const scale = 2;
  const baseW = 380;

  // Procesar biografía y líneas
  const cleanBio = bio || 'Sin biografía.';
  const bioLines = splitTextIntoLines(cleanBio, 38, 3);

  const baseH = 460 + (bioLines.length - 1) * 20;

  const width = baseW * scale;
  const height = baseH * scale;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.scale(scale, scale);

  // 1. Fondo base Telegram Desktop (#17212b)
  ctx.fillStyle = '#17212b';
  ctx.fillRect(0, 0, baseW, baseH);

  // 2. Cabecera con Wallpaper/Gradiente nativo de Telegram (#24303e a #1b2531)
  const headH = 180;
  const headGrad = ctx.createLinearGradient(0, 0, 0, headH);
  headGrad.addColorStop(0, '#2b3847');
  headGrad.addColorStop(1, '#1b2532');
  ctx.fillStyle = headGrad;
  ctx.fillRect(0, 0, baseW, headH);

  // Botón de cerrar "✕" nativo
  drawCloseButton(ctx, baseW - 22, 22);

  // 3. Avatar Circular de Telegram (76px diámetro)
  const avX = baseW / 2;
  const avY = 56;
  const avR = 38;

  if (avatarBuffer) {
    try {
      const img = await loadImage(avatarBuffer);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avX, avY, avR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, avX - avR, avY - avR, avR * 2, avR * 2);
      ctx.restore();
    } catch {
      drawDefaultAvatar(ctx, avX, avY, avR, name);
    }
  } else {
    drawDefaultAvatar(ctx, avX, avY, avR, name);
  }

  // 4. Nombre Completo (100% legible, emojis soportados)
  const cleanName = cleanAndNormalize(name || 'Usuario', 28);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 16px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.fillText(cleanName, avX, 114);

  // 5. Estado ("últ. vez recientemente")
  ctx.fillStyle = '#7e8f9f';
  ctx.font = `12.5px ${FONT_STACK}`;
  ctx.fillText('últ. vez recientemente', avX, 133);

  // 6. Fila de 4 Botones de Acción Nativos
  const btnY = 148;
  const btnW = 70;
  const btnH = 46;
  const gap = 8;
  const startX = (baseW - (btnW * 4 + gap * 3)) / 2;

  const actions = [
    { label: 'Mensaje', icon: 'msg' },
    { label: 'No silenciar', icon: 'mute' },
    { label: 'Llamar', icon: 'call' },
    { label: 'Más', icon: 'more' },
  ];

  actions.forEach((act, idx) => {
    const x = startX + idx * (btnW + gap);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.beginPath();
    ctx.roundRect(x, btnY, btnW, btnH, 8);
    ctx.fill();

    drawActionIcon(ctx, x + btnW / 2, btnY + 17, act.icon);

    ctx.fillStyle = '#e4ecf2';
    ctx.font = `10.5px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.fillText(act.label, x + btnW / 2, btnY + 37);
  });

  // Franja divisoria oscura (#0e1621)
  let curY = 206;
  ctx.fillStyle = '#0e1621';
  ctx.fillRect(0, curY, baseW, 10);
  curY += 22;

  // 7. Sección Biografía
  ctx.textAlign = 'left';
  const fieldX = 24;

  for (let i = 0; i < bioLines.length; i++) {
    const line = bioLines[i];
    const isUrl = line.includes('http://') || line.includes('https://') || line.includes('t.me/');
    ctx.fillStyle = isUrl ? '#40a7e3' : '#ffffff';
    ctx.font = `13.5px ${FONT_STACK}`;
    ctx.fillText(line, fieldX, curY);
    curY += 18;
  }

  ctx.fillStyle = '#708499';
  ctx.font = `11.5px ${FONT_STACK}`;
  curY += 2;
  ctx.fillText('Biografía', fieldX, curY);

  curY += 22;

  // 8. Sección @Username con icono QR
  const userTag = username ? `@${username}` : 'Sin nombre de usuario';
  ctx.fillStyle = '#40a7e3';
  ctx.font = `13.5px ${FONT_STACK}`;
  ctx.fillText(userTag, fieldX, curY);

  if (username) {
    drawQrIcon(ctx, baseW - 38, curY - 11);
  }

  ctx.fillStyle = '#708499';
  ctx.font = `11.5px ${FONT_STACK}`;
  curY += 16;
  ctx.fillText('Nombre de usuario', fieldX, curY);

  curY += 22;

  // 9. Sección ID Numérico
  ctx.fillStyle = '#40a7e3';
  ctx.font = `13.5px ${FONT_STACK}`;
  ctx.fillText(String(id || 'Desconocido'), fieldX, curY);

  ctx.fillStyle = '#708499';
  ctx.font = `11.5px ${FONT_STACK}`;
  curY += 16;
  ctx.fillText('ID de Telegram', fieldX, curY);

  // Línea divisoria inferior
  curY += 20;
  ctx.fillStyle = '#0e1621';
  ctx.fillRect(0, curY, baseW, 1);

  // 10. Enlace Inferior "AÑADIR A CONTACTOS"
  curY += 26;
  ctx.fillStyle = '#40a7e3';
  ctx.font = `bold 13px ${FONT_STACK}`;
  ctx.fillText('AÑADIR A CONTACTOS', fieldX, curY);

  return canvas.toBuffer('image/png');
}

function drawCloseButton(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#a4b3c4';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 5);
  ctx.lineTo(x + 5, y + 5);
  ctx.moveTo(x + 5, y - 5);
  ctx.lineTo(x - 5, y + 5);
  ctx.stroke();
  ctx.restore();
}

function drawDefaultAvatar(ctx, x, y, r, name) {
  const grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  grad.addColorStop(0, '#e17076');
  grad.addColorStop(1, '#ff885e');

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 28px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initial = Array.from(name || '?')[0].toUpperCase();
  ctx.fillText(initial, x, y + 1);
  ctx.restore();
}

function drawActionIcon(ctx, x, y, type) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;

  if (type === 'msg') {
    ctx.beginPath();
    ctx.arc(x, y - 1, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 2);
    ctx.lineTo(x - 6.5, y + 6.5);
    ctx.lineTo(x - 1, y + 4.5);
    ctx.fill();
  } else if (type === 'mute') {
    ctx.beginPath();
    ctx.arc(x, y - 2, 4.5, Math.PI, 0, false);
    ctx.lineTo(x + 5.5, y + 2.5);
    ctx.lineTo(x - 5.5, y + 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y + 4.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 5);
    ctx.lineTo(x + 6, y + 6);
    ctx.stroke();
  } else if (type === 'call') {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0.4, Math.PI * 1.2, false);
    ctx.lineWidth = 2.4;
    ctx.stroke();
  } else if (type === 'more') {
    ctx.beginPath();
    ctx.arc(x - 4.5, y, 1.5, 0, Math.PI * 2);
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 4.5, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawQrIcon(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#40a7e3';
  ctx.fillRect(x, y, 4, 4);
  ctx.fillRect(x + 6, y, 4, 4);
  ctx.fillRect(x, y + 6, 4, 4);
  ctx.fillRect(x + 6, y + 6, 4, 4);
  ctx.restore();
}

function splitTextIntoLines(text, maxCharsPerLine = 38, maxLines = 3) {
  if (!text) return ['Sin biografía.'];
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const w of words) {
    if ((current + ' ' + w).trim().length <= maxCharsPerLine) {
      current = (current + ' ' + w).trim();
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.length ? lines : [text.slice(0, maxCharsPerLine)];
}

module.exports = { generateScammerCard };
