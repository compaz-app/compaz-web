# Ciclo de comunicaciones: reglas y matriz

Problema observado en las pruebas: entre correos, Telegram y portal la gente se perdía, y los correos pedían entrar de nuevo al portal aunque ya habían entrado. Este documento define el diseño objetivo. La matriz paso por paso está en `app/prototipo/ciclo-data.ts` y se ve en `/prototipo/ciclo`. Los 16 pasos coinciden con `/prototipo/recorrido`.

## Las 8 reglas

1. Un estado, un responsable. En cada momento el cliente está en una etapa y hay una sola persona que debe actuar.
2. Se avisa solo a quien le toca. A la otra parte no le llega nada, lo ve en su pantalla.
3. Un canal principal por persona. Cliente: correo y portal. Compita: Telegram. Admin: Bandeja, y Telegram solo si es urgente.
4. Un aviso, un botón, un destino. Siempre lleva a la tarjeta "lo que toca ahora".
5. Nunca se pide entrar dos veces. Sesión larga en el teléfono; sin sesión, código en la misma pantalla con el correo ya puesto.
6. Si ya lo hizo, el aviso muere. Al actuar se cancelan los recordatorios pendientes y un botón antiguo muestra "Ya lo hiciste".
7. Escalera de insistencia: aviso, recordatorio, tarea en la Bandeja.
8. Todo deja registro (quién, cuándo, por qué canal y si llegó).

## Cómo se arregla el ciclo de login

1. Los correos de pago hoy llevan a `/dashboard` sin llave; si el navegador no tiene sesión (por ejemplo el navegador interno de la app de correo) cae en `/login`.
2. Cada enlace nuevo puede invalidar el anterior (hipótesis, sin confirmar), y el límite de 1 correo por minuto es silencioso.
3. Arreglo: sesión larga; al llegar sin sesión, pantalla con el correo ya escrito y un código de 6 números que no invalida enlaces anteriores; recordar el destino (`requireAuth` hoy lo olvida); mostrar la cuenta atrás en lugar del límite silencioso.
4. Trade-off de seguridad: un enlace de un solo uso en cada correo equivale a dar acceso a quien reciba el reenvío. Por eso no se recomienda meter un enlace mágico en cada aviso.

## Qué se agrega como CRM (más allá de lo ya diseñado)

1. Tiempo de respuesta al lead (postulación nueva): meta de contactar en menos de 2 horas.
2. Resumen diario al admin en lugar de ráfagas de avisos.
3. Horas de silencio y zona horaria de cada persona (el cliente puede estar en EE.UU. y el compita en Venezuela).
4. Plantillas de aviso en un solo lugar y con versión, para no tener 25 textos sueltos ni copy inventado.
5. Embudo con conversión y tiempo por etapa.
6. Salud del cliente y riesgo de abandono (renovación a tiempo, calificaciones, avisos sin respuesta).
7. Idempotencia: un mismo aviso nunca se envía dos veces por el mismo hecho.

## Respaldo por correo para el compita (decidido para diseñar, 2026-11-03)

Telegram solo no es robusto: puede fallar al salir (bot bloqueado, chat inexistente), no llegar (sin datos o teléfono apagado) o no verse. Hoy `sendTelegramMessage` lanza error si falla, no guarda nada, y tiene unas 123 llamadas; solo una usa `.catch`. No se sabe cuántas están protegidas con `try`, y la causa de la prueba no está confirmada (faltan los registros de Netlify de esa fecha).

Escalera para el compita (en orden):
1. Telegram con botones.
2. Si Telegram falla al instante: correo en ese momento, mismo contenido y mismo botón.
3. Si Telegram salió pero el compita no actúa en el plazo del evento (por ejemplo 2 h en una solicitud): correo de respaldo.
4. Si tampoco actúa: tarea en la Bandeja para que alguien lo llame.

Principios:
1. Se mide la acción (tocar el botón), no la entrega. La escalera se activa por falta de acción.
2. No se envían los dos canales a la vez desde el primer minuto (regla 2).
3. El correo al compita no incluye ningún dato de contacto del cliente.
4. El enlace del correo actúa sin iniciar sesión, con token de un solo uso y caducidad (ya existe `token_respuesta` en solicitudes; falta confirmar que cubra los demás eventos).
5. `compitas.email` hoy es opcional: debe pasar a ser obligatorio al registrar a un compita.

