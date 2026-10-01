// POST /api/solicitudes — crea una solicitud de entrevista y notifica al compita por Telegram
import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { crearSolicitud } from '@/lib/solicitudes'
import { sendTelegramMessage, makeInlineKeyboard } from '@/lib/telegram'
import { ok, err, unauthorized, serverError } from '@/lib/api'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''

// Venezuela UTC-4: formatea un ISO datetime a texto legible local
function formatSlotVE(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString('es-VE', {
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
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const body = await req.json() as {
    compita_id: string
    mensaje: string
    slots_propuestos: string[]
    franja_horaria?: string
  }

  const { compita_id, mensaje, slots_propuestos, franja_horaria } = body

  if (!compita_id || !mensaje?.trim()) return err('Faltan campos requeridos')
  if (!Array.isArray(slots_propuestos) || slots_propuestos.length === 0 || slots_propuestos.length > 3) {
    return err('Debes proponer entre 1 y 3 horarios')
  }

  // Traer datos del cliente y del compita
  const admin = createAdminSupabase()
  const [{ data: cliente }, { data: compita }] = await Promise.all([
    admin.from('usuarios').select('nombre, email').eq('id', user.id).single(),
    admin.from('compitas').select('nombre, telegram_chat_id').eq('id', compita_id).single(),
  ])

  if (!compita) return err('Compita no encontrada', 404)

  let solicitud
  try {
    solicitud = await crearSolicitud({
      cliente_id: user.id,
      compita_id,
      mensaje,
      slots_propuestos,
      franja_horaria,
    })
  } catch (e) {
    console.error('[solicitudes] error:', e)
    const msg = e instanceof Error ? e.message : 'Error'
    return err(msg)
  }

  // Notificar al compita por Telegram si tiene chat_id
  if (compita.telegram_chat_id) {
    const clienteNombre = cliente?.nombre ?? 'Un cliente'
    const slotLabels = slots_propuestos
      .map((s, i) => `${['1️⃣', '2️⃣', '3️⃣'][i]} ${formatSlotVE(s)}`)
      .join('\n')

    const mensajeTelegram = [
      `🔔 <b>Nueva solicitud de entrevista</b>`,
      ``,
      `<b>${clienteNombre}</b> quiere conocerte.`,
      ``,
      `<b>Sobre su familiar:</b>`,
      mensaje,
      ``,
      `<b>Elige el horario que te funcione (llamada de 20 min):</b>`,
      slotLabels,
    ].join('\n')

    // Botones inline con callback_data — todo se resuelve dentro de Telegram
    const botonesSlots = slots_propuestos.map((_, i) => ([{
      text: `✅ Opción ${i + 1}`,
      callback_data: `slot:${i}:${solicitud.token_respuesta}`,
    }]))
    const teclado = makeInlineKeyboard([
      ...botonesSlots,
      [{ text: '❌ No puedo atender', callback_data: `rechazar:${solicitud.token_respuesta}` }],
    ])

    try {
      await sendTelegramMessage(compita.telegram_chat_id, mensajeTelegram, teclado)
    } catch (e) {
      console.error('Error Telegram solicitud:', e)
    }
  }

  return ok({ solicitud_id: solicitud.id, estado: solicitud.estado })
}
