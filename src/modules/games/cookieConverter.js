// ══════════════════════════════════════════════════════════
// 【 VENTAS LIBRES PERÚ 】 ⟡ MOTOR CONVERTIDOR DE COOKIES & ASISTENTE
//   Estandarización Estética Oriental: Cero Emojis // Tipografía Bold
//   Formatos: Netscape HTTP ⇄ Cookie-Editor JSON ⇄ Header String
// ══════════════════════════════════════════════════════════

const { InlineKeyboard, InputFile } = require('grammy');
const db = require('../../database/postgres');
const { escapeHtml, getSuperscriptDate } = require('../../utils/formatting');
const { btn, toMathBold } = require('../../utils/aesthetic');

// Enlaces oficiales de herramientas de importación
const COOKIE_EDITOR_CHROME_URL = 'https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm';
const KIWI_BROWSER_PLAYSTORE_URL = 'https://play.google.com/store/apps/details?id=com.kiwibrowser.browser';

/**
 * Convierte cookies en formato Netscape HTTP a formato JSON nativo para Cookie-Editor.
 * @param {string} rawText - Contenido del archivo o texto de cookies.
 * @returns {Array<Object>} Array de cookies en formato Cookie-Editor.
 */
function netscapeToJson(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const lines = rawText.split('\n');
  const cookies = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith('#') && !line.startsWith('#HttpOnly_')) continue;

    let isHttpOnly = false;
    if (line.startsWith('#HttpOnly_')) {
      isHttpOnly = true;
      line = line.replace('#HttpOnly_', '');
    }

    const parts = line.split('\t');
    if (parts.length >= 7) {
      const domain = parts[0];
      const hostOnly = parts[1].toLowerCase() === 'true';
      const path = parts[2];
      const secure = parts[3].toLowerCase() === 'true';
      let expiry = parseInt(parts[4], 10);
      if (expiry > 1000000000000) {
        expiry = Math.floor(expiry / 1000);
      }
      const name = parts[5];
      const value = parts.slice(6).join('\t');

      cookies.push({
        domain,
        expirationDate: isNaN(expiry) ? undefined : expiry,
        hostOnly,
        httpOnly: isHttpOnly,
        name,
        path,
        sameSite: 'no_restriction',
        secure,
        session: false,
        storeId: '0',
        value,
      });
    }
  }

  return cookies;
}

/**
 * Convierte un array JSON de Cookie-Editor a formato texto Netscape HTTP Cookie File.
 * @param {Array<Object>} jsonArray - Array de cookies.
 * @returns {string} Texto Netscape estándar.
 */
function jsonToNetscape(jsonArray) {
  if (!Array.isArray(jsonArray)) return '';
  let out = '# Netscape HTTP Cookie File\n# Convertido por Ventas Libres Perú Bot\n\n';

  for (const c of jsonArray) {
    if (!c.domain || !c.name) continue;
    const httpOnlyPrefix = c.httpOnly ? '#HttpOnly_' : '';
    const domain = `${httpOnlyPrefix}${c.domain}`;
    const flag = c.hostOnly ? 'TRUE' : 'FALSE';
    const path = c.path || '/';
    const secure = c.secure ? 'TRUE' : 'FALSE';
    const expiration = c.expirationDate ? Math.floor(c.expirationDate) : 0;
    const name = c.name;
    const value = c.value || '';

    out += `${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${name}\t${value}\n`;
  }

  return out;
}

/**
 * Convierte una cadena de headers HTTP (name=val; name2=val2) a formato Cookie-Editor.
 */
function headerToJson(headerText, defaultDomain = '.primevideo.com') {
  if (!headerText || typeof headerText !== 'string') return [];
  const pairs = headerText.split(';');
  const cookies = [];

  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const name = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();

    cookies.push({
      domain: defaultDomain,
      expirationDate: Math.floor(Date.now() / 1000) + 86400 * 365,
      hostOnly: false,
      httpOnly: false,
      name,
      path: '/',
      sameSite: 'no_restriction',
      secure: true,
      session: false,
      storeId: '0',
      value,
    });
  }

  return cookies;
}

/**
 * Detecta el formato predominante de un texto de cookies.
 */
