// ══════
// ⟡ Módulo de Difusión & Anuncios Masivos (/anun)
//   Preservación 100% de Emojis Premium, Fotos y Formatos Nativos
// ══════

const { InlineKeyboard } = require('grammy');
const db = require('../../database/postgres');
const config = require('../../config/env');
const { requireStaff } = require('../../middleware/auth');
const { escapeHtml, getSuperscriptDate } = require('../../utils/formatting');
const { toMathBold } = require('../../utils/aesthetic');

// Enlaces oficiales obligatorios para los botones
const GROUP_LINK = 'https://t.me/+hbIoqDOFBFFkMTM1';
const CHANNEL_LINK = 'https://t.me/+eFf0dp93AfJmMGNh';

// Almacén en memoria para borradores de anuncios pendientes de confirmación
// Map<draftId, { fromChatId, messageId, creatorId, tenantId, createdAt }>
const draftsMap = new Map();

// Limpieza periódica de borradores caducados (TTL de 15 minutos)
setInterval(() => {
  const now = Date.now();
  for (const [id, draft] of draftsMap.entries()) {
    if (now - draft.createdAt > 15 * 60 * 1000) {
      draftsMap.delete(id);
    }
  }
}, 60000);

/**
 * Genera el teclado con los 2 botones obligatorios del anuncio: GROUP y CHANNEL.
 */
function buildBroadcastKeyboard() {
  return new InlineKeyboard()
    .url(`❖ ${toMathBold('GROUP')}`, GROUP_LINK)
    .url(`✦ ${toMathBold('CHANNEL')}`, CHANNEL_LINK);
}

