// Datos de Personas del panel nuevo (servidor). Las queries viven aquí, no en la página ni en las rutas.
// Los datos de contacto NUNCA viajan en la lista ni en la ficha: solo salen por revelarContacto, con motivo anotado en Actividad.

import { createAdminSupabase } from '@/lib/supabase-server'
import type { Actor } from '@/lib/permisos'
import { estadoCmc } from '@/lib/cmc-estado'
import type { Compita } from '@/types'
import { puede } from '@/lib/permisos'
import { esCuentaEliminada } from '@/lib/cuenta-eliminar'
import { recortarTexto } from '@/lib/panel-datos'
import { registrarAcceso } from '@/lib/alertas-admin'
import { compitasEnPausa, resumenCancelacionesCompita } from '@/lib/cancelaciones'
import { compitasPausadosPorContacto } from '@/lib/pausas'
import { listarNotas } from '@/lib/panel-notas'
import { cargarFoto, decidirEstado, PASOS_PORTAL } from '@/lib/estado-cliente'
import {
  ETIQUETA_CANAL, SIN_MOTIVO_ADMIN, motivoValido,
  type CanalContacto, type EstadoCompita, type TipoContacto, type EventoLinea, type FichaPersona, type FilaCliente, type FilaCompita, type TipoPersona,
} from '@/lib/panel-personas-tipos'

const DIA = 86_400_000
export const LIMITE = 5000
const horasDesde = (iso: string | null | undefined, ahora: number) => (iso ? Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 3_600_000)) : null)

/** Todos los compitas con sus números de los últimos 30 días, en pocas consultas (no una por compita). */
export async function listarCompitas(ahora: Date = new Date()): Promise<FilaCompita[]> {
  const db = createAdminSupabase()
  const desde = new Date(ahora.getTime() - 30 * DIA).toISOString()
  const [compitas, clientes, visitas, solicitudes, cancelaciones] = await Promise.all([
    db.from('compitas').select('id, nombre, apellido, zona, estado, verificado, rating_promedio, es_demo').order('nombre', { ascending: true }).limit(LIMITE),
    db.from('usuarios').select('compita_id').not('compita_id', 'is', null).limit(LIMITE),
    db.from('visitas').select('compita_id, created_at, inicio, fin').gte('created_at', desde).limit(LIMITE),
    db.from('solicitudes').select('compita_id, respondido_at, created_at').gte('created_at', desde).limit(LIMITE),
    db.from('cancelaciones').select('compita_id, tardia, justificada').eq('cancelado_por', 'compita').gte('creado_en', desde).limit(LIMITE),
  ])
  for (const r of [compitas, clientes, visitas, solicitudes, cancelaciones]) if (r.error) throw new Error(`No se pudo leer Personas: ${r.error.message}`)

  const lista = (compitas.data ?? []).filter((c) => !c.es_demo && !esCuentaEliminada([c.nombre, c.apellido].filter(Boolean).join(' ')))
  const ids = lista.map((c) => String(c.id))
  const [pausaCanc, pausaContacto] = await Promise.all([compitasEnPausa(ids, ahora), compitasPausadosPorContacto(ids)])

  const por = <T extends { compita_id: string | null }>(filas: T[] | null) => {
    const m = new Map<string, T[]>()
    for (const f of filas ?? []) if (f.compita_id) m.set(f.compita_id, [...(m.get(f.compita_id) ?? []), f])
    return m
  }
  const mClientes = por(clientes.data), mVisitas = por(visitas.data), mSol = por(solicitudes.data), mCanc = por(cancelaciones.data)
  const t = ahora.getTime()

  return lista.map((c): FilaCompita => {
    const id = String(c.id)
    const activos = mClientes.get(id)?.length ?? 0
    const sol = mSol.get(id) ?? [], vis = mVisitas.get(id) ?? [], canc = mCanc.get(id) ?? []
    const ultimos = [...sol.map((s) => s.respondido_at), ...vis.map((v) => v.fin ?? v.inicio)].filter((x): x is string => !!x).sort()
    const estado: EstadoCompita = c.estado === 'inactivo' || pausaCanc.has(id) || pausaContacto.has(id) ? 'En pausa' : !c.verificado ? 'Nuevo' : activos > 0 ? 'Con cupo' : 'Disponible'
    return {
      id, nombre: [c.nombre, c.apellido].filter(Boolean).join(' '), zona: String(c.zona ?? ''), estado, activos,
      visitas: vis.length, rating: Number(c.rating_promedio ?? 0),
      respuesta: sol.length ? Math.round((sol.filter((s) => s.respondido_at).length / sol.length) * 100) : null,
      inactivoH: horasDesde(ultimos.at(-1), t), canc: canc.length, tardias: canc.filter((x) => x.tardia && !x.justificada).length,
    }
  })
}

