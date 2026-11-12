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
import { cuposDelPlan } from '@/lib/visitas'
import { fichaCompleta } from '@/lib/ficha'

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
/** Cuántos clientes se cargan por tanda: con 15 por tanda las consultas con `in(...)` no pasan del tope de filas de la base (1000). */
export const CLIENTES_POR_TANDA = 15

type Fila = Record<string, unknown>
function agrupar<T extends Fila>(filas: T[] | null | undefined, clave: string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const f of filas ?? []) { const k = String(f[clave]); const l = m.get(k); if (l) l.push(f); else m.set(k, [f]) }
  return m
}

/**
 * La foto de VARIOS clientes con una cantidad fija de consultas (unas 12 por tanda de hasta 15 clientes), en vez de unas 12 por cliente.
 * Es la única implementación: cargarFoto de uno solo la usa con un lote de uno, así el portal, el caso y Seguimiento dicen siempre lo mismo.
 */
export async function cargarFotos(clienteIds: string[], ahora: Date = new Date()): Promise<Map<string, FotoCliente>> {
  const salida = new Map<string, FotoCliente>()
  for (let i = 0; i < clienteIds.length; i += CLIENTES_POR_TANDA) {
    for (const [id, foto] of await cargarTanda(clienteIds.slice(i, i + CLIENTES_POR_TANDA), ahora)) salida.set(id, foto)
  }
  return salida
}

