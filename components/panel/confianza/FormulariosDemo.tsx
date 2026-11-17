'use client'

// Formularios de la demostración del Sistema de Confianza. Los campos y las listas son los del CMC (hojas 08, 12 y 16).
// Validan lo básico en pantalla; la validación que manda es la del motor (lib/confianza/demo.ts), igual que en el CMC.

import { useId, useState } from 'react'
import Boton from '@/components/ui/base/Boton'
import {
  CRITERIOS_PUNTAJE, CRITERIOS_SI_NO, DECISIONES_ENTREVISTA, ONBOARDING_CONTROLES, ONBOARDING_RESULTADOS, VERIF_ATRIBUTOS, VERIF_METODOS, VERIF_RESULTADOS,
  type DecisionEntrevista, type Entrevista, type OnboardingResultado, type VerifAtributo, type VerifMetodo, type VerifResultado,
} from '@/lib/confianza/reglas'

const CAMPO = 'min-h-10 w-full rounded-xl border border-borde bg-blanco px-3 text-sm'
const ETIQUETA = 'block text-sm font-bold text-texto-oscuro'

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className={ETIQUETA}>{etiqueta}</span>{children}</label>
}
function Lista<T extends string>({ valor, opciones, onChange, nombre }: { valor: T; opciones: readonly T[]; onChange: (v: T) => void; nombre: string }) {
  return <select aria-label={nombre} value={valor} onChange={(e) => onChange(e.target.value as T)} className={CAMPO}>{opciones.map((o) => <option key={o} value={o}>{o}</option>)}</select>
}

/** Puntaje de 1 a 5 como botones (más rápido que un desplegable, en el teléfono también). */
function Puntaje({ etiqueta, valor, onChange }: { etiqueta: string; valor: number; onChange: (n: number) => void }) {
  const id = useId()
  return (
    <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap items-center justify-between gap-2">
      <span id={id} className="text-sm">{etiqueta}</span>
      <span className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} de 5`} onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-lg border text-sm font-bold ${valor === n ? 'border-morado-medio bg-morado-medio text-blanco' : 'border-borde bg-blanco text-texto-oscuro'}`}>{n}</button>
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
  const faltan = puntajes.filter((n) => n === 0).length
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onGuardar({ siNo, puntajes, positivas: positivas.trim(), pendientes: pendientes.trim(), alertas: alertas.trim(), decision, razon }) }}>
      <div className="grid gap-2 sm:grid-cols-2">
        {CRITERIOS_SI_NO.map((c, i) => (
          <Campo key={c} etiqueta={c}><Lista nombre={c} valor={siNo[i] ? 'Sí' : 'No'} opciones={['Sí', 'No'] as const} onChange={(v) => setSiNo(siNo.map((x, j) => (j === i ? v === 'Sí' : x)))} /></Campo>
        ))}
      </div>
      <fieldset className="space-y-2">
        <legend className={ETIQUETA}>Criterios (1 = muy débil, 5 = excelente)</legend>
        {CRITERIOS_PUNTAJE.map((c, i) => <Puntaje key={c} etiqueta={c} valor={puntajes[i]} onChange={(n) => setPuntajes(puntajes.map((x, j) => (j === i ? n : x)))} />)}
      </fieldset>
      <div className="grid gap-2 sm:grid-cols-3">
        <Campo etiqueta="Señales positivas"><textarea rows={2} maxLength={300} value={positivas} onChange={(e) => setPositivas(e.target.value)} className={`${CAMPO} py-2`} /></Campo>
        <Campo etiqueta="Aspectos pendientes"><textarea rows={2} maxLength={300} value={pendientes} onChange={(e) => setPendientes(e.target.value)} className={`${CAMPO} py-2`} /></Campo>
        <Campo etiqueta="Señales de alerta"><textarea rows={2} maxLength={300} value={alertas} onChange={(e) => setAlertas(e.target.value)} className={`${CAMPO} py-2`} /></Campo>
      </div>
      <div className="grid gap-2 sm:grid-cols-[14rem_1fr]">
        <Campo etiqueta="Decisión"><Lista nombre="Decisión" valor={decision} opciones={DECISIONES_ENTREVISTA} onChange={setDecision} /></Campo>
        <Campo etiqueta="Razón objetiva de la decisión"><input value={razon} maxLength={300} onChange={(e) => setRazon(e.target.value)} className={CAMPO} placeholder="Qué observaste que justifica la decisión" /></Campo>
      </div>
      <Boton tamano="compacto" type="submit" disabled={faltan > 0} info={faltan > 0 ? `Apagado: faltan ${faltan} criterios por puntuar.` : 'Guarda la entrevista, pasa al aspirante a «Entrevistado» y lo anota en el historial. Si la decisión es «Avanza a verificación», después aparece el botón para pasar a verificación.'}>Guardar entrevista</Boton>
    </form>
  )
}

