# Auditoría técnica: panel del equipo, llamadas y ajustes de Compaz

Fecha: 2026-11-11. Alcance: `git diff 6d87cc9..HEAD` en la rama `rediseno` (5 commits, 171 archivos, +6340 −4383) y el código existente que toca. Método: lectura de código, ejecución real de `tsc`, pruebas y `next build`, y medición de lecturas contra la base real (solo SELECT; un guardia en el script bloqueaba cualquier escritura; el script ya se borró). Ningún valor secreto aparece en este informe.

## 1. Resumen ejecutivo

1. Veredicto: NO se puede abrir al público todavía. El modelo de permisos del panel está bien pensado, pero hay un hueco que lo anula y varios puntos de costo y de dinero que fallarán con las primeras decenas de clientes reales.
2. CRÍTICO (S-01): `GET /api/admin/cliente-preview` entrega, con el permiso más bajo (`monitorear`, activo por defecto), el correo, teléfono, Telegram, ficha del familiar y el chat de la visita en curso, sin motivo, sin registro y sin recorte. Anula todo el sistema de "ver contacto con motivo". La ruta ni siquiera tiene pantalla. Se corrige borrándola (1 hora).
3. Alto (S-02): `/portal?preview=<id>` decide "es administrador" con `getSession()` (cookie no verificada). Es la deuda ya anotada en CLAUDE.md, pero ahora una vista de cualquier cliente depende de ella.
4. Alto (S-03): las salas de Daily son públicas, con nombre `cmp-<8 hex del id>-<milisegundos>`; `/llamada/<sala>` y `/api/llamada/info` no piden sesión ni tienen límite.
5. Alto (E-01 y E-02): Seguimiento hace 89 consultas para 7 clientes (12,7 por cliente: unas 1.900 por recálculo con 150 clientes), y el portal se recarga entero cada 15 s por cliente, incluso con la pestaña oculta.
6. Alto (D-01): los pagos no son idempotentes, no son atómicos y anular un pago no deja quién lo hizo.
7. Resultados reales: `tsc` sin errores, 1214 pruebas pasan, 0 fallan, `next build` compila. Las pruebas usan una base falsa que no emula permisos ni RLS, así que no habrían detectado S-01.
8. Conteo: 1 Crítico, 6 Altos, 14 Medios, 9 Bajos, 4 Informativos (34 en total).
9. Costo estimado de corregir lo que bloquea el lanzamiento (fase 1 y 2 del plan): entre 45 y 65 horas.

## 2. Resultados de ejecución y mediciones

### 2.1 Verificaciones

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | Sin errores (1,8 s) |
| `node tests/run.mjs` | 1214 pruebas, 260 suites, 1214 pasan, 0 fallan, 15,9 s |
| `npx next build` (Next.js 16.4.3, Turbopack, tras detener `next dev` y borrar `.next/dev`) | Compila; TypeScript del build sin errores; 147 páginas generadas. Aviso: la convención `middleware` está obsoleta, Next pide migrar a `proxy` |
| `npm audit --omit=dev` | 0 vulnerabilidades en producción |
| `npm audit` (todo) | 7 moderadas, todas en la cadena de desarrollo `@typescript-eslint` |

Nota de proceso: el build reescribió `next-env.d.ts`; lo restauré con `git checkout`. El servidor de desarrollo que estaba corriendo (pid 27243) lo detuve y no lo reinicié.

### 2.2 JavaScript inicial por ruta (sin comprimir, de `.next/diagnostics/route-bundle-stats.json`)

| Ruta | Bytes | Observación |
|---|---|---|
| `/portal` | 1.078.836 | incluye `@daily-co/daily-js` |
| `/dashboard` | 1.069.563 | incluye `@daily-co/daily-js` |
| `/llamada/[sala]` | 723.790 | normal: aquí sí hace falta |
| `/panel` | 533.967 | razonable para el panel |
| `/login` | 479.412 | base de comparación |
| `/sala/[token]` | 472.150 | |
| `/admin` (solo redirige) | 461.309 | base compartida del sitio |

El mismo `/dashboard` pesa unos 590 KB más que `/login`: es el costo de cargar Daily para quien nunca entra a una llamada (hallazgo E-05).

### 2.3 Mediciones contra la base real (dos corridas, sin caché; datos de prueba: 4 compitas, 8 clientes, 7 con etapa)

| Pantalla (función) | Consultas | ms corrida 1 / 2 | Datos |
|---|---|---|---|
| Personas, compitas (`listarCompitas`) | 8 | 1062 / 479 | 7 KB |
| Personas, clientes (`listarClientes`) | 2 | 220 / 172 | 4 KB |
| Bandeja (`cargarBandeja`) | 1 | 158 / 192 | 0 |
| Seguimiento (`listarSeguimiento`) | 89 | 1125 / 1058 | 16 KB |
| Visitas (`listarVisitas`) | 1 | 139 / 137 | 3 KB |
| Más, Actividad (pág. 1) | 1 | 160 / 133 | 3 KB |
| Más, Ajustes | 2 | 160 / 234 | 0 |
| Más, Cobertura | 10 | 389 / 656 | 8 KB |
| Más, Avisos | 1 | 131 / 151 | 0 |
| Más, Pagos | 2 | 335 / 208 | 2 KB |
| Más, Reseñas | 1 | 223 / 130 | 0 |
| Más, Postulaciones | 1 | 148 / 136 | 1 KB |
| Más, Estado del sistema | 7 | 277 / 266 | 1 KB |

Lectura: la latencia base por consulta es de unos 130 ms (Supabase desde esta máquina). Todo lo de una sola consulta cuesta ese mínimo. Seguimiento es la excepción y es lineal en clientes.

Proyección (estimación, no medición): Seguimiento a 150 clientes ≈ 150 × 12,7 ≈ 1.900 peticiones a Supabase por cada recálculo, en 6 lotes de 25 clientes; entre 5 y 10 s por recálculo. Con caché por instancia de 30 s, un panel abierto por tres personas en instancias distintas puede generar más de 10.000 peticiones por minuto.

