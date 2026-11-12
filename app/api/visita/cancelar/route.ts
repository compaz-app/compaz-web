// /api/visita/cancelar — el cliente cancela una visita en coordinación (pre_visita) o con fecha (programada).
// GET: qué pasaría si cancela ahora (cuántas horas faltan, si es gratis o la visita cuenta como usada).
// POST { mensaje?, acepta_perder_visita? }: cancela. Con menos aviso que el mínimo de Ajustes (hoy 24 h) la visita cuenta
// como usada, y el servidor exige que el cliente lo acepte expresamente (no basta con la pantalla).
import { getClienteActivo } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { esc } from '@/lib/html'
import { ok, err, unauthorized } from '@/lib/api'
import { registrarCancelacion, evaluarCancelacionCliente } from '@/lib/cancelaciones'

const ESTADOS_CANCELABLES = ['pre_visita', 'programada']

type VisitaCancelable = {
  id: string; usuario_id: string; compita_id: string; created_at: string
  fecha_programada: string | null; hora_inicio_programada: string | null; estado: string
  compitas: { nombre: string; telegram_chat_id: string | null } | null
  usuarios: { nombre: string } | null
}

async function visitaDelCliente(userId: string): Promise<VisitaCancelable | null> {
  const { data } = await createAdminSupabase()
    .from('visitas')
    .select('id, usuario_id, compita_id, created_at, estado, fecha_programada, hora_inicio_programada, compitas(nombre, telegram_chat_id), usuarios(nombre)')
    .eq('usuario_id', userId).in('estado', ESTADOS_CANCELABLES)
    .order('created_at', { ascending: false }).limit(1).maybeSingle() as { data: VisitaCancelable | null }
  return data
}

export async function GET() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  const v = await visitaDelCliente(user.id)
  if (!v) return err('No hay visita que puedas cancelar', 404)
  const e = await evaluarCancelacionCliente(v.fecha_programada, v.hora_inicio_programada)
  return ok({ fecha: v.fecha_programada, hora: v.hora_inicio_programada, horas_de_aviso: e.horasDeAviso, minimo_horas: e.minimo, cuenta_como_usada: e.cuentaComoUsada })
}

export async function POST(req: Request) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  const body = await req.json().catch(() => null)
  const mensaje = typeof body?.mensaje === 'string' ? body.mensaje.trim().slice(0, 500) : ''
  const aceptaPerder = body?.acepta_perder_visita === true

  const admin = createAdminSupabase()
  const visita = await visitaDelCliente(user.id)
  if (!visita) return err('No hay visita en coordinación que puedas cancelar', 404)

  // La regla de las 24 horas: con menos aviso la visita cuenta como usada y hay que aceptarlo de forma expresa.
  const e = await evaluarCancelacionCliente(visita.fecha_programada, visita.hora_inicio_programada)
  if (e.cuentaComoUsada && !aceptaPerder) {
    return Response.json({
      ok: false, tardia: true,
      error: `Faltan menos de ${e.minimo} horas. Si cancelas ahora, esta visita se cuenta como usada. Confirma si quieres cancelar de todos modos.`,
    }, { status: 409 })
  }

  // Registrar la cancelación ANTES de borrar la visita: el registro no depende de ella (ver lib/cancelaciones.ts).
  await registrarCancelacion({
    visitaId: visita.id, compitaId: visita.compita_id, usuarioId: visita.usuario_id, canceladoPor: 'cliente',
    fechaProgramada: visita.fecha_programada, horaInicioProgramada: visita.hora_inicio_programada, motivo: mensaje || null,
    visitaCreadaEn: visita.created_at,
  })

  // Eliminar la visita (su registro queda en `cancelaciones`)
  const { error } = await admin.from('visitas').delete().eq('id', visita.id).in('estado', ESTADOS_CANCELABLES)
  if (error) {
    console.error('[visita/cancelar]', error)
    return err('No se pudo cancelar la visita', 500)
  }

  const clienteNombre = visita.usuarios?.nombre ?? 'El cliente'
  const compitaNombre = visita.compitas?.nombre ?? 'la compita'
  const etiqueta = e.cuentaComoUsada ? ' con poco aviso' : ''

  // Notificar al compita por Telegram
  if (visita.compitas?.telegram_chat_id) {
    const textoMensaje = mensaje
      ? `👋 <b>${esc(clienteNombre)}</b> ha cancelado la próxima visita${etiqueta}.\n\n<b>Mensaje del cliente:</b> ${esc(mensaje)}`
      : `👋 <b>${esc(clienteNombre)}</b> ha cancelado la próxima visita${etiqueta}.`
    try {
      await sendTelegramMessage(visita.compitas.telegram_chat_id, textoMensaje)
    } catch (err2) { console.error('[visita/cancelar] Telegram compita:', err2) }
  }

  await alertaAdmin('actividad', `ℹ️ <b>${esc(clienteNombre)}</b> canceló la visita con <b>${esc(compitaNombre)}</b>${e.cuentaComoUsada ? ` <b>con poco aviso (${e.horasDeAviso} h): cuenta como usada</b>` : ''}.${mensaje ? `\n<b>Motivo:</b> ${esc(mensaje)}` : ''}`)

  return ok({ cuenta_como_usada: e.cuentaComoUsada })
}
