// En qué paso está el cliente AHORA. Se deriva del ESTADO REAL (solicitudes, reservas, pagos, visitas, cancelaciones) cada vez que se
// consulta: no se guarda nada, así el portal nunca puede mostrar algo viejo. Es el equivalente de "¿Qué me toca?" del compita.
//
// Dos piezas separadas a propósito:
//   cargarFoto(clienteId)      lee la base y arma una "foto" simple (el único lugar que toca la base).
//   decidirEstado(foto)        función PURA: la misma foto siempre da el mismo estado. Se prueba sin base de datos, caso por caso.
// El portal solo dibuja lo que esta función decide (los textos y botones de cada estado viven en lib/portal-estados.ts).
//
// REGLA: nunca queda "sin estado". Si la foto no encaja en nada, cae en 'bienvenida' (elegir un compita), que siempre tiene una acción útil.

import { createAdminSupabase } from '@/lib/supabase-server'
import { cupoDelPlan } from '@/lib/visitas'
import { fichaCompleta } from '@/lib/ficha'
import { personaPausada } from '@/lib/pausas'

/** Los pasos de la barra de progreso del portal, en orden. */
export const PASOS_PORTAL = ['Elegir', 'Entrevista', 'Decidir', 'Pagar', 'Ficha', 'Visitas'] as const

export const CODIGOS_ESTADO = [
  // 0 Elegir
  'bienvenida', 'solicitud_enviada', 'solicitud_recibida', 'directa_enviada', 'mandado_enviado', 'todas_rechazadas',
  // 1 Entrevista
  'elegir_horario', 'horario_pedido', 'horario_rechazado', 'entrevista_programada', 'entrevista_ahora',
  // 2 Decidir
  'decidir', 'motivo_no',
  // 3 Pagar
  'directa_aceptada', 'pagar', 'pago_revision', 'ficha_lista_espera',
  // 4 Ficha
  'ficha',
  // 5 Visitas
  'agendar_visita', 'cita_pendiente', 'visita_programada', 'compita_llego', 'nadie_abre', 'visita_en_curso', 'visita_interrumpida', 'visita_cancelada_equipo',
  'visita_terminada', 'agendar_otra', 'plan_agotado', 'cuenta_pausada',
] as const
export type CodigoEstado = (typeof CODIGOS_ESTADO)[number]

// ── La foto ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface SolicitudFoto {
  id: string; estado: string; tipo: string | null; compitaId: string; compitaNombre: string
  slotConfirmado: string | null; slotsPropuestos: number; seguimientoEnviado: boolean; tokenRespuesta: boolean
  /** El token de la sala de la entrevista (para el enlace de entrada del cliente). */
  token?: string | null
  /** true si el cliente dijo que NO contrata tras la entrevista. */
  clienteDijoNo: boolean; motivoRegistrado: boolean
  /** El aviso de "nueva solicitud" ya le llegó al compita. */
  avisoEntregado: boolean
  /** Última reserva de hora de esta solicitud. */
  reserva: 'reservada' | 'confirmada' | 'rechazada' | 'liberada' | 'vencida' | null
  creadaEn: string
}
export interface VisitaFoto {
  id: string; estado: string; compitaNombre: string
  fechaProgramada: string | null; horaInicio: string | null
  llegadaEn: string | null; sinAccesoEn: string | null; fin: string | null; creadaEn: string
  /** Hora que el cliente propuso y que el compita aún no confirma. */
  citaPropuesta?: { fecha: string; inicio: string } | null
}
export interface CancelacionFoto { visitaId: string | null; por: 'cliente' | 'compita' | 'admin' | 'sistema'; justificadaPor: string | null; creadaEn: string }
export interface FotoCliente {
  ahora: Date
  /** La cuenta está en pausa por compartir contactos (tabla pausas_contacto) hasta que el equipo decida. */
  pausada: boolean
  fichaCompleta: boolean
  /** Zona horaria del cliente (para mostrar la hora de las citas en su hora y en la de Caracas). */
  zonaHoraria: string | null
  nombre: string
  /** Compita asignado al contratar (el que ya lo conoce). */
  compitaAsignado: { id: string; nombre: string } | null
  solicitudes: SolicitudFoto[]
  pagoPendiente: { id: string; insistido: boolean } | null
  /** Visitas que le quedan por usar (null si nunca tuvo un plan). */
  cupo: { restantes: number } | null
  visitas: VisitaFoto[]
  cancelaciones: CancelacionFoto[]
}

