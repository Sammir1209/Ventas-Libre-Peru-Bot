const { InlineKeyboard } = require('grammy');
const config = require('../../config/env');
const { SYM, CB } = require('../../config/constants');

// ══════
// ⟡ Teclados de Verificación
// ══════

/**
 * Teclado de bienvenida con botones cortos alineados uno al costado del otro
 */
function welcomeKeyboard(targetUserId = null, customFolderUrl = null) {
  const kb = new InlineKeyboard();

  const folderLink = customFolderUrl || config.VERIFY_WEB_URL || config.GROUPS_FOLDER_LINK || 'https://ventas-libre-peru-bot-2y5n.onrender.com/verificar';
  const verifyData = targetUserId ? `verify:${targetUserId}` : CB.VERIFY;
  const cancelData = targetUserId ? `verify_cancel:${targetUserId}` : 'verify_cancel';

  // Fila 1: [ UNIRME ] (Lleva a la web/carpeta oficial de canales) | [ VERIFICAR ] (Evalúa si ya se unió)
  kb.url('UNIRME', folderLink);
  kb.text('VERIFICAR', verifyData);

  // Fila 2: [ CANCELAR ]
  kb.row();
  kb.text('CANCELAR', cancelData);

  return kb;
}

module.exports = {
  welcomeKeyboard,
};
