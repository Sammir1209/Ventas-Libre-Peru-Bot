const https = require('https');
const { InputFile, InputMediaBuilder } = require('grammy');
const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const { escapeHtml } = require('../../utils/formatting');
const { delay } = require('../../utils/helpers');
const { generateUserCardBuffer } = require('../../utils/userCard');
const userbot = require('../../userbot/client');

/**
 * Descarga una foto de perfil de Telegram a Buffer
 */
async function downloadTelegramFile(api, fileId) {
  try {
    const file = await api.getFile(fileId);
    const filePath = file.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${filePath}`;

    return new Promise((resolve, reject) => {
      https.get(downloadUrl, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  } catch {
    return null;
  }
}

/**
 * Extrae metadatos del acusado a partir del reporte
 */
function extractTargetInfo(report) {
  let targetId = Number(report.target_id) || 0;
  let targetUsername = report.target_username || null;
  let targetName = report.target_name || null;
  let cleanContext = report.context || '';

  // 1. Revisar cabecera [ACUSADO: @username | Name]
  const tagMatch = cleanContext.match(/^\[ACUSADO:\s*@?([a-zA-Z0-9_]+)(?:\s*\|\s*([^\]]+))?\]\s*\n?/i);
  if (tagMatch) {
    targetUsername = tagMatch[1];
    if (tagMatch[2]) targetName = tagMatch[2].trim();
    cleanContext = cleanContext.replace(tagMatch[0], '').trim();
  }

  // 2. Si no hay username, buscar @username mencionados en el texto
  if (!targetUsername) {
    const userMatches = cleanContext.match(/@[a-zA-Z0-9_]{3,32}/g);
    if (userMatches && userMatches.length > 0) {
      targetUsername = userMatches[0].replace(/^@/, '');
    }
  }

  return { targetId, targetUsername, targetName, cleanContext };
}

/**
 * Publica la alerta de estafador quemado con diseño de banner modal nativo
 * y álbum de pruebas en TODOS los canales y grupos oficiales registrados.
 */
async function publishBurnAlert(api, report) {
  try {
    let { targetId, targetUsername, targetName, cleanContext } = extractTargetInfo(report);
    let avatarBuffer = null;

    // 1. Intentar resolver usuario vía Userbot MTProto si no tiene ID numérico
    if ((!targetId || targetId === 0) && targetUsername) {
      try {
        if (userbot.isConnected()) {
          const ubRes = await userbot.resolveUser(targetUsername);
          if (ubRes && ubRes.userId) {
            targetId = ubRes.userId;
            const ubName = [ubRes.firstName, ubRes.lastName].filter(Boolean).join(' ');
            if (ubName) targetName = ubName;
            if (ubRes.username) targetUsername = ubRes.username;
          }
        }
      } catch (ubErr) {
        console.warn('⟡ Userbot resolveUser aviso:', ubErr.message);
      }
    }

    // 2. Si tiene ID numérico, buscar info en Telegram Bot API
    if (targetId && targetId > 0) {
      try {
        const chatInfo = await api.getChat(targetId);
        const tgName = [chatInfo.first_name, chatInfo.last_name].filter(Boolean).join(' ');
        if (tgName && (!targetName || targetName === 'Estafador')) targetName = tgName;
        if (chatInfo.username) targetUsername = chatInfo.username;
      } catch {}

      try {
        const userPhotos = await api.getUserProfilePhotos(targetId, { limit: 1 });
        if (userPhotos && userPhotos.total_count > 0) {
          const largestPhoto = userPhotos.photos[0][userPhotos.photos[0].length - 1];
          avatarBuffer = await downloadTelegramFile(api, largestPhoto.file_id);
        }
      } catch {}
    }

    // 1. Generar Tarjeta Visual idéntica al comando /perfil (Azul pizarra, aro cyan, online, NO ROJA)
    // El bot y el userbot verifican y resuelven tanto el @ como el ID numérico y descargan el avatar real.
    let cardBuffer = null;
    try {
      const res = await generateUserCardBuffer(api, {
        userId: targetId || null,
        username: targetUsername || null,
        firstName: targetName,
      }, {
        isBurned: false, // El usuario no quiere el tema rojo, sino la tarjeta limpia idéntica a /perfil
      });
      cardBuffer = res.cardBuffer;
      if (res.userId) targetId = res.userId;
      if (res.username) targetUsername = res.username;
      if (res.firstName) targetName = res.firstName;
    } catch (cardErr) {
      console.error('⟡ Error generando tarjeta modal de perfil:', cardErr.message);
    }

    // 2. Formatear datos legibles finales
    const hasNumericId = targetId && targetId > 0;
    const displayName = targetName || (targetUsername ? `@${targetUsername}` : 'Estafador');

    // 3. Generar Leyenda / Caption con diseño estético uniforme
    const idLine = hasNumericId
      ? `▸ <b>ID de Telegram:</b> <code>${targetId}</code>\n\n`
      : `▸ <b>ID de Telegram:</b> <i>Identificado por @alias oficial</i>\n\n`;

    const userLine = targetUsername
      ? `▸ <b>Username:</b> @${escapeHtml(targetUsername)}\n`
      : '';

    const publicCaption =
      `${SYM.DIVIDER}\n` +
      `⟡ <b>[ LISTA NEGRA OFICIAL ] ESTAFADOR QUEMADO Y REGISTRADO</b> ⟡\n` +
      `${SYM.DIVIDER}\n\n` +
      `▸ <b>Nombre / Alias:</b> <b>${escapeHtml(displayName)}</b>\n` +
      userLine +
      idLine +
      `▸ <b>Motivo / Hechos:</b>\n` +
      `<i>${escapeHtml(cleanContext || 'Estafa comprobada')}</i>\n\n` +
      `${SYM.THIN_LINE}\n` +
      `▸ <b>Sanción:</b> Baneo Permanente y Registro en Lista Negra Oficial.\n` +
      `▪ <i>Ventas Libres Perú — Tu seguridad es nuestra prioridad.</i>`;

    // 6. Destino Exclusivo: Canal Oficial de Quemados (@quemando_ventaslibreperu)
    let pubChannel = config.PUBLIC_BURN_CHANNEL_ID;
    let pubThread = config.PUBLIC_BURN_THREAD_ID;
    if (!pubChannel) {
      try {
        const savedChan = await db.getSetting('public_burn_channel_id');
        if (savedChan) pubChannel = Number(savedChan);
        const savedTh = await db.getSetting('public_burn_thread_id');
        if (savedTh) pubThread = Number(savedTh);
      } catch {}
    }

    // Fallback: Si no está en config, buscar el canal de quemados en official_groups
    if (!pubChannel) {
      try {
        const groups = await db.getAllGroups();
        const quemandoGroup = groups.find(
          (g) => (g.username && g.username.toLowerCase().includes('quemando')) ||
                 (g.title && g.title.toLowerCase().includes('quemando'))
        );
        if (quemandoGroup) pubChannel = Number(quemandoGroup.chat_id);
      } catch {}
    }

    if (!pubChannel) {
      throw new Error('No se ha configurado el Canal Oficial de Quemados (PUBLIC_BURN_CHANNEL_ID).');
    }

    const targetChannelId = Number(pubChannel);
    const extraOpts = pubThread ? { message_thread_id: Number(pubThread) } : {};

    // 7. Preparar pruebas fotográficas
    const proofFileIds = Array.isArray(report.proof_file_ids) ? report.proof_file_ids.slice(0, 9) : [];
    const hasProofs = proofFileIds.length > 0;

    try {
      if (cardBuffer) {
        const photoPayload = new InputFile(cardBuffer, 'perfil_estafador.png');

        if (hasProofs) {
          const media = [
            InputMediaBuilder.photo(photoPayload, { caption: publicCaption, parse_mode: 'HTML' }),
            ...proofFileIds.map((fId) => InputMediaBuilder.photo(fId)),
          ];
          await api.sendMediaGroup(targetChannelId, media, extraOpts);
        } else {
          await api.sendPhoto(targetChannelId, photoPayload, {
            caption: publicCaption,
            parse_mode: 'HTML',
            ...extraOpts,
          });
        }
      } else {
        // Fallback a mensaje de texto si no hubo buffer
        await api.sendMessage(targetChannelId, publicCaption, {
          parse_mode: 'HTML',
          ...extraOpts,
        });
      }

      console.log(`⟡ Quemado publicado con éxito en Canal de Quemados (${targetChannelId})`);
    } catch (postErr) {
      console.warn(`⟡ Error enviando multimedia al canal (${targetChannelId}), intentando texto:`, postErr.message);
      await api.sendMessage(targetChannelId, publicCaption, {
        parse_mode: 'HTML',
        ...extraOpts,
      });
    }

    return {
      success: true,
      broadcastCount: 1,
      targetChannelId,
      targetId,
      targetUsername,
      displayName,
    };
  } catch (err) {
    console.error('⟡ Error general en publishBurnAlert:', err);
    throw err;
  }
}

module.exports = {
  extractTargetInfo,
  publishBurnAlert,
};
