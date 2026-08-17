const { InlineKeyboard } = require('grammy');
const config = require('../../config/env');
const db = require('../../database/postgres');
const { SYM, ROLES } = require('../../config/constants');

// ══════════════════════════════════════════════════════
// ⟡ Módulo: Guía de Ayuda y Protocolos de Actuación por Rol
// ══════════════════════════════════════════════════════

/**
 * Genera la vista de ayuda para el rol de OWNER / CO-OWNER.
 */
function buildOwnerHelp() {
  const text =
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>PANEL DE COMANDOS — OWNER / CO-OWNER</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `👑 <b>Gestión de Jerarquías y Staff:</b>\n` +
    `${SYM.BULLET} <code>/promote [ID/@user/reply]</code> — Ascender de rango a un usuario.\n` +
    `${SYM.BULLET} <code>/demote [ID/@user/reply]</code> — Degradar de rango a un miembro del staff.\n` +
    `${SYM.BULLET} <code>/staff</code> — Lista oficial del equipo y mediadores.\n\n` +
    `🛡️ <b>Seguridad y Baneo Global:</b>\n` +
    `${SYM.BULLET} <code>/listanegra</code> — Ver la lista completa de estafadores con fechas y motivos.\n` +
    `${SYM.BULLET} <code>/gban [ID/@user/reply] [motivo]</code> — Baneo permanente de <b>TODOS</b> los grupos y lista negra.\n` +
    `${SYM.BULLET} <code>/ungban</code> / <code>/unburn [ID/@user]</code> — Quitar de lista negra y desbanear.\n` +
    `${SYM.BULLET} <code>/info [ID/@user]</code> — Consultar antecedentes de estafas y perfil.\n\n` +
    `⚙️ <b>Configuración de Canales e Hilos (Topics):</b>\n` +
    `${SYM.BULLET} <code>/set_grupo_tratos</code> — Supergrupo oficial de salas Escrow (con temas).\n` +
    `${SYM.BULLET} <code>/set_tratosadm</code> — Grupo o Hilo para solicitudes de <code>/tratoadm</code>.\n` +
    `${SYM.BULLET} <code>/set_quemar</code> — Grupo o Hilo para reportes de <code>/quemar</code> (Staff).\n` +
    `${SYM.BULLET} <code>/set_canal_quemar</code> — Canal Público Oficial donde se publican estafadores quemados.\n` +
    `${SYM.BULLET} <code>/set_logs</code> — Canal o Hilo para Logs y copias de seguridad <code>.json</code>.\n` +
    `${SYM.BULLET} <code>/verify</code> — Activar o desactivar verificación obligatoria en el grupo.\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <i>Tip: Si tu grupo tiene Temas (Topics), ejecuta el comando dentro del Hilo exacto donde quieres que lleguen los mensajes.</i>`;

  const kb = new InlineKeyboard()
    .text(`${SYM.DIAMOND} Protocolo Trato Admin`, 'help_view:trato_admin').primary()
    .text(`${SYM.STAR} Manual Admin`, 'help_view:admin').primary()
    .row()
    .text(`${SYM.CROSS} Cerrar`, 'help_close').danger();

  return { text, kb };
}

/**
 * Genera la vista de ayuda y protocolo para TRATO ADMIN.
 */
function buildTratoAdminHelp() {
  const text =
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>PROTOCOLO OFICIAL — TRATO ADMIN (ESCROW)</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `🛡️ <b>Pasos Obligatorios para la Mediación Segura:</b>\n\n` +
    `<b>1️⃣ Entrada a la Sala:</b>\n` +
    `${SYM.ARROW} Al aceptar una solicitud en el canal de Staff, pulsa el botón del bot para ingresar al hilo creado.\n\n` +
    `<b>2️⃣ Confirmación de Condiciones:</b>\n` +
    `${SYM.ARROW} Saluda a ambas partes y confirma: <b>Monto en dinero</b> y <b>Producto/Cuenta a entregar</b>.\n\n` +
    `<b>3️⃣ Custodia de Fondos (REGLA DE ORO):</b>\n` +
    `${SYM.ARROW} Pasa tus datos de pago (Yape/Plin/Banco) al <b>COMPRADOR</b>.\n` +
    `${SYM.ARROW} <b>NUNCA</b> des luz verde al vendedor hasta ver el dinero reflejado en tu cuenta bancaria personal.\n\n` +
    `<b>4️⃣ Entrega del Producto:</b>\n` +
    `${SYM.ARROW} Notifica en el hilo que el pago está retenido y pide al <b>VENDEDOR</b> entregar los datos/producto al comprador dentro del chat.\n\n` +
    `<b>5️⃣ Conformidad y Cierre:</b>\n` +
    `${SYM.ARROW} El comprador confirma que todo funciona 100% conforme.\n` +
    `${SYM.ARROW} Transfieres el dinero correspondiente al vendedor.\n` +
    `${SYM.ARROW} Presionas <code>[ Finalizar Trato y Cerrar Hilo ]</code>.\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <i>El bot solicitará la calificación al usuario y respaldará el chat en .json automáticamente.</i>`;

  const kb = new InlineKeyboard()
    .text(`${SYM.DIAMOND} Ver Mis Estadísticas`, 'help_view:my_stats').success()
    .row()
    .text(`${SYM.CROSS} Cerrar`, 'help_close').danger();

  return { text, kb };
}

