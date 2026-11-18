import Link from 'next/link'
import { Encabezado } from '@/components/panel/ui'
import LogoCmc from '@/components/panel/confianza/LogoCmc'
import { INFO_CONFIANZA } from '@/lib/confianza/textos'

// Marco visual del CMC (Centro de Mando Compitaz · Sistema de Confianza), según la referencia aprobada el 17-nov-2026:
// a la izquierda logo + «CMC» y subtítulo; en el centro la etiqueta «Modo demostración · Datos ficticios»; a la derecha el selector
// de modalidad. Todo el estilo vive dentro de .cf-modulo (paleta cf-* de lib/design.ts) y usa la tipografía del panel (Inter, heredada):
// el menú y las demás secciones no cambian.

export default function MarcoConfianza({ demo, hrefReal, hrefDemo, children }: { demo: boolean; hrefReal: string; hrefDemo: string; children: React.ReactNode }) {
  const opcion = (activo: boolean, href: string, texto: string) => (
    <Link prefetch={false} href={href} aria-current={activo ? 'page' : undefined}
      className={`flex min-h-9 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors sm:flex-none ${activo ? 'bg-cf-morado text-blanco shadow-sm' : 'text-cf-texto hover:bg-cf-lateral'}`}>{texto}</Link>
  )
  return (
    <div className="cf-modulo text-cf-texto">
      {/* Fijo arriba desde tableta; en el teléfono no, para no tapar media pantalla (la ficha repite «Demo · ficticio»). */}
      <div className="z-20 -mx-4 bg-cf-fondo/95 px-4 pb-3 pt-1 backdrop-blur sm:sticky sm:top-0">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 lg:flex-nowrap">
          <div className="flex min-w-0 items-center gap-3">
            <LogoCmc tamano={40} />
            <Encabezado titulo={<span className="text-2xl leading-tight text-cf-texto">CMC</span>} descripcion="Centro de Mando Compitaz · Sistema de Confianza" info={INFO_CONFIANZA} infoQue="Para qué sirve el CMC" />
          </div>
          {demo && (
            <span role="status" className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-cf-lavanda px-3 py-1 text-xs font-semibold text-cf-morado">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-cf-morado" />Modo demostración · Datos ficticios
            </span>
          )}
          <nav aria-label="Modalidad" className="flex w-full shrink-0 gap-1 rounded-xl border border-cf-borde bg-blanco p-1 shadow-sm sm:ml-auto sm:w-auto">
            {opcion(!demo, hrefReal, 'Operación real')}
            {opcion(demo, hrefDemo, 'Demostración')}
          </nav>
        </div>
      </div>

      <div className="space-y-5 pt-3">
        {demo && (
          <details className="group rounded-xl bg-cf-lateral text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-cf-texto">
              <span aria-hidden className="text-cf-texto-suave transition-transform group-open:rotate-90">›</span>Cómo funciona esta demostración
            </summary>
            <ul className="list-disc space-y-1 pb-4 pl-10 pr-4 text-cf-texto-suave">
              <li>Personas, familias y cifras son ficticias. No son resultados de Compaz.</li>
              <li>Aplica las mismas reglas de selección del CMC: no hay atajos para habilitar.</li>
              <li>Lo que haces se guarda solo en este navegador. No envía correos, mensajes de Telegram, solicitudes ni pagos, y no llama a ninguna API ni a la base de datos.</li>
              <li>Cada parte dice si en la operación real ya está comprobada, si aquí es simulada o si falta validarla.</li>
            </ul>
          </details>
        )}
        {children}
      </div>
    </div>
  )
}
