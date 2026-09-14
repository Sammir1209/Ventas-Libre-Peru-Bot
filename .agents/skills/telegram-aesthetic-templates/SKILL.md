---
name: telegram-aesthetic-templates
description: Guía de diseño de plantillas estéticas para Telegram y Web con tipografía unicode premium, simbología armónica, estructuras visuales equilibradas y parseo HTML estricto.
---

# Guía Maestra de Diseño de Plantillas Estéticas (Ventas Libres Perú)

Esta guía establece el estándar visual obligatorio para todos los mensajes, alertas, notificaciones y reportes generados por el bot y la plataforma web.

---

## 1. Catálogo Curado de Simbología Unicode

Evitar emojis genéricos o infantiles sin propósito. Usar combinaciones elegantes y estructuradas:

### A. Encabezados & Marcadores de Título
- `⟡` (Rombo hueco central - Marcador primario)
- `✦` / `✧` (Estrellas de cuatro puntas)
- `❖` (Diamante ornamentado)
- `⊱` / `⊰` (Bordes envolventes para títulos y badges)
- `⚔️` (Para temas de staff, combate, seguridad)
- `🛡️` (Para sistemas de protección, anti-raid, defensas)
- `⚡` (Para acciones instantáneas o automáticas)

### B. Separadores de Sección & Líneas Divisorias (Máximo 6 Guiones en Móvil)
```text
══════
──────
━━━━━━
```
> **Norma Móvil Estricta:** No usar más de 6 guiones continuos (`──────`), ya que líneas más largas se desbordan y saturan la visualización vertical en pantallas de smartphones.

### C. Viñetas & Jerarquía de Datos
- `•` (Bullet point limpio)
- `▸` (Flecha hacia la derecha para datos principales)
- `↳` (Sub-elemento o detalle anidado)
- `✓` (Confirmación / Estado positivo)
- `✗` (Error / Rechazo / Restricción)
- `⚠️` (Precaución / Advertencia)
- `🚨` (Alerta crítica / Pánico / Estafa)

### D. Cajas & Badges de Estado
- `[ ACTIVO ]` | `[ OFFLINE ]`
- `⊱ EN PROCESO ⊰` | `⊱ COMPLETADO ⊰` | `⊱ CANCELADO ⊰`
- `🛡️ 𝘿𝙀𝙁𝘾𝙊𝙉 𝟭` | `⚡ 𝙉𝙊𝙍𝙈𝘼𝙇`

---

## 2. Tipografía Unicode & Estilos de Texto

Para resaltar elementos en clientes de Telegram sin depender exclusivamente de etiquetas HTML, o combinándolas con etiquetas:

### Fuentes Matemáticas / Monospace:
1. **Bold Serif / Sans:**
   - 𝐕𝐄𝐍𝐓𝐀𝐒 𝐋𝐈𝐁𝐑𝐄 𝐏𝐄𝐑𝐔
   - 𝙑𝙚𝙣𝙩𝙖𝙨 𝙇𝙞𝙗𝙧𝙚𝙨 𝙋𝙚𝙧𝙪
2. **Small Caps / Compacto:**
   - ᴀᴅᴍɪɴɪsᴛʀᴀᴅᴏʀ • ᴏᴡɴᴇʀ • ᴍᴇᴅɪᴀᴅᴏʀ
3. **Monospace / Code:**
   - Utilizar siempre `<code>` para IDs, tokens, hashes, comandos y montos:
     `<code>-1003538147715</code>`, `<code>/verificar</code>`, `<code>$150.00 USDT</code>`.

---

## 3. Arquitectura y Estructura de una Plantilla

Todo mensaje debe construirse bajo el patrón **Header -> Body -> Metadata -> Footer**:

```text
⟡ [TÍTULO EN MAYÚSCULAS O BOLD SERIF] ⊱ [SUBTÍTULO] ⊰
══════════════════════════════════════════════════════

[Párrafo introductorio o resumen claro del estado]

▸ Campo Principal: <b>Valor Destacado</b>
▸ Identificador: <code>123456789</code>
  ↳ Detalle secundario o contexto anidado
▸ Estado: [ INSIGNIA O BADGE ]

──────────────────────────────────────────────────────
[Instrucción de acción o llamada al usuario]
```

---

## 4. Reglas Críticas de Formato y Parseo HTML

1. **Escapado Obligatorio:**
   - Todo texto proveniente de usuarios (`first_name`, `username`, `title`, comentarios) DEBE pasar por `escapeHtml()` antes de interpolarse en mensajes con `parse_mode: 'HTML'`.
   ```javascript
   function escapeHtml(text) {
     if (!text) return '';
     return String(text).replace(/[&<>"']/g, (m) => ({
       '&': '&amp;',
       '<': '&lt;',
       '>': '&gt;',
       '"': '&quot;',
       "'": '&#39;',
     }[m]));
   }
   ```
2. **Etiquetas Permitidas en Telegram:**
   - `<b>negrita</b>`
   - `<i>cursiva</i>`
   - `<code>código en línea</code>`
   - `<pre>bloque de código</pre>`
   - `<a href="url">enlace</a>`
   - Nunca usar etiquetas no soportadas (`<div>`, `<p>`, `<span>`, `<h1>`), ya que causan error 400 `CANNOT_PARSE_ENTITIES`.

---

## 5. Plantillas Oficiales de Referencia

### Plantilla A: Trato Escrow
```text
⟡ 𝙏𝙍𝘼𝙏𝙊 𝙀𝙎𝘾𝙍𝙊𝙒 𝙊𝙁𝙄𝘾𝙄𝘼𝙇 ⊱ #{{deal_id}} ⊰
══════════════════════════════════════════════════════

▸ <b>Comprador:</b> {{buyer}} (<code>{{buyer_id}}</code>)
▸ <b>Vendedor:</b> {{seller}} (<code>{{seller_id}}</code>)
▸ <b>Mediador:</b> {{mediator}}
▸ <b>Monto:</b> <code>{{amount}} {{currency}}</code>
▸ <b>Método:</b> {{method}}
▸ <b>Estado:</b> ⊱ {{status_badge}} ⊰

──────────────────────────────────────────────────────
⚠️ <i>No liberes el pago ni la cuenta sin la confirmación explícita del mediador asignado.</i>
```

### Plantilla B: Alerta de Seguridad / Lockdown
```text
🚨 <b>ALERTA DE SEGURIDAD DEFCON 1</b> 🚨
══════════════════════════════════════════════════════
🛡️ <b>Grupo Protegido:</b> {{chat_title}}
⚡ <b>Acción:</b> Modo Pánico Activado
▸ <b>Motivo:</b> {{reason}}
▸ <b>Responsable:</b> {{author}}
──────────────────────────────────────────────────────
<i>El envío de mensajes ha sido restringido preventivamente.</i>
```
