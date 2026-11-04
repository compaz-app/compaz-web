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
5. La compita en Seguimiento es clicable y abre su ficha. El resto de la fila abre la ficha del cliente.
6. Semáforo del círculo del cliente (verde, amarillo, rojo) según etapa y horas esperando. Umbrales en `UMBRALES` (Solicitud 6 y 24 h, Entrevista 1 y 3 h, Decisión 2 y 24 h, Pago 2 y 12 h, Activo 24 y 72 h). Con leyenda.
7. Personas: 100 compitas falsas en tabla con vistas rápidas (Todas, Disponibles, Con cupo, Sin respuesta 24h, En pausa, Nuevas sin verificar), orden por columna, búsqueda y paginación de 25. Semáforo propio de la compita. Columnas que se ocultan según el ancho para evitar scroll lateral.
8. Bandeja: cada fila muestra cliente y compita con su rol y su etiqueta, ambos clicables. Los botones dicen a quién van ("Recordar al cliente", "Insistir a la compita", "Reintentar aviso").
9. Visitas: 140 visitas de prueba (25 clientes falsos con ficha) con vistas Hoy, En curso, Próximas, Terminadas, Con problema y Todas, cada una con número. Sin pestaña Historial: lo cerrado vive en Terminadas. Cliente y compita con su rol, estado con color, estrellas y paginación de 25. "Con problema" agrupa no se presentó, canceladas y calificación de 3 o menos.
10. Visitas: se quitó el estado ficticio "Cancelada"; "Con problema" muestra el motivo de cada fila. Cliente: se quitaron los botones "Necesito ayuda" y "Mi historial". Telegram: se quitaron "Ver detalles" y "Voy con retraso", y "Llegué" pasó a "Iniciar visita" (el botón real del bot).
11. Emergencia: nueva tarea fija arriba y en rojo en la Bandeja, con banner de alerta y filtro propio; en la maqueta de Telegram, botón "🚨 Emergencia" durante la visita (refleja el flujo real).
12. Más: centro de herramientas con 7 tarjetas y seis subvistas con datos falsos (Reseñas por aprobar, Postulaciones y origen, Pagos con anular, Avisos enviados con reintento, Cobertura y demanda por zona, Ajustes del semáforo). Cada tarjeta lleva la etiqueta "Existe hoy" o "Requiere base nueva".
13. Portal del cliente: tres estados nuevos durante la visita (la compita llegó, visita en curso con videollamada y chat, visita terminada con reporte de bienestar y calificación). El chat censura teléfonos y correos y muestra el aviso, igual que `lib/chat-moderacion.ts`.
14. Nueva pantalla `/prototipo/cliente/elegir`: elegir compita con filtros (zona, orden, con video), lista con foto, calificación y visitas, ficha en panel, contador de solicitudes (máximo 3), elección de hasta 3 horarios y envío. Banner naranja si hay una entrevista aceptada.
15. Bandeja: nueva tarea "Contacto bloqueado" (el chat censuró un teléfono o correo), que corresponde al flag que ya crea `chat-moderacion`.
16. Login del cliente (`/prototipo/cliente/entrar`): correo, pantalla "Revisa tu correo" con aviso de usar el enlace más reciente, cuenta atrás visible para pedir otro enlace (hoy el límite de 1 por minuto es silencioso), y opción de código de 6 números. Llega al portal justo al paso donde estaba.
17. Portal del cliente con 4 secciones fijas abajo: Inicio, Visitas, Mi familiar y Mi plan. Visitas: próxima visita, cambiar fecha, agendar otra, anteriores con reporte. Mi familiar: formulario de 4 campos. Mi plan: plan, visitas restantes, renovación, pagos y cerrar sesión.
18. Recorrido guiado de un cliente nuevo (`/prototipo/recorrido`, ahora la entrada del prototipo): 16 pasos en 7 fases (llegar, entrar, elegir, entrevista, pagar, visitas, después). En cada paso se ven lado a lado el cliente, el Telegram de la compita y el admin, con "qué pasa" y "qué se registra". Flechas del teclado para avanzar. En pantallas angostas, pestañas Cliente, Compita y Admin.
19. El Telegram de la compita acepta `hasta=N` para abrirse ya avanzado. El estado de cada pantalla puede vivir en memoria (EmbedProvider) para mostrar varias a la vez.
20. Paso 1 del recorrido con el texto real de micompaz.com y el slogan "Cerca aunque estés lejos"; el formulario pide estado y teléfono (antes yo había inventado un correo).
21. Mapa del ciclo (`/prototipo/ciclo`): 8 reglas y, para cada uno de los 16 pasos, quién actúa, aviso, botón, destino, escalera si no actúa y dato registrado. Cada paso del recorrido muestra su aviso, botón y escalera. Detalle en `docs/ciclo-comunicaciones.md`.
22. Anotado para diseñar (no construido): respaldo por correo para el compita, en escalera (Telegram, correo si falla o no actúa, Bandeja). Ver `docs/ciclo-comunicaciones.md`.
23. Anotado para diseñar (no construido): botón de ayuda por paso con escalera de tres intentos y salida a un humano. Ver `docs/ciclo-comunicaciones.md`.
24. Esc cierra la ficha.

