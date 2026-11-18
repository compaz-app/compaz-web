'use client'

// Formularios de la demostración del Sistema de Confianza. Los campos y las listas son los del CMC (hojas 08, 12 y 16).
// Si falta algo, el formulario dice QUÉ falta junto al campo, lo marca y conserva lo escrito. La validación que manda sigue
// siendo la del motor (lib/confianza/demo.ts), igual que en el CMC.

import { useId, useState } from 'react'
import Boton from '@/components/ui/base/Boton'
import { BOTON_CF } from '@/components/panel/confianza/piezas'
import { PREFIJO_EVIDENCIA, sinPrefijoDemo } from '@/lib/confianza/demo'
import {
  CRITERIOS_PUNTAJE, CRITERIOS_SI_NO, DECISIONES_ENTREVISTA, ONBOARDING_CONTROLES, ONBOARDING_RESULTADOS, VERIF_ATRIBUTOS, VERIF_METODOS, VERIF_RESULTADOS,
  type DecisionEntrevista, type Entrevista, type OnboardingResultado, type VerifAtributo, type VerifMetodo, type VerifResultado,
} from '@/lib/confianza/reglas'

const CAMPO = 'min-h-10 w-full rounded-xl border bg-blanco px-3 text-sm text-cf-texto focus-visible:outline-2 focus-visible:outline-cf-morado'
const borde = (mal: boolean) => (mal ? 'border-rojo ring-2 ring-rojo-claro' : 'border-cf-borde')
const ETIQUETA = 'block text-sm font-bold text-cf-texto'

function Campo({ etiqueta, error, children }: { etiqueta: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className={ETIQUETA}>{etiqueta}</span>
      {children}
      {error && <span className="block text-xs font-bold text-rojo-oscuro">{error}</span>}
    </label>
  )
}
function Lista<T extends string>({ valor, opciones, onChange, nombre }: { valor: T; opciones: readonly T[]; onChange: (v: T) => void; nombre: string }) {
  return <select aria-label={nombre} value={valor} onChange={(e) => onChange(e.target.value as T)} className={`${CAMPO} ${borde(false)}`}>{opciones.map((o) => <option key={o} value={o}>{o}</option>)}</select>
}
/** Resumen de lo que falta, junto al botón de guardar. */
function Faltan({ items }: { items: string[] }) {
  if (!items.length) return null
  return <p role="alert" className="rounded-xl bg-rojo-claro px-3 py-2 text-sm font-semibold text-rojo-oscuro">Para guardar falta: {items.join('; ')}.</p>
}

