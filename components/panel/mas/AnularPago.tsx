'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import Aviso from '@/components/ui/base/Aviso'
import DialogoPanel from '@/components/panel/DialogoPanel'

/** Anular un pago: libera las visitas que no se cobraron. Pide un motivo (queda guardado con el pago). */
export default function AnularPago({ id, cliente, monto }: { id: string; cliente: string; monto: number }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false); const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(false); const [fallo, setFallo] = useState<string | null>(null)
  async function anular() {
    setCargando(true); setFallo(null)
    try {
      const r = await fetch('/api/admin/anular-pago', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pago_id: id, motivo }) })
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!r.ok || j?.ok === false) throw new Error(j?.error ?? `Error ${r.status}`)
      setAbierto(false); router.refresh()
    } catch (e) { setFallo(e instanceof Error ? e.message : 'No se pudo anular') } finally { setCargando(false) }
  }
  return (
    <>
      <Boton tamano="compacto" variante="secundario" info="Anula este pago y libera las visitas que no se cobraron. Úsalo solo si hubo un error. Pide un motivo y queda guardado." onClick={() => setAbierto(true)}>Anular pago</Boton>
      {abierto && (
        <DialogoPanel titulo="¿Anular este pago?" onCerrar={() => setAbierto(false)}>
          <p className="mt-1 text-sm text-texto-medio">Pago de <b>${monto}</b> de <b>{cliente}</b>. Las visitas que no se hayan usado se liberan y el cupo del cliente se recalcula. No se puede deshacer desde aquí.</p>
          <label className="mt-3 block text-sm font-bold">Motivo<textarea value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} placeholder="Por ejemplo: el cliente pagó dos veces" className="mt-1 min-h-20 w-full rounded-xl border border-borde p-3 text-sm font-normal" /></label>
          {fallo && <div className="mt-3"><Aviso tamano="compacto" tono="peligro">{fallo}</Aviso></div>}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Boton tamano="compacto" variante="fantasma" navegacion onClick={() => setAbierto(false)}>Cancelar</Boton>
            <Boton tamano="compacto" variante="peligro" info="Anula el pago de verdad y recalcula el cupo del cliente. Revisa que sea el pago correcto." disabled={motivo.trim().length < 5} cargando={cargando} onClick={anular}>Sí, anular</Boton>
          </div>
        </DialogoPanel>
      )}
    </>
  )
}
