const { InlineKeyboard } = require('grammy');

// ══════
// ⟡ Teclados para el Centro de Configuración y Guía (/setup)
// ══════

function setupMainMenuKeyboard() {
  return new InlineKeyboard()
    .text('1. SALA DE TRATOS ADMIN', 'setup_mod:escrow').primary()
    .row()
    .text('2. CANALES Y LOGS', 'setup_mod:channels').primary()
    .row()
    .text('3. GESTION DE STAFF', 'setup_mod:staff').primary()
    .row()
    .text('4. ANTI-ESTAFAS Y QUEMAR', 'setup_mod:burn').primary()
    .row()
    .text('5. VERIFICACION DE MIEMBROS', 'setup_mod:verify').primary()
    .row()
    .text('CERRAR GUIA', 'setup_close').danger();
}

function setupSectionKeyboard(currentSection) {
  return new InlineKeyboard()
    .text('VOLVER AL MENU', 'setup_back_main').primary()
    .text('CERRAR', 'setup_close').danger();
}

module.exports = {
  setupMainMenuKeyboard,
  setupSectionKeyboard,
};
