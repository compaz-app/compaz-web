# Prototipo del rediseño: registro de cambios

Ubicación: `app/prototipo/` (ruta `/prototipo`). Solo maqueta con datos falsos: no toca la base de datos, ni Netlify, ni ningún archivo existente. Se puede borrar la carpeta sin efectos. Este archivo se actualiza con cada cambio. El directorio no es un repositorio git, así que este registro hace de historial.

## Pantallas

1. `/prototipo`: índice.
2. `/prototipo/cliente`: portal del cliente. Línea de 5 pasos y una tarjeta con lo que toca. Selector con 7 estados.
3. `/prototipo/compita`: maqueta del chat de Telegram. Botones dentro del mensaje, "Simular siguiente aviso" y "¿Qué me toca?".
4. `/prototipo/admin`: admin tipo CRM con Bandeja, Seguimiento, Personas (compitas), Visitas (140 visitas falsas) y Más (centro de herramientas).

## Cambios en orden

1. Creación de las 3 pantallas y del índice.
2. Seguimiento: se quitó el tablero de columnas con scroll lateral. Ahora 6 fichas con número por etapa y una lista vertical debajo. Filtro en la URL.
3. Bandeja: de tarjetas grandes a filas de una línea, con filtros por tipo con número, paginación de 10 en 10 y 30 tareas de prueba.
4. Roles visuales: cliente en púrpura y compita en naranja, con etiquetas "Cliente" y "Compita".
5. El compita en Seguimiento es clicable y abre su ficha. El resto de la fila abre la ficha del cliente.
6. Semáforo del círculo del cliente (verde, amarillo, rojo) según etapa y horas esperando. Umbrales en `UMBRALES` (Solicitud 6 y 24 h, Entrevista 1 y 3 h, Decisión 2 y 24 h, Pago 2 y 12 h, Activo 24 y 72 h). Con leyenda.
7. Personas: 100 compitas falsas en tabla con vistas rápidas (Todas, Disponibles, Con cupo, Sin respuesta 24h, En pausa, Nuevos sin verificar), orden por columna, búsqueda y paginación de 25. Semáforo propio del compita. Columnas que se ocultan según el ancho para evitar scroll lateral.
8. Bandeja: cada fila muestra cliente y compita con su rol y su etiqueta, ambos clicables. Los botones dicen a quién van ("Recordar al cliente", "Insistir al compita", "Reintentar aviso").
9. Visitas: 140 visitas de prueba (25 clientes falsos con ficha) con vistas Hoy, En curso, Próximas, Terminadas, Con problema y Todas, cada una con número. Sin pestaña Historial: lo cerrado vive en Terminadas. Cliente y compita con su rol, estado con color, estrellas y paginación de 25. "Con problema" agrupa no se presentó, canceladas y calificación de 3 o menos.
10. Visitas: se quitó el estado ficticio "Cancelada"; "Con problema" muestra el motivo de cada fila. Cliente: se quitaron los botones "Necesito ayuda" y "Mi historial". Telegram: se quitaron "Ver detalles" y "Voy con retraso", y "Llegué" pasó a "Iniciar visita" (el botón real del bot).
11. Emergencia: nueva tarea fija arriba y en rojo en la Bandeja, con banner de alerta y filtro propio; en la maqueta de Telegram, botón "🚨 Emergencia" durante la visita (refleja el flujo real).
12. Más: centro de herramientas con 7 tarjetas y seis subvistas con datos falsos (Reseñas por aprobar, Postulaciones y origen, Pagos con anular, Avisos enviados con reintento, Cobertura y demanda por zona, Ajustes del semáforo). Cada tarjeta lleva la etiqueta "Existe hoy" o "Requiere base nueva".
13. Portal del cliente: tres estados nuevos durante la visita (el compita llegó, visita en curso con videollamada y chat, visita terminada con reporte de bienestar y calificación). El chat censura teléfonos y correos y muestra el aviso, igual que `lib/chat-moderacion.ts`.
14. Nueva pantalla `/prototipo/cliente/elegir`: elegir compita con filtros (zona, orden, con video), lista con foto, calificación y visitas, ficha en panel, contador de solicitudes (máximo 3), elección de hasta 3 horarios y envío. Banner naranja si hay una entrevista aceptada.
15. Bandeja: nueva tarea "Contacto bloqueado" (el chat censuró un teléfono o correo), que corresponde al flag que ya crea `chat-moderacion`.
16. Login del cliente (`/prototipo/cliente/entrar`): correo, pantalla "Revisa tu correo" con aviso de usar el enlace más reciente, cuenta atrás visible para pedir otro enlace (hoy el límite de 1 por minuto es silencioso), y opción de código de 6 números. Llega al portal justo al paso donde estaba.
17. Portal del cliente con 4 secciones fijas abajo: Inicio, Visitas, Mi familiar y Mi plan. Visitas: próxima visita, cambiar fecha, agendar otra, anteriores con reporte. Mi familiar: formulario de 4 campos. Mi plan: plan, visitas restantes, renovación, pagos y cerrar sesión.
18. Recorrido guiado de un cliente nuevo (`/prototipo/recorrido`, ahora la entrada del prototipo): 16 pasos en 7 fases (llegar, entrar, elegir, entrevista, pagar, visitas, después). En cada paso se ven lado a lado el cliente, el Telegram del compita y el admin, con "qué pasa" y "qué se registra". Flechas del teclado para avanzar. En pantallas angostas, pestañas Cliente, Compita y Admin.
19. El Telegram del compita acepta `hasta=N` para abrirse ya avanzado. El estado de cada pantalla puede vivir en memoria (EmbedProvider) para mostrar varias a la vez.
20. Paso 1 del recorrido con el texto real de micompaz.com y el slogan "Cerca aunque estés lejos"; el formulario pide estado y teléfono (antes yo había inventado un correo).
21. Mapa del ciclo (`/prototipo/ciclo`): 8 reglas y, para cada uno de los 16 pasos, quién actúa, aviso, botón, destino, escalera si no actúa y dato registrado. Cada paso del recorrido muestra su aviso, botón y escalera. Detalle en `docs/ciclo-comunicaciones.md`.
22. Anotado para diseñar (no construido): respaldo por correo para el compita, en escalera (Telegram, correo si falla o no actúa, Bandeja). Ver `docs/ciclo-comunicaciones.md`.
23. Anotado para diseñar (no construido): botón de ayuda por paso con escalera de tres intentos y salida a un humano. Ver `docs/ciclo-comunicaciones.md`.
24. Decisiones del usuario (2026-11-03): la visita muestra reportes con fotos y notas, sin videollamada (portal "Visita en curso" ahora con "Novedades de la visita" y chat; el reporte final con fotos); canal humano solo tras 3 o 4 intentos de ayuda; los administradores invitan a clientes y compitas en esta fase.
25. Corrección de género en el prototipo y los documentos: "el compita", "los compitas".
26. Esc cierra la ficha.

