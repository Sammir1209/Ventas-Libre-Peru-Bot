// ══════
// ⟡ Web Service: Grupos Oficiales y Seguridad DEFCON / Locks
// ══════

const db = require('../../database/postgres');

async function listGroups() {
  const groups = await db.getAllGroups();
  const enriched = await Promise.all((groups || []).map(async (g) => {
    const isReverifyActive = (await db.getSetting(`reverify_active_${g.chat_id}`)) === 'true';
    return { ...g, isReverifyActive };
  }));
  return enriched;
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

async function getPrimaryVerificationChat(tenantId = null) {
  const key = tenantId ? `primary_verification_chat_${tenantId}` : 'primary_verification_chat';
  return await db.getSetting(key, tenantId);
}

async function setPrimaryVerificationChat(chatId, tenantId = null) {
  const key = tenantId ? `primary_verification_chat_${tenantId}` : 'primary_verification_chat';
  if (!chatId) {
    await db.setSetting(key, '', tenantId);
    return null;
  }
  const strId = String(chatId).trim();
  await db.setSetting(key, strId, tenantId);
  return strId;
}

async function listAvailableChats(botInstance = null, tenantId = null) {
  const rawGroups = await db.getAllGroups(tenantId);
  const primaryChatId = await getPrimaryVerificationChat(tenantId);

  if (!botInstance) {
    return (rawGroups || []).map(g => ({
      chatId: String(g.chat_id),
      title: g.title || 'Chat Oficial',
      type: g.type || 'supergroup',
      username: g.username ? `@${String(g.username).replace(/^@/, '')}` : null,
      isAdmin: false,
      status: 'unknown',
      badge: '⚠️ No Verificado',
      isPrimaryVerification: primaryChatId && String(g.chat_id) === String(primaryChatId),
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

      const isPrimary = primaryChatId ? String(cid) === String(primaryChatId) : false;

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
        isPrimaryVerification: isPrimary,
        badge: isAdm ? '🛡️ Admin' : '⚠️ No Admin',
      });
    } catch {
      const isPrimary = primaryChatId ? String(cid) === String(primaryChatId) : false;
      results.push({
        chatId: String(cid),
        title: g.title || 'Chat',
        type: g.type || 'supergroup',
        username: g.username ? `@${String(g.username).replace(/^@/, '')}` : null,
        isAdmin: false,
        status: 'unknown',
        isPrimaryVerification: isPrimary,
        badge: '⚠️ Sin Acceso',
      });
    }
  }

  return results;
}

async function addGroup({ chatId, title, type = 'channel', username = null, tenantId = null, botInstance = null }) {
  if (!chatId) {
    throw new Error('Debes ingresar un ID numérico de Telegram o un @username.');
  }

  let cleanInput = String(chatId).trim();
  // Limpiar links tipo https://t.me/canal o t.me/canal
  if (cleanInput.includes('t.me/')) {
    cleanInput = cleanInput.split('t.me/')[1].split('/')[0].split('?')[0];
    if (!cleanInput.startsWith('@') && !/^-?\d+$/.test(cleanInput)) {
      cleanInput = `@${cleanInput}`;
    }
  }

  let finalChatId = cleanInput;
  let finalTitle = title ? String(title).trim() : null;
  let finalType = type || 'channel';
  let finalUsername = username ? String(username).trim().replace(/^@/, '') : null;
  let botChecked = false;
  let isAdmin = false;

  // Si tenemos instancia del bot activa, consultar getChat
  if (botInstance && botInstance.api) {
    try {
      const chat = await botInstance.api.getChat(cleanInput);
      if (chat) {
        finalChatId = String(chat.id);
        finalTitle = chat.title || finalTitle || 'Chat Oficial';
        finalType = chat.type || finalType;
        if (chat.username) {
          finalUsername = chat.username.replace(/^@/, '');
        }
        botChecked = true;

        try {
          const botId = botInstance.botInfo?.id || (await botInstance.api.getMe())?.id;
          if (botId) {
            const member = await botInstance.api.getChatMember(chat.id, botId);
            isAdmin = member && (member.status === 'administrator' || member.status === 'creator');
          }
        } catch {}
      }
    } catch (tgErr) {
      console.warn(`⟡ [groupsService] Telegram getChat aviso para "${cleanInput}":`, tgErr.message);
    }
  }

  // Si no se resolvió por getChat, verificar si es ID numérico
  const isNumeric = /^-?\d+$/.test(finalChatId);
  if (!isNumeric) {
    throw new Error(
      `No se pudo conectar con "${cleanInput}" en Telegram. Asegúrate de que el bot haya sido agregado al canal/grupo como administrador, o ingresa el ID numérico (-100...).`
    );
  }

  if (!finalTitle) {
    finalTitle = finalUsername ? `@${finalUsername}` : `Chat ${finalChatId}`;
  }

  const group = await db.registerGroup(
    finalChatId,
    finalTitle,
    finalType,
    finalUsername,
    tenantId
  );

  let warning = null;
  if (botChecked && !isAdmin) {
    warning = 'Canal vinculado. Sin embargo, el bot aún no figura como Administrador en Telegram.';
  }

  return {
    group,
    isAdmin,
    warning,
  };
}

async function removeGroup(chatId, tenantId = null) {
  if (!chatId) {
    throw new Error('ID de chat requerido para desvincular.');
  }
  await db.removeGroup(chatId, tenantId);
  return true;
}

async function reverifyGroup({ chatId, mode = 'lock', tenantId = null, botInstance = null }) {
  if (!chatId) throw new Error('ID de chat requerido.');
  if (!botInstance || !botInstance.api) {
    throw new Error('La instancia del bot no se encuentra activa en este momento.');
  }

  const { executeReverify, executeUnreverify } = require('../../modules/verification/handler');

  let tenant = null;
  if (tenantId) {
    tenant = await db.getSubBotById(tenantId);
  }

  if (mode === 'lock') {
    await executeReverify(botInstance.api, chatId, tenant);
    return {
      ok: true,
      active: true,
      message: 'Filtro de auditoría activado. Quienes no estén unidos a los canales oficiales serán silenciados al intentar hablar. Los miembros ya verificados seguirán hablando normalmente.',
    };
  } else {
    await executeUnreverify(botInstance.api, chatId, tenant);
    return {
      ok: true,
      active: false,
      message: 'Filtro de auditoría desactivado. El chat vuelve a operar sin restricciones de miembros antiguos.',
    };
  }
}

async function getReverifyStatus(chatId) {
  const saved = await db.getSetting(`reverify_active_${chatId}`);
  return saved === 'true';
}

module.exports = {
  listGroups,
  getGroupSecurity,
  updateGroupSecurity,
  listAvailableChats,
  addGroup,
  removeGroup,
  reverifyGroup,
  getReverifyStatus,
  getPrimaryVerificationChat,
  setPrimaryVerificationChat,
};

