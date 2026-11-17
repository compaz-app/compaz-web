'use client'

// Ficha de un aspirante en la demostración del Sistema de Confianza. Cada pestaña muestra una cosa y no repite lo de las otras:
// el Resumen dice dónde está y qué sigue; el resto, el detalle de cada paso del CMC.

import { useState } from 'react'
import Aviso from '@/components/ui/base/Aviso'
import Boton from '@/components/ui/base/Boton'
import { CLASE_LISTA, ChipBoton, TituloSeccion } from '@/components/panel/ui'
import { EtiquetaEtapa, EtiquetaMadurez } from '@/components/panel/confianza/piezas'
import { FormEntrevista, FormOnboarding, FormVerificacion, MotivoEnLinea } from '@/components/panel/confianza/FormulariosDemo'
import { PASOS_OPERACION, PASOS_SOLICITUD, enFrase, type AccionDemo, type AspiranteDemo, type EstadoDemo } from '@/lib/confianza/demo'
import {
  CRITERIOS_PUNTAJE, CRITERIOS_SI_NO, ETAPAS, ONBOARDING_CONTROLES, evaluarHabilitacion, promedioEntrevista, siguienteAccion, transicionDisponible,
} from '@/lib/confianza/reglas'

export const TABS_FICHA = [
  ['resumen', 'Resumen'], ['preentrevista', 'Preentrevista'], ['entrevista', 'Entrevista'], ['verificaciones', 'Verificaciones'],
  ['onboarding', 'Onboarding'], ['habilitacion', 'Habilitación'], ['operacion', 'Operación'], ['historial', 'Historial'],
] as const
export type TabFicha = (typeof TABS_FICHA)[number][0]

type Hacer = (a: AccionDemo) => boolean
const fechaCorta = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })

export default function FichaDemo({ a, estado, tab, setTab, hacer, volver, mensaje }: {
  a: AspiranteDemo; estado: EstadoDemo; tab: TabFicha; setTab: (t: TabFicha) => void; hacer: Hacer; volver: () => void; mensaje: React.ReactNode
}) {
  const indice = ETAPAS.indexOf(a.etapa as (typeof ETAPAS)[number])
  return (
    <div className="space-y-3">
      <button type="button" onClick={volver} className="inline-flex min-h-9 items-center text-sm font-bold text-morado-medio">‹ Volver a la lista</button>
      <header className="space-y-2 rounded-xl border border-borde bg-blanco p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-extrabold leading-tight">{a.nombre}</h2>
          <span className="text-xs text-texto-sutil">{a.id} · ficticio</span>
          <EtiquetaEtapa etapa={a.etapa} />
        </div>
        <ol className="flex flex-wrap gap-1 text-xs" aria-label="Etapas de selección">
          {ETAPAS.map((e, i) => (
            <li key={e} aria-current={i === indice ? 'step' : undefined} className={`rounded px-1.5 py-0.5 font-bold ${i < indice || a.etapa === 'Habilitado' ? 'bg-verde-claro text-verde-oscuro' : i === indice ? 'bg-morado-medio text-blanco' : 'bg-gris100 text-texto-sutil'}`}>
              {i < indice || a.etapa === 'Habilitado' ? '✓ ' : ''}{e}
            </li>
          ))}
        </ol>
        <p className="text-sm"><span className="font-bold">Siguiente:</span> {siguienteAccion(a)}</p>
      </header>

      <div className="-mx-4 overflow-x-auto px-4" role="tablist" aria-label="Partes de la ficha">
        <div className="flex w-max gap-1.5">
          {TABS_FICHA.map(([id, texto]) => <ChipBoton key={id} activo={tab === id} onClick={() => setTab(id)}>{texto}</ChipBoton>)}
        </div>
      </div>
      {mensaje}

      {tab === 'resumen' && <Resumen a={a} hacer={hacer} setTab={setTab} />}
      {tab === 'preentrevista' && <Preentrevista a={a} />}
      {tab === 'entrevista' && <Entrevistas a={a} hacer={hacer} />}
      {tab === 'verificaciones' && <Verificaciones a={a} hacer={hacer} />}
      {tab === 'onboarding' && <OnboardingTab a={a} hacer={hacer} />}
      {tab === 'habilitacion' && <Habilitacion a={a} hacer={hacer} setTab={setTab} />}
      {tab === 'operacion' && <Operacion a={a} estado={estado} hacer={hacer} />}
      {tab === 'historial' && <Historial a={a} estado={estado} />}
    </div>
  )
}

