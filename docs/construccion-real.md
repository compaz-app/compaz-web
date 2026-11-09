# Del prototipo al sistema real: auditoría de viabilidad (2026-11-09)

Regla de partida (permanente): nada del prototipo es decoración. Cada pantalla y cada botón debe poder construirse con datos y servicios reales. Este documento compara cada función nueva del prototipo con lo que existe hoy en el código y dice qué hay que construir, con qué datos y con qué riesgos. Todas las migraciones son ADITIVAS (la base es compartida entre local y producción).

Leyenda de estado: EXISTE (ya funciona), EXTENDER (hay base, falta añadir), NUEVO (se construye de cero). Tamaño: S (horas), M (1 a 3 días), L (más de 3 días).

## 1. Hechos del sistema real que condicionan el diseño

1. El chat cliente y compita exige una visita en estado `pre_visita`, `programada` o `en_curso` (`app/api/send-message`). No existe chat durante la etapa de entrevista ni antes de contratar. Las funciones "escribirle al compita" del prototipo solo valen con una visita ya creada.
2. Telegram limita `callback_data` a 64 bytes. Los botones del bot deben llevar ids cortos y resolver el resto en el servidor.
3. Las fotos de Telegram se guardan hoy como `tg:<file_id>`. Telegram NO permite borrar esos archivos de sus servidores. La promesa de "se borra a los 90 días" no se puede cumplir con `file_id`: hay que COPIAR la foto a un almacenamiento privado nuestro (con enlaces firmados) y borrar esa copia, sin conservar ni mostrar el `file_id`.
4. La sala de videollamada se abre en una pestaña nueva con la página de Daily (`window.open`). Allí no se puede mostrar nuestra cuenta atrás ni el aviso de los 20 minutos. Para tenerlos hay que incrustar la sala en nuestra página `/sala` (la política CSP ya permite `*.daily.co`).
5. `api/visita/cancelar` BORRA la visita. Para registrar cancelaciones y verlas como patrón hay que dejar de borrar.
6. Los precios, plazos y topes están en el código (`lib/planes.ts` y constantes sueltas). Ajustes necesita una fuente única en base de datos con respaldo en el código.
7. No existen: dirección estructurada por cita, contacto en el sitio, personas presentes, tipo de solicitud (directa), zona horaria del usuario, reservas de horario, fotos privadas, bloqueos entre compita y cliente.
8. Ya existen y se reutilizan: tabla `eventos` inmutable y `registrar_evento` (Registro de actividad, cancelaciones, términos), `avisos` con escalera y respaldo, `admin_flags` (tareas de la Bandeja), `telegram_estados`, filtro de contactos, `limpieza` diaria.

## 2. Auditoría por función

### Cliente

