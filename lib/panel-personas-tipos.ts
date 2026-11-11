// Personas del panel nuevo: lógica PURA (sin base de datos) que comparten el servidor y la pantalla.
// Compitas: tabla con estado, calificación, respuesta y cancelaciones. Clientes: lista simple. Ficha: línea de tiempo y contacto con motivo.

export type EstadoCompita = 'Disponible' | 'Con cupo' | 'En pausa' | 'Nuevo'
export type Urgencia = 'verde' | 'amarillo' | 'rojo'

export interface FilaCompita {
  id: string; nombre: string; zona: string; estado: EstadoCompita
  /** Familias que atiende ahora. */ activos: number
  /** Visitas de los últimos 30 días. */ visitas: number
  /** Promedio 1 a 5 (0 = sin calificaciones). */ rating: number
  /** % de solicitudes respondidas en 30 días (null = no recibió ninguna). */ respuesta: number | null
  /** Horas desde que respondió o hizo una visita (null = nunca). */ inactivoH: number | null
  /** Cancelaciones del compita en 30 días. */ canc: number
  /** Las tardías que no están justificadas (las que cuentan en su contra). */ tardias: number
}

export interface FilaCliente { id: string; nombre: string; zona: string; compita: string | null; plan: string | null; alta: string; bloqueado: boolean }

export type TipoPersona = 'compita' | 'cliente'
export interface EventoLinea { cuando: string; texto: string }
export interface FichaPersona {
  tipo: TipoPersona; id: string; nombre: string; zona: string
  /** Cliente: paso en el que está (Elegir, Entrevista...). */ etapa?: string
  /** Cliente: nombre de su compita. */ compita?: string | null
  /** Cliente: id de su compita (para abrir el chat entre ambos). */ compitaId?: string | null
  /** Hay contacto guardado (el valor NO viaja: se pide aparte, con motivo). */ contacto: { correo: boolean; telefono: boolean }
  linea: EventoLinea[]
  /** Notas internas del equipo, la más nueva primero. */ notas: NotaPersona[]
  /** Solo compitas. */ canc?: { total: number; tardias: number; cuentanContra: number; nivel: 'normal' | 'revision' | 'pausa' }
}

// ── Urgencia y vistas de compitas ─────────────────────────────────────────────
export function urgCompita(s: FilaCompita): Urgencia {
  if (s.estado === 'Nuevo' || s.estado === 'En pausa') return 'verde'
  if ((s.respuesta !== null && s.respuesta < 50) || (s.rating > 0 && s.rating < 4) || (s.inactivoH !== null && s.inactivoH > 72) || s.tardias >= 3) return 'rojo'
  if ((s.respuesta !== null && s.respuesta < 75) || (s.inactivoH !== null && s.inactivoH > 24) || s.tardias >= 2) return 'amarillo'
  return 'verde'
}
export const ORD_URG: Record<Urgencia, number> = { rojo: 0, amarillo: 1, verde: 2 }

export const VISTAS_COMPITA: { id: string; t: string; ayuda?: string; f: (s: FilaCompita) => boolean }[] = [
  { id: 'todas', t: 'Todos', f: () => true },
  { id: 'disponibles', t: 'Disponibles', ayuda: 'Compitas activos sin ninguna familia asignada ahora.', f: (s) => s.estado === 'Disponible' },
  { id: 'cupo', t: 'Con familias', ayuda: 'Compitas activos que ya atienden al menos una familia.', f: (s) => s.estado === 'Con cupo' },
  { id: 'sinrespuesta', t: 'Sin respuesta 24h', ayuda: 'Compitas activos que llevan 24 horas o más sin responder una solicitud ni hacer una visita.', f: (s) => s.estado !== 'En pausa' && s.estado !== 'Nuevo' && s.inactivoH !== null && s.inactivoH >= 24 },
  { id: 'cancel', t: 'Cancelaciones tardías', ayuda: 'Compitas que en los últimos 30 días cancelaron con poco aviso. Las justificadas (enfermedad, emergencia) no cuentan.', f: (s) => s.tardias >= 1 },
  { id: 'pausa', t: 'En pausa', ayuda: 'Compitas pausados por cancelaciones, por compartir contactos o desactivados.', f: (s) => s.estado === 'En pausa' },
  { id: 'nuevas', t: 'Nuevos sin verificar', ayuda: 'Compitas ya registrados que el equipo aún no ha verificado.', f: (s) => s.estado === 'Nuevo' },
]

