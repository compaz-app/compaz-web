// Seguridad del compita durante la visita. "No me siento seguro": el compita interrumpe la visita SIN penalización; el cliente
// recibe un aviso neutro y el equipo una alerta urgente. "¿Todo bien?": pasada la hora de fin de la visita, el bot pregunta;
// si no hay respuesta a tiempo, alerta urgente al equipo.
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjustes } from '@/lib/ajustes'
import { registrarEvento } from '@/lib/eventos'
import { notificar, registrarAccion } from '@/lib/avisos'
import { alertaAdmin } from '@/lib/alertas-admin'
import { registrarCancelacion } from '@/lib/cancelaciones'
import { programarBorradoVisita } from '@/lib/fotos-privadas'
import { emailAdminPago } from '@/lib/aviso-pago'
import { inicioDeLaCita } from '@/lib/direccion'
import { esc } from '@/lib/html'

type VisitaSeg = {
  id: string; usuario_id: string; compita_id: string; estado: string; created_at: string
  fecha_programada: string | null; hora_inicio_programada: string | null; hora_fin_programada: string | null
  llegada_en: string | null; contacto_nombre: string | null; contacto_tel: string | null
}
const COLS = 'id, usuario_id, compita_id, estado, created_at, fecha_programada, hora_inicio_programada, hora_fin_programada, llegada_en, contacto_nombre, contacto_tel'

/** La visita en la que el compita está ahora: en curso primero; si no, la que ya empezó a atender (llegó o confirmando inicio). */
export async function visitaActualDelCompita(compitaId: string): Promise<VisitaSeg | null> {
  const { data } = await createAdminSupabase().from('visitas').select(COLS).eq('compita_id', compitaId).in('estado', ['en_curso', 'confirmando_inicio', 'programada']).order('created_at', { ascending: false })
  const lista = (data ?? []) as VisitaSeg[]
  return lista.find((v) => v.estado === 'en_curso') ?? lista.find((v) => v.estado === 'confirmando_inicio') ?? lista.find((v) => v.estado === 'programada' && v.llegada_en) ?? null
}

export type ResultadoSalida = { ok: true; hayVisita: boolean }

/**
 * "No me siento seguro". Nunca se le pide confirmar ni se le niega: la prioridad es que pueda salir. Si hay una visita, se
 * interrumpe (queda registrada como cancelación JUSTIFICADA, sin efecto en su semáforo ni en su pausa, y sin descontar la visita al
 * cliente); si no hay, igual se alerta al equipo.
 */
