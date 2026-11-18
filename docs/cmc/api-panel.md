# CMC en el panel: lectura real (fase 2A) y acciones (fase 2B, diseño)

Estado: **2A preparada, sin instalar.** El código del panel está listo y probado con datos sintéticos. Para ver datos reales hace falta instalar la API en Apps Script y poner dos variables en Netlify. Las dos cosas requieren autorización de Luis (ver «Cambios en producción»).

## 1. Qué resuelve

La pestaña «Operación real» del CMC (`/panel?sec=confianza`) mostraba solo las Compitas habilitadas desde Supabase. Con la fase 2A muestra toda la selección tal como está en el CMC original (Google Sheets + Apps Script): etapas, ficha, preentrevista, entrevistas, verificaciones, onboarding, disponibilidad, alertas, historial, requisitos de habilitación y próxima acción. Es solo lectura. La V2 sigue siendo el único lugar donde se decide.

## 2. Arquitectura (opción elegida)

```
Navegador (admin) ──> /panel (servidor Next, Netlify)
                         │  requireAuth + actor.rol === 'admin'
                         │  lib/confianza/lectura-real.ts
                         │  lib/cmc-api.ts  (POST firmado HMAC-SHA256, caché 60 s lista / 30 s ficha)
                         ▼
              Apps Script del CMC · ApiPanelWeb.gs (doPost, implementación NUEVA)
                         │  reutiliza v2_obtenerFichaRaw_ / v2_obtenerTabRaw_ (lectores de la V2, sin escrituras)
                         ▼
              Hoja del CMC (03, 08, 09, 10, 11, 12, 13B, 16, 17)
```

Alternativas descartadas:

| Opción | Por qué no |
|---|---|
| A. Copiar el CMC a tablas de Supabase con una sincronización | Duplica datos personales en una segunda base y crea una segunda verdad que se desfasa. Exige migraciones y una sincronización masiva (no autorizadas). |
| B. Leer la hoja con la API de Sheets y una cuenta de servicio | Habría que compartir la hoja entera con una cuenta nueva (todos los teléfonos y correos), y reescribir en TypeScript la lógica de elegibilidad que ya calcula el CMC. Esto daría dos versiones de las reglas. |
| **C. API de lectura dentro del mismo Apps Script (elegida)** | Una sola verdad. Reutiliza los lectores y las reglas reales de la V2 (no la lógica de la demo). Los contactos se recortan antes de salir de Google. No hay migración. El mismo canal sirve para la fase 2B. |

## 3. Contrato

Petición (cuerpo `text/plain` con JSON, ≤ 4000 caracteres):

```json
{ "v": 1, "op": "ping|lista|ficha", "id": "COM-xxxx o vacío", "ts": 1763400000, "nonce": "uuid", "firma": "hex" }
```

- `firma = HMAC-SHA256(CMC_API_TOKEN, "v.op.id.ts.nonce")`.
- Ventana de tiempo de ±300 s.
- El nonce es de un solo uso (CacheService, 10 min).
- Tope de 120 peticiones por minuto.

Respuesta: `{ ok: true, v, op, generado, ms, datos }`. Si algo falla, la respuesta es `{ ok: false, error: "<código>" }`. Los códigos posibles son `inactiva`, `sin_configurar`, `peticion_invalida`, `fuera_de_tiempo`, `firma_invalida`, `repetida`, `limite`, `id_invalido`, `no_existe`, `operacion_no_permitida` y `error_interno`. Nunca se devuelve un detalle interno.

Minimización: se borran en cualquier nivel las claves que coinciden con `teléfono|whats|email|correo|cédula|documento|dirección|enlace|link|url|ip|t|e|wa`. Esto pasa en Apps Script y otra vez en la web, que es la segunda barrera. Las dos expresiones deben ser idénticas, y la prueba 120 lo comprueba.

## 4. De dónde sale cada dato