async function cargarTanda(ids: string[], ahora: Date): Promise<Map<string, FotoCliente>> {
  const salida = new Map<string, FotoCliente>()
  if (ids.length === 0) return salida
  const admin = createAdminSupabase()
  const hace30 = new Date(ahora.getTime() - 30 * 24 * HORA).toISOString()
  const [usR, solR, visR, cancR, pagoR, pausasR, cupos] = await Promise.all([
    admin.from('usuarios').select('*, compita:compitas(id, nombre)').in('id', ids),
    admin.from('solicitudes').select('id, cliente_id, estado, tipo, compita_id, slot_confirmado, slots_propuestos, seguimiento_enviado, token_respuesta, confirmacion_cliente, created_at, compitas(nombre)').in('cliente_id', ids).gte('created_at', hace30).order('created_at', { ascending: false }),
    admin.from('visitas').select('id, usuario_id, estado, fecha_programada, hora_inicio_programada, llegada_en, sin_acceso_en, fin, created_at, cita_propuesta_fecha, cita_propuesta_inicio, compita:compitas(nombre)').in('usuario_id', ids).in('estado', ['pre_visita', 'programada', 'confirmando_inicio', 'en_curso', 'terminada']).order('created_at', { ascending: false }).limit(1000),
    admin.from('cancelaciones').select('usuario_id, visita_id, cancelado_por, justificada_por, creado_en').in('usuario_id', ids).gte('creado_en', new Date(ahora.getTime() - AVISO_CANCELACION_H * HORA).toISOString()),
    admin.from('solicitudes_pago').select('id, usuario_id').in('usuario_id', ids).eq('estado', 'pendiente'),
    admin.from('pausas_contacto').select('persona_id').eq('rol', 'cliente').eq('activa', true).in('persona_id', ids),
    cuposDelPlan(ids).catch(() => new Map<string, never>()),
  ])
  const solRows = (solR.data ?? []) as unknown as (Fila & { id: string; cliente_id: string; estado: string; tipo: string | null; compita_id: string; slot_confirmado: string | null; slots_propuestos: string[] | null; seguimiento_enviado: boolean | null; token_respuesta: string | null; confirmacion_cliente: boolean | null; created_at: string; compitas: { nombre: string } | null })[]
  const solIds = solRows.map((x) => x.id)
  const pagoPorUsuario = new Map<string, string>(); for (const p of (pagoR.data ?? []) as { id: string; usuario_id: string }[]) if (!pagoPorUsuario.has(p.usuario_id)) pagoPorUsuario.set(p.usuario_id, p.id)
  const pagoIds = [...pagoPorUsuario.values()]
  const [{ data: reservas }, { data: avisos }, { data: motivos }, { data: insistencias }] = await Promise.all([
    solIds.length ? admin.from('reservas_horario').select('solicitud_id, estado, creada_en').in('solicitud_id', solIds).order('creada_en', { ascending: false }) : Promise.resolve({ data: [] }),
    solIds.length ? admin.from('avisos').select('entidad_id').eq('plantilla', 'solicitud_nueva').eq('estado', 'enviado').in('entidad_id', solIds) : Promise.resolve({ data: [] }),
    solIds.length ? admin.from('eventos').select('entidad_id').eq('tipo', 'motivo_no_contratar').in('entidad_id', solIds) : Promise.resolve({ data: [] }),
    pagoIds.length ? admin.from('eventos').select('entidad_id').eq('entidad', 'pago').eq('tipo', 'pago_insistido').in('entidad_id', pagoIds) : Promise.resolve({ data: [] }),
  ])
  const reservaDe = new Map<string, string>(); for (const r of (reservas ?? []) as { solicitud_id: string; estado: string }[]) if (!reservaDe.has(r.solicitud_id)) reservaDe.set(r.solicitud_id, r.estado)
  const entregados = new Set(((avisos ?? []) as { entidad_id: string }[]).map((a) => a.entidad_id))
  const conMotivo = new Set(((motivos ?? []) as { entidad_id: string }[]).map((m) => m.entidad_id))
  const insistidos = new Set(((insistencias ?? []) as { entidad_id: string }[]).map((e) => e.entidad_id))
  const pausadas = new Set(((pausasR.data ?? []) as { persona_id: string }[]).map((x) => x.persona_id))
  const usuarios = new Map(((usR.data ?? []) as unknown as (Fila & { id: string })[]).map((u) => [u.id, u]))
  const solPorCliente = agrupar(solRows, 'cliente_id')
  const visPorCliente = agrupar((visR.data ?? []) as unknown as Fila[], 'usuario_id')
  const cancPorCliente = agrupar((cancR.data ?? []) as unknown as Fila[], 'usuario_id')

  for (const clienteId of ids) {
    const usuario = (usuarios.get(clienteId) ?? null) as ({ compita: { id: string; nombre: string } | null } & Record<string, unknown>) | null
    const pagoId = pagoPorUsuario.get(clienteId)
    const cupo = cupos.get(clienteId) ?? null
    salida.set(clienteId, {
      ahora,
      pausada: pausadas.has(clienteId),
      fichaCompleta: usuario ? fichaCompleta(usuario as never) : false,
      zonaHoraria: (usuario?.zona_horaria as string | null | undefined) ?? null,
      nombre: String(usuario?.nombre ?? ''),
      compitaAsignado: usuario?.compita ?? null,
      solicitudes: (solPorCliente.get(clienteId) ?? []).map((x) => {
        const sr = x as unknown as (typeof solRows)[number]
        return {
          id: sr.id, estado: sr.estado, tipo: sr.tipo, compitaId: sr.compita_id, compitaNombre: sr.compitas?.nombre ?? '', slotConfirmado: sr.slot_confirmado,
          slotsPropuestos: (sr.slots_propuestos ?? []).length, seguimientoEnviado: !!sr.seguimiento_enviado, tokenRespuesta: !!sr.token_respuesta, token: sr.token_respuesta,
          clienteDijoNo: sr.confirmacion_cliente === false, motivoRegistrado: conMotivo.has(sr.id), avisoEntregado: entregados.has(sr.id),
          reserva: (reservaDe.get(sr.id) as SolicitudFoto['reserva']) ?? null, creadaEn: sr.created_at,
        }
      }),
      pagoPendiente: pagoId ? { id: pagoId, insistido: insistidos.has(pagoId) } : null,
      cupo: cupo ? { restantes: cupo.restantes } : null,
      // Las 20 visitas más recientes de CADA cliente (la consulta ya viene ordenada de la más reciente a la más antigua).
      visitas: (visPorCliente.get(clienteId) ?? []).slice(0, 20).map((x) => {
        const v = x as unknown as { id: string; estado: string; fecha_programada: string | null; hora_inicio_programada: string | null; llegada_en: string | null; sin_acceso_en: string | null; fin: string | null; created_at: string; cita_propuesta_fecha: string | null; cita_propuesta_inicio: string | null; compita: { nombre: string } | null }
        return {
          citaPropuesta: v.cita_propuesta_fecha && v.cita_propuesta_inicio ? { fecha: v.cita_propuesta_fecha, inicio: v.cita_propuesta_inicio } : null,
          id: v.id, estado: v.estado, compitaNombre: v.compita?.nombre ?? '', fechaProgramada: v.fecha_programada, horaInicio: v.hora_inicio_programada,
          llegadaEn: v.llegada_en, sinAccesoEn: v.sin_acceso_en, fin: v.fin, creadaEn: v.created_at,
        }
      }),
      cancelaciones: (cancPorCliente.get(clienteId) ?? []).map((x) => {
        const c = x as unknown as { visita_id: string | null; cancelado_por: CancelacionFoto['por']; justificada_por: string | null; creado_en: string }
        return { visitaId: c.visita_id, por: c.cancelado_por, justificadaPor: c.justificada_por, creadaEn: c.creado_en }
      }),
    })
  }
  return salida
}

export async function cargarFoto(clienteId: string, ahora: Date = new Date()): Promise<FotoCliente> {
  return (await cargarFotos([clienteId], ahora)).get(clienteId) as FotoCliente
}

/** Atajo: la foto de la base y la decisión. */
export async function estadoDelCliente(clienteId: string, ahora: Date = new Date()): Promise<EstadoCliente> {
  return decidirEstado(await cargarFoto(clienteId, ahora))
}
