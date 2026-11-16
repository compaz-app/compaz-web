import { ETIQUETA_PROXIMAMENTE, SERVICIOS_PROXIMOS, type IdServicioProximo, type ServicioProximo } from '@/lib/servicios-proximos'

// Cómo se ve cada línea que viene (próximamente). Cada una con su acento, dentro de los colores de la marca. Nada aquí se puede usar todavía: son tarjetas
// de información, sin enlaces ni botones que lleven a un flujo que no existe.
const ACENTO: Record<IdServicioProximo, { tarjeta: string; titulo: string; insignia: string; icono: string }> = {
  voluntariado: { tarjeta: 'border-verde-vivo bg-verde-claro', titulo: 'text-verde-oscuro', insignia: 'bg-verde-oscuro text-blanco', icono: 'bg-blanco' },
  mascotas: { tarjeta: 'border-amarillo-marca bg-amarillo-claro', titulo: 'text-ambar-oscuro', insignia: 'bg-ambar-oscuro text-blanco', icono: 'bg-blanco' },
  donar_horas: { tarjeta: 'border-borde-lavanda bg-fondo-lavanda', titulo: 'text-morado-medio', insignia: 'bg-morado-medio text-blanco', icono: 'bg-blanco' },
}

/** Iconos de línea (sin emojis), del color del texto de cada tarjeta. */
function Icono({ nombre, className }: { nombre: ServicioProximo['icono']; className?: string }) {
  const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...trazo}>
      {nombre === 'corazon' && <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.5 2.5c0 5.6-7.5 10.2-7.5 10.2Z" />}
      {nombre === 'huella' && (<><circle cx="6.5" cy="11" r="1.8" /><circle cx="10" cy="6.8" r="1.8" /><circle cx="14" cy="6.8" r="1.8" /><circle cx="17.5" cy="11" r="1.8" /><path d="M12 12.5c-2.6 0-5 2.6-5 4.6 0 1.5 1.2 2.4 2.6 2.4 .9 0 1.6-.4 2.4-.4s1.5.4 2.4.4c1.4 0 2.6-.9 2.6-2.4 0-2-2.4-4.6-5-4.6Z" /></>)}
      {nombre === 'regalo' && (<><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M3 9h18M12 9v11M12 9c-1.5-3.5-5-4-5-1.8C7 8.6 8.6 9 12 9Zm0 0c1.5-3.5 5-4 5-1.8C17 8.6 15.4 9 12 9Z" /></>)}
    </svg>
  )
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
        <span aria-hidden className={`grid shrink-0 place-items-center rounded-2xl shadow-sm ${a.icono} ${a.titulo} ${grande ? 'h-14 w-14' : 'h-10 w-10'}`}><Icono nombre={s.icono} className={grande ? 'h-8 w-8' : 'h-6 w-6'} /></span>
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

const alternar = (valor: readonly string[], id: string) => (valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id])

/**
 * Las casillas del registro y del perfil del compita: lo que podrá ofrecer más adelante. Marcarlas solo guarda su interés (no activa nada todavía):
 * el equipo lo usa para avisarle cuando la línea abra. Mascotas tiene su propia sección (SeccionCuidadorMascotas).
 */
export function OpcionesProximamenteCompita({ valor, onChange }: { valor: readonly string[]; onChange: (v: string[]) => void }) {
  const ofrecibles = SERVICIOS_PROXIMOS.filter((s) => s.paraCompitas && s.id !== 'mascotas')
  return (
    <fieldset className="rounded-2xl border-2 border-dashed border-borde-lavanda bg-fondo-lavanda p-4">
      <legend className="px-1 text-sm font-extrabold text-morado-medio">Lo que podrás ofrecer más adelante <span className="ml-1 text-xs font-bold text-texto-sutil">({ETIQUETA_PROXIMAMENTE.toLowerCase()})</span></legend>
      <ul className="space-y-3">
        {ofrecibles.map((s) => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={valor.includes(s.id)} onChange={() => onChange(alternar(valor, s.id))} className="mt-1 h-4 w-4 shrink-0 accent-morado-medio" />
              <span className="min-w-0 text-sm">
                <span className="block font-bold text-texto-oscuro">{s.titulo} <span className="ml-1 rounded-full bg-morado-medio px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-blanco">{ETIQUETA_PROXIMAMENTE}</span></span>
                <span className="mt-0.5 block text-texto-medio">{s.paraCompitas}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

/** Sección del perfil del compita para el cuidado de mascotas: dice de qué trata y deja marcar su interés. */
export function SeccionCuidadorMascotas({ valor, onChange }: { valor: readonly string[]; onChange: (v: string[]) => void }) {
  const m = SERVICIOS_PROXIMOS.find((x) => x.id === 'mascotas')!
  return (
    <section aria-labelledby="cuidador-mascotas" className="rounded-2xl border-2 border-dashed border-amarillo-marca bg-amarillo-claro p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 id="cuidador-mascotas" className="text-base font-extrabold text-ambar-oscuro">Cuidado de mascotas</h3>
        <Insignia id="mascotas" />
      </div>
      <p className="mt-1 text-sm text-texto-medio">{m.paraCompitas}</p>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-texto-oscuro"><input type="checkbox" checked={valor.includes('mascotas')} onChange={() => onChange(alternar(valor, 'mascotas'))} className="h-4 w-4 accent-ambar-oscuro" />Quiero ofrecer este servicio</label>
    </section>
  )
}
