'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'

/** Aprobar u ocultar una reseña. Ocultar la devuelve a "Por aprobar": no se ve en el perfil del compita. */
export default function AccionResena({ id, publicada }: { id: string; publicada: boolean }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false); const [fallo, setFallo] = useState<string | null>(null)
  async function cambiar() {
    setCargando(true); setFallo(null)
    try {
      const r = await fetch('/api/admin/resenas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, publicada: !publicada }) })
      if (!r.ok) throw new Error(String(r.status))
      router.refresh()
    } catch { setFallo('No se pudo. Inténtalo otra vez.') } finally { setCargando(false) }
  }
  return (
    <div className="flex flex-col items-start gap-1">
      {publicada
        ? <Boton tamano="compacto" variante="secundario" info="La reseña deja de verse en el perfil del compita y no cuenta en su calificación. Vuelve a Por aprobar. El cliente no recibe ningún aviso." cargando={cargando} onClick={cambiar}>Ocultar</Boton>
        : <Boton tamano="compacto" variante="primario" info="Publica la reseña en el perfil del compita y cuenta en su calificación. El cliente no recibe ningún aviso." cargando={cargando} onClick={cambiar}>Aprobar</Boton>}
      {fallo && <span role="status" className="text-xs font-bold text-rojo-oscuro">{fallo}</span>}
    </div>
  )
}
