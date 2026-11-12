// "Reportar un problema con un cliente" y "no quiero volver con este cliente". El compita elige un motivo de un toque; queda un
// evento y una tarea para el equipo, y si marcó no volver, el par queda bloqueado para solicitudes y visitas nuevas hasta que el
// equipo lo levante. El cliente NUNCA ve el motivo (solo "este compita no está disponible"). Nada revela contactos de nadie.
import { createAdminSupabase } from '@/lib/supabase-server'
import { registrarEvento } from '@/lib/eventos'
import { alertaAdmin } from '@/lib/alertas-admin'
import { getAjustes } from '@/lib/ajustes'
import { registrarCancelacion } from '@/lib/cancelaciones'
import { programarBorradoVisita } from '@/lib/fotos-privadas'
import { notificar } from '@/lib/avisos'
import { esc } from '@/lib/html'

export const MOTIVOS_REPORTE = {
  fuera: 'Me pidió algo fuera del servicio',
  trato: 'Trato irrespetuoso',
  inseguro: 'El lugar o la situación no era segura',
  pago: 'Quiso arreglar pagos fuera de Compaz',
  otro: 'Otro motivo',
} as const
export type MotivoReporte = keyof typeof MOTIVOS_REPORTE
export const esMotivoReporte = (m: unknown): m is MotivoReporte => typeof m === 'string' && m in MOTIVOS_REPORTE

type Compita = { id: string; nombre: string }

/** Los clientes con los que este compita ha tenido solicitud o visita (los más recientes primero, máximo 5). Solo se puede reportar a uno de ellos. */
export async function clientesReportables(compitaId: string): Promise<{ id: string; nombre: string }[]> {
  const admin = createAdminSupabase()
  const [{ data: v }, { data: s }] = await Promise.all([
    admin.from('visitas').select('usuario_id, created_at').eq('compita_id', compitaId).order('created_at', { ascending: false }).limit(10),
    admin.from('solicitudes').select('cliente_id, created_at').eq('compita_id', compitaId).order('created_at', { ascending: false }).limit(10),
  ])
  const orden: { id: string; en: string }[] = [
    ...((v ?? []) as { usuario_id: string; created_at: string }[]).map((x) => ({ id: x.usuario_id, en: x.created_at })),
    ...((s ?? []) as { cliente_id: string; created_at: string }[]).map((x) => ({ id: x.cliente_id, en: x.created_at })),
  ].filter((x) => x.id).sort((a, b) => String(b.en).localeCompare(String(a.en)))
  const ids = [...new Set(orden.map((x) => x.id))].slice(0, 5)
  if (ids.length === 0) return []
  const { data: us } = await admin.from('usuarios').select('id, nombre').in('id', ids)
  const nombre = new Map(((us ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]))
  return ids.filter((id) => nombre.has(id)).map((id) => ({ id, nombre: nombre.get(id)! }))
}

export type ResultadoReporte = 'ok' | 'no_corresponde' | 'invalido'
export const CUANDO = { durante: 'Durante la visita', llegada: 'Al llegar', despues: 'Después, por mensaje' } as const
export type Cuando = keyof typeof CUANDO
export const esCuando = (c: unknown): c is Cuando => typeof c === 'string' && c in CUANDO
/** Estos motivos SIEMPRE llevan llamada del equipo; los demás solo si el compita la pide. */
export const MOTIVOS_DE_RIESGO: MotivoReporte[] = ['inseguro', 'pago']

export interface DatosReporte { motivo: unknown; cuando?: unknown; estaBien?: boolean; reincidente?: boolean; noVolver: boolean; llamar?: boolean }
export type ReporteCreado = { resultado: ResultadoReporte; llamar: boolean; plazo: Date | null }

