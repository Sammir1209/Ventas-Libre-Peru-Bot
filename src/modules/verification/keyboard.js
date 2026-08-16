const { InlineKeyboard } = require('grammy');
const config = require('../../config/env');
const { SYM, CB } = require('../../config/constants');

// ══════════════════════════════════════════════════════
// ⟡ Teclados de Verificación
// ══════════════════════════════════════════════════════

/**
 * Teclado de bienvenida con botones de los 3 canales + Verificar + ¿Cómo funciona?
 */
function welcomeKeyboard() {
  const kb = new InlineKeyboard();

  // Si hay un Folder Link configurado se muestra, además de los canales obligatorios
  if (config.GROUPS_FOLDER_LINK && !config.GROUPS_FOLDER_LINK.includes('+')) {
    kb.url(`${SYM.DIAMOND} 📁 Unirme al Folder Oficial`, config.GROUPS_FOLDER_LINK).row();
  }

  // Botones de los 3 canales obligatorios (2 en fila 1, 1 en fila 2)
  kb.url('🔥 Canal Quemados', 'https://t.me/quemando_ventaslibreperu');
  kb.url('⭐ Canal Refes #1', 'https://t.me/+vRTkqW3Hba9jZDIx').row();
  kb.url('📦 Canal Refes #2', 'https://t.me/+JSQRh7463MIzYmVh').row();

  // Fila de acción: Verificar membresía en verde
  kb.text(`${SYM.CHECK} Verificar Membresía`, CB.VERIFY).success().row();

  // Fila de ayuda
  kb.text(`${SYM.ARROW} ¿Cómo funciona?`, CB.HOW_IT_WORKS);

  return kb;
}

module.exports = {
  welcomeKeyboard,
};