Nota técnica: no se usaron iframes porque las cabeceras de seguridad actuales (`X-Frame-Options: DENY`, `frame-ancestors 'none'` en `next.config.ts`) los bloquean. No se modificó esa configuración. Estado en la URL (pestaña, filtros, ficha abierta).

## Observaciones del usuario (revisión)

Hechas:
1. Seguimiento con scroll lateral incómodo: resuelto (cambio 2).
2. Bandeja con tarjetas demasiado grandes para 1000 clientes: resuelto (cambio 3).
3. Confundir cliente y compita en Seguimiento: resuelto (cambios 4 y 5).
4. Círculo con inicial sin utilidad: ahora indica urgencia (cambio 6).
5. Bandeja sin decir quién es el cliente y quién el compita: resuelto (cambio 8).
6. Personas con 100 compitas, útil y sin scroll infinito: resuelto (cambio 7).

Pendientes de construir en el prototipo:
1. Vistas de rendimiento en Personas: mejores, menos activos, no responden, en riesgo.
2. Columna "Visitas al perfil", marcada como pendiente de datos.
3. Acciones en la fila del compita: escribirle con plantilla, pausar, retirar, anotar llamada.
4. Mostrar en la Bandeja el canal y el motivo del aviso fallido (Telegram, correo, "bot bloqueado").
5. Lista de clientes con el mismo formato que la de compitas (hoy Personas muestra solo compitas).
6. Revisar el prototipo en el celular (Bandeja, Seguimiento y Personas no se midieron a 375px tras los últimos cambios).
7. Distribución más realista de los datos falsos (salen demasiadas compitas en rojo).

