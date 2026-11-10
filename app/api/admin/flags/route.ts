import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { requierePermiso } from '@/lib/permisos'
import { recortarTexto } from '@/lib/panel-datos'
import { alertaAdmin } from '@/lib/alertas-admin'
import { ok, err, serverError } from '@/lib/api'

// GET /api/admin/flags — listar flags abiertos
export async function GET(req: NextRequest) {
  const g = await requierePermiso('atender')
  if (!g.ok) return g.res
  const user = { email: g.actor.correo }

  const { searchParams } = req.nextUrl
  const resueltos = searchParams.get('resueltos') === 'true'

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('admin_flags')
    .select('*')
    .eq('resuelto', resueltos)
    .order('created_at', { ascending: false })

  if (error) return serverError(error)
  // Sin el permiso de teléfonos, las notas llegan sin teléfonos ni correos (se recorta en el servidor).
  return ok((data ?? []).map((f) => ({ ...f, nota: recortarTexto(g.actor, String(f.nota ?? '')), entidad_nombre: recortarTexto(g.actor, String(f.entidad_nombre ?? '')) })))
}

// POST /api/admin/flags — crear flag
export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender')
  if (!g.ok) return g.res
  const user = { email: g.actor.correo }

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
  const g = await requierePermiso('atender')
  if (!g.ok) return g.res
  const user = { email: g.actor.correo }

  const { flag_id } = (await req.json().catch(() => ({}))) as { flag_id: string }
  if (!flag_id) return err('flag_id requerido')

  const admin = createAdminSupabase()
  const { data: previa } = await admin.from('admin_flags').select('entidad_nombre, resuelto').eq('id', flag_id).maybeSingle()
  const { error } = await admin
    .from('admin_flags')
    .update({ resuelto: true, resuelto_at: new Date().toISOString() })
    .eq('id', flag_id)

  if (error) return serverError(error)
  // Queda anotado QUIÉN resolvió qué (el equipo se reparte la bandeja y esto evita duplicar trabajo).
  if (previa && !(previa as { resuelto: boolean }).resuelto) await alertaAdmin('actividad', `Tarea resuelta por ${user.email}: ${String((previa as { entidad_nombre: string }).entidad_nombre ?? '')}`, { categoria: 'tarea_resuelta' })
  return ok(null)
}
