import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAdminUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!(await getAdminUser())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const usuarioId = req.nextUrl.searchParams.get('usuario_id')
  if (!usuarioId) return NextResponse.json({ error: 'Falta usuario_id' }, { status: 400 })

  const admin = createAdminSupabase()

  const { data: usuario } = await admin
    .from('usuarios')
    .select('*, compita:compitas(*)')
    .eq('id', usuarioId)
    .single()

  const { data: visitaActiva } = await admin
    .from('visitas')
    .select('*, compita:compitas(*)')
    .eq('usuario_id', usuarioId)
    .eq('estado', 'en_curso')
    .order('inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  let mensajes: unknown[] = []
  if (visitaActiva) {
    const { data } = await admin
      .from('mensajes')
      .select('*')
      .eq('visit_id', visitaActiva.id)
      .order('created_at', { ascending: true })
    mensajes = data ?? []
  }

  const { data: visitasPasadas } = await admin
    .from('visitas')
    .select('*, compita:compitas(nombre)')
    .eq('usuario_id', usuarioId)
    .eq('estado', 'terminada')
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ usuario, visitaActiva, mensajes, visitasPasadas: visitasPasadas ?? [] })
}
