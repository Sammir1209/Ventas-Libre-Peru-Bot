// ══════
// ⟡ Web Service: Grupos Oficiales y Seguridad DEFCON / Locks
// ══════

const db = require('../../database/postgres');

async function listGroups() {
  const groups = await db.getAllGroups();
  return groups || [];
}

async function getGroupSecurity(chatId) {
  const numId = Number(chatId);
  const defcon = await db.getSetting(`defcon_${numId}`) || '0';
  const antiRaid = await db.getSetting(`antiraid_${numId}`) || 'off';
  const antiFlood = await db.getSetting(`antiflood_${numId}`) || 'off';
  const locks = await db.getSetting(`locks_${numId}`) || '{}';

  return {
    chatId: numId,
    defconLevel: defcon,
    antiRaid: antiRaid === 'on',
    antiFlood: antiFlood === 'on',
    locks: typeof locks === 'string' ? JSON.parse(locks) : locks,
  };
}

async function updateGroupSecurity(chatId, settings = {}) {
  const numId = Number(chatId);

  if (settings.defconLevel !== undefined) {
    await db.setSetting(`defcon_${numId}`, String(settings.defconLevel));
  }
  if (settings.antiRaid !== undefined) {
    await db.setSetting(`antiraid_${numId}`, settings.antiRaid ? 'on' : 'off');
  }
  if (settings.antiFlood !== undefined) {
    await db.setSetting(`antiflood_${numId}`, settings.antiFlood ? 'on' : 'off');
  }
  if (settings.locks !== undefined) {
    await db.setSetting(`locks_${numId}`, JSON.stringify(settings.locks));
  }

  return await getGroupSecurity(numId);
}

module.exports = {
  listGroups,
  getGroupSecurity,
  updateGroupSecurity,
};
