# Para Luis: qué cambió el 12 de noviembre de 2026, por qué, y cómo trabajamos desde ahora

Preparado por Juan, con ayuda de Claude. Léelo de arriba abajo una vez; después sirve de consulta. La sección 2 es lo único urgente.

---

## 1. Resumen ejecutivo

1. **Panel nuevo en producción.** `/panel` (con datos reales) reemplazó al `/admin` viejo, que ahora solo redirige. Incluye Bandeja, Personas, Seguimiento, Visitas y todo lo de Más (reseñas, pagos, avisos, cobertura, equipo y permisos, ajustes, postulaciones y origen (CMC), invitar, actividad, registro de accesos, límites, manual y estado). Versión en producción hoy: **1.1.3-beta.1** (se ve en el menú lateral del panel).
2. **La base de datos se movió de São Paulo a Virginia.** Era la causa principal de la lentitud: el servidor de Netlify corre en Virginia (región bloqueada en nuestro plan) y cada consulta cruzaba continentes. El proyecto nuevo se llama **`compaz-prod`**. **El proyecto de São Paulo ya no es producción** y quedó renombrado `ARCHIVO-NO-USAR-saopaulo-viejo`.
3. **El panel es entre 2 y 3 veces más rápido.** Contenido completo de cada pantalla: de 700 a 1750 ms a 250 a 450 ms casi siempre.
4. **Tu CMC quedó integrado al panel y al sistema** (sección 5): la ficha del compita muestra su estado en el CMC, el panel no deja verificar ni activar a quien el CMC no permite, y el alta manual no duplica un perfil que ya existe desde el CMC.
5. **Airtable ya no se usa.** Su cuota de API está agotada y sus procesos fallan. Falta cortarlo de forma ordenada, y eso depende de tu lado (sección 2, punto C).
6. **Todo lo que hay en la base son datos de prueba.** No hay clientes reales todavía; por eso fue el momento barato para hacer la migración.

**Lo que necesito de ti** (detalle en la sección 2): que tu entorno local deje de apuntar al proyecto viejo, que me confirmes en qué etapa va tu integración del CMC, y que sigas las reglas de trabajo de la sección 6.

---

## 2. Lo que tienes que hacer tú

### A. Dejar de apuntar al proyecto viejo (urgente)

El proyecto viejo es `qrhkzlzblaknzsxqfney` (dirección `qrhkzlzblaknzsxqfney.supabase.co`, región `sa-east-1`). Producción ya no lo usa. **Si algo tuyo lo sigue usando, está escribiendo en una base que nadie mira**, o va a dejar de funcionar cuando se pause.

Busca esa referencia (`qrhkzlzblaknzsxqfney`) en todos estos sitios y cámbiala:

