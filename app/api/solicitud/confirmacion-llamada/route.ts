// /api/solicitud/confirmacion-llamada?token=&quien=cliente|compita&s=<firma>&respuesta=si|no
// GET muestra una página con botón (los escáneres de correo no pueden ejecutar la acción);
// POST registra si la llamada ocurrió. La firma `s` ata el enlace a un rol (nadie puede responder por el otro).
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getSolicitudPorToken, registrarConfirmacion } from '@/lib/solicitudes'
import { avisarAdmin } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { rolValido } from '@/lib/links'
import { pagina, puertaConfirmacion } from '@/lib/confirm'

function leer(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const token = sp.get('token')
  const quien = sp.get('quien')
  const respuesta = sp.get('respuesta')
  if (!token || (respuesta !== 'si' && respuesta !== 'no') || !rolValido(token, quien, sp.get('s'))) return null
  return { token, quien: quien as 'cliente' | 'compita', respuesta }
}

export async function GET(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)
  return puertaConfirmacion(
    req,
    p.respuesta === 'si' ? '¿La llamada ocurrió?' : '¿La llamada no se pudo realizar?',
    p.respuesta === 'si' ? 'Confirma que la llamada se realizó con normalidad.' : 'Confirma que la llamada no ocurrió para ayudarte a reagendar.',
    p.respuesta === 'si' ? 'Sí, ocurrió' : 'No ocurrió',
  )
}

export async function POST(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)
  const { token, quien, respuesta } = p

  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud) return pagina('Enlace inválido', 'No encontramos esta solicitud.', 404)
  if (solicitud.estado !== 'aceptada') {
    return pagina('Ya registramos tu respuesta', 'Esta llamada ya fue procesada. ¡Gracias!')
  }

  const ocurrio = respuesta === 'si'
  const actualizada = await registrarConfirmacion(solicitud.id, quien, ocurrio)
  if (!actualizada) return pagina('Error', 'No pudimos registrar tu respuesta. Intenta de nuevo.', 500)

  if (!ocurrio) {
    const admin = createAdminSupabase()
    const { data: cliente } = await admin.from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()

    await avisarAdmin([
      `⚠️ <b>Llamada no ocurrió</b>`, ``,
      `<b>${quien === 'cliente' ? 'El cliente' : 'La compita'}</b> reportó que la llamada con <b>${esc(solicitud.compita_nombre)}</b>${quien === 'compita' ? ` y <b>${esc(cliente?.nombre ?? 'el cliente')}</b>` : ''} no se realizó.`, ``,
      `El cliente recibirá un link para proponer nuevos horarios.`,
    ].join('\n'))

    if (quien === 'compita' && cliente?.email) {
      try {
        await sendEmail({
          to: cliente.email,
          subject: `${solicitud.compita_nombre} propone reagendar la llamada`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">Reagendar con ${esc(solicitud.compita_nombre)}</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                Parece que la llamada no pudo realizarse. Elige nuevos horarios y ${esc(solicitud.compita_nombre)} confirmará el que mejor le quede.
              </p>
              <a href="${SITE_URL}/reagendar/${encodeURIComponent(token)}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:16px">
                Proponer nuevos horarios →
              </a>
              <p style="color:#6B5C90;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>`,
        })
      } catch (e) {
        console.error('Email reagendar al cliente:', e)
        await avisarAdmin(`⚠️ No se pudo enviar al cliente <b>${esc(cliente.nombre)}</b> el enlace para reagendar. Avísale manualmente.`)
      }
    }

    if (quien === 'cliente') return NextResponse.redirect(`${SITE_URL}/reagendar/${encodeURIComponent(token)}`, 303)
    return pagina('Gracias por avisarnos', 'Entendemos. Le enviaremos al cliente un enlace para que proponga nuevos horarios.')
  }

  return pagina(
    '¡Confirmado!',
    quien === 'cliente'
      ? `¡Perfecto! Ya registramos que la llamada fue bien. En un momento te preguntaremos si quieres contratar a ${solicitud.compita_nombre ?? 'tu compita'}.`
      : '¡Gracias! Ya registramos tu confirmación. Seguimos en contacto.',
  )
}
