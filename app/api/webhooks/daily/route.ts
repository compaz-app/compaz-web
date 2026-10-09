// POST /api/webhooks/daily
// Recibe eventos de Daily.co. Al terminar una sala de entrevista ("ent-"), dispara el flujo post-llamada.
// Firma: HMAC de Daily (X-Webhook-Signature + X-Webhook-Timestamp) o, por compatibilidad, secreto estático.
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getSolicitudPorRoomUrl, reclamarFlag } from '@/lib/solicitudes'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { formatSlotVE } from '@/lib/format'
import { qRol, secretoValido } from '@/lib/links'

const SECRET = process.env.DAILY_WEBHOOK_SECRET ?? ''

function firmaValida(req: NextRequest, rawBody: string): boolean {
  if (!SECRET) return false
  const sig = req.headers.get('x-webhook-signature')
  const ts = req.headers.get('x-webhook-timestamp')
  if (sig && ts) {
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false // anti-replay
    for (const key of [Buffer.from(SECRET, 'base64'), Buffer.from(SECRET)]) {
      const esperado = createHmac('sha256', key).update(`${ts}.${rawBody}`).digest('base64')
      const a = Buffer.from(esperado), b = Buffer.from(sig)
      if (a.length === b.length && timingSafeEqual(a, b)) return true
    }
    return false
  }
  // Compatibilidad con configuración anterior (cabecera propia con el secreto)
  return secretoValido(req.headers.get('x-daily-signature'), SECRET)
}

