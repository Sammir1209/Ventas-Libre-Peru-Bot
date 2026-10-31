const crypto = require('crypto');
const config = require('../../config/env');
const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const { SYM } = require('../../config/constants');
const { escapeHtml, getSuperscriptDate } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');
const { isGlobalOwner, DEFAULT_COMMUNITY_NAME } = require('../../utils/tenantContext');
const { toMathBold } = require('../../utils/aesthetic');

// ══════════════════════════════════════════════════════════
// ⟡ Módulo: Suite de Moderación & Panel de Control Group Help
//   Estándar Obsidian: Simbología Unicode Pura (Sin Emojis)
// ══════════════════════════════════════════════════════════

/**
 * Genera un token y contraseña temporal de acceso para el panel web.
 */
async function generatePanelSession(userId, role = 'STAFF', extra = {}) {
  const sessionToken = crypto.randomBytes(24).toString('hex');
  const tempPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
  const tenantId = extra.tenantId || null;

  const sessionData = {
    userId,
    tempPassword,
    role,
    createdAt: Date.now(),
    isGlobalOwner: extra.isGlobalOwner || false,
    tenantId,
    communityName: extra.communityName || DEFAULT_COMMUNITY_NAME,
    theme: extra.theme || 'owner',
    branding: extra.branding || {},
  };

  try {
    await db.createPanelSession(userId, tenantId, role, tempPassword, sessionToken, 24);
  } catch (dbErr) {
    console.warn('⟡ Error guardando sesión de panel en DB:', dbErr.message);
  }

  await redisDb.setCache(`panel_token:${sessionToken}`, sessionData, 86400);
  await redisDb.setCache(`panel_user_pass:${userId}`, tempPassword, 86400);

  return { sessionToken, tempPassword };
}

/**
 * Valida un token o contraseña de sesión contra Redis o PostgreSQL.
 */
async function validatePanelSession(tokenOrUserId, password = null, tenantId = null) {
  if (password) {
    const savedPass = await redisDb.getCache(`panel_user_pass:${tokenOrUserId}`);
    if (savedPass && savedPass === password) {
      return { userId: Number(tokenOrUserId), role: 'STAFF' };
    }
    const dbSession = await db.validatePanelSession(password, tokenOrUserId, tenantId);
    if (dbSession) {
      return { userId: Number(dbSession.user_id), role: dbSession.role, tenantId: dbSession.tenant_id };
    }
    return null;
  }

  const cached = await redisDb.getCache(`panel_token:${tokenOrUserId}`);
  if (cached) return cached;

  const dbSession = await db.validatePanelSession(tokenOrUserId, null, tenantId);
  if (dbSession) {
    return {
      userId: Number(dbSession.user_id),
      role: dbSession.role,
      tenantId: dbSession.tenant_id,
      isGlobalOwner: !dbSession.tenant_id,
    };
  }
  return null;
}

// ══════════════════════════════════════════════════════════
// ⟡ Catálogo de Comandos de Referencia (Simbología Unicode)
// ══════════════════════════════════════════════════════════

const PANEL_CATEGORIES = {
  mod: {
    title: '❖ [PANEL - MODERACIÓN & SANCIONES]',
    text:
      `❖ <b>[PANEL - MODERACIÓN & SANCIONES]</b>\n` +
      `══════\n` +
      `• <code>/data [@user | ID | responder]</code>\n` +
      `  ↳ Panel rápido del usuario con perfil, antecedentes, mute, ban y blacklist.\n\n` +
      `• <code>/ban [@user | ID | responder] [motivo]</code>\n` +
      `  ↳ Expulsa y bloquea permanentemente a un usuario del grupo.\n\n` +
      `• <code>/unban [ID]</code>\n` +
      `  ↳ Desbloquea a un usuario previamente sancionado.\n\n` +
      `• <code>/mute [@user | ID | responder] [tiempo] [motivo]</code>\n` +
      `  ↳ Silencia temporalmente (ej: <code>10m</code>, <code>1h</code>, <code>1d</code>) o indefinido.\n\n` +
      `• <code>/unmute [@user | ID | responder]</code>\n` +
      `  ↳ Devuelve permisos para enviar mensajes en el grupo.\n\n` +
      `• <code>/kick [@user | ID | responder] [motivo]</code>\n` +
      `  ↳ Expulsa al infractor sin bloquearlo permanentemente.\n\n` +
      `• <code>/warn [@user | ID | responder] [motivo]</code>\n` +
      `  ↳ Aplica una advertencia disciplinaria acumulable.\n\n` +
      `• <code>/unwarn [@user | ID | responder]</code>\n` +
      `  ↳ Retira las advertencias activas acumuladas de un usuario.\n\n` +
      `• <code>/warns [@user | ID | responder]</code>\n` +
      `  ↳ Consulta el historial y conteo de advertencias activas.`,
  },
  sec: {
    title: '✦ [PANEL - SEGURIDAD & DEFCON]',
    text:
      `✦ <b>[PANEL - SEGURIDAD & DEFCON]</b>\n` +
      `══════\n` +
      `• <code>/panico</code> o <code>/defcon</code>\n` +
      `  ↳ Activa el cierre perimetral de emergencia (silencia el chat para todos).\n\n` +
      `• <code>/antiraid [on | off | estricto]</code>\n` +
      `  ↳ Muralla de defensa contra ingresos masivos coordinados y bots.\n\n` +
      `• <code>/antiflood [límite]</code>\n` +
      `  ↳ Protección contra ráfagas de spam rápido o inundación de mensajes.\n\n` +
      `• <code>/lock [tipo]</code>\n` +
      `  ↳ Bloquea tipos de contenido: links, stickers, reenviados, videos, audios.\n\n` +
      `• <code>/unlock [tipo]</code>\n` +
      `  ↳ Desbloquea el tipo de mensaje restringido.\n\n` +
      `• <code>/locks</code>\n` +
      `  ↳ Muestra el estado en tiempo real de todos los filtros activos.\n\n` +
      `• <code>/cleanservice [on | off]</code>\n` +
      `  ↳ Limpia automáticamente los mensajes de sistema ("se unió", "salió").\n\n` +
      `• <code>/purge [número]</code>\n` +
      `  ↳ Borra en masa los últimos N mensajes del chat.`,
  },
  blacklist: {
    title: '❖ [PANEL - LISTA NEGRA & GBAN]',
    text:
      `❖ <b>[PANEL - LISTA NEGRA & GBAN]</b>\n` +
      `══════\n` +
      `• <code>/quemar</code>\n` +
      `  ↳ Inicia el asistente interactivo para registrar a un estafador con pruebas.\n\n` +
      `• <code>/gban [@user | ID] [motivo]</code>\n` +
      `  ↳ Expulsión y baneo global en toda la red comunitaria de grupos vinculados.\n\n` +
      `• <code>/ungban [ID] [motivo]</code>\n` +
      `  ↳ Retira a un usuario de la lista negra global tras resolución de caso.\n\n` +
      `• <code>/gbanlist</code> o <code>/blacklist</code>\n` +
      `  ↳ Radar interactivo de estafadores con paginación, filtros y búsqueda de fichas.`,
  },
  escrow: {
    title: '✦ [PANEL - TRATOS & ESCROW P2P]',
    text:
      `✦ <b>[PANEL - TRATOS & ESCROW P2P]</b>\n` +
      `══════\n` +
      `• <code>/tratoadm</code>\n` +
      `  ↳ Inicia el flujo guiado de intermediación segura para transacciones P2P.\n\n` +
      `• <code>/guiatrato</code> o <code>/infotrato</code>\n` +
      `  ↳ Reglas, garantías, recomendaciones y comisiones del sistema.\n\n` +
      `• <code>/calificar [ID_Trato] [1-5] [comentario]</code>\n` +
      `  ↳ Registra la reputación y valoración de las partes tras finalizar un trato.`,
  },
  profiles: {
    title: '❖ [PANEL - PERFILES & RADAR]',
    text:
      `❖ <b>[PANEL - PERFILES & RADAR]</b>\n` +
      `══════\n` +
      `• <code>/info [@user | ID | código | responder]</code>\n` +
      `  ↳ Ficha de reputación completa con insignias y antecedentes.\n\n` +
      `• <code>/perfil</code>\n` +
      `  ↳ Genera tu card de perfil en alta resolución con código QR y rango.\n\n` +
      `• <code>/id</code>\n` +
      `  ↳ Muestra tu ID numérico de Telegram y el ID del chat actual.\n\n` +
      `• <code>/buscar [texto / alias]</code>\n` +
      `  ↳ Busca usuarios registrados en la base de datos de la comunidad.\n\n` +
      `• <code>/multis</code>\n` +
      `  ↳ Escáner forense para detectar usuarios operando con cuentas múltiples.\n\n` +
      `• <code>/clones</code>\n` +
      `  ↳ Analiza posibles suplantadores de identidad de administradores.`,
  },
  ai: {
    title: '✧ [PANEL - ASISTENTE IA]',
    text:
      `✧ <b>[PANEL - ASISTENTE IA]</b>\n` +
      `══════\n` +
      `• <code>/ia on</code>\n` +
      `  ↳ Enciende el asistente de Inteligencia Artificial en el grupo.\n\n` +
      `• <code>/ia off</code>\n` +
      `  ↳ Apaga el asistente en el grupo para silenciar respuestas automáticas.\n\n` +
      `• <code>/ia [pregunta]</code> o <code>/ask [pregunta]</code>\n` +
      `  ↳ Realiza una consulta directa con respuesta asistida por IA.\n\n` +
      `• <code>/reset_ai</code>\n` +
      `  ↳ Limpia el contexto y memoria de conversación de la IA en este chat.`,
  },
  config: {
    title: '❖ [PANEL - CONFIGURACIÓN & STAFF]',
    text:
      `❖ <b>[PANEL - CONFIGURACIÓN & STAFF]</b>\n` +
      `══════\n` +
      `• <code>/setup</code>\n` +
      `  ↳ Asistente guiado de configuración inicial del bot para la comunidad.\n\n` +
      `• <code>/staff</code>\n` +
      `  ↳ Muestra el directorio visual de Owners, Mediadores y Moderadores.\n\n` +
      `• <code>/setstaff [@user | ID] [Rango]</code>\n` +
      `  ↳ Asigna rol oficial en el bot (Owner, Co-Owner, Mediador, Admin, Soporte).\n\n` +
      `• <code>/demote [@user | ID]</code>\n` +
      `  ↳ Revoca el rol oficial de un miembro del equipo.\n\n` +
      `• <code>/verify</code>\n` +
      `  ↳ Despliega el panel de verificación de miembros nuevos.\n\n` +
      `• <code>/set_canales_verificar [canales]</code>\n` +
      `  ↳ Configura canales obligatorios a seguir para ser verificado.\n\n` +
      `• <code>/set_canal_logs [ID_Canal]</code>\n` +
      `  ↳ Vincula el canal de auditoría donde se reportan todas las acciones.`,
  },
};

