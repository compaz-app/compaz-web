'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import DialogoPanel from '@/components/panel/DialogoPanel'

/**
 * Un botón de cuenta (bloquear, verificar, activar...) que pide confirmar antes de actuar. Llama a una ruta de /api/admin, que vuelve a comprobar
 * el permiso en el servidor: esconder el botón no protege nada. Al terminar refresca la ficha.
 */
export default function AccionCuenta({ texto, info, titulo, mensaje, url, metodo = 'POST', cuerpo, peligro = false }: {
  texto: string; info: string; titulo: string; mensaje: string; url: string; metodo?: 'POST' | 'PATCH' | 'DELETE'; cuerpo: Record<string, unknown>; peligro?: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function hacer() {
    setCargando(true); setError('')
    try {
      const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!r.ok || j?.ok === false) { setError(j?.error ?? `Error ${r.status}`); return }
      setAbierto(false); router.refresh()
    } catch { setError('Sin conexión. No se cambió nada: inténtalo otra vez.') } finally { setCargando(false) }
  }

  return (
    <>
      <Boton tamano="compacto" variante={peligro ? 'peligro' : 'secundario'} info={info} onClick={() => setAbierto(true)}>{texto}</Boton>
      {abierto && (
        <DialogoPanel titulo={titulo} onCerrar={() => setAbierto(false)}>
          <p className="mt-2 text-sm text-texto-medio">{mensaje}</p>
          {error && <p role="alert" className="mt-2 text-sm font-bold text-rojo-oscuro">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Boton tamano="compacto" variante="fantasma" info="Cierra esta ventana sin cambiar nada." onClick={() => setAbierto(false)}>Cancelar</Boton>
            <Boton tamano="compacto" variante={peligro ? 'peligro' : 'primario'} cargando={cargando} info="Aplica el cambio ahora y queda anotado quién lo hizo." onClick={hacer}>{texto}</Boton>
          </div>
        </DialogoPanel>
      )}
    </>
  )
}
