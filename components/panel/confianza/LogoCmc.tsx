// Logo propio del CMC (el que eligió Luis el 17-nov-2026: cuadrado morado con cuatro cuadrados blancos en cuadrícula).
// Es el ARCHIVO ORIGINAL que envió Luis, sin redibujar: solo se recortó el margen blanco de la captura y el fondo de fuera de las
// esquinas redondeadas quedó transparente. Mide 74×74 px: se muestra a 28 px como máximo para que se vea nítido en pantallas 2×.
// Solo se usa dentro del CMC (components/panel/confianza).
export const LOGO_CMC: string | null = '/confianza/logo-cmc.png'

export default function LogoCmc({ tamano = 28 }: { tamano?: number }) {
  if (!LOGO_CMC) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={LOGO_CMC} alt="" aria-hidden width={tamano} height={tamano} style={{ width: tamano, height: tamano }} className="shrink-0" decoding="async" />
}
