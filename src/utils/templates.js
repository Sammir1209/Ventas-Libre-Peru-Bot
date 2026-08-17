const { SYM } = require('../config/constants');
const { escapeHtml } = require('./formatting');

// ══════════════════════════════════════════════════════
// ⟡ Plantillas HTML — Ventas Libres Perú
// ══════════════════════════════════════════════════════

/**
 * Mensaje de bienvenida para nuevos miembros.
 */
function welcomeMessage(username, firstName) {
  const mention = username
    ? `@${username}`
    : `<b>${escapeHtml(firstName || 'Usuario')}</b>`;

  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>VENTAS LIBRES PERÚ</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.STAR} ¡Hola, ${mention}!\n\n` +
    `${SYM.ARROW} Has ingresado en modo <b>silenciado</b> por seguridad.\n` +
    `${SYM.ARROW} Para desbloquear tu acceso y escribir en el grupo:\n\n` +
    `${SYM.BULLET} 1. Únete a nuestros canales obligatorios pulsando <b>[ Unirme ]</b>.\n` +
    `${SYM.BULLET} 2. Pulsa el botón <b>[ Verificar ]</b>.\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <i>Solo toma unos segundos.</i>`
  );
}

/**
 * Mensaje de éxito tras verificar membresía.
 */
function verificationSuccess(username, firstName) {
  const mention = username
    ? `@${username}`
    : `<b>${escapeHtml(firstName || 'Usuario')}</b>`;

  return (
    `${SYM.DIAMOND} <b>Verificación Exitosa</b>\n\n` +
    `${SYM.CHECK} <b>${mention}</b>, tus restricciones han sido removidas.\n` +
    `${SYM.ARROW} Ahora tienes membresía normal. Bienvenido ${SYM.STAR}`
  );
}

/**
 * Mensaje cuando faltan canales por unirse.
 */
function verificationFailed(missingChannels) {
  const list = missingChannels.map(ch => {
    if (ch.startsWith('http')) {
      return `${SYM.BULLET} <a href="${ch}">${ch}</a>`;
    }
    if (ch.startsWith('@')) {
      return `${SYM.BULLET} <a href="https://t.me/${ch.replace('@', '')}">${ch}</a>`;
    }
    return `${SYM.BULLET} <code>${ch}</code>`;
  }).join('\n');

  return (
    `${SYM.DIAMOND} <b>Verificación Fallida</b>\n\n` +
    `${SYM.CROSS} Aún no estás en todos los canales obligatorios:\n\n` +
    `${list}\n\n` +
    `${SYM.ARROW} Únete a todos y pulsa <b>[ Verificar ]</b> nuevamente.`
  );
}

/**
 * Información sobre cómo funciona el sistema.
 */
function howItWorksMessage() {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>¿Cómo funciona?</b>\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.BULLET} Al ingresar a un grupo oficial, serás silenciado automáticamente.\n\n` +
    `${SYM.BULLET} Para escribir, debes unirte a nuestros canales y grupos obligatorios.\n\n` +
    `${SYM.BULLET} Tras unirte, pulsa <b>[ Verificar ]</b> y el bot comprobará tu membresía.\n\n` +
    `${SYM.BULLET} Si todo está correcto, se te removerán las restricciones al instante.\n\n` +
    `${SYM.THIN_LINE}`
  );
}

/**
 * Plantilla del menú principal /tratoadm.
 */