export async function reportarCliente(compita: Compita, usuarioId: string, d: DatosReporte, ahora: Date = new Date()): Promise<ReporteCreado> {
  const motivo = d.motivo
  if (!esMotivoReporte(motivo)) return { resultado: 'invalido', llamar: false, plazo: null }
  const admin = createAdminSupabase()
  // Solo se reporta a alguien con quien de verdad hubo trato: nadie bloquea a un cliente cualquiera.
  if (!(await clientesReportables(compita.id)).some((c) => c.id === usuarioId)) return { resultado: 'no_corresponde', llamar: false, plazo: null }
  const { data: cli } = await admin.from('usuarios').select('nombre').eq('id', usuarioId).maybeSingle()
  const nombreCli = (cli as { nombre: string } | null)?.nombre ?? 'el cliente'
  const texto = MOTIVOS_REPORTE[motivo]
  const cuando = esCuando(d.cuando) ? d.cuando : null
  const pideAyuda = d.estaBien === false
  const llamar = MOTIVOS_DE_RIESGO.includes(motivo) || pideAyuda || d.llamar === true
  const horas = Number((await getAjustes()).reporte_llamada_horas)
  const plazo = llamar ? new Date(ahora.getTime() + horas * 3600_000) : null

  const { data: rep } = await admin.from('reportes_compita').insert({
    compita_id: compita.id, usuario_id: usuarioId, motivo, cuando, esta_bien: d.estaBien ?? null, reincidente: d.reincidente ?? null,
    no_volver: d.noVolver, llamar, plazo_llamada: plazo?.toISOString() ?? null,
  }).select('id').maybeSingle()
  const reporteId = (rep as { id: string } | null)?.id ?? `${compita.id}:${usuarioId}:${motivo}`

  await registrarEvento({ entidad: 'cliente', entidadId: usuarioId, tipo: 'reporte_cliente', actor: `compita:${compita.id}`, datos: { motivo, cuando, esta_bien: d.estaBien ?? null, reincidente: d.reincidente ?? null, no_volver: d.noVolver, llamar, compita_id: compita.id } })
  if (d.noVolver) {
    const { error } = await admin.from('bloqueos_compita_cliente').insert({ compita_id: compita.id, usuario_id: usuarioId, motivo })
    if (error && error.code !== '23505') console.error('[bloqueos] no se pudo guardar el bloqueo:', error.message)
  }
  const detalle = [
    `<b>Reporte de ${esc(compita.nombre)}</b> sobre <b>${esc(nombreCli)}</b>: ${esc(texto)}.`,
    cuando ? `Cuándo: ${CUANDO[cuando]}.` : '',
    pideAyuda ? '<b>Dijo que necesita ayuda.</b>' : d.estaBien ? 'Dijo que está bien.' : '',
    d.reincidente === undefined ? '' : d.reincidente ? 'Ya le había pasado antes con este cliente.' : 'Es la primera vez con este cliente.',
    d.noVolver ? 'Pidió <b>no volver con este cliente</b>: ya no se le asignará. Revisa si hay solicitudes o visitas abiertas entre ambos.' : 'No pidió dejar de trabajar con este cliente.',
    plazo ? `<b>Llamar al compita antes de</b> ${plazo.toLocaleString('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })} (hora de Venezuela). Pidió que lo llamemos o el motivo lo requiere.` : 'No pidió llamada.',
  ].filter(Boolean).join('\n')
  const urgente = motivo === 'inseguro' || pideAyuda
  // Solo hay trabajo para el equipo si hay que llamar o es un riesgo; lo demás queda en el registro de Actividad, sin tarea.
  await alertaAdmin(urgente ? 'urgente' : llamar ? 'tarea' : 'actividad', detalle, {
    categoria: 'reporte_cliente', clave: `reporte:${reporteId}`, entidad: { tipo: 'compita', id: compita.id, nombre: `Reporte: ${compita.nombre} / ${nombreCli}` }, critica: urgente,
  })
  return { resultado: 'ok', llamar, plazo }
}

export interface ReportePendiente { id: string; compita_id: string; compita_nombre: string; cliente_nombre: string; motivo: string; cuando: string | null; esta_bien: boolean | null; reincidente: boolean | null; no_volver: boolean; plazo_llamada: string; vencido: boolean; creado_en: string; abiertas: AbiertasDelPar }

