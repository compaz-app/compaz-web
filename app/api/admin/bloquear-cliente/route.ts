import { NextRequest } from 'next/server'
import { bloquearCliente } from '@/lib/usuarios'
import { requierePermiso } from '@/lib/permisos'
import { ok, err, serverError } from '@/lib/api'
import { anotarAccion } from '@/lib/acciones-equipo'

export async function POST(req: NextRequest) {
  const g = await requierePermiso('cuentas'); if (!g.ok) return g.res

  const { usuario_id, bloquear } = (await req.json().catch(() => ({})))
  if (!usuario_id) return err('usuario_id requerido')

  try { await bloquearCliente(usuario_id, !!bloquear) } catch (e) { return serverError(e) }
  await anotarAccion(g.actor.correo, bloquear ? 'bloqueó a un cliente' : 'desbloqueó a un cliente', { tipo: 'cliente', id: String(usuario_id) })

  return ok(null)
}
