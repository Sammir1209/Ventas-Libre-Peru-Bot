const crypto = require('crypto');
const config = require('../../config/env');
const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const { SYM } = require('../../config/constants');
const { escapeHtml } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');

// ══════════════════════════════════════════════════════
// ⟡ Módulo: Comando /panel & Generador de Acceso Seguro (MD)
//   Soporta temas dinámicos: Owner VLP (naranja fuego) vs Client (negro/blanco)
// ══════════════════════════════════════════════════════

/**
 * Genera un token y contraseña temporal de un solo clic para el panel web.
 * Ahora incluye datos de tenant, tema y branding en la sesión.
 */
async function generatePanelSession(userId, role = 'STAFF', extra = {}) {
  const sessionToken = crypto.randomBytes(24).toString('hex');
  const tempPassword = crypto.randomBytes(4).toString('hex').toUpperCase();

  const sessionData = {
    userId,
    tempPassword,
    role,
    createdAt: Date.now(),
    // Multi-tenant theming data
    isGlobalOwner: extra.isGlobalOwner || false,
    tenantId: extra.tenantId || null,
    communityName: extra.communityName || 'Ventas Libres Perú',
    theme: extra.theme || 'owner', // 'owner' | 'owner-dev' | 'client'
    branding: extra.branding || {},
  };

  await redisDb.setCache(`panel_token:${sessionToken}`, sessionData, 1800);
  await redisDb.setCache(`panel_user_pass:${userId}`, tempPassword, 1800);

  return { sessionToken, tempPassword };
}

/**
 * Valida un token o contraseña de sesión.
 */
async function validatePanelSession(tokenOrUserId, password = null) {
  if (password) {
    const savedPass = await redisDb.getCache(`panel_user_pass:${tokenOrUserId}`);
    return savedPass === password;
  }
  return await redisDb.getCache(`panel_token:${tokenOrUserId}`);
}

