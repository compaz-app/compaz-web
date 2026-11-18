# Historial de versiones

La versión vigente está en `lib/version.ts` y se ve en el panel (menú lateral, abajo; en el teléfono, arriba junto al título). Se sube cuando entra algo relevante y se anota aquí, la más nueva primero.

Reglas: mayor = cambio grande o lanzamiento; menor = función nueva; parche = arreglo. La etapa `beta` sale cuando el sistema corre una o dos semanas con uso real sin sorpresas.

## 1.3.26-beta.1 (2026-11-18)
Los correos «¿Pudiste hablar?» y «¿qué te pareció?» vuelven a salir (el cliente podía cerrar la pestaña del portal sin enterarse) y el portal ahora también los muestra, con botones: tarjeta `confirmar_llamada` («Sí, hablamos» / «No se pudo, elegir otra hora»). Contestar en el portal, en el correo o (el compita) en Telegram cierra la pregunta en todos los canales y el tablero se actualiza solo. Prueba 130.

## 1.3.25-beta.1 (2026-11-18)
Correos: quedan solo los que hacen falta, el resto va al portal o a un resumen (quinta parte de la reducción de textos). Decidido con Juan el 18-nov.
1. «Va en camino» y «llegó» ya no mandan correo: el portal lo muestra y, si el cliente no entró, lo recoge el resumen diario. Siguen instantáneos «nadie abre», «se cerró: nadie abrió» y «ya llegó, confirma el inicio».
2. Resumen diario (7 pm de Caracas, proceso `resumen-diario`, `lib/resumen-diario.ts`): un solo correo con lo que no tuvo correo propio. Solo si hay algo sin ver y el cliente no entró al portal ese día; una vez por día.
3. Fin de entrevista y «¿qué decidiste?»: primero el portal. El correo sale a las 24 h solo si el cliente no lo vio, y es UNO (se quitó el segundo recordatorio de la escalera; si tampoco decide, pasa a una tarea del equipo). La llamada muy corta sigue mandando el correo al instante. «¿Pudiste hablar?» y «¿qué te pareció?» NO se quitan: siguen llegando por correo y además aparecen en el portal (tarjeta nueva `confirmar_llamada`, con «Sí, hablamos» y «No se pudo, elegir otra hora»; ruta `/api/portal/llamada`). Contestar en cualquier canal (portal, correo o Telegram del compita) cierra la pregunta en todos (`cerrarPreguntasDeSolicitud`): el portal deja de mostrarla y el correo diferido pendiente se cancela.
4. Chat: un correo «te escribió» por visita, y otro solo si pasan más de 30 minutos sin que el cliente lea (antes: cada 10 minutos antes de la visita).
5. Compitas: el recordatorio de una solicitud sin respuesta va por Telegram, no por correo (sin Telegram no se les puede contratar).
6. «Visita confirmada» es ahora el resumen del proceso: plan, compita, fecha y hora; el correo de contratación es más corto y avisa que ese correo llegará. Se juntan en uno solo solo cuando coinciden, pero en el flujo actual la hora se acuerda DESPUÉS de contratar, así que son dos correos distintos y cada uno dice lo suyo.
7. Si el correo de las 24 h falla, el equipo recibe una tarea para reenviarlo.

## 1.3.24-beta.1 (2026-11-18)
Mensajes largos de Telegram, más cortos (cuarta parte de la reducción de textos).
1. Medido: 54 de 283 mensajes distintos pasaban de 40 palabras; los peores eran «¡Te contrataron!» (129), «el cliente decidió no continuar» (116) y «Gracias por tu dedicación» (105).
2. Recortados: contratación, decisión del cliente, resultado de llamada, reagendado, «nadie abre», «Edita tu perfil», dirección repetida y cierres de solicitud sin horario. Se mantienen las advertencias de fraude y de no acordar por fuera, en su versión breve (`lib/avisos-seguridad.ts`).
3. Prueba 129: ningún texto de Telegram en las rutas pasa de 70 palabras.

## 1.3.23-beta.1 (2026-11-18)
Correos del cliente: menos y más cortos (tercera parte de la reducción de textos).
1. Medido (correos reales de las pruebas): un cliente recibía unos 11 correos hasta su primera visita. El «trío» de la llamada (confirmada, empieza a las…, link de acceso) eran en realidad DOS normales más uno que solo manda el equipo a mano, así que ese no se junta.
2. «Llegó con tu familiar»: ya no sale cuando el cliente confirma él mismo la llegada (acababa de pulsar el botón y el portal ya lo muestra). Sigue saliendo cuando la visita arranca sola porque no confirmó (aviso-inicio-visita). «Ya llegó, confirma el inicio» no cambia: es el aviso importante.
3. «Te escribió en Compaz»: durante la visita llega UN solo correo por visita (antes uno cada 10 minutos; el portal muestra los mensajes y las fotos en vivo); antes de la visita sigue siendo uno cada 10 minutos. El correo dice «Verlo en mi portal» y apunta al portal nuevo.
4. Bienvenida del cliente: de 227 a unas 65 palabras (3 pasos, el botón, la vigencia del enlace, el aviso de fraude y el correo de ayuda).
5. El lema «Compaz, cerca aunque estés lejos» sale de los 30 correos y mensajes transaccionales (queda en la landing).
6. Advertencias de seguridad, cortas y comunes: el aviso de 49 palabras de los correos de seguimiento pasa a la frase común de contacto por fuera; los textos por defecto de Ajustes pasan de 46 a 28 palabras (fraude del cliente), de 37 a 25 (fraude del compita) y de 30 a 24 (contacto detectado en el chat). Si ya cambiaron estos textos en Ajustes, sus textos propios se respetan.
7. Prueba 128 (presupuestos y comportamiento). Pendiente: los mensajes largos de Telegram («¡Te contrataron!», «decidió no continuar», «Gracias por tu dedicación») y la prueba general de presupuestos. Sin migración.

## 1.3.22-beta.1 (2026-11-18)
Inscripción del compita: el formulario de registro y su pantalla de activación son más cortos (segunda parte de la reducción de textos).
1. Formulario: de 366 a 267 palabras visibles por defecto (la guía de cómo grabar y subir el video ya estaba plegada y no cuenta). Los textos de ayuda bajo cada campo pasan a una frase corta («Solo lo ve el equipo, nunca las familias.», «Aquí te llega el código para activar Telegram.»…). Se quitaron las repeticiones (la lista de ejemplos de habilidades salía dos veces) y la promesa de «triplicar las probabilidades».
2. Pantalla de después de registrarse: de los bloques «Paso 1 — Descarga Telegram», «Paso 2 — Abre el bot» y la «Alerta de fraude» (unas 130 palabras) a tres pasos (abrir el bot, tocar Iniciar y escribir el nombre, escribir el código), el enlace de descarga para iPhone y Android y la frase corta de fraude (`AVISO_FRAUDE`).
3. Prueba 127: presupuesto de 290 palabras visibles y ayudas de 20 palabras como máximo.
4. NO se vio en pantalla: el formulario exige una invitación válida y crearla escribiría en la base compartida. Hay que mirarlo con un enlace de invitación real. Sin migración.

