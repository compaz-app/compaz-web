'use client'

// Sistema de Confianza, modalidad de DEMOSTRACIÓN.
// Aislada por diseño: no llama a ninguna API ni a la base. Todo el estado vive en este navegador (localStorage) y la navegación
// (filtro, búsqueda, ficha abierta y pestaña) en la dirección, para que un refresco deje la pantalla igual.
// Las reglas son las del CMC (lib/confianza/reglas.ts) a través del motor de lib/confianza/demo.ts.

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Aviso from '@/components/ui/base/Aviso'
import Boton from '@/components/ui/base/Boton'
import InfoBoton from '@/components/ui/InfoBoton'
import { CLASE_LISTA, ChipBoton, Conteo, Filtros, Flecha, Rol, TituloSeccion } from '@/components/panel/ui'
import { Cifra, EtiquetaEtapa, EtiquetaMadurez } from '@/components/panel/confianza/piezas'
import FichaDemo, { TABS_FICHA, type TabFicha } from '@/components/panel/confianza/FichaDemo'
import { aplicar, escenarioInicial, leerEstadoGuardado, resumenDemo, type AccionDemo, type EstadoDemo } from '@/lib/confianza/demo'
import { CAPACIDADES, ETAPAS, siguienteAccion } from '@/lib/confianza/reglas'

const CLAVE_GUARDADO = 'compaz-confianza-demo'
const FILTROS = ['todas', ...ETAPAS, 'Descartado', 'excluidos'] as const
type Filtro = (typeof FILTROS)[number]

function guardar(e: EstadoDemo) { try { window.localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(e)) } catch { /* sin almacenamiento: la demo sigue en memoria */ } }
function cargar(): EstadoDemo | null { try { return leerEstadoGuardado(window.localStorage.getItem(CLAVE_GUARDADO)) } catch { return null } }

// Solo en el navegador: el estado vive en localStorage y el servidor nunca lo ve (ni lo pinta a medias).
const ConfianzaDemo = dynamic(() => Promise.resolve(Demo), { ssr: false, loading: () => <p className="text-sm text-texto-medio" aria-busy>Preparando la demostración…</p> })
export default ConfianzaDemo

