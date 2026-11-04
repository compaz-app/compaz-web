'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useParam } from '../useUrlState'

type Boton = { id: string; texto: string; resultado: string }
type Msg = { id: number; texto: string; botones?: Boton[]; resuelto?: string; hora: string }

// Guion de avisos que Compaz le manda al compita, uno por "evento".
const GUION: Omit<Msg, 'id' | 'resuelto'>[] = [
  { hora: '9:02', texto: '🆕 Nueva solicitud\nAna quiere conocerte. Su mamá vive en Chacao.\nTienes hasta las 6:00 pm para responder.', botones: [{ id: 'a', texto: '✅ Aceptar', resultado: 'Aceptaste ✓ Le avisamos a Ana.' }, { id: 'r', texto: 'No puedo', resultado: 'Rechazaste. No pasa nada.' }] },
  { hora: '9:40', texto: '📅 Ana eligió la entrevista\nMañana a las 4:00 pm (hora de Caracas 3:00 pm). Dura 20 minutos.', botones: [{ id: 'ok', texto: 'Confirmo que puedo', resultado: 'Confirmado ✓ Te recordamos 1 hora antes.' }, { id: 'no', texto: 'Necesito otra hora', resultado: 'Le pedimos a Ana otro horario.' }] },
  { hora: '2:00', texto: '⏰ Tu entrevista es en 1 hora\nCuando sea la hora, toca el botón. Si se corta, vuelve a tocarlo.', botones: [{ id: 'e', texto: '🎥 Entrar a la entrevista', resultado: 'Abriendo la sala…' }] },
  { hora: '4:25', texto: '🎉 Ana te contrató\nTu primera visita es el jueves a las 10:00 am en Chacao.' },
  { hora: '10:05', texto: '🏠 Visita de hoy, 10:00 am\nCuando llegues, toca Iniciar visita. Durante la visita manda fotos y notas aquí mismo: la familia las ve en su portal.', botones: [{ id: 'l', texto: '▶️ Iniciar visita', resultado: 'Visita iniciada ✓ Esperando la confirmación del cliente.' }, { id: 'em', texto: '🚨 Emergencia', resultado: '🚨 Alerta enviada. El equipo de Compaz fue notificado y te contactará de inmediato. Si hay peligro inmediato, llama al 911.' }] },
]

const hora = () => '·'

function TelegramMock() {
  // ?hasta=N abre el chat ya avanzado hasta el aviso N (lo usa el recorrido guiado).
  const hasta = Math.min(Math.max(Number(useParam('hasta')) || 0, 0), GUION.length - 1)
  const inicial = (): Msg[] => GUION.slice(0, hasta + 1).map((m, i) => (i < hasta ? { id: i, ...m, botones: undefined, resuelto: m.botones?.[0].resultado } : { id: i, ...m }))
  const [msgs, setMsgs] = useState<Msg[]>(inicial)
  const [siguiente, setSiguiente] = useState(hasta + 1)
  const fin = useRef<HTMLDivElement>(null)

  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs])

  const tocar = (m: Msg, b: Boton) =>
    setMsgs((arr) => arr.map((x) => (x.id === m.id ? { ...x, resuelto: b.resultado, botones: undefined } : x)))

  const avanzar = () => {
    if (siguiente >= GUION.length) return
    setMsgs((arr) => [...arr, { id: siguiente, ...GUION[siguiente] }])
    setSiguiente(siguiente + 1)
  }

  const queToca = () => {
    const pend = msgs.filter((m) => m.botones)
    const texto = pend.length
      ? 'Esto te toca ahora:\n' + pend.map((m, i) => `${i + 1}. ${m.texto.split('\n')[0]}`).join('\n')
      : 'Nada pendiente 🎉 Te avisamos cuando haya algo.'
    setMsgs((arr) => [...arr, { id: 100 + arr.length, hora: hora(), texto }])
  }

  const reiniciar = () => { setMsgs(inicial()); setSiguiente(hasta + 1) }

  return (
    <main className="mx-auto flex max-w-md flex-col px-3 pb-10 pt-4">
      <div className="mb-3 rounded-xl border border-dashed border-[var(--border-muted)] bg-white p-3 text-sm text-[var(--text-mid)]">
        Maqueta del chat de Telegram. Toca los botones dentro de los mensajes: el mensaje se edita, no se llena el chat. Después usa <b>Simular siguiente aviso</b>.
      </div>

      <div className="overflow-hidden rounded-3xl border-4 border-[var(--purple-dark)] bg-[#e6ebee] shadow-xl">
        <div className="flex items-center gap-3 bg-[#517da2] px-4 py-3 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--orange)] font-extrabold">C</div>
          <div><div className="font-bold leading-tight">Compaz</div><div className="text-xs opacity-80">bot oficial</div></div>
        </div>

        <div className="h-[480px] space-y-3 overflow-y-auto p-3">
          {msgs.map((m) => (
            <div key={m.id} className="max-w-[88%]">
              <div className="rounded-2xl rounded-tl-sm bg-white p-3 text-[15px] shadow-sm">
                <p className="whitespace-pre-line">{m.texto}</p>
                {m.resuelto && <p className="mt-2 border-t border-[var(--border-muted)] pt-2 font-bold text-green-700">{m.resuelto}</p>}
                <div className="mt-1 text-right text-[11px] text-gray-400">{m.hora}</div>
              </div>
              {m.botones && (
                <div className="mt-1 grid gap-1">
                  {m.botones.map((b) => (
                    <button key={b.id} onClick={() => tocar(m, b)} className="rounded-xl bg-[#d5e3ef] px-3 py-3 text-[15px] font-semibold text-[#2b5278] active:bg-[#bcd2e4]">
                      {b.texto}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={fin} />
        </div>

        <div className="flex gap-2 border-t border-gray-300 bg-white p-2">
          <button onClick={queToca} className="flex-1 rounded-xl bg-[var(--warm-gray)] py-3 text-[15px] font-bold text-[var(--purple)]">¿Qué me toca?</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={avanzar} disabled={siguiente >= GUION.length} className="min-h-12 rounded-2xl bg-[var(--orange)] px-4 font-extrabold text-white disabled:opacity-40">Simular siguiente aviso</button>
        <button onClick={reiniciar} className="min-h-12 rounded-2xl border border-[var(--border-muted)] bg-white px-4 font-bold text-[var(--text-mid)]">Reiniciar</button>
      </div>
      <p className="mt-4 text-sm text-[var(--text-light)]">Fíjate: en ningún mensaje aparece el teléfono, correo ni Telegram del cliente. Solo su primer nombre y la zona.</p>
    </main>
  )
}

export default function Page() {
  return <Suspense><TelegramMock /></Suspense>
}
