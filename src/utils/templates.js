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
    `${SYM.DIAMOND} <b>CONFIRMAR SOLICITUD DE TRATO</b>\n\n` +
    `• <b>Tu Rol:</b> ${role}\n` +
    `• <b>${counterpartRole}:</b> <code>${escapeHtml(counterpart)}</code>\n` +
    `• <b>Detalles:</b> <i>${escapeHtml(description)}</i>\n\n` +
    `¿Deseas enviar la solicitud al equipo de mediadores?`
  );
}

function dealWaitingMessage(dealId, role, counterpart, description) {
  return (
    `${SYM.DIAMOND} <b>SOLICITUD EN COLA #${dealId}</b>\n\n` +
    `${SYM.CHECK} ¡Solicitud creada con éxito!\n\n` +
    `• <b>Tu Rol:</b> ${role}\n` +
    `• <b>Contraparte:</b> <code>${escapeHtml(counterpart)}</code>\n` +
    `• <b>Detalles:</b> <i>${escapeHtml(description)}</i>\n\n` +
    `Los <b>Trato Admins</b> han sido notificados. Espera a que un mediador tome tu caso.`
  );
}

function dealNotifyAdmin(dealId, creatorUsername, creatorId, role, counterpart, description) {
  const userTag = creatorUsername ? `<code>@${creatorUsername}</code>` : `<code>${creatorId}</code>`;
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  return (
    `${SYM.DIAMOND} <b>NUEVA SOLICITUD DE TRATO #${dealId}</b>\n\n` +
    `• <b>Solicitante:</b> ${userTag} (${role || 'N/A'})\n` +
    `• <b>${counterpartRole}:</b> <code>${escapeHtml(counterpart || 'N/A')}</code>\n` +
    `• <b>Descripción:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `<i>Selecciona una opción para gestionar este caso:</i>`
  );
}

function dealAcceptedGroup(dealId, adminUsername) {
  const adminTag = adminUsername ? `<code>@${adminUsername}</code>` : 'un Administrador';
  return (
    `${SYM.DIAMOND} <b>TRATO #${dealId} ACEPTADO</b>\n\n` +
    `${SYM.CHECK} <b>${adminTag}</b> ha tomado la mediación de este caso.\n` +
    `Preparando sala privada de negociación...`
  );
}

