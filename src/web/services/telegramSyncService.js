// ══════
// ⟡ Web Service: Sincronización en Tiempo Real con Telegram Bot API
// ══════

const https = require('https');
const config = require('../../config/env');

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 30,
  timeout: 5000,
});

function telegramApiCall(token, method, params = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(params);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/${method}`,
      method: 'POST',
      agent: httpsAgent,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.ok) {
            resolve(json.result);
          } else {
            reject(new Error(json.description || 'Error en llamada a Telegram API'));
          }
        } catch {
          reject(new Error('Respuesta inválida de Telegram'));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Timeout en llamada a Telegram API'));
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

/**
 * Consulta la información más reciente de un usuario en Telegram (Nombre, @username, avatar)
 */
async function syncUserWithTelegram(userId, botToken = config.BOT_TOKEN) {
  try {
    const chatInfo = await telegramApiCall(botToken, 'getChat', { chat_id: userId });
    
    let photoUrl = null;
    try {
      const photos = await telegramApiCall(botToken, 'getUserProfilePhotos', { user_id: userId, limit: 1 });
      if (photos && photos.total_count > 0 && photos.photos[0] && photos.photos[0].length > 0) {
        const fileId = photos.photos[0][0].file_id;
        const fileInfo = await telegramApiCall(botToken, 'getFile', { file_id: fileId });
        if (fileInfo && fileInfo.file_path) {
          photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`;
        }
      }
    } catch {
      // Ignorar fallo al obtener foto (cuenta privada)
    }

    return {
      success: true,
      userId: chatInfo.id,
      username: chatInfo.username || null,
      firstName: chatInfo.first_name || 'Sin nombre',
      lastName: chatInfo.last_name || null,
      bio: chatInfo.bio || null,
      photoUrl,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Valida un token de bot contra Telegram API (getMe)
 */
async function validateBotToken(token) {
  try {
    const botInfo = await telegramApiCall(token, 'getMe');
    return {
      valid: true,
      botInfo,
    };
  } catch (err) {
    return {
      valid: false,
      error: err.message,
    };
  }
}

module.exports = {
  telegramApiCall,
  syncUserWithTelegram,
  validateBotToken,
};
