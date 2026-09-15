---
name: master-landing-ui-ux
description: Guía de ingeniería y estándares de diseño UI/UX de élite para landing pages y portales web de alto rendimiento. Enfoque en Obsidian Glassmorphism, micro-animaciones, tipografías modernas, retroalimentación interactiva y optimización móvil.
---

# Master Landing UI/UX — Estándar de Ingeniería Visual de Élite

Esta skill establece las directrices maestras de diseño, interacción y acabado estético para todas las páginas públicas y portales de **Ventas Libres Perú** y su ecosistema de Sub-Bots SaaS.

---

## 1. Filosofía de Diseño: Obsidian Glassmorphism & Cyberpunk Elegante

Las interfaces deben causar impacto inmediato ("Efecto WOW"), transmitiendo seguridad, tecnología de punta y distinción:

### Paleta de Colores & Materiales:
- **Fondo Base:** `#000000` (Negro Absoluto) y `#08090d` (Espacio Profundo).
- **Rejilla Cibernética:** Líneas tenues de 1px con opacidad al 3% (`rgba(255, 255, 255, 0.03)` en cuadros de 32x32px o 36x36px).
- **Iluminación Ambiental:** Halos radiales difuminados (`radial-gradient` con `filter: blur(80px)`), acentuando los colores de la marca:
  - **Ventas Libres Perú:** Naranja eléctrico (`#ff6b00`) y Ámbar (`#f59e0b`).
  - **Sub-Bots SaaS:** Monocromático reflectivo (`#ffffff`, `#71717a`, `#18181b`).
- **Superficies de Vidrio (Glassmorphism):**
  - Contenedores con `rgba(18, 22, 32, 0.7)` o `rgba(18, 18, 20, 0.75)`.
  - Desenfoque de fondo profundo: `backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);`.
  - Borde perimetral reflectivo: `border: 1px solid rgba(255, 255, 255, 0.12)`.

---

## 2. Tipografía y Jerarquía Visual

- **Fuentes Primarias:** *Outfit*, *Plus Jakarta Sans*, *Inter*.
- **Fuentes Monoespaciadas (IDs, Códigos, Tokens):** *JetBrains Mono*, *Fira Code*, *monospace*.
- **Títulos:**
  - `letter-spacing: -0.03em`.
  - Peso tipográfico: 800 o 900.
  - Gradiente de texto sutil para palabras clave (`background: linear-gradient(180deg, #ffffff 0%, #a1a1aa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;`).

---

## 3. Micro-Interacciones & Retroalimentación en Tiempo Real

Una web no puede ser estática ni plana. Debe sentirse viva y responder al usuario:
- **Telemetría en Vivo:**
  - Badge superior con punto de pulso animado (`box-shadow: 0 0 10px #22c55e`).
  - Muestra el estado del bot (`@username` en línea).
- **Barra de Progreso Dinámica:**
  - Detecta la interacción con cada canal ("X de N canales completados").
  - Anima suavemente la barra de avance (`transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1)`).
- **Tarjetas de Canales Interactivas:**
  - Elevación sutil en hover (`transform: translateY(-2px); box-shadow: 0 12px 30px rgba(0,0,0,0.6)`).
  - Al hacer clic para unirse, la tarjeta cambia automáticamente su estado a "✓ Listo / Unido".
- **Botones de Llamada a la Acción (CTA):**
  - Resplandor exterior pulsante (`glow effect`).
  - Micro-escala al presionar (`active: transform: scale(0.98)`).

---

## 4. Mobile-First para WebViews de Telegram

El 95% de los usuarios visitan estas webs desde el navegador interno de la app de Telegram (iOS / Android):
- **Áreas táctiles generosas:** Botones con altura mínima de 48px y padding ergonómico.
- **Scroll suave y sin rebotes:** Contenedor centrado con `max-width: 640px`.
- **Carga ultrarrápida:** Sin dependencias pesadas innecesarias. Cero JavaScript bloqueante.
