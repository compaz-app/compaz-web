// Equipo y permisos (lógica PURA): qué hace cada permiso y cómo se cuenta un cambio del historial.
import { ETIQUETA_PERMISO, PERMISOS, type Permiso } from '@/lib/permisos-catalogo'

/** Una línea que explica lo que da cada permiso (debajo de su nombre). */
export const DETALLE_PERMISO: Record<Permiso, string> = {
  monitorear: 'Entra a Seguimiento, Personas, Visitas, Actividad y Estado del sistema.',
  atender: 'Trabaja la Bandeja: resolver tareas, insistir con avisos, registrar llamadas y aprobar reseñas.',
  chats: 'Lee la conversación entre un cliente y su compita. Pide un motivo cada vez y queda anotado.',
  telefonos: 'Ve teléfonos, correos y el Registro de accesos. Pide un motivo cada vez y queda anotado.',
  pagos: 'Dinero: confirma y anula pagos. Conviene dejarlo solo para administradores.',
  cuentas: 'Pausa, reactiva o bloquea cuentas de clientes y compitas.',
  ajustes_ver: 'Mira los ajustes (precios, plazos, textos). Solo lectura.',
  ajustes_editar: 'Cambia ajustes de todo el sistema. Queda anotado quién y cuándo.',
  invitar: 'Invita clientes y registra compitas.',
}

export const INFO_EQUIPO = 'Aquí decides quién entra al panel y qué puede hacer. Los administradores tienen acceso total y se definen en la variable ADMIN_EMAILS de Netlify (no desde aquí). A cada colaborador le activas o apagas permisos con un interruptor: el cambio rige al instante y queda en el historial. Un colaborador nunca puede dar permisos, ni a sí mismo. Desactivar a alguien le corta el acceso en ese momento y se puede deshacer; Quitar del equipo lo borra y hay que invitarlo de nuevo. Invitar no manda ningún correo: cuando esa persona entre con su correo, verá el panel con los permisos que le diste.'

export const contarPermisos = (p: Record<string, boolean>) => PERMISOS.filter((k) => p[k] === true).length
const nombre = (k: string) => ETIQUETA_PERMISO[k as Permiso] ?? k
const activos = (v: unknown): string[] => (v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v as Record<string, unknown>).filter(([, x]) => x === true).map(([k]) => k) : [])

/** Lo que cambió entre dos juegos de permisos: qué se activó y qué se quitó. */
export function cambiosDePermisos(antes: unknown, despues: unknown): { activo: string[]; quito: string[] } {
  const a = new Set(activos(antes)), d = new Set(activos(despues))
  return { activo: [...d].filter((k) => !a.has(k)), quito: [...a].filter((k) => !d.has(k)) }
}

/** El texto de una fila del historial del equipo, en palabras llanas. */
export function describirCambioEquipo(accion: string, detalle: unknown): string {
  const d = (detalle && typeof detalle === 'object' ? detalle : {}) as Record<string, unknown>
  if (accion === 'alta') return `Se agregó al equipo con ${activos(d.permisos).length} ${activos(d.permisos).length === 1 ? 'permiso' : 'permisos'}.`
  if (accion === 'desactivado') return 'Se desactivó: ya no puede entrar al panel.'
  if (accion === 'eliminado') return 'Se quitó del equipo: ya no tiene acceso.'
  if (accion === 'reactivado') return 'Se reactivó: vuelve a entrar con sus permisos.'
  if (accion === 'permisos') {
    const c = cambiosDePermisos(d.antes, d.despues)
    const partes = [c.activo.length ? `Activó: ${c.activo.map(nombre).join(', ')}.` : '', c.quito.length ? `Quitó: ${c.quito.map(nombre).join(', ')}.` : ''].filter(Boolean)
    return partes.join(' ') || 'Guardó los permisos sin cambios.'
  }
  return accion
}
