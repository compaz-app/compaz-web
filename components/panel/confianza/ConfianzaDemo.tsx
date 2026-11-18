'use client'

// Sistema de Confianza, modalidad de DEMOSTRACIÓN.
// Aislada por diseño: no llama a ninguna API ni a la base. Todo el estado vive en este navegador (localStorage) y la navegación
// (filtro, búsqueda, ficha abierta y pestaña) en la dirección, para que un refresco deje la pantalla igual.
// Las reglas son las del CMC (lib/confianza/reglas.ts) a través del motor de lib/confianza/demo.ts.

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Boton from '@/components/ui/base/Boton'
import { BANDA_CF, Cifra, EtiquetaAtencion, EtiquetaEtapa, EtiquetaMadurez, LISTA_CF, BOTON_CF, type Atencion } from '@/components/panel/confianza/piezas'
import IconoCmc from '@/components/panel/confianza/iconos'
import FichaDemo, { TABS_FICHA, type TabFicha } from '@/components/panel/confianza/FichaDemo'
import { aplicar, escenarioInicial, leerEstadoGuardado, proximaAccion, requiereAtencion, resumenDemo, PASOS_OPERACION, type AccionDemo, type AspiranteDemo, type EstadoDemo } from '@/lib/confianza/demo'
import { CAPACIDADES } from '@/lib/confianza/reglas'

const CLAVE_GUARDADO = 'compaz-confianza-demo'

/** El flujo de selección, que también es el filtro principal. Cada paso dice qué aspirantes están ahí ahora. */
const FLUJO = [
  { id: 'Registrado', texto: 'Registro', que: 'Recibimos la postulación web y la preentrevista automática.' },
  { id: 'Preseleccionado', texto: 'Preselección', que: 'Revisamos la preentrevista y decidimos entrevistar.' },
  { id: 'Entrevistado', texto: 'Entrevista', que: 'Entrevista con 8 criterios y una decisión explícita.' },
  { id: 'En verificación', texto: 'Verificación', que: 'Validamos identidad, referencias y onboarding antes de habilitar.' },
  { id: 'Habilitado', texto: 'Habilitación', que: 'Pasó los 7 controles; se incorpora a la plataforma.' },
  { id: 'Operación', texto: 'Operación', que: 'Activo en el catálogo: las familias ya pueden pedirlo.' },
] as const
const OTROS = [{ id: 'todas', texto: 'Todos' }, { id: 'Descartado', texto: 'Descartados' }, { id: 'excluidos', texto: 'No cuentan' }] as const
type Filtro = (typeof FLUJO)[number]['id'] | (typeof OTROS)[number]['id']
const FILTROS: readonly string[] = [...FLUJO.map((f) => f.id), ...OTROS.map((f) => f.id)]