function dealMainMenuMessage() {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>SISTEMA DE TRATOS ADMIN (ESCROW)</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.STAR} <b>Seguridad y Garantía en tus Transacciones</b>\n\n` +
    `${SYM.ARROW} Un <b>Trato Admin</b> es un servicio oficial donde un mediador certificado ` +
    `retiene los fondos o productos hasta que ambas partes cumplan con lo acordado.\n\n` +
    `${SYM.BULLET} <b>Comisión:</b> 10% fija sobre el valor del trato.\n` +
    `${SYM.BULLET} <b>Tiempo estimado de atención:</b> 1 a 5 minutos.\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.ARROW} Selecciona una opción para comenzar:`
  );
}

/**
 * Explicación detallada para [ Inf. Trato Adm ].
 */
function dealDetailedInfoMessage() {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>GUÍA COMPLETA: TRATOS ADMIN</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.STAR} <b>¿Qué es y por qué usarlo?</b>\n` +
    `${SYM.ARROW} El Trato Admin evita estafas al 100%. El comprador paga al Admin, ` +
    `el vendedor entrega el producto, el comprador verifica la entrega y el Admin libera el pago.\n\n` +
    `${SYM.STAR} <b>Paso a paso del proceso:</b>\n` +
    `${SYM.BULLET} <b>1. Solicitud:</b> Indicas si vendes o compras, el usuario de la contraparte y la descripción.\n` +
    `${SYM.BULLET} <b>2. Aceptación:</b> Un Trato Admin certificado toma tu caso.\n` +
    `${SYM.BULLET} <b>3. Grupo Privado:</b> Se genera un enlace exclusivo para el comprador, vendedor y admin.\n` +
    `${SYM.BULLET} <b>4. Custodia:</b> El dinero/producto queda retenido por el Admin.\n` +
    `${SYM.BULLET} <b>5. Cierre y Calificación:</b> Finalizada la entrega, se califica el servicio (1-5 ✦).\n\n` +
    `${SYM.STAR} <b>Tarifario de Comisión (10%):</b>\n` +
    `${SYM.BULLET} Trato de 10 soles ➜ Comisión: 1 sol.\n` +
    `${SYM.BULLET} Trato de 50 soles ➜ Comisión: 5 soles.\n` +
    `${SYM.BULLET} Trato de 100 soles ➜ Comisión: 10 soles.\n\n` +
    `${SYM.DIAMOND} <i>¡Nunca realices tratos por fuera del grupo oficial creado por el bot!</i>\n\n` +
    `${SYM.THIN_LINE}`
  );
}

/**
 * Paso 1 del formulario de Trato: Elección de rol.
 */
function dealRoleStepMessage() {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>NUEVA SOLICITUD DE TRATO ADMIN</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.STAR} <b>Paso 1 de 3: ¿Cuál es tu rol en la transacción?</b>\n\n` +
    `${SYM.ARROW} Selecciona si eres quien va a <b>Vender</b> o quien va a <b>Comprar</b>:`
  );
}

/**
 * Paso 2 del formulario de Trato: Contraparte.
 */
function dealCounterpartStepMessage(role) {
  const isSeller = role === 'VENDEDOR';
  const counterpartName = isSeller ? 'Comprador' : 'Vendedor';

  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>NUEVA SOLICITUD DE TRATO ADMIN</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.STAR} <b>Paso 2 de 3: Contraparte (${counterpartName})</b>\n\n` +
    `${SYM.ARROW} Como <b>${role}</b>, ¿con quién realizarás la transacción?\n\n` +
    `${SYM.BULLET} Escribe y envía el <b>@usuario</b> (ej. <code>@usuario123</code>) o el <b>ID numérico</b> del <b>${counterpartName}</b>:`
  );
}

/**
 * Paso 3 del formulario de Trato: Descripción.
 */
function dealDescriptionStepMessage(role, counterpart) {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>NUEVA SOLICITUD DE TRATO ADMIN</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.STAR} <b>Paso 3 de 3: Detalles de la Transacción</b>\n\n` +
    `${SYM.ARROW} Contraparte: <b>${escapeHtml(counterpart)}</b>\n\n` +
    `${SYM.BULLET} Envía una <b>breve descripción</b> de lo que se va a negociar.\n` +
    `  <i>Ejemplo: Venta de cuenta de juego nivel 50 por 40 soles</i>`
  );
}

/**
 * Paso 4: Resumen y confirmación de la solicitud de Trato.
 */
function dealSummaryMessage(role, counterpart, description) {
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';

  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>CONFIRMAR SOLICITUD DE TRATO</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.ARROW} <b>Tu Rol:</b> ${role}\n` +
    `${SYM.ARROW} <b>Contraparte (${counterpartRole}):</b> <code>${escapeHtml(counterpart)}</code>\n` +
    `${SYM.ARROW} <b>Detalles:</b> ${escapeHtml(description)}\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} ¿Deseas enviar esta solicitud a los Trato Admins disponibles?`
  );
}