| Función del prototipo | Hoy | Qué construir | Datos (aditivo) | Tamaño |
|---|---|---|---|---|
| Formulario nuevo: Hablar primero, Contratarlo directo, Mandado; qué necesita; nota 300; lugar privado; quién más estará; foto opcional | La solicitud pide mensaje de 1.500 y 1 a 3 horarios | Nuevo formulario y nueva validación en `api/solicitudes`; la directa no crea sala | `solicitudes.tipo`, `que`, `lugar_privado`, `personas_en_lugar` (lista de tipos), `foto_cliente` | M |
| "Quién más estará" obligatorio con salida "Nadie más" | No existe | Validar en el SERVIDOR (no solo bloquear el botón) | Va en la columna anterior | S |
| Cambio de personas tras aceptar, con aviso al compita y espera proporcional | No existe | Ruta para editar la lista con evento y aviso por `notificar`; tarea si no responde (la espera sale de Ajustes) | `visitas.personas_en_lugar`, evento `lugar_personas_cambiadas` | M |
| Elegir horario de entrevista entre horas libres del compita, con reserva y confirmación | El cliente propone 1 a 3 horarios y el compita elige | Partir `horarios_disponibles` (día, inicio, fin) en bloques de 20 min, restar los ya reservados, reservar con restricción única, mostrar hora local y de Caracas | tabla `reservas_horario` (compita, inicio, solicitud, estado, vence) con índice único por compita e inicio; `usuarios.zona_horaria` | L |
| Pago en revisión, "¿No recibiste el correo?", contactar a Compaz | El cliente dice "ya pagué" y la solicitud se registra | Admin confirma el pago (Telegram y Bandeja), portal muestra el estado, reenvío con clave nueva, insistencia sube a URGENTE | `solicitudes_pago.insistido_en`, `estado`; evento `pago_insistido` | M |
| Ficha obligatoria con consentimiento y bloqueo de agendar | Perfil familiar sin obligatoriedad | Pantalla, validación en el servidor y etapa `ficha` | `usuarios.etapa`, `etapa_desde`; ficha con nombres de personas presentes; evento `terminos_aceptados` | M |
| Agendar visita con dirección por cita, cómo entrar, quién abre, contacto en el sitio | `api/visita/fecha` sin dirección | Capturar y guardar por cita; el teléfono del contacto solo lo ve el admin | `visitas.direccion`, `indicaciones`, `quien_abre`, `contacto_nombre`, `contacto_tel` | M |
| Cancelar o cambiar gratis hasta 24 h antes; después cuenta como usada | Borra la visita | Estado `cancelada` o tabla de cancelaciones, quién, cuándo, horas de aviso, motivo, justificada | tabla `cancelaciones`; evento `visita_cancelada` | M |
| Llegada con foto visible y nadie abre con cuenta atrás | No existe | Foto de llegada, aviso inmediato al cliente, cronómetro de 30 min en el portal | `visitas.llegada_en`, `llegada_foto`, `sin_acceso_en` | M |
| Videollamada posterior al pago (mensaje de video, voz, video) sin límite de veces | Solo entrevista y llamada de visita | Pedir, aceptar o proponer hora, sala por llamada con su corte | tabla `llamadas` (visita, tipo, estado, sala, duración) | L |
| Chat con el compita desde "Mis visitas" con filtro de contactos | Existe con visita activa | Reutilizar y mostrar el botón solo si hay visita | ninguno | S |
| Advertencia antifraude en 8 lugares con texto editable | No existe | Componente único y plantilla de correo y Telegram leyendo de Ajustes | Ajustes | S |

### Compita en Telegram

| Función | Hoy | Qué construir | Datos | Tamaño |
|---|---|---|---|---|
| Solicitud con foto, qué se hará, lugar privado y personas presentes | Recibe nombre completo y texto libre | Plantilla nueva en `plantillas-aviso`; foto del cliente por Telegram | usa columnas de solicitud | M |
| Contratación directa: aceptar o no puedo antes del pago | No existe | Flujo en el webhook; rechazo con motivo de un toque (ya existe) | `solicitudes.tipo` | M |
| Confirmar o rechazar horario reservado | Elige entre los horarios del cliente | Botones sobre la reserva; al rechazar se libera y se avisa al cliente | `reservas_horario` | M |
| Dirección 3 horas antes y "Voy en camino" | No existe | Cron nuevo, lee de Ajustes | campos de dirección de la visita | M |
| Llegué con foto obligatoria, iniciar, nadie abre y cierre sin acceso | Iniciar y confirmar existen | Ampliar el bot: pedir la foto, copiarla a almacenamiento privado, cronómetro de 30 min, tareas a los 5 y 15 min | `visitas.llegada_*`, eventos `llegada_registrada`, `llegada_sin_acceso`, `visita_sin_acceso` | L |
| "No me siento seguro", "¿Todo bien?", emergencia en todos los teclados | Emergencia solo con visita activa | Botón nuevo, cron de 15 min después del fin, alertas urgentes | eventos `salida_por_seguridad`, `visita_alargada`; tipos de tarea | M |
| "Tengo una duda" con respuestas automáticas y escalada tras 2 intentos | No existe | Menú con ids cortos; cada toque registra un evento; tarea solo si no se resuelve | evento `duda_compita` con tipo | M |
| "¿Qué me toca?" con contexto | Lista botones pendientes | NO guardar el texto de la última pulsación: derivar la situación del ESTADO REAL (solicitud, reserva, visita, llegada) en el momento de preguntar | ninguno | M |
| Reportar problema con un cliente y "no volver con este cliente" | No existe | Motivos de un toque, bloqueo compita-cliente | tabla `bloqueos_compita_cliente` | M |

### Administrador

