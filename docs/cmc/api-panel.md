# CMC en el panel: lectura real (fase 2A) y acciones (fase 2B, diseño)

Estado (2026-11-19): API de lectura instalada en un **proyecto de Apps Script independiente**, publicada y **apagada** (`CMC_API_ACTIVA = no`). Conexión configurada solo en los **Deploy Previews** de Netlify. Producción no tiene la conexión. El proyecto original del CMC no se tocó (archivos, implementaciones, disparadores y propiedades intactos).

## 1. Qué resuelve

La pestaña «Operación real» del CMC (`/panel?sec=confianza`) muestra la selección tal como está en el CMC original (Google Sheets + Apps Script): etapas, ficha, requisitos de habilitación, preentrevista, entrevista, verificaciones, onboarding, alertas, historial y próxima acción. Es solo lectura y solo para administradores. La V2 sigue siendo el único lugar donde se decide.

## 2. Por qué un proyecto aparte (decisión 2026-11-18)

El proyecto del CMC tiene un `doGet` que sirve la V2 con `HtmlService` sin revisar quién la abre, y 108 funciones públicas (varias de escritura: `v2_descartar`, `v2_habilitarCompita`, `registrarMovimiento`…). La V2 está a salvo porque su implementación se ejecuta «como el usuario que accede» y exige cuenta de Google. Una implementación anónima que se ejecuta como el propietario (lo que necesita esta API) habría incluido ese `doGet`. Por eso la API vive en otro proyecto que **solo contiene el código de la API**.

## 3. Arquitectura y permisos efectivos

```
Navegador (admin) ──> /panel (servidor Next, Netlify Deploy Preview)
                         │  requireAuth + actor.rol === 'admin'
                         │  lib/cmc-api.ts  (POST firmado HMAC-SHA256; caché 60 s lista / 30 s ficha / 10 min versión)
                         ▼
   Proyecto «CMC · API de lectura del panel (solo lectura)»  — propietario soycompaz
     ApiPanel.gs        doPost (sin doGet), firma, hora, nonce, tope, interruptor, minimización
     HojaSoloLectura.gs la hoja vista con la API de Sheets; objeto con forma de SpreadsheetApp SIN métodos de escritura
     ReglasCMC.gs       copia literal de 30 funciones de lectura del CMC (no está en el repo: es código interno)
     appsscript.json    oauthScopes = [spreadsheets.readonly]; servicio avanzado Sheets v4
                         ▼  (solo lectura)
   Hoja del CMC (03, 08, 09, 11, 12, 16, 17, 18)
```

| Capa | Qué puede | Qué no puede |
|---|---|---|
| Permiso OAuth del proyecto | Ver hojas de cálculo del propietario (`spreadsheets.readonly`). Verificado en la pantalla de consentimiento. | Escribir en cualquier hoja (Google lo rechaza). Gmail, Drive, llamadas externas, disparadores: sin permiso. |
| Código | Abrir **solo** la hoja del CMC (`openById` con otro ID falla: `solo_hoja_cmc`). | No existe ningún método de escritura en el objeto hoja. No hay `doGet`, `HtmlService`, `UrlFetchApp`, `MailApp` ni `ScriptApp`. |
| Implementación web | «Ejecutar como: yo», acceso «Cualquier usuario» (para que Netlify llame sin cuenta de Google). | Sin firma válida no lee nada. Con `CMC_API_ACTIVA ≠ si` responde «inactiva» sin leer. |
| Web | Solo administradores (servidor). Ninguna ruta `/api` ni pública usa la API. | Colaboradores y «ver como colaborador» ven la vista anterior. |

`SpreadsheetApp.openById` exige el permiso completo de hojas (lectura **y** escritura). Por eso la lectura se hace con la API de Sheets (`Sheets.Spreadsheets.Values.get`), que acepta el permiso de solo lectura. `HojaSoloLectura.gs` reproduce `getValues()`: celdas vacías como `''`, fechas como `Date` en la zona horaria de la hoja, números y texto tal cual.

