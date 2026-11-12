'use client'

import { useState } from 'react'
import Boton from '@/components/ui/base/Boton'
import Tarjeta from '@/components/ui/base/Tarjeta'
import Aviso from '@/components/ui/base/Aviso'

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })

export default function ConfirmarEliminar({ token }: { token: string }) {
  const [cargando, setCargando] = useState(false)
  const [borraEl, setBorraEl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    setCargando(true); setError(null)
    try {
      const r = await fetch('/api/cuenta/eliminar/confirmar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.ok !== false) setBorraEl(d.data.borra_el)
      else setError(d.error ?? 'No pudimos hacerlo. Intenta de nuevo.')
    } catch { setError('Sin conexión. Intenta de nuevo.') } finally { setCargando(false) }
  }

  if (borraEl) return (
    <Tarjeta tono="destacada">
      <h1 className="text-2xl font-extrabold text-morado-profundo">Tu cuenta quedó desactivada</h1>
      <p className="mt-2 text-lg text-morado-claro">Se borrará por completo el {fecha(borraEl)}. Si cambias de idea, entra con tu correo antes de esa fecha y la reactivas.</p>
    </Tarjeta>
  )
  if (!token) return <Aviso tono="peligro">Este enlace no es válido. Pide uno nuevo desde tu portal, en Mi plan.</Aviso>
  return (
    <Tarjeta>
      <h1 className="text-2xl font-extrabold text-morado-profundo">¿Eliminar tu cuenta?</h1>
      <p className="mt-2 text-lg text-morado-claro">Se desactiva ahora y se borra a los 7 días. Las visitas que tengas programadas se cancelan sin costo.</p>
      <div className="mt-5 grid gap-3">
        <Boton variante="primario" onClick={confirmar} cargando={cargando} info="Desactiva tu cuenta ahora y la borra a los 7 días. Si entras antes con tu correo, se reactiva.">Sí, eliminar mi cuenta</Boton>
        <Boton variante="secundario" href="/portal" info="No pasa nada: tu cuenta sigue como estaba.">No, volver</Boton>
      </div>
      {error && <p role="alert" className="mt-3 text-base font-bold text-rojo-oscuro">{error}</p>}
    </Tarjeta>
  )
}