## 3. Hallazgos

Leyenda: C = confirmado por lectura de código o medición; S = sospecha (no se pudo ejecutar o falta ver la base). Esfuerzo en horas aproximadas.

### Crítico

**S-01 · Crítico · seguridad y privacidad · C**
Ubicación: `app/api/admin/cliente-preview/route.ts:5-46`; permiso base en `lib/permisos-catalogo.ts:11` (`monitorear: true` en `PERMISOS_BASE`); prueba que lo da por bueno `tests/37-permisos.test.ts:36`.
Evidencia: la ruta exige solo `monitorear` y devuelve `usuarios.*` con `compita:compitas(*)` (línea 15), `visitas.*` con `compita:compitas(*)` (línea 22), todos los `mensajes` de la visita en curso (líneas 31-35) y `visitasPasadas` con `select('*')` (línea 40). No usa `recortarParaActor`, no pide motivo, no escribe en `actividad_admin`. Ninguna pantalla la llama (búsqueda en `app`, `components`, `lib`: 0 resultados); es resto del panel viejo.
Escenario: un colaborador recién invitado con los permisos base (que por diseño NO ve teléfonos sin motivo ni chats) abre en el navegador `/api/admin/cliente-preview?usuario_id=<id>` y obtiene correo, teléfono, Telegram del compita, dirección y notas del familiar y la conversación. El requisito inamovible "cliente y compita nunca ven contactos del otro" queda anulado para el equipo y sin rastro.
Impacto: datos personales de personas mayores y sus familias; el registro de accesos, que es la garantía de privacidad prometida, queda vacío.
Corrección: borrar la ruta y su entrada en la prueba. Si hiciera falta una vista previa, ya existe `/portal?preview=`. Revisar el resto de rutas huérfanas (M-04) con el mismo criterio.
Esfuerzo: 1 h.

### Alto

**S-02 · Alto · seguridad · C (explotación no probada)**
Ubicación: `lib/auth.ts:18-27` (`requireAuth` devuelve la sesión de `getSession()`), `app/portal/page.tsx:23-34` y `lib/portal.ts:12-14`.
Evidencia: `requireAuth` verifica con `getUser()` pero devuelve `session` de `getSession()`; `/portal` calcula `esAdmin = isAdminEmail(session.user.email)` con ese objeto, que sale de la cookie y no está verificado. Con `esAdmin` y `?preview=<uid>`, `accesoPortal` devuelve `'portal'` y se cargan `cargarPortal(uid)` y `cargarDatosPortal(uid)` de cualquier cliente. Está anotado como pendiente en CLAUDE.md sección 6, punto 1; este diff lo hizo más grave porque añade esa vista.
Escenario: un cliente cualquiera edita el campo `user.email` de su cookie de sesión (conserva su propio token válido) y pide `/portal?preview=<id de otro>`.
Impacto: acceso a datos de otros clientes (familiar, visitas, plan) sin registro.
Corrección: `requireAuth` debe devolver el usuario de `getUser()`; `/portal` debe decidir admin con `actorDePagina()` y exigir permiso `monitorear` para `preview`, con registro de acceso.
Esfuerzo: 3 h.

**S-03 · Alto · seguridad · C**
Ubicación: `lib/daily.ts:22` y `:61` (nombres), `:29-39` (propiedades de la sala), `lib/llamada.ts:26-35`, `app/api/llamada/info/route.ts:8-14`, `app/llamada/[sala]/page.tsx:10-19`.
Evidencia: las salas se crean sin `privacy: 'private'` ni token de reunión (cualquiera con el nombre entra, máximo 3). El nombre es `cmp-` + 8 caracteres del id + `Date.now()`; el id de la visita aparece en URLs como `/feedback/[visitaId]`. `/llamada/<sala>` y `/api/llamada/info` no piden sesión, no tienen límite y cada petición llama a la API de Daily (`cache: 'no-store'`). El comentario de la ruta admite "saber el nombre equivale a tener el enlace".
Escenario: quien conozca el prefijo del id de una visita y la hora aproximada entra a una videollamada entre un compita y una persona mayor. Además, un script que pida `/api/llamada/info` en bucle gasta la cuota de la API de Daily y puede dejar sin crear salas a los usuarios reales.
Impacto: privacidad de la llamada, costo y disponibilidad.
Corrección: salas `privacy: 'private'`, un token de reunión por participante (`/v1/meeting-tokens`, con `exp` y `is_owner` para el equipo), nombres con 16 bytes aleatorios, límite de frecuencia por IP en `/api/llamada/info` y exigir sesión o token de visita en `/llamada/<sala>`.
Esfuerzo: 10 h.

**E-01 · Alto · eficiencia · C (medido)**
Ubicación: `lib/panel-seguimiento.ts:28-53`, `lib/estado-cliente.ts:202-231`.
Evidencia: 89 consultas y 1,1 s para 7 clientes (12,7 por cliente). `cargarFoto` hace entre 7 y 11 consultas por cliente en dos tandas, más `personaPausada` y `cupoDelPlan`. El comentario del propio archivo admite que "hay que pasar a una consulta por lotes". Tope de 150 clientes; la memoria de 30 s es por instancia.
Escenario: 150 clientes activos, tres personas del equipo con el panel abierto: miles de peticiones por minuto, 5 a 10 s de espera en cada carga en frío y riesgo de límites de Supabase.
Impacto: tiempo de carga, cuota de Supabase y dinero en funciones de Netlify.
Corrección: calcular la etapa en una vista o función SQL (`etapa_cliente`) o materializarla en una columna actualizada por los eventos que ya existen; Seguimiento pasa a una sola consulta paginada en la base.
Esfuerzo: 16 h.

