import Link from 'next/link'
import { Encabezado } from '@/components/panel/ui'
import LogoCmc from '@/components/panel/confianza/LogoCmc'
import { INFO_CONFIANZA } from '@/lib/confianza/textos'

// Marco visual del CMC (Centro de Mando Compaz · Sistema de Confianza): encabezado con su logo propio, cambio de modalidad y, en la
// demostración, la etiqueta discreta «Modo demostración · Datos ficticios». Todo el estilo vive dentro de .cf-modulo (paleta cf-* de
// lib/design.ts) y usa la misma tipografía del panel (Inter, heredada): el menú y las demás secciones no cambian.

export default function MarcoConfianza({ demo, hrefReal, hrefDemo, children }: { demo: boolean; hrefReal: string; hrefDemo: string; children: React.ReactNode }) {
  const opcion = (activo: boolean, href: string, texto: string) => (
    <Link prefetch={false} href={href} aria-current={activo ? 'page' : undefined}
      className={`flex min-h-9 flex-1 items-center justify-center rounded-md px-3 text-sm font-bold transition-colors sm:flex-none ${activo ? 'bg-blanco text-cf-morado shadow-sm' : 'text-cf-texto-suave hover:text-cf-texto'}`}>{texto}</Link>
  )
  return (
    <div className="cf-modulo text-cf-texto">
      {/* Fijo arriba desde tableta; en el teléfono no, para no tapar media pantalla (la ficha repite «Demo · ficticio»). */}
      <div className="z-20 -mx-4 border-b sm:sticky sm:top-0 border-cf-borde bg-cf-fondo/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <Encabezado titulo={<span className="flex items-center gap-2 text-cf-texto"><LogoCmc />CMC</span>} descripcion="Centro de Mando Compaz · Sistema de Confianza" info={INFO_CONFIANZA} infoQue="Para qué sirve el CMC" />
          </div>
          {demo && (
            <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-amarillo-claro px-2.5 py-0.5 text-xs font-bold text-ambar-oscuro">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amarillo" />Modo demostración · Datos ficticios
            </span>
          )}
          <nav aria-label="Modalidad" className="flex w-full gap-1 rounded-lg bg-cf-lateral p-1 ring-1 ring-cf-borde sm:ml-auto sm:w-auto">
            {opcion(!demo, hrefReal, 'Operación real')}
            {opcion(demo, hrefDemo, 'Demostración')}
          </nav>
        </div>
      </div>

      <div className="space-y-6 pt-5">
        {demo && (
          <details className="group text-sm">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-semibold text-cf-texto-suave hover:text-cf-texto">
              <span aria-hidden className="transition-transform group-open:rotate-90">›</span>Cómo funciona esta demostración
            </summary>
            <ul className="mt-2 list-disc space-y-1 rounded-lg bg-cf-lateral py-3 pl-8 pr-4 text-cf-texto-suave">
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
