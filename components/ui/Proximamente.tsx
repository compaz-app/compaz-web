import { ETIQUETA_PROXIMAMENTE, SERVICIOS_PROXIMOS, type IdServicioProximo, type ServicioProximo } from '@/lib/servicios-proximos'

// Cómo se ve cada línea que viene (próximamente). Cada una con su acento, dentro de los colores de la marca. Nada aquí se puede usar todavía: son tarjetas
// de información, sin enlaces ni botones que lleven a un flujo que no existe.
const ACENTO: Record<IdServicioProximo, { tarjeta: string; titulo: string; insignia: string; icono: string }> = {
  voluntariado: { tarjeta: 'border-verde-vivo bg-verde-claro', titulo: 'text-verde-oscuro', insignia: 'bg-verde-oscuro text-blanco', icono: 'bg-blanco' },
  mascotas: { tarjeta: 'border-amarillo-marca bg-amarillo-claro', titulo: 'text-ambar-oscuro', insignia: 'bg-ambar-oscuro text-blanco', icono: 'bg-blanco' },
  donar_horas: { tarjeta: 'border-borde-lavanda bg-fondo-lavanda', titulo: 'text-morado-medio', insignia: 'bg-morado-medio text-blanco', icono: 'bg-blanco' },
}

const Insignia = ({ id }: { id: IdServicioProximo }) => (
  <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${ACENTO[id].insignia}`}>{ETIQUETA_PROXIMAMENTE}</span>
)

/** Una tarjeta. `grande` es la de la página principal y el portal (con la descripción completa); la compacta es la del panel. */
export function TarjetaProximamente({ s, grande = true }: { s: ServicioProximo; grande?: boolean }) {
  const a = ACENTO[s.id]
  return (
    <article aria-label={`${s.titulo}, ${ETIQUETA_PROXIMAMENTE.toLowerCase()}`} className={`rounded-2xl border-2 border-dashed ${a.tarjeta} ${grande ? 'p-5' : 'p-3'}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className={`grid shrink-0 place-items-center rounded-2xl shadow-sm ${a.icono} ${grande ? 'h-14 w-14 text-3xl' : 'h-10 w-10 text-xl'}`}>{s.icono}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className={`font-extrabold ${a.titulo} ${grande ? 'text-xl' : 'text-base'}`}>{s.titulo}</h3>
            <Insignia id={s.id} />
          </div>
          <p className={`mt-1 text-texto-medio ${grande ? 'text-base leading-relaxed' : 'text-sm'}`}>{grande ? s.descripcion : s.corto}</p>
        </div>
      </div>
    </article>
  )
}

/** Las tarjetas en rejilla. `ids` elige cuáles (por defecto, todas). */
export function TarjetasProximamente({ ids, grande = true }: { ids?: readonly IdServicioProximo[]; grande?: boolean }) {
  const lista = SERVICIOS_PROXIMOS.filter((s) => !ids || ids.includes(s.id))
  return <div className={`grid gap-3 ${grande ? 'md:grid-cols-2' : 'sm:grid-cols-2'}`}>{lista.map((s) => <TarjetaProximamente key={s.id} s={s} grande={grande} />)}</div>
}

/**
 * Las casillas del registro y del perfil del compita: lo que podrá ofrecer más adelante. Deshabilitadas a propósito: todavía no se activan. Dice qué
 * significará para él (por ejemplo, las preguntas adicionales de las mascotas).
 */
export function OpcionesProximamenteCompita() {
  const ofrecibles = SERVICIOS_PROXIMOS.filter((s) => s.paraCompitas)
  return (
    <fieldset className="rounded-2xl border-2 border-dashed border-borde-lavanda bg-fondo-lavanda p-4">
      <legend className="px-1 text-sm font-extrabold text-morado-medio">Lo que podrás ofrecer más adelante <span className="ml-1 text-xs font-bold text-texto-sutil">({ETIQUETA_PROXIMAMENTE.toLowerCase()})</span></legend>
      <ul className="space-y-3">
        {ofrecibles.map((s) => (
          <li key={s.id} className="flex items-start gap-3">
            <input type="checkbox" disabled aria-label={`${s.titulo}, ${ETIQUETA_PROXIMAMENTE.toLowerCase()}`} className="mt-1 h-4 w-4 shrink-0 opacity-50" />
            <div className="min-w-0 text-sm">
              <p className="font-bold text-texto-oscuro"><span aria-hidden>{s.icono}</span> {s.titulo} <span className="ml-1 rounded-full bg-morado-medio px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-blanco">{ETIQUETA_PROXIMAMENTE}</span></p>
              <p className="mt-0.5 text-texto-medio">{s.paraCompitas}</p>
            </div>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
