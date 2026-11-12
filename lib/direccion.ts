// Dirección POR CITA. El cliente la registra al agendar (dirección, cómo entrar, quién abre y un contacto en el sitio).
// El compita NO la recibe al aceptar: le llega `direccion_horas_antes` (Ajustes, hoy 3) antes de la cita, por Telegram y
// nunca por el chat. El TELÉFONO del contacto en el sitio es solo para el equipo: jamás se manda al compita.
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjustes } from '@/lib/ajustes'
import { notificar } from '@/lib/avisos'
import { avisarAdmin, sendTelegramMessage } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { registrarEvento } from '@/lib/eventos'
import { detectarContacto } from '@/lib/detectar-contacto'
import { esc } from '@/lib/html'

export interface DatosDireccion {
  direccion: string
  indicaciones: string | null
  quien_abre: string | null
  contacto_nombre: string
  contacto_tel: string
}

const texto = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')

/** Validación en el servidor. Teléfonos y correos NO van en los textos de la dirección: tienen su campo (solo para el equipo). */
export function validarDireccion(b: unknown): { ok: true; datos: DatosDireccion } | { ok: false; error: string } {
  if (!b || typeof b !== 'object') return { ok: false, error: 'Solicitud inválida' }
  const x = b as Record<string, unknown>
  const direccion = texto(x.direccion), indicaciones = texto(x.indicaciones), quien = texto(x.quien_abre)
  const contacto_nombre = texto(x.contacto_nombre), contacto_tel = texto(x.contacto_tel)

  if (direccion.length < 8) return { ok: false, error: 'Escribe la dirección completa o el punto de encuentro' }
  if (direccion.length > 300) return { ok: false, error: 'La dirección es demasiado larga (máximo 300 letras)' }
  if (indicaciones.length > 200) return { ok: false, error: 'Cómo entrar es demasiado largo (máximo 200 letras)' }
  if (quien.length > 100) return { ok: false, error: 'Quién abre es demasiado largo (máximo 100 letras)' }
  for (const [campo, valor] of [['la dirección', direccion], ['cómo entrar', indicaciones], ['quién abre', quien]] as const) {
    if (valor && detectarContacto(valor).detectado) return { ok: false, error: `No pongas teléfonos ni correos en ${campo}. El contacto en el sitio tiene su propio campo y solo lo ve el equipo de Compaz.` }
  }
  if (contacto_nombre.length < 2 || contacto_nombre.length > 100) return { ok: false, error: 'Escribe el nombre de la persona de contacto en el sitio' }
  if (!/^[+\d][\d\s().-]{6,24}$/.test(contacto_tel) || contacto_tel.replace(/\D/g, '').length < 7) return { ok: false, error: 'Escribe el teléfono de contacto con el código de país' }
  return { ok: true, datos: { direccion, indicaciones: indicaciones || null, quien_abre: quien || null, contacto_nombre, contacto_tel } }
}

