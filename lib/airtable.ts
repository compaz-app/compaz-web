// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Copia de postulaciones a Airtable ("Lista de Espera")
//
// Airtable alimenta hoy la hoja del CMC. Se mantiene como copia temporal mientras
// el CMC no lea de Supabase. Los campos y su formato son los de siempre, para que
// las fórmulas de Airtable (Teléfono, Email, Rol) y la sincronización con la hoja
// sigan funcionando igual.
//
// Límite de Airtable: su API no admite claves de idempotencia. Por eso cada
// postulación lleva una huella fija (Contacto + Fecha con milisegundos) y todo
// reintento busca esa huella antes de crear nada (ver lib/captacion.ts).
// ══════════════════════════════════════════════════════════════════════════════

export interface CamposAirtable {
  nombre: string
  contacto: string          // "WA: … | Email: … | Rol: …" (formato que leen las fórmulas)
  ciudad: string            // "ciudad, estado"
  fecha: string             // ISO con milisegundos: parte de la huella
  utmSource: string
  utmMedium: string
  utmCampaign: string
}

export interface RegistroAirtable {
  id: string
  creado: string
  nombre: string
  contacto: string
  ciudad: string
  fecha: string | null
  utmSource: string
  utmMedium: string
  utmCampaign: string
}

export type ResultadoCreacion =
  | { ok: true; id: string }
  | { ok: false; error: string; incierto: boolean }   // incierto: pudo haberse creado (timeout, corte)

export type ResultadoBusqueda = { ok: true; registros: RegistroAirtable[] } | { ok: false; error: string }

const TIMEOUT_MS = 5_000
const ID_AIRTABLE = /^rec[A-Za-z0-9]{14}$/

export function airtableConfigurado(): boolean {
  return !!process.env.AIRTABLE_API_KEY && !!process.env.AIRTABLE_BASE_ID
}

function urlTabla(): string {
  const tabla = process.env.AIRTABLE_TABLE_NAME ?? 'Lista de Espera'
  return `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(tabla)}`
}

async function pedir(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(t)
  }
}

function aRegistro(r: { id?: unknown; createdTime?: unknown; fields?: Record<string, unknown> }): RegistroAirtable | null {
  if (typeof r.id !== 'string' || !ID_AIRTABLE.test(r.id)) return null
  const f = r.fields ?? {}
  const s = (k: string) => (typeof f[k] === 'string' ? (f[k] as string) : '')
  return {
    id: r.id, creado: typeof r.createdTime === 'string' ? r.createdTime : '',
    nombre: s('Nombre'), contacto: s('Contacto'), ciudad: s('Ciudad'), fecha: s('Fecha') || null,
    utmSource: s('UTM Source'), utmMedium: s('UTM Medium'), utmCampaign: s('UTM Campaign'),
  }
}

export async function crearRegistroAirtable(c: CamposAirtable): Promise<ResultadoCreacion> {
  if (!airtableConfigurado()) return { ok: false, error: 'Airtable sin configurar', incierto: false }
  let res: Response
  try {
    res = await pedir(urlTabla(), {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          Nombre: c.nombre, Contacto: c.contacto, Ciudad: c.ciudad, Fecha: c.fecha,
          'UTM Source': c.utmSource, 'UTM Medium': c.utmMedium, 'UTM Campaign': c.utmCampaign,
        },
      }),
    })
  } catch (e) {
    // Timeout o corte de red: la petición pudo llegar y crearse
    return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : 'error de red', incierto: true }
  }
  if (!res.ok) {
    // 5xx: Airtable pudo haber guardado antes de fallar. 4xx: rechazo explícito.
    return { ok: false, error: `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`, incierto: res.status >= 500 }
  }
  const body = (await res.json().catch(() => null)) as { id?: unknown } | null
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!ID_AIRTABLE.test(id)) return { ok: false, error: 'Airtable respondió sin id de registro válido', incierto: true }
  return { ok: true, id }
}

/** Texto para una fórmula de Airtable entre comillas dobles. null si no se puede expresar con seguridad. */
export function textoFormula(valor: string): string | null {
  if (/[\r\n]/.test(valor)) return null
  return '"' + valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

async function listar(formula: string, maxPaginas = 20): Promise<ResultadoBusqueda> {
  if (!airtableConfigurado()) return { ok: false, error: 'Airtable sin configurar' }
  const registros: RegistroAirtable[] = []
  let offset = ''
  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const params = new URLSearchParams({ filterByFormula: formula, pageSize: '100' })
    if (offset) params.set('offset', offset)
    let res: Response
    try {
      res = await pedir(`${urlTabla()}?${params}`)
    } catch (e) {
      return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : 'error de red' }
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}` }
    const body = (await res.json().catch(() => null)) as { records?: unknown[]; offset?: unknown } | null
    if (!body || !Array.isArray(body.records)) return { ok: false, error: 'respuesta de Airtable no válida' }
    for (const r of body.records) {
      const reg = aRegistro(r as never)
      if (reg) registros.push(reg)
    }
    if (typeof body.offset !== 'string' || !body.offset) return { ok: true, registros }
    offset = body.offset
  }
  return { ok: false, error: 'demasiadas páginas: búsqueda incompleta' }
}

/** Registros con exactamente ese Contacto (para buscar la huella antes de reintentar). */
export async function buscarPorContacto(contacto: string): Promise<ResultadoBusqueda> {
  const t = textoFormula(contacto)
  if (!t) return { ok: false, error: 'Contacto no expresable en una fórmula' }
  return listar(`{Contacto} = ${t}`, 3)
}

/** Registros creados en Airtable a partir de una fecha (para la conciliación). */
export async function listarCreadosDesde(desdeIso: string): Promise<ResultadoBusqueda> {
  if (Number.isNaN(Date.parse(desdeIso))) return { ok: false, error: 'fecha no válida' }
  return listar(`IS_AFTER(CREATED_TIME(), ${textoFormula(new Date(desdeIso).toISOString())})`)
}

export async function obtenerRegistro(id: string): Promise<RegistroAirtable | null> {
  if (!ID_AIRTABLE.test(id) || !airtableConfigurado()) return null
  try {
    const res = await pedir(`${urlTabla()}/${id}`)
    if (!res.ok) return null
    return aRegistro((await res.json()) as never)
  } catch {
    return null
  }
}

/** Misma Fecha con precisión de milisegundos (Airtable y Postgres la escriben distinto). */
export function mismaFecha(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const x = Date.parse(a), y = Date.parse(b)
  return !Number.isNaN(x) && x === y
}
