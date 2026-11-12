// Secciones del panel nuevo (/panel) y quién las ve. Función PURA, sin base de datos: la comparten el servidor y el menú.
// El estado vive en la dirección: ?sec=<sección> y, solo para el administrador, ?como=colaborador ("ver el panel como").

import { PERMISOS_BASE, normalizarPermisos, type PermisoRequerido, type PermisosActor } from '@/lib/permisos-catalogo'

export type SeccionPanel = 'bandeja' | 'seguimiento' | 'personas' | 'visitas' | 'mas'

export interface DefSeccion {
  id: SeccionPanel
  texto: string
  /** Permiso para entrar; 'cualquiera' = basta con poder entrar al panel. */
  permiso: PermisoRequerido | 'cualquiera'
}

export const SECCIONES_PANEL: DefSeccion[] = [
  { id: 'bandeja', texto: 'Bandeja', permiso: 'atender' },
  { id: 'seguimiento', texto: 'Seguimiento', permiso: 'monitorear' },
  { id: 'personas', texto: 'Personas', permiso: 'monitorear' },
  { id: 'visitas', texto: 'Visitas', permiso: 'monitorear' },
  { id: 'mas', texto: 'Más', permiso: 'cualquiera' },
]

export const esSeccionPanel = (v: unknown): v is SeccionPanel => typeof v === 'string' && SECCIONES_PANEL.some((s) => s.id === v)

export type ActorVista = { rol: 'admin' | 'colaborador'; permisos: PermisosActor }

const tiene = (a: ActorVista, p: PermisoRequerido | 'cualquiera') => p === 'cualquiera' || (p === 'raiz' ? a.rol === 'admin' : a.permisos[p] === true)

/** Puede entrar al panel quien administra o tiene al menos uno de los dos permisos de trabajo. */
export const puedeEntrarAlPanel = (a: ActorVista) => a.rol === 'admin' || a.permisos.monitorear === true || a.permisos.atender === true

export const seccionesVisibles = (a: ActorVista): DefSeccion[] => SECCIONES_PANEL.filter((s) => tiene(a, s.permiso))

/** La sección pedida si se puede ver; si no, la primera que sí. */
export function seccionActiva(a: ActorVista, pedida: unknown): SeccionPanel {
  const visibles = seccionesVisibles(a)
  if (esSeccionPanel(pedida) && visibles.some((s) => s.id === pedida)) return pedida
  return visibles[0]?.id ?? 'mas'
}

/**
 * "Ver el panel como": solo el administrador puede mirarlo como un colaborador con los permisos base (para comprobar qué ve el equipo).
 * Es solo la pantalla: las rutas del servidor siguen comprobando a la persona real, así que nadie gana poder con esto.
 */
export function actorComo<T extends ActorVista>(real: T, como: unknown): { actor: ActorVista; comoColaborador: boolean } {
  if (real.rol === 'admin' && como === 'colaborador') return { actor: { rol: 'colaborador', permisos: normalizarPermisos(PERMISOS_BASE) }, comoColaborador: true }
  return { actor: { rol: real.rol, permisos: real.permisos }, comoColaborador: false }
}

/** Dirección de una sección conservando "ver como". La primera sección visible no necesita ?sec. */
export function hrefSeccion(id: SeccionPanel, comoColaborador: boolean, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams({ sec: id, ...(comoColaborador ? { como: 'colaborador' } : {}), ...extra })
  return `/panel?${q.toString()}`
}
