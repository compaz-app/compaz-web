# Punto 2: qué ve cada parte, seguridad del compita y datos del cliente

Especificación final de lo decidido con el usuario el 2026-11-04. Reemplaza las notas sueltas del plan sobre este punto. Estado: DECIDIDO salvo lo marcado como "pendiente".

## 1. Qué ve cada parte y cuándo

Antes de pagar (el compita acepta ANTES del pago, decisión del punto 1):
1. El cliente ve del compita: foto, video, calificación, reseñas, primer nombre y la INICIAL del apellido, y la zona general. Nada de contacto.
2. El compita ve del cliente al decidir: primer nombre, foto (si la hay), qué se hará, cuándo, si el lugar es privado, QUIÉN más estará en el lugar, solo el tipo de cada persona (familiar, amigo, vecino, persona que cuida o ayuda, otra), por la seguridad del compita; los nombres se piden en la ficha tras pagar y datos generales del familiar (edad aproximada, condición general). Hoy ve el nombre COMPLETO y el texto libre sobre el familiar: debe cambiar.

Tras pagar y confirmar la cita:
3. El cliente ve el nombre completo del compita.
4. El compita ve el nombre completo del cliente y la ficha del familiar. La zona de la cita sí; la dirección exacta le llega 3 HORAS antes, por Telegram y no por el chat.

Nunca: teléfono, correo ni Telegram de una parte para la otra. Los teléfonos del cliente y del contacto en el sitio los ve solo el admin.

## 2. Servicio con modelo general

No hay lista de tipos de servicio. Al pedirlo se dan: qué se hará, cuándo, dónde (lugar, punto de encuentro o casa del familiar) y quién más estará presente (opcional). Una pregunta de seguridad: "¿El compita estará en una casa u otro lugar privado?". Si es sí, se piden y se liberan con pago y cita confirmados: dirección, cómo entrar, quién abre y contacto en el sitio.

Dos niveles (propuesta para el diseño de datos, pendiente de confirmar):
1. La solicitud de contratación lleva una descripción corta y la pregunta "lugar privado".
2. Cada cita (visita) lleva el detalle: cuándo, dónde exacto, contacto en el sitio. Se captura al concretar la cita (hoy en `app/api/visita/fecha`). Se pueden guardar lugares para reutilizarlos.

## 3. Fotos

1. Foto del cliente: opcional, con la nota "Tu foto es opcional, pero ayuda mucho: los compitas aceptan con más confianza a quien pueden ver". El compita la ve antes de aceptar. Se medirá si se acepta más con foto.
2. Foto del familiar: opcional, visible tras el pago.
3. Almacenamiento privado (no el bucket público de los perfiles), con consentimiento y retención limitada (propuesta: mientras el cliente siga activo; borrado a su solicitud). Actualizar `/privacidad`.

## 4. Datos obligatorios (solo lo necesario para la seguridad o para que el servicio ocurra)

1. Una vez, el cliente: teléfono (solo admin), país, relación con el familiar.
2. Una vez, el familiar: nombre y edad aproximada; si el lugar es privado, descripción y movilidad.
3. Cada servicio: qué, cuándo, dónde. Si el lugar es privado: quién estará presente, dirección, cómo entrar y contacto en el sitio (nombre y teléfono).
4. No se piden medicinas, historial médico ni documentos. Casilla de consentimiento para los datos del familiar.
5. La ficha se pide DESPUÉS de pagar y es obligatoria antes de agendar la primera cita. El cliente la llena solo en el portal; el equipo no la llena por teléfono (decisión del usuario, 2026-11-09). Etapa nueva "ficha" en el ciclo.

## 5. Cadena de la visita presencial

En camino (opcional) -> Llegué, con FOTO obligatoria del lugar al que llegó -> Iniciar visita (el cliente confirma o se confirma sola a los 5 minutos) -> Terminar. La foto sirve de prueba de llegada y se muestra al cliente si nadie abre.

## 6. Si nadie abre

1. El compita toca "Llegué y no hay nadie" (con la foto). Cuenta 30 minutos desde ese toque.
2. El cliente recibe aviso inmediato con la foto.
3. Se intenta contactar al contacto en el sitio a los 5 y a los 15 minutos.
4. A los 30 minutos sin que aparezca nadie el compita cierra; la visita queda "sin acceso" y SE CUENTA COMO USADA (el cliente paga el servicio). El compita cobra el viaje perdido. El admin puede reprogramar sin costo si hay causa justificada.
5. El monto que cobra el compita se decide caso por caso por el admin (decisión del usuario).

El puente: ningún número se comparte. Primero el admin llama o escribe al contacto (piloto). Después se automatiza (cuando haya unas 5 visitas simultáneas) con mensajes de WhatsApp o SMS entre Compaz y el contacto, retransmitidos al Telegram del compita sin números y con el filtro de contactos. El compita nunca entra en ese chat. Telegram no puede iniciar llamadas y la telefonía por proveedor queda descartada por ahora.

