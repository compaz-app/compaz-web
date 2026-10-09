// /api/solicitud/resultado-llamada?token=&resultado=contratar|reagendar|no_contratar|bien&quien=cliente|compita&s=<firma>
// Acciones que cambian estado (no_contratar, bien, reagendar de la compita) exigen firma de rol y POST.
// contratar y reagendar del cliente solo redirigen (la autorización real ocurre en /pago y /compitas).
import { NextRequest, NextResponse } from 'next/server'
import { getSolicitudPorToken, iniciarReagendadoPorCompita } from '@/lib/solicitudes'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { rolValido } from '@/lib/links'
import { pagina, puertaConfirmacion } from '@/lib/confirm'

type Resultado = 'contratar' | 'reagendar' | 'no_contratar' | 'bien'

function leer(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const token = sp.get('token')
  const resultado = sp.get('resultado') as Resultado | null
  const quienRaw = sp.get('quien') ?? 'cliente'
  if (!token || !resultado || !['contratar', 'reagendar', 'no_contratar', 'bien'].includes(resultado)) return null
  const firmado = rolValido(token, quienRaw, sp.get('s'))
  return { token, resultado, quien: (quienRaw === 'compita' ? 'compita' : 'cliente') as 'cliente' | 'compita', firmado }
}

/** ¿Esta acción cambia estado y por tanto requiere firma + POST? */
function esMutante(r: Resultado, quien: 'cliente' | 'compita') {
  return r === 'no_contratar' || r === 'bien' || (r === 'reagendar' && quien === 'compita')
}

export async function GET(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)
  if (!esMutante(p.resultado, p.quien)) return ejecutar(req, p)
  if (!p.firmado) return pagina('Enlace inválido', 'Este enlace no es válido o está incompleto.', 400)
  const textos: Record<string, [string, string, string]> = {
    no_contratar: ['¿No quieres continuar?', 'Confirma que no deseas contratar a esta persona por ahora.', 'Confirmar'],
    bien: ['¿La llamada fue bien?', 'Confirma que la llamada se realizó con normalidad.', 'Sí, estuvo bien'],
    reagendar: ['¿Necesitas reagendar?', 'Confirma que necesitas repetir la llamada en otro horario.', 'Reagendar'],
  }
  const [t, c, b] = textos[p.resultado]
  return puertaConfirmacion(req, t, c, b)
}

export async function POST(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)
  if (esMutante(p.resultado, p.quien) && !p.firmado) return pagina('Enlace inválido', 'Este enlace no es válido o está incompleto.', 400)
  return ejecutar(req, p)
}

