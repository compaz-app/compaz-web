import { INDICADORES, serie, fechaCorta } from '@/lib/bienestar'
import type { ReporteVisita } from '@/types'

// El gráfico completo de la evolución: una línea por indicador, notas de 1 a 5, visita a visita. Cada línea se distingue por su forma además del color (patrón del trazo
// y marca), y la leyenda la nombra, para que no dependa solo del color. Sin librerías: SVG puro que escala al ancho de la pantalla.
const ESTILOS: { clase: string; trazo: string; marca: 'circulo' | 'cuadro' | 'rombo' | 'triangulo' }[] = [
  { clase: 'text-morado-medio', trazo: '', marca: 'circulo' },
  { clase: 'text-naranja', trazo: '5 3', marca: 'cuadro' },
  { clase: 'text-verde', trazo: '1 4', marca: 'rombo' },
  { clase: 'text-amarillo', trazo: '8 3 2 3', marca: 'triangulo' },
]

function Marca({ x, y, forma }: { x: number; y: number; forma: (typeof ESTILOS)[number]['marca'] }) {
  if (forma === 'circulo') return <circle cx={x} cy={y} r="3.5" fill="currentColor" />
  if (forma === 'cuadro') return <rect x={x - 3} y={y - 3} width="6" height="6" fill="currentColor" />
  if (forma === 'rombo') return <polygon points={`${x},${y - 4} ${x + 4},${y} ${x},${y + 4} ${x - 4},${y}`} fill="currentColor" />
  return <polygon points={`${x},${y - 4} ${x + 4},${y + 3} ${x - 4},${y + 3}`} fill="currentColor" />
}

export default function GraficoEvolucion({ reportes }: { reportes: ReporteVisita[] }) {
  const W = 320, H = 170, IZQ = 22, DER = 8, ARR = 8, ABA = 22
  const n = reportes.length
  const x = (i: number) => IZQ + (n === 1 ? (W - IZQ - DER) / 2 : (i * (W - IZQ - DER)) / (n - 1))
  const y = (nota: number) => ARR + ((5 - nota) * (H - ARR - ABA)) / 4
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Evolución de las cuatro notas de bienestar en las últimas ${n} visitas, de 1 a 5`}>
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={IZQ} x2={W - DER} y1={y(v)} y2={y(v)} className="stroke-borde" strokeWidth="1" />
            <text x={IZQ - 6} y={y(v) + 4} textAnchor="end" className="fill-morado-sutil" fontSize="11">{v}</text>
          </g>
        ))}
        {INDICADORES.map(({ key, label }, k) => {
          const e = ESTILOS[k]
          const puntos = serie(reportes, key).map((nota, i) => (nota === null ? null : { px: x(i), py: y(nota) }))
          const validos = puntos.filter((p): p is { px: number; py: number } => p !== null)
          const d = validos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ')
          return (
            <g key={key} className={e.clase} aria-label={label}>
              {validos.length > 1 && <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={e.trazo || undefined} />}
              {validos.map((p, i) => <Marca key={i} x={p.px} y={p.py} forma={e.marca} />)}
            </g>
          )
        })}
        {[0, n - 1].filter((i, j, a) => a.indexOf(i) === j && reportes[i]).map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : 'end'} className="fill-morado-sutil" fontSize="11">{fechaCorta(reportes[i].created_at)}</text>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-morado-claro">
        {INDICADORES.map(({ key, label }, k) => (
          <span key={key} className={`inline-flex items-center gap-1.5 ${ESTILOS[k].clase}`}>
            <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true"><line x1="0" x2="22" y1="5" y2="5" stroke="currentColor" strokeWidth="2" strokeDasharray={ESTILOS[k].trazo || undefined} /><Marca x={11} y={5} forma={ESTILOS[k].marca} /></svg>
            <span className="text-morado-claro">{label}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
