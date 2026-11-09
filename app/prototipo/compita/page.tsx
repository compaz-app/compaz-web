'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useEmbedded, useParam } from '../useUrlState'
import { TEXTO_COMPITA } from '../AvisoSeguridad'

// Igual que TEXTO_NOTA_DE_VOZ de lib/telegram.ts: el bot real responde esto cuando el compita manda un audio.
const TEXTO_NOTA_DE_VOZ = '🎤 Las notas de voz no están activas: el cliente no las recibe. Escribe tu mensaje en texto o manda una foto. Gracias por entender 🙏'

// queToca: lo que responde "¿Qué me toca?" después de tocar este botón (la situación en que queda el compita).
type Boton = { id: string; texto: string; resultado: string; queToca?: string; luego?: Omit<Msg, 'id' | 'hora'> }
type Msg = { id: number; texto: string; botones?: Boton[]; resuelto?: string; hora: string; rama?: string; propio?: boolean }

const CHAT_CLIENTE: Omit<Msg, 'id' | 'hora'> = { texto: '¿Quieres preguntarle algo a Ana directamente? Es por el chat de Compaz, sin teléfonos ni correos.', botones: [{ id: 'c', texto: '💬 Escribirle a Ana', resultado: 'Listo: lo que escribas aquí le llega a Ana. Recuerda que no se pueden compartir teléfonos ni correos.' }] }
// Menú de dudas del compita: el bot responde solo; una persona entra únicamente si no alcanza (tarea en la Bandeja, nunca una llamada).
const DUDAS: Omit<Msg, 'id' | 'hora'> = {
  texto: '❓ ¿Qué pasa?',
  botones: [
    { id: 'd1', texto: '🧭 No encuentro la dirección', resultado: 'Te la repetimos: Av. Francisco de Miranda, Edif. Sol, piso 3, apto 3B (Chacao).', luego: CHAT_CLIENTE },
    { id: 'd2', texto: '🚪 No sé cómo entrar', resultado: 'Cómo entrar: avisa en conserjería. Quién abre: Rosa, la vecina.', luego: CHAT_CLIENTE },
    { id: 'd3', texto: '🕒 Necesito cambiar la hora', resultado: 'Le avisamos a Ana y le ofrecemos otras horas. Queda anotado: cumplir las citas cuenta en tu historial.', queToca: 'Pediste cambiar la hora. Le ofrecemos otras horas a Ana y esperas su elección. Cumplir las citas cuenta en tu historial.' },
    { id: 'd4', texto: '⚠️ Algo no está bien', resultado: 'Si te sientes en riesgo, toca 🛑 No me siento seguro (abajo). Si es otra cosa, usa "Otra duda".' },
    { id: 'd5', texto: '💭 Otra duda', resultado: 'Escríbela en un mensaje. Te respondemos con lo que más se pregunta. Si no alcanza, el equipo la ve y te responde por aquí. No hacemos llamadas.' },
  ],
}

