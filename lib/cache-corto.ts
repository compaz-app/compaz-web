// Memoria de pocos segundos para cálculos caros del panel que no cambian de un clic al siguiente (por ejemplo Seguimiento, que recalcula la
// etapa de cada cliente con varias consultas). Vive en la memoria de cada instancia del servidor: no es un dato compartido ni durable, solo
// evita repetir el mismo trabajo cuando alguien filtra o pagina. Lo que se ve puede tener hasta `ttlMs` de retraso.
const memoria = new Map<string, { hasta: number; valor: Promise<unknown> }>()
let activa = true

/** Las pruebas lo apagan: cada una arranca con datos propios y no debe ver los de otra. */
export function desactivarCacheCorto() { activa = false; memoria.clear() }
export function limpiarCacheCorto() { memoria.clear() }

export function conCacheCorto<T>(clave: string, ttlMs: number, calcular: () => Promise<T>): Promise<T> {
  if (!activa) return calcular()
  const ahora = Date.now()
  const hit = memoria.get(clave)
  if (hit && hit.hasta > ahora) return hit.valor as Promise<T>
  const valor = calcular().catch((e) => { memoria.delete(clave); throw e }) // un fallo nunca se queda guardado
  memoria.set(clave, { hasta: ahora + ttlMs, valor })
  return valor
}