## 1.3.21-beta.1 (2026-11-18)
Inscripción del compita: correos y mensajes de Telegram mucho más cortos (primera parte de la reducción de textos).
1. Medido antes con los mensajes reales de las pruebas: el compita leía unas 1.300 palabras para inscribirse (formulario 647, correo de bienvenida 322, cinco mensajes de Telegram 305, correo del código 50).
2. Correo de bienvenida: de 322 a 66 palabras. Tres pasos (abrir el bot, tocar Iniciar y escribir el nombre, escribir el código), botón al bot, descargas de iPhone y Android, aviso de notificaciones y de fraude. Se quitaron el «Paso 2: completa tu perfil» (el perfil ya es obligatorio antes de activar Telegram) y la tabla de comandos.
3. Correo del código: de 50 a 39 palabras. Correo para completar el perfil: de 56 a 49.
4. Telegram: el registro pasa de cinco mensajes (305 palabras) a tres (12 + 22 + 39 palabras): pedir el nombre, enviar el código y UNA sola confirmación de activación. Ya no llegan la guía completa ni el «Eso es todo»; la guía sigue disponible con el botón «Menú» y pasó de 109 a 21 palabras de texto más las dos advertencias.
5. Las advertencias de seguridad se QUEDAN y se repiten, pero con dos frases cortas comunes en `lib/avisos-seguridad.ts`: «Compaz nunca te pide claves, dinero ni datos bancarios.» (fraude) y «Mantén todo dentro de Compaz: acordar por fuera viola los términos y puedes perder la garantía.» (contacto por fuera). Acompañan al código, a la activación y a la guía.
6. Prueba 126: presupuestos de palabras (correos máx. 80, 45 y 50; mensajes de Telegram máx. 45; guía máx. 75) para que no vuelvan a crecer.
7. Falta: el formulario de registro (647 palabras) y llevar las dos frases comunes a los demás correos y mensajes. Sin migración.

## 1.3.20-beta.1 (2026-11-18)
Un solo correo con el resumen de la visita, y se califica una sola vez.
1. Antes, al terminar una visita el cliente recibía DOS correos casi iguales: uno al instante («resumen de la visita», con las estrellas) y otro cuando el compita completaba el cuestionario (el reporte, también con las estrellas, y hasta con asunto «Actualización»). Se podía calificar dos veces y la segunda decía «ya calificaste».
2. Ahora, al terminar la visita NO sale ningún correo: solo un aviso en la campana del portal («La visita terminó. Estamos preparando el reporte.»). El cliente recibe UN correo, el resumen completo: la recomendación escrita por IA, los indicadores, lo que anotó el compita con sus propias palabras («Lo que anotó María») y la calificación con estrellas. Sale cuando el compita termina el cuestionario de bienestar.
3. Respaldo: si el compita NO completa el cuestionario, a los 35 minutos de terminada la visita sale el resumen básico (mensajes, fotos y calificación), una sola vez (lo corre el cron `recordatorio-cuestionario`, código en `lib/resumen-visita.ts`). Si el cuestionario se completa, ese respaldo ya no sale. No se revisan visitas de más de 48 horas.
4. Calificar una sola vez: el correo ya no ofrece las estrellas si el cliente ya calificó, y el enlace de una calificación ya hecha dice «Ya calificaste» sin pedir confirmar otra vez.
5. El texto que ve el compita al terminar ya no promete un «resumen básico» a la familia: dice que con el cuestionario la familia recibe su reporte completo.
6. Sin migración. Pendiente (no se tocó): revisar el resto de correos durante la visita (en camino, llegó, inicio de visita) por si se pueden juntar o dejar solo en el portal.

## 1.3.19-beta.1 (2026-11-18)
Portal del cliente en el teléfono: tamaños fluidos y más compactos en pantallas bajas.
1. Medido con los componentes reales en 375×667 (iPhone SE), 360×640 (Android chico), 390×844 (iPhone 14) y 430×932 (iPhone Pro Max): la tarjeta de siguiente paso ocupaba el 59 % de la pantalla en el iPhone SE y el 61 % en el Android chico, y el 37 % en el Pro Max, porque los tamaños eran fijos. El chat gastaba 144 px solo en marco (cabecera 58 y caja de escribir 86).
2. Tamaños fluidos: título de 20 a 24 px y texto de 16 a 18 px según el ancho de la pantalla (antes, 24 y 18 fijos). El botón grande y el texto de los botones también escalan.
3. Modo compacto en pantallas con menos de 760 px de alto: menos relleno en las tarjetas, avatar más pequeño, menos espacio entre bloques y botón de 48 px (56 en las altas).
4. Chat con menos marco en el teléfono: cabecera de 58 a 46 px, caja de escribir de 86 a 70 px, menos relleno en los mensajes, y la cabecera se esconde con el teclado abierto. Escritorio y la pantalla vieja no cambian.
5. Menú de abajo de 65 a 57 px, y la página deja justo ese lugar.
6. Resultado medido: la tarjeta pasa del 59 % al 50 % en el iPhone SE (54 % en el Android de 640 px de alto) y no cambia en los teléfonos grandes. El efecto del teclado abierto NO se pudo medir fuera de un teléfono real.
7. Sin migración.

## 1.3.18-beta.1 (2026-11-18)
Portal del cliente en el teléfono: el chat no queda a la mitad al escribir y el menú de abajo queda al fondo.
1. Chat: al tocar la caja de texto el teléfono abre el teclado y mueve la página, y el chat quedaba a la mitad de la pantalla. Ahora el marco del chat se pega arriba de la zona visible al enfocarse (dos veces, mientras sube el teclado y cuando ya subió) y, con el teclado abierto, ocupa justo el alto visible (`--alto-visible`, medido con `visualViewport`).
2. Menú de abajo (Inicio, Visitas, Mi cuenta): ya no queda «atravesado». Se apoya en el borde de la pantalla respetando la barra de inicio del iPhone (`safe-area-inset-bottom`) y se esconde mientras el teclado está abierto (en iPhone un menú fijo se quedaba flotando a media pantalla).
3. Solo el portal usa la pantalla completa (`viewport-fit=cover`) y, en Chrome de Android, el teclado achica la página en vez de taparla. La landing y las demás pantallas no cambian.
4. NO se probó en un teléfono real (no hay forma de abrir el teclado en el navegador de escritorio): hay que probarlo en iPhone y en Android. Si algo queda raro, lo más probable es el desfase al subir el teclado en iPhone (ver `MarcoChat`).
5. Sin migración.

## 1.3.17-beta.1 (2026-11-18)
Una entrevista que se queda sin hora ya no se pierde (cierra los dos huecos de 1.3.16).
1. «No se pudo» desde el correo: al abrirse la página de cambiar la hora, el sistema anota que la llamada NO ocurrió (si la hora de la llamada ya pasó), sin pedirle otro clic al cliente. Va por POST desde la página, que los escáneres de correo no ejecutan, y es idempotente. Así deja de llegarle el correo equivocado «¿Quieres contratarla?» a quien dijo que no se pudo.
2. Recordatorio escalonado para las entrevistas aceptadas que están sin hora (porque el cliente la soltó o nunca llegó a elegir): a las 24 h, correo al cliente con su enlace y aviso en la campana del portal; a las 48 h, tarea en la Bandeja («Cliente sin elegir hora», con el nombre) y aviso al compita en Telegram para que no espere sin saber (sin contactos ni enlaces). Cada peldaño sale una sola vez por cada vez que se quedó sin hora. La tarea se cierra sola cuando la solicitud vuelve a tener hora o se cierra.
3. Lo corre el cron `seguimiento` (paso 4, cada 5 minutos): no hay función programada nueva. Código en `lib/sin-hora.ts`.
4. Solo cubre entrevistas con horas libres (las de propuestas de horario son otro flujo). Sin migración.

