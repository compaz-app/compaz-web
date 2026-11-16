'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import Aviso from '@/components/ui/base/Aviso'
import InfoBoton from '@/components/ui/InfoBoton'
import DialogoPanel from '@/components/panel/DialogoPanel'
import { CLASE_LISTA } from '@/components/panel/ui'
import { avisarCambio } from '@/components/panel/pendientes-store'
import { cuandoLinea } from '@/lib/panel-personas-tipos'
import type { FilaPorConfirmar } from '@/lib/panel-mas-tipos'

const METODO: Record<string, string> = { zelle: 'Zelle', transferencia: 'Transferencia', stripe: 'Tarjeta (Stripe)', otro: 'Otro' }

/** Horas que lleva esperando, para que lo que más tiempo espera se note. */
const horasEsperando = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000))

// Los pagos que el cliente dice haber hecho y que nadie ha confirmado. Confirmar crea el pago real, activa las visitas y avisa al cliente por correo.
// Solo quien tiene el permiso de pagos puede confirmar; el servidor decide el monto y el cliente, nunca esta pantalla.
export default function PagosPorConfirmar({ filas, puedeConfirmar }: { filas: FilaPorConfirmar[]; puedeConfirmar: boolean }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState<FilaPorConfirmar | null>(null)
  const [cargando, setCargando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function confirmar() {
    if (!abierto) return
    setCargando(true); setFallo(null)
    try {
      const r = await fetch('/api/admin/confirmar-pago', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ solicitud_pago_id: abierto.id }) })
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!r.ok || j?.ok === false) { setFallo(j?.error ?? `Error ${r.status}`); return }
      setAbierto(null); avisarCambio(); router.refresh()
    } catch { setFallo('Sin conexión. No se perdió nada: inténtalo otra vez.') } finally { setCargando(false) }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5">
        <h3 className="text-base font-extrabold">Por confirmar <span className="ml-1 rounded-full bg-amarillo-claro px-2 py-0.5 text-xs font-bold text-ambar-oscuro">{filas.length}</span></h3>
        <InfoBoton que="Qué es Por confirmar" texto="Pagos que el cliente dice haber hecho (Zelle o transferencia) y que nadie ha confirmado. Revisa que el dinero llegó antes de confirmar. Al confirmar se crea el pago, se activan las visitas del cliente y le llega un correo. El más antiguo va primero." />
      </div>
      {filas.length === 0 ? <p className="rounded-xl border border-borde bg-blanco px-3 py-2 text-sm text-texto-sutil">No hay pagos por confirmar.</p> : (
        <ul className={CLASE_LISTA}>
          {filas.map((g) => {
            const h = horasEsperando(g.creado)
            return (
              <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <div className="min-w-48 flex-1">
                  <div className="text-sm"><b>{g.cliente}</b> <span className="text-texto-medio">· {g.plan} · ${g.monto}</span></div>
                  <div className="text-xs text-texto-sutil">{METODO[g.metodo] ?? g.metodo} · referencia {g.referencia} · {cuandoLinea(g.creado)}{h >= 1 ? ` · espera hace ${h} h` : ''}</div>
                </div>
                {puedeConfirmar
                  ? <Boton tamano="compacto" info="Abre la confirmación de este pago. Todavía no se confirma nada: primero te pide que verifiques que el dinero llegó." onClick={() => { setFallo(null); setAbierto(g) }}>Confirmar pago</Boton>
                  : <Boton tamano="compacto" variante="secundario" disabled info="Confirmar pagos necesita el permiso de pagos. Pídeselo al administrador.">Confirmar pago</Boton>}
              </li>
            )
          })}
        </ul>
      )}
      {abierto && (
        <DialogoPanel titulo="¿Ya llegó el dinero?" onCerrar={() => setAbierto(null)}>
          <p className="mt-1 text-sm text-texto-medio">Vas a confirmar el pago de ${abierto.monto} de <b>{abierto.cliente}</b> ({METODO[abierto.metodo] ?? abierto.metodo}, referencia {abierto.referencia}). El cliente podrá completar su ficha y agendar, y le llega un correo. Queda anotado que lo confirmaste tú.</p>
          {fallo && <div className="mt-3"><Aviso tamano="compacto" tono="peligro">{fallo}</Aviso></div>}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Boton tamano="compacto" variante="fantasma" navegacion onClick={() => setAbierto(null)}>Cancelar</Boton>
            <Boton tamano="compacto" info="Confirma el pago, activa las visitas del cliente y le avisa por correo. Revisa que el dinero de verdad llegó antes de confirmar." cargando={cargando} onClick={confirmar}>Sí, confirmar pago</Boton>
          </div>
        </DialogoPanel>
      )}
    </section>
  )
}
