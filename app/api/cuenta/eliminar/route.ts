// POST /api/cuenta/eliminar — el cliente pide eliminar su cuenta: se le envía un enlace de confirmación por correo (nada se borra todavía).
import { getClienteActivo } from '@/lib/auth'
import { solicitarEliminacion } from '@/lib/cuenta-eliminar'
import { ok, err, unauthorized, errEspera, serverError } from '@/lib/api'

export async function POST() {
  const cli = await getClienteActivo()
  if (!cli) return unauthorized()
  try {
    const r = await solicitarEliminacion(cli.id)
    if (r.ok) return ok({ enviado: true })
    if (r.motivo === 'espera') return errEspera(r.espera)
    if (r.motivo === 'visita_en_vivo') return err('Tienes una visita en curso. Cuando termine podrás eliminar tu cuenta.', 409)
    if (r.motivo === 'ya_programada') return err('Tu cuenta ya está en proceso de eliminación.', 409)
    return err('No encontramos tu cuenta.', 404)
  } catch (e) { return serverError(e) }
}
