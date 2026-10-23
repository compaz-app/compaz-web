// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Copia de postulaciones a Airtable ("Lista de Espera")
// Airtable alimenta hoy la hoja del CMC. Se mantiene como copia temporal mientras
// el CMC no lea de Supabase. Los campos y su formato son exactamente los de antes,
// para que las fórmulas de Airtable (Teléfono, Email, Rol) y la sincronización
// con la hoja sigan funcionando igual.
// ══════════════════════════════════════════════════════════════════════════════

export interface CamposAirtable {
  nombre: string
  contacto: string          // "WA: … | Email: … | Rol: …" (formato que leen las fórmulas)
  ciudad: string            // "ciudad, estado"
  fecha: string             // ISO
  utmSource: string
  utmMedium: string
  utmCampaign: string
}

export type ResultadoAirtable =
  | { ok: true; id: string }
  | { ok: false; error: string; sinConfigurar?: boolean }

const TIMEOUT_MS = 5_000

export function airtableConfigurado(): boolean {
  return !!process.env.AIRTABLE_API_KEY && !!process.env.AIRTABLE_BASE_ID
}

export async function crearRegistroAirtable(c: CamposAirtable): Promise<ResultadoAirtable> {
  const key = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  const tabla = process.env.AIRTABLE_TABLE_NAME ?? 'Lista de Espera'
  if (!key || !baseId) return { ok: false, error: 'Airtable sin configurar', sinConfigurar: true }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tabla)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          Nombre: c.nombre, Contacto: c.contacto, Ciudad: c.ciudad, Fecha: c.fecha,
          'UTM Source': c.utmSource, 'UTM Medium': c.utmMedium, 'UTM Campaign': c.utmCampaign,
        },
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` }
    const body = (await res.json().catch(() => null)) as { id?: unknown } | null
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!/^rec[A-Za-z0-9]{14}$/.test(id)) return { ok: false, error: 'Airtable respondió sin id de registro válido' }
    return { ok: true, id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : 'error de red' }
  } finally {
    clearTimeout(t)
  }
}
