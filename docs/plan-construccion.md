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
    C. Pregunta de contratar tras la entrevista: HECHO (2026-11-03). El webhook de Daily (`app/api/webhooks/daily/route.ts`) envía con `notificar()` el correo al cliente (plantilla `llamada_terminada_cliente`, variantes normal y llamada corta) y el Telegram al compita (`llamada_terminada_compita`), con el texto que ya usaba. Quedan registrados (paso 10; el correo espera la decisión 2 h), un fallo se reintenta, y el admin sigue recibiendo su alerta si el correo no sale. La clave de idempotencia incluye la sala, para que tras reconectar la llamada completa tenga su propio aviso (una prueba existente, `tests/08-recorridos`, lo detectó). `resultado-llamada` anota la acción (paso 10) y el evento `decision_contratar` (contratar, reagendar o no_contratar); el webhook registra `entrevista_terminada` con la duración. Si el cliente ya decidió, un reintento se cancela. 7 pruebas nuevas en `tests/24-llamada-avisos.test.ts`. Suite: 256 pruebas, 21 fallan, sin fallos nuevos. CORRECCIÓN (2026-11-03, tras leer `app/api/cron/seguimiento` y `lib/solicitudes.ts`): sí existe un respaldo por reloj, pero es lento y de varios pasos. 25 min después del horario el cron pregunta "¿ocurrió la llamada?" a AMBAS partes, y la pregunta de contratar solo sale cuando los dos confirman o pasan 4 horas sin que nadie diga que no. Si el compita no confirma (se confundió con Telegram), el cliente espera 4 horas. Esa es la causa probable de lo ocurrido en la prueba, más precisa que "depende de Daily". Arreglo propuesto: al pasar el horario más 25 minutos, preguntar al cliente directamente, sin esperar al compita ni las 4 horas. Tampoco se pregunta el motivo cuando el cliente dice que no.
    B. Pago confirmado al cliente: HECHO (2026-11-03). `app/api/admin/registrar-pago` y `app/api/admin/confirmar-solicitud` usan `notificar()` con la plantilla `pago_confirmado` (las dos variantes de texto de antes, conservadas). El aviso queda registrado (paso 12), un fallo del correo se puede reintentar, y un pago anulado no se confirma (el aviso se cancela). `registrarPago` deja el evento `pago_confirmado` con el correo del admin como actor. 5 pruebas nuevas en `tests/23-pago-avisos.test.ts` (la ruta `confirmar-solicitud` no tiene prueba de ruta porque la BD falsa no tiene `solicitudes_pago`; se probó la variante por la plantilla). Sigue pendiente que el botón "Ir a mi portal" no lleva llave de acceso (se arregla en el 3.1). Suite: 249 pruebas, 21 fallan, sin fallos nuevos.
    A. Solicitud al compita: HECHO (2026-11-03). `app/api/solicitudes/route.ts` ahora usa `notificar()`: Telegram primero y con registro; si no se entrega, el correo de respaldo sale en ese momento y queda enlazado (`respaldo_de`); el admin recibe el aviso de lo que falló. Cambio de comportamiento: ya no salen el correo y Telegram a la vez. La plantilla `solicitud_nueva` ahora tiene Telegram y correo (el armado del correo salió de `lib/resend.ts` a `armarSolicitudCompita`, sin cambiar su contenido). `responderSolicitud` anota la acción (`registrarAccion`) y el evento (`solicitud_aceptada` o `solicitud_rechazada`); al crear se registra `solicitud_creada`. 7 pruebas nuevas en `tests/22-solicitud-avisos.test.ts`. La BD falsa tiene ahora `eventos` y `registrar_evento`. Suite: 244 pruebas, 21 fallan (una de las 22 previas pasa ahora porque el aviso al admin usa el texto que esa prueba esperaba), sin fallos nuevos.