/** Reportes con llamada pendiente, el más próximo a vencer primero. */
export async function reportesPendientes(ahora: Date = new Date()): Promise<ReportePendiente[]> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('reportes_compita').select('id, compita_id, usuario_id, motivo, cuando, esta_bien, reincidente, no_volver, plazo_llamada, creado_en').eq('llamar', true).is('llamada_en', null).order('plazo_llamada', { ascending: true })
  const f = (data ?? []) as { id: string; compita_id: string; usuario_id: string; motivo: string; cuando: string | null; esta_bien: boolean | null; reincidente: boolean | null; no_volver: boolean; plazo_llamada: string; creado_en: string }[]
  if (f.length === 0) return []
  const [{ data: cs }, { data: us }] = await Promise.all([
    admin.from('compitas').select('id, nombre').in('id', [...new Set(f.map((x) => x.compita_id))]),
    admin.from('usuarios').select('id, nombre').in('id', [...new Set(f.map((x) => x.usuario_id))]),
  ])
  const c = new Map(((cs ?? []) as { id: string; nombre: string }[]).map((x) => [x.id, x.nombre]))
  const u = new Map(((us ?? []) as { id: string; nombre: string }[]).map((x) => [x.id, x.nombre]))
  const abiertas = await Promise.all(f.map((x) => abiertasDelPar(x.compita_id, x.usuario_id)))
  return f.map((x, i) => ({ abiertas: abiertas[i], id: x.id, compita_id: x.compita_id, compita_nombre: c.get(x.compita_id) ?? '', cliente_nombre: u.get(x.usuario_id) ?? '', motivo: MOTIVOS_REPORTE[x.motivo as MotivoReporte] ?? x.motivo, cuando: x.cuando, esta_bien: x.esta_bien, reincidente: x.reincidente, no_volver: x.no_volver, plazo_llamada: x.plazo_llamada, vencido: new Date(x.plazo_llamada).getTime() < ahora.getTime(), creado_en: x.creado_en }))
}

export const RESULTADOS_LLAMADA = ['resuelto', 'hablar_cliente', 'mantener_bloqueo', 'levantar_bloqueo'] as const
export type ResultadoLlamada = (typeof RESULTADOS_LLAMADA)[number]

/** El equipo ya llamó: queda quién, cuándo y qué se decidió; se cierra la tarea y, si se decidió, se levanta el bloqueo. */
export async function registrarLlamada(reporteId: string, por: string, resultado: ResultadoLlamada, ahora: Date = new Date()): Promise<boolean> {
  const admin = createAdminSupabase()
  const { data: rep } = await admin.from('reportes_compita').update({ llamada_en: ahora.toISOString(), llamada_por: por, resultado }).eq('id', reporteId).is('llamada_en', null).select('compita_id, usuario_id').maybeSingle()
  if (!rep) return false
  const r = rep as { compita_id: string; usuario_id: string }
  if (resultado === 'levantar_bloqueo') await admin.from('bloqueos_compita_cliente').update({ activo: false, levantado_por: por, levantado_en: ahora.toISOString() }).eq('compita_id', r.compita_id).eq('usuario_id', r.usuario_id).eq('activo', true)
  await admin.from('admin_flags').update({ resuelto: true }).eq('tipo', 'reporte_cliente').eq('resuelto', false).like('nota', `%[reporte:${reporteId}]%`)
  await alertaAdmin('actividad', `Llamada al compita registrada por ${por}: ${resultado.replace(/_/g, ' ')}`, { categoria: 'reporte_llamada', entidad: { tipo: 'compita', id: r.compita_id } })
  return true
}

