// ══════
// ⟡ Sub-Agente 3: UIAgent (Experiencia HUD & Mensajes Optimizados para Móviles)
//   Diseño Obsidian Glassmorphism, Zero Emojis gráficos, tipografía unicode compacta
// ══════

const { InlineKeyboard } = require('grammy');
const { escapeHtml, getSuperscriptDate } = require('../../../utils/formatting');
const { toMathBold } = require('../../../utils/aesthetic');
const config = require('../../../config/env');

class UIAgent {
  /**
   * Genera el mensaje de bienvenida ultra-compacto optimizado para pantallas táctiles.
   */
  static renderWelcomeMessage(user, communityName = 'Ventas Libres Perú') {
    const mention = user.username
      ? `@${user.username}`
      : `<b>${escapeHtml(user.first_name || 'Usuario')}</b>`;

    const cleanCommunity = (communityName || 'Ventas Libres Perú').trim();
    const botLabel = cleanCommunity.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || cleanCommunity;
    const dateFormatted = getSuperscriptDate();

    return (
      `⟡ <b>[VERIFICACIÓN OFICIAL]</b> ⊱ <code>${escapeHtml(botLabel.toUpperCase())}</code> ⊰\n` +
      `──────\n` +
      `▸ Hola, ${mention} • <b>Silenciado preventivamente</b>\n` +
      `▸ <b>Paso 1:</b> Pulsa <b>UNIRME</b> para acceder a los canales.\n` +
      `▸ <b>Paso 2:</b> Pulsa <b>VERIFICAR</b> para desbloquear tu acceso.\n\n` +
      `<i>Proceso automático y seguro en 3 segundos.</i>\n` +
      `──────\n` +
      `${dateFormatted}`
    );
  }

  /**
   * Genera el teclado táctil compacto con botones alineados.
   */
  static renderWelcomeKeyboard(userId, customFolderUrl = null) {
    const kb = new InlineKeyboard();
    const folderLink = customFolderUrl || config.GROUPS_FOLDER_LINK || 'https://t.me/addlist/PodUrc_gHJs2ZjNh';

    // Fila 1: Botones principales lado a lado
    kb.url(`❖ ${toMathBold('UNIRME')}`, folderLink).primary();
    kb.text(`✦ ${toMathBold('VERIFICAR')}`, `verify:${userId}`).success();

    // Fila 2: Botón de descarte
    kb.row();
    kb.text(`✕ ${toMathBold('CANCELAR')}`, `verify_cancel:${userId}`).danger();

    return kb;
  }

  /**
   * Mensaje de éxito tras completar la verificación.
   */
  static renderSuccessMessage(user, communityName = 'Ventas Libres Perú') {
    const mention = user.username
      ? `@${user.username}`
      : `<b>${escapeHtml(user.first_name || 'Usuario')}</b>`;

    const cleanCommunity = (communityName || 'Ventas Libres Perú').trim();
    const dateFormatted = getSuperscriptDate();

    return (
      `⟡ <b>[ACCESO AUTORIZADO]</b> ⊱ <code>${escapeHtml(cleanCommunity.toUpperCase())}</code> ⊰\n` +
      `──────\n` +
      `▸ ${mention} • <b>Membresía validada con éxito [ ✓ ]</b>\n` +
      `<i>Ya puedes participar, enviar mensajes y comerciar libremente.</i>\n` +
      `──────\n` +
      `${dateFormatted}`
    );
  }
}

module.exports = UIAgent;

