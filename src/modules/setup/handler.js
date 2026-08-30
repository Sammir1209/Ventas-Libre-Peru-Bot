const { setupMainMenuKeyboard, setupSectionKeyboard } = require('./keyboard');
const { SYM } = require('../../config/constants');
const { escapeHtml } = require('../../utils/formatting');

// ══════════════════════════════════════════════════════
// ⟡ Módulo: Centro Maestro de Configuración y Guía (/setup /guia)
// ══════════════════════════════════════════════════════

function getMainMenuText(communityName = 'Ventas Libres Perú') {
  return (
    `📖 <b>CENTRO MAESTRO DE CONFIGURACIÓN — ${escapeHtml(communityName.toUpperCase())}</b>\n\n` +
    `Bienvenido al manual oficial de configuración de tu bot. Selecciona una categoría para ver los pasos detallados y comandos organizados:\n\n` +
    `<b>1. 🤝 Salas de Tratos Admin:</b> Configura el grupo con temas para mediaciones.\n` +
    `<b>2. 📢 Canales y Logs:</b> Conecta canales de registros, staff y alertas.\n` +
    `<b>3. 👑 Gestión de Staff:</b> Asigna roles múltiples, permisos y tags oficiales.\n` +
    `<b>4. 🔥 Anti-Estafas y Quema:</b> Sistema de reportes y baneo global.\n` +
    `<b>5. ✅ Verificación:</b> Protección anti-spam y unión obligatoria a canales.\n\n` +
    `<i>Toca un botón para ver la guía con ejemplos reales:</i>`
  );
}