export type ColumnaCompita = 'nombre' | 'zona' | 'estado' | 'activos' | 'visitas' | 'rating' | 'respuesta' | 'canc' | 'inactivo'
export const COLUMNAS_COMPITA: { id: ColumnaCompita; t: string; ayuda?: string; clase: string; v: (p: FilaCompita) => number | string }[] = [
  { id: 'nombre', t: 'Nombre', clase: '', v: (p) => p.nombre },
  { id: 'zona', t: 'Zona', ayuda: 'Zona donde atiende.', clase: 'hidden @2xl:table-cell', v: (p) => p.zona },
  { id: 'estado', t: 'Estado', ayuda: 'Disponible o con familias: puede recibir solicitudes. En pausa: no las recibe. Nuevo: falta verificarlo.', clase: 'hidden @lg:table-cell', v: (p) => p.estado },
  { id: 'activos', t: 'Familias', ayuda: 'Familias que atiende ahora.', clase: 'hidden @4xl:table-cell', v: (p) => p.activos },
  { id: 'visitas', t: 'Visitas', ayuda: 'Visitas de los últimos 30 días.', clase: 'hidden @4xl:table-cell', v: (p) => p.visitas },
  { id: 'rating', t: '★', ayuda: 'Calificación promedio de las familias, de 1 a 5. Menos de 4 pasa a rojo.', clase: '', v: (p) => p.rating },
  { id: 'respuesta', t: 'Resp.', ayuda: 'Solicitudes respondidas de las recibidas en 30 días. Menos de 75% pasa a amarillo y menos de 50% a rojo.', clase: 'hidden @lg:table-cell', v: (p) => p.respuesta ?? -1 },
  { id: 'canc', t: 'Cancel.', ayuda: 'Cancelaciones del compita en 30 días y, entre paréntesis, las tardías sin justificar.', clase: 'hidden @2xl:table-cell', v: (p) => p.tardias * 100 + p.canc },
  { id: 'inactivo', t: 'Inactivo', ayuda: 'Horas desde su última respuesta o visita. Más de 24 pasa a amarillo y más de 72 a rojo.', clase: 'hidden @4xl:table-cell', v: (p) => p.inactivoH ?? 9999 },
]

/** El punto de la tabla: nuevo o en pausa no se evalúan (gris), el resto sale de urgCompita. */
export const puntoCompita = (p: FilaCompita): Urgencia | 'neutro' => (p.estado === 'Nuevo' || p.estado === 'En pausa' ? 'neutro' : urgCompita(p))

export const LEYENDA_COMPITA = 'Rojo (revisar): respondió menos del 50%, calificación menor a 4, más de 72 horas sin actividad o 3 cancelaciones tardías. Amarillo (atención): respondió menos del 75%, más de 24 horas sin actividad o 2 cancelaciones tardías. Verde: nada de lo anterior. Gris: nuevo o en pausa, no se evalúa.'

export const POR_PAGINA_PERSONAS = 25

export interface ConsultaCompitas { q: string; vista: string; orden: string; dir: string; pag: unknown; estado?: string }

/** El estado de Venezuela de cada zona guardada. Una zona es "Estado — Municipio" y un compita puede cubrir varias separadas por coma. */
export function estadosDeZona(zona: string | null | undefined): string[] {
  const salida: string[] = []
  for (const parte of String(zona ?? '').split(',')) {
    const e = parte.split(/\s[—–-]\s/)[0].trim()
    if (e && !/^sin zona$/i.test(e) && !salida.includes(e)) salida.push(e)
  }
  return salida
}
const clave = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const coincideEstado = (zona: string, estado: string) => estadosDeZona(zona).some((e) => clave(e) === clave(estado))

/** Estados que SÍ tienen gente en esta lista (con cuántos), en orden alfabético. Los estados vacíos no aparecen. */
export function estadosConGente(zonas: string[]): { estado: string; n: number }[] {
  const m = new Map<string, { estado: string; n: number }>()
  for (const z of zonas) for (const e of estadosDeZona(z)) { const k = clave(e); const x = m.get(k); if (x) x.n++; else m.set(k, { estado: e, n: 1 }) }
  return [...m.values()].sort((a, b) => a.estado.localeCompare(b.estado, 'es'))
}
/** El estado pedido solo vale si hay gente ahí; si no, se ignora (así nunca queda una lista vacía por un filtro que ya no existe). */
const estadoValido = (opciones: { estado: string }[], pedido: unknown) => opciones.find((o) => typeof pedido === 'string' && clave(o.estado) === clave(pedido))?.estado ?? ''

