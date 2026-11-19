// Reduce una foto EN EL TELÉFONO antes de subirla (corre en el navegador). Un celular saca fotos de 3 a 8 MB; con datos lentos eso tarda minutos y a veces falla a mitad.
// Aquí se baja a un tamaño útil (por defecto 1600 píxeles de lado) y se comprime: unos 150 a 400 KB. Redibujar la foto en un lienzo además deja atrás sus metadatos
// (ubicación GPS), y el servidor vuelve a limpiarla igual: esta es la primera barrera y la que ahorra la subida. NUNCA falla: si algo sale mal, devuelve la original.

export const MAX_LADO_FOTO = 1600
/** Una foto ya liviana y chica no se vuelve a comprimir (cada recompresión le quita calidad sin ganar nada). */
export const PESO_QUE_NO_SE_REDUCE = 300 * 1024

/** Las dimensiones finales: nunca agranda, mantiene la proporción y el lado mayor queda en `max`. Pura, se prueba sin navegador. */
export function dimensionesReducidas(ancho: number, alto: number, max: number): { ancho: number; alto: number; reducida: boolean } {
  const mayor = Math.max(ancho, alto)
  if (!(mayor > 0) || mayor <= max) return { ancho, alto, reducida: false }
  const escala = max / mayor
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)), reducida: true }
}

export async function reducirFoto(archivo: File, opciones: { maxLado?: number; calidad?: number } = {}): Promise<File> {
  try {
    if (typeof document === 'undefined' || !archivo.type.startsWith('image/')) return archivo
    const max = opciones.maxLado ?? MAX_LADO_FOTO
    const calidad = opciones.calidad ?? 0.82
    const imagen = await createImageBitmap(archivo) // aplica la orientación de la foto
    const { ancho, alto, reducida } = dimensionesReducidas(imagen.width, imagen.height, max)
    if (!reducida && archivo.size <= PESO_QUE_NO_SE_REDUCE) { imagen.close?.(); return archivo }
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho; lienzo.height = alto
    lienzo.getContext('2d')!.drawImage(imagen, 0, 0, ancho, alto)
    imagen.close?.()
    const aBlob = (tipo: string) => new Promise<Blob | null>((r) => lienzo.toBlob(r, tipo, calidad))
    let blob = await aBlob('image/webp')
    if (!blob || blob.type !== 'image/webp') blob = await aBlob('image/jpeg') // algunos navegadores no escriben WebP
    if (!blob || blob.size >= archivo.size) return archivo // si no se ganó nada, mejor la original
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    return new File([blob], `${archivo.name.replace(/\.[^.]+$/, '') || 'foto'}.${ext}`, { type: blob.type })
  } catch {
    return archivo
  }
}
