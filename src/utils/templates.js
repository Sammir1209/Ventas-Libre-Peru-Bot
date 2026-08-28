const { SYM } = require('../config/constants');
const { escapeHtml } = require('./formatting');

// ══════════════════════════════════════════════════════
// ⟡ Plantillas HTML — Ventas Libres Perú (Compactas)
// ══════════════════════════════════════════════════════

function welcomeMessage(username, firstName) {
  const mention = username
    ? `@${username}`
    : `<b>${escapeHtml(firstName || 'Usuario')}</b>`;

  return (
    `${SYM.SEAL} <b>VENTAS LIBRES PERÚ</b> ${SYM.BADGE}\n\n` +
    `¡Hola, ${mention}! Estás en modo <b>silenciado</b>.\n\n` +
    `① Únete a nuestros canales → <b>[ ⟡ Unirme ]</b>\n` +
    `② Pulsa <b>[ ✓ Verificar ]</b>\n\n` +
    `<i>Proceso automático, 3 segundos.</i>`
  );
}

function verificationSuccess(username, firstName) {
  const mention = username
    ? `@${username}`
    : `<b>${escapeHtml(firstName || 'Usuario')}</b>`;

  return (
    `${SYM.CHECK} <b>${mention}</b>, verificación exitosa. ¡Bienvenido(a)! 🇵🇪`
  );
}

function verificationFailed(missingChannels) {
  const list = missingChannels.map(ch => {
    if (ch.startsWith('http')) return `${SYM.BULLET} <a href="${ch}">${ch}</a>`;
    if (ch.startsWith('@')) return `${SYM.BULLET} <a href="https://t.me/${ch.replace('@', '')}">${ch}</a>`;
    return `${SYM.BULLET} <code>${ch}</code>`;
  }).join('\n');

  return (
    `${SYM.WARNING} <b>VERIFICACIÓN INCOMPLETA</b>\n\n` +
    `Te faltan canales:\n${list}\n\n` +
    `Únete y pulsa <b>[ ✓ Verificar ]</b> de nuevo.`
  );
}

function howItWorksMessage() {
  return (
    `${SYM.PRINT} <b>¿CÓMO FUNCIONA?</b>\n\n` +
    `① Al ingresar, serás silenciado.\n` +
    `② Únete a los canales oficiales.\n` +
    `③ Pulsa <b>[ ✓ Verificar ]</b>.\n` +
    `④ Acceso completo al instante.`
  );
}

function dealMainMenuMessage() {
  return (
    `${SYM.SWORD} <b>TRATO ADMIN (ESCROW)</b> ${SYM.SHIELD}\n\n` +
    `Un mediador certificado custodia los fondos hasta que ambas partes cumplan.\n\n` +
    `${SYM.BULLET} <b>Comisión:</b> 10% fija\n` +
    `${SYM.BULLET} <b>Atención:</b> 1-5 min\n\n` +
    `Selecciona una opción:`
  );
}

function dealDetailedInfoMessage() {
  return (
    `${SYM.DIAMOND} <b>GUÍA: TRATOS ADMIN</b>\n\n` +
    `El Trato Admin evita estafas al 100%. El comprador paga al Admin, el vendedor entrega, el comprador confirma y el Admin libera el pago.\n\n` +
    `<b>Proceso:</b>\n` +
    `${SYM.BULLET} <b>1.</b> Solicitas indicando si vendes/compras.\n` +
    `${SYM.BULLET} <b>2.</b> Un admin toma tu caso.\n` +
    `${SYM.BULLET} <b>3.</b> Se genera grupo privado.\n` +
    `${SYM.BULLET} <b>4.</b> Dinero en custodia del Admin.\n` +
    `${SYM.BULLET} <b>5.</b> Entrega verificada → cierre y calificación.\n\n` +
    `<b>Comisión (10%):</b> S/10 → S/1 | S/50 → S/5 | S/100 → S/10\n\n` +
    `<i>¡Nunca hagas tratos fuera del grupo oficial!</i>`
  );
}

function dealRoleStepMessage() {
  return (
    `${SYM.DIAMOND} <b>NUEVA SOLICITUD DE TRATO</b>\n\n` +
    `<b>Paso 1/3:</b> ¿Cuál es tu rol?\n\n` +
    `Selecciona si vas a <b>Vender</b> o <b>Comprar</b>:`
  );
}

