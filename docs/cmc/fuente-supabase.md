# CMC desde Supabase

El CMC (hoja `Centro_de_Mando_Compaz_V4`) da de alta a las familias y a los Compitas con su sincronización horaria de siempre. Lo único que cambia es de dónde lee: de Supabase en lugar de Airtable. No se reconstruye nada: las altas, los IDs COM- y CLI-, los controles *fail-closed*, las bienvenidas y preentrevistas, el vigilante y los disparadores siguen como están.

## Piezas

| Pieza | Qué es |
|---|---|
| `GET /api/cmc/postulaciones` (`lib/cmc.ts`) | Postulaciones desde `CAPTACION_DESDE`, con el mismo formato que la API de Airtable. Solo lectura, autenticada con `Authorization: Bearer CMC_LECTURA_TOKEN`. |
| `docs/cmc/fuente-supabase.gs` | Parche del Apps Script: 4 líneas cambiadas en `sincronizarAirtableInterno_` y 3 funciones nuevas. |
| Propiedad `CMC_FUENTE` del script | Interruptor: `airtable` (actual, por defecto) o `supabase`. |
| `tests/19-cmc-supabase.test.ts` | Pruebas de la ruta y pruebas de extremo a extremo con la copia literal del Apps Script (`tests/cmc/cmc-sync-original.gs.js`). La copia se verificó por huella contra el editor. |

## Garantías

- **IDs y claves**
  - La columna «ID Airtable» de la hoja guarda el `rec…` si la postulación llegó a Airtable. En ese caso la fila que ya existe se reconoce y no se crea otra.
  - Si la postulación no llegó a Airtable, guarda `SB-<uuid>`.
  - La sincronización busca también por «ID Supabase» (siempre `SB-<uuid>`). Por eso una fila creada como `SB-…` se sigue reconociendo aunque la postulación consiga después un `rec…`.
- **Histórico.** Las filas anteriores a `CAPTACION_DESDE` no se tocan, porque no están en Supabase y la sincronización nunca borra.
- **Qué no se entrega:** las postulaciones repetidas, las marcadas como «no procede» y las de tipo desconocido.
- **Altas manuales.** Si se da de alta a alguien a mano, hay que escribir `SB-<uuid>` en «ID Airtable» y no se duplicará. Si se escribe sin esa clave, el control de duplicados del CMC marca la fila.
- **Falla cerrado.** Con un token erróneo, una URL que falta, un error de la web o un `CMC_FUENTE` inválido, la sincronización no escribe nada y el vigilante avisa a las 3 horas.
- **Simulación.** `simularFuenteSupabase()` ejecuta la sincronización completa en modo `dryRun`: no escribe nada ni cambia el interruptor.

## Requisito previo en la hoja

La pestaña 03 tiene 1.007 filas y todas están ocupadas. `crearCompita_` escribe en la primera fila vacía, y si no queda ninguna intenta escribir fuera de la cuadrícula. En Apps Script eso falla y la alta se omite. Antes de activar, hay que añadir unas 200 filas vacías al final de la 03 con el formato de la fila anterior. En la 02 sobran filas.

## Despliegue mínimo (cada paso, con autorización)

1. **Web.**
   - Añadir `CMC_LECTURA_TOKEN` (aleatorio, de al menos 32 caracteres) en Netlify, solo en el contexto Production.
   - Fusionar la rama y hacer 1 despliegue a producción (unos 15 créditos).
   - Comprobar que `curl` sin token devuelve 401.
2. **Hoja.** Añadir las filas vacías a la 03.
3. **Apps Script.**
   - Guardar antes una versión (Historial del proyecto).
   - Aplicar las 4 ediciones y pegar las funciones de `fuente-supabase.gs`.
   - Crear las propiedades `CMC_SUPABASE_URL` (`https://micompaz.com/api/cmc/postulaciones`) y `CMC_LECTURA_TOKEN`.
   - No crear todavía `CMC_FUENTE`: con eso todo sigue funcionando igual que antes.
4. **Simulación.**
   - Ejecutar `simularFuenteSupabase()` desde el editor.
   - Resultado esperado hoy: una sola ALTA (COM-1063) para la postulación pendiente, o ninguna si ya se dio de alta a mano con su `SB-`, y 0 cambios en las pruebas.
5. **Activación.**
   - Crear `CMC_FUENTE = supabase`.
   - En la siguiente hora (minuto :10), la ejecución programada debe terminar en OK.
   - La bienvenida sale en la siguiente ejecución del flujo de preentrevistas, cada 15 minutos.

## Reversión

- **Inmediata:** poner `CMC_FUENTE = airtable` o borrar la propiedad. Con eso el código se comporta exactamente como el original (hay una prueba que lo compara con el original).
- **Completa:** restaurar la versión guardada del Apps Script. La ruta web puede quedarse; sin `CMC_LECTURA_TOKEN` responde 503 y no sirve nada.

## Dejar de copiar a Airtable

Con `POSTULACIONES_DESTINO=solo_supabase` la web deja de copiar a Airtable y los crons de Airtable se quedan en reposo (ver `docs/flows.md`, sección 12). El CMC no cambia: sigue leyendo de Supabase.