// Cadenas que cierran los ciclos que antes se cortaban: motivo de un toque al rechazar, la foto de llegada que de verdad
// se pide, y terminar la visita con su reporte.
const MOTIVO_RECHAZO: Omit<Msg, 'id' | 'hora'> = {
  texto: 'Gracias por avisar. ¿Nos cuentas por qué? Es opcional y de un toque.',
  botones: [
    { id: 'm1', texto: 'No tengo tiempo', resultado: 'Anotado ✓ Gracias.', queToca: 'Nada pendiente: la solicitud quedó rechazada y el cliente elegirá a otro compita.' },
    { id: 'm2', texto: 'Me queda lejos', resultado: 'Anotado ✓ Gracias.', queToca: 'Nada pendiente: la solicitud quedó rechazada y el cliente elegirá a otro compita.' },
    { id: 'm3', texto: 'No me sirven los horarios', resultado: 'Anotado ✓ Gracias.', queToca: 'Nada pendiente: la solicitud quedó rechazada y el cliente elegirá a otro compita.' },
    { id: 'm4', texto: 'Otro motivo', resultado: 'Anotado ✓ Gracias.', queToca: 'Nada pendiente: la solicitud quedó rechazada y el cliente elegirá a otro compita.' },
  ],
}
const REPORTE_VISITA: Omit<Msg, 'id' | 'hora'> = {
  texto: '📝 Reporte de bienestar\n¿Cómo estuvo la mamá de Ana durante la visita?',
  botones: [
    { id: 'r1', texto: '😊 Muy bien', resultado: 'Reporte enviado a Ana ✓ Gracias por tu trabajo.', queToca: 'Cerraste la visita y mandaste el reporte. Ana lo recibe y te califica. No tienes nada pendiente.' },
    { id: 'r2', texto: '😐 Normal', resultado: 'Reporte enviado a Ana ✓ Gracias por tu trabajo.', queToca: 'Cerraste la visita y mandaste el reporte. Ana lo recibe y te califica. No tienes nada pendiente.' },
    { id: 'r3', texto: '⚠️ Con novedades', resultado: 'Reporte enviado ✓ Avisamos al equipo de las novedades.', queToca: 'Cerraste la visita y avisaste de novedades: el equipo las revisa. No tienes nada más que hacer.' },
  ],
}
const VISITA_EN_CURSO: Omit<Msg, 'id' | 'hora'> = {
  texto: '✅ Ana confirmó tu llegada\nLa visita está activa. Manda fotos y notas por aquí; ella las ve al momento. Cuando termines, toca el botón.',
  botones: [{ id: 't', texto: '🔴 Terminar visita', resultado: 'Visita terminada ✓', queToca: 'La visita terminó. Falta tu reporte de bienestar: respóndelo para cerrarla.', luego: REPORTE_VISITA }],
}
const FOTO_LLEGADA: Omit<Msg, 'id' | 'hora'> = {
  texto: '📷 Manda ahora una foto de la puerta o la fachada. Es obligatoria: sirve de prueba de llegada.',
  botones: [{ id: 'f', texto: '📷 Enviar la foto (simulado)', resultado: 'Foto recibida a las 9:58 ✓ Se la mostramos a Ana si nadie abre.', queToca: 'Ya mandaste la foto de llegada. Ahora: si te abren, toca "Iniciar visita". Si nadie abre, toca "Llegué y no hay nadie".' }],
}

