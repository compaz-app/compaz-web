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

// La respuesta es siempre la misma (exista o no el correo). `espera` son los segundos hasta poder pedir otro
// enlace: la pantalla los muestra (antes el límite de 1 por minuto era silencioso y la gente creía que no pasaba nada).
const ESPERA_SEG = 60
const generico = (espera = ESPERA_SEG) => ok({ enviado: true as const, espera })

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
  const body = await req.json().catch(() => null) as { email?: unknown; returnTo?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const returnTo = typeof body?.returnTo === 'string' ? body.returnTo.trim() : ''
  if (!emailValido(email)) return err('Escribe un correo válido', 400)

  const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'desconocida'
  if (await ipExcedida(ip)) return err('Hiciste demasiadas solicitudes. Espera un rato y vuelve a intentar.', 429)

  const admin = createAdminSupabase()

  // Un envío por minuto y correo (si se repite, se responde igual pero no se manda otro)
  const claveMail = `acc_mail:${email}`
  const { data: previo } = await admin.from('telegram_estados').select('updated_at').eq('chat_id', claveMail).maybeSingle()
  if (previo) {
    const transcurrido = Date.now() - new Date(previo.updated_at).getTime()
    if (transcurrido < ESPERA_SEG * 1000) return generico(Math.max(1, Math.ceil((ESPERA_SEG * 1000 - transcurrido) / 1000)))
  }
  await admin.from('telegram_estados').upsert({ chat_id: claveMail, registro_pendiente: false, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })

  // Solo admins o personas invitadas (con cuenta en `usuarios`). generateLink crearía usuarios nuevos: nunca para desconocidos.
  const { data: u } = await admin.from('usuarios').select('nombre, plan').eq('email', email).maybeSingle()
  if (!u && !isAdminEmail(email)) return generico()
  if (u?.plan === 'bloqueado') return generico() // cuenta suspendida: no se envía ningún acceso

  try {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const hash = link.data?.properties?.hashed_token
    if (link.error || !hash) {
      console.error('[solicitar-acceso] generateLink falló:', link.error?.code, link.error?.message)
      return generico()
    }
    // generateLink crea el usuario de auth y el trigger lo registra como cliente: un admin nuevo no debe quedar como cliente
    if (!u && isAdminEmail(email)) await admin.from('usuarios').delete().eq('email', email)
    const tipo = link.data.properties.verification_type ?? 'magiclink'
    // Si el cliente venía de una página protegida, el link lo lleva allá tras el login
    const nextParam = returnTo ? `&next=${encodeURIComponent(returnTo)}` : ''
    // El mismo token trae un código numérico: sirve si el enlace se abre en otra app o teléfono. Un enlace nuevo
    // invalida el anterior (comprobado contra Supabase), por eso el correo pide usar siempre el más reciente.
    const codigo = link.data.properties.email_otp
    await sendAccesoEmail(email, u?.nombre ?? 'Administrador', `${baseUrl(req)}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=${tipo}${nextParam}`, codigo)
  } catch (e) {
    console.error('[solicitar-acceso] fallo enviando el acceso:', e)
  }
  return generico()
}
