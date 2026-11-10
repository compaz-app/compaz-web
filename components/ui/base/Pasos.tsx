// Barra de progreso del cliente: pasos hechos (✓), el actual (resaltado) y los que faltan.
export default function Pasos({ pasos, actual }: { pasos: readonly string[]; actual: number }) {
  return (
    <ol className="flex items-start" aria-label="Tu progreso">
      {pasos.map((p, i) => {
        const hecho = i < actual; const esActual = i === actual
        return (
          <li key={p} className="flex flex-1 flex-col items-center text-center" aria-current={esActual ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <div className={`h-1 flex-1 ${i === 0 ? 'opacity-0' : hecho || esActual ? 'bg-naranja' : 'bg-borde'}`} />
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold ${hecho ? 'bg-naranja text-blanco' : esActual ? 'bg-morado-medio text-blanco ring-4 ring-amarillo-marca' : 'bg-borde text-morado-sutil'}`}>{hecho ? '✓' : i + 1}</div>
              <div className={`h-1 flex-1 ${i === pasos.length - 1 ? 'opacity-0' : hecho ? 'bg-naranja' : 'bg-borde'}`} />
            </div>
            <span className={`mt-1 text-xs ${esActual ? 'font-extrabold text-morado-profundo' : 'font-semibold text-morado-sutil'}`}>{p}</span>
          </li>
        )
      })}
    </ol>
  )
}
