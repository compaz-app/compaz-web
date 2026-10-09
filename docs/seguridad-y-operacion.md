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
`npm run test:flows` ejecuta 125 pruebas contra una BD en memoria y mocks de Telegram, Resend y Daily (`tests/`). Cubren registro de compita, solicitudes, crons, webhook de Daily, enlaces, pago, ciclo de la visita, perfil y panel admin, incluyendo cruces entre flujos.
Límite: la BD falsa no emula RLS ni concurrencia real; esas dos cosas se verifican en el SQL y en staging.