1. Tu `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
2. Los secretos de GitHub Actions del repositorio, si guardas alguno de Supabase.
3. Las propiedades de tu Apps Script (el CMC). Por lo que dice tu documentación el CMC habla con la web por HTTP y no directo con la base, pero confírmalo.
4. Cualquier cliente SQL, conector o configuración de MCP de Supabase que tengas guardado con ese proyecto.

**No apuntes tu entorno local a `compaz-prod`** (producción) salvo que haya una razón concreta y avises. Es justo el error que queríamos evitar: antes local y producción compartían base y una prueba tuya podía escribir en producción.

### B. Dónde desarrollas ahora (decisión pendiente entre los dos)

Necesitas una base de pruebas propia. Hay tres caminos, de más simple a más trabajo:

1. **Supabase local con Docker** (`supabase start`). Es lo que ya usa el CI en el trabajo `e2e`. Gratis y aislado. Sirve para código y pruebas.
2. **Un proyecto de pruebas en la nube** (`compaz-pruebas`), como describe `docs/entorno-de-pruebas-y-respaldos.md`. El plan gratuito de Supabase permite 2 proyectos activos y hoy tenemos 2 (`compaz-prod` y el archivado), así que habría que **pausar el viejo primero** (se puede restaurar). Para llenarlo rápido con datos de prueba existe la herramienta de la sección 3.2: copia estructura, datos y usuarios de un proyecto a otro.
3. **Seguir usando el viejo como pruebas.** Funciona, pero lo renombré a propósito para que nadie lo confunda con producción; yo no lo recomiendo.

Mi recomendación: **pausar el viejo cuando tu `.env.local` ya no lo use, y crear `compaz-pruebas` en Virginia** con el camino 2. Dime cuál prefieres.

### C. Tu CMC y Airtable

Dime en qué etapa estás, porque de eso depende cortar Airtable. Según tus propios documentos a fecha 11 de noviembre:

1. **Lectura de postulaciones desde Supabase** (`docs/cmc/fuente-supabase.md`): falta, si no lo hiciste ya, aplicar el parche del Apps Script, añadir unas 200 filas vacías a la pestaña 03, correr `simularFuenteSupabase()` y poner `CMC_FUENTE=supabase`. La variable `CMC_LECTURA_TOKEN` ya existe en Netlify (solo en Production).
2. **Publicación de compitas habilitadas** (`docs/cmc/compitas-desde-cmc.md`): la migración `20261111_cmc_compitas` está aplicada (también en la base nueva). Faltan las etapas 2 a 5. **En Netlify no existen todavía `CMC_ESCRITURA_TOKEN` ni `CMC_COMPITAS_MODO`.** Crea el primero (al menos 32 caracteres aleatorios, solo en Production, y el mismo valor en las propiedades de tu script). Mientras `CMC_COMPITAS_MODO` no sea `aplicar`, todo corre en simulación y no escribe nada.
3. **Cortar Airtable:** cuando el punto 1 esté activo, avisa y se pone `POSTULACIONES_DESTINO=solo_supabase` en Netlify (la variable ya existe) y se redespliega. Con eso los procesos `conciliar-airtable` y `reintentar-airtable` solo anotan su latido y dejan de llamar a Airtable.

**Por qué importa el orden:** si se corta Airtable antes de que el CMC lea de Supabase, los postulantes nuevos serían invisibles para selección. Hoy, con la cuota agotada, ya no están llegando a Airtable, así que el riesgo es real.

**Aviso que vas a ver en Telegram:** hacia las 20:20 UTC puede llegar "Cron detenido: conciliar-airtable". Es esperado (Airtable rechaza por cuota) y se silencia con el punto 3.

---

## 3. Qué se hizo y por qué

### 3.1 El panel nuevo reemplazó al viejo

Se construyó con datos reales siguiendo `docs/handoff-panel-nuevo.md`. El `/admin` viejo se eliminó y redirige a `/panel`. Se hicieron dos rondas de auditoría de seguridad (informes en `docs/auditoria-2026-11-11.md` y `docs/revision-2026-11-12.md`) y todo lo encontrado quedó resuelto. Además: llamadas dentro de la sala con aviso de fin, ajustes conectados a comportamiento real, permisos por colaborador, validación de correos y eliminar cuenta conservando el historial.

Se guardaron capturas de cómo era el panel viejo, solo en el equipo de Juan.

### 3.2 La base de datos pasó a Virginia

**Por qué.** El servidor de Netlify corre en **Virginia (IAD)** y la región está bloqueada en el plan actual (Personal, 9 USD al mes; elegir región exige el plan Pro). La base estaba en **São Paulo**. Cada consulta pagaba unos 120 ms de viaje y cada pantalla hacía de 5 a 13 en fila. Los clientes de lanzamiento están en EE. UU., y Stripe, Resend, Daily y Telegram también están allí; los compitas en Venezuela trabajan casi todo por Telegram, así que Virginia es la región correcta.

**Cómo.**
1. Se creó el proyecto `compaz-prod` (Virginia, `us-east-1`, plan gratuito por ahora) con la Data API activada, "exponer tablas nuevas solas" desactivado y la RLS automática activada, igual que el original.
2. Se copiaron estructura, datos y usuarios de acceso con `pg_dump` (scripts en `scripts/migracion/`, plan en `docs/migracion-supabase-virginia.md`). El viejo solo se leyó. Comprobación fila por fila: **37 tablas, 47 funciones, 23 políticas, el trigger de usuarios nuevos y 3 tablas de tiempo real, todo igual**.
3. Los permisos de `anon` y `authenticated` quedaron idénticos. A `service_role` le quedaron más permisos que en el viejo (en el viejo le faltaban algunos), lo cual es seguro.
4. Se repitió a mano la configuración de acceso: **registro de usuarios cerrado** (el proyecto nuevo viene abierto por defecto), confirmación de correo activada, Site URL `https://micompaz.com`, las 3 URLs de retorno, SMTP de Resend, y las plantillas de correo (enlace de acceso e invitación) copiadas del viejo.
5. Se cambiaron 3 variables en Netlify (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) y se redespliegó. Se usaron las claves **legacy** (formato `eyJ...`) para no cambiar de tipo de clave a la vez; Supabase las retira a principios de 2027 y habrá que migrar a las nuevas más adelante. La de servicio quedó marcada como secreta.
6. **Las fotos no se copiaron** (eran de prueba). Quedaron los dos buckets vacíos (`fotos` y `fotos-privadas`).
7. **Todas las sesiones caducaron** al cambiar de proyecto: hay que volver a entrar.

