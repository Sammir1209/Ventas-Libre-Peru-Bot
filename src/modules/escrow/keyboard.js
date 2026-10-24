const { InlineKeyboard } = require('grammy');
if (!InlineKeyboard.prototype.primary) InlineKeyboard.prototype.primary = function() { return this; };
if (!InlineKeyboard.prototype.danger) InlineKeyboard.prototype.danger = function() { return this; };
if (!InlineKeyboard.prototype.success) InlineKeyboard.prototype.success = function() { return this; };
const { SYM, CB } = require('../../config/constants');
const { toMathBold } = require('../../utils/aesthetic');
const config = require('../../config/env');

// ══════
// ⟡ Teclados del Sistema Escrow (Tratos Admin 2.0)
// ══════

/**
 * Teclado principal de /tratoadm.
 */
function dealMainKeyboard() {
  return new InlineKeyboard()
    .text(toMathBold('🤝 INICIAR TRATO'), CB.START_DEAL).success()
    .text(toMathBold('ℹ️ INFORMACIÓN'), CB.DEAL_INFO).primary()
    .row()
    .text(toMathBold('📋 MIS TRATOS'), 'deal_my_deals').primary()
    .text(toMathBold('🧮 CALCULAR TARIFA'), 'deal_calc_menu').primary()
    .row()
    .text(toMathBold('❌ SALIR'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado para la vista detallada de información con botón Iniciar y Volver.
 */
function dealInfoKeyboard() {
  return new InlineKeyboard()
    .text(toMathBold('🤝 INICIAR TRATO AHORA'), CB.START_DEAL).success()
    .row()
    .text(toMathBold('🔙 VOLVER AL MENÚ'), 'deal_back_to_main').primary();
}

/**
 * Teclado para seleccionar el rol (Vendedor / Comprador).
 */
function dealRoleKeyboard() {
  return new InlineKeyboard()
    .text(toMathBold('💼 VOY A VENDER'), 'deal_role:VENDEDOR').primary()
    .text(toMathBold('🛒 VOY A COMPRAR'), 'deal_role:COMPRADOR').primary()
    .row()
    .text(toMathBold('❌ CANCELAR SOLICITUD'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado para selección de categoría del bien o servicio.
 */
function dealCategoryKeyboard() {
  return new InlineKeyboard()
    .text('🎮 Cuentas / Juegos', 'deal_cat:CUENTAS').primary()
    .text('📺 Streaming', 'deal_cat:STREAMING').primary()
    .row()
    .text('💎 Cripto / Saldo', 'deal_cat:CRIPTO').primary()
    .text('📱 Redes / Canales', 'deal_cat:REDES').primary()
    .row()
    .text('📦 Producto Físico', 'deal_cat:FISICO').primary()
    .text('⚡ Otro Trato', 'deal_cat:OTRO').primary()
    .row()
    .text(toMathBold('❌ CANCELAR'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado para selección de moneda (PEN, USD, USDT).
 */
function dealCurrencyKeyboard() {
  return new InlineKeyboard()
    .text('🇵🇪 Soles (PEN)', 'deal_curr:PEN').primary()
    .text('🇺🇸 Dólares (USD)', 'deal_curr:USD').primary()
    .text('🟡 USDT (Binance)', 'deal_curr:USDT').primary()
    .row()
    .text(toMathBold('❌ CANCELAR'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado para selección de método de pago.
 */
function dealPaymentMethodKeyboard() {
  return new InlineKeyboard()
    .text('🇵🇪 Yape / Plin', 'deal_pay:YAPE_PLIN').primary()
    .text('🏦 Banco BCP/BBVA', 'deal_pay:BANCO').primary()
    .row()
    .text('🟡 Binance Pay', 'deal_pay:BINANCE').primary()
    .text('💬 En Sala (Coordinar)', 'deal_pay:EN_SALA').primary()
    .row()
    .text(toMathBold('❌ CANCELAR'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado solo con botón cancelar durante la escritura de datos.
 */
function dealCancelKeyboard() {
  return new InlineKeyboard()
    .text(toMathBold('❌ CANCELAR SOLICITUD'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado de confirmación de los datos ingresados en el wizard.
 */
function dealConfirmKeyboard() {
  return new InlineKeyboard()
    .text(toMathBold('✅ ENVIAR AL STAFF'), 'deal_confirm').success()
    .row()
    .text(toMathBold('❌ CANCELAR'), CB.DEAL_CANCEL).danger();
}

/**
 * Teclado en estado de espera con botón Canal Oficial y Cancelar.
 */
function dealWaitingKeyboard(dealId) {
  const kb = new InlineKeyboard();

  const channelUrl = config.GROUPS_FOLDER_LINK || 'https://t.me/addlist/PodUrc_gHJs2ZjNh';
  kb.url(toMathBold('📢 CANALES OFICIALES'), channelUrl);
  kb.text(toMathBold('❌ CANCELAR SOLICITUD'), `deal_cancel_pending:${dealId}`).danger();

  return kb;
}

/**
 * Teclado para que un admin acepte o rechace un trato desde el staff.
 */
function dealAcceptKeyboard(dealId) {
  return new InlineKeyboard()
    .text(toMathBold('🤝 TOMAR MEDIACIÓN'), `${CB.DEAL_ACCEPT}${dealId}`).success()
    .text(toMathBold('❌ RECHAZAR'), `deal_reject:${dealId}`).danger();
}

/**
 * Teclado para completar o forzar cancelación de un trato.
 */
function dealCompleteKeyboard(dealId) {
  return new InlineKeyboard()
    .text(toMathBold('💸 LIBERAR Y FINALIZAR'), `${CB.DEAL_COMPLETE}${dealId}`).success()
    .text(toMathBold('❌ CANCELAR'), `deal_force_cancel:${dealId}`).danger();
}

/**
 * Teclado fijado dentro del hilo/topic para control dinámico de las 5 fases.
 */
function dealTopicKeyboard(dealId, phase = 'AGREEMENT') {
  const kb = new InlineKeyboard();

  if (phase === 'AGREEMENT') {
    kb.text('💳 Cuentas de Pago', `deal_accounts:${dealId}`).primary()
      .text('💰 Fondos en Custodia', `deal_funds_rcv:${dealId}`).success()
      .row()
      .text('⚠️ Disputa', `deal_dispute:${dealId}`).danger()
      .text('❌ Cancelar', `deal_force_cancel:${dealId}`).danger();
  } else if (phase === 'FUNDS_DEPOSITED') {
    kb.text('📦 Notificar Entrega', `deal_notify_deliv:${dealId}`).primary()
      .text('💸 Liberar Fondos', `${CB.DEAL_COMPLETE}${dealId}`).success()
      .row()
      .text('🔄 Reembolsar', `deal_refund:${dealId}`).danger()
      .text('⚠️ Disputa', `deal_dispute:${dealId}`).danger();
  } else if (phase === 'DELIVERY') {
    kb.text('💸 Liberar Fondos al Vendedor', `${CB.DEAL_COMPLETE}${dealId}`).success()
      .row()
      .text('🔄 Reembolsar Comprador', `deal_refund:${dealId}`).danger()
      .text('⚠️ Disputa', `deal_dispute:${dealId}`).danger();
  } else if (phase === 'DISPUTED') {
    kb.text('💸 Liberar al Vendedor', `${CB.DEAL_COMPLETE}${dealId}`).success()
      .text('🔄 Reembolsar Comprador', `deal_refund:${dealId}`).danger()
      .row()
      .text('❌ Cerrar Trato', `deal_force_cancel:${dealId}`).danger();
  } else {
    kb.text('💸 Liberar Fondos', `${CB.DEAL_COMPLETE}${dealId}`).success()
      .text('❌ Cancelar', `deal_force_cancel:${dealId}`).danger();
  }

  return kb;
}

/**
 * Teclado para comprador en topic: otorgar conformidad o pedir ayuda.
 */
function dealBuyerTopicKeyboard(dealId) {
  return new InlineKeyboard()
    .text('✅ Conformidad de Entrega (OK)', `deal_buyer_ok:${dealId}`).success()
    .row()
    .text('⚠️ Solicitar Asistencia / Disputa', `deal_dispute:${dealId}`).danger();
}

/**
 * Teclado de calificación (1-5 estrellas).
 */
function dealRatingKeyboard(dealId) {
  return new InlineKeyboard()
    .text('⭐ 1', `${CB.DEAL_RATE}${dealId}:1`).primary()
    .text('⭐⭐ 2', `${CB.DEAL_RATE}${dealId}:2`).primary()
    .text('⭐⭐⭐ 3', `${CB.DEAL_RATE}${dealId}:3`).primary()
    .row()
    .text('⭐⭐⭐⭐ 4', `${CB.DEAL_RATE}${dealId}:4`).success()
    .text('⭐⭐⭐⭐⭐ 5', `${CB.DEAL_RATE}${dealId}:5`).success();
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
