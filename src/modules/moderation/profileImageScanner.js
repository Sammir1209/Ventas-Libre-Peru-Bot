const config = require('../../config/env');
const db = require('../../database/postgres');
const { SYM } = require('../../config/constants');
const { escapeHtml, mentionFromData, normalizeUnicodeText } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');

// ══════
// ⟡ Módulo: Scanner Visual de Perfiles por Imagen (OCR & Vision Pipeline)
// Analiza capturas de perfiles de Telegram en cola para detectar estafadores
// ══════

// Modelos Gemini con soporte de visión multimodal
const VISION_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
];

/**
 * Cola asíncrona simple con concurrencia 1 para proteger la memoria RAM (512MB)
 */
class SimpleAsyncQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const { fn, resolve, reject } = this.queue.shift();
    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.isProcessing = false;
      this.processNext();
    }
  }
}

const scannerQueue = new SimpleAsyncQueue();

/**
 * Extrae texto e información del perfil mediante Gemini Vision
 */
async function extractProfileDataFromImage(imageBuffer, mimeType = 'image/jpeg') {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada.');
  }

  const base64Image = imageBuffer.toString('base64');

  const systemPrompt =
    'Eres un sistema experto de seguridad en Telegram encargado de analizar capturas de pantalla de perfiles y cabeceras de usuario. ' +
    'Tu objetivo es identificar el perfil, desofuscar y transcribir el nombre de usuario (incluso si usa caracteres Unicode especiales como negritas matemáticas, cursivas, fuentes góticas o símbolos, por ejemplo: 『 ༒ 𝙎𝙝𝙞𝙨𝙪𝙠𝙪 𝘽𝙋 ༒ 』 o 𝔃𝓮𝓻𝓸𝓖𝓱𝓸𝓼𝓽 o 𝐈𝐓𝐇𝐀𝐍𝐍𝐘). ' +
    'Devuelve EXCLUSIVAMENTE un JSON válido (sin formato markdown adicional ni bloques de código adicionales) con esta estructura exacta:\n' +
    '{\n' +
    '  "isTelegramProfile": true/false,\n' +
    '  "rawName": "nombre tal cual aparece con sus símbolos y tipografías",\n' +
    '  "normalizedName": "nombre traducido a caracteres ASCII estándar legibles",\n' +
    '  "username": "alias sin el @ o null si no se visualiza",\n' +
    '  "bio": "biografía o descripción si es visible",\n' +
    '  "status": "estado de conexión o última vez si es visible"\n' +
    '}';

  for (const model of VISION_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Analiza detalladamente esta imagen de Telegram y extrae los datos del perfil.',
              },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) continue;

      const data = await res.json();
      let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      // Limpiar posibles bloques ```json ... ```
      rawText = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(rawText);
      return parsed;
    } catch (err) {
      // Continuar con el siguiente modelo en caso de error
    }
  }

  return null;
}

/**
 * Procesa la imagen del perfil y responde con el diagnóstico de seguridad
 */
