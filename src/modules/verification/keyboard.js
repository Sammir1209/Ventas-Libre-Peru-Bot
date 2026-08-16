const { InlineKeyboard } = require('grammy');
const config = require('../../config/env');
const { SYM, CB } = require('../../config/constants');

// ══════════════════════════════════════════════════════
// ⟡ Teclados de Verificación
// ══════════════════════════════════════════════════════

/**
 * Teclado de bienvenida limpio con 1 solo botón de Folder/Canales + Verificar + ¿Cómo funciona?
 */
function welcomeKeyboard() {
  const kb = new InlineKeyboard();

  const folderLink = config.GROUPS_FOLDER_LINK || 'https://t.me/quemando_ventaslibreperu';

  // Fila 1: [ ⟡ Unirme a los Canales ] | [ ✓ Verificar ]
  kb.url(`${SYM.DIAMOND} Unirme a los Canales`, folderLink);
  kb.text(`${SYM.CHECK} Verificar`, CB.VERIFY).success().row();

  // Fila 2: [ ❓ ¿Cómo funciona? ]
  kb.text(`${SYM.ARROW} ¿Cómo funciona?`, CB.HOW_IT_WORKS);

  return kb;
}

module.exports = {
  welcomeKeyboard,
};
