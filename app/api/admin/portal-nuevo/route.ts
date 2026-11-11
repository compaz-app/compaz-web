// PATCH { usuario_id, activo: true | false | null } — activa el portal nuevo para UN cliente (true), lo deja en el viejo (false) o lo devuelve
// al interruptor general de Ajustes (null). Es la activación por etapas: equipo → familias de confianza → todos. Permiso de cuentas.
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { fijarPortalNuevo } from '@/lib/portal-activacion'
import { ok, err, notFound } from '@/lib/api'

export async function PATCH(req: NextRequest) {
  const g = await requierePermiso('cuentas'); if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { usuario_id?: unknown; activo?: unknown } | null
  if (!b || typeof b.usuario_id !== 'string' || !(b.activo === true || b.activo === false || b.activo === null)) return err('Faltan datos: usuario_id y activo (true, false o null)', 400)
  return (await fijarPortalNuevo(b.usuario_id, b.activo, g.actor.correo ?? 'equipo')) ? ok({ activo: b.activo }) : notFound('Cliente')
}