export function FormVerificacion({ onGuardar }: { onGuardar: (x: { atributo: VerifAtributo; metodo: VerifMetodo; resultado: VerifResultado; evidencia: string; vence: string | null }) => boolean }) {
  const [atributo, setAtributo] = useState<VerifAtributo>('Identidad')
  const [metodo, setMetodo] = useState<VerifMetodo>('Videollamada')
  const [resultado, setResultado] = useState<VerifResultado>('Verificado')
  const [evidencia, setEvidencia] = useState('DEMOSTRACIÓN: ')
  const [vence, setVence] = useState('')
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (onGuardar({ atributo, metodo, resultado, evidencia, vence: vence || null })) { setEvidencia('DEMOSTRACIÓN: '); setVence('') } }}>
      <div className="grid gap-2 sm:grid-cols-3">
        <Campo etiqueta="Atributo"><Lista nombre="Atributo" valor={atributo} opciones={VERIF_ATRIBUTOS} onChange={setAtributo} /></Campo>
        <Campo etiqueta="Método"><Lista nombre="Método" valor={metodo} opciones={VERIF_METODOS} onChange={setMetodo} /></Campo>
        <Campo etiqueta="Resultado"><Lista nombre="Resultado" valor={resultado} opciones={VERIF_RESULTADOS} onChange={setResultado} /></Campo>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
        <Campo etiqueta="Evidencia o referencia (obligatoria)"><input value={evidencia} maxLength={500} onChange={(e) => setEvidencia(e.target.value)} className={CAMPO} /></Campo>
        <Campo etiqueta="Vence (opcional)"><input type="date" value={vence} onChange={(e) => setVence(e.target.value)} className={CAMPO} /></Campo>
      </div>
      <Boton tamano="compacto" type="submit" info="Registra la verificación como Vigente, con quién la hizo y cuándo, y la anota en el historial. En la demostración la evidencia es ficticia y lo dice.">Registrar verificación</Boton>
    </form>
  )
}

export function FormOnboarding({ onGuardar }: { onGuardar: (x: { controles: boolean[]; resultado: OnboardingResultado; observaciones: string }) => boolean }) {
  const [controles, setControles] = useState<boolean[]>(ONBOARDING_CONTROLES.map(() => false))
  const [resultado, setResultado] = useState<OnboardingResultado>('Completado')
  const [obs, setObs] = useState('')
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onGuardar({ controles, resultado, observaciones: obs }) }}>
      <fieldset className="space-y-1">
        <legend className={ETIQUETA}>Controles operativos comprendidos</legend>
        {ONBOARDING_CONTROLES.map((c, i) => (
          <label key={c} className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" checked={controles[i]} onChange={(e) => setControles(controles.map((x, j) => (j === i ? e.target.checked : x)))} className="h-5 w-5" />{c}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-2 sm:grid-cols-[14rem_1fr]">
        <Campo etiqueta="Resultado"><Lista nombre="Resultado" valor={resultado} opciones={ONBOARDING_RESULTADOS} onChange={setResultado} /></Campo>
        <Campo etiqueta="Observaciones"><input value={obs} maxLength={500} onChange={(e) => setObs(e.target.value)} className={CAMPO} /></Campo>
      </div>
      <Boton tamano="compacto" type="submit" info="Registra el onboarding y lo anota en el historial. Solo puede quedar «Completado» si los cuatro controles están marcados.">Guardar onboarding</Boton>
    </form>
  )
}

/** Un campo corto en línea para escribir un motivo antes de una acción (anular, cerrar una alerta). */
export function MotivoEnLinea({ etiqueta, boton, info, onListo, onCancelar }: { etiqueta: string; boton: string; info: string; onListo: (m: string) => void; onCancelar: () => void }) {
  const [m, setM] = useState('')
  return (
    <form className="mt-1 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); onListo(m) }}>
      <label className="min-w-0 flex-1 basis-48 space-y-1"><span className="block text-xs font-bold">{etiqueta}</span><input autoFocus value={m} maxLength={300} onChange={(e) => setM(e.target.value)} className={CAMPO} /></label>
      <Boton tamano="compacto" type="submit" variante="peligro" info={info}>{boton}</Boton>
      <Boton tamano="compacto" variante="fantasma" navegacion onClick={onCancelar}>Cancelar</Boton>
    </form>
  )
}
