const { SYM } = require('../config/constants');
const { escapeHtml } = require('./formatting');

// ══════
// ⟡ Plantillas Estéticas Oficiales — Ventas Libres Perú 🇵🇪
// ══════

function welcomeMessage(username, firstName) {
  const mention = username
    ? `@${username}`
    : `<b>${escapeHtml(firstName || 'Usuario')}</b>`;

  return (
    `⟡ <b>𝐕𝐄𝐍𝐓𝐀𝐒 𝐋𝐈𝐁𝐑𝐄 𝐏𝐄𝐑𝐔</b> ⊱ <code>VERIFICACIÓN</code> ⊰\n` +
    `══════\n\n` +
    `¡Hola, ${mention}! Te damos la bienvenida oficial.\n` +
    `Actualmente te encuentras en modo <b>silenciado preventivo</b>.\n\n` +
    `▸ <b>Paso 1:</b> Únete a nuestros canales oficiales abajo.\n` +
    `▸ <b>Paso 2:</b> Pulsa el botón <b>[ ✓ VERIFICAR MEMBRESÍA ]</b>.\n` +
    `  ↳ <i>Proceso 100% automático y seguro en 3 segundos.</i>\n\n` +
    `──────\n` +
    `🛡️ <i>Manteniendo la comunidad libre de estafadores y cuentas falsas.</i>`
  );
}

function verificationSuccess(username, firstName) {
  const mention = username
    ? `@${username}`
    : `<b>${escapeHtml(firstName || 'Usuario')}</b>`;

  return (
    `⟡ <b>𝐕𝐄𝐍𝐓𝐀𝐒 𝐋𝐈𝐁𝐑𝐄 𝐏𝐄𝐑𝐔</b> ⊱ <code>ACCESO AUTORIZADO</code> ⊰\n` +
    `══════\n\n` +
    `✓ <b>Membresía validada:</b> ${mention}\n` +
    `▸ <b>Estado:</b> ⊱ <code>DESMUTEO EXITOSO</code> ⊰\n` +
    `▸ <b>Comunidad:</b> Ventas Libres Perú 🇵🇪\n\n` +
    `──────\n` +
    `✨ <i>¡Ya puedes participar, comerciar y chatear libremente!</i>`
  );
}

function verificationFailed(missingChannels) {
  const list = missingChannels.map(ch => {
    const raw = String(ch).trim();
    if (raw.includes('3My6QWWVjMw2Mzc8') || raw === '-1002561445231' || raw.includes('MADRE')) {
      return `▸ 📢 <a href="https://t.me/+3My6QWWVjMw2Mzc8"><b>Madre de las Ventas TV2</b></a>`;
    }
    if (raw.includes('quemando_ventaslibreperu')) {
      return `▸ 🔥 <a href="https://t.me/quemando_ventaslibreperu"><b>Quemando VLP (Lista Negra)</b></a>`;
    }
    if (raw.startsWith('http')) return `▸ 🔗 <a href="${raw}"><b>Canal Oficial</b></a>`;
    if (raw.startsWith('@')) return `▸ 🔗 <a href="https://t.me/${raw.replace('@', '')}"><b>${raw}</b></a>`;
    return `▸ <code>${raw}</code>`;
  }).join('\n');

  return (
    `⟡ <b>VERIFICACIÓN INCOMPLETA</b> ⊱ <code>CANALES PENDIENTES</code> ⊰\n` +
    `══════\n\n` +
    `Aún no registras suscripción activa a nuestros canales:\n\n${list}\n\n` +
    `──────\n` +
    `⚠️ <i>Únete a todos los canales arriba y pulsa nuevamente <b>[ ✓ VERIFICAR ]</b>.</i>`
  );
}

function howItWorksMessage() {
  return (
    `⟡ <b>¿CÓMO FUNCIONA?</b> ⊱ <code>GUÍA RÁPIDA</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>1.</b> Al ingresar al grupo, eres silenciado preventivamente.\n` +
    `▸ <b>2.</b> Te unes a nuestros canales oficiales verificados.\n` +
    `▸ <b>3.</b> Presionas el botón <b>[ ✓ Verificar ]</b>.\n` +
    `▸ <b>4.</b> El bot confirma tu membresía y desbloquea tu chat.\n\n` +
    `──────\n` +
    `💡 <i>Para transacciones seguras utiliza siempre <code>/tratoadm</code>.</i>`
  );
}

