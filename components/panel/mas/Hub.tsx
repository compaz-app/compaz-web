import Link from 'next/link'
import { Encabezado, TituloSeccion } from '@/components/panel/ui'
import InfoBoton from '@/components/ui/InfoBoton'
import { TarjetasProximamente } from '@/components/ui/Proximamente'
import { INFO_PROXIMAMENTE } from '@/lib/servicios-proximos'
import { hubVisible } from '@/lib/panel-mas-tipos'
import type { ActorVista } from '@/lib/panel-secciones'

type Enlace = (cambios: Record<string, string | null>) => string

// Más: el menú de herramientas que no son del día a día. Solo muestra las que esta persona puede usar.
export default function Hub({ actor, enlace }: { actor: ActorVista; enlace: Enlace }) {
  const hub = hubVisible(actor)
  return (
    <section className="max-w-3xl space-y-3">
      <Encabezado titulo="Más" descripcion="Herramientas que no son del día a día." />
      <ul className="grid gap-2 sm:grid-cols-2">
        {hub.map((h) => (
          <li key={h.id}>
            <Link prefetch={false} href={enlace({ mas: h.id })} className="block h-full rounded-xl border border-borde bg-blanco p-3 hover:bg-lavanda-sutil">
                <span className="flex items-center gap-2 text-base font-extrabold">{h.texto}<span aria-hidden className="ml-auto text-texto-sutil">›</span></span>
                <span className="mt-1 line-clamp-2 block text-sm text-texto-medio">{h.descripcion}</span>
              </Link>
          </li>
        ))}
      </ul>
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-1"><TituloSeccion>Próximamente</TituloSeccion><InfoBoton que="Qué es esto" texto={INFO_PROXIMAMENTE} /></div>
        <TarjetasProximamente grande={false} ids={['voluntariado', 'mascotas']} />
      </div>
    </section>
  )
}
