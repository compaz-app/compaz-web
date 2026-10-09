// POST /api/pago/cancelar — el cliente cancela su solicitud de pago pendiente.
import { NextRequest } from 'next/server'
import { getClienteActivo } from '@/lib/auth'
import { cancelarSolicitudPago } from '@/lib/solicitudes-pago'
import { ok, err, unauthorized } from '@/lib/api'

export async function POST(req: NextRequest) {
  const cli = await getClienteActivo()
  if (!cli) return unauthorized()
  const b = await req.json().catch(() => null) as { id?: string } | null
  if (!b?.id) return err('Falta id')
  return (await cancelarSolicitudPago(b.id, cli.id)) ? ok({ cancelada: true }) : err('No hay solicitud pendiente', 404)
}
