const { setupMainMenuKeyboard, setupSectionKeyboard } = require('./keyboard');
const { SYM } = require('../../config/constants');
const { escapeHtml } = require('../../utils/formatting');
const { toMathBold, toMathSerifBold, toSmallCaps, AESTHETIC_DIVIDERS } = require('../../utils/aesthetic');

// ══════════════════════════════════════════════════════
// ⟡ Módulo: Centro Maestro de Configuración y Guía (/setup /guia)
// ══════════════════════════════════════════════════════

function getMainMenuText(communityName = 'Ventas Libres Perú') {
  return (
    `⟡ <b>CENTRO MAESTRO DE CONFIGURACIÓN</b> ⊱ <code>MANUAL OFICIAL</code> ⊰\n` +
    `══════════════════════════════════════════════════════\n\n` +
    `Bienvenido a la consola de despliegue y arquitectura técnica de <b>${escapeHtml(communityName)}</b>.\n\n` +
    `▸ <b>1. Salas de Tratos Admin:</b> Configura el grupo con temas para mediaciones.\n` +
    `▸ <b>2. Canales & Logs:</b> Conecta canales de registros, staff y alertas.\n` +
    `▸ <b>3. Gestión de Staff:</b> Asigna roles múltiples, permisos y tags oficiales.\n` +
    `▸ <b>4. Anti-Estafas & Quema:</b> Sistema de reportes y baneo global.\n` +
    `▸ <b>5. Verificación Perimetral:</b> Protección anti-spam y unión obligatoria.\n\n` +
    `──────────────────────────────────────────────────────\n` +
    `✨ <i>Selecciona una categoría interactiva para consultar el manual detallado:</i>`
  );
}

