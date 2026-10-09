import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getClienteActivo } from '@/lib/auth'
import { ok, err, unauthorized, notFound } from '@/lib/api'
import { sendTelegramMessage, INLINE_REAGENDAR_VISITA } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { hoyVE, horaVE, formatFechaVE } from '@/lib/format'

// PUT /api/visita/fecha
// Guarda fecha + horario acordado Y confirma coordinación en un solo paso: pre_visita → programada.
// Valida que el compita no tenga otra visita programada que se solape con el horario.
export async function PUT(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  const body = await req.json().catch(() => null) as { visita_id?: string; fecha_programada?: string; hora_inicio?: string; hora_fin?: string } | null
  if (!body) return err('Solicitud inválida')
  const { visita_id, fecha_programada, hora_inicio, hora_fin } = body as { visita_id: string; fecha_programada: string; hora_inicio: string; hora_fin: string }

  if (!visita_id || !fecha_programada || !hora_inicio || !hora_fin) return err('Faltan parámetros')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_programada)) return err('Fecha inválida')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora_inicio) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora_fin)) return err('Hora inválida')
  if (hora_fin <= hora_inicio) return err('La hora de fin debe ser después de la hora de inicio')
  if (Number.isNaN(new Date(`${fecha_programada}T12:00:00Z`).getTime()) || new Date(`${fecha_programada}T12:00:00Z`).toISOString().slice(0, 10) !== fecha_programada) return err('Fecha inválida')
  const hoy = hoyVE() // día de Venezuela, no UTC
  if (fecha_programada < hoy) return err('La fecha debe ser hoy o en el futuro')
  if (fecha_programada === hoy && hora_inicio <= horaVE()) return err('La hora de inicio ya pasó')
  if (fecha_programada > hoyVE(180)) return err('La fecha es demasiado lejana')

  const admin = createAdminSupabase()

  const { data: visita } = await admin
    .from('visitas')
    .select('id, usuario_id, compita_id, estado')
    .eq('id', visita_id)
    .single()

  if (!visita) return notFound()
  if (visita.usuario_id !== user.id) return err('Sin acceso', 403)
  if (!['pre_visita', 'programada'].includes(visita.estado)) return err('Estado de visita inválido')

  // Verificar solapamiento: buscar visitas del mismo compita en la misma fecha
  // con horario que se cruce con el nuevo bloque solicitado.
  // Overlap: inicio_existente < hora_fin_nueva AND fin_existente > hora_inicio_nueva
  const { data: solapadas } = await admin
    .from('visitas')
    .select('id, hora_inicio_programada, hora_fin_programada')
    .eq('compita_id', visita.compita_id)
    .eq('fecha_programada', fecha_programada)
    .in('estado', ['programada', 'en_curso'])
    .neq('id', visita_id) // excluir la visita actual (reagendado)

  const hayConflicto = (solapadas ?? []).some((v) => {
    const ini = v.hora_inicio_programada
    const fin = v.hora_fin_programada
    if (!ini || !fin) return false
    return ini < hora_fin && fin > hora_inicio
  })

  if (hayConflicto) {
    return err(`El compita ya tiene otra visita programada en ese horario. Por favor coordinen un horario diferente.`)
  }

  const { error } = await admin
    .from('visitas')
    .update({ fecha_programada, hora_inicio_programada: hora_inicio, hora_fin_programada: hora_fin, estado: 'programada' })
    .eq('id', visita_id)

  if (error) {
    console.error('[visita/fecha] error:', error)
    return err('No pudimos guardar la fecha. Intenta de nuevo.', 500)
  }

  const fechaFormateada = formatFechaVE(fecha_programada, true)
  const horarioLabel = `${hora_inicio} – ${hora_fin}`

  const [{ data: compita }, { data: cliente }] = await Promise.all([
    admin.from('compitas').select('telegram_chat_id, nombre').eq('id', visita.compita_id).single(),
    admin.from('usuarios').select('nombre, email').eq('id', visita.usuario_id).single(),
  ])

  if (compita?.telegram_chat_id) {
    try {
      await sendTelegramMessage(
        compita.telegram_chat_id,
        [
          `✅ <b>¡Visita confirmada!</b>`,
          ``,
          `${esc(cliente?.nombre ?? 'El cliente')} registró el horario de la visita:`,
          ``,
          `📅 <b>${esc(fechaFormateada)}</b>`,
          `🕐 <b>${esc(horarioLabel)}</b>`,
          ``,
          `Recibirás un recordatorio el día anterior. Si necesitas reagendar, toca el botón de abajo.`,
        ].join('\n'),
        INLINE_REAGENDAR_VISITA,
      )
    } catch (e) { console.error('Telegram fecha/confirmar compita:', e) }
  }

  if (cliente?.email) {
    try {
      await sendEmail({
        to: cliente.email,
        subject: `✅ Visita confirmada: ${fechaFormateada}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px;margin-bottom:12px">✅ Visita confirmada</h2>
            <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
              La visita de <strong>${esc(compita?.nombre ?? 'tu compita')}</strong> con tu familiar está agendada.
            </p>
            <div style="background:#F5F0FF;border:2px solid #7C4DFF;border-radius:12px;padding:16px 20px;margin:20px 0;text-align:center">
              <p style="color:#6B5C90;font-size:13px;margin:0 0 4px">Fecha y horario</p>
              <p style="color:#2D1464;font-size:18px;font-weight:800;margin:0 0 4px;text-transform:capitalize">${esc(fechaFormateada)}</p>
              <p style="color:#2D1464;font-size:16px;font-weight:700;margin:0">${esc(horarioLabel)}</p>
            </div>
            <p style="color:#4A3B6B;font-size:14px;line-height:1.6">
              Te enviaremos un recordatorio el día anterior. Si necesitas cambiar la fecha puedes reagendar desde tu dashboard.
            </p>
            <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:14px;margin-top:8px">
              Ver en el dashboard →
            </a>
            <p style="color:#9990A8;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>
        `,
      })
    } catch (e) { console.error('Email confirmar visita cliente:', e) }
  }

  return ok({ fecha_programada, hora_inicio_programada: hora_inicio, hora_fin_programada: hora_fin, estado: 'programada' })
}
