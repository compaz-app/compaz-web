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
