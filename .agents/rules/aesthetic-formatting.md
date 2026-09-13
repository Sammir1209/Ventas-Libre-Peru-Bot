# Reglas de Formato Estético & Simbología Unicode (Ventas Libres Perú)

Para mantener la calidad visual premium en todas las respuestas del bot, notificaciones a canales oficiales y componentes de la web:

1. **Jerarquía Visual Consistente:**
   - Todo mensaje o notificación debe comenzar con el símbolo `⟡` seguido del título en mayúsculas o tipografía bold decorativa (`𝙏𝙄𝙏𝙐𝙇𝙊`).
   - Los subtítulos e insignias deben cerrarse entre `⊱ ... ⊰` o corchetes limpios.
   - Las líneas divisorias deben usar `══════════════════════════════════════════════════════` para encabezados principales y `──────────────────────────────────────────────────────` para pies de página.

2. **Simbología Funcional, No Decoración Caótica:**
   - Usar `▸` para viñetas de datos clave y `↳` para desgloses o detalles secundarios.
   - Emojis de alerta (`🚨`, `⚠️`, `🛡️`, `⚔️`) solo se usan en contextos de peligro, moderación o seguridad.
   - Emojis de éxito (`✓`) y error (`✗`) deben acompañar las confirmaciones o rechazos.

3. **Valores Sensibles en Monospace:**
   - Todos los IDs de Telegram, hashes de transacción, montos económicos y comandos ejecutables deben formatearse en `<code>...</code>`.

4. **Escapado HTML Obligatorio:**
   - Cualquier dato dinámico de usuario (`first_name`, `username`, `group title`) debe procesarse obligatoriamente con `escapeHtml()` antes de incluirse en mensajes de Telegram.
