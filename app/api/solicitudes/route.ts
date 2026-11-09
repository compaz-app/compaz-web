// POST /api/solicitudes — crea una solicitud de entrevista y notifica al compita por Telegram
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getClienteActivo } from '@/lib/auth'
import { crearSolicitud } from '@/lib/solicitudes'
import { ok, err, unauthorized, serverError } from '@/lib/api'

import { esc } from '@/lib/html'
import { esSlotFuturo } from '@/lib/format'
import { avisarAdmin } from '@/lib/telegram'
import { detectarContacto, reportarContactoEnTexto } from '@/lib/chat-moderacion'
import { notificar } from '@/lib/avisos'
import { registrarEvento } from '@/lib/eventos'
import { validarSolicitudNueva, mensajeDeSolicitud, type SolicitudNueva } from '@/lib/validar-solicitud'

const MENSAJES_NEGOCIO = ['Límite de', 'Ya tienes una solicitud']

export async function POST(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  const body = await req.json().catch(() => null) as {
    compita_id?: string
    mensaje?: string
    sobre_cliente?: string | null
    slots_propuestos?: unknown
    franja_horaria?: string
  } & Record<string, unknown> | null
  if (!body) return err('Solicitud inválida')

  const compita_id = body.compita_id
  // Contrato NUEVO (formulario del rediseño): el cuerpo trae `tipo`. Sin `tipo`, contrato anterior sin cambios.
  let nueva: SolicitudNueva | null = null
  if (body.tipo !== undefined) {
    const v = validarSolicitudNueva(body)
    if (!v.ok) return err(v.error)
    nueva = v.valor
  }
  const mensajeOriginal = nueva ? (nueva.nota ?? '') : typeof body.mensaje === 'string' ? body.mensaje.trim() : ''
  const sobreOriginal = typeof body.sobre_cliente === 'string' ? body.sobre_cliente.trim() : null
  const franja_horaria = typeof body.franja_horaria === 'string' ? body.franja_horaria.trim().slice(0, 200) : undefined
  const slotsRaw = body.slots_propuestos
  // Hasta que existan las horas libres del compita (Lote 3), la entrevista y el contrato anterior siguen proponiendo
  // 1 a 3 horarios; la contratación directa y el mandado no llevan horarios.
  const necesitaSlots = !nueva || nueva.tipo === 'entrevista'

  if (!compita_id || (!nueva && !mensajeOriginal)) return err('Faltan campos requeridos')
  if (mensajeOriginal.length > 1500) return err('El mensaje es demasiado largo (máximo 1500 caracteres)')
  if (sobreOriginal && sobreOriginal.length > 1000) return err('La descripción del cliente es demasiado larga (máximo 1000 caracteres)')
  if (necesitaSlots && (!Array.isArray(slotsRaw) || slotsRaw.length === 0 || slotsRaw.length > 3)) {
    return err('Debes proponer entre 1 y 3 horarios')
  }
  if (necesitaSlots && !(slotsRaw as unknown[]).every((s) => esSlotFuturo(s, 0))) return err('Todos los horarios deben ser válidos y estar en el futuro')
  if (necesitaSlots && (slotsRaw as string[]).some((s) => new Date(s).getTime() > Date.now() + 60 * 86400_000)) return err('Los horarios deben estar dentro de los próximos 60 días')
  const slots_propuestos = necesitaSlots ? [...new Set((slotsRaw as string[]).map((s) => new Date(s).toISOString()))] : []

  // El compita nunca debe recibir teléfonos ni correos del cliente: se censuran igual que en el chat.
  const mensajeCensurado = detectarContacto(mensajeOriginal)
  const sobreCensurado = sobreOriginal ? detectarContacto(sobreOriginal) : null
  const mensaje = nueva ? mensajeDeSolicitud(nueva, nueva.nota ? mensajeCensurado.textoCensurado : null) : mensajeCensurado.textoCensurado
  const sobre_cliente = sobreCensurado ? sobreCensurado.textoCensurado : null

  // Traer datos del cliente y del compita
  const admin = createAdminSupabase()
  const [{ data: cliente }, { data: compita }] = await Promise.all([
    admin.from('usuarios').select('nombre, email, plan').eq('id', user.id).single(),
    admin.from('compitas').select('nombre, email, telegram_chat_id, estado, verificado').eq('id', compita_id).single(),
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
      ...(nueva ? { tipo: nueva.tipo, que: nueva.que, lugar_privado: nueva.lugar_privado, personas_en_lugar: nueva.personas_en_lugar } : {}),
    })
  } catch (e) {
    console.error('[solicitudes] error:', e)
    const msg = e instanceof Error ? e.message : ''
    if (/duplicate|unique/i.test(msg)) return err('Ya tienes una solicitud pendiente con este compita')
    // Solo se muestran los mensajes de negocio; los errores de BD no se filtran al cliente
    return MENSAJES_NEGOCIO.some((m) => msg.startsWith(m)) ? err(msg) : err('No pudimos crear la solicitud. Intenta de nuevo.', 500)
  }

  if (mensajeCensurado.detectado || sobreCensurado?.detectado) {
    await reportarContactoEnTexto({
      origen: 'cliente', donde: 'la solicitud de entrevista', quien: cliente?.nombre ?? 'Un cliente',
      entidadTipo: 'cliente', entidadId: user.id,
      textoOriginal: [mensajeCensurado.detectado ? mensajeOriginal : '', sobreCensurado?.detectado ? sobreOriginal : ''].filter(Boolean).join(' | '),
    })
  }

  const clienteNombre = cliente?.nombre ?? 'Un cliente'
  await registrarEvento({
    entidad: 'solicitud', entidadId: solicitud.id, tipo: 'solicitud_creada', actor: `cliente:${user.id}`,
    datos: { compita_id, horarios: slots_propuestos.length, ...(nueva ? { tipo: nueva.tipo, lugar_privado: nueva.lugar_privado } : {}) },
  })

  // Telegram primero, con registro. Si no se pudo entregar, el correo de respaldo sale en ese momento.
  // (Antes el correo y Telegram salían a la vez y un fallo de Telegram no quedaba registrado.)
  const pedido = {
    plantilla: 'solicitud_nueva' as const,
    destinatario: { tipo: 'compita' as const, id: compita_id },
    variables: { solicitudId: solicitud.id },
    entidad: 'solicitud' as const, entidadId: solicitud.id, paso: 5,
    plazoAccionMin: 360, // si en 6 h no responde, la escalera (paso 1.5) manda el respaldo
  }
  const porTelegram = await notificar({ ...pedido, canal: 'telegram' })
  if (!porTelegram.ok) {
    const porCorreo = compita.email ? await notificar({ ...pedido, canal: 'correo', respaldoDe: porTelegram.avisoId }) : null
    const sinTelegram = porTelegram.error === 'sin Telegram vinculado'
    await avisarAdmin([
      sinTelegram ? `⚠️ <b>Solicitud sin Telegram</b>` : `🚨 <b>No se pudo notificar por Telegram</b>`, ``,
      `<b>${esc(clienteNombre)}</b> solicitó a <b>${esc(compita.nombre)}</b>${sinTelegram ? ' pero no tiene Telegram vinculado.' : ', y el aviso por Telegram falló.'}`,
      porCorreo?.ok ? `Se le notificó por correo.` : compita.email ? `Tampoco se pudo por correo. Contáctala directamente.` : `No tiene correo registrado. Contáctala directamente.`,
    ].join('\n'))
  }

  return ok({ solicitud_id: solicitud.id, estado: solicitud.estado })
}
