'use client'

// CMC · Operación real (fase 2A, SOLO LECTURA): la lista de aspirantes del CMC con el diseño aprobado.
// Los datos llegan del servidor (lib/confianza/lectura-real.ts); aquí solo se filtra, se busca y se pagina, sin pedir nada más.
// Filtro, búsqueda y página viven en la dirección. Abrir una ficha es una navegación normal (el servidor lee esa ficha del CMC).

import Link from 'next/link'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import IconoCmc from '@/components/panel/confianza/iconos'
import { BANDA_CF, Cifra, EtiquetaAtencion, EtiquetaEtapa, LISTA_CF } from '@/components/panel/confianza/piezas'
import type { EtapaReal, FilaReal } from '@/lib/confianza/real'

const FLUJO: { id: string; texto: string; que: string; etapa: EtapaReal; enCatalogo?: boolean }[] = [
  { id: 'registro', texto: 'Registro', que: 'Se postularon y reciben o respondieron la preentrevista.', etapa: 'Registrado' },
  { id: 'preseleccion', texto: 'Preselección', que: 'Preseleccionados: falta la entrevista.', etapa: 'Preseleccionado' },
  { id: 'entrevista', texto: 'Entrevista', que: 'Entrevistados: falta registrar la decisión.', etapa: 'Entrevistado' },
  { id: 'verificacion', texto: 'Verificación', que: 'Identidad, referencias y onboarding antes de habilitar.', etapa: 'En verificación' },
  { id: 'habilitacion', texto: 'Habilitación', que: 'Habilitados por el CMC que aún no están en el catálogo.', etapa: 'Habilitado', enCatalogo: false },
  { id: 'operacion', texto: 'Operación', que: 'Habilitados y activos en el catálogo: reciben solicitudes.', etapa: 'Habilitado', enCatalogo: true },
]
const OTROS = [{ id: 'todos', texto: 'Todos' }, { id: 'sin-etapa', texto: 'Sin etapa' }, { id: 'descartados', texto: 'Descartados' }, { id: 'no-cuentan', texto: 'No cuentan' }] as const
const FILTROS = [...FLUJO.map((f) => f.id), ...OTROS.map((o) => o.id)]
const POR_PAGINA = 50
export const CLAVE_BUSQUEDA = 'cmc_busqueda'
const sinSuscripcion = () => () => {}
const leerBusqueda = () => { try { return (sessionStorage.getItem(CLAVE_BUSQUEDA) ?? '').slice(0, 60) } catch { return '' } }
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
// La tabla de columnas aparece desde 1024 px: a 768 el nombre quedaba cortado; por debajo, cada fila es una tarjeta.
const COLUMNAS = 'lg:grid-cols-[minmax(0,1.7fr)_9.5rem_minmax(0,2fr)_9rem_1.25rem]'

const cuenta = (f: FilaReal) => !f.duplicado && !f.prueba
function enFiltro(f: FilaReal, filtro: string): boolean {
  if (filtro === 'no-cuentan') return !cuenta(f)
  if (!cuenta(f)) return false
  if (filtro === 'todos') return true
  if (filtro === 'sin-etapa') return f.etapa === 'Sin etapa'
  if (filtro === 'descartados') return f.etapa === 'Descartado'
  const paso = FLUJO.find((p) => p.id === filtro)
  if (!paso) return true
  if (paso.etapa !== f.etapa) return false
  return paso.enCatalogo === undefined || (f.enWeb === 'catalogo') === paso.enCatalogo
}
const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '·'
const fecha = (iso: string) => new Date(iso).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: false })

