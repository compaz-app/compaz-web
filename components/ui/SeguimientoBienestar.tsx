'use client'

import { useState } from 'react'
import Boton from '@/components/ui/base/Boton'
import InfoBoton from '@/components/ui/InfoBoton'
import GraficoEvolucion from '@/components/ui/GraficoEvolucion'
import {
  INDICADORES, ETIQUETA_NOTA, MIN_VISITAS_TENDENCIA, ordenarYRecortar, serie, promedioReporte, nivelGeneral, formatoPromedio, tendencia, direccion,
  fraseDeCambio, fechaCorta, novedades, type Nota,
} from '@/lib/bienestar'
import type { ReporteVisita } from '@/types'

// Seguimiento de bienestar. De arriba abajo: un resumen general con su tendencia, las cuatro notas con su línea de evolución, la rejilla de colores de las últimas
// visitas, una frase de lo que cambió y las novedades con fecha. El gráfico completo queda detrás de un botón. Pensado para el teléfono (2 por 2) y se abre a
// 4 en una fila en pantallas anchas. La lógica vive en lib/bienestar.ts.
type Props = { reportes: ReporteVisita[]; compitaNombre: string }

const COLOR_NOTA: Record<number, string> = { 1: 'var(--color-rojo)', 2: 'var(--color-naranja)', 3: 'var(--color-amarillo)', 4: 'var(--color-verde-vivo)', 5: 'var(--color-verde)' }
const colorDe = (n: Nota) => (n === null ? 'var(--color-borde)' : COLOR_NOTA[n])

const DEMO_REPORTES: ReporteVisita[] = [
  { animo: 3, fisico: 3, participacion: 2, entorno: 4, novedad: null }, { animo: 3, fisico: 3, participacion: 3, entorno: 4, novedad: null },
  { animo: 4, fisico: 3, participacion: 3, entorno: 4, novedad: 'Mencionó dolor de rodilla derecha.' }, { animo: 4, fisico: 4, participacion: 4, entorno: 5, novedad: null },
  { animo: 3, fisico: 3, participacion: 4, entorno: 4, novedad: null }, { animo: 4, fisico: 3, participacion: 4, entorno: 5, novedad: null },
  { animo: 4, fisico: 4, participacion: 4, entorno: 5, novedad: 'Pidió salir a caminar al patio.' }, { animo: 5, fisico: 4, participacion: 5, entorno: 5, novedad: null },
].map((r, i) => ({ id: `demo${i}`, visita_id: `d${i}`, resumen_ia: null, created_at: new Date(Date.UTC(2026, 9, 8 + i * 7, 15)).toISOString(), ...r }))

function Linea({ valores }: { valores: Nota[] }) {
  const validos = valores.map((v, i) => (v === null ? null : { v, i })).filter((p): p is { v: number; i: number } => p !== null)
  if (validos.length < 2) return null
  const W = 64, H = 22, P = 3
  const pt = ({ v, i }: { v: number; i: number }) => ({ x: P + (i * (W - 2 * P)) / (valores.length - 1), y: H - P - ((v - 1) * (H - 2 * P)) / 4 })
  const ps = validos.map(pt)
  const ultimo = ps[ps.length - 1]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="mt-1 block">
      <path d={ps.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')} fill="none" className="stroke-morado-sutil" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={ultimo.x} cy={ultimo.y} r="3" fill={colorDe(validos[validos.length - 1].v)} />
    </svg>
  )
}

const FLECHA = { sube: { t: '↑', c: 'text-verde' }, baja: { t: '↓', c: 'text-rojo' }, igual: { t: '→', c: 'text-morado-sutil' } } as const

