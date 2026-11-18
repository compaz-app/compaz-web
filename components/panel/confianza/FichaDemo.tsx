'use client'

// Ficha de un aspirante en la demostración del Sistema de Confianza. Cada pestaña muestra una cosa y no repite lo de las otras:
// el Resumen dice dónde está y qué sigue; el resto, el detalle de cada paso del CMC. Lo ya guardado va primero y el formulario
// para registrar otro queda plegado.

import { useState } from 'react'
import Aviso from '@/components/ui/base/Aviso'
import Boton from '@/components/ui/base/Boton'
import InfoBoton from '@/components/ui/InfoBoton'
import { BOTON_CF, EtiquetaEtapa, EtiquetaMadurez, LISTA_CF, Marca, TarjetaCf } from '@/components/panel/confianza/piezas'
import { FormEntrevista, FormOnboarding, FormVerificacion, MotivoEnLinea } from '@/components/panel/confianza/FormulariosDemo'
import { PASOS_OPERACION, PASOS_SOLICITUD, enFrase, proximaAccion, type AccionDemo, type AspiranteDemo, type EstadoDemo, type SolicitudDemo } from '@/lib/confianza/demo'
import { CRITERIOS_PUNTAJE, CRITERIOS_SI_NO, ONBOARDING_CONTROLES, evaluarHabilitacion, promedioEntrevista, transicionDisponible, type Entrevista, type Verificacion } from '@/lib/confianza/reglas'

export const TABS_FICHA = [
  ['resumen', 'Resumen'], ['preentrevista', 'Preentrevista'], ['entrevista', 'Entrevista'], ['verificaciones', 'Verificaciones'],
  ['onboarding', 'Onboarding'], ['habilitacion', 'Habilitación'], ['operacion', 'Operación'], ['historial', 'Historial'],
] as const
export type TabFicha = (typeof TABS_FICHA)[number][0]

type Hacer = (a: AccionDemo) => boolean
const fechaCorta = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })
const decimal = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const ultima = <T extends { fecha: string }>(xs: T[]) => (xs.length ? [...xs].sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0))[xs.length - 1] : null)
const vigente = (vs: Verificacion[], atributo: string) => vs.some((v) => v.atributo === atributo && v.estado === 'Vigente' && v.resultado === 'Verificado')
const enOperacion = (a: AspiranteDemo) => a.etapa === 'Habilitado' && a.operacion >= PASOS_OPERACION.length

// ── Encabezado y progreso ──────────────────────────────────────────────────────

const PASOS_FICHA = ['Registro', 'Preselección', 'Entrevista', 'Verificación', 'Habilitación', 'Operación'] as const
const INDICE: Record<string, number> = { Registrado: 0, Preseleccionado: 1, Entrevistado: 2, 'En verificación': 3, Habilitado: 4 }

