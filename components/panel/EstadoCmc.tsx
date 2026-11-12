import { TituloBloque } from '@/components/panel/ui'
import Aviso from '@/components/ui/base/Aviso'
import InfoBoton from '@/components/ui/InfoBoton'
import { cuandoLinea } from '@/lib/panel-personas-tipos'
import type { EstadoCmc as Estado } from '@/lib/cmc-estado'

// Bloque "Selección (CMC)" de la ficha de un compita: qué dice el Centro de Mando y qué le falta para recibir solicitudes. Solo lectura.
export default function EstadoCmc({ cmc }: { cmc: Estado }) {
  const faltan = cmc.pasos.filter((p) => !p.listo)
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1">
        <TituloBloque>Selección (CMC)</TituloBloque>
        <InfoBoton que="Qué es esto" texto="El CMC decide si este compita puede tomar clientes nuevos; el panel decide si ya los recibe. Aquí nunca se cambia lo que dice el CMC: si lo retira, no se puede verificar ni activar hasta que el CMC lo habilite de nuevo." />
      </div>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <b className="text-texto-medio">{cmc.codigo}</b>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-extrabold ${cmc.permite ? 'border-verde bg-verde-claro text-verde' : 'border-rojo bg-rojo-claro text-rojo-oscuro'}`}>
          {cmc.permite ? 'El CMC permite' : 'El CMC no permite'}{cmc.estado ? ` · ${cmc.estado}` : ''}
        </span>
        {cmc.actualizado && <span className="text-xs text-texto-sutil">Último cambio: {cuandoLinea(cmc.actualizado)}</span>}
      </p>
      {!cmc.permite && <Aviso tamano="compacto" tono="advertencia">No recibe solicitudes ni asignaciones nuevas, y no se puede verificar ni activar hasta que el CMC lo permita. Lo que ya tiene sigue en pie.</Aviso>}
      {faltan.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {cmc.pasos.map((p) => <li key={p.texto} className={`rounded px-1.5 py-0.5 text-[11px] ${p.listo ? 'bg-fondo-claro text-texto-sutil' : 'bg-amarillo-claro text-ambar-oscuro'}`}>{p.listo ? '✓' : '○'} {p.texto}</li>)}
        </ul>
      )}
    </section>
  )
}