1.5a HECHO (2026-11-03): la pregunta de contratar por reloj. `getSolicitudesParaSeguimiento` (lib/solicitudes.ts) ahora pregunta al cliente cuando él confirmó la llamada y el compita no respondió, 45 min después del horario (Caso C, nuevo), y el tiempo de espera cuando nadie responde bajó de 4 horas a 90 minutos. El cliente es quien decide; ya no depende de que el compita toque su botón. 6 pruebas en `tests/26-seguimiento-reloj.test.ts` (3 de ellas fallan sin el cambio). Suite: 282 pruebas, 21 fallos previos, ninguno nuevo. Esta pregunta sigue enviándose con el correo antiguo del cron (sin `notificar()`); migrarla queda pendiente.
1.5 HECHO (2026-11-03): la escalera de respaldo. `lib/escalera.ts` (`procesarEscalera`), cron `app/api/cron/escalera-avisos` y función de Netlify `netlify/functions/escalera-avisos.mts` (cada 5 minutos; registrada también en la vigilancia de crons de `lib/cron.ts`). Hace tres cosas: (1) despacha avisos que quedaron "pendiente" más de 3 minutos (el servidor se cayó entre guardar y enviar); (2) reintenta los fallidos por causas pasajeras, hasta 3 intentos, sin repetir los permanentes (sin Telegram, sin correo) y sin duplicar si el respaldo ya salió; (3) escala los enviados sin acción cuyo plazo venció: primero un respaldo por correo con asunto "Recordatorio: ...", y si tampoco hay acción, una tarea para el equipo (alerta en Atención con `reportado_por` "escalera automática" y aviso al admin). Reglas: solicitud al compita, respaldo por correo y tarea a las 18 h más; pregunta de contratar al cliente, recordatorio por correo y tarea a las 22 h más. Es idempotente (marca con clave única), cancela lo que ya no aplica y deja de vigilar lo que ya escaló. 18 pruebas en `tests/27-escalera.test.ts`. Suite: 300 pruebas, 21 fallos previos, ninguno nuevo. La función de Netlify solo existirá cuando se publique. Pendiente: el aviso de "Pago por confirmar" al admin no pasa por la escalera, y la retención de 90 días de `avisos` aún no tiene su limpieza.
Detalle original del paso 1.5: escalera de respaldo del compita: correo si Telegram falla o no actúa, luego tarea en la Bandeja.
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

## 3.1 Ciclo de login: HECHO (2026-11-03)

Causa confirmada contra Supabase real (con un usuario desechable que se borró): `generateLink` devuelve junto al enlace un código de 8 dígitos (no 6), y **cada enlace nuevo invalida el anterior**, también el código. Eso, más el límite silencioso de 1 por minuto y que el navegador interno de la app de correo no comparte la sesión, producía el ciclo.
1. Recordar el destino: el middleware manda a `/login?returnTo=<ruta con su consulta>` a quien entra sin sesión a `/dashboard`, `/compitas`, `/pago` o `/admin` (antes caía en un login que olvidaba a dónde iba). Solo rutas internas (`rutaInterna`).
2. Entrar directo: `/login` es ahora una página de servidor; con sesión redirige a donde iba o al portal (admin a `/admin`), sin pedir el correo.
3. Espera visible: `solicitar-acceso` devuelve `espera` (segundos) siempre, exista o no el correo, así que no revela quién existe; la pantalla muestra la cuenta atrás y, si ya se había enviado uno, lo dice ("Ya te enviamos un correo hace un momento").
4. Código numérico: el correo de acceso trae el código además del botón (mismo token que el enlace) y dice "usa siempre el correo más reciente". Nueva ruta `POST /api/auth/verificar-codigo` (`verifyOtp` con correo y código, `type: email`), mismo destino y mismas reglas que `/auth/confirm` (activa la cuenta, bloqueados y no invitados no entran, `returnTo` solo interno). Límite: 5 fallos por correo y 30 intentos por IP en 15 minutos (`lib/limite.ts`, sobre `telegram_estados`). La pantalla pide el código en un campo de un toque.
5. Sesión larga: no hizo falta código. La sesión de Supabase ya es larga; lo que fallaba era entrar desde otro navegador. Para revisar en el panel de Supabase: Authentication, ajustes de sesión (tiempo máximo e inactividad) y la longitud del código por correo (hoy 8).
6. Pruebas: 17 nuevas en `tests/29-login-codigo.test.ts` (comprobado que las de límites fallan sin ellos). La base falsa de autenticación ahora imita a Supabase real: un enlace nuevo invalida el anterior y el código es de 8 dígitos. Se actualizaron 4 pruebas existentes por el campo nuevo `espera` y el texto "vencen". Suite: 329 pruebas, 21 fallos previos, ninguno nuevo. Verificado en el navegador a 375 px: sin scroll lateral y con cuenta atrás.
7. PENDIENTE: el correo de pago ("Ir a mi portal") sigue llevando a `/dashboard` sin llave: ahora, sin sesión, cae en `/login?returnTo=/dashboard`, el cliente pide el correo y entra con el código o el enlace, y llega a `/dashboard`. El ciclo está roto, pero el correo con el correo ya escrito (código opaco en la dirección, sin datos personales) queda para después.
8. Falta probar el flujo completo con un correo real (envío con Resend y código real) desde el navegador, que no se hizo para no enviar correos a usuarios de prueba.

## Motivo cuando dicen que no: HECHO (2026-11-03)