async function processProfileInspection(ctx, photoFileId) {
  return scannerQueue.enqueue(async () => {
    // Notificar acción
    await ctx.replyWithChatAction('typing');

    // 1. Obtener enlace de descarga de la foto
    const file = await ctx.api.getFile(photoFileId);
    if (!file || !file.file_path) {
      throw new Error('No se pudo acceder a la imagen en los servidores de Telegram.');
    }

    const token = ctx.api.token || config.BOT_TOKEN;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error('Error al descargar el archivo de la foto.');
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Extraer información mediante visión multimodal
    const profileInfo = await extractProfileDataFromImage(buffer, 'image/jpeg');

    if (!profileInfo || (!profileInfo.rawName && !profileInfo.username)) {
      return await ctx.reply(
        `⟡ <b>[RADAR VISUAL] ANÁLISIS DE IMAGEN</b>\n` +
        `──────\n\n` +
        `No se logró identificar con claridad una cabecera o perfil de Telegram en la captura enviada.\n` +
        `<i>Asegúrate de que el nombre o @ del perfil sea legible.</i>`,
        { parse_mode: 'HTML' }
      );
    }

    const rawName = profileInfo.rawName || 'Sin nombre detectado';
    const normalizedName = profileInfo.normalizedName || normalizeUnicodeText(rawName);
    const username = profileInfo.username ? profileInfo.username.replace(/^@/, '').trim().toLowerCase() : null;

    // 3. Cruzar contra la base de datos de estafadores
    let burnedRecord = null;

    if (username) {
      try {
        const qRes = await db.pool?.query(
          'SELECT * FROM burned_users WHERE LOWER(username) = LOWER($1) LIMIT 1',
          [username]
        );
        if (qRes && qRes.rows && qRes.rows.length > 0) {
          burnedRecord = qRes.rows[0];
        }
      } catch {}
    }

    if (!burnedRecord && normalizedName) {
      try {
        const cleanNoSpaces = normalizedName.replace(/[^a-z0-9]/g, '');
        if (cleanNoSpaces.length >= 4) {
          const qRes = await db.pool?.query(
            `SELECT * FROM burned_users 
             WHERE LOWER(first_name) ILIKE $1 
                OR REPLACE(LOWER(first_name), ' ', '') ILIKE $2 
             LIMIT 1`,
            [`%${normalizedName}%`, `%${cleanNoSpaces}%`]
          );
          if (qRes && qRes.rows && qRes.rows.length > 0) {
            burnedRecord = qRes.rows[0];
          }
        }
      } catch {}
    }

    // 4. RESPUESTA: ¿Está quemado?
    if (burnedRecord) {
      const burnText =
        `<b>🚨 [RADAR VISUAL] PERFIL DE ESTAFADOR DETECTADO EN CAPTURA 🚨</b>\n` +
        `──────\n\n` +
        `▸ <b>Nombre en Captura:</b> <code>${escapeHtml(rawName)}</code>\n` +
        `▸ <b>Nombre Traducido:</b> <code>${escapeHtml(normalizedName)}</code>\n` +
        `▸ <b>Alias (@):</b> ${username ? `@${escapeHtml(username)}` : '<i>Sin @ visible</i>'}\n` +
        `▸ <b>ID Fichado:</b> <code>${burnedRecord.user_id}</code>\n` +
        `▸ <b>Estado en Red:</b> ⊱ <code>LISTA NEGRA OFICIAL 🔴</code> ⊰\n` +
        `▸ <b>Motivo:</b> <i>${escapeHtml(burnedRecord.context || 'Estafa comprobada en la comunidad')}</i>\n\n` +
        `──────\n` +
        `🚫 <b>ADVERTENCIA DE SEGURIDAD:</b>\n` +
        `<i>La persona del perfil enviado está confirmada como <b>ESTAFADOR</b>. No envíes dinero ni continúes la conversación.</i>`;

      const kb = new InlineKeyboard();
      const burnChannelId = config.PUBLIC_BURN_CHANNEL_ID;
      if (burnChannelId) {
        const cleanChannel = String(burnChannelId).replace('-100', '');
        kb.url('🚨 Ver Canal de Quemados', `https://t.me/c/${cleanChannel}/1`).row();
      }
      kb.text('✖ Entendido', 'info_close');

      return await ctx.reply(burnText, {
        parse_mode: 'HTML',
        reply_parameters: { message_id: ctx.message.message_id },
        reply_markup: kb,
        link_preview_options: { is_disabled: true },
      });
    }

    // 5. RESPUESTA: Perfil Limpio / No Fichado
    const statusText = profileInfo.status ? `\n▸ <b>Última Conexión:</b> <i>${escapeHtml(profileInfo.status)}</i>` : '';
    const bioText = profileInfo.bio ? `\n▸ <b>Bio / Info:</b> <i>${escapeHtml(profileInfo.bio.slice(0, 100))}</i>` : '';

    const cleanText =
      `<b>⟡ [RADAR VISUAL] PERFIL ANALIZADO</b> ⊱ <code>DIAGNÓSTICO</code> ⊰\n` +
      `──────\n\n` +
      `▸ <b>Nombre en Captura:</b> <code>${escapeHtml(rawName)}</code>\n` +
      `▸ <b>Nombre Normalizado:</b> <code>${escapeHtml(normalizedName)}</code>\n` +
      `▸ <b>Alias (@):</b> ${username ? `@${escapeHtml(username)}` : '<i>Sin @ visible</i>'}` +
      statusText +
      bioText +
      `\n\n` +
      `▸ <b>Estado en Lista Negra:</b> <b>✓ LIMPIO</b> (Sin reportes activos)\n\n` +
      `──────\n` +
      `💡 <i>Para mayor seguridad, recuerda exigir siempre intermediario oficial (/trato).</i>`;

    const kb = new InlineKeyboard();
    if (username) {
      kb.text('👤 Consultar Perfil', `perfil_card_user:${username}`).row();
    }
    kb.text('✖ Cerrar', 'info_close');

    return await ctx.reply(cleanText, {
      parse_mode: 'HTML',
      reply_parameters: { message_id: ctx.message.message_id },
      reply_markup: kb,
      link_preview_options: { is_disabled: true },
    });
  });
}

/**
 * Registra listeners y comandos del Scanner Visual
 */
function register(bot) {
  // ── Comando /scanperfil, /verperfil [Respondiendo a una foto] ──
  bot.command(['scanperfil', 'verperfil', 'ocrperfil'], async (ctx) => {
    try {
      const reply = ctx.message?.reply_to_message;
      const photos = reply?.photo || ctx.message?.photo;

      if (!photos || photos.length === 0) {
        return await ctx.reply(
          `⟡ <b>RADAR VISUAL DE PERFILES</b>\n` +
          `──────\n\n` +
          `▸ <b>Uso:</b> Responde a una foto o captura de perfil con <code>/scanperfil</code>.\n` +
          `▸ <b>Función:</b> Extrae y desofusca tipografías Unicode y verifica si el usuario es estafador.`,
          { parse_mode: 'HTML' }
        );
      }

      const bestPhoto = photos[photos.length - 1];
      await processProfileInspection(ctx, bestPhoto.file_id);
    } catch (err) {
      console.error('⟡ Error en /scanperfil:', err.message);
      await ctx.reply(`⟡ Error al inspeccionar perfil: ${err.message}`);
    }
  });

  // ── Listener Automático: Detección cuando alguien envía foto preguntando por reputación ──
  bot.on('message:photo', async (ctx, next) => {
    try {
      const caption = (ctx.message?.caption || '').toLowerCase();
      const photos = ctx.message?.photo || [];

      // Palabras clave que indican consulta de reputación sobre una captura
      const isProfileInquiry =
        /(?:es\s+confiable|es\s+estafador|alguien\s+lo\s+conoce|alguien\s+conoce|quien\s+es|referencias|es\s+seguro|hicieron\s+trato|perfil|scam|quemado|fichado)/i.test(caption);

      if (isProfileInquiry && photos.length > 0) {
        const bestPhoto = photos[photos.length - 1];
        await processProfileInspection(ctx, bestPhoto.file_id);
        return;
      }
    } catch (err) {
      console.error('⟡ Error en message:photo profile scanner:', err.message);
    }

    return next();
  });
}

module.exports = {
  register,
  extractProfileDataFromImage,
  processProfileInspection,
  scannerQueue,
};
