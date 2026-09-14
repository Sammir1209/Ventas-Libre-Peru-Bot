const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM, ROLES } = require('../../config/constants');
const { resolveTarget } = require('../../utils/helpers');
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
  };
  const dStr = date.toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\D/g, ''); // "13092026"

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
 * 🔗 Link de perfil: Presiona aquí
 * ──────
 * ¹⁴⁰⁹²⁰²⁶
 */
async function buildUserProfile(ctx, targetUser) {
  const userId = targetUser.userId;
  let username = targetUser.username;
  let firstName = targetUser.firstName;

  // Si faltan datos de nombre/username, consultar API
  if (!username || !firstName) {
    try {
      const chatInfo = await ctx.api.getChat(userId);
      if (chatInfo) {
        if (!username) username = chatInfo.username || null;
        if (!firstName) firstName = chatInfo.first_name || null;
      }
    } catch {}
  }
  if (!firstName) {
    try {
      const u = await db.getUser(userId);
      if (u) {
        if (!username) username = u.username || null;
        if (!firstName) firstName = u.first_name || null;
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

  const text =
    `<b>⟡ [${escapeHtml(botLabel)} BOT] PERFIL DE USUARIO</b>\n` +
    `──────\n\n` +
    `▸ <b>Nombre:</b> ${nameDisplay}\n` +
    `▸ <b>ID:</b> <a href="tg://user?id=${userId}">${userId}</a>\n` +
    `▸ <b>User:</b> ${userDisplay}\n` +
    `▸ <b>Rol:</b> ${escapeHtml(roleName)}\n` +
    `▸ <b>Link de perfil:</b> <a href="tg://user?id=${userId}">Presiona aquí</a>\n\n` +
    `──────\n` +
    `${dateFormatted}`;

  const profileUrl = username ? `https://t.me/${username}` : `tg://user?id=${userId}`;
  const keyboard = new InlineKeyboard()
    .url('Perfil', profileUrl)
    .text('Verificar', `info_check_burn:${userId}`);

  return { text, keyboard };
}

function register(bot) {
  // ── Comando /perfil [ID, @username o responder] (Solo la tarjeta / card) ──
  bot.command('perfil', async (ctx) => {
    try {
      let target = await resolveTarget(ctx);

      if (!target) {
        target = {
          userId: ctx.from.id,
          username: ctx.from.username || null,
          firstName: ctx.from.first_name || null,
        };
      }

      if (target.unresolved) {
        return ctx.reply(
          `${SYM.CROSS} No se pudo obtener la información de <b>@${target.username}</b> automáticamente.\n\n` +
          `${SYM.ARROW} Esto ocurre si el usuario nunca ha iniciado el bot o su cuenta es privada.\n\n` +
          `${SYM.STAR} <b>Soluciones:</b>\n` +
          `${SYM.BULLET} Pídele que le envíe <code>/start</code> al bot una sola vez.\n` +
          `${SYM.BULLET} O consulta su perfil usando su <b>ID numérico</b>: <code>/perfil [ID]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      const statusMsg = await ctx.reply('▪ <i>Generando tarjeta de perfil...</i>', { parse_mode: 'HTML' });

      const { cardBuffer, userId: resolvedId } = await generateUserCardBuffer(ctx.api, target, {
        tenantId: ctx.tenant?.id,
        ownerIds: ctx.tenant?.owner_ids,
        communityName: ctx.tenant?.community_name || 'Comunidad Oficial',
      });
      const cardFile = new InputFile(cardBuffer, `perfil_${resolvedId || target.userId || 'user'}.png`);

      // Se envía únicamente la tarjeta gráfica limpia (sin texto largo de info)
      await ctx.replyWithPhoto(cardFile);

      try {
        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
      } catch {}
    } catch (err) {
      console.error('⟡ Info: Error en /perfil:', err.message);
      await ctx.reply(`⟡ ✗ Error al generar perfil: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Comando /info [ID, @username o responder] (Plantilla original en texto) ──
  bot.command('info', async (ctx) => {
    try {
      let target = await resolveTarget(ctx);

      // Si no se pasó argumento ni es reply, consultar el perfil propio
      if (!target) {
        target = {
          userId: ctx.from.id,
          username: ctx.from.username || null,
          firstName: ctx.from.first_name || null,
        };
      }

      if (target.unresolved) {
        return ctx.reply(
          `${SYM.CROSS} No se pudo obtener la información de <b>@${target.username}</b> automáticamente.\n\n` +
          `${SYM.ARROW} Esto ocurre si el usuario nunca ha iniciado el bot o su cuenta es privada.\n\n` +
          `${SYM.STAR} <b>Soluciones:</b>\n` +
          `${SYM.BULLET} Pídele que le envíe <code>/start</code> al bot una sola vez.\n` +
          `${SYM.BULLET} O consulta su información usando su <b>ID numérico</b>: <code>/info [ID]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      const { text, keyboard } = await buildUserProfile(ctx, target);
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
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
      const targetId = parseInt(ctx.match[1]);
      await ctx.answerCallbackQuery({ text: '⟡ Consultando base de datos de estafas...' });

      // Consultar si está quemado
      const burnInfo = await db.getBurnedUserInfo(targetId);

      let targetUsername = null;
      let targetFirstName = null;
      try {
        const chatInfo = await ctx.api.getChat(targetId);
        targetUsername = chatInfo.username || null;
        targetFirstName = chatInfo.first_name || null;
      } catch {}

      const userMention = mentionFromData(targetId, targetUsername, targetFirstName);

      if (!burnInfo) {
        // USUARIO LIMPIO
        const cleanText =
          `⟡ <b>CONSULTA DE ANTECEDENTES</b> ⊱ <code>REGISTRO LIMPIO</code> ⊰\n` +
          `══════\n\n` +
          `▸ <b>Usuario:</b> ${userMention}\n` +
          `▸ <b>ID:</b> <code>${targetId}</code>\n` +
          `▸ <b>Estado:</b> ⊱ <code>LIMPIO [ VERIFICADO ]</code> ⊰\n\n` +
          `──────\n` +
          `✓ <i>Este usuario NO registra antecedentes de estafa ni sanciones en la base de datos oficial.</i>`;

        const kb = new InlineKeyboard()
          .text('« VOLVER AL PERFIL', `info_back:${targetId}`).primary();

        try {
          await ctx.editMessageText(cleanText, {
            parse_mode: 'HTML',
            reply_markup: kb,
          });
        } catch (editErr) {
          if (!editErr.message?.includes('message is not modified')) {
            console.error('⟡ Info: Error editando mensaje cleanText:', editErr.message);
          }
        }
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

        const burnText =
          `⟡ <b>[ LISTA NEGRA OFICIAL ] REGISTRO DE ESTAFADOR</b>\n` +
          `══════\n\n` +
          `▸ <b>Usuario:</b> ${userMention}\n` +
          `▸ <b>ID:</b> <code>${targetId}</code>\n` +
          `▸ <b>Estado:</b> ⊱ <code>QUEMADO / ESTAFADOR [ SANCIONADO ]</code> ⊰\n` +
          `▸ <b>Fecha:</b> <code>${dateStr}</code>\n` +
          `▸ <b>Motivo / Hechos:</b>\n  ↳ <i>${escapeHtml(burnInfo.context || 'Reporte de estafa confirmado')}</i>\n\n` +
          `▸ <b>Reportado por:</b> <code>${burnInfo.reported_by || 'Staff'}</code>\n` +
          `──────\n` +
          `⟡ <b>ADVERTENCIA DE SEGURIDAD:</b>\n` +
          `<i>No realices transferencias, pagos ni entregas con este usuario bajo ninguna circunstancia.</i>`;

        const kb = new InlineKeyboard()
          .text('« VOLVER AL PERFIL', `info_back:${targetId}`).primary();

        try {
          await ctx.editMessageText(burnText, {
            parse_mode: 'HTML',
            reply_markup: kb,
          });
        } catch (editErr) {
          if (!editErr.message?.includes('message is not modified')) {
            console.error('⟡ Info: Error editando mensaje burnText:', editErr.message);
          }
        }
      }
    } catch (err) {
      if (!err.message?.includes('message is not modified')) {
        console.error('⟡ Info: Error en info_check_burn:', err.message);
      }
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
};