export interface EstadoCliente {
  codigo: CodigoEstado
  /** Índice en PASOS_PORTAL. */
  paso: number
  solicitudId?: string
  visitaId?: string
  compitaNombre?: string
  /** Inicio de la entrevista o de la visita (ISO), si aplica. */
  cuando?: string
  /** Token de la sala de la entrevista (solo en 'entrevista_ahora'). */
  sala?: string
}

const PASO: Record<CodigoEstado, number> = {
  bienvenida: 0, solicitud_enviada: 0, solicitud_recibida: 0, directa_enviada: 0, mandado_enviado: 0, todas_rechazadas: 0,
  elegir_horario: 1, horario_pedido: 1, horario_rechazado: 1, entrevista_programada: 1, entrevista_ahora: 1,
  decidir: 2, motivo_no: 2,
  directa_aceptada: 3, pagar: 3, pago_revision: 3, ficha_lista_espera: 3,
  ficha: 4,
  agendar_visita: 5, cita_pendiente: 5, visita_programada: 5, compita_llego: 5, nadie_abre: 5, visita_en_curso: 5, visita_interrumpida: 5, visita_cancelada_equipo: 5,
  visita_terminada: 5, agendar_otra: 5, plan_agotado: 5, cuenta_pausada: 5,
}
export const pasoDe = (c: CodigoEstado) => PASO[c]

const MIN = 60_000; const HORA = 3_600_000
/** Inicio de una visita (fecha y hora de Venezuela, UTC-4 todo el año) como instante. */
export const inicioVisita = (v: Pick<VisitaFoto, 'fechaProgramada' | 'horaInicio'>): Date | null =>
  v.fechaProgramada ? new Date(`${v.fechaProgramada}T${(v.horaInicio ?? '00:00').slice(0, 5)}:00-04:00`) : null

// Ventanas (en minutos) alrededor de la hora de una entrevista.
const ENTREVISTA_ANTES_MIN = 60   // desde 1 hora antes aparece "es ahora" con el botón de entrar
const ENTREVISTA_DURACION_MIN = 25 // 20 de llamada + 5 de margen: después toca decidir
const AVISO_CANCELACION_H = 72     // cuánto tiempo se muestra "tu visita se canceló / se interrumpió"
const VISITA_TERMINADA_H = 12      // cuánto tiempo se muestra "¿cómo te fue?" tras terminar

const e = (codigo: CodigoEstado, extra: Partial<EstadoCliente> = {}): EstadoCliente => ({ codigo, paso: PASO[codigo], ...extra })
const masReciente = <T extends { creadaEn: string }>(l: T[]) => [...l].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))[0]

