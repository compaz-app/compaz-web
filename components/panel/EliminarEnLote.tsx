'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import DialogoPanel from '@/components/panel/DialogoPanel'

/**
 * Elimina varias cuentas de una vez. Confirmación simple (sin escribir palabras): se dice cuántas son y qué pasa. Al terminar cuenta las eliminadas y, si alguna
 * no se pudo (por ejemplo, tiene una visita en curso), dice cuál y por qué; esas quedan marcadas para que se puedan revisar.
 */
export default function EliminarEnLote({ tipo, ids, nombres, cerrar, alTerminar }: {
  tipo: 'cliente' | 'compita'; ids: string[]; nombres: Record<string, string>; cerrar: () => void
  /** Recibe los identificadores que NO se pudieron eliminar (para dejarlos marcados). */ alTerminar: (fallidas: string[]) => void
}) {
  const router = useRouter()
  const [borrarDatos, setBorrarDatos] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<{ eliminadas: number; fallidas: { id: string; motivo: string }[] } | null>(null)
  const n = ids.length
  const palabra = tipo === 'cliente' ? (n === 1 ? 'cliente' : 'clientes') : (n === 1 ? 'compita' : 'compitas')

  async function eliminar() {
    setCargando(true); setError('')
    try {
      const r = await fetch('/api/admin/eliminar-lote', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, ids, borrar_datos: borrarDatos }) })
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string; data?: { eliminadas: number; fallidas: { id: string; motivo: string }[] } } | null
      if (!r.ok || j?.ok === false || !j?.data) { setError(j?.error ?? `Error ${r.status}`); return }
      setResultado(j.data); alTerminar(j.data.fallidas.map((f) => f.id)); router.refresh()
      if (j.data.fallidas.length === 0) cerrar()
    } catch { setError('Sin conexión. No se sabe si se eliminó alguna: revisa la lista antes de repetir.') } finally { setCargando(false) }
  }

  if (resultado && resultado.fallidas.length > 0) {
    return (
      <DialogoPanel titulo={`${resultado.eliminadas} eliminada${resultado.eliminadas === 1 ? '' : 's'}, ${resultado.fallidas.length} no`} onCerrar={cerrar}>
        <p className="mt-2 text-sm text-texto-medio">Estas no se pudieron eliminar y siguen marcadas en la lista:</p>
        <ul className="mt-2 divide-y divide-borde rounded-lg border border-borde text-sm">
          {resultado.fallidas.map((f) => <li key={f.id} className="px-3 py-2"><b>{nombres[f.id] || 'Sin nombre'}</b>: {f.motivo}</li>)}
        </ul>
        <div className="mt-4 flex justify-end"><Boton tamano="compacto" variante="primario" info="Cierra esta ventana." onClick={cerrar}>Entendido</Boton></div>
      </DialogoPanel>
    )
  }

  return (
    <DialogoPanel titulo={`¿De verdad quieres eliminar ${n} ${palabra}?`} onCerrar={cerrar}>
      <p className="mt-2 text-sm text-texto-medio">
        {tipo === 'cliente'
          ? 'Se cierra el acceso de cada una para siempre y se cancelan sin costo sus visitas abiertas. Su historial (visitas, solicitudes, pagos, ficha y mensajes) se conserva con la marca "(cuenta eliminada)". No se puede deshacer.'
          : 'Dejan de existir para el sistema: sin acceso, sin Telegram y sin familias asignadas. Sus visitas y reportes pasados se conservan con la marca "(cuenta eliminada)". Las que tengan visitas abiertas se saltan y te aviso cuáles. No se puede deshacer.'}
      </p>
      <label className="mt-3 flex items-start gap-2 rounded-lg border border-borde bg-fondo-claro p-2 text-xs text-texto-medio">
        <input type="checkbox" checked={borrarDatos} onChange={(e) => setBorrarDatos(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Esas personas pidieron que se borren sus datos. Se anonimiza: se borran también nombre, contacto y lo que las identifica.</span>
      </label>
      {error && <p role="alert" className="mt-2 text-sm font-bold text-rojo-oscuro">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Boton tamano="compacto" variante="fantasma" info="Cierra esta ventana sin eliminar nada." onClick={cerrar}>Cancelar</Boton>
        <Boton tamano="compacto" variante="peligro" cargando={cargando} info={`Elimina ahora las ${n} cuentas marcadas, una por una. Si alguna no se puede, te dice cuál y por qué.`} onClick={eliminar}>Eliminar {n}</Boton>
      </div>
    </DialogoPanel>
  )
}
