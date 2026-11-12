// Más: las herramientas que no son del día a día (lógica PURA). Qué hay, quién lo ve y cuáles ya están construidas en el panel nuevo.
import type { ActorVista } from '@/lib/panel-secciones'

export type SubMas = 'resenas' | 'invitar' | 'postulaciones' | 'pagos' | 'avisos' | 'cobertura' | 'umbrales' | 'equipo' | 'ajustes' | 'actividad' | 'limites' | 'manual' | 'registro' | 'estado'

export interface DefMas {
  id: SubMas; icono: string; texto: string; descripcion: string
  /** Quién la ve (el panel viejo y el servidor siguen comprobando lo suyo; esto solo decide qué se muestra). */
  visible: (a: ActorVista) => boolean
  /** true = ya se hace en el panel nuevo; false = por ahora se sigue haciendo en el panel actual. */
  listo: boolean
}

const todos = () => true
const con = (p: keyof ActorVista['permisos']) => (a: ActorVista) => a.rol === 'admin' || a.permisos[p] === true
const soloAdmin = (a: ActorVista) => a.rol === 'admin'

export const HUB: DefMas[] = [
  { id: 'resenas', icono: '⭐', texto: 'Reseñas por aprobar', descripcion: 'Aprueba u oculta lo que el cliente escribe antes de que se vea en el perfil del compita.', visible: con('atender'), listo: true },
  { id: 'invitar', icono: '✉️', texto: 'Invitar', descripcion: 'Suma a un cliente por correo o genera un enlace de registro para un compita.', visible: con('invitar'), listo: true },
  { id: 'postulaciones', icono: '📥', texto: 'Postulaciones y origen (CMC)', descripcion: 'Quién se postuló, desde qué página o campaña llegó y si calificó.', visible: soloAdmin, listo: true },
  { id: 'pagos', icono: '💵', texto: 'Pagos', descripcion: 'Pagos registrados, con la opción de anular uno si hubo un error.', visible: con('pagos'), listo: true },
  { id: 'avisos', icono: '📨', texto: 'Avisos enviados', descripcion: 'Qué se le mandó a cada persona, por qué canal y si llegó. Aquí se reintentan los fallidos.', visible: con('monitorear'), listo: true },
  { id: 'cobertura', icono: '🗺️', texto: 'Cobertura y demanda', descripcion: 'Por zona: compitas disponibles frente a solicitudes del mes. Dónde falta reclutar.', visible: con('monitorear'), listo: true },
  { id: 'umbrales', icono: '🚦', texto: 'Ajustes del semáforo', descripcion: 'Cuántas horas son normales en cada etapa antes de pasar a amarillo y rojo.', visible: (a) => a.rol === 'admin' || a.permisos.ajustes_ver === true || a.permisos.ajustes_editar === true, listo: true },
  { id: 'equipo', icono: '🧑‍🤝‍🧑', texto: 'Equipo y permisos', descripcion: 'Quién entra al panel, con qué rol y qué puede hacer cada uno.', visible: soloAdmin, listo: true },
  { id: 'ajustes', icono: '🎛️', texto: 'Ajustes', descripcion: 'Precios, plazos, topes y umbrales. Se cambian aquí, con registro de quién y cuándo; no hay que tocar el código.', visible: (a) => a.rol === 'admin' || a.permisos.ajustes_ver === true || a.permisos.ajustes_editar === true, listo: true },
  { id: 'actividad', icono: '📜', texto: 'Actividad', descripcion: 'Todo lo que pasó en el sistema, en orden. Aquí no suena nada: se consulta cuando hace falta.', visible: con('monitorear'), listo: true },
  { id: 'limites', icono: '⏳', texto: 'Límites y esperas', descripcion: 'Lo que el sistema frena a propósito (plazos entre envíos, máximos) y por qué. Para responder "¿por qué no deja hacerlo otra vez?".', visible: con('monitorear'), listo: true },
  { id: 'manual', icono: '📖', texto: 'Manual', descripcion: 'Cómo funciona todo el sistema y qué hacer en cada situación. Se busca con tus palabras.', visible: todos, listo: true },
  { id: 'registro', icono: '🗂️', texto: 'Registro de accesos', descripcion: 'Quién del equipo vio un teléfono, un correo o un chat, cuándo y por qué.', visible: con('telefonos'), listo: true },
  { id: 'estado', icono: '🩺', texto: 'Estado del sistema', descripcion: 'Procesos automáticos y avisos fallidos: si algo dejó de funcionar, se ve aquí.', visible: con('monitorear'), listo: true },
]

export const hubVisible = (a: ActorVista): DefMas[] => HUB.filter((h) => h.visible(a))
export const esSubMas = (v: unknown): v is SubMas => typeof v === 'string' && HUB.some((h) => h.id === v)
/** La sub-pantalla pedida si existe y se puede ver; si no, null (se muestra el hub). */
export const subMasActiva = (a: ActorVista, pedida: unknown): DefMas | null => (esSubMas(pedida) ? hubVisible(a).find((h) => h.id === pedida) ?? null : null)