export async function listarClientes(): Promise<FilaCliente[]> {
  const db = createAdminSupabase()
  const [u, c] = await Promise.all([
    db.from('usuarios').select('id, nombre, zona, plan, plan_contratado, compita_id, created_at, eliminada_en').order('created_at', { ascending: false }).limit(LIMITE),
    db.from('compitas').select('id, nombre, apellido').limit(LIMITE),
  ])
  if (u.error || c.error) throw new Error(`No se pudo leer los clientes: ${u.error?.message ?? c.error?.message}`)
  const nombres = new Map((c.data ?? []).map((x) => [String(x.id), [x.nombre, x.apellido].filter(Boolean).join(' ')]))
  return (u.data ?? []).filter((x) => !x.eliminada_en).map((x): FilaCliente => ({
    id: String(x.id), nombre: String(x.nombre ?? ''), zona: String(x.zona ?? ''), compita: x.compita_id ? nombres.get(String(x.compita_id)) ?? null : null,
    plan: x.plan_contratado ?? null, alta: String(x.created_at), bloqueado: x.plan === 'bloqueado',
  }))
}

/** Línea de tiempo: lo que pasó con esta persona (visitas, solicitudes, cancelaciones y actividad del equipo), lo más nuevo primero. */
const esDeAcceso = (categoria: unknown) => typeof categoria === 'string' && categoria.startsWith('acceso_')

export async function lineaDe(actor: Actor, tipo: TipoPersona, id: string): Promise<EventoLinea[]> {
  const db = createAdminSupabase()
  const col = tipo === 'compita' ? 'compita_id' : 'usuario_id'
  const colSol = tipo === 'compita' ? 'compita_id' : 'cliente_id'
  const [vis, sol, canc, act] = await Promise.all([
    db.from('visitas').select('estado, created_at, fin').eq(tipo === 'compita' ? 'compita_id' : 'usuario_id', id).order('created_at', { ascending: false }).limit(20),
    db.from('solicitudes').select('estado, created_at, respondido_at').eq(colSol, id).order('created_at', { ascending: false }).limit(20),
    db.from('cancelaciones').select('cancelado_por, tardia, justificada, creado_en').eq(col, id).order('creado_en', { ascending: false }).limit(20),
    db.from('actividad_admin').select('resumen, creado_en, categoria').eq('entidad_id', id).order('creado_en', { ascending: false }).limit(40),
  ])
  const ev: EventoLinea[] = []
  for (const v of vis.data ?? []) {
    ev.push({ cuando: String(v.created_at), texto: 'Se agendó una visita' })
    if (v.fin) ev.push({ cuando: String(v.fin), texto: 'Terminó una visita' })
  }
  for (const s of sol.data ?? []) {
    ev.push({ cuando: String(s.created_at), texto: tipo === 'compita' ? 'Recibió una solicitud' : 'Envió una solicitud' })
    if (s.respondido_at) ev.push({ cuando: String(s.respondido_at), texto: s.estado === 'rechazada' ? 'La solicitud fue rechazada' : 'La solicitud fue respondida' })
  }
  for (const c of canc.data ?? []) ev.push({ cuando: String(c.creado_en), texto: `Cancelación por ${c.cancelado_por === 'cliente' ? 'el cliente' : c.cancelado_por === 'compita' ? 'el compita' : 'el equipo'}${c.tardia ? ', con poco aviso' : ''}${c.justificada ? ' (justificada)' : ''}` })
  // "X abrió el teléfono de Y" es del Registro de accesos: solo lo ve quien tiene el permiso de ver contactos (S-05).
  for (const a of (act.data ?? []).filter((x) => puede(actor, 'telefonos') || !esDeAcceso(x.categoria)).slice(0, 20)) ev.push({ cuando: String(a.creado_en), texto: recortarTexto(actor, String(a.resumen)) })
  return ev.sort((a, b) => b.cuando.localeCompare(a.cuando)).slice(0, 30)
}

