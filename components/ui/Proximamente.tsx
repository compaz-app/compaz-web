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

/**
 * Las casillas del registro y del perfil del compita: lo que podrá ofrecer más adelante. Deshabilitadas a propósito: todavía no se activan. Dice qué
 * significará para él (por ejemplo, las preguntas adicionales de las mascotas).
 */
export function OpcionesProximamenteCompita() {
  // Las mascotas tienen su propia sección (SeccionCuidadorMascotas): aquí solo lo que no la tiene.
  const ofrecibles = SERVICIOS_PROXIMOS.filter((s) => s.paraCompitas && s.id !== 'mascotas')
  return (
    <fieldset className="rounded-2xl border-2 border-dashed border-borde-lavanda bg-fondo-lavanda p-4">
      <legend className="px-1 text-sm font-extrabold text-morado-medio">Lo que podrás ofrecer más adelante <span className="ml-1 text-xs font-bold text-texto-sutil">({ETIQUETA_PROXIMAMENTE.toLowerCase()})</span></legend>
      <ul className="space-y-3">
        {ofrecibles.map((s) => (
          <li key={s.id} className="flex items-start gap-3">
            <input type="checkbox" disabled aria-label={`${s.titulo}, ${ETIQUETA_PROXIMAMENTE.toLowerCase()}`} className="mt-1 h-4 w-4 shrink-0 opacity-50" />
            <div className="min-w-0 text-sm">
              <p className="font-bold text-texto-oscuro">{s.titulo} <span className="ml-1 rounded-full bg-morado-medio px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-blanco">{ETIQUETA_PROXIMAMENTE}</span></p>
              <p className="mt-0.5 text-texto-medio">{s.paraCompitas}</p>
            </div>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

/**
 * Sección propia del perfil del compita para quien quiera cuidar mascotas. Todavía no se activa: solo dice que viene y qué se le preguntará, para que sepa
 * qué esperar. No tiene campos que se envíen.
 */
export function SeccionCuidadorMascotas() {
  const m = SERVICIOS_PROXIMOS.find((x) => x.id === 'mascotas')!
  return (
    <section aria-labelledby="cuidador-mascotas" className="rounded-2xl border-2 border-dashed border-amarillo-marca bg-amarillo-claro p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-blanco text-ambar-oscuro shadow-sm"><Icono nombre="huella" className="h-6 w-6" /></span>
        <h3 id="cuidador-mascotas" className="text-base font-extrabold text-ambar-oscuro">Cuidador de mascotas</h3>
        <Insignia id="mascotas" />
      </div>
      <p className="mt-2 text-sm text-texto-medio">{m.paraCompitas}</p>
      <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-ambar-oscuro">Más adelante te preguntaremos</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-texto-medio">{m.preguntasFuturas?.map((q) => <li key={q}>{q}</li>)}</ul>
      <label className="mt-3 flex items-center gap-2 text-sm text-texto-sutil"><input type="checkbox" disabled className="h-4 w-4 opacity-50" />Quiero ofrecer este servicio (se activará cuando esté disponible)</label>
    </section>
  )
}
