import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getClienteActivo } from '@/lib/auth'
import { sendTelegramMessage, avisarAdmin, INLINE_INICIO } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { emailAdminPago } from '@/lib/aviso-pago'
import { esc } from '@/lib/html'
import { pagoSimuladoActivo, PLANES_VALIDOS, PLAN_INFO } from '@/lib/pago'
import { registrarPago } from '@/lib/pagos'
import { ok, err, notFound, serverError, unauthorized } from '@/lib/api'

type SolRow = {
  id: string; estado: string; cliente_id: string; compita_id: string
  compitas: { nombre: string; telegram_chat_id: string | null; estado: string; verificado: boolean } | null
  usuarios: { nombre: string; email: string; plan: string | null; familiar_nombre: string | null; familiar_edad: number | null; familiar_condicion: string | null; familiar_notas: string | null } | null
}

export async function POST(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  const body = await req.json().catch(() => null) as { solicitud_id?: string; plan?: string } | null
  const solicitud_id = body?.solicitud_id
  const plan = body?.plan
  if (!solicitud_id || !plan) return err('Faltan parámetros', 400)
  if (!(PLANES_VALIDOS as readonly string[]).includes(plan)) return err('Plan inválido', 400)
  const planInfo = PLAN_INFO[plan]

  const admin = createAdminSupabase()
  const { data: sol } = await admin
    .from('solicitudes')
    .select('id, estado, cliente_id, compita_id, compitas(nombre, telegram_chat_id, estado, verificado), usuarios!solicitudes_cliente_id_fkey(nombre, email, plan, familiar_nombre, familiar_edad, familiar_condicion, familiar_notas)')
    .eq('id', solicitud_id)
    .maybeSingle() as { data: SolRow | null }

  if (!sol) return notFound()
  if (sol.cliente_id !== user.id) return unauthorized()
  if (sol.usuarios?.plan === 'bloqueado') return err('Tu cuenta está suspendida. Escríbenos a hola@micompaz.com.', 403)
  if (!['aceptada', 'completada'].includes(sol.estado)) return err('Esta solicitud ya fue procesada', 400)
  if (sol.compitas?.estado !== 'activo' || !sol.compitas.verificado) return err('Esta compita ya no está disponible. Elige otra.', 409)

  const clienteNombre = sol.usuarios?.nombre ?? 'El cliente'

  // ── Sin pasarela de pago: no se contrata gratis. Se registra el interés y se avisa al admin. ──
  if (!pagoSimuladoActivo()) {
    await avisarAdmin([
      `💳 <b>Cliente quiere contratar (pago pendiente)</b>`, ``,
      `<b>Cliente:</b> ${esc(clienteNombre)} (${esc(sol.usuarios?.email ?? '')})`,
      `<b>Compita:</b> ${esc(sol.compitas?.nombre ?? '')}`,
      `<b>Plan:</b> ${esc(planInfo.nombre)}`, ``,
      `Coordina el pago y luego asigna la compita desde el panel admin.`,
    ].join('\n'))
    await emailAdminPago('Un cliente quiere contratar en Compaz', `${clienteNombre} (${sol.usuarios?.email ?? ''}) quiere contratar el plan ${planInfo.nombre} con ${sol.compitas?.nombre ?? 'una compita'}. El pago está pendiente: coordínalo y asigna la compita desde el panel.`)
    return ok({ plan, pendiente: true })
  }

  // Reclamo atómico de la solicitud
  const { data: claimed, error: eSol } = await admin
    .from('solicitudes')
    .update({ estado: 'contratada' })
    .eq('id', solicitud_id)
    .in('estado', ['aceptada', 'completada'])
    .select('id')
    .maybeSingle()
  if (eSol || !claimed) return err('Esta solicitud ya fue procesada', 400)

  // Revertir si falla algún paso: no dejar la solicitud "contratada" sin visita ni asignación.
  const revertir = async () => { await admin.from('solicitudes').update({ estado: sol.estado }).eq('id', solicitud_id) }

  // Registrar el pago (paquete de visitas) ANTES de crear la visita: esa primera visita cuenta dentro del cupo.
  const pago = await registrarPago({ usuarioId: sol.cliente_id, tipo: 'plan', plan, metodo: 'otro', referencia: 'pago simulado', registradoPor: 'sistema' })
  if (!pago.ok) {
    console.error('[pago/confirmar] no se pudo registrar el pago:', pago.error)
    await avisarAdmin(`⚠️ <b>${esc(clienteNombre)}</b> contrató el plan <b>${esc(planInfo.nombre)}</b> pero no se pudo registrar el pago (sin límite de visitas). Ejecuta la migración de pagos y regístralo desde el panel.`)
  }

  // La visita de coordinación solo se crea si no hay ya una activa con esta compita
  const { data: existente } = await admin
    .from('visitas').select('id')
    .eq('compita_id', sol.compita_id).eq('usuario_id', sol.cliente_id)
    .in('estado', ['pre_visita', 'programada', 'en_curso']).limit(1).maybeSingle()

  let visitaId = existente?.id as string | undefined
  if (!visitaId) {
    const { data: nueva, error: eVisita } = await admin
      .from('visitas')
      .insert({ compita_id: sol.compita_id, usuario_id: sol.cliente_id, estado: 'pre_visita' })
      .select('id').single()
    if (eVisita || !nueva) { await revertir(); return serverError(eVisita) }
    visitaId = nueva.id
  }

  // Asignar la compita al cliente (sin esto el bot no encuentra al cliente de la compita)
  const { error: eAsig } = await admin.from('usuarios').update({ compita_id: sol.compita_id }).eq('id', sol.cliente_id)
  if (eAsig) { await revertir(); return serverError(eAsig) }

  // Dejar constancia del plan elegido (no existe columna dedicada; usuarios.plan se reserva para 'bloqueado')
  await admin.from('mensajes').insert({ visit_id: visitaId, origen: 'admin', tipo: 'texto', contenido: `plan:${plan}` }) // histórico; la fuente de verdad es usuarios.plan_contratado

  const u = sol.usuarios
  if (sol.compitas?.telegram_chat_id) {
    const perfilLineas: string[] = []
    if (u?.familiar_nombre) perfilLineas.push(`<b>Nombre:</b> ${esc(u.familiar_nombre)}`)
    if (u?.familiar_edad) perfilLineas.push(`<b>Edad:</b> ${esc(u.familiar_edad)} años`)
    if (u?.familiar_condicion) perfilLineas.push(`<b>Condición:</b> ${esc(u.familiar_condicion)}`)
    if (u?.familiar_notas) perfilLineas.push(`<b>Notas:</b> ${esc(u.familiar_notas)}`)
    const perfilBloque = perfilLineas.length > 0 ? [``, `🧓 <b>Sobre el familiar que vas a atender:</b>`, ...perfilLineas] : []
    try {
      await sendTelegramMessage(
        sol.compitas.telegram_chat_id,
        [
          `🎉 <b>¡Te contrataron!</b>`, ``,
          `<b>${esc(clienteNombre)}</b> acaba de contratarte con el plan <b>${esc(planInfo.nombre)}</b>.`, ``,
          `📋 <b>En qué consiste:</b> ${esc(planInfo.descripcion)}`,
          ...perfilBloque, ``,
          `👋 <b>Empieza saludando a ${esc(clienteNombre.split(' ')[0])}</b>`, ``,
          `Escríbele desde este mismo chat: un simple "¡Hola! Soy tu compita, ¿cuándo te queda bien para la primera visita?" es suficiente. Ellos lo verán en su dashboard y te responderán aquí.`, ``,
          `Una vez que queden de acuerdo, el cliente registra la fecha en el sistema y tú podrás iniciar la visita desde aquí.`, ``,
          `💙 Toda la comunicación con tu cliente debe mantenerse dentro de Compaz. Coordinar por fuera va contra nuestras condiciones de uso y puede resultar en la suspensión de tu cuenta.`,
        ].join('\n'),
        INLINE_INICIO,
      )
    } catch (e) {
      console.error('Telegram compita contratado:', e)
      await avisarAdmin(`⚠️ No se pudo avisar a <b>${esc(sol.compitas.nombre)}</b> que fue contratada por <b>${esc(clienteNombre)}</b>. Contáctala.`)
    }
  } else {
    await avisarAdmin(`⚠️ <b>${esc(sol.compitas?.nombre ?? 'La compita')}</b> fue contratada por <b>${esc(clienteNombre)}</b> pero no tiene Telegram vinculado.`)
  }

  if (u?.email) {
    const corto = esc(sol.compitas?.nombre.split(' ')[0] ?? 'tu compita')
    try {
      await sendEmail({
        to: u.email,
        subject: `¡Contratación confirmada! Coordina tu primera visita`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px;margin-bottom:12px">🎉 ¡Todo listo, ${esc(clienteNombre.split(' ')[0])}!</h2>
            <p style="color:#4A3B6B;font-size:15px;line-height:1.6">Acabas de contratar a <strong>${esc(sol.compitas?.nombre ?? 'tu compita')}</strong> con el plan <strong>${esc(planInfo.nombre)}</strong>.</p>
            <p style="color:#4A3B6B;font-size:15px;line-height:1.6">Le enviamos una notificación a ${corto} para que te escriba pronto. También puedes escribirle tú desde el dashboard para coordinar la fecha de la primera visita.</p>
            <div style="background:#F5F0FF;border:2px solid #7C4DFF;border-radius:12px;padding:16px 20px;margin:20px 0">
              <p style="color:#2D1464;font-size:13px;font-weight:700;margin:0 0 4px">Próximo paso</p>
              <p style="color:#4A3B6B;font-size:14px;margin:0;line-height:1.6">Entra al dashboard, habla con ${corto} por el chat y acuerden la fecha y hora de la primera visita.</p>
            </div>
            <a href="${SITE_URL}/dashboard?contratado=1" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px">Coordinar primera visita →</a>
            <p style="color:#9990A8;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>`,
      })
    } catch (e) { console.error('Email confirmación cliente contratado:', e) }
  }

  return ok({ plan })
}