| Función | Hoy | Qué construir | Datos | Tamaño |
|---|---|---|---|---|
| Bandeja con tipos nuevos (nadie abre, inseguro, alargada, ficha, cambio en el lugar, cancelación tardía, duda sin resolver, pago urgente) | `admin_flags` genérico | Tipo y prioridad en cada tarea, cronómetros, orden por urgencia | `admin_flags.tipo`, `prioridad`, `vence_en` | M |
| Ajustes como fuente única con vigencia, historial y límites | Valores en el código | Tabla, `lib/ajustes.ts` con respaldo, y migrar todos los consumidores | tabla `ajustes` e `ajustes_historial` | L |
| Personas: cancelaciones, semáforo y filtros con "?" | Existe una versión anterior | Columnas calculadas desde `cancelaciones`, vista de compitas con métricas | vistas SQL o consultas | M |
| Registro de actividad | `eventos` ya es inmutable | Registrar cada consulta de teléfono y cada "justificada" con quién y cuándo | `eventos` | S |
| Estado del sistema y dudas por tipo | Latidos de crons existen (`cron:*`) | Pantalla que lee latidos, `avisos` fallidos y eventos de dudas; chequeo de salud de Telegram, correo y Daily | ninguno | M |
| Pago: confirmar con un toque en Telegram | Registrar pago desde el panel | Botón en el aviso del admin, solo para el chat del admin | ninguno | S |

### Transversales

| Función | Hoy | Qué construir | Tamaño |
|---|---|---|---|
| Fotos privadas con retención de 90 días | `tg:<file_id>` | Bucket privado, enlace firmado, copia desde Telegram, borrado en `limpieza` con evento `foto_borrada`, aviso a cliente y compita | M |
| Sala de Daily incrustada con cuenta atrás, aviso a los 20 min y corte a los 23, en español | Pestaña nueva de Daily | Incrustar en `/sala`, leer tiempos de Ajustes, `lang: es` ya está | M |
| Aceptación de términos con versión y fecha | No existe | Pantalla, evento `terminos_aceptados`, borrador legal y `/privacidad` | M |
| Detección de contactos: aviso previo y alerta a la 2ª detección | Alerta en cada detección | Contar eventos `contacto_bloqueado` por persona en 30 días | S |
| Husos horarios con las dos horas visibles | Todo en hora de Venezuela | `lib/zonas.ts` y pruebas en cambios de horario de verano | M |

## 3. Lo que en el prototipo NO es viable tal cual

1. **"Compaz le escribe al contacto en el sitio a los 5 y 15 minutos" (nadie abre).** No hay proveedor de WhatsApp o SMS contratado. En la primera versión es una TAREA con cronómetro en la Bandeja y el administrador escribe a mano. El automático llega después. La pantalla del cliente y del compita debe prometer solo "el equipo avisa al contacto", sin decir que es automático.
2. **Cuenta atrás y aviso de 20 minutos en la videollamada.** Imposible mientras la sala se abra en la página de Daily. Exige incrustarla (ver hecho 4).
3. **"Las fotos se borran a los 90 días."** Imposible con `file_id` de Telegram (ver hecho 3). Exige copiar la foto a almacenamiento propio.
4. **"¿Qué me toca?" con una frase guardada por botón.** Se desincroniza apenas algo cambia por otro lado. Hay que calcularla del estado real.
5. **Resumen de dudas con porcentajes.** Las cifras del prototipo son inventadas; el resumen real solo existe cuando cada toque del menú se registra como evento desde el primer día.
6. **Entrevista y chat.** "Escribirle al compita" solo funciona con una visita creada; en la etapa de entrevista no hay chat.
7. **Elegir horarios libres.** El compita hoy solo tiene franjas semanales. Sin reservas y sin restricción única dos clientes pueden tomar el mismo bloque.

## 4. Orden de construcción propuesto

Cada lote termina con pruebas en verde, verificación de que lo viejo sigue funcionando, commit local y migraciones aplicadas por ti. Sin push hasta que lo pidas.

**Lote 1, cimientos (sin cambiar lo que ve el usuario):** tabla y librería de Ajustes con respaldo en el código; tipos de evento nuevos; tabla de cancelaciones y dejar de borrar visitas; campos de dirección, personas y llegada en visitas y solicitudes; almacenamiento privado de fotos con retención; tipo y prioridad en las tareas.

**Lote 2, entrada del cliente:** formulario nuevo con validación en el servidor, contratación directa, confirmación de pagos por el admin, ficha obligatoria con términos, cuatro frenos de seguridad ya decididos (2 detecciones, antifraude en los textos).

