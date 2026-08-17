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

  // Fila única: [ ⟡ Unirme ] | [ ✓ Verificar ] | [ ✗ Cancelar ] (uno al costado del otro)
  kb.url(`⟡ Unirme`, folderLink);
  kb.text(`✓ Verificar`, verifyData).success();
  kb.text(`✗ Cancelar`, cancelData).danger();

  return kb;
}

module.exports = {
  welcomeKeyboard,
};
