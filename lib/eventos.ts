// Registro de eventos de operación (historial inmutable en public.eventos, módulo 'operacion').
// El servidor no puede insertar directo en esa tabla: escribe mediante la función SQL registrar_evento.
// Ver docs/esquema-avisos-eventos.md. Un evento es un hecho ya ocurrido (quién, cuándo y qué).
// REGLA: en `datos` nunca van teléfono, correo ni Telegram de una parte para la otra.

import { createAdminSupabase } from '@/lib/supabase-server'

export type EntidadEvento = 'solicitud' | 'visita' | 'pago' | 'cliente' | 'compita' | 'aviso'

export type TipoEvento =
  | 'solicitud_creada' | 'solicitud_aceptada' | 'solicitud_rechazada' | 'horario_confirmado'
  | 'entrevista_entro' | 'entrevista_terminada' | 'decision_contratar'
  | 'pago_solicitado' | 'pago_confirmado' | 'pago_anulado'
  | 'visita_programada' | 'visita_iniciada' | 'visita_confirmada' | 'visita_terminada'
  | 'calificacion' | 'reporte_enviado' | 'emergencia'
  | 'etapa_cambiada' | 'ayuda_tocada' | 'ayuda_humano' | 'aviso_fallido'
  | 'motivo_no_contratar' | 'motivo_rechazo'
  // Rediseño (Lote 1): se registran desde los lotes siguientes; los tipos existen desde ya para no tocar esto dos veces.
  | 'visita_cancelada' | 'cancelacion_justificada' | 'lugar_personas_cambiadas' | 'pago_insistido' | 'pago_escalado'
  | 'horario_reservado' | 'que_me_toca' | 'recordatorio_al_cliente' | 'direccion_registrada' | 'direccion_entregada' | 'compita_en_camino' | 'entrevista_reagendada' | 'reserva_confirmada' | 'reserva_rechazada' | 'reserva_vencida'
  | 'terminos_aceptados' | 'contacto_bloqueado' | 'llegada_registrada' | 'llegada_sin_acceso' | 'visita_sin_acceso'
  | 'salida_por_seguridad' | 'visita_alargada' | 'reporte_cliente' | 'duda_compita' | 'foto_borrada' | 'cuenta_pausada' | 'cuenta_pausa_decidida' | 'cita_propuesta' | 'cita_confirmada' | 'cita_rechazada' | 'ayuda_cliente'
  | 'eliminacion_solicitada' | 'eliminacion_confirmada' | 'eliminacion_cancelada' | 'cuenta_eliminada' | 'portal_nuevo_cambiado'
  | 'consulta_dato_sensible' | 'ajuste_cambiado'

export type ActorEvento = 'sistema' | `cliente:${string}` | `compita:${string}` | `admin:${string}`

/** Datos planos (sin anidar) para que sea difícil colar información que no corresponde. */
export type DatosEvento = Record<string, string | number | boolean | null>

export interface NuevoEvento {
  entidad: EntidadEvento
  /** uuid de la solicitud, visita, pago, cliente (usuarios.id), compita o aviso */
  entidadId: string
  tipo: TipoEvento
  actor?: ActorEvento
  datos?: DatosEvento
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ClienteRpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> }

/**
 * Registra un evento. Nunca lanza: un fallo del historial no debe romper el flujo que lo origina.
 * Devuelve true si quedó guardado.
 */
export async function registrarEvento(e: NuevoEvento, cliente: ClienteRpc = createAdminSupabase()): Promise<boolean> {
  if (!UUID.test(e.entidadId)) {
    console.error('[eventos] entidadId no es un uuid:', e.tipo, e.entidad)
    return false
  }
  try {
    const { error } = await cliente.rpc('registrar_evento', {
      p_entidad: e.entidad,
      p_entidad_id: e.entidadId,
      p_tipo: e.tipo,
      p_actor: e.actor ?? 'sistema',
      p_datos: e.datos ?? {},
    })
    if (error) {
      console.error('[eventos] no se pudo registrar', e.tipo, error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('[eventos] error registrando', e.tipo, err)
    return false
  }
}
