// POST /api/admin/enviar-link-llamada
// Fuerza el envío del link de sala al cliente y al compita para una solicitud específica,
// y adelanta slot_confirmado a ahora mismo para que la sala quede abierta de inmediato
// (la página /sala calcula la apertura en base a ese campo, no en base a cuándo se envió el link).
// Solo admins.
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { guardarRoomUrl } from '@/lib/solicitudes'
import { createEntrevistaRoom } from '@/lib/daily'
import { sendTelegramMessage } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { formatSlotVE } from '@/lib/format'
import { qRol } from '@/lib/links'
import { reclamarFlag } from '@/lib/solicitudes'
import { ok, unauthorized, err, notFound, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { solicitud_id } = (await req.json().catch(() => ({}))) as { solicitud_id?: string }
  if (!solicitud_id) return err('Falta solicitud_id')

  const admin = createAdminSupabase()

  const { data: row } = await admin
    .from('solicitudes')
    .select('id, cliente_id, compita_id, slot_confirmado, room_url, token_respuesta, compitas(nombre, telegram_chat_id, email)')
    .eq('id', solicitud_id)
    .single()

  if (!row) return notFound('Solicitud no encontrada')
  if (!row.slot_confirmado) return err('La solicitud no tiene slot confirmado')

  const compitaData = row.compitas as unknown as { nombre: string; telegram_chat_id: string | null; email: string | null } | null

  // Forzar la hora a ahora mismo: la página /sala solo se abre 10 min antes de slot_confirmado,
  // así que si el admin fuerza el envío, el slot debe adelantarse para que la sala quede
  // abierta de inmediato (en vez de seguir bloqueada hasta la hora original pactada).
  const ahoraIso = new Date().toISOString()
  const { error: eSlot } = await admin.from('solicitudes').update({ slot_confirmado: ahoraIso }).eq('id', row.id)
  if (eSlot) {
    console.error('Error adelantando slot_confirmado:', eSlot)
    return serverError(eSlot)
  }
  row.slot_confirmado = ahoraIso
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
      return err('No se pudo crear la sala Daily', 502)
    }
  }

  const { data: cliente } = await admin
    .from('usuarios')
    .select('nombre, email')
    .eq('id', row.cliente_id)
    .single()

  const t = row.token_respuesta as string
  const salaClienteUrl = `${SITE_URL}/sala/${t}?${qRol(t, 'cliente')}`
  const salaCompitaUrl = `${SITE_URL}/sala/${t}?${qRol(t, 'compita')}`
  const resultados: string[] = []

  // ── Email al cliente ──────────────────────────────────────────────────────
  if (cliente?.email) {
    try {
      await sendEmail({
        to: cliente.email,
        subject: `⏰ Tu llamada con ${compitaData?.nombre ?? 'tu compita'} — link de acceso`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px">Tu link de llamada está listo</h2>
            <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
              Tu llamada con <strong>${esc(compitaData?.nombre ?? 'tu compita')}</strong> está programada para:<br>
              <strong>${esc(slotLabel)}</strong>
            </p>
            <p style="color:#C84B0E;background:#FFF3E8;border:2px solid #FF6B2B;border-radius:12px;padding:14px;font-size:14px">
              ⏱️ Recuerda: la llamada tiene un límite de 20 minutos. La sala se cierra automáticamente a los 23 min.
            </p>
            <a href="${salaClienteUrl}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:8px">
              Entrar a la llamada →
            </a>
            <p style="color:#6B5C90;font-size:14px;line-height:1.6;margin-top:24px">¿Surgió algo y no puedes a esa hora? Propón nuevos horarios aquí:</p>
            <a href="${SITE_URL}/reagendar/${encodeURIComponent(t)}" style="display:inline-block;background:#6B5C90;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:14px;margin-top:4px">🔄 Reagendar llamada</a>
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
          `Con <b>${esc(cliente?.nombre ?? 'el cliente')}</b> — <b>${esc(slotLabel)}</b>`,
          ``,
          `⏱️ La llamada es de <b>20 minutos</b>. La sala se cierra a los 23 min.`,
          ``,
          `Si no puedes a esa hora, toca Reagendar abajo.`,
        ].join('\n'),
        { inline_keyboard: [[{ text: '▶️ Entrar a la llamada', url: salaCompitaUrl }, { text: '🔄 Reagendar', url: `${SITE_URL}/api/solicitud/reagendar-compita?token=${t}&${qRol(t, 'compita')}` }]] },
      )
      resultados.push('telegram_compita: ok')
    } catch (e) {
      console.error('Telegram compita:', e)
      resultados.push('telegram_compita: error')
    }
  } else {
    resultados.push('telegram_compita: sin chat_id')
  }

  // ── Email al compita ──────────────────────────────────────────────────────
  if (compitaData?.email) {
    try {
      await sendEmail({
        to: compitaData.email,
        subject: `⏰ Tu llamada con ${esc(cliente?.nombre ?? 'el cliente')} — link de acceso`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px">Tu link de llamada está listo</h2>
            <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
              Tu llamada con <strong>${esc(cliente?.nombre ?? 'el cliente')}</strong> está programada para:<br>
              <strong>${esc(slotLabel)}</strong>
            </p>
            <p style="color:#C84B0E;background:#FFF3E8;border:2px solid #FF6B2B;border-radius:12px;padding:14px;font-size:14px">
              ⏱️ Recuerda: la llamada tiene un límite de 20 minutos. La sala se cierra automáticamente a los 23 min.
            </p>
            <a href="${salaCompitaUrl}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:8px">
              Entrar a la llamada →
            </a>
            <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>
        `,
      })
      resultados.push('email_compita: ok')
    } catch (e) {
      console.error('Email compita:', e)
      resultados.push('email_compita: error')
    }
  } else {
    resultados.push('email_compita: sin email')
  }

  // El admin ya envió los enlaces: evitar que el cron de recordatorios los repita
  await reclamarFlag(row.id, 'recordatorio_enviado').catch(() => false)

  return ok({ room_url: roomUrl, resultados })
}
