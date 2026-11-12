// Visitas del panel (lógica PURA). Cada regla sale de un dato real: el cron noshow-alerta (30 min), visitas.sin_acceso_en y visitas.rating_cliente.

export type EstadoVisita = 'Por coordinar' | 'Programada' | 'En curso' | 'Terminada' | 'No se presentó' | 'Sin acceso'

export interface FilaVisita {
  id: string; ts: string; estado: EstadoVisita
  clienteId: string; cliente: string; compitaId: string; compita: string; zona: string
  rating: number | null; motivo: string | null
}

/** Lo que se lee de la tabla visitas (con los nombres ya unidos). */
export interface VisitaCruda {
  id: string; estado: string; fecha_programada: string | null; hora_inicio_programada: string | null
  inicio: string | null; fin: string | null; created_at: string; sin_acceso_en: string | null; rating_cliente: number | null
  usuario_id: string; compita_id: string; cliente: string; compita: string; zona: string
}

const MIN30 = 30 * 60_000
/** La hora de la cita se guarda en hora de Venezuela (UTC-4, sin horario de verano). */
const instanteCita = (f: string, h: string): number => new Date(`${f}T${h.slice(0, 8).padEnd(8, ':00')}-04:00`).getTime()

export const diaVE = (t: number | string | Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Caracas' }).format(new Date(t))

export function clasificarVisita(v: VisitaCruda, ahora: number): FilaVisita {
  const cita = v.fecha_programada && v.hora_inicio_programada ? instanteCita(v.fecha_programada, v.hora_inicio_programada) : null
  const citaValida = cita !== null && !Number.isNaN(cita)
  let estado: EstadoVisita, ts: string, motivo: string | null = null
  if (v.sin_acceso_en) { estado = 'Sin acceso'; ts = v.sin_acceso_en; motivo = 'Llegó y nadie abrió: cuenta como usada' }
  else if (v.estado === 'terminada') { estado = 'Terminada'; ts = v.fin ?? v.inicio ?? v.created_at }
  else if (v.estado === 'en_curso' || v.estado === 'confirmando_inicio') { estado = 'En curso'; ts = v.inicio ?? v.created_at }
  else if (citaValida && cita! + MIN30 < ahora) { estado = 'No se presentó'; ts = new Date(cita!).toISOString(); motivo = 'No inició 30 min después de su hora' }
  else if (citaValida) { estado = 'Programada'; ts = new Date(cita!).toISOString() }
  else { estado = 'Por coordinar'; ts = v.created_at }
  const rating = estado === 'Terminada' ? v.rating_cliente : null
  if (rating !== null && rating <= 3) motivo = `El cliente la calificó con ${rating} estrellas`
  return { id: v.id, ts, estado, clienteId: v.usuario_id, cliente: v.cliente, compitaId: v.compita_id, compita: v.compita, zona: v.zona, rating, motivo }
}

export const VISTAS_VISITA: { id: string; t: string; ayuda?: string; desc: boolean; f: (v: FilaVisita, ahora: number) => boolean }[] = [
  { id: 'hoy', t: 'Hoy', ayuda: 'Visitas de hoy, hora de Venezuela.', desc: false, f: (v, a) => diaVE(v.ts) === diaVE(a) },
  { id: 'curso', t: 'En curso', desc: false, f: (v) => v.estado === 'En curso' },
  { id: 'proximas', t: 'Próximas', ayuda: 'Programadas que aún no empiezan y las que todavía no tienen fecha.', desc: false, f: (v) => v.estado === 'Programada' || v.estado === 'Por coordinar' },
  { id: 'terminadas', t: 'Terminadas', desc: true, f: (v) => v.estado === 'Terminada' },
  { id: 'problemas', t: 'Con problema', ayuda: 'No se presentó (30 min tarde), nadie abrió la puerta, o el cliente la calificó con 3 estrellas o menos. Cada fila dice el motivo.', desc: true, f: (v) => v.motivo !== null },
  { id: 'todas', t: 'Todas', desc: true, f: () => true },
]
export const POR_PAGINA_VISITAS = 25

export function consultarVisitas(todas: FilaVisita[], vista: unknown, pagina: unknown, ahora: number) {
  const def = VISTAS_VISITA.find((v) => v.id === vista) ?? VISTAS_VISITA[0]
  const lista = todas.filter((v) => def.f(v, ahora)).sort((a, b) => (def.desc ? -1 : 1) * a.ts.localeCompare(b.ts))
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA_VISITAS))
  const pag = Math.min(Math.max(1, Math.floor(Number(pagina)) || 1), paginas)
  return { vista: def.id, conteos: Object.fromEntries(VISTAS_VISITA.map((v) => [v.id, todas.filter((x) => v.f(x, ahora)).length])) as Record<string, number>, total: lista.length, paginas, pag, fila: lista.slice((pag - 1) * POR_PAGINA_VISITAS, pag * POR_PAGINA_VISITAS) }
}

export function etiquetaVisita(ts: string, ahora: number): string {
  const f = new Date(ts)
  const hora = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: false }).format(f)
  if (diaVE(f) === diaVE(ahora)) return `Hoy ${hora}`
  return `${new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'short', day: 'numeric', month: 'short' }).format(f)} ${hora}`
}

// ── Para qué sirve la pantalla y qué hacer con cada visita ───────────────────────────────────
export const DESCRIPCION_VISITAS = 'Vigila las visitas: cuáles hay hoy, cuáles van en curso y cuáles tuvieron un problema.'
export const INFO_VISITAS = 'Visitas es para vigilar, no para resolver: aquí ves cómo va cada visita. Lo que pide una acción tuya llega como tarea a la Bandeja (por ejemplo, nadie abre la puerta). Toca una fila para ver el detalle de esa visita: su historia, quiénes participan y qué conviene hacer si tuvo un problema. Desde el detalle abres la ficha del cliente, la del compita o el chat.'

/** Qué conviene hacer según cómo va la visita. null si no hay nada que hacer. */
export function queHacerConVisita(v: Pick<FilaVisita, 'estado' | 'rating'>): string | null {
  if (v.estado === 'No se presentó') return 'El compita no inició la visita 30 minutos después de su hora. Escríbele por Telegram (no lo llames). Si no responde, avisa a la familia y ofrécele otra opción.'
  if (v.estado === 'Sin acceso') return 'El compita llegó y nadie abrió. La visita cuenta como usada. Revisa la Bandeja: ahí está la tarea "Nadie abre" si todavía sigue abierta.'
  if (v.rating !== null && v.rating <= 3) return `El cliente la calificó con ${v.rating} estrellas. Lee el chat de esa visita y, si hay algo que corregir, escríbele al compita.`
  if (v.estado === 'En curso') return 'La visita está en marcha. Si algo va mal, el compita o el cliente avisan y llega una tarea a la Bandeja.'
  if (v.estado === 'Por coordinar') return 'Todavía no tiene fecha. El cliente y el compita la coordinan por el chat.'
  return null
}

/** El id de la visita de la dirección (?visita=). Solo un id válido. */
export const leerVisitaUrl = (v: unknown): string | null => (typeof v === 'string' && /^[0-9a-zA-Z-]{8,64}$/.test(v) ? v : null)