| Dato en el panel | Fuente en el CMC | Lector |
|---|---|---|
| Lista: código, nombre, zona, fecha de registro | Hoja 03 · Compitas (ID Compita, Nombre, Ubicación declarada, Fecha registro) | `cmcApi_lista_` |
| Etapa | 03 · Etapa de selección (vacía → «Sin etapa», nunca se inventa) | `cmcApi_lista_` + `normalizarEtapa` |
| Estado operativo, acepta servicios | 03 · Estado operativo, Acepta nuevos servicios | `cmcApi_lista_` |
| Preentrevista (estado) | 03 · Estado preentrevista | `cmcApi_lista_` |
| Duplicados | 03 · Duplicado de (ID), Clasificación duplicado («Duplicado confirmado» no cuenta) | `cmcApi_lista_` + `esDuplicadoConfirmado` |
| Perfiles de prueba | Códigos y nombres de prueba (`esPerfilDePrueba`, misma regla que la vista anterior) | `construirFilas` |
| Alertas abiertas / que bloquean | 11 · Alertas Compitas (Estado ≠ cerrada/resuelta/anulada; Bloquea matching = Sí) | `cmcApi_alertasAbiertas_` |
| En catálogo de la web | Supabase `compitas` (vista anterior, ya en producción) | `cargarResumenOperativo` |
| Requisitos de habilitación | Lo que calcula el CMC (`panel_obtenerPanelElegibilidad`) | `v2_obtenerFichaRaw_` |
| Ficha, estado operativo, atributos, onboarding, disponibilidad, cobertura, alertas | `panel_fichaCompleta_` (hojas 03, 10, 10B, 11, 12, 13B, 16) | `v2_obtenerFichaRaw_` |
| Preentrevista (respuestas) | 09 · Preentrevistas Compitas | `v2_obtenerTabRaw_(id,'preentrevista')` |
| Entrevistas | 08 · Entrevistas Compitas | `v2_obtenerTabRaw_(id,'entrevista')` |
| Verificaciones | 12 · Verificaciones Compitas | `v2_obtenerTabRaw_(id,'verificaciones')` |
| Historial | 17 · Eventos Compitas | `v2_obtenerTabRaw_(id,'historial')` |
| Próxima acción | Orientativa, derivada de la etapa y las alertas (`lib/confianza/real.ts`). Se rotula «orientativa». | web |

## 5. Permisos y privacidad

- Solo un **administrador** ve los datos reales. Se decide en el servidor (`app/panel/page.tsx`: `actor.rol === 'admin'`), y «Ver como colaborador» también los esconde. Un colaborador con «monitorear» sigue viendo la vista anterior.
- Ninguna ruta `/api` ni pública lee el CMC (prueba 120). El token vive solo en el servidor; nunca en una variable `NEXT_PUBLIC_`.
- Los errores se registran como códigos (`[cmc/lectura] lista: firma_invalida`), nunca con contenido.
- **Clarity:** el panel (`/panel`) ya está fuera de Clarity, GA y Meta Pixel (`app/layout.tsx`, rutas con token y panel). Hay que comprobarlo de nuevo antes de instalar: si Clarity grabara `/panel`, los nombres de aspirantes quedarían en grabaciones de terceros.
- Lo que sí sale del CMC: nombre, zona declarada, etapas, estados y textos de notas (observaciones, motivos y respuestas de la preentrevista). Las notas son texto libre y pueden contener datos que alguien escribió a mano. Es aceptable porque solo lo ve un administrador, pero conviene saberlo.
- En el repositorio solo hay datos ficticios (`COM-9xxx`). La fuente sintética solo se activa en un deploy preview sin la API configurada.

## 6. Cambios en producción (requieren autorización; ninguno está hecho)

1. **Apps Script del CMC**:
   - agregar el archivo `ApiPanelWeb.gs` con el contenido exacto de `docs/cmc/api-panel.gs`. No se modifica ningún archivo existente.
   - Propiedades del script: `CMC_API_TOKEN` (64 caracteres aleatorios, nuevo y distinto de cualquier otro) y `CMC_API_ACTIVA = si`.
   - Implementar → **Nueva implementación** → Aplicación web, ejecutar como el propietario, acceso «Cualquier usuario». La implementación de la V2 sigue fijada en su versión.
   - Disparadores: ninguno.