/** La ficha de una persona, sin ningún dato de contacto (solo si lo hay). null si no existe. */
export async function fichaDePersona(actor: Actor, tipo: TipoPersona, id: string): Promise<FichaPersona | null> {
  const db = createAdminSupabase()
  if (tipo === 'compita') {
    const { data: c } = await db.from('compitas').select('*').eq('id', id).maybeSingle()
    if (!c || c.es_demo) return null
    const [linea, canc, notas] = await Promise.all([lineaDe(actor, 'compita', id), resumenCancelacionesCompita(id), listarNotas(actor, 'compita', id)])
    return { tipo, id, nombre: [c.nombre, c.apellido].filter(Boolean).join(' '), zona: String(c.zona ?? ''), contacto: { correo: !!c.email, telefono: !!c.telefono }, linea, notas, canc, cmc: estadoCmc(c as unknown as Compita),
      // Una cuenta eliminada se ve (por el historial) pero ya no tiene acciones.
      perfil: puede(actor, 'cuentas') && !esCuentaEliminada(c.nombre) ? { zona: String(c.zona ?? ''), descripcion: String(c.descripcion ?? ''), servicios: Array.isArray(c.servicios) ? c.servicios.map(String) : [], youtube: String(c.youtube_url ?? ''), fotoUrl: c.foto_url ? String(c.foto_url) : null } : undefined,
      cuenta: esCuentaEliminada(c.nombre) ? undefined : { bloqueado: c.estado === 'bloqueado', verificado: !!c.verificado, activo: c.estado === 'activo' } }
  }
  const { data: u } = await db.from('usuarios').select('id, nombre, zona, email, telefono, compita_id, eliminada_en, plan, portal_nuevo').eq('id', id).maybeSingle()
  if (!u || u.eliminada_en) return null
  const [linea, foto, compita, notas] = await Promise.all([
    lineaDe(actor, 'cliente', id), cargarFoto(id),
    u.compita_id ? db.from('compitas').select('nombre, apellido').eq('id', u.compita_id).maybeSingle() : Promise.resolve({ data: null }),
    listarNotas(actor, 'cliente', id),
  ])
  const estado = decidirEstado(foto)
  // Solo quien puede asignar necesita la lista de compitas (no viaja a los demás).
  const asignables = puede(actor, 'atender')
    ? ((await db.from('compitas').select('id, nombre, apellido, es_demo').eq('estado', 'activo').eq('verificado', true).order('nombre').limit(200)).data ?? []).filter((x) => !x.es_demo).map((x) => ({ id: String(x.id), nombre: [x.nombre, x.apellido].filter(Boolean).join(' ') }))
    : undefined
  return {
    tipo, id, nombre: String(u.nombre ?? ''), zona: String(u.zona ?? ''), etapa: PASOS_PORTAL[estado.paso],
    compita: compita.data ? [compita.data.nombre, compita.data.apellido].filter(Boolean).join(' ') : null, compitaId: u.compita_id ? String(u.compita_id) : null,
    contacto: { correo: !!u.email, telefono: !!u.telefono }, linea, notas,
    cuenta: { bloqueado: u.plan === 'bloqueado', portalNuevo: (u.portal_nuevo as boolean | null) ?? null }, asignables,
  }
}

export type ResultadoContacto = { ok: true; valor: string; /** Nombre de la persona (solo en el contacto de una visita). */ detalle?: string } | { ok: false; error: string; status: number }

/**
 * Entrega un dato de contacto. Reglas (en el servidor, no en la pantalla):
 * 1. Hace falta el permiso 'telefonos' (lo comprueba la ruta).
 * 2. Un colaborador debe dar un motivo válido; el administrador no.
 * 3. El acceso se ANOTA en Actividad antes de entregar el dato; si no se pudo anotar, no se entrega.
 */
export async function revelarContacto(actor: Actor, p: { tipo: TipoContacto; id: string; canal: CanalContacto; motivo: unknown }): Promise<ResultadoContacto> {
  if (!puede(actor, 'telefonos')) return { ok: false, error: 'Acceso denegado', status: 403 }
  const motivo = actor.rol === 'admin' ? (motivoValido(p.motivo) ?? SIN_MOTIVO_ADMIN) : motivoValido(p.motivo)
  if (!motivo) return { ok: false, error: 'Indica el motivo para ver este dato', status: 400 }

  const db = createAdminSupabase()
  let nombre = '', valor: string | null = null, detalle: string | undefined
  if (p.tipo === 'visita') {
    // El contacto en el sitio de una visita (quien abre la puerta). Solo tiene teléfono.
    const { data } = await db.from('visitas').select('contacto_nombre, contacto_tel').eq('id', p.id).maybeSingle()
    if (!data) return { ok: false, error: 'Visita no encontrada', status: 404 }
    nombre = `el contacto en el sitio de la visita${data.contacto_nombre ? ` (${data.contacto_nombre})` : ''}`
    detalle = data.contacto_nombre ?? undefined
    valor = p.canal === 'correo' ? null : data.contacto_tel ?? null
  } else if (p.tipo === 'compita') {
    const { data } = await db.from('compitas').select('*').eq('id', p.id).maybeSingle()
    if (!data) return { ok: false, error: 'Persona no encontrada', status: 404 }
    nombre = [data.nombre, data.apellido].filter(Boolean).join(' ')
    valor = p.canal === 'correo' ? data.email ?? null : data.telefono ?? null
  } else {
    const { data } = await db.from('usuarios').select('nombre, email, telefono').eq('id', p.id).maybeSingle()
    if (!data) return { ok: false, error: 'Persona no encontrada', status: 404 }
    nombre = String(data.nombre ?? '')
    valor = p.canal === 'correo' ? data.email ?? null : data.telefono ?? null
  }
  if (!valor) return { ok: false, error: `No hay ${ETIQUETA_CANAL[p.canal]} guardado de ${nombre || 'esta persona'}`, status: 404 }

  const anotado = await registrarAcceso(`${actor.correo} abrió ${ETIQUETA_CANAL[p.canal]} de ${nombre}. Motivo: ${motivo}`, { categoria: 'acceso_contacto', entidad: { tipo: p.tipo === 'compita' ? 'compita' : p.tipo === 'visita' ? 'visita' : 'cliente', id: p.id, nombre } })
  if (!anotado) return { ok: false, error: 'No se pudo anotar el acceso, así que no se muestra el dato. Inténtalo otra vez.', status: 503 }
  return detalle === undefined ? { ok: true, valor } : { ok: true, valor, detalle }
}
