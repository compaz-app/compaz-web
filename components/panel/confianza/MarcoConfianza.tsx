import Link from 'next/link'
import { Encabezado } from '@/components/panel/ui'
import InfoBoton from '@/components/ui/InfoBoton'
import { INFO_CONFIANZA } from '@/lib/confianza/textos'

// Marco visual del Sistema de Confianza: marca «Compaz · Centro de Operaciones», cambio de modalidad y, en la demostración, la marca
// persistente «Modo demostración · Datos ficticios». Todo el estilo vive dentro de .cf-modulo (paleta cf-* de lib/design.ts):
// el menú del panel y las demás secciones no cambian.

export default function MarcoConfianza({ demo, hrefReal, hrefDemo, children }: { demo: boolean; hrefReal: string; hrefDemo: string; children: React.ReactNode }) {
  const opcion = (activo: boolean, href: string, texto: string) => (
    <Link prefetch={false} href={href} aria-current={activo ? 'page' : undefined}
      className={`flex min-h-9 flex-1 items-center justify-center rounded-lg px-3 text-sm font-bold sm:flex-none transition-colors ${activo ? 'bg-blanco text-cf-morado shadow-sm' : 'text-cf-texto-suave hover:text-cf-texto'}`}>{texto}</Link>
  )
  return (
    <div className="cf-modulo -mx-4 -mt-5 min-h-dvh bg-cf-fondo px-4 pb-10 text-cf-texto lg:mx-0 lg:mt-0 lg:min-h-0 lg:rounded-3xl lg:px-6">
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-cf-borde bg-cf-fondo/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:rounded-t-3xl lg:px-6">
        <span className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-cf-morado">
            {/* Símbolo real de Compaz (recortado de public/logo-nav.webp). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/confianza/simbolo-compaz.png" alt="" width={20} height={20} className="h-5 w-5" />
          </span>
          <span className="text-sm font-extrabold">Compaz <span className="font-bold text-cf-texto-suave">· Centro de Operaciones</span></span>
        </span>
        {demo && (
          <span role="status" className="inline-flex items-center gap-1.5 rounded-md border border-amarillo-marca bg-amarillo-claro px-2 py-0.5 text-xs font-bold text-ambar-oscuro">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amarillo" />Modo demostración · Datos ficticios
          </span>
        )}
        <nav aria-label="Modalidad" className="ml-auto hidden gap-1 rounded-xl bg-cf-lateral p-1 sm:flex">
          {opcion(!demo, hrefReal, 'Operación real')}
          {opcion(demo, hrefDemo, 'Demostración')}
        </nav>
      </div>
      {/* En el teléfono el cambio de modalidad va fuera de la barra fija, para que la barra ocupe una sola línea. */}
      <nav aria-label="Modalidad" className="mt-3 flex gap-1 rounded-xl bg-cf-lateral p-1 sm:hidden">
        {opcion(!demo, hrefReal, 'Operación real')}
        {opcion(demo, hrefDemo, 'Demostración')}
      </nav>

      <div className="space-y-4 pt-4">
        <Encabezado titulo={<span className="text-cf-texto">Sistema de Confianza</span>} descripcion="Cómo seleccionamos, verificamos y habilitamos a cada Compita." info={INFO_CONFIANZA} infoQue="Para qué sirve el Sistema de Confianza" />
        {demo && (
          <details className="group rounded-xl border border-cf-borde bg-blanco px-3 py-2 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-cf-texto-suave">
              <span aria-hidden className="transition-transform group-open:rotate-90">›</span>Cómo funciona esta demostración
              <InfoBoton que="Aislamiento de la demostración" texto="La demostración no llama a ninguna API ni a la base de datos: cada acción cambia una copia guardada solo en este navegador." />
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-cf-texto-suave">
              <li>Personas, familias y cifras son ficticias. No son resultados de Compaz.</li>
              <li>Aplica las mismas reglas de selección que el Centro Compitas (CMC): no hay atajos para habilitar.</li>
              <li>Lo que haces se guarda solo en este navegador. No envía correos, mensajes de Telegram, solicitudes ni pagos.</li>
              <li>Cada parte dice si en la operación real ya está comprobada, si aquí es simulada o si falta validarla.</li>
            </ul>
          </details>
        )}
        {children}
      </div>
    </div>
  )
}
