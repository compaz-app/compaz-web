import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAdminUser } from '@/lib/auth'
import { ok, err, unauthorized, serverError } from '@/lib/api'

const requireAdmin = getAdminUser

// GET /api/admin/flags — listar flags abiertos
export async function GET(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return unauthorized()

  const { searchParams } = req.nextUrl
  const resueltos = searchParams.get('resueltos') === 'true'

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('admin_flags')
    .select('*')
    .eq('resuelto', resueltos)
    .order('created_at', { ascending: false })

  if (error) return serverError(error)
  return ok(data)
}

// POST /api/admin/flags — crear flag
export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return unauthorized()

  const body = await req.json().catch(() => null) as {
    entidad_tipo: 'visita' | 'compita' | 'cliente'
    entidad_id: string
    entidad_nombre: string
    nota: string
  } | null

  if (!body || !['visita', 'compita', 'cliente'].includes(body.entidad_tipo) || !body.entidad_id || !body.nota?.trim()) {
    return err('Faltan campos requeridos')
  }
  if (body.nota.length > 2000) return err('La nota es demasiado larga')

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('admin_flags')
    .insert({
      entidad_tipo: body.entidad_tipo,
      entidad_id: body.entidad_id,
      entidad_nombre: body.entidad_nombre ?? '',
      nota: body.nota.trim(),
      reportado_por: user.email ?? 'admin', // identidad de la sesión, no del body
      resuelto: false,
    })
    .select()
    .single()

  if (error) {
    console.error('[flags POST]', JSON.stringify(error))
    return serverError(error)
  }
  return ok(data)
}

// PATCH /api/admin/flags — resolver flag
export async function PATCH(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return unauthorized()

  const { flag_id } = (await req.json().catch(() => ({}))) as { flag_id: string }
  if (!flag_id) return err('flag_id requerido')

  const admin = createAdminSupabase()
  const { error } = await admin
    .from('admin_flags')
    .update({ resuelto: true, resuelto_at: new Date().toISOString() })
    .eq('id', flag_id)

  if (error) return serverError(error)
  return ok(null)
}