function Demo({ qsInicial }: { qsInicial: string }) {
  const inicial = useMemo(() => new URLSearchParams(qsInicial), [qsInicial])
  const [filtro, setFiltro] = useState<Filtro>(() => (FILTROS as readonly string[]).includes(inicial.get('cf_etapa') ?? '') ? inicial.get('cf_etapa') as Filtro : 'todas')
  const [q, setQ] = useState(() => (inicial.get('cf_q') ?? '').slice(0, 60))
  const [abierta, setAbierta] = useState<string | null>(() => inicial.get('cf_id'))
  const [tab, setTab] = useState<TabFicha>(() => TABS_FICHA.some(([id]) => id === inicial.get('cf_tab')) ? inicial.get('cf_tab') as TabFicha : 'resumen')
  const [estado, setEstado] = useState<EstadoDemo>(() => cargar() ?? escenarioInicial(new Date().toISOString()))
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  // La primera vez, el escenario recién creado también queda guardado.
  useEffect(() => { guardar(estado) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Navegación en la dirección (sin pedirle nada al servidor).
  useEffect(() => {
    const u = new URL(window.location.href)
    const pon = (k: string, v: string | null) => { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k) }
    pon('cf_etapa', filtro === 'todas' ? null : filtro); pon('cf_q', q.trim() || null); pon('cf_id', abierta); pon('cf_tab', abierta && tab !== 'resumen' ? tab : null)
    if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u.href)
  }, [filtro, q, abierta, tab])

  const hacer = useCallback((acc: AccionDemo): boolean => {
    const r = aplicar(estado, acc, new Date().toISOString())
    if (!r.ok) { setAviso({ ok: false, texto: r.error }); return false }
    setEstado(r.estado); guardar(r.estado); setAviso({ ok: true, texto: r.mensaje }); return true
  }, [estado])

  const reiniciar = () => { const e = escenarioInicial(new Date().toISOString()); setEstado(e); guardar(e); setAbierta(null); setTab('resumen'); setAviso({ ok: true, texto: 'Demostración reiniciada: el escenario vuelve al inicio.' }) }

  const banda = (
    <Aviso tamano="compacto" tono="advertencia">
      <span>
        <strong>Demostración.</strong> Personas y familias ficticias. Se guarda solo en este navegador: no envía correos, mensajes de Telegram, solicitudes ni pagos.{' '}
        <InfoBoton que="Cómo está aislada" texto="La demostración no llama a ninguna API ni a la base de datos. Las reglas son las mismas del CMC, pero cada acción solo cambia la copia guardada en este navegador. Reiniciar la devuelve al escenario inicial." />
      </span>
    </Aviso>
  )
  const mensaje = aviso && (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1"><Aviso tamano="compacto" tono={aviso.ok ? 'exito' : 'peligro'}>{aviso.texto}</Aviso></div>
      <button type="button" onClick={() => setAviso(null)} className="min-h-9 px-2 text-sm font-bold text-texto-medio" aria-label="Cerrar el mensaje">Cerrar</button>
    </div>
  )

  const actual = abierta ? estado.aspirantes.find((a) => a.id === abierta) : null
  if (actual) {
    return (
      <div className="space-y-3">
        {banda}
        <FichaDemo a={actual} estado={estado} tab={tab} setTab={(t) => { setTab(t); setAviso(null) }} hacer={hacer} volver={() => { setAbierta(null); setTab('resumen'); setAviso(null) }} mensaje={mensaje} />
      </div>
    )
  }

  const r = resumenDemo(estado)
  const texto = q.trim().toLowerCase()
  const cuenta = (f: Filtro) => estado.aspirantes.filter((a) => f === 'todas' ? !a.duplicadoDe && !a.esPrueba : f === 'excluidos' ? !!(a.duplicadoDe || a.esPrueba) : a.etapa === f && !a.duplicadoDe && !a.esPrueba).length
  const filas = estado.aspirantes
    .filter((a) => filtro === 'todas' ? !a.duplicadoDe && !a.esPrueba : filtro === 'excluidos' ? !!(a.duplicadoDe || a.esPrueba) : a.etapa === filtro && !a.duplicadoDe && !a.esPrueba)
    .filter((a) => !texto || `${a.nombre} ${a.id} ${a.zona}`.toLowerCase().includes(texto))

  return (
    <div className="space-y-4">
      {banda}
      {mensaje}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cifra valor={r.registrados} texto="Aspirantes" info="Postulaciones válidas de la demostración. No cuenta duplicados ni perfiles de prueba." />
        <Cifra valor={r.enEvaluacion} texto="En evaluación" info="Preseleccionados, entrevistados y en verificación." />
        <Cifra valor={r.habilitados} texto="Habilitados" info="Pasaron los 7 controles del CMC." />
        <Cifra valor={r.pendientes} texto="Requieren atención" alerta={r.pendientes > 0} info="Tienen una acción pendiente del equipo: decidir, entrevistar, verificar o activar." />
      </div>
      <p className="text-xs text-texto-sutil">No cuentan: {r.duplicados} duplicado y {r.pruebas} perfil de prueba (filtro Excluidos).</p>

      <details className="rounded-xl border border-borde bg-blanco p-3">
        <summary className="cursor-pointer text-sm font-extrabold text-morado-medio">Qué ya funciona en la operación real y qué está simulado</summary>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {CAPACIDADES.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
              <span className="min-w-0"><span className="font-bold">{c.texto}</span> <span className="text-texto-medio">{c.detalle}</span></span>
              <EtiquetaMadurez madurez={c.madurez} corta />
            </li>
          ))}
        </ul>
      </details>

      <div className="space-y-2">
        <Filtros info="Filtra por etapa de selección. Excluidos muestra los duplicados y los perfiles de prueba, que no cuentan en las cifras.">
          {FILTROS.map((f) => <ChipBoton key={f} activo={filtro === f} onClick={() => setFiltro(f)}>{f === 'todas' ? 'Todas' : f === 'excluidos' ? 'Excluidos' : f}<Conteo n={cuenta(f)} /></ChipBoton>)}
        </Filtros>
        <label className="block max-w-sm">
          <span className="sr-only">Buscar aspirante</span>
          <input type="search" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, código o zona" className="min-h-10 w-full rounded-xl border border-borde bg-blanco px-3 text-sm" />
        </label>
      </div>

      <section className="space-y-2">
        <TituloSeccion>Aspirantes ({filas.length})</TituloSeccion>
        {filas.length === 0 ? <p className="text-sm text-texto-medio">Nadie coincide con ese filtro.</p> : (
          <ul className={CLASE_LISTA}>
            {filas.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => { setAbierta(a.id); setTab('resumen'); setAviso(null) }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-lavanda-sutil">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold">{a.nombre}</span><span className="text-xs text-texto-sutil">{a.id}</span><EtiquetaEtapa etapa={a.etapa} />
                      {a.duplicadoDe && <Rol>Duplicado de {a.duplicadoDe}</Rol>}{a.esPrueba && <Rol>Prueba</Rol>}
                    </span>
                    <span className="block truncate text-xs text-texto-medio">{a.zona} · {siguienteAccion(a)}</span>
                  </span>
                  <Flecha />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <Boton tamano="compacto" variante="fantasma" onClick={reiniciar} info="Borra lo que hiciste en la demostración y vuelve al escenario inicial. Solo afecta a este navegador.">Reiniciar demostración</Boton>
      </div>
    </div>
  )
}
