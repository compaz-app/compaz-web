# Compitas habilitadas en el CMC → dashboard → solicitudes

Integración unidireccional: el CMC (hoja `03 · Compitas`) publica cada hora las Compitas con «Etapa de selección» = **Habilitado**; la web las incorpora a `compitas` por su **ID Compita** (`COM-NNNN`), las muestra en el dashboard de Juan y, una vez activadas, reciben solicitudes.

Aprobado por Luis el 10-nov-2026.

**Estado (11-nov-2026, 03:49 UTC): etapa 1 aplicada.**
- La migración `20261111_cmc_compitas` está en Supabase (versión 20261111034855).
- Etapas 2 a 5 pendientes. El código sigue sin fusionar ni desplegar.

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

**Etapa 4 — Activación** (1 despliegue).
- `CMC_COMPITAS_MODO=aplicar` en Netlify y redesplegar.
- Poner `CMC_PUBLICAR_COMPITAS=si` y ejecutar `publicarCompitasWeb()` una vez a mano.
- Verificar: 2 Compitas inactivas en el dashboard con «CMC permite»; 2 correos de bienvenida; mensaje al admin; una 2.ª ejecución da 0 cambios.
- Ejecutar `instalarDisparadorPublicarCompitas()`.
- Reversión inmediata: `CMC_PUBLICAR_COMPITAS=no` o quitar `CMC_ESCRITURA_TOKEN` en Netlify (503). Datos: `cmc_sincronizaciones.cambios` guarda el antes y el después de cada fila; las altas se dejan inactivas, nunca se borran.

**Etapa 5 — Activación operativa** (por Compita).
- La Compita vincula Telegram (nombre + código por correo) y completa `/perfil`.
- Juan pulsa Reactivar y Verificar en el dashboard.
- Vigilancia: si no llega ninguna foto en 3 h, `vigilarLatidos` avisa (`cron:cmc-compitas`).

## Pendientes fuera de esta integración

- **Lucho Prueba 2**: desactivación preparada en `docs/cmc/operaciones/desactivar-lucho-prueba-2.sql`, sin ejecutar.
- **COM-0274 y COM-0318**: ver la auditoría en `docs/cmc/operaciones/auditoria-ids-duplicados.md`. No se cambian los IDs. La publicación omite las filas «Duplicado confirmado» y la web pone en cuarentena cualquier COM- repetido.
- **COM-1062** (PRUEBA): solo en pruebas automatizadas y simuladas. No se habilita ni se modifica.
