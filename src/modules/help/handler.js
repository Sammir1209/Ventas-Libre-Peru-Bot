const { InlineKeyboard } = require('grammy');
const config = require('../../config/env');
const db = require('../../database/postgres');
const helpers = require('../../utils/helpers');
const { SYM, ROLES } = require('../../config/constants');

// ══════
// ⟡ Módulo: Guía de Ayuda y Protocolos de Actuación por Rol
// ══════

const { toMathBold, toMathSerifBold, toSmallCaps, AESTHETIC_DIVIDERS } = require('../../utils/aesthetic');

/**
 * Genera la vista de ayuda para el rol de OWNER / CO-OWNER.
 */
function buildOwnerHelp() {
  const text =
    `⟡ <b>PANEL DE CONTROL</b> ⊱ <code>OWNER & CO-OWNER</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>ADMINISTRACIÓN & STAFF</b>\n` +
    `  • <code>/promote</code> — Ascender y asignar rangos oficiales\n` +
    `  • <code>/demote</code> — Degradar rango a miembro regular\n` +
    `  • <code>/staff</code> — Directorio oficial del Staff\n\n` +
    `▸ <b>ESCUDO DE SEGURIDAD & ANTI-RAID</b>\n` +
    `  • <code>/panico</code> — Lockdown inmediato en grupo (DEFCON 1)\n` +
    `  • <code>/antiraid</code> — Configurar escudo anti-incursiones\n` +
    `  • <code>/antiflood</code> — Control de spam por repetición\n` +
    `  • <code>/locks</code> — Bloqueos selectivos (links, bots, media)\n` +
    `  • <code>/purge</code> — Limpieza relámpago de mensajes\n` +
    `  • <code>/gban</code> — Baneo global permanente + lista negra\n` +
    `  • <code>/ungban</code> — Revocar baneo global\n` +
    `  • <code>/blacklist</code> — Base de datos de estafadores\n` +
    `  • <code>/info</code> — Antecedentes y perfil penal\n\n` +
    `▸ <b>SISTEMA & ENRUTAMIENTO</b>\n` +
    `  • <code>/set_grupo_tratos</code> — Grupo de mediaciones Escrow\n` +
    `  • <code>/set_tratosadm</code> — Hilo / Topic de solicitudes\n` +
    `  • <code>/set_quemar</code> — Hilo de recepción de denuncias\n` +
    `  • <code>/set_canal_quemar</code> — Canal público de estafadores\n` +
    `  • <code>/set_logs</code> — Canal privado de auditoría\n` +
    `  • <code>/verify</code> — Toggle de verificación obligatoria\n` +
    `──────\n` +
    `⚖️ <i>Protocolo maestro reservado para la alta dirección.</i>`;

  const kb = new InlineKeyboard()
    .text('PROTOCOLO TRATO ADMIN', 'help_view:trato_admin').primary()
    .text('MANUAL ADMIN', 'help_view:admin').primary()
    .row()
    .text('CERRAR', 'help_close').danger();

  return { text, kb };
}

/**
 * Genera la vista de ayuda y protocolo para TRATO ADMIN.
 */
function buildTratoAdminHelp() {
  const text =
    `⟡ <b>PROTOCOLO OPERATIVO</b> ⊱ <code>TRATO ADMIN / ESCROW</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>Fase 1: Aceptación</b>\n` +
    `  ↳ Toma la solicitud pendiente e ingresa al hilo privado generado.\n\n` +
    `▸ <b>Fase 2: Conciliación</b>\n` +
    `  ↳ Confirma monto, moneda y especificaciones del producto con ambas partes.\n\n` +
    `▸ <b>Fase 3: Retención de Fondos</b>\n` +
    `  ↳ Envía tus cuentas de pago al <b>COMPRADOR</b>.\n` +
    `  ⚠️ <i>NUNCA des luz verde sin verificar el dinero disponible en tu cuenta/app bancaria.</i>\n\n` +
    `▸ <b>Fase 4: Entrega</b>\n` +
    `  ↳ Una vez confirmado el pago en custodia, autoriza al <b>VENDEDOR</b> a entregar.\n\n` +
    `▸ <b>Fase 5: Cierre & Liberación</b>\n` +
    `  ↳ Comprador da visto bueno → transfieres los fondos al vendedor → cierras el trato.\n` +
    `──────\n` +
    `🛡️ <i>El sistema solicita calificación y archiva la auditoría automáticamente.</i>`;

  const kb = new InlineKeyboard()
    .text('MIS ESTADISTICAS', 'help_view:my_stats').success()
    .row()
    .text('CERRAR', 'help_close').danger();

  return { text, kb };
}

