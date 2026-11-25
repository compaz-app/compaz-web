import Image from 'next/image'
import type { CSSProperties } from 'react'

// Foto redonda de un compita (avatar). Se sirve por el optimizador de imágenes de Next: AVIF o WebP según el navegador y al tamaño exacto en que se ve
// (antes se bajaba la foto original, de hasta 5 MB, para mostrarla en 32 a 80 píxeles). Si la dirección no es del almacenamiento de Compaz, que el optimizador
// no admite, se muestra como siempre.
const ORIGEN = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin } catch { return '' } })()
export const esFotoOptimizable = (src: string): boolean => src.startsWith('/') || (ORIGEN !== '' && src.startsWith(`${ORIGEN}/storage/v1/object/public/`))

export default function FotoRedonda({ src, alt, size, style }: { src: string; alt: string; size: number; style?: CSSProperties }) {
  const base: CSSProperties = { width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }
  if (!esFotoOptimizable(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={size} height={size} loading="lazy" decoding="async" style={base} />
  }
  // Se pide al doble del tamaño visible para pantallas de alta densidad; calidad 70 basta para un avatar.
  return <Image src={src} alt={alt} width={size} height={size} sizes={`${size}px`} quality={70} style={base} />
}
