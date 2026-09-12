---
name: anti-raid-management
description: Guía operacional para activar, configurar y responder ante ataques coordinados o raids en grupos de Ventas Libres Perú.
---

# Procedimiento de Gestión Anti-Raid & Modo Pánico

## Activación y Sensibilidad
El sistema vigila constantemente la tasa de unión de usuarios en `message:new_chat_members` y `chat_member`:
- **Umbral Estándar:** 6 usuarios en 10 segundos.
- **Acción Inmediata del Bot:**
  1. Activa **Lockdown automático** para el chat afectado.
  2. Cancela el envío de mensajes de bienvenida individuales para evitar FloodWait (Error 429).
  3. Aplica **mute silencioso preventivo** a todos los atacantes detectados en la ventana de tiempo.
  4. Envía notificación unificada al canal de Staff con lista de atacantes.

## Comandos Operacionales
- `/panico [on|off]` o `/lockdown [on|off]`: Bloquea/desbloquea manualmente el envío de mensajes a todos los usuarios normales.
- `/antiraid [on|off|sensibilidad]`: Permite ajustar el umbral (Baja: 10 en 10s, Media: 6 en 10s, Alta: 3 en 10s).
- `/limpiar_raid`: Expulsa o banea por lote a las cuentas detectadas en el último raid registrado.
