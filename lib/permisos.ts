// Permisos del equipo del panel, comprobados SIEMPRE en el servidor. Ocultar un botón no protege nada:
// quien conozca la dirección de una ruta puede llamarla. Cada ruta de /api/admin pasa por requierePermiso.
//
// Reglas:
// 1. Negar por defecto: lo que no esté activado expresamente en la fila del colaborador cuenta como apagado.
// 2. El administrador raíz sale de ADMIN_EMAILS (no de la base) y no se puede quitar ni limitar desde el panel.
// 3. Quien no está en el equipo recibe 401 (igual que antes); un colaborador sin el permiso recibe 403.
// 4. Un colaborador desactivado equivale a no estar en el equipo.

import type { NextResponse } from 'next/server'
import { isAdminEmail, usuarioVerificado } from '@/lib/auth'
import { obtenerColaborador } from '@/lib/equipo'
import { err, unauthorized, forbidden } from '@/lib/api'
import { evaluarMfa, nivelSegundoFactor, exigirSegundoFactorEnPagina } from '@/lib/mfa'
import { TODOS, normalizarPermisos, type PermisosActor, type PermisoRequerido } from '@/lib/permisos-catalogo'

export * from '@/lib/permisos-catalogo'

export type RolPanel = 'admin' | 'colaborador'
export interface Actor { id: string; correo: string; rol: RolPanel; permisos: PermisosActor }

export interface FilaEquipo { correo: string; activo: boolean; permisos: unknown }

/** Función pura: quién es esta persona para el panel. Sin base de datos, fácil de probar. */
export function resolverActor(id: string, correo: string, fila: FilaEquipo | null): Actor | null {
  const c = correo.trim().toLowerCase()
  if (!c) return null
  if (isAdminEmail(c)) return { id, correo: c, rol: 'admin', permisos: { ...TODOS } }
  if (fila && fila.activo && fila.correo.toLowerCase() === c) return { id, correo: c, rol: 'colaborador', permisos: normalizarPermisos(fila.permisos) }
  return null
}

export function puede(actor: Actor, permiso: PermisoRequerido): boolean {
  if (permiso === 'raiz') return actor.rol === 'admin'
  return actor.permisos[permiso] === true
}

export type Guardia = { ok: true; actor: Actor } | { ok: false; res: NextResponse }

/**
 * Guardia de las rutas del panel. Uso:
 *   const g = await requierePermiso('pagos'); if (!g.ok) return g.res
 *   const actor = g.actor
 */
/** `peligrosa`: acción que no se puede deshacer (anular un pago, borrar una cuenta, cambiar el equipo). Con el segundo factor obligatorio pide una confirmación de hace poco. */
export async function requierePermiso(permiso: PermisoRequerido, opciones: { peligrosa?: boolean } = {}): Promise<Guardia> {
  try {
    const { data: { user } } = await usuarioVerificado()
    if (!user?.email) return { ok: false, res: unauthorized() }
    const correo = user.email.toLowerCase()
    const fila = isAdminEmail(correo) ? null : await obtenerColaborador(correo)
    const actor = resolverActor(user.id, correo, fila)
    if (!actor) return { ok: false, res: unauthorized() }
    if (!puede(actor, permiso)) return { ok: false, res: forbidden() }
    // Segundo factor (autenticador): con ADMIN_MFA=obligatorio, sin él no se usa ninguna ruta del panel; las peligrosas piden además una confirmación reciente.
    const mfa = evaluarMfa(await nivelSegundoFactor(), { reciente: opciones.peligrosa === true })
    if (!mfa.ok) return { ok: false, res: err(mfa.mensaje, 403) }
    return { ok: true, actor }
  } catch (e) {
    // Si no se puede comprobar, se niega (nunca se deja pasar por error).
    console.error('[permisos] no se pudo comprobar el acceso:', e)
    return { ok: false, res: err('No se pudo comprobar el acceso', 503) }
  }
}

/** Quién es esta persona para el panel, SIN exigir el segundo factor (la usa la propia página de seguridad, que es donde se registra y se confirma). */
export async function actorDeSesion(): Promise<Actor | null> {
  try {
    const { data: { user } } = await usuarioVerificado()
    if (!user?.email) return null
    const correo = user.email.toLowerCase()
    const fila = isAdminEmail(correo) ? null : await obtenerColaborador(correo)
    return resolverActor(user.id, correo, fila)
  } catch (e) {
    console.error('[permisos] no se pudo resolver el actor de la página:', e)
    return null
  }
}

/** Para páginas del servidor: quién es esta persona, o null si no puede entrar al panel. Con ADMIN_MFA=obligatorio, sin autenticador confirmado manda a la página de seguridad. */
export async function actorDePagina(): Promise<Actor | null> {
  const actor = await actorDeSesion()
  // Fuera de cualquier try: redirect() lanza una excepción que no debe tragarse.
  if (actor) await exigirSegundoFactorEnPagina('/panel')
  return actor
}
