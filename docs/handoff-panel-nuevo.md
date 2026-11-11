# Handoff: panel nuevo (2026-11-11)

Para empezar un chat nuevo sin perder contexto. Léelo entero antes de tocar nada.

## Dónde estamos
Todo lo de abajo está COMMITEADO (último commit `a6b7035`). Nunca se ha hecho push y NO se hace push ni commit sin que el usuario lo pida.

Hecho en el portal del cliente (`/portal`, reemplaza a `/dashboard`):
1. Estilos unificados (`lib/design.ts` → `app/tokens.generated.css`, componentes `components/ui/base/`, trinquete `tests/56-estilos.test.ts`).
2. Estado del cliente (`lib/estado-cliente.ts`, 30 estados) y textos (`lib/portal-estados.ts`).
3. `/portal` con pestañas Inicio, Visitas, Mi familiar, Mi plan (`lib/portal-datos.ts`, `lib/portal-secciones.ts`, `components/portal/*`).
4. Acciones reales, tiempo real (`VisitaWatcher`), foto de llegada, Eliminar mi cuenta real (`lib/cuenta-eliminar.ts`, `/api/cuenta/eliminar*`, `/cuenta/eliminar`).
5. Activación por cliente: `lib/portal-activacion.ts`, `PATCH /api/admin/portal-nuevo`, columna `usuarios.portal_nuevo`; `/dashboard` redirige a `/portal` con la misma decisión (`clienteVePortalNuevo`).
6. Prototipo terminado y APROBADO por el usuario (`app/prototipo/*`, servidor en `npx next dev -p 3111`, entrada `/prototipo`).

## Decisión nueva (2026-11-10)
El usuario dijo: el panel viejo (`/admin`) está sin uso y no tiene nada sensible; el prototipo está aprobado. Por eso NO hace falta activación por etapas del panel: se construye el nuevo en `/panel`, se hace el cambio de una vez y se borra el viejo.

## Pasos que faltan, en orden
0. El USUARIO debe aplicar en Supabase (SQL editor) las migraciones `supabase/migrations/20261110e_eliminar_cuenta.sql` y `20261110f_portal_nuevo_por_cliente.sql`. Sin la primera, `getClienteActivo` y el login leen columnas que no existen y bloquean a todos los clientes. La base la comparten local y producción. Pregúntale si ya lo hizo antes de probar nada con datos reales.
1. Panel nuevo en `/panel` con el diseño aprobado del prototipo (`app/prototipo/admin/page.tsx`, 1700 líneas, es la referencia visual y de textos), con datos REALES y la lógica que ya existe:
   1. Esqueleto: menú (lateral en escritorio, barra inferior en móvil), selector "ver el panel como" (admin o colaborador), permisos con `requierePermiso`/`lib/permisos.ts`. Estado en la URL (tab, filtros).
   2. Bandeja ("Requiere tu atención"): tareas de `admin_flags`/alertas (`lib/alertas-admin.ts`), filtros por tipo.
   3. Personas (compitas y clientes) con ficha y línea de tiempo; contacto por WhatsApp/correo pide motivo si no eres admin (queda en Actividad).
   4. Visitas y Seguimiento por etapas.
   5. Más: Pausas (`lib/pausas.ts`, `/api/admin/pausas`), Registrar llamada (`lib/bloqueos-compita.ts`), Límites y esperas (`GET /api/admin/esperas`), Estado del sistema, Manual (`lib/manual.ts`), Actividad, Ajustes, Equipo (`/api/admin/equipo`), Pagos, Avisos, Reseñas, Postulaciones, Cobertura, Umbrales, Registro.
2. El cambio: `/admin` redirige a `/panel`, borrar `app/admin/AdminDashboard.tsx` y lo viejo, bajar la línea base de colores (`UPDATE_ESTILOS=1 node tests/run.mjs 56`).
3. Portal: el usuario revisa `/portal?preview=<id de cliente>` con sesión real (el asistente NO puede iniciar sesión) y se enciende el interruptor general `portal_nuevo` = 1 en Ajustes; después borrar `/dashboard` viejo.
4. Aparte del panel: checklist de lanzamiento (CLAUDE.md sección 6: Stripe, copias de seguridad, base de desarrollo separada, texto legal provisional, Turnstile), pruebas reales de correo y Telegram en el hosting oficial, sala embebida con cuenta atrás, llamadas posteriores al pago.

Estimación dada al usuario: unos 12 tramos de 15 a 40 minutos cada uno (3 a 6 horas de trabajo), un commit por tramo cuando el usuario lo pida. Recorte seguro si quiere ir más rápido: cambiar a `/panel` solo con las 4 pestañas principales y dejar vistas de Más en el viejo hasta tenerlas.

