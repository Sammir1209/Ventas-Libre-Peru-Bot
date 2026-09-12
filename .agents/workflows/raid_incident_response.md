# Runbook: Respuesta ante Incidentes de Raid / Ataque Masivo

## Fase 1: Detección & Mitigación Instantánea (Automatizada)
1. **Detección de pico:** El Ring Buffer en memoria detecta que se superó el límite de ingresos por segundo.
2. **Activación de Defensa:**
   - El bot desactiva el envío de bienvenidas.
   - Todo nuevo ingreso recibe `can_send_messages = false` sin mensaje público.
   - Se alerta al Staff en su canal privado.

## Fase 2: Intervención del Moderador / Staff
1. Si el ataque continúa o los atacantes ya enviaron mensajes:
   - Ejecutar en el grupo: `/panico on` o `/lockdown on`.
   - Limpiar el spam reciente: `/purge [1-100]` respondiendo al mensaje inicial.
2. Expulsar masivamente al contingente del raid:
   - Pulsar el botón inline en la alerta de Staff: `[ EXPULSAR RAIDERS ]` o ejecutar `/limpiar_raid`.

## Fase 3: Retorno a la Operación Normal
1. Una vez cesado el ataque:
   - Ejecutar: `/panico off` o `/lockdown off`.
   - El bot restaura los permisos estándar del chat.
   - Se genera el reporte en `mod_logs`.