function dealMainMenuMessage() {
  return (
    `⟡ <b>𝐓𝐑𝐀𝐓𝐎 𝐀𝐃𝐌𝐈𝐍</b> ⊱ <code>ESCROW OFICIAL</code> ⊰\n` +
    `══════\n\n` +
    `Un <b>Trato Admin certificado</b> del Staff retiene los fondos y custodia la operación hasta la conformidad de ambas partes.\n\n` +
    `▸ <b>Comisión fija:</b> <code>10%</code>\n` +
    `▸ <b>Tiempo estimado:</b> <code>1 a 5 minutos</code>\n` +
    `▸ <b>Garantía:</b> 100% libre de robos y estafas\n\n` +
    `──────\n` +
    `👇 <i>Selecciona una opción en el menú inferior para iniciar:</i>`
  );
}

function dealDetailedInfoMessage() {
  return (
    `⟡ <b>GUÍA DE TRATOS SEGUROS</b> ⊱ <code>ESCROW VLP</code> ⊰\n` +
    `══════\n\n` +
    `El Trato Admin protege tanto al comprador como al vendedor reteniendo los fondos hasta comprobar la entrega real del producto o cuenta.\n\n` +
    `▸ <b>Paso 1:</b> Solicitas el trato indicando si vendes o compras.\n` +
    `▸ <b>Paso 2:</b> Un Trato Admin verificado toma tu caso.\n` +
    `▸ <b>Paso 3:</b> Se abre una sala privada en el grupo de mediaciones.\n` +
    `▸ <b>Paso 4:</b> El comprador transfiere los fondos al Trato Admin.\n` +
    `▸ <b>Paso 5:</b> El vendedor entrega el producto y se verifica.\n` +
    `▸ <b>Paso 6:</b> El Trato Admin libera el dinero y cierra el trato.\n\n` +
    `▸ <b>Tabla de Comisión (10%):</b>\n` +
    `  ↳ S/ 10.00 → Comisión S/ 1.00\n` +
    `  ↳ S/ 50.00 → Comisión S/ 5.00\n` +
    `  ↳ S/ 100.00 → Comisión S/ 10.00\n\n` +
    `──────\n` +
    `⚠️ <i>¡Nunca realices pagos por fuera de la sala oficial!</i>`
  );
}

function dealRoleStepMessage() {
  return (
    `⟡ <b>SOLICITUD DE TRATO</b> ⊱ <code>PASO 1 DE 3</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Pregunta:</b> ¿Cuál es tu rol en la transacción?\n\n` +
    `Selecciona si vas a <b>Vender</b> o <b>Comprar</b>:`
  );
}

function dealCounterpartStepMessage(role) {
  const counterpartName = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  return (
    `⟡ <b>SOLICITUD DE TRATO</b> ⊱ <code>PASO 2 DE 3</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Tu rol:</b> <code>${role}</code>\n` +
    `▸ <b>Pregunta:</b> ¿Con quién vas a realizar la transacción?\n\n` +
    `Envía el <b>@usuario</b> o <b>ID numérico</b> del <b>${counterpartName}</b>:`
  );
}

function dealDescriptionStepMessage(role, counterpart) {
  return (
    `⟡ <b>SOLICITUD DE TRATO</b> ⊱ <code>PASO 3 DE 3</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Tu rol:</b> <code>${role}</code>\n` +
    `▸ <b>Contraparte:</b> <code>${escapeHtml(counterpart)}</code>\n\n` +
    `Envía una descripción clara de la operación (producto, monto y método):`
  );
}

function dealSummaryMessage(role, counterpart, description) {
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  return (
    `⟡ <b>CONFIRMAR SOLICITUD DE TRATO</b> ⊱ <code>ESCROW</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Tu Rol:</b> <code>${role}</code>\n` +
    `▸ <b>${counterpartRole}:</b> <code>${escapeHtml(counterpart)}</code>\n` +
    `▸ <b>Detalles de la operación:</b>\n` +
    `  ↳ <i>${escapeHtml(description)}</i>\n\n` +
    `──────\n` +
    `¿Deseas enviar la solicitud al equipo de mediadores oficiales?`
  );
}

