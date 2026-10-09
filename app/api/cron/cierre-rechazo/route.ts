// POST /api/cron/cierre-rechazo — cada 30 min
// 1. Recordatorio a las 2 h a la compita que debe sugerir horarios (una sola vez).
// 2. Cierre automático a las 24 h de esas sugerencias pendientes.
// 3. Solicitudes 'pendiente' sin respuesta de la compita: recordatorio a las 24 h, cierre a las 72 h.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, avisarAdmin, INLINE_INICIO } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { cronAutorizado, latido, reclamarUnaVez } from '@/lib/cron'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabase()
  const ahora = new Date()
  const en22h = new Date(Date.now() + 22 * 60 * 60_000).toISOString()
  let recordatorios = 0, cierres = 0, pendientesCerradas = 0

  // ── 1. Recordatorio a las 2 h: SOLO estados "sugerir_horarios:" (sugerir_r: = ya recordado) ──
  const { data: pendientesNuevos, error: e1 } = await supabase
    .from('telegram_estados')
    .select('chat_id, pendiente_accion')
    .like('pendiente_accion', 'sugerir_horarios:%')
    .lt('pendiente_expira', en22h)
    .gt('pendiente_expira', ahora.toISOString())
  if (e1) console.error('[cierre-rechazo] consulta recordatorios:', e1)

  for (const estado of pendientesNuevos ?? []) {
    const nombrePartes = (estado.pendiente_accion as string).split(':').slice(3)
    const clienteNombre = nombrePartes.join(':') || 'el cliente'
    // Marcar ANTES de enviar y de forma condicional: una sola ejecución gana
    const { data: marcado } = await supabase
      .from('telegram_estados')
      .update({ pendiente_accion: (estado.pendiente_accion as string).replace('sugerir_horarios:', 'sugerir_r:') })
      .eq('chat_id', estado.chat_id)
      .eq('pendiente_accion', estado.pendiente_accion)
      .select('chat_id')
      .maybeSingle()
    if (!marcado) continue
    try {
      await sendTelegramMessage(
        estado.chat_id,
        `⏰ <b>Recordatorio</b>\n\nAún tienes pendiente sugerir nuevos horarios a <b>${esc(clienteNombre)}</b>.\n\nSi no respondes en las próximas 22 horas, la solicitud se cerrará automáticamente y el cliente será notificado.`,
      )
      recordatorios++
    } catch (e) { console.error('Error recordatorio rechazo:', e) }
  }

  // ── 2. Cierre automático a las 24 h ─────────────────────────────────────────
  const { data: expirados, error: e2 } = await supabase
    .from('telegram_estados')
    .select('chat_id, pendiente_accion')
    .or('pendiente_accion.like.sugerir_horarios:%,pendiente_accion.like.sugerir_r:%')
    .lt('pendiente_expira', ahora.toISOString())
  if (e2) console.error('[cierre-rechazo] consulta cierres:', e2)

  for (const estado of expirados ?? []) {
    const accion = estado.pendiente_accion as string
    const prefijo = accion.startsWith('sugerir_r:') ? 'sugerir_r:' : 'sugerir_horarios:'
    const [solicitudId, clienteEmail, ...nombrePartes] = accion.slice(prefijo.length).split(':')
    const clienteNombre = nombrePartes.join(':') || 'el cliente'

    // Reclamar el estado: solo una ejecución cierra
    const { data: limpiado } = await supabase
      .from('telegram_estados')
      .update({ pendiente_accion: null, pendiente_expira: null })
      .eq('chat_id', estado.chat_id)
      .eq('pendiente_accion', accion)
      .select('chat_id')
      .maybeSingle()
    if (!limpiado) continue

    if (solicitudId) {
      await supabase.from('solicitudes').update({ estado: 'rechazada' }).eq('id', solicitudId).in('estado', ['pendiente', 'rechazada', 'aceptada'])
    }

    const { data: compitaData } = await supabase.from('compitas').select('nombre').eq('telegram_chat_id', estado.chat_id).maybeSingle()
    const compitaNombre = compitaData?.nombre ?? 'La compita'

    if (clienteEmail) {
      try {
        await sendEmail({
          to: clienteEmail,
          subject: `${compitaNombre} no pudo coordinarse contigo`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">No fue posible coordinar esta vez</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6"><strong>${esc(compitaNombre)}</strong> no pudo proponer horarios alternativos para atenderte.</p>
              <p style="color:#4A3B6B;font-size:15px;line-height:1.6">No te preocupes. Hay más compitas disponibles. Explora otros perfiles y encuentra el que mejor se adapte a tu familiar.</p>
              <a href="${SITE_URL}/compitas" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:4px">Ver otros compitas →</a>
              <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>`,
        })
      } catch (e) {
        console.error('Email cierre rechazo cliente:', e)
        await avisarAdmin(`⚠️ No se pudo avisar a <b>${esc(clienteNombre)}</b> (${esc(clienteEmail)}) que su solicitud con <b>${esc(compitaNombre)}</b> se cerró. Avísale manualmente.`)
      }
    }
    try {
      await sendTelegramMessage(
        estado.chat_id,
        `La solicitud de <b>${esc(clienteNombre)}</b> fue cerrada automáticamente.\n\nEl cliente fue notificado de que no pudiste coordinarte con ellos en esta oportunidad.`,
        INLINE_INICIO,
      )
    } catch (e) { console.error('Telegram cierre rechazo compita:', e) }
    cierres++
  }

  // ── 3. Solicitudes pendientes sin respuesta de la compita ────────────────────
  const hace24h = new Date(Date.now() - 24 * 3600_000).toISOString()
  const hace72h = new Date(Date.now() - 72 * 3600_000).toISOString()
  const { data: sinResponder, error: e3 } = await supabase
    .from('solicitudes')
    .select('id, created_at, compita_id, cliente_id, compitas(nombre, telegram_chat_id), usuarios!solicitudes_cliente_id_fkey(nombre, email)')
    .eq('estado', 'pendiente')
    .lt('created_at', hace24h)
    .gt('created_at', new Date(Date.now() - 14 * 86400_000).toISOString()) as {
      data: Array<{ id: string; created_at: string; compitas: { nombre: string; telegram_chat_id: string | null } | null; usuarios: { nombre: string; email: string } | null }> | null; error: unknown
    }
  if (e3) console.error('[cierre-rechazo] consulta sin responder:', e3)

  for (const sol of sinResponder ?? []) {
    const nombreCompita = sol.compitas?.nombre ?? 'la compita'
    if (sol.created_at < hace72h) {
      if (!(await reclamarUnaVez(`pend_cierre:${sol.id}`))) continue
      const { data: cerrada } = await supabase.from('solicitudes').update({ estado: 'rechazada' }).eq('id', sol.id).eq('estado', 'pendiente').select('id').maybeSingle()
      if (!cerrada) continue
      pendientesCerradas++
      if (sol.usuarios?.email) {
        try {
          await sendEmail({
            to: sol.usuarios.email,
            subject: `${nombreCompita} no pudo responder tu solicitud`,
            html: `
              <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
                <h2 style="color:#2D1464;font-size:22px">Tu solicitud no recibió respuesta</h2>
                <p style="color:#4A3B6B;font-size:16px;line-height:1.6"><strong>${esc(nombreCompita)}</strong> no alcanzó a responder tu solicitud de entrevista. Puedes elegir a otra compita disponible.</p>
                <a href="${SITE_URL}/compitas" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:4px">Ver compitas →</a>
                <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
              </div>`,
          })
        } catch (e) { console.error('Email cierre pendiente:', e) }
      }
      await avisarAdmin(`⌛ Solicitud sin respuesta por 72 h cerrada: <b>${esc(sol.usuarios?.nombre ?? 'cliente')}</b> → <b>${esc(nombreCompita)}</b>.`)
    } else if (await reclamarUnaVez(`pend_rec:${sol.id}`)) {
      if (sol.compitas?.telegram_chat_id) {
        try {
          await sendTelegramMessage(sol.compitas.telegram_chat_id, `⏰ <b>Tienes una solicitud sin responder</b>\n\n<b>${esc(sol.usuarios?.nombre ?? 'Un cliente')}</b> quiere conocerte. Busca el mensaje con los horarios y toca el que te funcione, o rechaza si no puedes. Si no respondes, la solicitud se cerrará en 2 días.`)
        } catch (e) { console.error('Recordatorio pendiente compita:', e) }
      } else {
        await avisarAdmin(`⚠️ Solicitud pendiente hace 24 h para <b>${esc(nombreCompita)}</b>, que no tiene Telegram vinculado.`)
      }
    }
  }

  await latido('cierre-rechazo')
  return NextResponse.json({ ok: true, recordatorios, cierres, pendientesCerradas })
}
