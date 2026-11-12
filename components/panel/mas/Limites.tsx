import Link from 'next/link'
import { CLASE_LISTA, clasesChip } from '@/components/panel/ui'
import InfoBoton from '@/components/ui/InfoBoton'
import type { FilaLimite } from '@/lib/esperas-catalogo'

type Enlace = (cambios: Record<string, string | null>) => string
const QUIEN = { compita: 'Compitas', cliente: 'Clientes y visitantes', equipo: 'Equipo' } as const
const FILTROS = [['', 'Todos'], ['compita', 'Compitas'], ['cliente', 'Clientes'], ['equipo', 'Equipo']] as const

// Límites y esperas: lo que el sistema frena a propósito y por qué. Responde "¿por qué no deja hacerlo otra vez?" sin escribirle al desarrollador.
// Los valores y las razones salen del mismo catálogo que usan los mensajes reales, así nunca quedan viejos.
export default function Limites({ filas, quien, enlace }: { filas: FilaLimite[]; quien: string; enlace: Enlace }) {
  const lista = filas.filter((f) => !quien || f.quien === quien)
  return (
    <section className="max-w-3xl space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <InfoBoton que="Qué son los límites y esperas" texto="Cosas que el sistema frena a propósito: plazos entre envíos, máximos y límites de seguridad. Cuando alguien se topa con una, el mensaje que ve le explica lo mismo que lees aquí. Los chips filtran por quién se topa con ella; no cambian ninguna regla." />
        {FILTROS.map(([v, t]) => <Link key={v} href={enlace({ lim: v || null })} aria-pressed={quien === v} className={clasesChip(quien === v)}>{t}</Link>)}
      </div>
      <ul className={CLASE_LISTA}>
        {lista.map((f) => (
          <li key={f.clave} className="px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-bold">{f.limita}</span>
              <span className="shrink-0 rounded bg-gris100 px-1.5 text-[11px] font-bold text-texto-medio">{QUIEN[f.quien]}</span>
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-sm text-texto-medio">{f.valor}</span>
              <InfoBoton que="Por qué existe esta regla" texto={f.porQue} />
            </div>
          </li>
        ))}
        {!lista.length && <li className="p-6 text-center text-texto-sutil">No hay reglas de este tipo.</li>}
      </ul>
    </section>
  )
}
