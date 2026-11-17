import InfoBoton from '@/components/ui/InfoBoton'
import { MADUREZ_TEXTO, type Madurez } from '@/lib/confianza/reglas'

// Piezas pequeñas del Sistema de Confianza (las comparten la vista operativa y la demostración).

const TONO_MADUREZ: Record<Madurez, string> = {
  comprobado: 'border-verde-vivo bg-verde-claro text-verde-oscuro',
  simulado: 'border-amarillo-marca bg-amarillo-claro text-ambar-oscuro',
  pendiente: 'border-borde bg-gris100 text-texto-medio',
}
const MARCA: Record<Madurez, string> = { comprobado: '✓', simulado: '◇', pendiente: '○' }

/** Etiqueta que dice si algo está comprobado en la operación, es simulado o falta validarlo. Lleva texto: nunca depende solo del color. */
export function EtiquetaMadurez({ madurez, corta = false }: { madurez: Madurez; corta?: boolean }) {
  const texto = corta ? { comprobado: 'Comprobado', simulado: 'Simulado', pendiente: 'Pendiente' }[madurez] : MADUREZ_TEXTO[madurez]
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 text-[11px] font-bold ${TONO_MADUREZ[madurez]}`}><span aria-hidden>{MARCA[madurez]}</span>{texto}</span>
}

/** Un indicador: número grande, nombre y, detrás del ⓘ, de dónde sale. */
export function Cifra({ valor, texto, info, alerta = false }: { valor: number | string; texto: string; info: string; alerta?: boolean }) {
  return (
    <div className={`rounded-xl border bg-blanco p-3 ${alerta ? 'border-naranja' : 'border-borde'}`}>
      <div className={`text-2xl font-extrabold leading-none ${alerta ? 'text-naranja-oscuro' : 'text-morado-profundo'}`}>{valor}</div>
      <div className="mt-1 flex items-center gap-1 text-sm font-bold text-texto-medio">{texto}<InfoBoton que={texto} texto={info} /></div>
    </div>
  )
}

/** Etapa de selección como etiqueta neutra con su posición (1 de 5). */
export function EtiquetaEtapa({ etapa }: { etapa: string }) {
  const tono = etapa === 'Habilitado' ? 'bg-verde-claro text-verde-oscuro' : etapa === 'Descartado' ? 'bg-gris100 text-texto-sutil' : 'bg-fondo-lavanda text-morado-claro'
  return <span className={`inline-flex whitespace-nowrap rounded px-1.5 text-xs font-bold ${tono}`}>{etapa}</span>
}
