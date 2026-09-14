// ══════
// ⟡ Motor de Tipografía y Estética Unicode — Ventas Libres Perú
// ══════

/**
 * Escapado seguro de caracteres HTML para mensajes de Telegram.
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));
}

// ── Tablas de Mapeo Unicode ──

const MATH_BOLD_MAP = {
  a: '𝗮', b: '𝗯', c: '𝗰', d: '𝗱', e: '𝗲', f: '𝗳', g: '𝗴', h: '𝗵', i: '𝗶', j: '𝗷',
  k: '𝗸', l: '𝗹', m: '𝗺', n: '𝗻', o: '𝗼', p: '𝗽', q: '𝗾', r: '𝗿', s: '𝘀', t: '𝘁',
  u: '𝘂', v: '𝘃', w: '𝘄', x: '𝘅', y: '𝘆', z: '𝘇',
  A: '𝗔', B: '𝗕', C: '𝗖', D: '𝗗', E: '𝗘', F: '𝗙', G: '𝗚', H: '𝗛', I: '𝗜', J: '𝗝',
  K: '𝗞', L: '𝗟', M: '𝗠', N: '𝗡', O: '𝗢', P: '𝗣', Q: '𝗤', R: '𝗥', S: '𝗦', T: '𝗧',
  U: '𝗨', V: '𝗩', W: '𝗪', X: '𝗫', Y: '𝗬', Z: '𝗭',
  0: '𝟬', 1: '𝟭', 2: '𝟮', 3: '𝟯', 4: '𝟰', 5: '𝟱', 6: '𝟲', 7: '𝟳', 8: '𝟴', 9: '𝟵',
};

const MATH_SERIF_BOLD_MAP = {
  a: '𝐚', b: '𝐛', c: '𝐜', d: '𝐝', e: '𝐞', f: '𝐟', g: '𝐠', h: '𝐡', i: '𝐢', j: '𝐣',
  k: '𝐤', l: '𝐥', m: '𝐦', n: '𝐧', o: '𝐨', p: '𝐩', q: '𝐪', r: '𝐫', s: '𝐬', t: '𝐭',
  u: '𝐮', v: '𝐯', w: '𝐰', x: '𝐱', y: '𝐲', z: '𝐳',
  A: '𝐀', B: '𝐁', C: '𝐂', D: '𝐃', E: '𝐄', F: '𝐅', G: '𝐆', H: '𝐇', I: '𝐈', J: '𝐉',
  K: '𝐊', L: '𝐋', M: '𝐌', N: '𝐍', O: '𝐎', P: '𝐏', Q: '𝐐', R: '𝐑', S: '𝐒', T: '𝐓',
  U: '𝐔', V: '𝐕', W: '𝐖', X: '𝐗', Y: '𝐘', Z: '𝐙',
  0: '𝟎', 1: '𝟏', 2: '𝟐', 3: '𝟑', 4: '𝟒', 5: '𝟓', 6: '𝟔', 7: '𝟕', 8: '𝟖', 9: '𝟗',
};

const SMALL_CAPS_MAP = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ғ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ',
  k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ',
  u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
};

/**
 * Convierte un texto a negrita matemática Sans (ej: 𝙑𝙚𝙣𝙩𝙖𝙨 / 𝗔𝗱𝗺𝗶𝗻).
 */
function toMathBold(text) {
  if (!text) return '';
  return String(text).split('').map(ch => MATH_BOLD_MAP[ch] || ch).join('');
}

/**
 * Convierte un texto a negrita matemática Serif (ej: 𝐕𝐄𝐍𝐓𝐀𝐒 𝐋𝐈𝐁𝐑𝐄 𝐏𝐄𝐑𝐔).
 */
function toMathSerifBold(text) {
  if (!text) return '';
  return String(text).split('').map(ch => MATH_SERIF_BOLD_MAP[ch] || ch).join('');
}

/**
 * Convierte un texto a Small Caps (ej: ᴀᴅᴍɪɴɪsᴛʀᴀᴅᴏʀ).
 */
function toSmallCaps(text) {
  if (!text) return '';
  return String(text).toLowerCase().split('').map(ch => SMALL_CAPS_MAP[ch] || ch).join('');
}

// ── Separadores y Estilos de Borde Oficiales ──
const AESTHETIC_DIVIDERS = {
  BOX_TOP:    '══════',
  BOX_BOTTOM: '──────',
  THIN:       '──────',
  COMPACT:    '━━━━━━',
};

/**
 * Crea una tarjeta estética de advertencia para Cachineros.
 */
function createCachineroWarningCard({ username, userId, firstName } = {}) {
  const userDisplay = username ? `@${username}` : (firstName || 'Usuario');
  const idDisplay = userId ? `<code>${userId}</code>` : 'No identificado';

  return (
    `\n\n` +
    `⟡ <b>ADVERTENCIA DE COMUNIDAD</b> ⊱ <code>ANTÍ-CACHINEO</code> ⊰\n` +
    `══════\n` +
    `▸ <b>Infractor:</b> ${escapeHtml(userDisplay)} (${idDisplay})\n` +
    `▸ <b>Conducta:</b> Desvalorización agresiva de precios / Cachineo\n` +
    `▸ <b>Sanción preventiva:</b> ⚠️ Advertencia registrada\n` +
    `──────\n` +
    `⚖️ <i>En Ventas Libres Perú se respeta el trabajo de los vendedores. De persistir con ofertas absurdas, el Staff aplicará <code>/warn</code> oficial (3/3 = expulsión).</i>`
  );
}

/**
 * Crea una tarjeta estética de llamado al orden para Faltosos.
 */
function createFaltosoWarningCard({ username, userId, firstName } = {}) {
  const userDisplay = username ? `@${username}` : (firstName || 'Usuario');
  const idDisplay = userId ? `<code>${userId}</code>` : 'No identificado';

  return (
    `\n\n` +
    `⟡ <b>LLAMADO AL ORDEN</b> ⊱ <code>FALTA DE RESPETO</code> ⊰\n` +
    `══════\n` +
    `▸ <b>Usuario:</b> ${escapeHtml(userDisplay)} (${idDisplay})\n` +
    `▸ <b>Motivo:</b> Trato irrespetuoso / Falta a las normas de convivencia\n` +
    `▸ <b>Estado:</b> ⚠️ Advertido en el chat\n` +
    `──────\n` +
    `🛡️ <i>Mantén la compostura y el respeto hacia los miembros y el Staff. Los insultos conllevan <code>/warn</code> o <code>/mute</code> directo.</i>`
  );
}

module.exports = {
  escapeHtml,
  toMathBold,
  toMathSerifBold,
  toSmallCaps,
  AESTHETIC_DIVIDERS,
  createCachineroWarningCard,
  createFaltosoWarningCard,
};
