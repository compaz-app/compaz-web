// POST /api/admin/confirmar-solicitud — el admin confirma que llegó el dinero de una solicitud de pago del cliente.
// { solicitud_id, accion?: 'confirmar'|'cancelar' }
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { confirmarSolicitudPago, cancelarSolicitudPago } from '@/lib/solicitudes-pago'
import { cupoDelPlan } from '@/lib/visitas'
import { sendEmail, SITE_URL } from '@/lib/email'
import { createAdminSupabase } from '@/lib/supabase-server'
import { esc } from '@/lib/html'
import { emailAdminPago } from '@/lib/aviso-pago'
import { PLANES, ETIQUETA_METODO, TEXTO_REEMBOLSO, type PlanId, type MetodoPago } from '@/lib/planes'
import { ok, err, unauthorized } from '@/lib/api'

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return unauthorized()
  const b = await req.json().catch(() => null) as { solicitud_id?: string; accion?: string } | null
  if (!b?.solicitud_id) return err('Falta solicitud_id')

  if (b.accion === 'cancelar') return (await cancelarSolicitudPago(b.solicitud_id)) ? ok({ cancelada: true }) : err('La solicitud ya fue resuelta', 409)

  const r = await confirmarSolicitudPago(b.solicitud_id, admin.email ?? 'admin')
  if (!r.ok) return err(r.error, r.status)

  const { data: cli } = await createAdminSupabase().from('usuarios').select('nombre, email').eq('id', r.usuarioId).maybeSingle()
  let correoEnviado = !cli?.email
  if (cli?.email) {
    const p = r.pago
    const que = p.tipo === 'plan' ? `plan ${PLANES[p.plan as PlanId].nombre}` : `visita extra de ${p.horas} horas`
    const vence = new Date(p.vence).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Caracas' })
    try {
      await sendEmail({
        to: cli.email, subject: 'Recibimos tu pago en Compaz',
        html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h2 style="color:#2D1464;font-size:22px">¡Recibimos tu pago!</h2>
          <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${esc(cli.nombre.split(' ')[0])}. Confirmamos tu pago de <strong>$${p.monto_usd}</strong> por ${esc(ETIQUETA_METODO[p.metodo as MetodoPago])}: <strong>${esc(que)}</strong> (${p.visitas} ${p.visitas === 1 ? 'visita' : 'visitas'}), disponibles hasta el <strong>${esc(vence)}</strong>.</p>
          <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px;margin-top:8px">Ir a mi portal →</a>
          <p style="color:#9990A8;font-size:12px;margin-top:28px">${esc(TEXTO_REEMBOLSO)}</p></div>`,
      })
      correoEnviado = true
    } catch (e) { console.error('[confirmar-solicitud] correo falló:', e) }
  }
  await emailAdminPago('Pago confirmado en Compaz', `Confirmaste el pago de $${r.pago.monto_usd} de ${cli?.nombre ?? 'un cliente'} (${ETIQUETA_METODO[r.pago.metodo as MetodoPago]}).`)
  return ok({ pago: r.pago, cupo: await cupoDelPlan(r.usuarioId), correo_enviado: correoEnviado })
}