/**
 * Mensaje de espera tras confirmar la solicitud de Trato.
 */
function dealWaitingMessage(dealId, role, counterpart, description) {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>SOLICITUD EN COLA DE ESPERA</b> #${dealId} ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.CHECK} <b>¡Solicitud enviada con éxito!</b>\n\n` +
    `${SYM.ARROW} <b>Tu Rol:</b> ${role}\n` +
    `${SYM.ARROW} <b>Contraparte:</b> <code>${escapeHtml(counterpart)}</code>\n` +
    `${SYM.ARROW} <b>Detalles:</b> ${escapeHtml(description)}\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} Los <b>Trato Admins</b> han sido notificados.\n` +
    `${SYM.STAR} En cuanto un admin tome tu caso, se generará el grupo privado.\n\n` +
    `${SYM.ARROW} <i>Puedes visitar nuestro canal oficial mientras esperas:</i>`
  );
}

/**
 * Notificación al admin cuando hay un trato pendiente (con información enriquecida).
 */
function dealNotifyAdmin(dealId, creatorUsername, creatorId, role, counterpart, description) {
  const mention = creatorUsername ? `@${creatorUsername}` : `ID: <code>${creatorId}</code>`;
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';

  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>NUEVA SOLICITUD DE TRATO #${dealId}</b> ⟡\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.ARROW} <b>Solicitado por:</b> ${mention} (Rol: <b>${role || 'N/A'}</b>)\n` +
    `${SYM.ARROW} <b>Contraparte (${counterpartRole}):</b> <code>${escapeHtml(counterpart || 'N/A')}</code>\n` +
    `${SYM.ARROW} <b>Descripción:</b> ${escapeHtml(description || 'Sin especificar')}\n` +
    `${SYM.ARROW} <b>Estado:</b> ⏳ En cola de espera\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} Pulsa <b>[ Aceptar Trato ]</b> para tomar este caso y crear el grupo.`
  );
}

/**
 * Confirmación en grupo de que un admin tomó el trato.
 */
function dealAcceptedGroup(dealId, adminUsername) {
  const mention = adminUsername ? `@${adminUsername}` : 'Admin';
  return (
    `${SYM.DIAMOND} <b>Trato #${dealId} Aceptado</b>\n\n` +
    `${SYM.CHECK} El admin <b>${mention}</b> ha tomado este caso.\n` +
    `${SYM.ARROW} Se está preparando el grupo privado de negociación${SYM.DOT}${SYM.DOT}${SYM.DOT}`
  );
}

/**
 * Mensaje DM al creador del trato con el enlace de acceso al grupo/hilo.
 */
function dealInviteMessage(dealId, inviteLink, topicLink, counterpart, role, description) {
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  const cleanCounterpart = (counterpart || 'N/A').startsWith('@') ? counterpart : `@${counterpart}`;

  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>SALA DE TRATO ADMIN N°${dealId} CREADA</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.CHECK} <b>¡Tu sala privada de negociación está lista!</b>\n\n` +
    `${SYM.ARROW} <b>Tu Rol:</b> <b>${role}</b>\n` +
    `${SYM.ARROW} <b>Contraparte (${counterpartRole}):</b> <b>${cleanCounterpart}</b>\n` +
    `${SYM.ARROW} <b>Detalles:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <b>Enlace de Acceso a la Sala:</b>\n` +
    `👉 <a href="${inviteLink}"><b>[ Entrar a la Sala Trato N°${dealId} ]</b></a>\n\n` +
    `${SYM.STAR} <b>Instrucciones:</b>\n` +
    `${SYM.BULLET} Pulsa el enlace para unirte a la sala de negociación.\n` +
    `${SYM.BULLET} El Trato Admin supervisará la entrega y el pago.\n` +
    `${SYM.BULLET} Al finalizar la transacción, el admin cerrará la sala.\n` +
    `${SYM.THIN_LINE}`
  );
}

/**
 * Mensaje DM enviado a la CONTRAPARTE con su perspectiva invertida (ej: Comprador/Vendedor).
 */
function dealCounterpartInviteMessage(dealId, inviteLink, creatorMention, myRole, creatorRole, description) {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>SALA DE TRATO ADMIN N°${dealId} CREADA</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.CHECK} <b>¡Tu sala privada de negociación está lista!</b>\n\n` +
    `${SYM.ARROW} <b>Tu Rol:</b> <b>${myRole}</b>\n` +
    `${SYM.ARROW} <b>Contraparte (${creatorRole}):</b> <b>${creatorMention}</b>\n` +
    `${SYM.ARROW} <b>Detalles:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <b>Enlace de Acceso a la Sala:</b>\n` +
    `👉 <a href="${inviteLink}"><b>[ Entrar a la Sala Trato N°${dealId} ]</b></a>\n\n` +
    `${SYM.STAR} <b>Instrucciones:</b>\n` +
    `${SYM.BULLET} Pulsa el enlace para unirte a la sala de negociación.\n` +
    `${SYM.BULLET} El Trato Admin supervisará la entrega y el pago.\n` +
    `${SYM.BULLET} Al finalizar la transacción, el admin cerrará la sala.\n` +
    `${SYM.THIN_LINE}`
  );
}

