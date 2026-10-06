// POST /api/solicitud/proponer-reagendado
// El cliente propone nuevos slots después de que la llamada no ocurrió.
// Resetea la solicitud a 'pendiente' y notifica al compita por Telegram.
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getSolicitudPorToken, guardarSlotsReagendado } from '@/lib/solicitudes'
import { sendTelegramMessage } from '@/lib/telegram'
import { ok, err, notFound } from '@/lib/api'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''

function formatSlotVE(iso: string): string {
  return new Date(iso).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.token || !Array.isArray(body.slots) || body.slots.length === 0) {
    return err('Datos inválidos')
  }

  const { token, slots } = body as { token: string; slots: string[] }
  if (slots.length > 3) return err('Máximo 3 horarios')
  const slotsPasados = slots.filter((s) => new Date(s).getTime() <= Date.now())
  if (slotsPasados.length > 0) return err('Todos los horarios deben ser en el futuro')

  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud) return notFound('Solicitud no encontrada')

  if (solicitud.estado === 'completada' || solicitud.estado === 'contratada') {
    return err('Esta solicitud ya está cerrada.')
  }

  // Resetear solicitud con los nuevos slots
  await guardarSlotsReagendado(solicitud.id, slots)

  // Notificar al compita por Telegram con los nuevos slots
  const admin = createAdminSupabase()
  const { data: compita } = await admin
    .from('compitas')
    .select('telegram_chat_id')
    .eq('id', solicitud.compita_id)
    .single()

  if (compita?.telegram_chat_id) {
    const slotsLabel = slots.map((s, i) => `${i + 1}. ${formatSlotVE(s)}`).join('\n')

    const botonesSlots = slots.map((s, i) => [{
      text: `✅ Opción ${i + 1}: ${formatSlotVE(s)}`,
      url: `${SITE_URL}/api/solicitud/responder?token=${token}&slot=${i}`,
    }])
    botonesSlots.push([{
      text: '❌ No puedo en ninguno',
      url: `${SITE_URL}/api/solicitud/responder?token=${token}&slot=-1`,
    }])

    try {
      await sendTelegramMessage(
        compita.telegram_chat_id,
        [
          `🗓️ <b>El cliente propone nuevos horarios</b>`,
          ``,
          `La llamada anterior no pudo realizarse. El cliente propone:`,
          ``,
          slotsLabel,
          ``,
          `Elige el que mejor te quede:`,
        ].join('\n'),
        { inline_keyboard: botonesSlots },
      )
    } catch (e) { console.error('Telegram reagendado compita:', e) }
  }

  // Notificar al admin
  const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (adminTg) {
    try {
      await sendTelegramMessage(
        adminTg,
        `🔄 <b>Reagendado</b>\n\nEl cliente propuso nuevos horarios para <b>${solicitud.compita_nombre}</b>. El compita recibió la notificación para confirmar.`,
      )
    } catch (e) { console.error('Telegram admin reagendado:', e) }
  }

  return ok({ reagendado: true })
}