Pendiente antes de construir: revisar los registros de Netlify del día de la prueba para saber si el fallo fue del bot, del código o de la conexión. Depende de la tabla de avisos y de `notificar()`.

Pendiente de diseño: el ciclo paralelo del compita (postulación, evaluación, invitación, activación en Telegram, primera visita) con esta escalera incluida.

## Ayuda en cada paso (decidido para diseñar, 2026-11-03)

Objetivo: que quien no lee y va directo al botón cause poca fricción y poco desgaste al equipo. Se diseña para que equivocarse sea difícil, no para que lean más.

Criterios de diseño:
1. Una sola acción posible por pantalla; el botón dice el verbo completo; pantallas con una frase corta e ícono.
2. Confirmar solo lo irreversible (por ejemplo el pago, mostrando la referencia escrita).
3. Rellenar lo que ya se sabe para reducir campos.
4. El sistema responde lo repetitivo desde el estado ("¿ya llegó mi pago?") sin humano.
5. Sin tutoriales largos ni más texto explicativo: es lo que esta gente no lee.

Botón "¿Qué hago ahora?" (portal) y `/ayuda` contextual (Telegram), con el texto sacado de la misma matriz del ciclo para que no se desincronice. Escalera por paso:
1. Primer "no entiendo": la instrucción corta del paso.
2. Segundo: una versión más simple, con ícono o imagen y una sola frase (distinta de la primera).
3. Tercero: "Te ayudamos nosotros" y se abre una tarea "Pidió ayuda" en la Bandeja, con el paso, lo que intentó y desde cuándo.

Ajustes:
1. Pasos urgentes saltan la regla y muestran "Hablar con una persona" desde el primer toque: entrevista a punto de empezar, pago, visita en curso, emergencia.
2. Una salida discreta siempre visible ("Prefiero hablar con una persona").
3. El contador es por paso y se reinicia al avanzar.
4. El número tres es un ajuste, no una constante: se afina con los datos reales (si el 80% llega al tercero, el problema es la pantalla).

Datos que se registran: evento por cada toque de ayuda con el paso, el número de intento y si llegó a un humano. Es el termómetro de dónde se confunde la gente. Revisión semanal de las 5 confusiones más frecuentes.

Pendiente de definir: el canal humano (por dónde escribe la persona y quién responde). Una bienvenida de 3 pantallas en el primer acceso queda para después, y un asistente con IA para el final (riesgo de errores, costo y de compartir contactos).

## Decisiones del 2026-11-03

1. Visita: el cliente recibe reportes con fotos y texto durante y después de la visita; no hay videollamada ni notas de voz. La sala de Daily queda solo para las entrevistas.
2. Ayuda: el canal humano aparece después de 3 o 4 intentos en el mismo paso, no de inmediato. La emergencia mantiene su botón directo.
3. Entrada: por invitación de los administradores, para clientes y compitas, en esta fase inicial.

## Cómo entra la gente hoy (confirmado por el usuario, 2026-11-03)

Por ahora los clientes y los compitas entran solo por invitación del equipo (`invitar-cliente`, `generar-invite`, `registrar-compita`). Consecuencias para el diseño:
1. El primer paso del cliente es una tarea humana: la postulación debe aparecer en la Bandeja con semáforo de tiempo de respuesta.
2. Falta diseñar el ciclo paralelo del compita (postulación, evaluación, invitación, activación en Telegram, primera visita). Está pendiente y debe seguir las mismas 8 reglas.
3. Más adelante, cuando se abra al público, el registro propio sustituye a la invitación manual sin cambiar el resto del ciclo.

## Estado

Diseño objetivo. Las etiquetas "Existe" y "Nuevo" salen de lo revisado en el código (cron de recordatorios, `confirmar-inicio`, emergencia, resultado de la llamada, `churn-alerta`) y se confirman flujo por flujo antes de construir. Depende de la base: registro de eventos y tabla de avisos con `notificar()` (ver `docs/crm-datos-pendientes.md`).
