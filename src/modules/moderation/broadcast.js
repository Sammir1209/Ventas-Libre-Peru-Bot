// ══════════════════════════════════════════════════════════
// ⟡ Módulo de Difusión & Anuncios Masivos (/anun)
//   Segmentación Dinámica: Grupos, Canales, DMs Privados y Todo
//   Preservación 100% de Emojis Premium, Fotos y Formatos Nativos
// ══════════════════════════════════════════════════════════

const { InlineKeyboard } = require('grammy');
const db = require('../../database/postgres');
const config = require('../../config/env');
const { requireStaff } = require('../../middleware/auth');
const { escapeHtml, getSuperscriptDate } = require('../../utils/formatting');
const { toMathBold } = require('../../utils/aesthetic');

// Enlaces oficiales obligatorios de la comunidad
const GROUP_LINK = 'https://t.me/+hbIoqDOFBFFkMTM1';
const CHANNEL_LINK = 'https://t.me/+eFf0dp93AfJmMGNh';

// Almacén en memoria para borradores de anuncios pendientes de confirmación
// Map<draftId, DraftObject>
const draftsMap = new Map();

// Registro de órdenes de parada de emergencia en curso: draftId -> boolean
const activeStops = new Map();

// Limpieza periódica de borradores caducados (TTL de 20 minutos)
setInterval(() => {
  const now = Date.now();
  for (const [id, draft] of draftsMap.entries()) {
    if (now - draft.createdAt > 20 * 60 * 1000) {
      draftsMap.delete(id);
      activeStops.delete(id);
    }
  }
}, 60000);

/**
 * Genera el teclado con los 2 botones oficiales obligatorios: GROUP y CHANNEL.
 */
function buildBroadcastKeyboard() {
  return new InlineKeyboard()
    .url(`❖ ${toMathBold('GROUP')}`, GROUP_LINK)
    .url(`✦ ${toMathBold('CHANNEL')}`, CHANNEL_LINK);
}

/**
 * Pausa pasiva asíncrona para respetar los límites de la API de Telegram y evitar FloodWait.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Construye la interfaz HUD del panel de selección y confirmación de audiencia.
 */
