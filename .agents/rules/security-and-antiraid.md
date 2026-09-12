---
description: Reglas fundamentales de seguridad, prevención de FloodWait (error 429 de Telegram) y respuesta ante raids masivos.
always_on: true
---

# Reglas de Seguridad & Anti-Raid — Ventas Libres Perú Bot

## 1. Prevención Absoluta de FloodWait (Telegram 429)
- **Nunca responder 1-a-1 en ráfagas de joins:** Si la tasa de ingresos supera el umbral configurado (ej. 6 usuarios en 10s), suspender de inmediato el envío de mensajes de bienvenida.
- **Throttling de APIs de Moderación:** Agrupar o regular las llamadas (`restrictChatMember`, `banChatMember`, `deleteMessage`) con colas o retardos controlados (máx 25-30 ops/segundo) para evitar penalizaciones de Telegram.
- **Silent Action:** Durante un ataque o raid, ejecutar silenciados/expulsiones sin enviar mensajes de texto al grupo para no saturar el canal ni disparar rate limits del bot.

## 2. Jerarquía Inviolable de Staff & Owners
- Ninguna regla de bloqueo (`lock`), advertencia (`warn`) o anti-flood aplica a los IDs en `config.OWNER_IDS` ni a los miembros del Staff registrados en base de datos.
- Solo Owners y Administradores autorizados pueden alterar configuraciones de seguridad (`/antiraid`, `/lockdown`, `/panico`, `/lock`).

## 3. Registro Forense y Trazabilidad
- Todo evento de raid o activación de lockdown debe quedar registrado en base de datos (`mod_logs`) y notificado de inmediato al canal privado del Staff.
- Los IDs de los atacantes deben ser conservados en memoria/cache para permitir un baneo masivo coordinado si el Staff lo autoriza con un clic.