function Bloque({ titulo, children, madurez }: { titulo: string; children: React.ReactNode; madurez?: 'comprobado' | 'simulado' | 'pendiente' }) {
  return (
    <section className="space-y-2 rounded-xl border border-borde bg-blanco p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><TituloSeccion>{titulo}</TituloSeccion>{madurez && <EtiquetaMadurez madurez={madurez} />}</div>
      {children}
    </section>
  )
}

/** Dónde está, qué sigue (con su botón), disponibilidad y alertas. */
function Resumen({ a, hacer, setTab }: { a: AspiranteDemo; hacer: Hacer; setTab: (t: TabFicha) => void }) {
  const t = transicionDisponible(a)
  const destino: Partial<Record<string, TabFicha>> = { Preseleccionado: 'entrevista', 'En verificación': 'habilitacion', Habilitado: 'operacion' }
  const [cerrando, setCerrando] = useState<string | null>(null)
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Bloque titulo="Qué sigue">
        <p className="text-sm">{siguienteAccion(a)}</p>
        <div className="flex flex-wrap gap-2">
          {t && <Boton tamano="compacto" variante={t.a === 'Descartado' ? 'peligro' : 'primario'} onClick={() => hacer({ tipo: 'cambiarEtapa', id: a.id, a: t.a })} info={`Pasa al aspirante de «${a.etapa}» a «${t.a}» y lo anota en el historial. Mismo cambio que hace el CMC.`}>{t.texto}</Boton>}
          {destino[a.etapa] && <Boton tamano="compacto" variante="secundario" navegacion onClick={() => setTab(destino[a.etapa]!)}>Ir a {TABS_FICHA.find(([id]) => id === destino[a.etapa])![1]}</Boton>}
          {a.etapa === 'Entrevistado' && !t && <Boton tamano="compacto" variante="secundario" navegacion onClick={() => setTab('entrevista')}>Registrar otra entrevista</Boton>}
        </div>
      </Bloque>
      <Bloque titulo="Disponibilidad y cobertura">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-texto-medio">Días</dt><dd>{a.disponibilidad.dias}</dd>
          <dt className="text-texto-medio">Horario</dt><dd>{a.disponibilidad.horario}</dd>
          <dt className="text-texto-medio">Cubre</dt><dd>{a.disponibilidad.cubre}</dd>
          <dt className="text-texto-medio">Se mueve en</dt><dd>{a.disponibilidad.movilidad}</dd>
          <dt className="text-texto-medio">Servicios</dt><dd>{a.servicios.join(', ')}</dd>
          <dt className="text-texto-medio">Origen</dt><dd>{a.origen} · {fechaCorta(a.registrado)}</dd>
        </dl>
      </Bloque>
      <Bloque titulo={`Alertas (${a.alertas.filter((x) => x.abierta).length} abiertas)`}>
        {a.alertas.length === 0 ? <p className="text-sm text-texto-medio">Sin alertas.</p> : (
          <ul className="space-y-2">
            {a.alertas.map((al) => (
              <li key={al.id} className="text-sm">
                <p><span className="font-bold">{al.tipo}</span> · {al.severidad}{al.bloquea ? ' · bloquea la habilitación' : ''} · {al.abierta ? 'Abierta' : 'Cerrada'}</p>
                <p className="text-texto-medio">{al.motivo}</p>
                {al.abierta && (cerrando === al.id
                  ? <MotivoEnLinea etiqueta="Cómo se resolvió" boton="Cerrar alerta" info="Cierra la alerta con su resolución y lo anota en el historial. Si bloqueaba, deja de bloquear la habilitación." onListo={(m) => { if (hacer({ tipo: 'cerrarAlerta', id: a.id, alertaId: al.id, resolucion: m })) setCerrando(null) }} onCancelar={() => setCerrando(null)} />
                  : <Boton tamano="compacto" variante="secundario" onClick={() => setCerrando(al.id)} info="Abre un campo para escribir cómo se resolvió la alerta antes de cerrarla.">Resolver alerta</Boton>)}
              </li>
            ))}
          </ul>
        )}
      </Bloque>
      {a.duplicadoDe && <Aviso tamano="compacto" tono="advertencia">Duplicado de {a.duplicadoDe}: comparte correo o teléfono. No cuenta en las cifras.</Aviso>}
      {a.esPrueba && <Aviso tamano="compacto" tono="advertencia">Perfil interno de prueba. No cuenta en las cifras.</Aviso>}
    </div>
  )
}

