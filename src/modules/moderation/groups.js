const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM } = require('../../config/constants');
const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════
// ⟡ Módulo 5: Gestión y Configuración de Grupos Oficiales
// ══════════════════════════════════════════════════════

/**
 * Actualiza una variable de entorno en el archivo .env físico.
 */
function updateEnvFile(key, value) {
  try {
    const envPath = path.resolve(__dirname, '../../../.env');
    if (fs.existsSync(envPath)) {
      let envText = fs.readFileSync(envPath, 'utf-8');
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envText)) {
        envText = envText.replace(regex, `${key}=${value}`);
      } else {
        envText += `\n${key}=${value}\n`;
      }
      fs.writeFileSync(envPath, envText, 'utf-8');
    }
  } catch (err) {
    console.warn(`⟡ Error actualizando ${key} en .env:`, err.message);
  }
}

function register(bot) {
  // ── Evento: Bot añadido a un grupo → registrar automáticamente ──
  bot.on('my_chat_member', async (ctx) => {
    try {
      const update = ctx.myChatMember;
      if (!update) return;

      const chat = update.chat;
      const newStatus = update.new_chat_member?.status;

      // El bot fue añadido como admin o miembro
      if (newStatus === 'administrator' || newStatus === 'member') {
        if (chat.type === 'group' || chat.type === 'supergroup' || chat.type === 'channel') {
          await db.registerGroup(chat.id, chat.title || 'Sin título');
          console.log(`⟡ Groups: Grupo/Canal registrado: ${chat.title} (${chat.id})`);
        }
      }

      // El bot fue removido del grupo
      if (newStatus === 'left' || newStatus === 'kicked') {
        if (chat.type === 'group' || chat.type === 'supergroup' || chat.type === 'channel') {
          await db.removeGroup(chat.id);
          console.log(`⟡ Groups: Grupo/Canal removido: ${chat.title} (${chat.id})`);
        }
      }
    } catch (err) {
      console.error('⟡ Groups: Error en my_chat_member:', err.message);
    }
  });

  // ── /set_grupo_staff / /set_tratosadm (Configurar Grupo e Hilo de Solicitudes de Tratos) ──
  bot.command(['set_grupo_staff', 'set_staff', 'set_tratosadm', 'set_topic_tratos'], async (ctx) => {
    try {
      const userId = ctx.from.id;

      // 1. Validar que sea Owner
      if (!config.OWNER_IDS.includes(userId)) {
        return ctx.reply(`${SYM.CROSS} Solo los <b>Owners</b> pueden configurar este destino.`, {
          parse_mode: 'HTML',
        });
      }

      let targetChatId = ctx.chat.id;
      let targetThreadId = ctx.message.message_thread_id || null;
      let targetTitle = ctx.chat.title || 'Grupo de Staff / Tratos Adm';

      // Si se pasó un ID como argumento
      const arg = ctx.message.text.split(/\s+/)[1];
      if (arg && /^-\d+$/.test(arg)) {
        targetChatId = Number(arg);
        targetThreadId = null;
        try {
          const chatInfo = await ctx.api.getChat(targetChatId);
          targetTitle = chatInfo.title || 'Grupo de Staff';
        } catch {}
      } else if (ctx.chat.type === 'private') {
        return ctx.reply(
          `${SYM.DIAMOND} <b>Uso:</b> Ejecuta este comando dentro del grupo/hilo donde deben llegar las solicitudes de Trato Admin, o usa:\n` +
          `<code>/set_tratosadm [ID_DEL_GRUPO]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      // 2. Guardar permanentemente
      config.STAFF_CHAT_ID = targetChatId;
      config.STAFF_THREAD_ID = targetThreadId;
      await db.setSetting('staff_chat_id', targetChatId.toString());
      await db.setSetting('staff_thread_id', targetThreadId ? targetThreadId.toString() : '');
      await db.registerGroup(targetChatId, `Staff/Tratos: ${targetTitle}`);
      updateEnvFile('STAFF_CHAT_ID', targetChatId);
      if (targetThreadId) updateEnvFile('STAFF_THREAD_ID', targetThreadId);

      await ctx.reply(
        `${SYM.DIVIDER}\n` +
        `${SYM.CHECK} <b>HILO / SALA DE TRATOS ADMIN CONFIGURADO</b> ${SYM.CHECK}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CHECK} <b>Grupo:</b> <b>${targetTitle}</b>\n` +
        `${SYM.ARROW} <b>Chat ID:</b> <code>${targetChatId}</code>\n` +
        (targetThreadId ? `${SYM.ARROW} <b>Hilo / Tema (Topic ID):</b> <code>${targetThreadId}</code>\n` : `${SYM.ARROW} <b>Ubicación:</b> Chat Principal\n`) +
        `${SYM.ARROW} <b>Destino:</b> Solicitudes entrantes de <code>/tratoadm</code> para mediadores.\n` +
        `${SYM.CHECK} <b>Persistencia:</b> Guardado permanentemente en Supabase y .env.\n\n` +
        `${SYM.THIN_LINE}\n` +
        `${SYM.STAR} Todas las solicitudes de Trato Admin llegarán directamente a este ${targetThreadId ? 'hilo/tema' : 'chat'}.`,
        {
          parse_mode: 'HTML',
          ...(targetThreadId ? { message_thread_id: targetThreadId } : {}),
        }
      );
    } catch (err) {
      console.error('⟡ Error en /set_staff:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al configurar destino de tratos: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /set_canal_logs / /set_topic_logs (Configurar Canal/Hilo Oficial de Logs y Auditoría) ──
  async function handleSetCanalLogs(ctx) {
    try {
      const msg = ctx.message || ctx.channelPost;
      const isChannel = ctx.chat?.type === 'channel';
      const userId = ctx.from?.id;

      // Validar permisos en chats no-canales
      if (!isChannel && userId && !config.OWNER_IDS.includes(userId)) {
        return ctx.reply(`${SYM.CROSS} Solo los <b>Owners</b> pueden configurar el canal/hilo de logs.`, {
          parse_mode: 'HTML',
        });
      }

      let targetChatId = ctx.chat.id;
      let targetThreadId = msg?.message_thread_id || null;
      let targetTitle = ctx.chat.title || 'Canal de Logs';

      // Si se pasó un ID como argumento
      const text = msg?.text || '';
      const arg = text.split(/\s+/)[1];
      if (arg && /^-\d+$/.test(arg)) {
        targetChatId = Number(arg);
        targetThreadId = null;
        try {
          const chatInfo = await ctx.api.getChat(targetChatId);
          targetTitle = chatInfo.title || 'Canal de Logs';
        } catch {}
      } else if (ctx.chat.type === 'private') {
        return ctx.reply(
          `${SYM.DIAMOND} <b>Uso:</b> Ejecuta este comando dentro del canal/hilo de logs, o usa:\n` +
          `<code>/set_canal_logs [ID_DEL_CANAL]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      // Guardar permanentemente
      config.LOG_CHANNEL_ID = targetChatId;
      config.LOG_THREAD_ID = targetThreadId;
      await db.setSetting('log_channel_id', targetChatId.toString());
      await db.setSetting('log_thread_id', targetThreadId ? targetThreadId.toString() : '');
      await db.registerGroup(targetChatId, `Logs: ${targetTitle}`);
      updateEnvFile('LOG_CHANNEL_ID', targetChatId);
      if (targetThreadId) updateEnvFile('LOG_THREAD_ID', targetThreadId);

      const confirmText =
        `${SYM.DIVIDER}\n` +
        `${SYM.CHECK} <b>DESTINO DE LOGS Y AUDITORÍA CONFIGURADO</b> ${SYM.CHECK}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CHECK} <b>Nombre:</b> <b>${targetTitle}</b>\n` +
        `${SYM.ARROW} <b>Chat ID:</b> <code>${targetChatId}</code>\n` +
        (targetThreadId ? `${SYM.ARROW} <b>Hilo / Tema (Topic ID):</b> <code>${targetThreadId}</code>\n` : `${SYM.ARROW} <b>Ubicación:</b> Canal / Chat Principal\n`) +
        `${SYM.ARROW} <b>Destino:</b> Moderación (/ban, /gban), respaldos .json de chats y auditoría.\n` +
        `${SYM.CHECK} <b>Persistencia:</b> Guardado permanentemente en Supabase y .env.\n\n` +
        `${SYM.THIN_LINE}\n` +
        `${SYM.STAR} Todas las copias de seguridad de tratos y logs se enviarán aquí.`;

      if (isChannel) {
        await ctx.api.sendMessage(targetChatId, confirmText, {
          parse_mode: 'HTML',
          ...(targetThreadId ? { message_thread_id: targetThreadId } : {}),
        });
      } else {
        await ctx.reply(confirmText, {
          parse_mode: 'HTML',
          ...(targetThreadId ? { message_thread_id: targetThreadId } : {}),
        });
      }
    } catch (err) {
      console.error('⟡ Error en /set_canal_logs:', err.message);
      try {
        await ctx.reply(`${SYM.CROSS} Error al configurar destino de logs: ${err.message}`, { parse_mode: 'HTML' });
      } catch {}
    }
  }

  bot.command(['set_canal_logs', 'set_logs', 'set_grupo_logs', 'set_topic_logs'], handleSetCanalLogs);

  // ── /set_grupo_quemar / /set_topic_quemar (Configurar Hilo Oficial de Reportes de Estafa) ──
  bot.command(['set_grupo_quemar', 'set_burn', 'set_topic_quemar', 'set_quemar'], async (ctx) => {
    try {
      const msg = ctx.message || ctx.channelPost;
      const isChannel = ctx.chat?.type === 'channel';
      const userId = ctx.from?.id;

      if (!isChannel && userId && !config.OWNER_IDS.includes(userId)) {
        return ctx.reply(`${SYM.CROSS} Solo los <b>Owners</b> pueden configurar este destino.`, {
          parse_mode: 'HTML',
        });
      }

      let targetChatId = ctx.chat.id;
      let targetThreadId = msg?.message_thread_id || null;
      let targetTitle = ctx.chat.title || 'Grupo de Denuncias / Quemar';

      const text = msg?.text || '';
      const arg = text.split(/\s+/)[1];
      if (arg && /^-\d+$/.test(arg)) {
        targetChatId = Number(arg);
        targetThreadId = null;
        try {
          const chatInfo = await ctx.api.getChat(targetChatId);
          targetTitle = chatInfo.title || 'Grupo de Denuncias';
        } catch {}
      } else if (ctx.chat.type === 'private') {
        return ctx.reply(
          `${SYM.DIAMOND} <b>Uso:</b> Ejecuta este comando dentro del grupo/hilo donde deben llegar los reportes de /quemar, o usa:\n` +
          `<code>/set_quemar [ID_DEL_GRUPO]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      config.BURN_CHAT_ID = targetChatId;
      config.BURN_THREAD_ID = targetThreadId;
      await db.setSetting('burn_chat_id', targetChatId.toString());
      await db.setSetting('burn_thread_id', targetThreadId ? targetThreadId.toString() : '');
      await db.registerGroup(targetChatId, `Quemar: ${targetTitle}`);
      updateEnvFile('BURN_CHAT_ID', targetChatId);
      if (targetThreadId) updateEnvFile('BURN_THREAD_ID', targetThreadId);

      await ctx.reply(
        `${SYM.DIVIDER}\n` +
        `${SYM.CHECK} <b>HILO / SALA DE REPORTES /QUEMAR CONFIGURADO</b> ${SYM.CHECK}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CHECK} <b>Grupo:</b> <b>${targetTitle}</b>\n` +
        `${SYM.ARROW} <b>Chat ID:</b> <code>${targetChatId}</code>\n` +
        (targetThreadId ? `${SYM.ARROW} <b>Hilo / Tema (Topic ID):</b> <code>${targetThreadId}</code>\n` : `${SYM.ARROW} <b>Ubicación:</b> Chat Principal\n`) +
        `${SYM.ARROW} <b>Destino:</b> Denuncias y pruebas fotográficas de estafadores para revisión.\n` +
        `${SYM.CHECK} <b>Persistencia:</b> Guardado permanentemente en Supabase y .env.\n\n` +
        `${SYM.THIN_LINE}\n` +
        `${SYM.STAR} Todos los reportes del comando /quemar llegarán directamente a este ${targetThreadId ? 'hilo/tema' : 'chat'}.`,
        {
          parse_mode: 'HTML',
          ...(targetThreadId ? { message_thread_id: targetThreadId } : {}),
        }
      );
    } catch (err) {
      console.error('⟡ Error en /set_quemar:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al configurar destino de quemar: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /set_canal_quemar / /set_quemados (Canal Público Oficial de Estafadores Quemados) ──
  async function handleSetCanalQuemar(ctx) {
    try {
      const msg = ctx.message || ctx.channelPost;
      const isChannel = ctx.chat?.type === 'channel';
      const userId = ctx.from?.id;

      // 1. Validar permisos en no-canales
      if (!isChannel && userId && !config.OWNER_IDS.includes(userId)) {
        return ctx.reply(`${SYM.CROSS} Solo los <b>Owners</b> pueden configurar este canal.`, {
          parse_mode: 'HTML',
        });
      }

      let targetChatId = ctx.chat.id;
      let targetThreadId = msg?.message_thread_id || null;
      let targetTitle = ctx.chat.title || 'Canal de Estafadores Quemados';

      // Si se pasó un ID como argumento
      const text = msg?.text || '';
      const arg = text.split(/\s+/)[1];
      if (arg && /^-\d+$/.test(arg)) {
        targetChatId = Number(arg);
        targetThreadId = null;
        try {
          const chatInfo = await ctx.api.getChat(targetChatId);
          targetTitle = chatInfo.title || 'Canal de Estafadores Quemados';
        } catch {}
      } else if (ctx.chat.type === 'private') {
        return ctx.reply(
          `${SYM.DIAMOND} <b>Uso:</b> Ejecuta este comando dentro del canal oficial de quemados, o usa:\n` +
          `<code>/set_canal_quemar [ID_DEL_CANAL]</code>`,
          { parse_mode: 'HTML' }
        );
      }

      // 2. Guardar permanentemente
      config.PUBLIC_BURN_CHANNEL_ID = targetChatId;
      config.PUBLIC_BURN_THREAD_ID = targetThreadId;
      await db.setSetting('public_burn_channel_id', targetChatId.toString());
      await db.setSetting('public_burn_thread_id', targetThreadId ? targetThreadId.toString() : '');
      await db.registerGroup(targetChatId, `Canal Quemados: ${targetTitle}`);
      updateEnvFile('PUBLIC_BURN_CHANNEL_ID', targetChatId);
      if (targetThreadId) updateEnvFile('PUBLIC_BURN_THREAD_ID', targetThreadId);

      const confirmText =
        `${SYM.DIVIDER}\n` +
        `${SYM.CHECK} <b>CANAL OFICIAL DE QUEMADOS CONFIGURADO</b> ${SYM.CHECK}\n` +
        `${SYM.DIVIDER}\n\n` +
        `${SYM.CHECK} <b>Nombre:</b> <b>${targetTitle}</b>\n` +
        `${SYM.ARROW} <b>Chat ID:</b> <code>${targetChatId}</code>\n` +
        (targetThreadId ? `${SYM.ARROW} <b>Hilo / Topic:</b> <code>${targetThreadId}</code>\n` : `${SYM.ARROW} <b>Ubicación:</b> Canal Principal\n`) +
        `${SYM.ARROW} <b>Destino:</b> Publicaciones automáticas con Banners de Perfil de estafadores quemados y pruebas.\n` +
        `${SYM.CHECK} <b>Persistencia:</b> Guardado permanentemente en Supabase y .env.\n\n` +
        `${SYM.THIN_LINE}\n` +
        `${SYM.STAR} Cada vez que el Staff apruebe un reporte, se publicará automáticamente aquí.`;

      if (isChannel) {
        await ctx.api.sendMessage(targetChatId, confirmText, {
          parse_mode: 'HTML',
          ...(targetThreadId ? { message_thread_id: targetThreadId } : {}),
        });
      } else {
        await ctx.reply(confirmText, {
          parse_mode: 'HTML',
          ...(targetThreadId ? { message_thread_id: targetThreadId } : {}),
        });
      }
    } catch (err) {
      console.error('⟡ Error en /set_canal_quemar:', err.message);
      try {
        await ctx.reply(`${SYM.CROSS} Error al configurar canal de quemados: ${err.message}`, { parse_mode: 'HTML' });
      } catch {}
    }
  }

  bot.command(['set_canal_quemar', 'set_quemados', 'set_public_burn'], handleSetCanalQuemar);

  // Escuchar también en channel_post directamente
  bot.on('channel_post', async (ctx, next) => {
    const text = ctx.channelPost?.text?.trim() || '';
    if (/^\/(set_canal_quemar|set_quemados|set_public_burn)(\s+.*)?$/i.test(text)) {
      return handleSetCanalQuemar(ctx);
    }
    if (/^\/(set_canal_logs|set_logs|set_grupo_logs)(\s+.*)?$/i.test(text)) {
      return handleSetCanalLogs(ctx);
    }
    return next();
  });
}

module.exports = { register };