/** Función PURA: decide el estado del cliente a partir de la foto. El orden importa: primero lo que pasa en vivo, al final lo de siempre. */
export function decidirEstado(f: FotoCliente): EstadoCliente {
  const ahora = f.ahora.getTime()
  if (f.pausada) return e('cuenta_pausada')

  // 1. Una visita en vivo manda sobre todo lo demás.
  const enCurso = f.visitas.find((v) => v.estado === 'en_curso')
  if (enCurso) return e('visita_en_curso', { visitaId: enCurso.id, compitaNombre: enCurso.compitaNombre })
  const llego = f.visitas.find((v) => v.estado === 'confirmando_inicio')
  if (llego) return e('compita_llego', { visitaId: llego.id, compitaNombre: llego.compitaNombre })
  const sinAcceso = f.visitas.find((v) => v.estado === 'programada' && v.llegadaEn && v.sinAccesoEn)
  if (sinAcceso) return e('nadie_abre', { visitaId: sinAcceso.id, compitaNombre: sinAcceso.compitaNombre })

  // 2. Visitas por venir. Una hora propuesta que el compita aún no confirma va primero: es lo que el cliente está esperando.
  const propuesta = f.visitas.find((v) => (v.estado === 'pre_visita' || v.estado === 'programada') && v.citaPropuesta)
  if (propuesta) return e('cita_pendiente', { visitaId: propuesta.id, compitaNombre: propuesta.compitaNombre, cuando: inicioVisita({ fechaProgramada: propuesta.citaPropuesta!.fecha, horaInicio: propuesta.citaPropuesta!.inicio })?.toISOString() })
  const programada = f.visitas.filter((v) => v.estado === 'programada').sort((a, b) => (inicioVisita(a)?.getTime() ?? 0) - (inicioVisita(b)?.getTime() ?? 0))[0]
  if (programada) return e('visita_programada', { visitaId: programada.id, compitaNombre: programada.compitaNombre, cuando: inicioVisita(programada)?.toISOString() })
  const pre = f.visitas.find((v) => v.estado === 'pre_visita')
  if (pre) {
    // Sin ficha completa no se puede agendar: primero la ficha.
    if (!f.fichaCompleta) return e('ficha', { visitaId: pre.id, compitaNombre: pre.compitaNombre })
    return e('agendar_visita', { visitaId: pre.id, compitaNombre: pre.compitaNombre })
  }

  // 3. Algo se interrumpió o se canceló hace poco (y no hay una visita nueva).
  const reciente = masReciente(f.cancelaciones.filter((c) => ahora - new Date(c.creadaEn).getTime() < AVISO_CANCELACION_H * HORA && (c.justificadaPor ?? '').length > 0))
  if (reciente) {
    if ((reciente.justificadaPor ?? '').startsWith('sistema: salida por seguridad')) return e('visita_interrumpida', { visitaId: reciente.visitaId ?? undefined })
    if ((reciente.justificadaPor ?? '').startsWith('admin')) return e('visita_cancelada_equipo', { visitaId: reciente.visitaId ?? undefined })
  }

  // 4. La última visita terminó hace poco: "¿cómo te fue?".
  const terminada = masReciente(f.visitas.filter((v) => v.estado === 'terminada' && ahora - new Date(v.fin ?? v.creadaEn).getTime() < VISITA_TERMINADA_H * HORA))
  if (terminada) return e('visita_terminada', { visitaId: terminada.id, compitaNombre: terminada.compitaNombre })

  // 5. Pago: pedido, avisado como hecho, o falta pedirlo.
  if (f.pagoPendiente) {
    // "Ya hice el pago": en revisión. Si la ficha ya está, solo falta que confirmemos; si no, se le invita a completarla mientras tanto.
    if (f.pagoPendiente.insistido) return e(f.fichaCompleta ? 'ficha_lista_espera' : 'pago_revision')
    return e('pagar')
  }

  // 6. Decisión tras la entrevista.
  const sinCompita = f.solicitudes.filter((s) => s.compitaId !== f.compitaAsignado?.id)
  const tras = (s: SolicitudFoto) => s.slotConfirmado ? ahora >= new Date(s.slotConfirmado).getTime() + ENTREVISTA_DURACION_MIN * MIN : false
  const porDecidir = sinCompita.find((s) => s.tokenRespuesta && (s.estado === 'completada' || (s.estado === 'aceptada' && (s.seguimientoEnviado || tras(s)))))
  if (porDecidir) return e('decidir', { solicitudId: porDecidir.id, compitaNombre: porDecidir.compitaNombre })
  const dijoNo = masReciente(sinCompita.filter((s) => s.clienteDijoNo && !s.motivoRegistrado && ahora - new Date(s.creadaEn).getTime() < 7 * 24 * HORA))
  if (dijoNo) return e('motivo_no', { solicitudId: dijoNo.id, compitaNombre: dijoNo.compitaNombre })

  // 7. Entrevistas: confirmada (por venir o ahora), con hora pedida, o por elegir hora.
  const conHora = f.solicitudes.filter((s) => s.estado === 'aceptada' && s.slotConfirmado).sort((a, b) => a.slotConfirmado!.localeCompare(b.slotConfirmado!))[0]
  if (conHora) {
    const t = new Date(conHora.slotConfirmado!).getTime()
    const base = { solicitudId: conHora.id, compitaNombre: conHora.compitaNombre, cuando: conHora.slotConfirmado!, ...(conHora.token ? { sala: conHora.token } : {}) }
    return ahora >= t - ENTREVISTA_ANTES_MIN * MIN ? e('entrevista_ahora', base) : e('entrevista_programada', base)
  }
  const sinHora = f.solicitudes.find((s) => s.estado === 'aceptada' && s.tipo === 'entrevista' && !s.slotConfirmado && s.slotsPropuestos === 0)
  if (sinHora) {
    if (sinHora.reserva === 'reservada') return e('horario_pedido', { solicitudId: sinHora.id, compitaNombre: sinHora.compitaNombre })
    if (sinHora.reserva === 'rechazada') return e('horario_rechazado', { solicitudId: sinHora.id, compitaNombre: sinHora.compitaNombre })
    return e('elegir_horario', { solicitudId: sinHora.id, compitaNombre: sinHora.compitaNombre })
  }
  const directaAceptada = f.solicitudes.find((s) => s.estado === 'aceptada' && s.tipo === 'directa')
  if (directaAceptada && !f.cupo) return e('directa_aceptada', { solicitudId: directaAceptada.id, compitaNombre: directaAceptada.compitaNombre })

  // 8. Solicitudes que esperan al compita.
  const pendiente = masReciente(f.solicitudes.filter((s) => s.estado === 'pendiente'))
  if (pendiente) {
    const base = { solicitudId: pendiente.id, compitaNombre: pendiente.compitaNombre }
    if (pendiente.tipo === 'directa') return e('directa_enviada', base)
    if (pendiente.tipo === 'mandado') return e('mandado_enviado', base)
    return e(pendiente.avisoEntregado ? 'solicitud_recibida' : 'solicitud_enviada', base)
  }

  // 9. Con compita y plan: seguir agendando.
  if (f.compitaAsignado) {
    if (!f.fichaCompleta) return e('ficha', { compitaNombre: f.compitaAsignado.nombre })
    if (f.cupo && f.cupo.restantes <= 0) return e('plan_agotado', { compitaNombre: f.compitaAsignado.nombre })
    return e('agendar_otra', { compitaNombre: f.compitaAsignado.nombre })
  }
  if (f.solicitudes.length > 0 && f.solicitudes.every((s) => s.estado === 'rechazada')) return e('todas_rechazadas')

  return e('bienvenida')
}