**Un descubrimiento importante.** La política de seguridad del navegador (CSP) tenía **escrita a mano** la dirección del proyecto viejo. Cambiar solo las claves habría roto el acceso desde el navegador y el tiempo real. Ahora la CSP sale de `NEXT_PUBLIC_SUPABASE_URL` (`next.config.ts`), con una prueba que impide que vuelva a quedar una dirección fija. Si algún día cambiamos de proyecto otra vez, basta cambiar la variable.

**El proyecto viejo** (`qrhkzlzblaknzsxqfney`) no recibe ninguna petición desde las 19:00 UTC. Se queda una o dos semanas como red de seguridad y luego se pausa; se borra solo cuando `compaz-prod` tenga copias de seguridad probadas.

### 3.3 Velocidad del panel

Se midió en producción en vez de suponer. Las consultas a la base ya costaban poco (15 a 50 ms); el tiempo se iba en otras tres causas:

1. El proxy consultaba a Supabase Auth por la red en **cada** petición, desde una función de borde.
2. La página esperaba todas sus consultas antes de enviar nada.
3. Next **precargaba cada enlace visible** ejecutando la pantalla entera (decenas de peticiones `_rsc=` por visita), lo que gastaba créditos de Netlify y competía con lo que hacía la persona.

Arreglos (PR 17 y 18): menú y encabezado al instante con un esqueleto mientras llegan los datos (`app/panel/loading.tsx` y `ContenidoPanel` dentro de `Suspense`), enlaces del panel con `prefetch={false}`, proxy que solo renueva la sesión (la página y cada ruta de `/api/admin` siguen verificando al usuario), y Personas ordena, filtra, busca y pagina en el navegador con la lista ya cargada.

Resultado: **250 a 450 ms** por pantalla casi siempre, con picos ocasionales de 600 a 860 ms por arranque en frío de la función. El objetivo que fijamos es contenido completo en menos de 500 ms en el 75 % de los casos. Hay un botón **Más, Estado, Velocidad** (solo administrador) que mide la latencia entre el servidor y la base.

### 3.4 Otros cambios

1. Líneas de servicio futuras (voluntariado, cuidado de mascotas, dona horas) como "Próximamente", sin nada activo.
2. **Emojis solo en Telegram y en las estrellas de calificación.** Web, portal, panel y correos sin emojis. La landing no se tocó.
3. **Versión del sistema:** vive en `lib/version.ts`, se ve en el panel y se anota en `docs/versiones.md`. Una prueba falla si no coinciden con `package.json`.

---

## 4. Estado de producción hoy

| Qué | Valor |
|---|---|
| Sitio | `micompaz.com` (proyecto de Netlify `compaz-beta`) |
| Versión | 1.1.3-beta.1 |
| Base de datos | `compaz-prod`, referencia `jizckcfuemgfbmopbhbh`, Virginia, plan gratuito |
| Base vieja | `ARCHIVO-NO-USAR-saopaulo-viejo`, referencia `qrhkzlzblaknzsxqfney`, sin uso |
| Netlify | plan Personal, 9 USD al mes, créditos limitados; **cada despliegue a producción cuesta unos 15 créditos** |
| Funciones de Netlify | región Virginia (bloqueada en este plan) |

Variables del CMC y captación en Netlify hoy: existen `CMC_LECTURA_TOKEN` (solo Production), `POSTULACIONES_DESTINO` y `CAPTACION_DESDE`. **No existen** `CMC_ESCRITURA_TOKEN` ni `CMC_COMPITAS_MODO`.

---

## 5. Cómo se integró tu CMC

### 5.1 Lo tuyo, tal como lo dejaste

