// POST /api/admin/registrar-pago — el admin registra un pago recibido por Zelle, transferencia, Stripe u otro.
// { usuario_id, tipo: 'plan'|'extra', plan?, horas?, monto_usd?, metodo, referencia? }
// Cada pago crea un paquete de visitas que vence a los 60 días.
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { registrarPago } from '@/lib/pagos'
import { cupoDelPlan } from '@/lib/visitas'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { ETIQUETA_METODO, PLANES, TEXTO_REEMBOLSO, type PlanId, type MetodoPago } from '@/lib/planes'
import { ok, err, unauthorized } from '@/lib/api'

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return unauthorized()

  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!b || typeof b.usuario_id !== 'string') return err('Falta usuario_id')

  const r = await registrarPago({
    usuarioId: b.usuario_id,
    tipo: b.tipo as 'plan' | 'extra',
    plan: typeof b.plan === 'string' ? b.plan : null,
    horas: b.horas === undefined || b.horas === null ? null : Number(b.horas),
    montoUsd: b.monto_usd === undefined || b.monto_usd === null || b.monto_usd === '' ? null : Number(b.monto_usd),
    metodo: String(b.metodo ?? ''),
    referencia: typeof b.referencia === 'string' ? b.referencia : null,
    registradoPor: admin.email ?? 'admin',
  })
  if (!r.ok) return err(r.error, r.error.startsWith('Cliente no') ? 404 : 400)

  // Confirmación al cliente
  const { data: cli } = await createAdminSupabase().from('usuarios').select('nombre, email').eq('id', b.usuario_id).maybeSingle()
  let correoEnviado = !cli?.email
  if (cli?.email) {
    const p = r.pago
    const que = p.tipo === 'plan' ? `plan ${PLANES[p.plan as PlanId].nombre}` : `visita extra de ${p.horas} horas`
    const vence = new Date(p.vence).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Caracas' })
    try {
      await sendEmail({
        to: cli.email,
        subject: 'Recibimos tu pago en Compaz',
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px">¡Recibimos tu pago!</h2>
            <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${esc(cli.nombre.split(' ')[0])}. Registramos tu pago de <strong>$${p.monto_usd}</strong> por ${esc(ETIQUETA_METODO[p.metodo as MetodoPago])} correspondiente a: <strong>${esc(que)}</strong> (${p.visitas} ${p.visitas === 1 ? 'visita' : 'visitas'}).</p>
            <p style="color:#4A3B6B;font-size:15px;line-height:1.6">Las visitas que no uses este mes siguen disponibles hasta el <strong>${esc(vence)}</strong>.</p>
            <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px;margin-top:8px">Ir a mi portal →</a>
            <p style="color:#9990A8;font-size:12px;margin-top:28px">${esc(TEXTO_REEMBOLSO)}</p>
          </div>`,
      })
      correoEnviado = true
    } catch (e) { console.error('[registrar-pago] correo al cliente falló:', e) }
  }

  return ok({ pago: r.pago, cupo: await cupoDelPlan(b.usuario_id), correo_enviado: correoEnviado })
}
