import { NextRequest } from 'next/server'
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, INLINE_INICIO } from '@/lib/telegram'
import { ok, err, notFound, serverError, unauthorized } from '@/lib/api'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const { solicitud_id, plan } = await req.json()
  if (!solicitud_id || !plan) return err('Faltan parámetros', 400)
  const planesValidos = ['carta', 'quincenal', 'semanal', 'unica', 'mensual']
  if (!planesValidos.includes(plan)) return err('Plan inválido', 400)

  const PLAN_INFO: Record<string, { nombre: string; descripcion: string }> = {
    carta:     { nombre: 'A la carta',      descripcion: 'Una visita de 2 horas.' },
    quincenal: { nombre: 'Compañía',        descripcion: '2 visitas al mes de 2 horas cada una.' },
    semanal:   { nombre: 'Compañía Plus',   descripcion: '4 visitas al mes de 2 horas cada una.' },
    unica:     { nombre: 'Visita puntual',  descripcion: 'Una visita de 2 horas.' },
    mensual:   { nombre: 'Membresía',       descripcion: 'Visitas regulares de 2 horas cada una.' },
  }
  const planInfo = PLAN_INFO[plan]

  const admin = createAdminSupabase()

  const { data: sol } = await admin
    .from('solicitudes')
    .select('id, estado, cliente_id, compita_id, compitas(nombre, telegram_chat_id), usuarios!solicitudes_cliente_id_fkey(nombre, email, familiar_nombre, familiar_edad, familiar_condicion, familiar_notas)')
    .eq('id', solicitud_id)
    .single() as {
      data: {
        id: string
        estado: string
        cliente_id: string
        compita_id: string
        compitas: { nombre: string; telegram_chat_id: string | null } | null
        usuarios: { nombre: string; email: string; familiar_nombre: string | null; familiar_edad: number | null; familiar_condicion: string | null; familiar_notas: string | null } | null
      } | null
    }

  if (!sol) return notFound()
  if (sol.cliente_id !== user.id) return unauthorized()

  // Marcar como contratada atómicamente — .in('estado', [...]) previene race conditions
  // si el cliente hace doble clic: solo la primera request afecta filas, la segunda no encuentra nada.
  // Acepta 'aceptada' (cliente paga antes de que el compita marque la llamada como bien) y 'completada'.
  const { data: claimed, error: eSol } = await admin
    .from('solicitudes')
    .update({ estado: 'contratada' })
    .eq('id', solicitud_id)
    .in('estado', ['aceptada', 'completada'])
    .select('id')
    .single()
  if (eSol || !claimed) return err('Esta solicitud ya fue procesada', 400)

  // Crear visita en estado pre_visita para el chat de coordinación
  const { error: eVisita } = await admin
    .from('visitas')
    .insert({ compita_id: sol.compita_id, usuario_id: sol.cliente_id, estado: 'pre_visita' })
  if (eVisita) return serverError(eVisita)

  // Notificar al compita por Telegram
  if (sol.compitas?.telegram_chat_id) {
    const clienteNombre = sol.usuarios?.nombre ?? 'El cliente'
    const u = sol.usuarios
    const perfilLineas: string[] = []
    if (u?.familiar_nombre) perfilLineas.push(`<b>Nombre:</b> ${u.familiar_nombre}`)
    if (u?.familiar_edad) perfilLineas.push(`<b>Edad:</b> ${u.familiar_edad} años`)
    if (u?.familiar_condicion) perfilLineas.push(`<b>Condición:</b> ${u.familiar_condicion}`)
    if (u?.familiar_notas) perfilLineas.push(`<b>Notas:</b> ${u.familiar_notas}`)

    const perfilBloque = perfilLineas.length > 0
      ? [``, `🧓 <b>Sobre el familiar que vas a atender:</b>`, ...perfilLineas]
      : []

    try {
      await sendTelegramMessage(
        sol.compitas.telegram_chat_id,
        [
          `🎉 <b>¡Te contrataron!</b>`,
          ``,
          `<b>${clienteNombre}</b> acaba de contratarte con el plan <b>${planInfo.nombre}</b>.`,
          ``,
          `📋 <b>En qué consiste:</b> ${planInfo.descripcion}`,
          ...perfilBloque,
          ``,
          `👋 <b>Empieza saludando a ${clienteNombre.split(' ')[0]}</b>`,
          ``,
          `Escríbele desde este mismo chat — un simple "¡Hola! Soy tu compita, ¿cuándo te queda bien para la primera visita?" es suficiente para arrancar. Ellos lo verán en su dashboard y te responderán aquí.`,
          ``,
          `Una vez que queden de acuerdo, ingresa la fecha en el sistema para que quede registrada y el cliente reciba la confirmación.`,
          ``,
          `💙 Toda la comunicación con tu cliente debe mantenerse dentro de Compaz. Coordinar por fuera va contra nuestras condiciones de uso y puede resultar en la suspensión de tu cuenta.`,
        ].join('\n'),
        INLINE_INICIO,
      )
    } catch (e) { console.error('Telegram compita contratado:', e) }
  }

  // Email de confirmación al cliente
  const clienteEmail = sol.usuarios?.email ?? null
  const clienteNombre = sol.usuarios?.nombre ?? 'Cliente'
  if (clienteEmail) {
    const compitaNombreCorto = sol.compitas?.nombre.split(' ')[0] ?? 'tu compita'
    try {
      await resend.emails.send({
        from: 'Compaz <visitas@micompaz.com>',
        to: clienteEmail,
        subject: `¡Contratación confirmada! Coordina tu primera visita`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px;margin-bottom:12px">🎉 ¡Todo listo, ${clienteNombre.split(' ')[0]}!</h2>
            <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
              Acabas de contratar a <strong>${sol.compitas?.nombre ?? 'tu compita'}</strong> con el plan <strong>${planInfo.nombre}</strong>.
            </p>
            <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
              Le enviamos una notificación a ${compitaNombreCorto} para que te escriba pronto. También puedes escribirle tú desde el dashboard para coordinar la fecha de la primera visita.
            </p>
            <div style="background:#F5F0FF;border:2px solid #7C4DFF;border-radius:12px;padding:16px 20px;margin:20px 0">
              <p style="color:#2D1464;font-size:13px;font-weight:700;margin:0 0 4px">Próximo paso</p>
              <p style="color:#4A3B6B;font-size:14px;margin:0;line-height:1.6">
                Entra al dashboard, habla con ${compitaNombreCorto} por el chat y acuerden la fecha y hora de la primera visita.
              </p>
            </div>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://micompaz.com'}/dashboard?contratado=1" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px">
              Coordinar primera visita →
            </a>
            <p style="color:#9990A8;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>
        `,
      })
    } catch (e) { console.error('Email confirmación cliente contratado:', e) }
  }

  return ok({ plan })
}
