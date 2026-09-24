const { InlineKeyboard } = require('grammy');
const { SYM, CB } = require('../../config/constants');
const { toMathBold } = require('../../utils/aesthetic');
const config = require('../../config/env');

// ══════
// ⟡ Teclados del Sistema Escrow (Tratos Admin)
// ══════

/**
 * Teclado principal de /tratoadm.
 */
function dealMainKeyboard() {
  return new InlineKeyboard()
    .text(toMathBold('TRATO ADMIN'), CB.START_DEAL).success()
    .text(toMathBold('INFORMACIÓN'), CB.DEAL_INFO).primary()
    .row()
    .text(toMathBold('CANCELAR'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado para la vista detallada de información con botón Volver.
 */
function dealInfoKeyboard() {
  return new InlineKeyboard()
    .text(toMathBold('VOLVER'), 'deal_back_to_main').primary();
}

/**
 * Teclado para seleccionar el rol (Vendedor / Comprador).
 */
function dealRoleKeyboard() {
  return new InlineKeyboard()
    .text(toMathBold('VOY A VENDER'), 'deal_role:VENDEDOR').primary()
    .text(toMathBold('VOY A COMPRAR'), 'deal_role:COMPRADOR').primary()
    .row()
    .text(toMathBold('CANCELAR'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado solo con botón cancelar durante la escritura de datos.
 */
function dealCancelKeyboard() {
  return new InlineKeyboard()
    .text(toMathBold('CANCELAR SOLICITUD'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado de confirmación de los datos ingresados.
 */
function dealConfirmKeyboard() {
  return new InlineKeyboard()
    .text(toMathBold('CONFIRMAR'), 'deal_confirm').success()
    .text(toMathBold('CANCELAR'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado en estado de espera con botón Canal Oficial y Cancelar.
 */
function dealWaitingKeyboard(dealId) {
  const kb = new InlineKeyboard();

  const channelUrl = config.GROUPS_FOLDER_LINK || 'https://t.me/+JSQRh7463MIzYmVh';
  kb.url(toMathBold('CANAL OFICIAL'), channelUrl);
  kb.text(toMathBold('CANCELAR'), `deal_cancel_pending:${dealId}`).danger();

  return kb;
}

/**
 * Teclado para que un admin acepte o rechace un trato.
 */
function dealAcceptKeyboard(dealId) {
  return new InlineKeyboard()
    .text(toMathBold('ACEPTAR'), `${CB.DEAL_ACCEPT}${dealId}`).success()
    .text(toMathBold('RECHAZAR'), `deal_reject:${dealId}`).danger();
}

/**
 * Teclado para completar un trato.
 */
function dealCompleteKeyboard(dealId) {
  return new InlineKeyboard()
    .text(toMathBold('FINALIZAR'), `${CB.DEAL_COMPLETE}${dealId}`).success()
    .text(toMathBold('CANCELAR'), `deal_force_cancel:${dealId}`).danger();
}

/**
 * Teclado de calificación (1-5 estrellas).
 */
function dealRatingKeyboard(dealId) {
  return new InlineKeyboard()
    .text(toMathBold('⭐ 1'), `${CB.DEAL_RATE}${dealId}:1`).primary()
    .text(toMathBold('⭐⭐ 2'), `${CB.DEAL_RATE}${dealId}:2`).primary()
    .text(toMathBold('⭐⭐⭐ 3'), `${CB.DEAL_RATE}${dealId}:3`).primary()
    .row()
    .text(toMathBold('⭐⭐⭐⭐ 4'), `${CB.DEAL_RATE}${dealId}:4`).success()
    .text(toMathBold('⭐⭐⭐⭐⭐ 5'), `${CB.DEAL_RATE}${dealId}:5`).success();
}

/**
 * Teclado fijado dentro del hilo/topic para control del trato.
 */
function dealTopicKeyboard(dealId) {
  return new InlineKeyboard()
    .text(toMathBold('FINALIZAR'), `${CB.DEAL_COMPLETE}${dealId}`).success()
    .text(toMathBold('CANCELAR'), `deal_force_cancel:${dealId}`).danger();
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
