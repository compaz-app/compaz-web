'use client'

// Sistema de Confianza, modalidad de DEMOSTRACIÓN.
// Aislada por diseño: no llama a ninguna API ni a la base. Todo el estado vive en este navegador (localStorage) y la navegación
// (filtro, búsqueda, ficha abierta y pestaña) en la dirección, para que un refresco deje la pantalla igual.
// Las reglas son las del CMC (lib/confianza/reglas.ts) a través del motor de lib/confianza/demo.ts.

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Boton from '@/components/ui/base/Boton'
import { Cifra, EtiquetaAtencion, EtiquetaEtapa, EtiquetaMadurez, LISTA_CF, BOTON_CF, type Atencion } from '@/components/panel/confianza/piezas'
import FichaDemo, { TABS_FICHA, type TabFicha } from '@/components/panel/confianza/FichaDemo'
import { aplicar, escenarioInicial, leerEstadoGuardado, proximaAccion, requiereAtencion, resumenDemo, PASOS_OPERACION, type AccionDemo, type AspiranteDemo, type EstadoDemo } from '@/lib/confianza/demo'
import { CAPACIDADES } from '@/lib/confianza/reglas'

const CLAVE_GUARDADO = 'compaz-confianza-demo'

/** El flujo de selección, que también es el filtro principal. Cada paso dice qué aspirantes están ahí ahora. */
const FLUJO = [
  { id: 'Registrado', texto: 'Registro', que: 'Se postuló desde la web y respondió la preentrevista automática.' },
  { id: 'Preseleccionado', texto: 'Preselección', que: 'El equipo revisó la preentrevista y decidió entrevistarlo.' },
  { id: 'Entrevistado', texto: 'Entrevista', que: 'Entrevista con 8 criterios y una decisión explícita del entrevistador.' },
  { id: 'En verificación', texto: 'Verificación', que: 'Identidad, referencias y onboarding antes de habilitar.' },
  { id: 'Habilitado', texto: 'Habilitación', que: 'Pasó los 7 controles del CMC; ahora se incorpora a la plataforma.' },
  { id: 'Operación', texto: 'Operación', que: 'Activo en el catálogo: las familias ya pueden pedirlo.' },
] as const
const OTROS = [{ id: 'todas', texto: 'Todos' }, { id: 'Descartado', texto: 'Descartados' }, { id: 'excluidos', texto: 'No cuentan' }] as const
type Filtro = (typeof FLUJO)[number]['id'] | (typeof OTROS)[number]['id']
const FILTROS: readonly string[] = [...FLUJO.map((f) => f.id), ...OTROS.map((f) => f.id)]

const activo = (a: AspiranteDemo) => a.etapa === 'Habilitado' && a.operacion >= PASOS_OPERACION.length
const excluido = (a: AspiranteDemo) => !!(a.duplicadoDe || a.esPrueba)
function enFiltro(a: AspiranteDemo, f: Filtro): boolean {
  if (f === 'excluidos') return excluido(a)
  if (excluido(a)) return false
  if (f === 'todas') return true
  if (f === 'Operación') return activo(a)
  if (f === 'Habilitado') return a.etapa === 'Habilitado' && !activo(a)
  return a.etapa === f
}
function atencionDe(a: AspiranteDemo): Atencion {
  if (excluido(a)) return 'excluido'
  if (a.etapa === 'Descartado') return 'cerrado'
  if (a.alertas.some((x) => x.abierta && x.bloquea)) return 'bloqueado'
  return requiereAtencion(a) ? 'accion' : 'al-dia'
}

function guardar(e: EstadoDemo) { try { window.localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(e)) } catch { /* sin almacenamiento: la demo sigue en memoria */ } }
function cargar(): EstadoDemo | null { try { return leerEstadoGuardado(window.localStorage.getItem(CLAVE_GUARDADO)) } catch { return null } }

// Solo en el navegador: el estado vive en localStorage y el servidor nunca lo ve (ni lo pinta a medias).
const ConfianzaDemo = dynamic(() => Promise.resolve(Demo), { ssr: false, loading: () => <p className="text-sm text-cf-texto-suave" aria-busy>Preparando la demostración…</p> })
export default ConfianzaDemo

