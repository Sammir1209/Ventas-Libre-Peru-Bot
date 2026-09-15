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

async function listAvailableChats(botInstance = null, tenantId = null) {
  const rawGroups = await db.getAllGroups(tenantId);
  if (!botInstance) {
    return (rawGroups || []).map(g => ({
      chatId: String(g.chat_id),
      title: g.title || 'Chat Oficial',
      type: g.type || 'supergroup',
      username: g.username ? `@${String(g.username).replace(/^@/, '')}` : null,
      isAdmin: false,
      status: 'unknown',
      badge: '⚠️ No Verificado',
    }));
  }

  let botId = botInstance.botInfo?.id;
  if (!botId && botInstance.api?.getMe) {
    try {
      const me = await botInstance.api.getMe();
      botId = me?.id;
    } catch {}
  }

  const results = [];
  const checkedChatIds = new Set();

  for (const g of rawGroups || []) {
    const cid = Number(g.chat_id);
    if (checkedChatIds.has(cid)) continue;
    checkedChatIds.add(cid);

    try {
      let chat = null;
      let member = null;

      if (botInstance.api) {
        [chat, member] = await Promise.all([
          botInstance.api.getChat(cid).catch(() => null),
          botId ? botInstance.api.getChatMember(cid, botId).catch(() => null) : null,
        ]);
      }

      const title = chat?.title || g.title || 'Chat';
      const type = chat?.type || g.type || 'supergroup';
      const cleanUser = chat?.username || g.username;
      const username = cleanUser ? `@${String(cleanUser).replace(/^@/, '')}` : null;
      const isAdm = member ? (member.status === 'administrator' || member.status === 'creator') : false;

      // Si el bot fue expulsado del grupo
      if (member?.status === 'left' || member?.status === 'kicked') {
        await db.removeGroup(cid, tenantId).catch(() => {});
        continue;
      }

      results.push({
        chatId: String(cid),
        title,
        type,
        username,
        isAdmin: isAdm,
        status: member?.status || 'unknown',
        canRestrict: isAdm ? (member.can_restrict_members !== false) : false,
        canPost: isAdm ? (member.can_post_messages !== false) : false,
        canDelete: isAdm ? (member.can_delete_messages !== false) : false,
        canInvite: isAdm ? (member.can_invite_users !== false) : false,
        badge: isAdm ? '🛡️ Admin' : '⚠️ No Admin',
      });
    } catch {
      results.push({
        chatId: String(cid),
        title: g.title || 'Chat',
        type: g.type || 'supergroup',
        username: g.username ? `@${String(g.username).replace(/^@/, '')}` : null,
        isAdmin: false,
        status: 'unknown',
        badge: '⚠️ Sin Acceso',
      });
    }
  }

  return results;
}

module.exports = {
  listGroups,
  getGroupSecurity,
  updateGroupSecurity,
  listAvailableChats,
};