2. **Netlify (producción)**: `CMC_API_URL` (la URL `/exec` de la nueva implementación) y `CMC_API_TOKEN` (el mismo token). Después hay que volver a desplegar.
3. **Supabase**: nada. No hay migración en 2A.

Riesgos:

| Riesgo | Mitigación |
|---|---|
| Alguien llama a la URL `/exec` | Sin firma válida no lee nada. La URL no se publica. |
| Fuga del token | Se rota cambiando la propiedad. El token solo da lectura y no permite escribir. |
| Cuota de Apps Script o lentitud | Caché de 60 s para la lista y 30 s para la ficha, tope de 120 por minuto y límite de espera de 25 s. Si falla, el panel muestra la vista anterior. |
| Cambio de columnas en la hoja 03 | La API falla con `error_interno` (columna obligatoria ausente) y el panel muestra la vista anterior. |

Reversión (cualquiera de estas vale, de la más rápida a la más completa):

1. `CMC_API_ACTIVA = no` en Apps Script. Efecto inmediato y sin desplegar: el panel muestra «No se pudo leer el CMC (inactiva)» y la vista anterior.
2. Quitar `CMC_API_URL` y `CMC_API_TOKEN` de Netlify y volver a desplegar. El panel vuelve exactamente a la vista anterior.
3. Archivar la implementación nueva y borrar `ApiPanelWeb.gs`.

## 7. Fase 2B (acciones), diseño sin activar

Objetivo: operar desde el panel (cambiar etapa, registrar entrevista, verificación u onboarding, cerrar alerta, habilitar) usando las mismas funciones del CMC que la V2.

1. **Mismo canal, operaciones de escritura separadas** en `ApiPanelWeb.gs` (`etapa`, `entrevista`, `verificacion`, `onboarding`, `alerta_cerrar`, `habilitar`). Cada una llama a la función núcleo que ya usa la V2 (`*_raw_` / `panel_*`), nunca a una copia.
2. **Token distinto** (`CMC_API_TOKEN_ESCRITURA`) y su propio interruptor (`CMC_API_ESCRITURA_ACTIVA`), para poder apagar las escrituras sin apagar la lectura.
3. **Operador explícito y verificado.** La V2 identifica al operador con `Session.getActiveUser()`, que en una implementación «ejecutar como propietario» devolvería siempre al propietario. Por eso el panel envía el correo del operador autenticado dentro del mensaje firmado, y Apps Script lo comprueba contra la hoja 18 · Operadores Compaz (activo y con el permiso de esa acción). Si no está, rechaza.
4. **Idempotencia**: cada acción lleva una `clave` única (uuid). Apps Script la guarda en CacheService y en el evento, y una clave repetida devuelve el resultado anterior sin volver a escribir.
5. **Rastro**: cada acción escribe su evento en la hoja 17, con el operador, el origen «panel», la clave y el antes y el después. En la web queda además el registro en `acciones_equipo`.
6. **Web**:
   - un permiso nuevo `cmc_acciones` en el catálogo de permisos y en el manual;
   - rutas `POST /api/admin/cmc/<accion>` con `requierePermiso('cmc_acciones')`, registradas en `tests/37-permisos.test.ts`;
   - validación de la entrada en el servidor, y un límite con `explicarEspera`;
   - la pantalla pide confirmación con el resumen del cambio.
7. **Reglas reales**: el permiso de habilitar lo decide la elegibilidad del CMC (`puedeHabilitar`), nunca `lib/confianza/reglas.ts` (que es el espejo de la demo).
8. **Pruebas**:
   - primero, una copia de la hoja y una implementación de pruebas, con aspirantes sintéticos;
   - nunca con aspirantes reales sin autorización;
   - las pruebas automáticas ejecutan `ApiPanelWeb.gs` en la caja de arena, como hace la prueba 120.
9. **Activación por pasos**: la lectura ya instalada → las escrituras en la copia → una acción (cerrar alerta) en producción con un solo operador → el resto.