function detectCookieFormat(rawText) {
  if (!rawText) return 'EMPTY';
  const trimmed = rawText.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      JSON.parse(trimmed);
      return 'JSON';
    } catch {}
  }
  if (trimmed.includes('\t') && (trimmed.includes('TRUE') || trimmed.includes('FALSE') || trimmed.includes('# Netscape'))) {
    return 'NETSCAPE';
  }
  if (trimmed.includes('=') && trimmed.includes(';')) {
    return 'HEADER';
  }
  return 'NETSCAPE';
}

/**
 * Obtiene la URL de la plataforma según la categoría o título.
 */
function getPlatformUrl(category = '', title = '') {
  const c = `${category} ${title}`.toLowerCase();
  if (c.includes('youtube')) return 'https://www.youtube.com';
  if (c.includes('prime') || c.includes('amazon')) return 'https://www.primevideo.com';
  if (c.includes('netflix')) return 'https://www.netflix.com';
  if (c.includes('disney')) return 'https://www.disneyplus.com';
  if (c.includes('max') || c.includes('hbo')) return 'https://www.max.com';
  return 'https://www.primevideo.com';
}

/**
 * Renderiza el Hub interactivo del Convertidor de Cookies (Cero Emojis).
 */
function renderConverterHubCard(reward, cookiesCount, originalFormat) {
  const dateFormatted = getSuperscriptDate();
  const title = escapeHtml(reward.account_title || reward.category || 'Cuenta Premium');
  const cat = escapeHtml(reward.category || 'STREAMING');

  return (
    `<b>【 𝗩𝗘𝗡𝗧𝗔𝗦 𝗟𝗜𝗕𝗥𝗘𝗦 𝗣𝗘𝗥𝗨 】 ⟡ 「 𝗖𝗢𝗡𝗩𝗘𝗥𝗧𝗜𝗗𝗢𝗥 𝗗𝗘 𝗖𝗢𝗢𝗞𝗜𝗘𝗦 」</b>\n` +
    `────── // ───\n\n` +
    `▸ <b>Cuenta Ganada:</b> <code>${title}</code>\n` +
    `▸ <b>Categoría:</b> <code>〔 ${cat} 〕</code>\n` +
    `▸ <b>Formato Origen:</b> <code>${originalFormat}</code>\n` +
    `▸ <b>Cookies Detectadas:</b> <code>${cookiesCount} cookies válidas ✓</code>\n\n` +
    `<b>〔 OPCIONES DE CONVERSIÓN Y ACCESO 〕</b>\n` +
    `  • <b>Obtener JSON:</b> Genera el bloque de código para copiarlo con 1 toque en tu celular.\n` +
    `  • <b>Descargar .json:</b> Archivo listo para importar en Cookie-Editor.\n` +
    `  • <b>Tutorial Móvil / PC:</b> Guías ilustradas paso a paso para iniciar sesión.\n\n` +
    `────── // ───\n` +
    `${dateFormatted}`
  );
}

/**
 * Construye el teclado principal del Hub Convertidor (Mathematical Bold, Cero Emojis).
 */
function buildConverterHubKeyboard(rewardId, platformUrl) {
  const kb = new InlineKeyboard();

  // Fila 1: Obtener JSON copiable en 1 clic
  kb.text(btn('Obtener JSON (1 Clic)', '✦', '✦'), `cookie_get_json:${rewardId}`);
  kb.row();

  // Fila 2: Descargar archivo .json
  kb.text(btn('Descargar Archivo .json', '⟡', '⟡'), `cookie_file_json:${rewardId}`);
  kb.row();

  // Fila 3: Tutoriales Móvil y PC
  kb.text(btn('Tutorial Movil', '⌥', '⌥'), `cookie_tut_mobile:${rewardId}`)
    .text(btn('Tutorial PC', '⌘', '⌘'), `cookie_tut_pc:${rewardId}`);
  kb.row();

  // Fila 4: Enlace oficial a la plataforma
  kb.url(btn('Entrar a Plataforma', '❖', '❖'), platformUrl);
  kb.row();

  // Fila 5: Volver
  kb.text(btn('Volver', '✕', '✕'), `cookie_back:${rewardId}`);

  return kb;
}

