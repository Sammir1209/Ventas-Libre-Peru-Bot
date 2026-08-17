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

  // 1. Obtener rol en el bot
  let botRole = 'USUARIO (Sin Rango)';
  if (config.OWNER_IDS.includes(userId)) {
    botRole = 'OWNER';
  } else {
    try {
      const staff = await db.getStaffMember(userId);
      if (staff && staff.role) {
        botRole = staff.role;
      }
    } catch {}
  }

  // 2. Obtener conteo de tratos
  let dealsCount = 0;
  try {
    dealsCount = await db.getUserDealsCount(userId);
  } catch {}

  // 3. Obtener rating si es Trato Admin
  let ratingText = '';
  if (botRole === ROLES.DEAL_ADMIN) {
    try {
      const ratingData = await db.getAdminAvgRating(userId);
      const avg = parseFloat(ratingData.avg_rating || 0);
      const total = ratingData.total_ratings || 0;
      ratingText = `\n${SYM.ARROW} <b>Reputación:</b> <b>${avg > 0 ? avg.toFixed(1) : '5.0'} / 5.0 ⭐</b> (${total} calificaciones)`;
    } catch {}
  }

  // 4. Verificación en BD
  let isVerifiedText = 'No verificado';
  try {
    const dbUser = await db.getUser(userId);
    if (dbUser && dbUser.is_verified) {
      isVerifiedText = 'Sí ✓';
    }
  } catch {}

  const userMention = mentionFromData(userId, username, firstName);

  const text =
    `${SYM.DIVIDER}\n` +
    `${SYM.CROWN} <b>PERFIL OFICIAL DE USUARIO</b> ${SYM.BADGE}\n` +
    `${SYM.DIVIDER}\n\n` +
    `${SYM.ARROW} <b>Nombre:</b> <b>${escapeHtml(firstName || 'Usuario')}</b>\n` +
    `${SYM.ARROW} <b>Usuario:</b> ${username ? `@${username}` : '<i>Sin @username</i>'}\n` +
    `${SYM.ARROW} <b>ID:</b> <code>${userId}</code>\n\n` +
    `${SYM.THIN_LINE}\n` +
    `${SYM.ARROW} <b>Rango en el Bot:</b> <b>${botRole}</b>\n` +
    `${SYM.ARROW} <b>Tratos Realizados:</b> <b>${dealsCount} Trato(s)</b>` +
    ratingText + '\n' +
    `${SYM.ARROW} <b>Verificado en Canales:</b> <b>${isVerifiedText}</b>\n` +
    `${SYM.THIN_LINE}\n\n` +
    `${SYM.STAR} <i>Consulta de antecedentes y registros de estafas:</i>`;

  const keyboard = new InlineKeyboard()
    .text(`⛊ Antecedentes`, `info_check_burn:${userId}`).success()
    .text(`✗ Cerrar`, 'info_close').danger();

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
          .text(`⟡ Volver`, `info_back:${targetId}`).primary()
          .text(`✗ Cerrar`, 'info_close').danger();

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
        const dateStr = burnInfo.created_at
          ? new Date(burnInfo.created_at).toLocaleDateString('es-PE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
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
          .text(`⟡ Volver`, `info_back:${targetId}`).primary()
          .text(`✗ Cerrar`, 'info_close').danger();

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

  // ── Callback: Volver a la Vista Principal del Perfil ──
  bot.callbackQuery(/^info_back:(\d+)$/, async (ctx) => {
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

module.exports = { register };
