const https = require('https');
const db = require('../database/postgres');
const config = require('../config/env');
const { generateTelegramProfileModal } = require('./telegramProfileModal');
const userbot = require('../userbot/client');

/**
 * Descarga el avatar de un usuario de Telegram usando Bot API
 */
async function downloadTelegramAvatar(api, fileId) {
  try {
    const file = await api.getFile(fileId);
    const token = api.token || config.BOT_TOKEN;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    return new Promise((resolve) => {
      https.get(downloadUrl, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(null));
      }).on('error', () => resolve(null));
    });
  } catch {
    return null;
  }
}

/**
 * Genera el buffer de la tarjeta de perfil gráfica del usuario (idéntica a /perfil)
 * Utilizada tanto por el comando /perfil como por la publicación de alertas en el canal de quemados.
 * 
 * Por defecto genera SIEMPRE la tarjeta auténtica limpia de Telegram (fondo pizarra azul,
 * anillo cyan/esmeralda, estado online, fila de @username y fila de ID oficial).
 */
async function generateUserCardBuffer(api, target, options = {}) {
  let userId = target.userId && Number(target.userId) > 0 ? Number(target.userId) : null;
  let username = target.username ? target.username.replace(/^@/, '') : null;
  let firstName = target.firstName || target.name || null;
  let targetBio = target.bio || target.targetBio || null;
  let avatarBuffer = target.avatarBuffer || null;

  // 1. Verificar primero en Base de Datos si falta ID o Username
  if (!userId && username) {
    try {
      const dbUser = await db.getUserByUsername(username);
      if (dbUser && dbUser.user_id) {
        userId = Number(dbUser.user_id);
        if (!firstName && dbUser.first_name) firstName = dbUser.first_name;
      }
    } catch {}
  }
  if (userId && !username) {
    try {
      const dbUser = await db.getUser(userId);
      if (dbUser && dbUser.username) username = dbUser.username.replace(/^@/, '');
      if (!firstName && dbUser.first_name) firstName = dbUser.first_name;
    } catch {}
  }

  // 2. Verificar vía Agentbot / MTProto Userbot (resuelve cualquier usuario, ID, biografía, estado y foto en HD)
  let isOnline = true;
  if ((!userId || !username || !avatarBuffer || !targetBio) && (username || userId)) {
    try {
      if (userbot.isConnected()) {
        const targetQuery = username || userId;
        const ubRes = await userbot.resolveUser(targetQuery);
        if (ubRes) {
          if (!userId && ubRes.userId) userId = ubRes.userId;
          if (!username && ubRes.username) username = ubRes.username.replace(/^@/, '');
          if ((!firstName || firstName === 'Estafador' || firstName === 'Usuario') && (ubRes.firstName || ubRes.lastName)) {
            firstName = [ubRes.firstName, ubRes.lastName].filter(Boolean).join(' ') || null;
          }
          if (!targetBio && ubRes.bio) {
            targetBio = ubRes.bio;
          }
          if (ubRes.isOnline !== undefined) {
            isOnline = ubRes.isOnline;
          }
        }

        if (!avatarBuffer) {
          avatarBuffer = await userbot.downloadProfilePhoto(targetQuery);
        }
      }
    } catch (ubErr) {
      console.warn('⟡ Userbot resolveUser aviso:', ubErr.message);
    }
  }

  // 3. Verificar vía Bot API de Telegram (getChat y getUserProfilePhotos)
  if (!userId && username) {
    try {
      const chatInfo = await api.getChat(`@${username}`);
      if (chatInfo && chatInfo.id) {
        userId = chatInfo.id;
        if (!username && chatInfo.username) username = chatInfo.username.replace(/^@/, '');
        if ((!firstName || firstName === 'Estafador') && (chatInfo.first_name || chatInfo.last_name)) {
          firstName = [chatInfo.first_name, chatInfo.last_name].filter(Boolean).join(' ');
        }
        if (!targetBio && chatInfo.bio) targetBio = chatInfo.bio;
      }
    } catch {}
  }

  if (userId) {
    try {
      const chatInfo = await api.getChat(userId);
      if (!username && chatInfo.username) username = chatInfo.username.replace(/^@/, '');
      if ((!firstName || firstName === 'Estafador' || firstName === 'Usuario') && (chatInfo.first_name || chatInfo.last_name)) {
        firstName = [chatInfo.first_name, chatInfo.last_name].filter(Boolean).join(' ');
      }
      if (!targetBio && chatInfo.bio) targetBio = chatInfo.bio;
    } catch {}

    if (!avatarBuffer) {
      try {
        const userPhotos = await api.getUserProfilePhotos(userId, { limit: 1 });
        if (userPhotos && userPhotos.total_count > 0) {
          const largestPhoto = userPhotos.photos[0][userPhotos.photos[0].length - 1];
          avatarBuffer = await downloadTelegramAvatar(api, largestPhoto.file_id);
        }
      } catch {}
    }
  }

  // 4. Fallbacks de nombre para que siempre salga limpio y legible
  if (!firstName || firstName === 'Estafador') {
    if (username) firstName = `@${username}`;
    else if (userId) firstName = `ID ${userId}`;
    else firstName = target.name || 'Usuario';
  }

  // 5. Consultar roles, tratos, rating
  let rolesList = [];
  const effectiveOwners = options.ownerIds || config.OWNER_IDS || [];
  const tenantId = options.tenantId || null;
  const communityName = options.communityName || 'Comunidad Oficial';

  if (userId && effectiveOwners.includes(userId)) {
    rolesList = ['OWNER'];
  }

  if (userId) {
    try {
      const staff = await db.getStaffMember(userId, tenantId);
      if (staff && staff.role) {
        const parsed = staff.role.split(',').map((r) => r.trim().toUpperCase());
        rolesList = Array.from(new Set([...rolesList, ...parsed]));
      }
    } catch {}
  }

  let dealsCount = 0;
  if (userId) {
    try {
      dealsCount = await db.getUserDealsCount(userId);
    } catch {}
  }

  let rating = '5.0';
  let totalRatings = 0;
  const isDealAdmin = rolesList.some((r) => r.includes('TRATO ADMIN') || r.includes('TRATOADMIN'));
  if (isDealAdmin && userId) {
    try {
      const rData = await db.getAdminAvgRating(userId);
      if (rData && rData.avg_rating) rating = parseFloat(rData.avg_rating).toFixed(1);
      if (rData && rData.total_ratings) totalRatings = rData.total_ratings;
    } catch {}
  }

  let isVerified = false;
  if (userId) {
    try {
      const dbUser = await db.getUser(userId);
      if (dbUser && (dbUser.verified || dbUser.is_verified)) {
        isVerified = true;
      }
    } catch {}
  }

  // NO USAR TEMA ROJO (la tarjeta de perfil es SIEMPRE la versión auténtica de Telegram solicitada por el usuario)
  const isBurned = options.isBurned === true;

  let primaryRole = null;
  if (rolesList.includes('OWNER')) primaryRole = '⟡ OWNER';
  else if (rolesList.some((r) => r.includes('CO-OWNER') || r.includes('COOWNER'))) primaryRole = '◈ CO-OWNER';
  else if (isDealAdmin) primaryRole = '⟡ TRATO ADMIN';
  else if (rolesList.includes('ADMIN')) primaryRole = '✦ ADMINISTRADOR';

  let modalBio = targetBio;
  if (!modalBio) {
    if (primaryRole) {
      modalBio = `Staff Oficial: ${primaryRole}\nTratos: ${dealsCount} completados`;
    } else {
      modalBio = `Miembro de la Comunidad\nTratos: ${dealsCount} completados`;
    }
  }

  let trackName = options.musicTrack || null;
  if (!trackName) {
    if (isDealAdmin) {
      trackName = `⟡ Mediador Certificado ★ ${rating}/5.0 (${dealsCount} tratos)`;
    } else if (rolesList.includes('OWNER')) {
      trackName = dealsCount > 0
        ? `${communityName} — ${dealsCount} tratos completados`
        : `⟡ Staff Oficial (Owner)`;
    } else if (rolesList.some((r) => r.includes('CO-OWNER') || r.includes('COOWNER'))) {
      trackName = dealsCount > 0
        ? `◈ Co-Owner Oficial (${dealsCount} tratos)`
        : `◈ Co-Owner Oficial`;
    } else if (rolesList.includes('ADMIN') || rolesList.includes('ADMINISTRADOR')) {
      trackName = dealsCount > 0
        ? `✦ Administrador Oficial (${dealsCount} tratos)`
        : `✦ Administrador Oficial`;
    } else if (rolesList.includes('MOD') || rolesList.includes('MODERADOR')) {
      trackName = dealsCount > 0
        ? `▪ Moderador Oficial (${dealsCount} tratos)`
        : `▪ Moderador Oficial`;
    } else {
      trackName = `${communityName} — ${dealsCount} tratos completados`;
    }
  }

  const displayId = userId ? String(userId) : (target.displayId || 'No identificado');

  const cardBuffer = await generateTelegramProfileModal({
    name: firstName || 'Usuario',
    username: username,
    id: displayId,
    bio: modalBio,
    avatarBuffer: avatarBuffer,
    isOnline: isOnline,
    isVerified: isVerified,
    musicTrack: trackName,
    communityName: communityName,
    isBurned: isBurned,
    burnReason: null,
    dealsCount: dealsCount,
    role: primaryRole,
    rating: rating,
    totalRatings: totalRatings,
  });

  return {
    cardBuffer,
    userId,
    username,
    firstName,
    avatarBuffer,
    target: {
      ...target,
      userId,
      username,
      firstName,
      avatarBuffer,
    },
  };
}

module.exports = {
  downloadTelegramAvatar,
  generateUserCardBuffer,
};
