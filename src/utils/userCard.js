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
 */
async function generateUserCardBuffer(api, target, options = {}) {
  let userId = target.userId && Number(target.userId) > 0 ? Number(target.userId) : null;
  let username = target.username || null;
  let firstName = target.firstName || target.name || null;
  let targetBio = target.bio || target.targetBio || null;
  let avatarBuffer = target.avatarBuffer || null;

  // 1. Si no hay userId o no hay avatar y tenemos username, intentar resolver vía MTProto Userbot
  if ((!userId || !avatarBuffer) && (username || userId)) {
    try {
      if (userbot.isConnected()) {
        const targetQuery = username || userId;
        const ubRes = await userbot.resolveUser(targetQuery);
        if (ubRes) {
          if (!userId && ubRes.userId) userId = ubRes.userId;
          if (!firstName && (ubRes.firstName || ubRes.lastName)) {
            firstName = [ubRes.firstName, ubRes.lastName].filter(Boolean).join(' ') || null;
          }
          if (!username && ubRes.username) username = ubRes.username;
        }

        if (!avatarBuffer) {
          avatarBuffer = await userbot.downloadProfilePhoto(targetQuery);
        }
      }
    } catch {}
  }

  // 2. Si tenemos userId numérico, consultar Telegram Bot API
  if (userId) {
    try {
      const chatInfo = await api.getChat(userId);
      if (!username && chatInfo.username) username = chatInfo.username;
      if (!firstName) firstName = [chatInfo.first_name, chatInfo.last_name].filter(Boolean).join(' ') || null;
      if (chatInfo.bio) targetBio = chatInfo.bio;
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

  // 3. Fallbacks de nombre
  if (!firstName) {
    if (username) firstName = `@${username}`;
    else if (userId) firstName = `ID ${userId}`;
    else firstName = target.name || 'Usuario';
  }

  // 4. Consultar roles, tratos, rating, antecedentes
  let rolesList = [];
  const effectiveOwners = options.ownerIds || config.OWNER_IDS || [];
  const tenantId = options.tenantId || null;

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

  let burnInfo = null;
  if (options.isBurned !== undefined) {
    if (options.isBurned) {
      burnInfo = { context: options.burnReason || 'Estafa comprobada / Falta grave' };
    }
  } else if (userId || username) {
    try {
      burnInfo = (userId ? await db.getBurnedUserInfo(userId) : null) || (username ? await db.getBurnedUserInfo(username) : null);
    } catch {}
  }

  const isBurned = !!burnInfo;

  let primaryRole = null;
  if (rolesList.includes('OWNER')) primaryRole = '👑 OWNER';
  else if (rolesList.some((r) => r.includes('CO-OWNER') || r.includes('COOWNER'))) primaryRole = '⚜️ CO-OWNER';
  else if (isDealAdmin) primaryRole = '🤝 TRATO ADMIN';
  else if (rolesList.includes('ADMIN')) primaryRole = '⚔️ ADMINISTRADOR';

  let modalBio = targetBio;
  if (!modalBio) {
    if (isBurned) {
      modalBio = `🚨 LISTA NEGRA: ${burnInfo.context || 'Estafa comprobada'}\nID: ${userId || target.displayId || 'No identificado'}`;
    } else if (primaryRole) {
      modalBio = `Staff Oficial: ${primaryRole}\nTratos: ${dealsCount} completados`;
    } else {
      modalBio = `Usuario de la Comunidad\nTratos: ${dealsCount} completados`;
    }
  }

  const cardBuffer = await generateTelegramProfileModal({
    name: firstName || 'Usuario',
    username: username,
    id: userId ? String(userId) : (target.displayId || 'No identificado'),
    bio: modalBio,
    avatarBuffer: avatarBuffer,
    isOnline: !isBurned,
    isVerified: isVerified,
    isBurned: isBurned,
    burnReason: isBurned ? (burnInfo.context || options.burnReason || 'Estafa comprobada') : null,
    dealsCount: dealsCount,
    role: primaryRole,
    rating: rating,
    totalRatings: totalRatings,
  });

  return { cardBuffer, userId, target };
}

module.exports = {
  downloadTelegramAvatar,
  generateUserCardBuffer,
};
