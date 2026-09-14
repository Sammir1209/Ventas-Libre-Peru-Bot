---
name: telegram-bot-mastery
description: Guía de ingeniería para diseñar, optimizar y escalar bots de Telegram de alto rendimiento con grammY, MTProto, control de FloodWait, hilos de foros y UX móvil.
---

# Telegram Bot Mastery — Estándar de Ingeniería para Bots de Alto Rendimiento

Esta skill documenta las mejores prácticas y patrones de diseño para construir bots de Telegram de nivel empresarial, seguros y optimizados para entornos con recursos limitados (como Render 512MB RAM).

---

## 1. Rendimiento y Protección Anti-Flood (Telegram Limits)

Telegram impone límites estrictos de envío de mensajes:
- **Límite general por chat:** Máximo 1 mensaje por segundo (ráfagas permitidas de hasta 30 msg/s de forma global).
- **Límite global:** Máximo 30 mensajes por segundo a chats distintos.
- **Límite a grupos:** Máximo 20 mensajes por minuto por grupo.
- **Código de Error 429:** `Too Many Requests: retry after X seconds`.

### Arquitectura de Resiliencia Obligatoria:
1. **Throttler Transformer (`@grammyjs/transformer-throttler`):**
   Regula la tasa de salida para no disparar los límites del servidor de Telegram.
2. **Auto-Retry (`@grammyjs/auto-retry`):**
   Intercepta errores 429 (FloodWait) y reintenta la solicitud automáticamente tras el tiempo indicado en `retry_after`.
3. **Manejo de Relevos en Despliegues (Error 409 Conflict):**
   Al reiniciar o redesplegar en Render u otras plataformas en la nube, dos instancias pueden competir por el long-polling. Implementar un bucle de reintento exponencial con pausa de 3 a 5 segundos ante error 409.

```javascript
const { Bot } = require('grammy');
const { autoRetry } = require('@grammyjs/auto-retry');
const { apiThrottler } = require('@grammyjs/transformer-throttler');

const bot = new Bot(process.env.BOT_TOKEN);
bot.api.config.use(autoRetry({ maxRetryAttempts: 5, maxDelaySeconds: 60 }));
bot.api.config.use(apiThrottler());
```

---

## 2. Gestión de Hilos y Foros (`message_thread_id`)

Los grupos de Telegram organizados por Topics (Foros) requieren asociar explícitamente el hilo para que el mensaje llegue a la sección correcta:
- Cuando el bot recibe una interacción en un hilo, `ctx.message?.message_thread_id` contiene el ID del tema.
- Para responder dentro del mismo hilo:
  ```javascript
  const threadId = ctx.message?.message_thread_id;
  await ctx.reply(texto, {
    message_thread_id: threadId,
    parse_mode: 'HTML',
  });
  ```
- **Hilos del Sistema (Canales y Grupos Administrativos):**
  Guardar en base de datos (`bot_settings` o variables de entorno) tanto el `chat_id` como el `thread_id` específico (e.g. hilo de staff, hilo de logs, hilo de comprobantes de pago).

---

## 3. Experiencia de Usuario Móvil y Regla de Separadores

> [!IMPORTANT]
> **Regla Estricta de Separadores Móviles:**
> En dispositivos móviles, las líneas divisorias que superan 6 caracteres (`────────────────────────────`) causan saltos de línea automáticos y desbordan la pantalla verticalmente.
> **Regla de oro:** Usar como máximo 6 guiones en cualquier separador:
> `──────` o `══════`.

### Diseño de Tarjetas de Perfil y Respuestas:
- Utilizar iconos específicos al inicio de cada atributo: `👤 Nombre:`, `🆔 ID:`, `🆀 User:`, `💼 Rol:`.
- IDs y códigos siempre envueltos en `<code>...</code>` o enlaces directos `<a href="tg://user?id=12345">12345</a>`.
- Teclados en línea compactos (máximo 2 a 3 botones por fila).

---

## 4. Teclados En Línea y Máquina de Estados (Callbacks)

1. **Estructuración de `callback_data`:**
   Telegram limita `callback_data` a un máximo de **64 bytes**. Diseñar identificadores compactos:
   `modulo_accion:id` (ej. `deal_assign:452`, `burn_rev:982`).
2. **Siempre responder al Callback:**
   Invocar siempre `await ctx.answerCallbackQuery()` de inmediato para evitar que el botón quede con el icono de carga dando vueltas indefinidamente.
3. **Idempotencia de Acciones:**
   Antes de mutar el estado en la base de datos (por ejemplo, aceptar un trato o aprobar un reporte), verificar en la base de datos si la acción ya fue ejecutada por otro administrador para evitar dobles aprobaciones.

---

## 5. Sinergia Bot (GrammY) + Userbot (MTProto)

- **Bot API:** Ideal para interactuar con usuarios mediante comandos, botones inline y webhook/polling. Limitado en ciertas tareas de búsqueda global y extracción de participantes de canales grandes.
- **Userbot MTProto (GramJS):** Permite ejecutar búsquedas globales en tiempo real por nombre de usuario (`getUsers`, `getParticipants`, `search`), localizar usuarios que no han interactuado con el bot y sincronizar avatares y biografías.
- **Patrón de Fallback:** Si el bot regular no encuentra un usuario por nombre o `@username`, consultar al servicio de Userbot en segundo plano sin bloquear el hilo principal.