/** Instante en que empieza la cita (hora de Venezuela), o null si aún no tiene fecha. */
export function inicioDeLaCita(fecha: string | null, hora: string | null): Date | null {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !hora || !/^\d{2}:\d{2}/.test(hora)) return null
  const d = new Date(`${fecha}T${hora.slice(0, 5)}:00-04:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

type VisitaDir = { id: string; usuario_id: string; compita_id: string; estado: string; fecha_programada: string | null; hora_inicio_programada: string | null; direccion: string | null }

/** La visita próxima del cliente (en coordinación o programada). */
export async function visitaProximaDelCliente(clienteId: string): Promise<VisitaDir | null> {
  const { data } = await createAdminSupabase().from('visitas')
    .select('id, usuario_id, compita_id, estado, fecha_programada, hora_inicio_programada, direccion')
    .eq('usuario_id', clienteId).in('estado', ['pre_visita', 'programada']).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return (data as VisitaDir | null) ?? null
}

/** La dirección de la visita anterior más reciente, para reutilizarla ("guardar el lugar para la próxima"). */
export async function direccionAnterior(clienteId: string, excluirVisitaId?: string): Promise<DatosDireccion | null> {
  let q = createAdminSupabase().from('visitas').select('direccion, indicaciones, quien_abre, contacto_nombre, contacto_tel')
    .eq('usuario_id', clienteId).not('direccion', 'is', null).order('created_at', { ascending: false }).limit(1)
  if (excluirVisitaId) q = q.neq('id', excluirVisitaId)
  const { data } = await q.maybeSingle()
  const d = data as { direccion: string | null; indicaciones: string | null; quien_abre: string | null; contacto_nombre: string | null; contacto_tel: string | null } | null
  return d && d.direccion && d.contacto_nombre && d.contacto_tel ? { direccion: d.direccion, indicaciones: d.indicaciones, quien_abre: d.quien_abre, contacto_nombre: d.contacto_nombre, contacto_tel: d.contacto_tel } : null
}

export async function guardarDireccion(visitaId: string, d: DatosDireccion): Promise<boolean> {
  const { error } = await createAdminSupabase().from('visitas').update({
    direccion: d.direccion, indicaciones: d.indicaciones, quien_abre: d.quien_abre, contacto_nombre: d.contacto_nombre, contacto_tel: d.contacto_tel,
  }).eq('id', visitaId).in('estado', ['pre_visita', 'programada'])
  if (error) { console.error('[direccion] no se pudo guardar:', error.message); return false }
  return true
}

/** Clave de entrega: incluye la fecha y hora, así si la cita se reagenda la dirección se vuelve a entregar para la nueva. */
const claveEntrega = (v: { id: string; fecha_programada: string | null; hora_inicio_programada: string | null }) => `direccion:${v.id}:${v.fecha_programada}:${(v.hora_inicio_programada ?? '').slice(0, 5)}`

/**
 * Entrega la dirección al compita si la cita está dentro de la ventana (`direccion_horas_antes`) y todavía no se le dio
 * para esa fecha y hora. Sin dirección registrada: avisa al cliente y abre una tarea urgente (una sola vez).
 */
export async function entregarDireccionDeVisita(visitaId: string, ahora: Date = new Date()): Promise<'enviada' | 'fuera_de_ventana' | 'ya_entregada' | 'sin_direccion' | 'no_aplica'> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('visitas').select('id, usuario_id, compita_id, estado, fecha_programada, hora_inicio_programada, direccion').eq('id', visitaId).maybeSingle()
  const v = data as VisitaDir | null
  if (!v || v.estado !== 'programada') return 'no_aplica'
  const inicio = inicioDeLaCita(v.fecha_programada, v.hora_inicio_programada)
  if (!inicio) return 'no_aplica'
  const horas = Number((await getAjustes()).direccion_horas_antes)
  const falta = inicio.getTime() - ahora.getTime()
  if (falta > horas * 3600_000) return 'fuera_de_ventana'
  if (falta < -2 * 3600_000) return 'no_aplica' // la cita ya pasó hace rato: no se entrega una dirección vieja

  if (!v.direccion) {
    await alertarDireccionFaltante(v, ahora)
    return 'sin_direccion'
  }
  const r = await notificar({
    plantilla: 'direccion_visita', canal: 'telegram', destinatario: { tipo: 'compita', id: v.compita_id },
    variables: { visitaId: v.id }, entidad: 'visita', entidadId: v.id, paso: 10, claveUnica: claveEntrega(v),
  })
  if (r.ok && r.estado === 'duplicado') return 'ya_entregada'
  if (!r.ok) {
    // No se pudo entregar: el equipo debe saberlo ya (la escalera de avisos reintenta; esto es el respaldo humano).
    await alertaAdmin('urgente', `<b>No se pudo entregar la dirección</b>\n\nLa visita empieza pronto y el aviso con la dirección al compita falló. Contáctalo.`)
    return 'ya_entregada'
  }
  await registrarEvento({ entidad: 'visita', entidadId: v.id, tipo: 'direccion_entregada', actor: 'sistema', datos: { horas_antes: Math.round((falta / 3600_000) * 10) / 10 } })
  return 'enviada'
}

async function alertarDireccionFaltante(v: VisitaDir, ahora: Date): Promise<void> {
  const admin = createAdminSupabase()
  const clave = `direccion_faltante:${claveEntrega(v)}`
  const { data: previa } = await admin.from('admin_flags').select('id').eq('tipo', 'direccion_faltante').eq('entidad_id', v.id).eq('resuelto', false).maybeSingle()
  if (previa) return
  const [{ data: cmp }, { data: cli }] = await Promise.all([
    admin.from('compitas').select('nombre, telegram_chat_id').eq('id', v.compita_id).maybeSingle(),
    admin.from('usuarios').select('nombre').eq('id', v.usuario_id).maybeSingle(),
  ])
  await admin.from('admin_flags').insert({
    entidad_tipo: 'visita', entidad_id: v.id, entidad_nombre: `Falta la dirección: ${(cmp as { nombre: string } | null)?.nombre ?? ''} / ${(cli as { nombre: string } | null)?.nombre ?? ''}`,
    nota: `La visita empieza en menos de ${Number((await getAjustes()).direccion_horas_antes)} horas y el cliente todavía no registró la dirección. Contáctalo para que la registre en su portal.`,
    reportado_por: 'dirección automática', resuelto: false, tipo: 'direccion_faltante', prioridad: 1,
  })
  await notificar({
    plantilla: 'direccion_faltante_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: v.usuario_id },
    variables: { visitaId: v.id }, entidad: 'visita', entidadId: v.id, paso: 10, claveUnica: clave,
  })
  const chat = (cmp as { telegram_chat_id: string | null } | null)?.telegram_chat_id
  if (chat) {
    try { await sendTelegramMessage(chat, `<b>Aún falta la dirección</b>\n\nEl cliente todavía no registró dónde será la visita. Apenas lo haga te la enviamos por aquí. Ya le avisamos.`) } catch (e) { console.error('[direccion] Telegram al compita:', e) }
  }
  await alertaAdmin('actividad', `<b>Falta la dirección de una visita</b>\n\n<b>${esc((cmp as { nombre: string } | null)?.nombre ?? '')}</b> visita a <b>${esc((cli as { nombre: string } | null)?.nombre ?? '')}</b> en menos de ${Number((await getAjustes()).direccion_horas_antes)} h y no hay dirección. Abrimos una tarea.`)
  void ahora
}

/** Recorre las visitas programadas que entran en la ventana. Lo llama la escalera (cron cada 5 minutos). */
export async function entregarDirecciones(ahora: Date = new Date()): Promise<{ enviadas: number; sinDireccion: number }> {
  const horas = Number((await getAjustes()).direccion_horas_antes)
  const hoy = new Date(ahora.getTime() - 4 * 3600_000).toISOString().slice(0, 10)
  const manana = new Date(ahora.getTime() - 4 * 3600_000 + 86400_000 * 2).toISOString().slice(0, 10)
  const { data } = await createAdminSupabase().from('visitas').select('id').eq('estado', 'programada').gte('fecha_programada', hoy).lte('fecha_programada', manana)
  const r = { enviadas: 0, sinDireccion: 0 }
  for (const v of (data ?? []) as { id: string }[]) {
    const x = await entregarDireccionDeVisita(v.id, ahora).catch((e) => { console.error('[direccion] error entregando:', e); return 'no_aplica' as const })
    if (x === 'enviada') r.enviadas++
    if (x === 'sin_direccion') r.sinDireccion++
  }
  void horas
  return r
}
