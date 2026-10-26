const { SYM } = require('../config/constants');
const { escapeHtml, getSuperscriptDate } = require('./formatting');
const { toMathBold, toMathSerifBold } = require('./aesthetic');

// ══════
// ⟡ Plantillas Estéticas Oficiales — Multi-Tenant SaaS
// ══════

function welcomeMessage(username, firstName, communityName = 'Ventas Libres Perú') {
  const mention = username
    ? `@${username}`
    : `<b>${escapeHtml(firstName || 'Usuario')}</b>`;

  const cleanCommunity = (communityName || 'Ventas Libres Perú').trim();
  const botLabel = cleanCommunity.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || cleanCommunity;
  const dateFormatted = getSuperscriptDate();

  return (
    `<b>⟡ [${escapeHtml(botLabel.toUpperCase())} BOT] VERIFICACIÓN OFICIAL</b>\n` +
    `──────\n\n` +
    `¡Hola, ${mention}! Te damos la bienvenida oficial.\n` +
    `Actualmente te encuentras en modo <b>silenciado preventivo</b>.\n\n` +
    `〖❖〗 <b>Paso 1:</b> Únete a nuestros canales oficiales abajo.\n` +
    `〖✦〗 <b>Paso 2:</b> Pulsa el botón <b>[ ✓ VERIFICAR MEMBRESÍA ]</b>.\n` +
    `  ↳ <i>Proceso automático y seguro en 3 segundos.</i>\n\n` +
    `──────\n` +
    `<i>Manteniendo la comunidad libre de estafadores y cuentas falsas.</i>\n` +
    `${dateFormatted}`
  );
}

function verificationSuccess(username, firstName, communityName = 'Ventas Libres Perú') {
  const mention = username
    ? `@${username}`
    : `<b>${escapeHtml(firstName || 'Usuario')}</b>`;

  const cleanCommunity = (communityName || 'Ventas Libres Perú').trim();
  const botLabel = cleanCommunity.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || cleanCommunity;
  const dateFormatted = getSuperscriptDate();

  return (
    `<b>⟡ [${escapeHtml(botLabel.toUpperCase())} BOT] ACCESO AUTORIZADO</b>\n` +
    `──────\n\n` +
    `〖☁〗 <b>Membresía validada:</b> ${mention}\n` +
    `〖☾〗 <b>Estado:</b> ⊱ <code>DESMUTEO EXITOSO 🟢</code> ⊰\n` +
    `〖❖〗 <b>Comunidad:</b> <code>${escapeHtml(cleanCommunity)}</code>\n\n` +
    `──────\n` +
    `<i>Acceso otorgado: puedes participar, comerciar y chatear libremente.</i>\n` +
    `${dateFormatted}`
  );
}

function verificationFailed(missingChannels) {
  const dateFormatted = getSuperscriptDate();
  const list = missingChannels.map(ch => {
    const raw = String(ch).trim();
    if (raw.includes('3My6QWWVjMw2Mzc8') || raw === '-1002561445231' || raw.includes('MADRE')) {
      return `〖✦〗 <a href="https://t.me/+3My6QWWVjMw2Mzc8"><b>Madre de las Ventas TV2</b></a>`;
    }
    if (raw.includes('quemando_ventaslibreperu')) {
      return `〖🔥〗 <a href="https://t.me/quemando_ventaslibreperu"><b>Quemando VLP [ Lista Negra ]</b></a>`;
    }
    if (raw.startsWith('http')) return `〖✦〗 <a href="${raw}"><b>Canal Oficial</b></a>`;
    if (raw.startsWith('@')) return `〖✦〗 <a href="https://t.me/${raw.replace('@', '')}"><b>${raw}</b></a>`;
    return `〖✦〗 <code>${raw}</code>`;
  }).join('\n');

  return (
    `<b>⟡ [SISTEMA DE SEGURIDAD] VERIFICACIÓN INCOMPLETA</b>\n` +
    `──────\n\n` +
    `Aún no registras suscripción activa a nuestros canales oficiales:\n\n${list}\n\n` +
    `──────\n` +
    `<i>Únete a todos los canales arriba y pulsa nuevamente <b>[ ✓ VERIFICAR ]</b>.</i>\n` +
    `${dateFormatted}`
  );
}

function howItWorksMessage() {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [GUÍA OFICIAL] ¿CÓMO FUNCIONA?</b>\n` +
    `──────\n\n` +
    `〖1〗 Al ingresar al grupo, eres silenciado preventivamente.\n` +
    `〖2〗 Te unes a nuestros canales oficiales verificados.\n` +
    `〖3〗 Presionas el botón <b>[ ✓ Verificar ]</b>.\n` +
    `〖4〗 El bot confirma tu membresía y desbloquea tu chat.\n\n` +
    `──────\n` +
    `<i>Para transacciones seguras utiliza siempre <code>/tratoadm</code>.</i>\n` +
    `${dateFormatted}`
  );
}

function dealMainMenuMessage() {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [ESCROW OFICIAL] TRATO ADMIN</b>\n` +
    `──────\n\n` +
    `Un <b>Trato Admin certificado</b> del Staff retiene los fondos y custodia la operación hasta la conformidad de ambas partes.\n\n` +
    `〖💰〗 <b>Comisión fija:</b> <code>10%</code>\n` +
    `〖⏱️〗 <b>Tiempo estimado:</b> <code>1 a 5 minutos</code>\n` +
    `〖🛡️〗 <b>Garantía:</b> <i>100% libre de robos y estafas</i>\n\n` +
    `──────\n` +
    `<i>Selecciona una opción en el menú inferior para iniciar:</i>\n` +
    `${dateFormatted}`
  );
}

