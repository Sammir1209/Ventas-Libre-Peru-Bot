const db = require('../../database/postgres');
const config = require('../../config/env');
const { ROLES } = require('../../config/constants');
const templates = require('../../utils/templates');
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
        let username = null;
        let firstName = 'Owner';
        try {
          const chatInfo = await ctx.api.getChat(ownerId);
          username = chatInfo.username || null;
          firstName = chatInfo.first_name || firstName;
        } catch {}

        grouped.owners.push({
          user_id: ownerId,
          username,
          first_name: firstName,
        });
      }

      // 2. Cargar Staff de Supabase / BD (Aislado por tenant_id)
      let staffMembers = [];
      try {
        staffMembers = await db.getAllStaff(tenantId);
      } catch (dbErr) {
        console.error('⟡ Staff list: Error leyendo BD:', dbErr.message);
      }

      for (const member of staffMembers) {
        let username = member.username || null;
        let firstName = member.first_name || null;

        // Si el username no está en la tabla staff, buscarlo en users o en Telegram API
        if (!username) {
          const u = await db.getUser(member.user_id);
          if (u && u.username) {
            username = u.username;
            firstName = firstName || u.first_name;
          } else {
            try {
              const chat = await ctx.api.getChat(member.user_id);
              if (chat) {
                username = chat.username || null;
                firstName = firstName || chat.first_name;
                if (username) {
                  await db.upsertStaffMember(member.user_id, username, member.role, tenantId);
                }
              }
            } catch {}
          }
        }

        const enrichedMember = {
          ...member,
          username,
          first_name: firstName,
        };

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
