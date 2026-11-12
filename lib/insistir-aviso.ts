// Insistir con un aviso desde la Bandeja (servidor): reenvía el aviso que la persona no atendió. El reenvío es un aviso NUEVO, ligado al original
// (respaldo_de), con su propia clave y su registro, así queda todo en Avisos y en Actividad. Tiene tope: uno cada 30 minutos y 3 por aviso
// (regla `insistir_aviso` de lib/esperas.ts), para no llenar el Telegram o el correo de nadie.
import { createAdminSupabase } from '@/lib/supabase-server'
import { notificar } from '@/lib/avisos'
import type { NombrePlantilla, VariablesAviso } from '@/lib/plantillas-aviso'
import type { Espera } from '@/lib/esperas'
import { explicarEspera } from '@/lib/esperas'
import { alertaAdmin } from '@/lib/alertas-admin'
import type { Actor } from '@/lib/permisos'
import { puede } from '@/lib/permisos'
import { claseInsistir } from '@/lib/panel-bandeja-tipos'

export const MIN_ENTRE_REENVIOS_MIN = 30
export const MAX_REENVIOS = 3

interface AvisoRaiz { id: string; destinatario_tipo: 'cliente' | 'compita'; destinatario_id: string; canal: 'telegram' | 'correo'; plantilla: string; variables: VariablesAviso; entidad: string | null; entidad_id: string | null; paso: number | null }
interface FlagInsistible { id: string; entidad_tipo: string; entidad_id: string; entidad_nombre: string; tipo: string | null; reportado_por: string }

/** El aviso que no se atendió y que esta tarea quiere reenviar, o null si no hay. Nunca un reenvío anterior ni la marca interna de la escalera. */
export async function avisoParaInsistir(f: Pick<FlagInsistible, 'entidad_tipo' | 'entidad_id'> & { tipo: string | null; reportado_por: string }): Promise<AvisoRaiz | null> {
  const clase = claseInsistir(f)
  if (!clase) return null
  let q = createAdminSupabase().from('avisos')
    .select('id, destinatario_tipo, destinatario_id, canal, plantilla, variables, entidad, entidad_id, paso, clave_unica, programado_para')
    .eq('estado', 'enviado').is('accion_en', null).eq('destinatario_tipo', clase.destinatario).neq('plantilla', 'escalera_tarea')
  q = f.entidad_tipo === 'visita' ? q.eq('entidad', 'visita').eq('entidad_id', f.entidad_id) : q.eq('destinatario_id', f.entidad_id)
  const { data } = await q.order('programado_para', { ascending: false }).limit(10)
  const fila = ((data ?? []) as (AvisoRaiz & { clave_unica: string | null })[]).find((a) => a.destinatario_id && !(a.clave_unica ?? '').startsWith('reenvio:'))
  return fila ?? null
}

export interface EstadoReenvios { usados: number; ultimo: string | null }
export async function reenviosDe(avisoId: string): Promise<EstadoReenvios> {
  const { data } = await createAdminSupabase().from('avisos').select('programado_para').eq('respaldo_de', avisoId).like('clave_unica', 'reenvio:%').order('programado_para', { ascending: false })
  const filas = (data ?? []) as { programado_para: string }[]
  return { usados: filas.length, ultimo: filas[0]?.programado_para ?? null }
}

/** Si ya no se puede insistir, la explicación (qué pasó, por qué y cuándo seguir); si se puede, null. */
export function esperaDeReenvio(r: EstadoReenvios, ahora: Date = new Date()): Espera | null {
  const cada = MIN_ENTRE_REENVIOS_MIN * 60_000
  if (r.usados >= MAX_REENVIOS) return explicarEspera('insistir_aviso', { usados: r.usados, max: MAX_REENVIOS, ahora })
  if (r.ultimo && ahora.getTime() - new Date(r.ultimo).getTime() < cada) return explicarEspera('insistir_aviso', { desde: r.ultimo, duracionMs: cada, usados: r.usados, ahora })
  return null
}

export type ResultadoInsistir = { ok: true; reenvios: number } | { ok: false; error: string; status: number; espera?: Espera }

export async function insistirDeTarea(actor: Actor, flagId: string, ahora: Date = new Date()): Promise<ResultadoInsistir> {
  if (!puede(actor, 'atender')) return { ok: false, error: 'Acceso denegado', status: 403 }
  const { data: flag } = await createAdminSupabase().from('admin_flags').select('id, entidad_tipo, entidad_id, entidad_nombre, tipo, reportado_por, resuelto').eq('id', flagId).maybeSingle()
  const f = flag as (FlagInsistible & { resuelto: boolean }) | null
  if (!f || f.resuelto || !claseInsistir(f)) return { ok: false, error: 'La tarea no existe o ya se resolvió', status: 404 }
  const aviso = await avisoParaInsistir(f)
  if (!aviso) return { ok: false, error: 'No hay un aviso pendiente que reenviar. Escríbele directamente.', status: 404 }
  const previos = await reenviosDe(aviso.id)
  const espera = esperaDeReenvio(previos, ahora)
  if (espera) return { ok: false, error: espera.resumen, status: 429, espera }

  const n = previos.usados + 1
  const r = await notificar({
    plantilla: aviso.plantilla as NombrePlantilla, canal: aviso.canal, destinatario: { tipo: aviso.destinatario_tipo, id: aviso.destinatario_id }, variables: aviso.variables,
    entidad: (aviso.entidad ?? undefined) as never, entidadId: aviso.entidad_id ?? undefined, paso: aviso.paso ?? undefined, claveUnica: `reenvio:${aviso.id}:${n}`, respaldoDe: aviso.id,
  })
  if (!r.ok) return { ok: false, error: r.error === 'sin Telegram vinculado' ? 'El compita no tiene Telegram vinculado, así que el aviso no se pudo entregar. Escríbele por otro medio.' : `No se pudo reenviar el aviso: ${r.error ?? 'error desconocido'}`, status: 502 }
  await alertaAdmin('actividad', `${actor.correo} insistió con un aviso (${aviso.canal}) a ${aviso.destinatario_tipo === 'compita' ? 'un compita' : 'un cliente'}: ${f.entidad_nombre}. Reenvío ${n} de ${MAX_REENVIOS}.`, { categoria: 'aviso_reenviado', entidad: { tipo: aviso.destinatario_tipo, id: aviso.destinatario_id } })
  return { ok: true, reenvios: n }
}