// ── La carga (única parte que toca la base) ────────────────────────────────────────────────────────────────────
export async function cargarFoto(clienteId: string, ahora: Date = new Date()): Promise<FotoCliente> {
  const admin = createAdminSupabase()
  const hace30 = new Date(ahora.getTime() - 30 * 24 * HORA).toISOString()
  const [{ data: u }, { data: sols }, { data: vis }, { data: canc }, { data: pago }, cupo] = await Promise.all([
    admin.from('usuarios').select('*, compita:compitas(id, nombre)').eq('id', clienteId).maybeSingle(),
    admin.from('solicitudes').select('id, estado, tipo, compita_id, slot_confirmado, slots_propuestos, seguimiento_enviado, token_respuesta, confirmacion_cliente, created_at, compitas(nombre)').eq('cliente_id', clienteId).gte('created_at', hace30).order('created_at', { ascending: false }),
    admin.from('visitas').select('id, estado, fecha_programada, hora_inicio_programada, llegada_en, sin_acceso_en, fin, created_at, cita_propuesta_fecha, cita_propuesta_inicio, compita:compitas(nombre)').eq('usuario_id', clienteId).in('estado', ['pre_visita', 'programada', 'confirmando_inicio', 'en_curso', 'terminada']).order('created_at', { ascending: false }).limit(20),
    admin.from('cancelaciones').select('visita_id, cancelado_por, justificada_por, creado_en').eq('usuario_id', clienteId).gte('creado_en', new Date(ahora.getTime() - AVISO_CANCELACION_H * HORA).toISOString()),
    admin.from('solicitudes_pago').select('id').eq('usuario_id', clienteId).eq('estado', 'pendiente').maybeSingle(),
    cupoDelPlan(clienteId).catch(() => null),
  ])
  const solRows = (sols ?? []) as unknown as { id: string; estado: string; tipo: string | null; compita_id: string; slot_confirmado: string | null; slots_propuestos: string[] | null; seguimiento_enviado: boolean | null; token_respuesta: string | null; confirmacion_cliente: boolean | null; created_at: string; compitas: { nombre: string } | null }[]
  const ids = solRows.map((s) => s.id)
  const [{ data: reservas }, { data: avisos }, { data: motivos }] = ids.length
    ? await Promise.all([
      admin.from('reservas_horario').select('solicitud_id, estado, creada_en').in('solicitud_id', ids).order('creada_en', { ascending: false }),
      admin.from('avisos').select('entidad_id').eq('plantilla', 'solicitud_nueva').eq('estado', 'enviado').in('entidad_id', ids),
      admin.from('eventos').select('entidad_id').eq('tipo', 'motivo_no_contratar').in('entidad_id', ids),
    ])
    : [{ data: [] }, { data: [] }, { data: [] }]
  const reservaDe = new Map<string, string>(); for (const r of (reservas ?? []) as { solicitud_id: string; estado: string }[]) if (!reservaDe.has(r.solicitud_id)) reservaDe.set(r.solicitud_id, r.estado)
  const entregados = new Set(((avisos ?? []) as { entidad_id: string }[]).map((a) => a.entidad_id))
  const conMotivo = new Set(((motivos ?? []) as { entidad_id: string }[]).map((m) => m.entidad_id))
  let insistido = false
  if (pago) { const { count } = await admin.from('eventos').select('id', { count: 'exact', head: true }).eq('entidad', 'pago').eq('entidad_id', (pago as { id: string }).id).eq('tipo', 'pago_insistido'); insistido = (count ?? 0) > 0 }
  const usuario = u as ({ compita: { id: string; nombre: string } | null } & Record<string, unknown>) | null

  return {
    ahora,
    pausada: await personaPausada('cliente', clienteId),
    fichaCompleta: usuario ? fichaCompleta(usuario as never) : false,
    zonaHoraria: (usuario?.zona_horaria as string | null | undefined) ?? null,
    nombre: String(usuario?.nombre ?? ''),
    compitaAsignado: usuario?.compita ?? null,
    solicitudes: solRows.map((s) => ({
      id: s.id, estado: s.estado, tipo: s.tipo, compitaId: s.compita_id, compitaNombre: s.compitas?.nombre ?? '', slotConfirmado: s.slot_confirmado,
      slotsPropuestos: (s.slots_propuestos ?? []).length, seguimientoEnviado: !!s.seguimiento_enviado, tokenRespuesta: !!s.token_respuesta, token: s.token_respuesta,
      clienteDijoNo: s.confirmacion_cliente === false, motivoRegistrado: conMotivo.has(s.id), avisoEntregado: entregados.has(s.id),
      reserva: (reservaDe.get(s.id) as SolicitudFoto['reserva']) ?? null, creadaEn: s.created_at,
    })),
    pagoPendiente: pago ? { id: (pago as { id: string }).id, insistido } : null,
    cupo: cupo ? { restantes: cupo.restantes } : null,
    visitas: ((vis ?? []) as unknown as { id: string; estado: string; fecha_programada: string | null; hora_inicio_programada: string | null; llegada_en: string | null; sin_acceso_en: string | null; fin: string | null; created_at: string; cita_propuesta_fecha: string | null; cita_propuesta_inicio: string | null; compita: { nombre: string } | null }[]).map((v) => ({
      citaPropuesta: v.cita_propuesta_fecha && v.cita_propuesta_inicio ? { fecha: v.cita_propuesta_fecha, inicio: v.cita_propuesta_inicio } : null,
      id: v.id, estado: v.estado, compitaNombre: v.compita?.nombre ?? '', fechaProgramada: v.fecha_programada, horaInicio: v.hora_inicio_programada,
      llegadaEn: v.llegada_en, sinAccesoEn: v.sin_acceso_en, fin: v.fin, creadaEn: v.created_at,
    })),
    cancelaciones: ((canc ?? []) as { visita_id: string | null; cancelado_por: CancelacionFoto['por']; justificada_por: string | null; creado_en: string }[]).map((c) => ({ visitaId: c.visita_id, por: c.cancelado_por, justificadaPor: c.justificada_por, creadaEn: c.creado_en })),
  }
}

/** Atajo: la foto de la base y la decisión. */
export async function estadoDelCliente(clienteId: string, ahora: Date = new Date()): Promise<EstadoCliente> {
  return decidirEstado(await cargarFoto(clienteId, ahora))
}
