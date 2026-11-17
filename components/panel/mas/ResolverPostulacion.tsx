'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import InfoBoton from '@/components/ui/InfoBoton'

type Resolucion = 'registrada_en_cmc' | 'no_procede'
const OPCIONES: { valor: Resolucion; etiqueta: string; ayuda: string }[] = [
  { valor: 'registrada_en_cmc', etiqueta: 'La registré directamente en el CMC', ayuda: 'Escribe el ID COM- o dónde quedó registrada.' },
  { valor: 'no_procede', etiqueta: 'No procede', ayuda: 'Escribe el motivo (prueba, spam, datos falsos…).' },
]

// Resuelve una postulación de la bandeja. La resolución queda con el correo de quien la hizo, la nota y la fecha.
export default function ResolverPostulacion({ id }: { id: string }) {
  const router = useRouter()
  const [resolucion, setResolucion] = useState<Resolucion>('registrada_en_cmc')
  const [nota, setNota] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const opcion = OPCIONES.find((o) => o.valor === resolucion)!
  const campo = 'min-h-9 w-full rounded-lg border border-borde bg-blanco px-2 text-sm'

  async function resolver() {
    setCargando(true); setError('')
    try {
      const r = await fetch('/api/admin/postulaciones/resolver', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, resolucion, nota }) })
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!r.ok || !j?.ok) { setError(j?.error ?? `Error ${r.status}`); return }
      router.refresh()
    } catch { setError('Sin conexión. No se guardó nada: inténtalo otra vez.') } finally { setCargando(false) }
  }

  return (
    <details className="group mt-1">
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center rounded-full border border-borde bg-blanco px-3 text-xs font-bold text-texto-oscuro marker:hidden group-open:bg-fondo-claro">Resolver…</summary>
      <div className="mt-2 space-y-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(10rem,1fr)_minmax(10rem,2fr)_auto] sm:items-end">
        <label className="text-xs text-texto-medio">Resolución
          <select value={resolucion} onChange={(e) => setResolucion(e.target.value as Resolucion)} disabled={cargando} className={`${campo} mt-1`}>
            {OPCIONES.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
          </select>
        </label>
        <label className="text-xs text-texto-medio">Nota
          <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} disabled={cargando} className={`${campo} mt-1`} />
        </label>
        <Boton tamano="compacto" cargando={cargando} onClick={resolver} info="Guarda cómo quedó esta postulación, con tu correo, la nota y la fecha. Sale de esta lista y no se puede deshacer desde aquí.">Resolver</Boton>
      </div>
      <p className="flex items-center gap-1 text-xs text-texto-sutil">{opcion.ayuda}<InfoBoton que="Qué pasa al resolver" texto="Resolverla deja constancia de qué se hizo con ella: quién la resolvió, la nota y la fecha." /></p>
      {error && <p role="alert" className="text-xs font-bold text-rojo-oscuro">{error}</p>}
      </div>
    </details>
  )
}
