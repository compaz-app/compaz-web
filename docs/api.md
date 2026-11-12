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

### `POST /api/admin/contacto`
Permiso `telefonos`. Cuerpo `{ tipo: 'compita'|'cliente', id, canal: 'correo'|'telefono'|'whatsapp', motivo }`. Entrega el dato de contacto (`data.valor`). Un colaborador debe dar un motivo (uno de la lista o `Otro: <explicación>`); el administrador no. El acceso se anota en Actividad (categoría `acceso_contacto`) ANTES de entregar el dato; si no se puede anotar, no se entrega (503). Del compita: correo y teléfono (`compitas.telefono`, pedido en el formulario de registro).

### `POST /api/onboarding/registrar`
El cuerpo ahora incluye `telefono` (WhatsApp, obligatorio salvo que lo llame un administrador). Se normaliza a `+código de país` con `normalizarTelefono` y se guarda en `compitas.telefono`; si no es válido responde 400. `POST /api/admin/registrar-compita` lo acepta como opcional.

### `POST /api/admin/notas`
Permiso `atender`. Cuerpo `{ tipo: 'compita'|'cliente', id, texto }` (1 a 1000 letras). Agrega una nota interna a la ficha, con el correo de quien la escribe. Solo se agregan: no hay editar ni borrar. Las notas se leen con la ficha (sin teléfonos ni correos si falta el permiso `telefonos`). Tabla `notas_persona`.

### `POST /api/admin/chat`
Permiso `chats`. Cuerpo `{ clienteId, compitaId, motivo }`. Devuelve `{ cliente, compita, mensajes: [{ de, texto, cuando, esFoto }] }` con los mensajes de todas las visitas entre ambos (hasta 500, más antiguo primero). Un colaborador debe dar motivo; el administrador no. La consulta se anota en Actividad (categoría `acceso_chat`) ANTES de entregar nada; si no se puede anotar, responde 503 y no entrega el chat. Sin el permiso `telefonos`, los textos llegan sin teléfonos ni correos.

### `POST /api/admin/confirmar-pago`
Permiso `pagos`. Cuerpo `{ flag_id }` (una tarea de pago de la Bandeja). La solicitud de pago se busca por el cliente de la tarea: el navegador no elige qué pago confirmar. Confirma el pago, avisa al cliente por correo, cierra las tareas de pago de ese cliente y anota quién en Actividad (`pago_confirmado_bandeja`). Responde 409 si el pago ya no está pendiente. La ruta vieja `confirmar-solicitud` también exige `pagos` (antes pedía `atender`).

### `POST /api/admin/insistir-aviso`
Permiso `atender`. Cuerpo `{ flag_id }`. Reenvía el aviso que la persona de una tarea no atendió (tareas de la escalera, cambio en el lugar, cita sin confirmar y dirección faltante). El reenvío es un aviso nuevo con clave `reenvio:<aviso>:<n>` y `respaldo_de`. Tope: uno cada 30 minutos y 3 por aviso (regla `insistir_aviso`); al alcanzarlo responde 429 con `error` corto y `porQue`. La tarea queda abierta. Anota `aviso_reenviado` en Actividad.

### `POST /api/admin/reintentar-aviso`
Permiso `atender`. Cuerpo `{ aviso_id }`. Reintenta un aviso FALLIDO (Estado del sistema). 409 si ya no está pendiente o llegó al máximo de intentos (5); 502 si vuelve a fallar, con el motivo. Anota `aviso_reintentado`.

### Contacto en el sitio
`POST /api/admin/contacto` acepta también `tipo: 'visita'` (canal `telefono` o `whatsapp`): devuelve el teléfono y el nombre del contacto en el sitio de esa visita, con las mismas reglas de motivo y registro en Actividad.

### `/api/admin/equipo`
Permiso `raiz` (solo administradores de ADMIN_EMAILS). `GET` lista, `POST { correo, nombre, permisos? }` invita (no manda correo), `PATCH { correo, permisos?, activo? }` cambia permisos o activa o desactiva, `DELETE { correo }` quita al colaborador del equipo (borra su fila; el historial `equipo_historial` es de solo inserción y conserva `alta`, `permisos`, `desactivado`, `reactivado` y `eliminado`). Los administradores no se quitan por aquí: viven en ADMIN_EMAILS.

