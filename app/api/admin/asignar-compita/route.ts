import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { asignarCompita } from '@/lib/usuarios'
import { ok, err, serverError } from '@/lib/api'
import { anotarAccion } from '@/lib/acciones-equipo'

export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res

  const body = await req.json().catch(() => null) as { usuario_id?: string; compita_id?: string } | null
  if (!body?.usuario_id) return err('Falta usuario_id')

  try {
    await asignarCompita(body.usuario_id, body.compita_id || null)
    await anotarAccion(g.actor.correo, body.compita_id ? 'asignó un compita a un cliente' : 'quitó el compita a un cliente', { tipo: 'cliente', id: body.usuario_id })
    return ok({ usuario_id: body.usuario_id, compita_id: body.compita_id || null })
  } catch (e) {
    return e instanceof Error && /compita/i.test(e.message) ? err(e.message, 409) : serverError(e)
  }
}
