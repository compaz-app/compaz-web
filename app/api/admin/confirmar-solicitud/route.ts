// POST /api/admin/confirmar-solicitud — el admin confirma que llegó el dinero de una solicitud de pago del cliente.
// { solicitud_id, accion?: 'confirmar'|'cancelar' }
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { cancelarSolicitudPago } from '@/lib/solicitudes-pago'
import { confirmarPagoYAvisar } from '@/lib/confirmar-pago'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { solicitud_id?: string; accion?: string } | null
  if (!b?.solicitud_id) return err('Falta solicitud_id')

  if (b.accion === 'cancelar') return (await cancelarSolicitudPago(b.solicitud_id)) ? ok({ cancelada: true }) : err('La solicitud ya fue resuelta', 409)

  const r = await confirmarPagoYAvisar(b.solicitud_id, g.actor.correo ?? 'admin')
  if (!r.ok) return err(r.error, r.status)
  return ok({ pago: r.pago, cupo: r.cupo, correo_enviado: r.correoEnviado })
}