### `PATCH /api/admin/ajustes`
Permiso `ajustes_editar`. Cuerpo `{ cambios: { clave: valor, ... }, confirmar_incoherente? }`. Guarda varios ajustes a la vez, TODO O NADA: se valida cada valor, las reglas entre ajustes (por ejemplo el rojo del semáforo después del amarillo) y los precios; un plan más caro que las horas sueltas responde 409 hasta que se confirma. Cada cambio deja su fila en `ajustes_historial` y una línea `ajustes_cambiados` en Actividad. Los ajustes se LEEN en el servidor al abrir la pantalla (permiso `ajustes_ver`). Los umbrales del semáforo de Seguimiento son los ajustes `semaforo_<etapa>_amarillo|rojo`.

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

## Captación

| Método | Ruta | Acceso | Qué hace |
| --- | --- | --- | --- |
| POST | `/api/waitlist` | Público (Turnstile, honeypot, límites) | Recibe postulaciones de la home y de `/se-compita`. Con `POSTULACIONES_DESTINO=supabase_y_airtable` guarda en Supabase y copia a Airtable. Campos nuevos opcionales: `utmContent`, `utmTerm`, `fuente` (`home` o `se_compita`), `claveIdempotencia` (uuid por envío) |
| POST | `/api/cron/reintentar-airtable` | `x-cron-secret` | Cada 15 min: retoma copias pendientes buscando antes su huella en Airtable; avisa de la bandeja |
| POST | `/api/cron/conciliar-airtable` | `x-cron-secret` | Cada hora: importa o vincula registros de Airtable creados desde `CAPTACION_DESDE` que Supabase no tenga |
| POST | `/api/admin/postulaciones/resolver` | Admin (sesión verificada) | Resuelve una postulación de la bandeja: `{ id, resolucion, nota?, airtableId? }` |
| GET | `/admin/postulaciones` | Admin | Bandeja de postulaciones que no llegaron a Airtable |
| GET | `/api/cmc/postulaciones` | `Authorization: Bearer CMC_LECTURA_TOKEN` (sin él o sin `CAPTACION_DESDE`: 503) | Solo lectura para el Apps Script del CMC: postulaciones desde `CAPTACION_DESDE` con formato de Airtable (`{ ok, data: { records, offset } }`, `?offset=` para paginar). Ver `docs/cmc/fuente-supabase.md` |
| POST | `/api/cmc/compitas` | `Authorization: Bearer CMC_ESCRITURA_TOKEN` (sin él: 503) | Foto horaria de Compitas habilitadas enviada por el Apps Script del CMC. Simula (solo lecturas) salvo `CMC_COMPITAS_MODO=aplicar` y sin `?dryRun=1`. 409 si la foto se rechaza (vacía, incompleta, anómala o freno). Ver `docs/cmc/compitas-desde-cmc.md` |

## Errores comunes

| Status | Descripción |
|--------|-------------|
| 400 | Request inválido (body mal formado, límite alcanzado) |
| 401 | No autenticado |
| 403 | Sin permisos suficientes |
| 404 | Recurso no encontrado |
| 500 | Error interno del servidor |

### GET /api/precios
Pública. Devuelve los precios vigentes (`hora`, `mandado`, `planes.{carta,quincenal,semanal}`) tomados de Ajustes. Solo para mostrar: al cobrar, el servidor recalcula el importe con `lib/precios.ts` y nunca acepta uno del navegador.

### Cambios tras la auditoría (2026-11-12)
- `GET /api/admin/resenas` **ya no existe** (devolvía el correo de cada cliente a quien tuviera `atender`); `PATCH` sigue. El listado lo lee el panel desde el servidor.
- `POST /api/admin/enviar-link-llamada { solicitud_id }`: máximo uno cada 5 minutos por solicitud (429 con explicación) y solo si la solicitud sigue aceptada.
- `DELETE /api/admin/eliminar-cliente` y `eliminar-compita` aceptan `borrar_datos: true` (la persona pidió borrar sus datos): solo entonces se anonimiza; sin él se conserva la información con la marca "(cuenta eliminada)".
- `POST /api/admin/anular-pago { pago_id, motivo }`: el motivo es obligatorio.
- `GET /api/llamada/info?sala=` y `/llamada/<sala>`: piden enlace firmado, administrador o el cliente de esa visita; la sala de Daily es privada.
- `asignar-rapido` lleva el token en la URL a propósito (un solo uso, vence, confirmación por POST).