## 1.3.16-beta.1 (2026-11-18)
«¿Cómo estuvo la llamada?»: el compita se queda en Telegram, y el cliente se entera y llega más rápido a reagendar.
1. Compita: «Sí, ocurrió» y «No se pudo» ahora son botones de Telegram que responden al toque (callback `ll:`), sin página web de por medio. Antes lo mandaban a una página que volvía a preguntar «¿la llamada no se pudo realizar?» y, al responder, mostraba «Ir a mi portal», que es el portal del CLIENTE. Solo la compita de esa solicitud puede responder.
2. Causa del «Ir a mi portal»: `pagina()` ponía ese botón por defecto en toda página de éxito, también las del compita. Ahora el botón depende de quién mira (`paginaPara`): el cliente vuelve a su portal; el compita vuelve a Telegram (o no ve botón). Aplica a todas las páginas de respuesta de solicitudes (responder, reagendar, seguimiento, resultado de la llamada, calificación).
3. Cliente: cuando el compita dice que la llamada no se pudo, además del correo llega un aviso en la campana del portal con el enlace directo a elegir otra hora. Y el botón «No se pudo» del correo «¿Pudiste hablar?» ya no pasa por la página intermedia de confirmación: va directo a la página de cambiar la hora (de 3 pasos a 2). El enlace «Sí, todo bien» conserva su confirmación.
4. Se probó que el correo al cliente SÍ sale cuando el compita dice que no se pudo (prueba 121); si en la prueba real no llegó, revisar spam y el registro de avisos (Más, Avisos). Si el cliente toca «No se pudo» y no termina de elegir hora, ya no queda anotado que la llamada no ocurrió, y más tarde puede recibir la pregunta de contratar.
5. Sin migración.

## 1.3.15-beta.1 (2026-11-17)
Un compita nuevo no cuenta en el sistema hasta tener el perfil lleno y Telegram activo.
1. En Personas, un compita sin verificar al que le falta el perfil (descripción y al menos un servicio) o Telegram sale como «Pendiente», con lo que le falta en la columna Estado («Falta perfil», «Falta Telegram» o «Falta perfil y Telegram»). Ya no aparece en «Todos» ni en los conteos de esa lista: se ve en el filtro nuevo «Pendientes».
2. Cuando completa el perfil y activa Telegram pasa solo a «Nuevo» (a la espera de que el equipo lo verifique). Antes, un compita dado de alta desde el CMC (inactivo) aparecía como «En pausa» aunque nunca hubiera sido verificado; ahora «En pausa» es solo para los ya verificados que se pausaron o desactivaron. Un compita ya verificado NO cambia aunque le falte algo, para no esconder a quien ya atiende familias; los bloqueados tampoco.
3. Complementa 1.3.5 y 1.3.6 (Telegram y verificar ya exigen el perfil): ahora además se ve con claridad quién está en el sistema y quién está pendiente. Sin párrafos nuevos: solo la etiqueta corta y el filtro.
4. Sin migración.

## 1.3.14-beta.1 (2026-11-17)
Un cliente invitado no cuenta como cliente hasta activar su cuenta.
1. Antes, al invitar a un cliente se le creaba la cuenta y ya figuraba como cliente (en Clientes y en Seguimiento) aunque nunca abriera el correo. Ahora queda como «Invitado» (`usuarios.activado = false`): no sale en Clientes ni en Seguimiento. Pasa a ser cliente cuando abre el correo y activa su cuenta.
2. En Más, Invitar aparece «Invitados sin activar» con un botón «Reenviar». Reenviar manda un enlace nuevo (el anterior deja de servir). Invitar otra vez al mismo correo hace lo mismo en lugar de rechazarlo; quien ya activó su cuenta sigue sin poder reinvitarse (409).
3. Los clientes que ya existían no cambian: solo se oculta a quien está marcado como no activado.
4. Sin migración.

## 1.3.13-beta.1 (2026-11-17)
Limpieza de Airtable, fase 3: la pantalla Postulaciones y el manual ya no hablan de Airtable.
1. En Más, Postulaciones y origen, la bandeja se llama «Por resolver» (postulaciones anteriores que el CMC no llegó a ver) y se resuelven con «La registré directamente en el CMC» o «No procede». Desaparecen los mensajes «La copia a Airtable está desactivada», «Todo lo recibido llegó a Airtable» y el detalle del error de Airtable.
2. El manual del equipo (¿Cómo veo de dónde llegan las postulaciones…?) y la ayuda ⓘ se reescriben sin Airtable. `pendientesDeAirtable` pasa a llamarse `pendientesPorResolver`.
3. Se actualizan los comentarios de `lib/captacion.ts`. SE QUEDAN, a propósito, el formato Airtable de `/api/cmc/postulaciones` (lo espera el Apps Script del CMC), las columnas `airtable_*` de la base y las etiquetas «Respaldo de Airtable» / «Importada de Airtable» de datos históricos.
4. Con esto termina la limpieza de Airtable en el código. Queda por hacer fuera del código: quitar de Netlify `AIRTABLE_*` y `POSTULACIONES_DESTINO`, y revocar la clave de Airtable. Sin migración.

## 1.3.12-beta.1 (2026-11-17)
Limpieza de Airtable, fase 2: el código de la web ya no usa Airtable.
1. Las postulaciones (`/api/waitlist`) se guardan SOLO en Supabase. Si Supabase falla, la persona ve un error 503 y puede reintentar, y el equipo recibe un aviso (como mucho uno cada 15 minutos). Ya no existe el respaldo directo a Airtable.
2. Se borran: el cliente de Airtable (`lib/airtable.ts`), las rutas de cron `reintentar-airtable` y `conciliar-airtable`, sus funciones programadas de Netlify, las pruebas de integración contra Airtable real y los trabajos `airtable` y `e2e` del flujo de GitHub. En `lib/captacion.ts` se quitan la copia, los reintentos, la conciliación y los avisos de la bandeja.
3. En la bandeja de postulaciones por resolver desaparece la resolución «Ya está en Airtable» (queda «La registré directamente en el CMC» y «No procede», las dos con nota obligatoria).
4. SE QUEDA a propósito el contrato con el CMC: `/api/cmc/postulaciones` sigue respondiendo en formato Airtable (columna «ID Airtable» de la hoja) porque cambiarlo exige que Luis cambie el Apps Script, y las columnas `airtable_*` de la tabla `postulaciones` (solo agregamos, nunca borramos).
5. La prueba 116 vigila que no vuelva a aparecer ninguna llamada a Airtable. La prueba 18 se reescribió para Supabase solo.
6. Pendiente: fase 3 (la pantalla Postulaciones todavía dice «Sin llegar a Airtable» y el manual lo menciona) y quitar en Netlify las variables `AIRTABLE_*` y `POSTULACIONES_DESTINO` (lo hace Juan). Sin migración.