/**
 * Espera pasiva para respetar los límites de la API de Telegram y evitar FloodWait.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function register(bot) {
  // ── Comando /anun (y alias: anuncio, difundir, broadcast) ──
  bot.command(['anun', 'anuncio', 'difundir', 'broadcast'], requireStaff(), async (ctx) => {
    try {
      const replyTo = ctx.message?.reply_to_message;

      if (!replyTo) {
        return await ctx.reply(
          `⟡ <b>[SISTEMA DE ANUNCIOS & DIFUSIÓN]</b> ⊱ <code>INFO</code> ⊰\n` +
          `──────\n` +
          `▪ <b>Modo de uso:</b>\n` +
          `  ↳ Responde a cualquier mensaje (texto, foto, video o con emojis premium) con <code>/anun</code>.\n\n` +
          `▪ <b>Características:</b>\n` +
          `  ↳ Conserva al 100% el formato, imágenes y emojis de Telegram Premium.\n` +
          `  ↳ Adjunta automáticamente los botones oficiales <b>GROUP</b> y <b>CHANNEL</b>.\n` +
          `  ↳ Muestra un panel de confirmación previo y un reporte final de entrega.\n` +
          `──────\n` +
          `<i>Selecciona un mensaje y responde con <code>/anun</code> para comenzar.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      const tenantId = ctx.tenant?.id || null;
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';

      // 1. Obtener la lista de grupos y canales registrados
      let officialGroups = [];
      try {
        officialGroups = await db.getAllGroups(tenantId);
      } catch (dbErr) {
        console.warn('⟡ Error obteniendo official_groups para anuncio:', dbErr.message);
      }

      // Filtrar chats únicos
      const chatMap = new Map();
      for (const g of officialGroups) {
        chatMap.set(String(g.chat_id), g);
      }

      const allTargets = Array.from(chatMap.values());
      const groupsCount = allTargets.filter(
        (t) => t.type === 'group' || t.type === 'supergroup'
      ).length;
      const channelsCount = allTargets.filter((t) => t.type === 'channel').length;
      const totalDestinos = allTargets.length;

      // 2. Registrar el borrador
      const draftId = `draft_${Date.now()}_${ctx.from.id}`;
      draftsMap.set(draftId, {
        fromChatId: ctx.chat.id,
        messageId: replyTo.message_id,
        creatorId: ctx.from.id,
        tenantId,
        targets: allTargets,
        createdAt: Date.now(),
      });

      // 3. Renderizar el panel de confirmación
      const confirmText =
        `⟡ <b>[SISTEMA DE DIFUSIÓN]</b> ⊱ <code>CONFIRMACIÓN</code> ⊰\n` +
        `──────\n` +
        `▪ <b>Mensaje de origen:</b> Detectado correctamente ✓\n` +
        `▪ <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n\n` +
        `▪ <b>Destinos oficiales registrados:</b>\n` +
        `  ↳ <b>Grupos:</b> <code>${groupsCount}</code>\n` +
        `  ↳ <b>Canales:</b> <code>${channelsCount}</code>\n` +
        `  ↳ <b>Total receptores:</b> <code>${totalDestinos}</code>\n\n` +
        `▪ <b>Botones integrados al anuncio:</b>\n` +
        `  • <b>GROUP</b> ➔ <code>${GROUP_LINK}</code>\n` +
        `  • <b>CHANNEL</b> ➔ <code>${CHANNEL_LINK}</code>\n` +
        `──────\n` +
        `<i>¿Confirmas la emisión masiva inmediata?</i>`;

      const kb = new InlineKeyboard()
        .text(`✦ ${toMathBold('ENVIAR ANUNCIO')}`, `anun_send:${draftId}`)
        .text(`✕ ${toMathBold('CANCELAR')}`, `anun_cancel:${draftId}`);

      await ctx.reply(confirmText, {
        parse_mode: 'HTML',
        reply_markup: kb,
        reply_to_message_id: replyTo.message_id,
      });
    } catch (err) {
      console.error('⟡ Error en comando /anun:', err.message);
      await ctx.reply(`⟡ ✗ Error al preparar anuncio: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Callback: Cancelar Anuncio ──
  bot.callbackQuery(/^anun_cancel:(.+)$/, async (ctx) => {
    try {
      const draftId = ctx.match[1];
      const draft = draftsMap.get(draftId);

      if (draft && draft.creatorId !== ctx.from.id && !config.OWNER_IDS.includes(ctx.from.id)) {
        return await ctx.answerCallbackQuery({
          text: 'Solo quien inició la solicitud puede cancelarla.',
          show_alert: true,
        });
      }

      draftsMap.delete(draftId);
      await ctx.answerCallbackQuery({ text: 'Difusión cancelada.' });
      await ctx.editMessageText(
        `⟡ <b>[DIFUSIÓN CANCELADA]</b>\n──────\n<i>El envío del anuncio ha sido descartado.</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.warn('⟡ Error en anun_cancel:', err.message);
    }
  });

  // ── Callback: Proceder con el Envío Masivo ──
  bot.callbackQuery(/^anun_send:(.+)$/, async (ctx) => {
    try {
      const draftId = ctx.match[1];
      const draft = draftsMap.get(draftId);

      if (!draft) {
        return await ctx.answerCallbackQuery({
          text: 'Esta solicitud de anuncio ha caducado. Vuelve a ejecutar /anun.',
          show_alert: true,
        });
      }

      if (draft.creatorId !== ctx.from.id && !config.OWNER_IDS.includes(ctx.from.id)) {
        return await ctx.answerCallbackQuery({
          text: 'Solo el creador del anuncio o un Owner puede autorizar el envío.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery({ text: 'Iniciando emisión masiva...' });

      // Notificar en la interfaz que el envío está en curso
      await ctx.editMessageText(
        `⟡ <b>[TRANSMISIÓN EN PROCESO]</b> ⊱ <code>ENVIANDO...</code> ⊰\n` +
        `──────\n` +
        `⏳ <i>Emitiendo el anuncio a todos los grupos y canales oficiales...</i>\n` +
        `<i>Por favor espera mientras se generan los acuses de recibo.</i>`,
        { parse_mode: 'HTML' }
      );

      const targets = draft.targets || [];
      const broadcastKeyboard = buildBroadcastKeyboard();

      let successCount = 0;
      let failCount = 0;
      const errorsList = [];

      for (const target of targets) {
        try {
          // Usar copyMessage para garantizar el 100% de formato, imágenes y emojis premium
          await ctx.api.copyMessage(target.chat_id, draft.fromChatId, draft.messageId, {
            reply_markup: broadcastKeyboard,
          });
          successCount++;
          // Retardo preventivo para respetar límites de Telegram
          await sleep(50);
        } catch (sendErr) {
          failCount++;
          const chatName = target.title || `Chat ${target.chat_id}`;
          let errorReason = sendErr.message || 'Error desconocido';

          if (errorReason.includes('chat not found')) {
            errorReason = 'Chat no encontrado / Bot eliminado';
          } else if (errorReason.includes('bot was kicked') || errorReason.includes('bot is not a member')) {
            errorReason = 'Bot no es miembro del grupo';
          } else if (errorReason.includes('not enough rights') || errorReason.includes('administrator')) {
            errorReason = 'Sin permisos de administrador para publicar';
          } else if (errorReason.includes('user is deactivated')) {
            errorReason = 'Canal o chat desactivado';
          } else if (errorReason.includes('TOO_MANY_REQUESTS')) {
            // Reintentar tras espera breve
            await sleep(1500);
            try {
              await ctx.api.copyMessage(target.chat_id, draft.fromChatId, draft.messageId, {
                reply_markup: broadcastKeyboard,
              });
              successCount++;
              failCount--;
              continue;
            } catch (retryErr) {
              errorReason = `FloodWait: ${retryErr.message}`;
            }
          }

          errorsList.push({
            title: chatName,
            id: target.chat_id,
            reason: errorReason,
          });
        }
      }

      // Eliminar borrador finalizado
      draftsMap.delete(draftId);

      // 4. Construir Reporte Final Detallado
      let reportText =
        `⟡ <b>[REPORTE FINAL DE DIFUSIÓN]</b> ⊱ <code>ANUNCIO COMPLETADO</code> ⊰\n` +
        `──────\n` +
        `✓ <b>Entregados con éxito:</b> <code>${successCount}</code>\n` +
        `✗ <b>Fallidos:</b> <code>${failCount}</code>\n` +
        `📊 <b>Total procesados:</b> <code>${targets.length}</code>\n`;

      if (errorsList.length > 0) {
        reportText += `\n<b>Detalle de fallas detectadas (${errorsList.length}):</b>\n`;
        const displayedErrors = errorsList.slice(0, 10);
        for (const errItem of displayedErrors) {
          reportText += `• <b>${escapeHtml(errItem.title)}:</b> <i>${escapeHtml(errItem.reason)}</i>\n`;
        }
        if (errorsList.length > 10) {
          reportText += `<i>... y ${errorsList.length - 10} incidencias adicionales.</i>\n`;
        }
      } else {
        reportText += `\n<i>¡Transmisión perfecta! Sin ningún error registrado.</i>\n`;
      }

      reportText +=
        `──────\n` +
        `⟡ <i>Registro: ${getSuperscriptDate()}</i>`;

      await ctx.editMessageText(reportText, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Error en ejecución de anun_send:', err.message);
      await ctx.reply(`⟡ ✗ Error durante la transmisión: ${err.message}`, { parse_mode: 'HTML' });
    }
  });
}

module.exports = {
  register,
  buildBroadcastKeyboard,
  GROUP_LINK,
  CHANNEL_LINK,
};
