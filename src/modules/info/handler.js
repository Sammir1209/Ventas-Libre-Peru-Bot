const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM, ROLES } = require('../../config/constants');
const { resolveTarget, searchCandidatesInCommunity, extractTarget } = require('../../utils/helpers');
const userbot = require('../../userbot/client');
const { mentionFromData, formatId, escapeHtml } = require('../../utils/formatting');
const { InlineKeyboard, InputFile } = require('grammy');
const { generateUserCardBuffer } = require('../../utils/userCard');

// ══════
// ⟡ Módulo: Información de Usuario y Consulta de Antecedentes (/info)
// ══════

/**
 * Convierte los dígitos de una fecha (DDMMYYYY) a caracteres superíndice Unicode (ej. ¹⁴⁰⁹²⁰²⁶).
 */
function getSuperscriptDate(date = new Date()) {
  const digits = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻',
  };
  const dStr = date.toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-'); // "23-09-2026"

  return dStr.split('').map((ch) => digits[ch] || ch).join('');
}

/**
 * Construye los datos y plantilla principal del perfil de usuario (/info).
 * Sigue el diseño estético de tarjeta:
 * 🤖 [Nombre BOT] PERFIL DE USUARIO
 * ──────
 * 👤 Nombre: ...
 * 🆔 ID: ...
 * 🆀 User: ...
 * 💼 Rol: ...
 * 🌐 Origen: ...
 * 🔗 Link de perfil: Presiona aquí
 * ──────
 * ¹⁴⁰⁹²⁰²⁶
 */
async function buildUserProfile(ctx, targetUser) {
  const userId = Number(targetUser.userId);
  let username = targetUser.username;
  let firstName = targetUser.firstName;

  // Consultar BD primero (instantáneo en Postgres)
  if (!username || !firstName) {
    try {
      const u = await db.getUser(userId);
      if (u) {
        if (!username) username = u.username || null;
        if (!firstName) firstName = u.first_name || null;
      }
    } catch {}
  }
  // Solo si sigue sin datos, consultar API de Telegram como fallback
  if (!username || !firstName) {
    try {
      const chatInfo = await ctx.api.getChat(userId);
      if (chatInfo) {
        if (!username) username = chatInfo.username || null;
        if (!firstName) firstName = chatInfo.first_name || null;
      }
    } catch {}
  }

  // 1. Obtener rol y custom title en BD
  let rolesList = [];
  let customTitle = null;
  const effectiveOwners = ctx.tenant?.owner_ids || config.OWNER_IDS;
  const tenantId = ctx.tenant?.id || null;
  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
  const botLabel = communityName.replace(/\s*perú|\s*peru|\s*bot/gi, '').trim() || 'Ventas Libres';

  if (effectiveOwners.includes(userId)) {
    rolesList = ['OWNER'];
  }
  try {
    const staff = await db.getStaffMember(userId, tenantId);
    if (staff && staff.role) {
      const parsed = staff.role.split(',').map((r) => r.trim().toUpperCase());
      rolesList = Array.from(new Set([...rolesList, ...parsed]));
      customTitle = staff.custom_title || null;
    }
  } catch {}

  // 0. Comprobar si el usuario está en la Lista Negra (Quemado / GBAN)
  let burnInfo = null;
  try {
    burnInfo = await db.getBurnedUserInfo(userId) || (username ? await db.getBurnedUserInfo(username) : null);
  } catch {}

  // Determinar rol legible
  const isOwner = rolesList.includes('OWNER');
  const isCoOwner = rolesList.includes('CO-OWNER') || rolesList.includes('COOWNER');
  const isAdmin = rolesList.some((r) => r.includes('ADMIN') || r.includes('ADMINISTRADOR'));
  const isDealAdmin = rolesList.some((r) => r.includes('TRATO ADMIN') || r.includes('TRATOADMIN'));

  let roleName = 'Usuario';
  if (burnInfo) {
    roleName = 'Estafador [ LISTA NEGRA ]';
  } else if (isOwner) {
    roleName = 'Owner';
  } else if (isCoOwner) {
    roleName = 'Co-Owner';
  } else if (isAdmin && isDealAdmin) {
    roleName = 'Administrador & Mediador';
  } else if (isAdmin) {
    roleName = 'Administrador';
  } else if (isDealAdmin) {
    roleName = 'Trato Admin (Mediador)';
  } else if (customTitle) {
    roleName = customTitle;
  }

  const nameDisplay = escapeHtml(firstName || 'Usuario');
  const userDisplay = username ? `@${escapeHtml(username)}` : '<i>Sin @username</i>';
  const dateFormatted = getSuperscriptDate();

  const originLine = targetUser.isGlobal
    ? `〖❖〗 <b>Origen:</b> <i>Usuario Global (Fuera de la comunidad)</i>\n`
    : `〖❖〗 <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n`;

  const bodyText =
    `<b>⟡ [${escapeHtml(botLabel)} BOT] PERFIL DE USUARIO</b>\n` +
    `──────\n\n` +
    `〖☁〗 <b>Username:</b> ${nameDisplay}\n` +
    `〖ϟ〗 <b>ID:</b> <code>${userId}</code>\n` +
    `〖♝〗 <b>@User:</b> ${userDisplay}\n` +
    `〖☾〗 <b>Rol:</b> ${escapeHtml(roleName)}\n` +
    originLine +
    `〖✦〗 <b>Link de perfil:</b> <a href="tg://user?id=${userId}">Presiona aquí</a>`;

  const text = `${bodyText}\n\n──────\n${dateFormatted}`;

  const keyboard = new InlineKeyboard();
  if (userId) {
    keyboard.text('Perfil', `info_view_card:${userId}`).primary();
    keyboard.text('Verificar', `info_check_burn:${userId}`).success();
  } else if (username) {
    keyboard.text('Perfil', `info_view_card_user:${username}`).primary();
    keyboard.text('Verificar', `info_check_burn_user:${username}`).success();
  }

  // Si se buscó por término y no es una consulta directa de reply/ID, agregar botón de búsqueda global
  if (targetUser.searchQuery && !targetUser.isGlobal) {
    const safeQ = encodeURIComponent(targetUser.searchQuery).slice(0, 40);
    keyboard.row().text('🌐 ¿No es él? Buscar en Telegram', `info_global:${safeQ}`);
  }

  return { text, keyboard, bodyText, dateFormatted };
}

/**
 * Construye la plantilla estética de perfil cuando solo se cuenta con el @username
 */