/**
 * Genera la vista de ayuda para ADMIN.
 */
function buildAdminHelp() {
  const text =
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>MANUAL DE MODERACIÓN — ADMIN</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `⚔️ <b>Comandos de Control de Grupos:</b>\n` +
    `${SYM.BULLET} <code>/ban [ID/@user/reply] [motivo]</code> — Expulsar y banear del grupo actual.\n` +
    `${SYM.BULLET} <code>/unban [ID/@user/reply]</code> — Desbanear del grupo actual.\n` +
    `${SYM.BULLET} <code>/mute [ID/@user/reply]</code> — Silenciar usuario para que no escriba.\n` +
    `${SYM.BULLET} <code>/unmute [ID/@user/reply]</code> — Devolver permisos de escritura.\n\n` +
    `🚨 <b>Anti-Estafas y Lista Negra:</b>\n` +
    `${SYM.BULLET} <code>/listanegra</code> — Ver la lista oficial de estafadores con motivos y fechas.\n` +
    `${SYM.BULLET} <code>/gban [ID/@user/reply] [motivo]</code> — Baneo global de toda la comunidad.\n` +
    `${SYM.BULLET} <code>/ungban [ID/@user]</code> — Quitar baneo global si fue un error.\n` +
    `${SYM.BULLET} <code>/info [ID/@user]</code> — Consultar antecedentes de estafas en tiempo real.\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.STAR} <i>Mantén siempre un trato respetuoso y sanciona cualquier intento de fraude de inmediato.</i>`;

  const kb = new InlineKeyboard()
    .text(`${SYM.DIAMOND} Protocolo Trato Admin`, 'help_view:trato_admin').primary()
    .row()
    .text(`${SYM.CROSS} Cerrar`, 'help_close').danger();

  return { text, kb };
}

/**
 * Genera la vista de ayuda para USUARIOS NORMALES.
 */
function buildUserHelp() {
  const text =
    `${SYM.DIVIDER}\n` +
    `${SYM.DIAMOND} <b>CENTRO DE AYUDA — VENTAS LIBRES PERÚ</b> ${SYM.DIAMOND}\n` +
    `${SYM.DIVIDER}\n\n` +
    `🛡️ <b>¿Cómo comprar y vender seguro?</b>\n` +
    `${SYM.BULLET} <code>/tratoadm</code> — Solicita un <b>Trato Admin</b> oficial para mediar tu compra o venta. El bot creará una sala privada y un admin custodiará el dinero hasta que recibas tu producto.\n\n` +
    `🔍 <b>Verificación y Lista Negra:</b>\n` +
    `${SYM.BULLET} <code>/listanegra</code> — Consulta la lista oficial de usuarios sancionados por estafa.\n` +
    `${SYM.BULLET} <code>/info [ID / @username]</code> — Consulta si una persona registra antecedentes, reportes o sanciones de estafa antes de hacer tratos.\n\n` +
    `🚨 <b>Reportar Estafadores:</b>\n` +
    `${SYM.BULLET} <code>/quemar</code> — Reporta a un estafador adjuntando pruebas y capturas para sancionarlo en la comunidad.\n\n` +
    `👥 <b>Equipo Oficial:</b>\n` +
    `${SYM.BULLET} <code>/staff</code> — Consulta quiénes son los administradores y mediadores autorizados.\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.CROSS} <b>ADVERTENCIA DE SEGURIDAD:</b>\n` +
    `Nunca transfieras dinero directamente por mensaje privado. Usa siempre <code>/tratoadm</code>.`;

  const kb = new InlineKeyboard()
    .url(`${SYM.DIAMOND} Iniciar Trato Admin`, `https://t.me/${config.BOT_TOKEN.split(':')[0]}?start=tratoadm`).primary()
    .row()
    .text(`${SYM.CROSS} Cerrar`, 'help_close').danger();

  return { text, kb };
}

