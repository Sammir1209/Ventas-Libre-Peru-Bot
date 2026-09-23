const config = require('../../config/env');
const db = require('../../database/postgres');
const { SYM } = require('../../config/constants');
const { escapeHtml, mentionFromData, normalizeUnicodeText, getSuperscriptDate } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');
const userbot = require('../../userbot/client');
const { normalizeString } = require('./antiImpersonator');
const { buildUserProfile, buildUserProfileByUsername } = require('../info/handler');
const Tesseract = require('tesseract.js');

// ══════
// ⟡ Módulo: Scanner Visual de Perfiles por Imagen (OCR & Vision Pipeline)
// Analiza capturas de perfiles de Telegram en cola para detectar estafadores
// ══════

// Modelos Gemini con soporte de visión multimodal activo y ordenados por velocidad
const VISION_MODELS = [
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
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
  '  * Si la captura solo muestra la tarjeta superior recortada con foto y nombre (ej. modal "User Info") pero NO se observa fila de @ ni ID numérico, define estrictamente "username": null y "detectedId": null. NO inventes ningún username.\n' +
  '  * Solo si el nombre de visualización es estrictamente una sola palabra simple alfanumérica sin espacios ni adornos (ej. "cvttzz"), asígnala como posible alias. Si tiene adornos, flechas o espacios (ej. "╰─➤ 『𝑷𝑷𝑴』Madres..."), "username" DEBE ser null obligatoriamente.\n' +
  '- DETECCIÓN DE ID:\n' +
  '  * Si en la imagen se observa un ID numérico (ej: "ID: 123456789", "User ID: ...", "ID 123456789" o una secuencia de 7 a 11 dígitos identificando al usuario), extráelo como número entero en "detectedId".\n' +
  '- DETECCIÓN DE PERFIL: Toda captura que contenga un nombre de usuario, alias, avatar, cabecera de chat o modal de Telegram (incluso si está recortada o solo muestra el nombre y estado de conexión como "en línea", "online", "últ. vez"), define SIEMPRE "isTelegramProfile": true.\n\n' +
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
 * Extracción vía OCR Local (Tesseract.js) sin IA, costo cero y sin límites de cuota.
 * Normaliza fuentes Unicode y extrae Username (@), ID o nombres para búsqueda directa con Userbot.
 */
async function extractWithLocalOCR(imageBuffer) {
  try {
    const { data } = await Tesseract.recognize(imageBuffer, 'eng');
    const rawText = data?.text || '';
    if (!rawText || rawText.trim().length < 3) return null;

    // Normalizar fuentes decorativas, góticas y unicode a ASCII
    const normalizedText = normalizeUnicodeText(rawText);

    // 1. Detectar ID numérico explícito (ej: ID: 123456789, User ID: 123456789)
    let detectedId = null;
    const idMatch = normalizedText.match(/(?:id|user\s*id|uid)[\s:;#]*([0-9]{6,14})/i);
    if (idMatch) {
      detectedId = Number(idMatch[1]);
    } else {
      // Buscar secuencia aislada de dígitos que parezca un ID de Telegram (8-11 dígitos)
      const standaloneIdMatch = normalizedText.match(/\b([0-9]{8,11})\b/);
      if (standaloneIdMatch) {
        detectedId = Number(standaloneIdMatch[1]);
      }
    }

    // 2. Detectar @username explícito (filtrando bots y texto del sistema)
    let username = null;
    const usernameMatch = normalizedText.match(/@([a-zA-Z0-9_]{3,32})/);
    if (usernameMatch) {
      const u = usernameMatch[1];
      if (!/^(?:bot|admin|ventas_libres|ventaslibre|photo|message|comunidad|channel|user)$/i.test(u)) {
        username = u;
      }
    }
    if (!username) {
      const tmeMatch = normalizedText.match(/(?:t\.me\/|username[\s:;]+|usuario[\s:;]+)([a-zA-Z0-9_]{3,32})/i);
      if (tmeMatch) {
        const u = tmeMatch[1];
        if (!/^(?:bot|admin|ventas_libres|ventaslibre|photo|message|comunidad|channel|user)$/i.test(u)) {
          username = u;
        }
      }
    }

    // 3. Extraer posible nombre de perfil de las primeras líneas legibles
    const lines = normalizedText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    let rawName = null;
    for (const line of lines) {
      // Omitir líneas de estado, horas, batería o iconos de sistema
      if (/^(?:online|en\s*l[iíì1l]nea|last\s*seen|[uú]lt\.?\s*vez|username|info|bio|id\b|user\s*info)/i.test(line)) continue;
      if (line.length >= 2 && line.length <= 60 && !line.startsWith('@')) {
        rawName = line;
        break;
      }
    }

    const isTelegramProfile = !!(
      username ||
      detectedId ||
      /(?:last\s*seen|[uú]lt\.?\s*vez|online|en\s*l[iíì1l]nea|info|bio|user\s*info)/i.test(normalizedText)
    );

    if (username || detectedId || rawName) {
      return {
        isTelegramProfile: true,
        rawName: rawName || username || 'Usuario',
        normalizedName: rawName ? normalizeString(rawName) : (username || 'Usuario'),
        username: username || null,
        detectedId: detectedId || null,
        bio: null,
        isFromLocalOCR: true,
      };
    }
  } catch (err) {
    console.warn('⟡ Local OCR (Tesseract): Fallback por error:', err.message);
  }
  return null;
}

/**
 * Extrae texto e información del perfil mediante arquitectura concurrente ultra-rápida:
 * 1. Dispara en paralelo OCR Local (Tesseract) y Gemini Vision (3.5-Flash).
 * 2. Si Local OCR detecta @username o ID primero (<1.5s), devuelve inmediatamente con costo 0.
 * 3. Si Gemini Vision completa primero con perfil enriquecido, devuelve inmediatamente.
 * 4. Respaldo secundario: OpenRouter Free Vision si Gemini reporta congestión.
 */
async function extractProfileDataFromImage(imageBuffer, mimeType = 'image/jpeg') {
  const base64Image = imageBuffer.toString('base64');

  // Promesa de OCR Local (ultra-rápido para @ y IDs en memoria)
  const localPromise = (async () => {
    try {
      const res = await extractWithLocalOCR(imageBuffer);
      if (res && (res.username || res.detectedId)) {
        return res;
      }
    } catch {}
    return null;
  })();

  // Promesa de Visión Multimodal (Gemini 3.5 Flash ultrarrápido y preciso)
  const visionPromise = (async () => {
    try {
      const res = await extractWithGeminiVision(base64Image, mimeType);
      if (res && (res.rawName || res.username || res.normalizedName)) {
        return res;
      }
    } catch {}
    return null;
  })();

  // Carrera inteligente: El primero que obtenga un resultado concluyente resuelve
  const earlyResult = await Promise.race([
    localPromise.then((r) => (r ? r : new Promise(() => {}))),
    visionPromise.then((r) => (r ? r : new Promise(() => {}))),
    new Promise((resolve) => setTimeout(() => resolve(null), 6000)),
  ]);

  if (earlyResult) {
    return earlyResult;
  }

  // Si ninguno resolvió en carrera temprana, esperar la promesa de visión
  const fallbackVision = await visionPromise;
  if (fallbackVision) return fallbackVision;

  // Respaldo secundario con OpenRouter Free Vision
  try {
    const openRouterResult = await extractWithOpenRouterVision(base64Image, mimeType);
    if (openRouterResult && (openRouterResult.rawName || openRouterResult.username || openRouterResult.normalizedName)) {
      return openRouterResult;
    }
  } catch {}

  return null;
}

// Lista de tags de clanes / equipos y palabras comunes que no identifican a un usuario único
const GENERIC_CLAN_TAGS = new Set([
  'ppm', 'wb', 'vip', 'vlp', 'ap', 'cw', 'hq', 'bp', 'rdp', 'cmpe',
  'shieldgram', 'new', 'clan', 'team', 'oficial', 'bot', 'admin', 'mod',
  'dev', 'user', 'the', 'perfil', 'grupo', 'comunidad', 'shisuku', 'whiteblack',
  'bloodcipher', 'lozychk'
]);

/**
 * Tokeniza un nombre limpiando caracteres de adorno y devuelve tokens normalizados
 */
function extractNameTokens(name) {
  if (!name || typeof name !== 'string') return [];
  const norm = normalizeUnicodeText(name).toLowerCase();
  return norm
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
}

/**
 * Evalúa con precisión matemática la similitud entre un candidato y el nombre capturado.
 * Evita emparejamientos erróneos por compartir un clan tag común (como PPM).
 */
function scoreCandidateMatch(candidate, targetRawName, targetNormalizedName) {
  const candName = candidate.first_name || '';
  const candUser = candidate.username || '';
  if (!candName && !candUser) return 0;

  const targetTokens = extractNameTokens(targetNormalizedName || targetRawName);
  const candTokens = extractNameTokens(candName);
  const candUserTokens = extractNameTokens(candUser);

  // Palabras distintivas del objetivo (excluyendo tags de clan)
  const distinctiveTarget = targetTokens.filter((t) => !GENERIC_CLAN_TAGS.has(t) && t.length >= 3);
  const clanTarget = targetTokens.filter((t) => GENERIC_CLAN_TAGS.has(t));

  const allCandTokens = [...candTokens, ...candUserTokens];

  let score = 0;

  // 1. Coincidencias de palabras distintivas (ej: "madres")
  let matchedDistinctiveCount = 0;
  for (const dt of distinctiveTarget) {
    const isMatched = allCandTokens.some((ct) => ct === dt || ct.startsWith(dt) || dt.startsWith(ct));
    if (isMatched) {
      matchedDistinctiveCount++;
      score += 45;
    }
  }

  // Si había palabras distintivas en el target pero NINGUNA coincide, descartar inmediatamente
  if (distinctiveTarget.length > 0 && matchedDistinctiveCount === 0) {
    return 0; // Rechazado: es un miembro diferente del mismo clan
  }

  // 2. Coincidencia de clan tag (solo si también coinciden palabras distintivas)
  for (const ct of clanTarget) {
    if (allCandTokens.includes(ct)) {
      score += 15;
    }
  }

  // 3. Penalización por palabras clave en conflicto en el candidato (ej: "NEW NEW")
  const candDistinctive = candTokens.filter((t) => !GENERIC_CLAN_TAGS.has(t) && t.length >= 3);
  for (const cdt of candDistinctive) {
    const appearsInTarget = distinctiveTarget.some((dt) => dt === cdt || dt.startsWith(cdt) || cdt.startsWith(dt));
    if (!appearsInTarget) {
      score -= 20;
    }
  }

  // 4. Coincidencia de nombre exacto o substring largo
  const cleanTargetNorm = (targetNormalizedName || targetRawName).toLowerCase().replace(/[^\w]/g, '');
  const cleanCandNorm = candName.toLowerCase().replace(/[^\w]/g, '');
  if (cleanTargetNorm.length >= 5 && cleanCandNorm.length >= 5) {
    if (cleanTargetNorm === cleanCandNorm) {
      score += 50;
    } else if (cleanTargetNorm.includes(cleanCandNorm) || cleanCandNorm.includes(cleanTargetNorm)) {
      score += 30;
    }
  }

  return Math.max(0, score);
}

/**
 * Procesa la imagen del perfil y responde con el diagnóstico de seguridad
 */
async function processProfileInspection(ctx, photoFileId, { isExplicitInquiry = false } = {}) {
  // ⟡ Retroalimentación visual inmediata: Mensaje de revisión en proceso
  let statusMsg = null;
  try {
    statusMsg = await ctx.reply(
      `🔍 <b>[RADAR VISUAL]</b> <i>Revisando perfil y verificando antecedentes...</i>`,
      {
        parse_mode: 'HTML',
        reply_parameters: { message_id: ctx.message.message_id },
        link_preview_options: { is_disabled: true },
      }
    );
  } catch {}

  return scannerQueue.enqueue(async () => {
    // Notificar acción en el chat
    await ctx.replyWithChatAction('typing').catch(() => {});

    // 1. Obtener enlace de descarga de la foto
    const file = await ctx.api.getFile(photoFileId);
    if (!file || !file.file_path) {
      if (statusMsg) {
        if (isExplicitInquiry) {
          await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '❌ No se pudo acceder a la imagen en los servidores de Telegram.').catch(() => {});
        } else {
          await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        }
      }
      return;
    }

    const token = ctx.api.token || config.BOT_TOKEN;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    const res = await fetch(downloadUrl);
    if (!res.ok) {
      if (statusMsg) {
        if (isExplicitInquiry) {
          await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '❌ Error al descargar el archivo de la foto.').catch(() => {});
        } else {
          await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        }
      }
      return;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Extraer información mediante visión multimodal y OCR Local
    const profileInfo = await extractProfileDataFromImage(buffer, 'image/jpeg');

    const hasIdentifier = !!(profileInfo && (profileInfo.rawName || profileInfo.username || profileInfo.detectedId));

    if (!profileInfo || !hasIdentifier) {
      if (statusMsg) {
        if (isExplicitInquiry) {
          return await ctx.api.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            `⟡ <b>[RADAR VISUAL] ANÁLISIS DE IMAGEN</b>\n` +
            `──────\n\n` +
            `No se logró identificar con claridad un nombre o perfil de Telegram en la captura enviada.\n` +
            `<i>Asegúrate de que el nombre o @ del perfil sea legible.</i>`,
            { parse_mode: 'HTML' }
          ).catch(() => {});
        } else {
          // Si fue una foto genérica no explícita, borrar el aviso de revisión silenciosamente
          return await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        }
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

    // 4. Búsqueda Comunitaria Inteligente y Agent Bot con Filtro de Clanes
    let communityMatch = null;

    if (!resolvedUser) {
      // 4.1 Tokenizar y separar palabras distintivas de clan tags (ej: PPM, VIP, etc.)
      const rawTokens = (normalizedName || rawName)
        .split(/[\s|/\\_•\-\[\]\(\)\{\}\.,:;!¡?¿]+/g)
        .map((w) => w.trim())
        .filter((w) => w.length >= 3 && !/^(bot|admin|mod|user|ap|perfil|grupo|the)$/i.test(w));

      const distinctiveTokens = rawTokens.filter((t) => !GENERIC_CLAN_TAGS.has(t.toLowerCase()));

      // Priorizar palabras distintivas primero (ej: "Madres" antes que "PPM")
      const searchTerms = Array.from(new Set([
        ...distinctiveTokens,
        (normalizedName || '').trim(),
        (rawName || '').trim(),
        ...rawTokens,
      ])).filter((t) => t && t.length >= 3);

      const candidatePool = new Map();

      // 4.2 Recolectar candidatos en Postgres
      for (const term of searchTerms) {
        try {
          let list = await db.searchUsers(term, tenantId);
          if (!list || list.length === 0) {
            list = await db.searchUsers(term, null);
          }
          if (list && list.length > 0) {
            for (const cand of list) {
              const cid = cand.user_id || cand.id;
              if (cid && !candidatePool.has(cid)) {
                candidatePool.set(cid, {
                  user_id: cid,
                  username: cand.username || null,
                  first_name: cand.first_name || '',
                });
              }
            }
          }
        } catch {}
      }

      // 4.3 Recolectar candidatos vía Agent Bot (Userbot MTProto)
      if (userbot.isConnected() && candidatePool.size < 8) {
        for (const term of searchTerms) {
          try {
            const ubUsers = await userbot.searchCommunityUsers(term);
            if (ubUsers && ubUsers.length > 0) {
              for (const cand of ubUsers) {
                const cid = cand.user_id || cand.id;
                if (cid && !candidatePool.has(cid)) {
                  candidatePool.set(cid, {
                    user_id: cid,
                    username: cand.username || null,
                    first_name: cand.first_name || '',
                  });
                }
              }
            }
          } catch {}
        }
      }

      // 4.4 Puntuar y clasificar todos los candidatos para evitar falsos positivos
      if (candidatePool.size > 0) {
        let bestCandidate = null;
        let highestScore = 0;

        for (const cand of candidatePool.values()) {
          const score = scoreCandidateMatch(cand, rawName, normalizedName);
          if (score > highestScore) {
            highestScore = score;
            bestCandidate = cand;
          }
        }

        // Solo aceptar si la similitud supera el umbral de seguridad (score >= 50)
        if (bestCandidate && highestScore >= 50) {
          communityMatch = bestCandidate;
        }
      }
    }

    // 4.5 Si se encontró coincidencia por el Agent Bot, resolver perfil completo en caliente
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

    // 7. Verificación de Staff Oficial y Detección Estricta de Cuentas Clones
    let isOfficialStaff = false;
    let isStaffCloneAlert = false;
    let imitatedStaff = null;
    let matchedStaffNameOnly = null;

    try {
      const staffList = await db.getAllStaff(tenantId).catch(() => []);
      for (const staff of staffList) {
        const isMatchingId = targetId && Number(staff.user_id) === Number(targetId);
        const isMatchingUser = effectiveUsername && staff.username && staff.username.toLowerCase() === effectiveUsername.toLowerCase();

        // Si coincide con el ID o @username oficial: Es Staff Oficial
        if (isMatchingId || isMatchingUser) {
          isOfficialStaff = true;
          imitatedStaff = staff;
          break;
        }

        // Comparar similitud de nombre
        const staffNorm = normalizeString(staff.first_name || '');
        const targetNorm = normalizeString(normalizedName || rawName || '');
        if (staffNorm.length >= 4 && targetNorm.length >= 4 && (staffNorm === targetNorm || targetNorm.includes(staffNorm) || staffNorm.includes(targetNorm))) {
          // Solo alertar de clon si la captura MUESTRA un @ o un ID que NO corresponde al verdadero Staff
          if (targetId || effectiveUsername) {
            isStaffCloneAlert = true;
            imitatedStaff = staff;
            break;
          } else {
            // Si la captura no muestra @ ni ID, omitir falsa alarma y reconocer nombre de Staff
            matchedStaffNameOnly = staff;
          }
        }
      }
    } catch {}

    // ══════════════════════════════════════════════════
    // ⟡ VEREDICTO DE LISTA NEGRA Y ANTECEDENTES EN BD
    // ══════════════════════════════════════════════════

    const botLabel = ctx.tenant?.community_name || 'Ventas Libres Perú';
    const dateFormatted = getSuperscriptDate();
    let outputText = '';
    const kb = new InlineKeyboard();

    if (burnedRecord) {
      const dateRaw = burnedRecord.burned_at || burnedRecord.created_at;
      const dateStr = dateRaw
        ? new Date(dateRaw).toLocaleString('es-PE', {
            timeZone: 'America/Lima',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
        : 'Fecha no registrada';

      outputText =
        `🚨 <b>[ LISTA NEGRA OFICIAL ] ESTAFADOR IDENTIFICADO</b> 🚨\n` +
        `──────\n\n` +
        `👤 <b>Identificado como:</b> ${escapeHtml(burnedRecord.raw_name || rawName || 'Desconocido')}\n` +
        `🆔 <b>ID Fichado:</b> <code>${burnedRecord.user_id || targetId || 'No registrado'}</code>\n` +
        `🔍 <b>Alias / @:</b> ${burnedRecord.username ? `@${escapeHtml(burnedRecord.username)}` : (effectiveUsername ? `@${escapeHtml(effectiveUsername)}` : '<i>Sin @ registrado</i>')}\n` +
        `⚖️ <b>Estado:</b> ⊱ <code>QUEMADO / ESTAFADOR [ SANCIONADO ]</code> ⊰\n` +
        `📅 <b>Fecha:</b> <code>${dateStr}</code>\n` +
        `📋 <b>Motivo / Hechos:</b>\n  ↳ <i>${escapeHtml(burnedRecord.context || 'Reporte de estafa confirmado')}</i>\n` +
        `👮 <b>Reportado por:</b> <code>${escapeHtml(burnedRecord.reported_by || 'Staff')}</code>\n\n` +
        `──────\n` +
        `🚫 <b>ADVERTENCIA DE SEGURIDAD:</b>\n` +
        `<i>No realices transferencias, pagos ni entregas con este usuario bajo ninguna circunstancia.</i>\n\n` +
        `${dateFormatted}`;

      if (targetId) {
        kb.text('Perfil', `info_view_card:${targetId}`).primary();
      } else if (effectiveUsername) {
        kb.text('Perfil', `info_view_card_user:${effectiveUsername}`).primary();
      }
      if (config.PUBLIC_BURN_CHANNEL_ID) {
        const cleanChannel = String(config.PUBLIC_BURN_CHANNEL_ID).replace('-100', '');
        kb.row().url('🚨 Ver Canal de Quemados', `https://t.me/c/${cleanChannel}/1`).danger();
      }

    } else if (isStaffCloneAlert && imitatedStaff) {
      outputText =
        `🚨 <b>[ALERTA CRÍTICA] CUENTA CLON DE ESTAFADOR</b> 🚨\n` +
        `──────\n\n` +
        `⚠️ <i>El perfil de la captura imita el nombre del Administrador <b>${escapeHtml(imitatedStaff.first_name)}</b>, pero su ID o @username no corresponde al Staff oficial (@${escapeHtml(imitatedStaff.username || '')}).</i>\n\n` +
        `👤 <b>Nombre usado:</b> ${escapeHtml(rawName || normalizedName)}\n` +
        `🆔 <b>ID en captura:</b> <code>${targetId || 'No visible'}</code>\n` +
        `🔍 <b>User en captura:</b> ${effectiveUsername ? `@${escapeHtml(effectiveUsername)}` : '<i>Sin @ visible</i>'}\n` +
        `🛡️ <b>Staff Real:</b> <code>${escapeHtml(imitatedStaff.first_name)}</code> (@${escapeHtml(imitatedStaff.username || '')})\n\n` +
        `──────\n` +
        `🚫 <b>¡PELIGRO: ES UN ESTAFADOR SUPLANTANDO IDENTIDAD!</b>\n` +
        `<i>No envíes dinero ni entregues cuentas a este clon.</i>\n\n` +
        `${dateFormatted}`;

      if (targetId) {
        kb.text('Perfil', `info_view_card:${targetId}`).primary().text('Verificar', `info_check_burn:${targetId}`).success();
      } else if (effectiveUsername) {
        kb.text('Perfil', `info_view_card_user:${effectiveUsername}`).primary().text('Verificar', `info_check_burn_user:${effectiveUsername}`).success();
      }

    } else if (isOfficialStaff && imitatedStaff) {
      outputText =
        `🛡️ <b>[VERIFICACIÓN OFICIAL] STAFF DE LA RED</b>\n` +
        `──────\n\n` +
        `👤 <b>Nombre:</b> ${escapeHtml(imitatedStaff.first_name || rawName)}\n` +
        `🆔 <b>ID:</b> <code>${imitatedStaff.user_id}</code>\n` +
        `🔍 <b>User:</b> @${escapeHtml(imitatedStaff.username || 'Oficial')}\n` +
        `💼 <b>Rango:</b> <code>${escapeHtml(imitatedStaff.role || 'ADMIN')} OFICIAL</code>\n` +
        `👥 <b>Comunidad:</b> <code>${escapeHtml(botLabel)}</code>\n` +
        `⚖️ <b>Estado en BD:</b> ⊱ <code>OFICIAL [ VERIFICADO ]</code> ⊰\n\n` +
        `──────\n` +
        `✓ <i>Este usuario es miembro legítimo y verificado del Staff Oficial. No registra antecedentes de estafa.</i>\n\n` +
        `${dateFormatted}`;

      kb.text('Perfil', `info_view_card:${imitatedStaff.user_id}`).primary().text('Verificar', `info_check_burn:${imitatedStaff.user_id}`).success();

    } else {
      // USUARIO LIMPIO / SIN ANTECEDENTES
      let staffNotice = '';
      if (matchedStaffNameOnly) {
        staffNotice =
          `\n🛡️ <b>[AVISO DE VERIFICACIÓN]</b>\n` +
          `<i>Este nombre coincide con el del Administrador <b>${escapeHtml(matchedStaffNameOnly.first_name)}</b>. Para confirmar que es él y no una copia, verifica que su @ sea <b>@${escapeHtml(matchedStaffNameOnly.username || '')}</b> o su ID sea <code>${matchedStaffNameOnly.user_id}</code>.</i>\n`;
      }

      outputText =
        `✅ <b>[RADAR DE SEGURIDAD] SIN ANTECEDENTES DE ESTAFA</b>\n` +
        `──────\n\n` +
        `👤 <b>Usuario en Captura:</b> ${escapeHtml(rawName || normalizedName)}\n` +
        `🆔 <b>ID:</b> ${targetId ? `<code>${targetId}</code>` : '<i>No visible en captura</i>'}\n` +
        `🔍 <b>User:</b> ${effectiveUsername ? `@${escapeHtml(effectiveUsername)}` : '<i>Sin @ visible</i>'}\n` +
        `🛡️ <b>Estado en Base de Datos:</b> ⊱ <code>LIMPIO [ VERIFICADO ]</code> ⊰\n` +
        staffNotice +
        `\n──────\n` +
        `✓ <i>El usuario analizado NO figura en la lista negra oficial de estafadores ni reportes de quemados.</i>\n` +
        (!targetId && !effectiveUsername ? `\n💡 <i>Para mayor seguridad y verificar su ID exacto, envía una captura donde se visualice su @username o desliza hacia abajo en el perfil.</i>\n\n` : `\n`) +
        `${dateFormatted}`;

      if (targetId) {
        kb.text('Perfil', `info_view_card:${targetId}`).primary().text('Verificar', `info_check_burn:${targetId}`).success();
      } else if (effectiveUsername) {
        kb.text('Perfil', `info_view_card_user:${effectiveUsername}`).primary().text('Verificar', `info_check_burn_user:${effectiveUsername}`).success();
      }
    }

    const outputKb = (kb.inline_keyboard && kb.inline_keyboard.length > 0) ? kb : null;

    // ⟡ Si existe statusMsg, editar el mensaje en el mismo lugar para fluidez visual
    if (statusMsg) {
      try {
        const editOptions = {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        };
        if (outputKb) {
          editOptions.reply_markup = outputKb;
        }
        return await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, outputText, editOptions);
      } catch {
        // Si editMessageText falla por alguna restricción de Telegram, borrar statusMsg y enviar como reply
        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
      }
    }

    const replyOptions = {
      parse_mode: 'HTML',
      reply_parameters: { message_id: ctx.message.message_id },
      link_preview_options: { is_disabled: true },
    };
    if (outputKb) {
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
