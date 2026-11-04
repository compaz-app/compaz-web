# Plan de construcción del rediseño, paso a paso

Rama de trabajo: `rediseno`. Punto de retorno: etiqueta `antes-del-rediseno`. Cada paso es pequeño, se prueba solo (`node tests/run.mjs`, `npx tsc --noEmit`) y se puede deshacer. Solo commit; el push lo decide el usuario. Las migraciones solo agregan tablas o columnas. Cada paso se marca como hecho al terminar.

Aclaración (2026-11-03): todo lo que hay hoy en el sistema, clientes y compitas, es de prueba y se puede borrar. No se exporta ni se respalda nada de lo actual.

## Fase 0. Preparar (casi sin código)

0.1 Descartado: no hace falta exportar compitas porque son de prueba.
0.2 Revisar los registros de Netlify del día de la prueba para saber por qué fallaron los avisos de Telegram.
0.3 HECHO (2026-11-03, lectura de solo existencia y conteo, sin leer datos personales). Resultados:
    1. La migración de captación está aplicada: existen `eventos` (4 filas), `postulaciones` (2) y `personas` (2).
    2. `eventos` solo tiene eventos del módulo `captacion` (`postulacion_recibida`, `airtable_enviada`). El módulo `operacion` está permitido por la restricción pero nadie escribe en él. `eventos` es de solo inserción, `entidad_id` debe ser un uuid (hoy la alerta de emergencia usa el texto "sin-visita" en `admin_flags`, que no cabría) y `datos` es jsonb. Decisión de 1.2: reutilizar `eventos` con módulo `operacion`.
    3. La tabla `avisos` NO existe: el nombre está libre para 1.1.
    4. Existen también `solicitudes` (10), `solicitudes_pago` (3), `pagos_plan` (6), `admin_flags` (12), `reportes_visita` (3), `telegram_estados` (60), `compitas` (23), `usuarios` (8), `visitas` (6).
    5. HALLAZGO a verificar: la tabla `resenas` da "permission denied" (código 42501) incluso con la clave de servicio. `api/admin/resenas` usa esa clave, así que aprobar reseñas podría estar fallando hoy. Falta confirmarlo en la app y, si es así, arreglarlo con un GRANT aditivo.
0.4 DECIDIDO (2026-11-03):
    1. Durante la visita el cliente recibe reportes con fotos y texto, sin videollamada. Notas de voz: DESCARTADAS por decisión del usuario (2026-11-03); solo fotos y texto. Las entrevistas siguen usando Daily.
    2. Canal humano: último recurso. Aparece solo después de 3 o 4 intentos de "no entiendo" en el mismo paso, nunca de inmediato, para que no se abuse. La única excepción es la emergencia, que ya tiene su propio botón.
    3. En esta fase inicial los administradores invitan a clientes y compitas. Más adelante será automático (registro propio).
    4. Canal humano DECIDIDO: botón "Pedir que me ayude una persona" que crea una tarea "Pidió ayuda" en la Bandeja del admin (paso, intentos y desde cuándo). Respaldo: correo visible para quien no pueda entrar al portal. Responden los administradores, en menos de 2 horas en horario laboral. Se queda solo en la Bandeja (sin aviso extra por Telegram); si el plazo vence, sube a amarillo y rojo.
    5. Compitas: "Hablar con el equipo" en Telegram. El mensaje se guarda (tabla nueva `mensajes_equipo`, aditiva), aparece en la Bandeja como "Mensaje del compita" y el admin responde desde el portal; el sistema lo envía por el bot con `notificar()`. Hoy el bot solo reenvía el texto libre al cliente durante una visita; fuera de la visita no hay camino al admin. El botón explícito evita mezclar ambos. Si el compita bloqueó el bot, cae en la escalera (correo y Bandeja).
    Riesgos de las notas de voz: Telegram las entrega en formato ogg/opus, que no suena en todos los navegadores de iPhone sin convertirlo; y un audio puede decir un teléfono en voz alta, algo que hoy el filtro de contactos del chat no detecta (choca con el requisito de que cliente y compita no se contacten fuera).
0.5 Diseñar el ciclo del compita con la escalera de Telegram, correo y Bandeja.

## Fase 1. Base de avisos y eventos (invisible, lo más importante)