**E-02 · Alto · eficiencia y costo · C**
Ubicación: `components/ui/AutoRefresh.tsx:12-16`, `app/portal/page.tsx:55`, `app/dashboard/page.tsx:999`.
Evidencia: `router.refresh()` cada 15 s sin comprobar `document.visibilityState`. Cada refresco ejecuta de nuevo toda la página en servidor (portal: `requireAuth`, `getClienteActivo`, `clienteVePortalNuevo`, `cargarPortal`; dashboard: una página de 1002 líneas con muchas consultas).
Escenario: 100 clientes con la pestaña abierta (también en segundo plano) generan 400 renders por minuto, 24.000 por hora, aunque no pase nada.
Impacto: facturación de funciones de Netlify y de Supabase proporcional a pestañas abiertas, no a actividad real.
Corrección: pausar cuando la pestaña está oculta, intervalo adaptativo (15 s solo si hay visita en curso, 120 s si no) o Supabase Realtime filtrado por usuario.
Esfuerzo: 4 h.

**D-01 · Alto · dinero · C**
Ubicación: `lib/pagos.ts:27-87` y `:96-107`, `app/api/admin/registrar-pago/route.ts:14-43`, `app/api/admin/anular-pago/route.ts:8-15`.
Evidencia: `registrarPago` inserta sin clave de idempotencia ni restricción única (CLAUDE.md sección 6, punto 4 lo reconoce); luego actualiza `usuarios` y registra el evento en pasos separados, sin transacción. `anularPago` solo guarda `anulado_motivo`; no guarda quién anuló ni cuándo, no llama a `alertaAdmin` ni a `registrarEvento`, y el motivo puede quedar vacío. Un colaborador con `pagos` puede registrar un pago con cualquier `referencia` de texto libre, sin comprobante.
Escenario: doble clic o dos personas registran el mismo Zelle y el cliente recibe dos paquetes de visitas (cada uno vale dinero). Otro caso: un colaborador anula un pago real y la visita deja de cobrarse; nadie sabe quién fue.
Impacto: dinero y confianza. Con Stripe el problema se mueve al webhook, pero esta ruta seguirá existiendo.
Corrección: columna `idempotencia` única (cliente, método, referencia normalizada) o función SQL `registrar_pago` atómica; guardar `anulado_por` y `anulado_en`; alerta de nivel `tarea` al administrador por cada anulación; motivo obligatorio.
Esfuerzo: 8 h.

**O-01 · Alto · operación · C**
Ubicación: entorno (CLAUDE.md sección 6 "Datos y respaldo"), `tests/fake-supabase-server.ts`, `.github/workflows/captacion.yml`.
Evidencia: local y producción comparten la misma base; el servidor usa la clave de servicio (ignora RLS); webhooks de Telegram y Daily apuntan a producción; no hay copias de seguridad ni restauración probada; el único flujo de CI (`captacion.yml`) solo corre con cambios de captación: ni `tsc` ni las 1214 pruebas corren en cada cambio.
Escenario: una prueba local de `forzar-cierre-visita` o `eliminar-cliente` actúa sobre datos de producción; un error en una migración no tiene vuelta atrás verificada.
Impacto: pérdida de datos irreversible.
Corrección: proyecto Supabase de pruebas, copias automáticas con una restauración ensayada, CI con `tsc` + pruebas + build en cada pull request. Ya está en la lista de pendientes del lanzamiento; se eleva a Alto porque hoy cualquier ejecución local escribe en producción.
Esfuerzo: 8 h.

### Medio

**S-04 · Medio · seguridad y privacidad · C**
Ubicación: `lib/alertas-admin.ts:36-46`, usado en `lib/panel-personas.ts:160-161` y `lib/panel-chat.ts:29-30`.
Evidencia: se promete que el acceso "se ANOTA antes de entregar el dato; si no se pudo anotar, no se entrega". Si el `insert` en `actividad_admin` falla, `alertaAdmin` entra en el `catch` y devuelve el resultado de `avisarAdmin` por Telegram: basta que Telegram responda bien para que devuelva `true` y el dato se entregue sin quedar en el registro oficial (que además es el que la pantalla "Registro de accesos" muestra). Además el motivo escrito por el colaborador entra como HTML a Telegram sin escapar, y `aTexto` (línea 29) borra cualquier cosa entre `<` y `>` antes de guardarlo: un motivo `Otro: <x> ...` se registra mutilado.
Escenario: caída parcial de la base (o tabla bloqueada): se leen teléfonos sin rastro en el registro; un motivo con `<b>` hace fallar el envío a Telegram.
Corrección: para categorías `acceso_*` usar una función que devuelva `false` si falla el `insert` (sin respaldo por Telegram) y guardar el motivo en una columna aparte, escapado.
Esfuerzo: 3 h.

**S-05 · Medio · seguridad · C**
Ubicación: `app/panel/page.tsx:162-163`, `lib/panel-personas.ts:102-123`, `lib/panel-personas.ts:77-98`.
Evidencia: `fichaDePersona` se carga para cualquiera que pueda entrar al panel (`atender` o `monitorear`) con solo poner `?persona=cliente:<id>` en la URL, sin exigir `monitorear` (la sección Personas sí lo exige). La línea de tiempo (`lineaDe`) incluye las filas de `actividad_admin` con `entidad_id`, es decir, también "X abrió el teléfono de Y. Motivo: ..." (accesos), que el Registro de accesos reserva a `telefonos`.
Escenario: un colaborador solo con `atender` ve fichas, notas y accesos de cualquier persona; uno con `monitorear` ve quién del equipo miró a quién.
Corrección: exigir `monitorear` para la ficha y filtrar las categorías `acceso_*` en `lineaDe` y `detalleDeVisita` para quien no tenga `telefonos`.
Esfuerzo: 2 h.

