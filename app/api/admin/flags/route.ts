import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { ok, err, unauthorized, serverError } from '@/lib/api'

async function requireAdmin() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email ?? '')) return null
  return user
}

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

  const body = await req.json() as {
    entidad_tipo: 'visita' | 'compita' | 'cliente'
    entidad_id: string
    entidad_nombre: string
    nota: string
    reportado_por: string
  }

  if (!body.entidad_tipo || !body.entidad_id || !body.nota?.trim() || !body.reportado_por?.trim()) {
    return err('Faltan campos requeridos')
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('admin_flags')
    .insert({
      entidad_tipo: body.entidad_tipo,
      entidad_id: body.entidad_id,
      entidad_nombre: body.entidad_nombre ?? '',
      nota: body.nota.trim(),
      reportado_por: body.reportado_por.trim(),
      resuelto: false,
    })
    .select()
    .single()

  if (error) return serverError(error)
  return ok(data)
}

// PATCH /api/admin/flags — resolver flag
export async function PATCH(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return unauthorized()

  const { flag_id } = await req.json() as { flag_id: string }
  if (!flag_id) return err('flag_id requerido')

  const admin = createAdminSupabase()
  const { error } = await admin
    .from('admin_flags')
    .update({ resuelto: true, resuelto_at: new Date().toISOString() })
    .eq('id', flag_id)

  if (error) return serverError(error)
  return ok(null)
}