// Guion de avisos que Compaz le manda al compita. Los primeros nueve siguen el camino normal, en orden.
// Los últimos son alternativas (contratación directa, nadie abre, videollamada) y se ven con ?solo=N.
const GUION: Omit<Msg, 'id' | 'resuelto'>[] = [
  { hora: '9:02', texto: '🆕 Nueva solicitud\nAna quiere conocerte: una videollamada de 20 minutos.\nQué se hará: acompañar a su mamá a misa y a caminar.\n¿Lugar privado? Sí, en Chacao.\nAdemás de su mamá estarán: 1 familiar y 1 vecina.\n📷 Foto de Ana\nTienes hasta las 6:00 pm para responder.', botones: [{ id: 'a', texto: '✅ Aceptar', resultado: 'Aceptaste ✓ Le avisamos a Ana.', queToca: 'Aceptaste la solicitud de Ana. Ahora ella elige una de tus horas libres para la entrevista y te avisamos. No tienes que hacer nada.' }, { id: 'r', texto: 'No puedo', resultado: 'Rechazaste. No pasa nada.', queToca: 'Rechazaste la solicitud. No tienes nada pendiente.', luego: MOTIVO_RECHAZO }] },
  { hora: '9:40', texto: '📅 Ana eligió una de tus horas libres para la entrevista\nMañana a las 4:00 pm hora de Caracas (3:00 pm hora de Miami). Dura 20 minutos. Ese horario queda reservado hasta que respondas.', botones: [{ id: 'ok', texto: 'Confirmo que puedo', resultado: 'Confirmado ✓ Te recordamos 1 hora antes.', queToca: 'La entrevista con Ana está confirmada para mañana a las 4:00 pm hora de Caracas. Te recordamos 1 hora antes. No tienes que hacer nada ahora.' }, { id: 'no', texto: 'No puedo a esa hora', resultado: 'Anotado. Le mostramos a Ana las otras horas que tienes libres, sin que te escriba.', queToca: 'Le mostramos a Ana tus otras horas libres. Esperas a que elija otra y te avisamos. No tienes que hacer nada.' }] },
  { hora: '2:00', texto: '⏰ Tu entrevista es en 1 hora\nCuando sea la hora, toca el botón. Si se corta, vuelve a tocarlo.', botones: [{ id: 'e', texto: '🎥 Entrar a la entrevista', resultado: 'Abriendo la sala…', queToca: 'Estás entrando a la entrevista. Si se corta la conexión, vuelve a tocar el mismo botón y sigues donde estabas.' }] },
  { hora: '4:25', texto: '🎉 Ana te contrató\nCuando complete su ficha y elija un horario, te avisamos. Desde ahora ves su nombre completo: Ana Rojas.' },
  { hora: '3:10', texto: '📅 Ana eligió tu horario\nJueves 5 nov, 10:00 am (hora de Caracas). Ya ves la ficha de su mamá.', botones: [{ id: 'ok', texto: '✅ Confirmo la cita', resultado: 'Cita confirmada ✓ Te mandamos la dirección 3 horas antes.', queToca: 'La visita está confirmada: jueves 5 nov, 10:00 am hora de Caracas. La dirección te llega 3 horas antes. No tienes que hacer nada ahora.' }, { id: 'no', texto: 'No puedo ese día', resultado: 'Le avisamos a Ana y le ofrecemos otros horarios. Queda anotado.', queToca: 'Le ofrecemos otras horas a Ana. Esperas su nueva elección y te avisamos. No tienes que hacer nada.' }] },
  { hora: '7:00', texto: '📍 Tu visita es en 3 horas\nDirección: Av. Francisco de Miranda, Edif. Sol, piso 3, apto 3B (Chacao).\nCómo entrar: avisa en conserjería.\nQuién abre: Rosa, la vecina.\nSi nadie abre, toca "Llegué y no hay nadie" cuando llegues: Compaz avisa al contacto por ti.', botones: [{ id: 'v', texto: '🚗 Voy en camino', resultado: 'Avisamos a Ana que vas en camino.', queToca: 'Vas en camino. Al llegar, toca "Llegué" y manda la foto de la puerta o la fachada.' }, { id: 'd', texto: '❓ Tengo una duda', resultado: 'Dime qué pasa:', luego: DUDAS }] },
  { hora: '9:58', texto: '📸 Llegaste\nToca el botón y luego manda una foto de la puerta o la fachada. La foto es obligatoria, sirve de prueba de llegada y se borra a los 90 días.', botones: [{ id: 'l', texto: '📍 Llegué', resultado: 'Llegada anotada. Falta la foto de la puerta: es obligatoria.', queToca: 'Falta la foto de llegada: es obligatoria para continuar. Mándala aquí.', luego: FOTO_LLEGADA }] },
  { hora: '10:00', texto: '🔔 ¿Te abrieron?\nSi abren, toca Iniciar visita. Si no hay nadie, avísanos y empezamos a contar 30 minutos.', botones: [{ id: 'i', texto: '▶️ Iniciar visita', resultado: 'Esperando que Ana confirme (o se confirma sola en 5 minutos).', queToca: 'Esperas a que Ana confirme el inicio de la visita. Si no responde, arranca sola en 5 minutos. No tienes que hacer nada.', luego: VISITA_EN_CURSO }, { id: 'n', texto: '🚪 Llegué y no hay nadie', resultado: 'Empezó la espera de 30 minutos. Le avisamos a Ana con tu foto y le escribimos al contacto en el sitio a los 5 y 15 minutos. Tú solo espera aquí.', queToca: '⏳ Estás esperando a que abran la puerta, hasta 30 minutos como máximo. Tu tiempo se paga: si nadie aparece, la visita cuenta como usada por la familia y tú cobras el viaje. No tienes que hacer nada más que esperar cerca: nosotros le avisamos a Ana con tu foto y le escribimos al contacto en el sitio a los 5 y a los 15 minutos. A los 30 minutos te avisamos para que cierres la visita.' }] },
  { hora: '11:15', texto: '⏱️ ¿Todo bien?\nTu visita debía terminar a las 11:00. Si no respondes en 10 minutos, avisamos al equipo.', botones: [{ id: 'b', texto: '👍 Todo bien, termino pronto', resultado: 'Gracias. Cuando termines, toca Terminar visita.', queToca: 'La visita sigue en curso. Cuando termines, toca "Terminar visita".' }, { id: 'h', texto: '🆘 Necesito ayuda', resultado: 'Avisamos al equipo ahora mismo.', queToca: 'Avisamos al equipo de que necesitas ayuda. Te respondemos por aquí, no por llamada. Si te sientes en riesgo, toca "No me siento seguro".' }] },
  { hora: '11:20', rama: 'Alternativa: contratación directa', texto: '🤝 Ana quiere contratarte directamente, sin entrevista.\nQué se hará: acompañar a su mamá a misa y a caminar.\nCuándo: jueves en la mañana.\n¿Lugar privado? Sí, la casa de su mamá en Chacao.\nAdemás de su mamá estarán: 1 familiar y 1 vecina.\nFamiliar: 82 años, camina con bastón.\n📷 Foto de Ana', botones: [{ id: 'a', texto: '✅ Aceptar', resultado: 'Aceptaste ✓ Ana paga primero; te avisamos cuando esté confirmado.', queToca: 'Aceptaste la contratación directa. Ana paga primero y te avisamos cuando esté confirmado. No tienes que hacer nada.' }, { id: 'r', texto: 'No puedo', resultado: 'Rechazaste. No pasa nada: el cliente elige a otro compita sin haber pagado.', queToca: 'Rechazaste la contratación. No tienes nada pendiente.', luego: MOTIVO_RECHAZO }] },
  { hora: '10:30', rama: 'Alternativa: nadie abrió', texto: '🚪 Pasaron 30 minutos\nNadie apareció. Puedes cerrar la visita. Cuenta como usada por la familia y tú cobras el viaje. Si Ana tuvo una causa justificada, el equipo puede reprogramarla.', botones: [{ id: 'c', texto: 'Cerrar visita sin acceso', resultado: 'Cerrada ✓ Quedó registrada como "sin acceso".', queToca: 'Cerraste la visita como "sin acceso": cuenta como usada y cobras el viaje. No tienes nada pendiente.' }] },
  { hora: '8:20', rama: 'Alternativa: cambió quién estará', texto: '⚠️ Cambió quién estará en el lugar\nAna agregó a 1 amigo o amiga. Ahora estarán: 1 familiar, 1 vecina y 1 amigo o amiga, además de su mamá.\nTu visita sigue siendo el jueves 5 nov, 10:00 am (hora de Caracas). Puedes decidir si sigues.', botones: [{ id: 's', texto: '✅ Sigo con la visita', resultado: 'Anotado ✓ Le avisamos a Ana que confirmaste.', queToca: 'Sigues con la visita del jueves, con la lista nueva de personas. No tienes que hacer nada ahora.' }, { id: 'n', texto: '🛑 Prefiero no ir', resultado: 'Sin problema y sin penalización. Le ofrecemos a Ana otro horario o compita, y el equipo ya está enterado.', queToca: 'Cancelaste esta visita sin penalización. Le ofrecemos a Ana otro horario u otro compita. No tienes nada pendiente.' }] },
  { hora: '5:30', rama: 'Alternativa: el cliente quiere otra visita', texto: '📅 Ana quiere agendar otra visita contigo\nSe abrió un chat para que se pongan de acuerdo en el día y la hora. Escribe aquí y le llega a Ana.\n🛡️ No compartas teléfonos ni correos: es por seguridad y quien lo haga puede ser penalizado.\n🎤 Las notas de voz no están activas: escribe en texto o manda una foto.', botones: [{ id: 'e', texto: '💬 Escribirle a Ana', resultado: 'Listo: lo que escribas aquí le llega a Ana, y lo que ella escriba te llega a ti.', queToca: 'Estás coordinando la próxima visita con Ana por el chat. Cuando acuerden día y hora, ella elige la fecha y tú la confirmas. No compartas contactos.' }] },
  { hora: '5:45', rama: 'Alternativa: visita en espera', texto: '⏸️ Tu visita del jueves 5 nov quedó en espera\nEl equipo de Compaz está revisando algo con la cuenta del cliente. No tienes que hacer nada: te avisamos apenas se resuelva. No vayas a esa visita hasta recibir el aviso.', botones: [{ id: 'ok', texto: '👍 Entendido', resultado: 'Anotado. Te avisamos cuando haya novedades.', queToca: 'Tu visita del jueves está en espera mientras el equipo revisa. No vayas hasta recibir el aviso de Compaz. No tienes que hacer nada.' }] },
  { hora: '6:00', rama: 'Alternativa: videollamada', texto: '🎥 Ana pide una videollamada con su mamá\nHoy a las 6:00 pm. Dura hasta 20 minutos. No se graba.', botones: [{ id: 'a', texto: '✅ Acepto', resultado: 'Aceptada ✓ Te mandamos el botón 5 minutos antes.', queToca: 'La videollamada está aceptada. Te mandamos el botón 5 minutos antes. No tienes que hacer nada ahora.' }, { id: 'o', texto: '🕒 Propongo otra hora', resultado: 'Le preguntamos a Ana si le sirve otra hora.', queToca: 'Esperas a que Ana responda a tu nueva hora. Te avisamos.' }] },
]

