// Cancelaciones de visitas: se REGISTRAN siempre (quién, cuándo, con cuántas horas de aviso, motivo y si fue
// justificada) para ver patrones, sobre todo de compitas. Hoy cancelar borra la visita; este registro no depende de
// ella (visita_id no es clave foránea). Los umbrales salen de Ajustes. Ver docs/plan-construccion.md (punto 3).
// Nada de aquí lanza errores hacia el flujo que lo llama: un fallo del registro no debe impedir cancelar.

import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjustes } from '@/lib/ajustes'
import { registrarEvento } from '@/lib/eventos'
import { avisarAdmin } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { esc } from '@/lib/html'

export type CanceladoPor = 'cliente' | 'compita' | 'admin' | 'sistema'

export interface NuevaCancelacion {
  visitaId?: string | null
  solicitudId?: string | null
  compitaId: string | null
  usuarioId: string | null
  canceladoPor: CanceladoPor
  /** Fecha y hora de la visita cancelada, en hora de Venezuela (como se guardan en `visitas`). */
  fechaProgramada?: string | null
  horaInicioProgramada?: string | null
  /** Texto libre del cliente: se guarda solo en la tabla (la ve el administrador), nunca en el evento. */
  motivo?: string | null
  /** Cuándo se creó la visita: hace falta para descontarla del saldo si cuenta como usada (la visita se borra). */
  visitaCreadaEn?: string | null
  /** Fuerza que cuente como usada (por ejemplo "sin acceso": nadie abrió). Si no se indica, solo cuenta la cancelación tardía del cliente. */
  cuentaComoUsada?: boolean
  ahora?: Date
}

export interface EvaluacionCancelacion {
  /** Horas que faltan para la visita (null si aún no tiene fecha: está en coordinación). */
  horasDeAviso: number | null
  /** Horas mínimas de aviso para cancelar gratis (Ajustes). */
  minimo: number
  /** Cancelar ahora cuesta la visita (menos aviso que el mínimo). */
  cuentaComoUsada: boolean
}

/** Qué pasaría si el cliente cancelara ahora. Sin fecha no hay costo: no hay nada que perder todavía. */
export async function evaluarCancelacionCliente(fecha: string | null | undefined, hora: string | null | undefined, ahora: Date = new Date()): Promise<EvaluacionCancelacion> {
  const minimo = Number((await getAjustes()).cancelacion_gratis_horas)
  const horas = horasDeAviso(fecha, hora, ahora)
  return { horasDeAviso: horas, minimo, cuentaComoUsada: horas !== null && horas < minimo }
}

/** Horas que faltaban para la visita al cancelar. null si la visita aún no tiene fecha (está en coordinación). */
export function horasDeAviso(fecha: string | null | undefined, hora: string | null | undefined, ahora: Date = new Date()): number | null {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null
  const h = hora && /^\d{2}:\d{2}/.test(hora) ? hora.slice(0, 5) : '00:00'
  const inicio = new Date(`${fecha}T${h}:00-04:00`) // hora de Venezuela, UTC-4 todo el año
  if (Number.isNaN(inicio.getTime())) return null
  return Math.round(((inicio.getTime() - ahora.getTime()) / 3_600_000) * 10) / 10
}

/** Registra una cancelación. Devuelve el id o null si no se pudo guardar. */
export async function registrarCancelacion(c: NuevaCancelacion): Promise<string | null> {
  try {
    const ajustes = await getAjustes()
    const aviso = horasDeAviso(c.fechaProgramada, c.horaInicioProgramada, c.ahora)
    const minimo = c.canceladoPor === 'compita' ? Number(ajustes.compita_aviso_minimo_horas)
      : c.canceladoPor === 'cliente' ? Number(ajustes.cancelacion_gratis_horas) : null
    // Tardía: se canceló con menos aviso que el mínimo. Sin fecha no hay forma de saberlo, así que no cuenta.
    const tardia = minimo !== null && aviso !== null && aviso < minimo

    const fila = {
      visita_id: c.visitaId ?? null,
      solicitud_id: c.solicitudId ?? null,
      compita_id: c.compitaId,
      usuario_id: c.usuarioId,
      cancelado_por: c.canceladoPor,
      horas_de_aviso: aviso,
      tardia,
      motivo: c.motivo ? c.motivo.slice(0, 500) : null,
    }
    const admin = createAdminSupabase()
    // Solo cancela el cliente con poco aviso la visita que cuenta como usada.
    let { data, error } = await admin.from('cancelaciones').insert({
      ...fila, cuenta_como_usada: c.cuentaComoUsada ?? (c.canceladoPor === 'cliente' && tardia), visita_creada_en: c.visitaCreadaEn ?? null,
    }).select('id').single()
    // Si la migración de las columnas nuevas aún no está aplicada, igual se registra la cancelación (sin ese dato).
    if (error && /cuenta_como_usada|visita_creada_en/.test(error.message)) {
      ;({ data, error } = await admin.from('cancelaciones').insert(fila).select('id').single())
    }
    if (error || !data) { console.error('[cancelaciones] no se pudo registrar:', error?.message); return null }

    if (c.visitaId) {
      await registrarEvento({
        entidad: 'visita', entidadId: c.visitaId, tipo: 'visita_cancelada', actor: c.canceladoPor === 'cliente' && c.usuarioId ? `cliente:${c.usuarioId}` : c.canceladoPor === 'compita' && c.compitaId ? `compita:${c.compitaId}` : 'sistema',
        datos: { cancelado_por: c.canceladoPor, horas_de_aviso: aviso, tardia },
      })
    }
    return (data as { id: string }).id
  } catch (e) {
    console.error('[cancelaciones] error registrando:', e)
    return null
  }
}

