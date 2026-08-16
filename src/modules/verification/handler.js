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
      const isPrivate = ctx.chat.type === 'private';
      if (isPrivate) {
        return ctx.reply(
          `${SYM.CROSS} Este comando se utiliza <b>dentro de un grupo</b> para activar o desactivar la verificación obligatoria de nuevos miembros.`,
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

  // ── Evento: Nuevo miembro en el grupo ──
  bot.on('message:new_chat_members', async (ctx) => {
    try {
      const chatId = ctx.chat.id;

      // 1. Eximir automáticamente el supergrupo de Escrow y Staff
      if (chatId === config.ESCROW_GROUP_ID || chatId === config.STAFF_CHAT_ID) {
        return;
      }

      // 2. Comprobar si la verificación está desactivada para este grupo
      let isDisabled = await redisDb.getCache(`verify_disabled:${chatId}`);
      if (isDisabled === null || isDisabled === undefined) {
        const saved = await db.getSetting(`verify_disabled_${chatId}`);
        isDisabled = saved === 'true';
        if (isDisabled) await redisDb.setCache(`verify_disabled:${chatId}`, true, 86400 * 365);
      }

      if (isDisabled) {
        return; // No mutear ni pedir verificación
      }

      const newMembers = ctx.message.new_chat_members || [];

      for (const member of newMembers) {
        if (member.is_bot) continue;

        const userId = member.id;
        const username = member.username;
        const firstName = member.first_name;

        // 2. Mute inmediato
        try {
          await ctx.api.restrictChatMember(ctx.chat.id, userId, {
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
          });
        } catch (muteErr) {
          console.error('⟡ Verificación: No se pudo mutear:', muteErr.message);
        }

        // 3. Registrar usuario en BD
        try {
          await db.upsertUser(userId, username, firstName);
        } catch {}

        // 4. Enviar mensaje de bienvenida con botones
        await ctx.api.sendMessage(ctx.chat.id, templates.welcomeMessage(username, firstName), {
          parse_mode: 'HTML',
          reply_markup: welcomeKeyboard(),
        });
      }
    } catch (err) {
      console.error('⟡ Verificación: Error en message:new_chat_members:', err.message);
    }
  });

  // ── Callback: Verificar Membresía ──
  bot.callbackQuery(CB.VERIFY, async (ctx) => {
    try {
      const userId = ctx.from.id;
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
  bot.callbackQuery(CB.HOW_IT_WORKS, async (ctx) => {
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
 * Remueve las restricciones de un usuario (unmute).
 */
async function unmuteMember(ctx, userId) {
  const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
  if (!chatId) return;

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
      can_change_info: false,
      can_invite_users: true,
      can_pin_messages: false,
      can_manage_topics: false,
    },
  });

  // Marcar como verificado en BD
  await db.verifyUser(userId);

  // Mensaje de éxito
  const user = await db.getUser(userId);
  await ctx.api.sendMessage(
    chatId,
    templates.verificationSuccess(user?.username, user?.first_name),
    { parse_mode: 'HTML' }
  );
}

module.exports = { register };
