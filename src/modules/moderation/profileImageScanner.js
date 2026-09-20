const config = require('../../config/env');
const db = require('../../database/postgres');
const { SYM } = require('../../config/constants');
const { escapeHtml, mentionFromData, normalizeUnicodeText } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');

// ══════
// ⟡ Módulo: Scanner Visual de Perfiles por Imagen (OCR & Vision Pipeline)
// Analiza capturas de perfiles de Telegram en cola para detectar estafadores
// ══════

// Modelos Gemini con soporte de visión multimodal activo
const VISION_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
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

const GROQ_VISION_MODELS = [
  'llama-3.2-11b-vision-preview',
  'llama-3.2-90b-vision-preview',
];

const OPENROUTER_VISION_MODELS = [
  'qwen/qwen-2.5-vl-72b-instruct:free',
  'meta-llama/llama-3.2-11b-vision-instruct:free',
  'google/gemini-2.0-flash-lite-preview-02-05:free',
];

const VISION_SYSTEM_PROMPT =
  'Eres un sistema experto de seguridad en Telegram. ' +
  'Tu objetivo es analizar capturas de pantalla de perfiles, tarjetas de usuario, cabeceras recortadas (como una barra superior de chat con el nombre y última vez) o menciones de usuarios en Telegram. ' +
  'Debes identificar, desofuscar y transcribir el nombre de usuario (incluso si usa caracteres Unicode especiales como negritas matemáticas, cursivas, fuentes góticas o símbolos, por ejemplo: ✦ AP | ZeroGhost | ITHANNY 💳 o 『 ༒ 𝙎𝙝𝙞𝙨𝙪𝙠𝙪 𝘽𝙋 ༒ 』 o 𝔃𝓮𝓻𝓸𝓖𝓱𝓸𝓼𝓽). ' +
  'Devuelve EXCLUSIVAMENTE un objeto JSON con esta estructura exacta:\n' +
  '{\n' +
  '  "isTelegramProfile": true,\n' +
  '  "rawName": "nombre tal cual aparece con sus símbolos y tipografías",\n' +
  '  "normalizedName": "nombre traducido a caracteres ASCII estándar legibles",\n' +
  '  "username": "alias sin el @ o null si no se visualiza",\n' +
  '  "bio": "biografía o descripción si es visible o null",\n' +
  '  "status": "estado de conexión o última vez si es visible o null"\n' +
  '}';

/**
 * Extracción vía Groq LPU Vision (Ultrarrápido ~300ms)
 */
async function extractWithGroqVision(base64Image, mimeType = 'image/jpeg') {
  const groqKeys = config.GROQ_API_KEYS.length > 0 ? config.GROQ_API_KEYS : (config.GROQ_API_KEY ? [config.GROQ_API_KEY] : []);
  if (groqKeys.length === 0) return null;

  for (const key of groqKeys) {
    for (const model of GROQ_VISION_MODELS) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          signal: AbortSignal.timeout(6000),
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: VISION_SYSTEM_PROMPT + '\nAnaliza la imagen del perfil:' },
                  {
                    type: 'image_url',
                    image_url: { url: `data:${mimeType};base64,${base64Image}` },
                  },
                ],
              },
            ],
            temperature: 0.1,
            max_tokens: 800,
          }),
        });

        if (!res.ok) continue;

        const data = await res.json();
        let rawText = data?.choices?.[0]?.message?.content;
        if (!rawText) continue;

        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const toParse = jsonMatch ? jsonMatch[0] : rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        return JSON.parse(toParse);
      } catch (err) {
        // Continuar al siguiente modelo o proveedor
      }
    }
  }

  return null;
}

/**
 * Extracción vía Google Gemini Multimodal Vision con rotación de claves
 */