function dealCounterpartStepMessage(role) {
  const counterpartName = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  return (
    `${SYM.DIAMOND} <b>SOLICITUD DE TRATO</b>\n\n` +
    `<b>Paso 2/3:</b> ¿Con quién es el trato?\n\n` +
    `Envía el <b>@usuario</b> o <b>ID</b> del <b>${counterpartName}</b>:`
  );
}

function dealDescriptionStepMessage(role, counterpart) {
  return (
    `${SYM.DIAMOND} <b>SOLICITUD DE TRATO</b>\n\n` +
    `<b>Paso 3/3:</b> Detalles\n` +
    `Contraparte: <b>${escapeHtml(counterpart)}</b>\n\n` +
    `Envía una breve descripción de la transacción:`
  );
}

function dealSummaryMessage(role, counterpart, description) {
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  return (
    `${SYM.DIAMOND} <b>CONFIRMAR SOLICITUD</b>\n\n` +
    `${SYM.ARROW} <b>Rol:</b> ${role}\n` +
    `${SYM.ARROW} <b>${counterpartRole}:</b> <code>${escapeHtml(counterpart)}</code>\n` +
    `${SYM.ARROW} <b>Detalles:</b> ${escapeHtml(description)}\n\n` +
    `¿Enviar solicitud a los Trato Admins?`
  );
}

function dealWaitingMessage(dealId, role, counterpart, description) {
  return (
    `${SYM.DIAMOND} <b>SOLICITUD EN COLA</b> #${dealId}\n\n` +
    `${SYM.CHECK} ¡Enviada con éxito!\n\n` +
    `${SYM.ARROW} <b>Rol:</b> ${role}\n` +
    `${SYM.ARROW} <b>Contraparte:</b> <code>${escapeHtml(counterpart)}</code>\n` +
    `${SYM.ARROW} <b>Detalles:</b> ${escapeHtml(description)}\n\n` +
    `Los <b>Trato Admins</b> han sido notificados. Espera a que tomen tu caso.`
  );
}

function dealNotifyAdmin(dealId, creatorUsername, creatorId, role, counterpart, description) {
  const mention = creatorUsername ? `@${creatorUsername}` : `ID: <code>${creatorId}</code>`;
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  return (
    `${SYM.DIAMOND} <b>SOLICITUD DE TRATO #${dealId}</b>\n\n` +
    `${SYM.ARROW} <b>Solicitante:</b> ${mention} (${role || 'N/A'})\n` +
    `${SYM.ARROW} <b>${counterpartRole}:</b> <code>${escapeHtml(counterpart || 'N/A')}</code>\n` +
    `${SYM.ARROW} <b>Descripción:</b> ${escapeHtml(description || 'Sin especificar')}\n\n` +
    `Pulsa <b>[ Aceptar Trato ]</b> para tomar este caso.`
  );
}

function dealAcceptedGroup(dealId, adminUsername) {
  const mention = adminUsername ? `@${adminUsername}` : 'Admin';
  return (
    `${SYM.DIAMOND} <b>Trato #${dealId} Aceptado</b>\n\n` +
    `${SYM.CHECK} <b>${mention}</b> ha tomado este caso.\n` +
    `Preparando grupo privado...`
  );
}

