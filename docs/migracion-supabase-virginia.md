# Migración de Supabase a Virginia (decidida 2026-11-12)

Por qué: la base estaba en São Paulo (`sa-east-1`) y el servidor de Netlify corre en Virginia (IAD), con la región bloqueada en el plan Personal. Cada consulta cruzaba continentes (unos 120 ms) y cada pantalla hace varias en fila. Los clientes de lanzamiento están en EE. UU., y Stripe, Resend, Daily y Telegram también. Todo son datos de prueba: es el momento barato para mover la base.

Proyecto nuevo: `compaz-prod`, referencia `jizckcfuemgfbmopbhbh`, región `us-east-1`, plan Free (pasar a Pro antes de abrir al público, por las copias de seguridad). Creado con Data API activada, "exponer tablas nuevas" desactivado y RLS automática activada, igual que el proyecto original.
El proyecto viejo (`qrhkzlzblaknzsxqfney`, São Paulo) NO se toca: queda como respaldo y después como base de desarrollo y pruebas.

## Qué se copia y cómo
1. Estructura y datos de `public`, y los usuarios de acceso (`auth.users`, `auth.identities`): `scripts/migracion/01-copiar-base.sh` (usa `pg_dump` de la vieja, que solo lee). También repite la publicación de tiempo real.
2. Fotos: NO se copian al proyecto nuevo (decidido 2026-11-12: eran fotos de prueba; el usuario guardó una copia personal en `recuerdo-sistema-viejo/fotos-compitas/`). En el proyecto nuevo solo se crearon los dos buckets vacíos, `fotos` (público) y `fotos-privadas` (privado). Las pocas compitas con `foto_url` apuntando al proyecto viejo seguirán mostrando su foto mientras el viejo exista. `02-copiar-fotos.mjs` queda disponible por si algún día hace falta.
3. Comprobación fila por fila: `scripts/migracion/03-verificar.sh`.
4. Para repetir un ensayo: `scripts/migracion/00-vaciar-nueva.sh` (solo vacía la NUEVA).
Las conexiones van en `.env.migracion` (modelo en `scripts/migracion/.env.migracion.example`; no se sube a GitHub). Usar la cadena "Session pooler", no la directa (solo IPv6).

## Configuración de acceso que NO se copia sola (repetir en el proyecto nuevo)
Valores leídos del proyecto viejo el 2026-11-12:
1. Authentication, URL Configuration: Site URL `https://micompaz.com`; Redirect URLs `http://localhost:3000/auth/callback`, `https://micompaz.com/auth/callback`, `https://www.micompaz.com/auth/callback`.
2. Authentication, Sign In / Providers: solo Email activado; el resto desactivado. Revisar también "Confirm email", "Allow new users to sign up" y el enlace mágico, igual que en el viejo.
3. Authentication, Emails, SMTP Settings: SMTP propio activado. Remitente `visitas@micompaz.com`, nombre `Compaz`, host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = la clave de API de Resend (la pone una persona, no se copia).
4. Authentication, Emails, Templates: pegar las plantillas de `docs/plantillas-correo-supabase.md`.
5. Authentication, Rate Limits, Sessions, Attack Protection: igualar al viejo.
6. Storage: comprobar que los dos buckets existen y que las políticas de `storage.objects` (si las hay en el viejo) están repetidas.

## Cambio de producción (cutover)
Solo después de que `03-verificar.sh` diga "TODO IGUAL" y de probar en local contra la base nueva.
1. Netlify, Environment variables (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` con los valores del proyecto nuevo. Redesplegar (cuesta 15 créditos de Netlify).
2. `.env.local` de cada persona sigue apuntando al proyecto VIEJO (pasa a ser la base de desarrollo). Así queda separada la de pruebas y la de producción.
3. Probar en producción: entrar (enlace mágico y código), abrir el panel, un aviso de Telegram y una llamada. Telegram y Daily no cambian.
4. Todas las sesiones actuales caducan: hay que volver a entrar.

## Vuelta atrás
Devolver las 3 variables de Netlify a los valores del proyecto viejo y redesplegar. El viejo sigue intacto.

## Después
1. Pasar `compaz-prod` a Pro y comprobar una restauración (requisito de `CLAUDE.md`, sección 6).
2. Actualizar `CLAUDE.md` (punto 3 de "Datos y respaldo") cuando la separación esté hecha.
3. Avisar a Luis: su entorno de pruebas debe usar la base vieja; el CMC habla con la web, no con la base.

## Estado de la ejecución (2026-11-12)
Hecho: proyecto `compaz-prod` creado; estructura, datos y usuarios de acceso copiados con `01-copiar-base.sh`; `03-verificar.sh` dice "TODO IGUAL" (37 tablas, 47 funciones, 23 políticas RLS, trigger de `auth.users`, 3 tablas en tiempo real); buckets vacíos creados; permisos de `anon` y `authenticated` idénticos al viejo (`service_role` tiene más en el nuevo, sin riesgo).
Configuración de acceso del proyecto nuevo: HECHA y verificada (registro cerrado, Confirm email activado, Site URL, 3 URLs de retorno, SMTP de Resend guardado con una clave puesta por una persona, plantillas Magic link e Invite user copiadas del viejo, captcha desactivado igual que el viejo).
Falta: cambio de claves en Netlify (con redespliegue), prueba en producción y, antes del lanzamiento, pasar `compaz-prod` a Pro. Recomendado usar las claves LEGACY (anon y service_role, JWT) del proyecto nuevo para no cambiar de tipo de clave en el mismo paso; migrar a publishable/secret más adelante (las legacy se retiran a principios de 2027).
