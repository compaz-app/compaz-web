// POST /api/cron/recordatorios — Netlify Scheduled Function cada 5 min
// Busca llamadas en la próxima hora, crea la sala Daily y envía el link a cliente, compita y admin.
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getSolicitudesParaRecordatorio, reclamarFlag, liberarFlag, guardarRoomUrl } from '@/lib/solicitudes'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { createEntrevistaRoom } from '@/lib/daily'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { formatSlotVE } from '@/lib/format'
import { qRol } from '@/lib/links'
import { cronAutorizado, latido, vigilarLatidos, reclamarUnaVez } from '@/lib/cron'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return err('No autorizado', 401)

  const solicitudes = await getSolicitudesParaRecordatorio()
  const admin = createAdminSupabase()
  let enviados = 0

  for (const solicitud of solicitudes) {
    try {
      const slotMs = new Date(solicitud.slot_confirmado!).getTime()
      const slotLabel = formatSlotVE(solicitud.slot_confirmado!)
      const minutos = Math.round((slotMs - Date.now()) / 60000)
      const tiempoLabel = minutos <= 1 ? 'ahora mismo' : `en ${minutos} minutos`
      const recordatorio20 = '⏱️ Recuerda: la llamada tiene un límite de 20 minutos. La sala se cierra automáticamente a los 23 min.'

      let roomUrl = solicitud.room_url ?? ''
      if (!roomUrl) {
        try {
          const room = await createEntrevistaRoom(solicitud.id, new Date(solicitud.slot_confirmado!))
          roomUrl = room.url
          await guardarRoomUrl(solicitud.id, roomUrl)
        } catch (e) {
          console.error('Error creando sala Daily en recordatorio:', e)
          if (await reclamarUnaVez(`sala_fail:${solicitud.id}`)) {
            await avisarAdmin(`🚨 <b>No se pudo crear la sala de la llamada</b>\n\n<b>Compita:</b> ${esc(solicitud.compita_nombre)}\n<b>Hora:</b> ${esc(slotLabel)}\n\nSe reintenta cada 5 min. Si persiste, usa "Enviar link" en el panel admin.`)
          }
        }
      }
      if (!roomUrl) continue

      // Reclamo atómico: solo una ejecución envía. Si el email falla, se libera y se reintenta.
      if (!(await reclamarFlag(solicitud.id, 'recordatorio_enviado'))) continue

      const salaClienteUrl = `${SITE_URL}/sala/${solicitud.token_respuesta}?${qRol(solicitud.token_respuesta, 'cliente')}`
      const salaCompitaUrl = `${SITE_URL}/sala/${solicitud.token_respuesta}?${qRol(solicitud.token_respuesta, 'compita')}`

      const [{ data: cliente }, { data: compita }] = await Promise.all([
        admin.from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single(),
        admin.from('compitas').select('telegram_chat_id').eq('id', solicitud.compita_id).single(),
      ])

      if (cliente?.email) {
        try {
          await sendEmail({
            to: cliente.email,
            subject: `⏰ Tu llamada con ${solicitud.compita_nombre} empieza ${tiempoLabel}`,
            html: `
              <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
                <h2 style="color:#2D1464;font-size:22px">Tu llamada empieza ${esc(tiempoLabel)}</h2>
                <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Tienes una llamada con <strong>${esc(solicitud.compita_nombre)}</strong>: <strong>${esc(slotLabel)}</strong>.</p>
                <p style="color:#C84B0E;background:#FFF3E8;border:2px solid #FF6B2B;border-radius:12px;padding:14px;font-size:14px">${recordatorio20}</p>
                <p style="color:#4A3B6B;font-size:14px;line-height:1.6">La sala se abre <strong>5 minutos antes</strong> de la hora pautada. Si entras antes y ves un error, espera un momento y vuelve a intentarlo.</p>
                <a href="${salaClienteUrl}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:8px">Entrar a la llamada →</a>
                <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
              </div>`,
          })
        } catch (e) {
          console.error('Email recordatorio cliente:', e)
          await liberarFlag(solicitud.id, 'recordatorio_enviado') // reintento en 5 min, sin haber avisado a la compita
          continue
        }
      }

      let compitaAvisada = false
      if (compita?.telegram_chat_id) {
        try {
          await sendTelegramMessage(
            compita.telegram_chat_id,
            [
              `⏰ <b>Tu llamada empieza ${esc(tiempoLabel)}</b>`, ``,
              `Con <b>${esc(cliente?.nombre ?? 'el cliente')}</b>: <b>${esc(slotLabel)}</b>.`, ``,
              `⏱️ La llamada es de <b>20 minutos</b>. La sala se cierra automáticamente a los 23 min.`, ``,
              `🔓 La sala ya está lista. Puedes entrar cuando quieras.`, ``,
              `<a href="${salaCompitaUrl}">Entrar a la llamada →</a>`,
            ].join('\n'),
          )
          compitaAvisada = true
        } catch (e) { console.error('Telegram recordatorio compita:', e) }
      }

      await avisarAdmin([
        `⏰ <b>Llamada ${esc(tiempoLabel)}</b>`, ``,
        `<b>Cliente:</b> ${esc(cliente?.nombre ?? '')} (${esc(cliente?.email ?? '')})`,
        `<b>Compita:</b> ${esc(solicitud.compita_nombre)}${compitaAvisada ? '' : ' ⚠️ NO se pudo avisar por Telegram'}`,
        `<b>Hora:</b> ${esc(slotLabel)}`, ``,
        `⏱️ Llamada de 20 min. Únete como supervisor:`,
        `<a href="${roomUrl}">Entrar a la sala →</a>`,
      ].join('\n'))
      enviados++
    } catch (e) {
      console.error(`[recordatorios] fallo con solicitud ${solicitud.id}:`, e)
    }
  }

  // Llamadas sin confirmación: slot pasó hace >90 min y nadie confirmó (sala vacía / webhook caído)
  const hace90min = new Date(Date.now() - 90 * 60_000).toISOString()
  const hace4h = new Date(Date.now() - 4 * 60 * 60_000).toISOString()
  const { data: sinConfirmacion, error: errSin } = await admin
    .from('solicitudes')
    .select('id, slot_confirmado, compitas(nombre), usuarios!solicitudes_cliente_id_fkey(nombre, email)')
    .eq('estado', 'aceptada')
    .eq('confirmacion_llamada_enviada', false)
    .not('slot_confirmado', 'is', null)
    .lt('slot_confirmado', hace90min)
    .gt('slot_confirmado', hace4h) as { data: Array<{ id: string; slot_confirmado: string; compitas: { nombre: string } | null; usuarios: { nombre: string; email: string } | null }> | null; error: unknown }
  if (errSin) console.error('[recordatorios] consulta sin-confirmación falló:', errSin)

  for (const sol of sinConfirmacion ?? []) {
    if (!(await reclamarUnaVez(`alerta_sala_vacia:${sol.id}`))) continue
    await avisarAdmin([
      `⚠️ <b>Llamada sin confirmar — posible sala vacía</b>`, ``,
      `La entrevista estaba pautada para <b>${esc(formatSlotVE(sol.slot_confirmado))}</b> y no hay registro de que ocurriera.`, ``,
      `<b>Compita:</b> ${esc(sol.compitas?.nombre ?? '—')}`,
      `<b>Cliente:</b> ${esc(sol.usuarios?.nombre ?? '—')} (${esc(sol.usuarios?.email ?? '—')})`, ``,
      `Es posible que ninguno de los dos haya entrado. Contacta a ambos.`,
    ].join('\n'))
  }

  await latido('recordatorios')
  await vigilarLatidos()
  return ok({ procesados: solicitudes.length, enviados })
}
