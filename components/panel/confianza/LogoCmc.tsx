// Logo propio del CMC (el que eligió Luis: cuadrado morado oscuro con cuatro cuadrados blancos en cuadrícula).
// Se usa el ARCHIVO ORIGINAL, sin redibujarlo. Mientras no esté en public/confianza/, no se muestra ningún logo (ni uno provisional).
// Para activarlo: copiar el archivo a public/confianza/ y poner su ruta en LOGO_CMC.
export const LOGO_CMC: string | null = null

export default function LogoCmc({ tamano = 28 }: { tamano?: number }) {
  if (!LOGO_CMC) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={LOGO_CMC} alt="" width={tamano} height={tamano} style={{ width: tamano, height: tamano }} className="shrink-0 rounded-md" />
}
