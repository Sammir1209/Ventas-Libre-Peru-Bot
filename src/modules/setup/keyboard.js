const { InlineKeyboard } = require('grammy');
const { btn } = require('../../utils/aesthetic');

// ══════
// ⟡ Teclados para el Centro de Configuración y Guía (/setup) — Estética Oriental & Bold (Cero Emojis)
// ══════

function setupMainMenuKeyboard() {
  return new InlineKeyboard()
    .text(btn('1. SALA DE TRATOS ADMIN', '⚖', '⚖'), 'setup_mod:escrow').primary()
    .row()
    .text(btn('2. CANALES Y LOGS', '⌥', '⌥'), 'setup_mod:channels').primary()
    .row()
    .text(btn('3. GESTION DE STAFF', '◈', '◈'), 'setup_mod:staff').primary()
    .row()
    .text(btn('4. ANTI-ESTAFAS Y QUEMAR', '✦', '✦'), 'setup_mod:burn').primary()
    .row()
    .text(btn('5. VERIFICACION DE MIEMBROS', '〔', '〕'), 'setup_mod:verify').primary()
    .row()
    .text(btn('CERRAR GUIA', '✕', '✕'), 'setup_close').danger();
}

function setupSectionKeyboard(currentSection) {
  return new InlineKeyboard()
    .text(btn('VOLVER AL MENU', '«', '»'), 'setup_back_main').primary()
    .text(btn('CERRAR', '✕', '✕'), 'setup_close').danger();
}

module.exports = {
  setupMainMenuKeyboard,
  setupSectionKeyboard,
};
