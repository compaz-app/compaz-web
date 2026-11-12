# CRM del admin: datos a registrar y construir

Documento de trabajo del rediseño (prototipo en `/prototipo`, solo maqueta con datos falsos). Regla: ninguna pantalla se construye sin un dato real que la alimente. Lo que no se registra hoy se pierde para siempre.

## Los 5 datos prioritarios a registrar (recomendación del mentor, 2026-11-03)

1. Visitas al perfil y clics en "solicitar" de cada compita. Muestran si el problema es el perfil o la oferta. Solo cuentan desde que se activan.
2. Motivo cuando alguien dice que no: el compita al rechazar y el cliente al no contratar tras la entrevista. Una pregunta de un toque. Es la información más valiosa para mejorar el servicio y hoy se pierde.
3. Origen del cliente (de qué anuncio o campaña llegó). Con los anuncios en marcha, permite saber cuáles traen clientes que sí contratan.
4. Entrega de avisos: si el bot del compita está bloqueado o falla. Un compita "sin respuesta" a veces es un compita a la que nunca le llegó el aviso.
5. Oferta contra demanda por zona: dónde faltan compitas. Guía el reclutamiento.

Criterio: cada dato debe responder a una decisión concreta (a quién llamar, a quién retirar, dónde reclutar, qué anuncio seguir). Si no sirve a una decisión, no se registra todavía.

## Base obligatoria (se construye primero)

1. Tabla de eventos de operación: cada cambio (solicitud, respuesta, entrevista, decisión, pago, visita, aviso) con fecha, actor y datos. Ya existe `eventos` en `supabase/migrations/20261022_captacion.sql`, pero nada de operación la escribe y no está confirmado que esté aplicada en la base real.
2. Tabla de avisos: destinatario, canal, qué se iba a enviar, estado (enviado, fallido), error, intentos. Función central `notificar()` que envíe y registre. Reintentar reenvía el aviso guardado. Hoy `sendTelegramMessage` tiene unos 124 sitios de llamada sin registro. Migrar primero los flujos críticos.
3. Etapa explícita de cada cliente y desde cuándo está en ella (hoy se deduce de varias columnas).
4. Notas internas (tabla pequeña; `admin_flags` son alertas, no notas).

## Datos del compita

Existe ya:
1. Estado, verificada, visitas realizadas, calificación y total de reseñas, zona, horarios disponibles.
2. Tiempo de respuesta a solicitudes (`respondido_at` menos `created_at`).
3. Puntualidad (`visitas.inicio` contra `hora_inicio_programada`).
4. Alertas del equipo (`admin_flags`).

Se deriva con consultas:
1. Solicitudes recibidas, aceptadas, rechazadas y sin respuesta.
2. Tasa de contratación tras la entrevista.
3. Clientes activos y retención.
4. Ingresos generados.

Nuevo, empezar a registrar ya (sin historial hacia atrás):
1. Visitas al perfil (cada vez que un cliente abre su perfil en el marketplace).
2. Clics en "solicitar" desde el perfil.
3. Última actividad real.
4. Entrega de avisos de Telegram (bot bloqueado, chat inválido).
5. Motivo cuando rechaza una solicitud.

Uso: vistas de rendimiento (mejores, menos activos, no responden, en riesgo), y mensaje de mejora de perfil cuando hay muchas visitas pero pocas solicitudes.

## Datos del cliente

Existe o se deriva:
1. Solicitudes enviadas hasta contratar, tiempo entre etapas, plan, pagos, aviso de abandono (cron `churn-alerta`).

Nuevo:
1. Origen de captación (campaña, anuncio) ligado al cliente.
2. Motivo de no contratar tras la entrevista (una pregunta de una toque).
3. Motivo de cancelación o baja.
4. Satisfacción global (NPS) cada cierto tiempo.

## Datos del negocio

1. Embudo por etapa y conversión entre etapas.
2. Tiempo promedio por etapa.
3. Oferta contra demanda por zona (dónde faltan compitas).
4. Porcentaje de avisos fallidos por canal.
5. Ingreso por mes y por plan.

## Acciones sobre el compita (dependen de avisos y notas)

1. Escribirle por Telegram con plantilla (mejorar perfil, responder más rápido).
2. Pausar o retirar del sistema.
3. Anotar llamada y acuerdos.

## Orden sugerido

1. Eventos y avisos. 2. Etapa explícita. 3. Registro de visitas al perfil y clics en solicitar (barato, se puede adelantar). 4. Bandeja y Seguimiento reales. 5. Personas con vistas de rendimiento y acciones. 6. Notas.
