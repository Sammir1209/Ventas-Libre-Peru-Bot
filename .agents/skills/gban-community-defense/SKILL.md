---
name: gban-community-defense
description: Protocolos de baneo global (GBan), custodia de pruebas en Supabase Storage, radar furtivo y expulsión coordinada de estafadores en toda la red.
---

# GBan & Community Defense — Sistema Global de Lista Negra

Esta skill documenta la arquitectura de seguridad defensiva, detección proactiva y expulsión sincronizada de ciberdelincuentes y estafadores dentro del ecosistema de **Ventas Libres Perú**.

---

## 1. Cadena de Custodia de Evidencias (Storage Inmutable)

Cuando un usuario o administrador reporta una estafa vía `/quemar` o desde el portal web:
1. Las capturas y comprobantes recibidos por Telegram se descargan inmediatamente en memoria usando la API de Telegram (`getFile`).
2. Se suben de forma segura a Supabase Storage en el bucket `burn-proofs`:
   ```javascript
   const { data, error } = await supabase.storage
     .from('burn-proofs')
     .upload(`${targetId}/${Date.now()}_${fileName}`, fileBuffer, {
       contentType: mimeType,
       upsert: false
     });
   ```
3. La URL pública permanente se almacena en el array `proof_urls` de la tabla `burn_reports` o `burned_users`.
4. Si el estafador borra su cuenta de Telegram, las pruebas continúan preservadas de forma permanente e inmutable.

---

## 2. Ejecución Sincronizada de GBan (Cross-Group Ban)

Al confirmar un GBan (ya sea por aprobación de reporte o inserción directa desde el panel web):
- Se inserta o actualiza el registro en `burned_users`.
- Se consulta la tabla `official_groups` para obtener todos los grupos y canales oficiales donde el bot es administrador.
- El bot itera sobre cada grupo ejecutando la expulsión:
  ```javascript
  for (const group of groups) {
    try {
      await bot.api.banChatMember(group.chat_id, targetUserId);
    } catch (err) {
      // Ignorar si el usuario no estaba en el chat o no hay permisos suficientes
    }
  }
  ```
- Se publica la ficha oficial en el canal público de quemados (`PUBLIC_BURN_CHANNEL_ID`) y en el hilo privado de staff.

---

## 3. Detección Preventiva en Tiempo Real

1. **Evento `chat_member` / `new_chat_members`:**
   En cuanto un usuario entra a cualquier grupo oficial, el bot consulta la caché Redis / DB. Si `isUserBurned(userId)` es verdadero, el bot lo expulsa en menos de 200 ms y emite una alerta visual en el grupo.
2. **Radar Furtivo (`búscame a...` / `/buscar`):**
   Permite a los miembros verificar antecedentes de cualquier persona antes de hacer negocios. Si el usuario está registrado como estafador, el radar lo delata con estado `🔴 QUEMADO / ESTAFADOR`.

---

## 4. Procedimiento de Desbaneo y Apelación

- El desbaneo (`UNGBAN`) solo puede ser ejecutado por un **Owner** o **Co-Owner**.
- Acciones requeridas:
  1. Eliminar el registro de `burned_users` (`unburnUser(userId)`).
  2. Registrar la acción en `mod_logs` con el motivo de la revocación.
  3. Ejecutar `unbanChatMember` en los grupos principales para permitir su reingreso si correspondiese.
