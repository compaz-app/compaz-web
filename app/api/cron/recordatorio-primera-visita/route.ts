import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, avisarAdmin, INLINE_REAGENDAR_VISITA } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { hoyVE, formatFechaVE } from '@/lib/format'
import { cronAutorizado } from '@/lib/cron'

// POST /api/cron/recordatorio-visita-manana — diario 10:00 VE
// Recordatorio 24 h antes de toda visita 'programada'. El marcador incluye la fecha, así que
// si la visita se reagenda, el nuevo día vuelve a recibir su recordatorio.
export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabase()
  const mananaStr = hoyVE(1) // mañana en Venezuela, no en UTC

  const { data: visitas, error } = await admin
    .from('visitas')
    .select(`id, compita_id, usuario_id, fecha_programada, hora_inicio_programada, hora_fin_programada,
      compitas(telegram_chat_id, nombre), usuarios(nombre, email)`)
    .eq('estado', 'programada')
    .eq('fecha_programada', mananaStr)
  if (error) console.error('[recordatorio-primera-visita] consulta falló:', error)
  if (!visitas || visitas.length === 0) return NextResponse.json({ ok: true, recordatorios: 0 })

  let enviados = 0
  for (const visita of visitas) {
    const marcador = `recordatorio_visita:${visita.fecha_programada}`
    const { count } = await admin
      .from('mensajes').select('id', { count: 'exact', head: true })
      .eq('visit_id', visita.id).eq('origen', 'admin').eq('contenido', marcador)
    if ((count ?? 0) > 0) continue

    const compita = visita.compitas as unknown as { telegram_chat_id: string | null; nombre: string } | null
    const cliente = visita.usuarios as unknown as { nombre: string; email: string } | null
    const fechaFormateada = formatFechaVE(visita.fecha_programada!, true)
    const horarioLabel = visita.hora_inicio_programada && visita.hora_fin_programada
      ? `${visita.hora_inicio_programada} – ${visita.hora_fin_programada}` : null

    let ok = false
    if (compita?.telegram_chat_id) {
      try {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          [
            `🗓️ <b>Recordatorio: visita mañana</b>`, ``,
            `Mañana tienes visita con <b>${esc(cliente?.nombre ?? 'el cliente')}</b>.`, ``,
            `📅 <b>${esc(fechaFormateada)}</b>`,
            horarioLabel ? `🕐 <b>${esc(horarioLabel)}</b>` : '', ``,
            `Recuerda llegar puntual, presentarte con una sonrisa y revisar las notas del familiar. ¡Éxito!`, ``,
            `🔄 <b>Si surge algún imprevisto:</b> toca el botón de abajo para reagendar y le avisaremos al cliente automáticamente.`,
          ].filter(Boolean).join('\n'),
          INLINE_REAGENDAR_VISITA,
        )
        ok = true
      } catch (e) { console.error('Telegram recordatorio visita compita:', e) }
    }
    if (cliente?.email) {
      try {
        await sendEmail({
          to: cliente.email,
          subject: `Recordatorio: mañana es la visita de ${compita?.nombre ?? 'tu compita'}`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px;margin-bottom:12px">🗓️ Visita mañana</h2>
              <p style="color:#4A3B6B;font-size:15px;line-height:1.6">Mañana es la visita de <strong>${esc(compita?.nombre ?? 'tu compita')}</strong> con tu familiar.</p>
              <div style="background:#F5F0FF;border:2px solid #7C4DFF;border-radius:12px;padding:16px 20px;margin:16px 0;text-align:center">
                <p style="color:#2D1464;font-size:18px;font-weight:800;margin:0 0 4px;text-transform:capitalize">${esc(fechaFormateada)}</p>
                ${horarioLabel ? `<p style="color:#2D1464;font-size:16px;font-weight:700;margin:0">🕐 ${esc(horarioLabel)}</p>` : ''}
              </div>
              <p style="color:#4A3B6B;font-size:14px;line-height:1.6">Si necesitas hacer algún cambio, entra al dashboard y comunícaselo a ${esc(compita?.nombre ?? 'tu compita')} por el chat. También puedes reagendar desde allí si surge algún imprevisto.</p>
              <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:14px;margin-top:8px">Ver en el dashboard →</a>
              <p style="color:#9990A8;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>`,
        })
        ok = true
      } catch (e) { console.error('Email recordatorio visita cliente:', e) }
    }

    if (ok) {
      await admin.from('mensajes').insert({ visit_id: visita.id, origen: 'admin', tipo: 'texto', contenido: marcador })
      enviados++
    } else {
      await avisarAdmin(`⚠️ No se pudo enviar el recordatorio de la visita de mañana (<b>${esc(compita?.nombre ?? '—')}</b> con <b>${esc(cliente?.nombre ?? '—')}</b>).`)
    }
  }
  return NextResponse.json({ ok: true, recordatorios: enviados })
}
