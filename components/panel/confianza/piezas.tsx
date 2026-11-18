import InfoBoton from '@/components/ui/InfoBoton'
import IconoCmc from '@/components/panel/confianza/iconos'
import { MADUREZ_TEXTO, type Madurez } from '@/lib/confianza/reglas'

// Piezas visuales del CMC (las comparten la vista operativa y la demostración).
// Paleta propia del módulo (tokens cf-* de lib/design.ts): fondo blanco, morado como acento y color solo cuando indica un estado.

/** Clases para dar a los botones base (Boton) el color del módulo sin tocar el componente global. */
export const BOTON_CF = {
  principal: 'bg-cf-morado! text-blanco! hover:bg-cf-morado-hover!',
  secundario: 'border-cf-borde! bg-blanco! text-cf-morado! hover:bg-cf-lateral!',
  suave: 'text-cf-texto-suave! hover:bg-cf-lateral!',
} as const

/** Lista del módulo: filas separadas por una línea fina, sin caja pesada alrededor. */
export const LISTA_CF = 'divide-y divide-cf-borde overflow-hidden rounded-xl border border-cf-borde bg-blanco shadow-sm'

const TONO_MADUREZ: Record<Madurez, string> = {
  comprobado: 'text-verde-oscuro',
  simulado: 'text-ambar-oscuro',
  pendiente: 'text-cf-texto-suave',
}
const PUNTO_MADUREZ: Record<Madurez, string> = { comprobado: 'bg-verde-vivo', simulado: 'bg-amarillo', pendiente: 'bg-gris400' }

/** Dice si algo está comprobado en la operación, es simulado o falta validarlo. Lleva texto: nunca depende solo del color. */
export function EtiquetaMadurez({ madurez, corta = false }: { madurez: Madurez; corta?: boolean }) {
  const texto = corta ? { comprobado: 'Comprobado', simulado: 'Simulado', pendiente: 'Pendiente' }[madurez] : MADUREZ_TEXTO[madurez]
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ${TONO_MADUREZ[madurez]}`}><span aria-hidden className={`h-1.5 w-1.5 rounded-full ${PUNTO_MADUREZ[madurez]}`} />{texto}</span>
}

/** Banda única de indicadores (referencia aprobada): una superficie gris muy clara con columnas y separadores casi imperceptibles. */
export const BANDA_CF = 'grid grid-cols-1 divide-y divide-cf-borde rounded-xl bg-cf-lateral min-[480px]:grid-cols-2 min-[480px]:divide-y-0 lg:grid-cols-4 lg:divide-x'

const TONO_ICONO = { neutro: 'bg-cf-cabecera text-cf-texto-suave', exito: 'bg-verde-claro text-verde-oscuro', atencion: 'bg-amarillo-claro text-ambar-oscuro' } as const

/** Un indicador de la banda: icono en un círculo suave, número grande, nombre con su ⓘ y una línea de qué cuenta. El color va en el icono, no en el número. */
export function Cifra({ valor, texto, detalle, info, icono, tono = 'neutro' }: { valor: number | string; texto: string; detalle?: string; info: string; icono: 'personas' | 'reloj' | 'check' | 'alerta'; tono?: keyof typeof TONO_ICONO }) {
  return (
    <div className="flex items-start gap-3 px-4 py-4 xl:gap-4 xl:px-5">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full xl:h-12 xl:w-12 ${TONO_ICONO[tono]}`}><IconoCmc nombre={icono} className="h-6 w-6" /></span>
      <div className="min-w-0">
        <div className="text-3xl font-extrabold leading-none tabular-nums text-cf-texto">{valor}</div>
        <div className="mt-1.5 flex items-center gap-1 whitespace-nowrap text-base font-bold text-cf-texto">{texto}<InfoBoton que={texto} texto={info} /></div>
        {detalle && <div className="text-sm text-cf-texto-suave">{detalle}</div>}
      </div>
    </div>
  )
}

/** Etapa de selección: texto con un punto de color discreto. */
export function EtiquetaEtapa({ etapa }: { etapa: string }) {
  const punto = etapa === 'En operación' || etapa === 'Habilitado' ? 'bg-verde-vivo' : etapa === 'Descartado' ? 'bg-gris400' : 'bg-cf-morado'
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm ${etapa === 'Descartado' ? 'text-cf-texto-suave' : 'text-cf-texto'}`}><span aria-hidden className={`h-2 w-2 rounded-full ${punto}`} />{etapa}</span>
}

export type Atencion = 'accion' | 'bloqueado' | 'al-dia' | 'cerrado' | 'excluido'
const ATENCION: Record<Atencion, [string, string]> = {
  accion: ['Requiere acción', 'bg-amarillo-claro text-ambar-oscuro'],
  bloqueado: ['Bloqueado', 'bg-rojo-claro text-rojo-oscuro'],
  'al-dia': ['Al día', 'bg-verde-claro text-verde-oscuro'],
  cerrado: ['Cerrado', 'text-cf-texto-suave'],
  excluido: ['No cuenta', 'text-cf-texto-suave'],
}
/** Estado de atención: solo lo que pide acción lleva fondo de color; el resto es texto. */
export function EtiquetaAtencion({ estado }: { estado: Atencion }) {
  const [texto, clase] = ATENCION[estado]
  return <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-sm font-semibold ${clase}`}>{texto}</span>
}

/** Sección del módulo con título y, opcionalmente, algo a la derecha. Borde fino, sin sombra. */
export function TarjetaCf({ titulo, extra, children, className = '' }: { titulo?: React.ReactNode; extra?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`space-y-3 rounded-xl border border-cf-borde bg-blanco p-4 ${className}`}>
      {(titulo || extra) && <div className="flex flex-wrap items-center justify-between gap-2">{titulo && <h3 className="text-base font-extrabold text-cf-texto">{titulo}</h3>}{extra}</div>}
      {children}
    </section>
  )
}

/** Marca de requisito: hecho, pendiente, bloqueado o a revisar. */
export function Marca({ estado }: { estado: 'hecho' | 'pendiente' | 'bloqueo' | 'aviso' }) {
  const m = { hecho: ['✓', 'bg-verde-claro text-verde-oscuro'], pendiente: ['○', 'bg-cf-lateral text-cf-texto-suave ring-1 ring-cf-borde'], bloqueo: ['✕', 'bg-rojo-claro text-rojo-oscuro'], aviso: ['!', 'bg-amarillo-claro text-ambar-oscuro'] }[estado]
  return <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${m[1]}`}>{m[0]}</span>
}
