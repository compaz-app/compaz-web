import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, INLINE_INICIO } from '@/lib/telegram'
import { Resend } from 'resend'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabase()
  const ahora = new Date()
  const en22h = new Date(Date.now() + 22 * 60 * 60_000).toISOString()

  let recordatorios = 0
  let cierres = 0

  // ── 1. Recordatorio a las 2h: estados sin recordatorio y con más de 2h de antigüedad ──
  // pendiente_expira fue seteado a T+24h, así que T+2h = pendiente_expira - 22h
  // Si pendiente_expira < ahora+22h → han pasado más de 2h desde el rechazo
  const { data: pendientesNuevos } = await supabase
    .from('telegram_estados')
    .select('chat_id, pendiente_accion, pendiente_expira')
    .or('pendiente_accion.like.sugerir_horarios:%,pendiente_accion.like.sugerir_r:%')
    .lt('pendiente_expira', en22h) // más de 2h desde el rechazo
    .gt('pendiente_expira', ahora.toISOString()) // aún no expirado

  for (const estado of pendientesNuevos ?? []) {
    const partes = (estado.pendiente_accion as string).split(':')
    const [, , , ...nombrePartes] = partes
    const clienteNombre = nombrePartes.join(':') || 'el cliente'

    // Cambiar prefijo a sugerir_r: para marcar que el recordatorio fue enviado
    const nuevaAccion = (estado.pendiente_accion as string).replace('sugerir_horarios:', 'sugerir_r:')
    await supabase
      .from('telegram_estados')
      .update({ pendiente_accion: nuevaAccion })
      .eq('chat_id', estado.chat_id)

    try {
      await sendTelegramMessage(
        estado.chat_id,
        `⏰ <b>Recordatorio</b>\n\nAún tienes pendiente sugerir nuevos horarios a <b>${clienteNombre}</b>.\n\nSi no respondes en las próximas 22 horas, la solicitud se cerrará automáticamente y el cliente será notificado.`,
      )
      recordatorios++
    } catch (e) { console.error('Error recordatorio rechazo:', e) }
  }

  // ── 2. Cierre automático a las 24h: estados expirados (con o sin recordatorio) ──
  const { data: expirados } = await supabase
    .from('telegram_estados')
    .select('chat_id, pendiente_accion')
    .or('pendiente_accion.like.sugerir_horarios:%,pendiente_accion.like.sugerir_r:%')
    .lt('pendiente_expira', ahora.toISOString())

  for (const estado of expirados ?? []) {
    const accion = estado.pendiente_accion as string
    const prefijo = accion.startsWith('sugerir_r:') ? 'sugerir_r:' : 'sugerir_horarios:'
    const partes = accion.slice(prefijo.length).split(':')
    const [solicitudId, clienteEmail, ...nombrePartes] = partes
    const clienteNombre = nombrePartes.join(':') || 'el cliente'

    // Limpiar estado del compita
    await supabase
      .from('telegram_estados')
      .update({ pendiente_accion: null, pendiente_expira: null })
      .eq('chat_id', estado.chat_id)

    // Marcar solicitud como rechazada en la BD
    if (solicitudId) {
      await supabase
        .from('solicitudes')
        .update({ estado: 'rechazada' })
        .eq('id', solicitudId)
        .eq('estado', 'pendiente') // solo si aún está pendiente
    }

    // Buscar nombre del compita para el email
    const { data: compitaData } = await supabase
      .from('compitas')
      .select('nombre, id')
      .eq('telegram_chat_id', estado.chat_id)
      .maybeSingle()

    const compitaNombre = compitaData?.nombre ?? 'El compita'
    const compitaId = compitaData?.id ?? ''

    // Email al cliente
    if (clienteEmail) {
      try {
        await resend.emails.send({
          from: 'Compaz <visitas@micompaz.com>',
          to: clienteEmail,
          subject: `${compitaNombre} no pudo coordinarse contigo`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">No fue posible coordinar esta vez</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                <strong>${compitaNombre}</strong> no pudo proponer horarios alternativos para atenderte.
              </p>
              <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
                No te preocupes. Hay más compitas disponibles. Explora otros perfiles y encuentra el que mejor se adapte a tu familiar.
              </p>
              <a href="${SITE_URL}/compitas" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:4px">
                Ver otros compitas →
              </a>
              <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>
          `,
        })
      } catch (e) { console.error('Email cierre rechazo cliente:', e) }
    }

    // Telegram al compita
    try {
      await sendTelegramMessage(
        estado.chat_id,
        `La solicitud de <b>${clienteNombre}</b> fue cerrada automáticamente.\n\nEl cliente fue notificado de que no pudiste coordinarte con ellos en esta oportunidad.`,
        INLINE_INICIO,
      )
    } catch (e) { console.error('Telegram cierre rechazo compita:', e) }

    cierres++
  }

  return NextResponse.json({ ok: true, recordatorios, cierres })
}