export async function POST(req: NextRequest) {
  const raw = await req.text()

  // Al crear un webhook, Daily envía primero una petición de verificación sin firma ({"test":"test"}).
  // No tiene efectos, así que se acepta; cualquier evento real sigue exigiendo firma válida.
  try {
    const sonda = JSON.parse(raw) as Record<string, unknown>
    if (sonda && typeof sonda === 'object' && Object.keys(sonda).length === 1 && 'test' in sonda) {
      return NextResponse.json({ ok: true })
    }
  } catch { /* no es JSON: seguir con la validación normal */ }

  if (!firmaValida(req, raw)) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })

  let body: { event_type?: string; payload?: { room_name?: string; room_url?: string; duration?: number } }
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  if (body.event_type !== 'meeting.ended') return NextResponse.json({ ok: true })
  const roomName = body.payload?.room_name ?? ''
  const roomUrl = body.payload?.room_url ?? ''
  const durationSeg = body.payload?.duration ?? 0
  if (!roomName.startsWith('ent-')) return NextResponse.json({ ok: true })

  try {
    const solicitud = await getSolicitudPorRoomUrl(roomUrl)
    if (!solicitud) {
      console.error('Webhook Daily: no se encontró solicitud para room_url', roomUrl)
      return NextResponse.json({ ok: true })
    }

    // Idempotencia: solo el primer meeting.ended de esta llamada dispara los correos
    // (reconectar-llamada resetea el flag al crear una sala nueva).
    if (!(await reclamarFlag(solicitud.id, 'confirmacion_llamada_enviada'))) return NextResponse.json({ ok: true, duplicado: true })

    const admin = createAdminSupabase()
    const token = solicitud.token_respuesta
    const llamadaCorta = durationSeg < 180
    const nadieLlego = durationSeg === 0

    const [{ data: cliente }, { data: compita }] = await Promise.all([
      admin.from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single(),
      admin.from('compitas').select('telegram_chat_id').eq('id', solicitud.compita_id).single(),
    ])

    const slotLabel = solicitud.slot_confirmado ? formatSlotVE(solicitud.slot_confirmado) : ''
    const nombreCliente = cliente?.nombre?.split(' ')[0] ?? 'Cliente'

    if (nadieLlego) {
      await avisarAdmin([
        `⚠️ <b>Sala de entrevista expiró sin participantes</b>`, ``,
        `<b>Cliente:</b> ${esc(cliente?.nombre ?? '—')} (${esc(cliente?.email ?? '—')})`,
        `<b>Compita:</b> ${esc(solicitud.compita_nombre)}`,
        `<b>Hora acordada:</b> ${esc(slotLabel)}`, ``,
        `Ninguno de los dos entró a la sala. Contacta a ambos para reagendar.`,
      ].join('\n'))
      return NextResponse.json({ ok: true })
    }

    // Esta ruta ya preguntó "¿quieres contratar?": evita que el cron la repita (la llamada corta no lo pregunta).
    if (!llamadaCorta) await reclamarFlag(solicitud.id, 'seguimiento_enviado').catch(() => false)

    const base = `${SITE_URL}/api/solicitud/resultado-llamada?token=${token}`
    const contratarUrl = `${base}&resultado=contratar`
    const reagendarUrl = `${base}&resultado=reagendar`
    const noUrl = `${base}&resultado=no_contratar&${qRol(token, 'cliente')}`
    const compitaReagendarUrl = `${base}&resultado=reagendar&${qRol(token, 'compita')}`
    const compitaBienUrl = `${base}&resultado=bien&${qRol(token, 'compita')}`

    if (cliente?.email) {
      const titulo = llamadaCorta ? `¿Pudiste hablar con ${solicitud.compita_nombre}?` : `¿Qué decidiste sobre ${solicitud.compita_nombre}?`
      const intro = llamadaCorta
        ? `Parece que la llamada fue muy corta o tuvo problemas técnicos. ¿Qué pasó?`
        : `Tu llamada con <strong>${esc(solicitud.compita_nombre)}</strong> acaba de terminar. ¿Qué decides?`
      try {
        await sendEmail({
          to: cliente.email,
          subject: titulo,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">${esc(titulo)}</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, <strong>${esc(nombreCliente)}</strong>. ${intro}</p>
              <div style="margin-top:24px">
                ${!llamadaCorta ? `<a href="${contratarUrl}" style="display:block;background:#22C55E;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;text-align:center;margin-bottom:12px">✅ Sí, quiero contratar a ${esc(solicitud.compita_nombre)}</a>` : ''}
                <a href="${reagendarUrl}" style="display:block;background:#6B5C90;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:15px;text-align:center;margin-bottom:12px">🔄 ${llamadaCorta ? 'La llamada se cortó — quiero reagendar' : 'Quiero reagendar para hablar más'}</a>
                <a href="${noUrl}" style="display:block;background:#E8E0D4;color:#1A0A3C;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:15px;text-align:center">❌ ${llamadaCorta ? 'No pude hablar — ver otros compitas' : 'No es lo que busco — ver otros perfiles'}</a>
              </div>
              <p style="color:#6B5C90;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>`,
        })
      } catch (e) {
        console.error('Email post-llamada cliente:', e)
        await avisarAdmin(`⚠️ No se pudo enviar el correo post-llamada a <b>${esc(cliente.nombre)}</b> (${esc(cliente.email)}). Reenvíalo manualmente.`)
      }
    }

    if (compita?.telegram_chat_id) {
      try {
        if (llamadaCorta) {
          await sendTelegramMessage(
            compita.telegram_chat_id,
            `📞 La llamada con <b>${esc(cliente?.nombre ?? 'el cliente')}</b> parece que tuvo problemas técnicos.\n\n¿Qué pasó?`,
            { inline_keyboard: [[{ text: '✅ Estuvo bien', url: compitaBienUrl }, { text: '🔄 Necesitamos reagendar', url: compitaReagendarUrl }]] },
          )
        } else {
          await sendTelegramMessage(
            compita.telegram_chat_id,
            `✅ <b>¡Gracias por la llamada!</b>\n\nLa entrevista con <b>${esc(cliente?.nombre ?? 'el cliente')}</b> terminó.\n\nEstaremos en contacto según lo que decida la familia. Si tuviste algún problema técnico, avísanos.`,
            { inline_keyboard: [[{ text: '🔄 Tuvimos problemas — reagendar', url: compitaReagendarUrl }]] },
          )
        }
      } catch (e) { console.error('Telegram post-llamada compita:', e) }
    }
  } catch (e) {
    // El flag ya está reclamado: un reintento de Daily no reenviaría nada. Se avisa al admin y se responde 200.
    console.error('[webhook daily] error:', e)
    await avisarAdmin(`⚠️ Falló el procesamiento de fin de llamada (sala <code>${esc(roomName)}</code>). Revisa los logs y avisa a las partes manualmente.`)
  }

  return NextResponse.json({ ok: true })
}
