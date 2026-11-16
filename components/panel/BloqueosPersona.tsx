'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import Aviso from '@/components/ui/base/Aviso'
import InfoBoton from '@/components/ui/InfoBoton'
import DialogoPanel from '@/components/panel/DialogoPanel'
import { cuandoLinea, type BloqueoFicha } from '@/lib/panel-personas-tipos'

/**
 * Los bloqueos «este compita no vuelve con este cliente» de una persona. Antes no se veían en ningún lugar del panel: si la llamada se cerraba sin decidir el bloqueo,
 * el cliente quedaba sin poder contratar a ese compita («Este compita no está disponible») y nadie sabía por qué. Aquí se ven y se levantan.
 */
export default function BloqueosPersona({ tipo, bloqueos }: { tipo: 'compita' | 'cliente'; bloqueos: BloqueoFicha[] }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState<BloqueoFicha | null>(null)
  const [cargando, setCargando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  if (bloqueos.length === 0) return null

  async function levantar() {
    if (!abierto) return
    setCargando(true); setFallo(null)
    try {
      const r = await fetch('/api/admin/bloqueos-compita', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: abierto.id }) })
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!r.ok || j?.ok === false) { setFallo(j?.error ?? `Error ${r.status}`); return }
      setAbierto(null); router.refresh()
    } catch { setFallo('Sin conexión. No se perdió nada: inténtalo otra vez.') } finally { setCargando(false) }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1">
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-texto-medio">No vuelven a trabajar juntos</h3>
        <InfoBoton que="Qué es un bloqueo" texto="El compita pidió no volver con este cliente, o el equipo lo decidió. Mientras siga activo, el cliente no puede pedirle visitas a ese compita y solo ve «Este compita no está disponible», sin el motivo. Aquí lo levantas si ya no hace falta." />
      </div>
      <ul className="divide-y divide-borde rounded-xl border border-borde">
        {bloqueos.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-40 flex-1 text-sm">
              <b>{b.otro || 'Sin nombre'}</b>
              <span className="block text-xs text-texto-sutil">{b.motivo} · desde {cuandoLinea(b.desde)}</span>
            </div>
            <Boton tamano="compacto" variante="secundario" info={tipo === 'compita' ? 'Abre la confirmación para levantar este bloqueo. Todavía no cambia nada.' : 'Abre la confirmación para levantar este bloqueo. Todavía no cambia nada.'} onClick={() => { setFallo(null); setAbierto(b) }}>Levantar el bloqueo</Boton>
          </li>
        ))}
      </ul>
      {abierto && (
        <DialogoPanel titulo="¿Levantar el bloqueo?" onCerrar={() => setAbierto(null)}>
          <p className="mt-1 text-sm text-texto-medio">{tipo === 'compita' ? <>El cliente <b>{abierto.otro}</b> volverá a poder pedirle visitas a este compita.</> : <>Este cliente volverá a poder pedirle visitas a <b>{abierto.otro}</b>.</>} Queda anotado quién lo levantó.</p>
          {fallo && <div className="mt-3"><Aviso tamano="compacto" tono="peligro">{fallo}</Aviso></div>}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Boton tamano="compacto" variante="fantasma" navegacion onClick={() => setAbierto(null)}>Cancelar</Boton>
            <Boton tamano="compacto" info="Levanta el bloqueo: el cliente y el compita pueden volver a trabajar juntos. Queda anotado en Actividad." cargando={cargando} onClick={levantar}>Sí, levantar</Boton>
          </div>
        </DialogoPanel>
      )}
    </section>
  )
}