Aún por revisar por el usuario: parte del portal del cliente y maqueta de Telegram. Observación del usuario: el portal del cliente solo cubre un 20% del dashboard real; falta mi familiar, plan y pagos, visitas (próximas, reagendar, historial), bienestar en el tiempo, primer acceso y cuenta.

## Mapa de botones: cada uno con su función real

Regla del usuario (2026-11-03): ningún botón es cosmético. Cada botón debe ejecutar algo que se pueda construir con lo que ya existe y debe dejar un dato registrado. Estado: EXISTE (ya funciona hoy), PEQUEÑO (se construye sobre algo existente) o REQUIERE BASE (depende del registro de eventos o de la tabla de avisos).

Portal del cliente:
1. Ver otros compitas: EXISTE (marketplace `/compitas`).
2. Elegir horario y Cambiar horario: EXISTE (`/reagendar`, `api/solicitud/proponer-reagendado`).
3. Entrar a la entrevista: EXISTE (`/sala`).
4. Sí quiero contratarla y No, ver otras: EXISTE (`api/solicitud/resultado-llamada`, `confirmacion-llamada`).
5. Ya hice el pago: EXISTE (`api/pago/solicitar`, crea `solicitudes_pago`).
6. Ver mis visitas: EXISTE (dashboard).
7. Quitados por no tener función definida: "Necesito ayuda" y "Mi historial". Volverlos a poner solo cuando se defina qué hacen.

Telegram del compita:
1. Aceptar y No puedo: EXISTE (`api/solicitud/responder`).
2. Confirmo que puedo: EXISTE (confirmar horario). Necesito otra hora: EXISTE (`api/solicitud/reagendar-compita`).
3. Entrar a la entrevista: EXISTE (botón con enlace a `/sala`).
4. Emergencia: EXISTE (botón del teclado durante la visita, `telegram-webhook`). Avisa al admin por Telegram y por correo y crea una alerta en `admin_flags`, que el dashboard muestra en tiempo real.
5. Iniciar visita: EXISTE (el bot ya tiene el botón; pasa a `confirmando_inicio` y el cliente confirma).
6. ¿Qué me toca?: PEQUEÑO (comando nuevo que lee solicitudes y visitas).
7. Quitados: "Ver detalles" y "Voy con retraso" (no existen flujos para ellos).

Portal del cliente (visita y elegir compita):
1. Pedir entrevista y enviar solicitud: EXISTE (`api/solicitudes`, máximo 3).
2. Confirmar y empezar (llegada del compita): EXISTE (`api/visita/confirmar-inicio`, se confirma sola a los 5 min).
3. Entrar a la videollamada y chat: EXISTEN (`VideoCall`, `Chat`, con moderación de contactos que crea una alerta).
4. Reporte de bienestar y calificación: EXISTEN (`reportes_visita`, `api/visita/rating`, `api/visita/feedback`).
5. Ver video de presentación: EXISTE el dato (`compitas.youtube_url`).
6. Filtro "Con video" y orden por calificación o visitas: EXISTEN los datos; el filtro por zona ya existe en el marketplace.

Login y secciones del cliente:
1. Enlace por correo: EXISTE (`api/auth/solicitar-acceso`). Cuenta atrás visible en lugar del límite silencioso: PEQUEÑO (el límite ya existe, falta devolver los segundos que faltan).
2. Código de 6 números: PEQUEÑO pero por verificar. Supabase permite código por correo, falta confirmar la plantilla del correo y una ruta que lo verifique.
3. Entrar directo si ya hay sesión y volver al destino original: PEQUEÑO (`requireAuth` hoy olvida el destino).
4. Cambiar fecha u hora: EXISTE (`api/visita/reagendar`). Agendar otra visita: EXISTE (`AgendarOtraVisita`).
5. No se incluyó "Cancelar visita": `api/visita/cancelar` solo funciona en `pre_visita` y borra la visita.
6. Guardar datos del familiar: EXISTE (`PerfilFamiliar`). Cambiar o renovar plan: EXISTE (`PlanesPago`). Cerrar sesión: EXISTE (`LogoutButton`).
7. Visitas restantes del ciclo: EXISTE (`cupoDelPlan`).