**Lote 3, agenda:** horas libres del compita, reservas con restricción única, confirmación o rechazo, husos horarios, cancelaciones con la regla de 24 horas, cambio de personas con su aviso.

**Lote 4, la visita:** dirección 3 horas antes, llegada con foto, nadie abre con cronómetro y tareas, "no me siento seguro", "¿todo bien?", ayuda automática con eventos, "¿qué me toca?" derivado del estado.

**Lote 5, llamadas y administración:** sala incrustada con cuenta atrás, llamadas posteriores al pago, Bandeja completa, Personas con cancelaciones, Estado del sistema, Registro de actividad.

## 5. Decisiones

Resueltas por el usuario (2026-11-09):
1. Reserva de un horario sin confirmar: 2 horas (ajuste `reserva_horario_horas`). La reserva nunca dura más allá de la hora de la cita: si la cita es en menos de 2 horas, la reserva vence al llegar la hora.
2. Anticipación mínima para pedir una entrevista: sin mínimo (ajuste `entrevista_anticipacion_horas` en 0). Riesgo aceptado: una entrevista pedida para dentro de pocos minutos casi nunca llega a confirmarse; el sistema debe liberar la hora y avisar al cliente apenas venza la reserva.
3. Horas libres del compita: se cargan en su página de perfil actual (bloques de 20 minutos).
4. Nadie abre en la primera versión: manual desde la Bandeja, con tareas y cronómetro a los 5 y 15 minutos; sin WhatsApp ni SMS por ahora.

Siguen abiertas:
5. Texto legal de términos y privacidad (borrador a aprobar). Bloquea el cierre de la ficha con términos (Lote 2) pero no el resto.
6. Si el equipo nunca llama o solo no pide datos por teléfono (afecta textos como "Llamar al compita y decidir").

## 6. Seguridad de los permisos de administración (diseño, 2026-11-09)

Estado hoy: las 25 rutas de `app/api/admin` usan `getAdminUser()`, que solo responde si el correo está en `ADMIN_EMAILS` (sí o no, sin matices). `asignar-rapido` usa un enlace de un solo uso, no sesión. Las páginas de `/admin` usan `requireAdmin`. No hay roles ni permisos. PELIGRO: dar acceso a un colaborador agregándolo a `ADMIN_EMAILS` le da el 100 %.

Diseño (todo prohibido por defecto):
1. `lib/permisos.ts`: `requierePermiso(permiso)` para rutas y `requierePermisoPagina(permiso)` para páginas. Administrador (correo en `ADMIN_EMAILS`) pasa siempre. Colaborador pasa solo si su permiso está activo en `equipo_permisos` en ese momento (caché de máximo 30 segundos y se limpia al cambiar un permiso). Si no, 403 y evento `acceso_denegado`.
2. Mapa único ruta a permiso. Una prueba estática recorre `app/api/admin/**/route.ts` y falla si una ruta no usa `requierePermiso`. `getAdminUser` pasa a uso interno.
3. `ADMIN_EMAILS` queda como raíz inmutable (no se edita desde el panel, evita quedar sin acceso). Los colaboradores viven en la tabla `equipo`, nunca en esa variable.
4. Datos sensibles (chat, teléfonos): rutas que exigen permiso Y motivo; anotan el acceso en `eventos` (`consulta_dato_sensible`) ANTES de devolver el dato; sin motivo no devuelven nada; a quien no tiene permiso ni se le envían los campos.
5. Matriz de pruebas generada desde el mapa: cada ruta contra anónimo, colaborador sin permiso, colaborador con permiso y administrador.
6. Cambiar permisos solo lo hace un administrador, con historial de solo inserción; desactivar a un colaborador le corta el acceso de inmediato.
7. A revisar: `asignar-rapido` (enlace de un solo uso), las páginas de servidor, y la política de lectura en vivo de `admin_flags` (hoy por correo de administrador en la base): los colaboradores necesitan otra vía.
8. Orden: se construye ANTES de invitar a un colaborador real. Tamaño mediano.


> Estado 2026-11-09: la guardia de permisos del servidor (sección 6) está construida y probada. Ver docs/plan-construccion.md. Pendiente aplicar la migración 20261109c_equipo.sql.
