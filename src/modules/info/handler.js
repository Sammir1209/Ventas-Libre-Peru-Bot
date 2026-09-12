const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM, ROLES } = require('../../config/constants');
const { resolveTarget } = require('../../utils/helpers');
const { mentionFromData, formatId, escapeHtml } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');

// ══════════════════════════════════════════════════════
// ⟡ Módulo: Información de Usuario y Consulta de Antecedentes (/info)
// ══════════════════════════════════════════════════════

/**
 * Construye los datos y plantilla principal del perfil de usuario.
 */
async function buildUserProfile(ctx, targetUser) {
  const userId = targetUser.userId;
  let username = targetUser.username;
  let firstName = targetUser.firstName;

  // Si faltan datos de nombre/username, consultar API
  if (!username || !firstName) {
    try {
      const chatInfo = await ctx.api.getChat(userId);
      if (!username) username = chatInfo.username || null;
      if (!firstName) firstName = chatInfo.first_name || null;
    } catch {}
  }

  // 1. Obtener rol y custom title en BD
  let rolesList = [];
  let customTitle = null;
  const effectiveOwners = ctx.tenant?.owner_ids || config.OWNER_IDS;
  const tenantId = ctx.tenant?.id || null;
  const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';

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

  // 2. Obtener conteo de tratos
  let dealsCount = 0;
  try {
    dealsCount = await db.getUserDealsCount(userId);
  } catch {}

  // 3. Rating si es trato admin
  let rating = '5.0';
  let totalRatings = 0;
  const isDealAdmin = rolesList.some((r) => r.includes('TRATO ADMIN') || r.includes('TRATOADMIN'));
  if (isDealAdmin) {
    try {
      const rData = await db.getAdminAvgRating(userId);
      if (rData && rData.avg_rating) rating = parseFloat(rData.avg_rating).toFixed(1);
      if (rData && rData.total_ratings) totalRatings = rData.total_ratings;
    } catch {}
  }

  // 4. Verificación en BD
  let isVerified = false;
  try {
    const dbUser = await db.getUser(userId);
    if (dbUser && (dbUser.verified || dbUser.is_verified)) {
      isVerified = true;
    }
  } catch {}

  const userTag = username ? `<code>@${username}</code>` : '<i>Sin @username</i>';
  const nameFormatted = escapeHtml(firstName || 'Usuario');
  let text = '';

  // 0. Comprobar si el usuario está en la Lista Negra (Quemado / GBAN)
  let burnInfo = null;
  try {
    burnInfo = await db.getBurnedUserInfo(userId) || (username ? await db.getBurnedUserInfo(username) : null);
  } catch {}

  if (burnInfo) {
    const dateFormatted = burnInfo.burned_at || burnInfo.created_at
      ? new Date(burnInfo.burned_at || burnInfo.created_at).toLocaleString('es-PE', {
          timeZone: 'America/Lima',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : 'Fecha no registrada';

    text =
      `🚨 <b>ALERTA DE SEGURIDAD — USUARIO QUEMADO</b> 🚨\n\n` +
      `• <b>Nombre:</b> <b>${nameFormatted}</b>\n` +
      `• <b>Usuario:</b> ${userTag}\n` +
      `• <b>ID:</b> <code>${userId}</code>\n\n` +
      `🔴 <b>ESTADO OFICIAL:</b> <b>QUEMADO / LISTA NEGRA (GBAN)</b>\n` +
      `📝 <b>Motivo:</b> <i>${escapeHtml(burnInfo.context || 'Estafa comprobada / Infracción grave')}</i>\n` +
      `📅 <b>Fecha de Sanción:</b> <code>${dateFormatted}</code>\n` +
      (burnInfo.reported_by ? `👮 <b>Sancionado por:</b> <code>${burnInfo.reported_by}</code>\n\n` : '\n') +
      `⛔ <b>ADVERTENCIA DE SEGURIDAD:</b>\n` +
      `Este usuario se encuentra registrado en la <b>Lista Negra Oficial</b> por conducta fraudulenta o infracción crítica. Queda prohibido comerciar con él.\n\n` +
      `🛡️ <i>${escapeHtml(communityName)} — Escudo de Protección</i>`;

    const keyboard = new InlineKeyboard()
      .text('VER ANTECEDENTES', `info_check_burn:${userId}`).danger()
      .text('CERRAR', 'info_close').primary();

    return { text, keyboard };
  }

  if (rolesList.length > 0) {
    // Es Staff (Puede tener 1 o múltiples roles)
    const isOwner = rolesList.includes('OWNER');
    const isCoOwner = rolesList.includes('CO-OWNER') || rolesList.includes('COOWNER');
    const isAdmin = rolesList.includes('ADMIN') || rolesList.includes('ADMINISTRADOR');

    let headerIcon = '🛡️';
    let headerTitle = 'STAFF OFICIAL';
    if (isOwner) {
      headerIcon = '👑';
      headerTitle = 'PROPIETARIO (OWNER)';
    } else if (isCoOwner) {
      headerIcon = '⚜️';
      headerTitle = 'CO-OWNER';
    } else if (isDealAdmin && !isAdmin) {
      headerIcon = '🤝';
      headerTitle = 'TRATO ADMIN OFICIAL';
    } else if (isAdmin) {
      headerIcon = '⚔️';
      headerTitle = 'ADMINISTRADOR OFICIAL';
    }

    text =
      `${headerIcon} <b>PERFIL OFICIAL — ${headerTitle}</b> ${headerIcon}\n\n` +
      `• <b>Nombre:</b> <b>${nameFormatted}</b>\n` +
      `• <b>Usuario:</b> ${userTag}\n` +
      `• <b>ID:</b> <code>${userId}</code>\n\n` +
      `⚜️ <b>Roles Asignados:</b> <b>${rolesList.join(' + ')}</b>\n` +
      (customTitle ? `🏷️ <b>Tag en Grupos:</b> <code>${escapeHtml(customTitle)}</code>\n` : '');

    if (isDealAdmin) {
      text +=
        `💼 <b>Mediaciones Realizadas:</b> <b>${dealsCount} caso(s)</b>\n` +
        `⭐ <b>Reputación de Mediador:</b> <b>${rating} / 5.0</b> (${totalRatings} reseñas)\n`;
    } else {
      text += `📦 <b>Tratos Realizados:</b> <b>${dealsCount} caso(s)</b>\n`;
    }

    text +=
      `🟢 <b>Estado:</b> <b>Miembro del Staff Activo</b>\n\n` +
      `🛡️ <i>${escapeHtml(communityName)} — Equipo Oficial</i>`;
  } else {
    // USUARIO NORMAL (Limpio, estético y nada recargado)
    const verifiedStatus = isVerified ? 'Verificado 🟢' : 'Pendiente ⚪';
    text =
      `👤 <b>PERFIL DE USUARIO</b>\n\n` +
      `• <b>Nombre:</b> <b>${nameFormatted}</b>\n` +
      `• <b>Usuario:</b> ${userTag}\n` +
      `• <b>ID:</b> <code>${userId}</code>\n\n` +
      `• <b>Rango:</b> <b>Usuario de la Comunidad</b>\n` +
      `• <b>Canales:</b> <b>${verifiedStatus}</b>\n` +
      `• <b>Tratos Realizados:</b> <b>${dealsCount} completado(s)</b>\n\n` +
      `<i>Consulta de antecedentes y registros de seguridad:</i>`;
  }

  const keyboard = new InlineKeyboard()
    .text('ANTECEDENTES', `info_check_burn:${userId}`).success()
    .text('CERRAR', 'info_close').danger();

  return { text, keyboard };
}

function register(bot) {
  // ── Comando /info [ID, @username o responder] ──
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
          `${SYM.BULLET} O consulta su perfil usando su <b>ID numérico</b>: <code>/info [ID]</code>`,
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
        `${SYM.DIVIDER}\n` +
        `🔍 <b>IDENTIFICADORES (IDs)</b>\n` +
        `${SYM.DIVIDER}\n\n` +
        `➜ <b>ID de este Chat:</b> <code>${ctx.chat.id}</code>\n`;
      
      if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        replyText += `➜ <b>Tipo de Chat:</b> Grupo\n`;
      } else if (ctx.chat.type === 'channel') {
        replyText += `➜ <b>Tipo de Chat:</b> Canal\n`;
      } else {
        replyText += `➜ <b>Tipo de Chat:</b> Privado\n`;
      }

      replyText += `\n`;

      if (ctx.message?.reply_to_message) {
        const repliedUser = ctx.message.reply_to_message.from;
        replyText += `➜ <b>ID del usuario respondido:</b> <code>${repliedUser.id}</code>\n`;
      } else {
        replyText += `➜ <b>Tu ID:</b> <code>${ctx.from.id}</code>\n`;
      }

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
        `${SYM.SEAL} <b>ENLACE DE INVITACIÓN</b> ${SYM.BADGE}\n\n` +
        (isGroup ? `👥 <b>Grupo:</b> ${escapeHtml(groupTitle)}\n\n` : `🇵🇪 <b>Comunidad:</b> Ventas Libres Perú\n\n`) +
        `🔗 <b>Enlace Oficial:</b>\n<code>${finalLink}</code>\n\n` +
        `<i>Comparte este enlace para invitar a tus amigos y comerciantes a la comunidad.</i>`;

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
          `${SYM.DIVIDER}\n` +
          `${SYM.SHIELD} <b>CONSULTA DE ANTECEDENTES</b> ${SYM.CHECK}\n` +
          `${SYM.DIVIDER}\n\n` +
          `${SYM.ARROW} <b>Usuario:</b> ${userMention}\n` +
          `${SYM.ARROW} <b>ID:</b> <code>${targetId}</code>\n` +
          `${SYM.ARROW} <b>Estado:</b> <b>LIMPIO 🟢</b>\n\n` +
          `${SYM.THIN_LINE}\n` +
          `${SYM.STAR} Este usuario <b>NO registra antecedentes</b> ni sanciones por estafa en la base de datos oficial.\n` +
          `${SYM.THIN_LINE}`;

        const kb = new InlineKeyboard()
          .text('VOLVER', `info_back:${targetId}`).primary()
          .text('CERRAR', 'info_close').danger();

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
          `${SYM.DIVIDER}\n` +
          `${SYM.ALERT} <b>ALERTA: USUARIO QUEMADO</b> ${SYM.WARNING}\n` +
          `${SYM.DIVIDER}\n\n` +
          `${SYM.CROSS} <b>Usuario:</b> ${userMention}\n` +
          `${SYM.ARROW} <b>ID:</b> <code>${targetId}</code>\n` +
          `${SYM.CROSS} <b>Estado:</b> <b>QUEMADO / ESTAFADOR 🔴</b>\n\n` +
          `${SYM.THIN_LINE}\n` +
          `${SYM.ARROW} <b>Motivo / Contexto:</b>\n<i>${escapeHtml(burnInfo.context || 'Reporte de estafa confirmado')}</i>\n\n` +
          `${SYM.ARROW} <b>Reportado por:</b> <code>${burnInfo.reported_by || 'Staff'}</code>\n` +
          `${SYM.ARROW} <b>Fecha de Registro:</b> ${dateStr}\n` +
          `${SYM.THIN_LINE}\n\n` +
          `${SYM.WARNING} <b>ADVERTENCIA DE SEGURIDAD:</b>\n` +
          `No realices transferencias, depósitos ni entregas de productos con este usuario bajo ninguna circunstancia.`;

        const kb = new InlineKeyboard()
          .text('VOLVER', `info_back:${targetId}`).primary()
          .text('CERRAR', 'info_close').danger();

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
