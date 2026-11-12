// Catálogo de permisos del panel (sin acceso a base de datos). Lo comparten lib/permisos.ts y lib/equipo.ts.

export const PERMISOS = ['monitorear', 'atender', 'chats', 'telefonos', 'pagos', 'cuentas', 'ajustes_ver', 'ajustes_editar', 'invitar'] as const
export type Permiso = (typeof PERMISOS)[number]

/** Lo que se activa por defecto al invitar a alguien (igual que el prototipo aprobado). */
export const PERMISOS_BASE: Record<Permiso, boolean> = {
  monitorear: true, atender: true, chats: true, telefonos: true,
  pagos: false, cuentas: false, ajustes_ver: true, ajustes_editar: false, invitar: false,
}

export const ETIQUETA_PERMISO: Record<Permiso, string> = {
  monitorear: 'Ver seguimiento, personas y visitas',
  atender: 'Atender la bandeja',
  chats: 'Ver los chats entre cliente y compita',
  telefonos: 'Ver teléfonos y datos sensibles',
  pagos: 'Registrar y anular pagos',
  cuentas: 'Pausar, bloquear y editar cuentas',
  ajustes_ver: 'Ver los ajustes',
  ajustes_editar: 'Cambiar los ajustes',
  invitar: 'Invitar clientes y registrar compitas',
}

export type PermisosActor = Record<Permiso, boolean>
/** "raiz" = solo el administrador de ADMIN_EMAILS (acciones destructivas o de configuración del propio sistema). */
export type PermisoRequerido = Permiso | 'raiz'

export const TODOS: PermisosActor = Object.fromEntries(PERMISOS.map((p) => [p, true])) as PermisosActor
export const NINGUNO: PermisosActor = Object.fromEntries(PERMISOS.map((p) => [p, false])) as PermisosActor

/** Normaliza lo guardado: solo cuentan las claves conocidas con valor exactamente `true`. */
export function normalizarPermisos(crudo: unknown): PermisosActor {
  const salida = { ...NINGUNO }
  if (crudo && typeof crudo === 'object' && !Array.isArray(crudo)) {
    for (const p of PERMISOS) if ((crudo as Record<string, unknown>)[p] === true) salida[p] = true
  }
  return salida
}


/** Solo se guardan las claves conocidas activadas: lo apagado simplemente no se guarda (negar por defecto). */
export function soloActivados(permisos: Record<string, unknown>): Record<string, true> {
  const salida: Record<string, true> = {}
  for (const k of PERMISOS) if (permisos[k] === true) salida[k] = true
  return salida
}
