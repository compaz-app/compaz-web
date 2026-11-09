import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { createAdminSupabase } from '@/lib/supabase-server'
import { ok, err, serverError } from '@/lib/api'

// GET /api/admin/resenas — lista todas las reseñas (pendientes primero)
export async function GET(_req: NextRequest) {
  const g = await requierePermiso('atender')
  if (!g.ok) return g.res

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('resenas')
    .select('*, compita:compitas(nombre), cliente:usuarios(nombre, email)')
    .order('publicada', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return serverError('Error al obtener reseñas')
  return ok(data)
}

// PATCH /api/admin/resenas — publicar o ocultar una reseña { id, publicada }
export async function PATCH(req: NextRequest) {
  const g = await requierePermiso('atender')
  if (!g.ok) return g.res

  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  const publicada = typeof body?.publicada === 'boolean' ? body.publicada : null

  if (!id || publicada === null) return err('Parámetros inválidos', 400)

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('resenas')
    .update({ publicada })
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) return serverError('Error al actualizar reseña')
  return ok(data)
}