/** Columnas de la tabla en escritorio (encabezado y filas comparten la misma rejilla). */
const COLUMNAS = 'md:grid-cols-[minmax(0,1.7fr)_9.5rem_minmax(0,2fr)_9rem_1.25rem]'
const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

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
  const iSel = FLUJO.findIndex((f) => f.id === filtro)
  const tituloLista = filtro === 'todas' ? 'Todos los aspirantes' : filtro === 'excluidos' ? 'No cuentan en las cifras' : filtro === 'Descartado' ? 'Descartados' : FLUJO.find((f) => f.id === filtro)?.texto ?? ''

  return (
    <div className="space-y-5">
      {mensaje}

      <section aria-label="Resumen">
        <div className={BANDA_CF}>
          <Cifra icono="personas" valor={r.registrados} texto="Aspirantes" detalle="Sin duplicados ni pruebas" info="Postulaciones válidas del escenario de demostración. No cuenta duplicados ni perfiles de prueba." />
          <Cifra icono="reloj" valor={r.enEvaluacion} texto="En evaluación" detalle="Preselección a verificación" info="Preseleccionados, entrevistados y en verificación." />
          <Cifra icono="check" tono="exito" valor={r.habilitados} texto="Habilitados" detalle="Pasaron los 7 controles" info="Aspirantes que pasaron los 7 controles del CMC (incluye a los que ya están en operación)." />
          <Cifra icono="alerta" tono={r.pendientes > 0 ? 'atencion' : 'neutro'} valor={r.pendientes} texto="Requieren atención" detalle="Con una acción pendiente" info="Tienen una acción pendiente del equipo: decidir, entrevistar, verificar o completar su incorporación." />
        </div>
        <p className="mt-2 px-1 text-sm text-cf-texto-suave">Cifras del escenario de demostración, no resultados de Compaz. No cuentan: {r.duplicados} duplicado y {r.pruebas} perfil de prueba.</p>
      </section>

      <section aria-label="Flujo de selección" className="space-y-4 rounded-xl bg-cf-lateral p-4 sm:p-5">
        <h2 className="text-lg font-extrabold">Flujo de selección</h2>
        {/* Stepper: una línea continua con 6 nodos. En el teléfono se desplaza dentro de su caja (nunca la página entera). */}
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <ol className="relative grid min-w-[38rem] grid-cols-6">
            <span aria-hidden className="absolute left-[8.33%] right-[8.33%] top-[18px] h-0.5 bg-cf-borde" />
            {iSel >= 0 && <span aria-hidden className="absolute left-[8.33%] top-[18px] h-0.5 bg-cf-morado-secundario" style={{ width: `${(iSel / 6) * 100}%` }} />}
            {FLUJO.map((f, i) => {
              const sel = filtro === f.id
              const recorrido = iSel < 0 || i < iSel
              const n = cuenta(f.id)
              return (
                <li key={f.id} className="relative flex justify-center">
                  <button type="button" onClick={() => setFiltro(sel ? 'todas' : f.id)} aria-pressed={sel} title={f.que}
                    className="group flex flex-col items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-cf-morado">
                    <span className={`relative z-10 grid h-9 w-9 place-items-center rounded-full text-sm font-bold transition-colors ${sel ? 'bg-cf-morado text-blanco' : recorrido ? 'border-2 border-cf-morado-secundario bg-blanco text-cf-morado group-hover:bg-cf-lavanda' : 'border-2 border-cf-borde bg-blanco text-cf-texto-suave group-hover:border-cf-morado-secundario'}`}>{i + 1}</span>
                    <span className={`flex flex-col items-center rounded-lg px-3 py-1 ${sel ? 'bg-cf-lavanda' : 'group-hover:bg-blanco'}`}>
                      <span className={`whitespace-nowrap text-base ${sel ? 'font-bold text-cf-morado' : 'font-semibold text-cf-texto'}`}>{f.texto}</span>
                      <span className={`whitespace-nowrap text-sm tabular-nums ${sel ? 'text-cf-morado' : 'text-cf-texto-suave'}`}>{n} {n === 1 ? 'perfil' : 'perfiles'}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-cf-cabecera px-3 py-2 text-sm">
          <IconoCmc nombre="info" className="h-4 w-4 shrink-0 text-cf-texto-suave" />
          {iSel >= 0
            ? <p className="min-w-0 flex-1 text-cf-texto"><span className="font-bold">{FLUJO[iSel].texto}:</span> {FLUJO[iSel].que}</p>
            : <p className="min-w-0 flex-1 text-cf-texto-suave">Selecciona una etapa para ver quién está ahí.</p>}
          {iSel >= 0 && <button type="button" onClick={() => setFiltro('todas')} className="font-semibold text-cf-morado hover:underline">Ver todos</button>}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-xl font-extrabold">{tituloLista} <span className="font-bold">({filas.length})</span></h2>
          <div role="group" aria-label="Otros filtros" className="flex gap-1 rounded-xl border border-cf-borde bg-blanco p-1">
            {OTROS.map((o) => (
              <button key={o.id} type="button" aria-pressed={filtro === o.id} onClick={() => setFiltro(o.id)}
                className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${filtro === o.id ? 'bg-cf-morado text-blanco' : 'text-cf-texto hover:bg-cf-lateral'}`}>{o.texto}<span className="tabular-nums">{cuenta(o.id)}</span></button>
            ))}
          </div>
          <label className="relative w-full sm:w-64">
            <span className="sr-only">Buscar aspirante</span>
            <IconoCmc nombre="lupa" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cf-texto-suave" />
            <input type="search" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, código o zona" className="min-h-11 w-full rounded-xl border border-cf-borde bg-blanco pl-9 pr-3 text-sm placeholder:text-cf-texto-suave focus-visible:outline-2 focus-visible:outline-cf-morado" />
          </label>
        </div>
        {filas.length === 0 ? <p className="rounded-xl border border-cf-borde py-8 text-center text-sm text-cf-texto-suave">Nadie en esta etapa ahora mismo.</p> : (
          <ul className={LISTA_CF}>
            <li aria-hidden className={`hidden ${COLUMNAS} gap-4 bg-cf-cabecera px-4 py-2.5 text-sm font-semibold text-cf-texto md:grid`}>
              <span>Aspirante</span><span>Etapa</span><span>Próxima acción</span><span>Atención</span><span />
            </li>
            {filas.map((a) => {
              const p = proximaAccion(a, estado.solicitudes)
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => { setAbierta(a.id); setTab('resumen'); setAviso(null) }}
                    className={`grid w-full grid-cols-1 items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-cf-superficie ${COLUMNAS}`}>
                    <span className="flex min-w-0 items-center gap-3">
                      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cf-cabecera text-sm font-bold text-cf-texto-suave">{iniciales(a.nombre)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{a.nombre}</span>
                        <span className="block truncate text-sm text-cf-texto-suave">{a.id} · {a.zona}{a.duplicadoDe ? ` · duplicado de ${a.duplicadoDe}` : ''}{a.esPrueba ? ' · perfil de prueba' : ''}</span>
                      </span>
                    </span>
                    <span className="pl-12 md:pl-0"><EtiquetaEtapa etapa={activo(a) ? 'En operación' : a.etapa} /></span>
                    <span className="min-w-0 pl-12 text-sm text-cf-texto md:pl-0">{p.tipo === 'cerrado' ? 'Sin acciones pendientes.' : p.texto}{p.solicitud ? ` · ${p.solicitud.familia}: ${p.solicitud.texto.toLowerCase()}` : ''}</span>
                    <span className="pl-12 md:justify-self-start md:pl-0"><EtiquetaAtencion estado={atencionDe(a)} /></span>
                    <IconoCmc nombre="chevron" className="hidden h-5 w-5 text-cf-texto-suave md:block" />
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
