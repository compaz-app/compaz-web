// POST /api/cron/recordatorios — enviado por Netlify Scheduled Function cada 5 min
// Busca llamadas en los próximos 30 min y envía recordatorios a cliente, compita y admin
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getSolicitudesParaRecordatorio, marcarRecordatorioEnviado } from '@/lib/solicitudes'
import { sendTelegramMessage } from '@/lib/telegram'
import { Resend } from 'resend'
import { ok, err } from '@/lib/api'

const resend = new Resend(process.env.RESEND_API_KEY)

function formatSlotVE(iso: string): string {
  return new Date(iso).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export async function POST(req: NextRequest) {
  // Verificar secreto del cron para que solo Netlify pueda llamarlo
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) return err('No autorizado', 401)

  const solicitudes = await getSolicitudesParaRecordatorio()
  const admin = createAdminSupabase()
  const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID

  for (const solicitud of solicitudes) {
    const slotLabel = formatSlotVE(solicitud.slot_confirmado!)
    const roomUrl = solicitud.room_url ?? ''
    const recordatorio20 = '⏱️ Recuerda: la llamada tiene un límite de 20 minutos. La sala se cierra automáticamente a los 23 min.'

    // Traer datos del cliente
    const { data: cliente } = await admin
      .from('usuarios')
      .select('nombre, email')
      .eq('id', solicitud.cliente_id)
      .single()

    // ── Email al cliente ────────────────────────────────────────────────────
    if (cliente) {
      try {
        await resend.emails.send({
          from: 'Compaz <visitas@micompaz.com>',
          to: cliente.email,
          subject: `⏰ En 30 minutos: tu llamada con ${solicitud.compita_nombre}`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">Tu llamada empieza en 30 minutos</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                Tienes una llamada con <strong>${solicitud.compita_nombre}</strong> hoy a las <strong>${slotLabel}</strong>.
              </p>
              <p style="color:#C84B0E;background:#FFF3E8;border:2px solid #FF6B2B;border-radius:12px;padding:14px;font-size:14px">
                ${recordatorio20}
              </p>
              <a href="${roomUrl}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:8px">
                Entrar a la llamada →
              </a>
              <p style="color:#6B5C90;font-size:13px;margin-top:24px">
                Compaz — <em>Cerca aunque estés lejos</em>
              </p>
            </div>
          `,
        })
      } catch (e) { console.error('Email recordatorio cliente:', e) }
    }

    // ── Telegram al compita ─────────────────────────────────────────────────
    const { data: compita } = await admin
      .from('compitas')
      .select('telegram_chat_id')
      .eq('id', solicitud.compita_id)
      .single()

    if (compita?.telegram_chat_id) {
      try {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          [
            `⏰ <b>Tu llamada empieza en 30 minutos</b>`,
            ``,
            `Con <b>${cliente?.nombre ?? 'el cliente'}</b> a las <b>${slotLabel}</b>.`,
            ``,
            `⏱️ La llamada es de <b>20 minutos</b>. La sala se cierra automáticamente a los 23 min.`,
            ``,
            `<a href="${roomUrl}">Entrar a la llamada →</a>`,
          ].join('\n'),
        )
      } catch (e) { console.error('Telegram recordatorio compita:', e) }
    }

    // ── Telegram al admin ───────────────────────────────────────────────────
    if (adminTg) {
      try {
        await sendTelegramMessage(
          adminTg,
          [
            `⏰ <b>Llamada en 30 minutos</b>`,
            ``,
            `<b>Cliente:</b> ${cliente?.nombre ?? ''} (${cliente?.email ?? ''})`,
            `<b>Compita:</b> ${solicitud.compita_nombre}`,
            `<b>Hora:</b> ${slotLabel}`,
            ``,
            `⏱️ Llamada de 20 min. Únete como supervisor:`,
            `<a href="${roomUrl}">Entrar a la sala →</a>`,
          ].join('\n'),
        )
      } catch (e) { console.error('Telegram recordatorio admin:', e) }
    }

    // Marcar como enviado para no repetir
    try {
      await marcarRecordatorioEnviado(solicitud.id)
    } catch (e) { console.error('Error marcando recordatorio:', e) }
  }

  return ok({ procesados: solicitudes.length })
}
