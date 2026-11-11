import ConfirmarEliminar from './ConfirmarEliminar'

export const metadata = { title: 'Eliminar mi cuenta · Compaz', robots: { index: false } }

// Aterriza aquí quien abre el enlace del correo. El token solo se envía al pulsar el botón (POST), nunca al abrir la página.
export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  return <main className="mx-auto max-w-xl px-4 py-10"><ConfirmarEliminar token={typeof t === 'string' ? t : ''} /></main>
}
