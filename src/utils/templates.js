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
    `<b>⟡ [SOLICITUD DE TRATO] PASO 1 DE 3</b>\n` +
    `──────\n\n` +
    `〖⚖️〗 <b>Pregunta:</b> ¿Cuál es tu rol en la transacción?\n\n` +
    `Selecciona si vas a <b>Vender</b> o <b>Comprar</b>:\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealCounterpartStepMessage(role) {
  const counterpartName = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [SOLICITUD DE TRATO] PASO 2 DE 3</b>\n` +
    `──────\n\n` +
    `〖☾〗 <b>Tu rol:</b> <code>${role}</code>\n` +
    `〖⚖️〗 <b>Pregunta:</b> ¿Con quién vas a realizar la transacción?\n\n` +
    `Envía el <b>@usuario</b> o <b>ID numérico</b> del <b>${counterpartName}</b>:\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealDescriptionStepMessage(role, counterpart) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [SOLICITUD DE TRATO] PASO 3 DE 3</b>\n` +
    `──────\n\n` +
    `〖☾〗 <b>Tu rol:</b> <code>${role}</code>\n` +
    `〖👤〗 <b>Contraparte:</b> <code>${escapeHtml(counterpart)}</code>\n\n` +
    `Envía una descripción clara de la operación (producto, monto y método de pago):\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function dealSummaryMessage(role, counterpart, description) {
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  const counterpartEmoji = role === 'VENDEDOR' ? '〖👤〗' : '〖💼〗';
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [ESCROW OFICIAL] CONFIRMAR SOLICITUD</b>\n` +
    `──────\n\n` +
    `〖☾〗 <b>Tu Rol:</b> <code>${role}</code>\n` +
    `${counterpartEmoji} <b>${counterpartRole}:</b> <code>${escapeHtml(counterpart)}</code>\n` +
    `〖📦〗 <b>Detalles de la operación:</b>\n` +
    `  ↳ <i>${escapeHtml(description)}</i>\n\n` +
    `──────\n` +
    `¿Deseas enviar la solicitud al equipo de mediadores oficiales?\n` +
    `${dateFormatted}`
  );
}

function dealWaitingMessage(dealId, role, counterpart, description) {
  const counterpartEmoji = role === 'VENDEDOR' ? '〖👤〗' : '〖💼〗';
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [TRATO #${dealId}] SOLICITUD EN COLA</b>\n` +
    `──────\n\n` +
    `✓ <b>Solicitud registrada exitosamente en cola de atención.</b>\n\n` +
    `〖☾〗 <b>Tu Rol:</b> <code>${role}</code>\n` +
    `${counterpartEmoji} <b>Contraparte:</b> <code>${escapeHtml(counterpart)}</code>\n` +
    `〖📦〗 <b>Detalles:</b> <i>${escapeHtml(description)}</i>\n\n` +
    `──────\n` +
    `<i>El equipo de <b>Trato Admins</b> ha sido notificado. En breve un mediador tomará tu caso.</i>\n` +
    `${dateFormatted}`
  );
}