/**
 * Banner de bienvenida fijado en el hilo/topic creado.
 */
function dealTopicWelcomeBanner(dealId, creatorMention, counterpart, adminMention, description, role) {
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';

  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>SALA DE MEDIACIÓN — TRATO ADMIN N°${dealId}</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.ARROW} <b>Solicitante (${role}):</b> ${creatorMention}\n` +
    `${SYM.ARROW} <b>Contraparte (${counterpartRole}):</b> <code>${escapeHtml(counterpart || 'N/A')}</code>\n` +
    `${SYM.ARROW} <b>Trato Admin Asignado:</b> ${adminMention}\n` +
    `${SYM.ARROW} <b>Descripción:</b> ${escapeHtml(description || 'Sin especificar')}\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <b>Reglas de Seguridad:</b>\n` +
    `${SYM.BULLET} Toda la conversación y comprobantes deben enviarse en este hilo.\n` +
    `${SYM.BULLET} El comprador transfiere el dinero al <b>Trato Admin</b> asignado.\n` +
    `${SYM.BULLET} El vendedor entrega el producto una vez que el Admin confirme el pago en custodia.\n` +
    `${SYM.BULLET} Al finalizar, el Trato Admin cerrará este hilo con el botón inferior.\n\n` +
    `${SYM.DIAMOND} <i>Ventas Libres Perú — Garantía y Confianza</i>`
  );
}

/**
 * Mensaje de éxito al configurar el grupo oficial de tratos.
 */
function escrowGroupConfigured(groupTitle, groupId) {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>GRUPO OFICIAL DE TRATOS CONFIGURADO</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.CHECK} <b>Grupo:</b> ${escapeHtml(groupTitle)}\n` +
    `${SYM.ARROW} <b>ID:</b> <code>${groupId}</code>\n` +
    `${SYM.ARROW} <b>Opción de Temas (Hilos / Topics):</b> <b>ACTIVADA ✓</b>\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} A partir de ahora, cada Trato Admin aceptado creará automáticamente un hilo dedicado:\n` +
    `<b>"⟡ Trato Admin N°X"</b> dentro de este grupo.`
  );
}

/**
 * Error cuando el grupo no tiene la opción de temas/hilos activada.
 */
function escrowGroupNotForumError() {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.CROSS} <b>OPCIÓN DE TEMAS NO DETECTADA</b> ${SYM.CROSS}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.ARROW} Este grupo <b>NO tiene activada la función de Temas (Topics / Hilos)</b>.\n\n` +
    `${SYM.STAR} <b>¿Cómo activarlo en Telegram?</b>\n` +
    `${SYM.BULLET} 1. Abre el perfil del Grupo y toca en <b>Editar</b> (ícono de lápiz).\n` +
    `${SYM.BULLET} 2. Busca la opción <b>"Temas" (Topics / Hilos)</b>.\n` +
    `${SYM.BULLET} 3. Actívala y guarda los cambios.\n` +
    `${SYM.BULLET} 4. Asegúrate de que el bot sea <b>Administrador</b> con permisos de <b>"Gestionar temas" (Manage Topics)</b>.\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.ARROW} <i>Una vez activado, vuelve a enviar <code>/set_grupo_tratos</code> aquí.</i>`
  );
}

/**
 * Error cuando el bot no tiene permisos de gestionar temas.
 */
function escrowGroupNoPermissionError() {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.CROSS} <b>PERMISOS INSUFICIENTES</b> ${SYM.CROSS}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.ARROW} El bot necesita ser <b>Administrador</b> del grupo con el permiso:\n` +
    `${SYM.BULLET} <b>Gestionar temas (Manage Topics / Create Topics)</b>\n` +
    `${SYM.BULLET} <b>Invitar usuarios mediante enlace</b>\n\n` +
    `${SYM.ARROW} Dale los permisos necesarios y vuelve a ejecutar <code>/set_grupo_tratos</code>.`
  );
}

