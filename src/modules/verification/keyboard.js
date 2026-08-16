const { InlineKeyboard } = require('grammy');
const config = require('../../config/env');
const { SYM, CB } = require('../../config/constants');

// ══════════════════════════════════════════════════════
// ⟡ Teclados de Verificación
// ══════════════════════════════════════════════════════

/**
 * Teclado de bienvenida con Unirme + Verificar + ¿Cómo funciona?
 */
function welcomeKeyboard() {
  const kb = new InlineKeyboard();

  // Fila 1: Unirme (verde) | Verificar (verde/success)
  if (config.GROUPS_FOLDER_LINK) {
    kb.url(`${SYM.DIAMOND} Unirme`, config.GROUPS_FOLDER_LINK).success();
  }
  kb.text(`${SYM.STAR} Verificar`, CB.VERIFY).success();

  // Fila 2: ¿Cómo funciona?
  kb.row();
  kb.text(`${SYM.ARROW} ¿Cómo funciona?`, CB.HOW_IT_WORKS);

  return kb;
}

module.exports = {
  welcomeKeyboard,
};
