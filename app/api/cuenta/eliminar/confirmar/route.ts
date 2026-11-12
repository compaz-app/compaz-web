// POST /api/cuenta/eliminar/confirmar { token } — el enlace del correo. Va por POST (no GET) para que los antivirus y vistas previas de correo no lo gasten.
import { NextRequest } from 'next/server'
import { confirmarEliminacion } from '@/lib/cuenta-eliminar'
import { ok, err, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: unknown }
  if (typeof token !== 'string') return err('Enlace no válido.', 400)
  try {
    const r = await confirmarEliminacion(token)
    if (r.ok) return ok({ borra_el: r.borraEl })
    if (r.motivo === 'enlace_vencido') return err('Este enlace venció. Pide uno nuevo desde tu portal, en Mi plan.', 410)
    if (r.motivo === 'visita_en_vivo') return err('Tienes una visita en curso. Cuando termine podrás eliminar tu cuenta.', 409)
    return err('Este enlace no es válido o ya se usó. Si necesitas uno nuevo, pídelo desde tu portal, en Mi plan.', 400)
  } catch (e) { return serverError(e) }
}
