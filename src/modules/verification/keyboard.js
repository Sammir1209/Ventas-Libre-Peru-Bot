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

  // Fila 1 (2 botones arriba): [ UNIRME ] | [ VERIFICAR ]
  kb.url('UNIRME', folderLink);
  kb.text('VERIFICAR', verifyData);

  // Fila 2 (1 botón abajo centrado): [ CANCELAR ]
  kb.row();
  kb.text('CANCELAR', cancelData);

  return kb;
}

module.exports = {
  welcomeKeyboard,
};