/**
 * Genera la vista de ayuda para ADMIN.
 */
function buildAdminHelp() {
  const text =
    `⟡ <b>PANEL DE MODERACIÓN</b> ⊱ <code>ADMINISTRADOR</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>CONTROL DE GRUPO</b>\n` +
    `  • <code>/ban</code> — Expulsión definitiva del grupo\n` +
    `  • <code>/unban</code> — Revocar expulsión\n` +
    `  • <code>/mute [tiempo]</code> — Silenciar temporalmente (ej. <code>1h</code>, <code>1d</code>)\n` +
    `  • <code>/unmute</code> — Restablecer permisos de escritura\n` +
    `  • <code>/warn</code> — Advertencia formal por mala conducta (3/3 ban)\n` +
    `  • <code>/warns</code> — Historial de advertencias del usuario\n\n` +
    `▸ <b>DEFENSA ANTI-FRAUDE</b>\n` +
    `  • <code>/gban [id/@user] [motivo]</code> — Baneo global de la red entera\n` +
    `  • <code>/ungban [id/@user]</code> — Retirar de la lista negra\n` +
    `  • <code>/blacklist</code> — Explorar registro oficial de estafadores\n` +
    `  • <code>/info [id/@user]</code> — Ficha penal y antecedentes\n` +
    `──────\n` +
    `⚖️ <i>Mantén la disciplina y el respeto en todos los sectores.</i>`;

  const kb = new InlineKeyboard()
    .text('PROTOCOLO TRATO ADMIN', 'help_view:trato_admin').primary()
    .row()
    .text('CERRAR', 'help_close').danger();

  return { text, kb };
}

/**
 * Genera la vista de ayuda para USUARIOS NORMALES.
 */
