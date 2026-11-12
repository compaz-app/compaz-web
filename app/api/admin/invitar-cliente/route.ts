// POST /api/admin/invitar-cliente — { nombre, email }
// Crea la cuenta del cliente y le envía UN solo correo (el de bienvenida) con un botón que activa la cuenta y entra directo al portal (/auth/confirm).
// Si el cliente ya está registrado NO se reinvita (409): para volver a entrar usa /login. No usa el correo de invitación de Supabase.
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { invitarCliente } from '@/lib/acciones-equipo'
import { revisarCorreo } from '@/lib/validar'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  const g = await requierePermiso('invitar'); if (!g.ok) return g.res
  const { nombre, email: emailRaw } = (await req.json().catch(() => ({}))) as { nombre?: string; email?: string }
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : ''
  if (!nombre || !email) return err('Faltan datos')
  const rev = revisarCorreo(email)
  if (!rev.ok) return err(rev.error) // dice qué está mal y, si se puede, cómo corregirlo
  if (typeof nombre !== 'string' || nombre.length > 100) return err('Datos inválidos')
  const r = await invitarCliente(nombre, email, g.actor.correo)
  return r.ok ? ok(r.data) : err(r.error, r.status)
}
