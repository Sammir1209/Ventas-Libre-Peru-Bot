const { InlineKeyboard } = require('grammy');
const { CB, SYM } = require('../../config/constants');

/**
 * Teclado inicial para elegir método de identificación del acusado.
 */
function burnTargetTypeKeyboard() {
  return new InlineKeyboard()
    .text('POR ID NUMERICO', 'burn_type:id').primary()
    .text('POR USERNAME', 'burn_type:username').primary()
    .row()
    .text('CANCELAR', 'burn_cancel').danger();
}

/**
 * Teclado durante la espera de ID o Username o Contexto.
 */
function burnCancelOnlyKeyboard() {
  return new InlineKeyboard().text('CANCELAR', 'burn_cancel').danger();
}

/**
 * Teclado durante la subida de pruebas/capturas.
 */
function burnProofUploadKeyboard(hasProofs = false) {
  const kb = new InlineKeyboard();
  if (hasProofs) {
    kb.text('CONTINUAR', 'burn_review').primary();
  }
  kb.text('CANCELAR', 'burn_cancel').danger();
  return kb;
}

/**
 * Teclado del resumen final antes de enviar:
 */
function burnSummaryKeyboard() {
  return new InlineKeyboard()
    .text('QUEMAR', 'burn_confirm_send').danger()
    .text('EDITAR', 'burn_edit_menu').primary()
    .row()
    .text('CANCELAR', 'burn_cancel').danger();
}

/**
 * Menú interactivo de edición.
 */
function burnEditMenuKeyboard() {
  return new InlineKeyboard()
    .text('ACUSADO', 'burn_edit:target').primary()
    .text('DESCRIPCION', 'burn_edit:context').primary()
    .row()
    .text('PRUEBAS', 'burn_edit:proofs').primary()
    .text('RESUMEN', 'burn_edit:back').primary()
    .row()
    .text('CANCELAR', 'burn_cancel').danger();
}

/**
 * Teclado de moderación para el Staff en el reporte.
 */
function burnStaffKeyboard(reportId) {
  return new InlineKeyboard()
    .text('APROBAR', `${CB.BURN_APPROVE}${reportId}`).danger()
    .text('RECHAZAR', `${CB.BURN_REJECT}${reportId}`).primary()
    .row()
    .text('BAN REPORTANTE', `${CB.BURN_BAN_REPORTER}${reportId}`).danger();
}

module.exports = {
  burnTargetTypeKeyboard,
  burnCancelOnlyKeyboard,
  burnProofUploadKeyboard,
  burnSummaryKeyboard,
  burnEditMenuKeyboard,
  burnStaffKeyboard,
};