## 7. Paquete de seguridad del compita

1. "No me siento seguro": botón que interrumpe la visita sin penalización para el compita. Al cliente le llega un aviso neutro; al admin, una alerta urgente. Si el compita cobra la visita se decide caso por caso (decisión del usuario).
2. Revisión si la visita se alarga: 15 minutos después de la hora de fin, "¿Todo bien?". Sin respuesta en 10 minutos, alerta urgente al admin. (Decidido: 15 minutos.)
3. Reportar un problema con un cliente (motivos de un toque) y marcar "no quiero volver con este cliente" (no se le vuelve a asignar). El admin puede bloquear al cliente (ya existe).
4. Emergencia disponible en TODOS los teclados. Hoy solo está en "visita programada" y "visita en curso"; falta en "sin visita" y en las confirmaciones. El caso sin visita en curso identifica al compita y su próxima visita cercana (hoy sale como "sin-visita").

## 8. Videollamada posterior al pago

Derecho del cliente, sin cupos ni cobro. Mensaje de video, llamada de solo voz (enlace de Daily, sin teléfonos) y videollamada. El compita acepta o propone otra hora. Tope solo de DURACIÓN por llamada: aviso de fin a los 20 minutos y corte automático a los 23. NO hay límite de cuántas veces se puede llamar (decisión del usuario, 2026-11-09): Compaz es el puente entre cliente y compita y, si se limita, se contactarán por su cuenta. Se vigila el costo con eventos, sin bloquear. Sin grabar. Durante una visita, solo si el compita lo acepta en ese momento.

## 9. Cabos sueltos revisados

Resueltos en esta revisión (con la propuesta que se adopta salvo que el usuario diga otra cosa):
1. Dónde vive "qué se hará": en la solicitud una descripción corta y en cada cita el detalle (sección 2).
2. Pago al compita por viaje perdido o salida por seguridad: caso por caso del admin. Hace falta registrar el ajuste y la nota en la visita; hoy no existe un sistema de pagos a compitas en el código.
3. Las notas de voz del contacto no se pueden retransmitir (el bot solo recibe texto y fotos): se le responde que escriba.
4. Lo que escribe el contacto o el compita se retransmite siempre por el filtro de contactos.

Respuestas del usuario a los pendientes (2026-11-04):

1. Servicios que no son visitas (diligencias o "mandados"): habrá un botón "Mandados". El cliente describe qué quiere hacer y da un estimado de cuánto duraría. Hay una tarifa plana inicial y después se sigue con la base por hora; con la descripción y el estimado se decide el precio. "Iniciamos así y lo iremos desarrollando." Cifras dichas por el usuario: tarifa por hora 22 dólares y tarifa plana inicial 22 dólares (primero dijo 20, luego corrigió a 22). DISCREPANCIA CON EL CÓDIGO: hoy `lib/planes.ts` tiene la hora extra en 20 dólares con mínimo de 2 horas, y los planes salen a unos 22,5 por hora (A la carta 45 por 2 horas). Pendiente confirmar la tarifa oficial antes de construir. Preguntas de diseño abiertas: si la tarifa plana cubre la primera hora; qué pasa si el mandado dura más que el estimado (propuesta: tope de más 30 por ciento sin aprobación del cliente); y quién adelanta el dinero cuando el mandado implica comprar algo (propuesta para la primera versión: el cliente paga las compras aparte y el compita sube la foto del recibo).
2. Llamadas del compita al cliente: el botón "Llamar al cliente" se MANTIENE. Límite de 5 minutos por llamada durante una visita, con advertencia visible: la plataforma es para comunicaciones puntuales, no para hacer la visita por video; quien quiera conversar más tiempo, el cliente llama directamente a su familiar por su cuenta. Este tope de 5 minutos aplica a las llamadas durante una visita, sean iniciadas por el compita o pedidas por el cliente. CONFIRMADO: las llamadas fuera de una visita (para conocerse o coordinar) pueden durar hasta 20 minutos.
3. Retención de la foto de llegada (el usuario pidió explicarla): es cuánto tiempo guardamos la foto del lugar que el compita manda al llegar. APROBADO: se borra 90 días después de cerrar la visita, lo bastante para resolver cualquier reclamo y no más. Hay que ADVERTIR de este plazo por privacidad: al cliente (en los términos que acepta, en `/privacidad` y en el aviso de "nadie abre" donde ve la foto) y al compita (en sus términos y al pedirle la foto de llegada). El borrado se programa en el cron de limpieza que ya existe y deja un evento `foto_borrada`.
4. Consentimiento: cada parte debe ACEPTAR dentro de la app los términos que le tocan, con registro de la versión aceptada y la fecha (evento `terminos_aceptados`). Cliente: datos y foto del familiar y del cliente, regla de no contactar fuera de la plataforma, visita perdida si nadie abre, condiciones de pago. Compita: foto de llegada y su retención, no contactar fuera, reglas de seguridad. Se redacta un borrador y se aprueba; se actualiza también `/privacidad`. Sin aceptación no se continúa.

