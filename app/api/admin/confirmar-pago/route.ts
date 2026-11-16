import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { confirmarPagoDeTarea, confirmarPagoPorSolicitud } from '@/lib/panel-bandeja-acciones'
import { ok, err } from '@/lib/api'

// POST /api/admin/confirmar-pago { flag_id } — confirma el pago que pide una tarea de la Bandeja. Permiso de pagos.
export async function POST(req: NextRequest) {
  const g = await requierePermiso('pagos')
  if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { flag_id?: unknown; solicitud_pago_id?: unknown } | null
  const ID = /^[0-9a-zA-Z-]{8,64}$/
  // Desde la Bandeja llega la tarea (flag_id); desde la pestaña Pagos llega la solicitud de pago. Nunca el monto ni el cliente: salen del servidor.
  const r = b && typeof b.solicitud_pago_id === 'string' && ID.test(b.solicitud_pago_id)
    ? await confirmarPagoPorSolicitud(g.actor, b.solicitud_pago_id)
    : b && typeof b.flag_id === 'string' && ID.test(b.flag_id)
      ? await confirmarPagoDeTarea(g.actor, b.flag_id)
      : null
  if (!r) return err('Falta la tarea o el pago')
  return r.ok ? ok({ correo_enviado: r.correoEnviado }) : err(r.error, r.status)
}
