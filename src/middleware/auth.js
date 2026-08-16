const config = require('../config/env');
const db = require('../database/postgres');
const { ROLES } = require('../config/constants');

// ══════════════════════════════════════════════════════
// ⟡ Middleware de Autenticación y Roles
// ══════════════════════════════════════════════════════

/**
 * Verifica que el usuario sea Owner del bot.
 */
function requireOwner() {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !config.OWNER_IDS.includes(userId)) {
      return ctx.reply(
        '⟡ <b>Acceso Denegado</b>\n\n' +
        '✧ Este comando es exclusivo para <b>Owners</b> del bot.',
        { parse_mode: 'HTML' }
      );
    }
    return next();
  };
}

/**
 * Verifica que el usuario sea parte del Staff (cualquier rol).
 */
function requireStaff() {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Owners siempre pasan
    if (config.OWNER_IDS.includes(userId)) return next();

    const member = await db.getStaffMember(userId);
    if (!member) {
      return ctx.reply(
        '⟡ <b>Acceso Denegado</b>\n\n' +
        '✧ Este comando requiere permisos de <b>Staff</b>.',
        { parse_mode: 'HTML' }
      );
    }

    ctx.staffRole = member.role;
    return next();
  };
}

/**
 * Verifica que el usuario tenga el rol "Trato Admin".
 */
function requireDealAdmin() {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Owners siempre pasan
    if (config.OWNER_IDS.includes(userId)) return next();

    const member = await db.getStaffMember(userId);
    if (!member || member.role !== ROLES.DEAL_ADMIN) {
      return ctx.reply(
        '⟡ <b>Acceso Denegado</b>\n\n' +
        '✧ Este comando requiere el rol de <b>Trato Admin</b>.',
        { parse_mode: 'HTML' }
      );
    }

    ctx.staffRole = member.role;
    return next();
  };
}

/**
 * Verifica que el usuario sea Owner o Co-Owner.
 */
function requireOwnerOrCoOwner() {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (config.OWNER_IDS.includes(userId)) return next();

    const member = await db.getStaffMember(userId);
    if (!member || (member.role !== ROLES.CO_OWNER && member.role !== ROLES.OWNER)) {
      return ctx.reply(
        '⟡ <b>Acceso Denegado</b>\n\n' +
        '✧ Este comando requiere permisos de <b>Owner</b> o <b>Co-Owner</b>.',
        { parse_mode: 'HTML' }
      );
    }

    ctx.staffRole = member.role;
    return next();
  };
}

module.exports = {
  requireOwner,
  requireStaff,
  requireDealAdmin,
  requireOwnerOrCoOwner,
};