## 1.3.11-beta.1 (2026-11-17)
La política de privacidad dice dónde se guardan los datos de verdad.
1. `/privacidad` decía «Tus datos se almacenan en Airtable». Ya no es cierto: las postulaciones y todo lo demás se guardan en Supabase. Ahora dice Supabase.
2. Es un texto legal público: conviene que Juan lo revise. El resto de la política no se tocó.
3. Es la fase 1 de la limpieza de Airtable. Sin migración.

## 1.3.10-beta.1 (2026-11-17)
Tope en el servidor y alarma de tráfico anormal para el punto rojo del panel (derivado de INC-002, ver `docs/incidentes.md`).
1. Las rutas `/api/admin/pendientes-bandeja` y `/api/admin/pendientes-pagos` cuentan las consultas de cada persona por minuto. Pasadas 30 por minuto (lo normal son unas 3) responden 429 con la explicación y la razón (`panel_consultas` en `lib/esperas.ts`, ya listado en Más, Límites y esperas). El navegador, al recibir 429, se calla un minuto.
2. Alarma: la primera vez que alguien pasa el tope llega un aviso urgente al equipo («Tráfico anormal: correo hizo N consultas en un minuto a la ruta»), una vez por hora y por persona y ruta, no una por consulta.
3. Falla abierto a propósito: si el conteo no se puede hacer, la consulta pasa. Es un freno contra errores, no una barrera de seguridad.
4. Alcance honesto: esto protege la base de datos y avisa, pero la función de Netlify igual se ejecuta en cada petición. El tope real de gasto en ejecuciones es una regla de Netlify (alerta de uso y reglas de límite de la plataforma), que se configura en Netlify, no en el código.
5. Sin migración.

## 1.3.9-beta.1 (2026-11-17)
URGENTE: el punto rojo del panel tumbaba la web con una lluvia de consultas.
1. Qué pasó: el 17-nov, entre la 01:00 y las 02:00 UTC, dos navegadores con el panel abierto hicieron cerca de 35.000 consultas a `/api/admin/pendientes-bandeja` (unas 5 por segundo cada uno; lo normal son unas 60 peticiones por HORA en todo el sitio). Eso gastó una cantidad enorme de ejecuciones de funciones de Netlify y las dos conexiones dejaron de poder abrir el sitio.
2. Causa: en `InsigniaPendiente` la función de suscripción era una flecha nueva en cada dibujo. React se desuscribía y volvía a suscribirse en cada dibujo; al quedar sin suscriptores el almacén borraba el número, y al volver a suscribirse consultaba al servidor y recuperaba el número, lo que forzaba otro dibujo. Un bucle sin fin mientras el panel estuviera abierto. Entró con el punto rojo (1.1.x).
3. Arreglo en tres capas: (a) la función de suscripción es estable (`useCallback`); (b) el almacén nunca hace más de una consulta cada 5 segundos por pestaña, junta las peticiones repetidas en una y no lanza otra si ya hay una en camino; (c) la prueba 113 reproduce el bucle (50 suscripciones seguidas = 1 consulta) y vigila que la suscripción siga estable.
4. Sin migración.

## 1.3.8-beta.1 (2026-11-16)
Estado del sistema ya no muestra nada de Airtable.
1. Se quitan de Más, Estado del sistema: la fila «Postulaciones sin enviar a Airtable» y los dos procesos «Reintento de envíos a Airtable» y «Conciliación con Airtable» (que además ya no se vigilan: no avisan si dejan de correr).
2. NO se toca el resto: las rutas, funciones programadas y el código de captación que todavía mencionan Airtable siguen igual, y la pantalla Postulaciones conserva su bandeja de «Sin llegar a Airtable». Con `POSTULACIONES_DESTINO=solo_supabase` no hacen nada; borrarlos es una limpieza aparte, en orden seguro.
3. Sin migración.

## 1.3.7-beta.1 (2026-11-16)
Más, Invitar y Postulaciones: el título ya no sale repetido.
1. El panel ya pone el título de cada herramienta de Más; Invitar y Postulaciones y origen ponían además el suyo, así que se leía «Invitar» dos veces. Ahora solo queda el del panel, con la descripción y su ⓘ debajo.
2. Sin migración.

## 1.3.6-beta.1 (2026-11-16)
El equipo no puede verificar ni activar a un compita sin el perfil público lleno.
1. Complementa 1.3.5 (que cierra Telegram): ahora «Verificar» y «Activar» responden con un error claro (409) si al compita le falta la descripción o al menos un servicio, y no cambian nada. El mensaje dice qué hacer: que lo complete (enlace del correo o /perfil en Telegram) o completarlo con Editar perfil.
2. Quitar la verificación o desactivar sigue funcionando siempre. La foto y el video siguen siendo opcionales.
3. Los textos y la ayuda ⓘ del botón Verificar lo avisan.
4. Sin migración.

## 1.3.5-beta.1 (2026-11-16)
Telegram no se activa sin el perfil público lleno.
1. Hallazgo: los compitas que entran por el CMC se crean con descripción vacía y sin servicios (el formulario de registro, que sí los exige, no lo pasan), y el bot los vinculaba igual diciéndoles «tu registro ya terminó». Mauricio Acacio y María Alejandra Navarro lo hicieron así.
2. Ahora, al escribir su nombre en el bot, si falta la descripción o los servicios NO se les da el código: se les envía por correo (nunca por Telegram, porque cualquiera puede escribir un nombre en el bot) el enlace para llenar el perfil, que vale 24 horas, y el bot les dice por qué. Al guardarlo, vuelven, tocan /start y escriben su nombre otra vez; ahí sigue el flujo normal.
3. Mínimo exigido: descripción y al menos un servicio, igual que el formulario de registro. La foto y el video siguen siendo opcionales. Sin correo registrado se les pide escribir a hola@micompaz.com.
4. El plazo de un minuto entre intentos aplica también aquí. Los compitas que ya estaban vinculados no cambian.
5. Sin migración.

## 1.3.4-beta.1 (2026-11-16)
«Ver el reporte» ya no se queda: al ver el reporte, el portal pasa a agendar la siguiente visita.
1. Causa real: tras terminar una visita, el portal decía «La visita terminó, ¿cómo te fue?» durante 12 horas SIN IMPORTAR si el cliente ya había abierto el reporte. Por eso el botón seguía ahí aunque ya lo estuviera viendo.
2. Ahora, cuando el cliente abre su pestaña de Visitas y el reporte de esa visita ya está listo, queda anotado (`visitas.reporte_visto_en`) y el estado pasa de «¿cómo te fue?» a «Agenda tu próxima visita» (o «Tu plan se agotó» si no le quedan visitas). Si el reporte todavía no llegó, no se anota y el aviso sigue hasta que llegue. La vista previa del equipo no lo marca.
3. Lo que hizo 1.3.3 sigue: la tarjeta oculta los botones que llevan a la misma pestaña.
4. MIGRACIÓN `20261117b_reporte_visto.sql`: agrega `visitas.reporte_visto_en`. Solo agrega. APLICARLA ANTES de publicar: el código ya la consulta.

## 1.3.3-beta.1 (2026-11-16)
Un botón de la tarjeta que lleva a donde ya estás ya no se muestra.
1. Al terminar la visita, «Ver el reporte» llevaba a la pestaña Visitas, pero la tarjeta (que ahora sale en todas las pestañas) seguía mostrando el mismo botón encima del reporte: tocarlo recargaba la misma página, en círculo.
2. Ahora, en cada pestaña, la tarjeta oculta los botones que llevan a esa misma pestaña. En Inicio sigue «Ver el reporte» y en Visitas queda el reporte sin botón repetido. Vale para todos los estados («Ver mis visitas», «Elegir la fecha», «Cambiar la fecha», «Completar la ficha»...).
3. Sin migración.