Nota técnica: no se usaron iframes porque las cabeceras de seguridad actuales (`X-Frame-Options: DENY`, `frame-ancestors 'none'` en `next.config.ts`) los bloquean. No se modificó esa configuración. Estado en la URL (pestaña, filtros, ficha abierta).

## Observaciones del usuario (revisión)

Hechas:
1. Seguimiento con scroll lateral incómodo: resuelto (cambio 2).
2. Bandeja con tarjetas demasiado grandes para 1000 clientes: resuelto (cambio 3).
3. Confundir cliente y compita en Seguimiento: resuelto (cambios 4 y 5).
4. Círculo con inicial sin utilidad: ahora indica urgencia (cambio 6).
5. Bandeja sin decir quién es el cliente y quién la compita: resuelto (cambio 8).
6. Personas con 100 compitas, útil y sin scroll infinito: resuelto (cambio 7).

Pendientes de construir en el prototipo:
1. Vistas de rendimiento en Personas: mejores, menos activas, no responden, en riesgo.
2. Columna "Visitas al perfil", marcada como pendiente de datos.
3. Acciones en la fila de la compita: escribirle con plantilla, pausar, retirar, anotar llamada.
4. Mostrar en la Bandeja el canal y el motivo del aviso fallido (Telegram, correo, "bot bloqueado").
5. Lista de clientes con el mismo formato que la de compitas (hoy Personas muestra solo compitas).
6. Revisar el prototipo en el celular (Bandeja, Seguimiento y Personas no se midieron a 375px tras los últimos cambios).
7. Distribución más realista de los datos falsos (salen demasiadas compitas en rojo).

Aún por revisar por el usuario: parte del portal del cliente y maqueta de Telegram. Observación del usuario: el portal del cliente solo cubre un 20% del dashboard real; falta mi familiar, plan y pagos, visitas (próximas, reagendar, historial), bienestar en el tiempo, primer acceso y cuenta.

## Mapa de botones: cada uno con su función real

Regla del usuario (2026-11-03): ningún botón es cosmético. Cada botón debe ejecutar algo que se pueda construir con lo que ya existe y debe dejar un dato registrado. Estado: EXISTE (ya funciona hoy), PEQUEÑO (se construye sobre algo existente) o REQUIERE BASE (depende del registro de eventos o de la tabla de avisos).

Portal del cliente:
1. Ver otras compitas: EXISTE (marketplace `/compitas`).
2. Elegir horario y Cambiar horario: EXISTE (`/reagendar`, `api/solicitud/proponer-reagendado`).
3. Entrar a la entrevista: EXISTE (`/sala`).
4. Sí quiero contratarla y No, ver otras: EXISTE (`api/solicitud/resultado-llamada`, `confirmacion-llamada`).
5. Ya hice el pago: EXISTE (`api/pago/solicitar`, crea `solicitudes_pago`).
6. Ver mis visitas: EXISTE (dashboard).
7. Quitados por no tener función definida: "Necesito ayuda" y "Mi historial". Volverlos a poner solo cuando se defina qué hacen.

Telegram de la compita:
1. Aceptar y No puedo: EXISTE (`api/solicitud/responder`).
2. Confirmo que puedo: EXISTE (confirmar horario). Necesito otra hora: EXISTE (`api/solicitud/reagendar-compita`).
3. Entrar a la entrevista: EXISTE (botón con enlace a `/sala`).
4. Emergencia: EXISTE (botón del teclado durante la visita, `telegram-webhook`). Avisa al admin por Telegram y por correo y crea una alerta en `admin_flags`, que el dashboard muestra en tiempo real.
5. Iniciar visita: EXISTE (el bot ya tiene el botón; pasa a `confirmando_inicio` y el cliente confirma).
6. ¿Qué me toca?: PEQUEÑO (comando nuevo que lee solicitudes y visitas).
7. Quitados: "Ver detalles" y "Voy con retraso" (no existen flujos para ellos).

