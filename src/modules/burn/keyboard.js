const { InlineKeyboard } = require('grammy');
const { CB, SYM } = require('../../config/constants');
const { toMathBold } = require('../../utils/aesthetic');

/**
 * Teclado inicial para elegir método de identificación del acusado.
 */
function burnTargetTypeKeyboard() {
  return new InlineKeyboard()
    .text(toMathBold('POR ID NUMÉRICO'), 'burn_type:id').primary()
    .text(toMathBold('POR USERNAME'), 'burn_type:username').primary()
    .row()
    .text(toMathBold('CANCELAR'), 'burn_cancel').danger();
}

/**
 * Teclado durante la espera de ID o Username o Contexto.
 */
function burnCancelOnlyKeyboard() {
  return new InlineKeyboard().text(toMathBold('CANCELAR'), 'burn_cancel').danger();
}

/**
 * Teclado durante la subida de pruebas/capturas.
 */
function burnProofUploadKeyboard(hasProofs = false) {
  const kb = new InlineKeyboard();
  if (hasProofs) {
    kb.text(toMathBold('CONTINUAR'), 'burn_review').success();
  }
  kb.text(toMathBold('CANCELAR'), 'burn_cancel').danger();
  return kb;
}

/**
 * Teclado del resumen final antes de enviar:
 */
function burnSummaryKeyboard() {
  return new InlineKeyboard()
    .text(toMathBold('QUEMAR'), 'burn_confirm_send').danger()
    .text(toMathBold('EDITAR'), 'burn_edit_menu').primary()
    .row()
    .text(toMathBold('CANCELAR'), 'burn_cancel').danger();
}

/**
 * Menú interactivo de edición.
 */
function burnEditMenuKeyboard() {
  return new InlineKeyboard()
    .text(toMathBold('ACUSADO'), 'burn_edit:target').primary()
    .text(toMathBold('DESCRIPCIÓN'), 'burn_edit:context').primary()
    .row()
    .text(toMathBold('PRUEBAS'), 'burn_edit:proofs').primary()
    .text(toMathBold('RESUMEN'), 'burn_edit:back').primary()
    .row()
    .text(toMathBold('CANCELAR'), 'burn_cancel').danger();
}

/**
 * Teclado de moderación para el Staff en el reporte.
 */
function burnStaffKeyboard(reportId) {
  return new InlineKeyboard()
    .text(toMathBold('APROBAR GBAN'), `${CB.BURN_APPROVE}${reportId}`).danger()
    .text(toMathBold('RECHAZAR'), `${CB.BURN_REJECT}${reportId}`).primary()
    .row()
    .text(toMathBold('BAN REPORTANTE'), `${CB.BURN_BAN_REPORTER}${reportId}`).danger();
}

module.exports = {
  burnTargetTypeKeyboard,
  burnCancelOnlyKeyboard,
  burnProofUploadKeyboard,
  burnSummaryKeyboard,
  burnEditMenuKeyboard,
  burnStaffKeyboard,
};
