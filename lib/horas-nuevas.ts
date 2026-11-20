// Cuando un compita actualiza sus horas libres, los clientes que lo esperaban para elegir hora se enteran. «Esperaban» = solicitud aceptada, sin hora todavía (porque no
// había horas, o porque la que eligieron no le servía). Así el compita puede arreglar su agenda en el momento y el cliente no tiene que acordarse de volver.
import { createAdminSupabase } from '@/lib/supabase-server'
import { generarBloques } from '@/lib/agenda'
import { notificar } from '@/lib/avisos'
import { novedadInformativa } from '@/lib/novedades'
import { esEntrevistaConHoras } from '@/lib/plantillas-aviso'
import type { HorarioDisponible } from '@/types'

export async function horariosDe(compitaId: string): Promise<HorarioDisponible[]> {
  try {
    const { data } = await createAdminSupabase().from('compitas').select('horarios_disponibles').eq('id', compitaId).maybeSingle()
    return ((data as { horarios_disponibles: HorarioDisponible[] | null } | null)?.horarios_disponibles ?? []) as HorarioDisponible[]
  } catch { return [] }
}

/** Las horas que hay ahora y antes no (próximos 14 días). Pura: se prueba sin base. */
export function horasNuevas(antes: HorarioDisponible[] | null | undefined, despues: HorarioDisponible[] | null | undefined, ahora: Date = new Date()): string[] {
  const previas = new Set(generarBloques(antes, ahora).map((b) => b.inicio))
  return generarBloques(despues, ahora).map((b) => b.inicio).filter((i) => !previas.has(i))
}

/** Devuelve a cuántos clientes se les avisó. NUNCA lanza: guardar el perfil no debe fallar por esto. */
export async function avisarHorasNuevas(compitaId: string, antes: HorarioDisponible[], despues: HorarioDisponible[], ahora: Date = new Date()): Promise<number> {
  try {
    const nuevas = horasNuevas(antes, despues, ahora)
    if (nuevas.length === 0) return 0
    const admin = createAdminSupabase()
    const { data: cmp } = await admin.from('compitas').select('nombre').eq('id', compitaId).maybeSingle()
    const primero = String((cmp as { nombre: string } | null)?.nombre ?? 'Tu compita').split(' ')[0]
    const { data } = await admin.from('solicitudes').select('id, cliente_id, tipo, slots_propuestos, estado, slot_confirmado').eq('compita_id', compitaId).eq('estado', 'aceptada').is('slot_confirmado', null)
    let avisados = 0
    for (const s of (data ?? []) as Record<string, unknown>[]) {
      if (!esEntrevistaConHoras(s)) continue
      const id = String(s.id); const cliente = String(s.cliente_id)
      const clave = `horas_actualizadas:${id}:${nuevas[0]}` // una por cada cambio real de horas
      await novedadInformativa({ usuarioId: cliente, tipo: 'horas_actualizadas', nivel: 'accionable', titulo: `${primero} actualizó sus horas. Elige la tuya.`, entidad: 'solicitud', entidadId: id, clave: `novedad:${clave}` })
      await notificar({ plantilla: 'horas_actualizadas', canal: 'correo', destinatario: { tipo: 'cliente', id: cliente }, variables: { solicitudId: id }, entidad: 'solicitud', entidadId: id, paso: 7, claveUnica: clave })
      avisados++
    }
    return avisados
  } catch (e) { console.error('[horas-nuevas] error:', e); return 0 }
}
