'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import InfoBoton from '@/components/ui/InfoBoton'
import type { AvisoPortal } from '@/lib/novedades'

const cuando = (iso: string) => new Date(iso).toLocaleString('es-VE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// La campana de avisos del portal: un círculo rojo con el número de avisos nuevos. Al abrirla se quitan (quedan en la lista, ya sin marca) y cada aviso lleva a donde se atiende.
export default function CampanaAvisos({ avisos, nuevos }: { avisos: AvisoPortal[]; nuevos: number }) {
  const router = useRouter()
  const [abierta, setAbierta] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  // Los que eran nuevos al abrir se siguen marcando mientras la lista está abierta, aunque el servidor ya los dé por atendidos.
  const [marcar, setMarcar] = useState<Set<string>>(new Set())

  function alternar() {
    const abriendo = !abierta
    setAbierta(abriendo)
    if (abriendo) {
      setMarcar(new Set(avisos.filter((a) => a.nueva).map((a) => a.id)))
      if (nuevos > 0) fetch('/api/portal/novedades/abiertas', { method: 'POST' }).then(() => router.refresh()).catch(() => undefined)
    }
  }
  useEffect(() => {
    if (!abierta) return
    const fuera = (e: MouseEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierta(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierta(false) }
    document.addEventListener('mousedown', fuera); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierta])

  return (
    <div ref={raiz} className="relative">
      <button type="button" onClick={alternar} aria-expanded={abierta} aria-label={nuevos > 0 ? `Avisos, ${nuevos} nuevos` : 'Avisos'} title="Avisos" className="relative flex h-11 w-11 items-center justify-center rounded-full text-morado-claro hover:bg-fondo-claro">
        <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {nuevos > 0 && <span role="status" aria-label={`${nuevos} avisos nuevos`} className="absolute right-0.5 top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rojo px-1.5 text-[11px] font-extrabold leading-5 text-blanco">{nuevos > 99 ? '99+' : nuevos}</span>}
      </button>
      {abierta && (
        <div role="dialog" aria-label="Avisos" className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-borde bg-blanco p-3 shadow-xl">
          <div className="mb-1 flex items-center gap-1 px-1"><h2 className="text-base font-extrabold text-morado-profundo">Avisos</h2><InfoBoton que="Qué son los avisos" texto="Lo que le pasa a tu visita y a tu cuenta: tu compita confirmó, llegó, la visita terminó. Aparecen aquí aunque no mires el correo. Al abrir la campana se quita el círculo rojo." /></div>
          {avisos.length === 0 ? <p className="px-1 py-3 text-sm text-morado-claro">Todavía no tienes avisos. Cuando pase algo con tu visita, lo verás aquí.</p> : (
            <ul className="max-h-80 divide-y divide-borde overflow-y-auto">
              {avisos.map((a) => (
                <li key={a.id}>
                  <Link href={a.ruta} onClick={() => setAbierta(false)} className="flex min-h-14 items-start gap-2 px-1 py-2.5 hover:bg-fondo-claro">
                    <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${marcar.has(a.id) ? 'bg-rojo' : 'bg-transparent'}`} />
                    <span className="min-w-0 flex-1"><span className={`block text-base leading-snug text-morado-profundo ${marcar.has(a.id) ? 'font-extrabold' : 'font-bold'}`}>{a.titulo}</span><span className="block text-xs text-morado-sutil">{cuando(a.creada_en)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