1.1 Tabla `avisos`: destinatario, canal, plantilla, estado (enviado, fallido), error, intentos, fechas. Migración aditiva.
    APLICADA Y VERIFICADA (2026-11-03): el usuario la ejecutó en el SQL Editor. Prueba con la clave de servicio: inserta, rechaza clave única repetida, rechaza cliente sin destinatario y canal inválido, y borra; la tabla quedó vacía. Escrita en: `supabase/migrations/20261103_avisos.sql`. Verificado antes en la base real: todos los `id` de `compitas`, `usuarios`, `visitas`, `solicitudes`, `solicitudes_pago` y `admin_flags` son uuid; `usuarios.id` es el de `auth.users`; `usuarios` aún no tiene `etapa`; `admin_flags.entidad_id` es texto. Decisiones del usuario sobre el esquema: una etapa por cliente en `usuarios`; avisos guardados 90 días; plantilla con variables.
1.2 Registro de eventos de operación: reutilizar `eventos` (decidido).
    APLICADA Y VERIFICADA (2026-11-03). Pruebas reales: rechaza entidad inválida, tipo inválido, sin id, actor vacío y datos enormes; el servidor sigue sin poder insertar directo (42501); un visitante sin sesión no puede ejecutarla (42501); una llamada válida del servidor guarda el evento (módulo operacion) y se lee de vuelta. Dejó 1 evento de prueba permanente (`verificacion_sistema`, id 5). Hallazgo previo: el servidor NO puede insertar directo en `eventos` (la migración de captación dejó a la clave de servicio solo con permiso de lectura, a propósito; los eventos se escriben con funciones SQL security definer). Por eso se crea `supabase/migrations/20261103b_registrar_evento.sql` (función `registrar_evento`, solo módulo operacion, valida entidad, tipo y tamaño, ejecutable solo por la clave de servicio) y `lib/eventos.ts` con `registrarEvento()`, que nunca lanza. Prueba: `tests/19-eventos.test.ts` (5 pruebas, pasan).
    Estado de la suite completa: 22 de 220 pruebas fallan, las mismas 22 que ya fallaban en el código publicado (etiqueta `antes-del-rediseno`: 22 de 215). No es un efecto de estos cambios; al menos una falla por hora (espera 400 con un horario a 5 minutos y recibe 200). Pendiente investigarlas.
1.3 `lib/avisos.ts` con `notificar()`: envía con `sendTelegramMessage` o `sendEmail` actuales, registra el resultado y permite reintentar.
    HECHO (2026-11-03), sin tocar ningún flujo existente. Archivos nuevos: `lib/avisos.ts` (`notificar`, `reintentarAviso`, `registrarAccion`), `lib/plantillas-aviso.ts` (registro de plantillas; la primera es `solicitud_nueva`, por Telegram, con el texto que ya usa `app/api/solicitudes/route.ts`) y `tests/20-avisos.test.ts` (12 pruebas, pasan). Se añadió la tabla `avisos` a `tests/fake-db.ts`. Diseño: nunca lanza; guarda el aviso antes de enviar (idempotencia por clave única); las direcciones (chat de Telegram, correo) se leen de la base al enviar y no se guardan en `avisos`; las plantillas reciben solo ids y leen datos frescos, y devuelven null si el hecho ya no aplica (se cancela); si no se puede guardar el registro, igual se envía; reintento con máximo de 5; `registrarAccion` anota que la persona actuó y cancela lo pendiente. Suite completa: 237 pruebas, 22 fallan, las mismas 22 que ya fallaban antes (se comprobó contra el código publicado).
    Falta para el 1.4: migrar los tres flujos (solicitud al compita, pago confirmado, pregunta de contratar) y añadir sus plantillas (la de correo incluida).
