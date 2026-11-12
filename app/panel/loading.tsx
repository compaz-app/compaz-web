import EsqueletoPanel from '@/components/panel/EsqueletoPanel'

// Se muestra al instante al entrar al panel o al navegar a él, antes de que el servidor termine de preparar la pantalla.
export default function Loading() {
  return <main className="mx-auto max-w-5xl px-4 pb-24 pt-5"><EsqueletoPanel /></main>
}