const hora = () => '·'

const CONTEXTO_SEGURO = 'Tu visita se detuvo por seguridad, sin penalización. Puedes irte ya. El equipo está enterado y le avisamos al cliente de forma neutra. Si quieres, cuéntanos qué pasó con los botones de arriba. No tienes que hacer nada más.'

// Lo que pasa al tocar "No me siento seguro": el bot detiene la visita y ofrece motivos de un toque.
function parSeguro(n: number): Msg[] {
  return [
    { id: 200 + n, hora: hora(), texto: '🛑 No me siento seguro' },
    {
      id: 300 + n, hora: hora(),
      texto: 'Tu visita se detuvo. No pasa nada y no hay penalización. Puedes irte ya. Al cliente le avisamos de forma neutra que la visita se interrumpió, y el equipo se pone en contacto contigo. Si quieres, cuéntanos qué pasó:',
      botones: [
        { id: 'm1', texto: 'Me pidió algo fuera del servicio', resultado: 'Anotado ✓ El equipo lo revisa.' },
        { id: 'm2', texto: 'Me sentí incómodo con alguien', resultado: 'Anotado ✓ El equipo lo revisa.' },
        { id: 'm3', texto: 'El lugar no era seguro', resultado: 'Anotado ✓ El equipo lo revisa.' },
        { id: 'm4', texto: '🚫 No quiero volver con este cliente', resultado: 'Listo ✓ No se te volverá a asignar este cliente.' },
      ],
    },
  ]
}

