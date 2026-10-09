// POST /api/solicitudes — crea una solicitud de entrevista y notifica al compita por Telegram
import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { crearSolicitud } from '@/lib/solicitudes'
import { sendTelegramMessage, makeInlineKeyboard } from '@/lib/telegram'
import { ok, err, unauthorized, serverError } from '@/lib/api'

import { esc } from '@/lib/html'
import { formatSlotVE, esSlotFuturo } from '@/lib/format'
import { avisarAdmin } from '@/lib/telegram'

const MENSAJES_NEGOCIO = ['Límite de', 'Ya tienes una solicitud']

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const body = await req.json().catch(() => null) as {
    compita_id?: string
    mensaje?: string
    sobre_cliente?: string | null
    slots_propuestos?: unknown
    franja_horaria?: string
  } | null
  if (!body) return err('Solicitud inválida')

  const compita_id = body.compita_id
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : ''
  const sobre_cliente = typeof body.sobre_cliente === 'string' ? body.sobre_cliente.trim() : null
  const franja_horaria = typeof body.franja_horaria === 'string' ? body.franja_horaria.trim().slice(0, 200) : undefined
  const slotsRaw = body.slots_propuestos

  if (!compita_id || !mensaje) return err('Faltan campos requeridos')
  if (mensaje.length > 1500) return err('El mensaje es demasiado largo (máximo 1500 caracteres)')
  if (sobre_cliente && sobre_cliente.length > 1000) return err('La descripción del cliente es demasiado larga (máximo 1000 caracteres)')
  if (!Array.isArray(slotsRaw) || slotsRaw.length === 0 || slotsRaw.length > 3) {
    return err('Debes proponer entre 1 y 3 horarios')
  }
  if (!slotsRaw.every((s) => esSlotFuturo(s, 30))) return err('Todos los horarios deben ser válidos y estar al menos 30 minutos en el futuro')
  if ((slotsRaw as string[]).some((s) => new Date(s).getTime() > Date.now() + 60 * 86400_000)) return err('Los horarios deben estar dentro de los próximos 60 días')
  const slots_propuestos = [...new Set((slotsRaw as string[]).map((s) => new Date(s).toISOString()))]

  // Traer datos del cliente y del compita
  const admin = createAdminSupabase()
  const [{ data: cliente }, { data: compita }] = await Promise.all([
    admin.from('usuarios').select('nombre, email, plan').eq('id', user.id).single(),
    admin.from('compitas').select('nombre, telegram_chat_id, estado, verificado').eq('id', compita_id).single(),
  ])

  if (!compita) return err('Compita no encontrada', 404)
  if (!cliente) return err('Tu cuenta no está registrada como cliente. Contacta al administrador.')

  // Rate limit: máximo 5 solicitudes por usuario en las últimas 24 horas
  const hace24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  const { count: solicitudesRecientes } = await admin
    .from('solicitudes')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', user.id)
    .gte('created_at', hace24h)
  if ((solicitudesRecientes ?? 0) >= 5) {
    return err('Has enviado demasiadas solicitudes hoy. Espera 24 horas antes de enviar otra.', 429)
  }
  if ((cliente as { plan: string | null }).plan === 'bloqueado') {
    return err('Tu cuenta ha sido suspendida. Escríbenos a hola@micompaz.com para más información.', 403)
  }
  if ((compita as { estado: string; verificado: boolean }).estado !== 'activo' || !(compita as { estado: string; verificado: boolean }).verificado) {
    return err('Este compita no está disponible', 400)
  }

  let solicitud
  try {
    solicitud = await crearSolicitud({
      cliente_id: user.id,
      compita_id,
      mensaje,
      sobre_cliente: sobre_cliente || null,
      slots_propuestos,
      franja_horaria,
    })
  } catch (e) {
    console.error('[solicitudes] error:', e)
    const msg = e instanceof Error ? e.message : ''
    if (/duplicate|unique/i.test(msg)) return err('Ya tienes una solicitud pendiente con este compita')
    // Solo se muestran los mensajes de negocio; los errores de BD no se filtran al cliente
    return MENSAJES_NEGOCIO.some((m) => msg.startsWith(m)) ? err(msg) : err('No pudimos crear la solicitud. Intenta de nuevo.', 500)
  }

  // Compita sin Telegram vinculado: avisar al admin para que la contacte
  if (!compita.telegram_chat_id) {
    await avisarAdmin([
      `⚠️ <b>Solicitud sin Telegram</b>`, ``,
      `El cliente <b>${esc(cliente?.nombre ?? '—')}</b> solicitó a <b>${esc(compita.nombre)}</b>, pero esa compita no tiene Telegram vinculado.`, ``,
      `La solicitud fue creada pero la compita no fue notificada. Contáctala directamente.`,
    ].join('\n'))
    return ok({ solicitud_id: solicitud.id, estado: solicitud.estado })
  }

  // Notificar al compita por Telegram si tiene chat_id
  if (compita.telegram_chat_id) {
    const clienteNombre = cliente?.nombre ?? 'Un cliente'
    const slotLabels = slots_propuestos
      .map((s, i) => `${['1️⃣', '2️⃣', '3️⃣'][i]} ${formatSlotVE(s)}`)
      .join('\n')

    const escapeHtml = esc

    const partesSobre: string[] = []
    if (sobre_cliente?.trim()) {
      partesSobre.push(`<b>Sobre el cliente:</b>`, escapeHtml(sobre_cliente.trim()), ``)
    }

    const mensajeTelegram = [
      `🔔 <b>Nueva solicitud de entrevista</b>`,
      ``,
      `<b>${escapeHtml(clienteNombre)}</b> quiere conocerte.`,
      ``,
      ...partesSobre,
      `<b>Sobre su familiar:</b>`,
      escapeHtml(mensaje),
      ``,
      `<b>Elige el horario que te funcione (llamada de 20 min):</b>`,
      slotLabels,
    ].join('\n')

    // Botones inline con callback_data — todo se resuelve dentro de Telegram
    const botonesSlots = slots_propuestos.map((iso, i) => {
      const d = new Date(iso)
      const label = d.toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
      return [{ text: `✅ ${label}`, callback_data: `slot:${i}:${solicitud.token_respuesta}` }]
    })
    const teclado = makeInlineKeyboard([
      ...botonesSlots,
      [{ text: '❌ No puedo atender', callback_data: `rechazar:${solicitud.token_respuesta}` }],
    ])

    try {
      await sendTelegramMessage(compita.telegram_chat_id, mensajeTelegram, teclado)
    } catch (e) {
      // La solicitud existe pero la compita no fue notificada: avisar al admin para no perderla en silencio
      console.error('Error Telegram solicitud:', e)
      await avisarAdmin(`🚨 <b>No se pudo notificar una solicitud</b>\n\n<b>${esc(clienteNombre)}</b> → <b>${esc(compita.nombre)}</b> (Telegram falló). Contacta a la compita; el cierre automático la cerrará a las 72 h si no responde.`)
    }
  }

  return ok({ solicitud_id: solicitud.id, estado: solicitud.estado })
}
