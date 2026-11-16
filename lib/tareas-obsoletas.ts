// Las tareas de la Bandeja se cierran SOLAS cuando lo que las originó ya se resolvió (regla 6 del ciclo: si ya pasó, el aviso muere). Antes una tarea de
// «cita sin confirmar» seguía abierta aunque la cita ya se hubiera confirmado y hecho. Dos caminos:
//  1. En el momento: quien resuelve (el compita confirma, rechaza, el cliente cambia la hora) cierra su tarea.
//  2. Barrido (la escalera, cada 5 minutos): cierra lo que haya quedado abierto por cualquier otro camino, y también lo viejo.
import { createAdminSupabase } from '@/lib/supabase-server'
import { versionCita } from '@/lib/citas-version'

type Admin = ReturnType<typeof createAdminSupabase>

/** La clave de la tarea va en la nota como «[cita:<visita>:<versión>]» (la pone alertaAdmin). */
export const CLAVE_CITA = /\[cita:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([^\]]*)\]/i

const cerrar = (admin: Admin, ids: string[]) =>
  ids.length ? admin.from('admin_flags').update({ resuelto: true, resuelto_at: new Date().toISOString() }).in('id', ids).eq('resuelto', false) : Promise.resolve()

/**
 * ¿Sigue vigente la propuesta que originó la tarea? Solo si la visita sigue en coordinación o programada, con una propuesta pendiente y es LA MISMA propuesta
 * (misma versión). Si no, la cita ya se resolvió (o cambió) y insistirle al compita sería mandarle algo viejo.
 */
export const citaVigente = (v: { estado: string; cita_propuesta_en: string | null } | undefined | null, version: string) =>
  !!v && ['pre_visita', 'programada'].includes(v.estado) && !!v.cita_propuesta_en && versionCita(v.cita_propuesta_en) === version

/** De la nota de una tarea de «cita sin confirmar»: a qué visita y a qué propuesta (versión) se refiere. */
export function claveDeTareaCita(nota: string | null | undefined): { visitaId: string; version: string } | null {
  const m = CLAVE_CITA.exec(nota ?? '')
  return m ? { visitaId: m[1], version: m[2] } : null
}

/** La cita de esa visita se resolvió (confirmada, rechazada o cambiada): se cierran sus tareas de «cita sin confirmar». */
export async function cerrarTareasDeCita(visitaId: string, admin: Admin = createAdminSupabase()): Promise<void> {
  try {
    await admin.from('admin_flags').update({ resuelto: true, resuelto_at: new Date().toISOString() }).eq('tipo', 'cita_sin_confirmar').eq('resuelto', false).like('nota', `%[cita:${visitaId}:%`)
  } catch (e) { console.error('[tareas] no se pudo cerrar la tarea de la cita:', e) }
}

/** El compita tiene Telegram y se le pudo avisar de una cita: la tarea de «arreglar su Telegram» ya no hace falta. */
export async function cerrarTareasSinTelegram(compitaId: string, admin: Admin = createAdminSupabase()): Promise<void> {
  try {
    await admin.from('admin_flags').update({ resuelto: true, resuelto_at: new Date().toISOString() }).eq('tipo', 'cita_sin_telegram').eq('resuelto', false).eq('entidad_id', compitaId)
  } catch (e) { console.error('[tareas] no se pudo cerrar la tarea de Telegram:', e) }
}

export interface ResultadoObsoletas { citas: number; sinTelegram: number }

/** Barrido: cierra las tareas de cita que ya no tienen una propuesta vigente y las de Telegram que ya se arreglaron. */
export async function cerrarTareasObsoletas(admin: Admin = createAdminSupabase()): Promise<ResultadoObsoletas> {
  const r: ResultadoObsoletas = { citas: 0, sinTelegram: 0 }
  try {
    const { data: abiertas } = await admin.from('admin_flags').select('id, nota').eq('tipo', 'cita_sin_confirmar').eq('resuelto', false).limit(200)
    const filas = ((abiertas ?? []) as { id: string; nota: string }[]).map((f) => ({ id: f.id, m: CLAVE_CITA.exec(f.nota ?? '') })).filter((f): f is { id: string; m: RegExpExecArray } => !!f.m)
    if (filas.length) {
      const { data: visitas } = await admin.from('visitas').select('id, estado, cita_propuesta_en').in('id', [...new Set(filas.map((f) => f.m[1]))])
      const porId = new Map(((visitas ?? []) as { id: string; estado: string; cita_propuesta_en: string | null }[]).map((v) => [v.id, v]))
      const obsoletas = filas.filter((f) => !citaVigente(porId.get(f.m[1]), f.m[2])).map((f) => f.id)
      await cerrar(admin, obsoletas); r.citas = obsoletas.length
    }

    const { data: sinTel } = await admin.from('admin_flags').select('id, entidad_id').eq('tipo', 'cita_sin_telegram').eq('resuelto', false).limit(200)
    const lista = (sinTel ?? []) as { id: string; entidad_id: string }[]
    if (lista.length) {
      const { data: compitas } = await admin.from('compitas').select('id, telegram_chat_id').in('id', lista.map((f) => f.entidad_id))
      const conTelegram = new Set(((compitas ?? []) as { id: string; telegram_chat_id: string | null }[]).filter((c) => !!c.telegram_chat_id).map((c) => c.id))
      const resueltas = lista.filter((f) => conTelegram.has(f.entidad_id)).map((f) => f.id)
      await cerrar(admin, resueltas); r.sinTelegram = resueltas.length
    }
  } catch (e) { console.error('[tareas] barrido de tareas obsoletas:', e) }
  return r
}