/** Puntaje de 1 a 5 como botones (más rápido que un desplegable, en el teléfono también). */
function Puntaje({ etiqueta, valor, mal, onChange }: { etiqueta: string; valor: number; mal: boolean; onChange: (n: number) => void }) {
  const id = useId()
  return (
    <div role="radiogroup" aria-labelledby={id} aria-invalid={mal || undefined} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-1 ${mal ? 'bg-rojo-claro' : ''}`}>
      <span id={id} className="text-sm">{etiqueta}{mal && <span className="ml-1 text-xs font-bold text-rojo-oscuro">(sin puntuar)</span>}</span>
      <span className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} de 5`} onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-lg border text-sm font-bold ${valor === n ? 'border-cf-morado bg-cf-morado text-blanco' : 'border-cf-borde bg-blanco text-cf-texto hover:bg-cf-lavanda-suave'}`}>{n}</button>
        ))}
      </span>
    </div>
  )
}

export function FormEntrevista({ onGuardar }: { onGuardar: (x: Omit<Entrevista, 'fecha' | 'entrevistador'>) => boolean }) {
  const [siNo, setSiNo] = useState<boolean[]>(CRITERIOS_SI_NO.map(() => true))
  const [puntajes, setPuntajes] = useState<number[]>(CRITERIOS_PUNTAJE.map(() => 0))
  const [positivas, setPositivas] = useState(''); const [pendientes, setPendientes] = useState(''); const [alertas, setAlertas] = useState('')
  const [decision, setDecision] = useState<DecisionEntrevista>('Avanza a verificación')
  const [razon, setRazon] = useState('')
  const [intentado, setIntentado] = useState(false)

  const sinPuntuar = CRITERIOS_PUNTAJE.filter((_, i) => puntajes[i] === 0)
  const razonCorta = razon.trim().length < 10
  const noConfirmado = decision === 'Avanza a verificación' && siNo.some((s) => !s)
  const faltan = [
    ...(sinPuntuar.length ? [`puntuar ${sinPuntuar.length === 1 ? sinPuntuar[0] : `${sinPuntuar.length} criterios`}`] : []),
    ...(razonCorta ? ['la razón objetiva de la decisión (al menos 10 caracteres)'] : []),
    ...(noConfirmado ? ['confirmar identidad, ubicación y disponibilidad para que avance'] : []),
  ]
  const enviar = (e: React.FormEvent) => {
    e.preventDefault(); setIntentado(true)
    if (faltan.length) return
    onGuardar({ siNo, puntajes, positivas: positivas.trim(), pendientes: pendientes.trim(), alertas: alertas.trim(), decision, razon })
  }
  return (
    <form className="space-y-4" onSubmit={enviar} noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        {CRITERIOS_SI_NO.map((c, i) => (
          <Campo key={c} etiqueta={c} error={intentado && noConfirmado && !siNo[i] ? 'Debe ser Sí para que avance a verificación.' : null}>
            <Lista nombre={c} valor={siNo[i] ? 'Sí' : 'No'} opciones={['Sí', 'No'] as const} onChange={(v) => setSiNo((ant) => ant.map((x, j) => (j === i ? v === 'Sí' : x)))} />
          </Campo>
        ))}
      </div>
      <fieldset className="space-y-1">
        <legend className={`${ETIQUETA} mb-1`}>Criterios <span className="font-semibold text-cf-texto-suave">(1 = muy débil, 5 = excelente)</span></legend>
        {CRITERIOS_PUNTAJE.map((c, i) => <Puntaje key={c} etiqueta={c} valor={puntajes[i]} mal={intentado && puntajes[i] === 0} onChange={(n) => setPuntajes((ant) => ant.map((x, j) => (j === i ? n : x)))} />)}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Observaciones: señales positivas"><textarea rows={2} maxLength={300} value={positivas} onChange={(e) => setPositivas(e.target.value)} className={`${CAMPO} ${borde(false)} py-2`} /></Campo>
        <Campo etiqueta="Observaciones: aspectos pendientes"><textarea rows={2} maxLength={300} value={pendientes} onChange={(e) => setPendientes(e.target.value)} className={`${CAMPO} ${borde(false)} py-2`} /></Campo>
        <Campo etiqueta="Señales de alerta (requieren revisión)"><textarea rows={2} maxLength={300} value={alertas} onChange={(e) => setAlertas(e.target.value)} className={`${CAMPO} ${borde(false)} py-2`} /></Campo>
      </div>
      {alertas.trim() && decision === 'Avanza a verificación' && (
        <p className="rounded-xl bg-amarillo-claro px-3 py-2 text-sm text-ambar-oscuro">Registraste señales de alerta. Por sí solas no frenan el paso a verificación (es la regla del CMC): quedarán marcadas en la ficha para revisarlas antes de habilitar.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-[15rem_1fr]">
        <Campo etiqueta="Decisión del entrevistador"><Lista nombre="Decisión" valor={decision} opciones={DECISIONES_ENTREVISTA} onChange={setDecision} /></Campo>
        <Campo etiqueta="Razón objetiva de la decisión" error={intentado && razonCorta ? 'Escribe qué observaste que justifica la decisión (al menos 10 caracteres).' : null}>
          <input value={razon} maxLength={300} aria-invalid={intentado && razonCorta} onChange={(e) => setRazon(e.target.value)} className={`${CAMPO} ${borde(intentado && razonCorta)}`} placeholder="Qué observaste que justifica la decisión" />
        </Campo>
      </div>
      {intentado && <Faltan items={faltan} />}
      <Boton tamano="compacto" type="submit" className={BOTON_CF.principal} info="Guarda la entrevista, pasa al aspirante a «Entrevistado» y lo anota en el historial. El promedio no decide: manda la decisión del entrevistador.">Guardar entrevista</Boton>
    </form>
  )
}

export function FormVerificacion({ onGuardar }: { onGuardar: (x: { atributo: VerifAtributo; metodo: VerifMetodo; resultado: VerifResultado; evidencia: string; vence: string | null }) => boolean }) {
  const [atributo, setAtributo] = useState<VerifAtributo>('Identidad')
  const [metodo, setMetodo] = useState<VerifMetodo>('Videollamada')
  const [resultado, setResultado] = useState<VerifResultado>('Verificado')
  const [evidencia, setEvidencia] = useState('')
  const [vence, setVence] = useState('')
  const [intentado, setIntentado] = useState(false)
  const corta = sinPrefijoDemo(evidencia).length < 5
  const enviar = (e: React.FormEvent) => {
    e.preventDefault(); setIntentado(true)
    if (corta) return
    if (onGuardar({ atributo, metodo, resultado, evidencia, vence: vence || null })) { setEvidencia(''); setVence(''); setIntentado(false) }
  }
  return (
    <form className="space-y-3" onSubmit={enviar} noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Atributo"><Lista nombre="Atributo" valor={atributo} opciones={VERIF_ATRIBUTOS} onChange={setAtributo} /></Campo>
        <Campo etiqueta="Método"><Lista nombre="Método" valor={metodo} opciones={VERIF_METODOS} onChange={setMetodo} /></Campo>
        <Campo etiqueta="Resultado"><Lista nombre="Resultado" valor={resultado} opciones={VERIF_RESULTADOS} onChange={setResultado} /></Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <Campo etiqueta="Evidencia o referencia (obligatoria)" error={intentado && corta ? 'Describe qué se revisó (al menos 5 caracteres). Por ejemplo: «cédula vista por videollamada».' : null}>
          <span className={`flex items-center overflow-hidden rounded-xl border bg-blanco ${borde(intentado && corta)}`}>
            <span className="shrink-0 border-r border-cf-borde bg-cf-lateral px-2 py-2.5 text-xs font-bold text-cf-texto-suave" title="Se agrega solo: toda evidencia de la demostración queda marcada como ficticia">{PREFIJO_EVIDENCIA}</span>
            <input value={evidencia} maxLength={480} aria-invalid={intentado && corta} onChange={(e) => setEvidencia(e.target.value)} placeholder="Qué se revisó y con quién" className="min-h-10 min-w-0 flex-1 px-3 text-sm text-cf-texto outline-none" />
          </span>
        </Campo>
        <Campo etiqueta="Vence (opcional)"><input type="date" value={vence} onChange={(e) => setVence(e.target.value)} className={`${CAMPO} ${borde(false)}`} /></Campo>
      </div>
      <Boton tamano="compacto" type="submit" className={BOTON_CF.principal} info="Registra la verificación como Vigente, con quién la hizo y cuándo, y la anota en el historial. La evidencia queda marcada como de demostración.">Registrar verificación</Boton>
    </form>
  )
}

export function FormOnboarding({ onGuardar }: { onGuardar: (x: { controles: boolean[]; resultado: OnboardingResultado; observaciones: string }) => boolean }) {
  const [controles, setControles] = useState<boolean[]>(ONBOARDING_CONTROLES.map(() => false))
  const [resultado, setResultado] = useState<OnboardingResultado>('Completado')
  const [obs, setObs] = useState('')
  const [intentado, setIntentado] = useState(false)
  const faltan = resultado === 'Completado' ? ONBOARDING_CONTROLES.filter((_, i) => !controles[i]) : []
  const enviar = (e: React.FormEvent) => {
    e.preventDefault(); setIntentado(true)
    if (faltan.length) return
    onGuardar({ controles, resultado, observaciones: obs })
  }
  return (
    <form className="space-y-3" onSubmit={enviar} noValidate>
      <fieldset className="space-y-1">
        <legend className={`${ETIQUETA} mb-1`}>Controles operativos comprendidos</legend>
        {ONBOARDING_CONTROLES.map((c, i) => (
          <label key={c} className={`flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm ${intentado && faltan.includes(c) ? 'bg-rojo-claro' : ''}`}>
            <input type="checkbox" checked={controles[i]} onChange={(e) => { const marcado = e.target.checked; setControles((ant) => ant.map((x, j) => (j === i ? marcado : x))) }} className="h-5 w-5 accent-cf-morado" />{c}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-[15rem_1fr]">
        <Campo etiqueta="Resultado"><Lista nombre="Resultado" valor={resultado} opciones={ONBOARDING_RESULTADOS} onChange={setResultado} /></Campo>
        <Campo etiqueta="Observaciones"><input value={obs} maxLength={500} onChange={(e) => setObs(e.target.value)} className={`${CAMPO} ${borde(false)}`} /></Campo>
      </div>
      {intentado && <Faltan items={faltan.length ? [`marcar ${faltan.join(', ').toLowerCase()} (o elegir otro resultado)`] : []} />}
      <Boton tamano="compacto" type="submit" className={BOTON_CF.principal} info="Registra el onboarding y lo anota en el historial. Solo puede quedar «Completado» si los cuatro controles están marcados.">Guardar onboarding</Boton>
    </form>
  )
}

/** Un campo corto en línea para escribir un motivo antes de una acción (anular, cerrar una alerta). */
export function MotivoEnLinea({ etiqueta, boton, info, onListo, onCancelar }: { etiqueta: string; boton: string; info: string; onListo: (m: string) => void; onCancelar: () => void }) {
  const [m, setM] = useState('')
  const [intentado, setIntentado] = useState(false)
  const corto = m.trim().length < 5
  return (
    <form className="mt-2 flex flex-wrap items-start gap-2" noValidate onSubmit={(e) => { e.preventDefault(); setIntentado(true); if (!corto) onListo(m) }}>
      <label className="min-w-0 flex-1 basis-56 space-y-1">
        <span className="block text-xs font-bold">{etiqueta}</span>
        <input autoFocus value={m} maxLength={300} aria-invalid={intentado && corto} onChange={(e) => setM(e.target.value)} className={`${CAMPO} ${borde(intentado && corto)}`} />
        {intentado && corto && <span className="block text-xs font-bold text-rojo-oscuro">Escribe al menos 5 caracteres.</span>}
      </label>
      <div className="flex gap-1 pt-5">
        <Boton tamano="compacto" type="submit" variante="peligro" info={info}>{boton}</Boton>
        <Boton tamano="compacto" variante="fantasma" className={BOTON_CF.suave} navegacion onClick={onCancelar}>Cancelar</Boton>
      </div>
    </form>
  )
}
