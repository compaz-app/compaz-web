'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import Aviso from '@/components/ui/base/Aviso'
import InfoBoton from '@/components/ui/InfoBoton'
import { CLASE_LISTA, Rol, TituloSeccion } from '@/components/panel/ui'
import type { FilaAjuste } from '@/lib/panel-mas-tipos'

const texto = (v: unknown) => String(v)
function malo(f: FilaAjuste, v: string): string | null {
  if (f.tipo === 'texto') return !v.trim() ? 'No puede quedar vacío.' : f.max !== null && v.trim().length > f.max ? `Máximo ${f.max} caracteres.` : null
  const n = Number(v)
  if (v.trim() === '' || !Number.isFinite(n)) return 'Debe ser un número.'
  if ((f.min !== null && n < f.min) || (f.max !== null && n > f.max)) return `Debe estar entre ${f.min} y ${f.max}.`
  return null
}

/**
 * La lista de ajustes por grupo. Los cambios se juntan y se guardan TODOS a la vez con "Guardar y aplicar" (el servidor valida el conjunto y,
 * si algo no cuadra, no guarda nada). Con solo el permiso de ver, los campos quedan en solo lectura.
 */
export default function AjustesForm({ filas, puedeEditar, esAdmin }: { filas: FilaAjuste[]; puedeEditar: boolean; esAdmin: boolean }) {
  const router = useRouter()
  const inicial = useMemo(() => Object.fromEntries(filas.map((f) => [f.clave, texto(f.valor)])), [filas])
  const [v, setV] = useState<Record<string, string>>(inicial)
  const [acepta, setAcepta] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  const sucios = filas.filter((f) => v[f.clave] !== inicial[f.clave])
  const malos = sucios.filter((f) => malo(f, v[f.clave]))
  const lugares = [...new Set(sucios.flatMap((f) => f.usa))]
  const grupos = [...new Set(filas.map((f) => f.grupo))]

  // Los precios: un plan que sale más caro que las horas sueltas no tiene sentido comercial. Se avisa y se pide confirmar (el servidor también lo comprueba).
  const hora = Number(v.precio_hora), p1 = Number(v.precio_plan_quincenal), p2 = Number(v.precio_plan_semanal)
  const hayPrecios = [hora, p1, p2].every((n) => Number.isFinite(n)) && 'precio_hora' in v && filas.some((f) => f.clave === 'precio_hora' && f.conectado)
  const ahorro1 = hora * 4 - p1, ahorro2 = hora * 8 - p2
  const incoherente = hayPrecios && sucios.some((f) => f.grupo === 'Precios') && (ahorro1 < 0 || ahorro2 < 0)

  async function guardar() {
    setCargando(true); setMsg(null)
    try {
      const cambios = Object.fromEntries(sucios.map((f) => [f.clave, f.tipo === 'numero' ? Number(v[f.clave]) : v[f.clave].trim()]))
      const r = await fetch('/api/admin/ajustes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cambios, confirmar_incoherente: acepta }) })
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!r.ok || j?.ok === false) { setMsg({ ok: false, texto: j?.error ?? `Error ${r.status}` }); return }
      setMsg({ ok: true, texto: '✓ Guardado y aplicado en todo el sistema.' }); setAcepta(false); router.refresh()
    } catch { setMsg({ ok: false, texto: 'Sin conexión. No se guardó nada: inténtalo otra vez.' }) } finally { setCargando(false) }
  }

  return (
    <div className="space-y-5">
      {filas.some((f) => !f.conectado) && <Aviso tamano="compacto" tono="info">Los ajustes marcados “Aún no conectado” se ven, pero no se pueden cambiar: el sistema todavía no los lee (su valor real está fijo en el código). Cambiarlos no tendría ningún efecto.</Aviso>}
      {!puedeEditar && <Aviso tamano="compacto" tono="advertencia">No tienes permiso para cambiar los ajustes. Puedes verlos; pídele el permiso a un administrador.</Aviso>}
      {msg?.ok && <p role="status" className="text-sm font-bold text-verde-oscuro">{msg.texto}</p>}
      {grupos.map((g) => (
        <section key={g} className="space-y-2">
          <TituloSeccion>{g}</TituloSeccion>
          <ul className={CLASE_LISTA}>
            {filas.filter((f) => f.grupo === g).map((f) => {
              const err = sucios.includes(f) ? malo(f, v[f.clave]) : null
              const cambiado = v[f.clave] !== inicial[f.clave]
              return (
                <li key={f.clave} className={`px-3 py-2.5 ${cambiado ? 'bg-amarillo-claro/40' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <label htmlFor={`aj-${f.clave}`} className="flex min-w-48 flex-1 items-center gap-1 text-sm">{f.etiqueta}{!f.conectado && <Rol>Aún no conectado</Rol>}{f.propuesto && <Rol>Propuesta</Rol>}{f.soloAdmin && !esAdmin && <Rol>Solo administrador</Rol>}
                      <InfoBoton que={`Qué es: ${f.etiqueta}`} texto={`${f.conectado ? '' : 'AÚN NO CONECTADO: el sistema todavía no lee este ajuste, así que cambiarlo no tiene efecto hoy. Lo que sigue es lo que hará cuando se conecte. '}${f.explica} Se usa en: ${f.usa.join(', ')}. Valor de fábrica: ${f.unidad === '$' ? '$' : ''}${f.tipo === 'texto' ? 'el texto original' : f.defecto}${f.unidad && f.unidad !== '$' ? ` ${f.unidad}` : ''}.${f.propuesto ? ' Es una cifra propuesta que el dueño aún no ha confirmado.' : ''}`} /></label>
                    {f.tipo === 'numero' && (
                      <span className="flex items-center gap-1">{f.unidad === '$' && <b className="text-sm">$</b>}
                        <input id={`aj-${f.clave}`} inputMode="decimal" value={v[f.clave]} disabled={!puedeEditar || !f.conectado || (f.soloAdmin && !esAdmin)} onChange={(e) => { setAcepta(false); setV((o) => ({ ...o, [f.clave]: e.target.value })) }}
                          className="min-h-10 w-24 rounded-lg border border-borde bg-blanco px-2 text-right text-sm font-bold disabled:bg-fondo-claro" />
                        {f.unidad && f.unidad !== '$' && <span className="text-sm text-texto-medio">{f.unidad}</span>}</span>
                    )}
                  </div>
                  {f.tipo === 'texto' && <textarea id={`aj-${f.clave}`} value={v[f.clave]} disabled={!puedeEditar || !f.conectado || (f.soloAdmin && !esAdmin)} onChange={(e) => { setAcepta(false); setV((o) => ({ ...o, [f.clave]: e.target.value })) }} className="mt-2 min-h-24 w-full rounded-lg border border-borde p-2 text-sm disabled:bg-fondo-claro" />}
                  {err && <p className="mt-1 text-xs font-bold text-rojo-oscuro">{err}</p>}
                </li>
              )
            })}
          </ul>
          {g === 'Precios' && hayPrecios && (
            <p className="rounded-xl bg-fondo-claro px-3 py-2 text-xs text-texto-medio">
              Así quedarían los planes: A la carta <b>${hora}</b> · Compañía <b>${p1}</b> ({ahorro1 < 0 ? <b className="text-rojo-oscuro">${-ahorro1} MÁS caro que 4 horas sueltas</b> : `el cliente ahorra $${ahorro1}`}) · Compañía Plus <b>${p2}</b> ({ahorro2 < 0 ? <b className="text-rojo-oscuro">${-ahorro2} MÁS caro que 8 horas sueltas</b> : `ahorra $${ahorro2}`}).
            </p>
          )}
        </section>
      ))}

      {sucios.length > 0 && puedeEditar && (
        <div className="sticky bottom-20 z-10 space-y-2 rounded-xl border-2 border-naranja bg-blanco p-3 shadow-lg lg:bottom-4">
          <p className="text-sm font-extrabold">{sucios.length} {sucios.length === 1 ? 'cambio' : 'cambios'} sin guardar</p>
          <p className="text-xs text-texto-medio">Al guardar se actualiza en: {lugares.join(', ')}. Vale desde ahora y no cambia lo ya pagado.</p>
          {incoherente && (
            <label className="flex items-start gap-2 rounded-lg border-2 border-rojo bg-rojo-claro p-2 text-xs font-bold text-rojo-oscuro">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Con estos precios un plan sale más caro que comprar las mismas horas sueltas: ningún cliente lo elegiría. Marca la casilla si es lo que quieres.</span>
            </label>
          )}
          {msg && !msg.ok && <Aviso tamano="compacto" tono="peligro">{msg.texto}</Aviso>}
          <div className="flex items-center gap-2">
            <Boton tamano="compacto" info="El cambio rige desde ahora en todo el sistema (precios, plazos y textos) y queda anotado quién lo hizo y cuándo. Se guarda todo o nada: si algo no cuadra, no se guarda ningún cambio." disabled={malos.length > 0 || (incoherente && !acepta)} cargando={cargando} onClick={guardar}>Guardar y aplicar</Boton>
            <Boton tamano="compacto" variante="fantasma" info="Descarta lo que cambiaste y vuelve a los valores guardados. No guarda nada." onClick={() => { setV(inicial); setAcepta(false); setMsg(null) }}>Deshacer</Boton>
          </div>
        </div>
      )}
    </div>
  )
}
