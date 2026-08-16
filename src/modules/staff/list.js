const db = require('../../database/postgres');
const config = require('../../config/env');
const { ROLES } = require('../../config/constants');
const templates = require('../../utils/templates');
const { getReputation } = require('../escrow/rating');

// ══════════════════════════════════════════════════════
// ⟡ Comando /staff — Listar Equipo con Jerarquía
// ══════════════════════════════════════════════════════

function register(bot) {
  bot.command('staff', async (ctx) => {
    try {
      const grouped = {
        owners: [],
        coowners: [],
        admins: [],
        dealAdmins: [],
      };

      const ownerIdSet = new Set(config.OWNER_IDS);

      // 1. Cargar Owners del .env garantizados
      for (const ownerId of config.OWNER_IDS) {
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

      // 2. Cargar Staff de Supabase / BD
      let staffMembers = [];
      try {
        staffMembers = await db.getAllStaff();
      } catch (dbErr) {
        console.error('⟡ Staff list: Error leyendo BD:', dbErr.message);
      }

      for (const member of staffMembers) {
        const role = (member.role || '').toUpperCase();

        if (role === ROLES.OWNER) {
          // Evitar duplicar con los del env
          if (!ownerIdSet.has(member.user_id)) {
            grouped.owners.push(member);
          }
        } else if (role === ROLES.CO_OWNER || role === 'CO-OWNER' || role === 'COOWNER') {
          grouped.coowners.push(member);
        } else if (role === 'ADMIN' || role === 'ADMINISTRADOR') {
          grouped.admins.push(member);
        } else if (role === ROLES.DEAL_ADMIN || role === 'TRATO ADMIN' || role === 'TRATOADMIN') {
          let avgRating = '5.0';
          try {
            const rep = await getReputation(member.user_id);
            if (rep.totalRatings > 0) {
              avgRating = rep.avgRating;
            }
          } catch {}
          grouped.dealAdmins.push({
            ...member,
            avgRating,
          });
        }
      }

      const message = templates.renderStaffList(grouped);
      const { InlineKeyboard } = require('grammy');
      let botUsername = 'ventas_libres_peru_Bot';
      try {
        const botInfo = await ctx.api.getMe();
        botUsername = botInfo.username;
      } catch {}

      const kb = new InlineKeyboard().url(
        `⟡ Iniciar Trato Admin`,
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
