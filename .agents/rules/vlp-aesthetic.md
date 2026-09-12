---
description: Estándares visuales, paleta tipográfica y estilo de diseño exclusivo para mensajes, alertas y paneles de Ventas Libres Perú.
always_on: true
---

# Guía Estética y Visual — Ventas Libres Perú

## 1. Identidad Visual & Caracteres Unicode (SYM)
Todos los módulos deben usar el diccionario `SYM` de `src/config/constants.js`:
- Separadores: `SYM.DIVIDER` (`━━━━━━━━━━━━`), `SYM.THIN_LINE` (`────────────`).
- Títulos: Encabezados claros en negrita con icono representativo (ej. `🛡️ <b>MÓDULO DE SEGURIDAD</b>`).
- Indicadores de estado: `🟢 ACTIVO`, `🔴 DESACTIVADO / BLOQUEADO`, `🟡 PRECAUCIÓN`.

## 2. Botones Inline (Sin Emojis Ruidosos)
- De acuerdo al commit `1070e80`, los botones inline deben usar texto limpio en mayúsculas:
  - Correcto: `[ VERIFICAR ]`, `[ ACTIVAR ]`, `[ DESACTIVAR ]`, `[ CERRAR ]`.
  - Evitar botones con iconos superfluos como `[ 🚀 Entrar ya ]` o `[ ❌ Cerrar ]` salvo indicación expresa de diseño.

## 3. Protección de Historial en Búsquedas
- En comandos de consulta como `/info`, omitir botones de cierre/eliminación automática para garantizar que el registro permanezca indexado en el buscador nativo de Telegram cuando clientes busquen el `@username`.
