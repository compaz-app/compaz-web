// Los puntos rojos del menú, compartidos por todo el panel. Una sola consulta periódica sirve a todos (menú de escritorio y barra del teléfono):
// cada 20 s con la pestaña a la vista y cada 60 s con la pestaña oculta, para que el número del título de la pestaña del navegador siga al día.
//
// Qué cuenta cada punto (se explica en pantalla y en el manual):
//  - Bandeja: las tareas NUEVAS que todavía no has visto, como los mensajes sin leer. Se quita al abrir la Bandeja con la pestaña a la vista;
//    "visto" se guarda en este navegador, por persona.
//  - Pagos: los pagos por confirmar. NO se quita al verlos: es dinero esperando, y se va cuando se confirma.

export type TipoPendiente = 'bandeja' | 'pagos'
const RUTA: Record<TipoPendiente, string> = { bandeja: '/api/admin/pendientes-bandeja', pagos: '/api/admin/pendientes-pagos' }
export const EVENTO_PENDIENTES = 'compaz:pendientes'

const valor: Record<TipoPendiente, number | null> = { bandeja: null, pagos: null }
const usos: Record<TipoPendiente, number> = { bandeja: 0, pagos: 0 }
const activa: Record<TipoPendiente, boolean> = { bandeja: false, pagos: false }
const oyentes = new Set<() => void>()
let temporizador: ReturnType<typeof setTimeout> | null = null
let tituloBase: string | null = null
let clave = 'compaz_visto_bandeja'

const quitarNumero = (t: string) => t.replace(/^\(\d+\+?\)\s*/, '')
const leerVisto = (): string | null => { try { return localStorage.getItem(clave) } catch { return null } }
const guardarVisto = (iso: string) => { try { localStorage.setItem(clave, iso) } catch { /* sin almacenamiento: se cuenta todo como nuevo */ } }
const visible = () => typeof document !== 'undefined' && document.visibilityState === 'visible'

function actualizarTitulo() {
  if (typeof document === 'undefined') return
  if (tituloBase === null) tituloBase = quitarNumero(document.title || 'Panel')
  const n = Math.max(valor.bandeja ?? 0, valor.pagos ?? 0)
  document.title = n > 0 ? `(${n > 99 ? '99+' : n}) ${tituloBase}` : tituloBase
}

async function consultar() {
  const tareas: Promise<void>[] = []
  if (usos.bandeja > 0) tareas.push((async () => {
    try {
      const visto = leerVisto()
      const r = await fetch(`${RUTA.bandeja}${visto ? `?desde=${encodeURIComponent(visto)}` : ''}`, { cache: 'no-store' })
      const j = await r.json().catch(() => null) as { ok?: boolean; data?: { nuevas?: number; ahora?: string } } | null
      if (r.status === 429) { pausaHasta = Date.now() + 60_000; return }
      if (!r.ok || j?.ok === false || typeof j?.data?.nuevas !== 'number') return
      // Estás mirando la Bandeja con la pestaña a la vista: lo que hay ya lo viste. Se guarda la hora del servidor y el punto se quita.
      if (activa.bandeja && visible() && j.data.ahora) { guardarVisto(j.data.ahora); valor.bandeja = 0 } else valor.bandeja = j.data.nuevas
    } catch { /* sin conexión: se conserva el número anterior y se reintenta */ }
  })())
  if (usos.pagos > 0) tareas.push((async () => {
    try {
      const r = await fetch(RUTA.pagos, { cache: 'no-store' })
      const j = await r.json().catch(() => null) as { ok?: boolean; data?: { n?: number } } | null
      if (r.status === 429) { pausaHasta = Date.now() + 60_000; return }
      if (r.ok && j?.ok !== false && typeof j?.data?.n === 'number') valor.pagos = j.data.n
    } catch { /* igual */ }
  })())
  await Promise.all(tareas)
  actualizarTitulo()
  oyentes.forEach((f) => f())
}

function programar() {
  if (temporizador) clearTimeout(temporizador)
  if (usos.bandeja + usos.pagos === 0) { temporizador = null; return }
  temporizador = setTimeout(() => { ahora() }, visible() ? 20_000 : 60_000)
}

// Tope de seguridad: nunca más de una consulta cada 5 segundos por pestaña, pase lo que pase (un error de dibujo, un evento repetido...). Si llega otra petición
// dentro de ese plazo, se junta en UNA sola consulta al terminar el plazo; si ya hay una en camino, no se lanza otra. Así un fallo aquí nunca puede tumbar el servidor.
export const MIN_ENTRE_CONSULTAS_MS = 5_000
let enCurso = false
let ultimaConsulta = 0
let trailing: ReturnType<typeof setTimeout> | null = null
// Si el servidor responde 429 (se pasó del tope), la pestaña se calla un minuto entero en vez de seguir insistiendo.
let pausaHasta = 0
const ahora = () => {
  if (enCurso) return
  if (Date.now() < pausaHasta) { programar(); return }
  const espera = ultimaConsulta + MIN_ENTRE_CONSULTAS_MS - Date.now()
  if (espera > 0) { if (!trailing) trailing = setTimeout(() => { trailing = null; ahora() }, espera); return }
  enCurso = true; ultimaConsulta = Date.now()
  void consultar().finally(() => { enCurso = false; programar() })
}
const alVolver = () => { if (visible()) ahora() }

/** Se suscribe un punto. `esActiva` = la persona está en esa sección ahora; `correo` separa lo "visto" de cada persona en este navegador. */
export function usar(tipo: TipoPendiente, oyente: () => void, opciones: { esActiva: boolean; correo: string }): () => void {
  const primero = usos.bandeja + usos.pagos === 0
  usos[tipo]++; activa[tipo] = opciones.esActiva; oyentes.add(oyente); clave = `compaz_visto_bandeja:${opciones.correo}`
  if (primero) {
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener(EVENTO_PENDIENTES, ahora)
  }
  // Al entrar a la sección (o la primera vez) se cuenta ya; así el punto se quita en cuanto abres la Bandeja, sin esperar el ciclo.
  ahora()
  return () => {
    usos[tipo]--; oyentes.delete(oyente)
    if (usos.bandeja + usos.pagos === 0) {
      document.removeEventListener('visibilitychange', alVolver); window.removeEventListener(EVENTO_PENDIENTES, ahora)
      if (temporizador) clearTimeout(temporizador); temporizador = null
      if (trailing) clearTimeout(trailing); trailing = null
      if (tituloBase !== null) { document.title = tituloBase; tituloBase = null }
      valor.bandeja = null; valor.pagos = null
    }
  }
}

export const leer = (tipo: TipoPendiente) => valor[tipo]

/** Avisa al menú que algo cambió (se resolvió una tarea, se confirmó un pago): vuelve a contar ya, sin esperar el siguiente ciclo. */
export const avisarCambio = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_PENDIENTES)) }
