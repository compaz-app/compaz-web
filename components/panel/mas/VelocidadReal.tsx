'use client'

import { useState } from 'react'
import Boton from '@/components/ui/base/Boton'
import InfoBoton from '@/components/ui/InfoBoton'
import { ETIQUETA_METRICA, UNIDAD, type ResumenVelocidad, type FilaResumen } from '@/lib/velocidad-real'

const COLOR = { good: 'text-verde-oscuro', 'needs-improvement': 'text-naranja-oscuro', poor: 'text-rojo-oscuro' } as const
const TEXTO = { good: 'Bien', 'needs-improvement': 'Mejorable', poor: 'Lento' } as const
const num = (f: FilaResumen) => (f.metrica === 'CLS' ? f.p75.toFixed(2) : `${Math.round(f.p75)} ${UNIDAD[f.metrica]}`)

function Tabla({ titulo, filas }: { titulo: string; filas: FilaResumen[] }) {
  if (filas.length === 0) return null
  return (
    <div>
      <p className="text-xs font-bold text-texto-medio">{titulo}</p>
      <ul className="mt-1 space-y-1">
        {filas.map((f) => (
          <li key={f.metrica} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span>{ETIQUETA_METRICA[f.metrica]} <span className="text-xs text-texto-sutil">({f.metrica}, {f.muestras} mediciones)</span></span>
            <span className={`font-extrabold ${COLOR[f.valoracion]}`}>{num(f)} · {TEXTO[f.valoracion]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** La velocidad que viven los usuarios reales en su teléfono (últimos 7 días). Solo lee. Se pide al tocar el botón, no al abrir la pantalla. */
export default function VelocidadReal() {
  const [cargando, setCargando] = useState(false)
  const [r, setR] = useState<ResumenVelocidad | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  async function ver() {
    setCargando(true); setFallo(null)
    try {
      const res = await fetch('/api/admin/velocidad-real', { cache: 'no-store' })
      const j = await res.json().catch(() => null) as { data?: ResumenVelocidad; error?: string } | null
      if (res.ok && j?.data) setR(j.data); else setFallo(j?.error ?? `Error ${res.status}`)
    } catch { setFallo('Sin conexión. Inténtalo otra vez.') } finally { setCargando(false) }
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Boton tamano="compacto" variante="secundario" cargando={cargando} onClick={ver}
          info="Muestra cuánto tardan en cargar y responder las pantallas en los teléfonos y computadoras de las personas, de los últimos 7 días. Solo lee; no cambia nada.">Ver velocidad de los usuarios</Boton>
        <InfoBoton que="De dónde sale" texto="Cada pantalla que se abre manda, al cerrarse, cuánto tardó. No se guarda quién fue, ni su IP, ni la dirección completa, solo el primer tramo (por ejemplo, /portal). Se muestra el valor que alcanzan 3 de cada 4 personas: así lo mide Google. Se borra lo de más de 30 días." />
      </div>
      {fallo && <p role="alert" className="text-xs font-bold text-rojo-oscuro">{fallo}</p>}
      {r?.estado === 'sin_tabla' && <p role="status" className="text-sm">Todavía no se guarda nada: falta aplicar la migración <code>20261118_web_vitals.sql</code> en la base.</p>}
      {r?.estado === 'sin_datos' && <p role="status" className="text-sm">Aún no hay mediciones. Aparecen apenas alguien use el sitio.</p>}
      {r?.estado === 'ok' && (
        <div role="status" className="space-y-3 rounded-xl border border-borde bg-blanco p-3">
          <p className="text-xs text-texto-sutil">Últimos {r.dias} días · {r.total} mediciones</p>
          <Tabla titulo="Todos los usuarios" filas={r.general} />
          <Tabla titulo="Solo con conexión lenta (3G o peor)" filas={r.lentas} />
          {r.paginasLentas.length > 0 && (
            <div>
              <p className="text-xs font-bold text-texto-medio">Pantallas que más tardan en verse</p>
              <ul className="mt-1 space-y-1 text-sm">{r.paginasLentas.map((p) => <li key={p.ruta} className="flex justify-between gap-3"><span>{p.ruta} <span className="text-xs text-texto-sutil">({p.muestras})</span></span><span className={`font-extrabold ${COLOR[p.valoracion]}`}>{p.lcp} ms</span></li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
