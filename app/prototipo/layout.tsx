import Link from 'next/link'

export const metadata = { title: 'Prototipo Compaz', robots: { index: false, follow: false } }

export default function PrototipoLayout({ children }: { children: React.ReactNode }) {
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