/**
 * Mensaje de calificación al finalizar un trato.
 */
function dealRatingMessage(dealId, adminUsername) {
  const mention = adminUsername ? `@${adminUsername}` : 'el Trato Admin';
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>CALIFICACIÓN DE SERVICIO (ESCROW)</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.CHECK} <b>¡Tu Trato Admin N°${dealId} ha sido completado con éxito!</b>\n\n` +
    `${SYM.ARROW} <b>Mediador Asignado:</b> <b>${mention}</b>\n` +
    `${SYM.ARROW} <b>Garantía:</b> Fondos y productos verificados.\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <b>¿Cómo calificarías la atención de ${mention}?</b>\n` +
    `<i>Tu puntuación ayuda a mejorar la reputación del mediador en la comunidad:</i>`
  );
}

/**
 * Trato cancelado.
 */
function dealCancelledMessage(dealId) {
  return (
    `${SYM.DIAMOND} <b>Trato #${dealId} Cancelado</b>\n\n` +
    `${SYM.CROSS} La solicitud de trato ha sido cancelada.`
  );
}

/**
 * Advertencia y selección inicial del método de identificación para /quemar.
 */
function burnInitialPrompt() {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFADORES (/QUEMAR)</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.STAR} <b>ADVERTENCIA ESTRICTA</b>\n` +
    `${SYM.BULLET} El uso <b>falso o de broma</b> de este sistema resultará en <b>Baneo Global Permanente</b>.\n` +
    `${SYM.BULLET} Solo procede si dispones de <b>pruebas fotográficas reales</b>.\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <b>Paso 1/3:</b> ¿Cómo deseas identificar al acusado?`
  );
}

function burnAskIdPrompt() {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>IDENTIFICACIÓN POR ID NUMÉRICO</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.ARROW} Envía el <b>ID numérico de Telegram</b> del acusado:\n` +
    `<i>Ejemplo: <code>8579513055</code></i>\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <i>Puedes consultar su ID mediante bots de información o reenviando uno de sus mensajes.</i>`
  );
}

function burnAskUsernamePrompt() {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>IDENTIFICACIÓN POR @USERNAME</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.ARROW} Envía el <b>@Username</b> del acusado:\n` +
    `<i>Ejemplo: <code>@usuario_estafador</code></i>\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <i>Escribe el @ de su perfil público.</i>`
  );
}

/**
 * Paso 2 del flujo /quemar (Descripción de los hechos).
 */
function burnContextPrompt(targetLabel) {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>DETALLES DE LA ESTAFA</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.CHECK} <b>Acusado:</b> <b>${targetLabel}</b>\n\n` +
    `${SYM.ARROW} <b>Paso 2/3:</b> Describe detalladamente lo que sucedió:\n` +
    `${SYM.BULLET} Monto de dinero o producto involucrado.\n` +
    `${SYM.BULLET} Cómo se llevó a cabo el engaño o incumplimiento.\n` +
    `${SYM.BULLET} Cualquier dato extra relevante.\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <i>Escribe tu relato completo en un solo mensaje.</i>`
  );
}

/**
 * Paso 3 del flujo /quemar (Pruebas fotográficas obligatorias).
 */
