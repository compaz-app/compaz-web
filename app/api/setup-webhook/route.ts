import { NextRequest, NextResponse } from 'next/server'
import { registerWebhook } from '@/lib/telegram'
import { isAdminEmail } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase-server'

// Ruta de administración: registra el webhook de Telegram apuntando a este servidor
// Llamar una sola vez después del deploy: GET /api/setup-webhook
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdminEmail(user.email ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const baseUrl = req.nextUrl.origin
  const webhookUrl = `${baseUrl}/api/telegram-webhook`

  try {
    await registerWebhook(webhookUrl)
    return NextResponse.json({ ok: true, webhook: webhookUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