function dealNotifyAdmin(dealId, creatorUsername, creatorId, role, counterpart, description) {
  const userTag = creatorUsername ? `@${creatorUsername}` : `<code>${creatorId}</code>`;
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  const counterpartEmoji = role === 'VENDEDOR' ? '〖👤〗' : '〖💼〗';
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [CASO #${dealId}] NUEVA SOLICITUD DE TRATO</b>\n` +
    `──────\n\n` +
    `〖👤〗 <b>Solicitante:</b> ${userTag} (<code>${role || 'N/A'}</code>)\n` +
    `${counterpartEmoji} <b>${counterpartRole}:</b> <code>${escapeHtml(counterpart || 'N/A')}</code>\n` +
    `〖📦〗 <b>Descripción:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `──────\n` +
    `<i>Selecciona una acción para tomar o declinar este caso:</i>\n` +
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

function dealInviteMessage(dealId, inviteLink, topicLink, counterpart, role, description) {
  const cleanRole = (role || '').toUpperCase();
  const myRole = cleanRole === 'VENDEDOR' ? 'Vendedor' : (cleanRole === 'COMPRADOR' ? 'Comprador' : (role || 'Solicitante'));
  const counterpartRole = cleanRole === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  const counterpartEmoji = cleanRole === 'VENDEDOR' ? '〖👤〗' : '〖💼〗';
  const cleanCounterpart = (!counterpart || counterpart === 'N/A' || counterpart === 'Sin especificar')
    ? 'No especificado'
    : (counterpart.startsWith('@') || /^\d+$/.test(counterpart) ? counterpart : `@${counterpart}`);
  const dateFormatted = getSuperscriptDate();

  return (
    `<b>⟡ [TRATO #${dealId}] SALA DE MEDIACIÓN LISTA</b>\n` +
    `──────\n\n` +
    `〖☾〗 <b>Tu Rol:</b> <code>${myRole}</code>\n` +
    `${counterpartEmoji} <b>${counterpartRole}:</b> <code>${escapeHtml(cleanCounterpart)}</code>\n` +
    `〖📦〗 <b>Detalles:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `〖✦〗 <b>Acceso:</b> <a href="${inviteLink}"><b>[ ENTRAR A LA SALA #${dealId} ]</b></a>\n\n` +
    `──────\n` +
    `<i>El Trato Admin retendrá los fondos y supervisará la entrega en este hilo oficial.</i>\n` +
    `${dateFormatted}`
  );
}

function dealCounterpartInviteMessage(dealId, inviteLink, creatorMention, myRole, creatorRole, description) {
  const dateFormatted = getSuperscriptDate();
  return (
    `<b>⟡ [TRATO #${dealId}] SALA DE MEDIACIÓN LISTA</b>\n` +
    `──────\n\n` +
    `〖☾〗 <b>Tu Rol:</b> <code>${myRole || 'Participante'}</code>\n` +
    `〖👤〗 <b>${creatorRole || 'Solicitante'}:</b> ${creatorMention}\n` +
    `〖📦〗 <b>Detalles:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `〖✦〗 <b>Acceso:</b> <a href="${inviteLink}"><b>[ ENTRAR A LA SALA #${dealId} ]</b></a>\n\n` +
    `──────\n` +
    `<i>El Trato Admin retendrá los fondos y supervisará la entrega en este hilo oficial.</i>\n` +
    `${dateFormatted}`
  );
}

function dealTopicWelcomeBanner(dealId, creatorMention, counterpart, adminMention, description, role) {
  const cleanRole = (role || '').toUpperCase();
  const creatorRoleName = cleanRole === 'VENDEDOR' ? 'Vendedor' : (cleanRole === 'COMPRADOR' ? 'Comprador' : (role || 'Solicitante'));
  const counterpartRoleName = cleanRole === 'VENDEDOR' ? 'Comprador' : (cleanRole === 'COMPRADOR' ? 'Vendedor' : 'Contraparte');
  const creatorEmoji = cleanRole === 'VENDEDOR' ? '〖💼〗' : '〖👤〗';
  const counterpartEmoji = cleanRole === 'VENDEDOR' ? '〖👤〗' : '〖💼〗';
  const cleanCounterpart = (!counterpart || counterpart === 'N/A' || counterpart === 'Sin especificar')
    ? 'No especificado'
    : (counterpart.startsWith('@') || /^\d+$/.test(counterpart) ? counterpart : `@${counterpart}`);
  const dateFormatted = getSuperscriptDate();

  return (
    `<b>⟡ [SALA #${dealId}] TRATO ESCROW OFICIAL</b>\n` +
    `──────\n\n` +
    `${creatorEmoji} <b>${creatorRoleName}:</b> ${creatorMention}\n` +
    `${counterpartEmoji} <b>${counterpartRoleName}:</b> <code>${escapeHtml(cleanCounterpart)}</code>\n` +
    `〖⚖️〗 <b>Mediador Asignado:</b> ${adminMention}\n` +
    `〖📦〗 <b>Detalles del Trato:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `──────\n` +
    `<b>⟡ PROTOCOLO OFICIAL DE SEGURIDAD:</b>\n` +
    `〖1〗 Todo comprobante y dato debe enviarse únicamente en este hilo.\n` +
    `〖2〗 El Comprador paga directamente al Mediador (Trato Admin).\n` +
    `〖3〗 El Vendedor entrega el producto SOLO cuando el Mediador confirme el dinero retenido.\n` +
    `〖4〗 Tras conformidad, el Mediador liquida los fondos y cierra el trato.\n\n` +
    `──────\n` +
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

function formatStaffUser(username, userId, defaultEmoji = '〖👤〗') {
  const cleanUser = username ? String(username).replace(/^@/, '').trim() : null;
  const userTag = cleanUser
    ? `<a href="https://t.me/${cleanUser}">@${escapeHtml(cleanUser)}</a>`
    : '<i>Sin @alias</i>';
  const idTag = userId ? `<code>${userId}</code>` : '';
  return `${defaultEmoji} ${userTag}${idTag ? ` | 〖ϟ〗 ${idTag}` : ''}`;
}

function renderStaffList(groupedStaff, communityName = 'Ventas Libres Perú') {
  const dateFormatted = getSuperscriptDate();
  const cleanCommunity = (communityName || 'Ventas Libres Perú').trim();
  const botLabel = cleanCommunity.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || cleanCommunity;

  let output =
    `<b>⟡ [${escapeHtml(botLabel.toUpperCase())} BOT] STAFF OFICIAL</b>\n` +
    `──────\n\n`;

  output += `<b>〖👑〗 OWNERS (Propietarios)</b>\n`;
  if (groupedStaff.owners && groupedStaff.owners.length > 0) {
    for (const m of groupedStaff.owners) {
      output += `${formatStaffUser(m.username, m.user_id, '〖👑〗')}\n`;
    }
  } else {
    output += `<i>• No registrados</i>\n`;
  }
  output += `\n`;

  output += `<b>〖◈〗 CO-OWNERS</b>\n`;
  if (groupedStaff.coowners && groupedStaff.coowners.length > 0) {
    for (const m of groupedStaff.coowners) {
      output += `${formatStaffUser(m.username, m.user_id, '〖◈〗')}\n`;
    }
  } else {
    output += `<i>• No registrados</i>\n`;
  }
  output += `\n`;

  output += `<b>〖🛡️〗 ADMINISTRADORES</b>\n`;
  if (groupedStaff.admins && groupedStaff.admins.length > 0) {
    for (const m of groupedStaff.admins) {
      output += `${formatStaffUser(m.username, m.user_id, '〖🛡️〗')}\n`;
    }
  } else {
    output += `<i>• No registrados</i>\n`;
  }
  output += `\n`;

  output += `<b>〖⚖️〗 TRATO ADMINS (Mediadores Certificados)</b>\n`;
  if (groupedStaff.dealAdmins && groupedStaff.dealAdmins.length > 0) {
    for (const m of groupedStaff.dealAdmins) {
      const score = m.avgRating ? `${m.avgRating}/5.0 ★` : `5.0/5.0 ★`;
      output += `${formatStaffUser(m.username, m.user_id, '〖⚖️〗')} ⊱ ${score} ⊰\n`;
    }
  } else {
    output += `<i>• No registrados</i>\n`;
  }

  output +=
    `\n──────\n` +
    `<i>Para compras y ventas 100% seguras usa <code>/tratoadm</code>.</i>\n` +
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
  dealCounterpartStepMessage,
  dealDescriptionStepMessage,
  dealSummaryMessage,
  dealWaitingMessage,
  dealNotifyAdmin,
  dealAcceptedGroup,
  dealInviteMessage,
  dealCounterpartInviteMessage,
  dealTopicWelcomeBanner,
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
