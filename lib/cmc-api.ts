// ══════════════════════════════════════════════════════════════════════════════
// Cliente de la API de LECTURA del CMC (Apps Script, docs/cmc/api-panel.gs). SOLO SERVIDOR.
//
// · El CMC es la fuente autorizada: aquí no se decide nada, solo se lee y se muestra.
// · Cada petición va firmada con HMAC-SHA256 (CMC_API_TOKEN), con hora y nonce de un solo uso.
// · Solo operaciones de lectura (ping, lista, ficha). Las escrituras de la fase 2B irán por otra función,
//   con permiso propio y registro; no existen todavía.
// · Defensa en profundidad: aunque el CMC ya las quita, aquí se vuelven a borrar las claves de contacto.
// · Sin CMC_API_URL o CMC_API_TOKEN la API está «no configurada» y el panel sigue mostrando la vista anterior.
// · Solo lo importan componentes de servidor y lib/: usa node:crypto y variables sin NEXT_PUBLIC_, así que no puede llegar al navegador.
// ══════════════════════════════════════════════════════════════════════════════
import { createHmac, randomUUID } from 'crypto'
import { conCacheCorto } from '@/lib/cache-corto'

export const VERSION_API_CMC = 1
const TIEMPO_MAX_MS = 25_000
export const TTL_LISTA_MS = 60_000
export const TTL_FICHA_MS = 30_000

export type OperacionLectura = 'ping' | 'lista' | 'ficha' | 'version'
export class CmcNoConfigurado extends Error { constructor() { super('La API del CMC no está configurada.') } }
export class CmcError extends Error { constructor(public codigo: string) { super(`El CMC respondió con un error (${codigo}).`) } }

/** Claves que nunca se muestran ni se guardan (mismas que borra el CMC). */
export const CLAVES_PRIVADAS = /tel[eé]fono|whats|email|e-mail|correo|c[eé]dula|documento|direcci[oó]n|enlace|link|url|ip$|^t$|^e$|^wa$/i

export function limpiarPrivados<T>(x: T, nivel = 0): T {
  if (nivel > 8 || x == null) return x
  if (Array.isArray(x)) return x.map((y) => limpiarPrivados(y, nivel + 1)) as T
  if (typeof x === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) if (!CLAVES_PRIVADAS.test(k)) o[k] = limpiarPrivados(v, nivel + 1)
    return o as T
  }
  return x
}

/** Solo se acepta una dirección de Apps Script: evita que una variable mal puesta mande la firma a otro sitio. */
export function urlValida(u: string | undefined): string | null {
  if (!u) return null
  try {
    const url = new URL(u)
    return url.protocol === 'https:' && url.hostname === 'script.google.com' && /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) && !url.search ? url.toString() : null
  } catch { return null }
}

export function configuracionCmc(): { url: string; token: string } | null {
  const url = urlValida(process.env.CMC_API_URL)
  const token = process.env.CMC_API_TOKEN ?? ''
  return url && token.length >= 48 ? { url, token } : null
}

export function firmar(token: string, p: { v: number; op: string; id: string; ts: number; nonce: string }): string {
  return createHmac('sha256', token).update([p.v, p.op, p.id, p.ts, p.nonce].join('.')).digest('hex')
}

export interface RespuestaCmc<T> { ok: true; v: number; op: string; generado: string; ms: number; datos: T }

async function llamar<T>(op: OperacionLectura, id = ''): Promise<RespuestaCmc<T>> {
  const conf = configuracionCmc()
  if (!conf) throw new CmcNoConfigurado()
  const p = { v: VERSION_API_CMC, op, id, ts: Math.floor(Date.now() / 1000), nonce: randomUUID() }
  let res: Response
  try {
    // text/plain: Apps Script lo recibe tal cual en e.postData.contents. La respuesta llega tras una redirección de Google.
    res = await fetch(conf.url, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...p, firma: firmar(conf.token, p) }), redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(TIEMPO_MAX_MS) })
  } catch { throw new CmcError('sin_conexion') }
  if (!res.ok) throw new CmcError(`http_${res.status}`)
  let cuerpo: unknown
  try { cuerpo = await res.json() } catch { throw new CmcError('respuesta_no_json') }
  const r = cuerpo as Partial<RespuestaCmc<T>> & { error?: unknown }
  // Solo un código conocido (letras y guion bajo) pasa a los registros; cualquier otro texto se descarta.
  if (!r || r.ok !== true) throw new CmcError(typeof r?.error === 'string' && /^[a-z_]{1,40}$/.test(r.error) ? r.error : 'respuesta_invalida')
  if (r.v !== VERSION_API_CMC || r.op !== op || typeof r.generado !== 'string' || r.datos == null) throw new CmcError('contrato_distinto')
  return { ...(r as RespuestaCmc<T>), datos: limpiarPrivados(r.datos as T) }
}

// ── Lista ──────────────────────────────────────────────────────────────────────

export interface FilaCmc {
  id: string; nombre: string; zona: string; registro: string; etapa: string; estadoOperativo: string; aceptaNuevos: string
  preentrevista: string; duplicadoDe: string; clasificacionDuplicado: string; alertasAbiertas: number; alertasBloquean: number
}
export interface ListaCmc { filas: FilaCmc[]; filasLeidas: number }