function dealDetailedInfoMessage() {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [ESCROW VLP] GUÍA DE TRATOS SEGUROS</b>\n` +
    `──────\n\n` +
    `El Trato Admin protege tanto al comprador como al vendedor reteniendo los fondos hasta comprobar la entrega real del producto o cuenta.\n\n` +
    `〖1〗 Solicitas el trato indicando si vendes o compras.\n` +
    `〖2〗 Un Trato Admin verificado toma tu caso.\n` +
    `〖3〗 Se abre una sala privada en el grupo de mediaciones.\n` +
    `〖4〗 El comprador transfiere los fondos al Trato Admin.\n` +
    `〖5〗 El vendedor entrega el producto y se verifica.\n` +
    `〖6〗 El Trato Admin libera el dinero y cierra el trato.\n\n` +
    `〖💰〗 <b>Tabla de Comisión (10%):</b>\n` +
    `  ↳ S/ 10.00 → Comisión S/ 1.00\n` +
    `  ↳ S/ 50.00 → Comisión S/ 5.00\n` +
    `  ↳ S/ 100.00 → Comisión S/ 10.00\n\n` +
    `──────\n` +
    `<i>Aviso: Nunca realices pagos por fuera de la sala oficial.</i>\n` +
    `${dateFormatted}`
  );
}

function dealRoleStepMessage() {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [SOLICITUD DE TRATO] PASO 1 DE 6 ⊱ ROL ⊰</b>\n` +
    `──────\n\n` +
    `〖⚖️〗 <b>¿Cuál es tu rol en esta transacción?</b>\n\n` +
    `Selecciona si eres el <b>Vendedor</b> (entregas el bien/servicio) o el <b>Comprador</b> (realizas el pago):\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealCategoryStepMessage(role) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [SOLICITUD DE TRATO] PASO 2 DE 6 ⊱ CATEGORÍA ⊰</b>\n` +
    `──────\n\n` +
    `〖☾〗 <b>Tu Rol:</b> <code>${role}</code>\n` +
    `〖📦〗 <b>¿Qué tipo de producto o servicio van a negociar?</b>\n\n` +
    `<i>Selecciona la categoría correspondiente en los botones inferiores:</i>\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealCounterpartStepMessage(role, category) {
  const counterpartName = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [SOLICITUD DE TRATO] PASO 3 DE 6 ⊱ CONTRAPARTE ⊰</b>\n` +
    `──────\n\n` +
    `〖☾〗 <b>Tu Rol:</b> <code>${role}</code>\n` +
    `〖🏷️〗 <b>Categoría:</b> <code>${category || 'General'}</code>\n\n` +
    `〖👤〗 <b>¿Con quién vas a realizar la transacción?</b>\n` +
    `Envía por mensaje el <b>@usuario</b> o <b>ID numérico</b> del <b>${counterpartName}</b>:\n\n` +
    `──────\n` +
    `<i>🛡️ El bot comprobará automáticamente si se encuentra en la Lista Negra Oficial.</i>\n` +
    `${dateFormatted}`
  );
}

function dealCurrencyStepMessage(role, category, counterpart) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [SOLICITUD DE TRATO] PASO 4 DE 6 ⊱ MONEDA ⊰</b>\n` +
    `──────\n\n` +
    `〖☾〗 <b>Tu Rol:</b> <code>${role}</code>\n` +
    `〖👤〗 <b>Contraparte:</b> <code>${escapeHtml(counterpart)}</code>\n\n` +
    `〖💱〗 <b>Selecciona la moneda acordada para el trato:</b>\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealAmountStepMessage(role, category, currency) {
  const dateFormatted = getSuperscriptDate();
  const symb = currency === 'USD' ? '$' : (currency === 'USDT' ? 'USDT' : 'S/');
  return (
    `<b>⟡ [SOLICITUD DE TRATO] PASO 5 DE 6 ⊱ MONTO ⊰</b>\n` +
    `──────\n\n` +
    `〖💱〗 <b>Moneda:</b> <code>${currency} (${symb})</code>\n\n` +
    `〖💰〗 <b>Envía el importe numérico del trato:</b>\n` +
    `<i>Ejemplo: <code>150</code> o <code>240.50</code></i>\n\n` +
    `──────\n` +
    `ℹ️ <i>La comisión del Trato Admin (10%) se calculará automáticamente sobre este monto.</i>\n` +
    `${dateFormatted}`
  );
}

