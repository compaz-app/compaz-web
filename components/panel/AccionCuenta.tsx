'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import DialogoPanel from '@/components/panel/DialogoPanel'

/**
 * Un botón de cuenta (bloquear, verificar, activar...) que pide confirmar antes de actuar. Llama a una ruta de /api/admin, que vuelve a comprobar
 * el permiso en el servidor: esconder el botón no protege nada. Al terminar refresca la ficha.
 */
export default function AccionCuenta({ texto, info, titulo, mensaje, url, metodo = 'POST', cuerpo, peligro = false, escribir, opcion }: {
  texto: string; info: string; titulo: string; mensaje: string; url: string; metodo?: 'POST' | 'PATCH' | 'DELETE'; cuerpo: Record<string, unknown>; peligro?: boolean
  /** Palabra que hay que escribir para poder confirmar (acciones que no se pueden deshacer). */ escribir?: string
  /** Casilla que se suma al cuerpo de la petición (por ejemplo, si la persona pidió borrar sus datos). */ opcion?: { clave: string; texto: string }
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [escrito, setEscrito] = useState('')
  const [marcada, setMarcada] = useState(false)

  async function hacer() {
    setCargando(true); setError('')
    try {
      const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opcion ? { ...cuerpo, [opcion.clave]: marcada } : cuerpo) })
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
          {opcion && (
            <label className="mt-3 flex items-start gap-2 rounded-lg border border-borde bg-fondo-claro p-2 text-xs text-texto-medio">
              <input type="checkbox" checked={marcada} onChange={(e) => setMarcada(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{opcion.texto}</span>
            </label>
          )}
          {escribir && (
            <label className="mt-3 block text-xs text-texto-medio">Para confirmar, escribe <b>{escribir}</b>
              <input value={escrito} onChange={(e) => setEscrito(e.target.value)} autoComplete="off" className="mt-1 min-h-9 w-full rounded-lg border border-borde bg-blanco px-2 text-sm" />
            </label>
          )}
          {error && <p role="alert" className="mt-2 text-sm font-bold text-rojo-oscuro">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Boton tamano="compacto" variante="fantasma" info="Cierra esta ventana sin cambiar nada." onClick={() => setAbierto(false)}>Cancelar</Boton>
            <Boton tamano="compacto" variante={peligro ? 'peligro' : 'primario'} cargando={cargando} disabled={!!escribir && escrito.trim().toUpperCase() !== escribir.toUpperCase()} info="Aplica el cambio ahora y queda anotado quién lo hizo." onClick={hacer}>{texto}</Boton>
          </div>
        </DialogoPanel>
      )}
    </>
  )
}