**S-06 · Medio · seguridad e integridad · C**
Ubicación: `app/api/admin/ajustes/route.ts:11-21`, `lib/ajustes.ts:72-74`, `lib/ajustes.ts:223-247`.
Evidencia: un colaborador con `ajustes_editar` puede cambiar precios, retención, topes y los textos antifraude y el aviso del chat que ven todos los clientes y compitas. Solo hay un aviso de nivel `actividad` (nadie suena). El texto se escapa al pintarse (bien), pero su contenido es libre (por ejemplo, un teléfono falso dentro de la "advertencia antifraude"). Además el comentario de la ruta dice "todo o nada", pero `setAjustes` guarda uno por uno con una llamada a `guardar_ajuste` por clave; si la tercera falla, las dos primeras quedan guardadas (el mensaje de error lo admite, líneas 242-243).
Corrección: `ajustes_editar` solo para el administrador, o doble confirmación; los textos antifraude, con una lista de patrones prohibidos (números, enlaces) o solo para raíz; función SQL que guarde el lote en una transacción; corregir el comentario.
Esfuerzo: 5 h.

**S-07 · Medio · abuso y costo · C**
Ubicación: `app/api/create-call/route.ts:14-54`, `app/api/admin/enviar-link-llamada/route.ts:20-173`, `app/api/llamada/info/route.ts`.
Evidencia: ninguna tiene límite de frecuencia ni explicación de espera (`lib/esperas.ts` no las cubre). `create-call` envía un Telegram al compita y una actividad en cada pulsación. `enviar-link-llamada` reenvía dos correos y un Telegram por cada llamada, pisa `slot_confirmado` con la hora actual sin mirar el estado de la solicitud (líneas 40-49) y no es idempotente. La línea 21 lee Ajustes antes de comprobar el permiso (línea 22).
Escenario: un cliente pulsando "Llamar" 30 veces manda 30 Telegram al compita; un colaborador con `atender` envía 30 correos a un cliente.
Impacto: spam a terceros y costo de Resend y Telegram.
Corrección: reclamar una clave única por solicitud y minuto (patrón `reclamarUnaVez`), agregarlas al `CATALOGO` de `lib/esperas.ts`, comprobar estado antes de mover el horario.
Esfuerzo: 5 h.

**S-08 · Medio · privacidad · C**
Ubicación: `lib/cuenta-eliminar.ts:140-170`, `supabase/migrations/20261111b_notas_persona.sql`, `lib/retencion.ts:15`, `app/api/cron/limpieza/route.ts:28-30`.
Evidencia: al borrar una cuenta se vacían usuario, fichas, fotos y mensajes, pero no se tocan `notas_persona` (las notas internas se declaran "no se borran solas"), ni los textos de `actividad_admin` y `admin_flags` que contienen el nombre y a veces teléfonos (hasta 90 días o 1 año), ni `avisos.variables`.
Escenario: una persona ejerce su derecho a eliminar la cuenta y sus datos siguen en notas y registros.
Impacto: incumplimiento de la política de privacidad prometida.
Corrección: borrar o anonimizar `notas_persona` y `entidad_nombre` de `actividad_admin`/`admin_flags` de esa persona al ejecutar el borrado; plazo de retención para notas.
Esfuerzo: 4 h.

**S-09 · Medio · operación · C**
Ubicación: `lib/cron.ts:26-29` (`ESPERADOS`), `app/api/cron/limpieza/route.ts`.
Evidencia: la vigilancia de latidos cubre 8 procesos; `limpieza` (la que aplica la retención, borra cuentas y sincroniza `ADMIN_EMAILS`) no está en la lista, ni `aviso-inicio-visita`, `churn-alerta`, `noshow-alerta`, `recordatorio-pago`. Si `limpieza` deja de correr, nadie se entera.
Corrección: agregar los 5 procesos a `ESPERADOS` y que cada función llame a `latido`.
Esfuerzo: 2 h.

**S-10 · Medio · eficiencia y corrección · C**
Ubicación: `lib/panel-personas.ts:19,27-31,65`, `lib/panel-visitas.ts:7,12-14`, `lib/panel-bandeja.ts:28`, `lib/panel-mas-datos.ts:63`.
Evidencia: `listarCompitas` y `listarClientes` traen hasta 5000 filas y filtran, ordenan y paginan en memoria; `listarVisitas` trae las 1000 más recientes y calcula conteos y filtros ("Hoy", "En curso", "Con problema") sobre ese recorte. `listarClientes` ordena por alta descendente: pasado el tope los clientes más antiguos desaparecen sin aviso. Bandeja limita a 500 sin avisar.
Escenario: con 1.001 visitas, "Todas" y los conteos por vista dejan de ser verdad; con 5.001 clientes faltan clientes en la búsqueda.
Impacto: datos incorrectos mostrados con seguridad y carga que crece con los clientes.
Corrección: filtros y paginación en SQL (`range`, `ilike`, `count`) y conteos por vista con una consulta agregada; avisar en pantalla si se alcanzó el tope.
Esfuerzo: 12 h.

**E-03 · Medio · eficiencia · S (por confirmar con `pg_indexes`)**
Ubicación: `lib/panel-personas.ts:85`, `lib/panel-visitas.ts:32`, `lib/panel-actividad.ts:29`; índices en `supabase/migrations/20261110_actividad_admin.sql:16-17`.
Evidencia: `actividad_admin` tiene índices solo por `creado_en` y `nivel`; las consultas por `entidad_id` (cada ficha, cada visita) y por `categoria` (Registro de accesos, un año de datos) no tienen índice, y la búsqueda `ilike '%texto%'` sobre `resumen` recorre toda la ventana. No pude confirmar los índices de `visitas(usuario_id)`, `mensajes(visit_id)` y `solicitudes(cliente_id)` porque solo hay acceso por la API de datos.
Corrección: índices `(entidad_id, creado_en desc)` y `(categoria, creado_en desc)`; para búsqueda de texto, `pg_trgm`.
Esfuerzo: 2 h.