Dato prioritario 2 de `docs/crm-datos-pendientes.md`. Opcional y de un toque; queda como evento (`motivo_no_contratar` del cliente y `motivo_rechazo` del compita) con el motivo en `datos`. No requirió migración.
1. Cliente: al decir que no tras la entrevista (correo de `resultado-llamada` o de `seguimiento`) llega a una pantalla `/api/solicitud/motivo` con 5 opciones (no conecté, precio, prefiero otro compita, más tiempo, otro) y una salida "Omitir" hacia los compitas. Cada botón hace POST, así un escáner de enlaces no registra nada, y el enlace va firmado por rol.
2. Compita: al rechazar una solicitud en Telegram recibe 4 botones (sin tiempo, zona lejos, horarios, otro) y un toque lo guarda.
3. Se guarda una sola vez por solicitud y rol; un código inventado se rechaza; otro compita no puede anotar en una solicitud ajena.
4. Código: `lib/motivos.ts`, `app/api/solicitud/motivo/route.ts`, y cableado en `resultado-llamada`, `seguimiento` y el webhook de Telegram. 12 pruebas en `tests/28-motivos.test.ts` (4 fallan sin el cableado). Suite: 312 pruebas, 21 fallos previos, ninguno nuevo.
5. Pendiente: verlo en el admin (Más, una vista de motivos agrupados) llega con la Fase 2; hoy se lee en la tabla `eventos`.

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
5. RESUELTO con el paso 1.5 (2026-11-03): un compita con Telegram activo ya no recibe el correo a la vez, pero ahora la escalera le manda el correo de respaldo si no responde en 6 horas. El paso 1.4 y el 1.5 deben ir juntos a producción.
6. RESUELTO con el paso 1.5: la escalera despacha los avisos "pendiente" de más de 3 minutos.
7. Pendiente: la ruta `confirmar-solicitud` no tiene prueba de ruta (la BD falsa no tiene `solicitudes_pago`).

## Cómo se trabaja cada paso

1. Se explica qué se hará y qué se toca.
2. Se construye en la rama `rediseno`.
3. Se prueba y se verifica que lo viejo sigue funcionando.
4. Commit. El push solo cuando el usuario lo pida.

## Reglas heredadas y fricción: decisiones (2026-11-04)

El usuario pidió revisar reglas que se pusieron por intuición y quitar o relajar lo que estorbe ("cero fricciones"). Se decide punto por punto.

1. CERRADO: contratación directa sin entrevista. La solicitud tendrá dos tipos (`tipo` en `solicitudes`: 'entrevista' por defecto, o 'directa'; columna aditiva). El cliente ve en el perfil "Hablar primero" o "Contratarlo directo". En la directa no hay horarios ni sala: el compita recibe en Telegram "quiere contratarte directamente" con Aceptar o No puedo. Si acepta, el cliente paga (pago existente) y empiezan las visitas; si rechaza, el cliente elige a otro sin haber pagado. DECISIÓN CLAVE: el compita acepta ANTES de que el cliente pague. La confianza que da la entrevista se sustituye con el perfil (video, calificación, reseñas), la primera hora de regalo y la política de reembolso de `lib/planes.ts`. El camino de la directa se salta los pasos de entrevista del ciclo (unos 9 pasos en vez de 16). Pendiente de construir.

2. EN DISCUSIÓN (2026-11-04): qué se desbloquea al pagar y seguridad del compita. Decidido: la foto, el video y las reseñas del compita se ven antes de pagar (son lo que reemplaza a la entrevista); antes del pago el cliente ve el primer nombre y la INICIAL del apellido del compita, y el nombre completo tras el pago. Hallazgos de revisar qué ve el compita del cliente (verificado en el código): (a) en la solicitud, el compita recibe el nombre COMPLETO del cliente y lo que escribió sobre su familiar, antes de cualquier pago; (b) con la asignación (`asignar-rapido`) recibe nombre, edad, condición y notas del familiar; (c) en los avisos de visita recibe el nombre completo del cliente; (d) el correo del cliente solo va al admin (emergencia, entrevista confirmada), no al compita; (e) NO existe un campo de dirección en el modelo de datos: la dirección de la visita se coordina por el chat de texto libre, que se guarda sin límite, sin control de cuándo se comparte y sin que el filtro de contactos la cubra; (f) herramientas de seguridad del compita hoy: botón de emergencia (avisa al admin y solo con visita en curso), terminar visita, alerta al admin si la visita no empieza 30 minutos tarde; no existe: aviso si la visita se alarga, salida de la visita "no me siento seguro" sin penalización, reporte o bloqueo de un cliente por el compita, ni dirección estructurada que solo se libere con pago confirmado y visita confirmada. Pendiente decidir el paquete de medidas.