## 4. Contrato

Petición (texto JSON, ≤ 4000 caracteres):
```json
{ "v": 1, "op": "ping|lista|ficha|version", "id": "COM-xxxx o vacío", "ts": 1763400000, "nonce": "uuid", "firma": "hex" }
```
`firma = HMAC-SHA256(CMC_API_TOKEN, "v.op.id.ts.nonce")`. La hora vale ±300 s y el nonce es de un solo uso (10 min). El tope es de 120 peticiones por minuto.

Respuesta: `{ ok, v, op, generado, ms, datos }`. Los errores salen como `{ ok: false, error: "<código>" }`, con uno de estos códigos: `inactiva`, `sin_configurar`, `peticion_invalida`, `fuera_de_tiempo`, `firma_invalida`, `repetida`, `limite`, `id_invalido`, `no_existe`, `operacion_no_permitida`, `error_interno`.

Minimización antes de responder (en Apps Script y otra vez en la web):
- La hoja 03 sale con una **lista blanca** de columnas: nunca WhatsApp, Email, enlaces, ID de Airtable, errores ni observaciones.
- Se borran las claves de contacto (`teléfono|whats|email|correo|cédula|documento|dirección|enlace|link|url…`).
- Se omiten las preguntas o campos de referencias, de «dónde vives / zona específica», de evidencias y de contacto.
- Dentro de cualquier texto se tachan correos, teléfonos venezolanos o internacionales, cédulas y enlaces.
- El registro privado del proyecto guarda solo la operación y el código, o un error tachado de 120 caracteres.

Prueba en el proyecto real, con 15 fichas: antes de limpiar había correos en 7; después, 0. Teléfonos, enlaces y cédulas: 0.

## 5. De dónde sale cada dato

| Dato | Fuente | Función |
|---|---|---|
| Lista: código, nombre, zona, registro, etapa, estado operativo, preentrevista, duplicados | Hoja 03 (lista blanca) | `cmcApi_lista_` |
| Alertas abiertas / que bloquean | Hoja 11 | `cmcApi_alertasAbiertas_` |
| Requisitos de habilitación, «puede recibir servicios», razones | Hojas 03, 08, 11, 12, 16, 18 | `panel_obtenerPanelElegibilidad_core_` (copia literal) |
| Alertas, verificaciones, onboarding | Hojas 11, 12, 16 | `panel_obtenerAlertas`, `panel_obtenerVerificaciones`, `panel_obtenerOnboarding` (copias) |
| Preentrevista, entrevista, historial | Hojas 09, 08, 17 | `v2_obtenerTabRaw_` (copia) |
| En catálogo de la web | Supabase `compitas` | `cargarResumenOperativo` |
| Próxima acción | Orientativa, derivada en la web (`lib/confianza/real.ts`) | — |

El requisito «operador» (solo Luis o Juan pueden habilitar) depende de quién mira. En la vista de lectura no aplica y no se muestra.

## 6. Paridad con la V2 (reglas copiadas, no reescritas)

`ReglasCMC.gs` es la **copia literal** de 30 funciones del proyecto del CMC. Se extrajeron automáticamente siguiendo el grafo de llamadas desde `panel_obtenerPanelElegibilidad_core_` y `v2_obtenerTabRaw_`. Tiene una sola sustitución: `operadores_configurarHoja`. La original crea o completa la hoja 18 (escritura); la copia solo comprueba que la hoja exista.