**E-04 · Medio · eficiencia · C**
Ubicación: `lib/auth.ts:62-67,72-81`, `lib/permisos.ts:46-47`, `middleware.ts:61`.
Evidencia: `getClienteActivo`, `getAdminUser`, `getUsuario` y `requierePermiso` llaman a `supabase.auth.getUser()` cada una (una petición de red a Supabase Auth) en lugar de la versión cacheada `usuarioVerificado`. Una visita a `/portal` hace `getUser` en el middleware, en `requireAuth` y en `getClienteActivo`: 3 llamadas de Auth más 2 consultas antes de pintar nada. Una acción del panel: `getUser` + 1 consulta de `equipo` por ruta (esto último es correcto y deseable).
Corrección: usar `usuarioVerificado()` en todas las funciones de servidor de página.
Esfuerzo: 2 h.

**E-05 · Medio · transferencia · C**
Ubicación: `components/ui/VideoCall.tsx:5`, `components/portal/SeccionVisitas.tsx:3`, `app/dashboard/page.tsx:5`.
Evidencia: `SalaDaily` importa `@daily-co/daily-js` de forma estática y `VideoCall` lo arrastra al paquete inicial de `/dashboard` y `/portal` (1,07 MB frente a 0,48 MB de `/login`). No hay `next/dynamic` para cargarlo al pulsar "Llamar".
Impacto: unos 590 KB sin comprimir extra en cada carga del portal, en móviles de gama baja y datos caros en Venezuela.
Corrección: `dynamic(() => import('@/components/llamada/SalaDaily'), { ssr: false })` dentro de `LlamadaIncrustada`.
Esfuerzo: 1 h.

**A-01 · Medio · arquitectura · C**
Ubicación: 27 de las 46 rutas de `app/api/admin/*` no tienen ningún llamador en `app`, `components` ni `lib`: `asignar-compita`, `bloquear-cliente`, `bloquear-compita`, `bloqueos-compita`, `cliente-preview`, `compita`, `completar-solicitud`, `demo/*` (5), `dudas`, `eliminar-cliente`, `eliminar-compita`, `enviar-link-llamada`, `esperas`, `forzar-cierre-visita`, `generar-invite`, `invitar-cliente`, `pagos`, `portal-nuevo`, `registrar-compita`, `toggle-estado`, `toggle-verificado`, `upload-foto`. El panel viejo (`app/admin/*`) se redujo a redirecciones.
Impacto: superficie de ataque sin uso (S-01 es un caso) y, además, posible pérdida de función: no veo en el panel nuevo cómo bloquear un cliente, eliminar una cuenta o generar una invitación (sospecha: confirmar con el dueño si hoy se hace por otra vía).
Corrección: decidir ruta por ruta si se conecta a una pantalla o se borra; dejar la prueba `37-permisos` con un campo "con pantalla: sí/no".
Esfuerzo: 6 h.

**A-02 · Medio · arquitectura · C**
Ubicación: consultas directas a Supabase fuera de `lib/` (CLAUDE.md regla 4): `app/api/admin/enviar-link-llamada/route.ts:29,44,65`, `app/api/admin/flags/route.ts` (4), `app/api/admin/cliente-preview/route.ts` (4), `app/api/admin/resenas/route.ts` (2), `app/api/admin/forzar-cierre-visita/route.ts:20`, `app/api/admin/registrar-pago/route.ts:34`, `app/api/create-call/route.ts:19,41`, `app/api/admin/asignar-rapido/route.ts` (5), `app/api/admin/eliminar-cliente`, `invitar-cliente`, `upload-foto`, `toggle-verificado`, `generar-invite`, `registrar-compita`, `completar-solicitud`. Respuestas sin helpers de `lib/api.ts` (regla 5): `cliente-preview` (líneas 9, 46), `eliminar-compita`, `upload-foto`. Además `app/panel/page.tsx` mezcla 190 líneas de orquestación y `app/dashboard/page.tsx` tiene 1002 líneas con estilos en línea.
Impacto: lógica repartida, difícil de probar y de cambiar de manos.
Esfuerzo: 10 h (se solapa con A-01).

**C-01 · Medio · consistencia · C**
Ubicación: `app/api/admin/enviar-link-llamada/route.ts:90,122,151`, `app/api/chat/route.ts` (prompt: "videollamada de 20 minutos"), `app/solicitar/SolicitarForm.tsx:13`.
Evidencia: los correos y el Telegram dicen "límite de 20 minutos" y en la misma frase "se cierra a los ${corteLlamada} min" (23 por defecto). El asistente y varias pantallas tienen "20 minutos" fijo aunque `llamada_corte_min` es editable y se supone que los textos nunca dicen un número distinto al del sistema (`lib/llamada.ts:1-2`).
Corrección: una sola función `textoDuracionLlamada()` con la duración de franja y el corte.
Esfuerzo: 2 h.

**O-02 · Medio · operación · C**
Ubicación: todo el código (277 `console.error`), `package.json` (sin librería de errores).
Evidencia: no hay registro centralizado de errores ni alertas por fallo de rutas; el equipo solo se enterará leyendo los logs de Netlify. La auditoría de acciones administrativas es parcial: `anular-pago`, `forzar-cierre-visita`, `eliminar-*`, `toggle-*` no dejan siempre quién y qué había antes.
Corrección: Sentry (o equivalente) con el identificador de solicitud; un `registrarAccionAdmin(actor, accion, antes, despues)` común.
Esfuerzo: 8 h.

### Bajo

**S-11 · Bajo · seguridad · C.** `next.config.ts:23-27`: CSP con `'unsafe-inline'` en `script-src` (anula la protección contra XSS), `connect-src` permite `api.telegram.org` y `api.airtable.com` desde el navegador (no se llaman desde cliente) y `img-src https:` abierto. Corrección: nonces, y recortar `connect-src`. 4 h.

**S-12 · Bajo · seguridad · C.** `app/api/webhooks/daily/route.ts:30-32`: se acepta además un secreto estático en cabecera "por compatibilidad", reutilizable sin límite de tiempo. Retirarlo cuando el webhook firmado funcione. 0,5 h.

