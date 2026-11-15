# Compitas habilitadas en el CMC → dashboard → solicitudes

Integración unidireccional: el CMC (hoja `03 · Compitas`) publica cada hora las Compitas con «Etapa de selección» = **Habilitado**; la web las incorpora a `compitas` por su **ID Compita** (`COM-NNNN`), las muestra en el dashboard de Juan y, una vez activadas, reciben solicitudes.

Aprobado por Luis el 10-nov-2026.

**Estado (15-nov-2026, 18:28 UTC): etapas 1 a 4 hechas, salvo el disparador horario.**
- Etapa 1: migración `20261111_cmc_compitas` aplicada (11-nov).
- Etapa 2: web desplegada (PR #19, `main@53588c2`, 1.1.4-beta.1, 13-nov).
- Etapa 3: Apps Script con `PublicarCompitas.gs` y simulación correcta (15-nov).
- Etapa 4: `CMC_COMPITAS_MODO=aplicar` en Production y 2 publicaciones manuales (15-nov). **Falta** `instalarDisparadorPublicarCompitas()`: sin autorización todavía; hoy nada publica solo.
- Etapa 5 pendiente.

## Reparto de autoridad

| Concepto | Dueño | Dónde | Significado |
|---|---|---|---|
| Habilitado en selección | CMC | AG «Etapa de selección» = Habilitado | Pasó la selección (7 controles de `panel_evaluarHabilitacion_` o habilitación directa) |
| Permitida por el CMC | CMC → copia | `compitas.cmc_permite` = Habilitado ∧ «Estado operativo» = Activo ∧ «Acepta nuevos servicios» = Sí | Puede tomar clientes nuevos |
| Activa para recibir solicitudes | Web | `cmc_permite ≠ false` ∧ estado = activo ∧ verificado ∧ Telegram vinculado | Aparece en la oferta y recibe solicitudes |
| Bloqueada | Web | estado = bloqueado | Seguridad; el CMC nunca lo cambia |

`cmc_permite` NULL = Compita anterior al CMC (Lorna, Reyna) o demo: **todo sigue como hoy** para ellas.

## Piezas

| Pieza | Qué hace |
|---|---|
| `docs/cmc/publicar-compitas.gs` | Archivo NUEVO del Apps Script. Lee la 03 (sin escribir), arma la foto y la envía. No toca ninguna función existente. |
| `POST /api/cmc/compitas` | Recibe la foto. Bearer `CMC_ESCRITURA_TOKEN` (distinto del de lectura). Sin token: 503. Simula salvo `CMC_COMPITAS_MODO=aplicar` y sin `?dryRun=1`. |
| `lib/cmc-compitas.ts` | `planificar()` (función pura) y `aplicarFotoCmc()` / `simularFotoCmc()`. |
| `supabase/migrations/20261111_cmc_compitas.sql` | 4 columnas `cmc_*` en `compitas`, formato de `codigo` y tabla `cmc_sincronizaciones`. Solo aditiva. |
| Guardas | `verificarCompita`, `reactivarCompita`, `crearSolicitud`, `/api/solicitudes`, `asignarCompita`, `getCompitasActivas`, `getCompitaById` respetan `cmc_permite = false`. La invitación por enlace y el registro manual no duplican un perfil del CMC. |
| Dashboard | `components/admin/EstadoCmcCompita.tsx`: insignia «CMC permite / no permite» y pasos de activación. Verificar y Reactivar desaparecen si el CMC no permite. |
| Pruebas | `tests/20-cmc-compitas.test.ts` (41 pruebas, incluida la VM del Apps Script contra la ruta real). |

## Qué sale del CMC

Solo 7 campos por fila Habilitado: ID Compita, Nombre, Email, Ubicación declarada, Etapa de selección, Estado operativo, Acepta nuevos servicios. Se omiten las filas marcadas «Duplicado confirmado».

Se quedan en el CMC: WhatsApp, identidad, antecedentes, referencias, entrevista, observaciones, alertas, motivos, tarifa, profesión e historial.

En Supabase, nombre, email y zona (provisional) se escriben **solo al crear**. Después la foto solo cambia `cmc_*` y, si el CMC deja de permitir, saca a la Compita de la oferta. La Compita completa zona, servicios, foto, descripción y horarios con `/perfil` en Telegram.

## Reglas

1. **Solo restringe.** Nunca pone `estado = activo` ni `verificado = true`. Si el CMC deja de permitir: estado inactivo y verificado false (salvo bloqueadas). Si vuelve a permitir: sigue oculta hasta que Juan la reactiva y la verifica.
2. **Suspensión** (también pausa, baja, «Acepta = No», valores desconocidos o ausencia de la foto): fuera de la oferta y sin solicitudes ni asignaciones nuevas. Conserva clientes, visitas, solicitudes y Telegram. Se crea un aviso en *Atención* con el número de clientes, solicitudes abiertas y visitas activas, y un mensaje al admin.
3. **Altas**: inactivas y sin verificar. Antes de insertar se comprueba que no exista otra Compita (no demo) con el mismo email ni una anterior sin código con el mismo nombre. Si hay conflicto no se crea nada y se avisa una vez.
4. **COM- estable**: la búsqueda es por `codigo` (UNIQUE en la base). Cambios de nombre o email en el CMC no reescriben el perfil.
5. **Bienvenida**: una sola por Compita, cuando el CMC permite; reserva atómica en `cmc_bienvenida_enviada_en`, liberada si el correo falla.
6. **Fotos rechazadas enteras** (no se aplica nada, aviso como máximo cada 6 h):
   - no marcada como completa, o con más registros que filas leídas;
   - filas leídas >20 % por debajo de la última foto aplicada;
   - lista vacía habiendo Compitas habilitadas en la web;
   - más de max(2, 10 %) registros inválidos o con COM- repetido;
   - **freno**: más de max(1, 25 %) de las Compitas habilitadas perderían el permiso a la vez, o todas cuando son 2 o más. Con las 2 actuales: retirar 1 se aplica; retirar las 2 se rechaza. Solo pasa con `CMC_AUTORIZAR_DESACTIVACION_MASIVA=si` en el script, que se borra sola tras usarse.
7. **COM- repetido en la foto**: cuarentena. No se crea, no cambia y no cuenta como ausente.
8. **Simulación**: solo lecturas (ni escrituras, ni correos, ni avisos, ni registro, ni propiedades del script).

## Despliegue por etapas (cada una con autorización de Luis)

**Etapa 1 — Migración** (Supabase).
- Aplicar `20261111_cmc_compitas.sql`.
- Verificar: las 4 columnas existen y son NULL en las 23 filas; `codigo` sigue NULL en todas; `cmc_sincronizaciones` vacía; restricción `compitas_codigo_formato` creada.
- **Hecho el 11-nov.**
  - Huella de `compitas` sin las columnas `cmc_*`: e3da8e5b…, la misma antes y después.
  - Sin cambios en las huellas de usuarios, solicitudes, visitas y admin_flags.
  - La oferta pública sigue con las mismas 21 Compitas.
  - `service_role` tiene SELECT e INSERT en la tabla nueva; `anon` y `authenticated` no tienen ningún privilegio.
  - Las columnas `cmc_*` no se añaden a los permisos públicos por columna.
- Reversión: `alter table compitas drop column cmc_permite, drop column cmc_estado, drop column cmc_actualizado_en, drop column cmc_bienvenida_enviada_en, drop constraint compitas_codigo_formato; drop table cmc_sincronizaciones;` (solo mientras el código de la etapa 2 no esté publicado).
- **Debe ir antes de la etapa 2**: el código nuevo lee esas columnas.

**Etapa 2 — Web en modo simulación** (1 despliegue, unos 15 créditos).
- Antes: Luis crea `CMC_ESCRITURA_TOKEN` en Netlify (Production). **No** crear `CMC_COMPITAS_MODO`.
- Fusionar la rama y desplegar.
- Verificar: sin token → 401; la oferta pública muestra las mismas Compitas (3 reales + 18 demo); el dashboard carga; una solicitud a una Compita anterior funciona igual.
- Reversión: publicar el despliegue anterior (main@102cbd6).

**Etapa 3 — Apps Script y simulación.**
- Guardar versión del proyecto. Añadir el archivo `publicar-compitas.gs` tal cual.
- Propiedades: `CMC_COMPITAS_URL` = `https://micompaz.com/api/cmc/compitas`; `CMC_ESCRITURA_TOKEN` (lo introduce Luis). **No** crear `CMC_PUBLICAR_COMPITAS`.
- Ejecutar `simularPublicacionCompitas()`.
- Resultado esperado hoy: 2 altas (COM-0025, COM-0187), 0 actualizaciones, 0 conflictos (comprobado el 10-nov: ningún email, nombre ni código coincide), 2 bienvenidas previstas. Supabase sin cambios.
- Reversión: borrar el archivo y las propiedades.
- **Hecho el 14 y 15-nov.**
  - Respaldo del proyecto: versión 32 («Respaldo antes de publicar-compitas.gs (etapa 3, simulacion) 2026-11-14»).
  - `PublicarCompitas.gs` guardado tal cual: 7452 bytes, sha256 `6a2723891a8268cb3ab754ffb6e1e3b55a6ab06ba7042656eaf91b1bf87c95eb`. Los otros 6 archivos, sin cambios.
  - Propiedades: `CMC_COMPITAS_URL` (Claude) y `CMC_ESCRITURA_TOKEN` (la introdujo Luis; nadie más la ha visto).
  - `simularPublicacionCompitas()`, 15-nov 18:14 UTC: HTTP 200, `modo: simular`, 1007 filas leídas, 2 enviadas, altas COM-0025 y COM-0187, 0 actualizaciones, 0 conflictos, 0 en cuarentena, 0 errores. `compaz-prod` idéntica antes y después; 5 disparadores intactos.

**Etapa 4 — Activación** (1 despliegue).
- `CMC_COMPITAS_MODO=aplicar` en Netlify y redesplegar.
- Poner `CMC_PUBLICAR_COMPITAS=si` y ejecutar `publicarCompitasWeb()` una vez a mano.
- Verificar: 2 Compitas inactivas en el dashboard con «CMC permite»; 2 correos de bienvenida; mensaje al admin; una 2.ª ejecución da 0 cambios.
- Ejecutar `instalarDisparadorPublicarCompitas()`.
- Reversión inmediata: `CMC_PUBLICAR_COMPITAS=no` o quitar `CMC_ESCRITURA_TOKEN` en Netlify (503). Datos: `cmc_sincronizaciones.cambios` guarda el antes y el después de cada fila; las altas se dejan inactivas, nunca se borran.
- **Hecho el 15-nov, salvo el disparador** (autorización de Luis).
  - Antes: 2 habilitadas en la 03 (simulación de control: COM-0025 y COM-0187); versión 32 presente; ningún disparador ni ejecución previa de `publicarCompitasWeb`; ningún otro llamador de `/api/cmc/compitas` en el código.
  - Netlify: `CMC_COMPITAS_MODO=aplicar` solo en el contexto Production. Un único despliegue de `main@53588c2` (sin código nuevo). Después: POST sin token → 401; portada → 200.
  - Apps Script: `CMC_PUBLICAR_COMPITAS=si`.
  - 1.ª `publicarCompitasWeb()` (18:27 UTC): registro `aplicada`; altas COM-0025 (Mauricio Acacio) y COM-0187 (María Alejandra Navarro), las dos `inactivo`, `verificado=false`, `cmc_permite=true`, `cmc_estado` «Habilitado · Activo · Acepta: Sí»; 2 bienvenidas enviadas sin errores (`cmc_bienvenida_enviada_en` 18:27:06); 0 conflictos, 0 cuarentena, 0 errores; ningún aviso en Atención (no hay restricciones); la web envía al admin un aviso por Telegram con las altas (pendiente de que Luis confirme que lo recibió).
  - 2.ª `publicarCompitasWeb()` (18:28 UTC): `aplicada`, 0 altas, 0 bienvenidas, 0 cambios, 2 gestionadas con permiso. Idempotente.
  - Sin cambios en el resto: las 25 Compitas anteriores (Lorna, Reyna, demos, bloqueadas) con la misma huella fila a fila; postulaciones, avisos, eventos y solicitudes iguales; 0 COM- repetidos y 0 emails duplicados; 5 disparadores originales.
  - Pendiente: `instalarDisparadorPublicarCompitas()`, con autorización aparte. Mientras no exista, el CMC no publica solo.

**Etapa 5 — Activación operativa** (por Compita).
- La Compita vincula Telegram (nombre + código por correo) y completa `/perfil`.
- Juan pulsa Reactivar y Verificar en el dashboard.
- Vigilancia: si no llega ninguna foto en 3 h, `vigilarLatidos` avisa (`cron:cmc-compitas`).

## Pendientes fuera de esta integración

- **Lucho Prueba 2**: desactivación preparada en `docs/cmc/operaciones/desactivar-lucho-prueba-2.sql`, sin ejecutar.
- **COM-0274 y COM-0318**: ver la auditoría en `docs/cmc/operaciones/auditoria-ids-duplicados.md`. No se cambian los IDs. La publicación omite las filas «Duplicado confirmado» y la web pone en cuarentena cualquier COM- repetido.
- **COM-1062** (PRUEBA): solo en pruebas automatizadas y simuladas. No se habilita ni se modifica.

## Permisos de `cmc_sincronizaciones` (13-nov-2026)

Al trasladar la base a `compaz-prod` (12-nov), `service_role` quedó con todos los privilegios sobre `cmc_sincronizaciones`. La migración `20261113b_cmc_sincronizaciones_permisos` devuelve lo aprobado: solo SELECT e INSERT (registro de solo anexado). Para comprobarlo: `psql "$DB_URL" -v ON_ERROR_STOP=1 -f tests/sql/cmc_sincronizaciones_permisos.sql`, que debe terminar en `OK`. Aplicada en `compaz-prod` el 13-nov (19:27 UTC). Hasta esa fecha `compaz-prod` no tenía filas en el historial de migraciones (el traslado copió solo el esquema `public`); `supabase_migrations.schema_migrations` tiene ahora una sola fila, esta. Las migraciones anteriores (incluida `20261111_cmc_compitas`) están aplicadas pero no registradas. Hay que acordar una convención (registrarlas todas o aplicarlas siempre a mano) y, mientras tanto, escribir las migraciones de forma idempotente.