export default function ConfianzaReal({ filas, resumen, generado, fuente, descartadas, porResolverWeb, qsInicial }: {
  filas: FilaReal[]
  resumen: { aspirantes: number; enEvaluacion: number; habilitados: number; enCatalogo: number; requierenAtencion: number; sinEtapa: number; duplicados: number; pruebas: number; total: number }
  generado: string; fuente: 'cmc' | 'sintetica'; descartadas: number; porResolverWeb: number; qsInicial: string
}) {
  const inicial = useMemo(() => new URLSearchParams(qsInicial), [qsInicial])
  const [filtro, setFiltro] = useState(() => (FILTROS.includes(inicial.get('cf_etapa') ?? '') ? inicial.get('cf_etapa')! : 'todos'))
  // La búsqueda puede ser un nombre: NUNCA va en la dirección (historial, registros del servidor, analítica).
  // Se guarda solo en esta pestaña (sessionStorage) para que siga ahí al volver de una ficha.
  const guardada = useSyncExternalStore(sinSuscripcion, leerBusqueda, () => '')
  const [escrita, setQ] = useState<string | null>(null)
  const q = escrita ?? guardada
  const [pagina, setPagina] = useState(() => Math.max(1, Number(inicial.get('cf_pag')) || 1))

  useEffect(() => { if (escrita === null) return; try { if (escrita.trim()) sessionStorage.setItem(CLAVE_BUSQUEDA, escrita.slice(0, 60)); else sessionStorage.removeItem(CLAVE_BUSQUEDA) } catch { /* sin almacenamiento */ } }, [escrita])

  useEffect(() => {
    const u = new URL(window.location.href)
    const pon = (k: string, v: string | null) => { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k) }
    pon('cf_etapa', filtro === 'todos' ? null : filtro); pon('cf_q', null); pon('cf_pag', pagina > 1 ? String(pagina) : null)
    if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u.href)
  }, [filtro, pagina])

  const texto = q.trim().toLowerCase()
  const visibles = filas.filter((f) => enFiltro(f, filtro)).filter((f) => !texto || `${f.nombre} ${f.id} ${f.zona}`.toLowerCase().includes(texto))
  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const pag = Math.min(pagina, paginas)
  const pagFilas = visibles.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA)
  const iSel = FLUJO.findIndex((p) => p.id === filtro)
  const n = (id: string) => filas.filter((f) => enFiltro(f, id)).length
  const elegir = (id: string) => { setFiltro(id); setPagina(1) }
  // La ficha conserva el filtro, la búsqueda y la página para poder volver al mismo sitio.
  const hrefFicha = (id: string) => { const u = new URLSearchParams(qsInicial); u.set('cf_id', id); u.delete('cf_tab'); if (filtro !== 'todos') u.set('cf_etapa', filtro); else u.delete('cf_etapa'); u.delete('cf_q'); if (pag > 1) u.set('cf_pag', String(pag)); else u.delete('cf_pag'); return `/panel?${u.toString()}` }

  // data-clarity-mask: Clarity se carga en todo el sitio; con esto no graba el texto de esta vista (nombres de aspirantes).
  return (
    <div className="space-y-5" data-clarity-mask="True">
      <p className="flex flex-wrap items-center gap-2 text-sm text-cf-texto-suave">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${fuente === 'cmc' ? 'bg-verde-claro text-verde-oscuro' : 'bg-amarillo-claro text-ambar-oscuro'}`}>{fuente === 'cmc' ? 'Datos reales del CMC · solo lectura' : 'Fuente sintética de prueba · solo en este preview'}</span>
        <span>{fuente === 'cmc' ? `Leído del CMC el ${fecha(generado)}. Se actualiza cada minuto.` : `Datos inventados, generados el ${fecha(generado)}. No son del CMC.`}</span>
        {descartadas > 0 && <span className="font-semibold text-ambar-oscuro">{descartadas === 1 ? '1 fila' : `${descartadas} filas`} del CMC con el código vacío, mal escrito o repetido no se {descartadas === 1 ? 'muestra' : 'muestran'} (se corrige en el CMC).</span>}
      </p>

      <section aria-label="Resumen">
        <div className={BANDA_CF}>
          <Cifra icono="personas" valor={resumen.aspirantes} texto="Aspirantes" detalle="En el CMC, sin duplicados ni pruebas" info="Fichas de la hoja 03 del CMC. No cuenta los duplicados confirmados por el CMC ni los perfiles de prueba." />
          <Cifra icono="reloj" valor={resumen.enEvaluacion} texto="En evaluación" detalle="Preselección a verificación" info="Etapa de selección Preseleccionado, Entrevistado o En verificación, según el CMC." />
          <Cifra icono="check" tono="exito" valor={resumen.habilitados} texto="Habilitados" detalle={`${resumen.enCatalogo} en el catálogo`} info="Etapa Habilitado en el CMC. El dato «en el catálogo» viene de la web (activos, verificados y con Telegram)." />
          <Cifra icono="alerta" tono={resumen.requierenAtencion > 0 ? 'atencion' : 'neutro'} valor={resumen.requierenAtencion} texto="Requieren atención" detalle="Con una acción del equipo" info="Preentrevista completada sin decidir, preseleccionados, entrevistados, en verificación, sin etapa, alertas que bloquean y habilitadas sin activar." />
        </div>
        <p className="mt-2 px-1 text-sm text-cf-texto-suave">
          No cuentan: {plural(resumen.duplicados, 'duplicado confirmado', 'duplicados confirmados')} y {plural(resumen.pruebas, 'perfil de prueba', 'perfiles de prueba')}.
          {resumen.sinEtapa > 0 && ` ${plural(resumen.sinEtapa, 'ficha sin etapa', 'fichas sin etapa')} (normalización pendiente en el CMC).`}
          {porResolverWeb > 0 && ` ${porResolverWeb} postulaciones de la web todavía no entraron al CMC (Más, Postulaciones).`}
        </p>
      </section>

      <section aria-label="Flujo de selección" className="space-y-4 rounded-xl bg-cf-lateral p-4 sm:p-5">
        <h2 className="text-lg font-extrabold">Flujo de selección</h2>
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <ol className="relative grid min-w-[38rem] grid-cols-6">
            <span aria-hidden className="absolute left-[8.33%] right-[8.33%] top-[18px] h-0.5 bg-cf-borde" />
            {iSel >= 0 && <span aria-hidden className="absolute left-[8.33%] top-[18px] h-0.5 bg-cf-morado-secundario" style={{ width: `${(iSel / 6) * 100}%` }} />}
            {FLUJO.map((p, i) => {
              const sel = filtro === p.id
              const recorrido = iSel < 0 || i < iSel
              const c = n(p.id)
              return (
                <li key={p.id} className="relative flex justify-center">
                  <button type="button" onClick={() => elegir(sel ? 'todos' : p.id)} aria-pressed={sel} title={p.que} className="group flex flex-col items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-cf-morado">
                    <span className={`relative z-10 grid h-9 w-9 place-items-center rounded-full text-sm font-bold transition-colors ${sel ? 'bg-cf-morado text-blanco' : recorrido ? 'border-2 border-cf-morado-secundario bg-blanco text-cf-morado group-hover:bg-cf-lavanda' : 'border-2 border-cf-borde bg-blanco text-cf-texto-suave group-hover:border-cf-morado-secundario'}`}>{i + 1}</span>
                    <span className={`flex flex-col items-center rounded-lg px-3 py-1 ${sel ? 'bg-cf-lavanda' : 'group-hover:bg-blanco'}`}>
                      <span className={`whitespace-nowrap text-base ${sel ? 'font-bold text-cf-morado' : 'font-semibold text-cf-texto'}`}>{p.texto}</span>
                      <span className={`whitespace-nowrap text-sm tabular-nums ${sel ? 'text-cf-morado' : 'text-cf-texto-suave'}`}>{c} {c === 1 ? 'perfil' : 'perfiles'}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-cf-cabecera px-3 py-2 text-sm">
          <IconoCmc nombre="info" className="h-4 w-4 shrink-0 text-cf-texto-suave" />
          {iSel >= 0 ? <p className="min-w-0 flex-1"><span className="font-bold">{FLUJO[iSel].texto}:</span> {FLUJO[iSel].que}</p> : <p className="min-w-0 flex-1 text-cf-texto-suave">Selecciona una etapa para ver quién está ahí.</p>}
          {iSel >= 0 && <button type="button" onClick={() => elegir('todos')} className="font-semibold text-cf-morado hover:underline">Ver todos</button>}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-xl font-extrabold">{iSel >= 0 ? FLUJO[iSel].texto : OTROS.find((o) => o.id === filtro)?.texto === 'Todos' ? 'Todos los aspirantes' : OTROS.find((o) => o.id === filtro)?.texto} <span className="font-bold">({visibles.length})</span></h2>
          <div role="group" aria-label="Otros filtros" className="flex flex-wrap gap-1 rounded-xl border border-cf-borde bg-blanco p-1">
            {OTROS.map((o) => (
              <button key={o.id} type="button" aria-pressed={filtro === o.id} onClick={() => elegir(o.id)}
                className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${filtro === o.id ? 'bg-cf-morado text-blanco' : 'text-cf-texto hover:bg-cf-lateral'}`}>{o.texto}<span className="tabular-nums">{n(o.id)}</span></button>
            ))}
          </div>
          <label className="relative w-full sm:w-64">
            <span className="sr-only">Buscar aspirante</span>
            <IconoCmc nombre="lupa" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cf-texto-suave" />
            <input type="search" value={q} maxLength={60} onChange={(e) => { setQ(e.target.value); setPagina(1) }} placeholder="Nombre, código o zona" className="min-h-11 w-full rounded-xl border border-cf-borde bg-blanco pl-9 pr-3 text-sm placeholder:text-cf-texto-suave focus-visible:outline-2 focus-visible:outline-cf-morado" />
          </label>
        </div>
        {visibles.length === 0 ? <p className="rounded-xl border border-cf-borde py-8 text-center text-sm text-cf-texto-suave">Nadie coincide con este filtro.</p> : (
          <ul className={LISTA_CF}>
            <li aria-hidden className={`hidden ${COLUMNAS} gap-4 bg-cf-cabecera px-4 py-2.5 text-sm font-semibold lg:grid`}><span>Aspirante</span><span>Etapa</span><span>Próxima acción</span><span>Atención</span><span /></li>
            {pagFilas.map((f) => (
              <li key={f.id}>
                <Link prefetch={false} href={hrefFicha(f.id)} className={`grid w-full grid-cols-1 items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-cf-superficie ${COLUMNAS}`}>
                  <span className="flex min-w-0 items-center gap-3">
                    <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cf-cabecera text-sm font-bold text-cf-texto-suave">{iniciales(f.nombre)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{f.nombre || 'Sin nombre en el CMC'}</span>
                      <span className="block truncate text-sm text-cf-texto-suave">{f.id}{f.zona ? ` · ${f.zona}` : ''}{f.duplicado ? ` · duplicado de ${f.duplicadoDe ?? '?'}` : ''}{f.prueba ? ' · perfil de prueba' : ''}</span>
                    </span>
                  </span>
                  <span className="pl-12 lg:pl-0"><EtiquetaEtapa etapa={f.etapa === 'Habilitado' && f.enWeb === 'catalogo' ? 'En operación' : f.etapa} /></span>
                  <span className="min-w-0 pl-12 text-sm lg:pl-0">{f.proxima}</span>
                  <span className="pl-12 lg:pl-0"><EtiquetaAtencion estado={f.atencion} /></span>
                  <IconoCmc nombre="chevron" className="hidden h-5 w-5 text-cf-texto-suave lg:block" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {paginas > 1 && (
          <nav aria-label="Páginas" className="flex items-center justify-between gap-2 text-sm">
            <span className="text-cf-texto-suave">{(pag - 1) * POR_PAGINA + 1}–{Math.min(pag * POR_PAGINA, visibles.length)} de {visibles.length}</span>
            <span className="flex items-center gap-2">
              <button type="button" disabled={pag <= 1} onClick={() => setPagina(pag - 1)} className="min-h-9 rounded-lg border border-cf-borde bg-blanco px-3 font-semibold disabled:opacity-40">‹ Anterior</button>
              <span className="font-bold tabular-nums">{pag} / {paginas}</span>
              <button type="button" disabled={pag >= paginas} onClick={() => setPagina(pag + 1)} className="min-h-9 rounded-lg border border-cf-borde bg-blanco px-3 font-semibold disabled:opacity-40">Siguiente ›</button>
            </span>
          </nav>
        )}
      </section>
    </div>
  )
}
