const db = require('../../database/postgres');
const config = require('../../config/env');
const { SYM, ROLES } = require('../../config/constants');
const { requireStaff } = require('../../middleware/auth');
const { formatId, escapeHtml, mentionFromData } = require('../../utils/formatting');
const { InlineKeyboard } = require('grammy');
const userbot = require('../../userbot/client');

// ══════════════════════════════════════════════════════
// ⟡ MOTOR CENTINELA VLP (VLP Sentinel Engine)
// ⟡ Sistema Propietario de Seguridad e Inteligencia Forense
// ══════════════════════════════════════════════════════

/**
 * Parsea cadenas de duración flexibles para silenciar o penalizar.
 * Soporta: 1s, 10s, 1m, 5m, 1h, 12h, 1d, 7d, 1w, 1mo, 1y y texto en español.
 */
function parseDuration(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const clean = timeStr.trim().toLowerCase();

  const match = clean.match(/^(\d+)\s*([a-zñáéíóú]+)?$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  if (isNaN(value) || value <= 0) return null;

  const unit = match[2] ? match[2].toLowerCase() : 'd'; // default días si solo pone número

  let seconds = 0;
  let humanReadable = '';

  switch (unit) {
    case 's':
    case 'seg':
    case 'segs':
    case 'segundo':
    case 'segundos':
      seconds = value;
      humanReadable = `${value} segundo(s)`;
      break;

    case 'm':
    case 'min':
    case 'mins':
    case 'minuto':
    case 'minutos':
      seconds = value * 60;
      humanReadable = `${value} minuto(s)`;
      break;

    case 'h':
    case 'hr':
    case 'hrs':
    case 'hora':
    case 'horas':
      seconds = value * 3600;
      humanReadable = `${value} hora(s)`;
      break;

    case 'd':
    case 'dia':
    case 'dias':
    case 'día':
    case 'días':
      seconds = value * 86400;
      humanReadable = `${value} día(s)`;
      break;

    case 'w':
    case 'sem':
    case 'semana':
    case 'semanas':
      seconds = value * 7 * 86400;
      humanReadable = `${value} semana(s)`;
      break;

    case 'mo':
    case 'mth':
    case 'mes':
    case 'meses':
      seconds = value * 30 * 86400;
      humanReadable = `${value} mes(es)`;
      break;

    case 'y':
    case 'a':
    case 'ano':
    case 'anos':
    case 'año':
    case 'años':
      seconds = value * 365 * 86400;
      humanReadable = `${value} año(s)`;
      break;

    default:
      return null;
  }

  // Telegram API restrict until_date:
  // Si es < 30 segundos, Telegram por defecto restringe para siempre.
  // Ajustamos al mínimo de 35 segundos para que Telegram procese el unmute temporal automáticamente.
  const apiUntilDate = Math.floor(Date.now() / 1000) + Math.max(35, seconds);

  return {
    seconds,
    humanReadable,
    untilDate: apiUntilDate,
  };
}

/**
 * Extractor Universal de Objetivos y Argumentos para todos los comandos de moderación.
 * Soporta:
 *  - Responder a un mensaje (ctx.message.reply_to_message)
 *  - Menciones directas con entity (text_mention)
 *  - @username
 *  - ID numérico
 */
async function resolveTargetAndArgs(ctx, options = {}) {
  const { hasDuration = false } = options;
  const message = ctx.message || {};
  const text = message.text || '';
  const parts = text.trim().split(/\s+/);
  const entities = message.entities || [];

  let target = null;
  let duration = null;
  let reason = 'Sin especificar';
  let rawArgs = [];

  // 1. Caso A: Respuesta a mensaje (Reply)
  if (message.reply_to_message && message.reply_to_message.from) {
    const from = message.reply_to_message.from;
    target = {
      userId: from.id,
      username: from.username || null,
      firstName: from.first_name || 'Usuario',
      source: 'REPLY',
    };
    rawArgs = parts.slice(1);

    if (hasDuration && rawArgs.length > 0) {
      const parsedDur = parseDuration(rawArgs[0]);
      if (parsedDur) {
        duration = parsedDur;
        reason = rawArgs.slice(1).join(' ') || 'Sin especificar';
      } else {
        duration = parseDuration('1d'); // Default 1 día si no se especificó formato de tiempo
        reason = rawArgs.join(' ') || 'Sin especificar';
      }
    } else {
      if (hasDuration) duration = parseDuration('1d');
      reason = rawArgs.join(' ') || 'Sin especificar';
    }

    return { target, duration, reason };
  }

  // 2. Caso B: Mención de texto oculta (text_mention entity)
  const textMentionEntity = entities.find((e) => e.type === 'text_mention' && e.user);
  if (textMentionEntity && textMentionEntity.user) {
    const u = textMentionEntity.user;
    target = {
      userId: u.id,
      username: u.username || null,
      firstName: u.first_name || 'Usuario',
      source: 'ENTITY',
    };
    rawArgs = parts.slice(2);

    if (hasDuration && rawArgs.length > 0) {
      const parsedDur = parseDuration(rawArgs[0]);
      if (parsedDur) {
        duration = parsedDur;
        reason = rawArgs.slice(1).join(' ') || 'Sin especificar';
      } else {
        duration = parseDuration('1d');
        reason = rawArgs.join(' ') || 'Sin especificar';
      }
    } else {
      if (hasDuration) duration = parseDuration('1d');
      reason = rawArgs.join(' ') || 'Sin especificar';
    }

    return { target, duration, reason };
  }

  // 3. Caso C: Argumento explícito en texto (/cmd @user o /cmd 123456)
  if (parts.length < 2) {
    return { target: null, duration: null, reason: null, error: 'MISSING_TARGET' };
  }

  const rawTargetArg = parts[1];

  // Es ID numérico
  if (/^\d{5,16}$/.test(rawTargetArg)) {
    const numericId = parseInt(rawTargetArg, 10);
    target = {
      userId: numericId,
      username: null,
      firstName: null,
      source: 'NUMERIC_ID',
    };

    // Intentar resolver username/firstName si están en BD o Telegram
    try {
      const u = await db.getUser(numericId);
      if (u) {
        target.username = u.username || null;
        target.firstName = u.first_name || null;
      }
    } catch {}
  }
  // Es @username o username
  else if (rawTargetArg.startsWith('@') || /^[a-zA-Z0-9_]{3,32}$/.test(rawTargetArg)) {
    const cleanUser = rawTargetArg.replace(/^@/, '');

    // 1. Userbot MTProto si está disponible
    if (userbot.isConnected()) {
      try {
        const ub = await userbot.resolveUser(cleanUser);
        if (ub && ub.userId) {
          target = {
            userId: ub.userId,
            username: ub.username || cleanUser,
            firstName: ub.firstName || null,
            source: 'USERBOT',
          };
        }
      } catch {}
    }

    // 2. Telegram API getChat
    if (!target) {
      try {
        const chat = await ctx.api.getChat(`@${cleanUser}`);
        if (chat && chat.id) {
          target = {
            userId: chat.id,
            username: chat.username || cleanUser,
            firstName: chat.first_name || null,
            source: 'API',
          };
        }
      } catch {}
    }

    // 3. Buscar en base de datos
    if (!target) {
      try {
        const dbUser = await db.getUserByUsername(cleanUser);
        if (dbUser && dbUser.user_id) {
          target = {
            userId: Number(dbUser.user_id),
            username: dbUser.username || cleanUser,
            firstName: dbUser.first_name || null,
            source: 'DATABASE',
          };
        }
      } catch {}
    }

    // 4. Buscar en tabla de quemados
    if (!target) {
      try {
        const burned = await db.getBurnedUserInfo(cleanUser);
        if (burned && burned.user_id) {
          target = {
            userId: Number(burned.user_id),
            username: burned.username || cleanUser,
            firstName: burned.first_name || null,
            source: 'BURNED_DB',
          };
        }
      } catch {}
    }

    // Si no se pudo resolver el ID
    if (!target) {
      target = {
        userId: null,
        username: cleanUser,
        firstName: null,
        unresolved: true,
        source: 'UNRESOLVED',
      };
    }
  }

  if (!target) {
    return { target: null, duration: null, reason: null, error: 'INVALID_TARGET' };
  }

  // Parsear duración y razón en caso de argumentos directos
  rawArgs = parts.slice(2);
  if (hasDuration && rawArgs.length > 0) {
    const parsedDur = parseDuration(rawArgs[0]);
    if (parsedDur) {
      duration = parsedDur;
      reason = rawArgs.slice(1).join(' ') || 'Sin especificar';
    } else {
      duration = parseDuration('1d');
      reason = rawArgs.join(' ') || 'Sin especificar';
    }
  } else {
    if (hasDuration) duration = parseDuration('1d');
    reason = rawArgs.join(' ') || 'Sin especificar';
  }

  return { target, duration, reason };
}

/**
 * Motor de Inteligencia Forense Centinela: Calcula el perfil de riesgo y confianza (0-100%).
 */
async function calculateThreatProfile(userId, username = null) {
  let score = 85; // Base neutra confiable
  const riskFactors = [];
  const trustFactors = [];

  const effectiveOwners = config.OWNER_IDS;
  if (effectiveOwners.includes(userId)) {
    return {
      score: 100,
      riskLevel: 'OFICIAL 👑',
      isBurned: false,
      isStaff: true,
      dealsCount: 0,
      riskFactors: [],
      trustFactors: ['Propietario Principal del Sistema (Owner)'],
    };
  }

  // 1. Verificación de Lista Negra (GBAN / Quemado)
  const burnInfo = await db.getBurnedUserInfo(userId) || (username ? await db.getBurnedUserInfo(username) : null);
  if (burnInfo) {
    return {
      score: 0,
      riskLevel: 'CRÍTICO / LISTA NEGRA 🔴',
      isBurned: true,
      burnInfo,
      riskFactors: [
        `Registrado en Lista Negra Oficial: ${burnInfo.context || 'Estafa comprobada'}`,
        `Fecha de penalización: ${burnInfo.burned_at || burnInfo.created_at || 'Previa'}`,
      ],
      trustFactors: [],
    };
  }

  // 2. Verificación de Staff
  const staff = await db.getStaffMember(userId);
  if (staff && staff.role) {
    score = 98;
    trustFactors.push(`Miembro Oficial del Staff (${staff.role})`);
    return {
      score,
      riskLevel: 'STAFF AUTORIZADO 🛡️',
      isBurned: false,
      isStaff: true,
      staffRole: staff.role,
      riskFactors,
      trustFactors,
    };
  }

  // 3. Tratos y Mediaciones
  let dealsCount = 0;
  try {
    dealsCount = await db.getUserDealsCount(userId);
    if (dealsCount > 0) {
      score += Math.min(15, dealsCount * 3);
      trustFactors.push(`${dealsCount} trato(s) oficial(es) completado(s)`);
    } else {
      riskFactors.push('Sin historial de tratos oficiales');
    }
  } catch {}

  // 4. Advertencias registradas
  let warningsCount = 0;
  try {
    const warns = await db.getWarnings(userId);
    warningsCount = warns.length;
    if (warningsCount > 0) {
      score -= warningsCount * 20;
      riskFactors.push(`${warningsCount} advertencia(s) activa(s) por faltas`);
    }
  } catch {}

  // Normalizar score
  score = Math.max(5, Math.min(99, score));

  let riskLevel = 'CONFIABLE 🟢';
  if (score < 40) riskLevel = 'ALTO RIESGO 🔴';
  else if (score < 70) riskLevel = 'PRECAUCIÓN / MEDIO 🟡';

  return {
    score,
    riskLevel,
    isBurned: false,
    isStaff: false,
    dealsCount,
    warningsCount,
    riskFactors,
    trustFactors,
  };
}

/**
 * Sincronizador de Sanciones Cross-Group en paralelo.
 */
async function syncPenaltyAcrossGroups(botApi, userId, action, options = {}) {
  const groups = await db.getAllGroups();
  let affectedCount = 0;
  const errors = [];

  const promises = groups.map(async (grp) => {
    if (!grp.chat_id || grp.type === 'channel') return;
    try {
      if (action === 'BAN' || action === 'GBAN') {
        await botApi.banChatMember(grp.chat_id, userId);
        affectedCount++;
      } else if (action === 'UNBAN' || action === 'UNGBAN') {
        await botApi.unbanChatMember(grp.chat_id, userId, { only_if_banned: true });
        affectedCount++;
      } else if (action === 'MUTE') {
        await botApi.restrictChatMember(
          grp.chat_id,
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
            can_change_info: false,
            can_invite_users: false,
            can_pin_messages: false,
            can_manage_topics: false,
          },
          {
            until_date: options.untilDate || undefined,
            use_independent_chat_permissions: true,
          }
        );
        affectedCount++;
      } else if (action === 'UNMUTE') {
        await botApi.restrictChatMember(
          grp.chat_id,
          userId,
          {
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
          },
          { use_independent_chat_permissions: true }
        );
        affectedCount++;
      }
    } catch (err) {
      // Ignorar errores típicos (ej: bot no admin en un grupo en prueba)
      if (!err.message?.includes('USER_NOT_PARTICIPANT') && !err.message?.includes('CHAT_ADMIN_REQUIRED')) {
        errors.push(err.message);
      }
    }
  });

  await Promise.allSettled(promises);
  return { affectedCount, errors };
}