Controles:
1. **Huella por función.** La operación `version` de la API devuelve el SHA-256 de cada función copiada. `lib/cmc-api.ts` (`HUELLAS_REGLAS_CMC`) guarda las huellas comprobadas el 2026-11-19 contra el proyecto original: **15 de 15 iguales**. Si la API devuelve otra huella, la ficha avisa «confirma estos requisitos en la V2». La prueba 120 vigila este control.
2. **Resultados comparados con la V2 en producción** (2026-11-19, en solo lectura; los códigos de la muestra están en el informe privado, no en este repositorio público):
   - Conteos de la lista, iguales a los de la V2: Registrado 547, Preseleccionado 291, sin etapa 23, En verificación 4, Habilitado 3 y Descartado 1. Son 869 sin duplicados; los 139 duplicados confirmados van aparte.
   - Una habilitada: puede recibir servicios, Sí. La V2 dice «Elegible: Sí».
   - Una habilitada por excepción: No, con identidad, referencia y onboarding pendientes. La V2 dice «Elegible: No» y «Etapas omitidas: identidad, referencia, onboarding».
   - Una en verificación: 3 pendientes, con los mismos textos que la V2 (identidad, referencia y onboarding). La V2 dice «Pendientes: 3».
   - El perfil de prueba: Sí, igual que en la V2.
   - Una sin etapa: No. La primera razón coincide con la V2: «Etapa de selección no es "Habilitado" (actual: (vacío))».
   - Duplicados: la V2 no los lista (los excluye); la API los marca como «No cuentan».
   - Bloqueados por alerta: hoy la hoja 11 no tiene filas, así que no hay casos reales. Está cubierto con datos sintéticos en la prueba 120.
3. **Cuando el CMC cambie sus reglas:** volver a extraer la copia, comparar las huellas con el editor del CMC, actualizar `HUELLAS_REGLAS_CMC` y repetir la muestra. La V2 no publica su código, así que este paso no es automático. Mientras no se haga, la ficha marca los requisitos como «sin comprobar» si la copia cambia.

## 7. Pruebas

- **Caja de arena (prueba 120).** Ejecuta los `HojaSoloLectura.gs` y `ApiPanel.gs` reales con un servicio Sheets falso. Comprueba:
  - firma, hora, nonce, tope e interruptor;
  - lista blanca y tachado;
  - fechas como `Date`;
  - que no hay métodos de escritura y que no se abren otras hojas;
  - el manifiesto con un único permiso;
  - las huellas.
- **Editor del proyecto real.** Se usó un archivo temporal `Pruebas.gs`, borrado antes de publicar. Comprobó:
  - la lectura de 1008 filas;
  - los requisitos de 22 aspirantes de todas las categorías;
  - la minimización de 15 fichas.
- **Implementación publicada, con la API apagada:**
  - cuerpo vacío, sin firma o con firma falsa → `inactiva`;
  - abrir la URL con GET no muestra nada (no hay `doGet`).
- **Prueba de integración real (2026-11-24, API activa, implementación «Version 2»):**
  - Configuración: `CMC_API_URL` y `CMC_API_TOKEN` existen solo en Deploy Previews (Producción no tiene ninguna); `CMC_API_TOKEN` está en las propiedades del proyecto API. El token no se mostró ni se registró.
  - Permisos: el manifiesto pide solo `spreadsheets.readonly`; ningún archivo del proyecto llama métodos de escritura, correo, Telegram ni `UrlFetchApp`.
  - Rechazos (repetidos tras publicar la versión 2):
    - vacío, sin JSON, sin firma o con versión distinta → `peticion_invalida`;
    - firma falsa o corta, y operación de escritura inventada → `firma_invalida`;
    - hora vencida o futura (±1000 s) → `fuera_de_tiempo`;
    - GET → «Script function not found: doGet».
  - Lectura real en el preview: solo códigos reales (ningún COM-9xxx sintético).
  - Cifras contrastadas con la hoja 03:
    - 1008 filas, de las que 2 son la segunda aparición de un código repetido y no se muestran;
    - 137 duplicados confirmados y 3 perfiles de prueba (la lista de `CODIGOS_PRUEBA`) no cuentan;
    - quedan 866 aspirantes por etapa:

      | Etapa | Aspirantes |
      |---|---|
      | Registrado | 547 |
      | Preseleccionado | 289 |
      | Entrevistado | 0 |
      | En verificación | 4 |
      | Habilitado | 4 (la hoja marca 5; el quinto es la prueba integral) |
      | Descartado | 1 |
      | Sin etapa | 21 |
  - Fichas de 10 aspirantes revisadas:
    - etapas: registrado, preseleccionado, en verificación, habilitado, descartado, sin etapa, prueba y los dos códigos repetidos;
    - todas cargaron sin error;
    - huellas de reglas iguales a la V2;
    - los habilitados cumplen los 4 requisitos y uno en verificación muestra los 3 pendientes.
  - Datos personales: en las 10 respuestas completas (todas las pestañas) no hay teléfonos, cédulas, enlaces de Drive o WhatsApp ni correos del CMC. El único correo es el de la sesión del administrador en la barra del panel.
  - Sin escrituras: la hoja conserva su última modificación (2026-11-22). En el proyecto del CMC solo corren sus disparadores programados de siempre.
  - Demostración: sigue funcionando con sus datos DEMO-1xx, sin mezcla con los reales.