**S-13 · Bajo · privacidad · S.** `lib/panel-mas-datos.ts:48-50` y `lib/panel-estado.ts:28`: el campo `error` de avisos fallidos (texto de Resend o Telegram) se muestra a quien tenga `monitorear` sin `recortarTexto`; podría incluir un correo. Aplicar el recorte. 1 h.

**S-14 · Bajo · seguridad · C.** `app/api/admin/asignar-rapido/route.ts:15-24`: el token viaja en la URL (consulta); funciona con reclamo atómico y confirmación por POST, pero queda en historiales de Telegram y del navegador. Aceptable; documentar.

**S-15 · Bajo · seguridad · S.** `lib/permisos.ts`: la identidad del colaborador es su correo; hay que confirmar en Supabase que "Confirm email" está activo y que no se permiten registros por contraseña, o un tercero que registre ese correo sin verificarlo heredaría permisos. 0,5 h para comprobar.

**E-06 · Bajo · eficiencia · C.** `lib/cache-corto.ts` y `lib/ajustes.ts:158-176`: las memorias viven por instancia de función; con instancias frías no sirven y con varias instancias el precio cambiado tarda hasta 30 s en verse en cada una. No es un error, pero no debe tratarse como caché real. `app/api/precios/route.ts` no manda `Cache-Control`; `usePrecios` hace un `fetch` por montaje. Agregar `s-maxage=30`. 1 h.

**E-07 · Bajo · eficiencia · C.** `lib/daily.ts:6-49`: dos peticiones simultáneas pueden crear dos salas (nombre con `Date.now()`) y ninguna llamada a Daily tiene tiempo máximo ni reintento. Agregar `AbortSignal.timeout` y bloqueo por visita. 2 h.

**A-03 · Bajo · arquitectura · C.** `app/prototipo/*` se publica en producción con cinco pantallas de 470 a 620 KB; revela flujos y permisos. Excluir del build de producción. 1 h.

**A-04 · Bajo · arquitectura · C.** El aviso de obsolescencia del build: `middleware` pasa a `proxy` en esta versión de Next. Migrar con el codemod. 1 h.

### Informativo

**I-01.** Pruebas: 1214 pasan pero con `tests/fake-supabase-server.ts`, que no emula RLS ni permisos de columnas ni transacciones; el ejemplo es `20261112_resenas_permiso.sql` (el permiso de `resenas` faltó y solo se vio en vivo). La prueba `37-permisos` valida que cada ruta use `requierePermiso`, no que el permiso elegido sea el adecuado (de ahí S-01).

**I-02.** Dependencias con rangos `^` en `package.json` (la versión real queda fijada por `package-lock.json`). Para `@daily-co/daily-js` (^0.95.0) conviene fijar exacta.

**I-03.** El administrador raíz no ve motivo obligatorio al abrir contactos ni chats (`lib/panel-personas.ts:135`), pero sí queda un registro ("Sin motivo requerido"). Es una decisión razonable; documentarla en la política.

**I-04.** Migraciones nuevas (`20261111_compita_telefono.sql`, `20261111b_notas_persona.sql`, `20261112_resenas_permiso.sql`) solo agregan y son repetibles; `notas_persona` activa RLS y revoca a `anon` y `authenticated`. Sin migraciones de reversa.

## 4. Lo que está bien construido (conservar)

1. Guardia de permisos única y con negación por defecto: `lib/permisos.ts:45-62` (`requierePermiso` falla cerrado con 503 si no puede comprobar) y `normalizarPermisos` que solo acepta `true` exacto (`lib/permisos-catalogo.ts:35-41`).
2. Todas las rutas de `/api/admin` salvo `asignar-rapido` (por token) usan `requierePermiso`, y una prueba estática impide que aparezca una nueva sin permiso (`tests/37-permisos.test.ts:44-48`).
3. Gestión del equipo solo para el administrador raíz, con historial de cada cambio y baja inmediata porque la fila se consulta en cada petición (`lib/equipo.ts:25-30,55-103`); un colaborador no puede darse permisos.
4. Datos de contacto fuera de las listas y de la ficha: solo salen por `revelarContacto` con permiso y motivo, y recortan teléfonos y correos en textos libres para quien no tiene `telefonos` (`lib/panel-datos.ts:12-42`), antes de viajar al navegador.
5. Búsqueda en Actividad sin inyección: `limpiarBusqueda` quita comas, paréntesis, comodines y comillas antes de armar el filtro `.or()` (`lib/panel-actividad.ts:13`), y la búsqueda de quien no tiene `telefonos` se hace sobre texto ya recortado, para no poder adivinar un teléfono preguntando por él.
6. Importes siempre del servidor: `registrarPago` ignora el monto del navegador y rechaza cualquier valor distinto (`lib/pagos.ts:45-47`); el asistente y los correos leen `preciosVigentes()`.
7. Webhooks y cron fallan cerrados: `secretoValido` rechaza secreto vacío (`lib/links.ts:53-56`), la firma de Daily comprueba HMAC y ventana de 5 minutos (`app/api/webhooks/daily/route.ts:18-29`) y los cron usan `x-cron-secret`.
8. Ajustes con valor por defecto, validación de tipo y rango, reglas entre ajustes y función SQL que guarda valor e historial juntos por cada clave (`lib/ajustes.ts:115-146,223-246`); las migraciones del cambio solo agregan.

## 5. Plan de corrección por fases

Fase 1, antes de subir a producción (unas 25 horas):
1. S-01 borrar `cliente-preview` y revisar las otras 26 rutas huérfanas (A-01).
2. S-02 `requireAuth` con `getUser()` y `/portal?preview=` con permiso y registro.
3. S-04 el registro de accesos no puede fallar abierto.
4. S-05 ficha y línea de tiempo con el permiso correcto.
5. D-01 anulación con autor y alerta; clave de idempotencia en pagos.
6. E-02 pausar `AutoRefresh` en pestañas ocultas.
7. S-09 vigilar `limpieza` y los otros cron.
8. O-01 (parte): copia automática de Supabase y una restauración ensayada.

