# Reglas de desarrollo — Compaz

## 1. URL state persistence (obligatorio)
Toda página o sección con tabs, filtros, selecciones o pasos multi-nivel debe persistir su estado en URL params (`useSearchParams` + `router.replace`) y restaurarlo al hacer refresh. El componente visual (mapa, lista, tab activo) también debe sincronizarse desde esos params al montar — no solo los dropdowns o la UI de texto.

## 2. Diseño responsive (obligatorio)
Todo componente y página debe funcionar correctamente en mobile (≥375px) y desktop (≥1024px). Nunca diseñar solo para uno. Usar `flexWrap`, breakpoints con `@media`, o lógica condicional cuando la diferencia entre mobile y desktop sea significativa.

## 3. Design tokens (obligatorio)
Todos los colores, tipografías y espaciados deben venir de `lib/design.ts`. Nunca hardcodear `#1A0A3C`, `#FF6B2B`, etc. directamente en componentes. Importar `colors`, `spacing`, `radius`, `zIndex` de ese módulo.

## 4. Capa de negocio separada (obligatorio)
Toda query a Supabase va en `lib/compitas.ts`, `lib/solicitudes.ts`, `lib/usuarios.ts` o el módulo correspondiente — nunca directamente en una API route o componente. Las API routes solo orquestan: autentican, llaman la función de lib/, y retornan con los helpers de `lib/api.ts`.

## 5. Respuestas de API estandarizadas (obligatorio)
Toda API route usa `ok()`, `err()`, `unauthorized()`, `notFound()`, `serverError()` de `lib/api.ts`. Nunca `NextResponse.json({ error: '...' })` directamente.

## 6. Pagos con Stripe y lanzamiento (obligatorio antes de instalar Stripe o abrir al público)
Estado a 2026-10-11: el proyecto NO está lanzado, está en pruebas. `PAGO_SIMULADO=true` está activo en Netlify producción a propósito para probar sin cobrar. Cuando se active Stripe se lanza el proyecto. Cualquier chat que toque pagos, Stripe, Netlify o el lanzamiento debe recordarle esto al usuario y aplicar la lista.

Al instalar Stripe (usar Stripe Checkout, la página de pago alojada por Stripe, salvo decisión contraria):
1. El pago se da por bueno solo desde el webhook de Stripe, nunca porque el navegador vuelva a una página de éxito.
2. Verificar la firma del webhook con el secreto de Stripe y fallar cerrado si falta el secreto, igual que Telegram y Daily.
3. El importe y el plan salen del servidor (`lib/planes.ts`), nunca del navegador.
4. Idempotencia: guardar el id del evento de Stripe y no registrar dos veces el mismo pago (hoy `registrarPago` no tiene clave única por pago).
5. Atar el pago al usuario y a la solicitud con metadatos de la sesión de Stripe y comprobar en el webhook que existen y que el usuario no está bloqueado.
6. Reembolsos y disputas: usar `anularPago` para que no queden visitas sin cobrar.
7. Claves de prueba y reales separadas por entorno. La clave secreta nunca en variables `NEXT_PUBLIC_`.
8. Si se incrusta el formulario en lugar de Checkout, permitir `js.stripe.com` en la CSP (`script-src` y `frame-src`) de `next.config.ts`.
9. Al activar Stripe: borrar `PAGO_SIMULADO` de Netlify y retirar o proteger `/api/pago/confirmar`, y pedir una auditoría centrada solo en la integración de Stripe (skill security-audit, perfil quick, carpeta de informes `~/security-audit-skill/compaz/run-3`).

Pendientes de seguridad antes de abrir al público (informes completos en `~/security-audit-skill/compaz/run-2/`, ver `REPORT.md` y `NEEDS-VALIDATION.md`):
1. `requireAuth` en `lib/auth.ts` debe devolver el usuario verificado de `getUser()`, no el de `getSession()`; `app/dashboard/page.tsx` decide admin y dueño con él.
2. Sacar Clarity, GA y Meta Pixel de las rutas con token (`/sala`, `/reagendar`, `/onboarding`, `/compita/perfil`, `/pago`, `/dashboard`, `/admin`) en `app/layout.tsx` y actualizar `/privacidad`.
3. Claves de Turnstile en Netlify.
4. Telegram: comando de admin para liberar `codfail:<compita>`, y límite de intentos en el paso de desambiguación por correo.
5. Extender el filtro de partes bloqueadas a `responderSolicitud` e `iniciarReagendadoPorCompita`, y cancelar solicitudes abiertas al bloquear.
6. Limpiar datos de prueba: filas de `pagos_plan` con referencia "pago simulado", solicitudes de prueba y grabaciones de Clarity.
7. Tercera pasada de la auditoría sobre lo que run-2 dejó sin cubrir (rutas admin cliente-preview, flags, invitar-cliente, toggle-estado, toggle-verificado; setup-webhook, setup-daily-webhook, auth/callback, login; perfil familiar y fechas de visita; cron y funciones Netlify restantes; componentes del dashboard).

