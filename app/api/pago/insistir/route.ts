// POST /api/pago/insistir — el cliente avisa que ya pagó. El pago pasa a URGENTE para el equipo (máximo una alerta por ventana).
import { getClienteActivo } from '@/lib/auth'
import { solicitudPendiente } from '@/lib/solicitudes-pago'
import { registrarInsistenciaPago } from '@/lib/confirmar-pago'
import { ok, err, unauthorized } from '@/lib/api'

export async function POST() {
  const cli = await getClienteActivo()
  if (!cli) return unauthorized()
  const s = await solicitudPendiente(cli.id)
  if (!s) return err('No tienes un pago pendiente', 404)
  const r = await registrarInsistenciaPago(s, String(cli.user_metadata?.nombre ?? cli.email ?? 'Un cliente'))
  return ok({ avisado: true, veces: r.veces })
}