async function buildUserProfileByUsername(ctx, username) {
  const cleanUser = String(username).replace(/^@/, '').trim();
  let dbUser = await db.getUserByUsername(cleanUser).catch(() => null);
  if (dbUser && dbUser.user_id) {
    return await buildUserProfile(ctx, {
      userId: dbUser.user_id,
      username: dbUser.username || cleanUser,
      firstName: dbUser.first_name,
    });
  }

  // Si no se encuentra en BD, intentar resolver por Userbot MTProto si está disponible
  let resolvedId = null;
  let resolvedFirst = null;
  try {
    const userbot = require('../../userbot/client');
    if (userbot.isConnected()) {
      const ub = await userbot.resolveUser(cleanUser);
      if (ub && ub.userId) {
        resolvedId = ub.userId;
        resolvedFirst = ub.firstName;
        db.upsertUser(ub.userId, ub.username || cleanUser, ub.firstName).catch(() => {});
        return await buildUserProfile(ctx, {
          userId: ub.userId,
          username: ub.username || cleanUser,
          firstName: ub.firstName,
        });
      }
    }
  } catch {}

  const botLabel = ctx.tenant?.community_name || 'VENTAS LIBRES PERÚ';
  const nameDisplay = escapeHtml(resolvedFirst || cleanUser);
  const userDisplay = `@${escapeHtml(cleanUser)}`;
  const dateFormatted = getSuperscriptDate();

  let roleName = 'Usuario';
  const staff = await db.getStaffMember(cleanUser, ctx.tenant?.id).catch(() => null);
  if (staff) roleName = staff.role || 'Staff';

  const burn = await db.getBurnedUserInfo(cleanUser).catch(() => null);
  if (burn) roleName = 'Estafador [ LISTA NEGRA ]';

  const bodyText =
    `<b>⟡ [${escapeHtml(botLabel)} BOT] PERFIL DE USUARIO</b>\n` +
    `──────\n\n` +
    `〖☁〗 <b>Username:</b> ${nameDisplay}\n` +
    `〖ϟ〗 <b>ID:</b> <i>No detectado</i>\n` +
    `〖♝〗 <b>@User:</b> ${userDisplay}\n` +
    `〖☾〗 <b>Rol:</b> ${escapeHtml(roleName)}\n` +
    `〖✦〗 <b>Link de perfil:</b> <a href="https://t.me/${cleanUser}">Presiona aquí</a>`;

  const text = `${bodyText}\n\n──────\n${dateFormatted}`;

  const keyboard = new InlineKeyboard()
    .text('Perfil', `info_view_card_user:${cleanUser}`).primary()
    .text('Verificar', `info_check_burn_user:${cleanUser}`).success();

  return { text, keyboard, bodyText, dateFormatted };
}

// Rate limit / Anti-spam para botones interactivos de Ocultar / Verificar
const BUTTON_SPAM_MAP = new Map(); // userId -> { count: number, lastReset: number }

function checkButtonSpam(userId) {
  const now = Date.now();
  const record = BUTTON_SPAM_MAP.get(userId) || { count: 0, lastReset: now };
  if (now - record.lastReset > 4000) {
    record.count = 1;
    record.lastReset = now;
  } else {
    record.count++;
  }
  BUTTON_SPAM_MAP.set(userId, record);
  return record.count > 3; // Más de 3 clics en 4 segundos dispara alerta de spam
}

/**
 * Sube un buffer de imagen a Catbox para obtener una URL pública directa.
 * Permite incrustar la imagen en el mensaje de texto original vía link_preview_options
 * sin crear mensajes adicionales y editando en el mismo lugar.
 */
async function uploadCardToHost(buffer) {
  try {
    const fd = new FormData();
    fd.append('reqtype', 'fileupload');
    fd.append('fileToUpload', new Blob([buffer], { type: 'image/png' }), `perfil_${Date.now()}.png`);
    const res = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: fd,
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const url = (await res.text()).trim();
      if (url.startsWith('http')) return url;
    }
  } catch (err) {
    console.warn('⟡ Info: Aviso al hospedar tarjeta (fallback):', err.message);
  }
  return null;
}

/**
 * Genera y envía la tarjeta gráfica de perfil (/perfil).
 */
async function sendUserCard(ctx, target) {
  const statusMsg = await ctx.reply('▪ <i>Generando tarjeta de perfil...</i>', { parse_mode: 'HTML' });
  try {
    const { cardBuffer, userId: resolvedId } = await generateUserCardBuffer(ctx.api, target, {
      tenantId: ctx.tenant?.id,
      ownerIds: ctx.tenant?.owner_ids,
      communityName: ctx.tenant?.community_name || 'Comunidad Oficial',
    });
    const cardFile = new InputFile(cardBuffer, `perfil_${resolvedId || target.userId || 'user'}.png`);
    await ctx.replyWithPhoto(cardFile);
    try {
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
    } catch {}
  } catch (err) {
    console.error('⟡ Info: Error generando tarjeta:', err.message);
    try {
      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `⟡ ✗ Error al generar tarjeta: ${err.message}`);
    } catch {}
  }
}