function getSectionContent(section, communityName = 'Ventas Libres Perú') {
  switch (section) {
    case 'escrow':
      return (
        `🤝 <b>GUÍA 1: CONFIGURACIÓN DE TRATOS ADMIN (ESCROW)</b>\n\n` +
        `El bot crea automáticamente salas privadas (hilos/topics) para cada compra o venta mediada.\n\n` +
        `<b>Paso 1: Crear o preparar el Grupo de Tratos</b>\n` +
        `• Crea un grupo de Telegram o usa uno existente.\n` +
        `• Ve a Ajustes del Grupo ➜ <b>Activar "Temas" (Topics / Foros)</b>.\n\n` +
        `<b>Paso 2: Dar permisos de Administrador al Bot</b>\n` +
        `• Añade al bot como Administrador con permisos de:\n` +
        `  - Gestionar temas (Manage Topics)\n` +
        `  - Invitar usuarios por enlace\n` +
        `  - Eliminar y fijar mensajes\n\n` +
        `<b>Paso 3: Vincular el Grupo</b>\n` +
        `• Escribe en el grupo el comando: <code>/set_grupo_tratos</code>\n\n` +
        `<b>Comandos de Trato Admin:</b>\n` +
        `• <code>/tratoadm</code> o <code>/tratoadmin</code>: Iniciar trato por privado.\n` +
        `• <code>/cancelar_trato</code>: Cancelar solicitud pendiente.`
      );

    case 'channels':
      return (
        `📢 <b>GUÍA 2: VINCULACIÓN DE CANALES Y LOGS</b>\n\n` +
        `Conecta los canales donde se registrarán las auditorías y alertas de tu comunidad.\n\n` +
        `<b>1. Canal de Logs Generales:</b>\n` +
        `• Añade al bot como Administrador en tu canal privado de logs.\n` +
        `• Si tiene hilos, obtén el ID del hilo.\n` +
        `• Comando: <code>/set_logs [ID_CANAL] [THREAD_ID_OPCIONAL]</code>\n\n` +
        `<b>2. Canal Público de Estafadores Quemados:</b>\n` +
        `• Canal donde se publican los banners visuales generados en Canvas.\n` +
        `• Comando: <code>/set_burn_channel [ID_CANAL] [THREAD_ID_OPCIONAL]</code>\n\n` +
        `<b>3. Grupo de Moderación del Staff:</b>\n` +
        `• Donde llegan los reportes de estafas para revisión de tu equipo.\n` +
        `• Comando: <code>/set_staff_chat [ID_GRUPO] [THREAD_ID_OPCIONAL]</code>\n\n` +
        `<i>Tip: Puedes obtener el ID de cualquier chat o usuario usando <code>/id</code>.</i>`
      );

    case 'staff':
      return (
        `👑 <b>GUÍA 3: GESTIÓN DE STAFF Y MEDIADORES</b>\n\n` +
        `Sistema interactivo con soporte de roles múltiples y títulos personalizados.\n\n` +
        `<b>Cómo Promover y Asignar Roles:</b>\n` +
        `• <code>/promote [ID/@usuario]</code> o responder a un mensaje con <code>/promote</code>\n` +
        `• Se desplegará el panel interactivo con checkboxes:\n` +
        `  - <code>[ OWNER ]</code>\n` +
        `  - <code>[ CO-OWNER ]</code>\n` +
        `  - <code>[ ADMIN ]</code>\n` +
        `  - <code>[ TRATO ADMIN ]</code>\n` +
        `• Puedes seleccionar uno o varios roles (ej: <b>ADMIN + TRATO ADMIN</b>).\n` +
        `• Luego eliges el tag de grupo (ej: <code>⚔ Admin & Mediador</code>).\n\n` +
        `<b>Cómo Degradar o Remover:</b>\n` +
        `• <code>/demote [ID/@usuario]</code>\n\n` +
        `<b>Ver la Lista Oficial del Staff:</b>\n` +
        `• <code>/staff</code> (Muestra a los miembros ordenados por jerarquía sin spam).`
      );

    case 'burn':
      return (
        `🔥 <b>GUÍA 4: SISTEMA ANTI-ESTAFAS Y LISTA NEGRA</b>\n\n` +
        `Protege a tu comunidad contra estafadores y clones.\n\n` +
        `<b>Cómo Reportar una Estafa:</b>\n` +
        `• <code>/quemar</code> (Por privado con el bot).\n` +
        `• El asistente interactivo guiará al usuario en un solo mensaje:\n` +
        `  1. Identificación del acusado (por ID o @username).\n` +
        `  2. Explicación de los hechos.\n` +
        `  3. Subida de capturas y comprobantes en tiempo real.\n` +
        `• Al enviar, llega al panel de revisión del Staff.\n\n` +
        `<b>Aprobación del Staff:</b>\n` +
        `• Al presionar <code>[ APROBAR ]</code>:\n` +
        `  - Se banea al estafador de todos los grupos registrados.\n` +
        `  - Se genera su banner visual oficial con Canvas.\n` +
        `  - Se publica en el canal de quemados y se envía alerta a los grupos.\n\n` +
        `<b>Consultas de Antecedentes:</b>\n` +
        `• <code>/info [ID/@usuario]</code> o <code>/listanegra</code>.`
      );

    case 'verify':
      return (
        `✅ <b>GUÍA 5: VERIFICACIÓN INTELIGENTE Y ANTI-SPAM</b>\n\n` +
        `Mantiene tus grupos limpios de bots spammer y usuarios maliciosos.\n\n` +
        `<b>Flujo de Entrada a Grupos:</b>\n` +
        `1. Cuando un nuevo usuario entra a tu grupo, el bot lo silencia (mute) al instante.\n` +
        `2. Envía una tarjeta con los canales que debe seguir obligatoriamente.\n` +
        `3. Al unirse y presionar <code>[ VERIFICAR ]</code>, el bot comprueba su suscripción y le desbloquea los permisos completos.\n\n` +
        `<b>Seguridad Adicional:</b>\n` +
        `• <b>Anti-Clones:</b> Bloquea automáticamente a usuarios que copien el nombre o foto de tu Staff.\n` +
        `• <b>Anti-Flood / Anti-Spam:</b> Elimina ráfagas de mensajes repetitivos y enlaces no autorizados.`
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