// ══════════════════════════════════════════════════════════
// ⟡ Renderers & Keyboards Group Help (Simbología Unicode Pura)
// ══════════════════════════════════════════════════════════

function renderGroupHelpMainMenu(groupTitle, chatId, firstName, isPrivate = false) {
  const gTitle = escapeHtml(groupTitle || 'Comunidad Oficial');
  const user = escapeHtml(firstName || 'Operador');
  const dateFormatted = getSuperscriptDate();

  return (
    `⟡ <b>[PANEL DE CONTROL CENTRAL]</b> ⊱ <code>AJUSTES & SEGURIDAD</code> ⊰\n` +
    `══════\n` +
    `▸ <b>Grupo:</b> <b>${gTitle}</b>\n` +
    `▸ <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `▸ <b>Operador:</b> <b>${user}</b>\n` +
    `▸ <b>Estado del Sistema:</b> <code>[ ACTIVO ]</code>\n` +
    `══════\n\n` +
    `Selecciona un apartado para configurar las herramientas en tiempo real:\n\n` +
    `• <b>Bloqueos:</b> Links, reenvíos, stickers, audios, videos y bots.\n` +
    `• <b>Anti-Flood:</b> Ráfagas de spam, límites y tiempos de silencio.\n` +
    `• <b>Bienvenida:</b> Mensaje automático, captcha y auto-borrado.\n` +
    `• <b>Modo Noche:</b> Horario de silencio programado automático.\n` +
    `• <b>Warns:</b> Límite disciplinario y sanción automática.\n` +
    `• <b>Limpieza:</b> Borrado de uniones/salidas y comandos.\n` +
    `• <b>Censor & Notas:</b> Palabras prohibidas y auto-respuestas #tags.\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function getGroupHelpMainKeyboard(chatId, isPrivate = false, botUsername = 'ventas_libres_peru_Bot') {
  const kb = new InlineKeyboard()
    .text(`❖ ${toMathBold('Bloqueos / Locks')}`, `gh_sub:${chatId}:locks`).primary()
    .text(`⚡ ${toMathBold('Anti-Flood')}`, `gh_sub:${chatId}:flood`).primary()
    .row()
    .text(`❖ ${toMathBold('Bienvenida & Captcha')}`, `gh_sub:${chatId}:welcome`).primary()
    .text(`✧ ${toMathBold('Modo Noche')}`, `gh_sub:${chatId}:night`).primary()
    .row()
    .text(`❖ ${toMathBold('Sanciones & Warns')}`, `gh_sub:${chatId}:warns`).primary()
    .text(`✧ ${toMathBold('Clean Service')}`, `gh_sub:${chatId}:clean`).primary()
    .row()
    .text(`❖ ${toMathBold('Filtro Palabras')}`, `gh_sub:${chatId}:censor`).primary()
    .text(`✦ ${toMathBold('Notas & #Tags')}`, `gh_sub:${chatId}:notes`).primary()
    .row()
    .text(`❖ ${toMathBold('Whitelist URLs')}`, `gh_sub:${chatId}:whitelist`).primary()
    .text(`⚡ ${toMathBold('Asistente IA')}`, `gh_sub:${chatId}:ai`).primary()
    .row()
    .text(`🎮 ${toMathBold('Juegos & Quizz')}`, `gh_sub:${chatId}:quizz`).primary()
    .text(`⟡ ${toMathBold('Diagnóstico / Estado')}`, `gh_sub:${chatId}:status`).success()
    .text(`❖ ${toMathBold('Catálogo de Comandos')}`, `gh_sub:${chatId}:commands`).primary();

  if (!isPrivate) {
    kb.url(`▸ ${toMathBold('Abrir en Privado')}`, `https://t.me/${botUsername}?start=panel_${chatId}`);
  } else {
    kb.text(`❖ ${toMathBold('Cambiar de Grupo')}`, 'gh_group_picker');
  }

  kb.row().text(`✕ ${toMathBold('Cerrar Panel')}`, 'panel_close').danger();
  return kb;
}

// ── Sub-Panel 1: Bloqueos & Locks ──
function renderLocksMenu(chatId, locks) {
  const dateFormatted = getSuperscriptDate();
  return (
    `❖ <b>[CONTROL DE BLOQUEOS SELECTIVOS (LOCKS)]</b>\n` +
    `══════\n` +
    `▸ <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `Toca cualquier botón para conmutar el estado del filtro en tiempo real:\n\n` +
    `• [ ✓ ] = <b>PERMITIDO</b> (Los miembros pueden enviar este contenido)\n` +
    `• [ ✗ ] = <b>BLOQUEADO</b> (El bot borra inmediatamente el mensaje)\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function getLocksKeyboard(chatId, locks) {
  const t = (k) => (locks[k] ? '✗' : '✓');
  return new InlineKeyboard()
    .text(`${t('links')} Enlaces`, `gh_tog_lock:${chatId}:links`)
    .text(`${t('invites')} Invites`, `gh_tog_lock:${chatId}:invites`)
    .row()
    .text(`${t('channels')} Canales`, `gh_tog_lock:${chatId}:channels`)
    .text(`${t('forwards')} Reenvíos`, `gh_tog_lock:${chatId}:forwards`)
    .row()
    .text(`${t('stickers')} Stickers`, `gh_tog_lock:${chatId}:stickers`)
    .text(`${t('gifs')} GIFs`, `gh_tog_lock:${chatId}:gifs`)
    .row()
    .text(`${t('audio')} Audios`, `gh_tog_lock:${chatId}:audio`)
    .text(`${t('voice')} Voz`, `gh_tog_lock:${chatId}:voice`)
    .row()
    .text(`${t('video')} Videos`, `gh_tog_lock:${chatId}:video`)
    .text(`${t('docs')} Archivos`, `gh_tog_lock:${chatId}:docs`)
    .row()
    .text(`${t('bots')} Anti-Bots`, `gh_tog_lock:${chatId}:bots`)
    .text(`${t('arab')} Anti-Árabe`, `gh_tog_lock:${chatId}:arab`)
    .row()
    .text(`${t('games')} Juegos`, `gh_tog_lock:${chatId}:games`)
    .text(`${t('service')} Limp. Serv.`, `gh_tog_lock:${chatId}:service`)
    .row()
    .text(`✓ ${toMathBold('Permitir Todo')}`, `gh_lock_all:${chatId}:unlock`).success()
    .text(`✗ ${toMathBold('Bloquear Todo')}`, `gh_lock_all:${chatId}:lock`).danger()
    .row()
    .text(`◄ ${toMathBold('Volver')}`, `gh_main:${chatId}`).primary()
    .text(`✕ ${toMathBold('Cerrar')}`, 'panel_close').danger();
}

// ── Sub-Panel 2: Anti-Flood ──
function renderFloodMenu(chatId, sec) {
  const dateFormatted = getSuperscriptDate();
  const estado = sec.anti_flood_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]';
  return (
    `✦ <b>[PROTECCIÓN ANTI-FLOOD & ANTI-SPAM]</b>\n` +
    `══════\n` +
    `▸ <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `Configura la sensibilidad y sanciones ante ráfagas rápidas de mensajes:\n\n` +
    `▸ <b>Estado:</b> <b>${estado}</b>\n` +
    `▸ <b>Límite de Mensajes:</b> <code>${sec.anti_flood_msg_limit} mensajes</code>\n` +
    `▸ <b>Ventana de Tiempo:</b> <code>${sec.anti_flood_window_seconds} segundos</code>\n` +
    `▸ <b>Sanción Aplicada:</b> <b>${sec.anti_flood_action}</b>\n` +
    `▸ <b>Duración de Silencio:</b> <code>${sec.anti_flood_mute_time || '1h'}</code>\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function getFloodKeyboard(chatId, sec) {
  const stText = sec.anti_flood_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]';
  return new InlineKeyboard()
    .text(`⚡ Estado: ${stText}`, `gh_flood_tog:${chatId}`).primary()
    .row()
    .text(`[ − ] Mensajes`, `gh_flood_mlim:${chatId}:dec`)
    .text(`[ ${sec.anti_flood_msg_limit} msg ]`, 'noop')
    .text(`[ + ] Mensajes`, `gh_flood_mlim:${chatId}:inc`)
    .row()
    .text(`[ − ] Tiempo`, `gh_flood_wsec:${chatId}:dec`)
    .text(`[ ${sec.anti_flood_window_seconds}s ]`, 'noop')
    .text(`[ + ] Tiempo`, `gh_flood_wsec:${chatId}:inc`)
    .row()
    .text(`❖ Sanción: ${sec.anti_flood_action} ↺`, `gh_flood_act:${chatId}`).primary()
    .text(`✧ Silencio: ${sec.anti_flood_mute_time || '1h'} ↺`, `gh_flood_dur:${chatId}`).primary()
    .row()
    .text(`◄ ${toMathBold('Volver')}`, `gh_main:${chatId}`).primary()
    .text(`✕ ${toMathBold('Cerrar')}`, 'panel_close').danger();
}

// ── Sub-Panel 3: Bienvenida & Captcha ──
function renderWelcomeMenu(chatId, sec) {
  const dateFormatted = getSuperscriptDate();
  const welState = sec.welcome_enabled ? '[ ✓ ACTIVA ]' : '[ ✗ APAGADA ]';
  const autoDelText = !sec.welcome_autodelete ? 'DESACTIVADO' : `${sec.welcome_autodelete} segundos`;
  const verState = sec.verify_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]';
  const folState = sec.verify_folder_enabled ? '[ ✓ ACTIVA ]' : '[ ✗ APAGADA ]';

  return (
    `❖ <b>[SISTEMA DE BIENVENIDA & CAPTCHA]</b>\n` +
    `══════\n` +
    `▸ <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `Gestiona el ingreso y verificación de nuevos miembros:\n\n` +
    `▸ <b>Mensaje de Bienvenida:</b> <b>${welState}</b>\n` +
    `▸ <b>Auto-Borrado de Bienvenida:</b> <code>${autoDelText}</code>\n` +
    `▸ <b>Verificación Captcha:</b> <b>${verState}</b>\n` +
    `▸ <b>Verif. Carpeta de Canales:</b> <b>${folState}</b>\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function getWelcomeKeyboard(chatId, sec) {
  const welText = sec.welcome_enabled ? '[ ✓ ON ]' : '[ ✗ OFF ]';
  const delText = !sec.welcome_autodelete ? 'OFF' : `${sec.welcome_autodelete}s`;
  const verText = sec.verify_enabled ? '[ ✓ ON ]' : '[ ✗ OFF ]';
  const folText = sec.verify_folder_enabled ? '[ ✓ ON ]' : '[ ✗ OFF ]';

  return new InlineKeyboard()
    .text(`❖ Bienvenida: ${welText}`, `gh_wel_tog:${chatId}`).primary()
    .row()
    .text(`✧ Auto-Borrado: [ ${delText} ] ↺`, `gh_wel_del:${chatId}`).primary()
    .row()
    .text(`✦ Captcha: ${verText}`, `gh_wel_ver:${chatId}`).primary()
    .text(`❖ Carpeta Canales: ${folText}`, `gh_wel_fol:${chatId}`).primary()
    .row()
    .text(`▸ Previsualizar Bienvenida`, `gh_wel_prev:${chatId}`).primary()
    .row()
    .text(`◄ ${toMathBold('Volver')}`, `gh_main:${chatId}`).primary()
    .text(`✕ ${toMathBold('Cerrar')}`, 'panel_close').danger();
}

// ── Sub-Panel 4: Modo Noche (Night Mode) ──
function renderNightMenu(chatId, sec) {
  const dateFormatted = getSuperscriptDate();
  const estado = sec.night_mode_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]';
  return (
    `✧ <b>[MODO NOCHE / HORARIO DE SILENCIO]</b>\n` +
    `══════\n` +
    `▸ <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `Silencia automáticamente el grupo durante la madrugada y restablece los permisos al amanecer:\n\n` +
    `▸ <b>Estado:</b> <b>${estado}</b>\n` +
    `▸ <b>Horario de Silencio:</b> <code>${sec.night_mode_start || '00:00'} - ${sec.night_mode_end || '07:00'}</code> (Hora Perú / Lima)\n` +
    `▸ <b>Acción:</b> El bot revoca los permisos de envío de texto de miembros no-admin durante la noche.\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function getNightKeyboard(chatId, sec) {
  const stText = sec.night_mode_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]';
  return new InlineKeyboard()
    .text(`✧ Modo Noche: ${stText}`, `gh_night_tog:${chatId}`).primary()
    .row()
    .text(`▸ Preset: 00:00 - 07:00`, `gh_night_pre:${chatId}:00-07`)
    .text(`▸ Preset: 23:00 - 06:00`, `gh_night_pre:${chatId}:23-06`)
    .row()
    .text(`▸ Preset: 01:00 - 08:00`, `gh_night_pre:${chatId}:01-08`)
    .row()
    .text(`◄ ${toMathBold('Volver')}`, `gh_main:${chatId}`).primary()
    .text(`✕ ${toMathBold('Cerrar')}`, 'panel_close').danger();
}

// ── Sub-Panel 5: Sanciones & Warns ──
function renderWarnsMenu(chatId, sec) {
  const dateFormatted = getSuperscriptDate();
  return (
    `❖ <b>[SISTEMA DE WARNS & SANCIONES ACUMULATIVAS]</b>\n` +
    `══════\n` +
    `▸ <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `Ajusta el umbral de advertencias antes de que el bot aplique sanción automática:\n\n` +
    `▸ <b>Límite de Advertencias:</b> <code>${sec.warn_limit} advertencias</code>\n` +
    `▸ <b>Sanción Automática:</b> <b>${sec.warn_action}</b>\n` +
    `▸ <b>Duración de Sanción:</b> <code>${sec.warn_duration || '1d'}</code>\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function getWarnsKeyboard(chatId, sec) {
  return new InlineKeyboard()
    .text(`[ − ] Límite`, `gh_warn_lim:${chatId}:dec`)
    .text(`[ ${sec.warn_limit} Warns ]`, 'noop')
    .text(`[ + ] Límite`, `gh_warn_lim:${chatId}:inc`)
    .row()
    .text(`❖ Sanción: ${sec.warn_action} ↺`, `gh_warn_act:${chatId}`).primary()
    .text(`✧ Duración: ${sec.warn_duration || '1d'} ↺`, `gh_warn_dur:${chatId}`).primary()
    .row()
    .text(`✗ ${toMathBold('Resetear Warns del Grupo')}`, `gh_warn_reset:${chatId}`).danger()
    .row()
    .text(`◄ ${toMathBold('Volver')}`, `gh_main:${chatId}`).primary()
    .text(`✕ ${toMathBold('Cerrar')}`, 'panel_close').danger();
}

// ── Sub-Panel 6: Clean Service ──
function renderCleanMenu(chatId, sec) {
  const dateFormatted = getSuperscriptDate();
  const servState = sec.clean_service_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]';
  const cmdState = sec.clean_commands_enabled ? '[ ✓ ACTIVO (5s) ]' : '[ ✗ APAGADO ]';

  return (
    `✧ <b>[SERVICIO DE LIMPIEZA & CLEAN SERVICE]</b>\n` +
    `══════\n` +
    `▸ <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `Mantenimiento estético eliminando mensajes innecesarios del chat:\n\n` +
    `▸ <b>Borrar Mensajes de Servicio:</b> <b>${servState}</b>\n` +
    `  ↳ Elimina notificaciones de "X se unió al grupo" o "X salió del grupo".\n\n` +
    `▸ <b>Auto-Borrar Comandos de Usuarios:</b> <b>${cmdState}</b>\n` +
    `  ↳ Elimina automáticamente comandos como /info, /staff, /perfil tras 5 segundos.\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function getCleanKeyboard(chatId, sec) {
  const servText = sec.clean_service_enabled ? '[ ✓ ON ]' : '[ ✗ OFF ]';
  const cmdText = sec.clean_commands_enabled ? '[ ✓ ON ]' : '[ ✗ OFF ]';

  return new InlineKeyboard()
    .text(`✧ Limpiar Servicio: ${servText}`, `gh_clean_serv:${chatId}`).primary()
    .row()
    .text(`⚡ Auto-Borrar Comandos: ${cmdText}`, `gh_clean_cmd:${chatId}`).primary()
    .row()
    .text(`◄ ${toMathBold('Volver')}`, `gh_main:${chatId}`).primary()
    .text(`✕ ${toMathBold('Cerrar')}`, 'panel_close').danger();
}

// ── Sub-Panel 7: Censor & Filtro de Palabras ──
function renderCensorMenu(chatId, sec, filters = []) {
  const dateFormatted = getSuperscriptDate();
  const estado = sec.censor_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]';
  const filterList = filters.length > 0
    ? filters.map((f) => `• <code>${escapeHtml(f.keyword)}</code> (${f.action})`).join('\n')
    : '<i>No hay palabras personalizadas añadidas. Usa /addfilter [palabra]</i>';

  return (
    `❖ <b>[FILTRO DE PALABRAS PROHIBIDAS & CENSOR]</b>\n` +
    `══════\n` +
    `▸ <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `Escudo protector contra términos que ponen en riesgo la comunidad (carding, billetes falsos, doxeo):\n\n` +
    `▸ <b>Escudo Anti-Riesgo Telegram:</b> <b>${estado}</b>\n` +
    `▸ <b>Acción por Defecto:</b> <b>${sec.censor_action || 'WARN'}</b>\n\n` +
    `▸ <b>Palabras Prohibidas Personalizadas:</b>\n` +
    `${filterList}\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function getCensorKeyboard(chatId, sec) {
  const stText = sec.censor_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]';
  return new InlineKeyboard()
    .text(`❖ Escudo: ${stText}`, `gh_censor_tog:${chatId}`).primary()
    .row()
    .text(`✦ Acción: ${sec.censor_action || 'WARN'} ↺`, `gh_censor_act:${chatId}`).primary()
    .row()
    .text(`◄ ${toMathBold('Volver')}`, `gh_main:${chatId}`).primary()
    .text(`✕ ${toMathBold('Cerrar')}`, 'panel_close').danger();
}

// ── Sub-Panel 8: Notas & #Tags ──
function renderNotesMenu(chatId, notes = []) {
  const dateFormatted = getSuperscriptDate();
  const notesList = notes.length > 0
    ? notes.map((n) => `• <code>#${escapeHtml(n.name)}</code>`).join('\n')
    : '<i>No hay notas registradas. Crea una respondiendo a un mensaje con /setnote #nombre</i>';

  return (
    `✦ <b>[NOTAS & AUTO-RESPUESTAS #TAGS]</b>\n` +
    `══════\n` +
    `▸ <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `El bot responde al instante cuando cualquier miembro envíe una etiqueta (ej: <code>#reglas</code>, <code>#soporte</code>, <code>#precios</code>):\n\n` +
    `▸ <b>Notas Activas en este Grupo:</b>\n` +
    `${notesList}\n\n` +
    `▸ <i>Para añadir una nota: envía <code>/setnote #nombre [texto]</code></i>\n` +
    `▸ <i>Para eliminar una nota: envía <code>/delnote #nombre</code></i>\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function getNotesKeyboard(chatId, notes = []) {
  const kb = new InlineKeyboard();
  if (notes.length > 0) {
    for (let i = 0; i < Math.min(notes.length, 6); i += 2) {
      const n1 = notes[i];
      const n2 = notes[i + 1];
      if (n2) {
        kb.text(`✕ #${n1.name}`, `gh_note_del:${chatId}:${n1.name}`)
          .text(`✕ #${n2.name}`, `gh_note_del:${chatId}:${n2.name}`)
          .row();
      } else {
        kb.text(`✕ Eliminar #${n1.name}`, `gh_note_del:${chatId}:${n1.name}`).row();
      }
    }
  }
  kb.text(`◄ ${toMathBold('Volver')}`, `gh_main:${chatId}`).primary()
    .text(`✕ ${toMathBold('Cerrar')}`, 'panel_close').danger();
  return kb;
}

// ── Sub-Panel 9: Whitelist de Enlaces ──
function renderWhitelistMenu(chatId, list = []) {
  const dateFormatted = getSuperscriptDate();
  const domList = list.length > 0
    ? list.map((d) => `• <code>${escapeHtml(d)}</code>`).join('\n')
    : '<i>No hay dominios autorizados en la lista blanca.</i>';

  return (
    `❖ <b>[WHITELIST DE ENLACES & DOMINIOS]</b>\n` +
    `══════\n` +
    `▸ <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `Dominios permitidos aunque el Bloqueo de Enlaces (Lock Links) esté activo:\n\n` +
    `${domList}\n\n` +
    `▸ <i>Para agregar un dominio: envía <code>/addwhitelist dominio.com</code></i>\n` +
    `▸ <i>Para remover un dominio: envía <code>/delwhitelist dominio.com</code></i>\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

function getWhitelistKeyboard(chatId) {
  return new InlineKeyboard()
    .text(`+ Añadir t.me/VentasLibresPeru`, `gh_wl_add:${chatId}:t.me/VentasLibresPeru`).primary()
    .row()
    .text(`+ Añadir youtube.com`, `gh_wl_add:${chatId}:youtube.com`).primary()
    .row()
    .text(`◄ ${toMathBold('Volver')}`, `gh_main:${chatId}`).primary()
    .text(`✕ ${toMathBold('Cerrar')}`, 'panel_close').danger();
}

// ── Sub-Panel 9.5: Control & Configuración de Asistente IA ──
function renderAiMenu(chatId, sec) {
  const dateFormatted = getSuperscriptDate();
  const aiStatus = sec.ai_enabled !== false ? '[ ✓ ACTIVADO ]' : '[ ✗ APAGADO ]';
  const aiMode = sec.ai_only_mentions !== false ? 'Solo Menciones (@Bot)' : 'Todo el Chat (General)';
  const cachineoStatus = sec.ai_cachineo_shield !== false ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]';
  const faltosoStatus = sec.ai_faltoso_shield !== false ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]';
  const personality = sec.ai_personality === 'formal' ? 'Formal / Cordura' : 'Barrio Criollo (Calle)';

  return (
    `⚡ <b>[CONFIGURACIÓN DEL ASISTENTE INTELIGENTE IA]</b>\n` +
    `══════\n` +
    `▸ <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `Personaliza el comportamiento y los filtros de la IA en este grupo:\n\n` +
    `• <b>Estado General:</b> <b>${aiStatus}</b>\n` +
    `• <b>Modo de Respuesta:</b> <code>${aiMode}</code>\n` +
    `• <b>Filtro Cachineros:</b> <b>${cachineoStatus}</b> (Parche a regateo excesivo)\n` +
    `• <b>Parche a Faltosos:</b> <b>${faltosoStatus}</b> (Autoridad ante faltas de respeto)\n` +
    `• <b>Estilo de Respuesta:</b> <code>${personality}</code>\n\n` +
    `──────\n` +
    `💡 <i>Comandos rápidos: <code>/iaon</code> y <code>/iaoff</code></i>\n` +
    `${dateFormatted}`
  );
}

function getAiKeyboard(chatId, sec) {
  const aiOn = sec.ai_enabled !== false;
  const onlyMentions = sec.ai_only_mentions !== false;
  const cachOn = sec.ai_cachineo_shield !== false;
  const faltOn = sec.ai_faltoso_shield !== false;
  const isFormal = sec.ai_personality === 'formal';

  return new InlineKeyboard()
    .text(`${aiOn ? '✗ Apagar IA' : '✓ Activar IA'}`, `gh_ai_tog:${chatId}`)
    .row()
    .text(`Modo: ${onlyMentions ? 'Solo Menciones' : 'Todo el Chat'}`, `gh_ai_mode:${chatId}`)
    .row()
    .text(`Cachineros: ${cachOn ? '[ ✓ ]' : '[ ✗ ]'}`, `gh_ai_cach:${chatId}`)
    .text(`Faltosos: ${faltOn ? '[ ✓ ]' : '[ ✗ ]'}`, `gh_ai_falt:${chatId}`)
    .row()
    .text(`Estilo: ${isFormal ? 'Formal' : 'Barrio Criollo'}`, `gh_ai_pers:${chatId}`)
    .row()
    .text(`🔄 Limpiar Memoria Grupo`, `gh_ai_clear:${chatId}`)
    .row()
    .text(`◄ ${toMathBold('Volver')}`, `gh_main:${chatId}`).primary()
    .text(`✕ ${toMathBold('Cerrar')}`, 'panel_close').danger();
}

// ── Sub-Panel 9.6: Juegos & Quizz Automático con Recompensas ──
function renderQuizMenu(chatId, settings, stock) {
  const dateFormatted = getSuperscriptDate();
  const qOn = settings.enabled === true;
  const statusBadge = qOn ? '[ ✓ ACTIVADO ]' : '[ ✗ APAGADO ]';
  const interval = settings.interval_minutes || 5;

  return (
    `🎮 <b>[CONFIGURACIÓN DE JUEGOS & QUIZZ AUTOMÁTICO]</b>\n` +
    `══════\n` +
    `▸ <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `Personaliza la emisión periódica de trivias interactivas y entrega de premios:\n\n` +
    `• <b>Estado General:</b> <b>${statusBadge}</b>\n` +
    `• <b>Intervalo Actual:</b> <code>Cada ${interval} minutos</code>\n` +
    `• <b>Stock de Cuentas:</b> <code>[ ${stock.total} Cuentas ]</code>\n` +
    `  ↳ <b>Prime Video:</b> <code>${stock.primeVideo} disponibles</code>\n` +
    `  ↳ <b>YouTube Premium:</b> <code>${stock.youtube} disponibles</code>\n\n` +
    `💡 <i>Las cuentas se descuentan automáticamente al acertar para evitar duplicaciones.</i>\n` +
    `──────\n` +
    `⚡ <i>Comandos rápidos: <code>/quizzon</code>, <code>/quizzoff</code>, <code>/quizz</code>, <code>/stock</code></i>\n` +
    `${dateFormatted}`
  );
}

function getQuizKeyboard(chatId, settings) {
  const qOn = settings.enabled === true;
  const interval = settings.interval_minutes || 5;

  const kb = new InlineKeyboard()
    .text(`${qOn ? '✗ Detener Quizz' : '✓ Iniciar Quizz'}`, `gh_qz_tog:${chatId}`)
    .text(`⚡ Lanzar Ahora`, `gh_qz_now:${chatId}`)
    .row()
    .text(`⏱️ Intervalo:`, 'gh_qz_noop')
    .text(interval === 2 ? '• 2m •' : '2m', `gh_qz_int:${chatId}:2`)
    .text(interval === 5 ? '• 5m •' : '5m', `gh_qz_int:${chatId}:5`)
    .text(interval === 10 ? '• 10m •' : '10m', `gh_qz_int:${chatId}:10`)
    .text(interval === 15 ? '• 15m •' : '15m', `gh_qz_int:${chatId}:15`)
    .text(interval === 30 ? '• 30m •' : '30m', `gh_qz_int:${chatId}:30`)
    .row()
    .text(`📦 Ver Stock Detallado`, `gh_qz_stock:${chatId}`)
    .row()
    .text(`◄ ${toMathBold('Volver')}`, `gh_main:${chatId}`).primary()
    .text(`✕ ${toMathBold('Cerrar')}`, 'panel_close').danger();

  return kb;
}

// ── Sub-Panel 10: Diagnóstico / Auditoría en 1 Clic ──
function renderStatusAudit(chatId, groupTitle, sec, locks) {
  const dateFormatted = getSuperscriptDate();
  const l = (k) => (locks[k] ? '[ ✗ BLOQ ]' : '[ ✓ PERMIT ]');
  return (
    `⟡ <b>[DIAGNÓSTICO INTEGRAL DE SEGURIDAD]</b>\n` +
    `══════\n` +
    `▸ <b>Grupo:</b> <b>${escapeHtml(groupTitle || 'Comunidad Oficial')}</b>\n` +
    `▸ <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `══════\n\n` +
    `❖ <b>ESCUDOS ACTIVOS:</b>\n` +
    `• Anti-Flood: <b>${sec.anti_flood_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]'}</b> (${sec.anti_flood_msg_limit}msg/${sec.anti_flood_window_seconds}s ➔ ${sec.anti_flood_action})\n` +
    `• Anti-Raid: <b>${sec.anti_raid_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]'}</b>\n` +
    `• Bienvenida: <b>${sec.welcome_enabled ? '[ ✓ ACTIVA ]' : '[ ✗ APAGADA ]'}</b>\n` +
    `• Captcha / Verif: <b>${sec.verify_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]'}</b>\n` +
    `• Modo Noche: <b>${sec.night_mode_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]'}</b> (${sec.night_mode_start || '00:00'} - ${sec.night_mode_end || '07:00'})\n` +
    `• Sistema Warns: <b>${sec.warn_limit} máx</b> ➔ Sanción: <b>${sec.warn_action}</b>\n` +
    `• Clean Service: <b>${sec.clean_service_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]'}</b>\n\n` +
    `❖ <b>MATRIZ DE BLOQUEOS (LOCKS):</b>\n` +
    `• Enlaces: ${l('links')} | Invites: ${l('invites')}\n` +
    `• Canales: ${l('channels')} | Reenvíos: ${l('forwards')}\n` +
    `• Stickers: ${l('stickers')} | GIFs: ${l('gifs')}\n` +
    `• Audios: ${l('audio')} | Voz: ${l('voice')}\n` +
    `• Videos: ${l('video')} | Archivos: ${l('docs')}\n` +
    `• Bots: ${l('bots')} | Árabe: ${l('arab')} | Juegos: ${l('games')}\n\n` +
    `──────\n` +
    `${dateFormatted}`
  );
}

// ══════════════════════════════════════════════════════════
// ⟡ Permisos & Autorización
// ══════════════════════════════════════════════════════════

async function isStaffOrAdmin(ctx, targetChatId = null) {
  const userId = ctx.from?.id;
  if (!userId) return false;
  if (isGlobalOwner(userId)) return true;
  if (ctx.tenant?.owner_ids?.some((id) => Number(id) === Number(userId))) return true;

  try {
    const staff = await db.getStaffMember(userId, ctx.tenant?.id || null);
    if (staff) return true;
  } catch {}

  const evalChatId = targetChatId || (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup' ? ctx.chat.id : null);
  if (evalChatId) {
    try {
      const member = await ctx.api.getChatMember(evalChatId, userId);
      if (['creator', 'administrator'].includes(member.status)) return true;
    } catch {}
  }

  return false;
}

// ══════════════════════════════════════════════════════════
// ⟡ Registro de Comandos y Callbacks de GrammY
// ══════════════════════════════════════════════════════════

function register(bot) {
  // ── Comando Principal /panel & Alias: Group Help Hub ──
  bot.command(['panel', 'settings', 'config', 'ajustes', 'comandos', 'menu_comandos', 'cmd'], async (ctx) => {
    try {
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      const firstName = ctx.from.first_name || 'Operador';
      let botUsername = 'ventas_libres_peru_Bot';
      try {
        const me = await bot.api.getMe();
        if (me?.username) botUsername = me.username;
      } catch {}

      // Caso 1: Invocado dentro de un Grupo
      if (isGroup) {
        const authorized = await isStaffOrAdmin(ctx);
        if (!authorized) {
          try { await ctx.deleteMessage(); } catch {}
          return;
        }

        const chatId = ctx.chat.id;
        const groupTitle = ctx.chat.title || 'Comunidad Oficial';
        const text = renderGroupHelpMainMenu(groupTitle, chatId, firstName, false);
        const kb = getGroupHelpMainKeyboard(chatId, false, botUsername);

        await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
        return;
      }

      // Caso 2: Invocado en Privado (DM) -> Selector Remoto de Grupos
      const tenantId = ctx.tenant?.id || null;
      let groups = [];
      try {
        groups = await db.getAllGroups(tenantId);
      } catch {}

      if (!Array.isArray(groups) || groups.length === 0) {
        const defaultChatId = config.ESCROW_GROUP_ID || -1003538147715;
        const text = renderGroupHelpMainMenu('Comunidad Principal VLP', defaultChatId, firstName, true);
        const kb = getGroupHelpMainKeyboard(defaultChatId, true, botUsername);
        return await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }

      // Si solo hay un grupo gestionado, abrirlo directamente
      if (groups.length === 1) {
        const grp = groups[0];
        const text = renderGroupHelpMainMenu(grp.chat_title || 'Comunidad Oficial', grp.chat_id, firstName, true);
        const kb = getGroupHelpMainKeyboard(grp.chat_id, true, botUsername);
        return await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }

      // Selector de múltiples grupos
      let selectorText =
        `⟡ <b>[PANEL DE CONTROL CENTRAL]</b> ⊱ <code>SELECCIÓN DE GRUPO</code> ⊰\n` +
        `══════\n` +
        `Hola, <b>${escapeHtml(firstName)}</b>. Selecciona la comunidad que deseas administrar remotamente:\n\n`;

      const kb = new InlineKeyboard();
      for (const g of groups.slice(0, 8)) {
        selectorText += `• <b>${escapeHtml(g.chat_title || 'Grupo')}</b> (<code>${g.chat_id}</code>)\n`;
        kb.text(`❖ ${g.chat_title || 'Grupo'}`, `gh_main:${g.chat_id}`).row();
      }
      kb.text(`❖ Catálogo de Comandos`, `gh_sub:${groups[0].chat_id}:commands`).primary().row();
      kb.text(`✕ Cerrar`, 'panel_close').danger();

      selectorText += `\n──────\n${getSuperscriptDate()}`;
      await ctx.reply(selectorText, { parse_mode: 'HTML', reply_markup: kb });
    } catch (err) {
      console.error('⟡ Error en comando /panel Group Help:', err.message);
    }
  });

  // ── Navegación al Menú Principal de un Grupo (gh_main:<chatId>) ──
  bot.callbackQuery(/^gh_main:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const authorized = await isStaffOrAdmin(ctx, chatId);
      if (!authorized) {
        return ctx.answerCallbackQuery({ text: 'No tienes permisos de Staff para este grupo.', show_alert: true });
      }

      await ctx.answerCallbackQuery();
      const isPrivate = ctx.chat.type === 'private';
      let groupTitle = 'Comunidad Oficial';
      try {
        const chat = await ctx.api.getChat(chatId);
        if (chat?.title) groupTitle = chat.title;
      } catch {}

      const firstName = ctx.from.first_name || 'Operador';
      let botUsername = 'ventas_libres_peru_Bot';
      try {
        const me = await bot.api.getMe();
        if (me?.username) botUsername = me.username;
      } catch {}

      const text = renderGroupHelpMainMenu(groupTitle, chatId, firstName, isPrivate);
      const kb = getGroupHelpMainKeyboard(chatId, isPrivate, botUsername);

      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch (err) {
      console.warn('⟡ Error navegando a gh_main:', err.message);
    }
  });

  // ── Selector de Grupos Remoto (gh_group_picker) ──
  bot.callbackQuery('gh_group_picker', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const tenantId = ctx.tenant?.id || null;
      const groups = await db.getAllGroups(tenantId);

      let selectorText =
        `⟡ <b>[PANEL DE CONTROL CENTRAL]</b> ⊱ <code>SELECCIÓN DE GRUPO</code> ⊰\n` +
        `══════\n` +
        `Selecciona la comunidad que deseas administrar remotamente:\n\n`;

      const kb = new InlineKeyboard();
      for (const g of (groups || []).slice(0, 8)) {
        selectorText += `• <b>${escapeHtml(g.chat_title || 'Grupo')}</b> (<code>${g.chat_id}</code>)\n`;
        kb.text(`❖ ${g.chat_title || 'Grupo'}`, `gh_main:${g.chat_id}`).row();
      }
      kb.text(`✕ Cerrar`, 'panel_close').danger();

      selectorText += `\n──────\n${getSuperscriptDate()}`;
      await ctx.editMessageText(selectorText, { parse_mode: 'HTML', reply_markup: kb });
    } catch (err) {
      console.warn('⟡ Error en gh_group_picker:', err.message);
    }
  });

  // ── Router de Sub-Paneles (gh_sub:<chatId>:<section>) ──
  bot.callbackQuery(/^gh_sub:(-?\d+):([a-z_]+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const section = ctx.match[2];
      const authorized = await isStaffOrAdmin(ctx, chatId);
      if (!authorized) {
        return ctx.answerCallbackQuery({ text: 'Acceso no autorizado.', show_alert: true });
      }

      await ctx.answerCallbackQuery();

      if (section === 'locks') {
        const locks = await db.getGroupLocksSettings(chatId);
        return await ctx.editMessageText(renderLocksMenu(chatId, locks), {
          parse_mode: 'HTML',
          reply_markup: getLocksKeyboard(chatId, locks),
        });
      }

      if (section === 'flood') {
        const sec = await db.getGroupSecuritySettings(chatId);
        return await ctx.editMessageText(renderFloodMenu(chatId, sec), {
          parse_mode: 'HTML',
          reply_markup: getFloodKeyboard(chatId, sec),
        });
      }

      if (section === 'welcome') {
        const sec = await db.getGroupSecuritySettings(chatId);
        return await ctx.editMessageText(renderWelcomeMenu(chatId, sec), {
          parse_mode: 'HTML',
          reply_markup: getWelcomeKeyboard(chatId, sec),
        });
      }

      if (section === 'night') {
        const sec = await db.getGroupSecuritySettings(chatId);
        return await ctx.editMessageText(renderNightMenu(chatId, sec), {
          parse_mode: 'HTML',
          reply_markup: getNightKeyboard(chatId, sec),
        });
      }

      if (section === 'warns') {
        const sec = await db.getGroupSecuritySettings(chatId);
        return await ctx.editMessageText(renderWarnsMenu(chatId, sec), {
          parse_mode: 'HTML',
          reply_markup: getWarnsKeyboard(chatId, sec),
        });
      }

      if (section === 'clean') {
        const sec = await db.getGroupSecuritySettings(chatId);
        return await ctx.editMessageText(renderCleanMenu(chatId, sec), {
          parse_mode: 'HTML',
          reply_markup: getCleanKeyboard(chatId, sec),
        });
      }

      if (section === 'censor') {
        const sec = await db.getGroupSecuritySettings(chatId);
        const filters = await db.getGroupFilters(chatId);
        return await ctx.editMessageText(renderCensorMenu(chatId, sec, filters), {
          parse_mode: 'HTML',
          reply_markup: getCensorKeyboard(chatId, sec),
        });
      }

      if (section === 'notes') {
        const notes = await db.getGroupNotes(chatId);
        return await ctx.editMessageText(renderNotesMenu(chatId, notes), {
          parse_mode: 'HTML',
          reply_markup: getNotesKeyboard(chatId, notes),
        });
      }

      if (section === 'whitelist') {
        const list = await db.getGroupWhitelist(chatId);
        return await ctx.editMessageText(renderWhitelistMenu(chatId, list), {
          parse_mode: 'HTML',
          reply_markup: getWhitelistKeyboard(chatId),
        });
      }

      if (section === 'ai') {
        const sec = await db.getGroupSecuritySettings(chatId);
        return await ctx.editMessageText(renderAiMenu(chatId, sec), {
          parse_mode: 'HTML',
          reply_markup: getAiKeyboard(chatId, sec),
        });
      }

      if (section === 'quizz') {
        const settings = await db.getQuizSettings(chatId);
        const stock = await db.getAvailableRewardsCount();
        return await ctx.editMessageText(renderQuizMenu(chatId, settings, stock), {
          parse_mode: 'HTML',
          reply_markup: getQuizKeyboard(chatId, settings),
        });
      }

      if (section === 'status') {
        const sec = await db.getGroupSecuritySettings(chatId);
        const locks = await db.getGroupLocksSettings(chatId);
        let groupTitle = 'Comunidad Oficial';
        try {
          const chat = await ctx.api.getChat(chatId);
          if (chat?.title) groupTitle = chat.title;
        } catch {}
        const kb = new InlineKeyboard()
          .text(`◄ ${toMathBold('Volver')}`, `gh_main:${chatId}`).primary()
          .text(`✕ ${toMathBold('Cerrar')}`, 'panel_close').danger();
        return await ctx.editMessageText(renderStatusAudit(chatId, groupTitle, sec, locks), {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      }

      if (section === 'commands') {
        const communityName = ctx.tenant?.community_name || DEFAULT_COMMUNITY_NAME;
        const dateFormatted = getSuperscriptDate();
        const cmdText =
          `⟡ <b>[GUÍA DE COMANDOS - ${escapeHtml(communityName.toUpperCase())}]</b>\n` +
          `══════\n` +
          `Explora los comandos organizados por categorías operativas:\n\n` +
          `• <b>Moderación:</b> Mutes, bans, warns y /data.\n` +
          `• <b>Seguridad:</b> Pánico, Anti-Raid y Locks.\n` +
          `• <b>Lista Negra:</b> GBan y fichaje /quemar.\n` +
          `• <b>Tratos & Escrow:</b> Intermediación P2P.\n` +
          `• <b>Perfiles & Radar:</b> /info, /perfil, multis y clones.\n` +
          `• <b>Asistente IA:</b> Encendido y consultas.\n` +
          `• <b>Configuración:</b> Setup y Staff.\n\n` +
          `──────\n${dateFormatted}`;

        const kb = new InlineKeyboard()
          .text(`❖ Moderación`, `panel_cat:mod:${chatId}`).primary()
          .text(`✦ Seguridad`, `panel_cat:sec:${chatId}`).danger()
          .row()
          .text(`❖ Lista Negra`, `panel_cat:blacklist:${chatId}`).danger()
          .text(`✦ Tratos & Escrow`, `panel_cat:escrow:${chatId}`).success()
          .row()
          .text(`❖ Perfiles`, `panel_cat:profiles:${chatId}`).primary()
          .text(`✧ Asistente IA`, `panel_cat:ai:${chatId}`).primary()
          .row()
          .text(`❖ Configuración`, `panel_cat:config:${chatId}`).primary()
          .row()
          .text(`◄ ${toMathBold('Volver al Panel')}`, `gh_main:${chatId}`).primary();

        return await ctx.editMessageText(cmdText, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (err) {
      console.warn('⟡ Error en sub-panel router:', err.message);
    }
  });

  // ── Toggle Individual de Locks (gh_tog_lock:<chatId>:<lockKey>) ──
  bot.callbackQuery(/^gh_tog_lock:(-?\d+):([a-z_]+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const lockKey = ctx.match[2];
      const authorized = await isStaffOrAdmin(ctx, chatId);
      if (!authorized) return ctx.answerCallbackQuery({ text: 'Sin autorización.', show_alert: true });

      const locks = await db.getGroupLocksSettings(chatId);
      locks[lockKey] = !locks[lockKey];
      await db.updateGroupLocksSettings(chatId, locks);

      const statusName = locks[lockKey] ? '[ ✗ BLOQUEADO ]' : '[ ✓ PERMITIDO ]';
      await ctx.answerCallbackQuery({ text: `${lockKey.toUpperCase()}: ${statusName}` });

      await ctx.editMessageReplyMarkup({
        reply_markup: getLocksKeyboard(chatId, locks),
      });
    } catch (err) {
      console.warn('⟡ Error toggling lock:', err.message);
    }
  });

  // ── Bloquear / Desbloquear Todo en Locks (gh_lock_all:<chatId>:<lock|unlock>) ──
  bot.callbackQuery(/^gh_lock_all:(-?\d+):(lock|unlock)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const action = ctx.match[2];
      const authorized = await isStaffOrAdmin(ctx, chatId);
      if (!authorized) return ctx.answerCallbackQuery({ text: 'Sin autorización.', show_alert: true });

      const locks = await db.getGroupLocksSettings(chatId);
      const isLocking = action === 'lock';
      for (const k of Object.keys(locks)) {
        locks[k] = isLocking;
      }
      await db.updateGroupLocksSettings(chatId, locks);

      await ctx.answerCallbackQuery({
        text: isLocking ? 'Todos los contenidos han sido BLOQUEADOS [ ✗ ].' : 'Todos los contenidos han sido PERMITIDOS [ ✓ ].',
      });

      await ctx.editMessageReplyMarkup({
        reply_markup: getLocksKeyboard(chatId, locks),
      });
    } catch (err) {
      console.warn('⟡ Error en lock_all:', err.message);
    }
  });

  // ── Acciones de Anti-Flood ──
  bot.callbackQuery(/^gh_flood_tog:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const authorized = await isStaffOrAdmin(ctx, chatId);
      if (!authorized) return ctx.answerCallbackQuery({ text: 'Sin autorización.', show_alert: true });

      const sec = await db.getGroupSecuritySettings(chatId);
      sec.anti_flood_enabled = !sec.anti_flood_enabled;
      await db.updateGroupSecuritySettings(chatId, sec);

      await ctx.answerCallbackQuery({ text: `Anti-Flood: ${sec.anti_flood_enabled ? 'ACTIVADO [ ✓ ]' : 'DESACTIVADO [ ✗ ]'}` });
      await ctx.editMessageText(renderFloodMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getFloodKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_flood_mlim:(-?\d+):(inc|dec)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const mod = ctx.match[2];
      const sec = await db.getGroupSecuritySettings(chatId);
      let lim = Number(sec.anti_flood_msg_limit) || 5;
      lim = mod === 'inc' ? Math.min(lim + 1, 20) : Math.max(lim - 1, 3);
      sec.anti_flood_msg_limit = lim;
      await db.updateGroupSecuritySettings(chatId, sec);

      await ctx.answerCallbackQuery({ text: `Límite: ${lim} mensajes` });
      await ctx.editMessageText(renderFloodMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getFloodKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_flood_wsec:(-?\d+):(inc|dec)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const mod = ctx.match[2];
      const sec = await db.getGroupSecuritySettings(chatId);
      let w = Number(sec.anti_flood_window_seconds) || 4;
      w = mod === 'inc' ? Math.min(w + 1, 15) : Math.max(w - 1, 2);
      sec.anti_flood_window_seconds = w;
      await db.updateGroupSecuritySettings(chatId, sec);

      await ctx.answerCallbackQuery({ text: `Ventana: ${w} segundos` });
      await ctx.editMessageText(renderFloodMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getFloodKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_flood_act:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      const actions = ['MUTE', 'KICK', 'BAN', 'WARN'];
      const nextIdx = (actions.indexOf(sec.anti_flood_action) + 1) % actions.length;
      sec.anti_flood_action = actions[nextIdx];
      await db.updateGroupSecuritySettings(chatId, sec);

      await ctx.answerCallbackQuery({ text: `Acción: ${sec.anti_flood_action}` });
      await ctx.editMessageText(renderFloodMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getFloodKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_flood_dur:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      const durations = ['10m', '1h', '24h', 'permanente'];
      const nextIdx = (durations.indexOf(sec.anti_flood_mute_time || '1h') + 1) % durations.length;
      sec.anti_flood_mute_time = durations[nextIdx];
      await db.updateGroupSecuritySettings(chatId, sec);

      await ctx.answerCallbackQuery({ text: `Duración silencio: ${sec.anti_flood_mute_time}` });
      await ctx.editMessageText(renderFloodMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getFloodKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  // ── Acciones de Bienvenida & Captcha ──
  bot.callbackQuery(/^gh_wel_tog:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      sec.welcome_enabled = !sec.welcome_enabled;
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({ text: `Bienvenida: ${sec.welcome_enabled ? '[ ✓ ON ]' : '[ ✗ OFF ]'}` });
      await ctx.editMessageText(renderWelcomeMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getWelcomeKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_wel_del:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      const options = [0, 30, 60, 300];
      const nextIdx = (options.indexOf(Number(sec.welcome_autodelete) || 0) + 1) % options.length;
      sec.welcome_autodelete = options[nextIdx];
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({
        text: sec.welcome_autodelete === 0 ? 'Auto-borrado: DESACTIVADO' : `Auto-borrado: ${sec.welcome_autodelete}s`,
      });
      await ctx.editMessageText(renderWelcomeMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getWelcomeKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_wel_ver:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      sec.verify_enabled = !sec.verify_enabled;
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({ text: `Captcha / Verif: ${sec.verify_enabled ? '[ ✓ ON ]' : '[ ✗ OFF ]'}` });
      await ctx.editMessageText(renderWelcomeMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getWelcomeKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_wel_fol:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      sec.verify_folder_enabled = !sec.verify_folder_enabled;
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({
        text: `Carpeta de Canales: ${sec.verify_folder_enabled ? '[ ✓ ON ]' : '[ ✗ OFF ]'}`,
      });
      await ctx.editMessageText(renderWelcomeMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getWelcomeKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_wel_prev:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const customWelcome = await db.getSetting(`welcome_message_${chatId}`) || await db.getSetting('welcome_message');
      const text = customWelcome || '⟡ ¡Bienvenido/a a la comunidad oficial de Ventas Libres Perú! Cumple las normas y mantente seguro.';
      await ctx.answerCallbackQuery();
      await ctx.reply(`⟡ <b>[VISTA PREVIA DE BIENVENIDA]</b>\n──────\n${text}`, { parse_mode: 'HTML' });
    } catch (err) {}
  });

  // ── Acciones de Modo Noche ──
  bot.callbackQuery(/^gh_night_tog:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      sec.night_mode_enabled = !sec.night_mode_enabled;
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({ text: `Modo Noche: ${sec.night_mode_enabled ? '[ ✓ ON ]' : '[ ✗ OFF ]'}` });
      await ctx.editMessageText(renderNightMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getNightKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_night_pre:(-?\d+):([0-9\-]+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const preset = ctx.match[2];
      const [startH, endH] = preset.split('-');
      const sec = await db.getGroupSecuritySettings(chatId);
      sec.night_mode_start = `${startH}:00`;
      sec.night_mode_end = `${endH}:00`;
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({ text: `Horario establecido: ${sec.night_mode_start} - ${sec.night_mode_end}` });
      await ctx.editMessageText(renderNightMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getNightKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  // ── Acciones de Warns ──
  bot.callbackQuery(/^gh_warn_lim:(-?\d+):(inc|dec)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const mod = ctx.match[2];
      const sec = await db.getGroupSecuritySettings(chatId);
      let lim = Number(sec.warn_limit) || 3;
      lim = mod === 'inc' ? Math.min(lim + 1, 5) : Math.max(lim - 1, 2);
      sec.warn_limit = lim;
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({ text: `Límite: ${lim} advertencias` });
      await ctx.editMessageText(renderWarnsMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getWarnsKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_warn_act:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      const actions = ['MUTE', 'KICK', 'BAN'];
      const nextIdx = (actions.indexOf(sec.warn_action) + 1) % actions.length;
      sec.warn_action = actions[nextIdx];
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({ text: `Sanción: ${sec.warn_action}` });
      await ctx.editMessageText(renderWarnsMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getWarnsKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_warn_dur:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      const durations = ['12h', '1d', '7d', 'permanente'];
      const nextIdx = (durations.indexOf(sec.warn_duration || '1d') + 1) % durations.length;
      sec.warn_duration = durations[nextIdx];
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({ text: `Duración: ${sec.warn_duration}` });
      await ctx.editMessageText(renderWarnsMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getWarnsKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_warn_reset:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      await db.clearWarnings(null, chatId);
      await ctx.answerCallbackQuery({ text: 'Todas las advertencias del grupo han sido reseteadas.', show_alert: true });
    } catch (err) {}
  });

  // ── Acciones de Limpieza (Clean Service) ──
  bot.callbackQuery(/^gh_clean_serv:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      sec.clean_service_enabled = !sec.clean_service_enabled;
      await db.updateGroupSecuritySettings(chatId, sec);
      const locks = await db.getGroupLocksSettings(chatId);
      locks.service = sec.clean_service_enabled;
      await db.updateGroupLocksSettings(chatId, locks);

      await ctx.answerCallbackQuery({ text: `Limpiar Servicio: ${sec.clean_service_enabled ? '[ ✓ ON ]' : '[ ✗ OFF ]'}` });
      await ctx.editMessageText(renderCleanMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getCleanKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_clean_cmd:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      sec.clean_commands_enabled = !sec.clean_commands_enabled;
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({ text: `Auto-Borrar Comandos: ${sec.clean_commands_enabled ? '[ ✓ ON ]' : '[ ✗ OFF ]'}` });
      await ctx.editMessageText(renderCleanMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getCleanKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  // ── Acciones de Censor & Filtros ──
  bot.callbackQuery(/^gh_censor_tog:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      sec.censor_enabled = !sec.censor_enabled;
      await db.updateGroupSecuritySettings(chatId, sec);
      const filters = await db.getGroupFilters(chatId);
      await ctx.answerCallbackQuery({ text: `Escudo Censor: ${sec.censor_enabled ? '[ ✓ ACTIVO ]' : '[ ✗ APAGADO ]'}` });
      await ctx.editMessageText(renderCensorMenu(chatId, sec, filters), {
        parse_mode: 'HTML',
        reply_markup: getCensorKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_censor_act:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      const actions = ['DELETE', 'WARN', 'MUTE'];
      const nextIdx = (actions.indexOf(sec.censor_action || 'WARN') + 1) % actions.length;
      sec.censor_action = actions[nextIdx];
      await db.updateGroupSecuritySettings(chatId, sec);
      const filters = await db.getGroupFilters(chatId);
      await ctx.answerCallbackQuery({ text: `Acción censor: ${sec.censor_action}` });
      await ctx.editMessageText(renderCensorMenu(chatId, sec, filters), {
        parse_mode: 'HTML',
        reply_markup: getCensorKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  // ── Eliminar Nota desde Botón ──
  bot.callbackQuery(/^gh_note_del:(-?\d+):([a-zA-Z0-9_\-]+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const noteName = ctx.match[2];
      await db.deleteGroupNote(chatId, noteName);
      await ctx.answerCallbackQuery({ text: `Nota #${noteName} eliminada.` });
      const notes = await db.getGroupNotes(chatId);
      await ctx.editMessageText(renderNotesMenu(chatId, notes), {
        parse_mode: 'HTML',
        reply_markup: getNotesKeyboard(chatId, notes),
      });
    } catch (err) {}
  });

  // ── Agregar a Whitelist desde Botón ──
  bot.callbackQuery(/^gh_wl_add:(-?\d+):(.+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const domain = ctx.match[2];
      await db.addGroupWhitelist(chatId, domain);
      await ctx.answerCallbackQuery({ text: `Añadido a Whitelist: ${domain}` });
      const list = await db.getGroupWhitelist(chatId);
      await ctx.editMessageText(renderWhitelistMenu(chatId, list), {
        parse_mode: 'HTML',
        reply_markup: getWhitelistKeyboard(chatId),
      });
    } catch (err) {}
  });

  // ── Acciones de Configuración de IA ──
  bot.callbackQuery(/^gh_ai_tog:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      sec.ai_enabled = sec.ai_enabled === false ? true : false;
      await db.updateGroupSecuritySettings(chatId, sec);

      // Sincronizar con Redis
      if (sec.ai_enabled) {
        if (redisDb.clearCache) await redisDb.clearCache(`ai_disabled:${chatId}`);
        else if (redisDb.deleteCache) await redisDb.deleteCache(`ai_disabled:${chatId}`);
      } else {
        await redisDb.setCache(`ai_disabled:${chatId}`, '1', 60 * 60 * 24 * 30);
      }

      await ctx.answerCallbackQuery({ text: `IA: ${sec.ai_enabled ? '[ ✓ ON ]' : '[ ✗ OFF ]'}` });
      await ctx.editMessageText(renderAiMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getAiKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_ai_mode:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      sec.ai_only_mentions = sec.ai_only_mentions === false ? true : false;
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({
        text: `Modo: ${sec.ai_only_mentions ? 'Solo Menciones (@Bot)' : 'Todo el Chat'}`,
      });
      await ctx.editMessageText(renderAiMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getAiKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_ai_cach:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      sec.ai_cachineo_shield = sec.ai_cachineo_shield === false ? true : false;
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({
        text: `Filtro Cachineros: ${sec.ai_cachineo_shield ? '[ ✓ ON ]' : '[ ✗ OFF ]'}`,
      });
      await ctx.editMessageText(renderAiMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getAiKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_ai_falt:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      sec.ai_faltoso_shield = sec.ai_faltoso_shield === false ? true : false;
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({
        text: `Filtro Faltosos: ${sec.ai_faltoso_shield ? '[ ✓ ON ]' : '[ ✗ OFF ]'}`,
      });
      await ctx.editMessageText(renderAiMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getAiKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_ai_pers:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const sec = await db.getGroupSecuritySettings(chatId);
      sec.ai_personality = sec.ai_personality === 'formal' ? 'barrio' : 'formal';
      await db.updateGroupSecuritySettings(chatId, sec);
      await ctx.answerCallbackQuery({
        text: `Estilo: ${sec.ai_personality === 'formal' ? 'Formal / Cordura' : 'Barrio Criollo'}`,
      });
      await ctx.editMessageText(renderAiMenu(chatId, sec), {
        parse_mode: 'HTML',
        reply_markup: getAiKeyboard(chatId, sec),
      });
    } catch (err) {}
  });

  bot.callbackQuery(/^gh_ai_clear:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const { clearSession } = require('../ai/memory');
      await clearSession(chatId);
      await ctx.answerCallbackQuery({ text: 'Memoria IA de este grupo reiniciada.', show_alert: true });
    } catch (err) {
      await ctx.answerCallbackQuery({ text: 'Error limpiando memoria.' });
    }
  });

  // ── Callbacks de Quizz en /panel ──
  bot.callbackQuery(/^gh_qz_tog:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const settings = await db.getQuizSettings(chatId);
      const stock = await db.getAvailableRewardsCount();
      const { startQuizTimer, stopQuizTimer } = require('../games/quizHandler');

      if (!settings.enabled) {
        if (stock.total <= 0) {
          return ctx.answerCallbackQuery({
            text: 'No se puede activar el Quizz: Stock en 0. Agrega más cuentas primero.',
            show_alert: true
          });
        }
        await db.updateQuizSettings(chatId, { enabled: true });
        startQuizTimer(bot, chatId, settings.interval_minutes || 5);
        await ctx.answerCallbackQuery({ text: 'Quizz Automático ACTIVADO.' });
      } else {
        await db.updateQuizSettings(chatId, { enabled: false });
        stopQuizTimer(chatId);
        await ctx.answerCallbackQuery({ text: 'Quizz Automático DETENIDO.' });
      }

      const updatedSettings = await db.getQuizSettings(chatId);
      const updatedStock = await db.getAvailableRewardsCount();
      await ctx.editMessageText(renderQuizMenu(chatId, updatedSettings, updatedStock), {
        parse_mode: 'HTML',
        reply_markup: getQuizKeyboard(chatId, updatedSettings),
      });
    } catch (err) {
      console.warn('⟡ Error en gh_qz_tog:', err.message);
    }
  });

  bot.callbackQuery(/^gh_qz_now:(-?\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const { triggerQuiz } = require('../games/quizHandler');
      const res = await triggerQuiz(bot, chatId);
      if (!res.success) {
        if (res.reason === 'ALREADY_ACTIVE') {
          return ctx.answerCallbackQuery({ text: 'Ya hay un Quizz activo en este momento.', show_alert: true });
        }
        if (res.reason === 'NO_STOCK') {
          return ctx.answerCallbackQuery({ text: 'No hay stock de cuentas disponibles.', show_alert: true });
        }
        return ctx.answerCallbackQuery({ text: `Error: ${res.reason}`, show_alert: true });
      }
      await ctx.answerCallbackQuery({ text: '¡Quizz lanzado inmediatamente en el grupo!' });
    } catch (err) {
      console.warn('⟡ Error en gh_qz_now:', err.message);
    }
  });

  bot.callbackQuery(/^gh_qz_int:(-?\d+):(\d+)$/, async (ctx) => {
    try {
      const chatId = Number(ctx.match[1]);
      const interval = Number(ctx.match[2]);
      const { startQuizTimer } = require('../games/quizHandler');

      await db.updateQuizSettings(chatId, { interval_minutes: interval });
      const updatedSettings = await db.getQuizSettings(chatId);
      if (updatedSettings.enabled) {
        startQuizTimer(bot, chatId, interval);
      }

      await ctx.answerCallbackQuery({ text: `Intervalo ajustado a cada ${interval} minutos.` });
      const updatedStock = await db.getAvailableRewardsCount();
      await ctx.editMessageText(renderQuizMenu(chatId, updatedSettings, updatedStock), {
        parse_mode: 'HTML',
        reply_markup: getQuizKeyboard(chatId, updatedSettings),
      });
    } catch (err) {
      console.warn('⟡ Error en gh_qz_int:', err.message);
    }
  });

  bot.callbackQuery(/^gh_qz_stock:(-?\d+)$/, async (ctx) => {
    try {
      const stock = await db.getAvailableRewardsCount();
      await ctx.answerCallbackQuery({
        text: `Stock Total: ${stock.total} | Prime: ${stock.primeVideo} | YouTube: ${stock.youtube}`,
        show_alert: true
      });
    } catch (err) {
      ctx.answerCallbackQuery({ text: 'Error consultando stock.' });
    }
  });

  bot.callbackQuery('gh_qz_noop', async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  // ── Categorías de la Guía de Comandos ──
  bot.callbackQuery(/^panel_cat:([a-z_]+):(-?\d+)$/, async (ctx) => {
    try {
      const catKey = ctx.match[1];
      const chatId = Number(ctx.match[2]);
      const category = PANEL_CATEGORIES[catKey];
      if (!category) return ctx.answerCallbackQuery({ text: 'Categoría no encontrada.' });

      await ctx.answerCallbackQuery();
      const catText = `${category.text}\n\n──────\n${getSuperscriptDate()}`;
      const kb = new InlineKeyboard()
        .text(`◄ ${toMathBold('Volver a Comandos')}`, `gh_sub:${chatId}:commands`).primary()
        .text(`❖ ${toMathBold('Ir al Panel')}`, `gh_main:${chatId}`).primary();

      await ctx.editMessageText(catText, { parse_mode: 'HTML', reply_markup: kb });
    } catch (err) {
      console.warn('⟡ Error en panel_cat:', err.message);
    }
  });

  // ── Cerrar Panel ──
  bot.callbackQuery('panel_close', async (ctx) => {
    try {
      await ctx.answerCallbackQuery({ text: 'Panel cerrado.' });
      await ctx.deleteMessage();
    } catch {}
  });

  // No-op para botones de solo lectura
  bot.callbackQuery('noop', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
    } catch {}
  });

  // ── Comando secundario /web_token: Acceso al Portal Web Secreto para Owners ──
  bot.command(['web_token', 'portal_key'], async (ctx) => {
    try {
      const userId = ctx.from.id;
      const firstName = ctx.from.first_name || 'Usuario';
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://ventas-libre-peru-bot-2y5n.onrender.com';

      const isOwnerCheck = isGlobalOwner(userId);
      const staffMember = await db.getStaffMember(userId);
      const isGlobalStaff = isOwnerCheck || (staffMember && (staffMember.role.includes('OWNER') || staffMember.role.includes('CO-OWNER')));

      if (!isGlobalStaff) {
        if (isGroup) {
          try { await ctx.deleteMessage(); } catch {}
        }
        return;
      }

      if (isGroup) {
        try { await ctx.deleteMessage(); } catch {}
      }

      const roleName = isOwnerCheck ? 'OWNER SUPREMO' : staffMember.role;
      const { sessionToken, tempPassword } = await generatePanelSession(userId, roleName, {
        isGlobalOwner: true,
        tenantId: null,
        communityName: DEFAULT_COMMUNITY_NAME,
        theme: 'owner',
      });

      const masterPanelUrl = `${baseUrl}/#admin?token=${sessionToken}&uid=${userId}`;
      const dmText =
        `⟡ <b>CONSOLA CENTRAL VLP</b> ⊱ <code>CREDENCIALES MAESTRAS</code> ⊰\n` +
        `══════\n\n` +
        `Hola, <b>${escapeHtml(firstName)}</b>. Se ha emitido tu clave de acceso seguro a la Consola Central:\n\n` +
        `▸ <b>Enlace de la Consola:</b>\n` +
        `<code>${masterPanelUrl}</code>\n\n` +
        `▸ <b>ID de Usuario:</b> <code>${userId}</code>\n` +
        `▸ <b>Rango Autorizado:</b> <b>${escapeHtml(roleName)}</b>\n` +
        `▸ <b>Clave Temporal:</b> <code>${tempPassword}</code>\n\n` +
        `▸ <b>Vigencia de Sesión:</b> <code>24 Horas</code>`;

      const kb = new InlineKeyboard().url('▸ ABRIR CONSOLA CENTRAL VLP', masterPanelUrl);
      await ctx.api.sendMessage(userId, dmText, {
        parse_mode: 'HTML',
        reply_markup: kb,
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      console.error('⟡ Error en comando /web_token:', err.message);
    }
  });
}

module.exports = {
  register,
  generatePanelSession,
  validatePanelSession,
  renderGroupHelpMainMenu,
  getGroupHelpMainKeyboard,
};
