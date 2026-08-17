const { InlineKeyboard } = require('grammy');
const config = require('../../config/env');
const { SYM, CB } = require('../../config/constants');

// ══════════════════════════════════════════════════════
// ⟡ Teclados de Verificación
// ══════════════════════════════════════════════════════

/**
 * Teclado de bienvenida con botón de Folder y acción vinculada al ID del usuario
 */
function welcomeKeyboard(targetUserId = null) {
  const kb = new InlineKeyboard();

  const folderLink = config.GROUPS_FOLDER_LINK || 'https://t.me/addlist/wJgsKg3dZCQ4Njlh';
  const verifyData = targetUserId ? `verify:${targetUserId}` : CB.VERIFY;
  const howData = targetUserId ? `how_it_works:${targetUserId}` : CB.HOW_IT_WORKS;

  // Fila 1: [ ⟡ Unirme a los Canales ] | [ ✓ Verificar ]
  kb.url(`${SYM.DIAMOND} Unirme a los Canales`, folderLink);
  kb.text(`${SYM.CHECK} Verificar`, verifyData).success().row();

  // Fila 2: [ ❓ ¿Cómo funciona? ]
  kb.text(`${SYM.ARROW} ¿Cómo funciona?`, howData);

  return kb;
}

module.exports = {
  welcomeKeyboard,
};
