---
name: zero-trust-panel-security
description: Protocolo de arquitectura y seguridad Zero-Trust para paneles web administrativos de bots multi-tenant. Control estricto de roles, aislamiento perimetral de comunidades, sesiones criptográficas con TTL en PostgreSQL y prevención de IDOR.
---

# Zero-Trust Panel Security — Estándar de Seguridad Perimetral

Esta skill define la arquitectura de ciberseguridad inquebrantable para el acceso administrativo al Panel Web tanto en **Ventas Libres Perú** como en sus **Sub-Bots SaaS**.

---

## 1. Principio Fundamental: Acceso Restringido a Owners Legítimos

Ningún usuario que carezca del rol de **Owner** (o Co-Owner autorizado en la base de datos) puede visualizar, acceder ni recibir credenciales del panel:
- **En Grupos:** Si un usuario común ejecuta `/panel`, `/web` o `/dashboard`, el bot elimina el mensaje trigger de forma silenciosa para evitar divulgar comandos y no expone ninguna interfaz.
- **En Privado:** Si no tiene permisos, el bot responde con un mensaje tajante de acceso denegado.
- **Verificación Criptográfica en DB:** La pertenencia como Owner se verifica en tiempo real contra los registros de la base de datos PostgreSQL (`sub_bots.owner_ids` y `staff_members.role`), nunca confiando únicamente en parámetros de cliente.

---

## 2. Emisión Segura de Credenciales vía Telegram DM

Cuando un Owner verificado solicita acceso:
1. **Generación Criptográfica:** Se crea una clave de acceso temporal (Access Key de 12 a 16 caracteres alfanuméricos de alta entropía) y un token de sesión SHA-256 con tiempo de vida limitado (TTL de 8 a 24 horas).
2. **Registro en PostgreSQL (`panel_sessions`):**
   - `user_id`: ID numérico de Telegram.
   - `tenant_id`: ID único de la comunidad del sub-bot (o NULL para el bot principal).
   - `access_key`: Contraseña de acceso temporal.
   - `token_hash`: Hash SHA-256 del token para validación segura.
   - `expires_at`: Timestamp estricto de expiración.
3. **Entrega en Chat Privado (DM):**
   - Enlace directo con token de un solo uso.
   - ID de Telegram del usuario.
   - Contraseña de seguridad para login manual.
   - Botón inline para ingreso instantáneo con 1 toque.

---

## 3. Aislamiento Multi-Tenant (Anti-IDOR & Anti-Bypass)

- **Validación Estricta de Tenant:** Cada llamada a la API REST `/api/portal/:slug/admin/*` verifica que la sesión del usuario pertenezca estrictamente al `tenant_id` del sub-bot consultado.
- **Prohibición de Acceso Cruzado:** El Owner de un sub-bot no puede consultar, modificar ni afectar datos de otra comunidad ni del panel maestro de Ventas Libres Perú.
- **Rotación y Revocación:** Al cerrar sesión o al expirar el tiempo de vida (TTL), la sesión queda invalidada inmediatamente en PostgreSQL.