## 1.3.2-beta.1 (2026-11-16)
El chat del portal del cliente se distingue del resto de la pestaña Visitas.
1. Antes el chat quedaba sin marco, fundido con el fondo y las demás tarjetas. Ahora tiene su propio marco (borde morado, fondo tenue y sombra suave) y una altura fija con los mensajes desplazándose adentro, así que nunca estira la página.
2. Sin migración.

## 1.3.1-beta.1 (2026-11-16)
Portal del cliente: la campana de avisos.
1. Una campana arriba, junto al saludo, con un círculo rojo y el número de avisos nuevos (compita confirmó, llegó, la visita terminó...). Al abrirla se quita el círculo y la lista queda a la vista con los últimos 10 avisos; cada uno lleva a donde se atiende.
2. Los círculos se separan: la campana cuenta los avisos y la pestaña Visitas cuenta los mensajes sin leer. Entrar a Visitas deja ambos atendidos.
3. El equipo en vista previa no ve la campana ni marca nada.
4. Sin migración.

## 1.3.0-beta.1 (2026-11-16)
Portal del cliente: círculo rojo de mensajes sin leer.
1. La pestaña Visitas muestra un círculo rojo con el número de mensajes nuevos del compita o del equipo, sumado a los avisos nuevos. Se quita al entrar a Visitas (el chat queda a la vista). Lo que escribe el propio cliente no cuenta.
2. Si llega un mensaje mientras el cliente tiene otra pestaña abierta, el círculo aparece al instante (Realtime). Si lo tiene el chat a la vista, queda leído solo.
3. MIGRACIÓN `20261117_chat_leido.sql`: agrega `usuarios.chat_leido_en`. Solo agrega. Hasta que se aplique, el círculo de mensajes queda en cero (no rompe nada).

## 1.2.9-beta.1 (2026-11-16)
La ficha del cliente tiene el botón «Ver perfil del cliente», igual que la del compita tiene «Ver perfil público».
1. Abre el portal del cliente tal como él lo ve (vista previa del equipo, sin ejecutar acciones). Queda anotado en Actividad. Solo para administradores: un colaborador no lo ve.
2. Sin migración.

## 1.2.8-beta.1 (2026-11-16)
Portal del cliente, fase 3: Mi cuenta.
1. Mi familiar y Mi plan pasan a una sola pestaña, Mi cuenta, con las dos partes plegables. Queda abierta la que se pidió; si no, la ficha cuando falta y si no el plan.
2. Los enlaces viejos (?sec=familiar y ?sec=plan) siguen funcionando: llevan a Mi cuenta con esa parte abierta.
3. «Pronto en Compaz» queda plegado en Inicio.
4. El menú pasa de 4 a 3 pestañas: Inicio, Visitas, Mi cuenta.
5. Sin migración.

## 1.2.7-beta.1 (2026-11-16)
Portal del cliente, fase 2: recorrido de la visita y chat siempre abierto.
1. En la pestaña Visitas, arriba, un recorrido de 5 pasos: dirección, día y hora, confirmación del compita, la visita, reporte y calificación. Lo hecho queda en una línea con ✓ verde, el paso de ahora se destaca y lo que falta queda tenue.
2. El chat con el compita ya no se pliega cuando la visita está programada: siempre está abierto.
3. Sin migración.

## 1.2.6-beta.1 (2026-11-16)
Portal del cliente, fase 1: siguiente paso en todas las pestañas y círculo rojo en Visitas.
1. La tarjeta «qué pasa y qué sigue» ya no solo está en Inicio: aparece arriba en Visitas, Mi familiar y Mi plan.
2. La tarjeta dice en una frase qué viene después de ese paso («Después: tu compita confirma la hora»).
3. Un círculo rojo con número en la pestaña Visitas cuenta lo nuevo que aún no abriste. Se quita al entrar a Visitas. Que el portal estuviera abierto no lo quita. El equipo en vista previa no lo marca.
4. Sin migración (usa la columna `actuada_en` que ya existía).

## 1.2.5-beta.1 (2026-11-16)
El bloqueo «este compita no vuelve con este cliente» se ve y se levanta desde la ficha (hallazgo 17 de la auditoría de flujos).
1. Causa de «Este compita no está disponible» al contratar por segunda vez: el compita había reportado al cliente pidiendo no volver con él (en Telegram), eso creó un bloqueo, y la llamada del equipo se cerró como «Resuelto», que NO lo levanta. El bloqueo quedó activo y escondido: el cliente solo ve «no está disponible» (a propósito, sin el motivo), y el panel no tenía ninguna pantalla para verlo ni levantarlo (existía la ruta, pero ningún botón).
2. Ahora, en la ficha del compita y en la del cliente, aparece «No vuelven a trabajar juntos» con el nombre del otro, desde cuándo y el botón «Levantar el bloqueo» (con confirmación y ⓘ). Solo lo ve quien puede atender.
3. La llamada del equipo ya no se puede cerrar como «Resuelto» ni «Hablar con el cliente» si hay un bloqueo activo: la ventana lo avisa y solo ofrece «Mantener el bloqueo» o «Levantar el bloqueo», y el servidor lo exige (409). Así el bloqueo nunca queda escondido.
4. Sin migración.

## 1.2.4-beta.1 (2026-11-16)
«Insistir al compita» en una cita sin confirmar de verdad funciona (hallazgo 16 de la auditoría de flujos).
1. Bug: el botón no reenviaba la cita. La cita se le manda al compita por Telegram sin guardar un aviso, así que el botón buscaba «el último aviso sin atender de ese compita», que casi nunca era el de la cita. Si ese aviso ya no aplicaba (por ejemplo una solicitud ya respondida), no salía nada y aun así se contaba como «reenviado 1 de 3».
2. Ahora, en una tarea de cita sin confirmar, insistir le manda al compita LA CITA pendiente con sus botones «Confirmo la cita» y «No puedo a esa hora» (`recordarCitaAlCompita`). El tope sigue siendo uno cada 30 minutos y 3 por propuesta, contado con eventos `cita_insistida`.
3. Si la cita ya se resolvió (la visita se programó, terminó o la propuesta cambió), no se manda nada y la tarea se cierra, y la Bandeja ya no ofrece el botón. Sin Telegram vinculado o si Telegram falla, lo dice claro y no cuenta como reenvío.
4. Arreglo general: en cualquier «Insistir», un aviso que ya no aplica o que ya se envió deja de contarse como reenviado; se explica («No se reenvió nada: eso ya se resolvió») y, si ya no aplica, se cierra la tarea. La pantalla vuelve a leer la lista después de cada intento.
5. Sin migración.