export default function SeguimientoBienestar({ reportes, compitaNombre }: Props) {
  const [ejemplo, setEjemplo] = useState(false)
  const [completo, setCompleto] = useState(false)
  const [tip, setTip] = useState<string | null>(null)
  const sinDatos = reportes.length === 0
  const datos = ordenarYRecortar(ejemplo && sinDatos ? DEMO_REPORTES : reportes)
  const n = datos.length
  const ultimo = datos[n - 1]
  const prom = ultimo ? promedioReporte(ultimo) : null
  const tend = n >= 2 && prom !== null ? tendencia(prom, promedioReporte(datos[n - 2])) : null
  const nivel = prom !== null ? nivelGeneral(prom) : null
  const frase = fraseDeCambio(datos)
  const notas = novedades(datos)
  const hayTendencia = n >= MIN_VISITAS_TENDENCIA

  return (
    <section aria-label="Seguimiento de bienestar" className="mb-6 rounded-2xl border border-borde bg-blanco p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="m-0 flex items-center gap-1 text-base font-extrabold text-morado-profundo">
          Seguimiento de bienestar
          <InfoBoton que="La escala de bienestar" texto="Cada visita, tu compita da una nota del 1 al 5 a cuatro cosas: ánimo, condición física, participación y ambiente. 1 es muy bajo, 2 bajo, 3 regular, 4 bueno y 5 excelente. Si algo no aplica, no cuenta en el resumen." />
        </h3>
        {sinDatos && <Boton tamano="compacto" variante="secundario" info="Muestra cómo se verá esta sección con datos de ejemplo. No es información de tu familiar." onClick={() => setEjemplo((v) => !v)}>{ejemplo ? 'Ocultar ejemplo' : 'Ver ejemplo'}</Boton>}
      </div>

      {sinDatos && !ejemplo && (
        <p className="m-0 text-sm leading-relaxed text-morado-sutil">Después de cada visita, {compitaNombre} registra cómo estuvo tu familiar. Aquí verás cómo va visita a visita.</p>
      )}
      {sinDatos && ejemplo && <p className="mb-3 rounded-xl bg-fondo-lavanda px-3 py-2 text-xs font-bold text-morado-medio">Ejemplo con datos ilustrativos. Así se verá cuando haya visitas registradas.</p>}

      {n > 0 && (
        <>
          <div className="flex items-center gap-4 rounded-xl bg-fondo-claro px-4 py-3">
            {prom !== null && nivel ? (
              <>
                <div className="text-4xl font-extrabold leading-none" style={{ color: colorDe(Math.round(prom)) }}>{formatoPromedio(prom)}</div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-base font-extrabold text-morado-profundo">{nivel.texto}</p>
                  {tend && <p className="m-0 mt-0.5 text-sm text-morado-claro"><span className={`font-extrabold ${FLECHA[tend.dir].c}`} aria-hidden="true">{FLECHA[tend.dir].t}</span> {tend.texto}</p>}
                </div>
              </>
            ) : <p className="m-0 text-sm text-morado-sutil">Esta visita no tiene notas que sumar.</p>}
          </div>
          <p className="mb-4 mt-1.5 px-0.5 text-xs text-morado-sutil">Última visita, {fechaCorta(ultimo.created_at)}, con {compitaNombre.split(' ')[0]}</p>

          <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {INDICADORES.map(({ key, label }) => {
              const v = serie(datos, key)
              const actual = v[n - 1]
              const dir = direccion(actual, n >= 2 ? v[n - 2] : null)
              return (
                <div key={key} className="rounded-xl border border-borde px-3 py-2.5">
                  <p className="m-0 text-xs text-morado-claro">{label}</p>
                  {actual !== null ? (
                    <div className="mt-0.5 flex items-baseline gap-1.5">
                      <span className="text-2xl font-extrabold" style={{ color: colorDe(actual) }}>{actual}</span>
                      <span className="text-xs text-morado-sutil">/5</span>
                      {dir && <span className={`ml-auto text-sm font-extrabold ${FLECHA[dir].c}`} aria-label={dir === 'sube' ? 'subió' : dir === 'baja' ? 'bajó' : 'igual'}>{FLECHA[dir].t}</span>}
                    </div>
                  ) : <p className="m-0 mt-1 text-sm text-morado-sutil">No aplica</p>}
                  {hayTendencia && <Linea valores={v} />}
                </div>
              )
            })}
          </div>

          {hayTendencia ? (
            <div className="mb-4">
              <div className="mb-1.5 flex items-baseline justify-between">
                <p className="m-0 text-sm font-extrabold text-morado-profundo">Últimas {n} visitas</p>
                <span className="text-xs text-morado-sutil">toca un cuadro</span>
              </div>
              {INDICADORES.map(({ key, label }) => (
                <div key={key} className="mb-[3px] flex items-center gap-[3px]">
                  <span className="w-[92px] shrink-0 text-xs text-morado-claro">{label}</span>
                  {serie(datos, key).map((nota, i) => (
                    <button
                      key={i} type="button"
                      aria-label={`${label}, ${fechaCorta(datos[i].created_at)}: ${nota === null ? 'no aplica' : `${nota} de 5, ${ETIQUETA_NOTA[nota]}`}`}
                      onClick={() => setTip(`${fechaCorta(datos[i].created_at)}: ${label} ${nota === null ? 'no aplica' : `${nota}/5, ${ETIQUETA_NOTA[nota]}`}`)}
                      className="h-6 min-w-0 flex-1 rounded border-0 p-0"
                      style={{ backgroundColor: colorDe(nota) }}
                    />
                  ))}
                </div>
              ))}
              <div className="ml-[95px] flex justify-between text-[10px] text-morado-sutil"><span>{fechaCorta(datos[0].created_at)}</span><span>{fechaCorta(ultimo.created_at)}</span></div>
              <p role="status" className="m-0 mt-2 min-h-[18px] text-sm text-morado-claro">{tip ?? ''}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-morado-sutil" aria-hidden="true">
                <span>Bajo</span>{[1, 2, 3, 4, 5].map((v) => <span key={v} className="h-2 w-3.5 rounded-sm" style={{ backgroundColor: COLOR_NOTA[v] }} />)}<span>Excelente</span>
              </div>
            </div>
          ) : (
            <p className="mb-4 mt-0 rounded-xl bg-fondo-lavanda px-3 py-2 text-sm text-morado-medio">Con la próxima visita empezaremos a ver cómo evoluciona.</p>
          )}

          {frase && <p className="mb-4 mt-0 rounded-xl bg-fondo-lavanda px-3 py-2.5 text-sm font-bold text-morado-medio">{frase}</p>}

          {notas.length > 0 && (
            <div className="mb-4">
              <p className="m-0 mb-1 text-sm font-extrabold text-morado-profundo">Novedades</p>
              {notas.map((x, i) => (
                <div key={i} className="flex gap-3 border-t border-borde py-2">
                  <span className="min-w-11 text-xs text-morado-sutil">{x.fecha}</span>
                  <span className="text-sm text-morado-profundo">{x.texto}</span>
                </div>
              ))}
            </div>
          )}

          {hayTendencia && (
            <>
              <Boton variante="secundario" info="Muestra u oculta el gráfico con las cuatro notas visita a visita. No cambia nada." onClick={() => setCompleto((v) => !v)}>{completo ? 'Ocultar la evolución' : 'Ver evolución completa'}</Boton>
              {completo && <div className="mt-3"><GraficoEvolucion reportes={datos} /></div>}
            </>
          )}
        </>
      )}
    </section>
  )
}
