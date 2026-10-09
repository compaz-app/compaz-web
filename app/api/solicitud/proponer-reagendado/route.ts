// POST /api/solicitud/proponer-reagendado
// El cliente propone nuevos slots después de que la llamada no ocurrió o para cambiarla.
// Resetea la solicitud a 'pendiente' y notifica a la compita por Telegram.
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getSolicitudPorToken, guardarSlotsReagendado } from '@/lib/solicitudes'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { formatSlotVE, esSlotFuturo } from '@/lib/format'
import { qRol } from '@/lib/links'
import { ok, err, notFound } from '@/lib/api'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.token !== 'string' || !Array.isArray(body.slots) || body.slots.length === 0) {
    return err('Datos inválidos')
  }
  const { token } = body as { token: string }
  const slots = body.slots as unknown[]
  if (slots.length > 3) return err('Máximo 3 horarios')
  if (!slots.every((s) => esSlotFuturo(s, 30))) return err('Todos los horarios deben ser válidos y estar al menos 30 minutos en el futuro')
  const limite = Date.now() + 60 * 86400_000
  if ((slots as string[]).some((s) => new Date(s).getTime() > limite)) return err('Los horarios deben estar dentro de los próximos 60 días')
  const unicos = [...new Set((slots as string[]).map((s) => new Date(s).toISOString()))]

  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud) return notFound('Solicitud')
  if (solicitud.estado === 'completada' || solicitud.estado === 'contratada') return err('Esta solicitud ya está cerrada.')

  try {
    await guardarSlotsReagendado(solicitud.id, unicos)
  } catch (e) {
    console.error('[proponer-reagendado] error:', e)
    return err('No pudimos guardar los nuevos horarios. Intenta de nuevo.', 409)
  }

  const admin = createAdminSupabase()
  const { data: compita } = await admin.from('compitas').select('telegram_chat_id').eq('id', solicitud.compita_id).single()

  let notificada = false
  if (compita?.telegram_chat_id) {
    const slotsLabel = unicos.map((s, i) => `${i + 1}. ${esc(formatSlotVE(s))}`).join('\n')
    const rol = qRol(token, 'compita')
    const botones = unicos.map((s, i) => [{
      text: `✅ Opción ${i + 1}: ${formatSlotVE(s)}`,
      url: `${SITE_URL}/api/solicitud/responder?token=${token}&slot=${i}&${rol}`,
    }])
    botones.push([{ text: '❌ No puedo en ninguno', url: `${SITE_URL}/api/solicitud/responder?token=${token}&slot=-1&${rol}` }])
    try {
      await sendTelegramMessage(
        compita.telegram_chat_id,
        [`🗓️ <b>El cliente propone nuevos horarios</b>`, ``, `La llamada anterior no pudo realizarse. El cliente propone:`, ``, slotsLabel, ``, `Elige el que mejor te quede:`].join('\n'),
        { inline_keyboard: botones },
      )
      notificada = true
    } catch (e) { console.error('Telegram reagendado compita:', e) }
  }

  await avisarAdmin(
    notificada
      ? `🔄 <b>Reagendado</b>\n\nEl cliente propuso nuevos horarios para <b>${esc(solicitud.compita_nombre)}</b>. La compita recibió la notificación para confirmar.`
      : `⚠️ <b>Reagendado sin notificar</b>\n\nEl cliente propuso nuevos horarios para <b>${esc(solicitud.compita_nombre)}</b>, pero la compita NO pudo ser notificada (sin Telegram o error). Contáctala.`,
  )

  return ok({ reagendado: true })
}