function dealPaymentMethodStepMessage(currency, amount, fee, total) {
  const dateFormatted = getSuperscriptDate();
  const symb = currency === 'USD' ? '$' : (currency === 'USDT' ? 'USDT' : 'S/');
  return (
    `<b>⟡ [SOLICITUD DE TRATO] PASO 6 DE 6 ⊱ MÉTODO DE PAGO ⊰</b>\n` +
    `──────\n\n` +
    `〖💰〗 <b>Monto del Trato:</b> <code>${symb} ${Number(amount).toFixed(2)}</code>\n` +
    `〖⚖️〗 <b>Comisión Admin (10%):</b> <code>${symb} ${Number(fee).toFixed(2)}</code>\n` +
    `〖🔒〗 <b>Total en Custodia:</b> <code>${symb} ${Number(total).toFixed(2)}</code>\n\n` +
    `〖💳〗 <b>¿A través de qué medio transferirá el comprador al Trato Admin?</b>\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealDescriptionStepMessage(currency, amount, paymentMethod) {
  const dateFormatted = getSuperscriptDate();
  const symb = currency === 'USD' ? '$' : (currency === 'USDT' ? 'USDT' : 'S/');
  return (
    `<b>⟡ [SOLICITUD DE TRATO] DETALLES Y CONDICIONES</b>\n` +
    `──────\n\n` +
    `〖💰〗 <b>Importe:</b> <code>${symb} ${Number(amount).toFixed(2)}</code> (${paymentMethod})\n\n` +
    `〖📦〗 <b>Envía una breve descripción del bien o condiciones:</b>\n` +
    `<i>Ej: "Cuenta de Steam con CS2 Prime + correo original"</i>\n\n` +
    `──────\n` +
    `<i>(Mínimo 5 caracteres | Máximo 250 caracteres)</i>\n` +
    `${dateFormatted}`
  );
}

function dealSummaryMessage(data) {
  const role = data.role || 'Solicitante';
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  const counterpartEmoji = role === 'VENDEDOR' ? '〖👤〗' : '〖💼〗';
  const currency = data.currency || 'PEN';
  const symb = currency === 'USD' ? '$' : (currency === 'USDT' ? 'USDT' : 'S/');
  const amount = Number(data.amount || 0).toFixed(2);
  const fee = Number(data.fee || (amount * 0.10)).toFixed(2);
  const total = Number(data.total || (Number(amount) + Number(fee))).toFixed(2);
  const dateFormatted = getSuperscriptDate();

  return (
    `<b>⟡ [VOUCHER DE SOLICITUD] REVISIÓN FINAL ESCROW</b>\n` +
    `──────\n\n` +
    `〖☾〗 <b>Tu Rol:</b> <code>${role}</code>\n` +
    `${counterpartEmoji} <b>${counterpartRole}:</b> <code>${escapeHtml(data.counterpart || 'N/A')}</code>\n` +
    `〖🏷️〗 <b>Categoría:</b> <code>${escapeHtml(data.category || 'General')}</code>\n` +
    `〖💳〗 <b>Método de Pago:</b> <code>${escapeHtml(data.paymentMethod || 'A coordinar')}</code>\n\n` +
    `<b>⟡ DESGLOSE FINANCIERO OFICIAL:</b>\n` +
    `┌─────────────────────────────┐\n` +
    `│ • Valor del Trato: <b>${symb} ${amount}</b>\n` +
    `│ • Comisión Admin (10%): <b>${symb} ${fee}</b>\n` +
    `│ • Total en Custodia: <b>${symb} ${total}</b>\n` +
    `└─────────────────────────────┘\n\n` +
    `〖📦〗 <b>Condiciones del Intercambio:</b>\n` +
    `  ↳ <i>${escapeHtml(data.description || 'Sin especificar')}</i>\n\n` +
    `──────\n` +
    `¿Deseas enviar formalmente este ticket a la cola del Staff?\n` +
    `${dateFormatted}`
  );
}

function dealWaitingMessage(dealId, data) {
  const role = data.role || 'Solicitante';
  const counterpartEmoji = role === 'VENDEDOR' ? '〖👤〗' : '〖💼〗';
  const currency = data.currency || 'PEN';
  const symb = currency === 'USD' ? '$' : (currency === 'USDT' ? 'USDT' : 'S/');
  const amount = Number(data.amount || 0).toFixed(2);
  const total = Number(data.total || (Number(amount) * 1.10)).toFixed(2);
  const dateFormatted = getSuperscriptDate();

  return (
    `<b>⟡ [CASO #${dealId}] TICKET EN COLA OFICIAL</b>\n` +
    `──────\n\n` +
    `✓ <b>Tu solicitud ha sido transmitida al equipo de mediadores certificados.</b>\n\n` +
    `〖☾〗 <b>Rol:</b> <code>${role}</code>\n` +
    `${counterpartEmoji} <b>Contraparte:</b> <code>${escapeHtml(data.counterpart || 'N/A')}</code>\n` +
    `〖💰〗 <b>Valor:</b> <code>${symb} ${amount}</code> (Custodia: <code>${symb} ${total}</code>)\n` +
    `〖📦〗 <b>Detalles:</b> <i>${escapeHtml(data.description || 'Sin especificar')}</i>\n\n` +
    `──────\n` +
    `<i>Recibirás una notificación inmediata con el enlace a tu sala privada en cuanto un Trato Admin tome tu caso.</i>\n` +
    `${dateFormatted}`
  );
}

function dealNotifyAdmin(dealId, creatorUsername, creatorId, data) {
  const userTag = creatorUsername ? `@${creatorUsername}` : `<code>${creatorId}</code>`;
  const role = data.role || 'Solicitante';
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  const counterpartEmoji = role === 'VENDEDOR' ? '〖👤〗' : '〖💼〗';
  const currency = data.currency || 'PEN';
  const symb = currency === 'USD' ? '$' : (currency === 'USDT' ? 'USDT' : 'S/');
  const amount = Number(data.amount || 0).toFixed(2);
  const fee = Number(data.fee || (amount * 0.10)).toFixed(2);
  const total = Number(data.total || (Number(amount) + Number(fee))).toFixed(2);
  const dateFormatted = getSuperscriptDate();

  return (
    `<b>⟡ [SOLICITUD #${dealId}] NUEVO CASO ESCROW</b>\n` +
    `──────\n\n` +
    `〖👤〗 <b>Solicitante:</b> ${userTag} (<code>${role}</code>)\n` +
    `${counterpartEmoji} <b>${counterpartRole}:</b> <code>${escapeHtml(data.counterpart || 'N/A')}</code>\n` +
    `〖🏷️〗 <b>Categoría:</b> <code>${escapeHtml(data.category || 'General')}</code>\n` +
    `〖💳〗 <b>Pago por:</b> <code>${escapeHtml(data.paymentMethod || 'A coordinar')}</code>\n\n` +
    `<b>⟡ IMPORTES DECLARADOS:</b>\n` +
    `  • Valor Trato: <b>${symb} ${amount}</b>\n` +
    `  • Comisión Staff (10%): <b>${symb} ${fee}</b>\n` +
    `  • Total a Custodiar: <b>${symb} ${total}</b>\n\n` +
    `〖📦〗 <b>Detalles:</b> <i>${escapeHtml(data.description || 'Sin especificar')}</i>\n\n` +
    `──────\n` +
    `<i>Presiona <b>[ TOMAR MEDIACIÓN ]</b> para abrir el hilo y generar enlaces exclusivos:</i>\n` +
    `${dateFormatted}`
  );
}

function dealAcceptedGroup(dealId, adminUsername) {
  const adminTag = adminUsername ? `@${adminUsername}` : 'un Administrador';
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [TRATO #${dealId}] CASO ASIGNADO</b>\n` +
    `──────\n\n` +
    `✓ <b>${adminTag}</b> ha tomado la mediación de este caso.\n` +
    `<i>Creando sala privada y generando enlaces de acceso seguro...</i>\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealInviteMessage(dealId, inviteLink, topicLink, counterpart, role, description, amountStr = '') {
  const cleanRole = (role || '').toUpperCase();
  const myRole = cleanRole === 'VENDEDOR' ? 'Vendedor' : (cleanRole === 'COMPRADOR' ? 'Comprador' : (role || 'Solicitante'));
  const counterpartRole = cleanRole === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  const counterpartEmoji = cleanRole === 'VENDEDOR' ? '〖👤〗' : '〖💼〗';
  const cleanCounterpart = (!counterpart || counterpart === 'N/A' || counterpart === 'Sin especificar')
    ? 'No especificado'
    : (counterpart.startsWith('@') || /^\d+$/.test(counterpart) ? counterpart : `@${counterpart}`);
  const dateFormatted = getSuperscriptDate();

  return (
    `<b>⟡ [TRATO #${dealId}] SALA DE MEDIACIÓN HABILITADA</b>\n` +
    `──────\n\n` +
    `〖☾〗 <b>Tu Rol:</b> <code>${myRole}</code>\n` +
    `${counterpartEmoji} <b>${counterpartRole}:</b> <code>${escapeHtml(cleanCounterpart)}</code>\n` +
    (amountStr ? `〖💰〗 <b>Monto en Custodia:</b> <code>${escapeHtml(amountStr)}</code>\n` : '') +
    `〖📦〗 <b>Detalles:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `〖✦〗 <b>Acceso Único:</b> <a href="${inviteLink}"><b>[ ENTRAR A LA SALA PRIVADA #${dealId} ]</b></a>\n\n` +
    `──────\n` +
    `🛡️ <i>El Trato Admin retendrá los fondos antes de autorizar la entrega en este hilo oficial.</i>\n` +
    `${dateFormatted}`
  );
}

function dealCounterpartInviteMessage(dealId, inviteLink, creatorMention, myRole, creatorRole, description, amountStr = '') {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [TRATO #${dealId}] INVITACIÓN A MEDIACIÓN OFICIAL</b>\n` +
    `──────\n\n` +
    `〖☾〗 <b>Tu Rol:</b> <code>${myRole || 'Participante'}</code>\n` +
    `〖👤〗 <b>${creatorRole || 'Solicitante'}:</b> ${creatorMention}\n` +
    (amountStr ? `〖💰〗 <b>Monto en Custodia:</b> <code>${escapeHtml(amountStr)}</code>\n` : '') +
    `〖📦〗 <b>Detalles:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `〖✦〗 <b>Acceso Único:</b> <a href="${inviteLink}"><b>[ ENTRAR A LA SALA PRIVADA #${dealId} ]</b></a>\n\n` +
    `──────\n` +
    `🛡️ <i>El Trato Admin retendrá los fondos antes de autorizar la entrega en este hilo oficial.</i>\n` +
    `${dateFormatted}`
  );
}

function getPhaseProgressBar(phase) {
  switch (phase) {
    case 'FUNDS_DEPOSITED':
      return '<code>[ 1. Acuerdo ✓ ] ➔ [ 2. CUSTODIA 💰 ] ➔ [ 3. Entrega ] ➔ [ 4. Liberación ]</code>';
    case 'DELIVERY':
      return '<code>[ 1. Acuerdo ✓ ] ➔ [ 2. Custodia ✓ ] ➔ [ 3. ENTREGA 📦 ] ➔ [ 4. Liberación ]</code>';
    case 'RELEASED':
    case 'COMPLETED':
      return '<code>[ 1. Acuerdo ✓ ] ➔ [ 2. Custodia ✓ ] ➔ [ 3. Entrega ✓ ] ➔ [ 4. LIBERADO 💸 ]</code>';
    case 'DISPUTED':
      return '<code>[ ⚠️ EN DISPUTA / CONTROVERSIA ABIERTA ]</code>';
    case 'AGREEMENT':
    default:
      return '<code>[ 1. ACUERDO 🤝 ] ➔ [ 2. Custodia ] ➔ [ 3. Entrega ] ➔ [ 4. Liberación ]</code>';
  }
}

function dealTopicWelcomeBanner(dealId, creatorMention, counterpart, adminMention, data, phase = 'AGREEMENT') {
  const role = data?.role || 'Solicitante';
  const cleanRole = String(role).toUpperCase();
  const creatorRoleName = cleanRole === 'VENDEDOR' ? 'Vendedor' : (cleanRole === 'COMPRADOR' ? 'Comprador' : role);
  const counterpartRoleName = cleanRole === 'VENDEDOR' ? 'Comprador' : (cleanRole === 'COMPRADOR' ? 'Vendedor' : 'Contraparte');
  const creatorEmoji = cleanRole === 'VENDEDOR' ? '〖💼〗' : '〖👤〗';
  const counterpartEmoji = cleanRole === 'VENDEDOR' ? '〖👤〗' : '〖💼〗';
  const cleanCounterpart = (!counterpart || counterpart === 'N/A' || counterpart === 'Sin especificar')
    ? 'No especificado'
    : (counterpart.startsWith('@') || /^\d+$/.test(counterpart) ? counterpart : `@${counterpart}`);
  const currency = data?.currency || 'PEN';
  const symb = currency === 'USD' ? '$' : (currency === 'USDT' ? 'USDT' : 'S/');
  const amountStr = data?.amount ? `${symb} ${Number(data.amount).toFixed(2)}` : 'Por definir';
  const feeStr = data?.fee ? `${symb} ${Number(data.fee).toFixed(2)}` : (data?.amount ? `${symb} ${(Number(data.amount)*0.10).toFixed(2)}` : '10%');
  const totalStr = data?.total ? `${symb} ${Number(data.total).toFixed(2)}` : (data?.amount ? `${symb} ${(Number(data.amount)*1.10).toFixed(2)}` : 'Por definir');
  const progressBar = getPhaseProgressBar(phase);
  const dateFormatted = getSuperscriptDate();

  return (
    `<b>⟡ [SALA PRIVADA #${dealId}] TRATO ESCROW OFICIAL</b>\n` +
    `──────\n\n` +
    `<b>⟡ ESTADO DEL FLUJO:</b>\n` +
    `${progressBar}\n\n` +
    `${creatorEmoji} <b>${creatorRoleName}:</b> ${creatorMention}\n` +
    `${counterpartEmoji} <b>${counterpartRoleName}:</b> <code>${escapeHtml(cleanCounterpart)}</code>\n` +
    `〖⚖️〗 <b>Mediador Oficial:</b> ${adminMention}\n` +
    `〖🏷️〗 <b>Categoría:</b> <code>${escapeHtml(data?.category || 'General')}</code>\n` +
    `〖💳〗 <b>Método Previsto:</b> <code>${escapeHtml(data?.paymentMethod || 'A coordinar')}</code>\n\n` +
    `<b>⟡ DETALLE FINANCIERO:</b>\n` +
    `  • Monto Trato: <b>${amountStr}</b>\n` +
    `  • Comisión Staff (10%): <b>${feeStr}</b>\n` +
    `  • Total en Custodia: <b>${totalStr}</b>\n\n` +
    `〖📦〗 <b>Condiciones del Trato:</b>\n` +
    `  ↳ <i>${escapeHtml(data?.description || 'Sin especificar')}</i>\n\n` +
    `──────\n` +
    `<b>⟡ PROTOCOLO OBLIGATORIO DE SEGURIDAD:</b>\n` +
    `〖1〗 <b>NUNCA pagues directamente al vendedor</b>. El pago va 100% al Mediador.\n` +
    `〖2〗 El Vendedor <b>NO debe entregar</b> hasta que el Mediador pulse <code>[ Fondos en Custodia ]</code>.\n` +
    `〖3〗 Toda prueba y coordinación debe permanecer dentro de este hilo.\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealFundsReceivedBanner(dealId, adminMention, totalStr) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [TRATO #${dealId}] FONDOS EN CUSTODIA CONFIRMADOS 🟢</b>\n` +
    `──────\n\n` +
    `<code>[ 1. Acuerdo ✓ ] ➔ [ 2. CUSTODIA ASEGURADA 💰 ] ➔ [ 3. Entrega ] ➔ [ 4. Liberación ]</code>\n\n` +
    `✓ <b>El mediador ${adminMention} ha verificado y retenido el pago:</b>\n` +
    `〖🔒〗 <b>Importe en Custodia:</b> <code>${totalStr}</code>\n\n` +
    `──────\n` +
    `📢 <b>ATENCIÓN AL VENDEDOR:</b>\n` +
    `Los fondos están <b>100% asegurados</b> en la bóveda oficial del bot.\n` +
    `Ya puedes hacer entrega de las cuentas, credenciales o producto al comprador en este hilo.\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealDeliveryNotifiedBanner(dealId, sellerMention) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [TRATO #${dealId}] ENTREGA REPORTADA POR EL VENDEDOR 📦</b>\n` +
    `──────\n\n` +
    `<code>[ 1. Acuerdo ✓ ] ➔ [ 2. Custodia ✓ ] ➔ [ 3. VALIDACIÓN DE ENTREGA ⏳ ]</code>\n\n` +
    `✓ <b>${sellerMention}</b> ha indicado que ya entregó el producto o credenciales.\n\n` +
    `〖👤〗 <b>Al Comprador:</b>\n` +
    `Revisa y comprueba que todo esté correcto (accesos, saldo, garantías).\n` +
    `Cuando estés conforme, pulsa el botón oficial <b>[ ✅ Conformidad de Entrega ]</b>.\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealBuyerConfirmedBanner(dealId, buyerMention) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [TRATO #${dealId}] CONFORMIDAD REGISTRADA POR EL COMPRADOR ✅</b>\n` +
    `──────\n\n` +
    `✓ <b>${buyerMention}</b> ha validado la entrega y otorgó su <b>conformidad formal</b>.\n\n` +
    `〖⚖️〗 <i>El Mediador ya puede proceder a transferir los fondos netos al Vendedor y cerrar la sala.</i>\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealDisputeBanner(dealId, adminMention, reporterMention) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [TRATO #${dealId}] ⚠️ CONTROVERSIA / DISPUTA ABIERTA</b>\n` +
    `──────\n\n` +
    `<code>[ ⚠️ TRATO CONGELADO POR DISPUTA DE PARTES ]</code>\n\n` +
    `Se ha reportado un inconveniente o discrepancia por parte de ${reporterMention}.\n` +
    `〖🛡️〗 Los fondos permanecen <b>completamente congelados</b> por ${adminMention}.\n\n` +
    `〖📸〗 Ambas partes deben enviar capturas y pruebas en este hilo.\n` +
    `El Staff evaluará las evidencias para liberar los fondos o emitir reembolso.\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealRefundBanner(dealId, adminMention, refundStr) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [TRATO #${dealId}] REEMBOLSO EMITIDO AL COMPRADOR 🔄</b>\n` +
    `──────\n\n` +
    `✓ <b>El mediador ${adminMention} ha ejecutado el reembolso de los fondos:</b>\n` +
    `〖💸〗 <b>Importe Devuelto:</b> <code>${refundStr}</code>\n\n` +
    `<i>El trato se concluye como NO COMPLETADO y la sala será cerrada.</i>\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealVoucherTicket(deal, adminName) {
  const currency = deal.currency || 'PEN';
  const symb = currency === 'USD' ? '$' : (currency === 'USDT' ? 'USDT' : 'S/');
  const amount = Number(deal.amount || 0).toFixed(2);
  const fee = Number(deal.fee || (deal.amount ? deal.amount * 0.10 : 0)).toFixed(2);
  const dateFormatted = getSuperscriptDate();

  return (
    `<b>╔══════════════════════════════════════╗</b>\n` +
    `<b>   ⟡ CERTIFICADO DIGITAL DE TRATO EXITOSO</b>\n` +
    `<b>╚══════════════════════════════════════╝</b>\n\n` +
    `〖💎〗 <b>N° DE OPERACIÓN:</b> <code>#ESCROW-${deal.id}</code>\n` +
    `〖📅〗 <b>FECHA DE CIERRE:</b> ${dateFormatted}\n` +
    `〖⚖️〗 <b>MEDIADOR ACREDITADO:</b> @${escapeHtml(adminName || 'Admin')}\n` +
    `〖🏷️〗 <b>CATEGORÍA:</b> <code>${escapeHtml(deal.category || 'General')}</code>\n\n` +
    `<b>⟡ PARTICIPANTES OFICIALES:</b>\n` +
    `  • Creador: <code>${deal.creator_id}</code> (${deal.role || 'Solicitante'})\n` +
    `  • Contraparte: <code>${escapeHtml(deal.counterpart || 'N/A')}</code>\n\n` +
    `<b>⟡ RESUMEN FINANCIERO:</b>\n` +
    `  • Monto Liquidado: <b>${symb} ${amount}</b>\n` +
    `  • Tarifa de Mediación (10%): <b>${symb} ${fee}</b>\n` +
    `  • Estado Final: ⊱ <code>CERRADO CON ÉXITO ✓</code> ⊰\n\n` +
    `──────\n` +
    `<i>Respaldado por el Sistema Anti-Estafas de Ventas Libres Perú.</i>\n` +
    `<i>Transacción auditada y almacenada en nube de respaldo permanente.</i>`
  );
}

function dealMyDealsMessage(deals, username) {
  const userTag = username ? `@${username}` : 'Tu cuenta';
  const dateFormatted = getSuperscriptDate();

  if (!deals || deals.length === 0) {
    return (
      `<b>⟡ [HISTORIAL ESCROW] MIS TRATOS</b>\n` +
      `──────\n\n` +
      `〖👤〗 <b>Usuario:</b> ${userTag}\n\n` +
      `<i>No registras tratos de intermediación activos ni pasados en esta comunidad.</i>\n\n` +
      `──────\n` +
      `<i>Para solicitar tu primer trato seguro utiliza <code>/tratoadm</code>.</i>\n` +
      `${dateFormatted}`
    );
  }

  let listText = '';
  for (const d of deals.slice(0, 10)) {
    const symb = d.currency === 'USD' ? '$' : (d.currency === 'USDT' ? 'USDT' : 'S/');
    const amt = d.amount ? `${symb} ${Number(d.amount).toFixed(2)}` : 'N/A';
    const statusIcon = d.status === 'COMPLETED' ? '🟢' : (d.status === 'CANCELLED' ? '🔴' : '🟡');
    const phaseLabel = d.phase || d.status;
    listText += `${statusIcon} <b>Trato #${d.id}</b> | ${amt} | <code>${phaseLabel}</code>\n`;
    listText += `  ↳ <i>Contraparte:</i> <code>${escapeHtml(d.counterpart || 'N/A')}</code>\n\n`;
  }

  return (
    `<b>⟡ [HISTORIAL ESCROW] MIS TRATOS RECIENTES</b>\n` +
    `──────\n\n` +
    `〖👤〗 <b>Usuario:</b> ${userTag}\n` +
    `〖📊〗 <b>Total Registrados:</b> <b>${deals.length}</b> tratos\n\n` +
    `${listText}` +
    `──────\n` +
    `<i>Ventas Libres Perú — Tu intermediación segura garantizada.</i>\n` +
    `${dateFormatted}`
  );
}

function dealCalculatorMessage(amount, currency = 'PEN') {
  const num = Number(amount);
  const symb = currency === 'USD' ? '$' : (currency === 'USDT' ? 'USDT' : 'S/');
  const fee = Number((num * 0.10).toFixed(2));
  const total = Number((num + fee).toFixed(2));
  const netForSeller = Number((num - fee).toFixed(2));
  const dateFormatted = getSuperscriptDate();

  return (
    `<b>⟡ [CALCULADORA OFICIAL] TARIFA DE TRATOS ADMIN</b>\n` +
    `──────\n\n` +
    `〖💰〗 <b>Valor del Trato:</b> <code>${symb} ${num.toFixed(2)}</code>\n` +
    `〖⚖️〗 <b>Comisión de Intermediación (10%):</b> <code>${symb} ${fee.toFixed(2)}</code>\n\n` +
    `<b>⟡ SEGÚN EL ACUERDO DE PAGO:</b>\n` +
    `〖A〗 <b>Si el Comprador asume la comisión:</b>\n` +
    `  ↳ Comprador paga: <b>${symb} ${total.toFixed(2)}</b>\n` +
    `  ↳ Vendedor recibe: <b>${symb} ${num.toFixed(2)}</b>\n\n` +
    `〖B〗 <b>Si el Vendedor asume la comisión:</b>\n` +
    `  ↳ Comprador paga: <b>${symb} ${num.toFixed(2)}</b>\n` +
    `  ↳ Vendedor recibe neto: <b>${symb} ${netForSeller.toFixed(2)}</b>\n\n` +
    `──────\n` +
    `<i>Para iniciar tu trato escribe <code>/tratoadm</code> o pulsa el botón inferior:</i>\n` +
    `${dateFormatted}`
  );
}

function escrowGroupConfigured(groupTitle, groupId) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [SISTEMA ESCROW] GRUPO CONFIGURADO</b>\n` +
    `──────\n\n` +
    `〖❖〗 <b>Grupo:</b> ${escapeHtml(groupTitle)}\n` +
    `〖ϟ〗 <b>ID:</b> <code>${groupId}</code>\n` +
    `〖☾〗 <b>Temas (Topics):</b> ⊱ <code>ACTIVADOS ✓</code> ⊰\n\n` +
    `──────\n` +
    `✓ <i>Cada trato aceptado creará automáticamente su hilo seguro.</i>\n` +
    `${dateFormatted}`
  );
}

function escrowGroupNotForumError() {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [ERROR DE CONFIGURACIÓN] TEMAS NO ACTIVADOS</b>\n` +
    `──────\n\n` +
    `Este grupo no tiene la función de <b>Temas (Topics)</b> activada.\n\n` +
    `〖❖〗 <b>Solución:</b>\n` +
    `  ↳ Editar grupo → Activar opción "Temas" → Guardar.\n` +
    `  ↳ Verificar que el bot sea Admin con permiso "Gestionar temas".\n\n` +
    `──────\n` +
    `<i>Luego vuelve a ejecutar <code>/set_grupo_tratos</code>.</i>\n` +
    `${dateFormatted}`
  );
}

function escrowGroupNoPermissionError() {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [BOT REQUERIMIENTO] PERMISOS INSUFICIENTES</b>\n` +
    `──────\n\n` +
    `El bot requiere los siguientes permisos de Administrador:\n\n` +
    `〖🛡️〗 Gestionar temas (Manage Topics)\n` +
    `〖✦〗 Invitar usuarios por enlace (Invite Users via Link)\n\n` +
    `──────\n` +
    `<i>Otorga los permisos y vuelve a ejecutar <code>/set_grupo_tratos</code>.</i>\n` +
    `${dateFormatted}`
  );
}

function dealRatingMessage(dealId, adminUsername) {
  const adminTag = adminUsername ? `@${adminUsername}` : 'el Trato Admin';
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [TRATO #${dealId}] CALIFICACIÓN DE ATENCIÓN</b>\n` +
    `──────\n\n` +
    `✓ <b>¡Trato completado exitosamente!</b>\n` +
    `〖⚖️〗 <b>Mediador:</b> ${adminTag}\n\n` +
    `──────\n` +
    `¿Cómo calificarías el desempeño y rapidez del mediador?\n` +
    `${dateFormatted}`
  );
}

function dealCancelledMessage(dealId = null) {
  const isNumeric = dealId && !isNaN(Number(dealId)) && Number(dealId) > 0;
  const tag = isNumeric ? `TRATO #${dealId}` : 'TRATO ADMIN';
  const dateFormatted = getSuperscriptDate();

  return (
    `<b>⟡ [${tag}] SOLICITUD CANCELADA</b>\n` +
    `──────\n\n` +
    `✗ <b>La operación ha sido cancelada.</b>\n` +
    `No se ha creado el hilo ni se ha retenido ningún fondo.\n\n` +
    `──────\n` +
    `<i>Para iniciar una nueva mediación usa <code>/tratoadm</code>.</i>\n` +
    `${dateFormatted}`
  );
}

function burnCancelledMessage() {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [SISTEMA QUEMAR] REPORTE CANCELADO</b>\n` +
    `──────\n\n` +
    `✗ <b>La denuncia ha sido cancelada.</b>\n` +
    `No se ha registrado ningún reporte en la base de datos ni se ha notificado al Staff.\n\n` +
    `──────\n` +
    `<i>Para reportar a un estafador usa <code>/quemar</code>.</i>\n` +
    `${dateFormatted}`
  );
}

function burnInitialPrompt() {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [SISTEMA ANTI-ESTAFAS] REPORTE DE ESTAFA</b>\n` +
    `──────\n\n` +
    `⚠️ <i>Advertencia: El uso indebido o denuncias falsas conllevan Baneo Global Permanente (GBAN).</i>\n\n` +
    `〖1〗 <b>Paso 1 de 3:</b> Selecciona cómo deseas identificar al acusado:\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function burnAskIdPrompt() {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [ANTI-ESTAFAS] IDENTIFICACIÓN POR ID</b>\n` +
    `──────\n\n` +
    `〖ϟ〗 <b>Paso 1 de 3:</b> Envía el <b>ID numérico de Telegram</b> del acusado.\n\n` +
    `──────\n` +
    `<i>Ejemplo: <code>8579513055</code></i>\n` +
    `${dateFormatted}`
  );
}