export async function salidaPorSeguridad(compita: { id: string; nombre: string }, ahora: Date = new Date()): Promise<ResultadoSalida> {
  const admin = createAdminSupabase()
  const v = await visitaActualDelCompita(compita.id)
  let cliente = null as { nombre: string; email: string | null; zona: string | null } | null
  if (v) {
    const { data } = await admin.from('usuarios').select('nombre, email, zona').eq('id', v.usuario_id).maybeSingle()
    cliente = data as typeof cliente
    // Primero queda el registro; si no se pudiera guardar, igual se interrumpe (la seguridad no espera a la base).
    const idCanc = await registrarCancelacion({
      visitaId: v.id, compitaId: compita.id, usuarioId: v.usuario_id, canceladoPor: 'compita', fechaProgramada: v.fecha_programada, horaInicioProgramada: v.hora_inicio_programada,
      motivo: 'Salida por seguridad', visitaCreadaEn: v.created_at, cuentaComoUsada: false, ahora,
    })
    if (idCanc) await admin.from('cancelaciones').update({ justificada: true, justificada_por: 'sistema: salida por seguridad', justificada_en: ahora.toISOString() }).eq('id', idCanc)
    if (v.llegada_en) await programarBorradoVisita(v.id, ahora)
    await admin.from('visitas').delete().eq('id', v.id)
    await registrarEvento({ entidad: 'visita', entidadId: v.id, tipo: 'salida_por_seguridad', actor: `compita:${compita.id}`, datos: { estado_anterior: v.estado } })
    // Aviso NEUTRO al cliente: sin culpas ni detalles.
    await notificar({
      plantilla: 'salida_seguridad_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: v.usuario_id },
      variables: { visitaId: v.id, compitaId: compita.id }, entidad: 'cliente', entidadId: v.usuario_id, paso: 12, claveUnica: `salida_seguridad:${v.id}`,
    })
    // La tarea queda visible en la Bandeja del equipo.
    await admin.from('admin_flags').insert({
      entidad_tipo: 'visita', entidad_id: v.id, entidad_nombre: `Salida por seguridad: ${compita.nombre}`,
      nota: `${compita.nombre} interrumpió la visita con ${cliente?.nombre ?? 'el cliente'} porque no se sintió seguro. Sin penalización para el compita. Contacta al compita y al cliente de inmediato. Si el compita cobra la visita se decide caso por caso.`,
      reportado_por: 'no me siento seguro', resuelto: false, tipo: 'salida_seguridad', prioridad: 1,
    })
  }
  const detalle = [
    `<b>NO ME SIENTO SEGURO</b>`, ``,
    `<b>${esc(compita.nombre)}</b> interrumpió la visita por seguridad.`,
    v && cliente ? `<b>Cliente:</b> ${esc(cliente.nombre)}${cliente.email ? ` (${esc(cliente.email)})` : ''}` : `No hay una visita registrada en este momento.`,
    ...(v && cliente?.zona ? [`<b>Zona:</b> ${esc(cliente.zona)}`] : []),
    ...(v?.contacto_nombre ? [`<b>Contacto en el sitio:</b> ${esc(v.contacto_nombre)} ${esc(v.contacto_tel ?? '')}`] : []),
    ``, `Contáctala ahora. Sin penalización para ella; si cobra la visita se decide caso por caso.`,
  ].join('\n')
  await alertaAdmin('urgente', detalle, { critica: true, sinTarea: true, categoria: 'salida_seguridad', entidad: { tipo: 'compita', id: compita.id, nombre: compita.nombre } })
  await emailAdminPago('URGENTE: un compita no se siente seguro', detalle.replace(/<[^>]+>/g, ''))
  return { ok: true, hayVisita: !!v }
}

// ── "¿Todo bien?" ────────────────────────────────────────────────────────────

/** Visitas en curso cuya hora de fin ya pasó hace `todo_bien_min` minutos: el bot pregunta (una sola vez por visita). */
export async function preguntarTodoBien(ahora: Date = new Date()): Promise<number> {
  const a = await getAjustes()
  const margenMs = Number(a.todo_bien_min) * 60_000
  const hoy = new Date(ahora.getTime() - 4 * 3600_000).toISOString().slice(0, 10)
  const ayer = new Date(ahora.getTime() - 4 * 3600_000 - 86400_000).toISOString().slice(0, 10)
  const { data } = await createAdminSupabase().from('visitas').select(COLS).eq('estado', 'en_curso').in('fecha_programada', [hoy, ayer])
  let n = 0
  for (const v of (data ?? []) as VisitaSeg[]) {
    const fin = inicioDeLaCita(v.fecha_programada, v.hora_fin_programada)
    if (!fin || ahora.getTime() < fin.getTime() + margenMs) continue
    const r = await notificar({
      plantilla: 'todo_bien', canal: 'telegram', destinatario: { tipo: 'compita', id: v.compita_id },
      variables: { visitaId: v.id }, entidad: 'visita', entidadId: v.id, paso: 12, claveUnica: `todo_bien:${v.id}`,
    })
    if (r.ok && r.estado !== 'duplicado') {
      await registrarEvento({ entidad: 'visita', entidadId: v.id, tipo: 'visita_alargada', actor: 'sistema', datos: { respuesta: 'pendiente', minutos_tras_el_fin: Math.round((ahora.getTime() - fin.getTime()) / 60_000) } })
      n++
    }
  }
  return n
}

export type RespuestaTodoBien = 'ok' | 'ayuda'