function dealWaitingMessage(dealId, role, counterpart, description) {
  return (
    `⟡ <b>SOLICITUD EN COLA</b> ⊱ <code>TRATO #${dealId}</code> ⊰\n` +
    `══════\n\n` +
    `✓ <b>Solicitud registrada exitosamente en cola de atención.</b>\n\n` +
    `▸ <b>Tu Rol:</b> <code>${role}</code>\n` +
    `▸ <b>Contraparte:</b> <code>${escapeHtml(counterpart)}</code>\n` +
    `▸ <b>Detalles:</b> <i>${escapeHtml(description)}</i>\n\n` +
    `──────\n` +
    `⏳ <i>El equipo de <b>Trato Admins</b> ha sido notificado. En breve un mediador tomará tu caso.</i>`
  );
}

function dealNotifyAdmin(dealId, creatorUsername, creatorId, role, counterpart, description) {
  const userTag = creatorUsername ? `@${creatorUsername}` : `<code>${creatorId}</code>`;
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  return (
    `⟡ <b>NUEVA SOLICITUD DE TRATO</b> ⊱ <code>CASO #${dealId}</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Solicitante:</b> ${userTag} (${role || 'N/A'})\n` +
    `▸ <b>${counterpartRole}:</b> <code>${escapeHtml(counterpart || 'N/A')}</code>\n` +
    `▸ <b>Descripción:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `──────\n` +
    `<i>Selecciona una acción para tomar o declinar este caso:</i>`
  );
}

function dealAcceptedGroup(dealId, adminUsername) {
  const adminTag = adminUsername ? `@${adminUsername}` : 'un Administrador';
  return (
    `⟡ <b>TRATO #${dealId} ACEPTADO</b> ⊱ <code>EN PROCESO</code> ⊰\n` +
    `══════\n\n` +
    `✓ <b>${adminTag}</b> ha tomado la mediación de este caso.\n` +
    `⚡ <i>Creando sala privada y generando enlaces de acceso...</i>`
  );
}