/** Llamadas que se pasaron del plazo: UNA alerta por reporte (la escalera la corre cada 5 minutos). */
export async function escalarLlamadasVencidas(ahora: Date = new Date()): Promise<number> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('reportes_compita').select('id').eq('llamar', true).is('llamada_en', null).is('escalado_en', null).lte('plazo_llamada', ahora.toISOString())
  let n = 0
  for (const r of (data ?? []) as { id: string }[]) {
    const { data: reclamo } = await admin.from('reportes_compita').update({ escalado_en: ahora.toISOString() }).eq('id', r.id).is('escalado_en', null).select('compita_id, usuario_id').maybeSingle()
    if (!reclamo) continue
    const x = reclamo as { compita_id: string; usuario_id: string }
    const [{ data: c }, { data: u }] = await Promise.all([admin.from('compitas').select('nombre').eq('id', x.compita_id).maybeSingle(), admin.from('usuarios').select('nombre').eq('id', x.usuario_id).maybeSingle()])
    const nombre = (c as { nombre: string } | null)?.nombre ?? 'un compita'
    await alertaAdmin('urgente', `<b>Llamada vencida</b>\n\nSe pasó el plazo para llamar a <b>${esc(nombre)}</b> por su reporte sobre <b>${esc((u as { nombre: string } | null)?.nombre ?? 'un cliente')}</b>. El compita está esperando la llamada que se le prometió.`, { categoria: 'reporte_llamada_vencida', clave: `reporte_vencido:${r.id}`, entidad: { tipo: 'compita', id: x.compita_id, nombre: `Llamada vencida: ${nombre}` } })
    n++
  }
  return n
}

/** ¿Este compita no volverá con este cliente? */
export async function parBloqueado(compitaId: string, usuarioId: string): Promise<boolean> {
  const { data } = await createAdminSupabase().from('bloqueos_compita_cliente').select('id').eq('compita_id', compitaId).eq('usuario_id', usuarioId).eq('activo', true).maybeSingle()
  return !!data
}

/** Los compitas que no volverán con este cliente (una consulta, para filtrar el listado). */
export async function compitasBloqueadosPara(usuarioId: string): Promise<Set<string>> {
  const { data } = await createAdminSupabase().from('bloqueos_compita_cliente').select('compita_id').eq('usuario_id', usuarioId).eq('activo', true)
  return new Set(((data ?? []) as { compita_id: string }[]).map((b) => b.compita_id))
}

export async function listarBloqueos(): Promise<{ id: string; compita_id: string; compita_nombre: string; usuario_id: string; cliente_nombre: string; motivo: string; creado_en: string }[]> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('bloqueos_compita_cliente').select('id, compita_id, usuario_id, motivo, creado_en').eq('activo', true).order('creado_en', { ascending: false })
  const filas = (data ?? []) as { id: string; compita_id: string; usuario_id: string; motivo: string; creado_en: string }[]
  if (filas.length === 0) return []
  const [{ data: cs }, { data: us }] = await Promise.all([
    admin.from('compitas').select('id, nombre').in('id', [...new Set(filas.map((f) => f.compita_id))]),
    admin.from('usuarios').select('id, nombre').in('id', [...new Set(filas.map((f) => f.usuario_id))]),
  ])
  const c = new Map(((cs ?? []) as { id: string; nombre: string }[]).map((x) => [x.id, x.nombre]))
  const u = new Map(((us ?? []) as { id: string; nombre: string }[]).map((x) => [x.id, x.nombre]))
  return filas.map((f) => ({ ...f, compita_nombre: c.get(f.compita_id) ?? '', cliente_nombre: u.get(f.usuario_id) ?? '', motivo: MOTIVOS_REPORTE[f.motivo as MotivoReporte] ?? f.motivo }))
}

export async function levantarBloqueo(id: string, por: string): Promise<boolean> {
  const { data } = await createAdminSupabase().from('bloqueos_compita_cliente').update({ activo: false, levantado_por: por, levantado_en: new Date().toISOString() }).eq('id', id).eq('activo', true).select('id').maybeSingle()
  if (data) await alertaAdmin('actividad', `Bloqueo compita-cliente levantado por ${por}`, { categoria: 'bloqueo_levantado' })
  return !!data
}

// ── Lo que sigue abierto entre el par: el equipo decide en la llamada si se cancela ────────────────────────────────
export interface AbiertasDelPar { visitas: { id: string; estado: string; fecha: string | null; cancelable: boolean }[]; solicitudes: { id: string; estado: string }[] }

