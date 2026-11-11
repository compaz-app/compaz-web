import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { alertaAdmin } from '@/lib/alertas-admin'
import {
  validateTelegramWebhook,
  sendTelegramMessage,
  avisarAdmin,
  answerCallbackQuery,
  editMessageReplyMarkup,
  INLINE_DURANTE,
  INLINE_CONFIRMAR_INICIO,
  INLINE_CONFIRMAR_FIN,
  INLINE_START,
  INLINE_REAGENDAR_VISITA,
  INLINE_INICIAR_O_REAGENDAR,
  QUITAR_TECLADO,
  TECLADO_SIN_VISITA,
  TEXTO_NOTA_DE_VOZ,
  TECLADO_INICIO,
  TECLADO_DURANTE_VISITA,
  makeInlineKeyboard,
} from '@/lib/telegram'
import { generarTokenPerfil } from '@/lib/compita-tokens'
import { getOrCreateDailyRoom } from '@/lib/daily'
import { rutaLlamada } from '@/lib/llamada-ruta'
import { minutosLlamadaVisita } from '@/lib/llamada'
import { sendVisitaInicio, sendVisitaResumen, sendResumenConReporte, sendCodigoTelegram } from '@/lib/resend'
import { responderSolicitud, getSolicitudPorToken, getSolicitudPorId, aceptarSolicitudDirecta } from '@/lib/solicitudes'
import { confirmarReserva, rechazarReserva } from '@/lib/agenda'
import { registrarCancelacion, alertarCancelacionesCompita, horasDeAviso } from '@/lib/cancelaciones'
import { getAjustes } from '@/lib/ajustes'
import { responderCambioLugar } from '@/lib/lugar'
import { registrarEvento } from '@/lib/eventos'
import { salidaPorSeguridad, responderTodoBien } from '@/lib/seguridad'
import { situacionDelCompita } from '@/lib/que-me-toca'
import { registrarConsultaQueMeToca, menuDudas, responderDuda, dudaNoResuelta, dudaResuelta, dudaConTexto, recordarAlCliente, esTipoDuda, esTipoRecordatorio } from '@/lib/ayuda'
import { esperaTelegram } from '@/lib/esperas'
import { personaPausada } from '@/lib/pausas'
import { confirmarCita, rechazarCita } from '@/lib/citas'
import { clientesReportables, reportarCliente, esMotivoReporte, MOTIVOS_REPORTE, MOTIVOS_DE_RIESGO, CUANDO, type MotivoReporte, type Cuando } from '@/lib/bloqueos-compita'
import { llegadaConFotoObligatoria, registrarLlegada, declararNadieAbre, cerrarSinAcceso, tecladoLlegada } from '@/lib/llegada'
import { notificar } from '@/lib/avisos'
import { confirmarPagoYAvisar } from '@/lib/confirmar-pago'
import { anunciarEntrevistaConfirmada } from '@/lib/entrevista-confirmada'
import { registrarMotivo, MOTIVOS } from '@/lib/motivos'
import { qRol } from '@/lib/links'
import { sendEmail, SITE_URL as SITE_URL_PUBLICA } from '@/lib/email'
import { esc, escLike } from '@/lib/html'
import { detectarContacto, moderarMensaje, reportarContactoEnTexto } from '@/lib/chat-moderacion'
import { formatSlotVE, formatFechaVE, hoyVE } from '@/lib/format'
import { randomInt } from 'crypto'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''

const GUIA_COMPITA = `📋 <b>Guía rápida Compaz</b>

<b>▶️ Al llegar</b> — Toca <b>Iniciar visita</b>. La familia sabe que llegaste.
<b>📸 Durante la visita</b> — Manda fotos o mensajes. La familia los ve en tiempo real.
<b>🔴 Al irte</b> — Toca <b>Terminar visita</b>. La familia recibe el resumen automáticamente.
<b>🚨 Emergencia</b> — Toca ese botón y te contactamos de inmediato. Para peligro inmediato llama al 911.
<b>/perfil</b> — Edita tu foto, descripción y horarios.

¿Dudas? Escríbenos a <b>hola@micompaz.com</b>

━━━━━━━━━━━━━━━━━━━

🔒 <b>Aviso de seguridad:</b> Compaz nunca te pedirá contraseñas, datos bancarios, números de cédula ni información privada por este chat ni por ningún otro medio. Si alguien te los solicita diciendo ser de Compaz, no respondas y avísanos de inmediato a hola@micompaz.com.`

const PREGUNTAS_REPORTE = [
  { emoji: '😊', label: 'Ánimo', texto: '¿Cómo estaba el <b>ánimo</b> de la persona durante la visita?' },
  { emoji: '💪', label: 'Condición física', texto: '¿Cómo notaste su <b>condición física</b>?' },
  { emoji: '🤝', label: 'Participación', texto: '¿Qué tan <b>receptiva o activa</b> estuvo durante la visita?' },
  { emoji: '🏠', label: 'Ambiente y entorno', texto: '¿Cómo estaba el <b>ambiente y entorno</b> donde se encontraba?' },
]

function makeReporteKeyboard() {
  return makeInlineKeyboard([
    [
      { text: '1', callback_data: 'rr:1' },
      { text: '2', callback_data: 'rr:2' },
      { text: '3', callback_data: 'rr:3' },
      { text: '4', callback_data: 'rr:4' },
      { text: '5', callback_data: 'rr:5' },
    ],
    [{ text: 'N/A — No aplica', callback_data: 'rr:N' }],
  ])
}

const escapeHtml = esc

import type { TelegramUpdate, Compita, Usuario, Visita, Mensaje } from '@/types'

// Estado persistido en Supabase (tabla telegram_estados) para sobrevivir serverless cold starts
async function getEstado(supabase: ReturnType<typeof createAdminSupabase>, chatId: string) {
  const { data } = await supabase.from('telegram_estados').select('*').eq('chat_id', chatId).maybeSingle()
  return data as { chat_id: string; registro_pendiente: boolean; pendiente_accion: string | null; pendiente_expira: string | null } | null
}

async function setEstado(supabase: ReturnType<typeof createAdminSupabase>, chatId: string, campos: { registro_pendiente?: boolean; pendiente_accion?: string | null; pendiente_expira?: string | null }) {
  const actual = await getEstado(supabase, chatId)
  if (actual) {
    await supabase.from('telegram_estados').update(campos).eq('chat_id', chatId)
  } else {
    await supabase.from('telegram_estados').insert({ chat_id: chatId, registro_pendiente: false, pendiente_accion: null, pendiente_expira: null, ...campos })
  }
}

async function setRegistroPendiente(supabase: ReturnType<typeof createAdminSupabase>, chatId: string, valor: boolean) {
  await setEstado(supabase, chatId, { registro_pendiente: valor, pendiente_accion: null, pendiente_expira: null })
}
async function clearPendiente(supabase: ReturnType<typeof createAdminSupabase>, chatId: string) {
  await setEstado(supabase, chatId, { pendiente_accion: null, pendiente_expira: null })
}

// Confirmaciones de iniciar/terminar viven en su propia fila (conf:<chat>) para no pisar
// el cuestionario de bienestar ni la sugerencia de horarios, que usan la fila principal.
type Confirmacion = { accion: 'iniciar' | 'terminar'; visitaId: string }
async function setConfirmacion(supabase: ReturnType<typeof createAdminSupabase>, chatId: string, accion: 'iniciar' | 'terminar', visitaId: string) {
  const fila = `conf:${chatId}`
  const campos = { pendiente_accion: `${accion}:${visitaId}`, pendiente_expira: new Date(Date.now() + 300_000).toISOString(), registro_pendiente: false }
  const { error } = await supabase.from('telegram_estados').upsert({ chat_id: fila, ...campos }, { onConflict: 'chat_id' })
  if (error) throw new Error(`setConfirmacion: ${error.message}`)
}
async function takeConfirmacion(supabase: ReturnType<typeof createAdminSupabase>, chatId: string, esperada: 'iniciar' | 'terminar'): Promise<Confirmacion | null> {
  // Consume de forma atómica: solo una entrega concurrente obtiene la fila.
  const { data } = await supabase
    .from('telegram_estados')
    .delete()
    .eq('chat_id', `conf:${chatId}`)
    .like('pendiente_accion', `${esperada}:%`)
    .select('pendiente_accion, pendiente_expira')
    .maybeSingle()
  if (!data?.pendiente_accion || !data.pendiente_expira || new Date(data.pendiente_expira).getTime() < Date.now()) return null
  const [accion, visitaId] = data.pendiente_accion.split(':')
  if ((accion !== 'iniciar' && accion !== 'terminar') || !visitaId) return null
  return { accion, visitaId }
}
async function clearConfirmacion(supabase: ReturnType<typeof createAdminSupabase>, chatId: string) {
  await supabase.from('telegram_estados').delete().eq('chat_id', `conf:${chatId}`)
}

// ── Llegada con foto: el compita debe mandar la foto de la fachada o la puerta antes de iniciar ─────────────────
async function pedirFotoLlegada(supabase: ReturnType<typeof createAdminSupabase>, chatId: string, visitaId: string) {
  await supabase.from('telegram_estados').upsert(
    { chat_id: `lleg:${chatId}`, pendiente_accion: `llegada:${visitaId}`, pendiente_expira: new Date(Date.now() + 20 * 60_000).toISOString(), registro_pendiente: false },
    { onConflict: 'chat_id' },
  )
  await sendTelegramMessage(
    chatId,
    `📸 <b>Para avisar que llegaste, envía una foto</b>\n\nTómale una foto a la fachada o a la puerta del lugar y mándala aquí. Es obligatoria: sirve para que la familia sepa que ya estás ahí.\n\nLa foto solo la ve la familia y se borra a los 90 días.`,
    INLINE_REAGENDAR_VISITA,
  )
}

async function guardarReporteYEnviarEmail(
  supabase: ReturnType<typeof createAdminSupabase>,
  chatId: string,
  compita: Compita,
  accion: string,
  novedad: string | null,
) {
  // formato: reporte_novedad:{visita_id}:{ans0},{ans1},{ans2},{ans3}
  const partes = accion.split(':')
  const visitaId = partes[1]
  const answers = (partes[2] ?? '').split(',')

  function parseAns(v: string | undefined): number | null {
    if (!v || v === 'N') return null
    const n = parseInt(v, 10)
    return isNaN(n) ? null : n
  }

  const reporte = {
    animo: parseAns(answers[0]),
    fisico: parseAns(answers[1]),
    participacion: parseAns(answers[2]),
    entorno: parseAns(answers[3]),
    novedad: novedad?.trim() || null,
  }

  // Todas las queries usan admin para saltarse RLS (compita no tiene sesión de Auth)
  const adminReporte = createAdminSupabase()

  // Obtener visita con usuario
  const { data: visita } = await adminReporte
    .from('visitas')
    .select('*, usuario:usuarios(*)')
    .eq('id', visitaId)
    .single() as { data: (Visita & { usuario: Usuario }) | null }

  await clearPendiente(supabase, chatId)

  if (visita && visita.compita_id !== compita.id) {
    await sendTelegramMessage(chatId, `Ese cuestionario no corresponde a tu cuenta.`, TECLADO_SIN_VISITA)
    return
  }

  // Idempotencia: un solo reporte por visita (doble toque / reintento de Telegram)
  const { count: yaExiste } = await adminReporte
    .from('reportes_visita').select('id', { count: 'exact', head: true }).eq('visita_id', visitaId)
  if ((yaExiste ?? 0) > 0) {
    await sendTelegramMessage(chatId, `Ese cuestionario ya fue registrado. ¡Gracias! 💙`, TECLADO_SIN_VISITA)
    return
  }

  if (!visita || !visita.usuario) {
    await sendTelegramMessage(chatId, `Hubo un problema al recuperar los datos de la visita. No pudimos guardar el cuestionario ni enviar el resumen a la familia. Escríbenos a hola@micompaz.com y lo resolvemos.`, TECLADO_SIN_VISITA)
    return
  }

  // Reportes anteriores del mismo cliente (vía sus visitas)
  const { data: visitasCliente } = await adminReporte
    .from('visitas')
    .select('id, compita_id')
    .eq('usuario_id', visita.usuario_id)
    .neq('id', visitaId)
    .eq('estado', 'terminada')

  type HistorialRow = { animo: number | null; fisico: number | null; participacion: number | null; entorno: number | null; created_at: string }
  let historial: HistorialRow[] = []
  if (visitasCliente && visitasCliente.length > 0) {
    const visitaIds = visitasCliente.map((v) => v.id)
    const { data: reportesPrevios } = await adminReporte
      .from('reportes_visita')
      .select('animo, fisico, participacion, entorno, created_at')
      .in('visita_id', visitaIds)
      .order('created_at', { ascending: true })
    historial = (reportesPrevios ?? []) as HistorialRow[]
  }

  // Guardar reporte en BD
  const { data: reporteGuardado, error: reporteError } = await adminReporte
    .from('reportes_visita')
    .insert({ visita_id: visitaId, ...reporte })
    .select('id')
    .single()

  if (reporteError?.code === '23505') {
    // Otro toque simultáneo ya registró el cuestionario: no es un error para la compita
    await sendTelegramMessage(chatId, `Ese cuestionario ya fue registrado. ¡Gracias! 💙`, TECLADO_SIN_VISITA)
    return
  }

  if (reporteError || !reporteGuardado) {
    console.error('Error guardando reporte_visita:', reporteError)
    await sendTelegramMessage(chatId, `Hubo un problema guardando el cuestionario. Por favor escríbenos a hola@micompaz.com para que lo registremos manualmente.`, TECLADO_SIN_VISITA)
    return
  }

  // Enviar segundo email con indicadores de bienestar y resumen IA
  let emailEnviado = false
  try {
    const { data: mensajes } = await adminReporte
      .from('mensajes').select('*').eq('visit_id', visitaId).order('created_at', { ascending: true }) as { data: import('@/types').Mensaje[] | null }

    const esRecurrenteReporte = (visitasCliente ?? []).some((v) => (v as { compita_id?: string }).compita_id === compita.id)
    const resumenIA = await sendResumenConReporte(
      visita.usuario,
      compita,
      visita,
      mensajes ?? [],
      reporte,
      historial,
      true, // esActualizacion — el email básico ya fue enviado al terminar
      esRecurrenteReporte,
    )

    // Guardar resumen IA en el reporte
    emailEnviado = true
    if (reporteGuardado?.id && resumenIA) {
      await adminReporte.from('reportes_visita').update({ resumen_ia: resumenIA }).eq('id', reporteGuardado.id)
    }
  } catch (e) {
    console.error('Error correo resumen con reporte:', e)
    await alertaAdmin('tarea', `⚠️ El cuestionario de <b>${esc(compita.nombre)}</b> se guardó pero no se pudo enviar el correo a <b>${esc(visita.usuario.nombre)}</b> (${esc(visita.usuario.email)}).`)
  }

  await sendTelegramMessage(
    chatId,
    emailEnviado
      ? `✅ <b>¡Listo!</b> El cuestionario fue guardado y se le envió el resumen a la familia.\n\n¡Gracias por tu trabajo, ${esc(compita.nombre)}! 💙`
      : `✅ El cuestionario fue guardado. Tuvimos un problema enviando el correo a la familia; el equipo de Compaz lo enviará.\n\n¡Gracias por tu trabajo, ${esc(compita.nombre)}! 💙`,
    TECLADO_SIN_VISITA,
  )
}