function dealInviteMessage(dealId, inviteLink, topicLink, counterpart, role, description) {
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  const cleanCounterpart = (counterpart || 'N/A').startsWith('@') ? counterpart : `@${counterpart}`;
  return (
    `${SYM.DIAMOND} <b>SALA DE MEDIACIÓN #${dealId} LISTA</b>\n\n` +
    `• <b>Tu Rol:</b> ${role}\n` +
    `• <b>${counterpartRole}:</b> <code>${escapeHtml(cleanCounterpart)}</code>\n` +
    `• <b>Detalles:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `👉 <a href="${inviteLink}"><b>[ Entrar a la Sala #${dealId} ]</b></a>\n\n` +
    `<i>El Trato Admin retendrá los fondos y supervisará la entrega en este hilo.</i>`
  );
}

function dealCounterpartInviteMessage(dealId, inviteLink, creatorMention, myRole, creatorRole, description) {
  return (
    `${SYM.DIAMOND} <b>SALA DE MEDIACIÓN #${dealId} LISTA</b>\n\n` +
    `• <b>Tu Rol:</b> ${myRole}\n` +
    `• <b>${creatorRole}:</b> ${creatorMention}\n` +
    `• <b>Detalles:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `👉 <a href="${inviteLink}"><b>[ Entrar a la Sala #${dealId} ]</b></a>\n\n` +
    `<i>El Trato Admin retendrá los fondos y supervisará la entrega en este hilo.</i>`
  );
}

function dealTopicWelcomeBanner(dealId, creatorMention, counterpart, adminMention, description, role) {
  const counterpartRole = role === 'VENDEDOR' ? 'Comprador' : 'Vendedor';
  return (
    `${SYM.DIAMOND} <b>SALA OFICIAL DE MEDIACIÓN — TRATO #${dealId}</b>\n\n` +
    `• <b>${role}:</b> ${creatorMention}\n` +
    `• <b>${counterpartRole}:</b> <code>${escapeHtml(counterpart || 'N/A')}</code>\n` +
    `• <b>Mediador:</b> ${adminMention}\n` +
    `• <b>Detalles del Trato:</b> <i>${escapeHtml(description || 'Sin especificar')}</i>\n\n` +
    `${SYM.THIN_LINE}\n` +
    `📌 <b>Protocolo de Seguridad:</b>\n` +
    `1. Toda comunicación y comprobantes deben enviarse en este hilo.\n` +
    `2. El Comprador paga directamente al Mediador (Trato Admin).\n` +
    `3. El Vendedor entrega el producto únicamente tras confirmación del Mediador.\n` +
    `4. Al finalizar con éxito, el Mediador libera los fondos y cierra el hilo.`
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
  const adminTag = adminUsername ? `<code>@${adminUsername}</code>` : 'el Trato Admin';
  return (
    `${SYM.DIAMOND} <b>CALIFICAR SERVICIO</b> — Trato #${dealId}\n\n` +
    `${SYM.CHECK} <b>¡Trato completado con éxito!</b>\n` +
    `<b>Mediador:</b> ${adminTag}\n\n` +
    `¿Cómo calificarías la atención del mediador?`
  );
}

function dealCancelledMessage(dealId) {
  return `${SYM.CROSS} <b>Trato #${dealId} Cancelado.</b>`;
}

function burnInitialPrompt() {
  return (
    `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFAS — REPORTE</b>\n\n` +
    `<i>El uso indebido o reportes falsos resultan en Baneo Global Permanente.</i>\n\n` +
    `<b>Paso 1/3:</b> Selecciona cómo identificar al acusado:`
  );
}

function burnAskIdPrompt() {
  return (
    `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFAS — REPORTE</b>\n\n` +
    `<b>Paso 1/3:</b> Envía el <b>ID numérico</b> del acusado.\n` +
    `<i>Ejemplo: <code>8579513055</code></i>`
  );
}

function burnAskUsernamePrompt() {
  return (
    `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFAS — REPORTE</b>\n\n` +
    `<b>Paso 1/3:</b> Envía el <b>@Username</b> del acusado.\n` +
    `<i>Ejemplo: <code>@usuario_estafador</code></i>`
  );
}

function burnContextPrompt(targetLabel) {
  return (
    `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFAS — REPORTE</b>\n\n` +
    `👤 <b>Acusado:</b> ${targetLabel}\n\n` +
    `<b>Paso 2/3:</b> Describe detalladamente lo sucedido (monto, método de engaño, fechas).\n` +
    `<i>(Mínimo 15 caracteres | Máximo 400 caracteres)</i>`
  );
}

function burnProofPrompt(targetLabel, contextSnippet, proofsCount = 0) {
  return (
    `${SYM.DIAMOND} <b>SISTEMA ANTI-ESTAFAS — REPORTE</b>\n\n` +
    `👤 <b>Acusado:</b> ${targetLabel}\n` +
    `📝 <b>Hechos:</b> <i>${escapeHtml(contextSnippet.slice(0, 80))}${contextSnippet.length > 80 ? '...' : ''}</i>\n\n` +
    `<b>Paso 3/3:</b> Envía tus capturas o comprobantes de pago como imagen.\n` +
    `📸 <b>Capturas subidas:</b> <b>${proofsCount}</b> <i>(Mínimo 1 obligatoria)</i>\n\n` +
    `<i>Cuando termines de enviar todas tus capturas, presiona <b>[ CONTINUAR ]</b>.</i>`
  );
}

function burnSummaryMessage(targetLabel, context, proofsCount) {
  return (
    `${SYM.DIAMOND} <b>RESUMEN DEL REPORTE ANTI-ESTAFAS</b>\n\n` +
    `👤 <b>Acusado:</b> ${targetLabel}\n` +
    `📸 <b>Evidencias:</b> <b>${proofsCount} captura(s)</b>\n\n` +
    `📝 <b>Descripción de los Hechos:</b>\n<i>${escapeHtml(context)}</i>\n\n` +
    `${SYM.THIN_LINE}\n` +
    `⚠️ <i>Al presionar <b>[ QUEMAR ]</b>, el reporte se enviará al equipo de moderación para su investigación y baneo global.</i>`
  );
}

function burnSentMessage(reportId = '') {
  const idText = reportId ? ` #${reportId}` : '';
  return (
    `${SYM.CHECK} <b>REPORTE ENVIADO AL STAFF${idText}</b>\n\n` +
    `Tu denuncia y pruebas han sido recibidas por los moderadores de <b>Ventas Libres Perú</b>.\n\n` +
    `<i>Revisaremos tu caso a la brevedad. Gracias por mantener segura la comunidad. 🇵🇪</i>`
  );
}

function burnStaffReport(reportId, reporterMention, targetLabel, context, proofsCount = 0) {
  return (
    `${SYM.DIAMOND} <b>REPORTE DE ESTAFA #${reportId}</b>\n\n` +
    `${SYM.ARROW} <b>Reportante:</b> ${reporterMention}\n` +
    `${SYM.ARROW} <b>Acusado:</b> ${targetLabel}\n` +
    `${SYM.ARROW} <b>Evidencias:</b> <code>${proofsCount} captura(s)</code>\n\n` +
    `📝 <b>Contexto / Hechos:</b>\n<i>${escapeHtml(context)}</i>\n\n` +
    `${SYM.THIN_LINE}\n` +
    `<b>Acciones de Moderación:</b>`
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

function formatStaffUser(username, userId) {
  const cleanUser = username ? username.replace(/^@/, '') : null;
  const userTag = cleanUser ? `@${escapeHtml(cleanUser)}` : `<a href="tg://user?id=${userId}">Perfil</a>`;
  const idTag = userId ? `<code>${userId}</code>` : '';
  return `${userTag} | ${idTag}`;
}

function renderStaffList(groupedStaff) {
  let output = `👑 <b>STAFF OFICIAL — VENTAS LIBRES PERÚ</b>\n\n`;

  output += `<b>OWNERS</b>\n`;
  if (groupedStaff.owners && groupedStaff.owners.length > 0) {
    for (const m of groupedStaff.owners) {
      output += `• ${formatStaffUser(m.username, m.user_id)}\n`;
    }
  } else {
    output += `<i>No registrados</i>\n`;
  }
  output += `\n`;

  output += `<b>CO-OWNERS</b>\n`;
  if (groupedStaff.coowners && groupedStaff.coowners.length > 0) {
    for (const m of groupedStaff.coowners) {
      output += `• ${formatStaffUser(m.username, m.user_id)}\n`;
    }
  } else {
    output += `<i>No registrados</i>\n`;
  }
  output += `\n`;

  output += `<b>ADMINISTRADORES</b>\n`;
  if (groupedStaff.admins && groupedStaff.admins.length > 0) {
    for (const m of groupedStaff.admins) {
      output += `• ${formatStaffUser(m.username, m.user_id)}\n`;
    }
  } else {
    output += `<i>No registrados</i>\n`;
  }
  output += `\n`;

  output += `<b>TRATO ADMINS (MEDIADORES)</b>\n`;
  if (groupedStaff.dealAdmins && groupedStaff.dealAdmins.length > 0) {
    for (const m of groupedStaff.dealAdmins) {
      const score = m.avgRating ? `${m.avgRating}/5.0 ⭐` : `5.0/5.0 ⭐`;
      output += `• ${formatStaffUser(m.username, m.user_id)} (${score})\n`;
    }
  } else {
    output += `<i>No registrados</i>\n`;
  }

  output += `\n🛡️ <i>Para compras y ventas 100% seguras usa <code>/tratoadm</code>.</i>`;
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
    .url('TRATO ADMIN', `https://t.me/${botUsername}?start=tratoadm`)
    .url('STAFF', `https://t.me/${botUsername}?start=staff`)
    .row()
    .url('REPORTAR ESTAFA', `https://t.me/${botUsername}?start=quemar`);
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
