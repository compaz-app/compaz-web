// Datos de las herramientas de Más: reseñas, pagos, avisos enviados y cobertura (servidor). Las queries viven aquí.
import { createAdminSupabase } from '@/lib/supabase-server'
import { conCacheCorto } from '@/lib/cache-corto'
import type { Actor } from '@/lib/permisos'
import { recortarTexto } from '@/lib/panel-datos'
import { PLANES } from '@/lib/planes'
import { listarCompitas } from '@/lib/panel-personas'
import { estadosDeZona } from '@/lib/panel-personas-tipos'
import { coberturaPorEstado, type FilaAviso, type FilaCobertura, type FilaPago, type FilaResena } from '@/lib/panel-mas-tipos'

const LIMITE = 500
const nombreCompleto = (c: { nombre?: string | null; apellido?: string | null } | null | undefined) => [c?.nombre, c?.apellido].filter(Boolean).join(' ') || 'Sin nombre'

/** Reseñas: las que esperan aprobación primero. Una reseña no se ve en el perfil del compita hasta que se aprueba. */
export async function listarResenas(actor: Actor): Promise<FilaResena[]> {
  const { data, error } = await createAdminSupabase().from('resenas').select('id, texto, estrellas, publicada, created_at, compita:compitas(nombre, apellido), cliente:usuarios(nombre)').order('created_at', { ascending: false }).limit(LIMITE)
  if (error) throw new Error(`No se pudo leer las reseñas: ${error.message}`)
  return ((data ?? []) as unknown as { id: string; texto: string; estrellas: number; publicada: boolean; created_at: string; compita: { nombre: string; apellido: string | null } | null; cliente: { nombre: string } | null }[])
    .map((r) => ({ id: String(r.id), estrellas: Number(r.estrellas), texto: recortarTexto(actor, String(r.texto ?? '')), publicada: !!r.publicada, creada: String(r.created_at), cliente: r.cliente?.nombre ?? 'Sin nombre', compita: nombreCompleto(r.compita) }))
}

/** Los pagos registrados más recientes, de todos los clientes. */
export async function listarPagosRecientes(): Promise<FilaPago[]> {
  const db = createAdminSupabase()
  const { data, error } = await db.from('pagos_plan').select('id, usuario_id, tipo, plan, horas, monto_usd, metodo, referencia, estado, anulado_motivo, created_at').order('created_at', { ascending: false }).limit(LIMITE)
  if (error) throw new Error(`No se pudo leer los pagos: ${error.message}`)
  const filas = (data ?? []) as { id: string; usuario_id: string; tipo: string; plan: string | null; horas: number | null; monto_usd: number; metodo: string; referencia: string | null; estado: string; anulado_motivo: string | null; created_at: string }[]
  const ids = [...new Set(filas.map((f) => f.usuario_id))]
  const { data: us } = ids.length ? await db.from('usuarios').select('id, nombre').in('id', ids) : { data: [] }
  const nombre = new Map(((us ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]))
  return filas.map((f): FilaPago => ({
    id: String(f.id), clienteId: String(f.usuario_id), cliente: nombre.get(f.usuario_id) ?? 'Sin nombre',
    plan: f.tipo === 'extra' ? `Visita extra${f.horas ? ` de ${f.horas} h` : ''}` : PLANES[f.plan as keyof typeof PLANES]?.nombre ?? f.plan ?? 'Plan',
    monto: Number(f.monto_usd), metodo: String(f.metodo), referencia: f.referencia, creado: String(f.created_at), anulado: f.estado === 'anulado', motivo: f.anulado_motivo,
  }))
}

/** Los avisos más recientes, con el nombre de a quién fueron. */
export async function listarAvisos(): Promise<FilaAviso[]> {
  const db = createAdminSupabase()
  const { data, error } = await db.from('avisos').select('id, destinatario_tipo, destinatario_id, canal, plantilla, estado, error, intentos, programado_para').neq('plantilla', 'escalera_tarea').order('programado_para', { ascending: false }).limit(LIMITE)
  if (error) throw new Error(`No se pudo leer los avisos: ${error.message}`)
  const filas = (data ?? []) as { id: string; destinatario_tipo: 'cliente' | 'compita' | 'admin'; destinatario_id: string | null; canal: 'telegram' | 'correo'; plantilla: string; estado: FilaAviso['estado']; error: string | null; intentos: number; programado_para: string }[]
  const de = (t: string) => [...new Set(filas.filter((f) => f.destinatario_tipo === t && f.destinatario_id).map((f) => f.destinatario_id as string))]
  const [cli, cmp] = await Promise.all([
    de('cliente').length ? db.from('usuarios').select('id, nombre').in('id', de('cliente')) : { data: [] },
    de('compita').length ? db.from('compitas').select('id, nombre, apellido').in('id', de('compita')) : { data: [] },
  ])
  const nombres = new Map<string, string>([...((cli.data ?? []) as { id: string; nombre: string }[]).map((x): [string, string] => [x.id, x.nombre]), ...((cmp.data ?? []) as { id: string; nombre: string; apellido: string | null }[]).map((x): [string, string] => [x.id, nombreCompleto(x)])])
  return filas.map((f): FilaAviso => ({ id: String(f.id), creado: String(f.programado_para), canal: f.canal, rol: f.destinatario_tipo, para: f.destinatario_tipo === 'admin' ? 'El equipo' : nombres.get(String(f.destinatario_id)) ?? 'Sin nombre', plantilla: String(f.plantilla), estado: f.estado, error: f.error ? String(f.error) : null, intentos: Number(f.intentos ?? 0) }))
}

/** Compitas que pueden recibir solicitudes contra solicitudes del último mes, por estado. */
export function cargarCobertura(ahora: Date = new Date()): Promise<FilaCobertura[]> {
  return conCacheCorto('cobertura', 60_000, () => calcularCobertura(ahora))
}

async function calcularCobertura(ahora: Date): Promise<FilaCobertura[]> {
  const db = createAdminSupabase()
  const desde = new Date(ahora.getTime() - 30 * 86_400_000).toISOString()
  const [compitas, sol] = await Promise.all([listarCompitas(ahora), db.from('solicitudes').select('cliente_id').gte('created_at', desde).limit(5000)])
  if (sol.error) throw new Error(`No se pudo leer las solicitudes: ${sol.error.message}`)
  const ids = [...new Set(((sol.data ?? []) as { cliente_id: string }[]).map((s) => s.cliente_id))]
  const { data: us } = ids.length ? await db.from('usuarios').select('id, zona').in('id', ids) : { data: [] }
  const zonaDe = new Map(((us ?? []) as { id: string; zona: string | null }[]).map((u) => [u.id, u.zona ?? '']))
  const zonas = ((sol.data ?? []) as { cliente_id: string }[]).map((s) => zonaDe.get(s.cliente_id) ?? '')
  return coberturaPorEstado(compitas.map((c) => ({ zona: c.zona, activo: c.estado === 'Disponible' || c.estado === 'Con cupo' })), zonas, estadosDeZona)
}
