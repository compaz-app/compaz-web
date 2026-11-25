# Sistema de Confianza en el panel

Sección del panel (`/panel?sec=confianza`) que reúne la selección de Compitas: registro, preentrevista, entrevista, verificaciones, onboarding y habilitación. Primera versión: 1.4.0-beta.1 (17-nov-2026).

## Dónde vive cada dato

| Dato | Fuente autorizada | ¿Lo lee la web hoy? |
|---|---|---|
| Postulaciones de Compitas | Supabase `postulaciones` (y el CMC las copia) | Sí |
| Etapa de selección, entrevistas (hoja 08), verificaciones (12), onboarding (16), alertas (11), eventos (17) | CMC (Google Sheets + Apps Script) | **No** |
| Compitas habilitadas | CMC → `compitas.cmc_permite` (publicador horario) | Sí |
| Estado en el catálogo (activo, verificado, Telegram) | Supabase `compitas` | Sí |

## Arquitectura de esta versión

1. **Operación real (solo lectura)**: `lib/confianza/operativo.ts` lee Supabase y separa las cifras: perfiles de prueba (`CODIGOS_PRUEBA`, palabras como prueba o test, cuentas de `ADMIN_EMAILS`), repetidas y demos. Cada Compita abre la ficha que ya existe en Personas: no hay una segunda ficha. No escribe nada.
2. **Demostración**: `lib/confianza/demo.ts` (escenario sintético y motor puro) con la pantalla `components/panel/confianza/ConfianzaDemo.tsx`. El estado vive en `localStorage` del navegador de quien presenta y la navegación en la dirección (`cf_modo`, `cf_etapa`, `cf_q`, `cf_id`, `cf_tab`). Está aislada **por diseño**: no importa Supabase, no llama a ninguna API, no envía nada. La prueba 118 lo vigila leyendo el código.
3. **Reglas**: `lib/confianza/reglas.ts` es un espejo de `panel_evaluarHabilitacion_` y de las listas del CMC. La demo usa estas reglas; la habilitación real la sigue decidiendo el CMC. Si el CMC cambia una regla, se cambia aquí (la prueba 118 tiene un caso por cada control).
4. En la demostración el marco del panel esconde el correo, el «ver como» y los puntos rojos.

### Por qué así (alternativas que se descartaron)

| Opción | Por qué no, por ahora |
|---|---|
| Tablas `demo_*` en Supabase | Hoy la base de desarrollo y la de producción son la misma: la demo escribiría en producción. |
| Incrustar la V2 (Apps Script) en un iframe | Mezcla dos sistemas de sesión, la CSP lo bloquea y la V2 escribe en el CMC real. |
| Copiar a Supabase las etapas del CMC ya | Exige cambiar el Apps Script de producción y un nuevo contrato: pendiente de autorizar (fase 2). |

## Bloqueos y lo que queda en la V2

Las escrituras reales (entrevista, verificación, onboarding, habilitación) **siguen en el Centro Compitas V2**. La web no tiene un canal seguro hacia el CMC para escribir ni para leer las etapas intermedias. Opcional: la variable `CMC_V2_URL` (servidor) muestra el enlace a la V2 en la vista operativa.

## Plan para la interfaz operativa definitiva

1. **Lectura de etapas (fase 2, bajo riesgo)**: ampliar la foto horaria que ya envía el CMC (`/api/cmc/compitas`) con la etapa de TODAS las filas (sin datos personales), en una tabla nueva `cmc_etapas` (migración que solo agrega). Con eso, la vista real cuenta los aspirantes en evaluación y cada ficha muestra su etapa. Requiere cambiar `PublicarCompitas.gs` (autorización de Luis).
2. **Escrituras (fase 3)**: endpoint firmado del CMC (`doPost` con token aparte, tiempo constante, registro en la hoja 17) para entrevista, verificación, onboarding y habilitación, llamado SOLO desde rutas `/api/admin/confianza/*` con `requierePermiso` nuevo («confianza») y motivo. Las reglas siguen en el CMC: el panel envía la acción y muestra lo que el CMC responde.
3. **Fuente única (fase 4, antes de escalar)**: decidir si el CMC sigue siendo la fuente o si la selección se muda a Supabase (con la base de producción ya separada de la de desarrollo). En ese momento `reglas.ts` pasa de espejo a fuente y la V2 se retira.
4. Columna `solo_pruebas` en `compitas` (migración que solo agrega) para que un perfil de prueba nunca salga en el catálogo ni reciba solicitudes, en lugar de la lista `CODIGOS_PRUEBA`.