Admin:
0. Contacto bloqueado (Marcar revisada): EXISTE la alerta (`chat-moderacion` crea un flag en `admin_flags`).
0. Emergencia (Marcar atendida): EXISTE la alerta (`admin_flags` con `resuelto`); en la Bandeja va fija arriba, en rojo. Debilidades actuales a corregir: el "visto" del banner vive solo en la pantalla (se pierde al refrescar), la alerta se distingue por el texto del nombre y no por un tipo propio, no queda quién la atendió ni cuándo, y si no hay visita en curso la alerta sale como "sin-visita".
1. Confirmar pago: EXISTE (`api/admin/confirmar-solicitud`).
2. Recordar al cliente e Insistir al compita: PEQUEÑO (reenvío manual de un aviso; hoy hay crons automáticos, falta el disparo manual). Registran un evento.
3. Reintentar aviso: REQUIERE BASE (tabla de avisos con `notificar()`).
4. Abrir ficha y filtros: EXISTE (solo lectura de datos).
5. Notas internas: REQUIERE BASE (tabla nueva).
6. Acciones sobre el compita (escribirle con plantilla, pausar, retirar): pausar y retirar EXISTEN (`toggle-estado`, `bloquear-compita`, `eliminar-compita`); escribirle con plantilla REQUIERE BASE (avisos).

## Más: qué hay detrás de cada tarjeta

1. Reseñas por aprobar: EXISTE. Tabla `resenas` con `publicada` (el admin aprueba antes de mostrar) y `api/admin/resenas`.
2. Postulaciones y origen: EXISTE si la migración `20261022_captacion.sql` está aplicada. `postulaciones` ya guarda fuente y utm_source, utm_medium y utm_campaign. Eso ya cubre el dato "origen" para postulaciones. Falta ligar el origen al cliente cuando se convierte.
3. Pagos con anular: EXISTE (`api/admin/pagos`, `anular-pago`).
4. Avisos enviados con reintento: REQUIERE BASE (tabla de avisos y `notificar()`).
5. Cobertura y demanda: el mapa de cobertura EXISTE. La comparación oferta contra demanda es una consulta nueva (compitas activos por zona frente a clientes y solicitudes por zona).
6. Ajustes del semáforo: REQUIERE BASE (tabla de ajustes; hoy los umbrales están en el código).
7. Invitar cliente y registrar compita: EXISTEN (`api/admin/invitar-cliente`, `generar-invite`, `registrar-compita`). No se rediseñan.

## Cómo se determina "Con problema" (Visitas)

Cada fila muestra el motivo. Reglas con datos reales:
1. No se presentó: visita programada que no inició 30 min después de su hora. El cron `noshow-alerta` ya lo detecta pero solo avisa por Telegram y no guarda marcador. Falta guardar el evento.
2. Calificación baja: `visitas.rating_cliente` de 3 o menos.
3. Candidatas a añadir con datos existentes: retraso al iniciar (`inicio` contra `hora_inicio_programada`), duración anormal, reporte de novedad del compita, alerta manual (`admin_flags`).
4. Cancelaciones: hoy `api/visita/cancelar` BORRA la visita (solo en `pre_visita`) y no deja rastro. Para medir cancelaciones hay que registrar un evento antes de borrar. Quitado "Cancelada" como estado de la maqueta porque no existe.
5. Un problema queda abierto hasta que alguien lo resuelve con una nota. Los umbrales (30 min, 3 estrellas) deben ser ajustes configurables.

## Datos prioritarios anotados

Los 5 datos que se recomienda empezar a registrar (visitas al perfil y clics en solicitar, motivo del "no", origen del cliente, entrega de avisos, oferta y demanda por zona) están detallados al inicio de `docs/crm-datos-pendientes.md`.

## Decisiones abiertas

0. Corrección de género: "el compita", "los compitas". Los textos del prototipo que dicen "el compita" están por corregir.

1. Nombre completo o inicial del apellido del compita ante el cliente.
2. Grabar las llamadas o no.
3. WhatsApp para clientes.
4. Portal web paral compita (hoy la recomendación es Telegram con botones como base).
5. Pagos en pestaña propia o dentro de "atención".
6. Los tiempos del semáforo (propuestos, a ajustar).

## Viabilidad con datos reales

Ver `docs/crm-datos-pendientes.md`. Base obligatoria: registro de eventos y tabla de avisos con `notificar()`.