function Preentrevista({ a }: { a: AspiranteDemo }) {
  return (
    <Bloque titulo="Preentrevista (formulario automático)" madurez="comprobado">
      <dl className="space-y-2 text-sm">
        {a.preentrevista.map((p) => <div key={p.pregunta}><dt className="text-texto-medio">{p.pregunta}</dt><dd className="font-bold">{p.respuesta}</dd></div>)}
      </dl>
      <p className="text-xs text-texto-sutil">En la operación real el CMC la envía sola y la respuesta llega a la hoja 09. Aquí las respuestas son ficticias.</p>
    </Bloque>
  )
}

function Entrevistas({ a, hacer }: { a: AspiranteDemo; hacer: Hacer }) {
  const puede = a.etapa === 'Preseleccionado' || a.etapa === 'Entrevistado'
  return (
    <div className="space-y-3">
      {a.entrevistas.map((e, i) => (
        <Bloque key={i} titulo={`Entrevista del ${fechaCorta(e.fecha)} · promedio ${promedioEntrevista(e)} de 5`}>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {CRITERIOS_SI_NO.map((c, j) => <li key={c} className="flex justify-between gap-2"><span>{c}</span><span className="font-bold">{e.siNo[j] ? 'Sí' : 'No'}</span></li>)}
            {CRITERIOS_PUNTAJE.map((c, j) => <li key={c} className="flex justify-between gap-2"><span>{c}</span><span className="font-bold">{e.puntajes[j]}</span></li>)}
          </ul>
          <p className="text-sm"><span className="font-bold">Decisión:</span> {e.decision}. {e.razon}</p>
          {e.alertas && <p className="text-sm text-rojo-oscuro"><span className="font-bold">Señales de alerta:</span> {e.alertas}</p>}
          <p className="text-xs text-texto-sutil">Entrevistó: {e.entrevistador}</p>
        </Bloque>
      ))}
      {puede
        ? <Bloque titulo={a.entrevistas.length ? 'Registrar otra entrevista' : 'Registrar la entrevista'} madurez="simulado"><FormEntrevista onGuardar={(x) => hacer({ tipo: 'guardarEntrevista', id: a.id, entrevista: x })} /></Bloque>
        : a.entrevistas.length === 0 && <p className="text-sm text-texto-medio">La entrevista se registra cuando el aspirante está preseleccionado. Ahora está en «{a.etapa}».</p>}
    </div>
  )
}

function Verificaciones({ a, hacer }: { a: AspiranteDemo; hacer: Hacer }) {
  const [anulando, setAnulando] = useState<string | null>(null)
  const puede = a.etapa === 'Entrevistado' || a.etapa === 'En verificación'
  return (
    <div className="space-y-3">
      <Bloque titulo={`Historial de verificaciones (${a.verificaciones.length})`}>
        {a.verificaciones.length === 0 ? <p className="text-sm text-texto-medio">Aún no hay verificaciones.</p> : (
          <ul className={CLASE_LISTA}>
            {[...a.verificaciones].reverse().map((v) => (
              <li key={v.id} className="space-y-1 px-3 py-2 text-sm">
                <p className="flex flex-wrap items-center gap-x-2"><span className="font-bold">{v.atributo}</span><span>{v.resultado}</span><span className="text-texto-medio">· {v.metodo} · {v.estado}</span><span className="text-xs text-texto-sutil">{v.id} · {fechaCorta(v.fecha)}{v.vence ? ` · vence ${fechaCorta(v.vence)}` : ''}</span></p>
                <p className="text-texto-medio">{v.evidencia}</p>
                {v.estado !== 'Anulada' && a.etapa !== 'Habilitado' && (anulando === v.id
                  ? <MotivoEnLinea etiqueta="Por qué se anula" boton="Anular" info="Marca la verificación como Anulada. No se borra: queda en el historial con el motivo." onListo={(m) => { if (hacer({ tipo: 'anularVerificacion', id: a.id, verificacionId: v.id, motivo: m })) setAnulando(null) }} onCancelar={() => setAnulando(null)} />
                  : <Boton tamano="compacto" variante="fantasma" onClick={() => setAnulando(v.id)} info="Abre un campo para escribir el motivo antes de anular la verificación.">Anular</Boton>)}
              </li>
            ))}
          </ul>
        )}
      </Bloque>
      {puede
        ? <Bloque titulo="Registrar una verificación" madurez="simulado"><FormVerificacion onGuardar={(x) => hacer({ tipo: 'registrarVerificacion', id: a.id, ...x })} /></Bloque>
        : <p className="text-sm text-texto-medio">Las verificaciones se registran después de la entrevista. Ahora está en «{a.etapa}».</p>}
    </div>
  )
}

