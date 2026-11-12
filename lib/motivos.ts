// Motivo cuando alguien dice que no: el cliente al no contratar tras la entrevista y el compita al rechazar una
// solicitud. Es opcional y de un toque. Queda como evento (módulo operación) y es la información que más ayuda a
// mejorar el servicio: por qué se pierde un cliente y por qué un compita rechaza.
// Ver docs/crm-datos-pendientes.md (dato prioritario 2).

import { createAdminSupabase } from '@/lib/supabase-server'
import { registrarEvento, type TipoEvento } from '@/lib/eventos'

export type RolMotivo = 'cliente' | 'compita'

export interface Motivo { id: string; texto: string }

export const MOTIVOS: Record<RolMotivo, Motivo[]> = {
  cliente: [
    { id: 'no_conecte', texto: 'No conecté con esa persona' },
    { id: 'precio', texto: 'El precio' },
    { id: 'prefiero_otro', texto: 'Prefiero conocer a otro compita' },
    { id: 'mas_tiempo', texto: 'Necesito más tiempo para decidir' },
    { id: 'otro', texto: 'Otro motivo' },
  ],
  compita: [
    { id: 'sin_tiempo', texto: 'No tengo tiempo disponible' },
    { id: 'zona', texto: 'La zona me queda lejos' },
    { id: 'horarios', texto: 'Los horarios no me sirven' },
    { id: 'otro', texto: 'Otro motivo' },
  ],
}

const TIPO: Record<RolMotivo, TipoEvento> = { cliente: 'motivo_no_contratar', compita: 'motivo_rechazo' }

export type ResultadoMotivo = 'registrado' | 'duplicado' | 'invalido'

/**
 * Guarda el motivo de un "no". Se guarda una sola vez por solicitud y rol (los eventos no se pueden borrar,
 * así que un segundo toque no suma otro). Nunca lanza.
 */
export async function registrarMotivo(p: {
  solicitudId: string
  rol: RolMotivo
  /** usuarios.id del cliente o compitas.id del compita */
  actorId: string
  motivo: string
}): Promise<ResultadoMotivo> {
  if (!MOTIVOS[p.rol].some((m) => m.id === p.motivo)) return 'invalido'
  try {
    const { data } = await createAdminSupabase()
      .from('eventos').select('id').eq('entidad', 'solicitud').eq('entidad_id', p.solicitudId).eq('tipo', TIPO[p.rol]).limit(1)
    if ((data ?? []).length > 0) return 'duplicado'
    const ok = await registrarEvento({
      entidad: 'solicitud', entidadId: p.solicitudId, tipo: TIPO[p.rol],
      actor: `${p.rol}:${p.actorId}`, datos: { motivo: p.motivo },
    })
    return ok ? 'registrado' : 'invalido'
  } catch (e) {
    console.error('[motivos] error:', e)
    return 'invalido'
  }
}
