// Reagendar una entrevista del flujo nuevo (la que se agendó con horas libres). La solicitud sigue "aceptada", sin hora:
// el cliente elige otra hora libre en /solicitar/hora y el compita la confirma de nuevo. Nada de proponer horarios a mano.
// Las entrevistas del contrato anterior (con horarios propuestos) siguen usando el reagendado anterior sin cambios.
import { createAdminSupabase } from '@/lib/supabase-server'
import { registrarEvento } from '@/lib/eventos'
import { notificar } from '@/lib/avisos'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { esc } from '@/lib/html'

/** ¿Esta solicitud es una entrevista agendada con horas libres? (tipo entrevista y sin horarios propuestos). */
export async function esEntrevistaConHoras(solicitudId: string): Promise<boolean> {
  const { data } = await createAdminSupabase().from('solicitudes').select('tipo, slots_propuestos').eq('id', solicitudId).maybeSingle()
  const s = data as { tipo?: string | null; slots_propuestos?: unknown } | null
  return !!s && s.tipo === 'entrevista' && Array.isArray(s.slots_propuestos) && s.slots_propuestos.length === 0
}

export type ResultadoReagendar = { ok: true; yaEstabaSinHora: boolean } | { ok: false; motivo: 'no_aplica' | 'cerrada' | 'error' }

/**
 * Suelta la hora confirmada (o reservada) y deja la solicitud lista para elegir otra. Avisa a la OTRA persona:
 * si reagenda el compita, el cliente recibe el correo para elegir; si reagenda el cliente, el compita recibe el aviso.
 */
export async function reagendarEntrevista(solicitudId: string, quien: 'cliente' | 'compita'): Promise<ResultadoReagendar> {
  const admin = createAdminSupabase()
  if (!(await esEntrevistaConHoras(solicitudId))) return { ok: false, motivo: 'no_aplica' }
  const { data } = await admin.from('solicitudes').select('id, cliente_id, compita_id, estado, slot_confirmado').eq('id', solicitudId).maybeSingle()
  const s = data as { id: string; cliente_id: string; compita_id: string; estado: string; slot_confirmado: string | null } | null
  if (!s || s.estado !== 'aceptada') return { ok: false, motivo: 'cerrada' }

  const yaEstabaSinHora = !s.slot_confirmado
  const ahora = new Date().toISOString()
  // 1) La hora vuelve a estar libre para otros.
  await admin.from('reservas_horario').update({ estado: 'liberada', resuelta_en: ahora }).eq('solicitud_id', s.id).in('estado', ['reservada', 'confirmada'])
  // 2) La solicitud queda sin hora ni sala y con los recordatorios en cero (igual que el reagendado anterior).
  const { data: act, error } = await admin.from('solicitudes').update({
    slot_confirmado: null, room_url: null, recordatorio_enviado: false, seguimiento_enviado: false, seguimiento2_enviado: false,
    confirmacion_llamada_enviada: false, confirmacion_cliente: null, confirmacion_compita: null,
  }).eq('id', s.id).eq('estado', 'aceptada').select('id').maybeSingle()
  if (error || !act) { console.error('[reagendar] no se pudo reagendar:', error?.message); return { ok: false, motivo: 'error' } }

  await registrarEvento({ entidad: 'solicitud', entidadId: s.id, tipo: 'entrevista_reagendada', actor: `${quien}:${quien === 'cliente' ? s.cliente_id : s.compita_id}`, datos: { antes: s.slot_confirmado } })
  if (yaEstabaSinHora) return { ok: true, yaEstabaSinHora }

  const [{ data: cli }, { data: cmp }] = await Promise.all([
    admin.from('usuarios').select('nombre').eq('id', s.cliente_id).maybeSingle(),
    admin.from('compitas').select('nombre, telegram_chat_id').eq('id', s.compita_id).maybeSingle(),
  ])
  if (quien === 'compita') {
    // Cada reagendado es un hecho nuevo: la clave incluye el momento para que no se tome por repetido.
    await notificar({
      plantilla: 'reserva_rechazada', canal: 'correo', destinatario: { tipo: 'cliente', id: s.cliente_id },
      variables: { solicitudId: s.id }, entidad: 'solicitud', entidadId: s.id, paso: 7, claveUnica: `reagendar:${s.id}:${ahora}`,
    })
  } else if (cmp?.telegram_chat_id) {
    try {
      await sendTelegramMessage(String(cmp.telegram_chat_id), `🔄 <b>${esc(String(cli?.nombre ?? 'El cliente').split(' ')[0])} pidió cambiar la hora de la videollamada</b>\n\nElegirá otra de tus horas libres y te avisamos para que la confirmes.`)
    } catch (e) { console.error('[reagendar] Telegram al compita:', e) }
  }
  await avisarAdmin(`🔄 <b>Entrevista reagendada</b>\n\n${quien === 'compita' ? 'El compita' : 'El cliente'} pidió cambiar la hora.\n<b>Cliente:</b> ${esc(String(cli?.nombre ?? ''))}\n<b>Compita:</b> ${esc(String(cmp?.nombre ?? ''))}\n\nEl cliente elegirá otra hora libre.`)
  return { ok: true, yaEstabaSinHora }
}
