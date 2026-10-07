// GET /api/solicitud/reconectar-llamada?token=xxx&quien=cliente|compita
// Crea sala nueva y avisa a la otra parte: si reconecta el cliente → Telegram al compita,
// si reconecta el compita → email al cliente.
import { NextRequest, NextResponse } from 'next/server'
import { getSolicitudPorToken, guardarRoomUrl } from '@/lib/solicitudes'
import { createEntrevistaRoom } from '@/lib/daily'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const quien = req.nextUrl.searchParams.get('quien') === 'compita' ? 'compita' : 'cliente'
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

  const admin = createAdminSupabase()

  // nbf = slotConfirmado - 5min → para que nbf ≈ ahora, pasamos now + 5min
  // exp = slotConfirmado + 23min = ahora + 28min → sala abierta ~28 min
  let roomUrl: string
  try {
    const room = await createEntrevistaRoom(solicitud.id, new Date(Date.now() + 5 * 60 * 1000))
    roomUrl = room.url
    await guardarRoomUrl(solicitud.id, roomUrl)
  } catch (e) {
    console.error('Error creando sala reconexión:', e)
    return NextResponse.json({ error: 'No se pudo crear la sala' }, { status: 500 })
  }

  const salaClienteUrl = `${SITE_URL}/sala/${token}?quien=cliente`
  const salaCompitaUrl = `${SITE_URL}/sala/${token}?quien=compita`

  const { data: compita } = await admin.from('compitas').select('telegram_chat_id, nombre').eq('id', solicitud.compita_id!).single()
  const { data: cliente } = await admin.from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()

  if (quien === 'cliente') {
    // Cliente reconecta → avisar al compita por Telegram
    if (compita?.telegram_chat_id) {
      try {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          `⚡ <b>La llamada se cayó</b>\n\n<b>${cliente?.nombre ?? 'El cliente'}</b> quiere retomar la llamada ahora mismo. Se creó una sala nueva.\n\n👉 Toca el enlace de abajo para entrar. La sala estará abierta por 30 minutos.\n\n<a href="${salaCompitaUrl}">Entrar a la nueva sala →</a>`,
        )
      } catch (e) { console.error('Telegram reconexión compita:', e) }
    }
  } else {
    // Compita reconecta → avisar al cliente por email
    if (cliente?.email) {
      try {
        await resend.emails.send({
          from: 'Compaz <visitas@micompaz.com>',
          to: cliente.email,
          subject: `${solicitud.compita_nombre} quiere retomar la llamada`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">Nueva sala lista</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                La llamada se cortó pero <strong>${solicitud.compita_nombre}</strong> está listo para retomar ahora.
              </p>
              <a href="${salaClienteUrl}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:16px">
                Entrar a la nueva sala →
              </a>
              <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>
          `,
        })
      } catch (e) { console.error('Email reconexión cliente:', e) }
    }
  }

  return NextResponse.json({ room_url: roomUrl })
}