/** Valida cada fila: lo que no tenga la forma esperada se descarta y se cuenta (nunca se inventa un valor). */
export function validarLista(d: unknown): { lista: ListaCmc; descartadas: number } {
  const x = d as { filas?: unknown; filasLeidas?: unknown }
  if (!x || !Array.isArray(x.filas)) throw new CmcError('contrato_distinto')
  const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const filas: FilaCmc[] = []
  let descartadas = 0
  const vistos = new Set<string>()
  for (const f of x.filas as Record<string, unknown>[]) {
    const id = s(f?.id).trim()
    if (!/^COM-\d{4,6}$/.test(id) || vistos.has(id)) { descartadas++; continue }
    vistos.add(id)
    filas.push({ id, nombre: s(f.nombre), zona: s(f.zona), registro: s(f.registro), etapa: s(f.etapa), estadoOperativo: s(f.estadoOperativo), aceptaNuevos: s(f.aceptaNuevos), preentrevista: s(f.preentrevista), duplicadoDe: s(f.duplicadoDe), clasificacionDuplicado: s(f.clasificacionDuplicado), alertasAbiertas: n(f.alertasAbiertas), alertasBloquean: n(f.alertasBloquean) })
  }
  return { lista: { filas, filasLeidas: n(x.filasLeidas) }, descartadas }
}

export async function leerListaCmc(): Promise<{ lista: ListaCmc; descartadas: number; generado: string }> {
  return conCacheCorto('cmc_api_lista', TTL_LISTA_MS, async () => {
    const r = await llamar<unknown>('lista')
    return { ...validarLista(r.datos), generado: r.generado }
  })
}

// ── Ficha ──────────────────────────────────────────────────────────────────────

export interface FichaCmc { ficha: Record<string, unknown>; pestanas: Record<string, unknown> }

export async function leerFichaCmc(id: string): Promise<{ datos: FichaCmc; generado: string }> {
  if (!/^COM-\d{4,6}$/.test(id)) throw new CmcError('id_invalido')
  return conCacheCorto(`cmc_api_ficha_${id}`, TTL_FICHA_MS, async () => {
    const r = await llamar<FichaCmc>('ficha', id)
    const d = r.datos as Partial<FichaCmc>
    if (!d || typeof d.ficha !== 'object' || typeof d.pestanas !== 'object') throw new CmcError('contrato_distinto')
    return { datos: d as FichaCmc, generado: r.generado }
  })
}

export async function pingCmc(): Promise<boolean> { await llamar('ping'); return true }

// ── Reglas copiadas del CMC: control de divergencia ────────────────────────────────────────────────────────────────────
// La API vive en un proyecto aparte y lleva una COPIA LITERAL de las funciones del CMC que calculan los requisitos
// (docs/cmc/api-lectura/ReglasCMC, no está en el repositorio). Estas son las huellas SHA-256 (16 primeros caracteres) de
// cada función tal como estaba en el proyecto del CMC el 2026-11-19; la copia se comprobó igual función por función.
// Si la API devuelve otra huella, la copia cambió: los requisitos se muestran como «sin comprobar».
// Si el CMC cambia sus reglas, hay que volver a copiar y actualizar esta lista (docs/cmc/api-panel.md, «Paridad»).
export const HUELLAS_REGLAS_CMC: Record<string, string> = {
  panel_obtenerPanelElegibilidad_core_: '5444a46942f169d3', panel_evaluarHabilitacion_: 'f24d05be2fb6d339', panel_calcularElegibilidad_: 'da5ad6c807ca88ef',
  panel_obtenerElegibilidad: 'a7d41d7063a671ed', panel_obtenerEtapaSeleccion_: '36f851b6be52afdd', entrevista_masReciente_: '1900a6bfba2476cc',
  panel_obtenerAlertas: '861a82e557e7882a', panel_obtenerVerificaciones: '1dfb98ecb687ba18', panel_obtenerOnboarding: '8653b53efac1eb4c',
  panel_leerFull03_: '6908be9dc3fe94e0', v2_obtenerTabRaw_: '2bc283861950e00c', v2_obtenerPreentrevista: 'a9962a961d1f3c03',
  obtenerEvaluacionCompita: 'b64c0e2bc58b0cee', v2_timeline_: '5bd4e48b5c4135b6', panel_obtenerEventos: '670dea6623b999c2',
}
export type EstadoReglas = 'iguales' | 'distintas' | 'sin_comprobar'
export function compararReglas(reglas: unknown): { estado: EstadoReglas; distintas: string[] } {
  if (!reglas || typeof reglas !== 'object') return { estado: 'sin_comprobar', distintas: [] }
  const r = reglas as Record<string, unknown>
  const distintas = Object.keys(HUELLAS_REGLAS_CMC).filter((k) => r[k] !== HUELLAS_REGLAS_CMC[k])
  return { estado: distintas.length ? 'distintas' : 'iguales', distintas }
}
export const TTL_VERSION_MS = 10 * 60_000
export async function leerReglasCmc(): Promise<{ estado: EstadoReglas; distintas: string[] }> {
  try {
    return await conCacheCorto('cmc_api_version', TTL_VERSION_MS, async () => compararReglas(((await llamar<{ reglas?: unknown }>('version')).datos || {}).reglas))
  } catch { return { estado: 'sin_comprobar', distintas: [] } }
}
