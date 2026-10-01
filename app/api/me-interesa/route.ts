import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'
import { ok, err, unauthorized, serverError } from '@/lib/api'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const { compita_nombre, compita_id } = await req.json() as { compita_nombre: string; compita_id: string }
  if (!compita_nombre || !compita_id) return err('Faltan parámetros')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nombre, compita_id')
    .eq('id', user.id)
    .single()

  const clienteNombre = perfil?.nombre ?? user.email ?? 'Cliente'

  if (perfil?.compita_id === compita_id) return err('Ya tienes esta Compita asignada')

  const admin = createAdminSupabase()

  // Rate limit: 1 solicitud por usuario por compita cada 24h
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: tokenReciente } = await admin
    .from('action_tokens')
    .select('id')
    .eq('cliente_id', user.id)
    .eq('compita_id', compita_id)
    .gte('created_at', hace24h)
    .limit(1)
    .maybeSingle()

  if (tokenReciente) return err('Ya enviaste una solicitud para esta Compita recientemente', 429)

  // Generar token de asignación rápida (7 días, un solo uso)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  let asignarUrl: string | null = null

  try {
    const token = randomBytes(24).toString('hex')
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { error: tokenError } = await admin.from('action_tokens').insert({
      token,
      cliente_id: user.id,
      compita_id,
      expires_at,
    })
    if (!tokenError) asignarUrl = `${siteUrl}/api/admin/asignar-rapido?token=${token}`
  } catch (e) {
    console.error('Error generando action token:', e)
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())
  const adminTelegramId = process.env.TELEGRAM_ADMIN_CHAT_ID

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
    try { await sendTelegramMessage(adminTelegramId, mensajeTelegram) }
    catch (e) { console.error('Error Telegram me-interesa:', e) }
  }

  try {
    await resend.emails.send({
      from: 'Compaz <visitas@micompaz.com>',
      to: adminEmails,
      subject: `Interés: ${clienteNombre} quiere conocer a ${compita_nombre}`,
      html: `
        <p><b>${clienteNombre}</b> (${user.email}) está interesado en <b>${compita_nombre}</b>.</p>
        ${asignarUrl
          ? `<p><a href="${asignarUrl}" style="background:#FF6B2B;color:white;padding:10px 20px;border-radius:9999px;text-decoration:none;font-weight:bold;">Asignar con un clic →</a></p>`
          : ''}
      `,
    })
  } catch (e) {
    console.error('Error email me-interesa:', e)
  }

  return ok(null)
}
