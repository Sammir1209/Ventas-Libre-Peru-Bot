---
name: nextjs-admin-portal
description: Estándares para el desarrollo de paneles administrativos en Next.js, diseño Obsidian Glassmorphism con globals.css y optimización de exportación estática para bajo consumo de memoria.
---

# Next.js Admin Portal — Estándar de Interfaz de Alta Fidelidad

Esta skill define las pautas visuales, de rendimiento y de desarrollo para el panel administrativo de **Ventas Libres Perú** construido sobre Next.js.

---

## 1. Filosofía Visual: Obsidian Glassmorphism

El panel debe ofrecer una estética futurista, limpia y profesional, inspirada en plataformas fintech y consolas de seguridad avanzadas:

### Paleta de Colores (`globals.css`):
- **Fondos:**
  - Base: `#080b11` (Obsidiana Profundo)
  - Superficie Elevada: `#0f172a` (Gris Pizarra Oscuro)
  - Tarjetas / Contenedores: `rgba(15, 23, 42, 0.65)` con `backdrop-filter: blur(16px)`
- **Acentos:**
  - Primario / Cyan Neón: `#06b6d4`
  - Éxito / Esmeralda: `#10b981`
  - Advertencia / Ámbar: `#f59e0b`
  - Peligro / Rubí: `#ef4444`
  - Púrpura Royal (Staff): `#8b5cf6`
- **Bordes:**
  - `rgba(255, 255, 255, 0.08)` para un sutil resplandor perimetral.

---

## 2. Optimización para Entornos de Recursos Restringidos (512MB RAM)

Para coexistir con el bot principal de Telegram y el Userbot MTProto en la misma máquina o contenedor sin riesgo de Out-of-Memory (OOM):
- **Exportación Estática (`output: 'export'`):**
  Next.js compila las páginas a HTML, JS y CSS estáticos de alta velocidad.
  ```javascript
  // next.config.js
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    output: 'export',
    trailingSlash: true,
    images: { unoptimized: true }
  };
  module.exports = nextConfig;
  ```
- El servidor Express se encarga de servir estos archivos estáticos con cabeceras de caché ultra-eficientes y consumo de RAM cercano a cero.

---

## 3. Organización Modular de Componentes

```
dashboard/src/
├── app/
│   ├── layout.jsx        # Shell principal, metadatos y carga de fuentes
│   ├── globals.css       # Variables CSS, resets, utilidades y animaciones
│   └── page.jsx          # Dashboard maestro con control reactivo de vistas
└── components/
    ├── common/           # Sidebar, Header, Modal, Toast, StatCard
    ├── staff/            # StaffTable, StaffEditModal, StaffSyncButton
    ├── deals/            # DealsTable, DealFilterTabs, DealEditModal
    ├── gban/             # GbanTable, GbanAddModal, GbanEnforceButton
    └── subbots/          # SubBotCards, SubBotStatusSwitch, SubBotConfigModal
```

---

## 4. Patrones de Interacción Reactiva

1. **Notificaciones Toast no intrusivas:**
   Toda acción exitosa o fallida (guardar cambio de rol, sincronizar @ de staff, forzar baneo) emite un toast flotante en la esquina superior derecha que desaparece tras 3.5 segundos.
2. **Modales Accesibles y con Escape:**
   Cierre con tecla `Esc` o clic fuera del contenedor, bloqueando el scroll de fondo mientras están activos.
3. **Filtros y Búsqueda en Vivo:**
   La barra de búsqueda en tablas (usuarios, staff, tratos) filtra en tiempo real sobre el dataset local o con debouncing (300ms) si realiza llamadas a la API.