function burnAskUsernamePrompt() {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [ANTI-ESTAFAS] IDENTIFICACIÓN POR USERNAME</b>\n` +
    `──────\n\n` +
    `〖♝〗 <b>Paso 1 de 3:</b> Envía el <b>@Username</b> del acusado.\n\n` +
    `──────\n` +
    `<i>Ejemplo: <code>@usuario_estafador</code></i>\n` +
    `${dateFormatted}`
  );
}

function burnContextPrompt(targetLabel) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [ANTI-ESTAFAS] DESCRIPCIÓN DE HECHOS</b>\n` +
    `──────\n\n` +
    `〖👤〗 <b>Acusado:</b> ${targetLabel}\n\n` +
    `〖⚖️〗 <b>Paso 2 de 3:</b> Describe detalladamente lo sucedido (monto robado, método, fecha).\n\n` +
    `──────\n` +
    `<i>(Mínimo 15 caracteres | Máximo 400 caracteres)</i>\n` +
    `${dateFormatted}`
  );
}

function burnProofPrompt(targetLabel, contextSnippet, proofsCount = 0) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [ANTI-ESTAFAS] EVIDENCIAS Y CAPTURAS</b>\n` +
    `──────\n\n` +
    `〖👤〗 <b>Acusado:</b> ${targetLabel}\n` +
    `〖⚖️〗 <b>Hechos:</b> <i>${escapeHtml(contextSnippet.slice(0, 80))}${contextSnippet.length > 80 ? '...' : ''}</i>\n\n` +
    `〖📦〗 <b>Paso 3 de 3:</b> Envía tus capturas o comprobantes de pago como imagen.\n` +
    `〖📷〗 <b>Capturas recibidas:</b> <b>${proofsCount}</b> <i>(Mínimo 1 obligatoria)</i>\n\n` +
    `──────\n` +
    `<i>Cuando termines de enviar todas tus capturas, presiona <b>[ CONTINUAR ]</b>.</i>\n` +
    `${dateFormatted}`
  );
}

function burnSummaryMessage(targetLabel, context, proofsCount) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [CONFIRMACIÓN] RESUMEN DEL REPORTE</b>\n` +
    `──────\n\n` +
    `〖👤〗 <b>Acusado:</b> ${targetLabel}\n` +
    `〖📷〗 <b>Evidencias:</b> <code>${proofsCount} captura(s)</code>\n` +
    `〖⚖️〗 <b>Descripción de los Hechos:</b>\n` +
    `  ↳ <i>${escapeHtml(context)}</i>\n\n` +
    `──────\n` +
    `<i>Al pulsar <b>[ QUEMAR ]</b>, el reporte se enviará al Staff para revisión y baneo global.</i>\n` +
    `${dateFormatted}`
  );
}

