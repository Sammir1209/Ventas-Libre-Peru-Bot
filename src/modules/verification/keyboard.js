const { InlineKeyboard } = require('grammy');
const config = require('../../config/env');
const { SYM, CB } = require('../../config/constants');

// ══════════════════════════════════════════════════════
// ⟡ Teclados de Verificación
// ══════════════════════════════════════════════════════

/**
 * Teclado de bienvenida con botones cortos alineados uno al costado del otro
 */
function welcomeKeyboard(targetUserId = null) {
  const kb = new InlineKeyboard();

  const folderLink = config.GROUPS_FOLDER_LINK || 'https://t.me/addlist/wJgsKg3dZCQ4Njlh';
  const verifyData = targetUserId ? `verify:${targetUserId}` : CB.VERIFY;
  const cancelData = targetUserId ? `verify_cancel:${targetUserId}` : 'verify_cancel';

  // Fila 1 (2 botones arriba): [ ⟡ Unirme ] | [ ✓ Verificar ]
  kb.url(`⟡ Unirme`, folderLink);
  kb.text(`✓ Verificar`, verifyData);

  // Fila 2 (1 botón abajo centrado): [ ✗ Cancelar ]
  kb.row();
  kb.text(`✗ Cancelar`, cancelData);

  return kb;
}

module.exports = {
  welcomeKeyboard,
};