## 1.2.3-beta.1 (2026-11-16)
Las tareas de la Bandeja se cierran solas cuando lo que las originó ya se resolvió, y se leen mejor (hallazgo 15 de la auditoría de flujos).
1. «Cita sin confirmar» seguía abierta aunque la cita ya se hubiera confirmado, hecho y cerrado. Ahora se cierra en el momento (el compita confirma o rechaza la hora, el cliente elige otra o reagenda) y, además, la escalera barre cada 5 minutos las que hayan quedado abiertas por cualquier otro camino (`lib/tareas-obsoletas.ts`): sin propuesta vigente, visita terminada o inexistente, o una propuesta ya reemplazada. Lo mismo para «cita sin Telegram» cuando el compita ya tiene Telegram. Cierra también las que ya estaban atascadas.
2. La nota de una tarea larga se podía cortar sin forma de leerla: ahora lleva «Ver más» y «Ver menos».
3. El botón apagado («Insistir al compita» dentro de su espera de 30 minutos o con 3 envíos ya hechos) ahora dice en una línea visible por qué y cuándo vuelve; la razón completa sigue en el ⓘ.
4. Los emojis de las tareas (📅, ⏳, ⚠️) se quitan en el panel, también de las ya guardadas (regla: emojis solo en Telegram). El texto «hace 0 horas» pasa a «hace menos de una hora».
5. Sin migración. Las tareas de seguridad y emergencia se siguen cerrando a mano a propósito.

## 1.2.2-beta.1 (2026-11-16)
Los correos del fin de la visita salen por el sistema de avisos (Nivel 1, parte C).
1. El resumen de la visita (al terminar) y el reporte de bienestar (cuando el compita termina el cuestionario) dejan de enviarse directo desde Telegram: ahora son los avisos `visita_resumen` y `visita_reporte`, que arman el correo al enviar con lo que hay en la base. Así el portal del cliente recibe la novedad en vivo («La visita terminó. Ya puedes calificarla.» y «El reporte de bienestar de la visita está listo.») y el correo es el respaldo: con `CORREO_RESPALDO=diferido` se cancela si el cliente ya lo vio y los dos se juntan en uno solo si llegan seguidos. Apagado, salen al instante como antes.
2. El resumen con IA del reporte se escribe y se guarda en `reportes_visita.resumen_ia` antes de avisar (antes se guardaba después de enviar el correo), así el portal y el correo muestran el mismo texto.
3. Lo que lee el compita en Telegram cambia: «Ya le dejamos el resumen básico a la familia en su portal» y «la familia ya puede ver el reporte en su portal».
4. `lib/resend.ts`: `armarVisitaResumen` y `armarResumenConReporte` arman el contenido sin enviar; `sendVisitaResumen` y `sendResumenConReporte` siguen existiendo para el envío directo. Sin migración nueva.

## 1.2.1-beta.1 (2026-11-16)
El correo al cliente como respaldo del portal (Nivel 1, parte B). Se enciende con `CORREO_RESPALDO=diferido` en Netlify; apagado, todo sale como antes.
1. Cada aviso por correo al cliente ya genera su novedad (el portal se actualiza en vivo). Con el interruptor encendido, el correo espera según la urgencia y si el portal está abierto: lo crítico sale ya; lo demás, 15 minutos con el portal abierto y 3 con el portal cerrado.
2. Si el cliente ve la novedad en el portal, el correo se cancela («ya lo vio en el portal»). Si varios correos del mismo cliente están listos (o por salir en los próximos 5 minutos), salen juntos en UN correo con la lista y un botón al portal («agrupado en un solo correo»).
3. Lo corre el cron de la escalera (cada 5 minutos), antes de los demás pasos (`procesarCorreosDiferidos`, `lib/correos-diferidos.ts`). Solo toca los avisos que nacieron con su novedad; los demás pendientes siguen igual. Un respaldo o reenvío (`respaldoDe`) sale al instante.
4. Manual del equipo: «Un cliente dice que su correo no llegó al instante». Reglas completas en `docs/ciclo-comunicaciones.md`. Sin migración nueva (usa la de 1.2.0).
5. Todavía NO pasan por esta regla los correos que no salen por `notificar()`, como los del fin de la visita (parte C) y algunos del flujo de pago y de Telegram.

## 1.2.0-beta.1 (2026-11-16)
Novedades del cliente y portal en vivo (Nivel 1, parte A: la base). El portal es el centro de mando; el correo pasa a ser respaldo (parte B).
1. Migración `20261116_novedades_cliente.sql` (solo agrega, **la aplica Juan en compaz-prod antes de desplegar**): tabla `novedades_cliente` (lo que le pasa al cliente, con `vista_en` y `actuada_en`) con permiso de lectura solo de las propias y tiempo real, y la columna `usuarios.portal_visto_en`.
2. `lib/novedades.ts` y `lib/novedades-politica.ts`: registrar una novedad (una sola vez por clave), marcar lo visto, el latido del portal y las reglas de cuándo hace falta el correo según la urgencia (crítico, accionable, informativo) y si el portal está abierto (15 minutos con el portal abierto, 3 con el portal cerrado; lo crítico, ya).
3. En el portal (y el dashboard viejo), solo para clientes: `NovedadesEnVivo` escucha las novedades del cliente en tiempo real (la pantalla se actualiza al instante), manda un latido cada 45 segundos con la pestaña a la vista y marca lo nuevo como visto cuando el cliente lo está mirando. Rutas nuevas `POST /api/portal/latido` y `POST /api/portal/novedades/vistas`. Si el tiempo real falla, el portal sigue actualizándose por consultas periódicas.
4. Todavía no se genera ninguna novedad ni cambia ningún correo: eso llega en la parte B.

## 1.1.18-beta.1 (2026-11-16)
Los correos le dicen al cliente que no hace falta hacer clic si ya tiene el portal abierto (hallazgo 14 de la auditoría de flujos).
1. Todo correo al cliente que trae un botón al portal ahora lleva debajo: «Si ya tienes tu portal abierto, no hace falta que hagas clic: se actualiza solo y lo verás ahí.» Así, cuando el cliente ya está viendo su portal y le llega «tu compita confirmó», sabe que no tiene que abrir otra pestaña.
2. Se agrega en un solo lugar, `sendEmail` (el único punto por el que sale todo correo), con `lib/correo-portal.ts`: busca el primer enlace al portal (/dashboard o /portal), pone la nota justo debajo, una sola vez, y deja igual los correos sin botón al portal (sala de videollamada, panel del equipo, enlaces externos). Los correos nuevos la reciben solos.
3. Complementa a «una sola pestaña del portal» (1.1.17). Sin migración.

## 1.1.17-beta.1 (2026-11-16)
Una sola pestaña del portal (hallazgo 13 de la auditoría de flujos).
1. Al abrir el portal desde el botón de un correo teniéndolo ya abierto, se creaba una segunda pestaña idéntica. Un navegador no permite que un enlace (ni una página) pase al frente otra pestaña, así que ahora: la pestaña que ya estaba abierta se actualiza sola (ve lo nuevo sin hacer nada) y la pestaña nueva se queda quieta con un aviso («Ya tienes Compaz abierto en otra pestaña»), intenta cerrarse sola (el navegador solo lo permite a veces) y ofrece «Usar esta pestaña» o «Cerrar esta pestaña».
2. Si el cliente elige usar la nueva, la vieja queda en pausa con el mismo aviso. Si dos pestañas se abren a la vez, solo una queda vigente.
3. Solo para clientes (no para el administrador ni la vista previa), en el portal y en el dashboard viejo. Se comunica entre pestañas del mismo navegador (BroadcastChannel); no manda nada al servidor. Sin migración.