1. **Lectura de postulaciones** (`GET /api/cmc/postulaciones`, `lib/cmc.ts`): entrega las postulaciones desde Supabase con el mismo formato que la API de Airtable, solo lectura, autenticada con `Authorization: Bearer CMC_LECTURA_TOKEN`. Interruptor `CMC_FUENTE` en tu Apps Script (`airtable` por defecto o `supabase`). Parche en `docs/cmc/fuente-supabase.gs`.
2. **Compitas habilitadas** (`POST /api/cmc/compitas`, `lib/cmc-compitas.ts`): tu hoja publica cada hora las compitas con "Etapa de selección" igual a Habilitado; la web las incorpora por su ID `COM-NNNN`, nunca activa ni verifica por su cuenta y solo restringe (si el CMC retira el permiso, la compita sale de la oferta). Autenticada con `Authorization: Bearer CMC_ESCRITURA_TOKEN`. Archivo nuevo `docs/cmc/publicar-compitas.gs`. Tabla `cmc_sincronizaciones` y columnas `cmc_*` en `compitas`. Todas las reglas (cuarentena de `COM-` repetido, freno de desactivación masiva, bienvenida única, fotos rechazadas) están en `docs/cmc/compitas-desde-cmc.md`.

### 5.2 Lo que hicimos para que funcione con el panel nuevo (un solo sistema)

Tu rama `feat/cmc-compitas` estaba pensada para el dashboard viejo, que ya no existe. Se unió y se adaptó así:

1. **La ficha del compita** (Personas) muestra el bloque **"Selección (CMC)"**: el ID `COM-`, si el CMC lo permite, su estado operativo, el último cambio recibido y los pasos que le faltan para recibir solicitudes (permiso del CMC, Telegram, foto, descripción, servicios, horarios, verificación del equipo). Reemplaza a tu componente viejo `EstadoCmcCompita`. La lógica está en `lib/cmc-estado.ts`.
2. **Si el CMC no permite a una compita**, el panel esconde los botones Verificar y Activar, y **el servidor también lo rechaza con 409** (tus guardas de `lib/compitas.ts` siguen mandando). Quitar la verificación o desactivar siempre se puede.
3. **La alta manual y la invitación por enlace** no crean un perfil si ya existe uno del CMC con el mismo correo (409 con mensaje claro).
4. **Más, Postulaciones y origen (CMC):** lista las postulaciones, de qué campaña o página llegaron (UTM) y si calificaron, y muestra lo que no llegó a Airtable para resolverlo (vincular, registrar directo en el CMC o marcar como no procedente). Incluye el aviso que escribiste para el modo `solo_supabase`.
5. **Vigilancia:** tu foto horaria (`cmc-compitas`, 60 minutos) quedó dentro de los procesos que vigila el sistema; si deja de llegar, avisa por Telegram.
6. **Pruebas:** tus 41 pruebas de `tests/20-cmc-compitas.test.ts` y las de lectura (`tests/19-cmc-supabase.test.ts`) siguen pasando junto a las nuevas del panel (`tests/86-cmc-en-el-panel.test.ts`).

### 5.3 Lo que puedes necesitar ajustar tú

1. Confirmar que tus Apps Script usan la URL de producción `https://micompaz.com/api/cmc/...` (no el proyecto de Supabase) y que los tokens están en las propiedades.
2. Pasar a `CMC_FUENTE=supabase` y a modo `aplicar` cuando estés listo, con tus simulaciones primero.
3. Si tu hoja o tus scripts guardaban algo del proyecto viejo, actualizarlo (sección 2, punto A).
4. Si quieres que el panel muestre algo más del CMC (columnas, filtros, insignias en la lista), dilo: la base está en `lib/cmc-estado.ts` y `components/panel/EstadoCmc.tsx`.

---

## 6. Cómo trabajamos de ahora en adelante

