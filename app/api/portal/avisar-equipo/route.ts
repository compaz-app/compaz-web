// POST /api/portal/avisar-equipo — el cliente pide ayuda al equipo desde su portal (una vez por hora; después se le explica por qué y cuándo).
import { getClienteActivo } from '@/lib/auth'
import { avisarAlEquipo } from '@/lib/portal-acciones'
import { ok, unauthorized, errEspera } from '@/lib/api'

export async function POST() {
  const cli = await getClienteActivo()
  if (!cli) return unauthorized()
  const r = await avisarAlEquipo({ id: cli.id, nombre: String(cli.user_metadata?.nombre ?? cli.email ?? '') })
  return r.avisado ? ok({ avisado: true }) : errEspera(r.espera)
}
