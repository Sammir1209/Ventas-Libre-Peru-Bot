const crypto = require('crypto');
const config = require('../../config/env');
const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const { SYM } = require('../../config/constants');
const { escapeHtml } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');
const { isGlobalOwner, resolveCommunityName, DEFAULT_COMMUNITY_NAME } = require('../../utils/tenantContext');

// ══════
// ⟡ Módulo: Comando /panel (Menú Interactivo de Comandos en Telegram)
//   & Generador de Acceso Seguro (Zero-Trust) para Consola Web
// ══════

/**
 * Genera un token y contraseña temporal de acceso para el panel web.
 * Registra la sesión con expiración tanto en PostgreSQL como en caché Redis.
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

  // 1. Persistir en PostgreSQL
  try {
    await db.createPanelSession(userId, tenantId, role, tempPassword, sessionToken, 24);
  } catch (dbErr) {
    console.warn('⟡ Error guardando sesión de panel en DB:', dbErr.message);
  }

  // 2. Persistir en caché Redis de alta velocidad (TTL 24h = 86400s)
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
    // Fallback a PostgreSQL
    const dbSession = await db.validatePanelSession(password, tokenOrUserId, tenantId);
    if (dbSession) {
      return { userId: Number(dbSession.user_id), role: dbSession.role, tenantId: dbSession.tenant_id };
    }
    return null;
  }

  const cached = await redisDb.getCache(`panel_token:${tokenOrUserId}`);
  if (cached) return cached;

  // Fallback a PostgreSQL
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

// ══════
// ⟡ Plantillas de Contenido para el Panel Interactivo en Telegram
// ══════

const PANEL_CATEGORIES = {
  mod: {
    title: '🛡️ [PANEL - MODERACIÓN & SANCIONES]',
    text:
      `🛡️ <b>[PANEL - MODERACIÓN & SANCIONES]</b>\n` +
      `══════════════════════════════\n` +
      `• <code>/data [@user | ID | responder]</code>\n` +
      `  ↳ Panel de control rápido del usuario con perfil, verificación de antecedentes, mute, ban y blacklist inmediata.\n\n` +
      `• <code>/ban [@user | ID | responder] [motivo]</code>\n` +
      `  ↳ Expulsa y bloquea permanentemente a un usuario del grupo.\n\n` +
      `• <code>/unban [ID]</code>\n` +
      `  ↳ Desbloquea a un usuario previamente expulsado.\n\n` +
      `• <code>/mute [@user | ID | responder] [tiempo] [motivo]</code>\n` +
      `  ↳ Silencia al usuario temporalmente (ej: <code>10m</code>, <code>1h</code>, <code>1d</code>) o indefinido.\n\n` +
      `• <code>/unmute [@user | ID | responder]</code>\n` +
      `  ↳ Devuelve los permisos para enviar mensajes en el grupo.\n\n` +
      `• <code>/kick [@user | ID | responder] [motivo]</code>\n` +
      `  ↳ Expulsa al infractor sin bloquearlo permanentemente.\n\n` +
      `• <code>/warn [@user | ID | responder] [motivo]</code>\n` +
      `  ↳ Aplica una advertencia disciplinaria (al tercer warn se sanciona automáticamente).\n\n` +
      `• <code>/unwarn [@user | ID | responder]</code>\n` +
      `  ↳ Retira las advertencias activas acumuladas de un usuario.\n\n` +
      `• <code>/warns [@user | ID | responder]</code>\n` +
      `  ↳ Consulta el historial y conteo de advertencias activas.`,
  },
  sec: {
    title: '🚨 [PANEL - SEGURIDAD & DEFCON]',
    text:
      `🚨 <b>[PANEL - SEGURIDAD & DEFCON]</b>\n` +
      `══════════════════════════════\n` +
      `• <code>/panico</code> o <code>/defcon</code>\n` +
      `  ↳ Activa el cierre perimetral de emergencia (silencia el chat para todos los miembros durante raids o ataques).\n\n` +
      `• <code>/antiraid [on | off | estricto]</code>\n` +
      `  ↳ Muralla de defensa contra ingresos masivos coordinados y bots maliciosos.\n\n` +
      `• <code>/antiflood [límite]</code>\n` +
      `  ↳ Protección contra ráfagas de spam rápido o inundación de mensajes.\n\n` +
      `• <code>/lock [tipo]</code>\n` +
      `  ↳ Bloquea tipos de contenido: <code>fotos</code>, <code>videos</code>, <code>stickers</code>, <code>links</code>, <code>reenvios</code>, <code>documentos</code>.\n\n` +
      `• <code>/unlock [tipo]</code>\n` +
      `  ↳ Desbloquea el tipo de mensaje restringido.\n\n` +
      `• <code>/locks</code>\n` +
      `  ↳ Muestra el estado en tiempo real de todos los filtros activos en el grupo.\n\n` +
      `• <code>/cleanservice [on | off]</code>\n` +
      `  ↳ Limpia automáticamente los mensajes de sistema ("se unió al grupo", "salió").\n\n` +
      `• <code>/purge [número]</code>\n` +
      `  ↳ Borra en masa los últimos N mensajes del chat.`,
  },
  blacklist: {
    title: '🔥 [PANEL - LISTA NEGRA & GBAN]',
    text:
      `🔥 <b>[PANEL - LISTA NEGRA & GBAN]</b>\n` +
      `══════════════════════════════\n` +
      `• <code>/quemar</code>\n` +
      `  ↳ Inicia el asistente interactivo para registrar a un estafador con pruebas fotográficas, motivos y datos bancarios.\n\n` +
      `• <code>/gban [@user | ID] [motivo]</code>\n` +
      `  ↳ Expulsión y baneo global en toda la red comunitaria de grupos vinculados.\n\n` +
      `• <code>/ungban [ID] [motivo]</code>\n` +
      `  ↳ Retira a un usuario de la lista negra global tras resolución de caso.\n\n` +
      `• <code>/gbanlist</code> o <code>/blacklist</code>\n` +
      `  ↳ Radar interactivo de estafadores con paginación, filtros y búsqueda de fichas.\n\n` +
      `• <code>/set_canal_quemar [ID_Canal]</code>\n` +
      `  ↳ Vincula el canal oficial de avisos públicos de estafadores.`,
  },
  escrow: {
    title: '🤝 [PANEL - TRATOS & ESCROW P2P]',
    text:
      `🤝 <b>[PANEL - TRATOS & ESCROW P2P]</b>\n` +
      `══════════════════════════════\n` +
      `• <code>/tratoadm</code>\n` +
      `  ↳ Inicia el flujo guiado de intermediación segura para transacciones y ventas P2P.\n\n` +
      `• <code>/guiatrato</code> o <code>/infotrato</code>\n` +
      `  ↳ Reglas, garantías, recomendaciones y comisiones del sistema de intermediación.\n\n` +
      `• <code>/set_grupo_tratos [ID_Grupo/Topic]</code>\n` +
      `  ↳ Configura la sala de recepción de solicitudes de tratos para el staff.\n\n` +
      `• <code>/calificar [ID_Trato] [1-5] [comentario]</code>\n` +
      `  ↳ Registra la reputación y valoración de las partes tras finalizar un trato con éxito.`,
  },
  profiles: {
    title: '👤 [PANEL - PERFILES & RADAR]',
    text:
      `👤 <b>[PANEL - PERFILES & RADAR]</b>\n` +
      `══════════════════════════════\n` +
      `• <code>/info [@user | ID | código | responder]</code>\n` +
      `  ↳ Ficha de reputación completa con insignias, antecedentes, estado en lista negra y botón para generar card gráfica.\n\n` +
      `• <code>/perfil</code>\n` +
      `  ↳ Genera tu card de perfil en alta resolución con código QR, estadísticas y rango.\n\n` +
      `• <code>/id</code>\n` +
      `  ↳ Muestra tu ID numérico de Telegram y el ID del chat actual.\n\n` +
      `• <code>/buscar [texto / alias]</code>\n` +
      `  ↳ Busca usuarios registrados en la base de datos de la comunidad.\n\n` +
      `• <code>/multis</code>\n` +
      `  ↳ Escáner forense para detectar usuarios operando con cuentas múltiples.\n\n` +
      `• <code>/clones</code>\n` +
      `  ↳ Analiza posibles suplantadores de identidad que copian fotos o nombres de administradores.\n\n` +
      `• <code>/sinusername</code>\n` +
      `  ↳ Detecta usuarios que ocultan su alias público en el grupo.`,
  },
  ai: {
    title: '🤖 [PANEL - ASISTENTE IA]',
    text:
      `🤖 <b>[PANEL - ASISTENTE IA]</b>\n` +
      `══════════════════════════════\n` +
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
    title: '⚙️ [PANEL - CONFIGURACIÓN & STAFF]',
    text:
      `⚙️ <b>[PANEL - CONFIGURACIÓN & STAFF]</b>\n` +
      `══════════════════════════════\n` +
      `• <code>/setup</code>\n` +
      `  ↳ Asistente guiado de configuración inicial del bot para la comunidad.\n\n` +
      `• <code>/staff</code>\n` +
      `  ↳ Muestra el directorio visual de Owners, Mediadores y Moderadores oficiales.\n\n` +
      `• <code>/setstaff [@user | ID] [Rango]</code>\n` +
      `  ↳ Asigna rol oficial en el bot (Owner, Co-Owner, Mediador, Admin, Soporte).\n\n` +
      `• <code>/demote [@user | ID]</code>\n` +
      `  ↳ Revoca el rol oficial de un miembro del equipo.\n\n` +
      `• <code>/verify</code>\n` +
      `  ↳ Despliega el panel de verificación de miembros nuevos mediante botón interactivo.\n\n` +
      `• <code>/set_canales_verificar [canales]</code>\n` +
      `  ↳ Configura canales obligatorios a seguir para ser verificado.\n\n` +
      `• <code>/set_canal_logs [ID_Canal]</code>\n` +
      `  ↳ Vincula el canal de auditoría donde se reportan todas las acciones de moderación.`,
  },
};

function renderMainMenuText(communityName, firstName) {
  const comm = escapeHtml(communityName || 'VENTAS LIBRES PERÚ');
  const user = escapeHtml(firstName || 'Operador');
  return (
    `🖲 <b>[${comm.toUpperCase()} - PANEL DE COMANDOS]</b>\n` +
    `══════════════════════════════\n` +
    `Bienvenido, <b>${user}</b>.\n` +
    `Explora el catálogo completo de herramientas y comandos del sistema organizados por categorías operativas:\n\n` +
    `🛡️ <b>Moderación:</b> Sanciones, mutes, bans, warns y /data.\n` +
    `🚨 <b>Seguridad:</b> Modo Pánico, Anti-Raid, Anti-Flood y Locks.\n` +
    `🔥 <b>Lista Negra:</b> GBan, Fichaje /quemar y reportes.\n` +
    `🤝 <b>Tratos & Escrow:</b> Intermediación P2P y calificaciones.\n` +
    `👤 <b>Perfiles & Radar:</b> /info, /perfil, detección de multis y clones.\n` +
    `🤖 <b>Asistente IA:</b> Encendido, apagado y consultas.\n` +
    `⚙️ <b>Configuración:</b> Setup, asignación de Staff y canales oficiales.\n` +
    `══════════════════════════════\n` +
    `👇 <i>Presiona un botón para ver los comandos de cada sección:</i>`
  );
}

function getMainMenuKeyboard() {
  return new InlineKeyboard()
    .text('🛡️ Moderación', 'panel_cat:mod')
    .text('🚨 Seguridad & Defcon', 'panel_cat:sec')
    .row()
    .text('🔥 Lista Negra & GBan', 'panel_cat:blacklist')
    .text('🤝 Tratos & Escrow', 'panel_cat:escrow')
    .row()
    .text('👤 Perfiles & Radar', 'panel_cat:profiles')
    .text('🤖 Asistente IA', 'panel_cat:ai')
    .row()
    .text('⚙️ Configuración & Staff', 'panel_cat:config')
    .row()
    .text('✖ Cerrar Panel', 'panel_close');
}

function getCategoryKeyboard() {
  return new InlineKeyboard()
    .text('◀ Volver al Menú', 'panel_back')
    .text('✖ Cerrar', 'panel_close');
}

async function isStaffOrAdmin(ctx) {
  const userId = ctx.from?.id;
  if (!userId) return false;
  if (isGlobalOwner(userId)) return true;
  if (ctx.tenant?.owner_ids?.some((id) => Number(id) === Number(userId))) return true;
  try {
    const staff = await db.getStaffMember(userId, ctx.tenant?.id || null);
    if (staff) return true;
  } catch {}
  if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
    try {
      const member = await ctx.api.getChatMember(ctx.chat.id, userId);
      if (['creator', 'administrator'].includes(member.status)) return true;
    } catch {}
  }
  return false;
}

function register(bot) {
  // ── Comando Principal /panel: Menú Interactivo de Comandos en Telegram ──
  bot.command(['panel', 'comandos', 'menu_comandos', 'cmd'], async (ctx) => {
    try {
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      const authorized = await isStaffOrAdmin(ctx);

      if (!authorized) {
        if (isGroup) {
          try { await ctx.deleteMessage(); } catch {}
          return;
        }
        return ctx.reply('⚠️ <i>Este panel de comandos es de uso exclusivo para Administradores y Staff.</i>', { parse_mode: 'HTML' });
      }

      const communityName = ctx.tenant?.community_name || DEFAULT_COMMUNITY_NAME;
      const firstName = ctx.from.first_name || 'Operador';
      const text = renderMainMenuText(communityName, firstName);
      const kb = getMainMenuKeyboard();

      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (err) {
      console.error('⟡ Error en comando /panel interactivo:', err.message);
    }
  });

  // ── Navegación de Categorías en /panel ──
  bot.callbackQuery(/^panel_cat:(.+)$/, async (ctx) => {
    try {
      const catKey = ctx.match[1];
      const category = PANEL_CATEGORIES[catKey];
      if (!category) {
        return ctx.answerCallbackQuery({ text: 'Categoría no encontrada.' });
      }

      await ctx.answerCallbackQuery();
      await ctx.editMessageText(category.text, {
        parse_mode: 'HTML',
        reply_markup: getCategoryKeyboard(),
      });
    } catch (err) {
      console.warn('⟡ Error navegando categoría panel:', err.message);
    }
  });

  // ── Volver al Menú Principal ──
  bot.callbackQuery('panel_back', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const communityName = ctx.tenant?.community_name || DEFAULT_COMMUNITY_NAME;
      const firstName = ctx.from.first_name || 'Operador';
      const text = renderMainMenuText(communityName, firstName);
      const kb = getMainMenuKeyboard();

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (err) {
      console.warn('⟡ Error volviendo al menú de panel:', err.message);
    }
  });

  // ── Cerrar Panel ──
  bot.callbackQuery('panel_close', async (ctx) => {
    try {
      await ctx.answerCallbackQuery({ text: 'Panel cerrado.' });
      await ctx.deleteMessage();
    } catch {}
  });

  // ── Comando secundario /web_token: Acceso al Portal Web Secreto para Owners ──
  bot.command(['web_token', 'portal_key'], async (ctx) => {
    try {
      const userId = ctx.from.id;
      const firstName = ctx.from.first_name || 'Usuario';
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      const tenant = ctx.tenant || null;
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
        `⏱️ <b>Vigencia de Sesión:</b> <code>24 Horas</code>`;

      const kb = new InlineKeyboard().url('🚀 ABRIR CONSOLA CENTRAL VLP', masterPanelUrl);
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
};