async function ejecutar(req: NextRequest, p: NonNullable<ReturnType<typeof leer>>) {
  const origin = SITE_URL
  const { token, resultado, quien } = p

  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud) return pagina('Enlace inválido', 'No encontramos esta solicitud.', 404)

  if (resultado !== 'bien' && resultado !== 'reagendar') {
    if (solicitud.estado === 'contratada') {
      return pagina('Ya registrado', `Ya registramos que querías contratar a ${solicitud.compita_nombre ?? 'tu compita'}. El equipo de Compaz está coordinando los detalles.`)
    }
    if (solicitud.estado === 'rechazada' && resultado === 'no_contratar') return NextResponse.redirect(`${origin}/compitas`, 303)
    if (solicitud.estado === 'rechazada' && resultado === 'contratar') {
      return pagina('Enlace vencido', 'Esta sesión ya cerró. Si tienes alguna duda escríbenos a hola@micompaz.com.')
    }
  }

  const admin = createAdminSupabase()
  const [{ data: cliente }, { data: compita }] = await Promise.all([
    admin.from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single(),
    admin.from('compitas').select('telegram_chat_id, nombre').eq('id', solicitud.compita_id).single(),
  ])

  // ── La compita reporta que estuvo bien ────────────────────────────────────
  if (quien === 'compita' && resultado === 'bien') {
    await admin.from('solicitudes').update({ estado: 'completada' }).eq('id', solicitud.id).eq('estado', 'aceptada')
    if (compita?.telegram_chat_id) {
      try {
        await sendTelegramMessage(compita.telegram_chat_id, `✅ <b>Llamada registrada</b>\n\nGracias por tu tiempo. Ahora esperamos que la familia nos confirme su decisión. Te avisamos en cuanto sepamos. ¡Gracias por ser parte de Compaz!`)
      } catch (e) { console.error('Telegram bien compita:', e) }
    }
    return pagina('¡Gracias!', 'Registramos que la llamada fue bien. Estaremos en contacto según lo que decida la familia.')
  }

  // ── Reagendar ─────────────────────────────────────────────────────────────
  if (resultado === 'reagendar') {
    if (quien === 'compita') {
      const reagendado = await iniciarReagendadoPorCompita(token)
      if (!reagendado) return pagina('Error', 'No pudimos procesar el reagendado (la solicitud ya cambió de estado).', 409)

      if (compita?.telegram_chat_id) {
        const accion = `sugerir_r:${solicitud.id}:${cliente?.email ?? ''}:${cliente?.nombre ?? 'el cliente'}`
        await admin.from('telegram_estados').upsert(
          { chat_id: compita.telegram_chat_id, registro_pendiente: false, pendiente_accion: accion, pendiente_expira: new Date(Date.now() + 24 * 3600_000).toISOString() },
          { onConflict: 'chat_id' },
        )
        try {
          await sendTelegramMessage(
            compita.telegram_chat_id,
            `🔄 <b>Reagendado iniciado</b>\n\n¿Cuándo puedes repetir la llamada con ${esc(cliente?.nombre ?? 'el cliente')}?\n\n✍️ <b>Responde a este mensaje con los horarios que te funcionen</b> y se los haremos llegar por email.\n\n📅 <i>Incluye el día y la hora exacta. Por ejemplo: lunes 13 de octubre a las 3:00pm.</i>`,
          )
        } catch (e) { console.error('Telegram reagendar compita:', e) }
      }

      if (cliente?.email) {
        try {
          await sendEmail({
            to: cliente.email,
            subject: `${solicitud.compita_nombre} necesita reagendar la llamada`,
            html: `
              <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
                <h2 style="color:#2D1464;font-size:22px">Reagendando la llamada</h2>
                <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                  <strong>${esc(solicitud.compita_nombre)}</strong> tuvo un problema técnico y necesita reagendar.
                  En breve recibirás un correo con nuevos horarios disponibles.
                </p>
                <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
              </div>`,
          })
        } catch (e) { console.error('Email reagendar al cliente desde compita:', e) }
      }
      return pagina('Reagendado iniciado', 'Escríbenos en Telegram los nuevos horarios y se los haremos llegar al cliente.')
    }
    return NextResponse.redirect(`${origin}/compitas?compita=${encodeURIComponent(solicitud.compita_id)}&reagendar=${encodeURIComponent(solicitud.id)}`, 303)
  }

  // ── Cliente contrata → paywall ────────────────────────────────────────────
  if (resultado === 'contratar') {
    return NextResponse.redirect(`${origin}/pago?solicitud=${encodeURIComponent(solicitud.id)}`, 303)
  }

  // ── Cliente no contrata ───────────────────────────────────────────────────
  const { data: cambiada, error: errUpdate } = await admin.from('solicitudes')
    .update({ confirmacion_cliente: false, estado: 'rechazada', seguimiento2_enviado: true })
    .eq('id', solicitud.id)
    .in('estado', ['aceptada', 'completada'])
    .select('id')
    .maybeSingle()
  if (errUpdate) {
    console.error('Error guardando no_contratar:', errUpdate)
    return pagina('Error', 'No pudimos registrar tu decisión. Intenta de nuevo.', 500)
  }
  if (!cambiada) return NextResponse.redirect(`${origin}/compitas`, 303)

  if (compita?.telegram_chat_id) {
    try {
      await sendTelegramMessage(
        compita.telegram_chat_id,
        `👋 <b>Gracias por tu dedicación</b>\n\nLa familia decidió no seguir adelante en esta ocasión. No es un reflejo de tu valor. A veces simplemente no encajan las necesidades o la química. Pasa, y no hay que desanimarse.\n\nMientras tanto, hay cosas que pueden ayudarte a destacar más:\n\n1. Agrega un video de presentación o mejora el que ya tienes. Las familias confían mucho más cuando te ven hablar.\n2. Actualiza o mejora la foto que tienes en tu perfil.\n3. Describe con más detalle tu experiencia específica (adultos mayores, niños, enfermedades crónicas, etc.).\n\nEl equipo de Compaz está trabajando para conectarte con nuevas familias. ¡Tú puedes!`,
      )
    } catch (e) { console.error('Telegram no_contratar compita:', e) }
  }
  await avisarAdmin(`ℹ️ <b>${esc(cliente?.nombre ?? 'Un cliente')}</b> decidió no contratar a <b>${esc(solicitud.compita_nombre)}</b> después de la llamada.`)

  return NextResponse.redirect(`${origin}/compitas`, 303)
}