## 1.1.16-beta.1 (2026-11-16)
Teléfonos con país y validación (hallazgo 12 de la auditoría de flujos).
1. Nuevo módulo `lib/telefono.ts` (compartido por el servidor y la pantalla): cada país define cuántos dígitos lleva su número y cómo empieza (Venezuela, EE. UU. y Caribe +1, Colombia, España, México, Panamá, Chile, Argentina, Perú, Ecuador, Brasil, Costa Rica, Portugal, Italia y Reino Unido; cualquier otro con su + y entre 8 y 15 dígitos). Quita el 0 de marcación local, acepta espacios, guiones y paréntesis, y rechaza lo que no existe (operadora inventada, dígitos de más o de menos, letras). Todo se guarda en formato internacional sin espacios (+584145550101).
2. El teléfono del contacto en el sitio (dirección de la visita) ahora tiene país y número por separado (Venezuela por defecto, en dos filas a 375 px), dice en el momento si el número calza con las reglas del país y cómo se guardará («Se guardará como +58 414 555 0101»). El servidor valida igual: ya no basta cualquier cadena de 7 dígitos.
3. Lo ya guardado no se toca; al editar la dirección se reconoce y se muestra bien. No se cambiaron todavía los otros teléfonos del sistema (ficha del cliente, registro del compita, solicitud de postulación): usan una validación más simple. Sin migración.

## 1.1.15-beta.1 (2026-11-16)
La dirección es requisito para agendar una visita (hallazgo 11 de la auditoría de flujos).
1. Antes se podía pedir y confirmar una cita sin haber puesto la dirección (después se perseguía con recordatorios y tareas). Ahora el servidor no deja al cliente pedir la hora (`PUT /api/visita/fecha` responde 409) hasta que registre la dirección y el contacto en el sitio, y el compita no puede confirmarla sin ellos (`confirmarCita` responde `sin_direccion` y Telegram le explica por qué).
2. En el portal, «¿Dónde será esta visita?» va ANTES de la fecha y el botón de confirmar la fecha queda apagado, con un aviso, hasta que se guarde la dirección; se enciende solo al guardarla. Lo mismo en el dashboard viejo.
3. Sin migración.

## 1.1.14-beta.1 (2026-11-16)
Punto rojo con número en el menú del panel (hallazgo 10 de la auditoría de flujos).
1. Junto a Bandeja aparece un punto rojo con el número de tareas NUEVAS que aún no has visto, como los mensajes sin leer: se quita al abrir la Bandeja con la pestaña a la vista y vuelve a aparecer cuando llega algo nuevo. Lo «visto» se guarda en cada navegador, por persona. Junto a Pagos, el número de pagos por confirmar: ese NO se quita al verlo, se va al confirmarlos (es dinero esperando).
2. Está en el menú de escritorio y en la barra del teléfono, solo para quien tiene el permiso de esa sección, con un texto que dice qué cuenta (al pasar el cursor y para lectores de pantalla). La ayuda ⓘ de la Bandeja y el manual lo explican.
3. El número también sale en el título de la pestaña del navegador, por ejemplo «(3) Panel». Se consulta cada 20 segundos con la pestaña a la vista y cada 60 con la pestaña oculta; una sola consulta sirve a todos los puntos. Al resolver una tarea o confirmar un pago se actualiza al instante.
4. Rutas nuevas `GET /api/admin/pendientes-bandeja?desde=` (permiso atender: devuelve `n`, `nuevas` y `ahora`) y `GET /api/admin/pendientes-pagos` (permiso pagos). Solo devuelven números. Sin migración.

## 1.1.13-beta.1 (2026-11-16)
El chat que el equipo revisa se actualiza solo (hallazgo 9 de la auditoría de flujos).
1. El chat entre cliente y compita en el panel se cargaba una sola vez al abrirlo: había que cerrarlo y abrirlo de nuevo para ver mensajes nuevos. Ahora se actualiza cada 10 segundos, solo con la pestaña a la vista, y pide únicamente los mensajes nuevos.
2. Actualizar NO anota un acceso nuevo (serían cientos de líneas en Actividad), pero tampoco se salta el motivo: el servidor solo responde si esa misma persona abrió ese mismo chat en los últimos 30 minutos. Pasado el plazo se detiene y aparece «Seguir viendo», que lo abre de nuevo (un colaborador da su motivo otra vez) y lo anota otra vez.
3. `POST /api/admin/chat` acepta `refrescar: true` y `desde`. Sin migración.

## 1.1.12-beta.1 (2026-11-16)
La Bandeja se actualiza sola y los pagos tienen su pestaña (hallazgo 8 de la auditoría de flujos).
1. La Bandeja no tenía actualización automática (solo Actividad y Estado la tenían): hacía falta recargar a mano. Ahora se actualiza cada 30 segundos, o cada 15 si hay un pago por confirmar, y solo con la pestaña a la vista (`AutoRefresh`: no gasta recursos con la pestaña oculta).
2. Pestaña nueva «Pagos» (permiso de pagos): arriba «Por confirmar» (con el tiempo que lleva esperando cada uno y el botón Confirmar pago) y debajo los pagos registrados y anulados. También se actualiza sola. La tarea de pago sigue en la Bandeja.
3. `POST /api/admin/confirmar-pago` acepta `solicitud_pago_id` además de `flag_id`; el monto y el cliente siempre salen del servidor. Sin migración.

## 1.1.11-beta.1 (2026-11-15)
Ver el perfil público de cada compita, tal como lo ve la familia (hallazgo 7 de la auditoría de flujos).
1. En la ficha del compita, el botón «Ver perfil público» abre `/panel/perfil-publico/[id]`: el mismo perfil que ve la familia (foto, sobre mí, servicios, zonas, disponibilidad, video y reseñas publicadas), con lo que el compita llenó. Funciona aunque aún no esté verificado y dice qué le falta para aparecer en el listado.
2. La pieza del perfil se sacó del listado de la familia a `components/ui/PerfilPublicoCompita.tsx`: ahora el equipo y la familia ven exactamente lo mismo.
3. Solo con el permiso de cuentas, solo lectura, sin teléfono ni correo. Sin migración.

## 1.1.10-beta.1 (2026-11-15)
«Todo de este compita» y «Todo de este cliente» en la ficha de Personas (hallazgo 6 de la auditoría de flujos).
1. Para revisar la calidad sin salir de la ficha. Compita: foto, enlace a su video, cómo lo ve la familia (descripción, servicios, horarios), calificaciones y reseñas (con si están publicadas), solicitudes y visitas. Cliente: ficha del familiar, plan, solicitudes, visitas y reseñas que escribió.
2. Solo con el permiso de cuentas y solo lectura. Nunca lleva teléfono ni correo. La condición y las notas de salud del familiar las ve solo un administrador.
3. Sin migración.

## 1.1.9-beta.1 (2026-11-15)
Responder una duda del compita desde el panel (hallazgo 5 de la auditoría de flujos).
1. La tarea «Duda sin resolver» ahora tiene el botón «Responder por Telegram»: el equipo escribe la respuesta en el panel (hasta 800 caracteres, sin teléfonos ni correos) y el bot se la envía al compita como mensaje del equipo. Antes la tarea decía «respóndele por Telegram» y no había cómo hacerlo desde el sistema.
2. Al enviar, la tarea se cierra y queda un evento con quién respondió y qué dijo. Si Telegram falla o el compita no lo tiene vinculado, la tarea sigue abierta y se explica por qué.
3. Ruta nueva `POST /api/admin/responder-duda` (permiso «atender»). Sin migración.

