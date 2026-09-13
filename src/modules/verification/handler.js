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
 * Cachea en memoria por 5 minutos para velocidad.
 */
let _channelsCache = null;
let _channelsCacheTime = 0;
const CHANNELS_CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getChannelsToVerify() {
  // Retornar cache si es reciente
  if (_channelsCache && (Date.now() - _channelsCacheTime) < CHANNELS_CACHE_TTL) {
    return _channelsCache;
  }

  try {
    const saved = await db.getSetting('channels_to_verify');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        _channelsCache = parsed;
        _channelsCacheTime = Date.now();
        return parsed;
      }
    }
  } catch {}

  if (Array.isArray(config.CHANNELS_TO_VERIFY) && config.CHANNELS_TO_VERIFY.length > 0) {
    _channelsCache = config.CHANNELS_TO_VERIFY;
    _channelsCacheTime = Date.now();
    return config.CHANNELS_TO_VERIFY;
  }

  _channelsCache = [];
  _channelsCacheTime = Date.now();
  return [];
}

function register(bot) {
  // ── Comando /verify (Activar / Desactivar Verificación en el Grupo) ──
  bot.command('verify', async (ctx) => {
    try {
      if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
        return ctx.reply(
          `⟡ ✗ <i>Este comando solo puede ejecutarse dentro de un grupo o supergrupo para activar o suspender el filtro perimetral.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      const userId = ctx.from.id;
      const isOwner = config.OWNER_IDS.includes(userId);
      const staffMember = await db.getStaffMember(userId);

      // Solo Owners o Staff pueden configurar
      if (!isOwner && !staffMember) {
        return ctx.reply(
          `⟡ ✗ <i>Solo miembros autorizados del Staff u Owners pueden modificar la verificación perimetral.</i>`,
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
          `⟡ <b>SISTEMA DE VERIFICACIÓN</b> ⊱ <code>FILTRO ACTIVADO 🟢</code> ⊰\n` +
          `══════════════════════════════════════════════════════\n\n` +
          `▸ <b>Grupo:</b> <b>${escapeHtml(ctx.chat.title || 'Este grupo')}</b>\n` +
          `▸ <b>Estado:</b> 🟢 <b>ACTIVO & BLINDADO</b>\n` +
          `▸ <b>Base de Datos:</b> Sincronizado permanentemente en Supabase.\n` +
          `──────────────────────────────────────────────────────\n` +
          `🛡️ <i>Todo nuevo miembro será silenciado preventivamente hasta unirse a los canales oficiales.</i>`,
          { parse_mode: 'HTML' }
        );
      } else {
        // Estaba activado -> Desactivar
        await redisDb.setCache(key, true, 86400 * 365);
        await db.setSetting(`verify_disabled_${chatId}`, 'true');
        await ctx.reply(
          `⟡ <b>SISTEMA DE VERIFICACIÓN</b> ⊱ <code>FILTRO SUSPENDIDO 🔴</code> ⊰\n` +
          `══════════════════════════════════════════════════════\n\n` +
          `▸ <b>Grupo:</b> <b>${escapeHtml(ctx.chat.title || 'Este grupo')}</b>\n` +
          `▸ <b>Estado:</b> 🔴 <b>DESACTIVADO</b>\n` +
          `▸ <b>Base de Datos:</b> Sincronizado permanentemente en Supabase.\n` +
          `──────────────────────────────────────────────────────\n` +
          `💡 <i>Los nuevos miembros ya no serán silenciados al entrar (ideal para salas de Staff o Tratos).</i>`,
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
        return ctx.reply(`⟡ ✗ <i>Solo los <b>Owners Supremos</b> pueden configurar los canales de verificación obligatoria.</i>`, {
          parse_mode: 'HTML',
        });
      }

      const args = ctx.message.text.split(/\s+/).slice(1);
      if (args.length === 0) {
        return ctx.reply(
          `⟡ <b>CANALES DE VERIFICACIÓN</b> ⊱ <code>CONFIGURACIÓN</code> ⊰\n` +
          `══════════════════════════════════════════════════════\n\n` +
          `▸ <b>Sintaxis:</b> <code>/set_canales [canal1] [canal2] [canal3]...</code>\n\n` +
          `▸ <b>Ejemplo:</b>\n` +
          `  <code>/set_canales @VentasLibresPeru @CanalRespaldo -1001234567890</code>\n\n` +
          `──────────────────────────────────────────────────────\n` +
          `⚠️ <i>El bot debe ser Administrador en todos los canales indicados para consultar membresías.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      // Guardar lista en BD e invalidar cache
      await db.setSetting('channels_to_verify', JSON.stringify(args));
      config.CHANNELS_TO_VERIFY = args;
      _channelsCache = args;
      _channelsCacheTime = Date.now();

      await ctx.reply(
        `⟡ <b>CANALES REGISTRADOS</b> ⊱ <code>${args.length} CANALES</code> ⊰\n` +
        `══════════════════════════════════════════════════════\n\n` +
        args.map((ch, i) => `▸ <b>${i + 1}.</b> <code>${escapeHtml(ch)}</code>`).join('\n') +
        `\n\n──────────────────────────────────────────────────────\n` +
        `✓ <i>Lista almacenada en base de datos perimetral.</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /set_canales:', err.message);
      await ctx.reply(`⟡ ✗ Error guardando canales: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Comando /canales_verificar (Ver canales requeridos actuales) ──
  bot.command(['canales_verificar', 'ver_canales', 'canales_verify'], async (ctx) => {
    try {
      const channels = await getChannelsToVerify();
      if (channels.length === 0) {
        return ctx.reply(
          `⟡ <b>CANALES DE VERIFICACIÓN</b> ⊱ <code>ESTADO</code> ⊰\n` +
          `══════════════════════════════════════════════════════\n\n` +
          `✗ No hay canales obligatorios registrados actualmente.\n` +
          `▸ Configúralos con: <code>/set_canales [canal1] [canal2]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      const statusList = [];
      for (const ch of channels) {
        let lookupTarget = ch;
        let isKnownInvite = false;
        if (typeof ch === 'string' && (ch.includes('3My6QWWVjMw2Mzc8') || ch.includes('MADRE'))) {
          lookupTarget = -1002561445231;
          isKnownInvite = true;
        }

        try {
          const chat = await ctx.api.getChat(lookupTarget);
          const title = chat.title || (isKnownInvite ? 'Madre de las Ventas TV2' : ch);
          statusList.push(`  • <b>${escapeHtml(title)}</b> (${isKnownInvite ? '<code>Canal Madre TV2</code>' : `<code>${ch}</code>`})`);
        } catch (e) {
          if (isKnownInvite) {
            statusList.push(`  • <b>Madre de las Ventas TV2</b> (<code>https://t.me/+3My6QWWVjMw2Mzc8</code>)`);
          } else {
            statusList.push(`  • <code>${escapeHtml(ch)}</code> (<i>${e.message}</i>)`);
          }
        }
      }

      await ctx.reply(
        `⟡ <b>CANALES DE VERIFICACIÓN</b> ⊱ <code>OBLIGATORIOS</code> ⊰\n` +
        `══════════════════════════════════════════════════════\n\n` +
        `▸ <b>Total registrados:</b> <code>${channels.length} canales</code>\n\n` +
        statusList.join('\n') +
        `\n\n──────────────────────────────────────────────────────\n` +
        `🛡️ <i>Los nuevos miembros deben unirse a cada uno de ellos para desbloquear su chat.</i>`,
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

    // ── 🛡️ CAPA 0 ESCUDO ANTI-RAID & MODO PÁNICO (DEFCON 1) ──
    try {
      const antiRaid = require('../security/antiRaid');
      const raidResult = await antiRaid.processJoinEvent(ctx.api, chat, user);
      if (raidResult.isRaid || !raidResult.shouldWelcome) {
        console.warn(`🛡️ [ANTI-RAID] Bienvenida y verificación individual suprimidas para ${userId} durante ataque activo.`);
        return; // Detener flujo para salvar al bot de FloodWait de Telegram
      }
    } catch (raidErr) {
      console.error('⟡ Error procesando evento de join en antiRaid:', raidErr.message);
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
      if (u && (u.verified || u.is_verified)) {
        await redisDb.setCache(`verified_user:${userId}`, true, 86400 * 30);
        return;
      }
    } catch {}

    console.log(`⟡ Verificación: Nuevo miembro por verificar en ${chat.title || chatId} -> @${username || userId}`);

    // ── 🛡️ Concurrency / Debounce Lock para evitar duplicados ──
    const joinLockKey = `join_proc:${chatId}:${userId}`;
    const alreadyProcessing = await redisDb.getCache(joinLockKey);
    if (alreadyProcessing) {
      console.log(`⟡ Verificación: Ignorando evento duplicado de ingreso para ${userId} en ${chatId}`);
      return;
    }
    // Lock de 25 segundos para asegurar que no se disparen múltiples bienvenidas en paralelo
    await redisDb.setCache(joinLockKey, true, 25);

    // 1. Mute preventivo inmediato estilo Group Help
    try {
      await ctx.api.restrictChatMember(
        chatId,
        userId,
        {
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
          can_invite_users: false,
          can_change_info: false,
          can_pin_messages: false,
          can_manage_topics: false,
        },
        {
          use_independent_chat_permissions: true,
        }
      );
      console.log(`✓ Mute preventivo aplicado a ${userId} en ${chatId}`);
    } catch (muteErr) {
      console.warn('⟡ Verificación: Advertencia al mutear preventivamente:', muteErr.message);
    }

    // 2. Registrar usuario en BD
    try {
      await db.upsertUser(userId, username, firstName);
    } catch {}

    // 3. Eliminar mensaje de verificación previo si existiese alguno colgado
    try {
      const existingPending = await db.getPendingVerification(chatId, userId);
      if (existingPending && existingPending.welcome_msg_id) {
        try {
          await ctx.api.deleteMessage(chatId, existingPending.welcome_msg_id);
        } catch {}
      }
    } catch {}

    // 4. Enviar mensaje de bienvenida con teclado interactivo y registrar en pending_verifications
    try {
      const welcomeMsg = await ctx.api.sendMessage(chatId, templates.welcomeMessage(username, firstName), {
        parse_mode: 'HTML',
        reply_markup: welcomeKeyboard(userId),
      });
      await db.addPendingVerification(chatId, userId, username, firstName, welcomeMsg?.message_id);
    } catch (sendErr) {
      console.error('⟡ Verificación: No se pudo enviar bienvenida:', sendErr.message);
      await db.addPendingVerification(chatId, userId, username, firstName, null);
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

      // Si el cambio de estado fue provocado por el propio bot (ej. cuando el bot mutea), no reprocesar
      const botId = ctx.me?.id;
      if (update.from && botId && update.from.id === botId) return;

      const oldStatus = update.old_chat_member?.status;
      const newStatus = update.new_chat_member?.status;
      const user = update.new_chat_member?.user;

      // SOLO procesar si el usuario REALMENTE ingresó de afuera ('left' o 'kicked') hacia 'member'
      if ((oldStatus === 'left' || oldStatus === 'kicked' || !oldStatus) && newStatus === 'member') {
        await handleNewMember(ctx, update.chat, user);
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
        let targetChatId = channel;
        // Si es el link de invitación conocido de Madre de las Ventas TV2, normalizar al chat_id real
        if (typeof channel === 'string' && (channel.includes('3My6QWWVjMw2Mzc8') || channel.includes('MADRE'))) {
          targetChatId = -1002561445231;
        }

        try {
          const member = await ctx.api.getChatMember(targetChatId, userId);
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
        // Formatear nombres limpios para la ventana emergente nativa (alert modal)
        const names = missingChannels.map(ch => {
          const raw = String(ch).trim();
          if (raw.includes('3My6QWWVjMw2Mzc8') || raw === '-1002561445231' || raw.includes('MADRE')) {
            return '• Madre de las Ventas TV2';
          }
          if (raw.includes('quemando_ventaslibreperu')) {
            return '• Quemando VLP (Lista Negra)';
          }
          if (raw.startsWith('@')) return `• ${raw}`;
          return `• ${raw}`;
        }).join('\n');

        return ctx.answerCallbackQuery({
          text: `⚠️ ACCESO DENEGADO\n\nAún no te has unido a todos los canales requeridos:\n\n${names}\n\nPresiona [ UNIRME ] para verlos y unirte.`,
          show_alert: true,
        });
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

  const fullMemberPerms = {
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

  let unmutedSuccessfully = false;

  // 1. Intento principal: restrictChatMember con permisos independientes (Bot API 6.5+)
  try {
    await ctx.api.restrictChatMember(chatId, userId, fullMemberPerms, {
      use_independent_chat_permissions: true,
    });
    unmutedSuccessfully = true;
    console.log(`✓ [Intento 1] restrictChatMember exitoso para ${userId} en ${chatId}`);
  } catch (err1) {
    console.warn(`⟡ Falló intento 1 de desmuteo (${err1.message}), probando modo estándar...`);

    // 2. Intento secundario: restrictChatMember estándar sin use_independent_chat_permissions
    try {
      await ctx.api.restrictChatMember(chatId, userId, fullMemberPerms);
      unmutedSuccessfully = true;
      console.log(`✓ [Intento 2] restrictChatMember estándar exitoso para ${userId} en ${chatId}`);
    } catch (err2) {
      console.warn(`⟡ Falló intento 2 de desmuteo (${err2.message}), probando permiso mínimo...`);

      // 3. Intento terciario: únicamente can_send_messages
      try {
        await ctx.api.restrictChatMember(chatId, userId, { can_send_messages: true });
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

  // 5. Marcar como verificado en Redis y BD + Quitar de pending_verifications
  let welcomeMsgId = ctx.callbackQuery?.message?.message_id || null;
  try {
    const pending = await db.getPendingVerification(chatId, userId);
    if (pending && pending.welcome_msg_id) {
      welcomeMsgId = welcomeMsgId || pending.welcome_msg_id;
    }
    await db.removePendingVerification(chatId, userId);
    await redisDb.setCache(`verified_user:${userId}`, true, 86400 * 30);
    await db.verifyUser(userId);
  } catch (dbErr) {
    console.error('⟡ Error actualizando estado de verificación en BD:', dbErr.message);
  }

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
  if (welcomeMsgId) {
    try {
      await ctx.api.deleteMessage(chatId, welcomeMsgId);
    } catch {}
  }

  return unmutedSuccessfully;
}

module.exports = { register };
