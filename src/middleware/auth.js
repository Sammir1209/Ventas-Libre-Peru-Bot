const config = require('../config/env');
const db = require('../database/postgres');
const { ROLES } = require('../config/constants');

// ══════════════════════════════════════════════════════
// ⟡ Middleware de Autenticación y Roles
// ══════════════════════════════════════════════════════

function getEffectiveOwners(ctx) {
  if (ctx.tenant && Array.isArray(ctx.tenant.owner_ids) && ctx.tenant.owner_ids.length > 0) {
    return ctx.tenant.owner_ids;
  }
  return config.OWNER_IDS;
}

/**
 * Verifica que el usuario sea Owner del bot (por tenant.owner_ids, .env o en base de datos).
 */
function requireOwner() {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const owners = getEffectiveOwners(ctx);
    if (owners.includes(userId)) return next();

    const tenantId = ctx.tenant?.id || null;
    const member = await db.getStaffMember(userId, tenantId);
    if (member && member.role) {
      const rolesUpper = member.role.toUpperCase();
      if (rolesUpper.includes('OWNER') && !rolesUpper.includes('CO-OWNER') && !rolesUpper.includes('COOWNER')) {
        ctx.staffRole = member.role;
        return next();
      }
    }

    return ctx.reply(
      '⟡ <b>Acceso Denegado</b>\n\n' +
      '✧ Este comando es exclusivo para <b>Owners</b> del bot.',
      { parse_mode: 'HTML' }
    );
  };
}

/**
 * Verifica que el usuario sea parte del Staff (cualquier rol).
 */
function requireStaff() {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const owners = getEffectiveOwners(ctx);
    if (owners.includes(userId)) return next();

    const tenantId = ctx.tenant?.id || null;
    const member = await db.getStaffMember(userId, tenantId);
    if (!member || !member.role) {
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

    const owners = getEffectiveOwners(ctx);
    if (owners.includes(userId)) return next();

    const tenantId = ctx.tenant?.id || null;
    const member = await db.getStaffMember(userId, tenantId);
    if (member && member.role) {
      const r = member.role.toUpperCase();
      if (r.includes('TRATO ADMIN') || r.includes('TRATOADMIN') || r.includes(ROLES.DEAL_ADMIN) || r.includes('OWNER')) {
        ctx.staffRole = member.role;
        return next();
      }
    }

    return ctx.reply(
      '⟡ <b>Acceso Denegado</b>\n\n' +
      '✧ Este comando requiere el rol de <b>Trato Admin</b>.',
      { parse_mode: 'HTML' }
    );
  };
}

/**
 * Verifica que el usuario sea Owner o Co-Owner.
 */
function requireOwnerOrCoOwner() {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const owners = getEffectiveOwners(ctx);
    if (owners.includes(userId)) return next();

    const tenantId = ctx.tenant?.id || null;
    const member = await db.getStaffMember(userId, tenantId);
    if (member && member.role) {
      const r = member.role.toUpperCase();
      if (r.includes('OWNER') || r.includes('CO-OWNER') || r.includes('COOWNER')) {
        ctx.staffRole = member.role;
        return next();
      }
    }

    return ctx.reply(
      '⟡ <b>Acceso Denegado</b>\n\n' +
      '✧ Este comando requiere permisos de <b>Owner</b> o <b>Co-Owner</b>.',
      { parse_mode: 'HTML' }
    );
  };
}

module.exports = {
  requireOwner,
  requireStaff,
  requireDealAdmin,
  requireOwnerOrCoOwner,
};
