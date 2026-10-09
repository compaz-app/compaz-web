// POST /api/auth/solicitar-acceso — { email }
// El cliente (o el admin) pide un enlace de acceso nuevo SIN intervención de nadie: sirve también para
// invitaciones vencidas o sin activar. Solo se genera para correos de admin o con cuenta creada por invitación
// (fila en `usuarios`); la respuesta es siempre la misma para no revelar qué correos existen.
// El enlace entra por /auth/confirm (no depende del navegador donde se pidió). Límites: 1 envío por minuto
// por correo y 10 solicitudes por hora por IP.
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { emailValido } from '@/lib/validar'
import { sendAccesoEmail } from '@/lib/resend'
import { baseUrl } from '@/lib/site'
import { ok, err } from '@/lib/api'

const GENERICO = { enviado: true as const }

async function ipExcedida(ip: string): Promise<boolean> {
  const admin = createAdminSupabase()
  const clave = `acc_ip:${ip}`
  const { data: fila } = await admin.from('telegram_estados').select('pendiente_accion, pendiente_expira').eq('chat_id', clave).maybeSingle()
  const ahora = Date.now()
  if (!fila?.pendiente_expira || new Date(fila.pendiente_expira).getTime() < ahora) {
    await admin.from('telegram_estados').upsert(
      { chat_id: clave, registro_pendiente: false, pendiente_accion: '1', pendiente_expira: new Date(ahora + 3600_000).toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'chat_id' },
    )
    return false
  }
  const n = parseInt(fila.pendiente_accion ?? '0', 10) + 1
  await admin.from('telegram_estados').update({ pendiente_accion: String(n) }).eq('chat_id', clave)
  return n > 10
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!emailValido(email)) return err('Escribe un correo válido', 400)

  const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'desconocida'
  if (await ipExcedida(ip)) return err('Hiciste demasiadas solicitudes. Espera un rato y vuelve a intentar.', 429)

  const admin = createAdminSupabase()

  // Un envío por minuto y correo (si se repite, se responde igual pero no se manda otro)
  const claveMail = `acc_mail:${email}`
  const { data: previo } = await admin.from('telegram_estados').select('updated_at').eq('chat_id', claveMail).maybeSingle()
  if (previo && Date.now() - new Date(previo.updated_at).getTime() < 60_000) return ok(GENERICO)
  await admin.from('telegram_estados').upsert({ chat_id: claveMail, registro_pendiente: false, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })

  // Solo admins o personas invitadas (con cuenta en `usuarios`). generateLink crearía usuarios nuevos: nunca para desconocidos.
  const { data: u } = await admin.from('usuarios').select('nombre, plan').eq('email', email).maybeSingle()
  if (!u && !isAdminEmail(email)) return ok(GENERICO)
  if (u?.plan === 'bloqueado') return ok(GENERICO) // cuenta suspendida: no se envía ningún acceso

  try {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const hash = link.data?.properties?.hashed_token
    if (link.error || !hash) {
      console.error('[solicitar-acceso] generateLink falló:', link.error?.code, link.error?.message)
      return ok(GENERICO)
    }
    const tipo = link.data.properties.verification_type ?? 'magiclink'
    await sendAccesoEmail(email, u?.nombre ?? 'Administrador', `${baseUrl(req)}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=${tipo}`)
  } catch (e) {
    console.error('[solicitar-acceso] fallo enviando el acceso:', e)
  }
  return ok(GENERICO)
}
