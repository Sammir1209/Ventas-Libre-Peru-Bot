const config = require('../../config/env');
const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const templates = require('../../utils/templates');
const { CB, SYM } = require('../../config/constants');
const { welcomeKeyboard } = require('./keyboard');
const { escapeHtml } = require('../../utils/formatting');

// ══════════════════════════════════════════════════════
// ⟡ Módulo 1: Verificación de Membresía (Con Toggle /verify)
// ══════════════════════════════════════════════════════

function register(bot) {
  // ── Comando /verify (Activar / Desactivar Verificación en el Grupo) ──
  bot.command('verify', async (ctx) => {
    try {
      if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
        return ctx.reply(
          `${SYM.CROSS} Este comando solo se utiliza <b>dentro de un grupo o supergrupo</b> para activar o desactivar la verificación obligatoria.`,
          { parse_mode: 'HTML' }
        );
      }

      const userId = ctx.from.id;
      const isOwner = config.OWNER_IDS.includes(userId);
      const staffMember = await db.getStaffMember(userId);

      // Solo Owners o Staff pueden configurar
      if (!isOwner && !staffMember) {
        return ctx.reply(
          `${SYM.CROSS} Solo los miembros del <b>Staff u Owners</b> pueden modificar la verificación en este grupo.`,
          { parse_mode: 'HTML' }
        );
      }

      const chatId = ctx.chat.id;
      const key = `verify_disabled:${chatId}`;
      let isDisabled = await redisDb.getCache(key);
      if (isDisabled === null || isDisabled === undefined) {
        const savedSetting = await db.getSetting(`verify_disabled_${chatId}`);
        isDisabled = savedSetting === 'true';
      }

      if (isDisabled) {
        // Estaba desactivado -> Activar
        await redisDb.clearCache(key);
        await db.setSetting(`verify_disabled_${chatId}`, 'false');
        await ctx.reply(
          `${SYM.DIVIDER}\n` +
          `${SYM.DIAMOND} <b>SISTEMA DE VERIFICACIÓN</b> ${SYM.DIAMOND}\n` +
          `${SYM.DIVIDER}\n\n` +
          `${SYM.ARROW} <b>Grupo:</b> ${escapeHtml(ctx.chat.title || 'Este grupo')}\n` +
          `${SYM.CHECK} <b>Estado:</b> <b>ACTIVADO 🟢</b>\n\n` +
          `${SYM.CHECK} <b>Persistencia:</b> Guardado permanentemente en Supabase.\n` +
          `${SYM.THIN_LINE}\n` +
          `${SYM.STAR} A partir de ahora, los nuevos miembros serán <b>silenciados automáticamente</b> hasta que se unan a los canales y verifiquen su membresía.`,
          { parse_mode: 'HTML' }
        );
      } else {
        // Estaba activado -> Desactivar
        await redisDb.setCache(key, true, 86400 * 365);
        await db.setSetting(`verify_disabled_${chatId}`, 'true');
        await ctx.reply(
          `${SYM.DIVIDER}\n` +
          `${SYM.DIAMOND} <b>SISTEMA DE VERIFICACIÓN</b> ${SYM.DIAMOND}\n` +
          `${SYM.DIVIDER}\n\n` +
          `${SYM.ARROW} <b>Grupo:</b> ${escapeHtml(ctx.chat.title || 'Este grupo')}\n` +
          `${SYM.CROSS} <b>Estado:</b> <b>DESACTIVADO 🔴</b>\n\n` +
          `${SYM.CHECK} <b>Persistencia:</b> Guardado permanentemente en Supabase.\n` +
          `${SYM.THIN_LINE}\n` +
          `${SYM.STAR} Los nuevos miembros que ingresen a este grupo ya <b>NO serán silenciados ni obligados a verificarse</b> (ideal para grupos de Staff y Tratos).`,
          { parse_mode: 'HTML' }
        );
      }
    } catch (err) {
      console.error('⟡ Verificación: Error en /verify:', err.message);
    }
  });

  // ── Función Universal para Procesar Nuevo Miembro ──
  async function handleNewMember(ctx, chat, user) {
    if (!chat || !user || user.is_bot) return;

    // Solo grupos y supergrupos
    if (chat.type !== 'group' && chat.type !== 'supergroup') return;

    const chatId = chat.id;

    // Eximir automáticamente supergrupos de Escrow y Staff
    if (chatId === config.ESCROW_GROUP_ID || chatId === config.STAFF_CHAT_ID) {
      return;
    }

    // Comprobar si la verificación está desactivada para este grupo
    let isDisabled = await redisDb.getCache(`verify_disabled:${chatId}`);
    if (isDisabled === null || isDisabled === undefined) {
      const saved = await db.getSetting(`verify_disabled_${chatId}`);
      isDisabled = saved === 'true';
      if (isDisabled) await redisDb.setCache(`verify_disabled:${chatId}`, true, 86400 * 365);
    }

    if (isDisabled) return;

    const userId = user.id;
    const username = user.username;
    const firstName = user.first_name;

    console.log(`⟡ Verificación: Nuevo miembro en ${chat.title || chatId} -> @${username || userId}`);

    // 1. Mute inmediato
    try {
      await ctx.api.restrictChatMember(chatId, userId, {
        permissions: {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
          can_manage_topics: false,
        },
        use_independent_chat_permissions: true,
      });
    } catch (muteErr) {
      console.warn('⟡ Verificación: No se pudo mutear:', muteErr.message);
    }

    // 2. Registrar usuario en BD
    try {
      await db.upsertUser(userId, username, firstName);
    } catch {}

    // 3. Enviar mensaje de bienvenida con teclado
    try {
      await ctx.api.sendMessage(chatId, templates.welcomeMessage(username, firstName), {
        parse_mode: 'HTML',
        reply_markup: welcomeKeyboard(userId),
      });
    } catch (sendErr) {
      console.error('⟡ Verificación: No se pudo enviar bienvenida:', sendErr.message);
    }
  }

  // ── Evento 1: Mensaje de servicio nuevo miembro ──
  bot.on('message:new_chat_members', async (ctx) => {
    try {
      const newMembers = ctx.message.new_chat_members || [];
      for (const member of newMembers) {
        await handleNewMember(ctx, ctx.chat, member);
      }
    } catch (err) {
      console.error('⟡ Verificación: Error en message:new_chat_members:', err.message);
    }
  });

  // ── Evento 2: chat_member (Para supergrupos grandes o con mensajes de servicio ocultos) ──
  bot.on('chat_member', async (ctx) => {
    try {
      const update = ctx.chatMember;
      if (!update) return;

      const oldStatus = update.old_chat_member?.status;
      const newStatus = update.new_chat_member?.status;

      // El usuario acaba de unirse o fue añadido
      if ((oldStatus === 'left' || oldStatus === 'kicked' || !oldStatus) && newStatus === 'member') {
        await handleNewMember(ctx, update.chat, update.new_chat_member.user);
      }
    } catch (err) {
      console.error('⟡ Verificación: Error en chat_member:', err.message);
    }
  });

  // ── Callback: Verificar Membresía (Con protección de usuario) ──
  bot.callbackQuery([CB.VERIFY, /^verify:(\d+)$/], async (ctx) => {
    try {
      const match = ctx.match;
      const targetUserId = match && match[1] ? Number(match[1]) : null;
      const clickerId = ctx.from.id;

      if (targetUserId && clickerId !== targetUserId) {
        return ctx.answerCallbackQuery({
          text: '⚠️ Esta verificación fue generada para otro usuario. Si acabas de ingresar, usa el mensaje que te envió el bot.',
          show_alert: true,
        });
      }

      const userId = clickerId;
      const channels = config.CHANNELS_TO_VERIFY;

      if (channels.length === 0) {
        // Sin canales configurados — verificar directamente
        await unmuteMember(ctx, userId);
        await ctx.answerCallbackQuery({
          text: '✓ Verificación exitosa',
          show_alert: false,
        });
        return;
      }

      // Verificar membresía en cada canal
      const missingChannels = [];

      for (const channel of channels) {
        try {
          const member = await ctx.api.getChatMember(channel, userId);
          const validStatuses = ['member', 'administrator', 'creator'];
          if (!validStatuses.includes(member.status)) {
            missingChannels.push(channel);
          }
        } catch {
          missingChannels.push(channel);
        }
      }

      if (missingChannels.length > 0) {
        // Faltan canales
        await ctx.answerCallbackQuery({
          text: '✗ Aún te faltan canales por unirte',
          show_alert: true,
        });
        await ctx.reply(templates.verificationFailed(missingChannels), {
          parse_mode: 'HTML',
        });
        return;
      }

      // Todos verificados — unmute
      await unmuteMember(ctx, userId);
      await ctx.answerCallbackQuery({
        text: '✓ Verificación exitosa',
        show_alert: false,
      });
    } catch (err) {
      console.error('⟡ Verificación: Error en callback verify:', err.message);
      await ctx.answerCallbackQuery({
        text: '✗ Error al verificar. Intenta de nuevo.',
        show_alert: true,
      });
    }
  });

  // ── Callback: ¿Cómo funciona? ──
  bot.callbackQuery([CB.HOW_IT_WORKS, /^how_it_works:(\d+)$/], async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      await ctx.reply(templates.howItWorksMessage(), {
        parse_mode: 'HTML',
      });
    } catch (err) {
      console.error('⟡ Verificación: Error en how_it_works:', err.message);
    }
  });
}