function register(bot) {
  // ── Comando /perfil [ID, @username o responder] (Solo la tarjeta / card) ──
  bot.command('perfil', async (ctx) => {
    try {
      const extracted = extractTarget(ctx);

      // 1. Caso A: Sin argumento y sin reply -> consultar propio perfil
      if (!extracted) {
        return await sendUserCard(ctx, {
          userId: ctx.from.id,
          username: ctx.from.username || null,
          firstName: ctx.from.first_name || null,
        });
      }

      // 2. Caso B: Reply a mensaje o ID numérico explícito -> target directo
      if (extracted.userId) {
        let directTarget = await resolveTarget(ctx);
        if (!directTarget || directTarget.unresolved) {
          directTarget = {
            userId: extracted.userId,
            username: extracted.username || null,
            firstName: extracted.firstName || null,
          };
        }
        return await sendUserCard(ctx, directTarget);
      }

      // 3. Caso C: Búsqueda por texto (@username o nombre)
      const rawQuery = extracted.query || extracted.username || '';
      const cleanQuery = rawQuery.replace(/^@/, '').trim();
      const tenantId = ctx.tenant?.id || null;
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';

      await ctx.replyWithChatAction('typing');

      // PRIORIDAD 1: Buscar en la comunidad
      const communityCandidates = await searchCandidatesInCommunity(cleanQuery, tenantId);

      if (communityCandidates.length > 1) {
        const kb = new InlineKeyboard();
        const displayList = communityCandidates.slice(0, 8);

        for (const u of displayList) {
          const uLabel = `${u.firstName || 'Usuario'}${u.username ? ` (@${u.username})` : ` [${u.userId}]`}`;
          kb.text(`👤 ${uLabel.slice(0, 30)}`, `perfil_card:${u.userId}`).row();
        }

        const safeQ = encodeURIComponent(cleanQuery).slice(0, 40);
        kb.text('🌐 Buscar en Telegram Global', `perfil_global:${safeQ}`).row();
        kb.text('✖ Cerrar', 'info_close');

        const msgText =
          `👥 <b>TARJETA DE PERFIL</b> ⊱ <code>COINCIDENCIAS</code> ⊰\n` +
          `══════\n\n` +
          `Se encontraron <b>${communityCandidates.length}</b> usuarios en la comunidad para: <code>${escapeHtml(cleanQuery)}</code>\n` +
          `▸ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n\n` +
          `<i>Selecciona a quién deseas generarle la tarjeta de perfil:</i>\n` +
          `──────`;

        return await ctx.reply(msgText, {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      }

      if (communityCandidates.length === 1) {
        return await sendUserCard(ctx, communityCandidates[0]);
      }

      // PRIORIDAD 2: Fallback Global (Solo si NO está en la comunidad)
      const globalTarget = await resolveTarget(ctx, { tenantId });
      if (globalTarget && globalTarget.userId && !globalTarget.unresolved) {
        return await sendUserCard(ctx, globalTarget);
      }

      return ctx.reply(
        `⟡ <b>GENERADOR DE TARJETA</b> ⊱ <code>SIN RESULTADOS</code> ⊰\n` +
        `══════\n\n` +
        `✗ No se encontró a ningún usuario para: <code>${escapeHtml(cleanQuery)}</code>\n\n` +
        `▸ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code> (0 coincidencias)\n` +
        `▸ <b>Telegram Global:</b> Sin coincidencias\n\n` +
        `──────\n` +
        `▪ <i>Verifica el @username o utiliza su ID numérico:</i> <code>/perfil [ID]</code>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Info: Error en /perfil:', err.message);
      await ctx.reply(`⟡ ✗ Error al generar perfil: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Comando /info [ID, @username o responder] (Plantilla original en texto) ──
  bot.command('info', async (ctx) => {
    try {
      const extracted = extractTarget(ctx);

      // 1. Caso A: Sin argumento y sin reply -> consultar propio perfil
      if (!extracted) {
        const { text, keyboard } = await buildUserProfile(ctx, {
          userId: ctx.from.id,
          username: ctx.from.username || null,
          firstName: ctx.from.first_name || null,
          isCommunity: true,
        });
        return await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }

      // 2. Caso B: Reply a mensaje o ID numérico explícito -> target directo
      if (extracted.userId) {
        let directTarget = await resolveTarget(ctx);
        if (!directTarget || directTarget.unresolved) {
          directTarget = {
            userId: extracted.userId,
            username: extracted.username || null,
            firstName: extracted.firstName || null,
          };
        }
        const { text, keyboard } = await buildUserProfile(ctx, directTarget);
        return await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }

      // 3. Caso C: Búsqueda por texto (@username, nombre o frase)
      const rawQuery = extracted.query || extracted.username || '';
      const cleanQuery = rawQuery.replace(/^@/, '').trim();
      const tenantId = ctx.tenant?.id || null;
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';

      await ctx.replyWithChatAction('typing');

      // ── PASO 1: PRIORIDAD ABSOLUTA - BÚSQUEDA EN LA COMUNIDAD ──
      const communityCandidates = await searchCandidatesInCommunity(cleanQuery, tenantId);

      // Si hay MÁS DE 1 coincidencia en la comunidad: mostrar opciones interactivas
      if (communityCandidates.length > 1) {
        const kb = new InlineKeyboard();
        const displayList = communityCandidates.slice(0, 8);

        for (const u of displayList) {
          const uLabel = `${u.firstName || 'Usuario'}${u.username ? ` (@${u.username})` : ` [${u.userId}]`}`;
          kb.text(`👤 ${uLabel.slice(0, 30)}`, `info_profile:${u.userId}`).row();
        }

        const safeQ = encodeURIComponent(cleanQuery).slice(0, 40);
        kb.text('🌐 Buscar en Telegram Global', `info_global:${safeQ}`).row();
        kb.text('✖ Cerrar', 'info_close');

        const msgText =
          `👥 <b>USUARIOS ENCONTRADOS EN LA COMUNIDAD</b>\n` +
          `══════\n\n` +
          `Se encontraron <b>${communityCandidates.length}</b> coincidencias dentro de la comunidad para: <code>${escapeHtml(cleanQuery)}</code>\n` +
          `▸ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n\n` +
          `<i>Selecciona un usuario de la lista para ver su perfil:</i>\n` +
          `──────`;

        return await ctx.reply(msgText, {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      }

      // Si hay EXACTAMENTE 1 coincidencia en la comunidad: mostrar perfil directamente
      if (communityCandidates.length === 1) {
        const target = communityCandidates[0];
        target.searchQuery = cleanQuery;
        const { text, keyboard } = await buildUserProfile(ctx, target);
        return await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }

      // ── PASO 2: FALLBACK GLOBAL EN TELEGRAM (Solo si NO existe en la comunidad) ──
      const globalTarget = await resolveTarget(ctx, { tenantId });

      if (globalTarget && globalTarget.userId && !globalTarget.unresolved) {
        globalTarget.isGlobal = true;
        const { text, keyboard } = await buildUserProfile(ctx, globalTarget);
        return await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }

      // Si no se encontró en ningún lado
      return ctx.reply(
        `⟡ <b>BÚSQUEDA DE USUARIO</b> ⊱ <code>SIN RESULTADOS</code> ⊰\n` +
        `══════\n\n` +
        `✗ No se encontró a ningún usuario para: <code>${escapeHtml(cleanQuery)}</code>\n\n` +
        `▸ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code> (0 coincidencias)\n` +
        `▸ <b>Telegram Global:</b> Sin coincidencias\n\n` +
        `──────\n` +
        `▪ <i>Pídele que envíe un mensaje en el grupo o consulta directamente por su ID numérico:</i> <code>/info [ID]</code>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Info: Error en /info:', err.message);
      await ctx.reply(`⟡ ✗ Error al consultar información: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Comando /id para obtener el ID del Chat y del Usuario ──
  bot.command('id', async (ctx) => {
    try {
      let replyText = 
        `⟡ <b>IDENTIFICADORES OFICIALES</b> ⊱ <code>TELEGRAM ID</code> ⊰\n` +
        `══════\n\n` +
        `▸ <b>ID de este Chat:</b> <code>${ctx.chat.id}</code>\n`;
      
      if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        replyText += `▸ <b>Tipo de Chat:</b> ⊱ <code>GRUPO</code> ⊰\n`;
      } else if (ctx.chat.type === 'channel') {
        replyText += `▸ <b>Tipo de Chat:</b> ⊱ <code>CANAL</code> ⊰\n`;
      } else {
        replyText += `▸ <b>Tipo de Chat:</b> ⊱ <code>PRIVADO</code> ⊰\n`;
      }

      if (ctx.message?.reply_to_message) {
        const repliedUser = ctx.message.reply_to_message.from;
        replyText += `▸ <b>ID de Usuario Respondido:</b> <code>${repliedUser.id}</code>\n`;
      } else {
        replyText += `▸ <b>Tu ID Numérico:</b> <code>${ctx.from.id}</code>\n`;
      }

      replyText += `──────`;

      await ctx.reply(replyText, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Info: Error en /id:', err.message);
    }
  });

  // ── Comando /invite para obtener el enlace de invitación oficial ──
  bot.command(['invite', 'invitacion', 'enlace', 'link'], async (ctx) => {
    try {
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      const folderLink = config.GROUPS_FOLDER_LINK || 'https://t.me/addlist/wJgsKg3dZCQ4Njlh';
      let groupInviteLink = null;
      let groupTitle = ctx.chat.title || 'Ventas Libres Perú';

      if (isGroup) {
        if (ctx.chat.username) {
          groupInviteLink = `https://t.me/${ctx.chat.username}`;
        } else {
          try {
            const created = await ctx.api.createChatInviteLink(ctx.chat.id, {
              name: 'Invitación Bot',
            });
            groupInviteLink = created.invite_link;
          } catch {
            try {
              groupInviteLink = await ctx.api.exportChatInviteLink(ctx.chat.id);
            } catch {}
          }
        }
      }

      const finalLink = groupInviteLink || folderLink;

      const text =
        `⟡ <b>ENLACE DE INVITACIÓN OFICIAL</b> ⊱ <code>ACCESO</code> ⊰\n` +
        `══════\n\n` +
        (isGroup ? `▸ <b>Grupo:</b> ${escapeHtml(groupTitle)}\n\n` : `▸ <b>Comunidad:</b> Ventas Libres Perú\n\n`) +
        `▸ <b>Enlace Verificado:</b>\n  ↳ <code>${finalLink}</code>\n\n` +
        `──────\n` +
        `▪ <i>Comparte este enlace para invitar a comerciantes a la red oficial.</i>`;

      const kb = new InlineKeyboard();
      if (groupInviteLink) {
        kb.url('ENTRAR AL GRUPO', groupInviteLink);
      }
      kb.url('CARPETA OFICIAL', folderLink);

      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (err) {
      console.error('⟡ Info: Error en /invite:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al obtener enlace de invitación.`, { parse_mode: 'HTML' });
    }
  });

  // ── Callback: Verificar Antecedentes de Estafa (/info) ──
  bot.callbackQuery(/^info_check_burn:(\d+)$/, async (ctx) => {
    try {
      if (checkButtonSpam(ctx.from.id)) {
        return await ctx.answerCallbackQuery({
          text: '⚠️ Calma, no hagas spam de botones.',
          show_alert: true,
        });
      }

      // Respuesta inmediata sin bloqueo para máxima fluidez
      ctx.answerCallbackQuery().catch(() => {});

      const targetId = parseInt(ctx.match[1]);

      // Consultas en paralelo a Postgres
      const [burnInfo, userObj] = await Promise.all([
        db.getBurnedUserInfo(targetId),
        db.getUser(targetId).catch(() => null),
      ]);

      // Reconstruir perfil base pasando datos de usuario en memoria
      const { bodyText, dateFormatted } = await buildUserProfile(ctx, {
        userId: targetId,
        username: userObj?.username,
        firstName: userObj?.first_name,
      });

      let verificationSection = '';
      if (!burnInfo) {
        // USUARIO LIMPIO
        verificationSection =
          `⟡ <b>ESTADO DE ANTECEDENTES:</b>\n` +
          `▸ <b>Estado:</b> ⊱ <code>LIMPIO [ VERIFICADO ]</code> ⊰\n` +
          `✓ <i>Este usuario NO registra antecedentes de estafa ni sanciones en la base de datos oficial.</i>`;
      } else {
        // USUARIO QUEMADO (ESTAFADOR)
        const dateRaw = burnInfo.burned_at || burnInfo.created_at;
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

        verificationSection =
          `⟡ <b>[ LISTA NEGRA OFICIAL ] REGISTRO DE ESTAFADOR</b>\n` +
          `▸ <b>Estado:</b> ⊱ <code>QUEMADO / ESTAFADOR [ SANCIONADO ]</code> ⊰\n` +
          `▸ <b>Fecha:</b> <code>${dateStr}</code>\n` +
          `▸ <b>Motivo / Hechos:</b>\n  ↳ <i>${escapeHtml(burnInfo.context || 'Reporte de estafa confirmado')}</i>\n` +
          `▸ <b>Reportado por:</b> <code>${burnInfo.reported_by || 'Staff'}</code>\n` +
          `🚫 <i>ADVERTENCIA DE SEGURIDAD: No realices transferencias, pagos ni entregas con este usuario.</i>`;
      }

      const targetUser = userObj?.username ? userObj.username : null;
      const profileUrl = targetUser ? `https://t.me/${targetUser}` : `tg://user?id=${targetId}`;

      const existingMediaUrl =
        ctx.callbackQuery?.message?.link_preview_options?.url ||
        ctx.callbackQuery?.message?.entities?.find((e) => e.type === 'text_link')?.url ||
        null;

      const isMedia = Boolean(ctx.callbackQuery?.message?.photo || ctx.callbackQuery?.message?.video || ctx.callbackQuery?.message?.document);

      const kb = new InlineKeyboard();
      if (isMedia || existingMediaUrl) {
        kb.url('Perfil', profileUrl).text('Verificar', `info_check_burn:${targetId}`).success();
      } else {
        kb.text('Perfil', `info_view_card:${targetId}`).primary().text('Verificar', `info_check_burn:${targetId}`).success();
      }
      kb.row().text('Ocultar', `info_hide_burn:${targetId}`).primary();

      if (burnInfo && config.PUBLIC_BURN_CHANNEL_ID) {
        const cleanChannel = String(config.PUBLIC_BURN_CHANNEL_ID).replace('-100', '');
        kb.row().url('🚨 Ver Canal de Quemados', `https://t.me/c/${cleanChannel}/1`).danger();
      }

      const fullText =
        `${bodyText}\n\n` +
        `──────\n` +
        `${verificationSection}\n\n` +
        `──────\n` +
        `${dateFormatted}`;

      try {
        if (isMedia) {
          await ctx.editMessageCaption({
            caption: fullText,
            parse_mode: 'HTML',
            reply_markup: kb,
          });
        } else if (existingMediaUrl) {
          const fullTextWithMedia = `<a href="${existingMediaUrl}">&#8205;</a>${fullText}`;
          await ctx.editMessageText(fullTextWithMedia, {
            parse_mode: 'HTML',
            reply_markup: kb,
            link_preview_options: {
              url: existingMediaUrl,
              prefer_large_media: true,
              show_above_text: true,
            },
          });
        } else {
          await ctx.editMessageText(fullText, {
            parse_mode: 'HTML',
            reply_markup: kb,
            link_preview_options: { is_disabled: true },
          });
        }
      } catch (editErr) {
        if (!editErr.message?.includes('message is not modified')) {
          console.error('⟡ Info: Error editando verificación añadida:', editErr.message);
        }
      }
    } catch (err) {
      if (!err.message?.includes('message is not modified')) {
        console.error('⟡ Info: Error en info_check_burn:', err.message);
      }
    }
  });

  // ── Callback: Ocultar Verificación (/info) ──
  bot.callbackQuery(/^info_hide_burn:(\d+)$/, async (ctx) => {
    try {
      if (checkButtonSpam(ctx.from.id)) {
        return await ctx.answerCallbackQuery({
          text: '⚠️ Calma, no hagas spam de botones.',
          show_alert: true,
        });
      }

      ctx.answerCallbackQuery().catch(() => {});

      const targetId = parseInt(ctx.match[1]);
      const userObj = await db.getUser(targetId).catch(() => null);

      const { text, keyboard } = await buildUserProfile(ctx, {
        userId: targetId,
        username: userObj?.username,
        firstName: userObj?.first_name,
      });

      const existingMediaUrl =
        ctx.callbackQuery?.message?.link_preview_options?.url ||
        ctx.callbackQuery?.message?.entities?.find((e) => e.type === 'text_link')?.url ||
        null;

      const isMedia = Boolean(ctx.callbackQuery?.message?.photo || ctx.callbackQuery?.message?.video || ctx.callbackQuery?.message?.document);

      let finalKeyboard = keyboard;
      if (isMedia || existingMediaUrl) {
        const targetUser = userObj?.username ? userObj.username : null;
        const profileUrl = targetUser ? `https://t.me/${targetUser}` : `tg://user?id=${targetId}`;
        finalKeyboard = new InlineKeyboard()
          .url('Perfil', profileUrl)
          .text('Verificar', `info_check_burn:${targetId}`).success();
      }

      try {
        if (isMedia) {
          await ctx.editMessageCaption({
            caption: text,
            parse_mode: 'HTML',
            reply_markup: finalKeyboard,
          });
        } else if (existingMediaUrl) {
          const textWithMedia = `<a href="${existingMediaUrl}">&#8205;</a>${text}`;
          await ctx.editMessageText(textWithMedia, {
            parse_mode: 'HTML',
            reply_markup: finalKeyboard,
            link_preview_options: {
              url: existingMediaUrl,
              prefer_large_media: true,
              show_above_text: true,
            },
          });
        } else {
          await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            reply_markup: finalKeyboard,
            link_preview_options: { is_disabled: true },
          });
        }
      } catch (editErr) {
        if (!editErr.message?.includes('message is not modified')) {
          console.error('⟡ Info: Error ocultando verificación:', editErr.message);
        }
      }
    } catch (err) {
      if (!err.message?.includes('message is not modified')) {
        console.error('⟡ Info: Error en info_hide_burn:', err.message);
      }
    }
  });

  // ── Callback: Verificar Antecedentes de Estafa por Username (/scanperfil o /info) ──
  bot.callbackQuery(/^(?:info_check_burn_user|perfil_card_user):(.+)$/, async (ctx) => {
    try {
      if (checkButtonSpam(ctx.from.id)) {
        return await ctx.answerCallbackQuery({
          text: '⚠️ Calma, no hagas spam de botones.',
          show_alert: true,
        });
      }

      ctx.answerCallbackQuery().catch(() => {});

      const username = ctx.match[1].toLowerCase().replace(/^@/, '').trim();

      // Consultas concurrentes en paralelo
      const [burnInfo, baseProfile] = await Promise.all([
        db.getBurnedUserInfo(username).then(async (res) => {
          if (!res && typeof db.findBurnedUserFlexible === 'function') {
            return await db.findBurnedUserFlexible({ username });
          }
          return res;
        }),
        buildUserProfileByUsername(ctx, username),
      ]);

      const { bodyText, dateFormatted } = baseProfile;

      let verificationSection = '';
      if (!burnInfo) {
        // USUARIO LIMPIO
        verificationSection =
          `⟡ <b>ESTADO DE ANTECEDENTES:</b>\n` +
          `▸ <b>Estado:</b> ⊱ <code>LIMPIO [ VERIFICADO ]</code> ⊰\n` +
          `✓ <i>Este usuario NO registra antecedentes de estafa ni sanciones en la base de datos oficial.</i>`;
      } else {
        // USUARIO QUEMADO (ESTAFADOR)
        const dateRaw = burnInfo.burned_at || burnInfo.created_at;
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

        verificationSection =
          `⟡ <b>[ LISTA NEGRA OFICIAL ] REGISTRO DE ESTAFADOR</b>\n` +
          `▸ <b>ID Fichado:</b> <code>${burnInfo.user_id || 'Desconocido'}</code>\n` +
          `▸ <b>Estado:</b> ⊱ <code>QUEMADO / ESTAFADOR [ SANCIONADO ]</code> ⊰\n` +
          `▸ <b>Fecha:</b> <code>${dateStr}</code>\n` +
          `▸ <b>Motivo / Hechos:</b>\n  ↳ <i>${escapeHtml(burnInfo.context || 'Reporte de estafa confirmado')}</i>\n\n` +
          `▸ <b>Reportado por:</b> <code>${burnInfo.reported_by || 'Staff'}</code>\n` +
          `──────\n` +
          `⟡ <b>ADVERTENCIA DE SEGURIDAD:</b>\n` +
          `<i>No realices transferencias, pagos ni entregas con este usuario bajo ninguna circunstancia.</i>`;
      }

      const existingMediaUrl =
        ctx.callbackQuery?.message?.link_preview_options?.url ||
        ctx.callbackQuery?.message?.entities?.find((e) => e.type === 'text_link')?.url ||
        null;

      const isMedia = Boolean(ctx.callbackQuery?.message?.photo || ctx.callbackQuery?.message?.video || ctx.callbackQuery?.message?.document);
      const profileUrl = `https://t.me/${username}`;

      const kb = new InlineKeyboard();
      if (isMedia || existingMediaUrl) {
        kb.url('Perfil', profileUrl).text('Verificar', `info_check_burn_user:${username}`).success();
      } else {
        kb.text('Perfil', `info_view_card_user:${username}`).primary().text('Verificar', `info_check_burn_user:${username}`).success();
      }
      kb.row().text('Ocultar', `info_hide_burn_user:${username}`).primary();

      if (burnInfo && config.PUBLIC_BURN_CHANNEL_ID) {
        const cleanChannel = String(config.PUBLIC_BURN_CHANNEL_ID).replace('-100', '');
        kb.row().url('🚨 Ver Canal de Quemados', `https://t.me/c/${cleanChannel}/1`).danger();
      }

      const fullText =
        `${bodyText}\n\n` +
        `──────\n` +
        `${verificationSection}\n\n` +
        `──────\n` +
        `${dateFormatted}`;

      try {
        if (isMedia) {
          await ctx.editMessageCaption({
            caption: fullText,
            parse_mode: 'HTML',
            reply_markup: kb,
          });
        } else if (existingMediaUrl) {
          const fullTextWithMedia = `<a href="${existingMediaUrl}">&#8205;</a>${fullText}`;
          await ctx.editMessageText(fullTextWithMedia, {
            parse_mode: 'HTML',
            reply_markup: kb,
            link_preview_options: {
              url: existingMediaUrl,
              prefer_large_media: true,
              show_above_text: true,
            },
          });
        } else {
          await ctx.editMessageText(fullText, {
            parse_mode: 'HTML',
            reply_markup: kb,
            link_preview_options: { is_disabled: true },
          });
        }
      } catch (editErr) {
        if (!editErr.message?.includes('message is not modified')) {
          console.error('⟡ Info: Error editando burnText por username:', editErr.message);
        }
      }
    } catch (err) {
      if (!err.message?.includes('message is not modified')) {
        console.error('⟡ Info: Error en info_check_burn_user:', err.message);
      }
    }
  });

  // ── Callback: Ocultar Verificación por Username (/info) ──
  bot.callbackQuery(/^info_hide_burn_user:(.+)$/, async (ctx) => {
    try {
      if (checkButtonSpam(ctx.from.id)) {
        return await ctx.answerCallbackQuery({
          text: '⚠️ Calma, no hagas spam de botones.',
          show_alert: true,
        });
      }

      ctx.answerCallbackQuery().catch(() => {});

      const username = ctx.match[1].toLowerCase().replace(/^@/, '').trim();
      const { text, keyboard } = await buildUserProfileByUsername(ctx, username);

      const existingMediaUrl =
        ctx.callbackQuery?.message?.link_preview_options?.url ||
        ctx.callbackQuery?.message?.entities?.find((e) => e.type === 'text_link')?.url ||
        null;

      const isMedia = Boolean(ctx.callbackQuery?.message?.photo || ctx.callbackQuery?.message?.video || ctx.callbackQuery?.message?.document);

      let finalKeyboard = keyboard;
      if (isMedia || existingMediaUrl) {
        finalKeyboard = new InlineKeyboard()
          .url('Perfil', `https://t.me/${username}`)
          .text('Verificar', `info_check_burn_user:${username}`).success();
      }

      try {
        if (isMedia) {
          await ctx.editMessageCaption({
            caption: text,
            parse_mode: 'HTML',
            reply_markup: finalKeyboard,
          });
        } else if (existingMediaUrl) {
          const textWithMedia = `<a href="${existingMediaUrl}">&#8205;</a>${text}`;
          await ctx.editMessageText(textWithMedia, {
            parse_mode: 'HTML',
            reply_markup: finalKeyboard,
            link_preview_options: {
              url: existingMediaUrl,
              prefer_large_media: true,
              show_above_text: true,
            },
          });
        } else {
          await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            reply_markup: finalKeyboard,
            link_preview_options: { is_disabled: true },
          });
        }
      } catch (editErr) {
        if (!editErr.message?.includes('message is not modified')) {
          console.error('⟡ Info: Error ocultando verificación por username:', editErr.message);
        }
      }
    } catch (err) {
      if (!err.message?.includes('message is not modified')) {
        console.error('⟡ Info: Error en info_hide_burn_user:', err.message);
      }
    }
  });

  // ── Callback: Generar Tarjeta Gráfica de Perfil (/perfil) desde Botón [ Perfil ] ──
  bot.callbackQuery(/^info_view_card:(\d+)$/, async (ctx) => {
    try {
      if (checkButtonSpam(ctx.from.id)) {
        return await ctx.answerCallbackQuery({
          text: '⚠️ Calma, no hagas spam de botones.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery({ text: '🎨 Cargando tarjeta de perfil...' }).catch(() => {});
      const targetId = parseInt(ctx.match[1]);
      const userObj = await db.getUser(targetId).catch(() => null);

      // Reconstruir perfil base para mantener los datos idénticos de /info
      const { text } = await buildUserProfile(ctx, {
        userId: targetId,
        username: userObj?.username,
        firstName: userObj?.first_name,
      });

      // Generar tarjeta gráfica oficial
      const { cardBuffer, userId: resolvedId } = await generateUserCardBuffer(
        ctx.api,
        {
          userId: targetId,
          username: userObj?.username || null,
          firstName: userObj?.first_name || 'Usuario',
        },
        {
          tenantId: ctx.tenant?.id,
          ownerIds: ctx.tenant?.owner_ids,
          communityName: ctx.tenant?.community_name || 'Comunidad Oficial',
        }
      );

      const targetUser = userObj?.username ? userObj.username : null;
      const profileUrl = targetUser ? `https://t.me/${targetUser}` : `tg://user?id=${targetId}`;

      const kb = new InlineKeyboard()
        .url('Perfil', profileUrl)
        .text('Verificar', `info_check_burn:${targetId}`).success();

      // 1. Intentar incrustar la imagen en el MISMO mensaje original vía preview superior
      const hostedUrl = await uploadCardToHost(cardBuffer);
      if (hostedUrl) {
        const textWithMedia = `<a href="${hostedUrl}">&#8205;</a>${text}`;
        try {
          return await ctx.editMessageText(textWithMedia, {
            parse_mode: 'HTML',
            reply_markup: kb,
            link_preview_options: {
              url: hostedUrl,
              prefer_large_media: true,
              show_above_text: true,
            },
          });
        } catch (editMediaErr) {
          console.warn('⟡ Info: Aviso editando mensaje con preview (usando fallback):', editMediaErr.message);
        }
      }

      // 2. Fallback: Foto nueva con caption y eliminación del mensaje anterior
      const cardFile = new InputFile(cardBuffer, `perfil_${resolvedId || targetId}.png`);

      const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
      const messageId = ctx.callbackQuery?.message?.message_id;
      const replyToMsgId = ctx.callbackQuery?.message?.reply_to_message?.message_id;
      const replyOptions = {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: kb,
      };
      if (replyToMsgId) {
        replyOptions.reply_parameters = { message_id: replyToMsgId };
      }

      await ctx.replyWithPhoto(cardFile, replyOptions);
      try {
        if (chatId && messageId) {
          await ctx.api.deleteMessage(chatId, messageId);
        } else {
          await ctx.deleteMessage();
        }
      } catch (delErr) {
        console.warn('⟡ Info: Aviso - No se pudo eliminar mensaje previo (requiere permiso Eliminar Mensajes):', delErr.message);
      }
    } catch (err) {
      console.error('⟡ Info: Error en info_view_card:', err.message);
    }
  });

  bot.callbackQuery(/^info_view_card_user:(.+)$/, async (ctx) => {
    try {
      if (checkButtonSpam(ctx.from.id)) {
        return await ctx.answerCallbackQuery({
          text: '⚠️ Calma, no hagas spam de botones.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery({ text: '🎨 Cargando tarjeta de perfil...' }).catch(() => {});
      const username = ctx.match[1].replace(/^@/, '').trim();
      const userObj = await db.getUserByUsername(username).catch(() => null);

      const { text } = await buildUserProfileByUsername(ctx, username);

      const { cardBuffer, userId: resolvedId } = await generateUserCardBuffer(
        ctx.api,
        {
          userId: userObj?.user_id || null,
          username: username,
          firstName: userObj?.first_name || username,
        },
        {
          tenantId: ctx.tenant?.id,
          ownerIds: ctx.tenant?.owner_ids,
          communityName: ctx.tenant?.community_name || 'Comunidad Oficial',
        }
      );

      const kb = new InlineKeyboard()
        .url('Perfil', `https://t.me/${username}`)
        .text('Verificar', `info_check_burn_user:${username}`).success();

      // 1. Intentar incrustar la imagen en el MISMO mensaje original vía preview superior
      const hostedUrl = await uploadCardToHost(cardBuffer);
      if (hostedUrl) {
        const textWithMedia = `<a href="${hostedUrl}">&#8205;</a>${text}`;
        try {
          return await ctx.editMessageText(textWithMedia, {
            parse_mode: 'HTML',
            reply_markup: kb,
            link_preview_options: {
              url: hostedUrl,
              prefer_large_media: true,
              show_above_text: true,
            },
          });
        } catch (editMediaErr) {
          console.warn('⟡ Info: Aviso editando mensaje de usuario con preview (usando fallback):', editMediaErr.message);
        }
      }

      // 2. Fallback: Foto nueva con caption y eliminación del mensaje anterior
      const cardFile = new InputFile(cardBuffer, `perfil_${resolvedId || username}.png`);

      const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
      const messageId = ctx.callbackQuery?.message?.message_id;
      const replyToMsgId = ctx.callbackQuery?.message?.reply_to_message?.message_id;
      const replyOptions = {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: kb,
      };
      if (replyToMsgId) {
        replyOptions.reply_parameters = { message_id: replyToMsgId };
      }

      await ctx.replyWithPhoto(cardFile, replyOptions);
      try {
        if (chatId && messageId) {
          await ctx.api.deleteMessage(chatId, messageId);
        } else {
          await ctx.deleteMessage();
        }
      } catch (delErr) {
        console.warn('⟡ Info: Aviso - No se pudo eliminar mensaje previo (requiere permiso Eliminar Mensajes):', delErr.message);
      }
    } catch (err) {
      console.error('⟡ Info: Error en info_view_card_user:', err.message);
    }
  });

  // ── Callback: Volver a la Vista Principal del Perfil (o desde Search) ──
  bot.callbackQuery(/^(?:info_back|info_profile):(\d+)$/, async (ctx) => {
    try {
      const targetId = parseInt(ctx.match[1]);
      await ctx.answerCallbackQuery();

      const { text, keyboard } = await buildUserProfile(ctx, { userId: targetId });
      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      } catch (editErr) {
        if (!editErr.message?.includes('message is not modified')) {
          console.error('⟡ Info: Error editando perfil info_back:', editErr.message);
        }
      }
    } catch (err) {
      if (!err.message?.includes('message is not modified')) {
        console.error('⟡ Info: Error en info_back:', err.message);
      }
    }
  });

  // ── Callback: Búsqueda Global en Telegram (/info) ──
  bot.callbackQuery(/^info_global:(.+)$/, async (ctx) => {
    try {
      const rawQuery = decodeURIComponent(ctx.match[1]);
      const cleanQuery = rawQuery.replace(/^@/, '').trim();
      await ctx.answerCallbackQuery({ text: '⟡ Buscando fuera de la comunidad en Telegram...' });

      const resultsMap = new Map();

      // 1. Resolver por username exacto vía Bot API o Userbot si no tiene espacios
      if (!cleanQuery.includes(' ')) {
        try {
          const chatInfo = await ctx.api.getChat(`@${cleanQuery}`);
          if (chatInfo && chatInfo.id) {
            resultsMap.set(Number(chatInfo.id), {
              userId: Number(chatInfo.id),
              username: chatInfo.username || cleanQuery,
              firstName: chatInfo.first_name || 'Usuario',
              isGlobal: true,
            });
            db.upsertUser(chatInfo.id, chatInfo.username, chatInfo.first_name).catch(() => {});
          }
        } catch {}

        if (userbot.isConnected() && resultsMap.size === 0) {
          try {
            const ubUser = await userbot.resolveUser(cleanQuery);
            if (ubUser && ubUser.userId) {
              resultsMap.set(Number(ubUser.userId), {
                userId: Number(ubUser.userId),
                username: ubUser.username || cleanQuery,
                firstName: ubUser.firstName || 'Usuario',
                isGlobal: true,
              });
              db.upsertUser(ubUser.userId, ubUser.username, ubUser.firstName).catch(() => {});
            }
          } catch {}
        }
      }

      // 2. Si no hubo match directo o la consulta tiene espacios, buscar global vía MTProto
      if (userbot.isConnected() && resultsMap.size === 0) {
        try {
          const globalList = await userbot.searchGlobalTelegram(cleanQuery, 10);
          for (const u of globalList) {
            const uid = Number(u.user_id);
            if (!resultsMap.has(uid)) {
              resultsMap.set(uid, {
                userId: uid,
                username: u.username || null,
                firstName: u.first_name || 'Usuario',
                isGlobal: true,
              });
              db.upsertUser(uid, u.username, u.first_name).catch(() => {});
            }
          }
        } catch {}
      }

      const globalResults = Array.from(resultsMap.values());

      if (globalResults.length === 0) {
        return await ctx.editMessageText(
          `⟡ <b>BÚSQUEDA GLOBAL EN TELEGRAM</b> ⊱ <code>SIN COINCIDENCIAS</code> ⊰\n` +
          `══════\n\n` +
          `✗ No se localizó ninguna cuenta en Telegram para: <code>${escapeHtml(cleanQuery)}</code>\n\n` +
          `──────\n` +
          `▪ <i>Verifica que el @username o nombre esté correctamente escrito.</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard().text('✖ Cerrar', 'info_close'),
          }
        );
      }

      if (globalResults.length === 1) {
        const { text, keyboard } = await buildUserProfile(ctx, globalResults[0]);
        return await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      }

      // Si hay varios resultados globales
      const kb = new InlineKeyboard();
      for (const u of globalResults.slice(0, 8)) {
        const uLabel = `${u.firstName || 'Usuario'}${u.username ? ` (@${u.username})` : ` [${u.userId}]`}`;
        kb.text(`🌐 ${uLabel.slice(0, 30)}`, `info_profile:${u.userId}`).row();
      }
      kb.text('✖ Cerrar', 'info_close');

      await ctx.editMessageText(
        `🌐 <b>RESULTADOS GLOBALES EN TELEGRAM</b>\n` +
        `══════\n\n` +
        `Se encontraron <b>${globalResults.length}</b> cuentas en Telegram para: <code>${escapeHtml(cleanQuery)}</code>\n\n` +
        `<i>Selecciona al usuario para ver su información:</i>\n` +
        `──────`,
        {
          parse_mode: 'HTML',
          reply_markup: kb,
        }
      );
    } catch (err) {
      console.error('⟡ Info: Error en callback info_global:', err.message);
    }
  });

  // ── Callback: Generar Tarjeta de Perfil desde Selección (/perfil) ──
  bot.callbackQuery(/^perfil_card:(\d+)$/, async (ctx) => {
    try {
      const targetId = Number(ctx.match[1]);
      await ctx.answerCallbackQuery({ text: '⟡ Generando tarjeta...' });
      await sendUserCard(ctx, { userId: targetId });
    } catch (err) {
      console.error('⟡ Info: Error en callback perfil_card:', err.message);
    }
  });

  // ── Callback: Búsqueda Global para Tarjeta de Perfil (/perfil) ──
  bot.callbackQuery(/^perfil_global:(.+)$/, async (ctx) => {
    try {
      const rawQuery = decodeURIComponent(ctx.match[1]);
      const cleanQuery = rawQuery.replace(/^@/, '').trim();
      await ctx.answerCallbackQuery({ text: '⟡ Buscando globalmente en Telegram...' });

      let resolvedTarget = null;

      if (!cleanQuery.includes(' ')) {
        try {
          const chatInfo = await ctx.api.getChat(`@${cleanQuery}`);
          if (chatInfo && chatInfo.id) {
            resolvedTarget = {
              userId: Number(chatInfo.id),
              username: chatInfo.username || cleanQuery,
              firstName: chatInfo.first_name || 'Usuario',
              isGlobal: true,
            };
          }
        } catch {}

        if (!resolvedTarget && userbot.isConnected()) {
          try {
            const ub = await userbot.resolveUser(cleanQuery);
            if (ub && ub.userId) {
              resolvedTarget = {
                userId: Number(ub.userId),
                username: ub.username || cleanQuery,
                firstName: ub.firstName || 'Usuario',
                isGlobal: true,
              };
            }
          } catch {}
        }
      }

      if (!resolvedTarget && userbot.isConnected()) {
        try {
          const globalList = await userbot.searchGlobalTelegram(cleanQuery, 5);
          if (globalList && globalList.length > 0) {
            resolvedTarget = {
              userId: Number(globalList[0].user_id),
              username: globalList[0].username || null,
              firstName: globalList[0].first_name || 'Usuario',
              isGlobal: true,
            };
          }
        } catch {}
      }

      if (resolvedTarget) {
        await sendUserCard(ctx, resolvedTarget);
      } else {
        await ctx.reply(
          `⟡ ✗ No se localizó a ningún usuario global en Telegram para: <code>${escapeHtml(cleanQuery)}</code>`,
          { parse_mode: 'HTML' }
        );
      }
    } catch (err) {
      console.error('⟡ Info: Error en callback perfil_global:', err.message);
    }
  });

  // ── Callback: Cerrar Panel ──
  bot.callbackQuery('info_close', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      await ctx.deleteMessage();
    } catch {
      try {
        await ctx.editMessageText('⟡ Panel cerrado.');
      } catch {}
    }
  });
}

module.exports = {
  register,
  buildUserProfile,
  buildUserProfileByUsername,
};
