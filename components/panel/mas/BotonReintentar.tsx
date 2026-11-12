'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'

/** Reintenta un aviso fallido. Si vuelve a fallar, dice por qué y el aviso sigue en la lista. */
export default function BotonReintentar({ avisoId }: { avisoId: string }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  async function reintentar() {
    setCargando(true); setMensaje(null)
    try {
      const r = await fetch('/api/admin/reintentar-aviso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aviso_id: avisoId }) })
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (r.ok && j?.ok !== false) { setMensaje({ ok: true, texto: 'Reenviado ✓' }); router.refresh() } else setMensaje({ ok: false, texto: j?.error ?? `Error ${r.status}` })
    } catch { setMensaje({ ok: false, texto: 'Sin conexión. Inténtalo otra vez.' }) } finally { setCargando(false) }
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <Boton tamano="compacto" variante="secundario" info="Vuelve a mandar el aviso que no llegó. Si falla otra vez, sigue en esta lista con el motivo. Hay un máximo de intentos por aviso." cargando={cargando} onClick={reintentar}>Reintentar</Boton>
      {mensaje && <span role="status" className={`text-xs font-bold ${mensaje.ok ? 'text-verde-oscuro' : 'text-rojo-oscuro'}`}>{mensaje.texto}</span>}
    </div>
  )
}
