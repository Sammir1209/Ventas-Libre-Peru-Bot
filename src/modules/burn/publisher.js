const https = require('https');
const { InputFile, InputMediaBuilder } = require('grammy');
const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const { escapeHtml } = require('../../utils/formatting');
const { delay } = require('../../utils/helpers');
const { generateTelegramProfileModal } = require('../../utils/telegramProfileModal');
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

    // 3. Formatear datos legibles
    const hasNumericId = targetId && targetId > 0;
    const displayId = hasNumericId ? String(targetId) : 'No identificado';
    const displayName = targetName || (targetUsername ? `@${targetUsername}` : 'Estafador');

    // 4. Generar Tarjeta Visual Modal de Telegram
    let cardBuffer;
    try {
      cardBuffer = await generateTelegramProfileModal({
        name: displayName,
        username: targetUsername,
        id: displayId,
        bio: `🚨 LISTA NEGRA: ${cleanContext.slice(0, 75)}\nID: ${displayId}`,
        avatarBuffer: avatarBuffer,
        isOnline: false,
        isBurned: true,
        burnReason: cleanContext || 'Estafa comprobada / Falta grave',
      });
    } catch (cardErr) {
      console.error('⟡ Error generando banner modal de quemado:', cardErr.message);
    }

    // 5. Generar Leyenda / Caption con diseño estético uniforme
    const idLine = hasNumericId
      ? `🆔 <b>ID de Telegram:</b> <code>${targetId}</code>\n\n`
      : `🆔 <b>ID de Telegram:</b> <i>Identificado por @alias oficial</i>\n\n`;

    const userLine = targetUsername
      ? `🔗 <b>Username:</b> @${escapeHtml(targetUsername)}\n`
      : '';

    const publicCaption =
      `${SYM.DIVIDER}\n` +
      `🚨 <b>NUEVO ESTAFADOR QUEMADO Y REGISTRADO</b> 🚨\n` +
      `${SYM.DIVIDER}\n\n` +
      `👤 <b>Nombre / Alias:</b> <b>${escapeHtml(displayName)}</b>\n` +
      userLine +
      idLine +
      `📝 <b>Motivo / Hechos:</b>\n` +
      `<i>${escapeHtml(cleanContext || 'Estafa comprobada')}</i>\n\n` +
      `${SYM.THIN_LINE}\n` +
      `⚖️ <b>Sanción:</b> Baneo Permanente y Registro en Lista Negra Oficial.\n` +
      `🛡️ <i>Ventas Libres Perú — Tu seguridad es nuestra prioridad.</i>`;

    // 6. Recopilar todos los destinos (Grupos + Canales oficiales + Canal de quemados)
    const destinations = new Map();

    const groups = await db.getAllGroups();
    for (const g of groups) {
      if (g && g.chat_id) {
        destinations.set(Number(g.chat_id), {
          chatId: Number(g.chat_id),
          title: g.title || `Chat ${g.chat_id}`,
          type: g.type || 'group',
          threadId: null,
        });
      }
    }

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
    if (pubChannel) {
      const cId = Number(pubChannel);
      destinations.set(cId, {
        chatId: cId,
        title: 'Canal Oficial de Quemados',
        type: 'channel',
        threadId: pubThread ? Number(pubThread) : null,
      });
    }

    // 7. Preparar pruebas
    const proofFileIds = Array.isArray(report.proof_file_ids) ? report.proof_file_ids.slice(0, 9) : [];
    const hasProofs = proofFileIds.length > 0;

    let cardFileId = null;
    let broadcastCount = 0;

    for (const dest of destinations.values()) {
      try {
        const extraOpts = dest.threadId ? { message_thread_id: Number(dest.threadId) } : {};

        if (cardBuffer) {
          const photoPayload = cardFileId || new InputFile(cardBuffer, 'perfil_estafador.png');

          if (hasProofs) {
            const media = [
              InputMediaBuilder.photo(photoPayload, { caption: publicCaption, parse_mode: 'HTML' }),
              ...proofFileIds.map((fId) => InputMediaBuilder.photo(fId)),
            ];
            const msgs = await api.sendMediaGroup(dest.chatId, media, extraOpts);
            if (!cardFileId && msgs && msgs.length > 0 && msgs[0].photo) {
              const p = msgs[0].photo;
              cardFileId = p[p.length - 1].file_id;
            }
          } else {
            const msg = await api.sendPhoto(dest.chatId, photoPayload, {
              caption: publicCaption,
              parse_mode: 'HTML',
              ...extraOpts,
            });
            if (!cardFileId && msg && msg.photo) {
              const p = msg.photo;
              cardFileId = p[p.length - 1].file_id;
            }
          }
        } else {
          // Fallback a mensaje de texto si no hubo buffer
          await api.sendMessage(dest.chatId, publicCaption, {
            parse_mode: 'HTML',
            ...extraOpts,
          });
        }

        broadcastCount++;
        console.log(`⟡ Quemado publicado con éxito en: ${dest.title} (${dest.chatId})`);
      } catch (postErr) {
        console.warn(`⟡ Error enviando multimedia a ${dest.title} (${dest.chatId}), intentando texto:`, postErr.message);
        try {
          await api.sendMessage(dest.chatId, publicCaption, {
            parse_mode: 'HTML',
            ...(dest.threadId ? { message_thread_id: Number(dest.threadId) } : {}),
          });
          broadcastCount++;
        } catch (txtErr) {
          console.error(`⟡ Falló el envío en ${dest.title} (${dest.chatId}):`, txtErr.message);
        }
      }

      await delay(400);
    }

    return {
      success: true,
      broadcastCount,
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