1. **Ramas desde `origin/main`**, no desde `main` local (puede estar desactualizada). Un cambio, una rama, un pull request.
2. **Nada va a producción sin pasar por pull request.** La comprobación que cuenta es **`verificar`** (tipos, pruebas y build). Los trabajos `airtable` y `e2e` del flujo `captacion` **fallan hoy por la cuota agotada de Airtable**, no por el código; se ignoran hasta que quitemos Airtable y ese flujo.
3. **Cada despliegue cuesta unos 15 créditos de Netlify** y los créditos están justos. Junta cambios en vez de desplegar uno por uno.
4. **Nadie hace push a `main` ni cambia variables de Netlify o de Supabase sin avisar.** Cambiar una variable de Netlify exige un redespliegue.
5. **Las migraciones solo agregan** tablas o columnas, nunca cambian ni borran lo existente (para poder volver al código anterior). Se prueban primero en la base de pruebas.
6. **Nunca se pegan claves, contraseñas ni tokens en el chat, en el repositorio ni en documentos.** Los secretos van en archivos ignorados por git o directamente en Netlify.
7. **No se escribe la dirección de Supabase en el código.** Sale de las variables de entorno.
8. **Antes de cerrar un cambio:** `npx tsc --noEmit`, `node tests/run.mjs` y `npm run build`. Se sube la versión en `lib/version.ts` y `package.json` y se anota en `docs/versiones.md` (mayor para un lanzamiento, menor para una función nueva, parche para un arreglo).
9. **Reglas del producto** (están en `CLAUDE.md`): colores solo desde `lib/design.ts`, toda consulta a la base en `lib/` y no en rutas ni componentes, respuestas de API con los ayudantes de `lib/api.ts`, toda ruta nueva de `/api/admin` pide permiso con `requierePermiso` y se registra en `tests/37-permisos.test.ts`, todo botón lleva su ⓘ, el estado de cada pantalla vive en la dirección, cada componente funciona en 375 px y en 1024 px, nunca se usan guiones como viñetas en correos, Telegram ni pantallas, y los emojis solo existen en Telegram y en las estrellas de calificación.
10. **Contactos:** cliente y compita nunca ven el contacto del otro.
11. **Panel:** páginas con datos usan un esqueleto (`Suspense`), los enlaces del panel van con `prefetch={false}`, y lo que dependa de la base no debe pedirse antes de devolver el marco.

---

## 7. Si algo falla: vuelta atrás

1. En Netlify, Environment variables, devolver `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` a los valores del proyecto viejo (están en su panel de Supabase, API Keys, legacy).
2. Redesplegar sin caché desde Deploys.
3. El proyecto viejo conserva los datos tal como estaban al migrar (hacia las 18:30 UTC del 12 de noviembre), así que lo creado después en `compaz-prod` no estaría allí.

Para volver solo el código, en Netlify se puede publicar un despliegue anterior.

---

## 8. Pendientes y decisiones abiertas

1. **Pasar `compaz-prod` a Pro** antes de abrir al público (copias de seguridad y fin de la pausa por inactividad), y probar una restauración. Es requisito de `CLAUDE.md`.
2. **Cortar Airtable** (sección 2, punto C) y después limpiar el código, los procesos, las variables y el flujo del CI.
3. **Dónde se desarrolla** (sección 2, punto B) y pausar el proyecto viejo.
4. **Probar de punta a punta** lo que no se pudo desde fuera: entrada con enlace por correo, un aviso de Telegram y una llamada.
5. **Antes de lanzar:** Stripe (quitar `PAGO_SIMULADO` y aplicar el checklist de seguridad), claves de Turnstile, texto legal revisado y política de privacidad.
6. **Migrar a las claves nuevas de Supabase** (`sb_publishable` y `sb_secret`) antes de que se retiren las legacy a principios de 2027.
7. **Netlify:** decidir si se sube a Pro (20 USD al mes, 3 veces más créditos y región configurable). No es urgente; hoy la región coincide.
8. **Mejoras ya acordadas y no hechas:** paginación de Seguimiento, demo para inversionistas, y reducir consultas en fila en Personas, Pagos y Estado si hace falta más velocidad.

---

## 9. Mapa de documentos

| Documento | Para qué |
|---|---|
| `docs/migracion-supabase-virginia.md` | La migración: qué se copió, configuración de acceso, cambio de producción y vuelta atrás |
| `docs/entorno-de-pruebas-y-respaldos.md` | Cómo montar una base de pruebas y los respaldos |
| `docs/cmc/fuente-supabase.md` | Lectura de postulaciones desde Supabase (tu parte) |
| `docs/cmc/compitas-desde-cmc.md` | Publicación de compitas habilitadas (tu parte) |
| `docs/handoff-panel-nuevo.md` | Cómo está construido el panel nuevo |
| `docs/versiones.md` | Historial de versiones |
| `CLAUDE.md` | Reglas de desarrollo del proyecto |
| `docs/auditoria-2026-11-11.md` y `docs/revision-2026-11-12.md` | Auditorías de seguridad y su estado |

Si algo de este documento no coincide con lo que ves, avísame: está escrito con lo verificado el 12 de noviembre de 2026 y puede quedar viejo.
