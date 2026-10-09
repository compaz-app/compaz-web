import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getClienteActivo } from '@/lib/auth'
import { sendTelegramMessage } from '@/lib/telegram'
import type { Visita, Compita, Usuario } from '@/types'

export async function POST(req: NextRequest) {
  const user = await getClienteActivo()

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

  // Verificar visita activa o en coordinación del usuario
  const { data: visita } = await admin
    .from('visitas')
    .select('*, compita:compitas(*), usuario:usuarios(*)')
    .eq('usuario_id', user.id)
    .in('estado', ['en_curso', 'pre_visita', 'programada'])
    .order('estado', { ascending: true }) // 'en_curso' primero
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: (Visita & { compita: Compita; usuario: Usuario }) | null }

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
    const nombreCliente = visita.usuario?.nombre ?? 'El cliente'
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    try {
      await sendTelegramMessage(
        visita.compita.telegram_chat_id,
        `💬 <b>${escapeHtml(nombreCliente)}:</b>\n\n${escapeHtml(contenido)}`
      )
    } catch (e) {
      console.error('Error reenviando a Telegram:', e)
    }
  } else {
    console.error('[send-message] compita sin Telegram vinculado; mensaje guardado pero no entregado', visita.id)
  }

  return NextResponse.json({ ok: true, mensaje })
}
