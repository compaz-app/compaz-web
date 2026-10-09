import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { asignarCompita } from '@/lib/usuarios'
import { LIMITES_PLAN } from '@/lib/pago'
import { ok, err, unauthorized, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const body = await req.json().catch(() => null) as { usuario_id?: string; compita_id?: string; plan?: string } | null
  if (!body?.usuario_id) return err('Falta usuario_id')

  if (body.plan && !(body.plan in LIMITES_PLAN)) return err('Plan inválido')
  try {
    await asignarCompita(body.usuario_id, body.compita_id || null, body.plan || null)
    return ok({ usuario_id: body.usuario_id, compita_id: body.compita_id || null })
  } catch (e) {
    return e instanceof Error && /compita/i.test(e.message) ? err(e.message, 409) : serverError(e)
  }
}
