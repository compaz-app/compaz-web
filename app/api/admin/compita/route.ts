import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { ok, err, notFound, serverError } from '@/lib/api'
import { actualizarCompita, getCompitaAdminById } from '@/lib/compitas'
import { anotarAccion } from '@/lib/acciones-equipo'

export async function PUT(req: NextRequest) {
  const g = await requierePermiso('cuentas'); if (!g.ok) return g.res

  const { id, ...campos } = (await req.json().catch(() => ({})))
  if (!id) return err('id requerido')

  const existente = await getCompitaAdminById(id)
  if (!existente) return notFound('Compita')

  try {
    const actualizada = await actualizarCompita(id, campos)
    await anotarAccion(g.actor.correo, `editó el perfil del compita (${Object.keys(campos).join(', ')})`, { tipo: 'compita', id })
    return ok(actualizada)
  } catch (e) {
    return serverError(e)
  }
}
