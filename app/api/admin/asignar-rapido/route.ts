import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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

  // Traer datos para el email
  const { data: cliente } = await admin.from('usuarios').select('nombre, email').eq('id', clienteId).single()
  const { data: compita } = await admin.from('compitas').select('nombre, foto_url, zona, descripcion').eq('id', compitaId).single()

  if (cliente && compita) {
    try {
      await resend.emails.send({
        from: 'Compaz <visitas@micompaz.com>',
        to: cliente.email,
        subject: `Tu Compita está lista: ${compita.nombre}`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #2D1464; font-size: 24px; margin-bottom: 16px;">¡Hola, ${cliente.nombre}!</h2>
            <p style="color: #4A3B6B; font-size: 16px; line-height: 1.6;">
              Te asignamos a <strong>${compita.nombre}</strong> como tu Compita.
              ${compita.zona ? `Cubre la zona de <strong>${compita.zona}</strong>.` : ''}
            </p>
            ${compita.descripcion ? `<p style="color: #6B5C90; font-size: 15px; line-height: 1.7;">${compita.descripcion}</p>` : ''}
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
