// ══════
// ⟡ Comando /staff — Directorio Oficial Sin Jerarquías (Admins & Trato Admins)
// ══════

const db = require('../../database/postgres');
const config = require('../../config/env');
const { ROLES, AUTHORIZED_STAFF_ROSTER } = require('../../config/constants');
const templates = require('../../utils/templates');
const helpers = require('../../utils/helpers');
const { getReputation } = require('../escrow/rating');
const { InlineKeyboard } = require('grammy');
const { toMathBold } = require('../../utils/aesthetic');

function register(bot) {
  bot.command('staff', async (ctx) => {
    try {
      const isSubBot = !!ctx.tenant;
      const effectiveOwnerIds = isSubBot ? (ctx.tenant.owner_ids || []) : config.OWNER_IDS;
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
      const tenantId = ctx.tenant?.id || null;

      const grouped = {
        admins: [],
        dealAdmins: [],
      };

      const adminUsernames = new Set();
      const dealAdminUsernames = new Set();

      // Para el bot principal (Ventas Libres Perú), aplicar lista blanca estricta
      if (!isSubBot) {
        // Cargar staff registrado de la BD
        let staffMembers = [];
        try {
          staffMembers = await db.getAllStaff(null);
        } catch (dbErr) {
          console.error('⟡ Staff list: Error leyendo BD:', dbErr.message);
        }

        const staffMap = new Map();
        for (const s of staffMembers) {
          if (s.username) {
            staffMap.set(s.username.toLowerCase().replace(/^@/, ''), s);
          }
          if (s.user_id) {
            staffMap.set(String(s.user_id), s);
          }
        }

        for (const official of AUTHORIZED_STAFF_ROSTER) {
          const uClean = official.username.toLowerCase();
          const dbData = staffMap.get(uClean) || (official.defaultId ? staffMap.get(String(official.defaultId)) : null);

          const memberObj = {
            user_id: dbData?.user_id || official.defaultId || null,
            username: official.username,
            first_name: dbData?.first_name || official.username,
            custom_title: official.roles.includes('TRATO ADMIN') ? 'Trato Admin' : 'Admin',
          };

          // Admins
          if (!adminUsernames.has(uClean)) {
            grouped.admins.push(memberObj);
            adminUsernames.add(uClean);
          }

          // Trato Admins autorizados (@AgarMaker y @S_14xx)
          if (official.roles.includes('TRATO ADMIN') && !dealAdminUsernames.has(uClean)) {
            let avgRating = '5.0';
            if (memberObj.user_id) {
              try {
                const rep = await getReputation(memberObj.user_id);
                if (rep.totalRatings > 0) avgRating = rep.avgRating;
              } catch {}
            }
            grouped.dealAdmins.push({
              ...memberObj,
              avgRating,
            });
            dealAdminUsernames.add(uClean);
          }
        }
      } else {
        // En sub-bots de otras comunidades
        const adminIdSet = new Set();
        const dealAdminIdSet = new Set();

        for (const ownerId of effectiveOwnerIds) {
          const numId = Number(ownerId);
          if (adminIdSet.has(numId)) continue;
          const ownerDetails = await helpers.resolveStaffUserDetails(ownerId, tenantId, ctx);
          if (ownerDetails) {
            grouped.admins.push({
              ...ownerDetails,
              custom_title: ownerDetails.custom_title || 'Admin',
            });
            adminIdSet.add(numId);
          }
        }

        let staffMembers = [];
        try {
          staffMembers = await db.getAllStaff(tenantId);
        } catch (dbErr) {
          console.error('⟡ Staff list: Error leyendo BD:', dbErr.message);
        }

        for (const member of staffMembers) {
          let enrichedMember = member;
          if (!member.username || !member.first_name) {
            const extra = await helpers.resolveStaffUserDetails(member.user_id, tenantId, ctx);
            if (extra) {
              enrichedMember = {
                ...member,
                username: member.username || extra.username,
                first_name: member.first_name || extra.first_name,
                custom_title: member.custom_title || extra.custom_title,
              };
            }
          }

          const roleStr = String(member.role || '').toUpperCase();
          const roles = roleStr.split(/[,/|]+/).map((r) => r.trim());
          const numUserId = Number(member.user_id);

          const isAdmin =
            roles.includes('ADMIN') ||
            roles.includes('ADMINISTRADOR') ||
            roles.includes('ADMINS') ||
            roles.includes('OWNER') ||
            roles.includes('CO-OWNER') ||
            roles.includes('COOWNER');

          if (isAdmin && !adminIdSet.has(numUserId)) {
            grouped.admins.push(enrichedMember);
            adminIdSet.add(numUserId);
          }

          const isDealAdmin =
            roles.includes('TRATO ADMIN') ||
            roles.includes('TRATOADMIN') ||
            roles.includes('TRATO_ADMIN') ||
            roles.includes(ROLES.DEAL_ADMIN) ||
            roleStr.includes('TRATO');

          if (isDealAdmin && !dealAdminIdSet.has(numUserId)) {
            let avgRating = '5.0';
            try {
              const rep = await getReputation(member.user_id);
              if (rep.totalRatings > 0) {
                avgRating = rep.avgRating;
              }
            } catch {}

            grouped.dealAdmins.push({
              ...enrichedMember,
              avgRating,
            });
            dealAdminIdSet.add(numUserId);
          }
        }
      }

      const message = templates.renderStaffList(grouped, communityName);

      let botUsername = 'ventas_libres_peru_Bot';
      try {
        const botInfo = await ctx.api.getMe();
        botUsername = botInfo.username;
      } catch {}

      // Teclado en cuadrícula (Grid Layout):
      // Fila 1: Botón largo solo
      // Fila 2: Botones cortos agrupados lado a lado
      const kb = new InlineKeyboard()
        .url(
          `✦ ${toMathBold('SOLICITAR TRATO ADMIN')}`,
          `https://t.me/${botUsername}?start=tratoadm`
        )
        .row()
        .url(
          `❖ ${toMathBold('GUIA')}`,
          `https://t.me/${botUsername}?start=guiatrato`
        )
        .text(
          `✕ ${toMathBold('CERRAR')}`,
          'staff_close'
        );

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: kb,
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      console.error('⟡ Staff: Error en /staff:', err.message);
      await ctx.reply('⟡ ✗ Error al cargar la lista del Staff.', { parse_mode: 'HTML' });
    }
  });

  // Callback para cerrar la lista de staff
  bot.callbackQuery('staff_close', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      await ctx.deleteMessage().catch(() => {});
    } catch {}
  });
}

module.exports = { register };