// ══════════════════════════════════════════════════════
// ⟡ Registro de Comandos Propietarios Centinela
// ══════════════════════════════════════════════════════

function register(bot) {
  // ── /sentinel o /centinela — Panel de Estado del Motor de Seguridad ──
  bot.command(['sentinel', 'centinela', 'security'], requireStaff(), async (ctx) => {
    try {
      const burnedCount = await db.getBurnedUsersCount();
      const groups = await db.getAllGroups();
      const staffList = await db.getAllStaff(ctx.tenant?.id || null);

      const text =
        `⟡ <b>MOTOR CENTINELA VLP</b> ⊱ <code>RED DE SEGURIDAD</code> ⊰\n` +
        `══════════════════════════════════════════════════════\n\n` +
        `▸ <b>Estado del Sistema:</b> ⊱ <code>EN LÍNEA / ACTIVO 🟢</code> ⊰\n` +
        `▸ <b>Grupos Protegidos:</b> <code>${groups.length} comunidades</code>\n` +
        `▸ <b>Estafadores en Lista Negra:</b> <code>${burnedCount} fichados</code>\n` +
        `▸ <b>Staff y Guardianes:</b> <code>${staffList.length + config.OWNER_IDS.length} agentes</code>\n` +
        `▸ <b>Motor MTProto Userbot:</b> <code>${userbot.isConnected() ? 'CONECTADO ⚡' : 'STANDBY ⚪'}</code>\n\n` +
        `──────────────────────────────────────────────────────\n` +
        `⚡ <b>Módulos Integrados:</b>\n` +
        `• <i>Blacklist Dinámico en Tiempo Real (Anti-Intrusos)</i>\n` +
        `• <i>Anti-Impersonator & Detector de Clones de Staff</i>\n` +
        `• <i>Sincronización Cross-Group Inmediata</i>\n` +
        `• <i>Radar Forense de Confianza y Calificación</i>\n\n` +
        `💡 <i>Usa <code>/analizar [ID/@user/reply]</code> para realizar un escaneo forense de cualquier usuario.</i>`;

      const kb = new InlineKeyboard()
        .text('LISTA NEGRA', 'blacklist_page:1').danger()
        .text('CERRAR', 'info_close').primary();

      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (err) {
      console.error('⟡ Error en /sentinel:', err.message);
      await ctx.reply(`${SYM.CROSS} Error consultando Motor Centinela: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /analizar o /radar — Análisis Forense de Usuario y Trust Score ──
  bot.command(['analizar', 'radar', 'forensic', 'escanear'], async (ctx) => {
    try {
      const { target } = await resolveTargetAndArgs(ctx);

      if (!target) {
        return ctx.reply(
          `⟡ <b>ESCANEO FORENSE</b> ⊱ <code>CENTINELA</code> ⊰\n` +
          `══════════════════════════════════════════════════════\n\n` +
          `▸ <b>Uso:</b> <code>/analizar [@usuario / ID / Responder]</code>\n\n` +
          `──────────────────────────────────────────────────────\n` +
          `🔍 <i>Ejecuta un escaneo forense completo de confiabilidad, antecedentes y riesgo.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      if (target.unresolved) {
        return ctx.reply(
          `${SYM.CROSS} No se pudo resolver automáticamente a <b>@${target.username}</b>.\n` +
          `${SYM.ARROW} Usa su <b>ID numérico</b> o responde a uno de sus mensajes con <code>/analizar</code>.`,
          { parse_mode: 'HTML' }
        );
      }

      const profile = await calculateThreatProfile(target.userId, target.username);
      const userMention = mentionFromData(target.userId, target.username, target.firstName);

      let text =
        `⟡ <b>INFORME FORENSE CENTINELA</b> ⊱ <code>PERFIL</code> ⊰\n` +
        `══════════════════════════════════════════════════════\n\n` +
        `▸ <b>Usuario:</b> ${userMention}\n` +
        `▸ <b>ID Numérico:</b> <code>${target.userId}</code>\n` +
        (target.username ? `▸ <b>Username:</b> @${target.username}\n` : '') +
        `▸ <b>Nivel de Confianza:</b> ⊱ <b>${profile.score}%</b> ⊰\n` +
        `▸ <b>Clasificación de Riesgo:</b> ⊱ <b>${profile.riskLevel}</b> ⊰\n\n` +
        `──────────────────────────────────────────────────────\n`;

      if (profile.isBurned) {
        text +=
          `🚨 <b>REGISTRO DE ESTAFADOR CONFIRMADO</b> 🚨\n` +
          `▸ <b>Detalle:</b> <i>${escapeHtml(profile.burnInfo.context || 'Estafa')}</i>\n` +
          `▸ <b>Fecha:</b> <code>${profile.burnInfo.burned_at || profile.burnInfo.created_at || 'Previa'}</code>\n\n` +
          `⚠️ <i>ADVERTENCIA: Usuario catalogado de peligro crítico. No realice operaciones.</i>\n`;
      } else {
        if (profile.trustFactors.length > 0) {
          text += `✅ <b>Factores de Confianza:</b>\n` + profile.trustFactors.map((f) => ` • ${escapeHtml(f)}`).join('\n') + '\n\n';
        }
        if (profile.riskFactors.length > 0) {
          text += `⚠️ <b>Factores de Atención / Riesgo:</b>\n` + profile.riskFactors.map((f) => ` • ${escapeHtml(f)}`).join('\n') + '\n\n';
        }
      }

      text += `──────────────────────────────────────────────────────\n🛡️ <i>Centinela Engine — Sistema de Protección Oficial</i>`;

      const kb = new InlineKeyboard()
        .text('VER PERFIL COMPLETO', `info_profile:${target.userId}`).primary()
        .text('CERRAR', 'info_close').danger();

      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (err) {
      console.error('⟡ Error en /analizar:', err.message);
      await ctx.reply(`${SYM.CROSS} Error al ejecutar escaneo forense: ${err.message}`, { parse_mode: 'HTML' });
    }
  });
}

module.exports = {
  register,
  parseDuration,
  resolveTargetAndArgs,
  calculateThreatProfile,
  syncPenaltyAcrossGroups,
};
