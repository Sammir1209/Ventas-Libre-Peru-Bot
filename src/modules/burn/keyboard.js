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
    .text(`✓ Revisar`, 'burn_review').primary()
    .text(`✗ Cancelar`, 'burn_cancel').danger();
}

/**
 * Teclado del resumen final antes de enviar:
 * Fila 1: [ 🔥 Quemar ] [ ✏️ Editar ]
 * Fila 2: [ ✗ Cancelar ]
 */
function burnSummaryKeyboard() {
  return new InlineKeyboard()
    .text('🔥 Quemar', 'burn_confirm_send').success()
    .text('✏️ Editar', 'burn_edit_menu').primary()
    .row()
    .text('✗ Cancelar', 'burn_cancel').danger();
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
    .text(`✗ Cancelar`, 'burn_cancel').danger();
}

/**
 * Teclado de moderación para el Staff en el reporte.
 */
function burnStaffKeyboard(reportId) {
  return new InlineKeyboard()
    .text(`✓ Aprobar`, `${CB.BURN_APPROVE}${reportId}`).danger()
    .text(`✗ Rechazar`, `${CB.BURN_REJECT}${reportId}`).primary()
    .row()
    .text(`⛔ Ban Reportante`, `${CB.BURN_BAN_REPORTER}${reportId}`).danger();
}

module.exports = {
  burnTargetTypeKeyboard,
  burnProofUploadKeyboard,
  burnSummaryKeyboard,
  burnEditMenuKeyboard,
  burnStaffKeyboard,
};