function register(bot) {
  // ── Callback: Abrir Hub Convertidor (/anun / quizz / claim) ──
  bot.callbackQuery(/^cookie_hub:(\d+)$/, async (ctx) => {
    try {
      const rewardId = Number(ctx.match[1]);
      const reward = await db.getRewardById(rewardId);

      if (!reward || !reward.account_data) {
        return await ctx.answerCallbackQuery({
          text: 'No se encontraron las cookies de esta cuenta en la base de datos.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery({ text: 'Abriendo convertidor...' });

      const raw = reward.account_data;
      const fmt = detectCookieFormat(raw);
      const cookiesList = fmt === 'JSON' ? JSON.parse(raw) : (fmt === 'HEADER' ? headerToJson(raw) : netscapeToJson(raw));
      const platformUrl = getPlatformUrl(reward.category, reward.account_title);

      const text = renderConverterHubCard(reward, cookiesList.length, fmt);
      const kb = buildConverterHubKeyboard(rewardId, platformUrl);

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      console.error('⟡ Error en cookie_hub:', err.message);
      await ctx.answerCallbackQuery({ text: 'Error abriendo el convertidor.', show_alert: true });
    }
  });

  // ── Callback: Obtener JSON en Texto Copiable (1 Clic) ──
  bot.callbackQuery(/^cookie_get_json:(\d+)$/, async (ctx) => {
    try {
      const rewardId = Number(ctx.match[1]);
      const reward = await db.getRewardById(rewardId);

      if (!reward || !reward.account_data) {
        return await ctx.answerCallbackQuery({ text: 'Cuenta no encontrada.', show_alert: true });
      }

      await ctx.answerCallbackQuery({ text: 'Generando formato JSON...' });

      const raw = reward.account_data;
      const fmt = detectCookieFormat(raw);
      const cookiesList = fmt === 'JSON' ? JSON.parse(raw) : (fmt === 'HEADER' ? headerToJson(raw) : netscapeToJson(raw));
      const jsonStr = JSON.stringify(cookiesList, null, 2);
      const platformUrl = getPlatformUrl(reward.category, reward.account_title);

      const kb = new InlineKeyboard()
        .text(btn('Descargar Archivo .json', '⟡', '⟡'), `cookie_file_json:${rewardId}`)
        .row()
        .url(btn('Entrar a Plataforma', '❖', '❖'), platformUrl)
        .text(btn('Volver al Menu', '✕', '✕'), `cookie_hub:${rewardId}`);

      if (jsonStr.length <= 3200) {
        // Cabe en el mensaje: enviar en bloque de código táctil
        const replyText =
          `<b>【 𝗖𝗢𝗢𝗞𝗜𝗘-𝗘𝗗𝗜𝗧𝗢𝗥 𝗝𝗦𝗢𝗡 】 ⟡ 「 𝗖𝗢𝗣𝗜𝗔𝗗𝗢 𝗥𝗔𝗣𝗜𝗗𝗢 」</b>\n` +
          `────── // ───\n\n` +
          `↳ <i>Toca una vez el bloque de código abajo para copiar todo el JSON al portapapeles:</i>\n\n` +
          `<pre><code>${escapeHtml(jsonStr)}</code></pre>\n\n` +
          `<b>〔 INSTRUCCIONES DE IMPORTACIÓN 〕</b>\n` +
          `1. Abre <b>${platformUrl}</b> en tu navegador.\n` +
          `2. Abre la extensión <b>Cookie-Editor</b>.\n` +
          `3. Presiona el botón <b>Import</b> (flecha hacia abajo / caja).\n` +
          `4. Pega el JSON copiado y presiona <b>Import</b>.\n` +
          `5. Recarga la página y ¡ya estás dentro de la cuenta!\n\n` +
          `────── // ───\n` +
          `${getSuperscriptDate()}`;

        await ctx.reply(replyText, {
          parse_mode: 'HTML',
          reply_markup: kb,
          link_preview_options: { is_disabled: true },
        });
      } else {
        // Si es muy extenso, enviar archivo virtual adjunto
        const buffer = Buffer.from(jsonStr, 'utf8');
        const fileName = `cookies_${(reward.category || 'cuenta').toLowerCase()}_vlp.json`;

        await ctx.replyWithDocument(new InputFile(buffer, fileName), {
          caption:
            `<b>【 𝗖𝗢𝗢𝗞𝗜𝗘-𝗘𝗗𝗜𝗧𝗢𝗥 𝗝𝗦𝗢𝗡 】 ⟡ 『 𝗔𝗥𝗖𝗛𝗜𝗩𝗢 𝗟𝗜𝗦𝗧𝗢 』</b>\n` +
            `────── // ───\n\n` +
            `▸ <b>Cuenta:</b> <code>${escapeHtml(reward.account_title || reward.category)}</code>\n` +
            `▸ <b>Total Cookies:</b> <code>${cookiesList.length} elementos</code>\n\n` +
            `↳ <i>Importa este archivo .json directamente en Cookie-Editor sin errores de formato.</i>`,
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      }
    } catch (err) {
      console.error('⟡ Error en cookie_get_json:', err.message);
      await ctx.answerCallbackQuery({ text: 'Error al generar JSON.', show_alert: true });
    }
  });

  // ── Callback: Descargar Archivo .json ──
  bot.callbackQuery(/^cookie_file_json:(\d+)$/, async (ctx) => {
    try {
      const rewardId = Number(ctx.match[1]);
      const reward = await db.getRewardById(rewardId);

      if (!reward || !reward.account_data) {
        return await ctx.answerCallbackQuery({ text: 'Cuenta no encontrada.', show_alert: true });
      }

      await ctx.answerCallbackQuery({ text: 'Preparando archivo .json...' });

      const raw = reward.account_data;
      const fmt = detectCookieFormat(raw);
      const cookiesList = fmt === 'JSON' ? JSON.parse(raw) : (fmt === 'HEADER' ? headerToJson(raw) : netscapeToJson(raw));
      const jsonStr = JSON.stringify(cookiesList, null, 2);

      const buffer = Buffer.from(jsonStr, 'utf8');
      const fileName = `cookies_${(reward.category || 'cuenta').toLowerCase()}_vlp.json`;

      const kb = new InlineKeyboard()
        .text(btn('Tutorial Movil', '⌥', '⌥'), `cookie_tut_mobile:${rewardId}`)
        .text(btn('Tutorial PC', '⌘', '⌘'), `cookie_tut_pc:${rewardId}`)
        .row()
        .text(btn('Volver al Menu', '✕', '✕'), `cookie_hub:${rewardId}`);

      await ctx.replyWithDocument(new InputFile(buffer, fileName), {
        caption:
          `<b>【 𝗔𝗥𝗖𝗛𝗜𝗩𝗢 𝗝𝗦𝗢𝗡 𝗢𝗙𝗜𝗖𝗜𝗔𝗟 】 ⟡ 『 𝗖𝗢𝗢𝗞𝗜𝗘-𝗘𝗗𝗜𝗧𝗢𝗥 』</b>\n` +
          `────── // ───\n` +
          `▸ <b>Archivo:</b> <code>${fileName}</code>\n` +
          `▸ <b>Compatibilidad:</b> Cookie-Editor (Kiwi, Chrome, Brave, Edge)\n` +
          `────── // ───\n` +
          `${getSuperscriptDate()}`,
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (err) {
      console.error('⟡ Error en cookie_file_json:', err.message);
    }
  });

  // ── Callback: Tutorial Móvil ──
  bot.callbackQuery(/^cookie_tut_mobile(?::(\d+))?$/, async (ctx) => {
    try {
      const rewardId = ctx.match[1];
      await ctx.answerCallbackQuery({ text: 'Cargando tutorial móvil...' });

      const text =
        `<b>【 𝗚𝗨𝗜𝗔 𝗠𝗢𝗩𝗜𝗟 】 ⟡ 「 𝗖𝗢𝗢𝗞𝗜𝗘-𝗘𝗗𝗜𝗧𝗢𝗥 𝗘𝗡 𝗖𝗘𝗟𝗨𝗟𝗔𝗥 」</b>\n` +
        `────── // ───\n\n` +
        `<b>Paso 1: Instalar Navegador con Extensiones</b>\n` +
        `  ↳ Descarga <b>Kiwi Browser</b> o <b>Yandex Browser</b> desde Play Store.\n\n` +
        `<b>Paso 2: Instalar la Extensión Cookie-Editor</b>\n` +
        `  ↳ Abre Kiwi Browser y accede a la Chrome Web Store para instalar <b>Cookie-Editor</b>.\n\n` +
        `<b>Paso 3: Abrir la Plataforma</b>\n` +
        `  ↳ Entra en Kiwi a la página del servicio (ej: <code>primevideo.com</code> o <code>youtube.com</code>).\n\n` +
        `<b>Paso 4: Importar Cookies</b>\n` +
        `  ↳ Toca los 3 puntos verticales arriba a la derecha en Kiwi Browser.\n` +
        `  ↳ Desliza abajo y toca <b>Cookie-Editor</b>.\n` +
        `  ↳ Toca el botón <b>Import</b> (icono de flecha hacia abajo).\n` +
        `  ↳ Pega el texto JSON generado por el bot y confirma tocando <b>Import</b>.\n\n` +
        `<b>Paso 5: Acceso Inmediato</b>\n` +
        `  ↳ Recarga la página en Kiwi. ¡Ya estarás dentro de la cuenta sin contraseña!\n\n` +
        `────── // ───\n` +
        `${getSuperscriptDate()}`;

      const kb = new InlineKeyboard()
        .url(btn('Instalar Kiwi Browser', '⌥', '⌥'), KIWI_BROWSER_PLAYSTORE_URL)
        .row()
        .url(btn('Instalar Cookie-Editor', '⌘', '⌘'), COOKIE_EDITOR_CHROME_URL);

      if (rewardId) {
        kb.row().text(btn('Volver al Convertidor', '✕', '✕'), `cookie_hub:${rewardId}`);
      }

      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      console.error('⟡ Error en cookie_tut_mobile:', err.message);
    }
  });

  // ── Callback: Tutorial PC ──
  bot.callbackQuery(/^cookie_tut_pc(?::(\d+))?$/, async (ctx) => {
    try {
      const rewardId = ctx.match[1];
      await ctx.answerCallbackQuery({ text: 'Cargando tutorial PC...' });

      const text =
        `<b>【 𝗚𝗨𝗜𝗔 𝗣𝗖 】 ⟡ 「 𝗖𝗢𝗢𝗞𝗜𝗘-𝗘𝗗𝗜𝗧𝗢𝗥 𝗘𝗡 𝗘𝗦𝗖𝗥𝗜𝗧𝗢𝗥𝗜𝗢 」</b>\n` +
        `────── // ───\n\n` +
        `<b>Paso 1: Instalar la Extensión</b>\n` +
        `  ↳ En Chrome, Brave o Edge, instala <b>Cookie-Editor</b> desde Chrome Web Store.\n\n` +
        `<b>Paso 2: Abrir la Web Oficial</b>\n` +
        `  ↳ Abre una pestaña en <code>primevideo.com</code> o <code>youtube.com</code>.\n\n` +
        `<b>Paso 3: Importar el JSON</b>\n` +
        `  ↳ Haz clic en el icono de la galleta (Cookie-Editor) en tu barra de extensiones.\n` +
        `  ↳ Haz clic en <b>Import</b>.\n` +
        `  ↳ Pega el bloque JSON que te entregó el bot.\n` +
        `  ↳ Presiona el botón <b>Import</b> para confirmar.\n\n` +
        `<b>Paso 4: Actualizar Página</b>\n` +
        `  ↳ Presiona <b>F5</b> o recarga la página. La sesión se iniciará de forma automática.\n\n` +
        `────── // ───\n` +
        `${getSuperscriptDate()}`;

      const kb = new InlineKeyboard()
        .url(btn('Instalar Cookie-Editor (PC)', '⌘', '⌘'), COOKIE_EDITOR_CHROME_URL);

      if (rewardId) {
        kb.row().text(btn('Volver al Convertidor', '✕', '✕'), `cookie_hub:${rewardId}`);
      }

      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      console.error('⟡ Error en cookie_tut_pc:', err.message);
    }
  });

  // ── Callback: Volver a la Tarjeta Original de Entrega ──
  bot.callbackQuery(/^cookie_back:(\d+)$/, async (ctx) => {
    try {
      const rewardId = Number(ctx.match[1]);
      const reward = await db.getRewardById(rewardId);

      if (!reward) {
        return await ctx.answerCallbackQuery({ text: 'Premio no encontrado.', show_alert: true });
      }

      const { renderPrivateRewardCard, buildRewardKeyboard } = require('./quizHandler');
      const text = renderPrivateRewardCard(ctx.from, reward);
      const kb = buildRewardKeyboard(rewardId, reward.category, reward.account_title);

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
      await ctx.answerCallbackQuery();
    } catch (err) {
      console.warn('⟡ Error en cookie_back:', err.message);
    }
  });

  // ── Comando Libre: /convertir o /cookie ──
  bot.command(['convertir', 'cookie', 'cookies'], async (ctx) => {
    try {
      const reply = ctx.message.reply_to_message;
      let rawText = '';

      if (reply) {
        if (reply.document && reply.document.file_name?.endsWith('.txt')) {
          const file = await ctx.api.getFile(reply.document.file_id);
          const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
          const res = await fetch(fileUrl);
          rawText = await res.text();
        } else if (reply.text) {
          rawText = reply.text;
        }
      } else {
        const parts = (ctx.message.text || '').split(/\s+/);
        if (parts.length > 1) {
          rawText = parts.slice(1).join(' ');
        }
      }

      if (!rawText.trim()) {
        return await ctx.reply(
          `<b>【 𝗩𝗘𝗡𝗧𝗔𝗦 𝗟𝗜𝗕𝗥𝗘𝗦 𝗣𝗘𝗥𝗨 】 ⟡ 「 𝗖𝗢𝗡𝗩𝗘𝗥𝗧𝗜𝗗𝗢𝗥 𝗟𝗜𝗕𝗥𝗘 」</b>\n` +
          `────── // ───\n\n` +
          `<b>Modo de uso:</b>\n` +
          `  ↳ Responde con <code>/convertir</code> a cualquier archivo .txt o mensaje con cookies.\n` +
          `  ↳ O escribe directamente: <code>/convertir [tus cookies]</code>\n\n` +
          `<b>Funciones automáticas:</b>\n` +
          `  • Convierte Netscape HTTP Cookie File a Cookie-Editor JSON.\n` +
          `  • Entrega el bloque copiable al toque y el archivo .json para importar.\n\n` +
          `────── // ───\n` +
          `${getSuperscriptDate()}`,
          { parse_mode: 'HTML' }
        );
      }

      const fmt = detectCookieFormat(rawText);
      const cookiesList = fmt === 'JSON' ? JSON.parse(rawText) : (fmt === 'HEADER' ? headerToJson(rawText) : netscapeToJson(rawText));

      if (cookiesList.length === 0) {
        return await ctx.reply(
          `<b>【 𝗘𝗥𝗥𝗢𝗥 𝗗𝗘 𝗙𝗢𝗥𝗠𝗔𝗧𝗢 】</b>\n────── // ───\n<i>No se pudieron extraer cookies válidas del texto proporcionado.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      const jsonStr = JSON.stringify(cookiesList, null, 2);
      const buffer = Buffer.from(jsonStr, 'utf8');

      const kb = new InlineKeyboard()
        .text(btn('Tutorial Movil', '⌥', '⌥'), `cookie_tut_mobile`)
        .text(btn('Tutorial PC', '⌘', '⌘'), `cookie_tut_pc`);

      await ctx.replyWithDocument(new InputFile(buffer, 'cookies_convertidas_vlp.json'), {
        caption:
          `<b>【 𝗖𝗢𝗡𝗩𝗘𝗥𝗦𝗜𝗢𝗡 𝗘𝗫𝗜𝗧𝗢𝗦𝗔 】 ⟡ 『 𝗖𝗢𝗢𝗞𝗜𝗘-𝗘𝗗𝗜𝗧𝗢𝗥 』</b>\n` +
          `────── // ───\n` +
          `▸ <b>Formato Origen:</b> <code>${fmt}</code>\n` +
          `▸ <b>Formato Destino:</b> <code>Cookie-Editor JSON</code>\n` +
          `▸ <b>Total Cookies:</b> <code>${cookiesList.length} elementos válidos ✓</code>\n` +
          `────── // ───\n` +
          `${getSuperscriptDate()}`,
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (err) {
      console.error('⟡ Error en comando /convertir:', err.message);
      await ctx.reply(`⟡ Error en conversión: ${err.message}`);
    }
  });
}

module.exports = {
  register,
  netscapeToJson,
  jsonToNetscape,
  headerToJson,
  detectCookieFormat,
  getPlatformUrl,
  renderConverterHubCard,
  buildConverterHubKeyboard,
};
