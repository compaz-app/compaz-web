import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { verificarCompita, desactivarCompita } from '@/lib/compitas'
import { ok, err, unauthorized, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { compita_id, verificado } = (await req.json().catch(() => ({})) as { compita_id: string; verificado: boolean })
  if (!compita_id || typeof verificado !== 'boolean') return err('Parámetros inválidos')

  try {
    if (verificado) {
      await verificarCompita(compita_id)
    } else {
      await desactivarCompita(compita_id)
    }
    return ok({ compita_id, verificado })
  } catch (e) {
    return serverError(e)
  }
}
