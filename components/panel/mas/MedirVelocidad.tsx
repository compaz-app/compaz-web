'use client'

import { useState } from 'react'
import Boton from '@/components/ui/base/Boton'
import type { InformeLatencia } from '@/lib/latencia'

/** Mide, desde el servidor, cuánto tarda en hablar con la base de datos y dice en una frase qué significa. Solo lee; no escribe nada. */
export default function MedirVelocidad() {
  const [cargando, setCargando] = useState(false)
  const [informe, setInforme] = useState<InformeLatencia | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  async function medir() {
    setCargando(true); setFallo(null)
    try {
      const r = await fetch('/api/admin/latencia', { cache: 'no-store' })
      const j = await r.json().catch(() => null) as { ok?: boolean; data?: InformeLatencia; error?: string } | null
      if (r.ok && j?.data) setInforme(j.data); else setFallo(j?.error ?? `Error ${r.status}`)
    } catch { setFallo('Sin conexión. Inténtalo otra vez.') } finally { setCargando(false) }
  }
  return (
    <div className="space-y-2">
      <Boton tamano="compacto" variante="secundario" cargando={cargando} onClick={medir}
        info="Mide cuánto tarda el servidor en hablar con la base de datos (tarda unos segundos). Sirve para saber si el panel va lento por la distancia entre ambos. No cambia nada.">Medir velocidad</Boton>
      {fallo && <p role="alert" className="text-xs font-bold text-rojo-oscuro">{fallo}</p>}
      {informe && (
        <div role="status" className="space-y-1 rounded-xl border border-borde bg-blanco p-3 text-sm">
          <p>{informe.lectura}</p>
          <p className="text-xs text-texto-sutil">Región del servidor: {informe.regionServidor ?? 'no la dice'} · Consultas en fila: {informe.consultasEnSerie.join(', ')} ms · Cinco a la vez: {informe.cincoEnParalelo} ms · Sesión: {informe.sesion} ms</p>
        </div>
      )}
    </div>
  )
}
