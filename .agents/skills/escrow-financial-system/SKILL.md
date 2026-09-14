---
name: escrow-financial-system
description: Procedimientos y arquitectura de intermediación P2P (Escrow), ciclo de vida de tratos, asignación de mediadores, reputación y resolución de disputas.
---

# Escrow Financial System — Intermediación Segura y Tratos Admin

Esta skill define el ciclo de vida, las reglas de negocio y los mecanismos de protección contra fraude para el sistema de intermediación comercial (Escrow / Tratos Admin) de **Ventas Libres Perú**.

---

## 1. Ciclo de Vida del Trato (State Machine)

Todo trato transita estrictamente por las siguientes etapas:

```
[ PENDING ]
     │
     ▼ (Admin toma el trato o se asigna vía web/bot)
[ ASSIGNED ]
     │
     ▼ (Se crea el grupo/topic privado y ambas partes confirman términos)
[ IN_PROGRESS ]
     │
     ├──────────────────────────┐
     ▼                          ▼ (Conflicto / Ruptura de acuerdo)
[ COMPLETED ]              [ DISPUTE ]
     │                          │
     ▼ (Rating 1-5★)            ▼ (Resolución Staff)
[ CERRADO & ARCHIVADO ]    [ CANCELLED / REFUNDED ]
```

### Definición de Estados:
- **`PENDING`:** Solicitud creada por el usuario (comprador o vendedor) a la espera de que un Trato Admin oficial tome el caso.
- **`ASSIGNED`:** Un mediador oficial ha tomado el caso y se genera el enlace de invitación o grupo exclusivo.
- **`IN_PROGRESS`:** Las partes están dentro del grupo, el comprador ha depositado los fondos o garantía al mediador y el vendedor procede con la entrega.
- **`COMPLETED`:** El comprador confirma la recepción conforme del producto/servicio, el mediador libera los fondos al vendedor y se habilita la calificación.
- **`CANCELLED`:** Trato abortado por mutuo acuerdo o expiración sin transferencia de fondos.
- **`DISPUTE`:** Una de las partes desconoce el cumplimiento; el staff evalúa pruebas en el hilo de logs.

---

## 2. Asignación y Reasignación de Mediadores

1. **Toma en Telegram:** Un Trato Admin presiona el botón inline `[ 🤝 Tomar Trato ]` en el canal de intermediación.
2. **Reasignación desde la Web:**
   Si el mediador asignado se encuentra inactivo o sufre una desconexión, el Owner o Administrador Supremo puede editar el trato desde el portal web:
   - Cambiar `admin_id` a otro miembro de Staff activo.
   - Registrar la auditoría de la reasignación con timestamp y responsable.
   - El bot notifica automáticamente en el grupo del trato el cambio de mediador.

---

## 3. Sistema de Calificaciones y Reputación

- Tras el cierre con éxito (`COMPLETED`), el bot envía un teclado de calificación a las partes:
  `[ ⭐ 1 ] [ ⭐ 2 ] [ ⭐ 3 ] [ ⭐ 4 ] [ ⭐ 5 ]`
- La tabla `ratings` almacena la puntuación vinculada a `deal_id`, `admin_id` y `rater_id`.
- Se calcula la reputación global del mediador:
  $$\text{Promedio} = \frac{\sum \text{Estrellas}}{\text{Total de Tratos Calificados}}$$
- La reputación se muestra en el perfil público del mediador (`/staff` y `/info`).

---

## 4. Medidas Anti-Fraude Obligatorias

- **Verificación de Enlace Oficial:** Ningún trato se realiza fuera de grupos creados o verificados por el bot oficial.
- **Validación de Identidad:** El bot compara el ID numérico del usuario con la lista negra de estafadores (`burned_users`) antes de permitir la apertura de cualquier intermediación.
- **Notificación a Canal Central:** Cada movimiento relevante (apertura, asignación, depósito, liberación) se reporta en el canal de logs (`LOG_CHANNEL_ID`) con copia de seguridad en Postgres.