function getSectionContent(section, communityName = 'Ventas Libres Perú') {
  switch (section) {
    case 'escrow':
      return (
        `⟡ <b>MANUAL TÉCNICO</b> ⊱ <code>TRATOS ADMIN / ESCROW</code> ⊰\n` +
        `══════════════════════════════════════════════════════\n\n` +
        `El sistema genera salas privadas automatizadas (hilos/topics) para cada intermediación comercial.\n\n` +
        `▸ <b>Paso 1: Preparar el Grupo de Tratos</b>\n` +
        `  ↳ En Ajustes del Grupo de Telegram ➜ Activar <b>"Temas" (Topics / Foros)</b>.\n\n` +
        `▸ <b>Paso 2: Privilegios del Bot</b>\n` +
        `  ↳ Otorgar permisos de Administrador:\n` +
        `     • Gestionar temas (Manage Topics)\n` +
        `     • Invitar usuarios por enlace\n` +
        `     • Eliminar y anclar mensajes\n\n` +
        `▸ <b>Paso 3: Vinculación</b>\n` +
        `  ↳ Ejecutar dentro del grupo el comando: <code>/set_grupo_tratos</code>\n\n` +
        `▸ <b>Comandos de Operación:</b>\n` +
        `  • <code>/tratoadm</code> — Iniciar solicitud por mensaje privado.\n` +
        `  • <code>/cancelar_trato</code> — Abortar solicitud no tomada.\n` +
        `──────────────────────────────────────────────────────\n` +
        `🛡️ <i>Soporte activo para auditoría y respaldo de conversaciones.</i>`
      );

    case 'channels':
      return (
        `⟡ <b>MANUAL TÉCNICO</b> ⊱ <code>CANALES & LOGS</code> ⊰\n` +
        `══════════════════════════════════════════════════════\n\n` +
        `Enlaza los canales donde se emitirán las auditorías perimetrales y avisos públicos.\n\n` +
        `▸ <b>1. Canal de Auditoría & Logs:</b>\n` +
        `  ↳ Registra acciones de moderación y movimientos de tratos.\n` +
        `  ↳ Comando: <code>/set_logs [ID_CANAL] [THREAD_ID_OPCIONAL]</code>\n\n` +
        `▸ <b>2. Canal Público de Estafadores:</b>\n` +
        `  ↳ Muro público donde se publican las fichas Canvas de usuarios quemados.\n` +
        `  ↳ Comando: <code>/set_canal_quemar [ID_CANAL]</code>\n\n` +
        `▸ <b>3. Grupo de Moderación de Staff:</b>\n` +
        `  ↳ Recepción de alertas y aprobación de denuncias.\n` +
        `  ↳ Comando: <code>/set_grupo_staff [ID_GRUPO]</code>\n\n` +
        `──────────────────────────────────────────────────────\n` +
        `💡 <i>Utiliza <code>/id</code> en cualquier canal o chat para obtener su identificador.</i>`
      );

    case 'staff':
      return (
        `⟡ <b>MANUAL TÉCNICO</b> ⊱ <code>GESTIÓN DE STAFF</code> ⊰\n` +
        `══════════════════════════════════════════════════════\n\n` +
        `Matriz jerárquica con soporte multicargo y títulos personalizados.\n\n` +
        `▸ <b>Ascenso & Designación de Roles:</b>\n` +
        `  ↳ <code>/promote [ID/@usuario]</code> o respondiendo a su mensaje.\n` +
        `  ↳ Opciones seleccionables con checkboxes:\n` +
        `     • <code>[ OWNER ]</code> / <code>[ CO-OWNER ]</code>\n` +
        `     • <code>[ ADMIN ]</code> / <code>[ TRATO ADMIN ]</code>\n` +
        `  ↳ Permite combinaciones duales (ej: <b>ADMIN + TRATO ADMIN</b>).\n` +
        `  ↳ Configuración inmediata del distintivo de grupo (ej: <code>⚔ Admin & Mediador</code>).\n\n` +
        `▸ <b>Degradación:</b>\n` +
        `  ↳ <code>/demote [ID/@usuario]</code> — Revoca privilegios de inmediato.\n\n` +
        `▸ <b>Directorio Oficial:</b>\n` +
        `  ↳ <code>/staff</code> — Consulta jerárquica limpia sin spam.\n` +
        `──────────────────────────────────────────────────────\n` +
        `⚖️ <i>Solo los Owners Supremos tienen facultad de alterar la estructura.</i>`
      );

    case 'burn':
      return (
        `⟡ <b>MANUAL TÉCNICO</b> ⊱ <code>DEFENSA ANTI-FRAUDE</code> ⊰\n` +
        `══════════════════════════════════════════════════════\n\n` +
        `Blindaje preventivo contra estafadores, clones y usurpadores de identidad.\n\n` +
        `▸ <b>Procedimiento de Denuncia:</b>\n` +
        `  ↳ Iniciar con <code>/quemar</code> en chat privado con el bot.\n` +
        `  ↳ El asistente interactivo solicitará:\n` +
        `     1. Identificador único o @alias del denunciado.\n` +
        `     2. Relato detallado del hecho.\n` +
        `     3. Capturas de pantalla y comprobantes bancarios.\n\n` +
        `▸ <b>Aprobación & Sentencia del Staff:</b>\n` +
        `  ↳ Al pulsar <code>[ APROBAR ]</code>:\n` +
        `     • Baneo global de toda la red de grupos vinculados.\n` +
        `     • Generación automática de ficha gráfica pericial en Canvas.\n` +
        `     • Publicación en canal de quemados y alerta perimetral.\n\n` +
        `▸ <b>Consultas Penales:</b>\n` +
        `  ↳ <code>/info [ID/@usuario]</code> o <code>/blacklist</code>.\n` +
        `──────────────────────────────────────────────────────\n` +
        `🛡️ <i>Cero tolerancia ante estafas o intentos de engaño.</i>`
      );

    case 'verify':
      return (
        `⟡ <b>MANUAL TÉCNICO</b> ⊱ <code>VERIFICACIÓN & ANTI-BOTS</code> ⊰\n` +
        `══════════════════════════════════════════════════════\n\n` +
        `Filtrado perimetral contra spam automatizado y cuentas descartables.\n\n` +
        `▸ <b>Mecánica de Ingreso:</b>\n` +
        `  ↳ Al entrar un nuevo miembro, se le silencia (mute) al instante.\n` +
        `  ↳ Se envía una tarjeta con los canales obligatorios a seguir.\n` +
        `  ↳ Al presionar <code>[ VERIFICAR ]</code>, se comprueba su membresía vía API y se desbloquea su permiso de escritura.\n\n` +
        `▸ <b>Módulos de Seguridad Complementarios:</b>\n` +
        `  • <b>Anti-Clones:</b> Baneo reactivo ante copias de foto o nombre del Staff.\n` +
        `  • <b>Anti-Flood:</b> Supresión instantánea de ráfagas repetitivas.\n` +
        `──────────────────────────────────────────────────────\n` +
        `💡 <i>Habilita o suspende la verificación con <code>/verify</code>.</i>`
      );

    default:
      return getMainMenuText(communityName);
  }
}

function register(bot) {
  // ── Comando /setup, /guia, /manual, /ayuda_admin ──
  bot.command(['setup', 'guia', 'manual', 'configuracion', 'tutorial'], async (ctx) => {
    try {
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
      const text = getMainMenuText(communityName);
      const kb = setupMainMenuKeyboard();

      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch (err) {
      console.error('⟡ Error en /setup:', err.message);
    }
  });

  // ── Callback: Navegación de Secciones ──
  bot.callbackQuery(/^setup_mod:(.+)$/, async (ctx) => {
    try {
      const section = ctx.match[1];
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
      const text = getSectionContent(section, communityName);
      const kb = setupSectionKeyboard(section);

      await ctx.answerCallbackQuery();
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch (err) {
      console.error('⟡ Error en setup_mod callback:', err.message);
    }
  });

  // ── Callback: Volver al Menú Principal ──
  bot.callbackQuery('setup_back_main', async (ctx) => {
    try {
      const communityName = ctx.tenant?.community_name || 'Ventas Libres Perú';
      const text = getMainMenuText(communityName);
      const kb = setupMainMenuKeyboard();

      await ctx.answerCallbackQuery();
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch (err) {
      console.error('⟡ Error en setup_back_main callback:', err.message);
    }
  });

  // ── Callback: Cerrar Guía ──
  bot.callbackQuery('setup_close', async (ctx) => {
    try {
      await ctx.answerCallbackQuery({ text: 'Guía cerrada.' });
      await ctx.deleteMessage();
    } catch {}
  });
}

module.exports = { register };
