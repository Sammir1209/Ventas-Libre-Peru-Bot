---
name: multi-tenant-saas-bots
description: Arquitectura de sub-bots SaaS multi-tenant, ciclo de vida en caliente, aislamiento de configuración, gestión de tokens y orquestación con botManager.
---

# Multi-Tenant SaaS Sub-Bots — Arquitectura de Instancias Dinámicas

Esta skill documenta el motor multi-tenant que permite a **Ventas Libres Perú** crear, orquestar y aislar instancias independientes de bots (Sub-Bots) ejecutándose bajo un único proceso central.

---

## 1. Modelo de Datos y Aislamiento por Inquilino (Tenant ID)

Cada sub-bot representa un inquilino independiente (`tenant_id` UUID) en la tabla `sub_bots`:
- `bot_token`: Token privado provisto por BotFather.
- `community_name`: Nombre de la marca o comunidad cliente.
- `owner_ids`: Lista de administradores autorizados para esa instancia.
- `plan_status`: `ACTIVE`, `SUSPENDED`, `EXPIRED`.
- `channels_to_verify`: Canales obligatorios donde los usuarios deben estar unidos.
- `staff_chat_id`, `log_channel_id`, `burn_chat_id`: Hilos y chats dedicados por comunidad.

Las tablas secundarias (`staff`, `official_groups`, `bot_settings`) poseen la columna `tenant_id` indexada para garantizar que ninguna comunidad acceda a los datos de otra.

---

## 2. Orquestador en Tiempo Real (`botManager.js`)

El módulo `src/core/botManager.js` mantiene en memoria un mapa de instancias activas:
```javascript
const activeBots = new Map(); // tenantId -> { bot, startedAt, runner }
```

### Operaciones del Ciclo de Vida:
1. **Validación de Token:**
   Antes de registrar un nuevo sub-bot, se realiza una llamada HTTP directa al endpoint `getMe` de la Bot API de Telegram para verificar que el token sea auténtico y obtener el `bot_username`.
2. **Arranque en Caliente (`startSubBot(tenantId)`):**
   - Instancia un nuevo objeto `new Bot(token)`.
   - Conecta los plugins de throttler y auto-retry independientes.
   - Registra los módulos con contexto scoped a `tenantId`.
   - Inicia el listener en segundo plano sin interrumpir las demás instancias.
3. **Detención en Caliente (`stopSubBot(tenantId)`):**
   - Llama a `bot.stop()` de forma ordenada liberando las conexiones de long-polling.
   - Elimina la referencia del mapa en memoria.
4. **Reinicio en Caliente (`restartSubBot(tenantId)`):**
   - Detiene la instancia existente, recarga la configuración desde Postgres y vuelve a iniciar el bot.

---

## 3. Prevención de Colisiones de Recursos

- **Conexiones a Base de Datos:** Todos los sub-bots comparten el pool común de PostgreSQL/Supabase, ejecutando consultas parametrizadas con cláusula `WHERE tenant_id = $1`.
- **Throttling:** Cada sub-bot posee su propio transformer throttler para que el tráfico de una comunidad no afecte los límites de las demás.
- **Tolerancia a Fallos:** Si un sub-bot lanza una excepción no controlada (`bot.catch`), se captura localmente para que el proceso principal no se caiga.
