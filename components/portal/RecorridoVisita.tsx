import type { PasoVisita } from '@/lib/portal-secciones'

// El recorrido de la visita: 5 pasos de un vistazo. Lo hecho queda en una línea con su ✓ en verde; el paso de ahora se destaca; lo que falta queda tenue.
// Es solo una guía (sin botones): lo que se hace en cada paso está en los bloques de abajo. Sin estado ni JavaScript.
export default function RecorridoVisita({ pasos }: { pasos: PasoVisita[] }) {
  return (
    <ol aria-label="Recorrido de la visita" className="space-y-1.5 rounded-2xl border border-borde bg-blanco p-3">
      {pasos.map((p, i) => (
        <li key={p.id} aria-current={p.estado === 'ahora' ? 'step' : undefined} className="flex min-h-10 items-center gap-3">
          <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${p.estado === 'hecho' ? 'bg-verde-oscuro text-blanco' : p.estado === 'ahora' ? 'bg-morado-medio text-blanco' : 'border-2 border-borde text-morado-sutil'}`}>{p.estado === 'hecho' ? '✓' : i + 1}</span>
          <span className={`flex-1 text-base ${p.estado === 'ahora' ? 'font-extrabold text-morado-profundo' : p.estado === 'hecho' ? 'font-bold text-morado-claro' : 'text-morado-sutil'}`}>{p.titulo}</span>
          <span className="sr-only">{p.estado === 'hecho' ? 'listo' : p.estado === 'ahora' ? 'ahora' : 'después'}</span>
          {p.estado === 'ahora' && <span aria-hidden className="text-sm font-bold text-morado-medio">Ahora</span>}
        </li>
      ))}
    </ol>
  )
}
