const crypto = require('crypto');
const config = require('../../config/env');
const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const { SYM } = require('../../config/constants');
const { escapeHtml } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');
const { isGlobalOwner, resolveCommunityName, DEFAULT_COMMUNITY_NAME } = require('../../utils/tenantContext');

// ══════
// ⟡ Módulo: Comando /panel & Generador de Acceso Seguro (Zero-Trust)
//   Aislamiento perimetral estricto: Sólo Owners reciben credenciales por DM
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

function register(bot) {
  bot.command(['panel', 'dashboard', 'control', 'web'], async (ctx) => {
    try {
      const userId = ctx.from.id;
      const firstName = ctx.from.first_name || 'Usuario';
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      const tenant = ctx.tenant || null;
      const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://ventas-libre-peru-bot-2y5n.onrender.com';

      // ══════════════════════════════════════════════════════
      // CASO 1: SUB-BOT (COMUNIDAD CLIENTE SAAS)
      // ══════════════════════════════════════════════════════
      if (tenant && tenant.id) {
        const ownerIds = Array.isArray(tenant.owner_ids) ? tenant.owner_ids.map(Number) : [];
        const isTenantOwner = ownerIds.includes(Number(userId));
        let isAuthorized = isTenantOwner;

        if (!isAuthorized) {
          try {
            const staffMember = await db.getStaffMember(userId, tenant.id);
            if (staffMember && (staffMember.role.includes('OWNER') || staffMember.role.includes('CO-OWNER'))) {
              isAuthorized = true;
            }
          } catch {}
        }

        // SI NO ES OWNER: SILENCIO ABSOLUTO EN GRUPOS, RECHAZO EN PRIVADO
        if (!isAuthorized) {
          if (isGroup) {
            try { await ctx.deleteMessage(); } catch {}
          } else {
            await ctx.reply(
              `⚠️ <b>Acceso Restringido:</b> Este comando es exclusivo para el <b>Owner</b> y directiva autorizada de esta comunidad.`,
              { parse_mode: 'HTML' }
            );
          }
          return;
        }

        // SI ES OWNER: Si está en grupo, borrar el comando trigger y avisar efímero
        if (isGroup) {
          try { await ctx.deleteMessage(); } catch {}
        }

        // Generar credenciales en PostgreSQL
        const subBotSlug = tenant.bot_username ? tenant.bot_username.replace(/^@/, '') : tenant.id;
        const { sessionToken, tempPassword } = await generatePanelSession(userId, 'OWNER SUB-BOT', {
          isGlobalOwner: false,
          tenantId: tenant.id,
          communityName: tenant.community_name || 'Mi Comunidad',
          theme: 'client',
        });

        const tenantAdminUrl = `${baseUrl}/portal/?slug=${subBotSlug}&token=${sessionToken}&view=admin`;

        const dmText =
          `⟡ <b>PANEL ADMINISTRATIVO</b> ⊱ <code>${escapeHtml(tenant.community_name)}</code> ⊰\n` +
          `══════\n\n` +
          `Hola <b>${escapeHtml(firstName)}</b>, se han generado tus credenciales exclusivas de administración:\n\n` +
          `▸ <b>Enlace Web del Panel:</b>\n` +
          `<code>${tenantAdminUrl}</code>\n\n` +
          `▸ <b>Tu ID de Telegram:</b> <code>${userId}</code>\n` +
          `▸ <b>Tu Contraseña Temporal:</b> <code>${tempPassword}</code>\n\n` +
          `⏱️ <b>Vigencia de Sesión:</b> <code>24 Horas</code>\n` +
          `──────\n` +
          `🔐 <i>Haz clic en el botón de abajo para ingresar directamente a tu panel:</i>`;

        const kb = new InlineKeyboard().url('🚀 ABRIR MI PANEL DE CONTROL', tenantAdminUrl);

        let sentDm = false;
        try {
          await ctx.api.sendMessage(userId, dmText, {
            parse_mode: 'HTML',
            reply_markup: kb,
            link_preview_options: { is_disabled: true },
          });
          sentDm = true;
        } catch (dmErr) {
          console.warn(`⟡ No se pudo enviar DM de panel a ${userId}:`, dmErr.message);
        }

        if (isGroup) {
          if (sentDm) {
            const notice = await ctx.reply(
              `👑 <b>${escapeHtml(firstName)}</b>, tus credenciales de acceso al Panel Web fueron enviadas a tu <b>chat privado</b>.`,
              { parse_mode: 'HTML' }
            );
            setTimeout(() => ctx.api.deleteMessage(ctx.chat.id, notice.message_id).catch(() => {}), 6000);
          } else {
            const notice = await ctx.reply(
              `⚠️ <b>${escapeHtml(firstName)}</b>, no pude enviarte el acceso. Inicia el bot por privado en <a href="https://t.me/${subBotSlug}?start=panel"><b>@${subBotSlug}</b></a> y repite <code>/panel</code>.`,
              { parse_mode: 'HTML' }
            );
            setTimeout(() => ctx.api.deleteMessage(ctx.chat.id, notice.message_id).catch(() => {}), 8000);
          }
        } else if (!sentDm) {
          await ctx.reply(dmText, { parse_mode: 'HTML', reply_markup: kb });
        }
        return;
      }

      // ══════════════════════════════════════════════════════
      // CASO 2: BOT PRINCIPAL (VENTAS LIBRES PERÚ)
      // ══════════════════════════════════════════════════════
      const isOwnerCheck = isGlobalOwner(userId);
      const staffMember = await db.getStaffMember(userId);
      const isGlobalStaff = isOwnerCheck || (staffMember && (staffMember.role.includes('OWNER') || staffMember.role.includes('CO-OWNER')));

      if (!isGlobalStaff) {
        if (isGroup) {
          try { await ctx.deleteMessage(); } catch {}
        } else {
          await ctx.reply(
            `${SYM.CROSS} <b>Acceso Restringido:</b> El comando <code>/panel</code> solo está habilitado para Owners y Staff oficial.`,
            { parse_mode: 'HTML' }
          );
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
        `⏱️ <b>Vigencia de Sesión:</b> <code>24 Horas</code>\n` +
        `──────\n` +
        `🔐 <i>Usa el botón de abajo para acceder directamente a la Consola Central:</i>`;

      const kb = new InlineKeyboard().url('🚀 ABRIR CONSOLA CENTRAL VLP', masterPanelUrl);

      let sentToDm = false;
      try {
        await ctx.api.sendMessage(userId, dmText, {
          parse_mode: 'HTML',
          reply_markup: kb,
          link_preview_options: { is_disabled: true },
        });
        sentToDm = true;
      } catch (dmErr) {
        console.warn(`⟡ /panel: No se pudo enviar MD a ${userId}:`, dmErr.message);
      }

      if (isGroup) {
        if (sentToDm) {
          const groupNotice = await ctx.reply(
            `👑 <b>${escapeHtml(firstName)}</b>, se han enviado tus credenciales de acceso por <b>mensaje privado</b>.`,
            { parse_mode: 'HTML' }
          );
          setTimeout(() => ctx.api.deleteMessage(ctx.chat.id, groupNotice.message_id).catch(() => {}), 6000);
        } else {
          const botUsername = ctx.me.username;
          const notice = await ctx.reply(
            `⚠️ <b>${escapeHtml(firstName)}</b>, inicia el bot por privado en <a href="https://t.me/${botUsername}?start=panel"><b>@${botUsername}</b></a> y repite <code>/panel</code>.`,
            { parse_mode: 'HTML' }
          );
          setTimeout(() => ctx.api.deleteMessage(ctx.chat.id, notice.message_id).catch(() => {}), 8000);
        }
      } else if (!sentToDm) {
        await ctx.reply(dmText, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (err) {
      console.error('⟡ Error en comando /panel:', err.message);
    }
  });
}

module.exports = {
  register,
  generatePanelSession,
  validatePanelSession,
};