/** El administrador marca una cancelación como justificada (o quita la marca). Queda como evento. */
export async function marcarJustificada(p: { id: string; justificada: boolean; actor: string }): Promise<boolean> {
  try {
    const admin = createAdminSupabase()
    const { data, error } = await admin.from('cancelaciones').update({
      justificada: p.justificada,
      justificada_por: p.justificada ? p.actor : null,
      justificada_en: p.justificada ? new Date().toISOString() : null,
    }).eq('id', p.id).select('compita_id').maybeSingle()
    if (error || !data) { console.error('[cancelaciones] justificar:', error?.message); return false }
    const compitaId = (data as { compita_id: string | null }).compita_id
    if (compitaId) {
      await registrarEvento({ entidad: 'compita', entidadId: compitaId, tipo: 'cancelacion_justificada', actor: p.actor.startsWith('admin:') ? (p.actor as `admin:${string}`) : `admin:${p.actor}`, datos: { cancelacion_id: p.id, justificada: p.justificada } })
    }
    return true
  } catch (e) {
    console.error('[cancelaciones] error justificando:', e)
    return false
  }
}

export interface ResumenCancelaciones {
  total: number
  tardias: number
  /** Tardías que NO están justificadas: las únicas que cuentan en contra del compita. */
  cuentanContra: number
  nivel: 'normal' | 'revision' | 'pausa'
}

/** Resumen de las cancelaciones de un compita en la ventana de Ajustes, y el nivel que le corresponde. */
export async function resumenCancelacionesCompita(compitaId: string, ahora: Date = new Date()): Promise<ResumenCancelaciones> {
  const vacio: ResumenCancelaciones = { total: 0, tardias: 0, cuentanContra: 0, nivel: 'normal' }
  try {
    const a = await getAjustes()
    const desde = new Date(ahora.getTime() - Number(a.canc_ventana_dias) * 86_400_000).toISOString()
    const { data, error } = await createAdminSupabase().from('cancelaciones')
      .select('tardia, justificada').eq('compita_id', compitaId).eq('cancelado_por', 'compita').gte('creado_en', desde)
    if (error) { console.error('[cancelaciones] resumen:', error.message); return vacio }
    const filas = (data ?? []) as { tardia: boolean; justificada: boolean }[]
    const cuentanContra = filas.filter((f) => f.tardia && !f.justificada).length
    const nivel = cuentanContra >= Number(a.canc_pausa) ? 'pausa' : cuentanContra >= Number(a.canc_revision) ? 'revision' : 'normal'
    return { total: filas.length, tardias: filas.filter((f) => f.tardia).length, cuentanContra, nivel }
  } catch (e) {
    console.error('[cancelaciones] error en resumen:', e)
    return vacio
  }
}

/**
 * Fechas de creación de las visitas que el cliente canceló con poco aviso y siguen contando como usadas (no justificadas).
 * Se suman a las visitas reales al calcular su saldo. Si la columna aún no existe devuelve vacío (no rompe el saldo).
 */