function Demo({ qsInicial }: { qsInicial: string }) {
  const inicial = useMemo(() => new URLSearchParams(qsInicial), [qsInicial])
  const [filtro, setFiltro] = useState<Filtro>(() => FILTROS.includes(inicial.get('cf_etapa') ?? '') ? inicial.get('cf_etapa') as Filtro : 'todas')
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

  // Mensajes discretos: una línea con su color (verde si salió, rojo si no), sin caja grande.
  const mensaje = aviso && (
    <div aria-live="polite" className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${aviso.ok ? 'bg-verde-claro/60 text-verde-oscuro' : 'bg-rojo-claro text-rojo-oscuro'}`}>
      <span aria-hidden className="font-extrabold">{aviso.ok ? '✓' : '!'}</span>
      <span className="min-w-0 flex-1 font-semibold">{aviso.texto}</span>
      <button type="button" onClick={() => setAviso(null)} className="text-xs font-bold opacity-70 hover:opacity-100" aria-label="Cerrar el mensaje">Cerrar</button>
    </div>
  )

  const actual = abierta ? estado.aspirantes.find((a) => a.id === abierta) : null
  if (actual) {
    return <FichaDemo a={actual} estado={estado} tab={tab} setTab={(t) => { setTab(t); setAviso(null) }} hacer={hacer} volver={() => { setAbierta(null); setTab('resumen'); setAviso(null) }} mensaje={mensaje} />
  }

  const r = resumenDemo(estado)
  const texto = q.trim().toLowerCase()
  const cuenta = (f: Filtro) => estado.aspirantes.filter((a) => enFiltro(a, f)).length
  const filas = estado.aspirantes.filter((a) => enFiltro(a, filtro)).filter((a) => !texto || `${a.nombre} ${a.id} ${a.zona}`.toLowerCase().includes(texto))
  const tituloLista = filtro === 'todas' ? 'Todos los aspirantes' : filtro === 'excluidos' ? 'No cuentan en las cifras' : filtro === 'Descartado' ? 'Descartados' : FLUJO.find((f) => f.id === filtro)?.texto ?? ''

  return (
    <div className="space-y-5">
      {mensaje}

      <section aria-label="Resumen">
        <div className="grid grid-cols-2 divide-cf-borde sm:grid-cols-4 sm:divide-x">
          <Cifra valor={r.registrados} texto="Aspirantes" detalle="Sin duplicados ni pruebas" info="Postulaciones válidas del escenario de demostración. No cuenta duplicados ni perfiles de prueba." />
          <Cifra valor={r.enEvaluacion} texto="En evaluación" detalle="Preselección a verificación" info="Preseleccionados, entrevistados y en verificación." />
          <Cifra valor={r.habilitados} texto="Habilitados" detalle="Pasaron los 7 controles" info="Aspirantes que pasaron los 7 controles del CMC (incluye a los que ya están en operación)." />
          <Cifra valor={r.pendientes} texto="Requieren atención" detalle="Con una acción pendiente" tono={r.pendientes > 0 ? 'atencion' : 'neutro'} info="Tienen una acción pendiente del equipo: decidir, entrevistar, verificar o completar su incorporación." />
        </div>
        <p className="mt-3 text-xs text-cf-texto-suave">Cifras del escenario de demostración, no resultados de Compaz. No cuentan: {r.duplicados} duplicado y {r.pruebas} perfil de prueba.</p>
      </section>

      <section aria-label="Flujo de selección" className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-extrabold">Flujo de selección</h2>
          {FLUJO.some((f) => f.id === filtro) && <button type="button" onClick={() => setFiltro('todas')} className="text-sm font-bold text-cf-morado-secundario hover:underline">Ver todos</button>}
        </div>
        {/* Stepper: una línea continua con 6 nodos. En el teléfono se desplaza dentro de su caja (nunca la página entera). */}
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <ol className="relative grid min-w-[36rem] grid-cols-6">
            <span aria-hidden className="absolute left-[8.33%] right-[8.33%] top-4 h-px bg-cf-borde" />
            {FLUJO.map((f, i) => {
              const sel = filtro === f.id
              const n = cuenta(f.id)
              return (
                <li key={f.id} className="relative flex justify-center">
                  <button type="button" onClick={() => setFiltro(sel ? 'todas' : f.id)} aria-pressed={sel} title={f.que}
                    className="group flex flex-col items-center gap-1.5 rounded-lg px-1 pb-1 focus-visible:outline-2 focus-visible:outline-cf-morado">
                    <span className={`relative z-10 grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold transition-colors ${sel ? 'bg-cf-morado text-blanco ring-4 ring-cf-lavanda' : n > 0 ? 'border border-cf-morado-secundario bg-blanco text-cf-morado-secundario group-hover:bg-cf-lavanda' : 'border border-cf-borde bg-blanco text-cf-texto-suave group-hover:bg-cf-lateral'}`}>{i + 1}</span>
                    <span className={`whitespace-nowrap text-sm ${sel ? 'font-extrabold text-cf-morado' : 'font-semibold text-cf-texto'}`}>{f.texto}</span>
                    <span className={`rounded-full px-2 text-xs font-bold tabular-nums ${sel ? 'bg-cf-lavanda text-cf-morado' : 'text-cf-texto-suave'}`}>{n} {n === 1 ? 'perfil' : 'perfiles'}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
        {FLUJO.some((f) => f.id === filtro) && <p className="text-sm text-cf-texto-suave"><span className="font-bold text-cf-texto">{FLUJO.find((f) => f.id === filtro)!.texto}:</span> {FLUJO.find((f) => f.id === filtro)!.que}</p>}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-base font-extrabold">{tituloLista} <span className="font-semibold text-cf-texto-suave">({filas.length})</span></h2>
          <div role="group" aria-label="Otros filtros" className="flex gap-1 rounded-lg bg-cf-lateral p-1 ring-1 ring-cf-borde">
            {OTROS.map((o) => (
              <button key={o.id} type="button" aria-pressed={filtro === o.id} onClick={() => setFiltro(o.id)}
                className={`flex min-h-8 items-center rounded-md px-2.5 text-sm font-semibold ${filtro === o.id ? 'bg-blanco text-cf-morado shadow-sm' : 'text-cf-texto-suave hover:text-cf-texto'}`}>{o.texto} <span className="ml-1 tabular-nums opacity-70">{cuenta(o.id)}</span></button>
            ))}
          </div>
          <label className="w-full sm:w-56">
            <span className="sr-only">Buscar aspirante</span>
            <input type="search" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, código o zona" className="min-h-9 w-full rounded-lg border border-cf-borde bg-blanco px-3 text-sm placeholder:text-cf-texto-suave focus-visible:outline-2 focus-visible:outline-cf-morado" />
          </label>
        </div>
        {filas.length === 0 ? <p className="border-y border-cf-borde py-6 text-center text-sm text-cf-texto-suave">Nadie en esta etapa ahora mismo.</p> : (
          <ul className={LISTA_CF}>
            <li aria-hidden className="hidden grid-cols-[minmax(0,1.3fr)_8.5rem_minmax(0,2fr)_7.5rem_1rem] gap-3 bg-cf-lateral px-3 py-2 text-xs font-bold text-cf-texto-suave md:grid">
              <span>Aspirante</span><span>Etapa</span><span>Próxima acción</span><span>Atención</span><span />
            </li>
            {filas.map((a) => {
              const p = proximaAccion(a, estado.solicitudes)
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => { setAbierta(a.id); setTab('resumen'); setAviso(null) }}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-3 text-left hover:bg-cf-lateral md:grid-cols-[minmax(0,1.3fr)_8.5rem_minmax(0,2fr)_7.5rem_1rem]">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{a.nombre}</span>
                      <span className="block text-xs text-cf-texto-suave">{a.id} · {a.zona}{a.duplicadoDe ? ` · duplicado de ${a.duplicadoDe}` : ''}{a.esPrueba ? ' · perfil de prueba' : ''}</span>
                    </span>
                    <span className="justify-self-end md:justify-self-start"><EtiquetaEtapa etapa={activo(a) ? 'En operación' : a.etapa} /></span>
                    <span className="col-span-2 min-w-0 text-sm text-cf-texto-suave md:col-span-1">{p.tipo === 'cerrado' ? 'Sin acciones pendientes.' : p.texto}{p.solicitud ? ` · ${p.solicitud.familia}: ${p.solicitud.texto.toLowerCase()}` : ''}</span>
                    <span className="md:justify-self-start"><EtiquetaAtencion estado={atencionDe(a)} /></span>
                    <span aria-hidden className="hidden text-lg text-cf-texto-suave md:block">›</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <details className="group border-t border-cf-borde pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-base font-extrabold">
          <span aria-hidden className="transition-transform group-open:rotate-90">›</span>Qué ya funciona en la operación real y qué está simulado
        </summary>
        <ul className="mt-3 grid gap-x-6 gap-y-2 md:grid-cols-2">
          {CAPACIDADES.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0"><span className="font-bold">{c.texto}.</span> <span className="text-cf-texto-suave">{c.detalle}</span></span>
              <EtiquetaMadurez madurez={c.madurez} corta />
            </li>
          ))}
        </ul>
      </details>

      <div className="flex justify-end">
        <Boton tamano="compacto" variante="fantasma" className={BOTON_CF.suave} onClick={reiniciar} info="Borra lo que hiciste en la demostración y vuelve al escenario inicial. Solo afecta a este navegador.">Reiniciar demostración</Boton>
      </div>
    </div>
  )
}
