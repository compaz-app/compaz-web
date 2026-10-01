import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import type { Visita, Compita } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: { contenido: string }
  try {
    body = await req.json() as { contenido: string }
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const contenido = body.contenido?.trim()
  if (!contenido || contenido.length > 1000) {
    return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 })
  }

  const admin = createAdminSupabase()

  // Verificar visita activa del usuario
  const { data: visita } = await admin
    .from('visitas')
    .select('*, compita:compitas(*)')
    .eq('usuario_id', user.id)
    .eq('estado', 'en_curso')
    .single() as { data: (Visita & { compita: Compita }) | null }

  if (!visita) {
    return NextResponse.json({ error: 'No hay visita activa' }, { status: 400 })
  }

  // Guardar mensaje en Supabase
  const { data: mensaje, error } = await admin
    .from('mensajes')
    .insert({
      visit_id: visita.id,
      origen: 'cliente',
      tipo: 'texto',
      contenido,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Error guardando mensaje' }, { status: 500 })
  }

  // Reenviar al Compita por Telegram
  if (visita.compita.telegram_chat_id) {
    try {
      await sendTelegramMessage(
        visita.compita.telegram_chat_id,
        `💬 Mensaje del cliente:\n\n${contenido}`
      )
    } catch (e) {
      console.error('Error reenviando a Telegram:', e)
    }
  }

  return NextResponse.json({ ok: true, mensaje })
}