function OnboardingTab({ a, hacer }: { a: AspiranteDemo; hacer: Hacer }) {
  const ultimo = a.onboardings[a.onboardings.length - 1]
  const faltan = ultimo ? ONBOARDING_CONTROLES.filter((_, i) => !ultimo.controles[i]) : [...ONBOARDING_CONTROLES]
  return (
    <div className="space-y-3">
      <Bloque titulo="Requisitos del onboarding">
        <ul className="space-y-1 text-sm">
          {ONBOARDING_CONTROLES.map((c) => <li key={c} className="flex gap-2"><span aria-hidden className={faltan.includes(c) ? 'text-texto-sutil' : 'text-verde-oscuro'}>{faltan.includes(c) ? '○' : '✓'}</span><span>{c}{faltan.includes(c) ? ' (pendiente)' : ''}</span></li>)}
        </ul>
        {ultimo && <p className="text-sm"><span className="font-bold">Último resultado:</span> {ultimo.resultado} · {fechaCorta(ultimo.fecha)}{ultimo.observaciones ? `. ${ultimo.observaciones}` : ''}</p>}
      </Bloque>
      {a.etapa === 'En verificación'
        ? <Bloque titulo="Registrar onboarding" madurez="simulado"><FormOnboarding onGuardar={(x) => hacer({ tipo: 'registrarOnboarding', id: a.id, ...x })} /></Bloque>
        : <p className="text-sm text-texto-medio">El onboarding se registra en «En verificación». Ahora está en «{a.etapa}».</p>}
    </div>
  )
}

function Habilitacion({ a, hacer, setTab }: { a: AspiranteDemo; hacer: Hacer; setTab: (t: TabFicha) => void }) {
  const r = evaluarHabilitacion(a, true)
  const hecha = a.etapa === 'Habilitado'
  return (
    <Bloque titulo="Los 7 controles del CMC" madurez="comprobado">
      <ul className={CLASE_LISTA}>
        {r.controles.map((c) => (
          <li key={c.id} className="flex items-start gap-2 px-3 py-2 text-sm">
            <span aria-hidden className={`font-extrabold ${c.cumple || hecha ? 'text-verde-oscuro' : 'text-rojo-oscuro'}`}>{c.cumple || hecha ? '✓' : '✕'}</span>
            <span className="min-w-0"><span className="font-bold">{c.texto}</span>{!c.cumple && !hecha && <span className="block text-texto-medio">{c.falta}</span>}</span>
          </li>
        ))}
      </ul>
      {hecha
        ? <div className="flex flex-wrap items-center gap-2"><Aviso tamano="compacto" tono="exito">Habilitado. Sigue en la pestaña Operación.</Aviso><Boton tamano="compacto" variante="secundario" navegacion onClick={() => setTab('operacion')}>Ir a Operación</Boton></div>
        : <Boton tamano="compacto" disabled={!r.puede} onClick={() => hacer({ tipo: 'habilitar', id: a.id })} info={r.puede ? 'Habilita al aspirante: pasa a «Habilitado» y queda en el historial. En la demostración también simula su publicación en la web, sin correo real.' : 'Apagado: falta al menos un control (marcado con ✕). No existe un atajo para saltárselos.'}>Habilitar</Boton>}
      <p className="text-xs text-texto-sutil">Es la misma regla que aplica el CMC al habilitar. En la operación real la decide el CMC, no esta pantalla.</p>
    </Bloque>
  )
}