## Reglas de este proyecto (obligatorias)
Están en `CLAUDE.md` (léelo) y en la memoria. Las que más se rompen:
1. Nunca push. Commit solo cuando el usuario lo pida ("commitea"). Mensaje de commit termina con la línea `Co-Authored-By` que indique el sistema.
2. Pantallas NUEVAS en Tailwind con tokens de `lib/design.ts` y los componentes de `components/ui/base/` (`Boton` exige la prop `info`: todo botón lleva su ⓘ). Ningún color suelto (`#1A0A3C`): lo detecta `tests/56`.
3. Toda query a Supabase va en `lib/`, nunca en rutas ni componentes. Rutas con `ok/err/...` de `lib/api.ts`. Un componente `"use client"` NO puede importar código de servidor (el build falla aunque las pruebas pasen; hay prueba guardia).
4. Toda ruta nueva de `/api/admin` usa `requierePermiso(...)` y se registra en `tests/37-permisos.test.ts` (mapa ESPERADO).
5. El sistema se explica solo: todo límite o espera va en `lib/esperas.ts` (CATALOGO) y se arma con `explicarEspera`; poco texto visible y la razón tras un ⓘ. Pantalla nueva del panel o permiso nuevo → explicarla en `lib/manual.ts` (`tests/60` lo exige).
6. Responsive: todo funciona a 375 y 1024+ px. Estado en la URL (tabs, filtros) y se restaura al refrescar. Para tablas usa container queries (`@container`, `@lg:`), no breakpoints de ventana: el menú lateral resta ancho.
7. En textos de UI, correos y Telegram nunca guiones como viñetas; "el compita" siempre masculino.
8. Comunicación: directa, concisa, sin suavizar. El usuario es el dueño y no programa; explica en español llano, da una recomendación y no un menú de opciones. Actuar como mentor/advisor de CRM.
9. Migraciones: solo AGREGAN columnas o tablas, nunca cambian ni borran (para poder volver atrás).

## Cómo trabajar y verificar
1. Pruebas: `node tests/run.mjs` (≈1031, todas deben pasar) o con filtro `node tests/run.mjs 66`. Cada cambio se verifica con mutaciones (rompe a propósito la condición y confirma que una prueba falla). El fake de la base está en `tests/fake-db.ts` y los ayudantes en `tests/harness.ts`.
2. `npx tsc --noEmit` limpio y `npx next build` al cerrar CADA tramo (las pruebas solas ya dejaron pasar un fallo de build).
3. Revisión de desbordes: hay un script con Chrome automatizado en la carpeta de borradores de la sesión anterior (`aud.mjs`, usa `puppeteer-core`); si no existe, recréalo: abre cada vista a 375, 768, 1024, 1280, 1440 y 1920 px y busca elementos cuyo borde derecho pase el de `main`. Chrome está en `/Applications/Google Chrome.app`.
4. El portal y el panel exigen sesión; el asistente no puede iniciarla ni escribir contraseñas. Para ver pantallas reales hay que pedirle al usuario que las mire, o hacer una página temporal con datos falsos (como se hizo con `/guia-visual`, solo en desarrollo).
5. Flake conocido ya corregido: `tests/50-que-me-toca` dependía de la hora (medianoche en Caracas). Si aparece otra prueba intermitente, suele ser dependencia del reloj.
6. Servidor de desarrollo: `npx next dev -p 3111` en segundo plano (el lanzador `.claude/launch.json` da EPERM). Apágalo al terminar si no lo pide el usuario.

## Mapa rápido
1. `lib/estado-cliente.ts`, `lib/portal*.ts`, `lib/cuenta-eliminar.ts`, `lib/portal-activacion.ts`: portal del cliente.
2. `lib/permisos.ts`, `lib/equipo.ts`, `lib/admins.ts`: quién entra al panel y qué puede (admin por `ADMIN_EMAILS`, colaborador con 9 permisos + raíz).
3. `lib/alertas-admin.ts`: alertas al equipo (actividad, tarea, urgente).
4. `lib/esperas.ts`, `lib/manual.ts`: límites explicados y manual del equipo.
5. `docs/plan-construccion.md` (historial detallado de cada tramo), `docs/prototipo-cambios.md` (decisiones del prototipo), `docs/flows.md`, `docs/api.md`, `docs/schema.sql`.
6. Memoria del proyecto en `~/.claude/projects/-Users-juantenreiro-Desktop-Web-Compaz/memory/` (índice `MEMORY.md`).
