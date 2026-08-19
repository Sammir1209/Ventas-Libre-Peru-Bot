const config = require('../../config/env');
const db = require('../../database/postgres');
const redisDb = require('../../database/redis');
const templates = require('../../utils/templates');
const { CB, SYM } = require('../../config/constants');
const { welcomeKeyboard } = require('./keyboard');
const { escapeHtml, mentionFromData } = require('../../utils/formatting');

// ══════════════════════════════════════════════════════
// ⟡ Módulo 1: Verificación de Membresía (Estilo Group Help Profesional)
// ══════════════════════════════════════════════════════

/**
 * Obtiene los canales/grupos requeridos para la verificación (desde BD o config).
 */
async function getChannelsToVerify() {
  try {
    const saved = await db.getSetting('channels_to_verify');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  if (Array.isArray(config.CHANNELS_TO_VERIFY) && config.CHANNELS_TO_VERIFY.length > 0) {
    return config.CHANNELS_TO_VERIFY;
  }

  return [];
}

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

  // ── Comando /set_canales_verificar o /set_canales (Configurar lista de canales requeridos) ──
  bot.command(['set_canales_verificar', 'set_canales', 'set_canales_verify'], async (ctx) => {
    try {
      const userId = ctx.from.id;
      if (!config.OWNER_IDS.includes(userId)) {
        return ctx.reply(`${SYM.CROSS} Solo los <b>Owners</b> pueden configurar los canales de verificación.`, {
          parse_mode: 'HTML',
        });
      }

      const args = ctx.message.text.split(/\s+/).slice(1);
      if (args.length === 0) {
        return ctx.reply(
          `${SYM.DIVIDER}\n` +
          `${SYM.DIAMOND} <b>CONFIGURAR CANALES / GRUPOS DE VERIFICACIÓN</b>\n` +
          `${SYM.DIVIDER}\n\n` +
          `${SYM.ARROW} <b>Uso:</b> <code>/set_canales [canal1] [canal2] [canal3]...</code>\n\n` +
          `${SYM.STAR} <b>Ejemplo:</b>\n` +
          `<code>/set_canales @VentasLibresPeru @CanalRespaldo -1001234567890</code>\n\n` +
          `${SYM.ALERT} <i>Asegúrate de que el bot sea Administrador en todos los canales/grupos indicados para poder comprobar membresía.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      // Guardar lista en BD
      await db.setSetting('channels_to_verify', JSON.stringify(args));
      config.CHANNELS_TO_VERIFY = args;

      await ctx.reply(
        `${SYM.DIVIDER}\n` +
        `${SYM.CHECK} <b>CANALES DE VERIFICACIÓN GUARDADOS</b>\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.ARROW} <b>Canales configurados (${args.length}):</b>\n` +
        args.map((ch, i) => `${SYM.BULLET} <b>${i + 1}.</b> <code>${escapeHtml(ch)}</code>`).join('\n') +
        `\n\n${SYM.CHECK} <b>Persistencia:</b> Guardado en Base de Datos.`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /set_canales:', err.message);
      await ctx.reply(`${SYM.CROSS} Error guardando canales: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Comando /canales_verificar (Ver canales requeridos actuales) ──
  bot.command(['canales_verificar', 'ver_canales', 'canales_verify'], async (ctx) => {
    try {
      const channels = await getChannelsToVerify();
      if (channels.length === 0) {
        return ctx.reply(
          `${SYM.DIVIDER}\n` +
          `${SYM.ALERT} <b>CANALES DE VERIFICACIÓN</b>\n` +
          `${SYM.DIVIDER}\n\n` +
          `${SYM.CROSS} No hay canales ni grupos obligatorios configurados.\n` +
          `${SYM.ARROW} Configúralos con <code>/set_canales [canal1] [canal2] [canal3]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      const statusList = [];
      for (const ch of channels) {
        try {
          const chat = await ctx.api.getChat(ch);
          statusList.push(`${SYM.CHECK} <b>${escapeHtml(chat.title || ch)}</b> (<code>${ch}</code>)`);
        } catch (e) {
          statusList.push(`${SYM.WARNING} <code>${escapeHtml(ch)}</code> (<i>${e.message}</i>)`);
        }
      }

      await ctx.reply(
        `${SYM.DIVIDER}\n` +
        `${SYM.DIAMOND} <b>CANALES Y GRUPOS OBLIGATORIOS</b>\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.ARROW} <b>Total requeridos:</b> ${channels.length}\n\n` +
        statusList.join('\n') +
        `\n\n${SYM.THIN_LINE}\n` +
        `${SYM.STAR} <i>Los nuevos miembros deben unirse a todos ellos para poder hablar.</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /canales_verificar:', err.message);
    }
  });

  // ── Función Universal para Procesar Nuevo Miembro ──
  async function handleNewMember(ctx, chat, user) {
    if (!chat || !user || user.is_bot) return;

    // Solo grupos y supergrupos
    if (chat.type !== 'group' && chat.type !== 'supergroup') return;

    const chatId = chat.id;
    const userId = user.id;
    const username = user.username || null;
    const firstName = user.first_name || 'Usuario';

    // ── 🛡️ CAPA 1 BLACKLIST DINÁMICO: Baneo inmediato de estafadores al ingresar ──
    try {
      const isBurned = await db.isUserBurned(userId, username);
      if (isBurned) {
        console.warn(`🚨 [BLACKLIST DINÁMICO] Intruso detectado intentando ingresar: ${userId} (@${username}) en chat ${chatId}`);
        try {
          await ctx.api.banChatMember(chatId, userId);
        } catch (banErr) {
          console.error('⟡ Error baneando estafador detectado:', banErr.message);
        }

        // Enviar alerta pública al grupo
        try {
          const userTag = username ? `@${username}` : `<b>${escapeHtml(firstName)}</b>`;
          const alertMsg =
            `${SYM.DIVIDER}\n` +
            `${SYM.ALERT} <b>ESTAFADOR DETECTADO Y EXPULSADO</b> ${SYM.WARNING}\n` +
            `${SYM.DIVIDER}\n\n` +
            `${SYM.CROSS} <b>Usuario:</b> ${userTag}\n` +
            `${SYM.ARROW} <b>ID:</b> <code>${userId}</code>\n` +
            `${SYM.ARROW} <b>Estado:</b> Registrado en la <b>Lista Negra Oficial</b>\n\n` +
            `${SYM.THIN_LINE}\n` +
            `${SYM.SHIELD} <i>Intruso expulsado y bloqueado automáticamente por seguridad.</i>`;

          await ctx.reply(alertMsg, { parse_mode: 'HTML' });
        } catch {}

        return;
      }
    } catch (chkErr) {
      console.error('⟡ Error comprobando blacklist dinámico en join:', chkErr.message);
    }

    // ── 🛡️ CAPA 1.5 ANTI-IMPERSONATOR: Detección y baneo de clones de Staff/Coder/Agar ──
    try {
      const { checkImpersonation, handleImpersonator } = require('../moderation/antiImpersonator');
      const cloneDetection = await checkImpersonation(user, ctx.api);
      if (cloneDetection) {
        await handleImpersonator(ctx, chat, user, cloneDetection);
        return;
      }
    } catch (cloneErr) {
      console.error('⟡ Error comprobando anti-impersonator en join:', cloneErr.message);
    }

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

    if (isDisabled) {
      return;
    }

    // Comprobar si el usuario ya está verificado previamente
    const cachedVerified = await redisDb.getCache(`verified_user:${userId}`);
    if (cachedVerified) return;
    try {
      const u = await db.getUser(userId);
      if (u && u.verified) {
        await redisDb.setCache(`verified_user:${userId}`, true, 86400 * 30);
        return;
      }
    } catch {}

    console.log(`⟡ Verificación: Nuevo miembro por verificar en ${chat.title || chatId} -> @${username || userId}`);

    // 1. Mute preventivo inmediato estilo Group Help
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
        },
        use_independent_chat_permissions: true,
      });
      console.log(`✓ Mute preventivo aplicado a ${userId} en ${chatId}`);
    } catch (muteErr) {
      console.warn('⟡ Verificación: Advertencia al mutear preventivamente:', muteErr.message);
    }

    // 2. Registrar usuario en BD
    try {
      await db.upsertUser(userId, username, firstName);
    } catch {}

    // 3. Enviar mensaje de bienvenida con teclado interactivo
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
      const user = update.new_chat_member?.user;

      // SOLO procesar si el usuario REALMENTE ingresó de afuera
      if (oldStatus === 'left' || oldStatus === 'kicked' || !oldStatus) {
        if (newStatus === 'member' || newStatus === 'restricted') {
          await handleNewMember(ctx, update.chat, user);
        }
      }
    } catch (err) {
      console.error('⟡ Verificación: Error en chat_member:', err.message);
    }
  });

  // ── Evento 3: chat_join_request (Si el grupo tiene activada la aprobación de miembros) ──
  bot.on('chat_join_request', async (ctx) => {
    try {
      const req = ctx.chatJoinRequest;
      if (!req) return;

      const isBurned = await db.isUserBurned(req.from.id, req.from.username);
      if (isBurned) {
        console.warn(`🚨 [BLACKLIST DINÁMICO] Solicitud rechazada para estafador: ${req.from.id} (@${req.from.username})`);
        try {
          await ctx.api.declineChatJoinRequest(req.chat.id, req.from.id);
        } catch {}
        return;
      }

      await ctx.api.approveChatJoinRequest(req.chat.id, req.from.id);
      await handleNewMember(ctx, req.chat, req.from);
    } catch (err) {
      console.error('⟡ Verificación: Error en chat_join_request:', err.message);
    }
  });

  // ── Callback: Verificar Membresía (Con protección de usuario y Anti-Spam de Clics) ──
  bot.callbackQuery([CB.VERIFY, /^verify:(\d+)$/], async (ctx) => {
    try {
      const match = ctx.match;
      const targetUserId = match && match[1] ? Number(match[1]) : null;
      const clickerId = ctx.from.id;

      if (targetUserId && clickerId !== targetUserId) {
        return ctx.answerCallbackQuery({
          text: '⚠️ Este botón de verificación fue generado para otro usuario.',
          show_alert: true,
        });
      }

      const userId = clickerId;

      // 1. Debounce Lock de 4 segundos para evitar spam de clics
      const lockKey = `verifying_lock:${userId}`;
      const isLocked = await redisDb.getCache(lockKey);
      if (isLocked) {
        return ctx.answerCallbackQuery({
          text: '⏳ Comprobando membresía, por favor espera un momento...',
          show_alert: false,
        });
      }
      await redisDb.setCache(lockKey, true, 4);

      // 2. Obtener lista de canales obligatorios
      const channels = await getChannelsToVerify();

      if (channels.length === 0) {
        // Sin canales configurados — desmutear directamente
        const unmuted = await unmuteMember(ctx, userId);
        if (unmuted) {
          await ctx.answerCallbackQuery({
            text: '✓ ¡Verificación exitosa! Ya puedes hablar en el grupo.',
            show_alert: false,
          });
        } else {
          await ctx.answerCallbackQuery({
            text: '✓ Verificado. Si continúas silenciado, pide al Staff que verifique los permisos de Admin del bot.',
            show_alert: true,
          });
        }
        return;
      }

      // 3. Verificar membresía en cada uno de los canales/grupos
      const missingChannels = [];

      for (const channel of channels) {
        try {
          const member = await ctx.api.getChatMember(channel, userId);
          const validStatuses = ['creator', 'administrator', 'member'];
          if (validStatuses.includes(member.status)) {
            // Es miembro activo
            continue;
          }
          if (member.status === 'restricted' && member.is_member !== false) {
            // Es miembro pero se encuentra temporalmente restringido/muteado en ese chat
            continue;
          }
          missingChannels.push(channel);
        } catch (chkErr) {
          console.warn(`⟡ Verificación: No se pudo chequear al usuario ${userId} en canal ${channel}: ${chkErr.message}`);
          missingChannels.push(channel);
        }
      }

      if (missingChannels.length > 0) {
        // Faltan canales por unirse
        await ctx.answerCallbackQuery({
          text: `✗ Aún te faltan ${missingChannels.length} grupo(s)/canal(es) por unirte.`,
          show_alert: true,
        });
        await ctx.reply(templates.verificationFailed(missingChannels), {
          parse_mode: 'HTML',
        });
        return;
      }

      // 4. Todos los canales verificados -> Proceder al desmuteo
      const unmuted = await unmuteMember(ctx, userId);
      await ctx.answerCallbackQuery({
        text: unmuted ? '✓ ¡Verificación exitosa! Restricciones removidas.' : '✓ Verificado exitosamente.',
        show_alert: false,
      });

    } catch (err) {
      console.error('⟡ Verificación: Error en callback verify:', err.message);
      try {
        await ctx.answerCallbackQuery({
          text: '✗ Error procesando verificación. Intenta de nuevo.',
          show_alert: true,
        });
      } catch {}
    }
  });

  // ── Callback: Cancelar Verificación ──
  bot.callbackQuery([/^verify_cancel(?::(\d+))?$/, 'verify_cancel'], async (ctx) => {
    try {
      const match = ctx.match;
      const targetUserId = match && match[1] ? Number(match[1]) : null;
      const clickerId = ctx.from.id;

      if (targetUserId && clickerId !== targetUserId) {
        return ctx.answerCallbackQuery({
          text: '⚠️ Este botón no te pertenece.',
          show_alert: true,
        });
      }

      await ctx.answerCallbackQuery({ text: 'Verificación cancelada.' });
      try {
        await ctx.deleteMessage();
      } catch {}
    } catch (err) {
      console.error('⟡ Verificación: Error en verify_cancel:', err.message);
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
 * Remueve completamente las restricciones de un usuario (desmuteo estilo Group Help / Bot API estándar).
 */
async function unmuteMember(ctx, userId) {
  const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
  if (!chatId) {
    console.error(`⟡ Unmute: No se pudo determinar chatId para usuario ${userId}`);
    return false;
  }

  console.log(`⟡ Iniciando proceso de desmuteo para ${userId} en chat ${chatId}...`);

  // Permisos normales de miembro estándar (sin incluir permisos administrativos que causan error 400 en Telegram)
  const defaultMemberPerms = {
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
    can_invite_users: true,
  };

  let targetPermissions = { ...defaultMemberPerms };

  // Intentar obtener permisos predeterminados del grupo si están configurados
  try {
    const chatInfo = await ctx.api.getChat(chatId);
    if (chatInfo && chatInfo.permissions) {
      const cp = chatInfo.permissions;
      targetPermissions = {
        can_send_messages: cp.can_send_messages !== false,
        can_send_audios: cp.can_send_audios !== false,
        can_send_documents: cp.can_send_documents !== false,
        can_send_photos: cp.can_send_photos !== false,
        can_send_videos: cp.can_send_videos !== false,
        can_send_video_notes: cp.can_send_video_notes !== false,
        can_send_voice_notes: cp.can_send_voice_notes !== false,
        can_send_polls: cp.can_send_polls !== false,
        can_send_other_messages: cp.can_send_other_messages !== false,
        can_add_web_page_previews: cp.can_add_web_page_previews !== false,
        can_invite_users: cp.can_invite_users !== false,
      };
    }
  } catch (chatErr) {
    console.warn(`⟡ Aviso al leer permisos de chat ${chatId}:`, chatErr.message);
  }

  let unmutedSuccessfully = false;

  // 1. Intento principal: restrictChatMember con permisos independientes (Bot API 6.5+)
  try {
    await ctx.api.restrictChatMember(chatId, userId, {
      permissions: targetPermissions,
      use_independent_chat_permissions: true,
    });
    unmutedSuccessfully = true;
    console.log(`✓ [Intento 1] restrictChatMember exitoso (use_independent_chat_permissions) para ${userId} en ${chatId}`);
  } catch (err1) {
    console.warn(`⟡ Falló intento 1 de desmuteo (${err1.message}), probando modo estándar...`);

    // 2. Intento secundario: restrictChatMember estándar sin use_independent_chat_permissions
    try {
      await ctx.api.restrictChatMember(chatId, userId, {
        permissions: defaultMemberPerms,
        use_independent_chat_permissions: false,
      });
      unmutedSuccessfully = true;
      console.log(`✓ [Intento 2] restrictChatMember estándar exitoso para ${userId} en ${chatId}`);
    } catch (err2) {
      console.warn(`⟡ Falló intento 2 de desmuteo (${err2.message}), probando permiso mínimo...`);

      // 3. Intento terciario: únicamente can_send_messages
      try {
        await ctx.api.restrictChatMember(chatId, userId, {
          permissions: { can_send_messages: true },
        });
        unmutedSuccessfully = true;
        console.log(`✓ [Intento 3] restrictChatMember mínimo exitoso para ${userId} en ${chatId}`);
      } catch (err3) {
        console.error(`🚨 ERROR CRÍTICO desmuteando a ${userId} en ${chatId}: ${err3.message}`);
        console.error(`👉 Verifica que el Bot tenga permiso de Administrador con "Restringir miembros" (can_restrict_members) en este grupo.`);
      }
    }
  }

  // 4. Respaldo por MTProto directo si el Userbot está activo
  try {
    const userbot = require('../../userbot/client');
    if (userbot && userbot.isConnected && userbot.isConnected()) {
      await userbot.unrestrictUser(chatId, userId);
      console.log(`✓ Desmuteo MTProto Userbot enviado para ${userId} en ${chatId}`);
    }
  } catch {}

  // 5. Marcar como verificado en Redis y BD
  try {
    await redisDb.setCache(`verified_user:${userId}`, true, 86400 * 30);
    await db.verifyUser(userId);
  } catch {}

  // 6. Mensaje de bienvenida y éxito en el chat
  try {
    const user = await db.getUser(userId);
    const firstName = user?.first_name || ctx.from?.first_name || 'Usuario';
    const username = user?.username || ctx.from?.username || null;

    await ctx.api.sendMessage(
      chatId,
      templates.verificationSuccess(username, firstName),
      { parse_mode: 'HTML' }
    );
  } catch (msgErr) {
    console.warn('⟡ No se pudo enviar mensaje de éxito:', msgErr.message);
  }

  // 7. Limpiar mensaje de bienvenida original para mantener el grupo limpio
  if (ctx.callbackQuery?.message?.message_id) {
    try {
      await ctx.api.deleteMessage(chatId, ctx.callbackQuery.message.message_id);
    } catch {}
  }

  return unmutedSuccessfully;
}

module.exports = { register };