const redisDb = require('../../database/redis');
const templates = require('../../utils/templates');
const { escapeHtml } = require('../../utils/formatting');

function register(bot) {
  // ── Comando /start con Deep-Linking (quemar, tratoadm, etc.) ──
  bot.command('start', async (ctx) => {
    try {
      const isPrivate = ctx.chat.type === 'private';
      const payload = ctx.match ? ctx.match.trim().toLowerCase() : '';

      // 1. Deep-link: Iniciar reporte de estafa (/start quemar)
      if (payload === 'quemar') {
        const userId = ctx.from.id;
        const { burnTargetTypeKeyboard } = require('../burn/keyboard');

        await redisDb.setBurnState(userId, {
          step: 'CHOOSE_TYPE',
          targetId: null,
          targetUsername: null,
          targetLabel: null,
          context: null,
          proofs: [],
          proofUrls: [],
        });

        return ctx.reply(templates.burnInitialPrompt(), {
          parse_mode: 'HTML',
          reply_markup: burnTargetTypeKeyboard(),
        });
      }

      // 2. Deep-link: Iniciar Trato Admin (/start tratoadm o /start tratos)
      if (payload === 'tratoadm' || payload === 'tratos') {
        const { dealMainKeyboard } = require('../escrow/keyboard');
        await redisDb.clearCache(`deal_form:${ctx.from.id}`);
        return ctx.reply(templates.dealMainMenuMessage(), {
          parse_mode: 'HTML',
          reply_markup: dealMainKeyboard(),
        });
      }

      // 3. Menú Principal de Bienvenida en DM (/start)
      if (isPrivate) {
        const name = ctx.from.first_name || 'Usuario';
        const startText =
          `${SYM.DIVIDER}\n` +
          `${SYM.SEAL} <b>VENTAS LIBRES PERÚ — BOT OFICIAL</b> ${SYM.BADGE}\n` +
          `${SYM.DIVIDER}\n\n` +
          `¡Hola, <b>${escapeHtml(name)}</b>! Bienvenido al sistema oficial de <b>Ventas Libres Perú</b> 🇵🇪\n\n` +
          `📌 <b>Servicios y Funciones Disponibles:</b>\n` +
          `${SYM.SWORD} <b>Trato Admin:</b> Mediación y custodia 100% segura para tus compras y ventas.\n` +
          `${SYM.ALERT} <b>Quemar Estafadores:</b> Denuncia estafas con pruebas y consulta la lista negra.\n` +
          `${SYM.CROWN} <b>Staff Certificado:</b> Conoce al equipo oficial de mediadores y administradores.\n\n` +
          `${SYM.THIN_LINE}\n` +
          `${SYM.STAR} <i>Selecciona una opción para comenzar:</i>`;

        const kb = new InlineKeyboard()
          .text(`${SYM.SWORD} Trato Admin`, 'start_tratoadm').success()
          .text(`${SYM.ALERT} Quemar`, 'start_quemar').danger()
          .row()
          .text(`${SYM.CROWN} Staff`, 'start_staff').primary()
          .text(`${SYM.PRINT} Ayuda`, 'start_help').primary();

        return ctx.reply(startText, {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      }
    } catch (err) {
      console.error('⟡ Error en /start:', err.message);
    }
  });

  // Callbacks del menú de inicio
  bot.callbackQuery('start_tratoadm', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const { dealMainKeyboard } = require('../escrow/keyboard');
      await redisDb.clearCache(`deal_form:${ctx.from.id}`);
      await ctx.reply(templates.dealMainMenuMessage(), {
        parse_mode: 'HTML',
        reply_markup: dealMainKeyboard(),
      });
    } catch {}
  });

  bot.callbackQuery('start_quemar', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const { burnTargetTypeKeyboard } = require('../burn/keyboard');
      await redisDb.setBurnState(ctx.from.id, {
        step: 'CHOOSE_TYPE',
        targetId: null,
        targetUsername: null,
        targetLabel: null,
        context: null,
        proofs: [],
        proofUrls: [],
      });
      await ctx.reply(templates.burnInitialPrompt(), {
        parse_mode: 'HTML',
        reply_markup: burnTargetTypeKeyboard(),
      });
    } catch {}
  });

  bot.callbackQuery('start_staff', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      // Mostrar lista staff
      const grouped = { owners: [], coowners: [], admins: [], dealAdmins: [] };
      for (const ownerId of config.OWNER_IDS) {
        let username = null;
        let firstName = 'Owner';
        try {
          const chatInfo = await ctx.api.getChat(ownerId);
          username = chatInfo.username || null;
          firstName = chatInfo.first_name || firstName;
        } catch {}
        grouped.owners.push({ user_id: ownerId, username, first_name: firstName });
      }
      try {
        const staffMembers = await db.getAllStaff();
        for (const member of staffMembers) {
          const role = (member.role || '').toUpperCase();
          if (role === ROLES.CO_OWNER) grouped.coowners.push(member);
          else if (role === 'ADMIN') grouped.admins.push(member);
          else if (role === ROLES.DEAL_ADMIN) grouped.dealAdmins.push({ ...member, avgRating: '5.0' });
        }
      } catch {}
      await ctx.reply(templates.renderStaffList(grouped), { parse_mode: 'HTML' });
    } catch {}
  });

  bot.callbackQuery('start_help', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const view = buildUserHelp();
      await ctx.reply(view.text, { parse_mode: 'HTML', reply_markup: view.kb });
    } catch {}
  });

  // ── Comando /help /ayuda ──
  bot.command(['help', 'ayuda'], async (ctx) => {
    try {
      const userId = ctx.from.id;
      const isOwner = config.OWNER_IDS.includes(userId);
      const staffMember = await db.getStaffMember(userId);
      const role = isOwner ? ROLES.OWNER : staffMember ? staffMember.role : null;

      let view;
      if (isOwner || role === ROLES.OWNER || role === ROLES.CO_OWNER) {
        view = buildOwnerHelp();
      } else if (role === ROLES.TRATO_ADMIN) {
        view = buildTratoAdminHelp();
      } else if (role === ROLES.ADMIN) {
        view = buildAdminHelp();
      } else {
        view = buildUserHelp();
      }

      await ctx.reply(view.text, {
        parse_mode: 'HTML',
        reply_markup: view.kb,
      });
    } catch (err) {
      console.error('⟡ Help: Error en /help:', err.message);
      await ctx.reply(`⟡ ✗ Error al cargar menú de ayuda: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Callback para cambiar de vista en /help ──
  bot.callbackQuery(/^help_view:(.+)$/, async (ctx) => {
    try {
      const viewType = ctx.match[1];
      await ctx.answerCallbackQuery();

      let view;
      if (viewType === 'trato_admin') {
        view = buildTratoAdminHelp();
      } else if (viewType === 'admin') {
        view = buildAdminHelp();
      } else if (viewType === 'owner') {
        view = buildOwnerHelp();
      } else if (viewType === 'my_stats') {
        const stats = await db.getAdminStats(ctx.from.id);
        const rating = stats.deals_count > 0 ? (stats.total_stars / stats.ratings_count || 5).toFixed(1) : '5.0';
        const statsText =
          `${SYM.DIVIDER}\n` +
          `${SYM.DIAMOND} <b>MIS ESTADÍSTICAS — TRATO ADMIN</b> ${SYM.DIAMOND}\n` +
          `${SYM.DIVIDER}\n\n` +
          `${SYM.ARROW} <b>Tratos Completados:</b> <code>${stats.deals_count || 0}</code>\n` +
          `${SYM.ARROW} <b>Calificación Promedio:</b> ⭐ <b>${rating} / 5.0</b>\n` +
          `${SYM.ARROW} <b>Reseñas Recibidas:</b> <code>${stats.ratings_count || 0}</code>\n\n` +
          `${SYM.THIN_LINE}\n` +
          `${SYM.STAR} <i>¡Sigue brindando una atención rápida y segura para mantener tu reputación alta!</i>`;

        const kb = new InlineKeyboard()
          .text(`${SYM.DIAMOND} Volver al Protocolo`, 'help_view:trato_admin').primary()
          .row()
          .text(`${SYM.CROSS} Cerrar`, 'help_close').danger();

        return ctx.editMessageText(statsText, {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      } else {
        view = buildUserHelp();
      }

      await ctx.editMessageText(view.text, {
        parse_mode: 'HTML',
        reply_markup: view.kb,
      });
    } catch (err) {
      console.error('⟡ Help: Error en callback help_view:', err.message);
    }
  });

  // ── Callback cerrar ──
  bot.callbackQuery('help_close', async (ctx) => {
    try {
      await ctx.answerCallbackQuery({ text: 'Panel cerrado.' });
      await ctx.deleteMessage();
    } catch {}
  });
}

module.exports = { register };