function burnSentMessage(reportId = '') {
  const idText = reportId ? ` #${reportId}` : '';
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [EN REVISIÓN] REPORTE ENVIADO AL STAFF${idText}</b>\n` +
    `──────\n\n` +
    `✓ Tu denuncia y evidencias han sido recibidas por los moderadores de <b>Ventas Libres Perú</b>.\n\n` +
    `──────\n` +
    `<i>Revisaremos tu caso a la brevedad. Gracias por mantener limpia la comunidad.</i>\n` +
    `${dateFormatted}`
  );
}

function burnStaffReport(reportId, reporterMention, targetLabel, context, proofsCount = 0) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [PANEL STAFF] DENUNCIA DE ESTAFA #${reportId}</b>\n` +
    `──────\n\n` +
    `〖🛡️〗 <b>Reportante:</b> ${reporterMention}\n` +
    `〖👤〗 <b>Acusado:</b> ${targetLabel}\n` +
    `〖📷〗 <b>Evidencias:</b> <code>${proofsCount} captura(s)</code>\n\n` +
    `〖⚖️〗 <b>Contexto / Hechos:</b>\n` +
    `  ↳ <i>${escapeHtml(context)}</i>\n\n` +
    `──────\n` +
    `<b>Acciones de Moderación:</b>\n` +
    `${dateFormatted}`
  );
}

