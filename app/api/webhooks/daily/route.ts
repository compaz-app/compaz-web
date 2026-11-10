// POST /api/webhooks/daily
// Recibe eventos de Daily.co. Al terminar una sala de entrevista ("ent-"), dispara el flujo post-llamada.
// Firma: HMAC de Daily (X-Webhook-Signature + X-Webhook-Timestamp) o, por compatibilidad, secreto estático.
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getSolicitudPorRoomUrl, reclamarFlag } from '@/lib/solicitudes'
import { createAdminSupabase } from '@/lib/supabase-server'
import { avisarAdmin } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { notificar } from '@/lib/avisos'
import { registrarEvento } from '@/lib/eventos'
import { esc } from '@/lib/html'
import { formatSlotVE } from '@/lib/format'
import { secretoValido } from '@/lib/links'

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
    const llamadaCorta = durationSeg < 180
    const nadieLlego = durationSeg === 0

    const { data: cliente } = await admin.from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()

    const slotLabel = solicitud.slot_confirmado ? formatSlotVE(solicitud.slot_confirmado) : ''

    if (nadieLlego) {
      await alertaAdmin('tarea', [
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

    await registrarEvento({
      entidad: 'solicitud', entidadId: solicitud.id, tipo: 'entrevista_terminada',
      datos: { duracion_seg: durationSeg, corta: llamadaCorta },
    })

    // Los avisos post-llamada salen con registro: si fallan quedan anotados y se pueden reintentar
    // (antes el flag ya estaba reclamado y un fallo no se podía repetir).
    // La clave incluye la sala: tras reconectar se crea una sala nueva y esa llamada sí merece su propio aviso.
    const variables = { solicitudId: solicitud.id, corta: llamadaCorta }
    const alCliente = await notificar({
      plantilla: 'llamada_terminada_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: solicitud.cliente_id },
      variables, entidad: 'solicitud', entidadId: solicitud.id, paso: 10,
      claveUnica: `llamada_cliente:${solicitud.id}:${roomUrl}`,
      plazoAccionMin: 120, // si en 2 h no decide, la escalera (paso 1.5) le recuerda y luego abre tarea en la Bandeja
    })
    if (!alCliente.ok) {
      await alertaAdmin('tarea', `⚠️ No se pudo enviar el correo post-llamada a <b>${esc(cliente?.nombre ?? 'el cliente')}</b> (${esc(cliente?.email ?? 'sin correo')}). Reenvíalo manualmente.`)
    }
    await notificar({
      plantilla: 'llamada_terminada_compita', canal: 'telegram', destinatario: { tipo: 'compita', id: solicitud.compita_id },
      variables, entidad: 'solicitud', entidadId: solicitud.id, paso: 10,
      claveUnica: `llamada_compita:${solicitud.id}:${roomUrl}`,
    })
  } catch (e) {
    // El flag ya está reclamado: un reintento de Daily no reenviaría nada. Se avisa al admin y se responde 200.
    console.error('[webhook daily] error:', e)
    await alertaAdmin('urgente', `⚠️ Falló el procesamiento de fin de llamada (sala <code>${esc(roomName)}</code>). Revisa los logs y avisa a las partes manualmente.`)
  }

  return NextResponse.json({ ok: true })
}
