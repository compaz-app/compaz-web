// POST /api/admin/enviar-link-llamada
// Fuerza el envío del link de sala al cliente y al compita para una solicitud específica.
// Solo admins. No modifica slot_confirmado ni ningún campo de estado.
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { guardarRoomUrl } from '@/lib/solicitudes'
import { createEntrevistaRoom } from '@/lib/daily'
import { sendTelegramMessage } from '@/lib/telegram'
import { Resend } from 'resend'
import { ok, unauthorized, err, notFound, serverError } from '@/lib/api'

const resend = new Resend(process.env.RESEND_API_KEY)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''

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
  try { await requireAdmin() } catch { return unauthorized() }

  const { solicitud_id } = await req.json() as { solicitud_id?: string }
  if (!solicitud_id) return err('Falta solicitud_id')

  const admin = createAdminSupabase()

  const { data: row } = await admin
    .from('solicitudes')
    .select('id, cliente_id, compita_id, slot_confirmado, room_url, token_respuesta, compitas(nombre, telegram_chat_id)')
    .eq('id', solicitud_id)
    .single()

  if (!row) return notFound('Solicitud no encontrada')
  if (!row.slot_confirmado) return err('La solicitud no tiene slot confirmado')

  const compitaData = row.compitas as unknown as { nombre: string; telegram_chat_id: string | null } | null
  const slotLabel = formatSlotVE(row.slot_confirmado)

  // Crear sala si no existe, reusar si ya existe
  let roomUrl = row.room_url as string | null
  if (!roomUrl) {
    try {
      const room = await createEntrevistaRoom(row.id, new Date(row.slot_confirmado))
      roomUrl = room.url
      await guardarRoomUrl(row.id, roomUrl)
    } catch (e) {
      console.error('Error creando sala Daily:', e)
      return serverError('No se pudo crear la sala Daily')
    }
  }

  const { data: cliente } = await admin
    .from('usuarios')
    .select('nombre, email')
    .eq('id', row.cliente_id)
    .single()

  const salaClienteUrl = `${SITE_URL}/sala/${row.token_respuesta}?quien=cliente`
  const salaCompitaUrl = `${SITE_URL}/sala/${row.token_respuesta}?quien=compita`
  const resultados: string[] = []

  // ── Email al cliente ──────────────────────────────────────────────────────
  if (cliente?.email) {
    try {
      await resend.emails.send({
        from: 'Compaz <visitas@micompaz.com>',
        to: cliente.email,
        subject: `⏰ Tu llamada con ${compitaData?.nombre ?? 'tu compita'} — link de acceso`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px">Tu link de llamada está listo</h2>
            <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
              Tu llamada con <strong>${compitaData?.nombre ?? 'tu compita'}</strong> está programada para:<br>
              <strong>${slotLabel}</strong>
            </p>
            <p style="color:#C84B0E;background:#FFF3E8;border:2px solid #FF6B2B;border-radius:12px;padding:14px;font-size:14px">
              ⏱️ Recuerda: la llamada tiene un límite de 20 minutos. La sala se cierra automáticamente a los 23 min.
            </p>
            <a href="${salaClienteUrl}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:8px">
              Entrar a la llamada →
            </a>
            <p style="color:#6B5C90;font-size:13px;margin-top:24px">
              Compaz — <em>Cerca aunque estés lejos</em>
            </p>
          </div>
        `,
      })
      resultados.push('email_cliente: ok')
    } catch (e) {
      console.error('Email cliente:', e)
      resultados.push('email_cliente: error')
    }
  } else {
    resultados.push('email_cliente: sin email')
  }

  // ── Telegram al compita ───────────────────────────────────────────────────
  if (compitaData?.telegram_chat_id) {
    try {
      await sendTelegramMessage(
        compitaData.telegram_chat_id,
        [
          `⏰ <b>Link de tu llamada listo</b>`,
          ``,
          `Con <b>${cliente?.nombre ?? 'el cliente'}</b> — <b>${slotLabel}</b>`,
          ``,
          `⏱️ La llamada es de <b>20 minutos</b>. La sala se cierra a los 23 min.`,
          ``,
          `<a href="${salaCompitaUrl}">Entrar a la llamada →</a>`,
        ].join('\n'),
      )
      resultados.push('telegram_compita: ok')
    } catch (e) {
      console.error('Telegram compita:', e)
      resultados.push('telegram_compita: error')
    }
  } else {
    resultados.push('telegram_compita: sin chat_id')
  }

  return ok({ room_url: roomUrl, resultados })
}