function burnProofPrompt(targetLabel, proofsCount = 0) {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>EVIDENCIAS Y CAPTURAS (OBLIGATORIO)</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.CHECK} <b>Acusado:</b> <b>${targetLabel}</b>\n` +
    `${SYM.ARROW} <b>Capturas subidas:</b> <b>${proofsCount}</b>\n\n` +
    `${SYM.STAR} <b>Paso 3/3:</b> Envía las <b>capturas de pantalla / fotos</b> de prueba:\n` +
    `${SYM.BULLET} Comprobantes de pago / transferencias.\n` +
    `${SYM.BULLET} Capturas de la conversación con el acusado.\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.ARROW} <b>Es obligatorio adjuntar al menos 1 captura</b> para validar el reporte.`
  );
}

/**
 * Resumen final para confirmación antes de enviar.
 */
function burnSummaryMessage(targetLabel, context, proofsCount) {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>RESUMEN DEL REPORTE DE ESTAFA</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `👤 <b>Acusado:</b> <b>${targetLabel}</b>\n` +
    `📸 <b>Pruebas Adjuntas:</b> <b>${proofsCount} captura(s)</b>\n\n` +
    `📝 <b>Descripción de los Hechos:</b>\n` +
    `<i>${escapeHtml(context)}</i>\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <i>Verifica los datos. Si todo es correcto, pulsa <b>[ Quemar ]</b> para enviar la denuncia al Staff.</i>`
  );
}

/**
 * Mensaje tras enviar el reporte de quemar.
 */
function burnSentMessage() {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.CHECK} <b>REPORTE ENVIADO AL STAFF CON ÉXITO</b> ${SYM.CHECK}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.CHECK} Tu denuncia y pruebas (capturas) han sido enviadas al equipo de moderación.\n` +
    `${SYM.ARROW} El caso será revisado minuciosamente por los Admins.\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <i>Gracias por colaborar en mantener segura la comunidad de Ventas Libres Perú.</i>`
  );
}

/**
 * Reporte que recibe el staff en su grupo privado.
 */
function burnStaffReport(reportId, reporterMention, targetId, context) {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>NUEVO REPORTE DE ESTAFA</b> #${reportId}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.ARROW} <b>Reportante:</b> ${reporterMention}\n` +
    `${SYM.ARROW} <b>Acusado (ID):</b> <code>${targetId}</code>\n\n` +
    `${SYM.STAR} <b>Contexto / Historia:</b>\n` +
    `${escapeHtml(context)}\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.ARROW} <b>Acciones del Staff:</b>`
  );
}

/**
 * Alerta broadcast cuando un estafador es quemado.
 */
function burnAlertBroadcast(targetId) {
  return (
    `${SYM.DIVIDER}\n` +
    `${SYM.CROSS} <b>ALERTA DE ESTAFADOR QUEMADO</b> ${SYM.CROSS}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.CROSS} El usuario con ID <code>${targetId}</code> ha sido\n` +
    `<b>baneado permanentemente</b> de todos los grupos oficiales.\n\n` +
    `${SYM.STAR} <b>Motivo:</b> Estafa confirmada por el Staff.\n\n` +
    `${SYM.ARROW} Si has tenido trato con esta persona,\n` +
    `contacta al Staff inmediatamente.\n\n` +
    `${SYM.DIVIDER}`
  );
}

/**
 * Renderizado de la lista /staff con jerarquía y formato exacto.
 */