1.4 Migrar tres flujos críticos a `notificar()`: solicitud al compita, pago confirmado, pregunta de contratar.
    C. Pregunta de contratar tras la entrevista: HECHO (2026-11-03). El webhook de Daily (`app/api/webhooks/daily/route.ts`) envía con `notificar()` el correo al cliente (plantilla `llamada_terminada_cliente`, variantes normal y llamada corta) y el Telegram al compita (`llamada_terminada_compita`), con el texto que ya usaba. Quedan registrados (paso 10; el correo espera la decisión 2 h), un fallo se reintenta, y el admin sigue recibiendo su alerta si el correo no sale. La clave de idempotencia incluye la sala, para que tras reconectar la llamada completa tenga su propio aviso (una prueba existente, `tests/08-recorridos`, lo detectó). `resultado-llamada` anota la acción (paso 10) y el evento `decision_contratar` (contratar, reagendar o no_contratar); el webhook registra `entrevista_terminada` con la duración. Si el cliente ya decidió, un reintento se cancela. 7 pruebas nuevas en `tests/24-llamada-avisos.test.ts`. Suite: 256 pruebas, 21 fallan, sin fallos nuevos. LIMITACIÓN que sigue: la pregunta aún depende de que Daily envíe `meeting.ended`; el cierre por reloj es de la Fase 3 y el recordatorio de la escalera es el 1.5. Tampoco se pregunta el motivo cuando el cliente dice que no.
    B. Pago confirmado al cliente: HECHO (2026-11-03). `app/api/admin/registrar-pago` y `app/api/admin/confirmar-solicitud` usan `notificar()` con la plantilla `pago_confirmado` (las dos variantes de texto de antes, conservadas). El aviso queda registrado (paso 12), un fallo del correo se puede reintentar, y un pago anulado no se confirma (el aviso se cancela). `registrarPago` deja el evento `pago_confirmado` con el correo del admin como actor. 5 pruebas nuevas en `tests/23-pago-avisos.test.ts` (la ruta `confirmar-solicitud` no tiene prueba de ruta porque la BD falsa no tiene `solicitudes_pago`; se probó la variante por la plantilla). Sigue pendiente que el botón "Ir a mi portal" no lleva llave de acceso (se arregla en el 3.1). Suite: 249 pruebas, 21 fallan, sin fallos nuevos.
    A. Solicitud al compita: HECHO (2026-11-03). `app/api/solicitudes/route.ts` ahora usa `notificar()`: Telegram primero y con registro; si no se entrega, el correo de respaldo sale en ese momento y queda enlazado (`respaldo_de`); el admin recibe el aviso de lo que falló. Cambio de comportamiento: ya no salen el correo y Telegram a la vez. La plantilla `solicitud_nueva` ahora tiene Telegram y correo (el armado del correo salió de `lib/resend.ts` a `armarSolicitudCompita`, sin cambiar su contenido). `responderSolicitud` anota la acción (`registrarAccion`) y el evento (`solicitud_aceptada` o `solicitud_rechazada`); al crear se registra `solicitud_creada`. 7 pruebas nuevas en `tests/22-solicitud-avisos.test.ts`. La BD falsa tiene ahora `eventos` y `registrar_evento`. Suite: 244 pruebas, 21 fallan (una de las 22 previas pasa ahora porque el aviso al admin usa el texto que esa prueba esperaba), sin fallos nuevos.
1.5 Escalera de respaldo del compita: correo si Telegram falla o no actúa, luego tarea en la Bandeja.
1.6 Registro de la etapa del cliente y desde cuándo (columna nueva aditiva).

## Fase 2. Admin nuevo, al lado del actual

2.1 Ruta nueva solo para admin con la Bandeja sobre datos reales: pagos por confirmar, emergencias, avisos fallidos, entrevistas sin decisión.
2.2 Seguimiento por etapas con el semáforo y los umbrales como ajuste.
2.3 Personas (compitas y clientes) con vistas, orden y paginación en servidor.
2.4 Visitas con "Con problema" y su motivo.
2.5 Más: reseñas, postulaciones, pagos, avisos enviados, cobertura y ajustes.
2.6 Cuando iguale al admin actual, se redirige y se retira el viejo.

## Fase 3. Acceso y portal del cliente

3.1 Arreglar el ciclo de login: sesión larga, recordar el destino, cuenta atrás visible y código de 6 números.
3.2 Portal nuevo con 4 secciones (Inicio, Visitas, Mi familiar, Mi plan) en ruta nueva.
3.3 Elegir compita y flujo de la visita según la decisión de 0.4.
3.4 Ayuda por paso con la escalera de tres intentos.
3.5 Cuando iguale al dashboard actual, se redirige y se retira el viejo.

## Fase 4. El compita en Telegram

4.1 "¿Qué me toca?" y `/ayuda` contextual.
4.1b "Hablar con el equipo": mensajes del compita al admin y respuesta desde el portal (depende de 1.3).
4.2 Botones únicos por aviso y mensajes que se editan al responder.

## Fase 5. Escala y lanzamiento

