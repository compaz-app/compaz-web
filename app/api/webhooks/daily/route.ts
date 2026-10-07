// POST /api/webhooks/daily
// Recibe eventos de Daily.co. Al detectar meeting-ended en una sala de entrevista,
// dispara inmediatamente el flujo post-llamada al cliente y al compita.
import { NextRequest, NextResponse } from 'next/server'
import { getSolicitudPorRoomUrl } from '@/lib/solicitudes'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''
const DAILY_WEBHOOK_SECRET = process.env.DAILY_WEBHOOK_SECRET ?? ''

function formatSlotVE(iso: string): string {
  return new Date(iso).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export async function POST(req: NextRequest) {
  // Verificar firma de Daily.co
  const signature = req.headers.get('x-daily-signature')
  if (DAILY_WEBHOOK_SECRET && signature !== DAILY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  const body = await req.json()
  const { event_type, payload } = body

  // Solo nos interesa meeting-ended en salas de entrevista (prefijo "ent-")
  if (event_type !== 'meeting.ended') return NextResponse.json({ ok: true })

  const roomName: string = payload?.room_name ?? ''
  const roomUrl: string = payload?.room_url ?? ''
  const durationSeg: number = payload?.duration ?? 0

  if (!roomName.startsWith('ent-')) return NextResponse.json({ ok: true })

  const solicitud = await getSolicitudPorRoomUrl(roomUrl)
  if (!solicitud) {
    console.error('Webhook Daily: no se encontró solicitud para room_url', roomUrl)
    return NextResponse.json({ ok: true })
  }

  // Marcar confirmacion_llamada_enviada para que el cron no la procese también
  const admin = createAdminSupabase()
  await admin.from('solicitudes')
    .update({ confirmacion_llamada_enviada: true })
    .eq('id', solicitud.id)

  const token = solicitud.token_respuesta
  const llamadaCorta = durationSeg < 180 // menos de 3 minutos = posible caída

  const { data: cliente } = await admin
    .from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()
  const { data: compita } = await admin
    .from('compitas').select('telegram_chat_id').eq('id', solicitud.compita_id).single()

  const contratarUrl = `${SITE_URL}/api/solicitud/resultado-llamada?token=${token}&resultado=contratar`
  const reagendarUrl = `${SITE_URL}/api/solicitud/resultado-llamada?token=${token}&resultado=reagendar`
  const noUrl = `${SITE_URL}/api/solicitud/resultado-llamada?token=${token}&resultado=no_contratar`
  const compitaReagendarUrl = `${SITE_URL}/api/solicitud/resultado-llamada?token=${token}&resultado=reagendar&quien=compita`

  const slotLabel = solicitud.slot_confirmado ? formatSlotVE(solicitud.slot_confirmado) : ''
  const nombreCliente = cliente?.nombre?.split(' ')[0] ?? 'Cliente'

  // ── Email al cliente ────────────────────────────────────────────────────────
  if (cliente?.email) {
    const tituloEmail = llamadaCorta
      ? `¿Pudiste hablar con ${solicitud.compita_nombre}?`
      : `¿Qué decidiste sobre ${solicitud.compita_nombre}?`

    const introEmail = llamadaCorta
      ? `Parece que la llamada fue muy corta o tuvo problemas técnicos. ¿Qué pasó?`
      : `Tu llamada con <strong>${solicitud.compita_nombre}</strong> acaba de terminar. ¿Qué decides?`

    try {
      await resend.emails.send({
        from: 'Compaz <visitas@micompaz.com>',
        to: cliente.email,
        subject: tituloEmail,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px">${tituloEmail}</h2>
            <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
              Hola${cliente.nombre ? `, <strong>${nombreCliente}</strong>` : ''}. ${introEmail}
            </p>
            <div style="display:flex;flex-direction:column;gap:12px;margin-top:24px">
              ${!llamadaCorta ? `
              <a href="${contratarUrl}" style="display:inline-block;background:#22C55E;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;text-align:center">
                ✅ Sí, quiero contratar a ${solicitud.compita_nombre}
              </a>` : ''}
              <a href="${reagendarUrl}" style="display:inline-block;background:#6B5C90;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:15px;text-align:center;margin-top:${llamadaCorta ? '0' : '4px'}">
                🔄 ${llamadaCorta ? 'La llamada se cortó — quiero reagendar' : 'Quiero reagendar para hablar más'}
              </a>
              <a href="${noUrl}" style="display:inline-block;background:#E8E0D4;color:#1A0A3C;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:15px;text-align:center;margin-top:4px">
                ❌ ${llamadaCorta ? 'No pude hablar — ver otros compitas' : 'No es lo que busco — ver otros perfiles'}
              </a>
            </div>
            <p style="color:#6B5C90;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>
        `,
      })
    } catch (e) { console.error('Email post-llamada cliente:', e) }
  }

  // ── Telegram al compita ─────────────────────────────────────────────────────
  if (compita?.telegram_chat_id) {
    try {
      if (llamadaCorta) {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          `📞 La llamada con <b>${cliente?.nombre ?? 'el cliente'}</b> parece que tuvo problemas técnicos.\n\n¿Qué pasó?`,
          { inline_keyboard: [[
            { text: '✅ Estuvo bien', url: `${SITE_URL}/api/solicitud/resultado-llamada?token=${token}&resultado=bien&quien=compita` },
            { text: '🔄 Necesitamos reagendar', url: compitaReagendarUrl },
          ]] },
        )
      } else {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          `✅ <b>¡Gracias por la llamada!</b>\n\nLa entrevista con <b>${cliente?.nombre ?? 'el cliente'}</b> terminó.\n\nEstaremos en contacto según lo que decida la familia. Si tuviste algún problema técnico, avísanos.`,
          { inline_keyboard: [[
            { text: '🔄 Tuvimos problemas — reagendar', url: compitaReagendarUrl },
          ]] },
        )
      }
    } catch (e) { console.error('Telegram post-llamada compita:', e) }
  }

  return NextResponse.json({ ok: true })
}
