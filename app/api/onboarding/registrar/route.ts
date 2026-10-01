import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { token, nombre, zona, descripcion, habilidades, servicios, foto_url, youtube_url } = await req.json()

  if (!token || !nombre || !zona || !descripcion || !servicios?.length) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const admin = createAdminSupabase()

  // Validar token una vez más (atómicamente lo marcamos como usado)
  const { data: tkn } = await admin
    .from('onboarding_tokens')
    .select('id, expires_at, usado')
    .eq('token', token)
    .single()

  if (!tkn || tkn.usado || new Date(tkn.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 400 })
  }

  // Crear la compita
  const { error: insertError } = await admin
    .from('compitas')
    .insert({
      nombre,
      zona,
      descripcion: habilidades ? `${descripcion}\n\nHabilidades especiales: ${habilidades}` : descripcion,
      servicios,
      foto_url: foto_url ?? null,
      youtube_url: youtube_url || null,
      estado: 'inactivo',
      verificado: false,
      visitas_realizadas: 0,
    })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Marcar token como usado
  await admin
    .from('onboarding_tokens')
    .update({ usado: true })
    .eq('id', tkn.id)

  return NextResponse.json({ ok: true })
}
