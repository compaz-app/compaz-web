import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())

export async function POST(req: NextRequest) {
  const supabaseAuth = await createServerSupabase()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { nombre, email } = await req.json()
  if (!nombre || !email) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const admin = createAdminSupabase()

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Crear registro en usuarios si no existe
  await admin.from('usuarios').upsert({ id: data.user.id, email, nombre }, { onConflict: 'id', ignoreDuplicates: true })

  return NextResponse.json({ ok: true })
}
