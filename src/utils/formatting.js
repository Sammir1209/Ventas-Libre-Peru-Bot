// ══════
// ⟡ Funciones de Formateo — Ventas Libres Perú
// ══════

/**
 * Escapa caracteres HTML para evitar inyección.
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Formatea una mención del usuario en HTML.
 */
function userMention(user) {
  if (!user) return 'Desconocido';
  if (user.username) return `@${escapeHtml(user.username)}`;
  const name = escapeHtml(user.first_name || 'Usuario');
  return `<a href="tg://user?id=${user.id}">${name}</a>`;
}

/**
 * Formatea una mención a partir de datos básicos.
 */
function mentionFromData(userId, username, firstName) {
  if (username) return `@${escapeHtml(username)}`;
  const name = escapeHtml(firstName || 'Usuario');
  return `<a href="tg://user?id=${userId}">${name}</a>`;
}

/**
 * Formatea un ID de usuario como código monoespaciado.
 */
function formatId(id) {
  return `<code>${id}</code>`;
}

/**
 * Formatea una fecha para mostrar.
 */
function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Trunca texto largo.
 */
function truncate(text, maxLength = 200) {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength) + '...';
}

/**
 * Normaliza texto Unicode (fuentes estilizadas, letras góticas/cursivas, acentos, emojis)
 * a texto plano ASCII estándar para búsquedas ultra-precisas.
 */
function normalizeUnicodeText(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFKD') // Descompone caracteres matemáticos / estilizados a ASCII
    .replace(/[\u0300-\u036f]/g, '') // Elimina acentos y diacríticos
    .toLowerCase()
    .trim();
}

/**
 * Formatea una mención de Staff como enlace directo (https://t.me/username) con su @username.
 * Al ser un enlace web (text_link) y no una entidad 'mention':
 * 1. Muestra la opción "Copy Link" en Telegram Desktop / Móvil en lugar de "Copy Username".
 * 2. Telegram NO envía alertas sonoras ni notificaciones push al staff.
 * 3. Permite hacer clic y abrir el perfil inmediatamente.
 */
function staffMention(userId, username, firstName, roleTitle = null) {
  const cleanUser = username ? String(username).replace(/^@/, '').trim() : null;
  const name = escapeHtml(firstName || 'Staff');
  const roleBadge = roleTitle ? ` [<i>${escapeHtml(roleTitle)}</i>]` : '';
  if (cleanUser) {
    return `<a href="https://t.me/${cleanUser}">@${escapeHtml(cleanUser)}</a>${roleBadge}`;
  }
  return `<b>${name}</b>${userId ? ` (<code>${userId}</code>)` : ''}${roleBadge}`;
}

module.exports = {
  escapeHtml,
  userMention,
  mentionFromData,
  staffMention,
  formatId,
  formatDate,
  truncate,
  normalizeUnicodeText,
};