function renderStaffList(groupedStaff) {
  let output = (
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>STAFF — VENTAS LIBRES PERÚ</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n`
  );

  // 1. OWNER(s)
  output += `<b>OWNER(s)</b>\n`;
  if (groupedStaff.owners.length > 0) {
    for (const m of groupedStaff.owners) {
      const userTag = m.username ? `@${m.username}` : `(Sin username)`;
      const name = m.first_name || m.username || 'Owner';
      output += `${SYM.DIAMOND} ${userTag} | ${escapeHtml(name)} | <code>${m.user_id}</code>\n`;
    }
  } else {
    output += `<i>No registrados</i>\n`;
  }
  output += `\n`;

  // 2. Co-Owner(s)
  output += `<b>Co-Owner(s)</b>\n`;
  if (groupedStaff.coowners.length > 0) {
    for (const m of groupedStaff.coowners) {
      const userTag = m.username ? `@${m.username}` : `(Sin username)`;
      const name = m.first_name || m.username || 'Co-Owner';
      output += `${SYM.DIAMOND} ${userTag} | ${escapeHtml(name)} | <code>${m.user_id}</code>\n`;
    }
  } else {
    output += `<i>No registrados</i>\n`;
  }
  output += `\n`;

  // 3. ADMIN(s)
  output += `<b>ADMIN(s)</b>\n`;
  if (groupedStaff.admins.length > 0) {
    for (const m of groupedStaff.admins) {
      const userTag = m.username ? `@${m.username}` : `(Sin username)`;
      const name = m.first_name || m.username || 'Admin';
      output += `${SYM.DIAMOND} ${userTag} | ${escapeHtml(name)} | <code>${m.user_id}</code>\n`;
    }
  } else {
    output += `<i>No registrados</i>\n`;
  }
  output += `\n`;

  // 4. TRATO ADMIN
  output += `<b>TRATO ADMIN</b>\n`;
  if (groupedStaff.dealAdmins.length > 0) {
    for (const m of groupedStaff.dealAdmins) {
      const userTag = m.username ? `@${m.username}` : `(Sin username)`;
      const name = m.first_name || m.username || 'Trato Admin';
      const score = m.avgRating ? `${m.avgRating}/5 ${SYM.STAR_FULL}` : `5/5 ${SYM.STAR_FULL}`;
      output += `${SYM.DIAMOND} ${userTag} | ${escapeHtml(name)} | <code>${m.user_id}</code> | Score: ${score}\n`;
    }
  } else {
    output += `<i>No registrados</i>\n`;
  }

  output += `\n${SYM.THIN_LINE}\n`;
  output += `${SYM.SHIELD} <b>RECOMENDACIÓN DE SEGURIDAD:</b>\n`;
  output += `» Para garantizar una <b>compra y venta 100% segura</b> y evitar riesgos de estafa, realiza siempre tus transacciones mediante <b>/tratoadm</b> con un mediador certificado del Staff.\n`;
  output += `\n${SYM.DIVIDER}`;
  return output;
}

/**
 * Log de moderación.
 */
function modLogEntry(action, moderatorMention, targetId, chatTitle, reason) {
  return (
    `${SYM.DIAMOND} <b>LOG: ${action}</b>\n\n` +
    `${SYM.ARROW} <b>Moderador:</b> ${moderatorMention}\n` +
    `${SYM.ARROW} <b>Objetivo:</b> <code>${targetId}</code>\n` +
    `${SYM.ARROW} <b>Grupo:</b> ${chatTitle || 'N/A'}\n` +
    `${SYM.ARROW} <b>Razón:</b> ${reason || 'Sin especificar'}\n` +
    `${SYM.ARROW} <b>Fecha:</b> <code>${new Date().toISOString()}</code>`
  );
/**
 * Plantilla de respuesta automática cuando un usuario menciona que fue estafado o quiere quemar/reportar.
 */
function scamKeywordReply(firstName, username) {
  const userTag = username ? `@${username}` : (firstName ? `<b>${escapeHtml(firstName)}</b>` : 'Estimado usuario');
  return (
    `${SYM.DIVIDER}\n` +
    `🚨 <b>CENTRAL DE REPORTES Y ANTI-ESTAFAS</b> 🚨\n` +
    `${SYM.DIVIDER}\n\n` +
    `Hola ${userTag}, si has sido víctima de una estafa o deseas quemar a un estafador:\n\n` +
    `📌 <b>Pasos para reportar de forma segura:</b>\n` +
    `1️⃣ <b>Guarda las pruebas:</b> No borres capturas de pantalla, comprobantes de pago ni el chat con el estafador.\n` +
    `2️⃣ <b>Inicia tu reporte privado:</b> Pulsa el botón de abajo o escribe <code>/quemar</code> directamente al bot.\n` +
    `3️⃣ <b>Evaluación del Staff:</b> Nuestro equipo revisará las pruebas y publicará la ficha oficial en el <b>Canal de Quemados</b> y la <b>Lista Negra</b>.\n\n` +
    `${SYM.THIN_LINE}\n` +
    `🛡️ <i>Ventas Libres Perú — Tu seguridad es nuestra prioridad.</i>`
  );
}

module.exports = {
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
  scamKeywordReply,
};
