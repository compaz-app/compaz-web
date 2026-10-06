import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const token = searchParams.get('token')

  if (!token) return new NextResponse('No autorizado', { status: 401 })

  const admin = createAdminSupabase()

  // Validar token de un solo uso
  const { data: actionToken } = await admin
    .from('action_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (!actionToken) return new NextResponse('Token inválido', { status: 401 })
  if (new Date(actionToken.expires_at) < new Date()) return new NextResponse('Enlace expirado', { status: 410 })

  const clienteId = actionToken.cliente_id
  const compitaId = actionToken.compita_id

  // Marcar como usado de forma atómica (WHERE usado = false) — elimina race condition TOCTOU.
  // Si dos requests llegan en paralelo, solo uno obtiene filas afectadas; el otro recibe 410.
  const { data: claimed } = await admin
    .from('action_tokens')
    .update({ usado: true })
    .eq('id', actionToken.id)
    .eq('usado', false)
    .select('id')
    .single()

  if (!claimed) return new NextResponse('Este enlace ya fue usado', { status: 410 })

  // Asignar compita al cliente
  const { error } = await admin.from('usuarios').update({ compita_id: compitaId }).eq('id', clienteId)
  if (error) return new NextResponse('Error interno', { status: 500 })

  // Traer datos para el email y Telegram
  const { data: cliente } = await admin.from('usuarios').select('nombre, email, familiar_nombre, familiar_edad, familiar_condicion, familiar_notas').eq('id', clienteId).single() as { data: { nombre: string; email: string; familiar_nombre: string | null; familiar_edad: number | null; familiar_condicion: string | null; familiar_notas: string | null } | null }
  const { data: compita } = await admin.from('compitas').select('nombre, foto_url, zona, descripcion, telegram_chat_id').eq('id', compitaId).single() as { data: { nombre: string; foto_url: string | null; zona: string | null; descripcion: string | null; telegram_chat_id: string | null } | null }

  if (cliente && compita) {
    // Notificar al compita por Telegram con el perfil del familiar
    if (compita.telegram_chat_id) {
      const perfilLineas: string[] = []
      if (cliente.familiar_nombre) perfilLineas.push(`<b>Nombre:</b> ${cliente.familiar_nombre}`)
      if (cliente.familiar_edad) perfilLineas.push(`<b>Edad:</b> ${cliente.familiar_edad} años`)
      if (cliente.familiar_condicion) perfilLineas.push(`<b>Condición:</b> ${cliente.familiar_condicion}`)
      if (cliente.familiar_notas) perfilLineas.push(`<b>Notas:</b> ${cliente.familiar_notas}`)
      const perfilBloque = perfilLineas.length > 0
        ? [``, `🧓 <b>Sobre el familiar que vas a atender:</b>`, ...perfilLineas]
        : []
      try {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          [
            `🎉 <b>¡Tienes un nuevo cliente!</b>`,
            ``,
            `<b>${escapeHtml(cliente.nombre)}</b> fue asignado a tu cuenta.`,
            ...perfilBloque,
            ``,
            `👋 <b>Saluda a ${escapeHtml(cliente.nombre.split(' ')[0])}</b> desde este chat para arrancar la coordinación. Ellos lo verán en su portal.`,
            ``,
            `💙 Toda la comunicación debe mantenerse dentro de Compaz.`,
          ].join('\n'),
        )
      } catch (e) { console.error('Telegram asignar-rapido compita:', e) }
    }

    try {
      await resend.emails.send({
        from: 'Compaz <visitas@micompaz.com>',
        to: cliente.email,
        subject: `Tu Compita está lista: ${compita.nombre}`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #2D1464; font-size: 24px; margin-bottom: 16px;">¡Hola, ${escapeHtml(cliente.nombre)}!</h2>
            <p style="color: #4A3B6B; font-size: 16px; line-height: 1.6;">
              Te asignamos a <strong>${escapeHtml(compita.nombre)}</strong> como tu Compita.
              ${compita.zona ? `Cubre la zona de <strong>${escapeHtml(compita.zona)}</strong>.` : ''}
            </p>
            ${compita.descripcion ? `<p style="color: #6B5C90; font-size: 15px; line-height: 1.7;">${escapeHtml(compita.descripcion)}</p>` : ''}
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" style="display:inline-block; background:#FF6B2B; color:white; border-radius:9999px; padding:14px 28px; font-weight:800; font-size:16px; text-decoration:none; margin-top:20px;">
              Ver mi portal →
            </a>
          </div>
        `,
      })
    } catch (e) {
      console.error('Error email asignación:', e)
    }
  }

  return NextResponse.redirect(new URL('/admin?tab=clientes', req.url))
}
