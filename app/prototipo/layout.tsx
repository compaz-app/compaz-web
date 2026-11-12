import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Prototipo Compaz', robots: { index: false, follow: false } }

export default function PrototipoLayout({ children }: { children: React.ReactNode }) {
  // El prototipo es solo de referencia y revela flujos y permisos: en producción no existe (se puede encender con PROTOTIPO_VISIBLE=1).
  if (process.env.NODE_ENV === 'production' && process.env.PROTOTIPO_VISIBLE !== '1') notFound()
  return (
    <div className="min-h-screen bg-[var(--warm-white)] text-[var(--text-dark)]">
      <div className="bg-[var(--purple-dark)] px-4 py-2 text-center text-xs font-semibold text-white">
        PROTOTIPO con datos falsos. No toca la base de datos ni la configuración real.{' '}
        <Link href="/prototipo" className="underline">Volver al índice</Link>
      </div>
      {children}
    </div>
  )
}
