const { InlineKeyboard } = require('grammy');
if (!InlineKeyboard.prototype.primary) InlineKeyboard.prototype.primary = function() { return this; };
if (!InlineKeyboard.prototype.danger) InlineKeyboard.prototype.danger = function() { return this; };
if (!InlineKeyboard.prototype.success) InlineKeyboard.prototype.success = function() { return this; };
const { SYM, CB } = require('../../config/constants');
const { toMathBold, btn } = require('../../utils/aesthetic');
const config = require('../../config/env');

// ══════
// ⟡ Teclados del Sistema Escrow (Tratos Admin 2.0) — Estética Oriental y Cero Emojis
// ══════

/**
 * Teclado principal de /tratoadm.
 */
function dealMainKeyboard() {
  return new InlineKeyboard()
    .text(btn('INICIAR TRATO', '⚖', '⚖'), CB.START_DEAL).success()
    .text(btn('INFORMACION', '⌥', '⌥'), CB.DEAL_INFO).primary()
    .row()
    .text(btn('MIS TRATOS', '◈', '◈'), 'deal_my_deals').primary()
    .text(btn('CALCULAR TARIFA', '⟡', '⟡'), 'deal_calc_menu').primary()
    .row()
    .text(btn('SALIR', '✕', '✕'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado para la vista detallada de información con botón Iniciar y Volver.
 */
function dealInfoKeyboard() {
  return new InlineKeyboard()
    .text(btn('INICIAR TRATO AHORA', '⚖', '⚖'), CB.START_DEAL).success()
    .row()
    .text(btn('VOLVER AL MENU', '«', '»'), 'deal_back_to_main').primary();
}

/**
 * Teclado para seleccionar el rol (Vendedor / Comprador).
 */
function dealRoleKeyboard() {
  return new InlineKeyboard()
    .text(btn('VOY A VENDER', '◈', '◈'), 'deal_role:VENDEDOR').primary()
    .text(btn('VOY A COMPRAR', '◇', '◇'), 'deal_role:COMPRADOR').primary()
    .row()
    .text(btn('CANCELAR SOLICITUD', '✕', '✕'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado para selección de categoría del bien o servicio.
 */
function dealCategoryKeyboard() {
  return new InlineKeyboard()
    .text(btn('Cuentas / Juegos', '◆', '◆'), 'deal_cat:CUENTAS').primary()
    .text(btn('Streaming', '◆', '◆'), 'deal_cat:STREAMING').primary()
    .row()
    .text(btn('Cripto / Saldo', '◆', '◆'), 'deal_cat:CRIPTO').primary()
    .text(btn('Redes / Canales', '◆', '◆'), 'deal_cat:REDES').primary()
    .row()
    .text(btn('Producto Fisico', '◆', '◆'), 'deal_cat:FISICO').primary()
    .text(btn('Otro Trato', '◆', '◆'), 'deal_cat:OTRO').primary()
    .row()
    .text(btn('CANCELAR', '✕', '✕'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado para selección de moneda (PEN, USD, USDT).
 */
function dealCurrencyKeyboard() {
  return new InlineKeyboard()
    .text(btn('Soles (PEN)', '§', '§'), 'deal_curr:PEN').primary()
    .text(btn('Dolares (USD)', '§', '§'), 'deal_curr:USD').primary()
    .text(btn('USDT (Binance)', '§', '§'), 'deal_curr:USDT').primary()
    .row()
    .text(btn('CANCELAR', '✕', '✕'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado para selección de método de pago.
 */
function dealPaymentMethodKeyboard() {
  return new InlineKeyboard()
    .text(btn('Yape / Plin', '▸', '▸'), 'deal_pay:YAPE_PLIN').primary()
    .text(btn('Banco BCP / BBVA', '▸', '▸'), 'deal_pay:BANCO').primary()
    .row()
    .text(btn('Binance Pay', '▸', '▸'), 'deal_pay:BINANCE').primary()
    .text(btn('En Sala (Coordinar)', '▸', '▸'), 'deal_pay:EN_SALA').primary()
    .row()
    .text(btn('CANCELAR', '✕', '✕'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado solo con botón cancelar durante la escritura de datos.
 */
function dealCancelKeyboard() {
  return new InlineKeyboard()
    .text(btn('CANCELAR SOLICITUD', '✕', '✕'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado de confirmación de los datos ingresados en el wizard.
 */
function dealConfirmKeyboard() {
  return new InlineKeyboard()
    .text(btn('ENVIAR AL STAFF', '✦', '✦'), 'deal_confirm').success()
    .row()
    .text(btn('CANCELAR', '✕', '✕'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado en estado de espera con botón Canal Oficial y Cancelar.
 */
function dealWaitingKeyboard(dealId) {
  const kb = new InlineKeyboard();

  const channelUrl = config.GROUPS_FOLDER_LINK || 'https://t.me/addlist/PodUrc_gHJs2ZjNh';
  kb.url(btn('CANALES OFICIALES', '〔', '〕'), channelUrl);
  kb.text(btn('CANCELAR SOLICITUD', '✕', '✕'), `deal_cancel_pending:${dealId}`).danger();

  return kb;
}

/**
 * Teclado para que un admin acepte o rechace un trato desde el staff.
 */
function dealAcceptKeyboard(dealId) {
  return new InlineKeyboard()
    .text(btn('TOMAR MEDIACION', '⚖', '⚖'), `${CB.DEAL_ACCEPT}${dealId}`).success()
    .text(btn('RECHAZAR', '✕', '✕'), `deal_reject:${dealId}`).danger();
}

/**
 * Teclado para completar o forzar cancelación de un trato.
 */
function dealCompleteKeyboard(dealId) {
  return new InlineKeyboard()
    .text(btn('LIBERAR Y FINALIZAR', '✦', '✦'), `${CB.DEAL_COMPLETE}${dealId}`).success()
    .text(btn('CANCELAR', '✕', '✕'), `deal_force_cancel:${dealId}`).danger();
}

/**
 * Teclado fijado dentro del hilo/topic para control dinámico de las 5 fases.
 */
function dealTopicKeyboard(dealId, phase = 'AGREEMENT') {
  const kb = new InlineKeyboard();

  if (phase === 'AGREEMENT') {
    kb.text(btn('Cuentas de Pago', '◈', '◈'), `deal_accounts:${dealId}`).primary()
      .text(btn('Fondos en Custodia', '✦', '✦'), `deal_funds_rcv:${dealId}`).success()
      .row()
      .text(btn('Disputa', '!', '!'), `deal_dispute:${dealId}`).danger()
      .text(btn('Cancelar', '✕', '✕'), `deal_force_cancel:${dealId}`).danger();
  } else if (phase === 'ACCOUNTS') {
    kb.text(btn('Ver Resumen Trato', '⌥', '⌥'), `deal_view_summary:${dealId}`).primary()
      .text(btn('Fondos en Custodia', '✦', '✦'), `deal_funds_rcv:${dealId}`).success()
      .row()
      .text(btn('Disputa', '!', '!'), `deal_dispute:${dealId}`).danger()
      .text(btn('Cancelar', '✕', '✕'), `deal_force_cancel:${dealId}`).danger();
  } else if (phase === 'FUNDS_DEPOSITED') {
    kb.text(btn('Notificar Entrega (Vendedor)', '◈', '◈'), `deal_notify_deliv:${dealId}`).primary()
      .row()
      .text(btn('Liberar Fondos al Vendedor', '✦', '✦'), `${CB.DEAL_COMPLETE}${dealId}`).success()
      .row()
      .text(btn('Reembolsar', '«', '»'), `deal_refund:${dealId}`).danger()
      .text(btn('Disputa', '!', '!'), `deal_dispute:${dealId}`).danger();
  } else if (phase === 'DELIVERY') {
    kb.text(btn('Conformidad de Entrega (Comprador)', '✓', '✓'), `deal_buyer_ok:${dealId}`).success()
      .row()
      .text(btn('Liberar Fondos al Vendedor', '✦', '✦'), `${CB.DEAL_COMPLETE}${dealId}`).success()
      .row()
      .text(btn('Reembolsar Comprador', '«', '»'), `deal_refund:${dealId}`).danger()
      .text(btn('Disputa', '!', '!'), `deal_dispute:${dealId}`).danger();
  } else if (phase === 'BUYER_CONFIRMED') {
    kb.text(btn('Liberar Fondos al Vendedor', '✦', '✦'), `${CB.DEAL_COMPLETE}${dealId}`).success()
      .row()
      .text(btn('Reembolsar Comprador', '«', '»'), `deal_refund:${dealId}`).danger()
      .text(btn('Disputa', '!', '!'), `deal_dispute:${dealId}`).danger();
  } else if (phase === 'DISPUTED') {
    kb.text(btn('Liberar al Vendedor', '✦', '✦'), `${CB.DEAL_COMPLETE}${dealId}`).success()
      .text(btn('Reembolsar Comprador', '«', '»'), `deal_refund:${dealId}`).danger()
      .row()
      .text(btn('Cerrar Trato', '✕', '✕'), `deal_force_cancel:${dealId}`).danger();
  } else if (phase === 'COMPLETED') {
    kb.text(btn('1', '★', '★'), `${CB.DEAL_RATE}${dealId}:1`).primary()
      .text(btn('2', '★', '★'), `${CB.DEAL_RATE}${dealId}:2`).primary()
      .text(btn('3', '★', '★'), `${CB.DEAL_RATE}${dealId}:3`).primary()
      .row()
      .text(btn('4', '★', '★'), `${CB.DEAL_RATE}${dealId}:4`).success()
      .text(btn('5', '★', '★'), `${CB.DEAL_RATE}${dealId}:5`).success();
  } else {
    kb.text(btn('Liberar Fondos', '✦', '✦'), `${CB.DEAL_COMPLETE}${dealId}`).success()
      .text(btn('Cancelar', '✕', '✕'), `deal_force_cancel:${dealId}`).danger();
  }

  return kb;
}

/**
 * Teclado para comprador en topic: otorgar conformidad o pedir ayuda.
 */
function dealBuyerTopicKeyboard(dealId) {
  return new InlineKeyboard()
    .text(btn('Conformidad de Entrega (OK)', '✓', '✓'), `deal_buyer_ok:${dealId}`).success()
    .row()
    .text(btn('Solicitar Asistencia / Disputa', '!', '!'), `deal_dispute:${dealId}`).danger();
}

/**
 * Teclado de calificación (1-5 estrellas).
 */
function dealRatingKeyboard(dealId) {
  return new InlineKeyboard()
    .text(btn('1', '★', '★'), `${CB.DEAL_RATE}${dealId}:1`).primary()
    .text(btn('2', '★', '★'), `${CB.DEAL_RATE}${dealId}:2`).primary()
    .text(btn('3', '★', '★'), `${CB.DEAL_RATE}${dealId}:3`).primary()
    .row()
    .text(btn('4', '★', '★'), `${CB.DEAL_RATE}${dealId}:4`).success()
    .text(btn('5', '★', '★'), `${CB.DEAL_RATE}${dealId}:5`).success();
}

module.exports = {
  dealMainKeyboard,
  dealInfoKeyboard,
  dealRoleKeyboard,
  dealCategoryKeyboard,
  dealCurrencyKeyboard,
  dealPaymentMethodKeyboard,
  dealCancelKeyboard,
  dealConfirmKeyboard,
  dealWaitingKeyboard,
  dealAcceptKeyboard,
  dealCompleteKeyboard,
  dealTopicKeyboard,
  dealBuyerTopicKeyboard,
  dealRatingKeyboard,
};