function TelegramMock() {
  // ?hasta=N abre el chat ya avanzado hasta el aviso N (lo usa el recorrido guiado).
  const hasta = Math.min(Math.max(Number(useParam('hasta')) || 0, 0), GUION.length - 1)
  // ?solo=N muestra solo el aviso N (alternativas); ?accion=seguro abre el chat tras tocar "No me siento seguro".
  const soloN = useParam('solo')
  const solo = soloN !== null && GUION[Number(soloN)] ? Number(soloN) : null
  const conAccion = useParam('accion') === 'seguro'
  const embebido = useEmbedded()
  const inicial = (): Msg[] => {
    if (conAccion) return parSeguro(0)
    if (solo !== null) return [{ id: solo, ...GUION[solo] }]
    return GUION.slice(0, hasta + 1).map((m, i) => (i < hasta ? { id: i, ...m, botones: undefined, resuelto: m.botones?.[0].resultado } : { id: i, ...m }))
  }
  const [msgs, setMsgs] = useState<Msg[]>(inicial)
  // Situación actual del compita: lo que hizo en el último botón. Alimenta "¿Qué me toca?".
  const contextoInicial = (): string | null => {
    if (conAccion) return CONTEXTO_SEGURO
    if (solo !== null) return null
    for (let i = hasta - 1; i >= 0; i--) { const q = GUION[i].botones?.[0].queToca; if (q) return q }
    return null
  }
  const [contexto, setContexto] = useState<string | null>(contextoInicial)
  const [siguiente, setSiguiente] = useState(conAccion || solo !== null ? GUION.length : hasta + 1)
  const fin = useRef<HTMLDivElement>(null)

  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs])

  const tocar = (m: Msg, b: Boton) => {
    if (b.queToca) setContexto(b.queToca)
    setMsgs((arr) => {
      const hecho = arr.map((x) => (x.id === m.id ? { ...x, resuelto: b.resultado, botones: undefined } : x))
      return b.luego ? [...hecho, { id: 400 + arr.length, hora: hora(), ...b.luego }] : hecho
    })
  }

  const avanzar = () => {
    if (siguiente >= GUION.length) return
    setMsgs((arr) => [...arr, { id: siguiente, ...GUION[siguiente] }])
    setSiguiente(siguiente + 1)
  }

  const queToca = () => {
    const pend = msgs.filter((m) => m.botones)
    const partes: string[] = []
    if (contexto) partes.push(contexto)
    if (pend.length) partes.push('Pendiente de ti:\n' + pend.map((m, i) => `${i + 1}. ${m.texto.split('\n')[0]}`).join('\n'))
    const texto = partes.length ? partes.join('\n\n') : 'Nada pendiente 🎉 Te avisamos cuando haya algo.'
    setMsgs((arr) => [...arr, { id: 100 + arr.length, hora: hora(), texto }])
  }

  // Botones fijos del teclado: respuesta inmediata del bot.
  const decir = (propio: string, respuesta: string) => {
    setContexto('Avisaste al equipo de una emergencia. Si es médica, llama también a emergencias de tu zona. El equipo te escribe por aquí y no hace llamadas.')
    setMsgs((arr) => [...arr, { id: 200 + arr.length, hora: hora(), texto: propio }, { id: 300 + arr.length, hora: hora(), texto: respuesta }])
  }
  // Lo que pasa si el compita manda una nota de voz: el bot no la reenvía y se lo explica (nunca se queda en silencio).
  const notaDeVoz = () => setMsgs((arr) => [...arr, { id: 500 + arr.length, hora: hora(), texto: '🎤 Nota de voz (0:12)', propio: true }, { id: 600 + arr.length, hora: hora(), texto: TEXTO_NOTA_DE_VOZ }])
  const noSeguro = () => { setContexto(CONTEXTO_SEGURO); setMsgs((arr) => [...arr, ...parSeguro(arr.length)]) }

  const reiniciar = () => { setContexto(contextoInicial()); setMsgs(inicial()); setSiguiente(conAccion || solo !== null ? GUION.length : hasta + 1) }

  return (
    <main className="mx-auto flex max-w-md flex-col px-3 pb-10 pt-4">
      {!embebido && <div className="mb-3 rounded-xl border border-dashed border-[var(--border-muted)] bg-white p-3 text-sm text-[var(--text-mid)]">
        Chat de Telegram del compita. Toca los botones dentro de los mensajes: el mensaje se edita, no se llena el chat. Después usa <b>Simular siguiente aviso</b>.
      </div>}

      <div className="overflow-hidden rounded-3xl border-4 border-[var(--purple-dark)] bg-[#e6ebee] shadow-xl">
        <div className="flex items-center gap-3 bg-[#517da2] px-4 py-3 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--orange)] font-extrabold">C</div>
          <div><div className="font-bold leading-tight">Compaz</div><div className="text-xs opacity-80">bot oficial</div></div>
        </div>

        <div className="h-[480px] space-y-3 overflow-y-auto p-3">
          {msgs.map((m) => (
            <div key={m.id} className={m.propio ? 'ml-auto max-w-[88%]' : 'max-w-[88%]'}>
              {m.rama && <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#517da2]">{m.rama}</div>}
              <div className={`rounded-2xl p-3 text-[15px] shadow-sm ${m.propio ? 'rounded-tr-sm bg-[#EFFDDE]' : 'rounded-tl-sm bg-white'}`}>
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
          <button onClick={noSeguro} className="rounded-xl bg-[#FEF3C7] py-3 text-[15px] font-bold text-[#92400E]">🛑 No me siento seguro</button>
        </div>
      </div>

      {!embebido && <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={avanzar} disabled={siguiente >= GUION.length} className="min-h-12 rounded-2xl bg-[var(--orange)] px-4 font-extrabold text-white disabled:opacity-40">Simular siguiente aviso</button>
        <button onClick={reiniciar} className="min-h-12 rounded-2xl border border-[var(--border-muted)] bg-white px-4 font-bold text-[var(--text-mid)]">Reiniciar</button>
        <button onClick={notaDeVoz} className="col-span-2 min-h-12 rounded-2xl border border-[var(--border-muted)] bg-white px-4 font-bold text-[var(--text-mid)]">🎤 Simular que el compita manda una nota de voz</button>
      </div>}
      <p className="mt-4 rounded-2xl border border-[#F5B800] bg-[#FFFBEB] p-3 text-sm font-bold text-[#7a5b00]">🛡️ {TEXTO_COMPITA}</p>
    </main>
  )
}

export default function Page() {
  return <Suspense><TelegramMock /></Suspense>
}