async function extractWithGeminiVision(base64Image, mimeType = 'image/jpeg') {
  const geminiKeys = config.GEMINI_API_KEYS.length > 0 ? config.GEMINI_API_KEYS : (config.GEMINI_API_KEY ? [config.GEMINI_API_KEY] : []);
  if (geminiKeys.length === 0) return null;

  for (const key of geminiKeys) {
    for (const model of VISION_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const payload = {
          systemInstruction: {
            parts: [{ text: VISION_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: 'user',
              parts: [
                { text: 'Analiza detalladamente esta captura de Telegram y extrae los datos del perfil o cabecera.' },
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
            responseMimeType: 'application/json',
            maxOutputTokens: 1000,
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify(payload),
        });

        if (res.status === 429) break;
        if (!res.ok) continue;

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const toParse = jsonMatch ? jsonMatch[0] : rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        return JSON.parse(toParse);
      } catch (err) {
        // Continuar al siguiente intento
      }
    }
  }

  return null;
}

/**
 * Extracción vía OpenRouter Free Vision (Qwen2.5-VL / Llama 3.2 Vision)
 */
async function extractWithOpenRouterVision(base64Image, mimeType = 'image/jpeg') {
  const apiKey = config.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  for (const model of OPENROUTER_VISION_MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://ventas-libre-peru.com',
          'X-Title': 'Ventas Libres Peru Bot',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: VISION_SYSTEM_PROMPT + '\nAnaliza la imagen del perfil:' },
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${base64Image}` },
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 800,
        }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      let rawText = data?.choices?.[0]?.message?.content;
      if (!rawText) continue;

      rawText = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      return JSON.parse(rawText);
    } catch (err) {
      // Continuar al siguiente modelo
    }
  }

  return null;
}

/**
 * Extrae texto e información del perfil mediante cascada multi-proveedor:
 * 1. Groq Vision (Ultra-rápido ~300ms)
 * 2. Gemini Vision (Preciso con rotación de claves)
 * 3. OpenRouter Free Vision (Respaldo)
 */
async function extractProfileDataFromImage(imageBuffer, mimeType = 'image/jpeg') {
  const base64Image = imageBuffer.toString('base64');

  // 1. Probar con Google Gemini Multimodal Vision (Alta precisión y soporte activo)
  try {
    const geminiResult = await extractWithGeminiVision(base64Image, mimeType);
    if (geminiResult && (geminiResult.rawName || geminiResult.username || geminiResult.normalizedName)) {
      return geminiResult;
    }
  } catch {}

  // 2. Probar con OpenRouter Free Vision (Qwen2.5-VL / Llama 3.2 Vision)
  try {
    const openRouterResult = await extractWithOpenRouterVision(base64Image, mimeType);
    if (openRouterResult && (openRouterResult.rawName || openRouterResult.username || openRouterResult.normalizedName)) {
      return openRouterResult;
    }
  } catch {}

  // 3. Probar con Groq Vision si está disponible
  try {
    const groqResult = await extractWithGroqVision(base64Image, mimeType);
    if (groqResult && (groqResult.rawName || groqResult.username || groqResult.normalizedName)) {
      return groqResult;
    }
  } catch {}

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

    // 3. Cruzar contra la base de datos de estafadores (Soporte Supabase REST + PostgreSQL Directo)
    let burnedRecord = null;

    try {
      if (typeof db.findBurnedUserFlexible === 'function') {
        burnedRecord = await db.findBurnedUserFlexible({ username, normalizedName, rawName });
      }
    } catch {}

    if (!burnedRecord && username) {
      try {
        if (typeof db.getBurnedUserInfo === 'function') {
          burnedRecord = await db.getBurnedUserInfo(username);
        }
      } catch {}
    }

    if (!burnedRecord && db.pool) {
      try {
        if (username) {
          const qRes = await db.pool.query(
            'SELECT * FROM burned_users WHERE LOWER(username) = LOWER($1) LIMIT 1',
            [username]
          );
          if (qRes?.rows?.length > 0) burnedRecord = qRes.rows[0];
        }

        if (!burnedRecord && normalizedName) {
          const cleanNoSpaces = normalizedName.replace(/[^a-z0-9]/g, '');
          if (cleanNoSpaces.length >= 4) {
            const qRes = await db.pool.query(
              `SELECT * FROM burned_users 
               WHERE LOWER(first_name) ILIKE $1 
                  OR REPLACE(LOWER(first_name), ' ', '') ILIKE $2 
               LIMIT 1`,
              [`%${normalizedName}%`, `%${cleanNoSpaces}%`]
            );
            if (qRes?.rows?.length > 0) burnedRecord = qRes.rows[0];
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
