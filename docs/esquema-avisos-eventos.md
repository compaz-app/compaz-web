# Esquema propuesto: avisos, eventos y mensajes con el equipo

Estado: propuesta en papel (2026-11-03). Nada creado en la base. Todo es aditivo: tablas y columnas nuevas, sin cambiar ni borrar lo existente.

## Reglas de las migraciones

1. `create table if not exists`. Solo agregar.
2. Activar RLS en cada tabla nueva, sin políticas para clientes (solo la clave de servicio), igual que `admin_flags`.
3. Dar permisos explícitos a la clave de servicio en cada tabla nueva (`grant all on table ... to service_role`). Lección del hallazgo de `resenas`, que hoy da "permission denied" incluso con esa clave.
4. Referencias con `on delete set null` para poder borrar los datos de prueba sin que se rompa el historial.
5. Ningún dato de contacto de una parte dentro de lo que se guarda para la otra.

## 1. Tabla `avisos` (registro de lo que se envía)

Cada aviso a una persona queda guardado, con su resultado. Reintentar reenvía el mismo aviso. La escalera de respaldo sale de aquí.

Columnas:
1. `id` uuid, clave primaria.
2. `destinatario_tipo`: 'cliente', 'compita' o 'admin'.
3. `destinatario_id` uuid (id de `usuarios` o `compitas`; nulo para el admin).
4. `canal`: 'telegram' o 'correo'.
5. `plantilla`: código de la plantilla (por ejemplo `solicitud_nueva`). El texto se arma al enviar con las variables, así una corrección de copy se aplica también a los reintentos.
6. `variables` jsonb: lo necesario para armar el mensaje (nombres, horas, enlaces). Sin datos de contacto del otro.
7. `entidad` y `entidad_id` uuid: a qué se refiere (solicitud, visita, pago).
8. `paso`: el paso del ciclo (1 a 16) para medir dónde se pierden.
9. `estado`: 'pendiente', 'enviado', 'fallido' o 'cancelado' (el aviso quedó obsoleto porque la persona ya actuó).
10. `error` texto, `intentos` entero, `ultimo_intento_en`.
11. `programado_para` timestamptz (para recordatorios y la escalera).
12. `plazo_accion_hasta` timestamptz: hasta cuándo se espera que la persona actúe.
13. `accion_en` timestamptz: cuándo actuó (tocó el botón o completó el paso). Se mide la acción, no la entrega.
14. `respaldo_de` uuid referencia a `avisos`: el correo de respaldo apunta al aviso de Telegram que no tuvo acción.
15. `clave_unica` texto único: idempotencia (`solicitud_nueva:<id>:telegram`) para no enviar dos veces el mismo hecho.
16. `creado_en`.

Índices: pendientes por `programado_para`; por destinatario y fecha; por entidad.

Cómo trabaja la escalera: un proceso programado cada 5 minutos busca avisos enviados sin `accion_en` cuyo `plazo_accion_hasta` venció, y crea el respaldo (correo) y después la tarea en la Bandeja.

## 2. Registro de eventos: reutilizar `eventos`

La tabla ya existe, es de solo inserción, y su restricción ya permite el módulo `operacion`. Hoy solo tiene eventos de captación.

Uso: `modulo = 'operacion'`, `entidad` (solicitud, visita, pago, cliente, compita), `entidad_id` (uuid obligatorio), `tipo`, `actor` y `datos` jsonb.

Actor: 'sistema', 'cliente:<id>', 'compita:<id>' o 'admin:<correo>'.

Tipos de evento propuestos (uno por cambio relevante): `solicitud_creada`, `solicitud_aceptada`, `solicitud_rechazada` (datos: motivo), `horario_confirmado`, `entrevista_entro` (datos: quién), `entrevista_terminada`, `decision_contratar` (datos: sí o no y motivo), `pago_solicitado`, `pago_confirmado`, `visita_programada`, `visita_iniciada`, `visita_confirmada`, `visita_terminada`, `calificacion`, `reporte_enviado`, `emergencia`, `etapa_cambiada` (datos: desde y hasta), `ayuda_tocada` (datos: paso e intento), `ayuda_humano`, `aviso_fallido`.

Problema de la emergencia sin visita: hoy se guarda el texto "sin-visita". Como `entidad_id` debe ser uuid, una emergencia sin visita en curso se registra con `entidad = 'compita'` y el id del compita.

## 3. Etapa del cliente (columnas aditivas)

Propuesta: en `usuarios`, `etapa` (con valores 'invitado', 'familiar', 'eligiendo', 'solicitud', 'entrevista', 'decision', 'pago', 'activo', 'inactivo') y `etapa_desde` timestamptz. Se actualiza en el mismo lugar que escribe el evento `etapa_cambiada`. De ahí salen Seguimiento, el semáforo y los tiempos por etapa.

## 4. Tabla `mensajes_equipo` (mensajes entre una persona y el equipo)

1. `id` uuid.
2. `persona_tipo` ('cliente' o 'compita') y `persona_id` uuid.
3. `direccion`: 'entrante' o 'saliente'.
4. `canal`: 'portal', 'telegram' o 'correo'.
5. `tipo`: 'ayuda' (pidió ayuda tras los intentos) o 'mensaje'.
6. `paso` y `intentos` (para las peticiones de ayuda).
7. `texto` (máximo 2000 caracteres).
8. `atendido` booleano, `atendido_por` texto, `atendido_en`.
9. `aviso_id` uuid referencia a `avisos` (para los salientes, que salen por `notificar()`).
10. `creado_en`.

Índices: por persona y fecha; parcial de los no atendidos (alimenta la Bandeja).

## 5. Cambio pequeño en `admin_flags`

Columna `tipo` ('emergencia', 'contacto_bloqueado', 'manual'). Hoy la emergencia se distingue por el texto del nombre. La Bandeja lee de aquí las emergencias y los contactos bloqueados.

## 6. La Bandeja no es una tabla

Es una consulta que junta: pagos por confirmar (`solicitudes_pago` pendientes), avisos fallidos o sin acción vencidos, emergencias y alertas sin resolver, mensajes del equipo sin atender, entrevistas sin decisión. Ordenada por urgencia con los umbrales del semáforo.

## Preguntas abiertas

1. Etapa del cliente: ¿una sola por cliente (en `usuarios`) o por solicitud? Un cliente puede tener hasta 3 solicitudes a la vez. Recomendación: una por cliente, y el detalle de cada solicitud ya está en `solicitudes`.
2. Cuánto tiempo guardar los avisos (propuesta: 90 días, con el cron de limpieza que ya existe). Los eventos no se borran.
3. Guardar la plantilla con variables (recomendado) o el texto ya armado.