function renderConfirmationCard(draft, recipients) {
  const communityName = draft.communityName || 'Ventas Libres Perú';
  const mode = draft.targetMode || 'ALL';
  const custom = draft.selectedTargets || { groups: true, channels: true, users: true };

  const groupsCount = recipients.groups.length;
  const channelsCount = recipients.channels.length;
  const usersCount = recipients.privateUsers.length;

  let activeTargetsCount = 0;
  let modeLabel = '🌐 Todo el Ecosistema';

  if (mode === 'ALL') {
    activeTargetsCount = groupsCount + channelsCount + usersCount;
    modeLabel = '🌐 Todo el Ecosistema (Grupos + Canales + DMs)';
  } else if (mode === 'GROUPS') {
    activeTargetsCount = groupsCount;
    modeLabel = '📢 Solo Grupos Oficiales';
  } else if (mode === 'CHANNELS') {
    activeTargetsCount = channelsCount;
    modeLabel = '📡 Solo Canales Vinculados';
  } else if (mode === 'USERS') {
    activeTargetsCount = usersCount;
    modeLabel = '👥 Solo Usuarios Privados (DMs)';
  } else if (mode === 'CUSTOM') {
    activeTargetsCount =
      (custom.groups ? groupsCount : 0) +
      (custom.channels ? channelsCount : 0) +
      (custom.users ? usersCount : 0);
    modeLabel = '🎯 Selección Personalizada';
  }

  const text =
    `<b>⟡ [SISTEMA DE DIFUSIÓN] CONFIGURAR AUDIENCIA</b>\n` +
    `──────\n\n` +
    `• <b>Origen:</b> <code>${draft.isReply ? 'Mensaje Respondido (Fidelidad 100%)' : 'Texto / Multimedia Directo'}</code>\n` +
    `• <b>Comunidad:</b> <code>${escapeHtml(communityName)}</code>\n` +
    `• <b>Audiencia activa:</b> <b>${escapeHtml(modeLabel)}</b>\n\n` +
    `<b>Destinos disponibles detectados:</b>\n` +
    `  ↳ <b>Grupos:</b> <code>${groupsCount}</code> chats\n` +
    `  ↳ <b>Canales:</b> <code>${channelsCount}</code> canales\n` +
    `  ↳ <b>Usuarios (DMs):</b> <code>${usersCount}</code> miembros\n` +
    `  ↳ <b>Total Receptores:</b> <code>${activeTargetsCount}</code> seleccionados\n\n` +
    `<b>Botones incorporados:</b>\n` +
    `  • <b>GROUP</b> ➔ <code>${GROUP_LINK}</code>\n` +
    `  • <b>CHANNEL</b> ➔ <code>${CHANNEL_LINK}</code>\n\n` +
    `──────\n` +
    `<i>Selecciona la audiencia deseada y presiona "ENVIAR AHORA" para emitir:</i>`;

  const kb = new InlineKeyboard();

  // Fila 1: Todo el ecosistema
  const allIcon = mode === 'ALL' ? '✓ ' : '';
  kb.text(`${allIcon}🌐 TODO (${groupsCount + channelsCount + usersCount})`, `anun_mode:${draft.id}:ALL`);
  kb.row();

  // Fila 2: Segmentos individuales
  const grpIcon = mode === 'GROUPS' ? '✓ ' : '';
  const chIcon = mode === 'CHANNELS' ? '✓ ' : '';
  kb.text(`${grpIcon}📢 Grupos (${groupsCount})`, `anun_mode:${draft.id}:GROUPS`)
    .text(`${chIcon}📡 Canales (${channelsCount})`, `anun_mode:${draft.id}:CHANNELS`);
  kb.row();

  // Fila 3: Solo DMs Privados
  const usrIcon = mode === 'USERS' ? '✓ ' : '';
  kb.text(`${usrIcon}👥 Solo Usuarios Privados DMs (${usersCount})`, `anun_mode:${draft.id}:USERS`);
  kb.row();

  // Fila 4: Interruptores personalizados
  if (mode === 'CUSTOM') {
    const gCheck = custom.groups ? '▣ Grupos ON' : '▢ Grupos OFF';
    const cCheck = custom.channels ? '▣ Canales ON' : '▢ Canales OFF';
    const uCheck = custom.users ? '▣ DMs ON' : '▢ DMs OFF';
    kb.text(gCheck, `anun_toggle:${draft.id}:groups`)
      .text(cCheck, `anun_toggle:${draft.id}:channels`)
      .text(uCheck, `anun_toggle:${draft.id}:users`);
    kb.row();
  } else {
    kb.text(`🎯 Personalizar Filtros`, `anun_mode:${draft.id}:CUSTOM`);
    kb.row();
  }

  // Fila 5: Confirmar / Cancelar
  kb.text(`✦ ${toMathBold('ENVIAR AHORA')}`, `anun_send:${draft.id}`)
    .text(`✕ ${toMathBold('CANCELAR')}`, `anun_cancel:${draft.id}`);

  return { text, keyboard: kb };
}