Fase 2, antes de abrir al público (unas 25 a 40 horas):
1. S-03 salas privadas con token y nombres aleatorios; límite en `/api/llamada/info`.
2. E-01 Seguimiento en una consulta; S-10 filtros y paginación en la base; E-03 índices.
3. S-06 y S-07 límites de frecuencia y control sobre ajustes y llamadas.
4. S-08 borrado completo en la eliminación de cuenta.
5. O-01 entorno de pruebas separado y CI con `tsc`, pruebas y build.
6. O-02 Sentry y auditoría administrativa común.
7. E-04, E-05, C-01.
8. Reemplazar `PAGO_SIMULADO` y aplicar la lista de Stripe de CLAUDE.md sección 6.

Fase 3, después del lanzamiento: A-02 (capas), S-11 (CSP con nonces), E-06, E-07, A-03, A-04, políticas RLS como segunda barrera, cola de trabajos para avisos, tablero de monitoreo.

## 6. Recomendaciones de mentor

Qué haría distinto un equipo profesional que construyera este CRM hoy, en orden de prioridad real:

1. Indispensable antes de abrir: entorno de pruebas separado, copias con restauración probada, y CI que corra `tsc`, pruebas y build en cada cambio. Hoy una prueba manual local escribe en producción. Costo bajo, riesgo enorme.
2. Indispensable: una sola puerta de datos sensibles. La prueba que debería existir es "ninguna ruta devuelve `select('*')` de `usuarios` o `compitas`" y un listado de columnas permitidas por permiso. S-01 sobrevivió porque la prueba revisa que haya guardia, no qué devuelve.
3. Indispensable: llamadas con salas privadas y token por participante. Es un servicio con personas mayores; una sala adivinable no es aceptable ni siquiera con probabilidad baja.
4. Indispensable: el cálculo de la etapa del cliente en la base (vista o función), no en el servidor con 12 consultas por persona. Es el mismo motor para portal, Seguimiento y caso; ahí está la deuda de rendimiento y también el único origen de verdad.
5. Muy recomendable (primer mes): RLS como segunda barrera. Con clave de servicio se ignora, pero políticas mínimas en tablas sensibles (`usuarios`, `compitas`, `mensajes`, `notas_persona`) y un rol de base de datos para el panel con permisos por columna convertirían un error de código como S-01 en un error de permisos de la base.
6. Muy recomendable: cola de trabajos para avisos (tabla `avisos` con estados y reintento ya existe; falta un trabajador con reintento exponencial y un tablero de fallidos con alerta). Ya hay la base: `lib/avisos.ts` y los cron.
7. Muy recomendable: Sentry y un tablero de salud (los latidos de cron ya existen; sumar errores por ruta y latencia).
8. Lujo prematuro hoy: Realtime para todo el panel, caché distribuida, microservicios, un sistema de roles personalizable más allá de los 9 permisos actuales, y pruebas de carga masivas. Con menos de 1.000 clientes, la consulta única indexada y paginación en SQL bastan.
9. Plan de crecimiento y costo por cliente: medir por cliente activo las funciones de Netlify (el refresco de 15 s es hoy el mayor consumo evitable), las peticiones a Supabase, los minutos de Daily (cada llamada crea una sala nueva que expira en 23 min o `llamada_visita_min`), Resend y Telegram. Con el refresco actual, 100 clientes con la pestaña abierta cuestan más que 100 clientes llamando.
10. Gestión de secretos: variables separadas por entorno (hoy un solo proyecto), rotación documentada de `SUPABASE_SERVICE_ROLE_KEY`, `DAILY_API_KEY`, `CRON_SECRET` y de los secretos de webhook, y ninguna de ellas en `NEXT_PUBLIC_` (comprobado: solo hay 9 variables públicas y ninguna es secreta).

## 7. Lo que no se pudo comprobar

1. Explotación real de S-02 (editar la cookie) y de S-01 contra producción: no ejecuté peticiones con sesiones falsas ni contra rutas de escritura. Comprobación: con un colaborador de prueba y la base de pruebas, abrir `/api/admin/cliente-preview` y la cookie modificada en `/portal?preview=`.
2. Entropía real del nombre de las salas y facilidad de enumerarlas: depende de la API de Daily (límites de tasa) y de cuánto se expone el id de visita. Comprobación: crear salas de prueba y medir cuántas peticiones por minuto permite la API sin cuenta.
3. Índices existentes en `visitas`, `mensajes`, `solicitudes` y `admin_flags` y los planes de consulta: solo tengo acceso por la API de datos. Comprobación: `select * from pg_indexes` y `explain analyze` en el editor SQL de Supabase.
4. Rendimiento con 100 o 10.000 clientes: la base tiene 8 clientes. Las proyecciones se basan en consultas por cliente (12,7) y deben repetirse con datos sintéticos en una base de pruebas.
5. Políticas RLS reales: el servidor usa la clave de servicio y no las ejerce; no revisé las políticas de las tablas previas a este diff.
6. Telegram y Daily en vivo, correos en la bandeja real y una llamada con dos personas: no envié mensajes ni creé salas por regla de esta auditoría. Comprobación: ensayo de punta a punta con una cuenta de pruebas.
7. Configuración de Supabase Auth (confirmación de correo, registro abierto) y de Netlify (variables, cabeceras efectivas): requiere acceso a esos paneles.
8. Accesibilidad y uso a 375 px del panel: no se hizo recorrido visual; solo lectura de código.
9. Código fuera del diff no revisado a fondo: `app/sala/[token]`, `lib/telegram.ts`, `app/api/auth/*`, el resto de `lib/` y `app/dashboard/page.tsx` más allá de lo citado.

---

## 8. Estado de cada hallazgo después de las correcciones (2026-11-12)