- **Problemas encontrados y corregidos en esa prueba:**
  1. Abrir varias fichas seguidas agotaba la cuota de lectura de Sheets (`error_interno`): cada hoja se leía con dos llamadas. Ahora cada petición hace 2 llamadas `batchGet` en total y, si Google limita, responde `limite_google` con un mensaje claro.
  2. El filtro de etiquetas privadas borraba el requisito «Referencia verificada» (la palabra «referencia» coincidía en el campo `etiqueta`). Ahora el filtro solo mira `campo` y `pregunta`.
- **Calidad de datos del CMC (se corrige allí, no en el panel):** dos códigos aparecen dos veces en la hoja 03. Se muestra la primera aparición y la segunda se cuenta como «código vacío, mal escrito o repetido».

## 8. Configuración

| Dónde | Qué | Valor |
|---|---|---|
| Apps Script (proyecto API) → Propiedades del script | `CMC_API_ACTIVA` | `no` al publicar; `si` desde el 2026-11-24 para probar el preview |
| Apps Script (proyecto API) → Propiedades del script | `CMC_API_TOKEN` | Token nuevo de 64 caracteres, generado y guardado por Luis en su gestor de secretos. Nunca en el chat, el repo ni los registros. |
| Netlify → Environment variables | `CMC_API_URL` | URL `/exec` de la implementación. **Solo «Deploy Previews».** |
| Netlify → Environment variables | `CMC_API_TOKEN` | El mismo token, marcado como secreto. **Solo «Deploy Previews».** |

Producción no tiene ninguna de las dos variables. Sin ellas, el panel de producción muestra la vista anterior.

## 9. Reversión

1. **Inmediata:** `CMC_API_ACTIVA = no` en el proyecto API. El panel muestra «No se pudo leer el CMC (inactiva)» y la vista anterior.
2. **Netlify:** borrar `CMC_API_URL` y `CMC_API_TOKEN` y volver a desplegar el preview.
3. **Apps Script:** en «Implementar → Gestionar implementaciones», archivar la implementación. Opcionalmente, borrar el proyecto «CMC · API de lectura del panel».
4. **Permiso:** retirar el acceso desde la cuenta de Google de soycompaz (myaccount.google.com → Seguridad → Apps de terceros, «CMC · API de lectura…»).

Nada de esto toca el proyecto del CMC ni la V2.

## 10. Fase 2B (acciones): diseño, sin activar

Las escrituras **no** irán en este proyecto, que es de solo lectura por permiso. Para 2B:
- un proyecto aparte con permiso de hojas completo;
- solo las funciones de escritura necesarias, copiadas igual que aquí y con huellas;
- token e interruptor propios;
- operador explícito, comprobado contra la hoja 18;
- clave de idempotencia y registro del evento en la hoja 17;
- permiso web `cmc_acciones` y rutas `/api/admin/cmc/*` con `requierePermiso`;
- pruebas primero en una copia de la hoja.

Requiere su propia autorización.
