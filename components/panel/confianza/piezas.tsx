import InfoBoton from '@/components/ui/InfoBoton'
import { MADUREZ_TEXTO, type Madurez } from '@/lib/confianza/reglas'

// Piezas visuales del Sistema de Confianza (las comparten la vista operativa y la demostración).
// Paleta propia del módulo (tokens cf-* de lib/design.ts): no se usan fuera de components/panel/confianza.

/** Clases para dar a los botones base (Boton) el color del módulo sin tocar el componente global. */
export const BOTON_CF = {
  principal: 'bg-cf-morado! text-blanco! hover:bg-cf-morado-hover!',
  secundario: 'border-cf-morado! text-cf-morado! hover:bg-cf-lavanda-suave!',
  suave: 'text-cf-texto-suave! hover:bg-cf-lateral!',
} as const

/** Contenedor de lista del módulo (filas separadas por una línea fina). */
export const LISTA_CF = 'divide-y divide-cf-borde overflow-hidden rounded-2xl border border-cf-borde bg-blanco'

const TONO_MADUREZ: Record<Madurez, string> = {
  comprobado: 'border-verde-vivo/40 bg-verde-claro text-verde-oscuro',
  simulado: 'border-amarillo-marca/60 bg-amarillo-claro text-ambar-oscuro',
  pendiente: 'border-cf-borde bg-cf-lateral text-cf-texto-suave',
}
const MARCA: Record<Madurez, string> = { comprobado: '✓', simulado: '◇', pendiente: '○' }

/** Dice si algo está comprobado en la operación, es simulado o falta validarlo. Lleva texto: nunca depende solo del color. */
export function EtiquetaMadurez({ madurez, corta = false }: { madurez: Madurez; corta?: boolean }) {
  const texto = corta ? { comprobado: 'Comprobado', simulado: 'Simulado', pendiente: 'Pendiente' }[madurez] : MADUREZ_TEXTO[madurez]
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-px text-[11px] font-bold ${TONO_MADUREZ[madurez]}`}><span aria-hidden>{MARCA[madurez]}</span>{texto}</span>
}

/** Un indicador: número grande, nombre, una línea de qué cuenta y, detrás del ⓘ, de dónde sale. */
export function Cifra({ valor, texto, detalle, info, tono = 'neutro' }: { valor: number | string; texto: string; detalle?: string; info: string; tono?: 'neutro' | 'atencion' | 'exito' }) {
  const color = tono === 'atencion' ? 'text-ambar-oscuro' : tono === 'exito' ? 'text-verde-oscuro' : 'text-cf-texto'
  return (
    <div className={`rounded-2xl border bg-blanco px-4 py-3 ${tono === 'atencion' ? 'border-amarillo-marca' : 'border-cf-borde'}`}>
      <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-cf-texto-suave">{texto}<InfoBoton que={texto} texto={info} /></div>
      <div className={`mt-1 text-3xl font-extrabold leading-none tabular-nums ${color}`}>{valor}</div>
      {detalle && <div className="mt-1 text-xs text-cf-texto-suave">{detalle}</div>}
    </div>
  )
}

/** Etapa de selección como etiqueta. */
export function EtiquetaEtapa({ etapa }: { etapa: string }) {
  const tono = etapa === 'Habilitado' ? 'bg-verde-claro text-verde-oscuro' : etapa === 'Descartado' ? 'bg-cf-lateral text-cf-texto-suave line-through decoration-1' : 'bg-cf-lavanda text-cf-morado'
  return <span className={`inline-flex whitespace-nowrap rounded-md px-1.5 py-px text-xs font-bold ${tono}`}>{etapa}</span>
}

export type Atencion = 'accion' | 'bloqueado' | 'al-dia' | 'cerrado' | 'excluido'
const ATENCION: Record<Atencion, [string, string]> = {
  accion: ['Requiere acción', 'bg-amarillo-claro text-ambar-oscuro'],
  bloqueado: ['Bloqueado', 'bg-rojo-claro text-rojo-oscuro'],
  'al-dia': ['Al día', 'bg-verde-claro text-verde-oscuro'],
  cerrado: ['Cerrado', 'bg-cf-lateral text-cf-texto-suave'],
  excluido: ['No cuenta', 'bg-cf-lateral text-cf-texto-suave'],
}
/** Estado de atención de una fila (texto + color discreto). */
export function EtiquetaAtencion({ estado }: { estado: Atencion }) {
  const [texto, clase] = ATENCION[estado]
  return <span className={`inline-flex whitespace-nowrap rounded-md px-1.5 py-px text-xs font-bold ${clase}`}>{texto}</span>
}

/** Tarjeta del módulo con título y, opcionalmente, una etiqueta a la derecha. */
export function TarjetaCf({ titulo, extra, children, className = '' }: { titulo?: React.ReactNode; extra?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`space-y-3 rounded-2xl border border-cf-borde bg-blanco p-4 ${className}`}>
      {(titulo || extra) && <div className="flex flex-wrap items-center justify-between gap-2">{titulo && <h3 className="text-sm font-extrabold text-cf-texto">{titulo}</h3>}{extra}</div>}
      {children}
    </section>
  )
}

/** Marca de requisito: hecho, pendiente o bloqueado. */
export function Marca({ estado }: { estado: 'hecho' | 'pendiente' | 'bloqueo' | 'aviso' }) {
  const m = { hecho: ['✓', 'bg-verde-claro text-verde-oscuro'], pendiente: ['○', 'bg-cf-lateral text-cf-texto-suave'], bloqueo: ['✕', 'bg-rojo-claro text-rojo-oscuro'], aviso: ['!', 'bg-amarillo-claro text-ambar-oscuro'] }[estado]
  return <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${m[1]}`}>{m[0]}</span>
}