function Operacion({ a, estado, hacer }: { a: AspiranteDemo; estado: EstadoDemo; hacer: Hacer }) {
  if (a.etapa !== 'Habilitado') return <p className="text-sm text-texto-medio">La operación empieza cuando el aspirante está habilitado. Ahora está en «{a.etapa}».</p>
  const activo = a.operacion >= PASOS_OPERACION.length
  const solicitudes = estado.solicitudes.filter((s) => s.compitaId === a.id)
  return (
    <div className="space-y-3">
      <Bloque titulo="De habilitado a activo en el catálogo" madurez="simulado">
        <ol className="space-y-1 text-sm">
          {PASOS_OPERACION.map((p, i) => <li key={p} className="flex gap-2"><span aria-hidden className={i < a.operacion ? 'text-verde-oscuro' : 'text-texto-sutil'}>{i < a.operacion ? '✓' : '○'}</span><span className={i < a.operacion ? '' : 'text-texto-medio'}>{p}</span></li>)}
        </ol>
        {!activo && <Boton tamano="compacto" onClick={() => hacer({ tipo: 'avanzarOperacion', id: a.id })} info="Simula el siguiente paso real: la publicación, el perfil que completa el Compita, la vinculación de Telegram o la activación del equipo. No toca la web.">Simular: {enFrase(PASOS_OPERACION[a.operacion])}</Boton>}
        <p className="text-xs text-texto-sutil">En la operación real estos pasos ya funcionan (comprobados el 17-nov-2026). Aquí se representan sin tocar la web.</p>
      </Bloque>

      {activo && (
        <Bloque titulo="Así aparece en el catálogo (vista simulada)">
          <div className="max-w-sm rounded-xl border border-borde bg-fondo-claro p-3">
            <p className="font-extrabold">{a.nombre.split(' ')[0]}</p>
            <p className="text-sm text-texto-medio">{a.zona}</p>
            <p className="mt-1 text-sm">{a.servicios.join(' · ')}</p>
            <p className="mt-1 text-xs font-bold text-verde-oscuro">✓ Verificado por Compaz</p>
          </div>
        </Bloque>
      )}

      {activo && (
        <Bloque titulo={`Solicitudes de familias (${solicitudes.length})`} madurez="simulado">
          {solicitudes.map((s) => (
            <div key={s.id} className="space-y-2 border-b border-borde pb-3 last:border-0 last:pb-0">
              <p className="text-sm"><span className="font-bold">{s.familia}</span> · {s.servicio} · {fechaCorta(s.creada)}</p>
              <ol className="space-y-1 text-sm">
                {PASOS_SOLICITUD.map((p, i) => (
                  <li key={p} className="flex flex-wrap items-center gap-2">
                    <span aria-hidden className={i <= s.paso ? 'text-verde-oscuro' : 'text-texto-sutil'}>{i <= s.paso ? '✓' : '○'}</span>
                    <span className={i <= s.paso ? '' : 'text-texto-medio'}>{p}</span>
                    {i === PASOS_SOLICITUD.length - 1 && <EtiquetaMadurez madurez="pendiente" corta />}
                  </li>
                ))}
              </ol>
              {s.paso >= 1 && (
                <figure className="max-w-sm rounded-xl border border-borde bg-fondo-lavanda p-3 text-sm">
                  <figcaption className="text-xs font-bold text-texto-sutil">Aviso por Telegram al Compita (representación, no se envía)</figcaption>
                  <p className="mt-1">Nueva solicitud: {s.familia.replace(' (ficticia)', '')} quiere conocerte para {s.servicio.toLowerCase()}. ¿Aceptas?</p>
                  <p className="mt-2 flex gap-2 text-xs font-bold"><span className="rounded-lg border border-borde bg-blanco px-2 py-1">Aceptar</span><span className="rounded-lg border border-borde bg-blanco px-2 py-1">No puedo</span></p>
                </figure>
              )}
              {s.paso < PASOS_SOLICITUD.length - 2
                ? <Boton tamano="compacto" variante="secundario" onClick={() => hacer({ tipo: 'avanzarSolicitud', solicitudId: s.id })} info="Simula el siguiente paso de la solicitud y lo anota en el historial. No envía nada a nadie.">Simular: {enFrase(PASOS_SOLICITUD[s.paso + 1])}</Boton>
                : <p className="text-xs text-texto-sutil">El pago no se simula: es lo que falta validar en la operación real.</p>}
            </div>
          ))}
          <Boton tamano="compacto" onClick={() => hacer({ tipo: 'crearSolicitud', id: a.id })} info="Crea una solicitud de una familia ficticia para este Compita, solo en esta demostración.">Simular una solicitud nueva</Boton>
        </Bloque>
      )}
    </div>
  )
}

function Historial({ a, estado }: { a: AspiranteDemo; estado: EstadoDemo }) {
  const eventos = estado.eventos.filter((e) => e.compitaId === a.id).sort((x, y) => (x.fecha < y.fecha ? 1 : x.fecha > y.fecha ? -1 : y.id.localeCompare(x.id)))
  return (
    <Bloque titulo={`Historial de cambios (${eventos.length})`}>
      <ul className={CLASE_LISTA}>
        {eventos.map((e) => (
          <li key={e.id} className="px-3 py-2 text-sm">
            <p className="flex flex-wrap gap-x-2"><span className="font-bold">{e.tipo}</span><span>{e.campo}{e.antes || e.despues ? `: ${e.antes ? `${e.antes} → ` : ''}${e.despues}` : ''}</span></p>
            <p className="text-xs text-texto-sutil">{new Date(e.fecha).toLocaleString('es-VE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {e.por} · {e.id}</p>
            {e.motivo && <p className="text-texto-medio">{e.motivo}</p>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-texto-sutil">Cada cambio queda con quién, cuándo, antes y después, como en la hoja 17 del CMC.</p>
    </Bloque>
  )
}
