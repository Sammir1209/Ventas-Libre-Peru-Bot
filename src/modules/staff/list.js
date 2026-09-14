const db = require('../../database/postgres');
const config = require('../../config/env');
const { ROLES } = require('../../config/constants');
const templates = require('../../utils/templates');
const helpers = require('../../utils/helpers');
const { getReputation } = require('../escrow/rating');

// ══════
// ⟡ Comando /staff — Listar Equipo con Jerarquía
// ══════

function register(bot) {
  bot.command('staff', async (ctx) => {
    try {
      const grouped = {
        owners: [],
        coowners: [],
        admins: [],
        dealAdmins: [],
      };

      const isSubBot = !!ctx.tenant;
      const effectiveOwnerIds = isSubBot ? (ctx.tenant.owner_ids || []) : config.OWNER_IDS;
      const ownerIdSet = new Set(effectiveOwnerIds);
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
      const tenantId = ctx.tenant?.id || null;

      // 1. Cargar Owners garantizados (de la comunidad correspondiente)
      for (const ownerId of effectiveOwnerIds) {
        const ownerDetails = await helpers.resolveStaffUserDetails(ownerId, tenantId, ctx);
        if (ownerDetails) {
          grouped.owners.push(ownerDetails);
        }
      }

      // 2. Cargar Staff de Supabase / BD (Aislado por tenant_id)
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

        if (roles.includes('OWNER') || roles.includes('DUENO') || roles.includes('DUEÑO')) {
          if (!ownerIdSet.has(member.user_id)) {
            grouped.owners.push(enrichedMember);
          }
        }
        if (roles.includes('CO-OWNER') || roles.includes('COOWNER') || roles.includes('CO OWNER')) {
          grouped.coowners.push(enrichedMember);
        }
        if (roles.includes('ADMIN') || roles.includes('ADMINISTRADOR') || roles.includes('ADMINS')) {
          grouped.admins.push(enrichedMember);
        }
        if (
          roles.includes('TRATO ADMIN') ||
          roles.includes('TRATOADMIN') ||
          roles.includes('TRATO_ADMIN') ||
          roles.includes(ROLES.DEAL_ADMIN) ||
          roleStr.includes('TRATO')
        ) {
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
        }
      }

      const message = templates.renderStaffList(grouped, communityName);
      const { InlineKeyboard } = require('grammy');
      let botUsername = 'ventas_libres_peru_Bot';
      try {
        const botInfo = await ctx.api.getMe();
        botUsername = botInfo.username;
      } catch {}

      const kb = new InlineKeyboard().url(
        'INICIAR TRATO ADMIN',
        `https://t.me/${botUsername}?start=tratoadm`
      ).primary();

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (err) {
      console.error('⟡ Staff: Error en /staff:', err.message);
      await ctx.reply('⟡ ✗ Error al cargar la lista del Staff.', { parse_mode: 'HTML' });
    }
  });
}

module.exports = { register };