function register(bot) {
  // ── Comando /anun (y alias: anuncio, difundir, broadcast) ──
  bot.command(['anun', 'anuncio', 'difundir', 'broadcast'], requireStaff(), async (ctx) => {
    try {
      const replyTo = ctx.message?.reply_to_message;
      const rawText = ctx.message?.text || ctx.message?.caption || '';
      const cleanDirectText = rawText
        .replace(/^\/(?:anun|anuncio|difundir|broadcast)(?:@[a-zA-Z0-9_]+)?\s*/i, '')
        .trim();

      // Si no hay mensaje respondido ni texto directo ni multimedia con caption:
      if (!replyTo && !cleanDirectText && !ctx.message?.photo && !ctx.message?.video && !ctx.message?.document) {
        return await ctx.reply(
          `<b>⟡ [SISTEMA DE DIFUSIÓN] GUÍA DE USO</b>\n` +
          `──────\n\n` +
          `• <b>Opción 1 (Recomendada):</b> Responde a cualquier mensaje (texto, foto, video o emojis premium) con <code>/anun</code>.\n` +
          `• <b>Opción 2:</b> Escribe directamente <code>/anun [tu comunicado]</code>.\n` +
          `• <b>Opción 3:</b> Sube una foto o video con el pie de foto <code>/anun [tu texto]</code>.\n\n` +
          `<b>Características:</b>\n` +
          `  ↳ Selector de destinos: Grupos, Canales vinculados o DMs a usuarios.\n` +
          `  ↳ Conserva formato nativo e imágenes.\n` +
          `  ↳ Adjunta automáticamente los botones oficiales <b>GROUP</b> y <b>CHANNEL</b>.\n\n` +
          `──────\n` +
          `<i>Ejecuta <code>/anun</code> respondiendo a un mensaje para comenzar.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      const isReply = !!replyTo;
      const sourceChatId = ctx.chat.id;
      const sourceMessageId = isReply ? replyTo.message_id : ctx.message.message_id;

      const tenantId = ctx.tenant?.id || null;
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';

      // 1. Obtener la lista consolidada de destinatarios (Grupos, Canales y Usuarios)
      let recipients = { groups: [], channels: [], privateUsers: [] };
      try {
        recipients = await db.getBroadcastRecipients(tenantId);
      } catch (dbErr) {
        console.warn('⟡ Error obteniendo destinatarios para anuncio:', dbErr.message);
      }

      // 2. Registrar el borrador en memoria
      const draftId = `draft_${Date.now()}_${ctx.from.id}`;
      const draftObj = {
        id: draftId,
        fromChatId: sourceChatId,
        messageId: sourceMessageId,
        isReply,
        directText: cleanDirectText,
        creatorId: ctx.from.id,
        tenantId,
        communityName,
        recipients,
        targetMode: 'ALL',
        selectedTargets: { groups: true, channels: true, users: true },
        createdAt: Date.now(),
      };

      draftsMap.set(draftId, draftObj);

      // 3. Renderizar la tarjeta interactiva
      const { text, keyboard } = renderConfirmationCard(draftObj, recipients);

      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
        reply_parameters: { message_id: sourceMessageId },
      });
    } catch (err) {
      console.error('⟡ Error en comando /anun:', err.message);
      await ctx.reply(`⟡ ✗ Error al preparar anuncio: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Callback: Cambiar Modo de Audiencia (/anun) ──
  bot.callbackQuery(/^anun_mode:(.+):([A-Z]+)$/, async (ctx) => {
    try {
      const draftId = ctx.match[1];
      const newMode = ctx.match[2];
      const draft = draftsMap.get(draftId);

      if (!draft) {
        return await ctx.answerCallbackQuery({
          text: 'Esta solicitud de anuncio ha caducado. Vuelve a ejecutar /anun.',
          show_alert: true,
        });
      }

      if (draft.creatorId !== ctx.from.id && !config.OWNER_IDS.includes(ctx.from.id)) {
        return await ctx.answerCallbackQuery({
          text: 'Solo quien inició la solicitud puede modificar los destinos.',
          show_alert: true,
        });
      }

      draft.targetMode = newMode;
      const { text, keyboard } = renderConfirmationCard(draft, draft.recipients);

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      await ctx.answerCallbackQuery();
    } catch (err) {
      console.warn('⟡ Error en anun_mode:', err.message);
    }
  });

  // ── Callback: Interruptores Personalizados (/anun) ──
  bot.callbackQuery(/^anun_toggle:(.+):([a-z]+)$/, async (ctx) => {
    try {
      const draftId = ctx.match[1];
      const targetType = ctx.match[2];
      const draft = draftsMap.get(draftId);

      if (!draft) {
        return await ctx.answerCallbackQuery({
          text: 'Esta solicitud ha caducado.',
          show_alert: true,
        });
      }

      if (draft.creatorId !== ctx.from.id && !config.OWNER_IDS.includes(ctx.from.id)) {
        return await ctx.answerCallbackQuery({
          text: 'Sin autorización.',
          show_alert: true,
        });
      }

      draft.selectedTargets[targetType] = !draft.selectedTargets[targetType];
      const { text, keyboard } = renderConfirmationCard(draft, draft.recipients);

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      await ctx.answerCallbackQuery();
    } catch (err) {
      console.warn('⟡ Error en anun_toggle:', err.message);
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
      activeStops.delete(draftId);
      await ctx.answerCallbackQuery({ text: 'Difusión cancelada.' });
      await ctx.editMessageText(
        `<b>⟡ [DIFUSIÓN CANCELADA]</b>\n──────\n<i>El envío del anuncio ha sido descartado por el administrador.</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.warn('⟡ Error en anun_cancel:', err.message);
    }
  });

  // ── Callback: Parada de Emergencia Durante la Emisión ──
  bot.callbackQuery(/^anun_stop:(.+)$/, async (ctx) => {
    try {
      const draftId = ctx.match[1];
      const draft = draftsMap.get(draftId);

      if (draft && draft.creatorId !== ctx.from.id && !config.OWNER_IDS.includes(ctx.from.id)) {
        return await ctx.answerCallbackQuery({
          text: 'Solo quien inició la difusión puede detenerla.',
          show_alert: true,
        });
      }

      activeStops.set(draftId, true);
      await ctx.answerCallbackQuery({ text: 'Deteniendo transmisión en el próximo ciclo...' });
    } catch (err) {
      console.warn('⟡ Error en anun_stop:', err.message);
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

      // Consolidar la lista de destinos según el filtro elegido
      const recipients = draft.recipients || { groups: [], channels: [], privateUsers: [] };
      let targets = [];

      if (draft.targetMode === 'ALL') {
        targets = [...recipients.groups, ...recipients.channels, ...recipients.privateUsers];
      } else if (draft.targetMode === 'GROUPS') {
        targets = [...recipients.groups];
      } else if (draft.targetMode === 'CHANNELS') {
        targets = [...recipients.channels];
      } else if (draft.targetMode === 'USERS') {
        targets = [...recipients.privateUsers];
      } else if (draft.targetMode === 'CUSTOM') {
        if (draft.selectedTargets.groups) targets.push(...recipients.groups);
        if (draft.selectedTargets.channels) targets.push(...recipients.channels);
        if (draft.selectedTargets.users) targets.push(...recipients.privateUsers);
      }

      // Eliminar posibles duplicados de ID
      const uniqueMap = new Map();
      for (const t of targets) {
        uniqueMap.set(Number(t.id), t);
      }
      targets = Array.from(uniqueMap.values());

      if (targets.length === 0) {
        return await ctx.editMessageText(
          `<b>⟡ [DIFUSIÓN CANCELADA] SIN DESTINATARIOS</b>\n──────\n<i>No hay ningún grupo, canal o usuario seleccionado para emitir.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      const broadcastKeyboard = buildBroadcastKeyboard();
      const stopKb = new InlineKeyboard().text(`🛑 ${toMathBold('DETENER DIFUSIÓN')}`, `anun_stop:${draftId}`);

      // Notificar progreso inicial
      await ctx.editMessageText(
        `<b>⟡ [TRANSMISIÓN EN PROCESO] ENVIANDO...</b>\n` +
        `──────\n\n` +
        `⏳ <i>Emitiendo anuncio a <b>${targets.length}</b> destinatarios...</i>\n` +
        `• <b>Progreso:</b> <code>0 / ${targets.length} (0%)</code>\n\n` +
        `──────\n` +
        `<i>Presiona el botón inferior si requieres detener la emisión.</i>`,
        { parse_mode: 'HTML', reply_markup: stopKb }
      );

      let successCount = 0;
      let blockedCount = 0;
      let failCount = 0;
      const errorsList = [];
      const startTime = Date.now();
      let lastEditTime = Date.now();

      for (let i = 0; i < targets.length; i++) {
        // Comprobar parada de emergencia
        if (activeStops.get(draftId)) {
          console.log(`⟡ [Difusión] Emisión ${draftId} detenida por el administrador.`);
          break;
        }

        const target = targets[i];

        try {
          if (draft.isReply) {
            // Reenvío exacto con copyMessage (preserva texto, fotos, videos y emojis premium)
            await ctx.api.copyMessage(target.id, draft.fromChatId, draft.messageId, {
              reply_markup: broadcastKeyboard,
            });
          } else {
            // Emisión directa
            if (draft.directText && !draft.hasMedia) {
              await ctx.api.sendMessage(target.id, draft.directText, {
                reply_markup: broadcastKeyboard,
                parse_mode: 'HTML',
              });
            } else {
              await ctx.api.copyMessage(target.id, draft.fromChatId, draft.messageId, {
                reply_markup: broadcastKeyboard,
              });
            }
          }
          successCount++;
        } catch (sendErr) {
          const errStr = (sendErr.message || sendErr.description || '').toLowerCase();

          if (
            errStr.includes('blocked by the user') ||
            errStr.includes('user is deactivated') ||
            errStr.includes('chat not found') ||
            errStr.includes('bot was kicked') ||
            errStr.includes('bot is not a member')
          ) {
            blockedCount++;
          } else if (errStr.includes('too_many_requests') || errStr.includes('flood')) {
            // Reintento tras espera breve
            await sleep(2000);
            try {
              if (draft.isReply) {
                await ctx.api.copyMessage(target.id, draft.fromChatId, draft.messageId, {
                  reply_markup: broadcastKeyboard,
                });
              } else {
                await ctx.api.sendMessage(target.id, draft.directText, {
                  reply_markup: broadcastKeyboard,
                  parse_mode: 'HTML',
                });
              }
              successCount++;
            } catch (retryErr) {
              failCount++;
              errorsList.push({
                title: target.title || target.name || `ID ${target.id}`,
                reason: `FloodWait: ${retryErr.message}`,
              });
            }
          } else {
            failCount++;
            errorsList.push({
              title: target.title || target.name || `ID ${target.id}`,
              reason: sendErr.message || 'Error desconocido',
            });
          }
        }

        // Actualizar HUD de progreso dinámicamente cada 15 envíos (o cada 3 segundos)
        const now = Date.now();
        const processed = i + 1;
        if ((processed % 15 === 0 || now - lastEditTime > 3000) && processed < targets.length) {
          lastEditTime = now;
          const percent = Math.round((processed / targets.length) * 100);
          try {
            await ctx.editMessageText(
              `<b>⟡ [TRANSMISIÓN EN PROCESO] ENVIANDO...</b>\n` +
              `──────\n\n` +
              `⏳ <i>Emitiendo a la comunidad seleccionada...</i>\n` +
              `• <b>Progreso:</b> <code>${processed} / ${targets.length} (${percent}%)</code>\n` +
              `• <b>Entregados:</b> <code>${successCount}</code>\n` +
              `• <b>Bloqueados / Inactivos:</b> <code>${blockedCount}</code>\n` +
              `• <b>Fallidos:</b> <code>${failCount}</code>\n\n` +
              `──────\n` +
              `<i>Presiona el botón inferior si requieres detener la emisión.</i>`,
              { parse_mode: 'HTML', reply_markup: stopKb }
            );
          } catch {}
        }

        // Delay preventivo para respetar la cuota de Telegram (35ms por mensaje)
        await sleep(35);
      }

      // Limpiar registros del borrador
      const wasStopped = !!activeStops.get(draftId);
      draftsMap.delete(draftId);
      activeStops.delete(draftId);

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const dateFormatted = getSuperscriptDate();

      // 4. Reporte Final Detallado
      let reportText =
        `<b>⟡ [REPORTE FINAL DE DIFUSIÓN] ${wasStopped ? 'EMISIÓN INTERRUMPIDA' : 'ANUNCIO COMPLETADO'}</b>\n` +
        `──────\n\n` +
        `• <b>Estado:</b> <code>${wasStopped ? '[ DETENIDO POR ADMIN ]' : '[ TRANSMISIÓN EXITOSA ]'}</code>\n` +
        `• <b>Total Programados:</b> <code>${targets.length} receptores</code>\n` +
        `• <b>Entregados con éxito:</b> <code>${successCount}</code>\n` +
        `• <b>Bloqueados / Inactivos:</b> <code>${blockedCount}</code>\n` +
        `• <b>Errores técnicos:</b> <code>${failCount}</code>\n` +
        `• <b>Tiempo total:</b> <code>${elapsedSec}s</code>\n\n` +
        `<b>Botones incluidos:</b>\n` +
        `  • <b>GROUP:</b> <code>${GROUP_LINK}</code>\n` +
        `  • <b>CHANNEL:</b> <code>${CHANNEL_LINK}</code>\n`;

      if (errorsList.length > 0) {
        reportText += `\n<b>Detalle de incidencias (${errorsList.length}):</b>\n`;
        const sampleErrors = errorsList.slice(0, 8);
        for (const e of sampleErrors) {
          reportText += `• <b>${escapeHtml(e.title)}:</b> <i>${escapeHtml(e.reason)}</i>\n`;
        }
        if (errorsList.length > 8) {
          reportText += `<i>... y ${errorsList.length - 8} errores adicionales.</i>\n`;
        }
      } else {
        reportText += `\n<i>¡Transmisión impecable! Sin incidencias registradas.</i>\n`;
      }

      reportText += `──────\n${dateFormatted}`;

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
