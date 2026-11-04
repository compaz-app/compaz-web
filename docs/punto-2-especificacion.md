# Punto 2: qué ve cada parte, seguridad del compita y datos del cliente

Especificación final de lo decidido con el usuario el 2026-11-04. Reemplaza las notas sueltas del plan sobre este punto. Estado: DECIDIDO salvo lo marcado como "pendiente".

## 1. Qué ve cada parte y cuándo

Antes de pagar (el compita acepta ANTES del pago, decisión del punto 1):
1. El cliente ve del compita: foto, video, calificación, reseñas, primer nombre y la INICIAL del apellido, y la zona general. Nada de contacto.
2. El compita ve del cliente al decidir: primer nombre, foto (si la hay), qué se hará, cuándo, si el lugar es privado y datos generales del familiar (edad aproximada, condición general). Hoy ve el nombre COMPLETO y el texto libre sobre el familiar: debe cambiar.

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
5. La ficha se pide DESPUÉS de pagar y es obligatoria antes de agendar la primera cita. El admin puede llenarla por teléfono. Etapa nueva "ficha" en el ciclo.

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

Derecho del cliente, sin cupos ni cobro. Mensaje de video, llamada de solo voz (enlace de Daily, sin teléfonos) y videollamada. El compita acepta o propone otra hora. Tope por llamada con aviso previo y freno anti-abuso discreto (propuesta: 1 videollamada al día y 3 por semana, con aviso al admin). Sin grabar. Durante una visita, solo si el compita lo acepta en ese momento.

## 9. Cabos sueltos revisados

Resueltos en esta revisión (con la propuesta que se adopta salvo que el usuario diga otra cosa):
1. Dónde vive "qué se hará": en la solicitud una descripción corta y en cada cita el detalle (sección 2).
2. Pago al compita por viaje perdido o salida por seguridad: caso por caso del admin. Hace falta registrar el ajuste y la nota en la visita; hoy no existe un sistema de pagos a compitas en el código.
3. Las notas de voz del contacto no se pueden retransmitir (el bot solo recibe texto y fotos): se le responde que escriba.
4. Lo que escribe el contacto o el compita se retransmite siempre por el filtro de contactos.

Pendientes que requieren al usuario:
1. ¿Una diligencia, un regalo u otro servicio consume lo mismo que una visita en el plan del cliente, o tiene otro precio? Se preguntó y no se respondió.
2. El botón actual "Llamar al cliente" del teclado de visita en curso permite al compita iniciar una videollamada. ¿Se mantiene o pasa a seguir la regla del punto 8 (el cliente la pide y el compita acepta)?
3. Retención de la foto de llegada (propuesta: cerrar la visita más 90 días).
4. Texto de consentimiento y política de privacidad para datos del familiar (se redacta un borrador y se aprueba).

Derivado en otros frentes:
1. Prototipo: falta reflejar contratación directa, foto opcional con nota, ficha post-pago, cadena "llegué con foto", "no me siento seguro", "¿todo bien?" y reporte. También `ciclo-data.ts` y el recorrido.
2. Paso 1.6 (etapa del cliente): los valores deben contemplar la contratación directa y la etapa "ficha".
3. Bandeja del admin: tipos de tarea nuevos (nadie abre con cronómetro de 5, 15 y 30 minutos; no me siento seguro; visita alargada sin respuesta; reporte de un compita; ficha incompleta).
4. Modelo de datos (aditivo): `tipo` en solicitudes (entrevista o directa); `lugar_privado`; campos de la cita (dirección, indicaciones, contacto en el sitio); fotos; bloqueos compita-cliente; tipo en `admin_flags`; `canal` de `avisos` ampliable a WhatsApp o SMS cuando se automatice.
5. Auditoría del admin: registrar cada vez que el admin consulta un teléfono o dato sensible (propuesta del mentor).
6. Eventos nuevos: `llegada_registrada`, `llegada_sin_acceso`, `visita_sin_acceso`, `salida_por_seguridad`, `visita_alargada`, `reporte_cliente`.