/**
 * Remueve completamente las restricciones de un usuario (unmute).
 */
async function unmuteMember(ctx, userId) {
  const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
  if (!chatId) return;

  const fullPerms = {
    can_send_messages: true,
    can_send_audios: true,
    can_send_documents: true,
    can_send_photos: true,
    can_send_videos: true,
    can_send_video_notes: true,
    can_send_voice_notes: true,
    can_send_polls: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true,
    can_change_info: true,
    can_invite_users: true,
    can_pin_messages: true,
    can_manage_topics: true,
  };

  try {
    await ctx.api.restrictChatMember(chatId, userId, {
      permissions: fullPerms,
      use_independent_chat_permissions: true,
    });
    console.log(`✓ Miembro ${userId} desmuteado con éxito en chat ${chatId}`);
  } catch (err1) {
    console.warn(`⟡ Intento 1 restrictChatMember: ${err1.message}. Reintentando con permisos básicos...`);
    try {
      await ctx.api.restrictChatMember(chatId, userId, {
        permissions: {
          can_send_messages: true,
          can_send_audios: true,
          can_send_documents: true,
          can_send_photos: true,
          can_send_videos: true,
          can_send_video_notes: true,
          can_send_voice_notes: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
        },
      });
      console.log(`✓ Miembro ${userId} desmuteado con éxito (fallback)`);
    } catch (err2) {
      console.error(`⟡ ERROR al desmutear miembro ${userId}:`, err2.message);
    }
  }

  // Marcar como verificado en BD
  try {
    await db.verifyUser(userId);
  } catch {}

  // Mensaje de éxito
  const user = await db.getUser(userId);
  try {
    await ctx.api.sendMessage(
      chatId,
      templates.verificationSuccess(user?.username || ctx.from?.username, user?.first_name || ctx.from?.first_name),
      { parse_mode: 'HTML' }
    );
  } catch {}

  // Limpiar mensaje de bienvenida original para mantener el grupo limpio
  if (ctx.callbackQuery?.message?.message_id) {
    try {
      await ctx.api.deleteMessage(chatId, ctx.callbackQuery.message.message_id);
    } catch {}
  }
}

module.exports = { register };