## Actualización del prototipo con las decisiones de los puntos 1 a 6 (2026-11-04)
Cliente: formulario nuevo `/prototipo/cliente/solicitar` (Hablar primero, Contratarlo directo, Mandado de $22; "¿Qué necesitan?", nota opcional de 300 caracteres con primer aviso de contacto, lugar privado, foto opcional, familia precargada, sin horarios); el perfil del compita ya no pide horarios y muestra "María P." hasta el pago; portal con estados nuevos (contratación directa, pago en revisión con "¿No recibiste el correo?", ficha obligatoria con consentimiento, agendar con horarios del compita y dirección por cita, esperando confirmación, llegada con foto, nadie abre con cuenta atrás de 30 min, visita interrumpida, videollamada posterior al pago, cancelación gratis a 24 h); precios a $22 y planes reales.
Compita (Telegram): contratación directa, cita para confirmar, dirección 3 horas antes, llegada con foto, "nadie abre", "¿Todo bien?", videollamada; teclado fijo con Emergencia y "No me siento seguro" (con motivos y "no quiero volver con este cliente").
Admin: tareas nuevas en la Bandeja (nadie abre, no me siento seguro, visita alargada, ficha incompleta, reporte de un compita, cancelación tardía, segunda detección de contacto, pago urgente) y en Más: Ajustes, Cancelaciones de compitas, Registro de actividad y Estado del sistema.
Ciclo y recorrido: 25 pasos alineados (antes 16). Código de acceso de 8 dígitos.


## Portal del cliente: cierre de huecos (2026-11-10)
Comparado con el portal real (`/dashboard`): "Primer acceso" del real es la ficha con términos, que el prototipo ya tiene (estado 8), así que no faltaba. Agregado: (1) estado "1d. María ya recibió tu solicitud" (se apoya en que el aviso al compita quedó entregado, no en que lo haya leído, porque Telegram no lo permite); (2) estado "19. El equipo canceló tu visita (sin costo)", igual al correo neutro real; (3) "Cómo ha estado tu mamá" en Mis visitas (cliente recurrente): los 4 indicadores del reporte con flecha frente a la visita anterior, como el real. Verificado a 375 px sin desborde. Cuenta y privacidad: DECIDIDO (ver más abajo). Pendiente del prototipo: maqueta de Telegram (reportar un problema con un cliente y recordarle al cliente), admin (llamada a compitas con plazo en Atención, pestaña Actividad, Estado del sistema) y el icono de info en cada botón.


## Eliminar mi cuenta (decidido por el usuario y hecho en el prototipo, 2026-11-10)
Derecho del cliente a borrar sus datos sin escribirle a nadie. DECISIONES: (1) Se borra el nombre, el contacto, la ficha del familiar con su dirección y notas, las fotos y los mensajes; se CONSERVAN los registros de pagos y de visitas ANONIMIZADOS (sin datos que identifiquen), por contabilidad y seguridad. (2) Saldo no usado: las visitas de cada pago ya caducan a los 60 días (`VIGENCIA_CREDITOS_DIAS`), así que al eliminar se pierden; la pantalla muestra cuántas quedan y cuándo vencen, ofrece agendarlas antes, y los reembolsos se tratan con el equipo (`TEXTO_REEMBOLSO`), nunca automáticos. (3) Borrado con plazo de 7 días: la cuenta queda desactivada de inmediato y se borra de forma definitiva al cumplirse; si el cliente entra con su correo antes, la reactiva. (4) Las visitas programadas se cancelan sin costo y al compita se le avisa de forma neutra, sin decirle que el cliente eliminó su cuenta. Confirmación por enlace al correo (vence en 1 hora), como el acceso, para evitar borrados por error o por un tercero. Prototipo: `app/prototipo/cliente/CuentaEliminar.tsx` en "Mi plan" (pasos en la URL: `cuenta=eliminar|enviado|desactivada`) y `app/prototipo/InfoBoton.tsx` (el ⓘ de cada botón). Verificado a 375 px, con el ⓘ abriendo y cerrando. PARA EL SISTEMA REAL: ruta propia del cliente (hoy solo existe `admin/eliminar-cliente`, solo raíz), tabla o columna de desactivación con fecha de borrado, cron de borrado definitivo en la limpieza diaria, anonimizar pagos y cancelaciones en vez de borrarlos, cancelar visitas abiertas con aviso neutro (ya existe la plantilla `cancelacion_equipo_cliente`), reactivación al entrar, correos de confirmación y de borrado. Antes del lanzamiento, que un abogado revise el texto.


