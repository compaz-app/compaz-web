// Datos de Equipo y permisos (servidor). Solo lo ve el administrador raíz (la pantalla y las rutas lo exigen).
import { createAdminSupabase } from '@/lib/supabase-server'
import { listarEquipo } from '@/lib/equipo'
import { adminsDeEntorno } from '@/lib/admins'
import { normalizarPermisos, type PermisosActor } from '@/lib/permisos-catalogo'
import { describirCambioEquipo } from '@/lib/panel-equipo-tipos'

export interface FilaColaborador { correo: string; nombre: string; activo: boolean; permisos: PermisosActor; creadoPor: string; creadoEn: string }
export interface FilaHistorial { correo: string; texto: string; por: string; cuando: string }
export interface DatosEquipo { admins: string[]; colaboradores: FilaColaborador[]; historial: FilaHistorial[] }

export async function datosDeEquipo(): Promise<DatosEquipo> {
  const [equipo, h] = await Promise.all([
    listarEquipo(),
    createAdminSupabase().from('equipo_historial').select('correo, accion, detalle, hecho_por, hecho_en').order('hecho_en', { ascending: false }).order('id', { ascending: false }).limit(30),
  ])
  if (h.error) throw new Error(`No se pudo leer el historial del equipo: ${h.error.message}`)
  return {
    admins: adminsDeEntorno(),
    colaboradores: equipo.map((c) => ({ correo: c.correo, nombre: c.nombre, activo: c.activo, permisos: normalizarPermisos(c.permisos), creadoPor: c.creado_por, creadoEn: c.creado_en })),
    historial: (h.data ?? []).map((x) => ({ correo: String(x.correo), texto: describirCambioEquipo(String(x.accion), x.detalle), por: String(x.hecho_por), cuando: String(x.hecho_en) })),
  }
}
