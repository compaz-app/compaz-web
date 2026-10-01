import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const TOKEN = process.env.ADMIN_ACTION_TOKEN ?? ''

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const token = searchParams.get('token')
  const clienteId = searchParams.get('cliente')
  const compitaId = searchParams.get('compita')

  if (!token || token !== TOKEN) {
    return new NextResponse('No autorizado', { status: 401 })
  }
  if (!clienteId || !compitaId) {
    return new NextResponse('Faltan parámetros', { status: 400 })
  }

  const admin = createAdminSupabase()

  // Validar que existan
  const [{ data: clienteCheck }, { data: compitaCheck }] = await Promise.all([
    admin.from('usuarios').select('id').eq('id', clienteId).single(),
    admin.from('compitas').select('id').eq('id', compitaId).single(),
  ])
  if (!clienteCheck || !compitaCheck) return new NextResponse('Cliente o Compita no encontrada', { status: 404 })

  // Asignar compita al cliente
  const { error } = await admin.from('usuarios').update({ compita_id: compitaId }).eq('id', clienteId)
  if (error) return new NextResponse(`Error: ${error.message}`, { status: 500 })

  // Traer datos para el email
  const { data: cliente } = await admin.from('usuarios').select('nombre, email').eq('id', clienteId).single()
  const { data: compita } = await admin.from('compitas').select('nombre, foto_url, zona, descripcion').eq('id', compitaId).single()

  // Email de bienvenida al cliente
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

  // Redirigir al admin al panel
  return NextResponse.redirect(new URL('/admin?tab=clientes', req.url))
}
