# Auditoría con la skill de Cloudflare (security-audit)

Preparada el 2026-10-09. Para correr de noche, en un chat nuevo, cuando haya créditos.

## Antes de instalar (pendiente, 10 minutos)

1. Leer lo que falta de https://github.com/cloudflare/security-audit-skill/tree/main/skills/security-audit :
   ATTACK-CLASSES.md, WEB-PROTOCOL-AND-AUTH.md, CLIENT-SIDE.md, DATA-ISOLATION-AND-LIFECYCLE.md,
   CLOUD-AND-DEPLOYMENT.md, SUPPLY-CHAIN-AND-RELEASE.md, AI-AND-LLM.md, report-schema.json y .github/workflows.
   Ya revisados sin hallazgos: SKILL.md, RECONNAISSANCE.md, HUNTING.md, VALIDATION-AND-REPORTING.md,
   validate-findings.cjs y validate-coverage-ledger.cjs (sin red, sin subprocesos, sin eval, sin escrituras).
2. Anotar el hash del commit revisado y fijarlo al instalar (o copiar la carpeta con otro nombre) para que
   un `npx skills update` no cambie lo que revisamos.
3. Instalar solo en el proyecto (sin `-g`).

## Reglas de la corrida

1. Solo leer. No cambiar código, no instalar dependencias, no ejecutar código del proyecto
   (hay claves reales en .env: nada de sandbox improvisado).
2. No tocar producción ni datos reales de clientes. Pruebas en vivo solo con cuentas de prueba, y las hace Claude aparte.
3. Informes fuera del proyecto o en una carpeta ignorada por git: contienen pasos para reproducir vulnerabilidades.
4. Empezar con `quick`; revisar resultado y coste antes de pasar a `standard`.
5. Un tope de agentes (por ejemplo 30) para controlar el gasto.

## Orden de las pasadas (`standard`, por áreas)

1. Landing pública y formularios abiertos: app/page.tsx, /api/waitlist, /api/chat, /api/me-interesa, Turnstile.
2. Autenticación y API: login, /auth/*, middleware.ts, lib/auth.ts, lib/links.ts, lib/confirm.ts.
3. Pagos y webhooks: lib/pagos.ts, lib/solicitudes-pago.ts, /api/pago/*, /api/admin/*pago*, webhooks de Telegram y Daily.
4. Admin y dashboard del cliente: app/admin, app/dashboard, RLS en supabase/migrations.

## Prompt de arranque (pegar en el chat nuevo)

> /security-audit quick. Audita el código de este proyecto (Compaz: Next.js 16, Supabase, Telegram, Resend,
> Daily, Netlify) sin cambiar nada y sin ejecutar código. Contexto: ya hubo una auditoría manual el 2026-10-09
> (docs/seguridad-y-operacion.md) y se corrigió; busca lo que se escapó. Superficie pública a cubrir: la landing
> (micompaz.com), el dashboard del cliente, el panel admin y todas las rutas /api. Dame un resumen en lenguaje
> llano: hallazgos confirmados por gravedad, los que necesitan validación (con cómo comprobarlos) y la prioridad
> número uno. Guarda los informes fuera del proyecto.

## Después

1. Comprobaciones en vivo con curl (cabeceras, CSP, HSTS, redirecciones, rutas sin sesión): las hace Claude.
2. Revisión manual de Supabase (RLS, claves), Netlify (variables y accesos), Cloudflare y GitHub (la rama main acepta push directo).
3. Cada hallazgo confirmado: primero un test que falle, luego el arreglo, luego el mismo test en verde.
4. Segunda pasada que lea los informes anteriores y busque lo que quedó sin revisar.

## Corrida 1 (quick) y arreglos aplicados (2026-10-09)

Informes: ~/security-audit-skill/compaz/run-1/. Sin críticos ni altos. Arreglado con tests (tests/17-hallazgos-auditoria.test.ts):
1. Vinculación de Telegram: fallos acumulados por compita (10 en 24 h bloquean y avisan al admin) y una compita ya vinculada no se re-vincula.
2. Los enlaces de una solicitud dejan de valer si el cliente o la compita están bloqueados; al bloquear una compita se borran sus tokens de edición de perfil.
3. Redirección abierta con caracteres de control (/%09/…): rechazada.
4. Chat público: Google Sheets se escribe en modo RAW (sin evaluar fórmulas).

Pendiente (decisión o ajuste de entorno): LINK_SECRET distinto de CRON_SECRET (hay que crear la variable en Netlify antes de quitar el respaldo), cupoDelPlan sin pagos = sin tope, trigger handle_new_user, límites de frecuencia en send-message/visita/*, docs/schema.sql con políticas antiguas, quitar PAGO_SIMULADO al abrir al público.

## Prompt para la pasada standard (segunda corrida)

> /security-audit standard. Segunda pasada sobre /Users/juantenreiro/Desktop/Web/Compaz/compaz. Lee primero los informes de ~/security-audit-skill/compaz/run-1/ y céntrate en las unidades que la corrida quick aplazó o cubrió poco: páginas y rutas públicas menores (/api/cobertura, /compita/perfil, /onboarding, /privacidad, /compitas, public/), app/page.tsx (landing), el bot de Telegram partido en unidades pequeñas, los flujos de solicitud/enlaces firmados, las políticas RLS en supabase/migrations, y el nuevo flujo de pagos (lib/solicitudes-pago.ts, /api/pago/*, /api/admin/confirmar-solicitud). Solo lectura: no cambies nada, no ejecutes código y no abras archivos .env. Guarda los informes fuera del proyecto (run-2). Presupuesto: máximo 60 agentes. Resumen final en lenguaje llano: confirmados por gravedad, necesitan validación (con cómo comprobarlos) y prioridad número uno.
