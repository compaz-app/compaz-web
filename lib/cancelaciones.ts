// Cancelaciones de visitas: se REGISTRAN siempre (quién, cuándo, con cuántas horas de aviso, motivo y si fue
// justificada) para ver patrones, sobre todo de compitas. Hoy cancelar borra la visita; este registro no depende de
// ella (visita_id no es clave foránea). Los umbrales salen de Ajustes. Ver docs/plan-construccion.md (punto 3).
// Nada de aquí lanza errores hacia el flujo que lo llama: un fallo del registro no debe impedir cancelar.

import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjustes } from '@/lib/ajustes'
import { registrarEvento } from '@/lib/eventos'

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
  ahora?: Date
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

    const { data, error } = await createAdminSupabase().from('cancelaciones').insert({
      visita_id: c.visitaId ?? null,
      solicitud_id: c.solicitudId ?? null,
      compita_id: c.compitaId,
      usuario_id: c.usuarioId,
      cancelado_por: c.canceladoPor,
      horas_de_aviso: aviso,
      tardia,
      motivo: c.motivo ? c.motivo.slice(0, 500) : null,
    }).select('id').single()
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
