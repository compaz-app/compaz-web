// POST /api/admin/confirmar-solicitud — el admin confirma que llegó el dinero de una solicitud de pago del cliente.
// { solicitud_id, accion?: 'confirmar'|'cancelar' }
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { confirmarSolicitudPago, cancelarSolicitudPago } from '@/lib/solicitudes-pago'
import { cupoDelPlan } from '@/lib/visitas'
import { notificar } from '@/lib/avisos'
import { createAdminSupabase } from '@/lib/supabase-server'
import { emailAdminPago } from '@/lib/aviso-pago'
import { ETIQUETA_METODO, type MetodoPago } from '@/lib/planes'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  const admin = { email: g.actor.correo }
  const b = await req.json().catch(() => null) as { solicitud_id?: string; accion?: string } | null
  if (!b?.solicitud_id) return err('Falta solicitud_id')

  if (b.accion === 'cancelar') return (await cancelarSolicitudPago(b.solicitud_id)) ? ok({ cancelada: true }) : err('La solicitud ya fue resuelta', 409)

  const r = await confirmarSolicitudPago(b.solicitud_id, admin.email ?? 'admin')
  if (!r.ok) return err(r.error, r.status)

  const { data: cli } = await createAdminSupabase().from('usuarios').select('nombre').eq('id', r.usuarioId).maybeSingle()
  // Aviso al cliente con registro y reintento posible (antes un fallo del correo solo quedaba en el log).
  const aviso = await notificar({
    plantilla: 'pago_confirmado', canal: 'correo', destinatario: { tipo: 'cliente', id: r.usuarioId },
    variables: { pagoId: r.pago.id, origen: 'confirmacion' }, entidad: 'pago', entidadId: r.pago.id, paso: 12,
  })
  const correoEnviado = aviso.ok || aviso.error === 'sin correo registrado'
  await emailAdminPago('Pago confirmado en Compaz', `Confirmaste el pago de $${r.pago.monto_usd} de ${cli?.nombre ?? 'un cliente'} (${ETIQUETA_METODO[r.pago.metodo as MetodoPago]}).`)
  return ok({ pago: r.pago, cupo: await cupoDelPlan(r.usuarioId), correo_enviado: correoEnviado })
}