export async function abiertasDelPar(compitaId: string, usuarioId: string): Promise<AbiertasDelPar> {
  const admin = createAdminSupabase()
  const [{ data: v }, { data: s }] = await Promise.all([
    admin.from('visitas').select('id, estado, fecha_programada').eq('compita_id', compitaId).eq('usuario_id', usuarioId).in('estado', ['pre_visita', 'programada', 'confirmando_inicio', 'en_curso']),
    admin.from('solicitudes').select('id, estado').eq('compita_id', compitaId).eq('cliente_id', usuarioId).in('estado', ['pendiente', 'aceptada']),
  ])
  return {
    // Una visita que ya empezó no se cancela desde aquí: es una situación en vivo.
    visitas: ((v ?? []) as { id: string; estado: string; fecha_programada: string | null }[]).map((x) => ({ id: x.id, estado: x.estado, fecha: x.fecha_programada, cancelable: x.estado === 'pre_visita' || x.estado === 'programada' })),
    solicitudes: (s ?? []) as { id: string; estado: string }[],
  }
}

/**
 * Cancela lo abierto entre el compita y el cliente: la cancelación queda JUSTIFICADA para el compita (no cuenta en su semáforo),
 * a la visita se le devuelve el crédito al cliente (se borra) y el cliente recibe un aviso neutro, sin el motivo.
 */
export async function cancelarAbiertasDelPar(reporteId: string, por: string, ahora: Date = new Date()): Promise<{ visitas: number; solicitudes: number } | null> {
  const admin = createAdminSupabase()
  const { data: rep } = await admin.from('reportes_compita').select('compita_id, usuario_id').eq('id', reporteId).maybeSingle()
  if (!rep) return null
  const { compita_id: compitaId, usuario_id: usuarioId } = rep as { compita_id: string; usuario_id: string }
  const abiertas = await abiertasDelPar(compitaId, usuarioId)
  let visitas = 0; let solicitudes = 0
  for (const v of abiertas.visitas.filter((x) => x.cancelable)) {
    const { data: fila } = await admin.from('visitas').select('id, created_at, fecha_programada, hora_inicio_programada, llegada_en').eq('id', v.id).maybeSingle()
    const vv = fila as { id: string; created_at: string; fecha_programada: string | null; hora_inicio_programada: string | null; llegada_en: string | null } | null
    if (!vv) continue
    const idCanc = await registrarCancelacion({ visitaId: vv.id, compitaId, usuarioId, canceladoPor: 'compita', fechaProgramada: vv.fecha_programada, horaInicioProgramada: vv.hora_inicio_programada, motivo: 'Cancelada por el equipo tras un reporte', visitaCreadaEn: vv.created_at, cuentaComoUsada: false, ahora })
    if (idCanc) await admin.from('cancelaciones').update({ justificada: true, justificada_por: `admin: ${por}`, justificada_en: ahora.toISOString() }).eq('id', idCanc)
    if (vv.llegada_en) await programarBorradoVisita(vv.id, ahora)
    await admin.from('visitas').delete().eq('id', vv.id)
    await notificar({ plantilla: 'cancelacion_equipo_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: usuarioId }, variables: { compitaId, tipo: 'visita' }, entidad: 'cliente', entidadId: usuarioId, paso: 12, claveUnica: `cancel_equipo:${vv.id}` })
    visitas++
  }
  for (const s of abiertas.solicitudes) {
    const { data: ok } = await admin.from('solicitudes').update({ estado: 'rechazada', respondido_at: ahora.toISOString() }).eq('id', s.id).in('estado', ['pendiente', 'aceptada']).select('id').maybeSingle()
    if (!ok) continue
    await admin.from('reservas_horario').update({ estado: 'liberada', resuelta_en: ahora.toISOString() }).eq('solicitud_id', s.id).in('estado', ['reservada', 'confirmada'])
    await notificar({ plantilla: 'cancelacion_equipo_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: usuarioId }, variables: { compitaId, tipo: 'solicitud' }, entidad: 'cliente', entidadId: usuarioId, paso: 12, claveUnica: `cancel_equipo:${s.id}` })
    solicitudes++
  }
  await alertaAdmin('actividad', `${por} canceló lo abierto entre un compita y su cliente tras un reporte: ${visitas} visita(s) y ${solicitudes} solicitud(es).`, { categoria: 'reporte_cancelacion', entidad: { tipo: 'compita', id: compitaId } })
  return { visitas, solicitudes }
}