Portal del cliente (visita y elegir compita):
1. Pedir entrevista y enviar solicitud: EXISTE (`api/solicitudes`, máximo 3).
2. Confirmar y empezar (llegada de la compita): EXISTE (`api/visita/confirmar-inicio`, se confirma sola a los 5 min).
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
2. Recordar al cliente e Insistir a la compita: PEQUEÑO (reenvío manual de un aviso; hoy hay crons automáticos, falta el disparo manual). Registran un evento.
3. Reintentar aviso: REQUIERE BASE (tabla de avisos con `notificar()`).
4. Abrir ficha y filtros: EXISTE (solo lectura de datos).
5. Notas internas: REQUIERE BASE (tabla nueva).
6. Acciones sobre la compita (escribirle con plantilla, pausar, retirar): pausar y retirar EXISTEN (`toggle-estado`, `bloquear-compita`, `eliminar-compita`); escribirle con plantilla REQUIERE BASE (avisos).

## Más: qué hay detrás de cada tarjeta

1. Reseñas por aprobar: EXISTE. Tabla `resenas` con `publicada` (el admin aprueba antes de mostrar) y `api/admin/resenas`.
2. Postulaciones y origen: EXISTE si la migración `20261022_captacion.sql` está aplicada. `postulaciones` ya guarda fuente y utm_source, utm_medium y utm_campaign. Eso ya cubre el dato "origen" para postulaciones. Falta ligar el origen al cliente cuando se convierte.
3. Pagos con anular: EXISTE (`api/admin/pagos`, `anular-pago`).
4. Avisos enviados con reintento: REQUIERE BASE (tabla de avisos y `notificar()`).
5. Cobertura y demanda: el mapa de cobertura EXISTE. La comparación oferta contra demanda es una consulta nueva (compitas activas por zona frente a clientes y solicitudes por zona).
6. Ajustes del semáforo: REQUIERE BASE (tabla de ajustes; hoy los umbrales están en el código).
7. Invitar cliente y registrar compita: EXISTEN (`api/admin/invitar-cliente`, `generar-invite`, `registrar-compita`). No se rediseñan.

## Cómo se determina "Con problema" (Visitas)

Cada fila muestra el motivo. Reglas con datos reales:
1. No se presentó: visita programada que no inició 30 min después de su hora. El cron `noshow-alerta` ya lo detecta pero solo avisa por Telegram y no guarda marcador. Falta guardar el evento.
2. Calificación baja: `visitas.rating_cliente` de 3 o menos.
3. Candidatas a añadir con datos existentes: retraso al iniciar (`inicio` contra `hora_inicio_programada`), duración anormal, reporte de novedad de la compita, alerta manual (`admin_flags`).
4. Cancelaciones: hoy `api/visita/cancelar` BORRA la visita (solo en `pre_visita`) y no deja rastro. Para medir cancelaciones hay que registrar un evento antes de borrar. Quitado "Cancelada" como estado de la maqueta porque no existe.
5. Un problema queda abierto hasta que alguien lo resuelve con una nota. Los umbrales (30 min, 3 estrellas) deben ser ajustes configurables.

## Datos prioritarios anotados

Los 5 datos que se recomienda empezar a registrar (visitas al perfil y clics en solicitar, motivo del "no", origen del cliente, entrega de avisos, oferta y demanda por zona) están detallados al inicio de `docs/crm-datos-pendientes.md`.

## Decisiones abiertas

0. Corrección de género: "el compita", "los compitas". Los textos del prototipo que dicen "la compita" están por corregir.

1. Nombre completo o inicial del apellido de la compita ante el cliente.
2. Grabar las llamadas o no.
3. WhatsApp para clientes.
4. Portal web para la compita (hoy la recomendación es Telegram con botones como base).
5. Pagos en pestaña propia o dentro de "atención".
6. Los tiempos del semáforo (propuestos, a ajustar).

## Viabilidad con datos reales

Ver `docs/crm-datos-pendientes.md`. Base obligatoria: registro de eventos y tabla de avisos con `notificar()`.