function burnAlertBroadcast(targetId, context = null, targetUsername = null, targetName = null) {
  const hasNumericId = targetId && Number(targetId) > 0;
  const idDisplay = hasNumericId ? `<code>${targetId}</code>` : '<i>Identificado por Alias</i>';
  const nameDisplay = targetName || (targetUsername ? `@${targetUsername}` : 'Estafador');
  const dateFormatted = getSuperscriptDate();

  let text =
    `<b>⟡ [LISTA NEGRA OFICIAL] ESTAFADOR QUEMADO Y REGISTRADO</b>\n` +
    `──────\n\n` +
    `〖☁〗 <b>Nombre / Alias:</b> <b>${escapeHtml(nameDisplay)}</b>\n` +
    (targetUsername ? `〖♝〗 <b>Username:</b> @${escapeHtml(targetUsername)}\n` : '') +
    `〖ϟ〗 <b>ID de Telegram:</b> ${idDisplay}\n` +
    `〖🔥〗 <b>Sanción:</b> ⊱ <code>BANEO GLOBAL PERMANENTE (GBAN)</code> ⊰\n\n`;

  if (context) {
    text += `〖⚖️〗 <b>Motivo / Hechos:</b>\n  ↳ <i>${escapeHtml(context)}</i>\n\n`;
  }

  text +=
    `──────\n` +
    `<i>Ventas Libres Perú — Tu seguridad es nuestra prioridad absoluta.</i>\n` +
    `${dateFormatted}`;
  return text;
}

