// ══════════════════════════════════════════════════════
// ⟡ Middleware: Solo DM (Chat Privado)
// ══════════════════════════════════════════════════════

function privateOnly() {
  return async (ctx, next) => {
    if (ctx.chat?.type !== 'private') {
      return ctx.reply(
        '⟡ <b>Comando Privado</b>\n\n' +
        '✧ Este comando solo puede usarse por <b>mensaje directo</b> con el bot.',
        { parse_mode: 'HTML' }
      );
    }
    return next();
  };
}

module.exports = { privateOnly };
