'use client'

import { useState } from 'react'
import Boton from '@/components/ui/base/Boton'
import InfoBoton from '@/components/ui/InfoBoton'

// "Eliminar mi cuenta": pide el enlace de confirmación por correo (nada se borra hasta que lo abre). Va al final de Mi plan, discreto.
export default function EliminarCuenta({ restantes, vence }: { restantes: number; vence: string | null }) {
  const [cargando, setCargando] = useState(false)
  const [aviso, setAviso] = useState<{ texto: string; porQue?: string; error?: boolean } | null>(null)

  async function pedir() {
    setCargando(true); setAviso(null)
    try {
      const r = await fetch('/api/cuenta/eliminar', { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.ok !== false) setAviso({ texto: 'Te enviamos un correo para confirmar. Revisa también el spam.' })
      else setAviso({ texto: d.error ?? 'No pudimos hacerlo. Intenta de nuevo.', porQue: d.porQue, error: !d.porQue })
    } catch { setAviso({ texto: 'Sin conexión. Intenta de nuevo.', error: true }) } finally { setCargando(false) }
  }

  return (
    <section className="border-t border-borde pt-4">
      <h2 className="flex items-center gap-1 text-lg font-extrabold text-morado-profundo">
        Eliminar mi cuenta
        <InfoBoton que="Qué pasa" texto="Se borran tu nombre, contacto, la ficha de tu familiar y su dirección, las fotos y los mensajes. Los pagos y las visitas quedan sin datos que te identifiquen. Se desactiva al confirmar y se borra a los 7 días: si entras antes, la reactivas. Las visitas programadas se cancelan sin costo. Las visitas sin usar no se reembolsan solas; escríbenos si necesitas un reembolso." />
      </h2>
      {restantes > 0 && <p className="mt-1 text-base text-morado-claro">Tienes {restantes} {restantes === 1 ? 'visita' : 'visitas'} sin usar{vence ? ` (vencen el ${new Date(vence).toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })})` : ''}. Se pierden al eliminar.</p>}
      <div className="mt-3"><Boton variante="secundario" onClick={pedir} cargando={cargando} info="Te enviamos un correo con un enlace. Nada se borra hasta que lo abras y confirmes.">Eliminar mi cuenta</Boton></div>
      {aviso && (
        <p role={aviso.error ? 'alert' : 'status'} className={`mt-2 flex flex-wrap items-center gap-1 text-base font-bold ${aviso.error ? 'text-rojo-oscuro' : 'text-verde-oscuro'}`}>
          <span>{aviso.texto}</span>{aviso.porQue && <InfoBoton que="Por qué" texto={aviso.porQue} />}
        </p>
      )}
    </section>
  )
}
