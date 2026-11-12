// Personas en el navegador: la lista completa llega UNA vez y ordenar, filtrar, buscar y paginar se calcula aquí, sin pedirle nada al servidor.
// Lógica PURA (sin React ni base de datos) para poder probarla. El estado sigue viviendo en la dirección (?q=...&orden=...), que se actualiza con
// history.replaceState: al refrescar o compartir el enlace, el servidor devuelve la misma pantalla.
import { consultarClientes, consultarCompitas, type FilaCliente, type FilaCompita } from '@/lib/panel-personas-tipos'
import type { DatosClientes, DatosCompitas } from '@/components/panel/Personas'

export interface ParamsLista { q: string; vista: string; orden: string; dir: string; pag: string; estado: string }

/** Lee de una cadena de consulta ("sec=personas&q=ana") los parámetros que mueven la lista. */
export function leerParamsLista(qs: string): ParamsLista {
  const u = new URLSearchParams(qs)
  const g = (k: string) => u.get(k) ?? ''
  return { q: g('q'), vista: g('vista'), orden: g('orden'), dir: g('dir'), pag: g('pag'), estado: g('estado') }
}

/** Aplica cambios (null quita el parámetro) a la cadena de consulta actual y devuelve la dirección completa del panel. Conserva lo demás (como, persona, chat...). */
export function direccionCon(qs: string, cambios: Record<string, string | null>): string {
  const u = new URLSearchParams(qs)
  for (const [k, v] of Object.entries(cambios)) { if (v === null || v === '') u.delete(k); else u.set(k, v) }
  return `/panel?${u.toString()}`
}

/** Lo mismo que armaba el servidor para la tabla de compitas, ahora a partir de la lista completa y de los parámetros. */
export function datosCompitas(todas: FilaCompita[], p: ParamsLista): DatosCompitas {
  const c = consultarCompitas(todas, p)
  return { fila: c.fila, total: c.total, paginas: c.paginas, pag: c.pag, conteos: c.conteos, vista: c.vista.id, orden: p.orden, dir: p.dir === 'desc' ? 'desc' : 'asc', q: p.q, enTotal: todas.length, estados: c.estados, estado: c.estado }
}

export function datosClientes(todos: FilaCliente[], p: ParamsLista): DatosClientes {
  return { ...consultarClientes(todos, p.q, p.pag, p.estado), q: p.q, enTotal: todos.length }
}

/** ¿Este enlace solo mueve la lista (se puede resolver en el navegador) o abre algo que necesita al servidor (una ficha, un chat, otra sección)? */
export function esMovimientoDeLista(href: string, lista: 'compitas' | 'clientes'): boolean {
  let u: URL
  try { u = new URL(href, 'https://x.local') } catch { return false }
  if (u.pathname !== '/panel') return false
  const q = u.searchParams
  if (q.get('sec') !== 'personas') return false
  if ((q.get('lista') === 'clientes' ? 'clientes' : 'compitas') !== lista) return false
  return !q.get('persona') && !q.get('chat') && !q.get('caso') && !q.get('visita')
}
