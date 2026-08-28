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
    `${SYM.DIAMOND} <b>PANEL — OWNER / CO-OWNER</b>\n\n` +
    `👑 <b>Staff:</b>\n` +
    `${SYM.BULLET} <code>/promote</code> — Ascender rango\n` +
    `${SYM.BULLET} <code>/demote</code> — Degradar rango\n` +
    `${SYM.BULLET} <code>/staff</code> — Lista oficial\n\n` +
    `🛡️ <b>Seguridad:</b>\n` +
    `${SYM.BULLET} <code>/gban</code> — Baneo global + lista negra\n` +
    `${SYM.BULLET} <code>/ungban</code> — Quitar de lista negra\n` +
    `${SYM.BULLET} <code>/listanegra</code> — Ver estafadores\n` +
    `${SYM.BULLET} <code>/info</code> — Consultar antecedentes\n\n` +
    `⚙️ <b>Configuración:</b>\n` +
    `${SYM.BULLET} <code>/set_grupo_tratos</code> — Grupo Escrow\n` +
    `${SYM.BULLET} <code>/set_tratosadm</code> — Hilo solicitudes\n` +
    `${SYM.BULLET} <code>/set_quemar</code> — Hilo reportes\n` +
    `${SYM.BULLET} <code>/set_canal_quemar</code> — Canal público quemados\n` +
    `${SYM.BULLET} <code>/set_logs</code> — Canal de logs\n` +
    `${SYM.BULLET} <code>/verify</code> — Toggle verificación`;

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
    `${SYM.DIAMOND} <b>PROTOCOLO — TRATO ADMIN</b>\n\n` +
    `<b>1.</b> Acepta solicitud → entra al hilo.\n` +
    `<b>2.</b> Confirma monto y producto con ambas partes.\n` +
    `<b>3.</b> Pasa tus datos de pago al <b>COMPRADOR</b>. <b>NUNCA</b> des luz verde sin ver el dinero reflejado.\n` +
    `<b>4.</b> Confirma pago retenido → vendedor entrega.\n` +
    `<b>5.</b> Comprador confirma → transfieres al vendedor → cierras hilo.\n\n` +
    `<i>El bot pide calificación y respalda el chat automáticamente.</i>`;

  const kb = new InlineKeyboard()
    .text(`${SYM.DIAMOND} Mis Estadísticas`, 'help_view:my_stats').success()
    .row()
    .text(`${SYM.CROSS} Cerrar`, 'help_close').danger();

  return { text, kb };
}

/**
 * Genera la vista de ayuda para ADMIN.
 */
function buildAdminHelp() {
  const text =
    `${SYM.DIAMOND} <b>MODERACIÓN — ADMIN</b>\n\n` +
    `⚔️ <b>Control:</b>\n` +
    `${SYM.BULLET} <code>/ban</code> — Banear del grupo\n` +
    `${SYM.BULLET} <code>/unban</code> — Desbanear\n` +
    `${SYM.BULLET} <code>/mute</code> — Silenciar\n` +
    `${SYM.BULLET} <code>/unmute</code> — Desmutear\n\n` +
    `🚨 <b>Anti-Estafas:</b>\n` +
    `${SYM.BULLET} <code>/gban</code> — Baneo global\n` +
    `${SYM.BULLET} <code>/ungban</code> — Quitar baneo global\n` +
    `${SYM.BULLET} <code>/listanegra</code> — Lista de estafadores\n` +
    `${SYM.BULLET} <code>/info</code> — Antecedentes`;

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
    `${SYM.DIAMOND} <b>AYUDA — VENTAS LIBRES PERÚ</b>\n\n` +
    `${SYM.BULLET} <code>/tratoadm</code> — Compra/venta segura con mediador\n` +
    `${SYM.BULLET} <code>/listanegra</code> — Lista de estafadores\n` +
    `${SYM.BULLET} <code>/info</code> — Consultar antecedentes\n` +
    `${SYM.BULLET} <code>/quemar</code> — Reportar estafador\n` +
    `${SYM.BULLET} <code>/staff</code> — Equipo oficial\n\n` +
    `${SYM.WARNING} Nunca transfieras dinero por DM. Usa <code>/tratoadm</code>.`;

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
          `${SYM.SEAL} <b>VENTAS LIBRES PERÚ</b> ${SYM.BADGE}\n\n` +
          `¡Hola, <b>${escapeHtml(name)}</b>! 🇵🇪\n\n` +
          `${SYM.SWORD} <b>Trato Admin</b> — Mediación segura\n` +
          `${SYM.ALERT} <b>Quemar</b> — Reportar estafadores\n` +
          `${SYM.CROWN} <b>Staff</b> — Equipo oficial\n\n` +
          `Selecciona una opción:`;

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