/** Filtra, ordena y pagina. Todo viene de la dirección, así que se sanea: lo desconocido cae en el valor por defecto. */
export function consultarCompitas(todas: FilaCompita[], c: ConsultaCompitas) {
  const q = c.q.trim().toLowerCase()
  const buscadas = todas.filter((p) => !q || `${p.nombre} ${p.zona}`.toLowerCase().includes(q))
  const vista = VISTAS_COMPITA.find((v) => v.id === c.vista) ?? VISTAS_COMPITA[0]
  // Los estados que se ofrecen salen de lo que ya está filtrado por búsqueda y vista: solo estados donde hay compitas así.
  const estados = estadosConGente(buscadas.filter(vista.f).map((p) => p.zona))
  const estado = estadoValido(estados, c.estado)
  const enEstado = estado ? buscadas.filter((p) => coincideEstado(p.zona, estado)) : buscadas
  const col = COLUMNAS_COMPITA.find((x) => x.id === c.orden)
  const sgn = c.dir === 'desc' ? -1 : 1
  const filtradas = enEstado.filter(vista.f).sort((a, b) => {
    if (!col) return (ORD_URG[urgCompita(a)] - ORD_URG[urgCompita(b)]) || ((b.inactivoH ?? 0) - (a.inactivoH ?? 0)) || a.nombre.localeCompare(b.nombre)
    const x = col.v(a), y = col.v(b)
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sgn
  })
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA_PERSONAS))
  const pag = Math.min(Math.max(1, Math.floor(Number(c.pag)) || 1), paginas)
  return { vista, estados, estado, conteos: Object.fromEntries(VISTAS_COMPITA.map((v) => [v.id, enEstado.filter(v.f).length])) as Record<string, number>, total: filtradas.length, paginas, pag, fila: filtradas.slice((pag - 1) * POR_PAGINA_PERSONAS, pag * POR_PAGINA_PERSONAS) }
}

export function consultarClientes(todos: FilaCliente[], q: string, pagina: unknown, estadoPedido?: string) {
  const t = q.trim().toLowerCase()
  const buscados = todos.filter((c) => !t || `${c.nombre} ${c.zona} ${c.compita ?? ''}`.toLowerCase().includes(t))
  const estados = estadosConGente(buscados.map((c) => c.zona))
  const estado = estadoValido(estados, estadoPedido)
  const l = estado ? buscados.filter((c) => coincideEstado(c.zona, estado)) : buscados
  const paginas = Math.max(1, Math.ceil(l.length / POR_PAGINA_PERSONAS))
  const pag = Math.min(Math.max(1, Math.floor(Number(pagina)) || 1), paginas)
  return { total: l.length, paginas, pag, estados, estado, fila: l.slice((pag - 1) * POR_PAGINA_PERSONAS, pag * POR_PAGINA_PERSONAS) }
}

/** "<cliente>:<compita>" de la dirección para abrir el chat. null si no son dos ids válidos. */
export function leerChatUrl(v: unknown): { clienteId: string; compitaId: string } | null {
  if (typeof v !== 'string') return null
  const [clienteId, compitaId, resto] = v.split(':')
  const ok = (x: unknown) => typeof x === 'string' && /^[0-9a-zA-Z-]{8,64}$/.test(x)
  return resto === undefined && ok(clienteId) && ok(compitaId) ? { clienteId, compitaId } : null
}

/** De quién se puede pedir un contacto: una persona, o el contacto en el sitio de una visita. */
export type TipoContacto = TipoPersona | 'visita'
export const esTipoContacto = (v: unknown): v is TipoContacto => v === 'compita' || v === 'cliente' || v === 'visita'
export const esTipoPersona = (v: unknown): v is TipoPersona => v === 'compita' || v === 'cliente'
/** "compita:<id>" o "cliente:<id>" de la dirección. Devuelve null si no es válido (el id solo puede llevar letras, números y guion). */
export function leerPersonaUrl(v: unknown): { tipo: TipoPersona; id: string } | null {
  if (typeof v !== 'string') return null
  const [tipo, id] = v.split(':')
  return esTipoPersona(tipo) && /^[0-9a-zA-Z-]{8,64}$/.test(id ?? '') ? { tipo, id } : null
}

