const { InlineKeyboard } = require('grammy');
const { CB, SYM } = require('../../config/constants');

/**
 * Teclado inicial para elegir método de identificación del acusado.
 */
function burnTargetTypeKeyboard() {
  return new InlineKeyboard()
    .text('🆔 Por ID Numérico', 'burn_type:id').primary()
    .text('👤 Por @Username', 'burn_type:username').primary()
    .row()
    .text(`${SYM.CROSS} Cancelar`, 'burn_cancel').danger();
}

/**
 * Teclado durante la subida de pruebas/capturas.
 */
function burnProofUploadKeyboard() {
  return new InlineKeyboard()
    .text(`${SYM.CHECK} Listo, revisar reporte`, 'burn_review').primary()
    .row()
    .text(`${SYM.CROSS} Cancelar`, 'burn_cancel').danger();
}

/**
 * Teclado del resumen final antes de enviar:
 * Fila 1 (2 al lado): [ ✏️ Editar ] [ ✗ Cancelar ]
 * Fila 2 (debajo con verde): [ 🔥 Quemar ]
 */
function burnSummaryKeyboard() {
  return new InlineKeyboard()
    .text('✏️ Editar', 'burn_edit_menu').primary()
    .text(`${SYM.CROSS} Cancelar`, 'burn_cancel').danger()
    .row()
    .text('🔥 Quemar', 'burn_confirm_send').success();
}

/**
 * Menú interactivo de edición.
 */
function burnEditMenuKeyboard() {
  return new InlineKeyboard()
    .text('👤 Acusado', 'burn_edit:target').primary()
    .text('📝 Descripción', 'burn_edit:context').primary()
    .row()
    .text('📸 Pruebas', 'burn_edit:proofs').primary()
    .text('« Resumen', 'burn_edit:back').primary()
    .row()
    .text(`${SYM.CROSS} Cancelar Reporte`, 'burn_cancel').danger();
}

/**
 * Teclado de moderación para el Staff en el reporte.
 */
function burnStaffKeyboard(reportId) {
  return new InlineKeyboard()
    .text(`${SYM.DIAMOND} Aprobar y Quemar`, `${CB.BURN_APPROVE}${reportId}`).danger()
    .row()
    .text(`${SYM.ARROW} Rechazar`, `${CB.BURN_REJECT}${reportId}`).primary()
    .text(`${SYM.CROSS} Banear Reportante`, `${CB.BURN_BAN_REPORTER}${reportId}`).danger();
}

module.exports = {
  burnTargetTypeKeyboard,
  burnProofUploadKeyboard,
  burnSummaryKeyboard,
  burnEditMenuKeyboard,
  burnStaffKeyboard,
};