function dealInviteMessage(dealId, inviteLink, topicLink, counterpart, role, description) {
  const cleanRole = (role || '').toUpperCase();
  const myRole = cleanRole === 'VENDEDOR' ? 'Vendedor' : (cleanRole === 'COMPRADOR' ? 'Comprador' : (role || 'Solicitante'));
  const counterpartRole = cleanRole === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  const cleanCounterpart = (!counterpart || counterpart === 'N/A' || counterpart === 'Sin especificar')
    ? 'No especificado'
    : (counterpart.startsWith('@') || /^\d+$/.test(counterpart) ? counterpart : `@${counterpart}`);

  return (
    `⟡ <b>SALA DE MEDIACIÓN LISTA</b> ⊱ <code>TRATO #${dealId}</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Tu Rol:</b> <code>${myRole}</code>\n` +
    `▸ <b>${counterpartRole}:</b> <code>${escapeHtml(cleanCounterpart)}</code>\n` +
    `▸ <b>Detalles:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `👉 <a href="${inviteLink}"><b>[ ENTRAR A LA SALA #${dealId} ]</b></a>\n\n` +
    `──────\n` +
    `🛡️ <i>El Trato Admin retendrá los fondos y supervisará la entrega en este hilo oficial.</i>`
  );
}

function dealCounterpartInviteMessage(dealId, inviteLink, creatorMention, myRole, creatorRole, description) {
  return (
    `⟡ <b>SALA DE MEDIACIÓN LISTA</b> ⊱ <code>TRATO #${dealId}</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Tu Rol:</b> <code>${myRole || 'Participante'}</code>\n` +
    `▸ <b>${creatorRole || 'Solicitante'}:</b> ${creatorMention}\n` +
    `▸ <b>Detalles:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `👉 <a href="${inviteLink}"><b>[ ENTRAR A LA SALA #${dealId} ]</b></a>\n\n` +
    `──────\n` +
    `🛡️ <i>El Trato Admin retendrá los fondos y supervisará la entrega en este hilo oficial.</i>`
  );
}

function dealTopicWelcomeBanner(dealId, creatorMention, counterpart, adminMention, description, role) {
  const cleanRole = (role || '').toUpperCase();
  const creatorRoleName = cleanRole === 'VENDEDOR' ? 'Vendedor' : (cleanRole === 'COMPRADOR' ? 'Comprador' : (role || 'Solicitante'));
  const counterpartRoleName = cleanRole === 'VENDEDOR' ? 'Comprador' : (cleanRole === 'COMPRADOR' ? 'Vendedor' : 'Contraparte');
  const cleanCounterpart = (!counterpart || counterpart === 'N/A' || counterpart === 'Sin especificar')
    ? 'No especificado'
    : (counterpart.startsWith('@') || /^\d+$/.test(counterpart) ? counterpart : `@${counterpart}`);

  return (
    `⟡ <b>𝐓𝐑𝐀𝐓𝐎 𝐄𝐒𝐂𝐑𝐎𝐖 𝐎𝐅𝐈𝐂𝐈𝐀𝐋</b> ⊱ <code>SALA #${dealId}</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>${creatorRoleName}:</b> ${creatorMention}\n` +
    `▸ <b>${counterpartRoleName}:</b> <code>${escapeHtml(cleanCounterpart)}</code>\n` +
    `▸ <b>Mediador Asignado:</b> ${adminMention}\n` +
    `▸ <b>Detalles del Trato:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `──────\n` +
    `📌 <b>PROTOCOLO OFICIAL DE SEGURIDAD:</b>\n` +
    `• <b>1.</b> Todo comprobante y dato debe enviarse únicamente en este hilo.\n` +
    `• <b>2.</b> El Comprador paga directamente al Mediador (Trato Admin).\n` +
    `• <b>3.</b> El Vendedor entrega el producto SOLO cuando el Mediador confirme el dinero retenido.\n` +
    `• <b>4.</b> Tras conformidad, el Mediador liquida los fondos y cierra el trato.`
  );
}

function escrowGroupConfigured(groupTitle, groupId) {
  return (
    `⟡ <b>GRUPO DE TRATOS CONFIGURADO</b> ⊱ <code>SISTEMA ESCROW</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Grupo:</b> ${escapeHtml(groupTitle)}\n` +
    `▸ <b>ID:</b> <code>${groupId}</code>\n` +
    `▸ <b>Temas (Topics):</b> ⊱ <code>ACTIVADOS ✓</code> ⊰\n\n` +
    `──────\n` +
    `✓ <i>Cada trato aceptado creará automáticamente su hilo seguro.</i>`
  );
}

function escrowGroupNotForumError() {
  return (
    `⟡ <b>TEMAS NO ACTIVADOS</b> ⊱ <code>ERROR DE CONFIGURACIÓN</code> ⊰\n` +
    `══════\n\n` +
    `Este grupo no tiene la función de <b>Temas (Topics)</b> activada.\n\n` +
    `▸ <b>Solución:</b>\n` +
    `  ↳ Editar grupo → Activar opción "Temas" → Guardar.\n` +
    `  ↳ Verificar que el bot sea Admin con permiso "Gestionar temas".\n\n` +
    `──────\n` +
    `<i>Luego vuelve a ejecutar <code>/set_grupo_tratos</code>.</i>`
  );
}

function escrowGroupNoPermissionError() {
  return (
    `⟡ <b>PERMISOS INSUFICIENTES</b> ⊱ <code>BOT REQUERIMIENTO</code> ⊰\n` +
    `══════\n\n` +
    `El bot requiere los siguientes permisos de Administrador:\n\n` +
    `▸ Gestionar temas (Manage Topics)\n` +
    `▸ Invitar usuarios por enlace (Invite Users via Link)\n\n` +
    `──────\n` +
    `<i>Otorga los permisos y vuelve a ejecutar <code>/set_grupo_tratos</code>.</i>`
  );
}

function dealRatingMessage(dealId, adminUsername) {
  const adminTag = adminUsername ? `@${adminUsername}` : 'el Trato Admin';
  return (
    `⟡ <b>CALIFICACIÓN DE ATENCIÓN</b> ⊱ <code>TRATO #${dealId}</code> ⊰\n` +
    `══════\n\n` +
    `✓ <b>¡Trato completado exitosamente!</b>\n` +
    `▸ <b>Mediador:</b> ${adminTag}\n\n` +
    `──────\n` +
    `¿Cómo calificarías el desempeño y rapidez del mediador?`
  );
}

function dealCancelledMessage(dealId) {
  return `⟡ <b>TRATO #${dealId} CANCELADO</b> ⊱ <code>CERRADO</code> ⊰`;
}

function burnInitialPrompt() {
  return (
    `⟡ <b>SISTEMA ANTI-ESTAFAS</b> ⊱ <code>REPORTE DE ESTAFA</code> ⊰\n` +
    `══════\n\n` +
    `⚠️ <i>El uso indebido o denuncias falsas conllevan Baneo Global Permanente (GBAN).</i>\n\n` +
    `▸ <b>Paso 1 de 3:</b> Selecciona cómo deseas identificar al acusado:`
  );
}

function burnAskIdPrompt() {
  return (
    `⟡ <b>SISTEMA ANTI-ESTAFAS</b> ⊱ <code>IDENTIFICACIÓN POR ID</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Paso 1 de 3:</b> Envía el <b>ID numérico de Telegram</b> del acusado.\n\n` +
    `──────\n` +
    `💡 <i>Ejemplo: <code>8579513055</code></i>`
  );
}

function burnAskUsernamePrompt() {
  return (
    `⟡ <b>SISTEMA ANTI-ESTAFAS</b> ⊱ <code>IDENTIFICACIÓN POR USERNAME</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Paso 1 de 3:</b> Envía el <b>@Username</b> del acusado.\n\n` +
    `──────\n` +
    `💡 <i>Ejemplo: <code>@usuario_estafador</code></i>`
  );
}

function burnContextPrompt(targetLabel) {
  return (
    `⟡ <b>SISTEMA ANTI-ESTAFAS</b> ⊱ <code>DESCRIPCIÓN DE HECHOS</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Acusado:</b> ${targetLabel}\n\n` +
    `▸ <b>Paso 2 de 3:</b> Describe detalladamente lo sucedido (monto robado, método, fecha).\n` +
    `──────\n` +
    `📝 <i>(Mínimo 15 caracteres | Máximo 400 caracteres)</i>`
  );
}

function burnProofPrompt(targetLabel, contextSnippet, proofsCount = 0) {
  return (
    `⟡ <b>SISTEMA ANTI-ESTAFAS</b> ⊱ <code>EVIDENCIAS Y CAPTURAS</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Acusado:</b> ${targetLabel}\n` +
    `▸ <b>Hechos:</b> <i>${escapeHtml(contextSnippet.slice(0, 80))}${contextSnippet.length > 80 ? '...' : ''}</i>\n\n` +
    `▸ <b>Paso 3 de 3:</b> Envía tus capturas o comprobantes de pago como imagen.\n` +
    `▸ <b>Capturas recibidas:</b> <b>${proofsCount}</b> <i>(Mínimo 1 obligatoria)</i>\n\n` +
    `──────\n` +
    `<i>Cuando termines de enviar todas tus capturas, presiona <b>[ CONTINUAR ]</b>.</i>`
  );
}

function burnSummaryMessage(targetLabel, context, proofsCount) {
  return (
    `⟡ <b>RESUMEN DEL REPORTE</b> ⊱ <code>CONFIRMACIÓN</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Acusado:</b> ${targetLabel}\n` +
    `▸ <b>Evidencias:</b> <code>${proofsCount} captura(s)</code>\n` +
    `▸ <b>Descripción de los Hechos:</b>\n` +
    `  ↳ <i>${escapeHtml(context)}</i>\n\n` +
    `──────\n` +
    `⚠️ <i>Al pulsar <b>[ QUEMAR ]</b>, el reporte se enviará al Staff para revisión y baneo global.</i>`
  );
}

function burnSentMessage(reportId = '') {
  const idText = reportId ? ` #${reportId}` : '';
  return (
    `⟡ <b>REPORTE ENVIADO AL STAFF${idText}</b> ⊱ <code>EN REVISIÓN</code> ⊰\n` +
    `══════\n\n` +
    `✓ Tu denuncia y evidencias han sido recibidas por los moderadores de <b>Ventas Libres Perú</b>.\n\n` +
    `──────\n` +
    `🛡️ <i>Revisaremos tu caso a la brevedad. Gracias por mantener limpia la comunidad. 🇵🇪</i>`
  );
}

function burnStaffReport(reportId, reporterMention, targetLabel, context, proofsCount = 0) {
  return (
    `⟡ <b>DENUNCIA DE ESTAFA #${reportId}</b> ⊱ <code>PANEL STAFF</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Reportante:</b> ${reporterMention}\n` +
    `▸ <b>Acusado:</b> ${targetLabel}\n` +
    `▸ <b>Evidencias:</b> <code>${proofsCount} captura(s)</code>\n\n` +
    `▸ <b>Contexto / Hechos:</b>\n` +
    `  ↳ <i>${escapeHtml(context)}</i>\n\n` +
    `──────\n` +
    `<b>Acciones de Moderación:</b>`
  );
}

function burnAlertBroadcast(targetId, context = null, targetUsername = null, targetName = null) {
  const hasNumericId = targetId && Number(targetId) > 0;
  const idDisplay = hasNumericId ? `<code>${targetId}</code>` : '<i>Identificado por Alias</i>';
  const nameDisplay = targetName || (targetUsername ? `@${targetUsername}` : 'Estafador');

  let text =
    `🚨 <b>𝐄𝐒𝐓𝐀𝐅𝐀𝐃𝐎𝐑 𝐐𝐔𝐄𝐌𝐀𝐃𝐎 𝐘 𝐑𝐄𝐆𝐈𝐒𝐓𝐑𝐀𝐃𝐎</b> 🚨\n` +
    `══════\n\n` +
    `▸ <b>Nombre / Alias:</b> <b>${escapeHtml(nameDisplay)}</b>\n` +
    (targetUsername ? `▸ <b>Username:</b> @${escapeHtml(targetUsername)}\n` : '') +
    `▸ <b>ID de Telegram:</b> ${idDisplay}\n` +
    `▸ <b>Sanción:</b> ⊱ <code>BANEO GLOBAL PERMANENTE (GBAN)</code> ⊰\n\n`;

  if (context) {
    text += `▸ <b>Motivo / Hechos:</b>\n  ↳ <i>${escapeHtml(context)}</i>\n\n`;
  }

  text +=
    `──────\n` +
    `🛡️ <i>Ventas Libres Perú — Tu seguridad es nuestra prioridad absoluta.</i>`;
  return text;
}

function formatStaffUser(username, userId) {
  const cleanUser = username ? username.replace(/^@/, '') : null;
  const userTag = cleanUser ? `@${escapeHtml(cleanUser)}` : `<a href="tg://user?id=${userId}">Perfil</a>`;
  const idTag = userId ? `<code>${userId}</code>` : '';
  return `${userTag} | ${idTag}`;
}

function renderStaffList(groupedStaff, communityName = 'Ventas Libres Perú') {
  let output =
    `⟡ <b>𝐒𝐓𝐀𝐅𝐅 𝐎𝐅𝐈𝐂𝐈𝐀𝐋</b> ⊱ <code>${escapeHtml(communityName.toUpperCase())}</code> ⊰\n` +
    `══════\n\n`;

  output += `👑 <b>𝐎𝐖𝐍𝐄𝐑𝐒 (Propietarios)</b>\n`;
  if (groupedStaff.owners && groupedStaff.owners.length > 0) {
    for (const m of groupedStaff.owners) {
      output += `▸ ${formatStaffUser(m.username, m.user_id)}\n`;
    }
  } else {
    output += `<i>• No registrados</i>\n`;
  }
  output += `\n`;

  output += `⚔️ <b>𝐂𝐎-𝐎𝐖𝐍𝐄𝐑𝐒</b>\n`;
  if (groupedStaff.coowners && groupedStaff.coowners.length > 0) {
    for (const m of groupedStaff.coowners) {
      output += `▸ ${formatStaffUser(m.username, m.user_id)}\n`;
    }
  } else {
    output += `<i>• No registrados</i>\n`;
  }
  output += `\n`;

  output += `🛡️ <b>𝐀𝐃𝐌𝐈𝐍𝐈𝐒𝐓𝐑𝐀𝐃𝐎𝐑𝐄𝐒</b>\n`;
  if (groupedStaff.admins && groupedStaff.admins.length > 0) {
    for (const m of groupedStaff.admins) {
      output += `▸ ${formatStaffUser(m.username, m.user_id)}\n`;
    }
  } else {
    output += `<i>• No registrados</i>\n`;
  }
  output += `\n`;

  output += `⚖️ <b>𝐓𝐑𝐀𝐓𝐎 𝐀𝐃𝐌𝐈𝐍𝐒 (Mediadores Certificados)</b>\n`;
  if (groupedStaff.dealAdmins && groupedStaff.dealAdmins.length > 0) {
    for (const m of groupedStaff.dealAdmins) {
      const score = m.avgRating ? `${m.avgRating}/5.0 ⭐` : `5.0/5.0 ⭐`;
      output += `▸ ${formatStaffUser(m.username, m.user_id)} ⊱ ${score} ⊰\n`;
    }
  } else {
    output += `<i>• No registrados</i>\n`;
  }

  output +=
    `\n──────\n` +
    `🛡️ <i>Para compras y ventas 100% seguras usa <code>/tratoadm</code>.</i>`;
  return output;
}

function modLogEntry(action, moderatorMention, targetId, chatTitle, reason) {
  return (
    `⟡ <b>LOG DE MODERACIÓN</b> ⊱ <code>${action}</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Moderador:</b> ${moderatorMention}\n` +
    `▸ <b>Objetivo:</b> <code>${targetId}</code>\n` +
    `▸ <b>Grupo:</b> ${chatTitle || 'N/A'}\n` +
    `▸ <b>Motivo:</b> ${reason || 'Sin especificar'}\n` +
    `▸ <b>Registro:</b> <code>${new Date().toISOString()}</code>\n` +
    `──────`
  );
}

function periodicSecurityNotice() {
  return (
    `⟡ <b>𝐕𝐄𝐍𝐓𝐀𝐒 𝐋𝐈𝐁𝐑𝐄 𝐏𝐄𝐑𝐔</b> ⊱ <code>AVISO DE SEGURIDAD</code> ⊰\n` +
    `══════\n\n` +
    `🛡️ <b>Recomendaciones para un comercio 100% seguro:</b>\n\n` +
    `▸ Verifica siempre al equipo oficial con <code>/staff</code>.\n` +
    `▸ Usa <code>/tratoadm</code> para retener y proteger tu dinero.\n` +
    `▸ No confíes en tratos por mensajes privados con desconocidos.\n\n` +
    `──────\n` +
    `✓ <i>Staff Oficial — Ventas Libres Perú 🇵🇪</i>`
  );
}

function periodicNoticeKeyboard(botUsername = 'ventas_libres_peru_Bot') {
  const { InlineKeyboard } = require('grammy');
  return new InlineKeyboard()
    .url('🤝 TRATO ADMIN', `https://t.me/${botUsername}?start=tratoadm`)
    .url('🛡️ STAFF', `https://t.me/${botUsername}?start=staff`)
    .row()
    .url('🚨 REPORTAR ESTAFA', `https://t.me/${botUsername}?start=quemar`);
}

function scamKeywordReply(firstName, username) {
  const userTag = username ? `@${username}` : (firstName ? `<b>${escapeHtml(firstName)}</b>` : 'Estimado usuario');
  return (
    `⟡ <b>CENTRAL DE SEGURIDAD</b> ⊱ <code>ALERTA DE ESTAFA</code> ⊰\n` +
    `══════\n\n` +
    `${userTag}, si fuiste víctima de estafa:\n\n` +
    `▸ <b>1.</b> Guarda todas las capturas de chat y vouchers de pago.\n` +
    `▸ <b>2.</b> Escribe <code>/quemar</code> al bot por privado.\n` +
    `▸ <b>3.</b> El Staff investigará y emitirá Baneo Global.\n\n` +
    `──────\n` +
    `🛡️ <i>Ventas Libres Perú — Tu seguridad es nuestra prioridad.</i>`
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
