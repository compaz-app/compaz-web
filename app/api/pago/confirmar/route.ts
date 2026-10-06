import { NextRequest } from 'next/server'
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { ok, err, notFound, serverError, unauthorized } from '@/lib/api'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const { solicitud_id, plan } = await req.json()
  if (!solicitud_id || !plan) return err('Faltan parámetros', 400)
  if (plan !== 'unica' && plan !== 'mensual') return err('Plan inválido', 400)

  const admin = createAdminSupabase()

  const { data: sol } = await admin
    .from('solicitudes')
    .select('id, estado, cliente_id, compita_id, compitas(nombre, telegram_chat_id), usuarios!solicitudes_cliente_id_fkey(nombre, familiar_nombre, familiar_edad, familiar_condicion, familiar_notas)')
    .eq('id', solicitud_id)
    .single() as {
      data: {
        id: string
        estado: string
        cliente_id: string
        compita_id: string
        compitas: { nombre: string; telegram_chat_id: string | null } | null
        usuarios: { nombre: string; familiar_nombre: string | null; familiar_edad: number | null; familiar_condicion: string | null; familiar_notas: string | null } | null
      } | null
    }

  if (!sol) return notFound()
  if (sol.cliente_id !== user.id) return unauthorized()
  if (sol.estado !== 'completada') return err('Esta solicitud ya fue procesada', 400)

  // Marcar solicitud como contratada
  const { error: eSol } = await admin
    .from('solicitudes')
    .update({ estado: 'contratada' })
    .eq('id', solicitud_id)
  if (eSol) return serverError(eSol)

  // Crear visita en estado pre_visita para el chat de coordinación
  const { error: eVisita } = await admin
    .from('visitas')
    .insert({ compita_id: sol.compita_id, usuario_id: sol.cliente_id, estado: 'pre_visita' })
  if (eVisita) return serverError(eVisita)

  // Notificar al compita por Telegram
  if (sol.compitas?.telegram_chat_id) {
    const clienteNombre = sol.usuarios?.nombre ?? 'El cliente'
    const planTexto = plan === 'unica' ? 'una visita puntual' : 'una membresía mensual'
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
          `<b>${clienteNombre}</b> acaba de confirmar tu contratación con <b>${planTexto}</b>.`,
          ...perfilBloque,
          ``,
          `Ya puedes coordinar con ellos la fecha y hora de la primera visita. <b>Escríbeles desde este mismo chat</b> y ellos lo verán en su dashboard. Cuando el cliente te responda, también recibirás el mensaje aquí.`,
          ``,
          `💙 <b>Recuerda:</b> Toda la comunicación con tu cliente debe mantenerse dentro de Compaz. Coordinar o acordar servicios fuera de la plataforma va contra nuestras condiciones de uso y puede resultar en la suspensión de tu cuenta. Llevamos esto con respeto y confianza de ambas partes, y estamos aquí para apoyarte.`,
        ].join('\n'),
      )
    } catch (e) { console.error('Telegram compita contratado:', e) }
  }

  return ok({ plan })
}
