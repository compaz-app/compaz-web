// Lo que se ve mientras llegan los datos de una pantalla del panel: bloques grises en el lugar de la lista. El menú y el encabezado ya están en pantalla.
export default function EsqueletoPanel() {
  const barra = 'animate-pulse rounded-lg bg-borde/60'
  return (
    <div role="status" aria-live="polite" aria-label="Cargando" className="space-y-3">
      <div className={`${barra} h-8 w-48`} />
      <div className={`${barra} h-5 w-full max-w-xl`} />
      <div className="flex gap-2"><div className={`${barra} h-9 w-24`} /><div className={`${barra} h-9 w-24`} /><div className={`${barra} h-9 w-24`} /></div>
      <div className="divide-y divide-borde rounded-xl border border-borde bg-blanco">
        {Array.from({ length: 7 }, (_, i) => <div key={i} className="flex items-center gap-3 px-3 py-3"><div className={`${barra} h-4 w-1/3`} /><div className={`${barra} h-4 w-1/5`} /><div className={`${barra} ml-auto h-4 w-16`} /></div>)}
      </div>
      <span className="sr-only">Cargando la pantalla...</span>
    </div>
  )
}
