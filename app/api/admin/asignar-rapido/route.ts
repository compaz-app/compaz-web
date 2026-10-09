// /api/admin/asignar-rapido?token=...   (enlace de un solo uso enviado al admin por email/Telegram)
// GET solo muestra una confirmación (los previsualizadores de enlaces de Telegram/correo no consumen el token);
// POST asigna la compita al cliente.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { asignarCompita } from '@/lib/usuarios'
import { pagina, puertaConfirmacion } from '@/lib/confirm'

export async function GET(req: NextRequest) {
  if (!req.nextUrl.searchParams.get('token')) return pagina('No autorizado', 'Falta el token.', 401)
  return puertaConfirmacion(req, 'Asignar compita', 'Se asignará esta compita al cliente y se les avisará a ambos.', 'Asignar ahora')
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return pagina('No autorizado', 'Falta el token.', 401)

  const admin = createAdminSupabase()
  const { data: actionToken } = await admin.from('action_tokens').select('*').eq('token', token).maybeSingle()
  if (!actionToken) return pagina('Token inválido', 'El enlace no es válido.', 401)
  if (new Date(actionToken.expires_at) < new Date()) return pagina('Enlace expirado', 'Este enlace venció.', 410)

  // Reclamo atómico (WHERE usado = false)
  const { data: claimed } = await admin
    .from('action_tokens').update({ usado: true }).eq('id', actionToken.id).eq('usado', false).select('id').maybeSingle()
  if (!claimed) return pagina('Enlace usado', 'Este enlace ya fue usado.', 410)

  try {
    await asignarCompita(actionToken.cliente_id, actionToken.compita_id)
  } catch (e) {
    // Liberar el token: el admin puede reintentar si falló nuestra parte
    await admin.from('action_tokens').update({ usado: false }).eq('id', actionToken.id)
    console.error('[asignar-rapido] error:', e)
    return pagina('No se pudo asignar', e instanceof Error ? e.message : 'Error interno', 409)
  }

  const [{ data: cliente }, { data: compita }] = await Promise.all([
    admin.from('usuarios').select('nombre, email, familiar_nombre, familiar_edad, familiar_condicion, familiar_notas').eq('id', actionToken.cliente_id).single(),
    admin.from('compitas').select('nombre, zona, descripcion, telegram_chat_id').eq('id', actionToken.compita_id).single(),
  ])

  if (cliente && compita) {
    if (compita.telegram_chat_id) {
      const perfil: string[] = []
      if (cliente.familiar_nombre) perfil.push(`<b>Nombre:</b> ${esc(cliente.familiar_nombre)}`)
      if (cliente.familiar_edad) perfil.push(`<b>Edad:</b> ${esc(cliente.familiar_edad)} años`)
      if (cliente.familiar_condicion) perfil.push(`<b>Condición:</b> ${esc(cliente.familiar_condicion)}`)
      if (cliente.familiar_notas) perfil.push(`<b>Notas:</b> ${esc(cliente.familiar_notas)}`)
      try {
        await sendTelegramMessage(compita.telegram_chat_id, [
          `🎉 <b>¡Tienes un nuevo cliente!</b>`, ``,
          `<b>${esc(cliente.nombre)}</b> fue asignado a tu cuenta.`,
          ...(perfil.length ? [``, `🧓 <b>Sobre el familiar que vas a atender:</b>`, ...perfil] : []), ``,
          `👋 <b>Saluda a ${esc(cliente.nombre.split(' ')[0])}</b> desde este chat para arrancar la coordinación. Ellos lo verán en su portal.`, ``,
          `💙 Toda la comunicación debe mantenerse dentro de Compaz.`,
        ].join('\n'))
      } catch (e) { console.error('Telegram asignar-rapido compita:', e) }
    }
    try {
      await sendEmail({
        to: cliente.email,
        subject: `Tu Compita está lista: ${compita.nombre}`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #2D1464; font-size: 24px; margin-bottom: 16px;">¡Hola, ${esc(cliente.nombre)}!</h2>
            <p style="color: #4A3B6B; font-size: 16px; line-height: 1.6;">
              Te asignamos a <strong>${esc(compita.nombre)}</strong> como tu Compita.
              ${compita.zona ? `Cubre la zona de <strong>${esc(compita.zona)}</strong>.` : ''}
            </p>
            ${compita.descripcion ? `<p style="color: #6B5C90; font-size: 15px; line-height: 1.7;">${esc(compita.descripcion)}</p>` : ''}
            <a href="${SITE_URL}/dashboard" style="display:inline-block; background:#FF6B2B; color:white; border-radius:9999px; padding:14px 28px; font-weight:800; font-size:16px; text-decoration:none; margin-top:20px;">Ver mi portal →</a>
          </div>`,
      })
    } catch (e) { console.error('Error email asignación:', e) }
  }

  return NextResponse.redirect(new URL('/admin?tab=clientes', req.url), 303)
}
