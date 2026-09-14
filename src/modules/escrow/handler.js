const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const supabaseStorage = require('../../database/supabase');
const templates = require('../../utils/templates');
const { CB, ROLES, SYM } = require('../../config/constants');
const {
  dealMainKeyboard,
  dealInfoKeyboard,
  dealRoleKeyboard,
  dealCancelKeyboard,
  dealConfirmKeyboard,
  dealWaitingKeyboard,
  dealAcceptKeyboard,
  dealCompleteKeyboard,
  dealTopicKeyboard,
  dealRatingKeyboard,
} = require('./keyboard');
const dealQueue = require('./queue');
const { rateAdmin } = require('./rating');
const config = require('../../config/env');
const { InlineKeyboard, InputFile } = require('grammy');

// ══════
// ⟡ Módulo 2: Sistema de Tratos Admin (Escrow con Temas / Hilos)
// ══════

const DEAL_FORM_PREFIX = 'deal_form:';
const FORM_TTL = 600; // 10 minutos
const ESCROW_GROUP_KEY = 'escrow_group_id';

async function setDealForm(userId, data) {
  await redisDb.setCache(`${DEAL_FORM_PREFIX}${userId}`, data, FORM_TTL);
}

async function getDealForm(userId) {
  return await redisDb.getCache(`${DEAL_FORM_PREFIX}${userId}`);
}

async function clearDealForm(userId) {
  await redisDb.clearCache(`${DEAL_FORM_PREFIX}${userId}`);
}

/**
 * Obtiene el ID del grupo oficial de tratos (desde memoria, env, redis o base de datos).
 */
async function getEscrowGroupId(ctx = null) {
  if (ctx?.tenant?.escrow_group_id) return Number(ctx.tenant.escrow_group_id);
  if (config.ESCROW_GROUP_ID) return config.ESCROW_GROUP_ID;
  const cached = await redisDb.getCache(ESCROW_GROUP_KEY);
  if (cached) {
    config.ESCROW_GROUP_ID = Number(cached);
    return Number(cached);
  }
  try {
    const saved = await db.getSetting('escrow_group_id');
    if (saved) {
      config.ESCROW_GROUP_ID = Number(saved);
      return Number(saved);
    }
  } catch {}
  return null;
}

/**
 * Verifica si un usuario pertenece al Staff (Owner, Co-Owner, Admin, Trato Admin).
 */
async function isStaffMember(userId, tenantId = null) {
  if (!userId) return false;
  if (config.OWNER_IDS.includes(userId) || config.OWNER_IDS.includes(Number(userId))) return true;
  const staff = await db.getStaffMember(userId, tenantId);
  if (!staff || !staff.role) return false;
  const r = String(staff.role).toUpperCase();
  return (
    r.includes('OWNER') ||
    r.includes('CO-OWNER') ||
    r.includes('ADMIN') ||
    r.includes('TRATO ADMIN') ||
    r.includes('TRATOADMIN')
  );
}

/**
 * Verifica si un usuario tiene permisos de Trato Admin u Owner para aceptar / gestionar tratos.
 */
async function isDealAdmin(userId, tenantId = null) {
  if (!userId) return false;
  if (config.OWNER_IDS.includes(userId) || config.OWNER_IDS.includes(Number(userId))) return true;
  const staff = await db.getStaffMember(userId, tenantId);
  if (!staff || !staff.role) return false;
  const r = String(staff.role).toUpperCase();
  return (
    r.includes('TRATO ADMIN') ||
    r.includes('TRATOADMIN') ||
    r.includes('DEAL_ADMIN') ||
    r.includes('OWNER') ||
    r.includes('CO-OWNER') ||
    r.includes('ADMIN')
  );
}

/**
 * Expulsa a los participantes invitados de un trato del grupo de tratos (protegiendo siempre al Staff).
 */