Derivado en otros frentes:
1. Prototipo: falta reflejar contratación directa, foto opcional con nota, ficha post-pago, cadena "llegué con foto", "no me siento seguro", "¿todo bien?" y reporte. También `ciclo-data.ts` y el recorrido.
2. Paso 1.6 (etapa del cliente): los valores deben contemplar la contratación directa y la etapa "ficha".
3. Bandeja del admin: tipos de tarea nuevos (nadie abre con cronómetro de 5, 15 y 30 minutos; no me siento seguro; visita alargada sin respuesta; reporte de un compita; ficha incompleta).
4. Modelo de datos (aditivo): `tipo` en solicitudes (entrevista o directa); `lugar_privado`; campos de la cita (dirección, indicaciones, contacto en el sitio); fotos; bloqueos compita-cliente; tipo en `admin_flags`; `canal` de `avisos` ampliable a WhatsApp o SMS cuando se automatice.
5. Auditoría del admin: registrar cada vez que el admin consulta un teléfono o dato sensible (propuesta del mentor).
6. Eventos nuevos: `llegada_registrada`, `llegada_sin_acceso`, `visita_sin_acceso`, `salida_por_seguridad`, `visita_alargada`, `reporte_cliente`.

## 10. Precios y mandados (decisiones del usuario, 2026-11-04)

1. TODO pasa a 22 dólares la hora. Cambiarlo en todo el sitio. El mínimo de 2 horas de "A la carta" se elimina: sin límite mínimo, desde 1 hora.
2. Mandados (DEFINITIVO): tarifa plana de 22 dólares por mandado, dure 15 minutos, 30 minutos o una hora. Un mandado no puede pasar de 1 hora. Si el compita tarda más, es problema suyo y no se cobra de más. Si el cliente ya sabe que durará más de una hora, debe hablar directamente con Compaz para ver cómo gestionarlo (deja de ser un mandado). El cliente describe qué quiere hacer y un estimado de duración. Las cifras están en `lib/planes.ts` (`PRECIO_MANDADO_USD`, `DURACION_MAX_MANDADO_MIN`); el botón "Mandados" se construye más adelante.
3. Compras: NO entran en el sistema en esta fase. El familiar paga sus cosas; si hay que comprar algo y el familiar no puede, se coordina directamente con el cliente (por el chat de Compaz, sin mover dinero por la plataforma). La idea del servicio es acompañar, no gestionar compras.
4. Mandado que dura más que el estimado: RESUELTO con tarifa plana (ver 2). Se descartó cobrar por tiempo porque da al compita un incentivo para alargarlo.

Inventario de dónde cambian los precios (verificado en el código):
1. `lib/planes.ts` es la fuente única: planes (A la carta 45, Compañía 75, Compañía Plus 140), `PRECIO_HORA_EXTRA_USD` (hoy 20) y `HORAS_MINIMAS_EXTRA` (hoy 2). De ahí leen la página de pago, `PlanesPago`, `RegistrarPago` (admin), `AgendarOtraVisita`, el cron `recordatorio-pago`, `solicitudes-pago` y `pagos`.
2. `app/api/chat/route.ts` (el asistente de la página) cita los precios en su texto (líneas 58 a 63): hay que actualizarlo a mano.
3. La página de inicio no muestra precios. `tests/10-planes-y-creditos.test.ts` fija los valores actuales y hay que actualizarlo.
4. DECIDIDO Y APLICADO (2026-11-04): planes mensuales con la opción B, es decir, se mantiene el descuento (Compañía 75 y Compañía Plus 140). La hora extra pasó de 20 a 22 y su mínimo de 2 horas a 1; A la carta pasó de 45 (2 horas) a 22 (1 hora). El precio tachado de la página de pago se calcula ahora desde la hora (88 y 176; ahorro de 13 y 36) en vez de estar fijo. Se actualizaron los textos de la página de pago, `PlanesPago`, `AgendarOtraVisita` y el asistente de la página, y las pruebas de precios (`tests/10`). Pendiente futuro: fusionar "A la carta" con "visita extra" en un solo "elige cuántas horas". Texto de la discusión original: Con 22 la hora: 2 horas = 44 (hoy 45), 2 visitas de 2 horas = 88 (hoy 75), 4 visitas de 2 horas = 176 (hoy 140). Opción A: sin descuento, todo a 22 la hora (88 y 176). Opción B: los planes conservan su descuento (75 y 140) y solo cambian A la carta, la hora extra y los mandados. Propuesta de diseño: "A la carta" deja de ser un producto fijo y pasa a ser "elige cuántas horas" (mínimo 1) a 22 la hora.

Cambio de personas tras aceptar: ver `docs/plan-construccion.md` (el compita recibe aviso y decide si sigue, sin penalización; el evento queda registrado).