function formatStaffUser(username, userId, bullet = '•', customTitle = null) {
  const cleanUser = username ? String(username).replace(/^@/, '').trim() : null;
  const userTag = cleanUser
    ? `<a href="https://t.me/${cleanUser}">@${escapeHtml(cleanUser)}</a>`
    : '<i>Sin @alias</i>';
  const idTag = userId ? `<code>${userId}</code>` : '';
  const titleTag = customTitle ? ` [<i>${escapeHtml(customTitle)}</i>]` : '';
  return `${bullet} ${userTag}${idTag ? ` (ID: ${idTag})` : ''}${titleTag}`;
}

function renderStaffList(groupedStaff, communityName = 'Ventas Libres Perú') {
  const dateFormatted = getSuperscriptDate();
  const cleanCommunity = (communityName || 'Ventas Libres Perú').trim();
  const botLabel = cleanCommunity.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || cleanCommunity;

  const admins = groupedStaff.admins || [];
  const dealAdmins = groupedStaff.dealAdmins || [];
  const totalCount = admins.length + dealAdmins.length;

  let output =
    `⟡ <b>[${escapeHtml(botLabel.toUpperCase())} BOT] ⊱ EQUIPO OFICIAL ⊰</b>\n` +
    `══════\n` +
    `▸ <b>Comunidad:</b> <b>${escapeHtml(cleanCommunity)}</b>\n` +
    `▸ <b>Personal Registrado:</b> <code>${totalCount} miembros</code>\n` +
    `▸ <b>Seguridad:</b> <code>OPERACIONES 100% AUDITADAS</code>\n` +
    `══════\n\n`;

  // 1. ADMINISTRADORES
  output += `❖ <b>ADMINISTRADORES</b>\n`;
  if (admins.length > 0) {
    for (const m of admins) {
      output += `${formatStaffUser(m.username, m.user_id, '•', m.custom_title)}\n`;
    }
  } else {
    output += `<i>• No registrados</i>\n`;
  }
  output += `\n`;

  // 2. TRATO ADMINS (MEDIADORES CERTIFICADOS)
  output += `✦ <b>TRATO ADMINS (MEDIADORES CERTIFICADOS)</b>\n`;
  if (dealAdmins.length > 0) {
    for (const m of dealAdmins) {
      const score = m.avgRating ? `${m.avgRating}/5.0 ★` : `5.0/5.0 ★`;
      const base = formatStaffUser(m.username, m.user_id, '•', m.custom_title);
      output += `${base} ⊱ <b>${score}</b> ⊰\n`;
    }
  } else {
    output += `<i>• No registrados</i>\n`;
  }

  output +=
    `\n──────\n` +
    `<i>Para compras y ventas 100% seguras exige siempre <code>/tratoadm</code>.</i>\n` +
    `${dateFormatted}`;
  return output;
}

