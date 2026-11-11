import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { desactivarCompita, reactivarCompita, CompitaNoPermitidaPorCmc } from '@/lib/compitas'
import { ok, err, unauthorized, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { compita_id, estado } = (await req.json().catch(() => ({})) as { compita_id: string; estado: string })
  if (!compita_id || !['activo', 'inactivo'].includes(estado)) return err('Parámetros inválidos')

  try {
    if (estado === 'inactivo') {
      await desactivarCompita(compita_id)
    } else {
      await reactivarCompita(compita_id)
    }
    return ok({ compita_id, estado })
  } catch (e) {
    if (e instanceof CompitaNoPermitidaPorCmc) return err(e.message, 409)
    return serverError(e)
  }
}