export async function visitasConsumidasPorCancelacion(usuarioId: string): Promise<string[]> {
  try {
    const { data, error } = await createAdminSupabase().from('cancelaciones')
      .select('visita_creada_en').eq('usuario_id', usuarioId).eq('cuenta_como_usada', true).eq('justificada', false)
    if (error) { console.error('[cancelaciones] consumidas:', error.message); return [] }
    return ((data ?? []) as { visita_creada_en: string | null }[]).map((f) => f.visita_creada_en).filter((x): x is string => !!x)
  } catch (e) {
    console.error('[cancelaciones] error leyendo consumidas:', e)
    return []
  }
}

/** ¿Este compita está en pausa por cancelaciones tardías? (Derivado de las cancelaciones: justificar una lo levanta solo.) */
export async function compitaEnPausa(compitaId: string): Promise<boolean> {
  return (await resumenCancelacionesCompita(compitaId)).nivel === 'pausa'
}

/**
 * Tras una cancelación del compita: si llegó a "revisión" o "pausa" abre UNA tarea para el equipo (y avisa por Telegram).
 * No repite mientras haya una tarea sin resolver del mismo compita.
 */
export async function alertarCancelacionesCompita(compitaId: string, nombre: string): Promise<'normal' | 'revision' | 'pausa'> {
  const r = await resumenCancelacionesCompita(compitaId)
  if (r.nivel === 'normal') return 'normal'
  try {
    const admin = createAdminSupabase()
    const { data: abiertas } = await admin.from('admin_flags').select('id, nota').eq('entidad_tipo', 'compita').eq('entidad_id', compitaId).eq('tipo', 'cancelacion_tardia').eq('resuelto', false)
    const yaPausa = ((abiertas ?? []) as { nota: string }[]).some((f) => f.nota.startsWith('PAUSA'))
    // Una tarea abierta de pausa cubre todo; una de revisión se reemplaza solo si ahora toca pausa.
    if ((abiertas ?? []).length > 0 && (r.nivel === 'revision' || yaPausa)) return r.nivel
    const pausa = r.nivel === 'pausa'
    await admin.from('admin_flags').insert({
      entidad_tipo: 'compita', entidad_id: compitaId, entidad_nombre: `${pausa ? '⛔' : '⚠️'} Cancelaciones tardías: ${nombre}`,
      nota: pausa
        ? `PAUSA: ${nombre} suma ${r.cuentanContra} cancelaciones tardías sin justificar. Sus solicitudes nuevas están en pausa hasta que el equipo hable con esta persona y justifique o resuelva.`
        : `REVISIÓN: ${nombre} suma ${r.cuentanContra} cancelaciones tardías sin justificar. Conviene hablar con esta persona antes de que se pausen sus solicitudes nuevas.`,
      reportado_por: 'cancelaciones automáticas', resuelto: false, tipo: 'cancelacion_tardia', prioridad: pausa ? 1 : 2,
    })
    await alertaAdmin('actividad', `${pausa ? '⛔' : '⚠️'} <b>Cancelaciones tardías de ${esc(nombre)}</b>\n\n${r.cuentanContra} sin justificar. ${pausa ? 'Sus solicitudes nuevas quedaron en pausa.' : 'Abrimos una tarea de revisión en la Bandeja.'}`)
  } catch (e) {
    console.error('[cancelaciones] no se pudo alertar:', e)
  }
  return r.nivel
}

/**
 * Cuáles de estos compitas están en pausa por cancelaciones tardías (una sola consulta para todos, para el listado).
 * Misma regla que `resumenCancelacionesCompita`: tardías sin justificar en la ventana de Ajustes >= `canc_pausa`.
 */
export async function compitasEnPausa(ids: string[], ahora: Date = new Date()): Promise<Set<string>> {
  const enPausa = new Set<string>()
  if (ids.length === 0) return enPausa
  try {
    const a = await getAjustes()
    const desde = new Date(ahora.getTime() - Number(a.canc_ventana_dias) * 86_400_000).toISOString()
    const { data, error } = await createAdminSupabase().from('cancelaciones')
      .select('compita_id').in('compita_id', ids).eq('cancelado_por', 'compita').eq('tardia', true).eq('justificada', false).gte('creado_en', desde)
    if (error) { console.error('[cancelaciones] pausa en lote:', error.message); return enPausa }
    const cuenta = new Map<string, number>()
    for (const f of (data ?? []) as { compita_id: string }[]) cuenta.set(f.compita_id, (cuenta.get(f.compita_id) ?? 0) + 1)
    for (const [id, n] of cuenta) if (n >= Number(a.canc_pausa)) enPausa.add(id)
  } catch (e) {
    console.error('[cancelaciones] error calculando pausas:', e)
  }
  return enPausa
}
