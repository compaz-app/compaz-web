// POST /api/cron/recordatorios — enviado por Netlify Scheduled Function cada 5 min
// Busca llamadas en la próxima 1 hora, crea la sala Daily y envía el link a todos
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getSolicitudesParaRecordatorio, marcarRecordatorioEnviado, guardarRoomUrl } from '@/lib/solicitudes'
import { sendTelegramMessage } from '@/lib/telegram'
import { createEntrevistaRoom } from '@/lib/daily'
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
    const minutosRestantes = Math.max(1, Math.round((new Date(solicitud.slot_confirmado!).getTime() - Date.now()) / 60000))
    const tiempoLabel = minutosRestantes <= 1 ? 'en menos de 1 minuto' : `en ${minutosRestantes} minutos`
    const recordatorio20 = '⏱️ Recuerda: la llamada tiene un límite de 20 minutos. La sala se cierra automáticamente a los 23 min.'

    // Crear sala Daily si aún no existe
    let roomUrl = solicitud.room_url ?? ''
    if (!roomUrl) {
      try {
        const room = await createEntrevistaRoom(solicitud.id, new Date(solicitud.slot_confirmado!))
        roomUrl = room.url
        await guardarRoomUrl(solicitud.id, roomUrl)
      } catch (e) { console.error('Error creando sala Daily en recordatorio:', e) }
    }

    // Si no hay sala disponible, no enviar el recordatorio — se reintentará en 5 min
    if (!roomUrl) {
      console.error(`Sin sala para solicitud ${solicitud.id}, se reintentará`)
      continue
    }

    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''
    const salaClienteUrl = `${SITE_URL}/sala/${solicitud.token_respuesta}?quien=cliente`
    const salaCompitaUrl = `${SITE_URL}/sala/${solicitud.token_respuesta}?quien=compita`

    // Traer datos del cliente
    const { data: cliente } = await admin
      .from('usuarios')
      .select('nombre, email')
      .eq('id', solicitud.cliente_id)
      .single()

    // ── Email al cliente ────────────────────────────────────────────────────
    let emailEnviado = !cliente?.email
    if (cliente?.email) {
      try {
        await resend.emails.send({
          from: 'Compaz <visitas@micompaz.com>',
          to: cliente.email,
          subject: `⏰ Tu llamada con ${solicitud.compita_nombre} empieza ${tiempoLabel}`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">Tu llamada empieza ${tiempoLabel}</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                Tienes una llamada con <strong>${solicitud.compita_nombre}</strong> hoy a las <strong>${slotLabel}</strong>.
              </p>
              <p style="color:#C84B0E;background:#FFF3E8;border:2px solid #FF6B2B;border-radius:12px;padding:14px;font-size:14px">
                ${recordatorio20}
              </p>
              <p style="color:#4A3B6B;font-size:14px;line-height:1.6">
                La sala se abre <strong>5 minutos antes</strong> de la hora pautada. Si entras antes y ves un error, espera un momento y vuelve a intentarlo.
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
        emailEnviado = true
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
            `⏰ <b>Tu llamada empieza ${tiempoLabel}</b>`,
            ``,
            `Con <b>${cliente?.nombre ?? 'el cliente'}</b> a las <b>${slotLabel}</b>.`,
            ``,
            `⏱️ La llamada es de <b>20 minutos</b>. La sala se cierra automáticamente a los 23 min.`,
            ``,
            `🔓 La sala ya está lista. Puedes entrar cuando quieras; la reunión está programada para las <b>${slotLabel}</b>.`,
            ``,
            `<a href="${salaCompitaUrl}">Entrar a la llamada →</a>`,
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
            `⏰ <b>Llamada ${tiempoLabel}</b>`,
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

    // Solo marcar como enviado si el email al cliente llegó (o no tenía email).
    // Si falló, el cron reintenta en 5 min.
    if (emailEnviado) {
      try {
        await marcarRecordatorioEnviado(solicitud.id)
      } catch (e) { console.error('Error marcando recordatorio:', e) }
    }
  }

  // ── Detectar llamadas sin confirmación: slot pasó hace >90 min y webhook Daily
  // nunca se disparó (nadie entró). Alertar al admin para que intervenga.
  const hace90min = new Date(Date.now() - 90 * 60_000).toISOString()
  const hace4h = new Date(Date.now() - 4 * 60 * 60_000).toISOString()
  const { data: sinConfirmacion } = await admin
    .from('solicitudes')
    .select('id, slot_confirmado, compita_nombre, cliente_id, usuarios(nombre, email)')
    .eq('estado', 'aceptada')
    .eq('confirmacion_llamada_enviada', false)
    .not('slot_confirmado', 'is', null)
    .lt('slot_confirmado', hace90min)
    .gt('slot_confirmado', hace4h) as { data: Array<{ id: string; slot_confirmado: string; compita_nombre: string; usuarios: { nombre: string; email: string } | null }> | null }

  for (const sol of sinConfirmacion ?? []) {
    if (!adminTg) break
    // Idempotencia: verificar si ya enviamos esta alerta
    const { count } = await admin
      .from('mensajes')
      .select('id', { count: 'exact', head: true })
      .eq('visit_id', sol.id)
      .eq('origen', 'admin')
      .eq('contenido', 'alerta_sala_vacia')
    if ((count ?? 0) > 0) continue

    try {
      await sendTelegramMessage(
        adminTg,
        [
          `⚠️ <b>Llamada sin confirmar — posible sala vacía</b>`,
          ``,
          `La entrevista estaba pautada para <b>${formatSlotVE(sol.slot_confirmado)}</b> y el sistema no recibió confirmación de Daily.`,
          ``,
          `<b>Compita:</b> ${sol.compita_nombre}`,
          `<b>Cliente:</b> ${sol.usuarios?.nombre ?? '—'} (${sol.usuarios?.email ?? '—'})`,
          ``,
          `Es posible que ninguno de los dos haya entrado a la sala. Contacta a ambos.`,
        ].join('\n'),
      )
      await admin.from('mensajes').insert({ visit_id: sol.id, origen: 'admin', tipo: 'texto', contenido: 'alerta_sala_vacia' })
    } catch (e) { console.error('Error alerta sala vacía:', e) }
  }

  return ok({ procesados: solicitudes.length })
}