// ── Contacto con motivo ───────────────────────────────────────────────────────
export const MOTIVOS_CONTACTO = ['Reclamo del cliente', 'Alerta de contacto compartido', 'Revisión de calidad de la visita', 'Otro (explicar)'] as const
export const MOTIVO_OTRO = MOTIVOS_CONTACTO[3]
export const CANALES = ['correo', 'telefono', 'whatsapp'] as const
export type CanalContacto = (typeof CANALES)[number]
export const SIN_MOTIVO_ADMIN = 'Sin motivo requerido (administrador)'

/** Motivo ya armado: uno de la lista, o "Otro: <explicación de 5 a 300 letras>". null si no sirve. */
export function motivoValido(m: unknown): string | null {
  if (typeof m !== 'string') return null
  const t = m.trim()
  if ((MOTIVOS_CONTACTO as readonly string[]).includes(t) && t !== MOTIVO_OTRO) return t
  const otro = /^Otro: ([\s\S]{5,300})$/.exec(t)
  return otro ? `Otro: ${otro[1].trim()}` : null
}
export const armarMotivo = (elegido: string, detalle: string) => (elegido === MOTIVO_OTRO ? `Otro: ${detalle.trim()}` : elegido)

export const ETIQUETA_CANAL: Record<CanalContacto, string> = { correo: 'el correo', telefono: 'el teléfono', whatsapp: 'el WhatsApp' }
export const INFO_CONTACTO = 'Muestra el dato de contacto y lo abre si hace falta. Es un dato sensible: si no eres administrador te pide un motivo, y queda anotado en Actividad junto con tu nombre. Compaz no guarda la conversación.'

/** Solo dígitos y con el + inicial quitado, para el enlace de WhatsApp. */
export const digitosWhatsapp = (tel: string) => tel.replace(/\D/g, '')

/** "10 nov, 9:41" en hora de Caracas (la de quien opera el panel). */
export function cuandoLinea(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(d)
}

// ── Notas internas ────────────────────────────────────────────────────────────
export interface NotaPersona { id: string; texto: string; autor: string; creado_en: string }
export const MAX_NOTA = 1000
/** Texto de la nota ya recortado, o null si está vacío o es demasiado largo. */
export function notaValida(t: unknown): string | null {
  if (typeof t !== 'string') return null
  const x = t.trim()
  return x.length >= 1 && x.length <= MAX_NOTA ? x : null
}

/** Dirección de la ficha de una persona (desde la Bandeja u otra pantalla). Solo clientes y compitas tienen ficha. */
export function hrefPersona(tipo: string, id: string, comoColaborador = false): string | null {
  if ((tipo !== 'cliente' && tipo !== 'compita') || !leerPersonaUrl(`${tipo}:${id}`)) return null
  const q = new URLSearchParams({ sec: 'personas', lista: tipo === 'cliente' ? 'clientes' : 'compitas', persona: `${tipo}:${id}`, ...(comoColaborador ? { como: 'colaborador' } : {}) })
  return `/panel?${q.toString()}`
}

/** Un mensaje del chat entre cliente y compita, como lo ve el equipo. */
export interface MensajePanel { de: 'Cliente' | 'Compita' | 'Compaz'; texto: string; cuando: string; esFoto: boolean }

/** Para qué sirve Personas: la frase corta que se ve siempre y la explicación detrás del ⓘ. */
export const DESCRIPCION_PERSONAS = 'Encuentra a cualquier compita o cliente, mira cómo va y abre su ficha.'
export const INFO_PERSONAS = 'Personas es el directorio del equipo. Compitas: quién puede recibir solicitudes, quién no responde o cancela tarde, y quién está en pausa; los colores te dicen a quién revisar primero. Clientes: todas las familias registradas. Toca a una persona para abrir su ficha: su historial, notas internas, contacto (con motivo si no eres administrador) y el chat con su compita o su cliente. Aquí no se cambia nada por accidente: abrir una ficha solo consulta.'
