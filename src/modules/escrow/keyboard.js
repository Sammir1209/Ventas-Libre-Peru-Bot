const { InlineKeyboard } = require('grammy');
const { SYM, CB } = require('../../config/constants');
const config = require('../../config/env');

// ══════════════════════════════════════════════════════
// ⟡ Teclados del Sistema Escrow (Tratos Admin)
// ══════════════════════════════════════════════════════

/**
 * Teclado principal de /tratoadm.
 */
function dealMainKeyboard() {
  return new InlineKeyboard()
    .text('TRATO ADMIN', CB.START_DEAL).success()
    .text('INFORMACION', CB.DEAL_INFO).success()
    .row()
    .text('CANCELAR', CB.DEAL_CANCEL).danger();
}

/**
 * Teclado para la vista detallada de información con botón Volver en verde.
 */
function dealInfoKeyboard() {
  return new InlineKeyboard()
    .text('VOLVER', 'deal_back_to_main').success();
}

/**
 * Teclado para seleccionar el rol (Vendedor / Comprador).
 */
function dealRoleKeyboard() {
  return new InlineKeyboard()
    .text('VOY A VENDER', 'deal_role:VENDEDOR').success()
    .text('VOY A COMPRAR', 'deal_role:COMPRADOR').success()
    .row()
    .text('CANCELAR', CB.DEAL_CANCEL).danger();
}

/**
 * Teclado solo con botón cancelar durante la escritura de datos.
 */
function dealCancelKeyboard() {
  return new InlineKeyboard()
    .text('CANCELAR SOLICITUD', CB.DEAL_CANCEL).danger();
}

/**
 * Teclado de confirmación de los datos ingresados.
 */
function dealConfirmKeyboard() {
  return new InlineKeyboard()
    .text('CONFIRMAR', 'deal_confirm').success()
    .text('CANCELAR', CB.DEAL_CANCEL).danger();
}

/**
 * Teclado en estado de espera con botón Canal Oficial y Cancelar (2 lado a lado).
 */
function dealWaitingKeyboard(dealId) {
  const kb = new InlineKeyboard();

  const channelUrl = config.GROUPS_FOLDER_LINK || 'https://t.me/+JSQRh7463MIzYmVh';
  kb.url('CANAL OFICIAL', channelUrl);
  kb.text('CANCELAR', `deal_cancel_pending:${dealId}`).danger();

  return kb;
}

/**
 * Teclado para que un admin acepte o rechace un trato.
 */
function dealAcceptKeyboard(dealId) {
  return new InlineKeyboard()
    .text('ACEPTAR', `${CB.DEAL_ACCEPT}${dealId}`).success()
    .text('RECHAZAR', `deal_reject:${dealId}`).danger();
}

/**
 * Teclado para completar un trato.
 */
function dealCompleteKeyboard(dealId) {
  return new InlineKeyboard()
    .text('FINALIZAR', `${CB.DEAL_COMPLETE}${dealId}`).success()
    .text('CANCELAR', `deal_force_cancel:${dealId}`).danger();
}

/**
 * Teclado de calificación (1-5 estrellas).
 */
function dealRatingKeyboard(dealId) {
  return new InlineKeyboard()
    .text('1 ESTRELLA', `${CB.DEAL_RATE}${dealId}:1`)
    .text('2 ESTRELLAS', `${CB.DEAL_RATE}${dealId}:2`)
    .text('3 ESTRELLAS', `${CB.DEAL_RATE}${dealId}:3`)
    .row()
    .text('4 ESTRELLAS', `${CB.DEAL_RATE}${dealId}:4`)
    .text('5 ESTRELLAS', `${CB.DEAL_RATE}${dealId}:5`);
}

/**
 * Teclado fijado dentro del hilo/topic para control del trato.
 */
function dealTopicKeyboard(dealId) {
  return new InlineKeyboard()
    .text('FINALIZAR', `${CB.DEAL_COMPLETE}${dealId}`).success()
    .text('CANCELAR', `deal_force_cancel:${dealId}`).danger();
}

module.exports = {
  dealMainKeyboard,
  dealInfoKeyboard,
  dealRoleKeyboard,
  dealCancelKeyboard,
  dealConfirmKeyboard,
  dealWaitingKeyboard,
  dealAcceptKeyboard,
  dealCompleteKeyboard,
  dealTopicKeyboard,
  dealRatingKeyboard,
};