8. TEXTO LEGAL PROVISIONAL (2026-11-09): los términos que acepta el cliente en la ficha (`lib/terminos.ts`, versión `provisional-1`) NO son un texto legal revisado: los escribió el sistema con las reglas decididas. La pantalla lo avisa ("Texto provisional, pendiente de revisión legal"). Antes de abrir al público: reemplazarlos por el texto aprobado, cambiar `TERMINOS_VERSION` (al quitar el prefijo "provisional" el aviso desaparece solo) y actualizar `/privacidad`. Recordárselo al usuario.

Datos y respaldo antes de abrir al público (decidido 2026-11-03, no olvidar):
1. Hoy todos los datos de la base de Supabase (clientes y compitas) son de prueba y se pueden borrar sin problema (confirmado por el usuario, 2026-11-03). No hay copias de seguridad configuradas y no hace falta guardar nada de lo actual. Se decidió dejarlo para antes del lanzamiento.
2. Antes de que entre el primer cliente real que pague: activar copias de seguridad automáticas en Supabase (confirmar plan y retención) y probar una restauración.
3. Antes de lanzar: separar la base de desarrollo de la de producción. Hoy local y producción comparten la misma base.
4. Mientras tanto, toda migración solo AGREGA tablas o columnas, nunca cambia ni borra lo existente (para poder volver al código viejo).
5. Cuando se registren los primeros compitas reales, repetir la pregunta de qué datos hay que respaldar.

## 6b. El sistema se explica solo (obligatorio, decidido 2026-11-10)
Cuando el sistema frena algo (plazo entre envíos, máximo de intentos, límite diario, alerta que no se repite) debe decir qué pasó, por qué existe la regla y cuándo o cómo seguir. Nunca "espera un momento" a secas. Toda restricción nueva se agrega al `CATALOGO` de `lib/esperas.ts` (con su razón) y todo mensaje de espera se arma con `explicarEspera`; la prueba de guardia de `tests/55-esperas.test.ts` falla si una ruta responde 429 sin usarlo. El panel lista todas las reglas en Más, "Límites y esperas" (`GET /api/admin/esperas`). Además, si un mensaje promete algo ("avisamos al equipo"), el sistema debe hacerlo de verdad.
**Poco texto a la vista (decidido 2026-11-10):** lo visible es UNA línea corta (qué pasó y cuándo seguir: `resumen`); la razón (`porQue`) y cualquier explicación larga van detrás de un ⓘ (`components/ui/InfoBoton.tsx`), no en párrafos. Las rutas con 429 responden con `errEspera` (`error` corto + `porQue`) y las pantallas muestran el ⓘ. En Telegram, que no tiene ⓘ, la razón va en un bloque desplegable (`esperaTelegram`, `<blockquote expandable>`). Los párrafos de introducción de una pantalla también se esconden tras un ⓘ.

## 7. Cómo agregar o quitar a alguien del panel (recordar siempre)
Hay dos tipos de persona y cada uno tiene su ruta:
1. **Administrador (acceso total):** se agrega o quita SOLO en la variable `ADMIN_EMAILS` de Netlify (correos separados por coma, y también en `.env.local` para pruebas locales). Después hay que volver a desplegar para que el servidor la lea. La lista de la base (`admin_emails`, que usa el tiempo real) se copia sola en la limpieza diaria de las 3 am; para verla al instante, llamar a `POST /api/cron/limpieza` con la cabecera `x-cron-secret`. Nunca editar la tabla `admin_emails` a mano: la siguiente limpieza la deja igual a `ADMIN_EMAILS`.
2. **Colaborador (acceso limitado):** lo gestiona un administrador por `/api/admin/equipo` (GET lista, POST invita con sus permisos, PATCH cambia permisos o desactiva). Cada permiso se activa o apaga por separado y todo queda en `equipo_historial`. Un colaborador nunca puede dar permisos, ni a sí mismo. La pantalla del panel real para esto aún no existe; hasta entonces se usa la ruta.
Código: `lib/permisos.ts`, `lib/equipo.ts`, `lib/admins.ts`. Toda ruta nueva de `/api/admin` debe llamar a `requierePermiso('...')` y registrarse en `tests/37-permisos.test.ts` (si no, la suite falla).

---

## Arquitectura de referencia

- `lib/design.ts` — tokens de diseño (colores, spacing, z-index)
- `lib/api.ts` — helpers de respuesta HTTP estándar
- `lib/auth.ts` — autenticación y roles
- `lib/compitas.ts` — lógica de negocio: compitas
- `lib/solicitudes.ts` — lógica de negocio: solicitudes de entrevista
- `lib/usuarios.ts` — lógica de negocio: usuarios/clientes
- `lib/telegram.ts` — envío de mensajes por Telegram
- `lib/resend.ts` — envío de emails
- `lib/daily.ts` — salas de videollamada
- `types/index.ts` — todos los tipos TypeScript
- `docs/schema.sql` — schema completo de la BD con comentarios
- `docs/api.md` — referencia de todos los endpoints
- `docs/flows.md` — flujos de negocio en lenguaje llano

---

@AGENTS.md
