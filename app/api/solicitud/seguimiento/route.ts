// /api/solicitud/seguimiento?token=&respuesta=si|no&quien=cliente&s=<firma>
// "si" solo redirige al pago (la autorización real está en /pago). "no" cambia estado: firma de rol + POST.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getSolicitudPorToken } from '@/lib/solicitudes'
import { sendTelegramMessage, makeInlineKeyboard } from '@/lib/telegram'
import { generarTokenPerfil } from '@/lib/compita-tokens'
import { SITE_URL } from '@/lib/email'
import { rolValido, qRol } from '@/lib/links'
import { pagina as paginaSola, paginaPara, puertaConfirmacion } from '@/lib/confirm'
// Esta ruta la ve siempre el cliente: sus páginas de éxito vuelven a donde él trabaja (ver botonDe).
const pagina = (titulo: string, texto: string, status = 200, boton?: { texto: string; href: string }) => (boton ? paginaSola(titulo, texto, status, boton) : paginaPara('cliente', titulo, texto, status))

function leer(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const token = sp.get('token')
  const respuesta = sp.get('respuesta')
  if (!token || (respuesta !== 'si' && respuesta !== 'no')) return null
  return { token, respuesta, firmado: rolValido(token, sp.get('quien'), sp.get('s')) && sp.get('quien') === 'cliente' }
}

export async function GET(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)
  if (p.respuesta === 'si') return ejecutar(p)
  if (!p.firmado) return pagina('Enlace inválido', 'Este enlace no es válido o está incompleto.', 400)
  return puertaConfirmacion(req, '¿No quieres contratar por ahora?', 'Avisaremos a la compita con respeto y podrás explorar otros perfiles.', 'Confirmar')
}

export async function POST(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)
  if (p.respuesta === 'no' && !p.firmado) return pagina('Enlace inválido', 'Este enlace no es válido o está incompleto.', 400)
  return ejecutar(p)
}

async function ejecutar(p: NonNullable<ReturnType<typeof leer>>) {
  const { token, respuesta } = p
  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud) return pagina('Enlace inválido', 'No encontramos esta solicitud.', 404)

  if (solicitud.estado === 'contratada' || solicitud.estado === 'rechazada') {
    return pagina('Ya registramos tu respuesta', 'Ya habías respondido a esta encuesta. ¡Gracias!')
  }
  if (solicitud.slot_confirmado) {
    const expira = new Date(solicitud.slot_confirmado).getTime() + 72 * 3600_000
    if (Date.now() > expira) return pagina('Enlace expirado', 'Este enlace ya no está activo. Si tienes dudas, escríbenos directamente.')
  }

  if (respuesta === 'si') {
    return NextResponse.redirect(`${SITE_URL}/pago?solicitud=${encodeURIComponent(solicitud.id)}`, 302)
  }

  // respuesta === 'no': transición atómica y estado terminal coherente con resultado-llamada
  const admin = createAdminSupabase()
  const { data: cambiada, error } = await admin.from('solicitudes')
    .update({ estado: 'rechazada', confirmacion_cliente: false, respondido_at: new Date().toISOString(), seguimiento2_enviado: true })
    .eq('id', solicitud.id)
    .in('estado', ['aceptada', 'completada'])
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[seguimiento] error:', error)
    return pagina('Error', 'No pudimos registrar tu respuesta. Intenta de nuevo.', 500)
  }

  if (cambiada) {
    const { data: compitaNo } = await admin.from('compitas').select('id, telegram_chat_id').eq('id', solicitud.compita_id).single()
    if (compitaNo?.telegram_chat_id) {
      try {
        // Solo se genera token de perfil si realmente cambió el estado (no por reintentos ni escáneres)
        let perfilUrl = `${SITE_URL}/compita/perfil`
        try { perfilUrl = `${SITE_URL}/compita/perfil?token=${await generarTokenPerfil(compitaNo.id)}` }
        catch (e) { console.error('Error generando token perfil:', e) }

        await sendTelegramMessage(
          compitaNo.telegram_chat_id,
          [
            `Hola 💙`, ``,
            `Esta vez el cliente decidió no continuar. No dice nada de tu valor: a veces simplemente no encaja.`, ``,
            `💡 Un perfil completo atrae más familias. Edítalo con el botón de abajo (o escribe /perfil).`,
          ].join('\n'),
          makeInlineKeyboard([
            [{ text: '✏️ Mejorar mi perfil', url: perfilUrl }],
            [{ text: '📋 Ver mis opciones', callback_data: 'cmd_menu' }],
          ]),
        )
      } catch (e) { console.error('Telegram compita rechazo:', e) }
    }
  }

  // Si el cliente acaba de decir que no, primero se le pregunta (opcional) por qué.
  if (cambiada) return NextResponse.redirect(`${SITE_URL}/api/solicitud/motivo?token=${encodeURIComponent(token)}&${qRol(token, 'cliente')}`, 303)
  return pagina('Gracias por tu tiempo', 'Entendemos. Cuando estés listo, puedes explorar otros compitas disponibles.', 200, { texto: 'Ver otros compitas →', href: `${SITE_URL}/compitas` })
}