## Maqueta de Telegram y admin del prototipo: lo que faltaba (2026-11-10)
MAQUETA DEL COMPITA (`app/prototipo/compita/page.tsx`): (1) teclado como el real: "❓ ¿Qué me toca?" y "🙋 Tengo una duda" en la misma fila, Emergencia y No me siento seguro debajo; (2) en el menú de dudas, "🚩 Reportar un problema con un cliente" con las preguntas de un toque (cliente, qué pasó con 5 motivos, cuándo, ¿estás bien ahora?, ¿ya había pasado?, ¿no volver con él?, y solo en los motivos leves ¿quieres que te llamen?). Lugar no seguro, pagos fuera de Compaz y "necesito ayuda" SIEMPRE llevan llamada; el mensaje final promete "te llamaremos en las próximas 24 horas"; (3) alternativa 15: "⏳ Esperando a Ana" con el botón "🔔 Recordarle a Ana" (correo de Compaz, sin datos del compita, cada 12 horas y máximo 3). Los botones de Telegram no llevan ⓘ: Telegram no lo permite; ahí cada botón se explica en el propio mensaje.
ADMIN: (1) la tarea "Reporte de un compita" ahora dice el plazo y su botón es "Registrar la llamada", que abre una ventana con el plazo de 24 horas, lo que sigue abierto con ese cliente, "Cancelar y avisar al cliente" y las cuatro decisiones (resuelto, hablar con el cliente, mantener o levantar el bloqueo); queda en el Registro de actividad; (2) nueva vista "Actividad" en Más (feed con tres niveles, filtros de tipo y de días y búsqueda, todo en la URL); (3) Estado del sistema suma "Timbre de Telegram" (urgencias de la última hora frente al tope) y "Llamadas pendientes a compitas"; (4) cada botón de la Bandeja lleva su ⓘ con lo que hace (15 textos). DIFERENCIA A RESOLVER AL PASAR A LO REAL: en el sistema real "Actividad" es una pestaña propia junto a Atención; en el prototipo está dentro de Más. Verificado a 375 px: llamada completa, filtros de Actividad con URL y sin desborde.
PENDIENTE DEL PROTOTIPO: el ⓘ en el resto de botones del admin (Seguimiento, Personas, Visitas, Más y sus vistas), en el portal del cliente y en la página de entrar; y revisar a 375 px lo ya modificado.


## El sistema se explica solo (prototipo, 2026-11-10)
Pantalla "Límites y esperas" en Más del admin (13 reglas, cada una con quién la ve, valor de hoy y por qué existe; las razones se importan de `lib/esperas.ts`, el mismo catálogo del sistema real). Telegram del compita: tras "🔔 Recordarle a Ana" aparece "🔔 Recordarle otra vez", que explica la espera de 12 horas y a qué hora vuelve. Portal del cliente (pago en revisión): "Contactar a Compaz" una segunda vez explica por qué no se avisa de nuevo y cuándo se podrá (30 minutos). Entrar: bajo la cuenta atrás se explica por qué se espera un minuto entre correos. Verificado a 375 px.

Ajuste posterior (poco texto a la vista): en el prototipo, la razón de cada límite y las introducciones de Actividad, Límites y Estado del sistema pasaron a un ⓘ; lo visible es una línea corta. Telegram usa un bloque desplegable ("🔎 ¿Por qué?"). Verificado a 375 px.