## 1.1.8-beta.1 (2026-11-15)
El portal muestra la hora elegida para la entrevista (hallazgo 4 de la auditoría de flujos).
1. Tras elegir hora, la tarjeta dice «Esperando que X confirme tu hora», la hora que eligió (en su hora y en la de Caracas) y que está pendiente de confirmar por el compita.
2. Solo cambia texto y lectura: no requiere migración.

## 1.1.7-beta.1 (2026-11-15)
Seguridad del lugar en la solicitud del cliente (hallazgo 3 de la auditoría de flujos).
1. Con lugar privado, el formulario exige además: si hay animales; y, si estará alguien más, si habrá menores de edad y si estarán toda la visita o solo una parte. Opcional: «hay alguien con quien el compita no debe quedarse a solas». Todo por opciones, sin nombres ni texto libre.
2. El compita lo ve en el aviso de Telegram antes de aceptar; la precaución sale como advertencia y le recuerda que puede no aceptar.
3. Migración `20261115b_solicitud_datos_lugar.sql` (solo agrega la columna `solicitudes.datos_lugar`; la aplica Juan en compaz-prod antes de desplegar). Las solicitudes anteriores no muestran nada.

## 1.1.6-beta.1 (2026-11-15)
Casillas de servicios futuros del compita (hallazgo 2 de la auditoría de flujos).
1. Voluntariado y cuidado de mascotas: sin iconos y solo con de qué trata el servicio (se quitó la lista de preguntas futuras).
2. Las casillas «Quiero ofrecer este servicio» ya funcionan: guardan el interés en `compitas.intereses_futuros` desde el registro, la corrección y el perfil. La ficha del panel lo muestra.
3. Migración `20261115_compita_intereses_futuros.sql` (solo agrega una columna con valor por defecto; la aplica Juan en compaz-prod antes de desplegar).

## 1.1.5-beta.1 (2026-11-15)
Texto del onboarding del compita en masculino (hallazgo 1 de la auditoría de flujos).
1. `/onboarding`: «Bienvenida a Compaz» pasa a «Bienvenido a Compaz» y «recibir visitas» a «recibir solicitudes». El compita siempre va en masculino.
2. Solo cambia texto: no requiere migración.

## 1.1.4-beta.1 (2026-11-13)
Permisos del registro de sincronizaciones del CMC (corrección tras el traslado a Virginia).
1. Migración `20261113b_cmc_sincronizaciones_permisos`: `service_role` vuelve a tener solo lectura y alta sobre `cmc_sincronizaciones` (lo aprobado en la `20261111`). Al copiar la base a `compaz-prod` había quedado con todos los privilegios. Solo cambia privilegios: no toca datos, columnas, restricciones ni RLS. Es idempotente y no depende del historial de migraciones.
2. Comprobación de solo lectura `tests/sql/cmc_sincronizaciones_permisos.sql` y prueba local completa `tests/sql/cmc_permisos_local.sh` (estado de `compaz-prod`, corrección aplicada dos veces, datos intactos y operaciones de la web).
3. Sin cambios de código: no requiere despliegue por sí sola.

## 1.1.3-beta.1 (2026-11-12)
Personas sin viajes al servidor.
1. Personas recibe la lista completa una vez; ordenar, filtrar por vista o estado, buscar (letra por letra) y cambiar de página se resuelve en el navegador (`PersonasInteractivo`, `lib/panel-personas-cliente.ts`). La dirección se mantiene al día con `history.replaceState` (con un retraso corto): refrescar o compartir el enlace restaura el mismo estado. Abrir una ficha o un chat sigue yendo al servidor.
2. Medido en producción tras la 1.1.2: el contenido completo de cada pantalla llega en 250 a 450 ms casi siempre (antes 700 a 1750 ms); quedan picos ocasionales de 600 a 860 ms por arranque en frío de la función.
3. Se documenta el cambio de producción a Virginia y la vuelta atrás.

## 1.1.2-beta.1 (2026-11-12)
El panel se siente inmediato.
1. El menú y el encabezado del panel salen al instante; los datos de cada pantalla llegan después, con un esqueleto gris mientras tanto (`app/panel/loading.tsx` y `ContenidoPanel` dentro de `Suspense`).
2. Los enlaces del panel ya no precargan: cada precarga ejecutaba la pantalla entera en el servidor (decenas de peticiones en segundo plano que gastaban créditos de Netlify y competían con lo que hacía la persona).
3. El proxy de /panel y /admin ya no consulta a Supabase Auth en cada pantalla (solo renueva la sesión); la página sigue verificando al usuario.
4. Más, Estado, Velocidad: botón para el administrador que mide la latencia entre el servidor y la base.

## 1.1.1-beta.1 (2026-11-12)
Preparación de la migración de Supabase a Virginia.
1. La dirección de Supabase en la política de seguridad del navegador (CSP) ya no está escrita a mano: sale de `NEXT_PUBLIC_SUPABASE_URL`. Cambiar de proyecto (o volver atrás) es solo cambiar la variable.
2. Scripts de migración (`scripts/migracion/`) y plan (`docs/migracion-supabase-virginia.md`).

## 1.1.0-beta.1 (2026-11-12)
Integración del CMC de Luis con el panel nuevo, en un solo sistema.
1. La ficha del compita muestra su estado en el CMC: ID COM-, si el CMC lo permite, último cambio y lo que le falta para recibir solicitudes.
2. Si el CMC no permite a un compita, el panel no deja verificarlo ni activarlo (el servidor también lo rechaza); quitar la verificación o desactivar siempre se puede.
3. La alta manual y la invitación por enlace no duplican un perfil que ya existe desde el CMC.
4. Entra la rama `feat/cmc-compitas`: ruta `POST /api/cmc/compitas`, sincronización de compitas habilitadas, guardas de `cmc_permite` en solicitudes y asignaciones, y vigilancia de la foto horaria.
5. El panel viejo no vuelve: lo que Luis había puesto en el dashboard viejo ahora vive en la ficha del panel nuevo.

## 1.0.0-beta.1 (2026-11-12)
Primera versión completa del panel nuevo `/panel` (sustituye al `/admin` viejo).
1. Panel con datos reales: Bandeja, Personas, Seguimiento, Visitas y Más (reseñas, pagos, avisos, cobertura, equipo y permisos, ajustes, postulaciones y origen (CMC), invitar, actividad, registro de accesos, límites, manual, estado).
2. Ajustes conectados, llamadas en sala incrustada con aviso de fin, esperas explicadas y permisos por colaborador.
3. Dos rondas de auditoría resueltas, rendimiento del Seguimiento, validación de correos y eliminar cuenta conservando el historial.
4. Líneas de servicio futuras como "Próximamente" y sección "Cuidador de mascotas" en el perfil del compita.
5. Emojis solo en Telegram y en las estrellas de calificación.
6. Incluye la integración de CMC desde Supabase de Luis.

Pendiente para salir de beta: probar Telegram, llamadas y avisos en vivo; Stripe; texto legal; claves de Turnstile; base de pruebas separada y respaldos.
