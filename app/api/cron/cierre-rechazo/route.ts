// POST /api/cron/cierre-rechazo — cada 30 min
// Solicitudes 'pendiente' sin respuesta de la compita: recordatorio a las 24 h, cierre a las 72 h.
// (Antes también cerraba las «sugerencias de horarios» del compita; ya no existen: las horas se acuerdan solo con las horas libres.)
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, avisarAdmin, TECLADO_SIN_VISITA } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { novedadInformativa } from '@/lib/novedades'
import { cronAutorizado, latido, reclamarUnaVez } from '@/lib/cron'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabase()
  const ahora = new Date()
  let recordatorios = 0, pendientesCerradas = 0

  // ── Solicitudes pendientes sin respuesta de la compita ────────────────────
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
      await novedadInformativa({ usuarioId: (sol as unknown as { cliente_id: string }).cliente_id, tipo: 'solicitud_cerrada', titulo: `${nombreCompita.split(' ')[0]} no pudo responder tu solicitud. Elige a otro compita.`, entidad: 'solicitud', entidadId: sol.id, clave: `solicitud_cerrada:${sol.id}` })
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
</div>`,
          })
        } catch (e) { console.error('Email cierre pendiente:', e) }
      }
      await alertaAdmin('actividad', `⌛ Solicitud sin respuesta por 72 h cerrada: <b>${esc(sol.usuarios?.nombre ?? 'cliente')}</b> → <b>${esc(nombreCompita)}</b>.`)
    } else if (await reclamarUnaVez(`pend_rec:${sol.id}`)) {
      if (sol.compitas?.telegram_chat_id) {
        try {
          await sendTelegramMessage(sol.compitas.telegram_chat_id, `⏰ <b>Tienes una solicitud sin responder</b>\n\n<b>${esc(sol.usuarios?.nombre ?? 'Un cliente')}</b> quiere conocerte. Busca el mensaje con los horarios y toca el que te funcione, o rechaza si no puedes. Si no respondes, la solicitud se cerrará en 2 días.`)
        } catch (e) { console.error('Recordatorio pendiente compita:', e) }
      } else {
        await alertaAdmin('tarea', `⚠️ Solicitud pendiente hace 24 h para <b>${esc(nombreCompita)}</b>, que no tiene Telegram vinculado.`)
      }
    }
  }

  await latido('cierre-rechazo')
  return NextResponse.json({ ok: true, recordatorios, pendientesCerradas })
}