export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token')
  if (!validateTelegramWebhook(secretHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await req.json() as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Idempotencia: Telegram reintenta si tardamos o respondemos 5xx. Reclamar update_id es atómico (PK).
  if (typeof update.update_id === 'number') {
    const { error: dupError } = await createAdminSupabase()
      .from('telegram_estados')
      .insert({ chat_id: `upd:${update.update_id}`, registro_pendiente: false })
    if (dupError?.code === '23505') return NextResponse.json({ ok: true, duplicado: true })
  }

  // Nunca devolver 5xx: provocaría reintentos en bucle. Se registra y se avisa al usuario.
  try {
    return await procesarUpdate(update)
  } catch (e) {
    console.error('[telegram-webhook] error no controlado:', e)
    const chat = update.message?.chat.id ?? update.callback_query?.message?.chat.id
    if (chat) {
      await sendTelegramMessage(String(chat), 'Ocurrió un error inesperado. Intenta de nuevo en un momento; si persiste escríbenos a hola@micompaz.com.').catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }
}

function enmascarar(email: string): string {
  const [u, d] = email.split('@')
  if (!d) return '***'
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`
}

const MAX_FALLOS_VINCULO = 10          // fallos acumulados por compita (no por chat)
const VENTANA_FALLOS_MS = 24 * 3600_000

/** Fallos de código acumulados contra una compita en las últimas 24 h (fila `codfail:<id>`: pendiente_accion = "n:<fallos>"). */
async function fallosDeVinculo(supabase: ReturnType<typeof createAdminSupabase>, compitaId: string): Promise<number> {
  const { data } = await supabase.from('telegram_estados').select('pendiente_accion, pendiente_expira').eq('chat_id', `codfail:${compitaId}`).maybeSingle()
  if (!data?.pendiente_expira || new Date(data.pendiente_expira).getTime() < Date.now()) return 0
  return parseInt((data.pendiente_accion ?? 'n:0').split(':')[1] ?? '0', 10) || 0
}

async function registrarFalloVinculo(supabase: ReturnType<typeof createAdminSupabase>, compitaId: string, nombre: string): Promise<void> {
  const n = (await fallosDeVinculo(supabase, compitaId)) + 1
  const { data: prev } = await supabase.from('telegram_estados').select('pendiente_expira').eq('chat_id', `codfail:${compitaId}`).maybeSingle()
  const vigente = prev?.pendiente_expira && new Date(prev.pendiente_expira).getTime() > Date.now()
  await supabase.from('telegram_estados').upsert({
    chat_id: `codfail:${compitaId}`, registro_pendiente: false, pendiente_accion: `n:${n}`,
    pendiente_expira: vigente ? prev!.pendiente_expira : new Date(Date.now() + VENTANA_FALLOS_MS).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'chat_id' })
  if (n === MAX_FALLOS_VINCULO) {
    await alertaAdmin('urgente', `🚨 Posible intento de suplantar a <b>${esc(nombre)}</b>: ${MAX_FALLOS_VINCULO} códigos de vinculación incorrectos en 24 h. La vinculación de Telegram de esa compita queda bloqueada hasta que pase la ventana o la liberes.`)
  }
}

/** Genera y envía el código de verificación. Límite: 1 código por minuto y compita. */
async function iniciarVerificacion(
  supabase: ReturnType<typeof createAdminSupabase>,
  chatId: string,
  c: Pick<Compita, 'id' | 'nombre' | 'email'>,
): Promise<void> {
  // Una compita ya vinculada no se re-vincula desde otro chat (solo el admin puede liberarla)
  const { data: yaVinc } = await supabase.from('compitas').select('telegram_chat_id').eq('id', c.id).maybeSingle()
  if (yaVinc?.telegram_chat_id) {
    await sendTelegramMessage(chatId, `Esa cuenta ya está vinculada a un Telegram. Si cambiaste de teléfono o es un error, escríbenos a hola@micompaz.com.`, QUITAR_TECLADO)
    await alertaAdmin('tarea', `⚠️ Alguien intentó vincular a <b>${esc(c.nombre)}</b>, que ya tiene Telegram vinculado.`)
    return
  }
  if ((await fallosDeVinculo(supabase, c.id)) >= MAX_FALLOS_VINCULO) {
    await sendTelegramMessage(chatId, `Por seguridad, la vinculación de esta cuenta está bloqueada temporalmente. Escríbenos a hola@micompaz.com.`, QUITAR_TECLADO)
    return
  }
  const key = `cod:${c.id}`
  const { data: prev } = await supabase.from('telegram_estados').select('updated_at').eq('chat_id', key).maybeSingle()
  if (prev && Date.now() - new Date(prev.updated_at).getTime() < 60_000) {
    await setRegistroPendiente(supabase, chatId, true)
    await sendTelegramMessage(chatId, `Ya enviamos un código hace un momento. Espera un minuto antes de pedir otro. ✍️ Escribe tu nombre de nuevo cuando quieras reintentar:`, QUITAR_TECLADO)
    return
  }
  await supabase.from('telegram_estados').upsert({ chat_id: key, registro_pendiente: false, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })

  const codigo = String(randomInt(100000, 1000000))
  const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  await setEstado(supabase, chatId, { registro_pendiente: false, pendiente_accion: `verificar:${codigo}:${c.id}`, pendiente_expira: expira })

  if (c.email) {
    try {
      await sendCodigoTelegram(c.email, c.nombre, codigo)
    } catch (e) {
      console.error('Error enviando código por email:', e)
      await setRegistroPendiente(supabase, chatId, true)
      await sendTelegramMessage(chatId, `No pudimos enviar el correo con tu código. Escríbenos a hola@micompaz.com y te activamos la cuenta. ✍️ O intenta de nuevo escribiendo tu nombre:`, QUITAR_TECLADO)
      return
    }
    await sendTelegramMessage(chatId, `Encontré tu cuenta 👀\n\nTe enviamos un <b>código de 6 dígitos</b> al correo <b>${esc(enmascarar(c.email))}</b>.\n\n✍️ Escríbelo aquí cuando lo recibas.\n\n🚨 <b>Alerta de fraude:</b> el código llega únicamente por correo. Compaz nunca te llamará por teléfono. No compartas este código con nadie.`, QUITAR_TECLADO)
  } else {
    const entregado = await avisarAdmin(`🔐 <b>Verificación de Compita</b>\n\n<b>${esc(c.nombre)}</b> quiere activar su cuenta.\n\nCódigo: <code>${codigo}</code>\n\nExpira en 15 minutos.`)
    if (!entregado) {
      await setRegistroPendiente(supabase, chatId, true)
      await sendTelegramMessage(chatId, `No pudimos generar tu código. Escríbenos a hola@micompaz.com. ✍️ O intenta de nuevo escribiendo tu nombre:`, QUITAR_TECLADO)
      return
    }
    await sendTelegramMessage(chatId, `Encontré tu cuenta 👀\n\nPor seguridad, te enviamos un <b>código de 6 dígitos</b> a través del admin de Compaz.\n\n✍️ Escríbelo aquí cuando lo recibas:`, QUITAR_TECLADO)
  }
}

type VisitaObj = {
  id: string; usuario_id: string; estado: string; llegada_en?: string | null
  fecha_programada: string | null; hora_inicio_programada: string | null; hora_fin_programada: string | null
  usuario: { nombre: string; email: string } | null
}

/** Visita sobre la que actúa la compita: la de hoy/ayer, si no la próxima con fecha, si no una sin fecha. */
async function visitaObjetivo(supabase: ReturnType<typeof createAdminSupabase>, compitaId: string): Promise<VisitaObj | null> {
  const { data } = await supabase
    .from('visitas')
    .select('id, usuario_id, estado, llegada_en, fecha_programada, hora_inicio_programada, hora_fin_programada, usuario:usuarios(nombre, email)')
    .eq('compita_id', compitaId)
    .in('estado', ['programada', 'pre_visita'])
    .order('fecha_programada', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false }) as { data: VisitaObj[] | null }
  const lista = data ?? []
  const hoy = hoyVE(), ayer = hoyVE(-1)
  return lista.find((v) => v.fecha_programada === hoy)
    ?? lista.find((v) => v.fecha_programada === ayer)
    ?? lista.find((v) => v.fecha_programada && v.fecha_programada > hoy)
    ?? lista.find((v) => v.fecha_programada)
    ?? lista[0]
    ?? null
}

async function procesarUpdate(update: TelegramUpdate): Promise<NextResponse> {

  // Extraer chatId y text tanto de message como de callback_query
  const isCallback = !!update.callback_query
  const callbackId = update.callback_query?.id
  const message = update.message ?? update.callback_query?.message
  if (!message) return NextResponse.json({ ok: true })

  const chatId = String(message.chat.id)
  const text = isCallback
    ? (update.callback_query?.data?.trim() ?? '')
    : (message.text?.trim() ?? '')

  const supabase = createAdminSupabase()

  // Si es callback, responder inmediatamente para quitar el "cargando" del botón
  if (isCallback && callbackId) {
    await answerCallbackQuery(callbackId)
    // Quitar los botones del mensaje original para evitar doble toque
    if (message.message_id) {
      await editMessageReplyMarkup(chatId, message.message_id, null).catch(() => {})
    }
  }

  // Buscar compita por telegram_chat_id
  const { data: compita } = await supabase
    .from('compitas')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .maybeSingle() as { data: Compita | null }

  // Cuenta bloqueada: no puede usar nada del bot (salvo /reset del admin).
  if (compita?.estado === 'bloqueado' && text !== '/reset') {
    await sendTelegramMessage(chatId, `Tu cuenta está suspendida. Escríbenos a hola@micompaz.com.`)
    return NextResponse.json({ ok: true })
  }

  // Confirmar un pago desde el botón del aviso al equipo. Solo el chat del administrador; el pago se confirma una sola vez.
  if (isCallback && text.startsWith('pagoconf:')) {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (!adminChatId || chatId !== adminChatId) return NextResponse.json({ ok: true })
    const r = await confirmarPagoYAvisar(text.slice('pagoconf:'.length), 'admin:telegram')
    await sendTelegramMessage(chatId, r.ok ? `✅ Pago de $${r.pago.monto_usd} confirmado. ${esc(r.nombre)} ya tiene sus visitas activas y recibió el correo.` : `No se confirmó: ${esc(r.error)}`)
    return NextResponse.json({ ok: true })
  }

  // Teclado correcto según estado actual de la visita (se usa en /menu y /perfil).
  async function tecladoSegunEstado(): Promise<typeof TECLADO_SIN_VISITA | typeof TECLADO_INICIO | typeof TECLADO_DURANTE_VISITA> {
    if (!compita) return TECLADO_SIN_VISITA
    const { data: v } = await supabase
      .from('visitas').select('id, estado').eq('compita_id', compita.id)
      .in('estado', ['programada', 'confirmando_inicio', 'en_curso']).limit(1).maybeSingle()
    if (v?.estado === 'en_curso' || v?.estado === 'confirmando_inicio') return TECLADO_DURANTE_VISITA
    if (v?.estado === 'programada') return TECLADO_INICIO
    return TECLADO_SIN_VISITA
  }

  // ── /menu — guía de funcionalidades ─────────────────────────────────────────
  if (text === '/menu' || text === '/ayuda' || text === 'cmd_menu') {
    if (!compita) {
      await sendTelegramMessage(chatId, `Tu cuenta no está vinculada. Toca el botón para comenzar. 👇`, INLINE_START)
      return NextResponse.json({ ok: true })
    }
    await sendTelegramMessage(chatId, GUIA_COMPITA, await tecladoSegunEstado())
    return NextResponse.json({ ok: true })
  }

  // ── /perfil — editar perfil ───────────────────────────────────────────────
  if (text === '/perfil') {
    if (!compita) {
      await sendTelegramMessage(chatId, `Tu cuenta no está vinculada. Toca el botón para comenzar. 👇`, INLINE_START)
      return NextResponse.json({ ok: true })
    }
    const tecladoPerfil = await tecladoSegunEstado()
    try {
      const token = await generarTokenPerfil(compita.id)
      const url = `${SITE_URL}/compita/perfil?token=${token}`
      const venceEn = new Date(Date.now() + 24 * 60 * 60_000)
      const venceLabel = venceEn.toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
      await sendTelegramMessage(
        chatId,
        `✏️ <b>Edita tu perfil</b>\n\nAquí tienes tu enlace personal:\n\n<a href="${url}">${url}</a>\n\n⏳ Este enlace vence el <b>${venceLabel}</b> y solo funciona una vez. Si lo abres y lo dejas a medias, vuelve a escribir /perfil para obtener uno nuevo.\n\nSi tienes algún problema, escríbenos a hola@micompaz.com.`,
        tecladoPerfil,
      )
    } catch (e) {
      console.error('Error generando token de perfil:', e)
      await sendTelegramMessage(chatId, `Hubo un error al generar tu enlace. Intenta de nuevo en un momento.`, tecladoPerfil)
    }
    return NextResponse.json({ ok: true })
  }

  // ── /reset — solo admin ──────────────────────────────────────────────────────
  if (text === '/reset') {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (chatId !== adminChatId) return NextResponse.json({ ok: true })
    if (compita) {
      await supabase.from('compitas').update({ telegram_chat_id: null }).eq('id', compita.id)
    }
    await setEstado(supabase, chatId, { registro_pendiente: false, pendiente_accion: null, pendiente_expira: null })
    await sendTelegramMessage(chatId, `Cuenta desvinculada. Toca el botón para comenzar de nuevo.`, INLINE_START)
    return NextResponse.json({ ok: true })
  }

  // ── /start — bienvenida y registro ──────────────────────────────────────────
  if (text === '/start' || text.startsWith('/start ')) {
    if (compita) {
      // Verificar si tiene cliente asignado
      const { data: clienteAsignado } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('compita_id', compita.id)
        .limit(1)
        .maybeSingle() as { data: { nombre: string } | null }

      if (clienteAsignado) {
        await sendTelegramMessage(
          chatId,
          `¡Hola de nuevo, <b>${esc(compita.nombre)}</b>! 👋\n\nTodo está listo. Cuando llegues a casa de tu cliente y vayas a comenzar, toca el botón <b>▶️ Iniciar visita</b>. Cuando termines, toca <b>🔴 Terminar visita</b>.`,
          await tecladoSegunEstado(),
        )
      } else {
        await sendTelegramMessage(
          chatId,
          `¡Hola de nuevo, <b>${esc(compita.nombre)}</b>! 👋\n\nTu cuenta está activa. Todavía no tienes un cliente asignado, pero cuando eso cambie te avisaremos aquí.\n\nMientras tanto, puedes actualizar tu perfil con <b>/perfil</b> para que las familias te conozcan mejor.`,
          TECLADO_SIN_VISITA,
        )
      }
    } else {
      await setEstado(supabase, chatId, { registro_pendiente: true, pendiente_accion: null, pendiente_expira: null })
      await sendTelegramMessage(
        chatId,
        `¡Bienvenido a Compaz! 👋\n\nPara verificar tu cuenta escríbeme tu <b>nombre completo</b> tal como lo pusiste al registrarte.\n\n<i>Ejemplo: María González</i>\n\n🔔 <b>Activa las notificaciones de Telegram</b> para no perderte solicitudes ni avisos de visita.\n\n🔒 Compaz nunca te pedirá contraseñas, datos bancarios ni información privada. Si alguien lo hace, avísanos a hola@micompaz.com.`,
        QUITAR_TECLADO,
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── Vinculación por nombre + código de verificación ─────────────────────────
  const estado = !compita ? await getEstado(supabase, chatId) : null

  // Paso 1b: desambiguación por email cuando hay múltiples cuentas con el mismo nombre
  // formato estado: desambiguar:{id1},{id2},...
  if (estado?.pendiente_accion?.startsWith('desambiguar:') && !compita) {
    if (!text.trim()) return NextResponse.json({ ok: true })
    const expirado = estado.pendiente_expira ? new Date(estado.pendiente_expira) < new Date() : true
    if (expirado) {
      await clearPendiente(supabase, chatId)
      await setRegistroPendiente(supabase, chatId, true)
      await sendTelegramMessage(chatId, `El tiempo expiró. ✍️ Escribe tu nombre de nuevo para intentarlo:`, QUITAR_TECLADO)
      return NextResponse.json({ ok: true })
    }
    const ids = estado.pendiente_accion.slice('desambiguar:'.length).split(',').filter(Boolean)
    const { data: candidatas } = await supabase
      .from('compitas')
      .select('id, nombre, email, codigo')
      .in('id', ids)
      .ilike('email', `${escLike(text.trim())}%`) as { data: Compita[] | null }

    if (!candidatas || candidatas.length === 0) {
      await setRegistroPendiente(supabase, chatId, true)
      await clearPendiente(supabase, chatId)
      await sendTelegramMessage(chatId, `No encontré ninguna cuenta con esas letras de correo. 🤔\n\nEscríbenos a hola@micompaz.com y te ayudamos a activar tu cuenta.\n\n✍️ O escribe tu nombre de nuevo para intentarlo:`, QUITAR_TECLADO)
    } else if (candidatas.length > 1) {
      await clearPendiente(supabase, chatId)
      await sendTelegramMessage(chatId, `No pude identificarte con esa información. Por favor escríbenos a hola@micompaz.com y te activamos la cuenta manualmente.`, QUITAR_TECLADO)
    } else {
      await iniciarVerificacion(supabase, chatId, candidatas[0])
    }
    return NextResponse.json({ ok: true })
  }

  // Paso 2: compita ingresó el código de 6 dígitos
  // formato estado: verificar:{codigo}:{compitaId}:{intentos_fallidos}
  if (estado?.pendiente_accion?.startsWith('verificar:') && !compita) {
    const partesCodigo = estado.pendiente_accion.split(':')
    const [, codigo, compitaId] = partesCodigo
    const intentosFallidos = parseInt(partesCodigo[3] ?? '0', 10)
    if (!text.trim()) return NextResponse.json({ ok: true })
    const expirado = estado.pendiente_expira ? new Date(estado.pendiente_expira) < new Date() : true
    if (expirado) {
      await clearPendiente(supabase, chatId)
      await setRegistroPendiente(supabase, chatId, true)
      await sendTelegramMessage(chatId, `El código expiró. ✍️ Escribe tu nombre de nuevo para obtener uno nuevo:`)
      return NextResponse.json({ ok: true })
    }
    if ((await fallosDeVinculo(supabase, compitaId)) >= MAX_FALLOS_VINCULO) {
      await clearPendiente(supabase, chatId)
      await sendTelegramMessage(chatId, `Por seguridad, la vinculación de esta cuenta está bloqueada temporalmente. Escríbenos a hola@micompaz.com.`, QUITAR_TECLADO)
      return NextResponse.json({ ok: true })
    }
    if (text.trim() !== codigo) {
      const { data: cf } = await supabase.from('compitas').select('nombre').eq('id', compitaId).maybeSingle()
      await registrarFalloVinculo(supabase, compitaId, cf?.nombre ?? 'una compita')
      const nuevosIntentos = intentosFallidos + 1
      if (nuevosIntentos >= 5) {
        // Bloquear: invalidar el código y pedir que empiece de nuevo
        await clearPendiente(supabase, chatId)
        await setRegistroPendiente(supabase, chatId, true)
        await sendTelegramMessage(
          chatId,
          `Demasiados intentos incorrectos ❌\n\nPor seguridad, el código fue invalidado. ✍️ Escribe tu nombre de nuevo para recibir uno nuevo:`,
          QUITAR_TECLADO,
        )
      } else {
        // Registrar intento fallido en el estado
        await setEstado(supabase, chatId, {
          pendiente_accion: `verificar:${codigo}:${compitaId}:${nuevosIntentos}`,
        })
        const restantes = 5 - nuevosIntentos
        await sendTelegramMessage(
          chatId,
          `Código incorrecto ❌\n\nRevisa el correo e inténtalo de nuevo. Te quedan <b>${restantes}</b> intento${restantes !== 1 ? 's' : ''}.`,
          QUITAR_TECLADO,
        )
      }
      return NextResponse.json({ ok: true })
    }
    // Código correcto — vincular
    await clearPendiente(supabase, chatId)
    const { data: encontrada } = await supabase.from('compitas').select('nombre').eq('id', compitaId).single() as { data: Compita | null }
    const { data: vinculada, error: errVinculo } = await supabase.from('compitas').update({ telegram_chat_id: chatId }).eq('id', compitaId).is('telegram_chat_id', null).select('id').maybeSingle()
    if (!errVinculo && !vinculada) {
      await sendTelegramMessage(chatId, `Esa cuenta ya está vinculada a un Telegram. Escríbenos a hola@micompaz.com.`, QUITAR_TECLADO)
      return NextResponse.json({ ok: true })
    }
    if (errVinculo) {
      console.error('Error vinculando Telegram:', errVinculo)
      await sendTelegramMessage(chatId, `No pudimos vincular tu cuenta. Escríbenos a hola@micompaz.com.`, QUITAR_TECLADO)
      return NextResponse.json({ ok: true })
    }
    const nombre = esc(encontrada?.nombre ?? 'Compita')
    await sendTelegramMessage(
      chatId,
      `✅ <b>¡Listo, ${nombre}!</b> Tu cuenta ya está activa en Compaz. ¡Ya eres parte del equipo! 🎉\n\n🔔 <b>Importante:</b> activa las notificaciones de Telegram ahora para no perderte solicitudes de clientes ni avisos de visita. Ve a Configuración → Notificaciones en Telegram y asegúrate de que estén activadas.\n\nAquí te explico cómo funciona todo:`,
      QUITAR_TECLADO,
    )
    await sendTelegramMessage(chatId, GUIA_COMPITA, TECLADO_SIN_VISITA)
    await sendTelegramMessage(
      chatId,
      `🙌 <b>Eso es todo. Tu registro ya terminó.</b>\n\nNo tienes que hacer nada más de tu lado. Ahora solo falta que una familia te contrate — en cuanto eso pase, te va a aparecer aquí mismo, en este chat.\n\nMientras tanto, si quieres, completa tu perfil con /perfil para que las familias te conozcan mejor.`,
      TECLADO_SIN_VISITA,
    )
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (adminChatId) {
      try {
        await sendTelegramMessage(adminChatId, `🟢 <b>Nueva Compita vinculada</b>\n\n<b>${nombre}</b> activó su cuenta en Telegram.\n\nRevisa su perfil en el panel admin y veríficala cuando esté lista.`)
      } catch (e) { console.error('Error notificando admin:', e) }
    }
    return NextResponse.json({ ok: true })
  }

  // Paso 1: compita ingresó su nombre → buscar y enviar código al email
  if (estado?.registro_pendiente && !compita) {
    if (!text.trim()) return NextResponse.json({ ok: true })
    await setRegistroPendiente(supabase, chatId, false)
    const normalizar = (s: string) =>
      s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    const textoBuscado = text.trim().slice(0, 80)
    let { data: resultados } = await supabase
      .from('compitas')
      .select('id, nombre, email, codigo')
      .ilike('nombre', `%${escLike(textoBuscado)}%`)
      .limit(5) as { data: Compita[] | null }
    // Si no hubo coincidencia exacta, buscar ignorando tildes
    if (!resultados?.length) {
      const { data: todos } = await supabase
        .from('compitas')
        .select('id, nombre, email, codigo') as { data: Compita[] | null }
      const normBuscado = normalizar(textoBuscado)
      resultados = (todos ?? []).filter((c) => normalizar(c.nombre).includes(normBuscado)).slice(0, 5)
    }

    const encontrada = resultados?.length === 1 ? resultados[0] : null
    const ambiguo = (resultados?.length ?? 0) > 1

    if (ambiguo) {
      const ids = (resultados ?? []).map((r) => r.id).join(',')
      const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      await setEstado(supabase, chatId, { pendiente_accion: `desambiguar:${ids}`, pendiente_expira: expira })
      await sendTelegramMessage(
        chatId,
        `Encontré más de una cuenta con ese nombre. Para identificarte, escribe las <b>primeras letras de tu correo</b>.\n\nPor ejemplo, si tu correo es <i>maria.garcia@gmail.com</i>, escribe <b>maria</b>.`,
        QUITAR_TECLADO,
      )
    } else if (!encontrada) {
      await setRegistroPendiente(supabase, chatId, true)
      await sendTelegramMessage(
        chatId,
        `No encontré ninguna cuenta con ese nombre. 🤔\n\nIntenta escribirlo de otra forma. Por ejemplo, si te registraste como "María" prueba con "Maria", o si pusiste solo el primer nombre prueba con el nombre completo.\n\nSi el problema continúa, escríbenos a hola@micompaz.com y te ayudamos.\n\n✍️ Intenta de nuevo:`,
        QUITAR_TECLADO,
      )
    } else {
      await iniciarVerificacion(supabase, chatId, encontrada)
    }
    return NextResponse.json({ ok: true })
  }

  if (!compita) {
    await sendTelegramMessage(
      chatId,
      `Tu cuenta no está vinculada todavía. 👇\n\nToca el botón para comenzar. Solo toma un minuto.`,
      INLINE_START,
    )
    return NextResponse.json({ ok: true })
  }

  // Notas de voz, audios y videomensajes: en Venezuela se usan mucho, pero el bot solo retransmite texto y fotos.
  // Sin esta respuesta el compita creería que el cliente las recibió. Nada se guarda ni se reenvía.
  if (!isCallback && (message.voice || message.audio || message.video_note)) {
    await sendTelegramMessage(chatId, TEXTO_NOTA_DE_VOZ)
    return NextResponse.json({ ok: true })
  }

  // Cuenta inactiva o aún sin verificar: puede usar /perfil y /menu, pero no operar visitas ni solicitudes.
  if (compita.estado !== 'activo' || !compita.verificado) {
    await sendTelegramMessage(
      chatId,
      `Tu cuenta todavía está en revisión. Mientras tanto puedes completar tu perfil con /perfil. Te avisaremos por aquí cuando esté verificada.`,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Menú ─────────────────────────────────────────────────────────────
  if (text === '📋 Menú') {
    await sendTelegramMessage(chatId, GUIA_COMPITA, await tecladoSegunEstado())
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Iniciar visita ────────────────────────────────────────────────────
  if (text === '▶️ Iniciar visita') {
    const { data: visitaEnCurso } = await supabase
      .from('visitas').select('id').eq('compita_id', compita.id).eq('estado', 'en_curso').limit(1).maybeSingle()
    if (visitaEnCurso) {
      await sendTelegramMessage(chatId, `Ya tienes una visita en curso. Cuando termines, toca el botón 🔴 de tu teclado. 👇`, TECLADO_DURANTE_VISITA)
      return NextResponse.json({ ok: true })
    }

    const objetivo = await visitaObjetivo(supabase, compita.id)
    if (!objetivo) {
      await sendTelegramMessage(
        chatId,
        `No encontré ninguna visita programada para ti en este momento.\n\nEsto ocurre cuando el cliente todavía no ha registrado la fecha de la visita en el sistema. Una vez que lo haga, podrás iniciarla desde aquí.\n\nSi crees que es un error, escríbenos a hola@micompaz.com.`,
        TECLADO_SIN_VISITA,
      )
      return NextResponse.json({ ok: true })
    }

    const clienteNombre = esc(objetivo.usuario?.nombre ?? 'tu cliente')
    if (!objetivo.fecha_programada) {
      await sendTelegramMessage(
        chatId,
        `⚠️ <b>La fecha de la visita aún no está confirmada</b>\n\n${clienteNombre} todavía no registró la fecha en el sistema. Escríbele desde este mismo chat para coordinarla. Una vez que la confirme, podrás iniciar la visita desde aquí.`,
        TECLADO_SIN_VISITA,
      )
      return NextResponse.json({ ok: true })
    }

    const fechaLabel = formatFechaVE(objetivo.fecha_programada)
    // Solo se puede iniciar el día pautado (hoy o, por cruce de medianoche, ayer).
    if (objetivo.fecha_programada !== hoyVE() && objetivo.fecha_programada !== hoyVE(-1)) {
      await sendTelegramMessage(
        chatId,
        objetivo.fecha_programada > hoyVE()
          ? `Tu próxima visita con <b>${clienteNombre}</b> es el <b>${fechaLabel}</b>. Podrás iniciarla ese día.\n\nSi necesitas cambiarla, toca el botón de abajo.`
          : `La visita con <b>${clienteNombre}</b> estaba pautada para el <b>${fechaLabel}</b> y ya pasó. Pídele que registre una nueva fecha o escríbenos a hola@micompaz.com.`,
        INLINE_REAGENDAR_VISITA,
      )
      return NextResponse.json({ ok: true })
    }

    const horarioLabel = objetivo.hora_inicio_programada && objetivo.hora_fin_programada
      ? `${esc(objetivo.hora_inicio_programada)} – ${esc(objetivo.hora_fin_programada)}`
      : null

    // Foto de llegada obligatoria: sin ella no se avanza (y se pide aquí mismo).
    const exigeFoto = await llegadaConFotoObligatoria()
    if (exigeFoto && !objetivo.llegada_en) { await pedirFotoLlegada(supabase, chatId, objetivo.id); return NextResponse.json({ ok: true }) }

    await setConfirmacion(supabase, chatId, 'iniciar', objetivo.id)
    await sendTelegramMessage(
      chatId,
      [
        `¿Vas a empezar la visita con <b>${clienteNombre}</b>?`,
        ``,
        `📅 <b>${fechaLabel}</b>`,
        horarioLabel ? `🕐 <b>${horarioLabel}</b>` : '',
        ``,
        `Toca <b>✅ Sí, iniciar</b> para confirmar. La familia sabrá que ya llegaste.`,
        ``,
        `Si surgió algún imprevisto, puedes reagendar tocando el botón de abajo.`,
      ].filter(Boolean).join('\n'),
      exigeFoto ? tecladoLlegada(objetivo.id) : INLINE_INICIAR_O_REAGENDAR,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Terminar visita ───────────────────────────────────────────────────
  if (text === '🔴 Terminar visita') {
    const { data: visita } = await supabase
      .from('visitas').select('id').eq('compita_id', compita.id).eq('estado', 'en_curso')
      .order('inicio', { ascending: false }).limit(1).maybeSingle()

    if (!visita) {
      await sendTelegramMessage(chatId, `No tienes ninguna visita en curso en este momento.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }

    await setConfirmacion(supabase, chatId, 'terminar', visita.id)
    await sendTelegramMessage(
      chatId,
      `¿Confirmas que quieres terminar la visita?\n\nToca <b>✅ Sí, terminar</b> para confirmar. Se le enviará un resumen a la familia.`,
      INLINE_CONFIRMAR_FIN,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Llamar al cliente ─────────────────────────────────────────────────
  if (text === '📹 Llamar al cliente') {
    const { data: visitaLlamada } = await supabase
      .from('visitas')
      .select('id, room_url, usuario:usuarios(nombre, email)')
      .eq('compita_id', compita.id)
      .eq('estado', 'en_curso')
      .order('inicio', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { id: string; room_url: string | null; usuario: { nombre: string; email: string } | null } | null }

    if (!visitaLlamada) {
      await sendTelegramMessage(chatId, `No tienes ninguna visita en curso en este momento.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }

    // Cada llamada tiene su sala con duración limitada: si la anterior ya se cerró, se crea otra (getOrCreateDailyRoom la reutiliza si sigue abierta).
    const room = await getOrCreateDailyRoom(visitaLlamada.id, visitaLlamada.room_url)
    const roomUrl = room.url
    await supabase.from('visitas').update({ room_url: roomUrl, llamada_solicitada_at: new Date().toISOString() }).eq('id', visitaLlamada.id)
    const minutosLlamada = await minutosLlamadaVisita()

    const roomUrlEs = `${SITE_URL_PUBLICA}${rutaLlamada(roomUrl)}`
    await sendTelegramMessage(
      chatId,
      `📹 <b>Enlace de videollamada</b>\n\nAbre este enlace para llamar al cliente (dura ${minutosLlamada} min):\n${roomUrlEs}`,
      TECLADO_DURANTE_VISITA,
    )

    // Notificar al cliente por email
    const clienteEmail = visitaLlamada.usuario?.email
    if (clienteEmail) {
      await sendEmail({
        to: [clienteEmail],
        subject: `${compita.nombre} quiere llamarte`,
        html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h2 style="color:#2D1464">📹 ${escapeHtml(compita.nombre)} quiere llamarte</h2>
          <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
            Tu compita quiere hacer una videollamada. Entra a tu portal para conectarte:
          </p>
          <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:600;margin-top:8px">
            Ir al portal
          </a>
        </div>`,
      })
    }

    return NextResponse.json({ ok: true })
  }

  // ── Botón: Cancelar ──────────────────────────────────────────────────────────
  if (text === '❌ Cancelar') {
    await clearConfirmacion(supabase, chatId)
    await sendTelegramMessage(chatId, `Cancelado. No se hizo ningún cambio.`, await tecladoSegunEstado())
    return NextResponse.json({ ok: true })
  }

  // ── "Tengo una duda": menú de un toque con respuestas automáticas; una persona entra solo si no se resuelve ──────────
  if ((isCallback && text === 'duda') || text === '🙋 Tengo una duda') {
    if (!compita) return NextResponse.json({ ok: true })
    await sendTelegramMessage(chatId, `🙋 <b>¿En qué te ayudamos?</b>\n\nElige lo que te pasa y te respondemos al instante:`, menuDudas())
    return NextResponse.json({ ok: true })
  }
  if (isCallback && text.startsWith('d:')) {
    const tipo = text.slice(2)
    if (!compita || !esTipoDuda(tipo)) return NextResponse.json({ ok: true })
    const r = await responderDuda(tipo, { id: compita.id, nombre: compita.nombre })
    if (tipo === 'otra') await supabase.from('telegram_estados').upsert({ chat_id: `duda:${chatId}`, pendiente_accion: 'duda_texto:', pendiente_expira: new Date(Date.now() + 30 * 60_000).toISOString(), registro_pendiente: false }, { onConflict: 'chat_id' })
    await sendTelegramMessage(chatId, r.texto, r.teclado ?? await tecladoSegunEstado())
    return NextResponse.json({ ok: true })
  }
  if (isCallback && text.startsWith('dr:')) {
    const [, res, tipo] = text.split(':')
    if (!compita || !esTipoDuda(tipo) || (res !== 'ok' && res !== 'no')) return NextResponse.json({ ok: true })
    if (res === 'ok') { await dudaResuelta(tipo, { id: compita.id, nombre: compita.nombre }); await sendTelegramMessage(chatId, `✅ Me alegra. Si te surge otra cosa, toca 🙋 Tengo una duda.`, await tecladoSegunEstado()) }
    else { const r = await dudaNoResuelta(tipo, { id: compita.id, nombre: compita.nombre }); await sendTelegramMessage(chatId, r.texto, r.teclado ?? await tecladoSegunEstado()) }
    return NextResponse.json({ ok: true })
  }
  // ── Reportar un problema con un cliente (motivo de un toque) y, si quiere, no volver con él ──────────────────────────
  if (isCallback && text === 'xp') {
    if (!compita) return NextResponse.json({ ok: true })
    const lista = await clientesReportables(compita.id)
    if (lista.length === 0) { await sendTelegramMessage(chatId, `Todavía no has tenido trato con ningún cliente, así que no hay a quién reportar. Si algo no está bien, toca 🙋 Tengo una duda y elige "Algo no está bien".`, await tecladoSegunEstado()); return NextResponse.json({ ok: true }) }
    await sendTelegramMessage(chatId, `🚩 <b>¿Con qué cliente tuviste el problema?</b>`, makeInlineKeyboard(lista.map((c) => [{ text: c.nombre, callback_data: `xp1:${c.id}` }])))
    return NextResponse.json({ ok: true })
  }
  if (isCallback && text.startsWith('xp1:')) {
    const uid = text.slice(4)
    if (!compita || !(await clientesReportables(compita.id)).some((c) => c.id === uid)) return NextResponse.json({ ok: true })
    await sendTelegramMessage(chatId, `¿Qué pasó?`, makeInlineKeyboard((Object.keys(MOTIVOS_REPORTE) as MotivoReporte[]).map((m) => [{ text: MOTIVOS_REPORTE[m], callback_data: `xpm:${uid}:${m}` }])))
    return NextResponse.json({ ok: true })
  }
  // ── Confirmar o rechazar la hora que el cliente eligió para la visita ─────────────────────────────────────────
  if (isCallback && text.startsWith('cita:')) {
    const [, accion, visitaId, version] = text.split(':')
    if (!compita || (accion !== 'ok' && accion !== 'no') || !visitaId) return NextResponse.json({ ok: true })
    const r = accion === 'ok' ? await confirmarCita(visitaId, compita.id, version ?? '') : await rechazarCita(visitaId, compita.id, version ?? '')
    await sendTelegramMessage(chatId, r === 'ok'
      ? (accion === 'ok' ? `✅ Cita confirmada. Te mandamos la dirección 3 horas antes y un recordatorio.` : `Anotado ✓ Le avisamos al cliente para que elija otra hora. Gracias por avisar.`)
      : r === 'cambio' ? `Esa propuesta ya cambió: el cliente eligió otra hora. Revisa el mensaje más reciente.`
      : r === 'choque' ? `Ya tienes otra visita a esa hora, así que no se puede confirmar. Toca "No puedo a esa hora" y el cliente elige otra.`
      : `Esa propuesta ya no está pendiente.`, await tecladoSegunEstado())
    return NextResponse.json({ ok: true })
  }
  // Preguntas de un toque después del motivo. Todo el estado viaja en el botón: xpm:<cliente>:<motivo> → xpw:…:<cuándo> → xpb:…:<bien> → xpr:…:<antes> → xpn:…:<no volver> → (si es leve) xpv
  const CODIGO_CUANDO: Record<Cuando, string> = { durante: 'd', llegada: 'l', despues: 'p' }
  const pasoReporte = (p: string[]): boolean => !!compita && esMotivoReporte(p[1]) && p[0].length === 36
  if (isCallback && text.startsWith('xpm:')) {
    const [, uid, motivo] = text.split(':')
    if (!pasoReporte([uid, motivo])) return NextResponse.json({ ok: true })
    await sendTelegramMessage(chatId, `¿Cuándo pasó?`, makeInlineKeyboard((Object.keys(CUANDO) as Cuando[]).map((k) => [{ text: CUANDO[k], callback_data: `xpw:${uid}:${motivo}:${CODIGO_CUANDO[k]}` }])))
    return NextResponse.json({ ok: true })
  }
  if (isCallback && text.startsWith('xpw:')) {
    const [, uid, motivo, cw] = text.split(':')
    if (!pasoReporte([uid, motivo]) || !['d', 'l', 'p'].includes(cw)) return NextResponse.json({ ok: true })
    await sendTelegramMessage(chatId, `¿Estás bien ahora?`, makeInlineKeyboard([[{ text: '✅ Sí, estoy bien', callback_data: `xpb:${uid}:${motivo}:${cw}:s` }], [{ text: '🆘 Necesito ayuda', callback_data: `xpb:${uid}:${motivo}:${cw}:n` }]]))
    return NextResponse.json({ ok: true })
  }
  if (isCallback && text.startsWith('xpb:')) {
    const [, uid, motivo, cw, bien] = text.split(':')
    if (!pasoReporte([uid, motivo]) || (bien !== 's' && bien !== 'n')) return NextResponse.json({ ok: true })
    if (bien === 'n') await sendTelegramMessage(chatId, `Si estás en peligro ahora mismo, toca 🚨 Emergencia o 🛡️ No me siento seguro. Seguimos con el reporte y el equipo te llamará.`)
    await sendTelegramMessage(chatId, `¿Ya te había pasado esto con este cliente?`, makeInlineKeyboard([[{ text: 'Sí, ya había pasado', callback_data: `xpr:${uid}:${motivo}:${cw}:${bien}:s` }], [{ text: 'No, es la primera vez', callback_data: `xpr:${uid}:${motivo}:${cw}:${bien}:n` }]]))
    return NextResponse.json({ ok: true })
  }
  if (isCallback && text.startsWith('xpr:')) {
    const [, uid, motivo, cw, bien, rep] = text.split(':')
    if (!pasoReporte([uid, motivo]) || (rep !== 's' && rep !== 'n')) return NextResponse.json({ ok: true })
    await sendTelegramMessage(chatId, `¿Quieres <b>no volver a trabajar</b> con este cliente? Si dices que sí, Compaz no te lo asignará más.`, makeInlineKeyboard([[{ text: '🚫 Sí, no volver con él', callback_data: `xpn:${uid}:${motivo}:${cw}:${bien}:${rep}:s` }], [{ text: 'No, solo avisar al equipo', callback_data: `xpn:${uid}:${motivo}:${cw}:${bien}:${rep}:n` }]]))
    return NextResponse.json({ ok: true })
  }
  if (isCallback && text.startsWith('xpn:')) {
    const [, uid, motivo, cw, bien, rep, nv] = text.split(':')
    if (!pasoReporte([uid, motivo]) || (nv !== 's' && nv !== 'n')) return NextResponse.json({ ok: true })
    // Los motivos de riesgo y el "necesito ayuda" siempre llevan llamada; en los leves se le pregunta.
    if (MOTIVOS_DE_RIESGO.includes(motivo as MotivoReporte) || bien === 'n') { await cerrarReporte(uid, motivo, cw, bien, rep, nv, 's'); return NextResponse.json({ ok: true }) }
    await sendTelegramMessage(chatId, `¿Quieres que el equipo te llame para hablar de lo que pasó?`, makeInlineKeyboard([[{ text: '📞 Sí, llámenme', callback_data: `xpv:${uid}:${motivo}:${cw}:${bien}:${rep}:${nv}:s` }], [{ text: 'No hace falta', callback_data: `xpv:${uid}:${motivo}:${cw}:${bien}:${rep}:${nv}:n` }]]))
    return NextResponse.json({ ok: true })
  }
  if (isCallback && text.startsWith('xpv:')) {
    const [, uid, motivo, cw, bien, rep, nv, ll] = text.split(':')
    if (!pasoReporte([uid, motivo]) || (ll !== 's' && ll !== 'n')) return NextResponse.json({ ok: true })
    await cerrarReporte(uid, motivo, cw, bien, rep, nv, ll)
    return NextResponse.json({ ok: true })
  }
  async function cerrarReporte(uid: string, motivo: string, cw: string, bien: string, rep: string, nv: string, ll: string) {
    if (!compita) return
    const r = await reportarCliente({ id: compita.id, nombre: compita.nombre }, uid, { motivo, cuando: ({ d: 'durante', l: 'llegada', p: 'despues' } as Record<string, string>)[cw], estaBien: bien === 's', reincidente: rep === 's', noVolver: nv === 's', llamar: ll === 's' })
    const horas = Number((await getAjustes()).reporte_llamada_horas)
    await sendTelegramMessage(chatId, r.resultado === 'ok'
      ? `✅ Gracias, ya avisamos al equipo.${nv === 's' ? ' No se te volverá a asignar este cliente.' : ''}${r.llamar ? ` 📞 Te llamaremos en las próximas ${horas} horas.` : ''}`
      : `No pude registrar el reporte. Toca 🙋 Tengo una duda y elige "Algo no está bien" para avisar al equipo.`, await tecladoSegunEstado())
  }
  // ── "Recordarle al cliente": un toque que manda un correo de Compaz (con límite) ─────────────────────────────────
  if (isCallback && text.startsWith('rc:')) {
    const [, tipo, id] = text.split(':')
    if (!compita || !esTipoRecordatorio(tipo) || !id) return NextResponse.json({ ok: true })
    const r = await recordarAlCliente({ tipo, id, compita: { id: compita.id, nombre: compita.nombre } })
    await sendTelegramMessage(chatId, r.ok ? `🔔 Listo. Le recordamos al cliente por correo desde Compaz. Te avisamos si responde.`
      : r.motivo === 'no_aplica' ? `Ese paso ya no está pendiente.`
      : esperaTelegram(r.espera), await tecladoSegunEstado())
    return NextResponse.json({ ok: true })
  }
  // Texto de "Otra duda": pasa directo a una persona del equipo (no hay respuesta automática posible)
  if (!isCallback && text && !text.startsWith('/') && !message.photo) {
    const { data: esperandoDuda } = await supabase.from('telegram_estados').delete().eq('chat_id', `duda:${chatId}`).select('pendiente_expira').maybeSingle()
    if (esperandoDuda?.pendiente_expira && new Date(esperandoDuda.pendiente_expira).getTime() > Date.now() && compita) {
      await dudaConTexto({ id: compita.id, nombre: compita.nombre }, text)
      await sendTelegramMessage(chatId, `✅ Recibimos tu duda. Un miembro del equipo te responderá por aquí, por Telegram, lo antes posible.`, await tecladoSegunEstado())
      return NextResponse.json({ ok: true })
    }
  }

  // ── "¿Qué me toca?": la situación REAL del compita ahora mismo (se calcula al preguntar; no se guarda nada) ─────────
  if ((isCallback && text === 'qmt') || text === '❓ ¿Qué me toca?') {
    if (!compita) return NextResponse.json({ ok: true })
    const sit = await situacionDelCompita(compita.id, new Date(), chatId)
    // Cada consulta es un dato para el equipo: qué situación se explicó, y si el compita parece atascado se abre "Duda sin resolver".
    const { atascado } = await registrarConsultaQueMeToca({ id: compita.id, nombre: compita.nombre }, sit).catch((e) => { console.error('[qmt] no se pudo registrar:', e); return { atascado: false } })
    await sendTelegramMessage(chatId, atascado ? `${sit.texto}\n\n🙋 <i>Parece que sigues con esto. Ya avisamos al equipo y te escribirán por aquí, por Telegram.</i>` : sit.texto, sit.teclado ?? await tecladoSegunEstado())
    return NextResponse.json({ ok: true })
  }

  // ── "No me siento seguro": interrumpe la visita sin penalización. Nunca pide confirmar: la prioridad es poder salir ──
  if ((isCallback && text === 'seguro') || text === '🛡️ No me siento seguro') {
    if (!compita) return NextResponse.json({ ok: true })
    const r = await salidaPorSeguridad({ id: compita.id, nombre: compita.nombre })
    await sendTelegramMessage(chatId, [
      `🛡️ <b>Entendido. Tu seguridad es lo primero.</b>`, ``,
      `Sal del lugar cuando puedas. ${r.hayVisita ? 'La visita quedó interrumpida y no tendrás ninguna penalización.' : ''}`,
      `Ya avisamos al equipo de Compaz con urgencia y te contactará enseguida.`, ``,
      `Si estás en peligro inmediato, llama al <b>911</b>.`,
    ].join('\n'), TECLADO_SIN_VISITA)
    return NextResponse.json({ ok: true })
  }

  // ── "¿Todo bien?": respuesta del compita tras la hora de fin ──────────────────────────────────────────────────
  if (isCallback && text.startsWith('tb:')) {
    const [, accion, visitaId] = text.split(':')
    if (!compita || !visitaId || (accion !== 'ok' && accion !== 'ayuda')) return NextResponse.json({ ok: true })
    const r = await responderTodoBien(visitaId, { id: compita.id, nombre: compita.nombre }, accion)
    await sendTelegramMessage(chatId, r === 'no_aplica'
      ? `Esa visita ya no está abierta.`
      : accion === 'ok' ? `✅ Gracias por avisar. Cuando termines, toca 🔴 Terminar visita.` : `🆘 Ya avisamos al equipo con urgencia. Te contactarán de inmediato. Si estás en peligro, llama al <b>911</b>.`, TECLADO_DURANTE_VISITA)
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Emergencia ────────────────────────────────────────────────────────
  if ((isCallback && text === 'emergencia') || text === '🚨 Emergencia') {
    const { data: visitaEmergencia } = await supabase
      .from('visitas')
      .select('id, usuario:usuarios(nombre, email, zona, familiar_nombre, familiar_condicion)')
      .eq('compita_id', compita.id)
      .in('estado', ['en_curso', 'confirmando_inicio'])
      .order('inicio', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { id: string; usuario: { nombre: string; email: string; zona: string | null; familiar_nombre: string | null; familiar_condicion: string | null } | null } | null }

    const u = visitaEmergencia?.usuario
    const infoCliente = u
      ? [
          `<b>Cliente:</b> ${esc(u.nombre)} (${esc(u.email)})`,
          u.zona ? `<b>Zona:</b> ${esc(u.zona)}` : null,
          u.familiar_nombre ? `<b>Familiar:</b> ${esc(u.familiar_nombre)}` : null,
          u.familiar_condicion ? `<b>Condición:</b> ${esc(u.familiar_condicion)}` : null,
        ].filter(Boolean).join('\n')
      : 'No hay visita activa registrada.'

    const aviso = [`🚨 <b>EMERGENCIA</b>`, ``, `<b>${esc(compita.nombre)}</b> activó el botón de emergencia durante una visita.`, ``, infoCliente, ``, `Contáctalos de inmediato.`].join('\n')

    // Telegram + email siempre (en paralelo); insertar flag visible en el dashboard admin
    const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean)
    const [telegramOk, emailOk] = await Promise.allSettled([
      alertaAdmin('urgente', aviso, { critica: true, sinTarea: true, categoria: 'emergencia', entidad: { tipo: 'compita', id: compita.id, nombre: compita.nombre } }),
      admins.length
        ? sendEmail({
            to: admins,
            subject: '🚨 EMERGENCIA en una visita de Compaz',
            html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#FEF2F2;border:2px solid #dc2626;border-radius:16px">
              <h2 style="color:#991b1b;font-size:22px;margin:0 0 12px">🚨 EMERGENCIA</h2>
              <p style="color:#7f1d1d;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(aviso.replace(/<[^>]+>/g, ''))}</p>
            </div>`,
          })
        : Promise.resolve(),
      // Flag en la DB para el dashboard en tiempo real
      supabase.from('admin_flags').insert({
        entidad_tipo: 'visita',
        entidad_id: visitaEmergencia?.id ?? 'sin-visita',
        entidad_nombre: `🚨 EMERGENCIA — ${compita.nombre}`,
        nota: aviso.replace(/<[^>]+>/g, ''),
        reportado_por: 'sistema',
        resuelto: false,
      }),
    ])
    const notificado = (telegramOk.status === 'fulfilled' && telegramOk.value === true)
      || (emailOk.status === 'fulfilled')

    await sendTelegramMessage(
      chatId,
      notificado
        ? `🚨 <b>Alerta enviada.</b>\n\nEl equipo de Compaz fue notificado ahora mismo y te contactará de inmediato.\n\nSi hay peligro inmediato, llama al <b>911</b>.`
        : `⚠️ <b>No pudimos avisar al equipo.</b>\n\nLlama ahora al <b>911</b> y escribe a hola@micompaz.com. Intenta tocar el botón de nuevo en unos segundos.`,
      TECLADO_DURANTE_VISITA,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Reagendar visita ──────────────────────────────────────────────────
  if (isCallback && text === 'reagendar_visita') {
    const objetivo = await visitaObjetivo(supabase, compita.id)
    if (!objetivo) {
      await sendTelegramMessage(chatId, `No encontré ninguna visita activa para reagendar.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }

    const fechaAnterior = objetivo.fecha_programada ? formatFechaVE(objetivo.fecha_programada) : null
    const { data: reseteada, error: errReset } = await supabase
      .from('visitas')
      .update({ estado: 'pre_visita', fecha_programada: null })
      .eq('id', objetivo.id)
      .in('estado', ['pre_visita', 'programada'])
      .select('id')
      .maybeSingle()
    if (errReset || !reseteada) {
      console.error('Error reagendando visita:', errReset)
      await sendTelegramMessage(chatId, `No pudimos reagendar la visita. Intenta de nuevo en un momento.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }

    // Cancelación del compita: se reprograma sin costo para el cliente, y SE REGISTRA (patrones, semáforo, pausa).
    await registrarCancelacion({
      visitaId: objetivo.id, compitaId: compita.id, usuarioId: objetivo.usuario_id, canceladoPor: 'compita',
      fechaProgramada: objetivo.fecha_programada, horaInicioProgramada: objetivo.hora_inicio_programada,
    })
    const avisoHoras = horasDeAviso(objetivo.fecha_programada, objetivo.hora_inicio_programada)
    const minimoCompita = Number((await getAjustes()).compita_aviso_minimo_horas)
    const avisoTardio = avisoHoras !== null && avisoHoras < minimoCompita
    if (avisoTardio) await alertarCancelacionesCompita(compita.id, compita.nombre)

    const clienteNombre = esc(objetivo.usuario?.nombre ?? 'El cliente')
    const clienteEmail = objetivo.usuario?.email
    let emailEnviado = false
    if (clienteEmail) {
      try {
        await sendEmail({
          to: clienteEmail,
          subject: `${compita.nombre} necesita reagendar la visita`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px;margin-bottom:12px">🔄 La visita necesita reagendarse</h2>
              <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
                <strong>${esc(compita.nombre)}</strong> tuvo un imprevisto y necesita cambiar la fecha${fechaAnterior ? ` del <strong>${esc(fechaAnterior)}</strong>` : ''}.
              </p>
              <p style="color:#4A3B6B;font-size:14px;line-height:1.6">
                Entra al dashboard y coordinen juntos una nueva fecha por el chat.
              </p>
              <a href="${SITE_URL_PUBLICA}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:14px;margin-top:8px">
                Ir al chat →
              </a>
              <p style="color:#9990A8;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>
          `,
        })
        emailEnviado = true
      } catch (e) { console.error('Email reagendar compita→cliente:', e) }
    }

    await sendTelegramMessage(
      chatId,
      [
        `🔄 <b>Visita reagendada</b>`,
        ``,
        emailEnviado
          ? `Le avisamos a <b>${clienteNombre}</b> que necesitas cambiar la fecha${fechaAnterior ? ` del ${esc(fechaAnterior)}` : ''}.`
          : `Registramos el cambio de fecha${fechaAnterior ? ` del ${esc(fechaAnterior)}` : ''}, pero no pudimos enviar el correo a <b>${clienteNombre}</b>. Escríbele desde este chat para avisarle.`,
        ``,
        `Escríbele desde este mismo chat para acordar un nuevo día. Ellos lo verán en su portal.`,
        ...(avisoTardio ? [``, `⚠️ Avisaste con menos de ${minimoCompita} horas de anticipación. Queda registrado: varias veces seguidas puede pausar tus solicitudes nuevas.`] : []),
      ].join('\n'),
      TECLADO_SIN_VISITA,
    )

    // Alerta al admin si esta visita acumula 3+ reagendados
    try {
      const { count: totalReagendados } = await supabase
        .from('mensajes').select('id', { count: 'exact', head: true })
        .eq('visit_id', objetivo.id).eq('origen', 'admin').like('contenido', 'reagendado:%')
      const nuevo = (totalReagendados ?? 0) + 1
      await supabase.from('mensajes').insert({ visit_id: objetivo.id, origen: 'admin', tipo: 'texto', contenido: `reagendado:compita` })
      if (nuevo >= 3) {
        await alertaAdmin('tarea', [`⚠️ <b>Visita con ${nuevo} reagendados</b>`, ``, `<b>Cliente:</b> ${clienteNombre}`, `<b>Compita:</b> ${esc(compita.nombre)}`, `<b>Iniciador:</b> compita`, ``, `Puede indicar un problema de coordinación. Considera intervenir.`].join('\n'))
      }
    } catch (e) { console.error('Alerta reagendados admin (compita):', e) }

    return NextResponse.json({ ok: true })
  }

  // ── Solicitud directa o mandado: aceptar (sin horario) ───────────────────────
  if (isCallback && text.startsWith('directa:')) {
    const token = text.slice('directa:'.length)
    const r = await aceptarSolicitudDirecta(token, compita.id)
    if (!r.ok) {
      await sendTelegramMessage(chatId, r.motivo === 'no_autorizada' ? `Esta solicitud no es tuya.` : `Este enlace ya fue usado o no existe.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }
    const sol = r.solicitud
    // Entrevista del formulario nuevo: el cliente elige una hora libre del compita (no paga todavía).
    if (r.tipo === 'entrevista') {
      await notificar({
        plantilla: 'entrevista_aceptada', canal: 'correo', destinatario: { tipo: 'cliente', id: sol.cliente_id },
        variables: { solicitudId: sol.id }, entidad: 'solicitud', entidadId: sol.id, paso: 6,
      })
      await sendTelegramMessage(chatId, `✅ <b>Aceptaste hablar con este cliente</b>\n\nAhora elige una de tus horas libres y te pedirá que la confirmes. Te avisamos apenas elija.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }
    // El cliente recibe el correo con el paso que le falta (pagar). Registrado en `avisos`: si falla, la escalera reintenta.
    await notificar({
      plantilla: 'directa_aceptada', canal: 'correo', destinatario: { tipo: 'cliente', id: sol.cliente_id },
      variables: { solicitudId: sol.id }, entidad: 'solicitud', entidadId: sol.id, paso: 6,
    })
    await sendTelegramMessage(chatId, `✅ <b>Aceptaste</b>\n\nEl cliente paga primero. Te avisamos apenas el pago esté confirmado.`, TECLADO_SIN_VISITA)
    await alertaAdmin('actividad', `🤝 <b>${esc(compita.nombre)}</b> aceptó una contratación directa. Esperando el pago del cliente.`)
    return NextResponse.json({ ok: true })
  }

  // ── "Llegué y nadie abre": empieza la cuenta atrás ────────────────────────────────────────────────────────────
  if (isCallback && text.startsWith('nadie:')) {
    const visitaId = text.slice('nadie:'.length)
    if (!compita || !visitaId) return NextResponse.json({ ok: true })
    const r = await declararNadieAbre(visitaId, compita.id)
    if (!r.ok) {
      await sendTelegramMessage(chatId, r.motivo === 'sin_llegada' ? `Primero envía la foto de llegada (toca ▶️ Iniciar visita).` : `Esa visita ya no está programada.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }
    await sendTelegramMessage(chatId, [
      `🚪 <b>Anotado: nadie abre</b>`, ``,
      `Espera cerca. Ya le avisamos al cliente y, a los 5 y 15 minutos, el equipo de Compaz intenta comunicarse con el contacto en el sitio y con el cliente.`,
      `Tu tiempo se paga: si pasan ${r.espera} minutos sin que nadie abra, podrás cerrar la visita desde aquí (se cuenta como usada y cobras el viaje).`,
      `Si el cliente aparece antes, toca ▶️ Iniciar visita.`,
    ].join('\n'), TECLADO_INICIO)
    return NextResponse.json({ ok: true })
  }

  // ── Cerrar la visita sin acceso (pasaron los 30 minutos) ──────────────────────────────────────────────────────
  if (isCallback && text.startsWith('sinacceso:')) {
    const visitaId = text.slice('sinacceso:'.length)
    if (!compita || !visitaId) return NextResponse.json({ ok: true })
    const r = await cerrarSinAcceso(visitaId, compita.id)
    if (!r.ok) {
      await sendTelegramMessage(chatId, r.motivo === 'aun_no' ? `Todavía faltan ${r.faltan} minutos para poder cerrarla. Espera cerca.` : r.motivo === 'sin_cuenta' ? `Primero reporta que nadie abre.` : `Esa visita ya no está programada.`, TECLADO_INICIO)
      return NextResponse.json({ ok: true })
    }
    await sendTelegramMessage(chatId, `✅ <b>Visita cerrada sin acceso.</b>\n\nTu tiempo quedó registrado y se cuenta como usada para el cliente. Gracias por esperar.`, TECLADO_SIN_VISITA)
    return NextResponse.json({ ok: true })
  }

  // ── "Voy en camino": el compita avisa que salió hacia la visita ───────────────────────────────────────────────
  if (isCallback && text.startsWith('camino:')) {
    const visitaId = text.slice('camino:'.length)
    if (!compita || !visitaId) return NextResponse.json({ ok: true })
    const { data: vis } = await supabase.from('visitas').select('id, usuario_id, estado').eq('id', visitaId).eq('compita_id', compita.id).maybeSingle()
    if (!vis || vis.estado !== 'programada') {
      await sendTelegramMessage(chatId, `Esta visita ya no está programada.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }
    await registrarEvento({ entidad: 'visita', entidadId: visitaId, tipo: 'compita_en_camino', actor: `compita:${compita.id}` })
    await notificar({
      plantilla: 'compita_en_camino', canal: 'correo', destinatario: { tipo: 'cliente', id: vis.usuario_id as string },
      variables: { visitaId }, entidad: 'visita', entidadId: visitaId, paso: 11, claveUnica: `compita_en_camino:${visitaId}`,
    })
    await sendTelegramMessage(chatId, `🚗 Gracias. Le avisamos al cliente que vas en camino. Cuando llegues, toca el botón ▶️ de tu teclado.`, TECLADO_INICIO)
    return NextResponse.json({ ok: true })
  }

  // ── Cambio de quién estará en el lugar: el compita sigue o prefiere no ir (sin penalización) ──────────────────
  if (isCallback && text.startsWith('lugar:')) {
    const [, accion, cambioId] = text.split(':')
    if (!compita || !cambioId || (accion !== 'ok' && accion !== 'no')) return NextResponse.json({ ok: true })
    const r = await responderCambioLugar(cambioId, compita.id, accion === 'ok' ? 'sigue' : 'no_va')
    if (!r.ok) {
      await sendTelegramMessage(chatId, r.motivo === 'no_encontrado' ? `Este cambio no es tuyo o ya no existe.` : `Ya respondiste a este cambio.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }
    await sendTelegramMessage(chatId, accion === 'ok'
      ? `✅ Perfecto. Seguimos con la visita y le avisamos al cliente.`
      : `Entendido. Tu seguridad primero: no habrá ninguna penalización. Le avisamos al cliente y la visita vuelve a coordinación.`, TECLADO_SIN_VISITA)
    if (accion === 'no') await alertaAdmin('actividad', `🚫 <b>${esc(compita.nombre)}</b> prefirió no ir a una visita por un cambio de personas en el lugar. Sin penalización; el cliente elegirá otro horario o compita sin costo.`)
    return NextResponse.json({ ok: true })
  }

  // ── Reserva de horario: el compita confirma la hora o dice que no puede ──────────────────────────────
  if (isCallback && text.startsWith('reserva:')) {
    const [, accion, reservaId] = text.split(':')
    if (!compita || !reservaId || (accion !== 'ok' && accion !== 'no')) return NextResponse.json({ ok: true })
    const r = accion === 'ok' ? await confirmarReserva(reservaId, compita.id) : await rechazarReserva(reservaId, compita.id)
    if (!r.ok) {
      await sendTelegramMessage(chatId, r.motivo === 'vencida' ? `Esa hora ya se liberó porque no se confirmó a tiempo. El cliente elegirá otra.` : r.motivo === 'no_encontrada' ? `Esta reserva no es tuya o no existe.` : `Esta reserva ya fue respondida.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }
    const reserva = r.reserva
    if (accion === 'no') {
      await notificar({
        plantilla: 'reserva_rechazada', canal: 'correo', destinatario: { tipo: 'cliente', id: reserva.cliente_id },
        variables: { solicitudId: reserva.solicitud_id ?? '' }, entidad: 'solicitud', entidadId: reserva.solicitud_id ?? reserva.id, paso: 7,
        claveUnica: `reserva_rechazada:${reserva.id}`, // una por reserva: puede rechazar varias horas de la misma solicitud
      })
      await sendTelegramMessage(chatId, `Listo. Esa hora quedó libre y le avisamos al cliente para que elija otra.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }
    // Confirmada: la solicitud queda con su hora y todo lo demás (correo, aviso, recordatorios) sigue igual que antes.
    const { data: act } = await supabase.from('solicitudes')
      .update({ slot_confirmado: reserva.inicio }).eq('id', reserva.solicitud_id ?? '').eq('estado', 'aceptada').is('slot_confirmado', null)
      .select('id').maybeSingle()
    if (!act || !reserva.solicitud_id) {
      await sendTelegramMessage(chatId, `Confirmaste la hora, pero esa solicitud ya no está activa. Avísanos si hace falta.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }
    const sol = await getSolicitudPorId(reserva.solicitud_id)
    if (sol) await anunciarEntrevistaConfirmada({ solicitud: sol, compita, chatId })
    return NextResponse.json({ ok: true })
  }

  // ── Solicitud: aceptar slot ──────────────────────────────────────────────────
  if (isCallback && text.startsWith('slot:')) {
    const partes = text.split(':')
    const slotIndex = parseInt(partes[1], 10)
    const token = partes.slice(2).join(':')

    const r = await responderSolicitud(token, slotIndex, compita.id)
    if (!r.ok) {
      await sendTelegramMessage(
        chatId,
        r.motivo === 'slot_pasado'
          ? `Ese horario ya pasó o está por empezar. Pídele al cliente que proponga nuevos horarios o usa otra opción.`
          : r.motivo === 'no_autorizada'
            ? `Esta solicitud no es tuya.`
            : `Este enlace ya fue usado o no existe.`,
        TECLADO_SIN_VISITA,
      )
      return NextResponse.json({ ok: true })
    }
    const solicitud = r.solicitud

    await anunciarEntrevistaConfirmada({ solicitud, compita, chatId })
    return NextResponse.json({ ok: true })
  }

  // ── Solicitud: rechazar ──────────────────────────────────────────────────────
  if (isCallback && text.startsWith('rechazar:')) {
    const token = text.slice('rechazar:'.length)
    const r = await responderSolicitud(token, -1, compita.id)
    if (!r.ok) {
      await sendTelegramMessage(chatId, `Este enlace ya fue usado o no existe.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }
    const solicitud = r.solicitud

    await alertaAdmin('actividad', `❌ <b>${esc(compita.nombre)}</b> rechazó una solicitud de entrevista.`)

    const adminSupa = createAdminSupabase()
    const { data: clienteRechazado } = await adminSupa
      .from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()
    const clienteEmail = clienteRechazado?.email ?? ''
    const clienteNombre = clienteRechazado?.nombre ?? 'el cliente'
    const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await setEstado(supabase, chatId, {
      pendiente_accion: `sugerir_horarios:${solicitud.id}:${clienteEmail}:${clienteNombre}`,
      pendiente_expira: expira,
    })

    await sendTelegramMessage(
      chatId,
      `Entendido. ¿Puedes sugerir otros horarios que sí te funcionen?\n\n✍️ <b>Responde a este mensaje</b> con los horarios y se los haremos llegar a ${esc(clienteNombre)} por email.\n\n📅 <i>Incluye el día y la hora exacta de cada opción. Por ejemplo: lunes 6 de octubre a las 3:00pm.</i>`,
    )
    // Motivo opcional, de un toque (dato para mejorar las solicitudes que le llegan)
    await sendTelegramMessage(
      chatId,
      `Si quieres, cuéntanos por qué no pudiste (un toque). Nos ayuda a enviarte solicitudes que sí te encajen.`,
      makeInlineKeyboard(MOTIVOS.compita.map((m) => [{ text: m.texto, callback_data: `motivo:${token}:${m.id}` }])),
    )
    return NextResponse.json({ ok: true })
  }

  // ── Solicitud: motivo del rechazo (botón de un toque) ────────────────────────
  if (isCallback && text.startsWith('motivo:')) {
    const [, tokenMotivo, codigo] = text.split(':')
    const sol = tokenMotivo ? await getSolicitudPorToken(tokenMotivo) : null
    if (!sol || sol.compita_id !== compita.id || sol.estado !== 'rechazada') {
      await sendTelegramMessage(chatId, `Este enlace ya no está disponible.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }
    const r = await registrarMotivo({ solicitudId: sol.id, rol: 'compita', actorId: compita.id, motivo: codigo ?? '' })
    await sendTelegramMessage(chatId, r === 'invalido' ? `No pudimos anotarlo. Intenta de nuevo.` : `Gracias, lo anotamos. 💙`)
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Confirmar (iniciar o terminar) ────────────────────────────────────
  if (text === '✅ Sí, iniciar' || text === '✅ Sí, terminar') {
    const esperada = text === '✅ Sí, iniciar' ? 'iniciar' : 'terminar'
    const conf = await takeConfirmacion(supabase, chatId, esperada)
    if (!conf) {
      await sendTelegramMessage(chatId, `El tiempo para confirmar expiró o ya se procesó. Si hace falta, intenta de nuevo.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }

    // ── Confirmar inicio ───────────────────────────────────────────────────────
    if (conf.accion === 'iniciar') {
      // Aunque llegue por otro camino (un teclado viejo), sin la foto de llegada no se inicia.
      if (await llegadaConFotoObligatoria()) {
        const { data: sinLlegada } = await supabase.from('visitas').select('llegada_en').eq('id', conf.visitaId).eq('compita_id', compita.id).maybeSingle()
        if (sinLlegada && !sinLlegada.llegada_en) { await pedirFotoLlegada(supabase, chatId, conf.visitaId); return NextResponse.json({ ok: true }) }
      }
      // Pasa a confirmando_inicio: el cliente debe confirmar en el dashboard (max 5 min).
      const { data: visita, error: errInicio } = await supabase
        .from('visitas')
        .update({ estado: 'confirmando_inicio', confirmando_inicio_en: new Date().toISOString() })
        .eq('id', conf.visitaId)
        .eq('compita_id', compita.id)
        .in('estado', ['programada', 'pre_visita'])
        .not('fecha_programada', 'is', null)
        .select('*, usuario:usuarios(*)')
        .maybeSingle() as { data: (Visita & { usuario: Usuario | null }) | null; error: { code?: string } | null }

      if (errInicio || !visita || !visita.usuario) {
        console.error('Error iniciando visita:', errInicio)
        await sendTelegramMessage(
          chatId,
          errInicio?.code === '23505'
            ? `Ya tienes una visita en curso. Termínala antes de iniciar otra.`
            : `No pudimos iniciar la visita (puede que la fecha ya no esté confirmada). Intenta de nuevo o escríbenos a hola@micompaz.com.`,
          TECLADO_SIN_VISITA,
        )
        return NextResponse.json({ ok: true })
      }

      // Avisar al cliente por correo que el compita llegó y está esperando su confirmación.
      if (visita.usuario.email) {
        const nombreCorto = esc(compita.nombre.split(' ')[0])
        sendEmail({
          to: visita.usuario.email,
          subject: `${compita.nombre} ya llegó — confirma el inicio`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">¡${nombreCorto} ya llegó! 👋</h2>
              <p style="color:#4A3B6B;font-size:15px;line-height:1.6"><strong>${esc(compita.nombre)}</strong> está lista para empezar la visita. Entra al dashboard y confirma el inicio.</p>
              <a href="${SITE_URL_PUBLICA}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px;margin-top:8px">Confirmar inicio →</a>
              <p style="color:#9990A8;font-size:13px;margin-top:24px">Si no confirmas en 5 minutos, la visita arranca sola.</p>
              <p style="color:#9990A8;font-size:13px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>`,
        }).catch(e => console.error('[telegram-webhook] email confirmando_inicio cliente:', e))
      }

      await sendTelegramMessage(
        chatId,
        `⏳ <b>Esperando confirmación del cliente</b>\n\nLe avisamos a <b>${esc(visita.usuario.nombre)}</b> que llegaste. En cuanto confirme, la visita arranca.\n\nSi no confirma en 5 minutos, la visita se inicia sola.`,
      )
    }

    // ── Confirmar fin ─────────────────────────────────────────────────────────
    if (conf.accion === 'terminar') {
      const fin = new Date().toISOString()
      const { data: visita, error: errFin } = await supabase
        .from('visitas')
        .update({ estado: 'terminada', fin, room_url: null })
        .eq('id', conf.visitaId)
        .eq('compita_id', compita.id)
        .eq('estado', 'en_curso')
        .select('*, usuario:usuarios(*)')
        .maybeSingle() as { data: (Visita & { usuario: Usuario | null }) | null; error: unknown }

      if (errFin || !visita) {
        await sendTelegramMessage(chatId, `No hay ninguna visita en curso que puedas terminar ahora mismo.\n\nSi crees que es un error, escríbenos a hola@micompaz.com.`, TECLADO_SIN_VISITA)
        return NextResponse.json({ ok: true })
      }

      // Contador: lectura fresca (la copia de `compita` puede estar desactualizada).
      try {
        const { data: fresca } = await supabase.from('compitas').select('visitas_realizadas').eq('id', compita.id).single()
        await supabase.from('compitas').update({ visitas_realizadas: (fresca?.visitas_realizadas ?? 0) + 1 }).eq('id', compita.id)
      } catch (e) {
        console.error('Error actualizando contador de visitas:', e)
      }

      try {
        const duracionMin = Math.round((new Date(fin).getTime() - new Date(visita.inicio ?? fin).getTime()) / 60000)
        const duracion = duracionMin >= 60 ? `${Math.floor(duracionMin / 60)}h ${duracionMin % 60}min` : `${duracionMin} min`
        await alertaAdmin('actividad', `✅ <b>Visita terminada</b>\n\n<b>Compita:</b> ${esc(compita.nombre)}\n<b>Cliente:</b> ${esc(visita.usuario?.nombre ?? '—')}\n<b>Duración:</b> ${duracion}`)
      } catch (e) {
        console.error('Error notificando admin al terminar visita:', e)
      }

      if (visita.usuario) {
        try {
          const { data: mensajes } = await supabase
            .from('mensajes').select('*').eq('visit_id', visita.id).order('created_at', { ascending: true }) as { data: Mensaje[] | null }
          const { count: visitasAnteriores } = await supabase
            .from('visitas').select('id', { count: 'exact', head: true })
            .eq('usuario_id', visita.usuario_id).eq('compita_id', compita.id)
            .eq('estado', 'terminada').neq('id', visita.id)
          await sendVisitaResumen(visita.usuario, compita, { ...visita, fin }, mensajes ?? [], (visitasAnteriores ?? 0) > 0)
        } catch (e) {
          console.error('Error correo básico al terminar:', e)
          await alertaAdmin('actividad', `⚠️ No se pudo enviar el resumen de visita a <b>${esc(visita.usuario.nombre)}</b> (${esc(visita.usuario.email)}). Reenvíalo manualmente.`)
        }
      }

      await setEstado(supabase, chatId, {
        pendiente_accion: `reporte:${visita.id}:0:`,
        pendiente_expira: new Date(Date.now() + 30 * 60_000).toISOString(),
      })

      await sendTelegramMessage(
        chatId,
        `🔴 <b>Visita terminada.</b>\n\n¡Gracias por tu trabajo de hoy, ${esc(compita.nombre)}! 🤝\n\nYa le enviamos el resumen básico a la familia. Ahora tómate un minuto para registrar cómo estuvo el familiar — ellos lo verán como una actualización. 📋`,
        TECLADO_SIN_VISITA,
      )
      await sendTelegramMessage(
        chatId,
        `1 de 4 — ${PREGUNTAS_REPORTE[0].emoji} <b>${PREGUNTAS_REPORTE[0].label}</b>\n\n${PREGUNTAS_REPORTE[0].texto}\n\n<i>1 = muy bajo, 5 = excelente</i>`,
        makeReporteKeyboard(),
      )
    }

    return NextResponse.json({ ok: true })
  }

  // ── Sugerencia de horarios alternativos tras rechazo ────────────────────────
  const estadoActual = await getEstado(supabase, chatId)
  const accionSugerir = estadoActual?.pendiente_accion
  const esSugerir = accionSugerir?.startsWith('sugerir_horarios:') || accionSugerir?.startsWith('sugerir_r:')
  let capturaSugerencia = false
  if (esSugerir && !isCallback && text && !text.startsWith('/')) {
    // Si la compita tiene visitas activas, solo se captura si responde al mensaje del bot;
    // así un mensaje normal de visita no se filtra por email a otro cliente.
    const { count: activas } = await supabase
      .from('visitas').select('id', { count: 'exact', head: true })
      .eq('compita_id', compita.id).in('estado', ['en_curso', 'pre_visita', 'programada'])
    capturaSugerencia = !!message.reply_to_message || (activas ?? 0) === 0
  }
  if (capturaSugerencia) {
    const prefijo = accionSugerir!.startsWith('sugerir_r:') ? 'sugerir_r:' : 'sugerir_horarios:'
    const partes = accionSugerir!.slice(prefijo.length).split(':')
    // formato: <solicitud_id>:<email>:<nombre> (nombre puede tener espacios pero fue el último segmento)
    const [solicitudId, clienteEmail, ...nombrePartes] = partes
    const clienteNombre = nombrePartes.join(':')
    const expirado = estadoActual?.pendiente_expira ? new Date(estadoActual.pendiente_expira) < new Date() : true

    await clearPendiente(supabase, chatId)

    if (expirado) {
      await sendTelegramMessage(chatId, `El tiempo para sugerir horarios expiró. Contacta al equipo de Compaz si necesitas ayuda.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }

    // El cliente nunca debe recibir teléfonos ni correos del compita: se censuran igual que en el chat.
    const sugerido = detectarContacto(text.slice(0, 2000))
    if (sugerido.detectado) {
      await reportarContactoEnTexto({
        origen: 'compita', donde: 'los horarios sugeridos al cliente', quien: compita.nombre,
        entidadTipo: 'compita', entidadId: compita.id, textoOriginal: text.slice(0, 2000),
      })
    }

    // Guardar el mensaje del compita en la solicitud para mostrarlo en el dashboard
    await supabase
      .from('solicitudes')
      .update({ mensaje_compita_reagendar: sugerido.textoCensurado })
      .eq('id', solicitudId)

    // Enviar email al cliente con los horarios sugeridos
    let emailHorarioEnviado = false
    if (clienteEmail) {
      try {
        await sendEmail({
          to: clienteEmail,
          subject: `${compita.nombre} te propone otros horarios`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">Nuevos horarios disponibles</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                <strong>${esc(compita.nombre)}</strong> no pudo en los horarios que propusiste, pero sugiere lo siguiente:
              </p>
              <blockquote style="background:#F5F0FF;border-left:4px solid #7C4DFF;border-radius:8px;padding:16px 20px;color:#1A0A3C;font-size:16px;line-height:1.6;margin:16px 0">
                ${esc(sugerido.textoCensurado.slice(0, 1500)).replace(/\n/g, '<br>')}
              </blockquote>
              <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
                Si alguno te funciona, haz clic aquí para enviar una nueva solicitud directamente con ${esc(compita.nombre)}:
              </p>
              <a href="${SITE_URL}/compitas?compita=${encodeURIComponent(compita.id)}&reagendar=${encodeURIComponent(solicitudId)}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:4px">
                Agendar con ${esc(compita.nombre)} →
              </a>
              <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>
          `,
        })
        emailHorarioEnviado = true
      } catch (e) { console.error('Email horarios alternativos:', e) }
    }

    if (emailHorarioEnviado) {
      await sendTelegramMessage(
        chatId,
        `✅ Listo. Le enviamos tus horarios a ${esc(clienteNombre || 'el cliente')} por email.\n\nSi acepta, te llegará una nueva solicitud por aquí.`,
      )
    } else {
      await sendTelegramMessage(
        chatId,
        `⚠️ No pudimos enviarle tus horarios al cliente (sin correo registrado o el envío falló). Por favor escríbenos a hola@micompaz.com y lo resolvemos manualmente.`,
        TECLADO_SIN_VISITA,
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── Reanudar cuestionario desde recordatorio ────────────────────────────────
  if (isCallback && text === 'reanudar_reporte') {
    const estadoReanuda = await getEstado(supabase, chatId)
    const accionReanuda = estadoReanuda?.pendiente_accion ?? ''
    if (!accionReanuda.startsWith('reporte:') && !accionReanuda.startsWith('reporte_r:') && !accionReanuda.startsWith('reporte_novedad:')) {
      await sendTelegramMessage(chatId, `Ya no hay un cuestionario pendiente.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }
    // Extender expiración otros 30 min y restaurar prefijo reporte: (si estaba como reporte_r:)
    const accionRestaurada = accionReanuda.replace('reporte_r:', 'reporte:')
    await supabase.from('telegram_estados').update({ pendiente_accion: accionRestaurada, pendiente_expira: new Date(Date.now() + 30 * 60_000).toISOString() }).eq('chat_id', chatId)
    if (accionRestaurada.startsWith('reporte_novedad:')) {
      await sendTelegramMessage(chatId, `📝 <b>¿Hay algo que quieras contarle a la familia?</b>\n\nEscríbelo aquí — puede ser una anécdota, un avance que notaste, algo que le gustó especialmente, o cualquier detalle que creas que les daría paz o alegría.`, QUITAR_TECLADO)
    } else {
      const partes = accionRestaurada.split(':')
      const step = parseInt(partes[2] ?? '0', 10)
      if (step < PREGUNTAS_REPORTE.length) {
        const pregunta = PREGUNTAS_REPORTE[step]
        await sendTelegramMessage(
          chatId,
          `${step + 1} de 4 — ${pregunta.emoji} <b>${pregunta.label}</b>\n\n${pregunta.texto}\n\n<i>1 = muy bajo, 5 = excelente</i>`,
          makeReporteKeyboard(),
        )
      } else {
        await clearPendiente(supabase, chatId)
        await sendTelegramMessage(chatId, `Ya no hay un cuestionario pendiente.`, TECLADO_SIN_VISITA)
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── Respuesta a cuestionario de bienestar (callback rr:value) ───────────────
  if (isCallback && text.startsWith('rr:')) {
    const estadoActualRR = await getEstado(supabase, chatId)
    const accionRaw = estadoActualRR?.pendiente_accion ?? ''
    const accion = accionRaw.replace('reporte_r:', 'reporte:') // normalizar si llegó marcado
    if (!accion.startsWith('reporte:')) {
      await sendTelegramMessage(chatId, `Ya no hay un cuestionario activo.`, TECLADO_SIN_VISITA)
      return NextResponse.json({ ok: true })
    }
    const partes = accion.split(':')
    // formato: reporte:{visita_id}:{step}:{answers_csv}
    const visitaId = partes[1]
    const step = parseInt(partes[2], 10)
    const answersSoFar = partes[3] ?? ''
    const valor = text.slice(3) // '1'..'5' or 'N'

    const newAnswers = answersSoFar ? `${answersSoFar},${valor}` : valor
    const nextStep = step + 1

    if (nextStep < PREGUNTAS_REPORTE.length) {
      // Siguiente pregunta
      await setEstado(supabase, chatId, {
        pendiente_accion: `reporte:${visitaId}:${nextStep}:${newAnswers}`,
        pendiente_expira: new Date(Date.now() + 30 * 60_000).toISOString(),
      })
      const q = PREGUNTAS_REPORTE[nextStep]
      await sendTelegramMessage(
        chatId,
        `${nextStep + 1} de 4 — ${q.emoji} <b>${q.label}</b>\n\n${q.texto}\n\n<i>1 = muy bajo, 5 = excelente</i>`,
        makeReporteKeyboard(),
      )
    } else {
      // Últimas respuesta (entorno) — pasar a novedad
      await setEstado(supabase, chatId, {
        pendiente_accion: `reporte_novedad:${visitaId}:${newAnswers}`,
        pendiente_expira: new Date(Date.now() + 30 * 60_000).toISOString(),
      })
      await sendTelegramMessage(
        chatId,
        `✍️ <b>Por último:</b> ¿Hubo alguna novedad importante que la familia deba saber?\n\nEscríbela aquí, o toca el botón si no hay nada que reportar.`,
        makeInlineKeyboard([[{ text: 'Sin novedad', callback_data: 'rn:skip' }]]),
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── Sin novedad (callback rn:skip) ───────────────────────────────────────────
  if (isCallback && text === 'rn:skip') {
    const estadoRN = await getEstado(supabase, chatId)
    const accion = estadoRN?.pendiente_accion ?? ''
    if (accion.startsWith('reporte_novedad:')) {
      await guardarReporteYEnviarEmail(supabase, chatId, compita, accion, null)
    } else {
      await sendTelegramMessage(chatId, `Ya no hay un cuestionario activo.`, TECLADO_SIN_VISITA)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Texto de novedad (estado reporte_novedad) ─────────────────────────────────
  {
    const estadoNov = await getEstado(supabase, chatId)
    if (!isCallback && estadoNov?.pendiente_accion?.startsWith('reporte_novedad:') && text && !text.startsWith('/')) {
      const expiradoNov = estadoNov.pendiente_expira ? new Date(estadoNov.pendiente_expira) < new Date() : true
      if (expiradoNov) {
        await clearPendiente(supabase, chatId)
        await sendTelegramMessage(chatId, `El tiempo para completar el cuestionario expiró. Si quieres registrarlo de todas formas, escríbenos a hola@micompaz.com.`, TECLADO_SIN_VISITA)
        return NextResponse.json({ ok: true })
      }
      await guardarReporteYEnviarEmail(supabase, chatId, compita, estadoNov.pendiente_accion, text)
      return NextResponse.json({ ok: true })
    }
  }

  // ── Foto de llegada: solo vale la que llega DESPUÉS de que el bot la pidió (el compita tocó "Iniciar visita") ─────
  if (!isCallback && message.photo && message.photo.length > 0) {
    const { data: esperando } = await supabase.from('telegram_estados').delete().eq('chat_id', `lleg:${chatId}`).like('pendiente_accion', 'llegada:%').select('pendiente_accion, pendiente_expira').maybeSingle()
    if (esperando?.pendiente_accion && esperando.pendiente_expira && new Date(esperando.pendiente_expira).getTime() > Date.now()) {
      const visitaId = esperando.pendiente_accion.split(':')[1]
      const r = await registrarLlegada({ visitaId, compitaId: compita.id, fileId: message.photo[message.photo.length - 1].file_id })
      if (!r.ok) {
        if (r.motivo === 'foto') await supabase.from('telegram_estados').upsert({ chat_id: `lleg:${chatId}`, pendiente_accion: `llegada:${visitaId}`, pendiente_expira: new Date(Date.now() + 20 * 60_000).toISOString(), registro_pendiente: false }, { onConflict: 'chat_id' })
        await sendTelegramMessage(chatId, r.motivo === 'foto' ? `No pudimos guardar la foto. Envíala de nuevo, por favor.` : `Esa visita ya no está programada.`, TECLADO_SIN_VISITA)
        return NextResponse.json({ ok: true })
      }
      await setConfirmacion(supabase, chatId, 'iniciar', visitaId)
      await sendTelegramMessage(chatId, `✅ <b>Llegada registrada.</b> La familia ya sabe que estás ahí.\n\n¿Qué pasó?`, tecladoLlegada(visitaId))
      return NextResponse.json({ ok: true })
    }
  }

  // ── Mensajes y fotos durante visita activa o coordinación pre-visita ──────────
  // Solo procesar si no es un callback (los callbacks no tienen contenido multimedia)
  if (!isCallback) {
    const { data: activas } = await supabase
      .from('visitas')
      .select('id, estado')
      .eq('compita_id', compita.id)
      .in('estado', ['en_curso', 'pre_visita', 'programada'])
      .order('created_at', { ascending: false }) as { data: { id: string; estado: string }[] | null }
    // La visita en curso tiene prioridad; si no, la más reciente en coordinación.
    const visitaActiva = (activas ?? []).find((v) => v.estado === 'en_curso') ?? (activas ?? [])[0] ?? null

    if (!visitaActiva) {
      await sendTelegramMessage(
        chatId,
        `No hay ninguna visita activa ahora mismo.\n\nCuando llegues donde tu cliente, toca el botón de abajo. 👇`,
        TECLADO_SIN_VISITA,
      )
      return NextResponse.json({ ok: true })
    }

    // Cuenta en pausa por compartir contactos (la suya o la del cliente): no se reenvía nada por el chat.
    {
      const { data: vp } = await supabase.from('visitas').select('usuario_id').eq('id', visitaActiva.id).maybeSingle() as { data: { usuario_id: string } | null }
      if (await personaPausada('compita', compita.id)) { await sendTelegramMessage(chatId, `⏸️ Tu cuenta está en pausa, así que por ahora no puedes escribir en el chat. El equipo se comunica contigo por aquí.`); return NextResponse.json({ ok: true }) }
      if (vp && await personaPausada('cliente', vp.usuario_id)) { await sendTelegramMessage(chatId, `El chat con el cliente no está disponible por ahora. El equipo te escribe si hace falta.`); return NextResponse.json({ ok: true }) }
    }

    // Foto: se guarda solo el file_id ("tg:<id>"). La imagen se sirve por /api/foto/[id];
    // NUNCA guardar la URL de descarga de Telegram porque contiene el token del bot.
    if (message.photo && message.photo.length > 0) {
      const photo = message.photo[message.photo.length - 1]
      const { error: errFoto } = await supabase
        .from('mensajes')
        .insert({ visit_id: visitaActiva.id, origen: 'compita', tipo: 'foto', contenido: `tg:${photo.file_id}` })
      if (errFoto) {
        console.error('Error guardando foto:', errFoto)
        await sendTelegramMessage(chatId, `No pudimos guardar la foto. Intenta enviarla de nuevo.`)
        return NextResponse.json({ ok: true })
      }
      if (message.caption?.trim()) {
        await supabase.from('mensajes').insert({ visit_id: visitaActiva.id, origen: 'compita', tipo: 'texto', contenido: message.caption.trim().slice(0, 1000) })
      }
      return NextResponse.json({ ok: true })
    }

    // Texto — comando desconocido (/menu y /perfil ya se interceptaron arriba, antes de este bloque)
    if (text.startsWith('/')) {
      await sendTelegramMessage(chatId, `No reconozco ese comando. Usa los botones de abajo. 👇`, await tecladoSegunEstado())
      return NextResponse.json({ ok: true })
    }

    if (!text) {
      // Voz, video, documentos, stickers: no se reenvían. Avisar para que no crea que llegaron.
      await sendTelegramMessage(chatId, `Por ahora solo puedo reenviar <b>texto y fotos</b> a la familia. Ese archivo no se envió.`)
      return NextResponse.json({ ok: true })
    }

    const textoRaw = text.slice(0, 1000)
    const { detectado, textoCensurado } = detectarContacto(textoRaw)
    const contenido = textoCensurado

    const { error: errMsg } = await supabase
      .from('mensajes')
      .insert({ visit_id: visitaActiva.id, origen: 'compita', tipo: 'texto', contenido })
    if (errMsg) {
      console.error('Error guardando mensaje de compita:', errMsg)
      await sendTelegramMessage(chatId, `No pudimos entregar tu mensaje. Intenta enviarlo de nuevo.`)
      return NextResponse.json({ ok: true })
    }

    // Moderar si hay datos de contacto
    if (detectado) {
      const { data: visitaExtra } = await supabase
        .from('visitas')
        .select('usuario_id, compita_id, usuario:usuarios(nombre)')
        .eq('id', visitaActiva.id)
        .single() as { data: { usuario_id: string; compita_id: string; usuario: { nombre: string } | null } | null }
      moderarMensaje({
        visitaId: visitaActiva.id,
        compitaNombre: compita.nombre,
        clienteNombre: visitaExtra?.usuario?.nombre ?? 'Cliente',
        origen: 'compita',
        textoOriginal: textoRaw,
        clienteId: visitaExtra?.usuario_id ?? '',
        compitaId: compita.id,
      }).catch((e) => console.error('[telegram-webhook] moderacion:', e))
    }
    if (text.length > 1000) {
      await sendTelegramMessage(chatId, `Tu mensaje era muy largo: se envió solo la primera parte (1000 caracteres).`)
    }

    // Email al cliente cuando la compita escribe — throttling: 1 email cada 10 min por visita
    if (visitaActiva.estado === 'programada' || visitaActiva.estado === 'en_curso') {
      try {
        const hace10min = new Date(Date.now() - 10 * 60_000).toISOString()
        const { count: emailsRecientes } = await supabase
          .from('mensajes')
          .select('id', { count: 'exact', head: true })
          .eq('visit_id', visitaActiva.id)
          .eq('origen', 'admin')
          .eq('contenido', 'email_notif_mensaje')
          .gt('created_at', hace10min)

        if ((emailsRecientes ?? 0) === 0) {
          const { data: clienteMensaje } = await supabase
            .from('visitas')
            .select('usuario:usuarios(nombre, email)')
            .eq('id', visitaActiva.id)
            .single() as { data: { usuario: { nombre: string; email: string } | null } | null }
          const emailCliente = clienteMensaje?.usuario?.email
          if (emailCliente) {
            const { error: throttleError } = await supabase.from('mensajes').insert({
              visit_id: visitaActiva.id, origen: 'admin', tipo: 'texto', contenido: 'email_notif_mensaje',
            })
            if (!throttleError) {
              try {
                await sendEmail({
                  to: emailCliente,
                  subject: `${compita.nombre} te escribió en Compaz`,
                  html: `
                    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
                      <h2 style="color:#2D1464;font-size:20px;margin-bottom:12px">💬 Nuevo mensaje de ${esc(compita.nombre)}</h2>
                      <div style="background:#F5F0FF;border-left:4px solid #7C4DFF;border-radius:8px;padding:16px 20px;margin:16px 0;color:#1A0A3C;font-size:15px;line-height:1.6">
                        ${esc(contenido).replace(/\n/g, '<br>')}
                      </div>
                      <a href="${SITE_URL_PUBLICA}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:14px;margin-top:8px">
                        Ver en el dashboard →
                      </a>
                      <p style="color:#9990A8;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
                    </div>
                  `,
                })
              } catch (e) {
                // Si el email falló, soltar el marcador para que el próximo mensaje reintente.
                console.error('Email compita→cliente en mensaje:', e)
                await supabase.from('mensajes').delete().eq('visit_id', visitaActiva.id).eq('origen', 'admin').eq('contenido', 'email_notif_mensaje').gt('created_at', hace10min)
              }
            }
          }
        }
      } catch (e) { console.error('Email compita→cliente en mensaje:', e) }
    }

    // Recordatorio anti-fuga cada 5 mensajes durante pre_visita
    if (visitaActiva.estado === 'pre_visita') {
      const { count } = await supabase
        .from('mensajes')
        .select('id', { count: 'exact', head: true })
        .eq('visit_id', visitaActiva.id)
        .eq('origen', 'compita')
      if (count && count % 5 === 0) {
        await sendTelegramMessage(
          chatId,
          `💙 <i>Recuerda que toda la comunicación con tu cliente debe mantenerse dentro de Compaz. Coordinar servicios fuera de la plataforma va contra las condiciones de uso y puede resultar en la suspensión de tu cuenta. ¡Sabemos que estás haciendo un gran trabajo!</i>`,
        )
      }
    }
  }

  return NextResponse.json({ ok: true })
}