function dealInviteMessage(dealId, inviteLink, topicLink, counterpart, role, description) {
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  const cleanCounterpart = (counterpart || 'N/A').startsWith('@') ? counterpart : `@${counterpart}`;
  return (
    `${SYM.DIAMOND} <b>SALA DE TRATO #${dealId} LISTA</b>\n\n` +
    `${SYM.ARROW} <b>Rol:</b> ${role}\n` +
    `${SYM.ARROW} <b>${counterpartRole}:</b> ${cleanCounterpart}\n` +
    `${SYM.ARROW} <b>Detalles:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `👉 <a href="${inviteLink}"><b>[ Entrar a la Sala #${dealId} ]</b></a>\n\n` +
    `El Trato Admin supervisará la entrega y el pago.`
  );
}

function dealCounterpartInviteMessage(dealId, inviteLink, creatorMention, myRole, creatorRole, description) {
  return (
    `${SYM.DIAMOND} <b>SALA DE TRATO #${dealId} LISTA</b>\n\n` +
    `${SYM.ARROW} <b>Tu Rol:</b> ${myRole}\n` +
    `${SYM.ARROW} <b>${creatorRole}:</b> ${creatorMention}\n` +
    `${SYM.ARROW} <b>Detalles:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `👉 <a href="${inviteLink}"><b>[ Entrar a la Sala #${dealId} ]</b></a>\n\n` +
    `El Trato Admin supervisará la entrega y el pago.`
  );
}

function dealTopicWelcomeBanner(dealId, creatorMention, counterpart, adminMention, description, role) {
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  return (
    `${SYM.DIAMOND} <b>SALA DE MEDIACIÓN — TRATO #${dealId}</b>\n\n` +
    `${SYM.ARROW} <b>${role}:</b> ${creatorMention}\n` +
    `${SYM.ARROW} <b>${counterpartRole}:</b> <code>${escapeHtml(counterpart || 'N/A')}</code>\n` +
    `${SYM.ARROW} <b>Admin:</b> ${adminMention}\n` +
    `${SYM.ARROW} <b>Descripción:</b> ${escapeHtml(description || 'Sin especificar')}\n\n` +
    `<b>Reglas:</b>\n` +
    `${SYM.BULLET} Toda evidencia va en este hilo.\n` +
    `${SYM.BULLET} Comprador paga al Admin, vendedor entrega tras confirmación.\n` +
    `${SYM.BULLET} Al finalizar, el Admin cierra el hilo.`
  );
}

function escrowGroupConfigured(groupTitle, groupId) {
  return (
    `${SYM.CHECK} <b>GRUPO DE TRATOS CONFIGURADO</b>\n\n` +
    `<b>Grupo:</b> ${escapeHtml(groupTitle)}\n` +
    `<b>ID:</b> <code>${groupId}</code>\n` +
    `<b>Temas (Topics):</b> ACTIVADOS ✓\n\n` +
    `Cada trato aceptado creará un hilo <b>"⟡ Trato Admin N°X"</b>.`
  );
}

function escrowGroupNotForumError() {
  return (
    `${SYM.CROSS} <b>TEMAS NO ACTIVADOS</b>\n\n` +
    `Este grupo no tiene la función de Temas activada.\n\n` +
    `<b>Para activar:</b>\n` +
    `${SYM.BULLET} Editar grupo → Activar "Temas" → Guardar.\n` +
    `${SYM.BULLET} Bot como Admin con "Gestionar temas".\n\n` +
    `Luego ejecuta <code>/set_grupo_tratos</code> de nuevo.`
  );
}

function escrowGroupNoPermissionError() {
  return (
    `${SYM.CROSS} <b>PERMISOS INSUFICIENTES</b>\n\n` +
    `El bot necesita ser Admin con:\n` +
    `${SYM.BULLET} Gestionar temas (Manage Topics)\n` +
    `${SYM.BULLET} Invitar usuarios por enlace\n\n` +
    `Dale los permisos y vuelve a ejecutar <code>/set_grupo_tratos</code>.`
  );
}

function dealRatingMessage(dealId, adminUsername) {
  const mention = adminUsername ? `@${adminUsername}` : 'el Trato Admin';
  return (
    `${SYM.DIAMOND} <b>CALIFICAR SERVICIO</b> — Trato #${dealId}\n\n` +
    `${SYM.CHECK} Trato completado con éxito.\n` +
    `<b>Mediador:</b> ${mention}\n\n` +
    `¿Cómo calificarías la atención?`
  );
}

function dealCancelledMessage(dealId) {
  return `${SYM.CROSS} <b>Trato #${dealId} Cancelado.</b>`;
}

function burnInitialPrompt() {
  return (
    `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFADORES</b>\n\n` +
    `${SYM.WARNING} El uso falso resulta en <b>Baneo Global Permanente</b>.\n` +
    `Solo procede con <b>pruebas reales</b>.\n\n` +
    `<b>Paso 1/3:</b> ¿Cómo identificar al acusado?`
  );
}

function burnAskIdPrompt() {
  return (
    `${SYM.DIAMOND} <b>IDENTIFICAR POR ID</b>\n\n` +
    `Envía el <b>ID numérico</b> del acusado:\n` +
    `<i>Ej: <code>8579513055</code></i>`
  );
}

function burnAskUsernamePrompt() {
  return (
    `${SYM.DIAMOND} <b>IDENTIFICAR POR @USERNAME</b>\n\n` +
    `Envía el <b>@Username</b> del acusado:\n` +
    `<i>Ej: <code>@usuario_estafador</code></i>`
  );
}

function burnContextPrompt(targetLabel) {
  return (
    `${SYM.DIAMOND} <b>DETALLES DE LA ESTAFA</b>\n\n` +
    `${SYM.CHECK} <b>Acusado:</b> ${targetLabel}\n\n` +
    `<b>Paso 2/3:</b> Describe lo que sucedió (monto, cómo fue el engaño, datos extra).\n\n` +
    `<i>Escribe todo en un solo mensaje.</i>`
  );
}

function burnProofPrompt(targetLabel, proofsCount = 0) {
  return (
    `${SYM.DIAMOND} <b>EVIDENCIAS (OBLIGATORIO)</b>\n\n` +
    `<b>Acusado:</b> ${targetLabel} | <b>Capturas:</b> ${proofsCount}\n\n` +
    `<b>Paso 3/3:</b> Envía capturas de comprobantes de pago y conversaciones.\n` +
    `<b>Mínimo 1 captura obligatoria.</b>`
  );
}

function burnSummaryMessage(targetLabel, context, proofsCount) {
  return (
    `${SYM.DIAMOND} <b>RESUMEN DEL REPORTE</b>\n\n` +
    `👤 <b>Acusado:</b> ${targetLabel}\n` +
    `📸 <b>Pruebas:</b> ${proofsCount} captura(s)\n\n` +
    `📝 <b>Hechos:</b>\n<i>${escapeHtml(context)}</i>\n\n` +
    `Si todo es correcto, pulsa <b>[ Quemar ]</b>.`
  );
}

function burnSentMessage() {
  return (
    `${SYM.CHECK} <b>REPORTE ENVIADO</b>\n\n` +
    `Tu denuncia y pruebas fueron enviadas al Staff.\n` +
    `<i>Gracias por mantener segura la comunidad.</i>`
  );
}

function burnStaffReport(reportId, reporterMention, targetId, context) {
  return (
    `${SYM.DIAMOND} <b>REPORTE DE ESTAFA</b> #${reportId}\n\n` +
    `${SYM.ARROW} <b>Reportante:</b> ${reporterMention}\n` +
    `${SYM.ARROW} <b>Acusado:</b> <code>${targetId}</code>\n\n` +
    `<b>Contexto:</b>\n${escapeHtml(context)}\n\n` +
    `<b>Acciones del Staff:</b>`
  );
}

function burnAlertBroadcast(targetId, context = null) {
  let text =
    `${SYM.CROSS} <b>ESTAFADOR QUEMADO</b>\n\n` +
    `ID <code>${targetId}</code> ha sido <b>baneado permanentemente</b> de todos los grupos.\n` +
    `<b>Motivo:</b> Estafa confirmada por el Staff.\n`;

  if (context) {
    text += `<b>Detalles:</b> <i>${escapeHtml(context.slice(0, 100))}</i>\n`;
  }

  text += `\nSi tuviste trato con esta persona, contacta al Staff.`;
  return text;
}

function renderStaffList(groupedStaff) {
  let output = `${SYM.CROWN} <b>STAFF OFICIAL — VENTAS LIBRES PERÚ</b> ${SYM.BADGE}\n\n`;

  output += `<b>${SYM.CROWN} OWNERS</b>\n`;
  if (groupedStaff.owners.length > 0) {
    for (const m of groupedStaff.owners) {
      const userTag = m.username ? `@${m.username}` : `(Sin @)`;
      output += `${SYM.DIAMOND} ${userTag} — <b>${escapeHtml(m.first_name || 'Owner')}</b>\n`;
    }
  } else output += `<i>No registrados</i>\n`;
  output += `\n`;

  output += `<b>${SYM.FLOWER} CO-OWNERS</b>\n`;
  if (groupedStaff.coowners.length > 0) {
    for (const m of groupedStaff.coowners) {
      const userTag = m.username ? `@${m.username}` : `(Sin @)`;
      output += `${SYM.DIAMOND} ${userTag} — <b>${escapeHtml(m.first_name || 'Co-Owner')}</b>\n`;
    }
  } else output += `<i>No registrados</i>\n`;
  output += `\n`;

  output += `<b>${SYM.SWORD} ADMINS</b>\n`;
  if (groupedStaff.admins.length > 0) {
    for (const m of groupedStaff.admins) {
      const userTag = m.username ? `@${m.username}` : `(Sin @)`;
      output += `${SYM.DIAMOND} ${userTag} — <b>${escapeHtml(m.first_name || 'Admin')}</b>\n`;
    }
  } else output += `<i>No registrados</i>\n`;
  output += `\n`;

  output += `<b>${SYM.SEAL} TRATO ADMINS</b>\n`;
  if (groupedStaff.dealAdmins.length > 0) {
    for (const m of groupedStaff.dealAdmins) {
      const userTag = m.username ? `@${m.username}` : `(Sin @)`;
      const score = m.avgRating ? `${m.avgRating}/5 ${SYM.STAR_FULL}` : `5/5 ${SYM.STAR_FULL}`;
      output += `${SYM.DIAMOND} ${userTag} — <b>${escapeHtml(m.first_name || 'Trato Admin')}</b> | ${score}\n`;
    }
  } else output += `<i>No registrados</i>\n`;

  output += `\n${SYM.SHIELD} Para compras/ventas seguras usa <b>/tratoadm</b>.`;
  return output;
}

function modLogEntry(action, moderatorMention, targetId, chatTitle, reason) {
  return (
    `${SYM.PRINT} <b>LOG: ${action}</b>\n\n` +
    `<b>Mod:</b> ${moderatorMention}\n` +
    `<b>Objetivo:</b> <code>${targetId}</code>\n` +
    `<b>Grupo:</b> ${chatTitle || 'N/A'}\n` +
    `<b>Razón:</b> ${reason || 'Sin especificar'}\n` +
    `<b>Fecha:</b> <code>${new Date().toISOString()}</code>`
  );
}

function periodicSecurityNotice() {
  return (
    `${SYM.SEAL} <b>AVISO DE SEGURIDAD</b> ${SYM.BADGE}\n\n` +
    `🛡️ Para compras y ventas 100% seguras:\n` +
    `${SYM.BULLET} Verifica al <b>/staff</b> oficial.\n` +
    `${SYM.BULLET} Usa <b>/tratoadm</b> con un mediador certificado.\n\n` +
    `${SYM.CHECK} Fondos y cuentas protegidos.\n` +
    `<i>— Staff Oficial, Ventas Libres Perú</i> 🇵🇪`
  );
}

function periodicNoticeKeyboard(botUsername = 'ventas_libres_peru_Bot') {
  const { InlineKeyboard } = require('grammy');
  return new InlineKeyboard()
    .url(`${SYM.SWORD} Trato Admin`, `https://t.me/${botUsername}?start=tratoadm`)
    .url(`${SYM.CROWN} Staff`, `https://t.me/${botUsername}?start=staff`)
    .row()
    .url(`${SYM.ALERT} Reportar Estafa`, `https://t.me/${botUsername}?start=quemar`);
}

function scamKeywordReply(firstName, username) {
  const userTag = username ? `@${username}` : (firstName ? `<b>${escapeHtml(firstName)}</b>` : 'Estimado usuario');
  return (
    `${SYM.ALERT} <b>CENTRAL DE REPORTES</b>\n\n` +
    `${userTag}, si fuiste víctima de estafa:\n\n` +
    `① Guarda capturas y comprobantes.\n` +
    `② Escribe <code>/quemar</code> al bot por privado.\n` +
    `③ El Staff revisará tu caso.\n\n` +
    `<i>${SYM.SHIELD} Tu seguridad es nuestra prioridad.</i>`
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
  scamKeywordReply,
};