function modLogEntry(action, moderatorMention, targetId, chatTitle, reason) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [LOG DE MODERACIÓN] ${action}</b>\n` +
    `──────\n\n` +
    `〖🛡️〗 <b>Moderador:</b> ${moderatorMention}\n` +
    `〖ϟ〗 <b>Objetivo:</b> <code>${targetId}</code>\n` +
    `〖❖〗 <b>Grupo:</b> ${escapeHtml(chatTitle || 'N/A')}\n` +
    `〖⚖️〗 <b>Motivo:</b> ${escapeHtml(reason || 'Sin especificar')}\n` +
    `〖⏱️〗 <b>Registro:</b> <code>${new Date().toISOString()}</code>\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function periodicSecurityNotice() {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [VENTAS LIBRES PERÚ] AVISO DE SEGURIDAD</b>\n` +
    `──────\n\n` +
    `⟡ <b>Recomendaciones para un comercio 100% seguro:</b>\n\n` +
    `〖1〗 Verifica siempre al equipo oficial con <code>/staff</code>.\n` +
    `〖2〗 Usa <code>/tratoadm</code> para retener y proteger tu dinero.\n` +
    `〖3〗 No confíes en tratos por mensajes privados con desconocidos.\n\n` +
    `──────\n` +
    `<i>Staff Oficial — Ventas Libres Perú</i>\n` +
    `${dateFormatted}`
  );
}

function periodicNoticeKeyboard(botUsername = 'ventas_libres_peru_Bot') {
  const { InlineKeyboard } = require('grammy');
  return new InlineKeyboard()
    .url(toMathBold('TRATO ADMIN'), `https://t.me/${botUsername}?start=tratoadm`).primary()
    .url(toMathBold('STAFF'), `https://t.me/${botUsername}?start=staff`).success()
    .row()
    .url(toMathBold('REPORTAR ESTAFA'), `https://t.me/${botUsername}?start=quemar`).danger();
}

function scamKeywordReply(firstName, username) {
  const userTag = username ? `@${username}` : (firstName ? `<b>${escapeHtml(firstName)}</b>` : 'Estimado usuario');
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [CENTRAL DE SEGURIDAD] ALERTA DE ESTAFA</b>\n` +
    `──────\n\n` +
    `${userTag}, si fuiste víctima de estafa:\n\n` +
    `〖1〗 Guarda todas las capturas de chat y vouchers de pago.\n` +
    `〖2〗 Escribe <code>/quemar</code> al bot por privado.\n` +
    `〖3〗 El Staff investigará y emitirá Baneo Global.\n\n` +
    `──────\n` +
    `<i>Ventas Libres Perú — Tu seguridad es nuestra prioridad.</i>\n` +
    `${dateFormatted}`
  );
}

module.exports = {
  periodicSecurityNotice,
  periodicNoticeKeyboard,
  scamKeywordReply,
  welcomeMessage,
  verificationSuccess,
  verificationFailed,
  howItWorksMessage,
  dealMainMenuMessage,
  dealDetailedInfoMessage,
  dealRoleStepMessage,
  dealCategoryStepMessage,
  dealCounterpartStepMessage,
  dealCurrencyStepMessage,
  dealAmountStepMessage,
  dealPaymentMethodStepMessage,
  dealDescriptionStepMessage,
  dealSummaryMessage,
  dealWaitingMessage,
  dealNotifyAdmin,
  dealAcceptedGroup,
  dealInviteMessage,
  dealCounterpartInviteMessage,
  dealTopicWelcomeBanner,
  dealFundsReceivedBanner,
  dealDeliveryNotifiedBanner,
  dealBuyerConfirmedBanner,
  dealDisputeBanner,
  dealRefundBanner,
  dealVoucherTicket,
  dealMyDealsMessage,
  dealCalculatorMessage,
  escrowGroupConfigured,
  escrowGroupNotForumError,
  escrowGroupNoPermissionError,
  dealRatingMessage,
  dealCancelledMessage,
  burnCancelledMessage,
  burnInitialPrompt,
  burnAskIdPrompt,
  burnAskUsernamePrompt,
  burnContextPrompt,
  burnProofPrompt,
  burnSummaryMessage,
  burnSentMessage,
  burnStaffReport,
  burnAlertBroadcast,
  renderStaffList,
  modLogEntry,
};