## Repaso del ⓘ en todos los botones (prototipo, 2026-11-10)
CRITERIO: lleva ⓘ todo botón que ACTÚA (envía, cancela, confirma, guarda, anula, invita, pide, abre algo sensible) y todo botón cuyo efecto no es obvio. NO lleva ⓘ la navegación pura (pestañas del menú, Volver, Cerrar, paginación, "Ver N más"), los chips de filtro (un ⓘ por grupo que explica los filtros) ni las opciones de un formulario que ya se explican con su etiqueta. Los botones de Telegram no pueden llevarlo: ahí cada botón se explica en el propio mensaje. HECHO: ADMIN: confirmación de motivo y "Ver el chat", "Ver el chat con..." de la ficha, "Ver teléfono", Aprobar y Ocultar reseñas, Anular pago, acciones de reintento de avisos, Guardar ajustes del semáforo, Guardar y aplicar y Deshacer de Ajustes, Volver a lo recomendado y Invitar del equipo, y los filtros de Bandeja, Seguimiento, Visitas y Avisos. PORTAL DEL CLIENTE: todos los botones principales y secundarios de la tarjeta de estado (16 textos en `INFO_BOTON`), Cancelar y Cambiar o cancelar la visita, Sí cancelar, Agendar otra visita, Guardar la ficha, Cambiar o renovar plan, Cerrar sesión, Pedir este horario, Enviar a María y Reenviar la confirmación. ENTRAR: Enviarme el enlace, Usar un código, Entrar, Escribirnos e Intentar con otro correo. ELEGIR Y SOLICITAR: Ver video, Hablar primero, Contratarlo directo, Pedir un mandado, Foto de tu familiar y Enviar la solicitud. Componente compartido `app/prototipo/ConInfo.tsx`. SIN ⓘ A PROPÓSITO: los iconos de WhatsApp y correo y el botón "Chat" que se repiten en cada fila (llevarían un ⓘ por fila y ensuciarían la lista; ya tienen título y etiqueta), y los controles propios del prototipo (Simular siguiente aviso, Reiniciar). Verificado a 375 px sin desborde.

Revisión de adaptación a móvil, tablet y escritorio (2026-11-10): verificado a 375, 768 y 1280 px en el admin (Bandeja, Personas, Actividad, Límites), el portal del cliente, solicitar y la maqueta de Telegram: sin desbordes. El admin usa menú lateral en escritorio y barra inferior en móvil. El portal del cliente y la maqueta de Telegram son una columna centrada a propósito (es lo que se ve en un teléfono); la barra inferior del portal ya no se estira por toda la pantalla en escritorio, queda centrada con el ancho del contenido. DECIDIDO (mentor, 2026-11-10): el portal es una columna única centrada en todos los tamaños (patrón de los flujos de una acción por pantalla: más amable, más rápido y con menos código que mantener). En escritorio sube a 672 px y el menú pasa ARRIBA como pestañas (la barra inferior es un patrón de móvil y solo se muestra en móvil). Verificado a 375 y 1280 px.


## Manual del equipo (prototipo, 2026-11-10)
Nueva herramienta en Más: "📖 Manual", que explica todas las funciones del sistema POR PREGUNTAS ("¿qué hago cuando...?"), para administradores y colaboradores. Contenido en `lib/manual.ts` (módulo puro, el mismo que usará el panel real): 5 secciones (Para empezar, El día a día, Qué hago cuando…, Cuentas y personas, Configuración y control), 37 entradas con "para qué sirve", pasos numerados y "qué pasa después", y dos listas AUTOMÁTICAS que se arman solas desde el sistema y nunca quedan viejas: qué puede hacer cada permiso (catálogo de permisos) y los límites y esperas con su razón (catálogo de esperas). Buscador con tus palabras (sin tildes ni mayúsculas, todas las palabras, ordenado por relevancia: lo que habla DE pago va antes que lo que solo lo menciona), secciones y pregunta abierta guardadas en la URL, un ⓘ de introducción, y "Ir a esta pantalla" en cada entrada. Con permisos: un colaborador ve igual toda la pregunta pero con candado y el permiso exacto que necesita. PRUEBAS (`tests/60-manual.test.ts`, 22) para que no se quede atrás: cada pantalla del panel y cada permiso tienen su explicación; las pantallas de Más del prototipo deben estar en la lista oficial del manual (agregar una pantalla sin manual hace fallar la suite); y los NÚMEROS del manual (24 h de la llamada, 6 y 24 h de la cita, 30 min de nadie abre, 15 y 10 min de "¿todo bien?", 30 min y 6 h del pago, 2 y 3 cancelaciones, 2 contactos en 30 días) se comparan con los valores reales de Ajustes: si alguien los cambia, la prueba avisa. Verificado a 375 y 1280 px. PENDIENTE: pasarlo al panel real (el contenido y la búsqueda ya son del sistema real; falta la pantalla), y manuales para el compita (Telegram) y el cliente (portal) con el mismo motor.
