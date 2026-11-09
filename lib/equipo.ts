// Colaboradores del panel: altas, permisos y bajas. Solo el administrador raíz llama a estas funciones
// (las rutas de /api/admin/equipo exigen el permiso 'raiz'). Todo cambio queda en equipo_historial.

import { createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { soloActivados } from '@/lib/permisos-catalogo'

export interface Colaborador {
  id: string
  correo: string
  nombre: string
  permisos: Record<string, unknown>
  activo: boolean
  creado_por: string
  creado_en: string
}

const CAMPOS = 'id, correo, nombre, permisos, activo, creado_por, creado_en'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Fila del colaborador o null. Un error de lectura se propaga: la guardia lo trata como "negar". */
export async function obtenerColaborador(correo: string): Promise<Colaborador | null> {
  const { data, error } = await createAdminSupabase().from('equipo').select(CAMPOS).eq('correo', correo.trim().toLowerCase()).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Colaborador | null) ?? null
}

export async function listarEquipo(): Promise<Colaborador[]> {
  const { data, error } = await createAdminSupabase().from('equipo').select(CAMPOS).order('creado_en', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Colaborador[]
}

async function historial(correo: string, accion: string, detalle: Record<string, unknown>, por: string) {
  const { error } = await createAdminSupabase().from('equipo_historial').insert({ correo, accion, detalle, hecho_por: por })
  if (error) console.error('[equipo] no se pudo anotar en el historial:', error.message)
}

export type ResultadoEquipo = { ok: true; colaborador: Colaborador } | { ok: false; error: string; status: number }

/** Da de alta a un colaborador con los permisos recomendados que el administrador indique (por defecto, ninguno). */
export async function invitarColaborador(correo: string, nombre: string, permisos: Record<string, boolean>, por: string): Promise<ResultadoEquipo> {
  const c = correo.trim().toLowerCase()
  if (!EMAIL.test(c)) return { ok: false, error: 'Correo inválido', status: 400 }
  if (!nombre.trim()) return { ok: false, error: 'Falta el nombre', status: 400 }
  if (isAdminEmail(c)) return { ok: false, error: 'Esa persona ya es administradora', status: 409 }
  if (await obtenerColaborador(c)) return { ok: false, error: 'Esa persona ya está en el equipo', status: 409 }
  const { data, error } = await createAdminSupabase().from('equipo')
    .insert({ correo: c, nombre: nombre.trim().slice(0, 80), permisos: soloActivados(permisos), activo: true, creado_por: por })
    .select(CAMPOS).single()
  if (error || !data) return { ok: false, error: 'No se pudo invitar', status: 500 }
  await historial(c, 'alta', { permisos: soloActivados(permisos) }, por)
  return { ok: true, colaborador: data as Colaborador }
}

export async function cambiarPermisos(correo: string, permisos: Record<string, boolean>, por: string): Promise<ResultadoEquipo> {
  const c = correo.trim().toLowerCase()
  const actual = await obtenerColaborador(c)
  if (!actual) return { ok: false, error: 'Esa persona no está en el equipo', status: 404 }
  const nuevos = soloActivados(permisos)
  const { data, error } = await createAdminSupabase().from('equipo')
    .update({ permisos: nuevos, actualizado_por: por, actualizado_en: new Date().toISOString() })
    .eq('correo', c).select(CAMPOS).single()
  if (error || !data) return { ok: false, error: 'No se pudo guardar', status: 500 }
  await historial(c, 'permisos', { antes: soloActivados(actual.permisos), despues: nuevos }, por)
  return { ok: true, colaborador: data as Colaborador }
}

/** Baja inmediata: la guardia consulta la fila en cada petición, así que el acceso se corta al instante. */
export async function cambiarActivo(correo: string, activo: boolean, por: string): Promise<ResultadoEquipo> {
  const c = correo.trim().toLowerCase()
  const actual = await obtenerColaborador(c)
  if (!actual) return { ok: false, error: 'Esa persona no está en el equipo', status: 404 }
  const { data, error } = await createAdminSupabase().from('equipo')
    .update({ activo, actualizado_por: por, actualizado_en: new Date().toISOString() })
    .eq('correo', c).select(CAMPOS).single()
  if (error || !data) return { ok: false, error: 'No se pudo guardar', status: 500 }
  await historial(c, activo ? 'reactivado' : 'desactivado', {}, por)
  return { ok: true, colaborador: data as Colaborador }
}