async function expelDealParticipants(api, escrowGroupId, dealId) {
  if (!escrowGroupId || !dealId) return;
  try {
    const participants = await redisDb.getCache(`deal_participants:${dealId}`);
    const deal = await db.getDeal(dealId);

    const uids = new Set();
    if (participants?.creatorId) uids.add(Number(participants.creatorId));
    if (participants?.counterpartId) uids.add(Number(participants.counterpartId));
    if (deal?.creator_id) uids.add(Number(deal.creator_id));
    if (deal?.counterpart && /^\d+$/.test(deal.counterpart)) uids.add(Number(deal.counterpart));

    for (const uid of uids) {
      if (!uid) continue;
      const isStaff = await isStaffMember(uid);
      if (!isStaff) {
        try {
          await api.banChatMember(escrowGroupId, uid);
          await api.unbanChatMember(escrowGroupId, uid, { only_if_banned: true });
          console.log(`✓ Usuario invitado ${uid} expulsado del grupo de tratos (Trato #${dealId}).`);
        } catch (kErr) {
          console.warn(`⟡ Error expulsando participante ${uid}:`, kErr.message);
        }
      } else {
        console.log(`🛡️ Miembro del Staff ${uid} protegido de expulsión.`);
      }
      await redisDb.clearCache(`user_deal_link:${uid}`);
      await redisDb.clearCache(`user_active_deal:${uid}`);
    }

    // Revocar cualquier enlace de invitación pendiente del trato
    const invites = await redisDb.getCache(`deal_invites:${dealId}`);
    if (Array.isArray(invites)) {
      for (const inv of invites) {
        if (inv) {
          try {
            await api.revokeChatInviteLink(escrowGroupId, inv);
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error(`⟡ Error en expelDealParticipants(#${dealId}):`, err.message);
  }
}

function register(bot) {
  // ── Listener: Revocar enlace en cuanto el usuario entra al grupo ──
  bot.on('chat_member', async (ctx, next) => {
    try {
      const escrowGroupId = await getEscrowGroupId(ctx);
      if (escrowGroupId && ctx.chat?.id === escrowGroupId) {
        const update = ctx.chatMember;
        const newStatus = update?.new_chat_member?.status;
        const oldStatus = update?.old_chat_member?.status;

        if (newStatus === 'member' && oldStatus !== 'member') {
          const joinedUserId = update.new_chat_member.user.id;
          const userLink = await redisDb.getCache(`user_deal_link:${joinedUserId}`);
          if (userLink) {
            try {
              await ctx.api.revokeChatInviteLink(escrowGroupId, userLink);
              console.log(`✓ Enlace de invitación de un solo uso revocado para usuario ${joinedUserId}`);
            } catch (revErr) {
              console.warn('⟡ Error revocando enlace de invitación:', revErr.message);
            }
          }
        }
      }
    } catch {}
    return next();
  });

  // ── Listener: Si un topic es cerrado manualmente por un admin en Telegram ──
  bot.on(['message:forum_topic_closed', 'message:forum_topic_edited'], async (ctx, next) => {
    try {
      const escrowGroupId = await getEscrowGroupId(ctx);
      const threadId = ctx.message?.message_thread_id;
      if (escrowGroupId && ctx.chat?.id === escrowGroupId && threadId) {
        const dealId = await redisDb.getCache(`thread_deal:${threadId}`);
        if (dealId) {
          console.log(`⟡ Hilo #${threadId} (Trato #${dealId}) cerrado/modificado manualmente. Expulsando participantes...`);
          await expelDealParticipants(ctx.api, escrowGroupId, dealId);
        }
      }
    } catch {}
    return next();
  });

  // ── Listener: Control de privacidad y guardado de historial del Hilo ──
  bot.on('message', async (ctx, next) => {
    try {
      const escrowGroupId = await getEscrowGroupId(ctx);
      const threadId = ctx.message?.message_thread_id;
      const chatId = ctx.chat?.id;

      if (escrowGroupId && chatId === escrowGroupId) {
        const userId = ctx.from?.id;
        const isStaff = await isStaffMember(userId);

        // Si NO es Staff:
        if (!isStaff && userId) {
          // 1. Si escribe en el Chat General (sin thread o thread principal), borrarlo
          if (!threadId) {
            try {
              await ctx.deleteMessage();
              console.log(`🛡️ Mensaje de usuario no-staff ${userId} eliminado del chat general de tratos.`);
            } catch {}
            return;
          }

          // 2. Si escribe en un hilo, verificar que pertenezca a su trato asignado
          const dealId = await redisDb.getCache(`thread_deal:${threadId}`);
          if (dealId) {
            const participants = await redisDb.getCache(`deal_participants:${dealId}`);
            const deal = await db.getDeal(dealId);
            const isAllowed =
              (participants && (String(participants.creatorId) === String(userId) || String(participants.counterpartId) === String(userId))) ||
              (deal && (String(deal.creator_id) === String(userId) || String(deal.counterpart) === String(userId)));

            if (!isAllowed) {
              try {
                await ctx.deleteMessage();
                console.log(`🛡️ Mensaje de usuario ${userId} eliminado de un hilo que no le pertenece (${threadId}).`);
              } catch {}
              return;
            }
          }
        }

        // Guardar en memoria/redis todos los mensajes del Hilo del trato
        if (threadId) {
          const dealId = await redisDb.getCache(`thread_deal:${threadId}`);
          if (dealId) {
            const chatHistory = (await redisDb.getCache(`deal_chat:${dealId}`)) || [];
            chatHistory.push({
              sender_id: ctx.from.id,
              sender_name: ctx.from.first_name || 'Usuario',
              username: ctx.from.username || null,
              date: new Date().toISOString(),
              text: ctx.message.text || ctx.message.caption || '[Archivo / Multimedia]',
              type: ctx.message.photo ? 'photo' : ctx.message.document ? 'document' : 'text',
            });
            await redisDb.setCache(`deal_chat:${dealId}`, chatHistory, 86400 * 7);
          }
        }
      }
    } catch {}
    return next();
  });

  // ── Comando /set_grupo_tratos (Solo Owners en Supergrupo con Temas) ──
  bot.command('set_grupo_tratos', async (ctx) => {
    try {
      const userId = ctx.from.id;

      // 1. Verificar que sea Owner
      if (!config.OWNER_IDS.includes(userId)) {
        return ctx.reply(`${SYM.CROSS} Solo los <b>Owners</b> pueden configurar el grupo de Tratos Admin.`, {
          parse_mode: 'HTML',
        });
      }

      // 2. Verificar que se ejecute en un supergrupo
      if (ctx.chat.type !== 'supergroup' && ctx.chat.type !== 'group') {
        return ctx.reply(
          `${SYM.CROSS} Este comando debe ejecutarse <b>dentro del supergrupo oficial</b> de Tratos Admin.`,
          { parse_mode: 'HTML' }
        );
      }

      const chatId = ctx.chat.id;

      // 3. Obtener información detallada del chat
      const chatInfo = await ctx.api.getChat(chatId);

      // 4. Comprobar si tiene la opción de Temas (Topics / Hilos) activada
      if (!chatInfo.is_forum) {
        return ctx.reply(templates.escrowGroupNotForumError(), { parse_mode: 'HTML' });
      }

      // 5. Comprobar permisos del bot en el grupo
      try {
        const botInfo = await ctx.api.getMe();
        const botMember = await ctx.api.getChatMember(chatId, botInfo.id);

        if (
          botMember.status !== 'creator' &&
          (botMember.status !== 'administrator' || !botMember.can_manage_topics)
        ) {
          return ctx.reply(templates.escrowGroupNoPermissionError(), { parse_mode: 'HTML' });
        }
      } catch (permErr) {
        console.error('⟡ Error verificando permisos del bot:', permErr.message);
      }

      // 6. Guardar grupo oficial de tratos de forma permanente
      config.ESCROW_GROUP_ID = chatId;
      await redisDb.setCache(ESCROW_GROUP_KEY, chatId.toString(), 86400 * 365); // 1 año
      try {
        await db.setSetting('escrow_group_id', chatId.toString());
        await db.registerGroup(chatId, chatInfo.title || 'Grupo de Tratos Admin');
      } catch {}

      // Actualizar variable en archivo .env en disco
      try {
        const fs = require('fs');
        const path = require('path');
        const envPath = path.resolve(__dirname, '../../../.env');
        if (fs.existsSync(envPath)) {
          let envText = fs.readFileSync(envPath, 'utf-8');
          if (/^ESCROW_GROUP_ID=.*$/m.test(envText)) {
            envText = envText.replace(/^ESCROW_GROUP_ID=.*$/m, `ESCROW_GROUP_ID=${chatId}`);
          } else {
            envText += `\nESCROW_GROUP_ID=${chatId}\n`;
          }
          fs.writeFileSync(envPath, envText, 'utf-8');
        }
      } catch (fsErr) {
        console.warn('⟡ No se pudo escribir ESCROW_GROUP_ID en .env:', fsErr.message);
      }

      await ctx.reply(templates.escrowGroupConfigured(chatInfo.title || 'Grupo Oficial', chatId), {
        parse_mode: 'HTML',
      });
    } catch (err) {
      console.error('⟡ Error en /set_grupo_tratos:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al configurar grupo: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Comando /tratoadm y /tratoadmin (Con verificación de chat privado) ──
  bot.command(['tratoadm', 'tratoadmin'], async (ctx) => {
    try {
      const isPrivate = ctx.chat.type === 'private';

      // Si se ejecuta en un grupo, redirigir al privado por seguridad
      if (!isPrivate) {
        let botUsername = 'ventas_libres_peru_Bot';
        try {
          const botInfo = await ctx.api.getMe();
          botUsername = botInfo.username;
        } catch {}

        return ctx.reply(
          `⟡ <b>SISTEMA TRATO ADMIN</b> ⊱ <code>CUSTODIA SEGURA</code> ⊰\n` +
          `══════\n\n` +
          `Por protocolos de <b>seguridad y protección de datos</b>, las solicitudes de Trato Admin se gestionan <b>únicamente por mensaje privado</b> con el bot.\n\n` +
          `──────\n` +
          `▪ <i>Pulsa el botón oficial de abajo para iniciar tu intermediación:</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard().url(
              'INICIAR TRATO EN PRIVADO',
              `https://t.me/${botUsername}?start=tratoadm`
            ),
          }
        );
      }

      await clearDealForm(ctx.from.id);
      await ctx.reply(templates.dealMainMenuMessage(), {
        parse_mode: 'HTML',
        reply_markup: dealMainKeyboard(),
      });
    } catch (err) {
      console.error('⟡ Escrow: Error en /tratoadm:', err.message);
    }
  });

  // ── Comando /guia_trato /infotrato /guiatrato (Explicación detallada del Trato Admin) ──
  bot.command(['guia_trato', 'guiatrato', 'infotrato', 'comotrato', 'como_funciona_trato'], async (ctx) => {
    try {
      let botUsername = 'ventas_libres_peru_Bot';
      try {
        const me = await ctx.api.getMe();
        if (me?.username) botUsername = me.username;
      } catch {}

      await ctx.reply(templates.dealDetailedInfoMessage(), {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .url('INICIAR TRATO ADMIN', `https://t.me/${botUsername}?start=tratoadm`),
      });
    } catch (err) {
      console.error('⟡ Escrow: Error en /guia_trato:', err.message);
    }
  });

  // ── Callback: Info del Trato Admin (Edición in-place) ──
  bot.callbackQuery(CB.DEAL_INFO, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(templates.dealDetailedInfoMessage(), {
        parse_mode: 'HTML',
        reply_markup: dealInfoKeyboard(),
      });
    } catch (err) {
      console.error('⟡ Escrow: Error en deal_info:', err.message);
    }
  });

  // ── Callback: Volver al menú principal de Trato (Edición in-place) ──
  bot.callbackQuery('deal_back_to_main', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      await clearDealForm(ctx.from.id);
      await ctx.editMessageText(templates.dealMainMenuMessage(), {
        parse_mode: 'HTML',
        reply_markup: dealMainKeyboard(),
      });
    } catch (err) {
      console.error('⟡ Escrow: Error en deal_back_to_main:', err.message);
    }
  });

  // ── Callback: Iniciar Formulario de Trato (Paso 1: Rol) ──
  bot.callbackQuery(CB.START_DEAL, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;

      await setDealForm(userId, {
        step: 'AWAIT_ROLE',
        messageId: ctx.callbackQuery?.message?.message_id,
        chatId: ctx.chat?.id,
      });

      await ctx.editMessageText(templates.dealRoleStepMessage(), {
        parse_mode: 'HTML',
        reply_markup: dealRoleKeyboard(),
      });
    } catch (err) {
      console.error('⟡ Escrow: Error en start_deal:', err.message);
    }
  });

  // ── Callback: Selección de Rol (Paso 2: Pedir Contraparte) ──
  bot.callbackQuery(/^deal_role:(VENDEDOR|COMPRADOR)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const role = ctx.match[1];

      await setDealForm(userId, {
        step: 'AWAIT_COUNTERPART',
        role,
        messageId: ctx.callbackQuery?.message?.message_id,
        chatId: ctx.chat?.id,
      });

      await ctx.editMessageText(templates.dealCounterpartStepMessage(role), {
        parse_mode: 'HTML',
        reply_markup: dealCancelKeyboard(),
      });
    } catch (err) {
      console.error('⟡ Escrow: Error en deal_role:', err.message);
    }
  });

  // ── Listener de texto para los pasos 2 y 3 del formulario en DM ──
  bot.on('message:text', async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || ctx.chat.type !== 'private') return next();

    // Solo procesar si el usuario tiene un formulario de trato activo
    const form = await getDealForm(userId);
    if (!form) return next();

    try {
      const text = ctx.message.text.trim();

      // Paso 2: Recibir Contraparte
      if (form.step === 'AWAIT_COUNTERPART') {
        if (!text || text.length < 2) {
          return ctx.reply(`${SYM.CROSS} Ingresa un @usuario o ID válido.`, { parse_mode: 'HTML' });
        }

        // 🚨 Verificar si la contraparte es un estafador registrado en Lista Negra
        const cleanTarget = text.replace(/^@/, '').trim();
        const isNumeric = /^\d+$/.test(cleanTarget);
        let isBurned = false;
        try {
          if (isNumeric) {
            isBurned = await db.isUserBurned(Number(cleanTarget), null);
          } else {
            isBurned = await db.isUserBurned(null, cleanTarget);
          }
        } catch {}

        if (isBurned) {
          await clearDealForm(userId);
          return ctx.reply(
            `${SYM.CROSS} <b>ALERTA DE ESTAFADOR DETECTADO</b>\n\n` +
            `El usuario <code>${escapeHtml(text)}</code> está registrado en la <b>Lista Negra Oficial de Estafadores</b>.\n\n` +
            `${SYM.WARNING} <i>Por tu seguridad, no puedes iniciar tratos con esta persona. Solicitud cancelada.</i>`,
            { parse_mode: 'HTML' }
          );
        }

        form.counterpart = text;
        form.step = 'AWAIT_DESCRIPTION';
        await setDealForm(userId, form);

        // Borrar mensaje del usuario para mantener chat limpio
        try {
          await ctx.deleteMessage();
        } catch {}

        // Actualizar el mensaje principal
        if (form.messageId && form.chatId) {
          try {
            await ctx.api.editMessageText(
              form.chatId,
              form.messageId,
              templates.dealDescriptionStepMessage(form.role, form.counterpart),
              {
                parse_mode: 'HTML',
                reply_markup: dealCancelKeyboard(),
              }
            );
            return;
          } catch {}
        }

        const sent = await ctx.reply(
          templates.dealDescriptionStepMessage(form.role, form.counterpart),
          {
            parse_mode: 'HTML',
            reply_markup: dealCancelKeyboard(),
          }
        );
        form.messageId = sent.message_id;
        form.chatId = sent.chat.id;
        await setDealForm(userId, form);
        return;
      }

      // Paso 3: Recibir Descripción
      if (form.step === 'AWAIT_DESCRIPTION') {
        if (!text || text.length < 5) {
          return ctx.reply(
            `${SYM.CROSS} La descripción debe tener al menos <b>5 caracteres</b>.`,
            { parse_mode: 'HTML' }
          );
        }

        if (text.length > 150) {
          return ctx.reply(
            `${SYM.CROSS} La descripción es muy larga (máximo <b>150 caracteres</b>). Tu texto tiene ${text.length} caracteres.\n\n` +
            `<i>Por favor escribe un resumen más corto:</i>`,
            { parse_mode: 'HTML' }
          );
        }

        form.description = text;
        form.step = 'CONFIRM';
        await setDealForm(userId, form);

        // Borrar mensaje del usuario
        try {
          await ctx.deleteMessage();
        } catch {}

        // Mostrar resumen de confirmación
        if (form.messageId && form.chatId) {
          try {
            await ctx.api.editMessageText(
              form.chatId,
              form.messageId,
              templates.dealSummaryMessage(form.role, form.counterpart, form.description),
              {
                parse_mode: 'HTML',
                reply_markup: dealConfirmKeyboard(),
              }
            );
            return;
          } catch {}
        }

        const sent = await ctx.reply(
          templates.dealSummaryMessage(form.role, form.counterpart, form.description),
          {
            parse_mode: 'HTML',
            reply_markup: dealConfirmKeyboard(),
          }
        );
        form.messageId = sent.message_id;
        form.chatId = sent.chat.id;
        await setDealForm(userId, form);
        return;
      }
    } catch (err) {
      console.error('⟡ Escrow: Error procesando formulario de trato:', err.message);
      return next();
    }

    return next();
  });

  // ── Callback: Confirmar y Encolar Solicitud de Trato ──
  bot.callbackQuery('deal_confirm', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const username = ctx.from.username;
      const form = await getDealForm(userId);

      if (!form || !form.role || !form.counterpart || !form.description) {
        return ctx.answerCallbackQuery({
          text: '✗ Datos incompletos o sesión expirada. Inicia nuevamente con /tratoadm',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery({ text: '⟡ Solicitud registrada con éxito.' });

      // Crear trato enriquecido en la cola
      const deal = await dealQueue.enqueueDeal(
        userId,
        username,
        form.role,
        form.counterpart,
        form.description,
        ctx.tenant?.id
      );

      // Limpiar formulario temporal
      await clearDealForm(userId);

      // Actualizar el mensaje del usuario con la confirmación de espera y botón Canal Oficial
      await ctx.editMessageText(
        templates.dealWaitingMessage(deal.id, form.role, form.counterpart, form.description),
        {
          parse_mode: 'HTML',
          reply_markup: dealWaitingKeyboard(deal.id),
        }
      );

      // Notificar al grupo/hilo oficial de Staff / Tratos Admin si está configurado
      if (config.STAFF_CHAT_ID) {
        try {
          await ctx.api.sendMessage(
            config.STAFF_CHAT_ID,
            templates.dealNotifyAdmin(
              deal.id,
              username,
              userId,
              form.role,
              form.counterpart,
              form.description
            ),
            {
              parse_mode: 'HTML',
              reply_markup: dealAcceptKeyboard(deal.id),
              ...(config.STAFF_THREAD_ID ? { message_thread_id: config.STAFF_THREAD_ID } : {}),
            }
          );
        } catch (staffErr) {
          console.warn('⟡ Error enviando notificación a grupo/hilo de staff:', staffErr.message);
        }
      }

      // Notificar a todos los Trato Admins y Owners por DM
      const allStaff = await db.getAllStaff(ctx.tenant?.id);
      const dealAdmins = (allStaff || []).filter(s => {
        const r = String(s.role || '').toUpperCase();
        return r.includes('TRATO ADMIN') || r.includes('TRATOADMIN') || r.includes('DEAL_ADMIN') || r.includes('OWNER');
      });
      const allOwners = config.OWNER_IDS;

      const notifyIds = [
        ...dealAdmins.map(a => Number(a.user_id)),
        ...allOwners.map(o => Number(o)),
      ];
      const uniqueIds = [...new Set(notifyIds.filter(Boolean))];

      for (const adminId of uniqueIds) {
        try {
          await ctx.api.sendMessage(
            adminId,
            templates.dealNotifyAdmin(
              deal.id,
              username,
              userId,
              form.role,
              form.counterpart,
              form.description
            ),
            {
              parse_mode: 'HTML',
              reply_markup: dealAcceptKeyboard(deal.id),
            }
          );
        } catch {
          // Admin no ha iniciado chat con el bot, ignorar
        }
      }
    } catch (err) {
      console.error('⟡ Escrow: Error en deal_confirm:', err.message);
    }
  });

  // ── Callback: Cancelar Trato (durante formulario o menú) ──
  bot.callbackQuery(CB.DEAL_CANCEL, async (ctx) => {
    try {
      await clearDealForm(ctx.from.id);
      await ctx.answerCallbackQuery({ text: '⟡ Solicitud cancelada.' });
      await ctx.editMessageText(templates.dealCancelledMessage('de Trato'), {
        parse_mode: 'HTML',
      });
    } catch (err) {
      console.error('⟡ Escrow: Error en deal_cancel:', err.message);
    }
  });

  // ── Callback: Cancelar Trato en Espera ──
  bot.callbackQuery(/^deal_cancel_pending:(\d+)$/, async (ctx) => {
    try {
      const dealId = parseInt(ctx.match[1]);
      await dealQueue.cancelDeal(dealId);
      await clearDealForm(ctx.from.id);
      await ctx.answerCallbackQuery({ text: '⟡ Solicitud cancelada.' });
      await ctx.editMessageText(templates.dealCancelledMessage(dealId), {
        parse_mode: 'HTML',
      });
    } catch (err) {
      console.error('⟡ Escrow: Error en deal_cancel_pending:', err.message);
    }
  });

  // ── Callback: Staff rechaza trato ──
  bot.callbackQuery(/^deal_reject:(\d+)$/, async (ctx) => {
    try {
      const dealId = parseInt(ctx.match[1]);
      const adminId = ctx.from.id;
      const adminName = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Admin');

      // 1. Verificar que sea Staff autorizado
      const isStaff = await isStaffMember(adminId, ctx.tenant?.id);
      if (!isStaff) {
        return ctx.answerCallbackQuery({
          text: '✗ Solo los miembros del Staff pueden rechazar este trato.',
          show_alert: true,
        });
      }

      // 2. Verificar que el trato esté pendiente
      const deal = await db.getDeal(dealId);
      if (!deal || deal.status !== 'PENDING') {
        return ctx.answerCallbackQuery({
          text: '✗ Este trato ya fue procesado o no existe.',
          show_alert: true,
        });
      }

      // 3. Cancelar trato en BD y Redis
      await dealQueue.cancelDeal(dealId);
      await db.updateDealStatus(dealId, 'CANCELLED');

      await ctx.answerCallbackQuery({ text: '✗ Trato rechazado.' });

      // 4. Editar mensaje en el canal/grupo de Staff
      try {
        await ctx.editMessageText(
          `${SYM.CROSS} <b>Trato #${dealId} Rechazado</b>\n\n` +
          `${SYM.ARROW} <b>Rechazado por:</b> ${adminName}\n` +
          `${SYM.ARROW} <b>Estado:</b> ⊱ <code>CANCELADO</code> ⊰`,
          { parse_mode: 'HTML' }
        );
      } catch {}

      // 5. Notificar al creador del trato por privado
      try {
        await ctx.api.sendMessage(
          deal.creator_id,
          `${SYM.CROSS} <b>TU SOLICITUD DE TRATO #${dealId} HA SIDO RECHAZADA</b>\n\n` +
          `El Staff no puede intermediar este trato en este momento.\n\n` +
          `<i>Si consideras que fue un error, consulta con el /staff oficial.</i>`,
          { parse_mode: 'HTML' }
        );
      } catch {}
    } catch (err) {
      console.error('⟡ Escrow: Error en deal_reject:', err.message);
    }
  });

  // ── Callback: Admin acepta trato (Creación de Hilo / Topic) ──
  bot.callbackQuery(/^deal_accept:(\d+)$/, async (ctx) => {
    try {
      const dealId = parseInt(ctx.match[1]);
      const adminId = ctx.from.id;
      const adminUsername = ctx.from.username;

      // 1. Verificar permisos: Trato Admins y Owners autorizados
      const isAuthorized = await isDealAdmin(adminId, ctx.tenant?.id);

      if (!isAuthorized) {
        return ctx.answerCallbackQuery({
          text: '✗ Solo los Trato Admins y Owners autorizados pueden aceptar este trato.',
          show_alert: true,
        });
      }

      // 2. Verificar que el trato exista y esté pendiente
      const deal = await db.getDeal(dealId);
      if (!deal || deal.status !== 'PENDING') {
        return ctx.answerCallbackQuery({
          text: '✗ Este trato ya fue tomado o no existe.',
          show_alert: true,
        });
      }

      // 3. Verificar si el grupo oficial de tratos con temas está configurado
      const escrowGroupId = await getEscrowGroupId(ctx);
      if (!escrowGroupId) {
        return ctx.answerCallbackQuery({
          text: '✗ Falta configurar el grupo de tratos. Un Owner debe ejecutar /set_grupo_tratos en el supergrupo con temas.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery({ text: '⟡ Creando sala de negociación...' });

      // 4. Asignar admin en BD y Redis
      await dealQueue.assignDealToAdmin(dealId, adminId);
      const redisState = (await redisDb.getDealState(dealId)) || (await redisDb.getCache(`deal_full_info:${dealId}`)) || {};
      
      const dealRole = redisState.role || deal.role || 'Solicitante';
      const dealCounterpart = redisState.counterpart || deal.counterpart || 'No especificado';
      const dealDescription = redisState.description || deal.description || 'Sin especificar';
      const dealCreatorUsername = redisState.creatorUsername || deal.creator_username || null;
      const dealData = {
        role: dealRole,
        counterpart: dealCounterpart,
        description: dealDescription,
        creatorUsername: dealCreatorUsername,
      };

      // 5. Crear el Hilo / Forum Topic en el Supergrupo (con fallback resiliente si el grupo no tiene topics)
      let threadId = null;
      let topicLink = null;
      try {
        const topic = await ctx.api.createForumTopic(
          escrowGroupId,
          `⟡ Trato Admin N°${dealId}`,
          { icon_color: 7322096 } // Cyan / Emerald
        );
        threadId = topic.message_thread_id;

        // Construir enlace directo al hilo
        const cleanChatId = Math.abs(escrowGroupId).toString().replace(/^100/, '');
        topicLink = `https://t.me/c/${cleanChatId}/${threadId}`;
      } catch (topicErr) {
        console.warn('⟡ Aviso creando Forum Topic, aplicando enlace alternativo de grupo:', topicErr.message);
        try {
          const chatInfo = await ctx.api.getChat(escrowGroupId);
          if (chatInfo.username) {
            topicLink = `https://t.me/${chatInfo.username}`;
          } else {
            const exp = await ctx.api.exportChatInviteLink(escrowGroupId);
            topicLink = exp;
          }
        } catch {
          const cleanChatId = Math.abs(escrowGroupId).toString().replace(/^100/, '');
          topicLink = `https://t.me/c/${cleanChatId}`;
        }
      }

      // 6. Generar enlaces de invitación de UN SOLO USO (member_limit: 1) para cada participante
      let creatorJoinLink = topicLink;
      let counterpartJoinLink = topicLink;

      try {
        const cInvite = await ctx.api.createChatInviteLink(escrowGroupId, {
          name: `Trato #${dealId} - Creador`,
          member_limit: 1,
        });
        if (cInvite && cInvite.invite_link) {
          creatorJoinLink = cInvite.invite_link;
          await redisDb.setCache(`user_deal_link:${deal.creator_id}`, creatorJoinLink, 86400);
        }
      } catch (invErr) {
        console.warn('⟡ Error creando invite link para creador:', invErr.message);
      }

      // Resolver ID de la contraparte si es posible
      let counterpartTargetId = null;
      const rawCounterpart = (dealCounterpart || '').trim();
      if (/^\d+$/.test(rawCounterpart)) {
        counterpartTargetId = Number(rawCounterpart);
      } else {
        const foundUser = await db.getUserByUsername(rawCounterpart);
        if (foundUser && foundUser.user_id) {
          counterpartTargetId = foundUser.user_id;
        }
      }

      try {
        const cpInvite = await ctx.api.createChatInviteLink(escrowGroupId, {
          name: `Trato #${dealId} - Contraparte`,
          member_limit: 1,
        });
        if (cpInvite && cpInvite.invite_link) {
          counterpartJoinLink = cpInvite.invite_link;
          if (counterpartTargetId) {
            await redisDb.setCache(`user_deal_link:${counterpartTargetId}`, counterpartJoinLink, 86400);
          }
        }
      } catch (invErr) {
        console.warn('⟡ Error creando invite link para contraparte:', invErr.message);
      }

      // Guardar enlaces activos del trato para revocación inmediata
      await redisDb.setCache(`deal_invites:${dealId}`, [creatorJoinLink, counterpartJoinLink], 86400);

      // 7. Enviar banner de bienvenida fijado en el Hilo/Topic
      const creatorMention = dealCreatorUsername
        ? `@${dealCreatorUsername}`
        : `ID: <code>${deal.creator_id}</code>`;

      const adminMention = adminUsername
        ? `@${adminUsername}`
        : `<a href="tg://user?id=${adminId}">${ctx.from.first_name || 'Admin'}</a>`;

      await ctx.api.sendMessage(
        escrowGroupId,
        templates.dealTopicWelcomeBanner(
          dealId,
          creatorMention,
          dealCounterpart,
          adminMention,
          dealDescription,
          dealRole
        ),
        {
          message_thread_id: threadId,
          parse_mode: 'HTML',
          reply_markup: dealTopicKeyboard(dealId),
        }
      );

      // Guardar mapeos de hilos y deals en Redis y BD
      await dealQueue.setDealInProgress(dealId, escrowGroupId, creatorJoinLink, threadId);
      await redisDb.setCache(`deal_thread:${dealId}`, threadId, 86400 * 7);
      await redisDb.setCache(`thread_deal:${threadId}`, dealId, 86400 * 7);
      await redisDb.setCache(`deal_chat:${dealId}`, [], 86400 * 7);
      await redisDb.setCache(`deal_participants:${dealId}`, {
        creatorId: deal.creator_id,
        counterpartId: counterpartTargetId,
      }, 86400 * 7);

      // 8. Enviar mensaje DM al creador del trato con su enlace único
      try {
        await ctx.api.sendMessage(
          deal.creator_id,
          templates.dealInviteMessage(dealId, creatorJoinLink, topicLink, dealCounterpart, dealRole, dealDescription),
          { parse_mode: 'HTML' }
        );
      } catch {
        console.warn(`⟡ No se pudo enviar DM al creador del trato #${dealId}`);
      }

      // 8.1. Enviar mensaje DM a la contraparte con su enlace único
      try {
        const counterpartRole = (dealRole || '').toUpperCase() === 'VENDEDOR' ? 'COMPRADOR' : 'VENDEDOR';
        if (counterpartTargetId && counterpartTargetId !== deal.creator_id) {
          await ctx.api.sendMessage(
            counterpartTargetId,
            templates.dealCounterpartInviteMessage(
              dealId,
              counterpartJoinLink,
              creatorMention,
              counterpartRole,
              dealRole,
              dealDescription
            ),
            { parse_mode: 'HTML' }
          );
        }
      } catch (cpErr) {
        console.warn(`⟡ No se pudo enviar DM a la contraparte:`, cpErr.message);
      }

      // 9. Actualizar mensaje del Admin con botón de acceso al hilo
      const adminKeyboard = new InlineKeyboard()
        .url(`ENTRAR A LA SALA #${dealId}`, topicLink)
        .row()
        .text('FINALIZAR TRATO', `${CB.DEAL_COMPLETE}${dealId}`).success();

      await ctx.editMessageText(
        `${SYM.DIVIDER}\n` +
        `${SYM.DIAMOND} <b>TRATO ADMIN N°${dealId} ASIGNADO</b> ${SYM.DIAMOND}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CHECK} Has tomado la mediación de este caso.\n` +
        `${SYM.ARROW} Sala asignada: <b>Trato Admin N°${dealId}</b>\n\n` +
        `${SYM.STAR} <b>Enlace a la Sala:</b>\n▸ <a href="${topicLink}">Entrar a la Sala de Negociación</a>\n\n` +
        `${SYM.THIN_LINE}`,
        {
          parse_mode: 'HTML',
          reply_markup: adminKeyboard,
        }
      );
    } catch (err) {
      console.error('⟡ Escrow: Error en deal_accept:', err.message);
    }
  });

  // ── Callback: Finalizar Trato (Copia de Seguridad JSON + Eliminar Hilo) ──
  bot.callbackQuery(/^deal_complete:(\d+)$/, async (ctx) => {
    try {
      const dealId = parseInt(ctx.match[1]);
      const deal = await db.getDeal(dealId);

      if (!deal) {
        return ctx.answerCallbackQuery({ text: '✗ Trato no encontrado.', show_alert: true });
      }

      const isOwner = config.OWNER_IDS.includes(ctx.from.id) || config.OWNER_IDS.includes(Number(ctx.from.id));
      const isAssignedAdmin = deal.admin_id && (String(deal.admin_id) === String(ctx.from.id));
      if (!isAssignedAdmin && !isOwner) {
        return ctx.answerCallbackQuery({
          text: '⚠️ Estos botones no te pertenecen. Solo el Trato Admin asignado o un Owner pueden finalizar este caso.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery({ text: '⟡ Finalizando trato y solicitando calificación...' });

      // 1. Marcar como completado en base de datos
      await dealQueue.completeDeal(dealId);
      const dealData = (await redisDb.getDealState(dealId)) || {};
      const chatHistory = (await redisDb.getCache(`deal_chat:${dealId}`)) || [];

      const adminMember = await db.getStaffMember(deal.admin_id, ctx.tenant?.id);
      const adminUsername = adminMember?.username || ctx.from.username || 'Admin';

      const escrowGroupId = await getEscrowGroupId(ctx);
      const threadId = await redisDb.getCache(`deal_thread:${dealId}`);

      // 2. PUBLICAR SOLICITUD DE CALIFICACIÓN DENTRO DEL HILO / TOPIC (Para que todos lo vean)
      const topicRatingText =
        `${SYM.DIVIDER}\n` +
        `${SYM.DIAMOND} <b>TRATO ADMIN N°${dealId} — FINALIZACIÓN & CALIFICACIÓN</b> ${SYM.DIAMOND}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CHECK} <b>¡Transacción concluida con éxito!</b>\n\n` +
        `${SYM.ARROW} <b>Mediador Asignado:</b> @${adminUsername}\n` +
        `${SYM.ARROW} <b>Solicitante:</b> <code>${deal.creator_id}</code>\n\n` +
        `${SYM.THIN_LINE}\n` +
        `${SYM.STAR} <b>${dealData.creatorUsername ? `@${dealData.creatorUsername}` : 'Solicitante'}, califica la atención del mediador:</b>`;

      if (escrowGroupId && threadId) {
        try {
          await ctx.api.sendMessage(escrowGroupId, topicRatingText, {
            message_thread_id: Number(threadId),
            parse_mode: 'HTML',
            reply_markup: dealRatingKeyboard(dealId),
          });
        } catch (topicErr) {
          console.warn('⟡ Error enviando calificación al topic:', topicErr.message);
        }
      }

      // 3. ENVIAR TAMBIÉN POR DM AL SOLICITANTE
      try {
        await ctx.api.sendMessage(
          deal.creator_id,
          templates.dealRatingMessage(dealId, adminUsername),
          {
            parse_mode: 'HTML',
            reply_markup: dealRatingKeyboard(dealId),
          }
        );
      } catch (dmErr) {
        console.warn(`⟡ No se pudo enviar DM al creador #${deal.creator_id}:`, dmErr.message);
      }

      // 4. GENERAR RESPALDO JSON EN SEGUNDO PLANO
      (async () => {
        try {
          const transcript = {
            deal_id: dealId,
            deal_title: `Trato Admin N°${dealId}`,
            created_at: dealData.createdAt || new Date().toISOString(),
            completed_at: new Date().toISOString(),
            admin: {
              id: deal.admin_id,
              name: ctx.from.first_name || '',
              username: ctx.from.username || null,
            },
            participants: {
              creator: {
                id: deal.creator_id,
                role: dealData.role || 'N/A',
                username: dealData.creatorUsername || null,
              },
              counterpart: {
                role: dealData.role === 'VENDEDOR' ? 'COMPRADOR' : 'VENDEDOR',
                target: dealData.counterpart || 'N/A',
              },
            },
            transaction_details: dealData.description || 'Sin especificar',
            total_messages: chatHistory.length,
            messages: chatHistory,
          };

          const jsonBuffer = Buffer.from(JSON.stringify(transcript, null, 2), 'utf-8');
          const fileName = `trato_${dealId}_backup_${Date.now()}.json`;

          // Subir a Supabase Storage
          let backupUrl = null;
          if (supabaseStorage.isEnabled()) {
            try {
              backupUrl = await supabaseStorage.uploadProof(jsonBuffer, fileName, 'application/json');
            } catch (uploadErr) {
              console.warn('⟡ Error subiendo backup a Supabase:', uploadErr.message);
            }
          }

          // Enviar archivo .json al Canal/Hilo de Logs
          const docFile = new InputFile(jsonBuffer, `trato_${dealId}_historial.json`);
          const destChannel = config.LOG_CHANNEL_ID || config.STAFF_CHAT_ID;
          const destThread = config.LOG_THREAD_ID || (destChannel === config.STAFF_CHAT_ID ? config.STAFF_THREAD_ID : null);

          if (destChannel) {
            try {
              await ctx.api.sendDocument(destChannel, docFile, {
                caption:
                  `${SYM.DIVIDER}\n` +
                  `${SYM.DIAMOND} <b>COPIA DE SEGURIDAD — TRATO ADMIN N°${dealId}</b>\n` +
                  `${SYM.DIVIDER}\n\n` +
                  `${SYM.CHECK} <b>Trato Completado con Éxito</b>\n` +
                  `${SYM.ARROW} <b>Admin:</b> @${ctx.from.username || 'Admin'}\n` +
                  `${SYM.ARROW} <b>Solicitante:</b> <code>${deal.creator_id}</code>\n` +
                  `${SYM.ARROW} <b>Mensajes Registrados:</b> ${transcript.total_messages}\n` +
                  (backupUrl ? `${SYM.ARROW} <b>Nube:</b> <a href="${backupUrl}">Descargar JSON</a>\n` : '') +
                  `\n${SYM.THIN_LINE}`,
                parse_mode: 'HTML',
                ...(destThread ? { message_thread_id: destThread } : {}),
              });
            } catch (sendDocErr) {
              console.warn('⟡ Error enviando documento JSON al canal de logs:', sendDocErr.message);
            }
          }

          // Enviar copia JSON al Trato Admin por privado
          try {
            await ctx.api.sendDocument(ctx.from.id, docFile, {
              caption: `✓ Copia de seguridad del <b>Trato Admin N°${dealId}</b> generada exitosamente.`,
              parse_mode: 'HTML',
            });
          } catch {}
        } catch (bgErr) {
          console.error('⟡ Error en background JSON backup:', bgErr.message);
        }
      })();

      // 5. Actualizar mensaje del admin
      const summaryMsg =
        `⟡ <b>Trato #${dealId} — Completado y en Proceso de Cierre</b>\n\n` +
        `✓ El trato ha sido finalizado.\n` +
        `✓ Solicitud de calificación publicada en el hilo y enviada al solicitante.\n` +
        `✓ Respaldo <code>.json</code> guardado en Supabase.\n` +
        `✓ La sala de negociación se eliminará automáticamente en unos segundos.`;

      try {
        await ctx.editMessageText(summaryMsg, { parse_mode: 'HTML' });
      } catch {
        try {
          await ctx.api.sendMessage(ctx.from.id, summaryMsg, { parse_mode: 'HTML' });
        } catch {}
      }

      // 6. Eliminar completamente el Topic/Hilo de Telegram y expulsar a los 2 usuarios
      const targetThreadId = threadId || deal.thread_id;
      if (escrowGroupId && targetThreadId) {
        setTimeout(async () => {
          try {
            await ctx.api.deleteForumTopic(escrowGroupId, Number(targetThreadId));
            console.log(`✓ Forum topic ${targetThreadId} para Trato #${dealId} eliminado automáticamente.`);
          } catch (delErr) {
            console.warn(`⟡ Error eliminando forum topic ${targetThreadId}:`, delErr.message);
          }
          await expelDealParticipants(ctx.api, escrowGroupId, dealId);
        }, 5000);
      } else {
        await expelDealParticipants(ctx.api, escrowGroupId, dealId);
      }
    } catch (err) {
      console.error('⟡ Escrow: Error en deal_complete:', err.message);
    }
  });

  // ── Callback: Cancelar Trato (forzado por admin) ──
  bot.callbackQuery(/^deal_force_cancel:(\d+)$/, async (ctx) => {
    try {
      const dealId = parseInt(ctx.match[1]);
      const isAuthorized = await isDealAdmin(ctx.from.id, ctx.tenant?.id);
      if (!isAuthorized) {
        return ctx.answerCallbackQuery({
          text: '✗ Solo los Trato Admins y Owners autorizados pueden cancelar este caso.',
          show_alert: true,
        });
      }

      await dealQueue.cancelDeal(dealId);

      const escrowGroupId = await getEscrowGroupId(ctx);
      const threadId = await redisDb.getCache(`deal_thread:${dealId}`);

      if (escrowGroupId && threadId) {
        try {
          await ctx.api.deleteForumTopic(escrowGroupId, Number(threadId));
        } catch {
          try {
            await ctx.api.closeForumTopic(escrowGroupId, Number(threadId));
          } catch {}
        }
      }

      // Expulsar participantes no-staff de inmediato
      await expelDealParticipants(ctx.api, escrowGroupId, dealId);

      await ctx.answerCallbackQuery({ text: '⟡ Trato cancelado.' });
      try {
        await ctx.editMessageText(templates.dealCancelledMessage(dealId), {
          parse_mode: 'HTML',
        });
      } catch {}
    } catch (err) {
      console.error('⟡ Escrow: Error en deal_force_cancel:', err.message);
    }
  });

  // ── Callback: Calificar Admin (Desde el Topic o por DM) ──
  bot.callbackQuery(/^deal_rate:(\d+):(\d+)$/, async (ctx) => {
    try {
      const dealId = parseInt(ctx.match[1]);
      const stars = parseInt(ctx.match[2]);

      if (stars < 1 || stars > 5) {
        return ctx.answerCallbackQuery({ text: '✗ Calificación inválida.', show_alert: true });
      }

      const deal = await db.getDeal(dealId);
      if (!deal || !deal.admin_id) {
        return ctx.answerCallbackQuery({ text: '✗ Trato no encontrado.', show_alert: true });
      }

      if (String(deal.creator_id) !== String(ctx.from.id)) {
        return ctx.answerCallbackQuery({
          text: '⚠️ Estos botones no te pertenecen. Solo el usuario solicitante puede calificar este trato.',
          show_alert: true,
        });
      }

      await rateAdmin(dealId, deal.admin_id, ctx.from.id, stars);

      const starIcons = '⭐'.repeat(stars);
      await ctx.answerCallbackQuery({ text: `✓ Calificación registrada: ${starIcons}` });

      const ratedText =
        `${SYM.DIVIDER}\n` +
        `${SYM.DIAMOND} <b>TRATO ADMIN N°${dealId} — CALIFICACIÓN REGISTRADA</b> ${SYM.DIAMOND}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CHECK} <b>Calificación:</b> ${starIcons} (${stars}.0 / 5.0)\n` +
        `${SYM.ARROW} <b>Estado:</b> Trato concluido y respaldado.\n\n` +
        `${SYM.THIN_LINE}\n` +
        `${SYM.STAR} <i>Este hilo se eliminará automáticamente en unos segundos.</i>`;

      try {
        await ctx.editMessageText(ratedText, { parse_mode: 'HTML' });
      } catch {}

      // Eliminar el Topic limpiamente y retirar solo a invitados no-staff
      const escrowGroupId = await getEscrowGroupId(ctx);
      const threadId = await redisDb.getCache(`deal_thread:${dealId}`);

      if (escrowGroupId && threadId) {
        setTimeout(async () => {
          try {
            await ctx.api.deleteForumTopic(escrowGroupId, Number(threadId));
            console.log(`✓ Forum topic ${threadId} para Trato #${dealId} eliminado.`);
          } catch (delErr) {
            try {
              await ctx.api.closeForumTopic(escrowGroupId, Number(threadId));
            } catch {}
          }

          // Retirar exclusivamente a participantes invitados que NO sean del Staff
          await expelDealParticipants(ctx.api, escrowGroupId, dealId);
        }, 6000);
      } else {
        await expelDealParticipants(ctx.api, escrowGroupId, dealId);
      }
    } catch (err) {
      console.error('⟡ Escrow: Error en deal_rate:', err.message);
      await ctx.answerCallbackQuery({
        text: '✗ Error al registrar calificación.',
        show_alert: true,
      });
    }
  });
}

module.exports = { register };
