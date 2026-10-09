import { NextRequest, NextResponse } from 'next/server'
import { registerWebhook } from '@/lib/telegram'
import { getAdminUser } from '@/lib/auth'

// Ruta de administración: registra el webhook de Telegram apuntando a este servidor
// Llamar una sola vez después del deploy: GET /api/setup-webhook
export async function GET(req: NextRequest) {
  if (!(await getAdminUser())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin
  const webhookUrl = `${baseUrl}/api/telegram-webhook`

  try {
    await registerWebhook(webhookUrl)
    return NextResponse.json({ ok: true, webhook: webhookUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