// ── Actividad ───────────────────────────────────────────────────────────────────────────────
export const NIVELES_ACTIVIDAD = [['', 'Todo'], ['urgente', 'Urgentes'], ['tarea', 'Tareas'], ['actividad', 'Informativo']] as const
export const DIAS_ACTIVIDAD = [['1', 'Hoy'], ['2', '2 días'], ['7', '7 días'], ['30', '30 días'], ['90', '90 días']] as const
/** El registro de accesos se guarda más tiempo (1 año por defecto), así que se puede mirar hasta un año atrás. */
export const DIAS_REGISTRO = [['1', 'Hoy'], ['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['365', '1 año']] as const
export const POR_PAGINA_ACTIVIDAD = 50
/** Categorías de actividad que registran quién vio un dato sensible. */
export const CATEGORIAS_ACCESO = ['acceso_contacto', 'acceso_chat'] as const

/** Los filtros de la dirección, saneados. */
export function filtrosActividad(p: { nivel?: unknown; dias?: unknown; q?: unknown; pag?: unknown }, diasPorDefecto = 2) {
  const nivel = p.nivel === 'urgente' || p.nivel === 'tarea' || p.nivel === 'actividad' ? p.nivel : ''
  const d = Math.floor(Number(p.dias)); const dias = Number.isFinite(d) && d >= 1 ? Math.min(1825, d) : diasPorDefecto
  const q = typeof p.q === 'string' ? p.q.trim().slice(0, 100) : ''
  const g = Math.floor(Number(p.pag)); const pagina = Number.isFinite(g) && g >= 0 ? Math.min(1000, g) : 0
  return { nivel: nivel as '' | 'urgente' | 'tarea' | 'actividad', dias, q, pagina }
}

// ── Estado del sistema ──────────────────────────────────────────────────────────────────────
export interface FilaProceso { nombre: string; cadaMin: number; ultimo: string | null; estado: 'ok' | 'caido' | 'sin_registro' }
/** Un proceso automático está caído si pasó más de 3 veces su intervalo sin dar señal (misma regla que la alerta de Telegram). */
export function estadoProceso(cadaMin: number, ultimo: string | null, ahora: number): FilaProceso['estado'] {
  if (!ultimo) return 'sin_registro'
  const t = new Date(ultimo).getTime()
  return Number.isNaN(t) ? 'sin_registro' : ahora - t < cadaMin * 3 * 60_000 ? 'ok' : 'caido'
}

// ── Reseñas, pagos, avisos y cobertura ───────────────────────────────────────────────────────
export interface FilaResena { id: string; estrellas: number; texto: string; publicada: boolean; creada: string; cliente: string; compita: string }
export interface FilaPago { id: string; cliente: string; clienteId: string; plan: string; monto: number; metodo: string; referencia: string | null; creado: string; anulado: boolean; motivo: string | null }
export interface FilaAviso { id: string; creado: string; canal: 'telegram' | 'correo'; para: string; rol: 'cliente' | 'compita' | 'admin'; plantilla: string; estado: 'pendiente' | 'enviado' | 'fallido' | 'cancelado'; error: string | null; intentos: number }
export interface FilaCobertura { estado: string; compitas: number; solicitudes: number; falta: boolean }

export const POR_PAGINA_MAS = 25

/** Una reseña con 3 estrellas o menos se marca para revisarla con más cuidado. */
export const resenaCritica = (r: Pick<FilaResena, 'estrellas'>) => r.estrellas <= 3

/** "pago_confirmado" → "Pago confirmado". */
export const nombreDePlantilla = (p: string) => { const t = p.replace(/_/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1) }

/** Texto de la página pedida: se sanea (viene de la dirección). */
export function paginaDe(v: unknown, total: number, porPagina = POR_PAGINA_MAS) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const n = Math.floor(Number(v))
  const pag = Math.min(paginas, Math.max(1, Number.isFinite(n) ? n : 1))
  return { pag, paginas, desde: (pag - 1) * porPagina, hasta: pag * porPagina }
}

/**
 * Cobertura por estado de Venezuela: compitas que pueden recibir solicitudes (disponibles o con familias) contra solicitudes del último mes de
 * clientes de ese estado. "Falta reclutar" si no hay ningún compita o la demanda duplica a la oferta. Solo salen estados con compitas o con demanda.
 */
export function coberturaPorEstado(compitas: { zona: string; activo: boolean }[], zonasDeSolicitudes: string[], estadosDe: (zona: string) => string[]): FilaCobertura[] {
  const mapa = new Map<string, FilaCobertura>()
  const fila = (e: string) => { let f = mapa.get(e.toLowerCase()); if (!f) { f = { estado: e, compitas: 0, solicitudes: 0, falta: false }; mapa.set(e.toLowerCase(), f) } return f }
  for (const c of compitas) if (c.activo) for (const e of estadosDe(c.zona)) fila(e).compitas++
  for (const z of zonasDeSolicitudes) for (const e of estadosDe(z).slice(0, 1)) fila(e).solicitudes++
  const filas = [...mapa.values()]
  for (const f of filas) f.falta = f.solicitudes > 0 && (f.compitas === 0 || f.solicitudes / f.compitas >= 2)
  return filas.sort((a, b) => Number(b.falta) - Number(a.falta) || b.solicitudes - a.solicitudes || a.estado.localeCompare(b.estado, 'es'))
}

/** Un ajuste con su valor vigente, listo para la pantalla de Ajustes. */
export interface FilaAjuste { clave: string; explica: string; /** false = el sistema aún no lo lee: no se puede cambiar. */ conectado: boolean; grupo: string; etiqueta: string; tipo: 'numero' | 'texto'; valor: number | string; defecto: number | string; unidad: string | null; min: number | null; max: number | null; usa: string[]; propuesto: boolean }
