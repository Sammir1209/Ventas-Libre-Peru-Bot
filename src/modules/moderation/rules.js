const db = require('../../database/postgres');
const config = require('../../config/env');
const { requireStaff } = require('../../middleware/auth');
const { escapeHtml } = require('../../utils/formatting');

// ══════
// ⟡ Módulo de Reglas del Grupo (/reglas, /setreglas, /clearreglas)
// ══════

const DEFAULT_RULES = 
  `1. Prohibido realizar tratos comerciales sin intermediación oficial (/tratoadm).\n` +
  `2. Prohibido enviar enlaces de invitación a otros grupos o canales no autorizados.\n` +
  `3. Cero tolerancia con estafas, suplantación de identidad o multicuentas.\n` +
  `4. Respeto mutuo entre todos los miembros de la comunidad.`;

async function getGroupRules(chatId, tenantId = null) {
  try {
    const custom = await db.getSetting(`rules_${chatId}`, tenantId);
    if (custom && custom.trim()) return custom;
  } catch {}
  return DEFAULT_RULES;
}

async function setGroupRules(chatId, rulesText, tenantId = null) {
  await db.setSetting(`rules_${chatId}`, rulesText, tenantId);
}

async function clearGroupRules(chatId, tenantId = null) {
  await db.setSetting(`rules_${chatId}`, '', tenantId);
}

function register(bot) {
  // ── /reglas o /rules — Consultar normas oficiales del grupo ──
  bot.command(['reglas', 'rules', 'normas'], async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(
          `⟡ <b>REGLAMENTO GENERAL</b> ⊱ <code>VENTAS LIBRES PERÚ</code> ⊰\n` +
          `══════\n\n` +
          `${DEFAULT_RULES}\n\n` +
          `──────\n` +
          `💡 <i>Ejecuta este comando en un grupo para ver las normas particulares de esa comunidad.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      const tenantId = ctx.tenant?.id || null;
      const rules = await getGroupRules(ctx.chat.id, tenantId);

      const text =
        `⟡ <b>REGLAMENTO OFICIAL</b> ⊱ <code>${escapeHtml(ctx.chat.title || 'COMUNIDAD')}</code> ⊰\n` +
        `══════\n\n` +
        `${escapeHtml(rules)}\n\n` +
        `──────\n` +
        `🛡️ <i>El incumplimiento de las normas conlleva advertencias (/warn), silencio (/mute) o expulsión (/ban).</i>`;

      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('⟡ Error en /reglas:', err.message);
    }
  });

  // ── /setreglas o /setrules [texto o responder] — Personalizar normas ──
  bot.command(['setreglas', 'setrules'], requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        return ctx.reply(`⟡ ✗ <i>Este comando solo puede ejecutarse dentro de un grupo oficial.</i>`, { parse_mode: 'HTML' });
      }

      let newRules = '';
      const reply = ctx.message.reply_to_message;

      if (reply && (reply.text || reply.caption)) {
        newRules = reply.text || reply.caption;
      } else {
        const parts = ctx.message.text.split(/\s+/);
        newRules = parts.slice(1).join(' ').trim();
      }

      if (!newRules) {
        return ctx.reply(
          `⟡ <b>CONFIGURACIÓN DE REGLAS</b> ⊱ <code>USO</code> ⊰\n` +
          `══════\n\n` +
          `▸ <b>Uso:</b> Escribe <code>/setreglas [texto de las reglas]</code> o responde a un mensaje con <code>/setreglas</code>.\n\n` +
          `──────\n` +
          `💡 <i>Para restaurar las reglas por defecto, usa <code>/clearreglas</code>.</i>`,
          { parse_mode: 'HTML' }
        );
      }

      const tenantId = ctx.tenant?.id || null;
      await setGroupRules(ctx.chat.id, newRules, tenantId);

      await ctx.reply(
        `⟡ <b>REGLAMENTO ACTUALIZADO</b> ⊱ <code>GUARDADO</code> ⊰\n` +
        `══════\n\n` +
        `▸ <b>Grupo:</b> <b>${escapeHtml(ctx.chat.title || 'Grupo')}</b>\n` +
        `▸ <b>Estado:</b> 🟢 Nuevas normas configuradas correctamente.\n` +
        `──────\n` +
        `📜 <i>Los miembros pueden verlas en cualquier momento con <code>/reglas</code>.</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /setreglas:', err.message);
      await ctx.reply(`⟡ ✗ Error al guardar reglas: ${err.message}`, { parse_mode: 'HTML' });
    }
  });

  // ── /clearreglas o /delrules — Restaurar reglas predeterminadas ──
  bot.command(['clearreglas', 'delrules', 'resetreglas'], requireStaff(), async (ctx) => {
    try {
      if (ctx.chat.type === 'private') return;
      const tenantId = ctx.tenant?.id || null;
      await clearGroupRules(ctx.chat.id, tenantId);

      await ctx.reply(
        `⟡ <b>REGLAMENTO RESTAURADO</b> ⊱ <code>POR DEFECTO</code> ⊰\n` +
        `══════\n\n` +
        `▸ <b>Estado:</b> 🟢 Se restablecieron las normas oficiales predeterminadas del sistema.\n` +
        `──────`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('⟡ Error en /clearreglas:', err.message);
    }
  });
}

module.exports = {
  register,
  getGroupRules,
  setGroupRules,
  clearGroupRules,
};
