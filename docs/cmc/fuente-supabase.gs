// ══════════════════════════════════════════════════════════════════════════════
// CMC · Fuente Supabase para la sincronización de altas (parche del Apps Script)
//
// Se aplica al proyecto de Apps Script ligado a «Centro_de_Mando_Compaz_V4», archivo
// «Código». NO reconstruye nada: la sincronización existente (sincronizarAirtableInterno_,
// crearCompita_, crearFamilia_, índices, IDs COM-/CLI-, controles fail-closed, aviso de
// frescura y disparadores) sigue igual. Solo cambia DE DÓNDE se leen los registros.
//
// Interruptor (Propiedades del script):
//   CMC_FUENTE = airtable  → comportamiento actual (valor por defecto si no existe).
//   CMC_FUENTE = supabase  → lee GET /api/cmc/postulaciones (sin llamadas a Airtable).
// Reversión inmediata: poner CMC_FUENTE = airtable (o borrar la propiedad).
//
// Propiedades nuevas: CMC_FUENTE, CMC_SUPABASE_URL (https://micompaz.com/api/cmc/postulaciones),
// CMC_LECTURA_TOKEN (mismo valor que la variable de Netlify; nunca en el código).
//
// ── TRES EDICIONES dentro de sincronizarAirtableInterno_ (texto exacto) ────────────
//
// E1 · lectura de registros
//   ANTES:    registros = obtenerRegistrosAirtable_(token);
//   DESPUÉS:  registros = obtenerRegistrosFuente_(token, opciones);
//
// E2 · clave alternativa (justo debajo de la línea de idAirtable)
//   ANTES:    const idAirtable = String(fields['ID Airtable'] || '').trim();
//   DESPUÉS:  const idAirtable = String(fields['ID Airtable'] || '').trim();
//             const idSupabase = String(fields['ID Supabase'] || '').trim();
//
// E3 · búsqueda de la fila existente (dos líneas)
//   ANTES:    const fila = idxLeads[idAirtable];
//   DESPUÉS:  const fila = idxLeads[idAirtable] || (idSupabase ? idxLeads[idSupabase] : undefined);
//   ANTES:    const fila = idxCompitas[idAirtable];
//   DESPUÉS:  const fila = idxCompitas[idAirtable] || (idSupabase ? idxCompitas[idSupabase] : undefined);
//
// Con CMC_FUENTE = airtable, los registros de Airtable no traen «ID Supabase»: E2 y E3
// no cambian nada y la sincronización es idéntica a la actual.
//
// ── FUNCIONES NUEVAS (pegar al final de «Código») ─────────────────────────────────

/** Elige la fuente según opciones.fuente (solo simulación) o la propiedad CMC_FUENTE. */
function obtenerRegistrosFuente_(token, opciones) {
  const fuente = String((opciones && opciones.fuente) ||
    PropertiesService.getScriptProperties().getProperty('CMC_FUENTE') || 'airtable').trim().toLowerCase();
  if (fuente === 'airtable') return obtenerRegistrosAirtable_(token);
  if (fuente === 'supabase') return obtenerRegistrosSupabase_();
  throw new Error('CMC_FUENTE no válida: ' + fuente + ' (usar airtable o supabase).');
}

/** Lee todas las páginas de /api/cmc/postulaciones. Falla cerrado: ante cualquier error lanza y no se escribe nada. */
function obtenerRegistrosSupabase_() {
  const props = PropertiesService.getScriptProperties();
  const url = String(props.getProperty('CMC_SUPABASE_URL') || '').trim();
  const token = String(props.getProperty('CMC_LECTURA_TOKEN') || '').trim();
  if (!url || !token) throw new Error('Faltan CMC_SUPABASE_URL o CMC_LECTURA_TOKEN en Propiedades del script.');
  if (url.indexOf('https://') !== 0) throw new Error('CMC_SUPABASE_URL debe empezar por https://');

  let registros = [];
  let offset = '';
  for (let pagina = 0; pagina < 50; pagina++) {
    const resp = UrlFetchApp.fetch(url + (offset ? '?offset=' + encodeURIComponent(offset) : ''), {
      method: 'get',
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true,
      followRedirects: false
    });
    const code = resp.getResponseCode();
    if (code !== 200) throw new Error('Supabase (web Compaz) devolvio el codigo HTTP ' + code + '.');
    const json = JSON.parse(resp.getContentText());
    if (!json || json.ok !== true || !json.data || !Array.isArray(json.data.records)) {
      throw new Error('Respuesta de /api/cmc/postulaciones no valida.');
    }
    registros = registros.concat(json.data.records);
    offset = json.data.offset || '';
    if (!offset) return registros;
  }
  throw new Error('Demasiadas paginas en /api/cmc/postulaciones (mas de 50).');
}

/**
 * SIMULACIÓN (solo lectura): ejecuta la sincronización completa contra Supabase sin
 * escribir nada en la hoja ni cambiar CMC_FUENTE. Ejecutar desde el editor y leer el
 * registro: lista las altas que haría (ALTA COM-xxxx …), las celdas que cambiaría
 * (UPD-…) y los fallos de los controles fail-closed.
 */
function simularFuenteSupabase() {
  const r = sincronizarAirtableInterno_({ dryRun: true, silencioso: true, fuente: 'supabase' });
  console.log('CMC_SIMULACION_SUPABASE ' + JSON.stringify(r));
  return r;
}