Leyenda: **Hecho** = corregido en código y con prueba; **Tú** = depende de algo que solo puede hacer el dueño en un servicio externo; **Decisión** = se dejó así a propósito y se explica.

| Id | Estado | Qué se hizo |
|---|---|---|
| S-01 | Hecho | Ruta `cliente-preview` borrada. |
| S-02 | Hecho | `requireAuth` devuelve el usuario verificado; la vista previa del portal anota el acceso antes de mostrarlo. |
| S-03 | Hecho | Salas privadas, nombre aleatorio y pase de Daily por participante. |
| E-01 | Hecho | `cargarFotos` y `cuposDelPlan` por lotes: de 89 a unas 15 consultas para 7 clientes. |
| E-02 | Hecho | `AutoRefresh` no refresca en pestañas ocultas y es lento en reposo. |
| D-01 | Hecho | Pagos sin duplicados; anular exige motivo y deja evento y alerta. |
| O-01 | Parcial: **Tú** | Añadido `.github/workflows/ci.yml` (tipos, pruebas y compilación en cada cambio), `scripts/respaldo.sh` y la guía paso a paso `docs/entorno-de-pruebas-y-respaldos.md`. Crear el proyecto de pruebas y activar los respaldos requiere tu cuenta de Supabase. |
| S-04 | Hecho | `registrarAcceso` falla cerrado y no mutila el motivo. |
| S-05 | Hecho | La línea de tiempo oculta los accesos a quien no tiene `telefonos`. Se mantiene que `atender` abre la ficha: la Bandeja lo necesita. |
| S-06 | Hecho | Precios, retención y textos solo para el administrador; el lote de ajustes es todo o nada (con reversión). |
| S-07 | Hecho | Reenviar el enlace de llamada: una vez cada 5 minutos por solicitud (con explicación en Límites) y solo si la solicitud sigue aceptada; el aviso al compita por "Llamar" sale como mucho una vez por minuto. |
| S-08 | Hecho | Al anonimizar se borran las notas internas y el nombre sale de Actividad y de las tareas. Además se corrigió un error real: al anonimizar no se borraban los mensajes (la columna es `visit_id`, no `visita_id`). |
| S-09 | Hecho | `limpieza`, `recordatorio-pago`, `recordatorio-primera-visita`, `aviso-inicio-visita`, `noshow-alerta` y `churn-alerta` están vigilados y marcan su latido. |
| S-10 | Parcial: **Decisión** | Filtros y paginación siguen en memoria (con 4 compitas y 8 clientes no importa); ahora cada pantalla avisa cuando llega al tope de filas cargadas (5.000 personas, 1.000 visitas, 500 tareas), para que ningún conteo parezca completo sin serlo. Pasar a paginación en la base es el cambio correcto al acercarse a ~1.000 clientes: exige guardar la urgencia y la etapa como columnas. |
| E-03 | Hecho: **Tú aplicas** | Migración `20261113_indices_panel.sql` (solo agrega índices y `pg_trgm`). |
| E-04 | Hecho | Todas las funciones de sesión usan la comprobación cacheada. |
| E-05 | Hecho | `daily-js` se carga solo cuando hay una llamada. |
| A-01 | Hecho | Todas las rutas de `/api/admin` tienen pantalla, salvo cuatro de lectura (`bloqueos-compita`, `dudas`, `esperas`, `pagos`) que se conservan como API probada; una prueba impide que aparezcan rutas huérfanas nuevas. |
| A-02 | Hecho en `/api/admin` y `create-call` | Sin consultas dentro de las rutas del equipo (prueba de guardia). Las otras 49 rutas antiguas quedan con un trinquete: no pueden sumar consultas directas. |
| C-01 | Hecho | Una sola frase (`textoDuracionLlamada`) con el corte de Ajustes. |
| O-02 | Hecho (sin servicio externo) | Toda acción del equipo queda anotada con quién; todo error 500 queda en Actividad (categoría `error_servidor`, una vez cada 10 minutos por mensaje) y al cliente le llega un mensaje genérico. Un servicio como Sentry (trazas y agrupación) sigue siendo opcional. |
| S-11 | Parcial: **Decisión** | Quitados Airtable y Telegram de `connect-src`. `'unsafe-inline'` en scripts se mantiene: los scripts de analítica y el modo de Next lo requieren; quitarlo exige nonces por petición (renderizado dinámico de todo el sitio). |
| S-12 | Hecho | El secreto estático del webhook de Daily ya no se acepta salvo `DAILY_WEBHOOK_LEGACY=1`. |
| S-13 | Hecho | Los errores de avisos fallidos se muestran sin teléfonos ni correos si no hay permiso. |
| S-14 | Decisión | El token de `asignar-rapido` viaja en la URL a propósito: es de un solo uso, vence y se confirma por POST. Queda documentado aquí. |
| S-15 | Hecho (verificado) | Comprobado el 2026-11-12 por la API de Supabase y con tu captura: registros nuevos desactivados, "Confirm email" activo, sin inicios anónimos. |
| E-06 | Hecho | `/api/precios` manda `Cache-Control`. La memoria corta sigue siendo por instancia y no se trata como caché real. |
| E-07 | Parcial | Toda llamada a Daily tiene tiempo máximo de 8 s. Dos peticiones simultáneas todavía pueden crear dos salas; la última que se guarda gana, y la otra expira sola. |
| A-03 | Hecho | `/prototipo` devuelve 404 en producción (se enciende con `PROTOTIPO_VISIBLE=1`). |
| A-04 | Hecho | `middleware.ts` pasó a `proxy.ts`. |
| I-01 | Decisión | Las pruebas usan una base falsa y no emulan RLS ni permisos de columnas: por eso lo de `resenas` solo se vio en vivo. La compensación es hacer una pasada en vivo antes de abrir al público. |
| I-02 | Hecho | `@daily-co/daily-js` fijado a `0.95.0`. |
