// Seguimiento por etapas (lógica PURA). Dónde está cada cliente en el proceso y si lleva más tiempo del normal.
import type { Urgencia } from '@/lib/panel-personas-tipos'

/** Las 6 etapas del prototipo aprobado, en el orden de los 6 pasos del portal (PASOS_PORTAL): Elegir, Entrevista, Decidir, Pagar, Ficha, Visitas. */
export const ETAPAS = ['Solicitud', 'Entrevista', 'Decisión', 'Pago', 'Ficha', 'Activo'] as const
export type Etapa = (typeof ETAPAS)[number]
export const etapaDePaso = (paso: number): Etapa => ETAPAS[Math.min(ETAPAS.length - 1, Math.max(0, paso))]

/**
 * Horas SIN movimiento en la etapa a partir de las cuales pasa a amarillo y a rojo. Son los valores POR DEFECTO (prototipo aprobado); los vigentes se
 * cambian en Más, Ajustes del semáforo (ver umbralesDeAjustes). Excepción: "Activo" usa 7 y 14 días, porque un cliente con visitas semanales no se mueve cada 24 horas.
 */
export const UMBRALES: Record<Etapa, [number, number]> = { Solicitud: [6, 24], Entrevista: [1, 3], Decisión: [2, 24], Pago: [2, 12], Ficha: [24, 48], Activo: [168, 336] }

export type Umbrales = Record<Etapa, [number, number]>
const CLAVE_ETAPA: Record<Etapa, string> = { Solicitud: 'solicitud', Entrevista: 'entrevista', Decisión: 'decision', Pago: 'pago', Ficha: 'ficha', Activo: 'activo' }
/** Los umbrales vigentes: los de Ajustes (Más, Ajustes del semáforo); si falta alguno, el de UMBRALES. */
export function umbralesDeAjustes(a: Record<string, unknown>): Umbrales {
  const n = (k: string, por: number) => { const v = Number(a[k]); return Number.isFinite(v) && v > 0 ? v : por }
  return Object.fromEntries(ETAPAS.map((e) => [e, [n(`semaforo_${CLAVE_ETAPA[e]}_amarillo`, UMBRALES[e][0]), n(`semaforo_${CLAVE_ETAPA[e]}_rojo`, UMBRALES[e][1])]])) as Umbrales
}

export function urgenciaDe(etapa: Etapa, horas: number, umbrales: Umbrales = UMBRALES): Urgencia {
  const [am, ro] = umbrales[etapa]
  return horas >= ro ? 'rojo' : horas >= am ? 'amarillo' : 'verde'
}

/** Cómo se llama cada color en Seguimiento (en Compitas el mismo semáforo se llama distinto: ahí no hay etapas). */
export const TEXTO_SEMAFORO: Record<Urgencia, string> = { verde: 'Al día', amarillo: 'Esperando más de lo normal', rojo: 'Atascado' }

export interface FilaSeguimiento { id: string; nombre: string; compitaId: string | null; compita: string | null; etapa: Etapa; horas: number; urgencia: Urgencia; ultimo: string; /** Quién tiene que moverse (lib/panel-caso-tipos.ts). */ espera: 'cliente' | 'compita' | 'equipo' | 'nadie' }

export const POR_PAGINA_SEGUIMIENTO = 25
const ORD: Record<Urgencia, number> = { rojo: 0, amarillo: 1, verde: 2 }

/** Etapa pedida (o Todos), más urgente primero y, dentro de cada color, el que más lleva esperando. Todo viene de la dirección: se sanea. */
export function consultarSeguimiento(todas: FilaSeguimiento[], etapa: unknown, pagina: unknown) {
  const e = (ETAPAS as readonly string[]).includes(String(etapa)) ? (etapa as Etapa) : 'Todos'
  const conteos = Object.fromEntries([['Todos', todas.length], ...ETAPAS.map((x) => [x, todas.filter((f) => f.etapa === x).length])]) as Record<string, number>
  const lista = todas.filter((f) => e === 'Todos' || f.etapa === e).sort((a, b) => ORD[a.urgencia] - ORD[b.urgencia] || b.horas - a.horas || a.nombre.localeCompare(b.nombre))
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA_SEGUIMIENTO))
  const pag = Math.min(Math.max(1, Math.floor(Number(pagina)) || 1), paginas)
  return { etapa: e, conteos, total: lista.length, paginas, pag, fila: lista.slice((pag - 1) * POR_PAGINA_SEGUIMIENTO, pag * POR_PAGINA_SEGUIMIENTO) }
}

/** "hace 3 h" / "hace 2 d". */
export const tiempoEnEtapa = (h: number) => (h < 1 ? 'menos de 1 h' : h < 48 ? `${h} h` : `${Math.round(h / 24)} d`)