function Progreso({ a }: { a: AspiranteDemo }) {
  const descartado = a.etapa === 'Descartado'
  const actual = descartado ? (a.entrevistas.length ? 2 : 1) : enOperacion(a) ? 5 : INDICE[a.etapa] ?? 0
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <ol aria-label="Progreso de selección" className="relative grid min-w-[30rem] grid-cols-6">
        <span aria-hidden className="absolute left-[8.33%] right-[8.33%] top-3 h-px bg-cf-borde" />
        <span aria-hidden className="absolute left-[8.33%] top-3 h-px bg-verde-vivo" style={{ width: `${(Math.min(actual, 5) / 6) * 100}%` }} />
        {PASOS_FICHA.map((p, i) => {
          const hecho = i < actual || (i === actual && enOperacion(a))
          const esActual = i === actual && !enOperacion(a)
          const estado = descartado && i === actual ? 'descartado' : hecho ? 'hecho' : esActual ? 'actual' : 'pendiente'
          const nodo = { hecho: 'bg-verde-vivo text-blanco', actual: 'bg-cf-morado text-blanco ring-4 ring-cf-lavanda', descartado: 'bg-rojo text-blanco', pendiente: 'border border-cf-borde bg-blanco text-cf-texto-suave' }[estado]
          const texto = { hecho: 'text-cf-texto', actual: 'font-extrabold text-cf-morado', descartado: 'font-extrabold text-rojo-oscuro', pendiente: 'text-cf-texto-suave' }[estado]
          return (
            <li key={p} aria-current={esActual ? 'step' : undefined} className={`relative flex flex-col items-center gap-1 ${descartado && i > actual ? 'opacity-40' : ''}`}>
              <span className={`relative z-10 grid h-6 w-6 place-items-center rounded-full text-[11px] font-extrabold ${nodo}`}>{estado === 'hecho' ? '✓' : estado === 'descartado' ? '✕' : i + 1}</span>
              <span className={`whitespace-nowrap text-xs font-semibold ${texto}`}>{estado === 'descartado' ? 'Descartado' : p}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function estadoTab(a: AspiranteDemo, id: TabFicha): 'hecho' | 'bloqueo' | null {
  const onb = ultima(a.onboardings)
  if (id === 'entrevista') return a.entrevistas.length ? 'hecho' : null
  if (id === 'verificaciones') return vigente(a.verificaciones, 'Identidad') && vigente(a.verificaciones, 'Referencia') ? 'hecho' : null
  if (id === 'onboarding') return onb?.resultado === 'Completado' ? 'hecho' : null
  if (id === 'habilitacion') return a.etapa === 'Habilitado' ? 'hecho' : a.alertas.some((x) => x.abierta && x.bloquea) ? 'bloqueo' : null
  if (id === 'operacion') return enOperacion(a) ? 'hecho' : null
  return null
}

export default function FichaDemo({ a, estado, tab, setTab, hacer, volver, mensaje }: {
  a: AspiranteDemo; estado: EstadoDemo; tab: TabFicha; setTab: (t: TabFicha) => void; hacer: Hacer; volver: () => void; mensaje: React.ReactNode
}) {
  const p = proximaAccion(a, estado.solicitudes)
  const tonoProxima = p.tipo === 'disponible' ? 'border-verde-vivo' : p.tipo === 'cerrado' ? 'border-cf-borde' : 'border-cf-morado'
  return (
    <div className="space-y-4">
      <button type="button" onClick={volver} className="inline-flex min-h-9 items-center gap-1 text-sm font-bold text-cf-morado">‹ Volver a la lista</button>

      <header className="space-y-4 border-b border-cf-borde pb-5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amarillo-claro px-2 py-0.5 text-xs font-bold text-ambar-oscuro">Demo · ficticio</span>
              <span className="text-xs font-bold text-cf-texto-suave">{a.id}</span>
            </div>
            <h2 className="mt-1 text-2xl font-extrabold leading-tight">{a.nombre}</h2>
            <p className="text-sm text-cf-texto-suave">{a.zona} · registrado el {fechaCorta(a.registrado)}</p>
          </div>
          <span className="ml-auto"><EtiquetaEtapa etapa={enOperacion(a) ? 'En operación' : a.etapa} /></span>
        </div>
        <Progreso a={a} />
        <div className={`border-l-[3px] py-0.5 pl-3 ${tonoProxima}`}>
          <p className="text-sm"><span className="font-extrabold">Próxima acción:</span> {p.texto}</p>
          {p.solicitud && <p className="mt-0.5 text-sm"><span className="font-extrabold">Solicitud en curso · {p.solicitud.familia}:</span> {p.solicitud.texto}.</p>}
        </div>
      </header>

      {mensaje}

      <div className="space-y-5">
        <nav aria-label="Partes de la ficha" className="-mx-4 overflow-x-auto border-b border-cf-borde px-4">
          <ul role="tablist" className="flex w-max gap-1">
            {TABS_FICHA.map(([id, texto]) => {
              const s = estadoTab(a, id)
              return (
                <li key={id}>
                  <button type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                    className={`-mb-px flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors ${tab === id ? 'border-cf-morado text-cf-morado' : 'border-transparent text-cf-texto-suave hover:text-cf-texto'}`}>
                    {texto}
                    {s && <span className={`h-1.5 w-1.5 rounded-full ${s === 'hecho' ? 'bg-verde-vivo' : 'bg-rojo'}`} aria-label={s === 'hecho' ? '(completo)' : '(bloqueado)'} />}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
        <div role="tabpanel" className="min-w-0 space-y-4">
          {tab === 'resumen' && <Resumen a={a} hacer={hacer} setTab={setTab} />}
          {tab === 'preentrevista' && <Preentrevista a={a} />}
          {tab === 'entrevista' && <Entrevistas a={a} hacer={hacer} />}
          {tab === 'verificaciones' && <Verificaciones a={a} hacer={hacer} />}
          {tab === 'onboarding' && <OnboardingTab a={a} hacer={hacer} />}
          {tab === 'habilitacion' && <Habilitacion a={a} hacer={hacer} setTab={setTab} />}
          {tab === 'operacion' && <Operacion a={a} estado={estado} hacer={hacer} />}
          {tab === 'historial' && <Historial a={a} estado={estado} />}
        </div>
      </div>
    </div>
  )
}

/** Botón secundario que despliega un formulario plegado. */
function Desplegar({ texto, info, onClick }: { texto: string; info: string; onClick: () => void }) {
  return <Boton tamano="compacto" variante="secundario" className={BOTON_CF.secundario} onClick={onClick} info={info}>{texto}</Boton>
}

// ── Resumen ────────────────────────────────────────────────────────────────────

function Resumen({ a, hacer, setTab }: { a: AspiranteDemo; hacer: Hacer; setTab: (t: TabFicha) => void }) {
  const t = transicionDisponible(a)
  const destino: Partial<Record<string, TabFicha>> = { Preseleccionado: 'entrevista', Entrevistado: 'entrevista', 'En verificación': 'habilitacion', Habilitado: 'operacion' }
  const [cerrando, setCerrando] = useState<string | null>(null)
  const ent = ultima(a.entrevistas)
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TarjetaCf titulo="Qué hacer ahora">
        <div className="flex flex-wrap gap-2">
          {t && <Boton tamano="compacto" variante={t.a === 'Descartado' ? 'peligro' : 'primario'} className={t.a === 'Descartado' ? '' : BOTON_CF.principal} onClick={() => hacer({ tipo: 'cambiarEtapa', id: a.id, a: t.a })} info={`Pasa al aspirante de «${a.etapa}» a «${t.a}» y lo anota en el historial. Mismo cambio que hace el CMC.`}>{t.texto}</Boton>}
          {destino[a.etapa] && <Boton tamano="compacto" variante="secundario" className={BOTON_CF.secundario} navegacion onClick={() => setTab(destino[a.etapa]!)}>Ir a {TABS_FICHA.find(([id]) => id === destino[a.etapa])![1]}</Boton>}
          {!t && !destino[a.etapa] && <p className="text-sm text-cf-texto-suave">No hay acciones pendientes en esta etapa.</p>}
        </div>
        {ent?.alertas && a.etapa !== 'Descartado' && <p className="rounded-xl bg-amarillo-claro px-3 py-2 text-sm text-ambar-oscuro"><strong>Señal de alerta de la entrevista:</strong> {ent.alertas} (revisar antes de habilitar; no bloquea por sí sola).</p>}
      </TarjetaCf>

      <TarjetaCf titulo="Alertas operativas" extra={<InfoBoton que="Qué es una alerta operativa" texto="Son las de la hoja 11 del CMC. Las marcadas «bloquea» impiden habilitar hasta cerrarlas con su resolución. Las señales de alerta de una entrevista son otra cosa: piden revisión, pero no bloquean." />}>
        {a.alertas.length === 0 ? <p className="text-sm text-cf-texto-suave">Sin alertas operativas.</p> : (
          <ul className="space-y-3">
            {a.alertas.map((al) => (
              <li key={al.id} className="text-sm">
                <p className="flex flex-wrap items-center gap-1.5">
                  <Marca estado={al.abierta ? (al.bloquea ? 'bloqueo' : 'aviso') : 'hecho'} />
                  <span className="font-bold">{al.tipo}</span>
                  <span className="text-cf-texto-suave">· {al.severidad} · {al.abierta ? 'Abierta' : 'Cerrada'}</span>
                  {al.bloquea && al.abierta && <span className="rounded-md bg-rojo-claro px-1.5 text-xs font-bold text-rojo-oscuro">Bloquea la habilitación</span>}
                </p>
                <p className="mt-0.5 text-cf-texto-suave">{al.motivo}</p>
                {al.abierta && (cerrando === al.id
                  ? <MotivoEnLinea etiqueta="Cómo se resolvió" boton="Cerrar alerta" info="Cierra la alerta con su resolución y lo anota en el historial. Si bloqueaba, deja de bloquear la habilitación." onListo={(m) => { if (hacer({ tipo: 'cerrarAlerta', id: a.id, alertaId: al.id, resolucion: m })) setCerrando(null) }} onCancelar={() => setCerrando(null)} />
                  : <div className="mt-1"><Desplegar texto="Resolver alerta" info="Abre un campo para escribir cómo se resolvió la alerta antes de cerrarla." onClick={() => setCerrando(al.id)} /></div>)}
              </li>
            ))}
          </ul>
        )}
      </TarjetaCf>

      <TarjetaCf titulo="Disponibilidad y cobertura" className="md:col-span-2">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {[['Días', a.disponibilidad.dias], ['Horario', a.disponibilidad.horario], ['Cubre', a.disponibilidad.cubre], ['Se mueve en', a.disponibilidad.movilidad], ['Servicios', a.servicios.join(', ')], ['Origen', a.origen]].map(([k, v]) => (
            <div key={k}><dt className="text-xs font-bold uppercase tracking-wide text-cf-texto-suave">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </TarjetaCf>
      {a.duplicadoDe && <div className="md:col-span-2"><Aviso tamano="compacto" tono="advertencia">Duplicado de {a.duplicadoDe}: comparte correo o teléfono. No cuenta en las cifras.</Aviso></div>}
      {a.esPrueba && <div className="md:col-span-2"><Aviso tamano="compacto" tono="advertencia">Perfil interno de prueba. No cuenta en las cifras.</Aviso></div>}
    </div>
  )
}

function Preentrevista({ a }: { a: AspiranteDemo }) {
  return (
    <TarjetaCf titulo="Preentrevista automática" extra={<EtiquetaMadurez madurez="comprobado" />}>
      <dl className="divide-y divide-cf-borde text-sm">
        {a.preentrevista.map((p) => <div key={p.pregunta} className="py-2.5 first:pt-0 last:pb-0"><dt className="text-cf-texto-suave">{p.pregunta}</dt><dd className="mt-0.5 font-bold">{p.respuesta}</dd></div>)}
      </dl>
      <p className="text-xs text-cf-texto-suave">En la operación real el CMC la envía sola y la respuesta llega a la hoja 09. Aquí las respuestas son ficticias.</p>
    </TarjetaCf>
  )
}

// ── Entrevista ─────────────────────────────────────────────────────────────────

const TONO_DECISION: Record<Entrevista['decision'], string> = {
  'Avanza a verificación': 'bg-verde-claro text-verde-oscuro',
  'Segunda conversación': 'bg-amarillo-claro text-ambar-oscuro',
  'No avanza': 'bg-rojo-claro text-rojo-oscuro',
}

function ResultadoEntrevista({ e }: { e: Entrevista }) {
  const prom = promedioEntrevista(e)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-cf-texto-suave">Decisión del entrevistador</p>
          <p className={`mt-1 inline-flex rounded-lg px-2.5 py-1 text-base font-extrabold ${TONO_DECISION[e.decision]}`}>{e.decision}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-cf-texto-suave">Promedio<InfoBoton que="Promedio" texto="Promedio de los 6 criterios con puntaje. Es informativo: no aprueba ni descarta a nadie. Manda la decisión explícita del entrevistador." /></p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-cf-texto">{decimal(prom)} <span className="text-sm font-bold text-cf-texto-suave">de 5</span></p>
        </div>
        <p className="text-xs text-cf-texto-suave">{fechaCorta(e.fecha)} · {e.entrevistador}</p>
      </div>
      <p className="text-sm"><span className="font-bold">Razón objetiva:</span> {e.razon}</p>
      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {CRITERIOS_SI_NO.map((c, j) => <li key={c} className="flex items-center gap-2 text-sm"><Marca estado={e.siNo[j] ? 'hecho' : 'bloqueo'} /><span className="flex-1">{c}</span><span className="font-bold">{e.siNo[j] ? 'Sí' : 'No'}</span></li>)}
        {CRITERIOS_PUNTAJE.map((c, j) => (
          <li key={c} className="text-sm">
            <div className="flex justify-between gap-2"><span>{c}</span><span className="font-bold tabular-nums">{e.puntajes[j]}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-cf-lateral"><div className="h-1.5 rounded-full bg-cf-morado" style={{ width: `${e.puntajes[j] * 20}%` }} /></div>
          </li>
        ))}
      </ul>
      {(e.positivas || e.pendientes) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {e.positivas && <p className="rounded-xl bg-cf-lateral px-3 py-2 text-sm"><span className="block text-xs font-bold text-cf-texto-suave">Observación: señales positivas</span>{e.positivas}</p>}
          {e.pendientes && <p className="rounded-xl bg-cf-lateral px-3 py-2 text-sm"><span className="block text-xs font-bold text-cf-texto-suave">Observación: aspectos pendientes</span>{e.pendientes}</p>}
        </div>
      )}
      {e.alertas && <p className="rounded-xl border border-amarillo-marca bg-amarillo-claro px-3 py-2 text-sm text-ambar-oscuro"><span className="block text-xs font-extrabold">Señal de alerta · requiere revisión, no bloquea por sí sola</span>{e.alertas}</p>}
    </div>
  )
}

function Entrevistas({ a, hacer }: { a: AspiranteDemo; hacer: Hacer }) {
  const puede = a.etapa === 'Preseleccionado' || a.etapa === 'Entrevistado'
  const [abierto, setAbierto] = useState(a.entrevistas.length === 0)
  const orden = [...a.entrevistas].sort((x, y) => (x.fecha < y.fecha ? 1 : -1))
  const [ult, ...anteriores] = orden
  return (
    <>
      {ult && <TarjetaCf titulo="Resultado de la entrevista" extra={<EtiquetaMadurez madurez="comprobado" />}><ResultadoEntrevista e={ult} /></TarjetaCf>}
      {anteriores.length > 0 && (
        <details className="group rounded-xl border border-cf-borde bg-blanco p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-extrabold"><span aria-hidden className="transition-transform group-open:rotate-90">›</span>Entrevistas anteriores ({anteriores.length})</summary>
          <div className="mt-3 space-y-4 divide-y divide-cf-borde">{anteriores.map((e, i) => <div key={i} className="pt-4 first:pt-0"><ResultadoEntrevista e={e} /></div>)}</div>
        </details>
      )}
      {puede && (abierto
        ? <TarjetaCf titulo={a.entrevistas.length ? 'Registrar otra entrevista' : 'Registrar la entrevista'} extra={<EtiquetaMadurez madurez="simulado" />}><FormEntrevista onGuardar={(x) => { const ok = hacer({ tipo: 'guardarEntrevista', id: a.id, entrevista: x }); if (ok) setAbierto(false); return ok }} /></TarjetaCf>
        : <Desplegar texto="Registrar otra entrevista" info="Abre el formulario para registrar una nueva entrevista (por ejemplo, una segunda conversación). La anterior queda guardada." onClick={() => setAbierto(true)} />)}
      {!puede && a.entrevistas.length === 0 && <p className="text-sm text-cf-texto-suave">La entrevista se registra cuando el aspirante está preseleccionado. Ahora está en «{a.etapa}».</p>}
    </>
  )
}

// ── Verificaciones ─────────────────────────────────────────────────────────────

function Verificaciones({ a, hacer }: { a: AspiranteDemo; hacer: Hacer }) {
  const [anulando, setAnulando] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(a.verificaciones.length === 0)
  // Índice de la verificación recién guardada (el motor la agrega al final): se resalta en el historial.
  const [indiceRecien, setIndiceRecien] = useState<number | null>(null)
  const recien = indiceRecien === null ? null : a.verificaciones[indiceRecien]?.id ?? null
  const puede = a.etapa === 'Entrevistado' || a.etapa === 'En verificación'
  const req = [['Identidad', vigente(a.verificaciones, 'Identidad')], ['Referencia', vigente(a.verificaciones, 'Referencia')]] as const
  return (
    <>
      <TarjetaCf titulo="Requisitos para habilitar">
        <ul className="grid gap-2 sm:grid-cols-2">
          {req.map(([r, ok]) => (
            <li key={r} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${ok ? 'border-verde-vivo/40 bg-verde-claro' : 'border-cf-borde bg-cf-lateral'}`}>
              <Marca estado={ok ? 'hecho' : 'pendiente'} /><span className="font-bold">{r}</span><span className="ml-auto text-xs font-bold">{ok ? 'Verificada y vigente' : 'Pendiente'}</span>
            </li>
          ))}
        </ul>
      </TarjetaCf>

      <TarjetaCf titulo={`Historial de verificaciones (${a.verificaciones.length})`}>
        {a.verificaciones.length === 0 ? <p className="text-sm text-cf-texto-suave">Aún no hay verificaciones.</p> : (
          <ul className={LISTA_CF}>
            {[...a.verificaciones].reverse().map((v) => (
              <li key={v.id} className={`space-y-1 px-3 py-2.5 text-sm ${v.id === recien ? 'bg-verde-claro' : ''} ${v.estado === 'Anulada' ? 'opacity-60' : ''}`}>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Marca estado={v.estado !== 'Vigente' ? 'pendiente' : v.resultado === 'Verificado' ? 'hecho' : 'aviso'} />
                  <span className="font-bold">{v.atributo}</span><span>{v.resultado}</span>
                  <span className="text-cf-texto-suave">· {v.metodo} · {v.estado}</span>
                  {v.id === recien && <span className="rounded-md bg-blanco px-1.5 text-xs font-bold text-verde-oscuro">Recién registrada</span>}
                  <span className="ml-auto text-xs text-cf-texto-suave">{v.id} · {fechaCorta(v.fecha)}{v.vence ? ` · vence ${fechaCorta(v.vence)}` : ''}</span>
                </p>
                <p className="text-cf-texto-suave">{v.evidencia}</p>
                {v.estado !== 'Anulada' && a.etapa !== 'Habilitado' && (anulando === v.id
                  ? <MotivoEnLinea etiqueta="Por qué se anula" boton="Anular" info="Marca la verificación como Anulada. No se borra: queda en el historial con el motivo." onListo={(m) => { if (hacer({ tipo: 'anularVerificacion', id: a.id, verificacionId: v.id, motivo: m })) setAnulando(null) }} onCancelar={() => setAnulando(null)} />
                  : <Boton tamano="compacto" variante="fantasma" className={BOTON_CF.suave} onClick={() => setAnulando(v.id)} info="Abre un campo para escribir el motivo antes de anular la verificación.">Anular</Boton>)}
              </li>
            ))}
          </ul>
        )}
      </TarjetaCf>

      {puede && (abierto
        ? <TarjetaCf titulo="Registrar una verificación" extra={<EtiquetaMadurez madurez="simulado" />}>
            <FormVerificacion onGuardar={(x) => {
              const ok = hacer({ tipo: 'registrarVerificacion', id: a.id, ...x })
              if (ok) { setAbierto(false); setIndiceRecien(a.verificaciones.length) }
              return ok
            }} />
          </TarjetaCf>
        : <Desplegar texto="Registrar otra verificación" info="Abre el formulario para registrar una verificación más. Las anteriores quedan en el historial." onClick={() => setAbierto(true)} />)}
      {!puede && a.verificaciones.length === 0 && <p className="text-sm text-cf-texto-suave">Las verificaciones se registran después de la entrevista. Ahora está en «{a.etapa}».</p>}
    </>
  )
}
// ── Onboarding ─────────────────────────────────────────────────────────────────

function OnboardingTab({ a, hacer }: { a: AspiranteDemo; hacer: Hacer }) {
  const ult = ultima(a.onboardings)
  const [abierto, setAbierto] = useState(!ult)
  const puede = a.etapa === 'En verificación'
  return (
    <>
      {ult ? (
        <TarjetaCf titulo="Último onboarding" extra={<span className={`rounded-md px-2 py-0.5 text-xs font-extrabold ${ult.resultado === 'Completado' ? 'bg-verde-claro text-verde-oscuro' : 'bg-amarillo-claro text-ambar-oscuro'}`}>{ult.resultado}</span>}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ONBOARDING_CONTROLES.map((c, i) => <li key={c} className="flex items-center gap-2 text-sm"><Marca estado={ult.controles[i] ? 'hecho' : 'pendiente'} />{c}</li>)}
          </ul>
          <p className="text-xs text-cf-texto-suave">{fechaCorta(ult.fecha)} · {ult.realizadoPor}{ult.observaciones ? ` · ${ult.observaciones}` : ''}</p>
        </TarjetaCf>
      ) : (
        <TarjetaCf titulo="Requisitos del onboarding">
          <ul className="grid gap-2 sm:grid-cols-2">{ONBOARDING_CONTROLES.map((c) => <li key={c} className="flex items-center gap-2 text-sm"><Marca estado="pendiente" />{c}</li>)}</ul>
        </TarjetaCf>
      )}
      {puede && (abierto
        ? <TarjetaCf titulo={ult ? 'Registrar otro onboarding' : 'Registrar el onboarding'} extra={<EtiquetaMadurez madurez="simulado" />}><FormOnboarding onGuardar={(x) => { const ok = hacer({ tipo: 'registrarOnboarding', id: a.id, ...x }); if (ok) setAbierto(false); return ok }} /></TarjetaCf>
        : <Desplegar texto="Registrar otro onboarding" info="Abre el formulario para registrar un onboarding nuevo (por ejemplo, un refuerzo). El anterior queda en el historial." onClick={() => setAbierto(true)} />)}
      {!puede && !ult && <p className="text-sm text-cf-texto-suave">El onboarding se registra en «En verificación». Ahora está en «{a.etapa}».</p>}
    </>
  )
}

// ── Habilitación ───────────────────────────────────────────────────────────────

function Habilitacion({ a, hacer, setTab }: { a: AspiranteDemo; hacer: Hacer; setTab: (t: TabFicha) => void }) {
  const r = evaluarHabilitacion(a, true)
  const hecha = a.etapa === 'Habilitado'
  const aprobados = r.controles.filter((c) => c.cumple || hecha)
  const pendientes = hecha ? [] : r.controles.filter((c) => !c.cumple)
  const bloqueo = pendientes.some((c) => c.id === 'alertas')
  const senal = ultima(a.entrevistas)?.alertas
  const [titulo, tono] = hecha ? ['Habilitado', 'border-verde-vivo/50 bg-verde-claro text-verde-oscuro']
    : r.puede ? ['Cumple los 7 controles: lista para habilitar', 'border-verde-vivo/50 bg-verde-claro text-verde-oscuro']
    : bloqueo ? ['Bloqueada por una alerta operativa', 'border-rojo/40 bg-rojo-claro text-rojo-oscuro']
    : [`${pendientes.length === 1 ? 'Falta 1' : `Faltan ${pendientes.length}`} de 7 controles`, 'border-amarillo-marca bg-amarillo-claro text-ambar-oscuro']
  return (
    <>
      <section className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${tono}`}>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide opacity-80">Decisión de habilitación</p>
          <p className="text-lg font-extrabold">{titulo}</p>
          <p className="text-xs opacity-80">{aprobados.length} de 7 controles aprobados · misma regla que aplica el CMC; en la operación real decide el CMC.</p>
        </div>
        {hecha
          ? <Boton tamano="compacto" variante="secundario" className={BOTON_CF.secundario} navegacion onClick={() => setTab('operacion')}>Ir a Operación</Boton>
          : <Boton tamano="compacto" className={BOTON_CF.principal} disabled={!r.puede} onClick={() => hacer({ tipo: 'habilitar', id: a.id })} info={r.puede ? 'Habilita al aspirante: pasa a «Habilitado» y queda en el historial. En la demostración también simula su publicación en la web, sin correo real.' : 'Apagado: falta al menos un control. No existe un atajo para saltárselos.'}>Habilitar</Boton>}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <TarjetaCf titulo={`Pendientes y bloqueos (${pendientes.length})`} extra={<EtiquetaMadurez madurez="comprobado" />}>
          {pendientes.length === 0 ? <p className="text-sm text-cf-texto-suave">Nada pendiente.</p> : (
            <ul className="space-y-2">
              {pendientes.map((c) => (
                <li key={c.id} className="flex gap-2 text-sm"><Marca estado={c.id === 'alertas' ? 'bloqueo' : 'pendiente'} /><span><span className="font-bold">{c.texto}</span><span className="block text-cf-texto-suave">{c.falta}</span></span></li>
              ))}
            </ul>
          )}
          {senal && !hecha && <p className="flex gap-2 text-sm"><Marca estado="aviso" /><span><span className="font-bold">A revisar (no bloquea):</span> señal de alerta en la entrevista: {senal}</span></p>}
        </TarjetaCf>
        <TarjetaCf titulo={`Controles aprobados (${aprobados.length})`}>
          <ul className="space-y-2">{aprobados.map((c) => <li key={c.id} className="flex items-center gap-2 text-sm"><Marca estado="hecho" />{c.texto}</li>)}</ul>
        </TarjetaCf>
      </div>
    </>
  )
}

// ── Operación y solicitudes ────────────────────────────────────────────────────

const PASOS_INCORPORACION = ['Publicación inicial inactiva', 'Perfil y disponibilidad completos', 'Telegram vinculado', 'Activación y verificación administrativa', 'Disponible para recibir solicitudes'] as const

function LineaPasos({ pasos, hechos, etiqueta, pendienteReal }: { pasos: readonly string[]; hechos: number; etiqueta: string; pendienteReal?: number }) {
  return (
    <ol aria-label={etiqueta} className="space-y-0">
      {pasos.map((p, i) => {
        const hecho = i < hechos; const actual = i === hechos && i !== pendienteReal
        return (
          <li key={p} className="relative flex gap-3 pb-3 last:pb-0">
            {i < pasos.length - 1 && <span aria-hidden className={`absolute left-[9px] top-5 h-[calc(100%-1rem)] w-0.5 ${hecho ? 'bg-verde-vivo' : 'bg-cf-borde'}`} />}
            <span className={`relative z-10 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${hecho ? 'bg-verde-vivo text-blanco' : actual ? 'bg-cf-morado text-blanco ring-4 ring-cf-lavanda' : 'bg-cf-lateral text-cf-texto-suave'}`}>{hecho ? '✓' : i + 1}</span>
            <span className={`text-sm ${hecho ? '' : actual ? 'font-extrabold text-cf-morado' : 'text-cf-texto-suave'}`}>
              {p}{i === pendienteReal && <span className="ml-2 align-middle"><EtiquetaMadurez madurez="pendiente" corta /></span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Operacion({ a, estado, hacer }: { a: AspiranteDemo; estado: EstadoDemo; hacer: Hacer }) {
  if (a.etapa !== 'Habilitado') return <TarjetaCf titulo="Incorporación a la plataforma"><p className="text-sm text-cf-texto-suave">Empieza cuando el aspirante está habilitado. Ahora está en «{a.etapa}».</p></TarjetaCf>
  const activo = enOperacion(a)
  const solicitudes = estado.solicitudes.filter((s) => s.compitaId === a.id)
  return (
    <>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_17rem]">
        <TarjetaCf titulo="Incorporación a la plataforma" extra={<EtiquetaMadurez madurez="simulado" />}>
          <LineaPasos etiqueta="Incorporación" pasos={PASOS_INCORPORACION} hechos={activo ? PASOS_INCORPORACION.length : a.operacion} />
          {!activo && <Boton tamano="compacto" className={BOTON_CF.principal} onClick={() => hacer({ tipo: 'avanzarOperacion', id: a.id })} info="Simula el siguiente paso real: la publicación, el perfil que completa el Compita, la vinculación de Telegram o la activación del equipo. No toca la web.">Simular: {enFrase(PASOS_OPERACION[a.operacion])}</Boton>}
          <p className="text-xs text-cf-texto-suave">En la operación real estos pasos ya funcionan (comprobados el 17-nov-2026). Aquí se representan sin tocar la web.</p>
        </TarjetaCf>
        <TarjetaCf titulo="En el catálogo (vista simulada)">
          {activo ? (
            <div className="rounded-xl border border-cf-borde bg-cf-lavanda-suave p-3">
              <p className="text-lg font-extrabold">{a.nombre.split(' ')[0]}</p>
              <p className="text-sm text-cf-texto-suave">{a.zona}</p>
              <p className="mt-2 flex flex-wrap gap-1">{a.servicios.map((s) => <span key={s} className="rounded-md bg-blanco px-1.5 py-px text-xs font-bold">{s}</span>)}</p>
              <p className="mt-2 text-xs font-extrabold text-verde-oscuro">✓ Verificado por Compaz</p>
            </div>
          ) : <p className="text-sm text-cf-texto-suave">Aparece cuando el equipo lo activa y verifica.</p>}
        </TarjetaCf>
      </div>

      {activo && (
        <TarjetaCf titulo={`Solicitudes de familias (${solicitudes.length})`} extra={<EtiquetaMadurez madurez="simulado" />}>
          {solicitudes.length === 0 && <p className="text-sm text-cf-texto-suave">Aún no hay solicitudes.</p>}
          <div className="space-y-4 divide-y divide-cf-borde">{solicitudes.map((s) => <Solicitud key={s.id} s={s} hacer={hacer} />)}</div>
          <Boton tamano="compacto" variante="secundario" className={BOTON_CF.secundario} onClick={() => hacer({ tipo: 'crearSolicitud', id: a.id })} info="Crea una solicitud de una familia ficticia para este Compita, solo en esta demostración.">Simular una solicitud nueva</Boton>
        </TarjetaCf>
      )}
    </>
  )
}

/** Una solicitud: su progreso, la vista (no interactiva) del mensaje de Telegram y UN solo control para avanzar la demostración. */
function Solicitud({ s, hacer }: { s: SolicitudDemo; hacer: Hacer }) {
  const familia = s.familia.replace(' (ficticia)', '')
  const ultimoSimulable = PASOS_SOLICITUD.length - 2 // el pago no se simula
  return (
    <div className="grid gap-4 pt-4 first:pt-0 md:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="space-y-3">
        <p className="text-sm"><span className="font-extrabold">{s.familia}</span> · {s.servicio} · {fechaCorta(s.creada)}</p>
        <LineaPasos etiqueta="Ciclo de la solicitud" pasos={[...PASOS_SOLICITUD.slice(0, -1), 'Pago del cliente: pendiente de validación real']} hechos={s.paso + 1} pendienteReal={PASOS_SOLICITUD.length - 1} />
        {s.paso < ultimoSimulable
          ? <Boton tamano="compacto" className={BOTON_CF.principal} onClick={() => hacer({ tipo: 'avanzarSolicitud', solicitudId: s.id })} info="Control de la demostración: simula el siguiente paso de la solicitud y lo anota en el historial. No envía nada a nadie.">Simular: {enFrase(PASOS_SOLICITUD[s.paso + 1])}</Boton>
          : <p className="text-xs text-cf-texto-suave">El pago no se simula: es lo que falta validar en la operación real.</p>}
      </div>
      {s.paso >= 1 && (
        <figure aria-label="Vista del mensaje de Telegram" className="h-fit rounded-xl border border-cf-borde bg-cf-lavanda-suave p-3 text-sm">
          <figcaption className="text-[11px] font-bold text-cf-texto-suave">Mensaje que recibe el Compita · vista, no se envía</figcaption>
          <p className="mt-2 rounded-xl rounded-tl-sm bg-blanco px-3 py-2">Nueva solicitud: {familia} quiere conocerte para {s.servicio.toLowerCase()}. ¿Aceptas?</p>
          {s.paso === 1
            ? <p aria-hidden className="mt-2 flex gap-2 text-xs font-bold text-cf-texto-suave"><span className="rounded-lg border border-cf-borde bg-blanco px-2 py-1">Aceptar</span><span className="rounded-lg border border-cf-borde bg-blanco px-2 py-1">No puedo</span><span className="self-center font-semibold">(esperando respuesta)</span></p>
            : <p className="mt-2 rounded-lg bg-verde-claro px-2 py-1 text-xs font-extrabold text-verde-oscuro">✓ Solicitud aceptada por el Compita</p>}
        </figure>
      )}
    </div>
  )
}

// ── Historial ──────────────────────────────────────────────────────────────────

function Historial({ a, estado }: { a: AspiranteDemo; estado: EstadoDemo }) {
  const eventos = estado.eventos.filter((e) => e.compitaId === a.id).sort((x, y) => (x.fecha < y.fecha ? 1 : x.fecha > y.fecha ? -1 : y.id.localeCompare(x.id)))
  return (
    <TarjetaCf titulo={`Historial de cambios (${eventos.length})`} extra={<InfoBoton que="Historial" texto="Cada cambio queda con quién, cuándo, antes y después, como en la hoja 17 del CMC." />}>
      <ol className="space-y-0">
        {eventos.map((e, i) => (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < eventos.length - 1 && <span aria-hidden className="absolute left-[5px] top-3 h-full w-0.5 bg-cf-borde" />}
            <span aria-hidden className="relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-cf-morado bg-blanco" />
            <div className="min-w-0 text-sm">
              <p className="flex flex-wrap gap-x-2"><span className="font-bold">{e.tipo}</span><span>{e.campo}{e.antes || e.despues ? `: ${e.antes ? `${e.antes} → ` : ''}${e.despues}` : ''}</span></p>
              {e.motivo && <p className="text-cf-texto-suave">{e.motivo}</p>}
              <p className="text-xs text-cf-texto-suave">{new Date(e.fecha).toLocaleString('es-VE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {e.por} · {e.id}</p>
            </div>
          </li>
        ))}
      </ol>
    </TarjetaCf>
  )
}
