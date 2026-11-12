'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import InfoBoton from '@/components/ui/InfoBoton'
import { peticionDeAccion, type AccionPortal as Accion } from '@/lib/portal-acciones-cliente'

// Un botón del portal que EJECUTA algo (avisar el pago, confirmar el inicio de la visita...). Hace la llamada, y según la respuesta: refresca el portal
// (el estado cambia solo), o dice qué pasó. Si el servidor frena la acción (por ejemplo, ya se avisó hace poco) muestra una línea corta y la razón tras un ⓘ.
export default function AccionPortal({ accion, texto, info, variante, visitaId, estado }: { accion: Accion; texto: string; info: string; variante: 'primario' | 'secundario'; visitaId?: string; estado?: string }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [aviso, setAviso] = useState<{ texto: string; porQue?: string; error?: boolean } | null>(null)

  async function ejecutar() {
    const p = peticionDeAccion(accion, { visitaId, estado })
    if (!p) { setAviso({ texto: 'No pudimos hacerlo desde aquí. Intenta de nuevo en unos minutos.', error: true }); return }
    setCargando(true); setAviso(null)
    try {
      const r = await fetch(p.url, { method: p.metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p.cuerpo) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.ok !== false) {
        // El pago ya avisado hace poco responde ok con un mensaje que explica por qué no se alerta otra vez.
        const resumen = d.data?.resumen as string | undefined
        setAviso({ texto: resumen ?? (accion === 'avisar_equipo' ? 'Listo, avisamos al equipo. Te escribimos por correo.' : 'Listo.'), porQue: d.data?.porQue })
        router.refresh()
      } else {
        setAviso({ texto: d.error ?? 'No pudimos hacerlo. Intenta de nuevo.', porQue: d.porQue, error: !d.porQue })
      }
    } catch { setAviso({ texto: 'Sin conexión. Intenta de nuevo.', error: true }) } finally { setCargando(false) }
  }

  return (
    <div>
      <Boton variante={variante} info={info} onClick={ejecutar} cargando={cargando}>{texto}</Boton>
      {aviso && (
        <p role={aviso.error ? 'alert' : 'status'} className={`mt-2 flex flex-wrap items-center gap-1 text-base font-bold ${aviso.error ? 'text-rojo-oscuro' : 'text-verde-oscuro'}`}>
          <span>{aviso.texto}</span>{aviso.porQue && <InfoBoton que="Por qué" texto={aviso.porQue} />}
        </p>
      )}
    </div>
  )
}
