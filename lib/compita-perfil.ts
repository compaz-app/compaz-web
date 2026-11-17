// ¿Tiene el compita su perfil público lleno? Es lo que ven las familias al elegir, así que Telegram no se activa sin esto. Función PURA.
// Lo mínimo es lo mismo que exige el formulario de registro: descripción y al menos un servicio. La foto y el video son opcionales (el formulario tampoco los exige).
export const PERFIL_MINIMO = 'descripción y al menos un servicio'

export function perfilCompleto(c: { descripcion?: string | null; servicios?: string[] | null } | null | undefined): boolean {
  if (!c) return false
  return !!c.descripcion && c.descripcion.trim().length > 0 && Array.isArray(c.servicios) && c.servicios.some((s) => typeof s === 'string' && s.trim().length > 0)
}