function register(bot) {
  bot.command(['panel', 'dashboard', 'control', 'web'], async (ctx) => {
    try {
      const userId = ctx.from.id;
      const username = ctx.from.username || null;
      const firstName = ctx.from.first_name || 'Usuario';

      // 1. Verificar si el usuario tiene rango de Staff, Owner o Administrador de algún grupo
      const isOwnerHardcoded = config.OWNER_IDS.includes(userId) || userId === 7794982496 || userId === 7849224682;
      const staffMember = await db.getStaffMember(userId);
      const isStaff = isOwnerHardcoded || !!staffMember;

      // Si no es staff global, verificar si es admin en el chat actual si es grupo
      let isChatAdmin = false;
      if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        try {
          const member = await ctx.api.getChatMember(ctx.chat.id, userId);
          isChatAdmin = member.status === 'administrator' || member.status === 'creator';
        } catch {}
      }

      // Detectar si el contexto actual es un sub-bot (tenant)
      const tenant = ctx.tenant || null;
      let isSubBotOwner = false;
      let subBotData = null;

      if (tenant && tenant.id) {
        // Estamos dentro de un sub-bot — verificar si el usuario es owner de este sub-bot
        const ownerIds = Array.isArray(tenant.owner_ids) ? tenant.owner_ids : [];
        isSubBotOwner = ownerIds.includes(userId);
        subBotData = tenant;
      } else {
        // Estamos en el bot principal — verificar si este usuario es dueño de algún sub-bot
        try {
          const allSubBots = await db.getAllSubBots();
          for (const sb of allSubBots) {
            const sbOwners = Array.isArray(sb.owner_ids) ? sb.owner_ids : [];
            if (sbOwners.includes(userId)) {
              isSubBotOwner = true;
              subBotData = sb;
              break;
            }
          }
        } catch {}
      }

      if (!isStaff && !isChatAdmin && !isSubBotOwner) {
        return ctx.reply(
          `${SYM.CROSS} <b>Acceso Restringido:</b> El comando <code>/panel</code> solo está habilitado para Administradores de grupos y miembros del Staff de la plataforma.`,
          { parse_mode: 'HTML' }
        );
      }

      // 2. Determinar tema y datos de sesión
      const isDev = userId === 7849224682; // Sammir = Dev principal
      let sessionTheme = 'owner';
      let sessionExtra = {
        isGlobalOwner: isOwnerHardcoded,
        tenantId: null,
        communityName: 'Ventas Libres Perú',
        theme: 'owner',
        branding: {},
      };

      if (isDev) {
        sessionTheme = 'owner-dev';
        sessionExtra.theme = 'owner-dev';
      } else if (isOwnerHardcoded) {
        sessionTheme = 'owner';
        sessionExtra.theme = 'owner';
      } else if (isSubBotOwner && subBotData) {
        // Cliente de sub-bot: tema elegante negro/blanco
        sessionTheme = 'client';
        sessionExtra = {
          isGlobalOwner: false,
          tenantId: subBotData.id,
          communityName: subBotData.community_name || 'Mi Comunidad',
          theme: 'client',
          branding: subBotData.branding || subBotData.custom_settings?.branding || {},
        };
      } else {
        // Staff regular o admin de grupo
        sessionTheme = 'owner';
        sessionExtra.theme = 'owner';
      }

      // 3. Generar credenciales
      const roleName = isOwnerHardcoded
        ? (isDev ? 'DEVELOPER SUPREMO' : 'OWNER SUPREMO')
        : (isSubBotOwner ? 'OWNER DEL BOT' : (staffMember?.role || 'ADMINISTRADOR DE GRUPO'));

      const { sessionToken, tempPassword } = await generatePanelSession(userId, roleName, sessionExtra);

      const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://ventas-libre-peru-bot.onrender.com';
      const dashboardPath = config.DASHBOARD_PATH || '/vlp-master-portal-7849';

      // Links con auto-login
      const groupsPanelUrl = `${baseUrl}${dashboardPath}?auth_token=${sessionToken}&uid=${userId}#groups`;
      const saasPanelUrl = `${baseUrl}${dashboardPath}/saas.html?auth_token=${sessionToken}&uid=${userId}`;

      // 4. Preparar mensaje para el chat privado (MD)
      const dmText =
        `${SYM.DIVIDER}\n` +
        `🔐 <b>CREDENCIALES DE ACCESO AL PANEL WEB</b>\n` +
        `${SYM.DIVIDER}\n\n` +
        `¡Hola, <b>${escapeHtml(firstName)}</b>! Se ha generado tu acceso seguro al centro de comando:\n\n` +
        `➜ <b>ID de Usuario:</b> <code>${userId}</code>\n` +
        `➜ <b>Usuario:</b> ${username ? `@${username}` : '<i>Sin @username</i>'}\n` +
        `➜ <b>Rango Autorizado:</b> <b>${escapeHtml(roleName)}</b>\n` +
        `➜ <b>Contraseña Temporal:</b> <code>${tempPassword}</code>\n\n` +
        `⏱️ <b>Vigencia:</b> 30 minutos desde la emisión.\n` +
        `${SYM.THIN_LINE}\n` +
        `💡 <i>Puedes pulsar directamente en los botones de abajo para ingresar sin escribir contraseña:</i>`;

      const kb = new InlineKeyboard()
        .url('GESTIONAR GRUPOS & SEGURIDAD', groupsPanelUrl);

      // Si es Owner global o Co-Owner, darle acceso al Gestor Maestro de Sub-Bots
      if (isOwnerHardcoded || (staffMember && (staffMember.role.includes('OWNER') || staffMember.role.includes('CO-OWNER')))) {
        kb.row().url('PANEL MAESTRO SAAS (SUB-BOTS)', saasPanelUrl);
      }

      // 5. Intentar enviar por MD
      let sentToDm = false;
      try {
        await ctx.api.sendMessage(userId, dmText, {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
        sentToDm = true;
      } catch (dmErr) {
        console.warn(`⟡ /panel: No se pudo enviar MD a ${userId}:`, dmErr.message);
      }

      // 6. Responder en el chat de origen
      if (ctx.chat.type === 'private') {
        if (!sentToDm) {
          await ctx.reply(dmText, { parse_mode: 'HTML', reply_markup: kb });
        }
      } else {
        if (sentToDm) {
          const groupNotice = await ctx.reply(
            `📩 <b>${escapeHtml(firstName)}</b>, te he enviado tus credenciales y enlaces de acceso al panel por <b>mensaje privado</b>.`,
            { parse_mode: 'HTML' }
          );
          setTimeout(async () => {
            try {
              await ctx.api.deleteMessage(ctx.chat.id, groupNotice.message_id);
              if (ctx.message) await ctx.deleteMessage();
            } catch {}
          }, 12000);
        } else {
          const botUsername = ctx.me.username;
          await ctx.reply(
            `⚠️ <b>${escapeHtml(firstName)}</b>, no pude enviarte el mensaje privado porque aún no has iniciado el bot.\n\n` +
            `👉 Haz clic en <a href="https://t.me/${botUsername}?start=panel"><b>[ Iniciar Chat Privado ]</b></a> y vuelve a escribir <code>/panel</code>.`,
            { parse_mode: 'HTML' }
          );
        }
      }
    } catch (err) {
      console.error('⟡ Error en comando /panel:', err.message);
      await ctx.reply(`${SYM.CROSS} Error generando acceso al panel: ${err.message}`, { parse_mode: 'HTML' });
    }
  });
}

module.exports = {
  register,
  generatePanelSession,
  validatePanelSession,
};
