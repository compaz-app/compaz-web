// POST /api/admin/registrar-pago — el admin registra un pago recibido por Zelle, transferencia, Stripe u otro.
// { usuario_id, tipo: 'plan'|'extra', plan?, horas?, monto_usd?, metodo, referencia? }
// Cada pago crea un paquete de visitas que vence a los 60 días.
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { nombreDelCliente } from '@/lib/acciones-equipo'
import { registrarPago } from '@/lib/pagos'
import { cupoDelPlan } from '@/lib/visitas'
import { notificar } from '@/lib/avisos'
import { emailAdminPago } from '@/lib/aviso-pago'
import { ETIQUETA_METODO, type MetodoPago } from '@/lib/planes'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  const g = await requierePermiso('pagos'); if (!g.ok) return g.res
  const admin = { email: g.actor.correo }

  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!b || typeof b.usuario_id !== 'string') return err('Falta usuario_id')

  const r = await registrarPago({
    usuarioId: b.usuario_id,
    tipo: b.tipo as 'plan' | 'extra',
    plan: typeof b.plan === 'string' ? b.plan : null,
    horas: b.horas === undefined || b.horas === null ? null : Number(b.horas),
    montoUsd: b.monto_usd === undefined || b.monto_usd === null || b.monto_usd === '' ? null : Number(b.monto_usd),
    metodo: String(b.metodo ?? ''),
    referencia: typeof b.referencia === 'string' ? b.referencia : null,
    registradoPor: admin.email ?? 'admin',
  })
  if (!r.ok) return err(r.error, r.error.startsWith('Cliente no') ? 404 : 400)

  // Confirmación al cliente, con registro y reintento posible (antes un fallo del correo solo quedaba en el log).
  const nombreCliente = await nombreDelCliente(b.usuario_id)
  const aviso = await notificar({
    plantilla: 'pago_confirmado', canal: 'correo', destinatario: { tipo: 'cliente', id: b.usuario_id },
    variables: { pagoId: r.pago.id, origen: 'registro' }, entidad: 'pago', entidadId: r.pago.id, paso: 12,
  })
  const correoEnviado = aviso.ok || aviso.error === 'sin correo registrado'

  await emailAdminPago('Pago registrado en Compaz', `Se registró un pago de $${r.pago.monto_usd} de ${nombreCliente ?? 'un cliente'} (${ETIQUETA_METODO[r.pago.metodo as MetodoPago]}) por ${admin.email ?? 'admin'}.`)
  return ok({ pago: r.pago, cupo: await cupoDelPlan(b.usuario_id), correo_enviado: correoEnviado })
}
