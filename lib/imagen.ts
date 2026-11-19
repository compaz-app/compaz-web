// Verifica el contenido real del archivo (magic bytes); el Content-Type del cliente no es confiable.
export function tipoImagenReal(buf: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.length > 12 && String.fromCharCode(...buf.slice(0, 4)) === 'RIFF' && String.fromCharCode(...buf.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}
export const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

// ── Limpieza de las fotos al subirlas ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Las fotos de celular traen metadatos (EXIF): ubicación GPS, modelo del teléfono, fecha. Las del perfil de un compita son PÚBLICAS: esa ubicación no debe quedar
// dentro del archivo. Además pesan hasta 5 MB para mostrarse en 80 píxeles. Al recibirlas se gira según su orientación, se reducen, se pasan a WebP y se descartan
// los metadatos (sharp no los conserva si no se le pide). Nunca falla: si la imagen no se puede procesar, se intenta al menos quitar los metadatos de un JPEG
// a mano, y si tampoco, se guarda como llegó (como antes), dejando constancia en el registro.

export interface ImagenLimpia { bytes: Buffer; contentType: string; ext: string; limpia: boolean }

/** Quita los bloques de metadatos (EXIF, XMP, comentarios, APP13) de un JPEG sin recomprimirlo. Devuelve null si no es un JPEG bien formado. */
export function quitarMetadatosJpeg(buf: Uint8Array): Buffer | null {
  if (!(buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8)) return null
  const partes: Buffer[] = [Buffer.from([0xff, 0xd8])]
  let i = 2
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) return null
    const marca = buf[i + 1]
    if (marca === 0xff) { i++; continue } // relleno
    if (marca === 0xda) { partes.push(Buffer.from(buf.subarray(i))); return Buffer.concat(partes) } // inicio de los datos de la imagen: el resto se copia tal cual
    if (marca >= 0xd0 && marca <= 0xd7 || marca === 0x01) { partes.push(Buffer.from(buf.subarray(i, i + 2))); i += 2; continue }
    const largo = (buf[i + 2] << 8) | buf[i + 3]
    if (largo < 2 || i + 2 + largo > buf.length) return null
    const esMetadato = marca === 0xe1 || (marca >= 0xe3 && marca <= 0xef) || marca === 0xfe // APP1 (EXIF/XMP), APP3…APP15 y comentarios; se conservan JFIF (APP0) y el perfil de color (APP2)
    if (!esMetadato) partes.push(Buffer.from(buf.subarray(i, i + 2 + largo)))
    i += 2 + largo
  }
  return null
}

export async function limpiarImagen(entrada: Uint8Array, opciones: { maxLado?: number; calidad?: number } = {}): Promise<ImagenLimpia> {
  const original = Buffer.from(entrada)
  const tipo = tipoImagenReal(original)
  try {
    const sharp = (await import('sharp')).default
    const bytes = await sharp(original, { failOn: 'error' })
      .rotate() // aplica la orientación del EXIF antes de descartarlo
      .resize({ width: opciones.maxLado ?? 1600, height: opciones.maxLado ?? 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: opciones.calidad ?? 80 })
      .toBuffer()
    return { bytes, contentType: 'image/webp', ext: 'webp', limpia: true }
  } catch (e) {
    console.error('[imagen] no se pudo procesar con sharp; se intenta quitar los metadatos a mano:', e instanceof Error ? e.message : e)
  }
  if (tipo === 'image/jpeg') {
    const sinMeta = quitarMetadatosJpeg(original)
    if (sinMeta) return { bytes: sinMeta, contentType: 'image/jpeg', ext: 'jpg', limpia: true }
  }
  return { bytes: original, contentType: tipo ?? 'application/octet-stream', ext: tipo ? EXT[tipo] : 'bin', limpia: false }
}
