// POST /api/solicitud/reconectar-llamada?token=&quien=cliente|compita&s=<firma>
// Crea una sala nueva y avisa a la otra parte. Solo con firma de rol, solicitud aceptada,
// cerca de la hora pautada, y con enfriamiento de 2 minutos (evita abuso de salas y spam).
import { NextRequest } from 'next/server'
import { getSolicitudPorToken, guardarRoomUrl } from '@/lib/solicitudes'
import { createEntrevistaRoom } from '@/lib/daily'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { qRol, rolValido } from '@/lib/links'
import { ok, err, notFound, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const token = sp.get('token')
  const quien = sp.get('quien')
  if (!token || !rolValido(token, quien, sp.get('s'))) return err('Enlace inválido', 400)

  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud) return notFound('Solicitud')
  if (solicitud.estado !== 'aceptada' && solicitud.estado !== 'completada') return err('Esta llamada ya no está activa', 409)
  if (!solicitud.slot_confirmado) return err('La llamada no tiene horario confirmado', 409)
  const dt = Date.now() - new Date(solicitud.slot_confirmado).getTime()
  if (dt < -30 * 60_000 || dt > 3 * 3600_000) return err('Solo puedes reconectar cerca de la hora de la llamada', 409)

  const admin = createAdminSupabase()

  // Enfriamiento: una fila sintética por solicitud
  const clave = `recon:${solicitud.id}`
  const { data: previo } = await admin.from('telegram_estados').select('updated_at').eq('chat_id', clave).maybeSingle()
  if (previo && Date.now() - new Date(previo.updated_at).getTime() < 120_000) return err('Espera un momento antes de reconectar de nuevo', 429)
  await admin.from('telegram_estados').upsert({ chat_id: clave, registro_pendiente: false, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })

  let roomUrl: string
  try {
    // nbf = slot - 5 min; pasamos now + 5 min para que la sala abra ahora y dure ~28 min
    const room = await createEntrevistaRoom(solicitud.id, new Date(Date.now() + 5 * 60 * 1000))
    roomUrl = room.url
    await guardarRoomUrl(solicitud.id, roomUrl)
    // Nueva llamada: el webhook de Daily debe poder volver a disparar el flujo post-llamada
    await admin.from('solicitudes').update({ confirmacion_llamada_enviada: false, seguimiento_enviado: false, seguimiento2_enviado: false, confirmacion_cliente: null, confirmacion_compita: null }).eq('id', solicitud.id)
  } catch (e) {
    console.error('Error creando sala reconexión:', e)
    return serverError('No se pudo crear la sala')
  }

  const salaClienteUrl = `${SITE_URL}/sala/${token}?${qRol(token, 'cliente')}`
  const salaCompitaUrl = `${SITE_URL}/sala/${token}?${qRol(token, 'compita')}`

  const [{ data: compita }, { data: cliente }] = await Promise.all([
    admin.from('compitas').select('telegram_chat_id').eq('id', solicitud.compita_id).single(),
    admin.from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single(),
  ])

  try {
    if (quien === 'cliente') {
      if (compita?.telegram_chat_id) {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          `⚡ <b>La llamada se cayó</b>\n\n<b>${esc(cliente?.nombre ?? 'El cliente')}</b> quiere retomar la llamada ahora mismo. Se creó una sala nueva.\n\n👉 Toca el enlace de abajo para entrar. La sala estará abierta por 30 minutos.\n\n<a href="${salaCompitaUrl}">Entrar a la nueva sala →</a>`,
        )
      }
    } else if (cliente?.email) {
      await sendEmail({
        to: cliente.email,
        subject: `${solicitud.compita_nombre} quiere retomar la llamada`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px">Nueva sala lista</h2>
            <p style="color:#4A3B6B;font-size:16px;line-height:1.6">La llamada se cortó pero <strong>${esc(solicitud.compita_nombre)}</strong> está lista para retomar ahora.</p>
            <a href="${salaClienteUrl}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:16px">Entrar a la nueva sala →</a>
            <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>`,
      })
    }
  } catch (e) { console.error('Aviso reconexión falló:', e) }

  return ok({ room_url: roomUrl })
}
