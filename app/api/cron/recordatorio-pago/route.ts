// POST /api/cron/recordatorio-pago — diario 11:00 VE.
// A los 30 días de un pago de plan mensual (Compañía / Compañía Plus), avisa al cliente que toca renovar
// y resume el pago pendiente al admin. Una sola vez por pago. Sin cobros automáticos: paga el cliente.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendEmail, SITE_URL } from '@/lib/email'
import { avisarAdmin } from '@/lib/telegram'
import { esc } from '@/lib/html'
import { PLANES, CICLO_PAGO_DIAS, TEXTO_REEMBOLSO, type PlanId } from '@/lib/planes'
import { cupoDelPlan } from '@/lib/visitas'
import { cronAutorizado, latido, reclamarUnaVez } from '@/lib/cron'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabase()
  const hace30 = new Date(Date.now() - CICLO_PAGO_DIAS * 86400_000).toISOString()
  const hace45 = new Date(Date.now() - 45 * 86400_000).toISOString()

  const { data: pagos, error } = await admin
    .from('pagos_plan')
    .select('id, usuario_id, plan, inicio, usuarios(nombre, email)')
    .eq('estado', 'activo').eq('tipo', 'plan').in('plan', ['quincenal', 'semanal'])
    .lte('inicio', hace30).gte('inicio', hace45) as {
      data: Array<{ id: string; usuario_id: string; plan: PlanId; inicio: string; usuarios: { nombre: string; email: string } | null }> | null; error: unknown
    }
  if (error) console.error('[recordatorio-pago] consulta falló:', error)

  const avisados: string[] = []
  for (const p of pagos ?? []) {
    // ¿Ya renovó? (hay un pago de plan más reciente que este)
    const { count } = await admin
      .from('pagos_plan').select('id', { count: 'exact', head: true })
      .eq('usuario_id', p.usuario_id).eq('estado', 'activo').eq('tipo', 'plan').gt('inicio', p.inicio)
    if ((count ?? 0) > 0) continue
    if (!p.usuarios?.email) continue
    if (!(await reclamarUnaVez(`pago_rec:${p.id}`))) continue

    const cupo = await cupoDelPlan(p.usuario_id)
    const plan = PLANES[p.plan]
    try {
      await sendEmail({
        to: p.usuarios.email,
        subject: 'Es hora de renovar tu plan en Compaz',
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px">Ya pasó un mes de tu plan</h2>
            <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${esc(p.usuarios.nombre.split(' ')[0])}. Para seguir agendando visitas, toca renovar tu plan <strong>${esc(plan.nombre)}</strong> ($${plan.precioUsd}).</p>
            <p style="color:#4A3B6B;font-size:15px;line-height:1.6">Puedes pagar por <strong>Zelle</strong> o transferencia: escríbenos a <a href="mailto:hola@micompaz.com" style="color:#FF6B2B">hola@micompaz.com</a> y te enviamos los datos.</p>
            ${cupo && cupo.restantes > 0 ? `<p style="color:#4A3B6B;font-size:15px;line-height:1.6">Buenas noticias: todavía te quedan <strong>${cupo.restantes} ${cupo.restantes === 1 ? 'visita' : 'visitas'}</strong> sin usar, y se suman a las del nuevo mes.</p>` : ''}
            <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px;margin-top:8px">Ir a mi portal →</a>
            <p style="color:#9990A8;font-size:12px;margin-top:28px">${esc(TEXTO_REEMBOLSO)}</p>
          </div>`,
      })
      avisados.push(p.usuarios.nombre)
    } catch (e) {
      console.error('[recordatorio-pago] correo falló:', e)
      await admin.from('telegram_estados').delete().eq('chat_id', `pago_rec:${p.id}`) // reintentar mañana
    }
  }

  if (avisados.length > 0) {
    await avisarAdmin(`💳 <b>Renovaciones pendientes (${avisados.length})</b>\n\nSe avisó a: ${avisados.map(esc).join(', ')}.\n\nCuando paguen por Zelle o transferencia, regístralo en el panel: Clientes, Pagos y plan.`)
  }

  await latido('recordatorio-pago')
  return NextResponse.json({ ok: true, avisados: avisados.length })
}