function buildUserHelp() {
  const text =
    `⟡ <b>CENTRO DE AYUDA</b> ⊱ <code>VENTAS LIBRES PERÚ</code> ⊰\n` +
    `══════\n\n` +
    `▸ <b>COMANDOS PRINCIPALES</b>\n` +
    `  • <code>/tratoadm</code> — Intermediación 100% segura para tus compras\n` +
    `  • <code>/quemar</code> — Denunciar a un estafador con pruebas reales\n` +
    `  • <code>/info [id/@user]</code> — Verificar antecedentes de un vendedor\n` +
    `  • <code>/blacklist</code> — Ver lista pública de usuarios vetados\n` +
    `  • <code>/staff</code> — Conocer al equipo oficial de mediadores\n` +
    `  • <code>/perfil</code> — Ver tu reputación y tratos concretados\n\n` +
    `──────\n` +
    `💡 <i>Consejo de Oro: Jamás compres por mensaje privado sin mediador. Usa <code>/tratoadm</code> para proteger tu dinero.</i>`;

  const kb = new InlineKeyboard()
    .url('INICIAR TRATO ADMIN', `https://t.me/${config.BOT_TOKEN.split(':')[0]}?start=tratoadm`).primary()
    .row()
    .text('CERRAR', 'help_close').danger();

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

      // 2. Deep-link: Iniciar Trato Admin (/start tratoadm o /start tratoadmin)
      if (payload === 'tratoadm' || payload === 'tratoadmin' || payload === 'tratos') {
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
        const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
        const customWelcome = ctx.tenant?.custom_settings?.welcome_message;

        const bodyDesc = customWelcome
          ? escapeHtml(customWelcome.replace(/\{mention\}/gi, name).replace(/\{community\}/gi, communityName))
          : `Hola, <b>${escapeHtml(name)}</b>. Bienvenido al ecosistema oficial de comercio seguro.\n\n` +
            `▸ <b>Trato Admin:</b> Mediación y custodia 100% garantizada.\n` +
            `▸ <b>Quemar:</b> Denuncias públicas y base de datos contra estafadores.\n` +
            `▸ <b>Staff:</b> Directorio de moderadores y mediadores autorizados.`;

        const startText =
          `⟡ <b>${escapeHtml(communityName.toUpperCase())}</b> ⊱ <code>OFICIAL</code> ⊰\n` +
          `══════\n\n` +
          `${bodyDesc}\n\n` +
          `──────\n` +
          `⟡ <i>Selecciona una opción del menú interactivo para comenzar:</i>`;

        const kb = new InlineKeyboard()
          .text('TRATO ADMIN', 'start_tratoadm')
          .text('QUEMAR', 'start_quemar')
          .row()
          .text('STAFF', 'start_staff')
          .text('AYUDA', 'start_help');

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
      const isSubBot = !!ctx.tenant;
      const effectiveOwnerIds = isSubBot ? (ctx.tenant.owner_ids || []) : config.OWNER_IDS;
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
      const tenantId = ctx.tenant?.id || null;

      const grouped = { owners: [], coowners: [], admins: [], dealAdmins: [] };
      for (const ownerId of effectiveOwnerIds) {
        const ownerDetails = await helpers.resolveStaffUserDetails(ownerId, tenantId, ctx);
        if (ownerDetails) {
          grouped.owners.push(ownerDetails);
        }
      }
      try {
        const staffMembers = await db.getAllStaff(tenantId);
        const ownerIdSet = new Set(effectiveOwnerIds);

        for (const member of staffMembers) {
          const roles = (member.role || '').split(',').map((r) => r.trim().toUpperCase());
          let enriched = member;
          if (!member.first_name || !member.username) {
            const extra = await helpers.resolveStaffUserDetails(member.user_id, tenantId, ctx);
            if (extra) {
              enriched = {
                ...member,
                username: member.username || extra.username,
                first_name: member.first_name || extra.first_name,
                custom_title: member.custom_title || extra.custom_title,
              };
            }
          }

          if (roles.includes('OWNER') && !ownerIdSet.has(member.user_id)) {
            grouped.owners.push(enriched);
          }
          if (roles.includes('CO-OWNER') || roles.includes('COOWNER')) {
            grouped.coowners.push(enriched);
          }
          if (roles.includes('ADMIN') || roles.includes('ADMINISTRADOR')) {
            grouped.admins.push(enriched);
          }
          if (roles.includes('TRATO ADMIN') || roles.includes('TRATOADMIN')) {
            grouped.dealAdmins.push({ ...enriched, avgRating: '5.0' });
          }
        }
      } catch {}
      await ctx.reply(templates.renderStaffList(grouped, communityName), { parse_mode: 'HTML' });
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
          `⟡ <b>ESTADÍSTICAS OFICIALES</b> ⊱ <code>TRATO ADMIN</code> ⊰\n` +
          `══════\n\n` +
          `▸ <b>Mediador:</b> <b>${escapeHtml(ctx.from.first_name || 'Admin')}</b> (<code>${ctx.from.id}</code>)\n` +
          `▸ <b>Tratos Concretados:</b> <code>${stats.deals_count || 0}</code> mediaciones\n` +
          `▸ <b>Calificación Promedio:</b> ⭐ <b>${rating} / 5.0</b>\n` +
          `▸ <b>Reseñas Verificadas:</b> <code>${stats.ratings_count || 0}</code> valoraciones\n\n` +
          `──────\n` +
          `⭐ <i>Tu desempeño y honestidad consolidan la confianza de toda la comunidad.</i>`;

        const kb = new InlineKeyboard()
          .text('VOLVER AL PROTOCOLO', 'help_view:trato_admin').primary()
          .row()
          .text('CERRAR', 'help_close').danger();

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
