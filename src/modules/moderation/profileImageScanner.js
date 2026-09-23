const config = require('../../config/env');
const db = require('../../database/postgres');
const { SYM } = require('../../config/constants');
const { escapeHtml, mentionFromData, normalizeUnicodeText, getSuperscriptDate } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');
const userbot = require('../../userbot/client');
const { normalizeString } = require('./antiImpersonator');
const { buildUserProfile, buildUserProfileByUsername } = require('../info/handler');

// ══════
// ⟡ Módulo: Scanner Visual de Perfiles por Imagen (OCR & Vision Pipeline)
// Analiza capturas de perfiles de Telegram en cola para detectar estafadores
// ══════

// Modelos Gemini con soporte de visión multimodal activo y ordenados por velocidad
const VISION_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
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
  'Eres el Sistema Forense de Visión Artificial y OCR Especializado de "Ventas Libres Perú". ' +
  'Tu tarea es analizar minuciosamente capturas de pantalla de perfiles, tarjetas de usuario (User Info), cabeceras de chat, o capturas recortadas de Telegram.\n\n' +
  '⟡ PATRONES Y FORMAS VISUALES SOPORTADAS:\n' +
  '1. MODAL/DRAWER COMPLETO DE TELEGRAM ("User Info"):\n' +
  '   - Avatar circular superior con foto de perfil.\n' +
  '   - Nombre principal o alias debajo de la foto (ej: "svlla_x", "Carlos", "Zydhira", "『 ༒ 𝙎𝙝𝙞𝙨𝙪𝙠𝙪 𝘽𝙋 ༒ 』").\n' +
  '   - Estado de conexión ("last seen 2 minutes ago", "last seen recently", "últ. vez recientemente", "online", "en línea").\n' +
  '   - Fila de Username (@ icon o texto "Username" / "Nombre de usuario"): El alias público (ej: "@svlla_x", "zydhira", o nombres alfanuméricos).\n' +
  '   - Fila de Bio (icono i): Descripción del usuario, a menudo contiene enlaces a otros @usernames o canales.\n' +
  '   - Fila de Channel / Subscribers: Canales vinculados al usuario.\n\n' +
  '2. CABECERA RECORTADA / BARRA SUPERIOR DE CHAT:\n' +
  '   - Barra superior con avatar pequeño, nombre con fuentes unicode y debajo estado de conexión ("últ. vez recientemente").\n' +
  '   - Si el nombre en la barra superior o en el chat parece un username alfanumérico (ej: "zydhira"), extráelo también.\n\n' +
  '3. MENSAJES Y CITAS:\n' +
  '   - Mensajes reenviados ("Forwarded from / Reenviado de ...") con el nombre del remitente.\n\n' +
  '⟡ REGLAS CRÍTICAS DE OCR:\n' +
  '- DESOFUSCACIÓN: Traduce cualquier tipografía unicode o matemática (Fraktur, Script, Mathematical Bold/Italic, fuentes decorativas) a texto legible ASCII estándar.\n' +
  '- EXTRACCIÓN EXHAUSTIVA DE USERNAME (@):\n' +
  '  * Examina TODA la imagen: la fila con el icono de @, el texto con etiqueta "Nombre de usuario", "Username", "Alias", "t.me/...", o texto que empiece con @.\n' +
  '  * Si debajo del nombre o en la sección de información aparece un handle o alias (con o sin @), extráelo obligatoriamente en "username" (limpiando el símbolo @ y espacios).\n' +
  '  * Si no hay @ explícito pero el nombre de visualización es una sola palabra alfanumérica típica de alias (ej. "Zydhira", "cvttzz"), asígnala a "username" además de a "rawName".\n' +
  '- DETECCIÓN DE ID:\n' +
  '  * Si en la imagen se observa un ID numérico (ej: "ID: 123456789", "User ID: ...", "ID 123456789" o una secuencia de 7 a 11 dígitos identificando al usuario), extráelo como número entero en "detectedId".\n' +
  '- DETECCIÓN DE PERFIL: Si la imagen es una captura de perfil, modal de usuario o chat de Telegram, define "isTelegramProfile": true.\n\n' +
  'Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura:\n' +
  '{\n' +
  '  "isTelegramProfile": true,\n' +
  '  "rawName": "nombre tal cual aparece con sus símbolos y tipografías",\n' +
  '  "normalizedName": "nombre traducido a caracteres ASCII estándar legibles",\n' +
  '  "username": "alias sin el @ o null si no se visualiza",\n' +
  '  "bio": "biografía o descripción si es visible o null",\n' +
  '  "bioMentions": ["lista", "de", "menciones", "en", "bio"],\n' +
  '  "status": "estado de conexión o última vez si es visible o null",\n' +
  '  "detectedId": null\n' +
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
          signal: AbortSignal.timeout(16000),
          body: JSON.stringify(payload),
        });

        if (res.status === 429 || res.status === 503) {
          // Si hay congestión o rate limit, intentar de inmediato con el siguiente modelo de la lista
          continue;
        }
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error(`⟡ Gemini Vision [${model}] status ${res.status}:`, errText.slice(0, 200));
          continue;
        }

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const toParse = jsonMatch ? jsonMatch[0] : rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        return JSON.parse(toParse);
      } catch (err) {
        console.error(`⟡ Gemini Vision [${model}] exception:`, err.message);
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
async function processProfileInspection(ctx, photoFileId, { isExplicitInquiry = false } = {}) {
  return scannerQueue.enqueue(async () => {
    // Notificar acción si fue consulta explícita
    if (isExplicitInquiry) {
      await ctx.replyWithChatAction('typing').catch(() => {});
    }

    // 1. Obtener enlace de descarga de la foto
    const file = await ctx.api.getFile(photoFileId);
    if (!file || !file.file_path) {
      if (isExplicitInquiry) {
        throw new Error('No se pudo acceder a la imagen en los servidores de Telegram.');
      }
      return;
    }

    const token = ctx.api.token || config.BOT_TOKEN;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    const res = await fetch(downloadUrl);
    if (!res.ok) {
      if (isExplicitInquiry) {
        throw new Error('Error al descargar el archivo de la foto.');
      }
      return;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Extraer información mediante visión multimodal
    const profileInfo = await extractProfileDataFromImage(buffer, 'image/jpeg');

    if (!profileInfo || (!profileInfo.rawName && !profileInfo.username) || !profileInfo.isTelegramProfile) {
      if (isExplicitInquiry) {
        return await ctx.reply(
          `⟡ <b>[RADAR VISUAL] ANÁLISIS DE IMAGEN</b>\n` +
          `──────\n\n` +
          `No se logró identificar con claridad una cabecera o perfil de Telegram en la captura enviada.\n` +
          `<i>Asegúrate de que el nombre o @ del perfil sea legible.</i>`,
          { parse_mode: 'HTML' }
        );
      }
      return;
    }

    const rawName = profileInfo.rawName || 'Sin nombre detectado';
    const normalizedName = profileInfo.normalizedName || normalizeUnicodeText(rawName);
    const username = profileInfo.username ? profileInfo.username.replace(/^@/, '').trim().toLowerCase() : null;
    const tenantId = ctx.tenant?.id || null;

    // 3. Resolución en caliente con Agent Bot (Userbot MTProto)
    let resolvedUser = null;
    if (username && userbot.isConnected()) {
      try {
        resolvedUser = await userbot.resolveUser(username);
        if (resolvedUser && resolvedUser.userId) {
          db.upsertUser(resolvedUser.userId, resolvedUser.username || username, resolvedUser.firstName).catch(() => {});
        }
      } catch (err) {
        console.warn('⟡ Scanner Userbot resolve error:', err.message);
      }
    }

    // 4. Búsqueda Comunitaria y Agent Bot si no se resolvió o no había @ visible
    let communityMatch = null;
    const rawTokens = (normalizedName || rawName)
      .split(/[\s|/\\_•\-\[\]\(\)\{\}\.,:;!¡?¿]+/g)
      .map(w => w.trim())
      .filter(w => w.length >= 3 && !/^(bot|admin|mod|user|ap|perfil|grupo|the)$/i.test(w));

    const searchTerms = Array.from(new Set([
      (normalizedName || '').trim(),
      (rawName || '').trim(),
      ...rawTokens,
    ])).filter(t => t && t.length >= 3);

    if (!resolvedUser && searchTerms.length > 0) {
      // 4.1 Búsqueda en Base de Datos Postgres (con y sin tenant)
      for (const term of searchTerms) {
        try {
          let candidates = await db.searchUsers(term, tenantId);
          if (!candidates || candidates.length === 0) {
            candidates = await db.searchUsers(term, null);
          }
          if (candidates && candidates.length > 0) {
            communityMatch = candidates[0];
            break;
          }
        } catch {}
      }

      // 4.2 Búsqueda mediante Agent Bot (Userbot MTProto) en la comunidad y global
      if (!communityMatch && userbot.isConnected()) {
        for (const term of searchTerms) {
          try {
            const ubUsers = await userbot.searchCommunityUsers(term);
            if (ubUsers && ubUsers.length > 0) {
              communityMatch = ubUsers[0];
              break;
            }
          } catch {}
        }
      }
    }

    // 4.3 Si se encontró coincidencia por el Agent Bot, resolver perfil completo en caliente
    if (communityMatch && userbot.isConnected() && !resolvedUser) {
      try {
        const toResolve = communityMatch.username || communityMatch.user_id;
        if (toResolve) {
          resolvedUser = await userbot.resolveUser(toResolve);
          if (resolvedUser && resolvedUser.userId) {
            db.upsertUser(resolvedUser.userId, resolvedUser.username || communityMatch.username, resolvedUser.firstName || communityMatch.first_name).catch(() => {});
          }
        }
      } catch {}
    }

    const targetId = resolvedUser?.userId || profileInfo.detectedId || communityMatch?.user_id || null;
    const effectiveUsername = username || (resolvedUser?.username ? resolvedUser.username.toLowerCase() : (communityMatch?.username ? communityMatch.username.toLowerCase() : null));

    // 5. Comprobar presencia física en grupos oficiales de la comunidad
    let detectedGroupName = null;
    if (targetId) {
      try {
        const groups = await db.getAllGroups(tenantId).catch(() => []);
        for (const grp of groups) {
          if (!grp.chat_id) continue;
          try {
            const member = await ctx.api.getChatMember(grp.chat_id, targetId);
            if (['member', 'administrator', 'creator', 'restricted'].includes(member.status)) {
              detectedGroupName = grp.title || 'Grupo Oficial';
              break;
            }
          } catch {}
        }
      } catch {}
    }

    // 6. Verificación en Lista Negra (GBan / Estafadores Fichados)
    let burnedRecord = null;
    if (targetId) {
      try {
        burnedRecord = await db.getBurnedUserInfo(targetId);
      } catch {}
    }

    if (!burnedRecord && effectiveUsername) {
      try {
        burnedRecord = await db.getBurnedUserInfo(effectiveUsername);
      } catch {}
    }

    if (!burnedRecord && typeof db.findBurnedUserFlexible === 'function') {
      try {
        burnedRecord = await db.findBurnedUserFlexible({ username: effectiveUsername, normalizedName, rawName });
      } catch {}
    }

    // 7. Verificación de Suplantación de Staff (Anti-Impersonator)
    let isOfficialStaff = false;
    let isStaffCloneAlert = false;
    let imitatedStaffName = null;

    try {
      const staffList = await db.getAllStaff(tenantId).catch(() => []);
      for (const staff of staffList) {
        if (targetId && Number(staff.user_id) === Number(targetId)) {
          isOfficialStaff = true;
          break;
        }
        if (effectiveUsername && staff.username && staff.username.toLowerCase() === effectiveUsername.toLowerCase()) {
          isOfficialStaff = true;
          break;
        }

        const staffNorm = normalizeString(staff.first_name || '');
        const targetNorm = normalizeString(normalizedName || '');
        if (staffNorm.length >= 4 && targetNorm.length >= 4) {
          if (staffNorm === targetNorm || targetNorm.includes(staffNorm)) {
            isStaffCloneAlert = true;
            imitatedStaffName = staff.first_name;
            break;
          }
        }
      }
    } catch {}

    // ══════════════════════════════════════════════════
    // ⟡ RESPUESTA ESTÉTICA Y CONCISA (FORMATO /INFO)
    // ══════════════════════════════════════════════════

    let profileResult = null;
    if (targetId) {
      profileResult = await buildUserProfile(ctx, {
        userId: targetId,
        username: effectiveUsername,
        firstName: resolvedUser?.firstName || communityMatch?.first_name || normalizedName || rawName,
      });
    } else if (effectiveUsername) {
      profileResult = await buildUserProfileByUsername(ctx, effectiveUsername);
    } else {
      const botLabel = ctx.tenant?.community_name || 'VENTAS LIBRES PERÚ';
      const dateFormatted = getSuperscriptDate();
      const fallbackText =
        `<b>⟡ [${escapeHtml(botLabel)} BOT] PERFIL DE USUARIO</b>\n` +
        `──────\n\n` +
        `👤 <b>Nombre:</b> ${escapeHtml(normalizedName || rawName)}\n` +
        `🆔 <b>ID:</b> <i>No detectado</i>\n` +
        `🔍 <b>User:</b> <i>Sin @ visible</i>\n` +
        `💼 <b>Rol:</b> Usuario\n` +
        `🔗 <b>Link de perfil:</b> <i>No disponible</i>\n\n` +
        `──────\n` +
        `${dateFormatted}`;
      profileResult = { text: fallbackText, keyboard: null };
    }

    let { text: outputText, keyboard: outputKb } = profileResult;

    // Alerta de suplantación de staff o estafador si corresponde
    if (isStaffCloneAlert) {
      outputText =
        `⚠️ <b>ALERTA DE SUPLANTACIÓN DE IDENTIDAD</b> ⚠️\n` +
        `<i>Este usuario imita el nombre del Administrador <b>${escapeHtml(imitatedStaffName)}</b> pero no cuenta con el ID verificado del Staff.</i>\n\n` +
        outputText;
    } else if (burnedRecord) {
      outputText =
        `🚨 <b>[LISTA NEGRA] ESTAFADOR IDENTIFICADO</b> 🚨\n` +
        `<i>El perfil capturado corresponde a un <b>ESTAFADOR CONFIRMADO</b> (GBan activo). No envíes dinero ni realices tratos.</i>\n\n` +
        outputText;
    }

    const replyOptions = {
      parse_mode: 'HTML',
      reply_parameters: { message_id: ctx.message.message_id },
      link_preview_options: { is_disabled: true },
    };
    if (outputKb && outputKb.inline_keyboard && outputKb.inline_keyboard.length > 0) {
      replyOptions.reply_markup = outputKb;
    }

    return await ctx.reply(outputText, replyOptions);
  });
}

const PROFILE_INQUIRY_REGEX =
  /(?:conoce|conosen|conocen|ubica|ubican|sabe|saben|alguien|qui[eé]n|refe|referencia|confiable|fiar|seguro|estafa|scam|quemad|fichad|perfil|user|trato|fake|clon|legal|cuenta|info|averigua|revisa|checa|fichaje|opiniones)/i;

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
      await processProfileInspection(ctx, bestPhoto.file_id, { isExplicitInquiry: true });
    } catch (err) {
      console.error('⟡ Error en /scanperfil:', err.message);
      await ctx.reply(`⟡ Error al inspeccionar perfil: ${err.message}`);
    }
  });

  // ── Listener Automático: Detección cuando alguien envía foto (con o sin consulta) ──
  bot.on('message:photo', async (ctx, next) => {
    try {
      const caption = (ctx.message?.caption || '').trim();
      const photos = ctx.message?.photo || [];
      if (photos.length === 0) return next();

      const isPrivate = ctx.chat?.type === 'private';
      const isExplicitInquiry = PROFILE_INQUIRY_REGEX.test(caption) || isPrivate;
      const shouldScan = isExplicitInquiry || caption.length <= 35;

      if (shouldScan) {
        const bestPhoto = photos[photos.length - 1];
        await processProfileInspection(ctx, bestPhoto.file_id, { isExplicitInquiry });
        return;
      }
    } catch (err) {
      console.error('⟡ Error en message:photo profile scanner:', err.message);
    }

    return next();
  });

  // ── Listener Automático: Detección cuando alguien responde a una foto preguntando reputación ──
  bot.on('message:text', async (ctx, next) => {
    try {
      const reply = ctx.message?.reply_to_message;
      if (reply && reply.photo && reply.photo.length > 0) {
        const text = (ctx.message?.text || '').trim();
        if (PROFILE_INQUIRY_REGEX.test(text)) {
          const bestPhoto = reply.photo[reply.photo.length - 1];
          await processProfileInspection(ctx, bestPhoto.file_id, { isExplicitInquiry: true });
          return;
        }
      }
    } catch (err) {
      console.error('⟡ Error en message:text reply profile scanner:', err.message);
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
