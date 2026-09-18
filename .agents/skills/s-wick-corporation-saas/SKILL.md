---
name: s-wick-corporation-saas
description: Directrices maestras de ingeniería y gobernanza SaaS multi-tenant para S_WICK CORPORATION.
---

# S_WICK CORPORATION — Arquitectura SaaS Multi-Tenant V2.0

Esta skill documenta los principios de diseño, arquitectura modular, seguridad Zero-Trust y gestión de planes comerciales para comunidades de compra y venta operadas bajo **S_WICK CORPORATION**.

---

## 1. Identidad Corporativa y Modelo de Negocio

- **S_WICK CORPORATION** es el núcleo corporativo central diseñado para aprovisionar, supervisar y comercializar sub-bots SaaS a administradores de comunidades de compra y venta en Telegram.
- **Ventas Libres Perú** actúa como el buque insignia ("Flagship Community"), operando bajo las mismas interfaces y motores modulares que los sub-bots comerciales.
- **Aislamiento Multi-Tenant Estricto**: Ninguna operación de un sub-bot puede alterar datos, roles, métricas o sesiones de otro sub-bot o del bot principal.

---

## 2. Niveles de Planes SaaS (Suscripciones)

| Nivel de Plan | Características Incluidas | Inteligencia Artificial (Gemini) |
|---|---|---|
| **BÁSICO** | Verificación perimetral de canales, moderación anti-spam/flood, locks, comandos `/promote` y `/demote`. | Desactivado (Invita a actualizar plan). |
| **PRO** | Todo lo de BÁSICO + P2P Escrow / Trato Admin, hilos de negociación, GBan comunitario y auditoría con `/reverify`. | Desactivado. |
| **WICK ELITE / ENTERPRISE** | Todo lo de PRO + **Inteligencia Artificial Contextual 24/7**, radar de cachineros, asistente conversacional de compras, panel web dedicado `/portal/?slug=xxx`. | **ACTIVADO AL 100%**. |

---

## 3. Detección en Tiempo Real de Chats y Permisos de Administrador

1. **Consulta Viva vía Telegram API**:
   - `listAvailableChats(botInstance, tenantId)` consulta directamente `api.getChat()` y `api.getChatMember()`.
   - Si el bot fue expulsado (`status: 'left' | 'kicked'`), el chat es automáticamente purgado de la base de datos para no mostrar registros fantasma.
2. **Auditoría de Permisos Granulares**:
   - `can_restrict_members`: Requerido para silenciar y desmutear miembros en la verificación.
   - `can_delete_messages`: Requerido para moderación y limpieza de mensajes no autorizados.
   - `can_invite_users`: Requerido para generar enlaces de invitación a hilos y grupos.
3. **Grupo Principal de Verificación**:
   - Todo bot (principal o sub-bot) cuenta con un ajuste persistente en PostgreSQL: `primary_verification_chat_${tenantId || 'global'}`.
   - Permite al cliente elegir explícitamente el grupo principal donde se aplicará la restricción sin afectar grupos secundarios o canales de avisos.

---

## 4. Reingeniería de Roles de Staff (`/promote` & `/demote`)

1. **Sincronización Bidireccional**:
   - **Base de Datos**: Registro atómico en la tabla `staff` con `tenant_id` y `custom_title`.
   - **Telegram Bot API**: Promoción mediante `api.promoteChatMember()` asignando título oficial con `api.setChatAdministratorCustomTitle()`.
2. **Tolerancia Defensiva a Fallos**:
   - Si Telegram deniega la promoción en un chat específico (ej. jerarquía insuficiente o canal solo lectura), se almacena el rol en base de datos y se informa limpiamente al usuario sin romper el flujo.

---

## 5. Estética UI Obsidian Orange

- **Paleta Primaria Corporativa**:
  - Color Principal: `var(--orange-primary): #ff6b00;`
  - Resplandor Neón: `var(--orange-glow): rgba(255, 107, 0, 0.28);`
  - Acento Secundario: `var(--amber-warning): #f59e0b;`
  - Fondo: Obsidian `#07090e` con desenfoque de 16px.
- **Responsividad Móvil**:
  - Todos los selectores desplegables, tablas y botones deben ser táctiles y adaptarse a anchos de pantalla reducidos (smartphones y tablets).
