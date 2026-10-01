import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { compita_nombre, compita_id } = await req.json()
  if (!compita_nombre) return NextResponse.json({ error: 'Falta compita_nombre' }, { status: 400 })

  const { data: perfil } = await supabase.from('usuarios').select('nombre, compita_id').eq('id', user.id).single()
  const clienteNombre = perfil?.nombre ?? user.email ?? 'Cliente'

  if (perfil?.compita_id === compita_id) {
    return NextResponse.json({ error: 'Ya tienes esta Compita asignada' }, { status: 400 })
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())
  const adminTelegramId = process.env.TELEGRAM_ADMIN_CHAT_ID
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const actionToken = process.env.ADMIN_ACTION_TOKEN ?? ''

  const asignarUrl = compita_id && actionToken
    ? `${siteUrl}/api/admin/asignar-rapido?token=${actionToken}&cliente=${user.id}&compita=${compita_id}`
    : null

  const mensajeTelegram = [
    `🔔 <b>Interés en Compita</b>`,
    ``,
    `<b>Cliente:</b> ${clienteNombre} (${user.email})`,
    `<b>Compita:</b> ${compita_nombre}`,
    ``,
    asignarUrl
      ? `✅ <a href="${asignarUrl}">Asignar ${compita_nombre} a ${clienteNombre} →</a>`
      : `Ve al panel admin para asignar.`,
  ].join('\n')

  if (adminTelegramId) {
    try {
      await sendTelegramMessage(adminTelegramId, mensajeTelegram)
    } catch (e) {
      console.error('Error Telegram me-interesa:', e)
    }
  }

  try {
    await resend.emails.send({
      from: 'Compaz <visitas@micompaz.com>',
      to: adminEmails,
      subject: `Interés: ${clienteNombre} quiere conocer a ${compita_nombre}`,
      html: `
        <p><b>${clienteNombre}</b> (${user.email}) está interesado en <b>${compita_nombre}</b>.</p>
        ${asignarUrl ? `<p><a href="${asignarUrl}" style="background:#FF6B2B;color:white;padding:10px 20px;border-radius:9999px;text-decoration:none;font-weight:bold;">Asignar con un clic →</a></p>` : ''}
      `,
    })
  } catch (e) {
    console.error('Error email me-interesa:', e)
  }

  return NextResponse.json({ ok: true })
}
