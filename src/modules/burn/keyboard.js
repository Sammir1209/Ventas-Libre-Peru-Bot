const { InlineKeyboard } = require('grammy');
const { CB, SYM } = require('../../config/constants');
const { toMathBold, btn } = require('../../utils/aesthetic');

/**
 * Teclado inicial para elegir método de identificación del acusado.
 */
function burnTargetTypeKeyboard() {
  return new InlineKeyboard()
    .text(btn('POR ID NUMERICO', '◈', '◈'), 'burn_type:id').primary()
    .text(btn('POR USERNAME', '◇', '◇'), 'burn_type:username').primary()
    .row()
    .text(btn('CANCELAR', '✕', '✕'), 'burn_cancel').danger();
}

/**
 * Teclado durante la espera de ID o Username o Contexto.
 */
function burnCancelOnlyKeyboard() {
  return new InlineKeyboard().text(btn('CANCELAR', '✕', '✕'), 'burn_cancel').danger();
}

/**
 * Teclado durante la subida de pruebas/capturas.
 */
function burnProofUploadKeyboard(hasProofs = false) {
  const kb = new InlineKeyboard();
  if (hasProofs) {
    kb.text(btn('CONTINUAR', '✦', '✦'), 'burn_review').success();
  }
  kb.text(btn('CANCELAR', '✕', '✕'), 'burn_cancel').danger();
  return kb;
}

/**
 * Teclado del resumen final antes de enviar:
 */
function burnSummaryKeyboard() {
  return new InlineKeyboard()
    .text(btn('QUEMAR', '✦', '✦'), 'burn_confirm_send').danger()
    .text(btn('EDITAR', '⌥', '⌥'), 'burn_edit_menu').primary()
    .row()
    .text(btn('CANCELAR', '✕', '✕'), 'burn_cancel').danger();
}

/**
 * Menú interactivo de edición.
 */
function burnEditMenuKeyboard() {
  return new InlineKeyboard()
    .text(btn('ACUSADO', '▸', '▸'), 'burn_edit:target').primary()
    .text(btn('DESCRIPCION', '▸', '▸'), 'burn_edit:context').primary()
    .row()
    .text(btn('PRUEBAS', '▸', '▸'), 'burn_edit:proofs').primary()
    .text(btn('RESUMEN', '▸', '▸'), 'burn_edit:back').primary()
    .row()
    .text(btn('CANCELAR', '✕', '✕'), 'burn_cancel').danger();
}

/**
 * Teclado de moderación para el Staff en el reporte.
 */
function burnStaffKeyboard(reportId) {
  return new InlineKeyboard()
    .text(btn('APROBAR GBAN', '✦', '✦'), `${CB.BURN_APPROVE}${reportId}`).danger()
    .text(btn('RECHAZAR', '✕', '✕'), `${CB.BURN_REJECT}${reportId}`).primary()
    .row()
    .text(btn('BAN REPORTANTE', '!', '!'), `${CB.BURN_BAN_REPORTER}${reportId}`).danger();
}

module.exports = {
  burnTargetTypeKeyboard,
  burnCancelOnlyKeyboard,
  burnProofUploadKeyboard,
  burnSummaryKeyboard,
  burnEditMenuKeyboard,
  burnStaffKeyboard,
};
