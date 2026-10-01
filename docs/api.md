# Compaz Platform — API Reference

Todas las rutas están bajo `/api/`. La autenticación usa Supabase Auth (cookie de sesión). Las respuestas siguen el formato estándar definido en `lib/api.ts`:

```ts
{ ok: true, data: T }      // éxito
{ ok: false, error: string } // error
```

---

## Autenticación

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/auth/callback` | GET | Callback OAuth de Supabase (redirect) |
| `/api/auth/signout` | POST | Cierra la sesión del usuario |

---

## Compitas (público autenticado)

### `GET /api/cobertura`
Retorna las zonas con cobertura activa (para el mapa).
- Solo compitas con `estado=activo` AND `verificado=true`.
- No requiere autenticación.

**Response:**
```json
{ "ok": true, "data": [{ "zona": "Miranda/Baruta", "compita_id": "..." }] }
```

### `GET /api/compitas/[id]`
Perfil público de un compita.
- Requiere autenticación.
- Solo retorna si `estado=activo` AND `verificado=true`.

---

## Solicitudes de entrevista

### `GET /api/mis-solicitudes`
Lista las solicitudes activas del cliente autenticado.
- Últimos 30 días.
- Incluye nombre, foto y zona del compita.

**Response:**
```json
{
  "ok": true,
  "data": {
    "solicitudes": [{
      "id": "uuid",
      "compita_id": "uuid",
      "compita_nombre": "María García",
      "compita_foto": "https://...",
      "compita_zona": "Miranda/Baruta",
      "mensaje": "Mi mamá necesita...",
      "estado": "pendiente",
      "created_at": "2025-10-01T..."
    }]
  }
}
```

### `POST /api/solicitudes`
Crea una nueva solicitud de entrevista.
- Máximo 3 solicitudes pendientes simultáneas por cliente.
- No se puede solicitar dos veces al mismo compita.
- Envía notificación al compita vía Telegram.

**Body:**
```json
{
  "compita_id": "uuid",
  "mensaje": "Mi mamá tiene 78 años...",
  "franja_horaria": "Mañanas (9-12am)"
}
```

### `GET /api/solicitud/responder`
Endpoint para que el compita acepte/rechace via Telegram.
- Token de un solo uso en la URL.
- No requiere autenticación (compita responde desde Telegram).

**Query params:** `?token=uuid&accion=aceptar|rechazar`

**Response:** HTML simple con confirmación (visible en Telegram).

---

## Acción de interés (legacy)

### `POST /api/interes`
Registra el interés de un cliente en un compita.
- Crea un `action_token` de un solo uso.
- Rate limit: máximo 3 tokens activos por cliente.

---

## Visitas

### `GET /api/visitas`
Lista las visitas del cliente autenticado.

### `POST /api/visitas`
Crea una nueva visita programada.
- Solo admins y compitas pueden crear visitas.

### `PATCH /api/visitas/[id]`
Actualiza el estado de una visita (`en_curso`, `terminada`).
- Usado por el bot de Telegram cuando el compita inicia/termina.

### `GET /api/visitas/[id]/mensajes`
Mensajes de una visita específica.

### `POST /api/visitas/[id]/mensajes`
Envía un mensaje dentro de una visita.

---

## Telegram Bot

### `POST /api/telegram/webhook`
Recibe actualizaciones del bot de Telegram.
- Validado con `X-Telegram-Bot-Api-Secret-Token` header.
- Maneja: inicio de visita, fin de visita, fotos, mensajes de texto.

### `GET /api/telegram/register`
Registra el webhook del bot (solo en setup inicial).
- Solo admins.

---

## Admin

### `GET /api/admin/compitas`
Lista todas las compitas (admin).

### `PATCH /api/admin/compitas/[id]`
Actualiza datos de un compita (verificar, desactivar, reactivar).

**Body:** `{ "verificado": true }` o `{ "estado": "inactivo" }`

### `GET /api/admin/usuarios`
Lista todos los usuarios (admin).

### `GET /api/admin/solicitudes`
Lista todas las solicitudes de entrevista (admin).

---

## Llamadas (Daily.co)

### `POST /api/llamada/crear`
Crea una sala de videollamada.
- Sala con duración máxima de 23 minutos (20 para la llamada + 3 de gracia).
- Solo admins pueden crear salas.

**Response:**
```json
{ "ok": true, "data": { "url": "https://compaz.daily.co/...", "room_name": "..." } }
```

---

### `PUT /api/admin/compita`

Actualiza campos editables del perfil de una compita. Solo admin.

**Body:** `{ id, nombre?, zona?, descripcion?, servicios?, youtube_url?, foto_url? }`

**Response:** `{ ok: true, data: Compita }`

---

## Errores comunes

| Status | Descripción |
|--------|-------------|
| 400 | Request inválido (body mal formado, límite alcanzado) |
| 401 | No autenticado |
| 403 | Sin permisos suficientes |
| 404 | Recurso no encontrado |
| 500 | Error interno del servidor |
