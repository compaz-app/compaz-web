// /api/admin/equipo — gestión de colaboradores. Solo el administrador raíz (ADMIN_EMAILS): un colaborador
// nunca puede darse permisos a sí mismo ni a otros, aunque tenga todos los demás.
//   GET    → lista del equipo
//   POST   { correo, nombre, permisos? }  → invita (permisos por defecto: ninguno)
//   PATCH  { correo, permisos? , activo? } → cambia permisos y/o activa o desactiva
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { listarEquipo, invitarColaborador, cambiarPermisos, cambiarActivo } from '@/lib/equipo'
import { ok, err, serverError } from '@/lib/api'

function permisosDe(v: unknown): Record<string, boolean> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return v as Record<string, boolean>
}

export async function GET() {
  const g = await requierePermiso('raiz')
  if (!g.ok) return g.res
  try { return ok(await listarEquipo()) } catch (e) { return serverError(e) }
}

export async function POST(req: NextRequest) {
  const g = await requierePermiso('raiz')
  if (!g.ok) return g.res
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b || typeof b.correo !== 'string' || typeof b.nombre !== 'string') return err('Faltan el correo y el nombre')
  const r = await invitarColaborador(b.correo, b.nombre, permisosDe(b.permisos) ?? {}, g.actor.correo)
  return r.ok ? ok(r.colaborador, 201) : err(r.error, r.status)
}

export async function PATCH(req: NextRequest) {
  const g = await requierePermiso('raiz')
  if (!g.ok) return g.res
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b || typeof b.correo !== 'string') return err('Falta el correo')
  const perm = b.permisos === undefined ? undefined : permisosDe(b.permisos)
  if (b.permisos !== undefined && !perm) return err('Los permisos deben ser un objeto')
  if (b.activo !== undefined && typeof b.activo !== 'boolean') return err('"activo" debe ser verdadero o falso')
  if (perm === undefined && b.activo === undefined) return err('No hay nada que cambiar')
  let r
  if (perm) r = await cambiarPermisos(b.correo, perm, g.actor.correo)
  if ((!r || r.ok) && typeof b.activo === 'boolean') r = await cambiarActivo(b.correo, b.activo, g.actor.correo)
  return r!.ok ? ok(r!.colaborador) : err(r!.error, r!.status)
}
