// POST /api/pago/solicitar — el cliente elige plan (o visita extra) y método desde su dashboard.
// { tipo: 'plan'|'extra', plan?, horas?, metodo: 'zelle'|'transferencia' } → crea la solicitud pendiente y avisa al admin.
import { NextRequest } from 'next/server'
import { getClienteActivo } from '@/lib/auth'
import { crearSolicitudPago, instruccionesPago, referenciaDe, type MetodoDirecto } from '@/lib/solicitudes-pago'
import { avisarAdmin } from '@/lib/telegram'
import { esc } from '@/lib/html'
import { emailAdminPago } from '@/lib/aviso-pago'
import { PLANES, ETIQUETA_METODO, type PlanId } from '@/lib/planes'
import { ok, err, unauthorized } from '@/lib/api'

export async function POST(req: NextRequest) {
  const cli = await getClienteActivo()
  if (!cli) return unauthorized()
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!b) return err('Solicitud inválida')

  const r = await crearSolicitudPago({
    usuarioId: cli.id, tipo: String(b.tipo ?? ''), plan: typeof b.plan === 'string' ? b.plan : null,
    horas: b.horas == null ? null : Number(b.horas), metodo: String(b.metodo ?? ''),
  })
  if (!r.ok) return err(r.error)
  const s = r.solicitud
  const que = s.tipo === 'plan' ? `plan ${PLANES[s.plan as PlanId].nombre}` : `visita extra de ${s.horas} h`
  await avisarAdmin(`💳 <b>${esc(String(cli.user_metadata?.nombre ?? cli.email ?? 'Cliente'))}</b> quiere pagar: ${esc(que)} ($${s.monto_usd}) por ${esc(ETIQUETA_METODO[s.metodo])}. Referencia ${referenciaDe(s.id)}. Cuando llegue el dinero, confírmalo en el panel, en Clientes, Pagos y plan.`).catch(() => false)
  await emailAdminPago('Un cliente quiere pagar en Compaz', `${String(cli.user_metadata?.nombre ?? cli.email ?? 'Un cliente')} quiere pagar ${que} ($${s.monto_usd}) por ${ETIQUETA_METODO[s.metodo]}. Referencia ${referenciaDe(s.id)}. Confirma el pago en el panel cuando llegue el dinero.`)
  return ok({ solicitud: s, referencia: referenciaDe(s.id), instrucciones: instruccionesPago(s.metodo as MetodoDirecto) })
}