5.1 Quitar la recarga de 15 s del portal, caché de la cobertura, índices y paginación en servidor.
5.2 Prueba de carga con datos falsos.
5.3 Copias de seguridad con restauración probada y base de desarrollo separada (ver `CLAUDE.md`, sección 6).
5.4 Limpiar datos de prueba (clientes de prueba, pagos simulados).
5.5 Bloquear o quitar `app/prototipo/` antes de publicar.
5.6 Stripe y lista de seguridad de `CLAUDE.md`.

## Hallazgos pendientes (2026-11-03)

1. ARREGLADO (2026-11-03, decisión del usuario: censurar como en el chat). El filtro de teléfonos y correos (`lib/chat-moderacion.ts`) solo se aplicaba en el chat de la visita. Los textos libres de la solicitud (`mensaje` y `sobre_cliente`) llegaban al compita sin filtrar, y el texto de los horarios sugeridos por el compita (`mensaje_compita_reagendar`) llegaba al cliente sin filtrar. Ahora ambos se censuran antes de guardarse y de enviarse, se crea una alerta en Atención (`admin_flags`) y se avisa al admin por Telegram, con la nueva `reportarContactoEnTexto`. Cambios en `app/api/solicitudes/route.ts`, `app/api/telegram-webhook/route.ts` y `lib/chat-moderacion.ts`. Pruebas en `tests/21-contacto-solicitud.test.ts` (5, comprobado que fallan sin el arreglo). Sigue pendiente la auditoría completa de otros posibles caminos de fuga (nombres completos, fotos, enlaces).
2. Hoy, al crear una solicitud, el compita recibe el correo y el mensaje de Telegram a la vez. Contradice la regla 2 del ciclo (no avisar por dos canales desde el primer minuto). Se corrige al migrar el flujo.
3. La suite tiene 22 pruebas que ya fallaban en el código publicado (una espera rechazar un horario a 5 minutos y lo acepta, parece depender de la hora). Pendiente de investigar.
4. La tabla `resenas` da permiso denegado a la clave de servicio; podría estar rompiendo la aprobación de reseñas del admin. Sin confirmar.

## Revisión de lo hecho (2026-11-03)

Hallazgos de revisar el trabajo de la Fase 1 y su corrección:
1. CORREGIDO: el filtro de contactos solo detectaba teléfonos venezolanos y +58; un cliente en Miami, Madrid o Bogotá podía escribir su número ("+1 305 555 1234", "(305) 555-1234", "3055551234") y llegaba entero al compita. Ahora detecta rachas de 9 a 15 dígitos con cualquier formato y también el correo escrito con palabras ("nombre arroba gmail punto com"). Afecta también al chat de la visita, que usaba el mismo filtro.
2. CORREGIDO: el filtro "censuraba" solo los últimos 4 dígitos ("0414 123****") y dejaba legible la mayor parte del número, no por completo como se pidió. Ahora reemplaza el número completo por "[teléfono eliminado]". 20 pruebas en `tests/25-moderacion-contactos.test.ts`, incluidos 7 textos normales que no deben tocarse (edades, años, fechas, precios).
3. CORREGIDO: 7 errores de lint en el prototipo (comillas sin escapar y un efecto que cambiaba el estado), que podían romper una compilación al unir la rama.
4. LÍMITE CONOCIDO: un número escrito con palabras ("cero cuatro uno cuatro...") no se detecta. Ningún filtro de texto lo resuelve del todo; la defensa de fondo es el aviso a los administradores y los términos de uso.
5. RIESGO ABIERTO, importante: desde el flujo A, un compita con Telegram activo ya no recibe el correo a la vez. Hasta que exista la escalera (paso 1.5), si no ve el mensaje de Telegram no hay respaldo. No se debe llevar el paso 1.4 a producción sin el 1.5.
6. RIESGO ABIERTO: si el servidor se cae entre guardar un aviso y enviarlo, queda "pendiente" para siempre. El proceso de la escalera (1.5) debe barrer los avisos pendientes de más de unos minutos y despacharlos.
7. Pendiente: la ruta `confirmar-solicitud` no tiene prueba de ruta (la BD falsa no tiene `solicitudes_pago`).

## Cómo se trabaja cada paso

1. Se explica qué se hará y qué se toca.
2. Se construye en la rama `rediseno`.
3. Se prueba y se verifica que lo viejo sigue funcionando.
4. Commit. El push solo cuando el usuario lo pida.
