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
