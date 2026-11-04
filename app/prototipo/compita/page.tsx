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
  { hora: '11:20', texto: '🤝 Contratación directa\nAna quiere contratarte directamente, sin entrevista.\nQué se hará: acompañar a su mamá a misa y a caminar.\nCuándo: jueves en la mañana.\n¿Lugar privado? Sí, la casa de su mamá en Chacao.\nFamiliar: 82 años, camina con bastón.\n📷 Foto de Ana', botones: [{ id: 'a', texto: '✅ Aceptar', resultado: 'Aceptaste ✓ Ana paga primero; te avisamos cuando esté confirmado.' }, { id: 'r', texto: 'No puedo', resultado: 'Anotado. ¿Nos cuentas por qué? (un toque)' }] },
  { hora: '3:10', texto: '📅 Ana eligió tu horario\nJueves 5 nov, 10:00 am (hora de Caracas). Ya pagó y su ficha está completa: ahora ves su nombre completo, Ana Rojas, y la ficha de su mamá.', botones: [{ id: 'ok', texto: '✅ Confirmo la cita', resultado: 'Cita confirmada ✓ Te mandamos la dirección 3 horas antes.' }, { id: 'no', texto: 'No puedo ese día', resultado: 'Le avisamos a Ana y le ofrecemos otros horarios. Queda anotado.' }] },
  { hora: '7:00', texto: '📍 Tu visita es en 3 horas\nDirección: Av. Francisco de Miranda, Edif. Sol, piso 3, apto 3B (Chacao).\nCómo entrar: avisa en conserjería.\nQuién abre: Rosa, la vecina.\nPor seguridad, el teléfono lo tiene el equipo de Compaz, no tú.', botones: [{ id: 'v', texto: '🚗 Voy en camino', resultado: 'Avisamos a Ana que vas en camino.' }] },
  { hora: '9:58', texto: '📸 Llegaste\nToca el botón y manda una foto de la puerta o la fachada. La foto es obligatoria, sirve de prueba de llegada y se borra a los 90 días.', botones: [{ id: 'l', texto: '📍 Llegué (mandar foto)', resultado: 'Foto recibida a las 9:58 ✓ Se la mostramos a Ana si nadie abre.' }] },
  { hora: '10:00', texto: '🔔 ¿Te abrieron?\nSi abren, toca Iniciar visita. Si no hay nadie, avísanos y empezamos a contar 30 minutos.', botones: [{ id: 'i', texto: '▶️ Iniciar visita', resultado: 'Esperando que Ana confirme (o se confirma sola en 5 minutos).' }, { id: 'n', texto: '🚪 Llegué y no hay nadie', resultado: 'Empezó la espera: 30 minutos. Le avisamos a Ana con tu foto y le escribimos al contacto en el sitio a los 5 y 15 minutos. Tú no tienes que hacer nada más que esperar aquí.' }] },
  { hora: '10:30', texto: '🚪 Pasaron 30 minutos\nNadie apareció. Puedes cerrar la visita. Cuenta como usada por la familia y tú cobras el viaje. Si Ana tuvo una causa justificada, el equipo puede reprogramarla.', botones: [{ id: 'c', texto: 'Cerrar visita sin acceso', resultado: 'Cerrada ✓ Quedó registrada como "sin acceso".' }] },
  { hora: '11:15', texto: '⏱️ ¿Todo bien?\nTu visita debía terminar a las 11:00. Si no respondes en 10 minutos, avisamos al equipo.', botones: [{ id: 'b', texto: '👍 Todo bien, termino pronto', resultado: 'Gracias. Cuando termines, toca Terminar visita.' }, { id: 'h', texto: '🆘 Necesito ayuda', resultado: 'Avisamos al equipo ahora mismo. Te llaman en un momento.' }] },
  { hora: '6:00', texto: '🎥 Ana pide una videollamada con su mamá\nHoy a las 6:00 pm. Dura hasta 20 minutos. No se graba.', botones: [{ id: 'a', texto: '✅ Acepto', resultado: 'Aceptada ✓ Te mandamos el botón 5 minutos antes.' }, { id: 'o', texto: '🕒 Propongo otra hora', resultado: 'Le preguntamos a Ana si le sirve otra hora.' }] },
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

  // Botones fijos del teclado: respuesta inmediata del bot, y opcionalmente motivos de un toque.
  const decir = (propio: string, respuesta: string, motivos = false) =>
    setMsgs((arr) => [...arr, { id: 200 + arr.length, hora: hora(), texto: propio, resuelto: undefined }, {
      id: 300 + arr.length, hora: hora(), texto: respuesta,
      botones: motivos ? [
        { id: 'm1', texto: 'Me pidió algo fuera del servicio', resultado: 'Anotado ✓ El equipo lo revisa.' },
        { id: 'm2', texto: 'Me sentí incómodo con alguien', resultado: 'Anotado ✓ El equipo lo revisa.' },
        { id: 'm3', texto: 'El lugar no era seguro', resultado: 'Anotado ✓ El equipo lo revisa.' },
        { id: 'm4', texto: '🚫 No quiero volver con este cliente', resultado: 'Listo ✓ No se te volverá a asignar este cliente.' },
      ] : undefined,
    }])

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

        <div className="grid grid-cols-2 gap-2 border-t border-gray-300 bg-white p-2">
          <button onClick={queToca} className="col-span-2 rounded-xl bg-[var(--warm-gray)] py-3 text-[15px] font-bold text-[var(--purple)]">¿Qué me toca?</button>
          <button onClick={() => decir('🚨 Emergencia', 'Avisamos al equipo ahora mismo. Si es una emergencia médica, llama también al 911 o a emergencias de tu zona. Este botón está siempre disponible, aunque no tengas visita.')} className="rounded-xl bg-[#FEE2E2] py-3 text-[15px] font-bold text-[#991B1B]">🚨 Emergencia</button>
          <button onClick={() => decir('🛑 No me siento seguro', 'Tu visita se detuvo. No pasa nada y no hay penalización. Puedes irte ya. Al cliente le avisamos de forma neutra que la visita se interrumpió, y el equipo te llama. Si quieres, cuéntanos qué pasó:', true)} className="rounded-xl bg-[#FEF3C7] py-3 text-[15px] font-bold text-[#92400E]">🛑 No me siento seguro</button>
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
