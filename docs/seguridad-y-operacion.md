# Seguridad y operación (auditoría 2026-10-09)

## Qué cambió y cómo funciona ahora

**Enlaces de correo y Telegram**
1. Los enlaces que cambian estado (confirmar llamada, no contratar, calificar, reagendar, asignar compita) ya no actúan con un GET. El GET muestra una página con un botón y la acción real va por POST (`lib/confirm.ts`). Así los escáneres de correo y los previsualizadores de Telegram no disparan acciones.
2. Los enlaces entre cliente y compita llevan el rol firmado (`quien=cliente&s=<firma>`, `lib/links.ts`). Un cliente no puede responder como compita ni al revés. La sala (`/sala/[token]`) también exige la firma.

**Fotos de visita**
Se siguen guardando en Telegram, pero como `tg:<file_id>`. Nunca se guarda la URL de descarga (contiene el token del bot). `/api/foto/[id]` las sirve al dueño de la visita, al admin o con un enlace firmado de 7 días (correos).

**Correo**
Todo envío pasa por `lib/email.ts` (`sendEmail`). El SDK de Resend no lanza excepciones: el wrapper convierte `error` en excepción para que los flags solo se marquen tras un envío real.

**Crons**
Cada envío reclama su flag de forma atómica (`reclamarFlag`) y lo libera si falla (`liberarFlag`). `lib/cron.ts` registra un latido por cron y alerta al admin si alguno se detiene.

**Telegram**
Reintentos de Telegram deduplicados por `update_id` (fila `upd:<id>` en `telegram_estados`). El webhook nunca devuelve 5xx. Confirmaciones de iniciar/terminar viven en su propia fila (`conf:<chat>`), así no pisan el cuestionario.

## Visitas recurrentes (2ª, 3ª, 4ª...)
La primera visita nace al contratar. Desde la segunda, el cliente pulsa **"Agendar otra visita"** en su dashboard (`POST /api/visita/nueva`, `lib/visitas.ts`). Se crea una visita en coordinación con su compita asignada y se repite el mismo flujo: chat, fecha, recordatorio, iniciar, terminar, cuestionario y valoración. Reglas: compita activa y verificada, cliente no bloqueado, al menos una visita terminada y ninguna otra visita activa. Requiere el índice `visitas_una_activa_por_cliente` de la migración (punto 2e, con consulta previa de duplicados).
**Planes, pagos y créditos** (configuración en `lib/planes.ts`, única fuente; los precios y cifras se ajustan ahí). Hay 3 planes: A la carta ($45, 1 visita), Compañía ($75 al mes, 2 visitas), Compañía Plus ($140 al mes, 4 visitas). El pago es mes a mes, sin cobros automáticos. Cada pago (plan o visita extra) crea un paquete de visitas en `pagos_plan` que **vence a los 60 días**: lo que no se usa en el mes no se pierde, se suma al siguiente pago hasta que el paquete vence. Las visitas se gastan primero de los paquetes que vencen antes (`lib/creditos.ts`). Visita extra: $20 por hora, mínimo 2 horas, cada una es un paquete de 1 visita. Con el ciclo vencido sin pagar el cliente puede realizar visitas ya programadas, pero no agendar nuevas sin saldo. Reembolsos: no se promete nada por escrito; los textos de pago y correos solo dicen que aplican ciertas condiciones y que se hable directamente con Compaz (`TEXTO_REEMBOLSO` en `lib/planes.ts`).
Cómo se registra un pago: panel admin, pestaña Clientes, botón **Pagos y plan** (Zelle, transferencia, Stripe u otro; se puede ajustar el monto, anular un pago equivocado y ver el historial). El cliente recibe un correo de confirmación. Rutas: `POST /api/admin/registrar-pago`, `POST /api/admin/anular-pago`, `GET /api/admin/pagos`. El cron `recordatorio-pago` avisa al cliente a los 30 días de un plan mensual que toca renovar y manda un resumen al admin. Cuentas anteriores sin pagos registrados: si tienen `plan_contratado` se aplica el cupo antiguo por ciclo; sin ninguno no hay límite.
Migración: `supabase/migrations/20261010_pagos_plan.sql` (ejecutar antes del deploy que la usa; el código tolera su ausencia y usa el cupo antiguo).

## Variables de entorno
1. `PAGO_SIMULADO=true`: permite que `/api/pago/confirmar` contrate sin cobrar en producción (modo piloto). Sin esta variable, en producción solo registra el interés y avisa al admin. Se elimina cuando entre Stripe.
2. `LINK_SECRET` (opcional): clave para firmar enlaces. Si falta se usa `CRON_SECRET`.
3. `DAILY_WEBHOOK_SECRET`: ahora se acepta la firma HMAC de Daily (`X-Webhook-Signature` + `X-Webhook-Timestamp`) y, por compatibilidad, el encabezado `x-daily-signature`.
4. `EMAIL_FROM`, `ANTHROPIC_MODEL_RESUMEN` (opcionales).

## Pasos manuales obligatorios
1. **Rotar `TELEGRAM_BOT_TOKEN`** (BotFather → /revoke), actualizarlo en Netlify y volver a llamar `/api/setup-webhook`. El token anterior pudo quedar en `mensajes.contenido` y en correos.
2. Ejecutar `supabase/migrations/20261009_auditoria_seguridad.sql` (revisar antes; probar en staging). Incluye RLS, índices únicos y limpieza de fotos con token.
3. Reemplazar la página/flujo de pago por Stripe cuando se contrate.

## Pruebas de flujos
`npm run test:flows` ejecuta 164 pruebas contra una BD en memoria y mocks de Telegram, Resend y Daily (`tests/`). Cubren registro de compita, solicitudes, crons, webhook de Daily, enlaces, pago, ciclo de la visita, perfil y panel admin, incluyendo cruces entre flujos.
Límite: la BD falsa no emula RLS ni concurrencia real; esas dos cosas se verifican en el SQL y en staging.
