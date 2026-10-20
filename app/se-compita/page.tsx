import type { Metadata } from 'next'
import SeCompita from './SeCompita'

const TITULO = 'Sé Compita | Compaz'
const DESCRIPCION =
  'Acompaña a adultos mayores cuyas familias están lejos. Pago por hora en dólares o bolívares, horario flexible y el respaldo del equipo Compaz.'

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: '/se-compita' },
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    url: '/se-compita',
    images: ['/og-image.png'],
  },
}

export default function SeCompitaPage() {
  return <SeCompita />
}
