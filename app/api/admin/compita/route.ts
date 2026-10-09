import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { ok, err, unauthorized, notFound, serverError } from '@/lib/api'
import { actualizarCompita, getCompitaAdminById } from '@/lib/compitas'

export async function PUT(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { id, ...campos } = (await req.json().catch(() => ({})))
  if (!id) return err('id requerido')

  const existente = await getCompitaAdminById(id)
  if (!existente) return notFound('Compita')

  try {
    const actualizada = await actualizarCompita(id, campos)
    return ok(actualizada)
  } catch (e) {
    return serverError(e)
  }
}
