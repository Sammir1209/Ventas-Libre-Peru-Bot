---
name: modular-backend-architecture
description: Patrones de arquitectura limpia para backend Node.js y Express, separación estricta en carpetas, seguridad zero-trust, sesiones /panel y sincronización con Telegram Bot API.
---

# Modular Backend Architecture — Estándar de Backend Enterprise

Esta skill establece las pautas de arquitectura, estructura de directorios, seguridad y convenciones de codificación para el backend de **Ventas Libres Perú**.

---

## 1. Separación de Responsabilidades por Carpetas

Para evitar archivos monolíticos gigantescos, el backend debe organizarse estrictamente en:

```
src/web/
├── controllers/    # Entrada HTTP: recibe req, valida payload, llama a services y responde res
├── services/       # Lógica pura de negocio y acceso a base de datos / APIs externas
├── routes/         # Definición semántica de rutas Express y asignación de middlewares
├── middlewares/    # Filtros de seguridad, autenticación, rate limiting y validaciones
└── server.js       # Orquestador: configura Express, monta middlewares globales y routers
```

### Reglas de Oro:
- **Controladores delgados (Thin Controllers):** No deben contener lógica SQL directa ni reglas de negocio complejas. Su única tarea es recibir, validar y retornar JSON.
- **Servicios reutilizables (Fat Services):** Toda la lógica de mutación, cálculo de métricas o llamadas a Telegram reside en los servicios.
- **Rutas desacopladas:** Cada recurso (`staff`, `deals`, `gban`, `subbots`, `groups`) tiene su propio archivo de rutas montado bajo un prefijo común.

---

## 2. Autenticación Dual (Master Key & Sesiones Telegram `/panel`)

El acceso a los endpoints protegidos exige autenticación obligatoria:
1. **Master Key (`x-admin-key`):**
   Clave estática configurada en entorno para integraciones automáticas y scripts autorizados.
2. **Token de Sesión Temporal (`x-auth-token`):**
   Generado cuando un administrador ejecuta `/panel` en Telegram.
   - Tiene expiración automática (ej. 30 minutos).
   - Valida el `userId` y nivel de permisos (`OWNER`, `ADMIN`).
   - Si expira, retorna código HTTP 401 para forzar la reautenticación.

---

## 3. Sincronización en Tiempo Real con Telegram Bot API

Para mantener la base de datos sincronizada con la realidad de Telegram (cuando un usuario cambia su `@username` o nombre):
- El servicio `telegramSyncService.js` expone métodos para consultar directamente a Telegram:
  ```javascript
  // Obtener información del usuario vía Bot API getChat
  async function fetchTelegramUserInfo(botToken, userId) {
    const res = await telegramApiCall(botToken, 'getChat', { chat_id: userId });
    return {
      userId: res.id,
      username: res.username || null,
      firstName: res.first_name || 'Sin nombre',
      photoUrl: res.photo ? await getPhotoUrl(botToken, res.photo.small_file_id) : null
    };
  }
  ```
- Al invocar `POST /api/staff/:id/sync`, el backend consulta Telegram, actualiza las tablas `staff` y `users`, y responde con los datos actualizados a la interfaz web.

---

## 4. Barrera de Seguridad Zero-Trust (Firewall & Rate Limit)

- **Anti-Scanners:** Detección de patrones maliciosos (`wp-admin`, `.env`, `phpmyadmin`, `swagger`, `shell`). Si una IP realiza solicitudes a estas rutas, es bloqueada automáticamente durante 15 minutos.
- **Cabeceras OWASP:** Inyección obligatoria de cabeceras de seguridad:
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy: same-origin`.
- **Sliding Window Rate-Limiter:** Limitación por IP para prevenir fuerza bruta en endpoints administrativos.
