// Enviar a mano el enlace de la llamada de presentación a la familia y al compita. Adelanta la hora a "ahora" para que la sala quede abierta de
// inmediato (la página /sala calcula la apertura con slot_confirmado). Toda la lógica y las consultas viven aquí; la ruta solo autentica y responde.
import { createAdminSupabase } from '@/lib/supabase-server'
import { guardarRoomUrl, reclamarFlag } from '@/lib/solicitudes'
import { createEntrevistaRoom } from '@/lib/daily'
import { sendTelegramMessage } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { formatSlotVE } from '@/lib/format'
import { qRol } from '@/lib/links'
import { minutosCorteLlamada, textoDuracionLlamada } from '@/lib/llamada'

export type ResultadoEnvioEnlace = { ok: true; roomUrl: string; resultados: string[] } | { ok: false; status: number; error: string }

export async function enviarEnlaceDeLlamada(solicitudId: string): Promise<ResultadoEnvioEnlace> {
  const corteLlamada = await minutosCorteLlamada()
  const admin = createAdminSupabase()

  const { data: row } = await admin
    .from('solicitudes')
    .select('id, estado, cliente_id, compita_id, slot_confirmado, room_url, token_respuesta, compitas(nombre, telegram_chat_id, email)')
    .eq('id', solicitudId)
    .single()

  if (!row) return { ok: false, status: 404, error: 'Solicitud no encontrada' }
  if (!row.slot_confirmado) return { ok: false, status: 400, error: 'La solicitud no tiene horario confirmado' }
  // Solo una solicitud con la llamada pendiente: no se mueve la hora de una que ya se hizo, se rechazó o se canceló.
  if (row.estado !== 'aceptada') return { ok: false, status: 409, error: 'Esta solicitud ya no tiene una llamada pendiente' }

  const compitaData = row.compitas as unknown as { nombre: string; telegram_chat_id: string | null; email: string | null } | null

  // Forzar la hora a ahora mismo: la página /sala solo se abre 10 min antes de slot_confirmado,
  // así que si el admin fuerza el envío, el slot debe adelantarse para que la sala quede
  // abierta de inmediato (en vez de seguir bloqueada hasta la hora original pactada).
  const ahoraIso = new Date().toISOString()
  const { error: eSlot } = await admin.from('solicitudes').update({ slot_confirmado: ahoraIso }).eq('id', row.id)
  if (eSlot) {
    console.error('Error adelantando slot_confirmado:', eSlot)
    return { ok: false, status: 500, error: 'No se pudo adelantar la hora de la llamada' }
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
      return { ok: false, status: 502, error: 'No se pudo crear la sala de la llamada' }
    }
  }

  const { data: cliente } = await admin
    .from('usuarios')
    .select('nombre, email')
    .eq('id', row.cliente_id)
    .single()

  const t = row.token_respuesta as string
  const duracion = textoDuracionLlamada(corteLlamada)
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
              ⏱️ ${duracion}
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
          `⏱️ ${duracion}`,
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
              ⏱️ ${duracion}
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

  return { ok: true, roomUrl: roomUrl as string, resultados }
}