/** El compita responde. "Todo bien" cierra la pregunta; "Necesito ayuda" alerta al equipo al instante. */
export async function responderTodoBien(visitaId: string, compita: { id: string; nombre: string }, respuesta: RespuestaTodoBien, ahora: Date = new Date()): Promise<'ok' | 'no_aplica'> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('visitas').select(COLS).eq('id', visitaId).eq('compita_id', compita.id).in('estado', ['en_curso', 'confirmando_inicio']).maybeSingle()
  const v = data as VisitaSeg | null
  if (!v) return 'no_aplica'
  await registrarAccion({ entidad: 'visita', entidadId: v.id, paso: 12 }) // la persona actuó: la pregunta deja de escalar
  await registrarEvento({ entidad: 'visita', entidadId: v.id, tipo: 'visita_alargada', actor: `compita:${compita.id}`, datos: { respuesta } })
  if (respuesta === 'ayuda') await alertarVisitaAlargada(v, compita.nombre, 'pidió ayuda al responder "¿Todo bien?"', ahora)
  return 'ok'
}

async function alertarVisitaAlargada(v: VisitaSeg, nombreCompita: string, motivo: string, ahora: Date): Promise<void> {
  const admin = createAdminSupabase()
  const { data: cli } = await admin.from('usuarios').select('nombre, email, zona').eq('id', v.usuario_id).maybeSingle()
  const c = cli as { nombre: string; email: string | null; zona: string | null } | null
  await admin.from('admin_flags').insert({
    entidad_tipo: 'visita', entidad_id: v.id, entidad_nombre: `Visita alargada: ${nombreCompita} / ${c?.nombre ?? ''}`,
    nota: `${nombreCompita} ${motivo}. La visita con ${c?.nombre ?? 'el cliente'} sigue abierta después de la hora de fin. Contacta al compita y al cliente ahora.`,
    reportado_por: 'visita alargada', resuelto: false, tipo: 'visita_alargada', prioridad: 1,
  })
  const texto = [
    `<b>VISITA ALARGADA</b>`, ``, `<b>${esc(nombreCompita)}</b> ${esc(motivo)}.`,
    `<b>Cliente:</b> ${esc(c?.nombre ?? '')}${c?.email ? ` (${esc(c.email)})` : ''}`,
    ...(c?.zona ? [`<b>Zona:</b> ${esc(c.zona)}`] : []),
    ...(v.contacto_nombre ? [`<b>Contacto en el sitio:</b> ${esc(v.contacto_nombre)} ${esc(v.contacto_tel ?? '')}`] : []),
    ``, `Contáctalos de inmediato.`,
  ].join('\n')
  await alertaAdmin('urgente', texto, { critica: true, sinTarea: true, categoria: 'visita_alargada', entidad: { tipo: 'visita', id: v.id, nombre: nombreCompita } })
  await emailAdminPago('URGENTE: visita alargada sin respuesta', texto.replace(/<[^>]+>/g, ''))
  void ahora
}

/** Sin respuesta al "¿Todo bien?" en `todo_bien_respuesta_min`: alerta urgente al equipo, una sola vez. */
export async function escalarTodoBien(ahora: Date = new Date()): Promise<number> {
  const admin = createAdminSupabase()
  const espera = Number((await getAjustes()).todo_bien_respuesta_min)
  const limite = new Date(ahora.getTime() - espera * 60_000).toISOString()
  const { data } = await admin.from('avisos').select('id, entidad_id').eq('plantilla', 'todo_bien').eq('estado', 'enviado').is('accion_en', null).lte('creado_en', limite)
  let n = 0
  for (const a of (data ?? []) as { id: string; entidad_id: string }[]) {
    // Se reclama primero (una sola alerta aunque el cron se solape): el aviso se marca como atendido por la escalera.
    const { data: reclamo } = await admin.from('avisos').update({ accion_en: ahora.toISOString() }).eq('id', a.id).is('accion_en', null).select('id').maybeSingle()
    if (!reclamo) continue
    const { data: vis } = await admin.from('visitas').select(COLS).eq('id', a.entidad_id).eq('estado', 'en_curso').maybeSingle()
    const v = vis as VisitaSeg | null
    if (!v) continue // la visita ya terminó: no hace falta alertar
    const { data: cmp } = await admin.from('compitas').select('nombre').eq('id', v.compita_id).maybeSingle()
    await alertarVisitaAlargada(v, String((cmp as { nombre: string } | null)?.nombre ?? 'El compita'), `no respondió en ${espera} minutos al "¿Todo bien?"`, ahora)
    n++
  }
  return n
}
