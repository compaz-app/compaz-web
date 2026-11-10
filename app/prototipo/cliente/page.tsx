'use client'
import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useEmbedded, useParam, useUrlState } from '../useUrlState'
import AvisoSeguridad from '../AvisoSeguridad'
import CuentaEliminar from './CuentaEliminar'
import InfoBoton from '../InfoBoton'

const PASOS = ['Elegir', 'Entrevista', 'Decidir', 'Pagar', 'Ficha', 'Visitas']

type Estado = {
  id: string
  etiqueta: string
  paso: number
  titulo: string
  texto: string
  boton: string
  secundario?: string
  tono?: 'espera' | 'accion'
  href?: string
  secHref?: string
  respuesta?: string
  secRespuesta?: string
  extra?: 'horarios' | 'horarios_otra' | 'motivo' | 'chat' | 'reporte' | 'ficha' | 'cita' | 'llegada' | 'ayuda' | 'video' | 'nadie'
  sinBoton?: boolean
}

// Antes de pagar el cliente ve "María P."; el nombre completo llega con el pago (decisión del punto 2).
const ESTADOS: Estado[] = [
  { id: 'enviada', etiqueta: '1. Solicitud enviada (hablar primero)', paso: 0, titulo: 'Esperando a María P.', texto: 'Le avisamos que quieres conocerla. Te escribimos apenas responda, normalmente en pocas horas.', boton: 'Ver otros compitas', href: '/prototipo/cliente/elegir', tono: 'espera' },
  { id: 'enviada_recibida', etiqueta: '1d. María ya recibió tu solicitud', paso: 0, titulo: 'María P. ya recibió tu solicitud', texto: 'Le llegó el aviso a su Telegram. Normalmente responde en pocas horas. Si pasa un día sin respuesta, te ayudamos a elegir a otro compita sin que pagues nada.', boton: 'Ver otros compitas', href: '/prototipo/cliente/elegir', tono: 'espera' },
  { id: 'directa_enviada', etiqueta: '1b. Solicitud enviada (contratar directo)', paso: 0, titulo: 'Esperando que María P. acepte', texto: 'Aún no pagas nada. Si María acepta, pasas al pago. Si no puede, eliges a otro compita sin haber pagado.', boton: 'Ver otros compitas', href: '/prototipo/cliente/elegir', tono: 'espera' },
  { id: 'mandado_enviado', etiqueta: '1c. Mandado enviado', paso: 0, titulo: 'Esperando que María P. acepte tu mandado', texto: 'Tarifa plana de $22. Si acepta, pagas y ella lo hace. Si no puede, eliges a otro compita sin haber pagado.', boton: 'Ver otros compitas', href: '/prototipo/cliente/elegir', tono: 'espera' },
  { id: 'aceptada', etiqueta: '2. Aceptó, elegir horario', paso: 1, titulo: 'María P. aceptó. Elige tu horario', texto: 'La entrevista dura 20 minutos, por video o solo con voz. Estas son las horas que María tiene libres. Toca la que te quede mejor.', boton: '', sinBoton: true, extra: 'horarios' },
  { id: 'horario_enviado', etiqueta: '2b. Horario pedido, esperando confirmación', paso: 1, titulo: 'Esperando que María confirme', texto: 'Pediste mañana a las 3:00 pm (4:00 pm en Caracas). Ese horario queda reservado para ti mientras ella responde. Te avisamos apenas confirme.', boton: 'Cambiar de horario', href: '/prototipo/cliente?estado=aceptada', tono: 'espera' },
  { id: 'horario_rechazado', etiqueta: '2c. El compita no puede a esa hora', paso: 1, titulo: 'María no puede a esa hora. Elige otra', texto: 'Le surgió un imprevisto a las 3:00 pm de mañana. Estas son las demás horas que le quedan libres.', boton: '', sinBoton: true, extra: 'horarios_otra' },
  { id: 'programada', etiqueta: '3. Entrevista programada', paso: 1, titulo: 'Entrevista mañana a las 3:00 pm', texto: 'Es tu hora de Miami; en Caracas son las 4:00 pm. Te mandamos un recordatorio una hora antes, con el botón para entrar.', boton: 'Cambiar horario', href: '/prototipo/cliente?estado=aceptada', tono: 'espera' },
  { id: 'ahora', etiqueta: '4. Entrevista ahora', paso: 1, titulo: 'Tu entrevista con María P. es ahora', texto: 'Ya puedes entrar. Si se corta la conexión, vuelve a pulsar el mismo botón y sigues donde estabas.', boton: 'Entrar a la entrevista', respuesta: 'Abriendo la sala. Cuando termine la entrevista te preguntamos si la contratas.', secundario: 'Ya terminó la entrevista', secHref: '/prototipo/cliente?estado=decidir' },
  { id: 'decidir', etiqueta: '5. Decidir', paso: 2, titulo: '¿Contratas a María P.?', texto: 'Si dices que sí, pasamos al pago. Si dices que no, te mostramos otros compitas sin costo.', boton: 'Sí, quiero contratarla', href: '/prototipo/cliente?estado=pagar', secundario: 'No, ver otras', secHref: '/prototipo/cliente?estado=motivo_no' },
  { id: 'motivo_no', etiqueta: '5c. Dijo que no (motivo opcional)', paso: 2, titulo: 'Gracias por contarnos. ¿Qué pasó?', texto: 'Es opcional y de un toque. Nos ayuda a mejorar. Después te mostramos otros compitas sin costo.', boton: '', sinBoton: true, extra: 'motivo' },
  { id: 'directa_aceptada', etiqueta: '5b. Aceptó la contratación directa', paso: 3, titulo: 'María P. aceptó. Un último paso: el pago', texto: 'Envía el pago y escribe esta referencia. Cuando lo confirmemos, completas la ficha de tu familiar y agendas.', boton: 'Ya hice el pago', href: '/prototipo/cliente?estado=pago_revision' },
  { id: 'pagar', etiqueta: '6. Pagar', paso: 3, titulo: 'Un último paso: el pago', texto: 'Envía el pago y escribe esta referencia. Cuando lo confirmemos, completas la ficha de tu familiar y agendas.', boton: 'Ya hice el pago', href: '/prototipo/cliente?estado=pago_revision' },
  { id: 'pago_revision', etiqueta: '7. Pago en revisión', paso: 3, titulo: 'Estamos confirmando tu pago', texto: 'Tarda unas horas. No tienes que quedarte esperando: aquí verás cuando esté confirmado. Mientras tanto ya puedes completar la ficha de tu familiar.', boton: 'Completar la ficha ahora', href: '/prototipo/cliente?estado=ficha_espera', tono: 'espera', extra: 'ayuda' },
  { id: 'ficha_espera', etiqueta: '7b. Completa la ficha mientras confirmamos el pago', paso: 3, titulo: 'Completa la ficha mientras confirmamos tu pago', texto: 'Así adelantas lo único que falta para agendar. Solo la ve tu compita, y la dirección exacta solo se le entrega 3 horas antes.', boton: '', sinBoton: true, extra: 'ficha' },
  { id: 'pago_ficha_lista', etiqueta: '7c. Ficha lista, falta confirmar el pago', paso: 3, titulo: 'Ficha lista. Solo falta confirmar tu pago', texto: 'Apenas lo confirmemos podrás agendar tu primera visita. Te avisamos por correo y aquí mismo.', boton: '', sinBoton: true, tono: 'espera', extra: 'ayuda' },
  { id: 'ficha', etiqueta: '8. Ficha del familiar (obligatoria)', paso: 4, titulo: 'Pago confirmado. Cuéntanos de tu familiar', texto: 'Es lo único que falta para agendar tu primera visita. Solo lo ve tu compita, y la dirección exacta solo se le entrega 3 horas antes.', boton: '', sinBoton: true, extra: 'ficha' },
  { id: 'agendar', etiqueta: '9. Agendar la primera visita', paso: 4, titulo: 'Elige cuándo visita María Pérez', texto: 'Estos son los horarios que ella tiene libres. María debe confirmar tu elección.', boton: 'Pedir esta cita', href: '/prototipo/cliente?estado=cita_pendiente', extra: 'cita' },
  { id: 'cita_pendiente', etiqueta: '10. Esperando que el compita confirme', paso: 5, titulo: 'Esperando que María confirme tu cita', texto: 'Jueves 5 nov, 9:00 am tu hora (10:00 am en Caracas). Si no puede, te avisamos y te ofrecemos otros horarios, sin costo.', boton: 'Ver mis visitas', href: '/prototipo/cliente?sec=visitas', tono: 'espera' },
  { id: 'activo', etiqueta: '11. Visitas activas', paso: 5, titulo: 'Próxima visita: jueves 9:00 am', texto: 'Es tu hora de Miami; en Caracas son las 10:00 am. María Pérez visitará a tu mamá en Chacao. Puedes cambiarla gratis hasta 24 horas antes. Te avisamos cuando llegue y cuando termine.', boton: 'Ver mis visitas', href: '/prototipo/cliente?sec=visitas', tono: 'espera', extra: 'video' },
  { id: 'llego', etiqueta: '12. El compita llegó (con foto)', paso: 5, titulo: '¡María llegó a casa de tu mamá!', texto: 'Esta es la foto que mandó al llegar. Confirma que puede empezar la visita. Si no respondes, se confirma sola en 5 minutos.', boton: 'Confirmar y empezar', href: '/prototipo/cliente?estado=curso', extra: 'llegada' },
  { id: 'nadie_abre', etiqueta: '13. Llegó y nadie abre', paso: 5, titulo: 'María llegó y no le abren', texto: 'Está en la puerta esperando. Avísale a quien pueda abrir. Si en 30 minutos nadie aparece, la visita se cuenta como usada.', boton: 'Ya abrieron', href: '/prototipo/cliente?estado=llego', secundario: 'Avisar a Compaz', secRespuesta: 'Avisamos al equipo con urgencia. Te respondemos por correo lo antes posible.', extra: 'nadie' },
  { id: 'curso', etiqueta: '14. Visita en curso', paso: 5, titulo: 'María está con tu mamá', texto: 'Aquí verás las fotos y notas que María envíe durante la visita. También puedes escribirle.', boton: '', sinBoton: true, extra: 'chat' },
  { id: 'interrumpida', etiqueta: '15. Visita interrumpida (seguridad)', paso: 5, titulo: 'La visita se interrumpió', texto: 'María tuvo que retirarse antes de tiempo. No tienes que hacer nada: el equipo de Compaz te escribe hoy para organizar otra visita.', boton: 'Avisar a Compaz que recibí el aviso', respuesta: 'Gracias. El equipo te escribe hoy por correo para organizar otra visita.', tono: 'espera' },
  { id: 'cancelada_equipo', etiqueta: '19. El equipo canceló tu visita (sin costo)', paso: 5, titulo: 'Tu visita con María ya no podrá realizarse', texto: 'Lamentamos las molestias. No tienes que hacer nada: esta visita no se descuenta de tu plan y el equipo de Compaz te escribe para ayudarte a encontrar otra opción.', boton: 'Elegir otro compita', href: '/prototipo/cliente/elegir', tono: 'accion' },
  { id: 'pausada', etiqueta: '17. Cuenta en pausa (2.º contacto compartido)', paso: 5, titulo: 'Tu cuenta está en pausa', texto: 'Por ahora tu cuenta está en pausa porque se intentó compartir contactos por segunda vez, y eso va contra las reglas de seguridad de Compaz. Compaz se comunicará contigo por correo para resolverlo. Mientras tanto no puedes escribir en el chat ni agendar visitas, y tu próxima visita queda en espera hasta que Compaz se comunique contigo.', boton: '', sinBoton: true, tono: 'espera' },
  { id: 'fin', etiqueta: '16. Visita terminada', paso: 5, titulo: 'La visita terminó. ¿Cómo te fue?', texto: 'Tu calificación ayuda a otras familias y a mejorar el servicio. Aquí tienes el reporte de María.', boton: '', sinBoton: true, extra: 'reporte' },
  { id: 'recurrente', etiqueta: '18. Cliente que ya tuvo visitas', paso: 5, titulo: 'Próxima visita: jueves 9:00 am', texto: 'Es tu hora de Miami; en Caracas son las 10:00 am. María Pérez volverá a visitar a tu mamá. Te quedan 1 de 2 visitas este ciclo.', boton: 'Ver mis visitas', href: '/prototipo/cliente?sec=visitas', tono: 'espera' },
]

function Avatar({ nombre }: { nombre: string }) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--purple)] text-xl font-extrabold text-white">
      {nombre[0]}
    </div>
  )
}


function Novedades() {
  const items = [
    { h: '10:12', t: 'Llegué. Tu mamá me recibió con café y está de buen ánimo.', foto: false },
    { h: '10:40', t: 'Estamos viendo sus fotos del jardín.', foto: true },
    { h: '11:05', t: 'Desayunó bien y tomó su medicina.', foto: false },
  ]
  return (
    <section className="mt-5 rounded-3xl border-2 border-[#1f9d6b] bg-white p-4">
      <h2 className="text-lg font-extrabold">Novedades de la visita</h2>
      <ul className="mt-3 grid gap-3">
        {items.map((n) => (
          <li key={n.h} className="rounded-2xl bg-[var(--warm-gray)] p-3">
            <div className="text-xs font-bold text-[var(--text-light)]">{n.h}</div>
            {n.foto && <div className="mt-2 flex h-36 items-center justify-center rounded-xl bg-[var(--border-muted)] text-[var(--text-mid)]">📷 Foto</div>}
            <p className="mt-1 text-base">{n.t}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ChatMock() {
  const [msgs, setMsgs] = useState([
    { de: 'María', t: 'Hola Carolina, ya estoy con tu mamá. Está de buen ánimo y desayunó.' },
    { de: 'Tú', t: 'Gracias María. ¿Puedes preguntarle si tomó su medicina?' },
  ])
  const [txt, setTxt] = useState('')
  const [aviso, setAviso] = useState(false)
  const enviar = () => {
    if (!txt.trim()) return
    // Misma idea que lib/chat-moderacion.ts: si hay teléfono o correo se censura y se avisa al equipo.
    const contacto = /\d[\d\s.-]{6,}\d|@|whats|telegram/i.test(txt)
    setMsgs((m) => [...m, { de: 'Tú', t: contacto ? '[contacto eliminado]' : txt }])
    setAviso(contacto)
    setTxt('')
  }
  return (
    <section className="mt-5 rounded-3xl border border-[var(--border-muted)] bg-white p-4">
      <h2 className="text-lg font-extrabold">Chat con María</h2>
      <div className="mt-3 grid gap-2">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-base ${m.de === 'Tú' ? 'justify-self-end bg-[var(--purple)] text-white' : 'bg-[var(--warm-gray)]'}`}>{m.t}</div>
        ))}
      </div>
      {aviso && <p className="mt-3 rounded-xl bg-[#FEF2F2] p-3 text-sm font-bold text-[#991B1B]">Por seguridad no se pueden compartir teléfonos ni correos. Compaz conecta todo dentro de la plataforma. El equipo fue avisado.</p>}
      <p className="mt-3 text-xs font-bold text-[#7a5b00]">🛡️ Nadie de Compaz te pedirá dinero ni datos por este chat. No compartas teléfonos ni correos: quien lo haga puede ser penalizado.</p>
      <div className="mt-3 flex gap-2">
        <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') enviar() }} placeholder="Escribe un mensaje" className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--border-muted)] px-3 text-base" />
        <button onClick={enviar} className="min-h-12 rounded-xl bg-[var(--orange)] px-4 font-extrabold text-white">Enviar</button>
      </div>
    </section>
  )
}

function Reporte() {
  const [estrellas, setEstrellas] = useState(0)
  const [enviada, setEnviada] = useState(false)
  const filas = [['Ánimo', 5], ['Estado físico', 4], ['Participación', 4], ['Entorno', 5]] as const
  return (
    <>
      <section className="mt-5 rounded-3xl border border-[var(--border-muted)] bg-white p-4">
        <h2 className="text-lg font-extrabold">Reporte de bienestar</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">{[1, 2, 3].map((n) => <div key={n} className="flex h-20 items-center justify-center rounded-xl bg-[var(--border-muted)] text-sm text-[var(--text-mid)]">📷 Foto {n}</div>)}</div>
        <div className="mt-3 grid gap-2">
          {filas.map(([n, v]) => (
            <div key={n} className="flex items-center gap-3 text-base"><span className="w-32">{n}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--warm-gray)]"><div className="h-full bg-[var(--orange)]" style={{ width: `${(v / 5) * 100}%` }} /></div><b>{v}/5</b></div>
          ))}
        </div>
        <p className="mt-3 text-base text-[var(--text-mid)]"><b>Resumen:</b> Tu mamá estuvo animada, conversó sobre su jardín y comió bien. No hubo novedades.</p>
      </section>
      <section className="mt-5 rounded-3xl border border-[var(--border-muted)] bg-white p-4">
        <h2 className="text-lg font-extrabold">Tu calificación</h2>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Estrellas">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setEstrellas(n)} aria-label={`${n} estrellas`} className={`h-12 w-12 text-3xl ${n <= estrellas ? 'text-[var(--orange)]' : 'text-[var(--border-muted)]'}`}>★</button>
          ))}
        </div>
        <textarea aria-label="Comentario opcional" placeholder="Comentario opcional (se publica en el perfil solo si el equipo lo aprueba)" className="mt-3 min-h-20 w-full rounded-xl border border-[var(--border-muted)] p-3 text-base" />
        {enviada ? (
          <div className="mt-3 grid gap-2">
            <p role="status" className="rounded-2xl bg-[var(--warm-gray)] p-4 text-lg font-bold">✓ Gracias por tu calificación. Ayuda a otras familias.</p>
            <Link href="/prototipo/cliente?estado=recurrente&sec=visitas" className="flex min-h-14 items-center justify-center rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white">Agendar otra visita</Link>
            <Link href="/prototipo/cliente?estado=recurrente" className="flex min-h-12 items-center justify-center rounded-2xl border border-[var(--border-muted)] font-bold text-[var(--text-mid)]">Volver al inicio</Link>
          </div>
        ) : (
          <button disabled={estrellas === 0} onClick={() => setEnviada(true)} className="mt-3 min-h-14 w-full rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white disabled:opacity-40">{estrellas === 0 ? 'Elige cuántas estrellas' : 'Enviar calificación'}</button>
        )}
      </section>
    </>
  )
}

function Ayuda() {
  const [r, setR] = useState<string | null>(null)
  const [avisos, setAvisos] = useState(0)
  return (
    <section className="mt-5 rounded-3xl border border-[var(--border-muted)] bg-white p-4">
      <h2 className="text-lg font-extrabold">¿No te llega el correo?</h2>
      <p className="mt-1 text-sm font-bold text-[#991B1B]">Si alguien te escribe o llama pidiéndote dinero para &quot;agilizar&quot; tu pago, es un fraude. Compaz no lo hace.</p>
      <p className="mt-1 text-base text-[var(--text-mid)]">No dependes de él: esta pantalla siempre muestra tu estado real.</p>
      {r && <p role="status" className="mt-3 flex items-center gap-1 rounded-xl bg-[var(--warm-gray)] p-3 font-bold"><span className="min-w-0 flex-1">✓ {r}</span>{avisos > 1 && <InfoBoton que="Por qué no se avisa otra vez" texto="Tu pago ya está marcado como urgente. Avisar más seguido no acelera la confirmación: el equipo recibe una sola alerta urgente por ventana para que no se pierda entre mensajes. Te escribimos por correo apenas lo confirmemos." />}</p>}
      {(
        <div className="mt-3 grid gap-2">
          <button onClick={() => setR('Te reenviamos la confirmación. Revisa también la carpeta de spam.')} className="min-h-12 rounded-xl border-2 border-[var(--purple)] font-extrabold text-[var(--purple)]">Reenviar la confirmación</button>
          <div className="flex items-center gap-1">
            <button onClick={() => { setAvisos(avisos + 1); setR(avisos === 0 ? 'Avisamos al equipo de Compaz con urgencia. Te escribimos por correo apenas confirmemos tu pago.' : 'Ya avisamos al equipo hace un momento. Podrás avisar de nuevo en 30 minutos.') }} className="min-h-12 flex-1 rounded-xl bg-[var(--orange)] font-extrabold text-white">Contactar a Compaz</button>
            <InfoBoton que="Contactar a Compaz" texto="Avisa al equipo, con urgencia, que ya pagaste. Si lo vuelves a tocar poco después, te explicamos por qué no se envía otro aviso y cuándo podrás hacerlo." alineado="izquierda" />
          </div>
        </div>
      )}
    </section>
  )
}

function FichaForm({ siguiente, etiqueta }: { siguiente: string; etiqueta: string }) {
  const campo = 'mt-1 min-h-14 w-full rounded-2xl border border-[var(--border-muted)] px-4 text-lg'
  const [ok, setOk] = useState(false)
  const [privado, setPrivado] = useState(true)
  const [nadie, setNadie] = useState(false)
  return (
    <section className="mt-5 grid gap-4 rounded-3xl border border-[var(--border-muted)] bg-white p-5">
      <h2 className="text-lg font-extrabold">Ficha de tu familiar</h2>
      <p className="-mt-2 text-sm font-bold text-[#991B1B]">Estos datos solo se escriben aquí. Compaz nunca te los pedirá por teléfono ni por mensaje.</p>
      <p className="-mt-2 text-sm text-[var(--text-mid)]">Una sola vez. Lo que ya pusiste antes no se repite. No pedimos medicinas ni historial médico.</p>
      <label className="text-base font-bold">Tu teléfono <span className="font-normal text-[var(--text-light)]">(solo lo ve el equipo de Compaz, nunca el compita)</span><input inputMode="tel" defaultValue="+1 305 555 0142" className={campo} /></label>
      <label className="text-base font-bold">País donde vives<input defaultValue="Estados Unidos" className={campo} /></label>
      <label className="text-base font-bold">¿Qué eres de tu familiar?<select className={campo} defaultValue="Hija"><option>Hija</option><option>Hijo</option><option>Nieta o nieto</option><option>Otro</option></select></label>
      <label className="text-base font-bold">Nombre de tu familiar<input defaultValue="Elena" className={campo} /></label>
      <label className="text-base font-bold">Edad aproximada<input defaultValue="82" inputMode="numeric" className={campo} /></label>
      <div>
        <div className="text-base font-bold">¿Estará en una casa u otro lugar privado?</div>
        <div className="mt-2 flex gap-2">{[true, false].map((v) => <button key={String(v)} onClick={() => setPrivado(v)} aria-pressed={privado === v} className={`min-h-12 flex-1 rounded-full font-bold ${privado === v ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)]'}`}>{v ? 'Sí' : 'No'}</button>)}</div>
      </div>
      {privado && <>
        <label className="text-base font-bold">Cómo es su día a día y cómo se mueve<textarea defaultValue="Camina con bastón, se cansa rápido. Le gusta el jardín." className={`${campo} min-h-24 py-3`} /></label>
        <div>
          <div className="text-base font-bold">¿Quién más estará en el lugar mientras el compita esté ahí? <span className="rounded bg-[#FEF3C7] px-1.5 py-0.5 text-xs font-extrabold uppercase text-[#92400E]">Obligatorio</span></div>
          <p className="mt-1 text-sm text-[var(--text-mid)]">Solo lo pedimos porque la visita es en una casa u otro lugar privado y el compita estará adentro con tu familiar. Es por su seguridad: necesita saber con quién se va a encontrar. En la solicitud dijiste: 1 familiar y 1 vecina.</p>
          {!nadie && <label className="mt-2 block text-base font-bold">Nombre de cada persona<input aria-label="Nombre de cada persona que estará" defaultValue="Rosa (vecina) y Pedro (familiar)" className={campo} /></label>}
          <button type="button" onClick={() => setNadie((n) => !n)} aria-pressed={nadie} className={`mt-2 min-h-12 w-full rounded-2xl border-2 px-4 text-base font-bold ${nadie ? 'border-[var(--purple)] bg-[var(--purple)] text-white' : 'border-[var(--border-muted)]'}`}>No habrá nadie más, solo mi familiar</button>
          {nadie && <p role="status" className="mt-2 rounded-2xl bg-[#FEF3C7] p-3 text-sm font-bold text-[#92400E]">Anotado: el compita estará a solas con tu familiar. Esto cambia lo que dijiste en la solicitud (1 familiar y 1 vecina), así que le avisamos al compita antes de la visita.</p>}
        </div>
      </>}
      <button className="min-h-14 rounded-2xl border-2 border-dashed border-[var(--border-muted)] text-base font-bold text-[var(--text-mid)]">📷 Foto de tu familiar (opcional)</button>
      <label className="flex items-start gap-3 text-base"><input type="checkbox" onChange={(e) => setOk(e.target.checked)} className="mt-1 h-6 w-6 shrink-0" /><span>Acepto que Compaz guarde estos datos y se los entregue solo al compita que me visita. Las fotos se borran a los 90 días de cerrada la visita. No contactaré al compita fuera de Compaz, y una visita en la que nadie abre se cuenta como usada.</span></label>
      <details className="rounded-2xl bg-[var(--warm-gray)] p-4 text-sm text-[var(--text-mid)]"><summary className="cursor-pointer font-bold text-[var(--text-dark)]">Leer los términos</summary><ol className="mt-2 list-decimal space-y-1 pl-5"><li>Guardamos los datos y las fotos de tu familiar y las tuyas solo para prestar el servicio.</li><li>Solo las ve el compita que te visita, y la dirección exacta solo 3 horas antes de la cita.</li><li>Las fotos de llegada se borran 90 días después de cerrada la visita.</li><li>No se contacta al compita fuera de Compaz.</li><li>Si el compita llega y nadie abre en 30 minutos, la visita se cuenta como usada.</li><li>Cambios y cancelaciones gratis hasta 24 horas antes.</li></ol></details>
      <p className={`text-sm ${ok ? 'font-bold text-green-700' : 'text-[var(--text-light)]'}`}>{ok ? '✓ Listo para guardar' : 'Para continuar tienes que aceptar.'}</p>
      {ok ? <Link href={siguiente} className="flex min-h-14 items-center justify-center rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white">{etiqueta}</Link> : <button disabled className="min-h-14 rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white opacity-40">{etiqueta}</button>}
    </section>
  )
}

function CitaForm() {
  const horas = [['Jue 5 nov, 10:00 am', '9:00 am tu hora (Miami)'], ['Jue 5 nov, 4:00 pm', '3:00 pm tu hora (Miami)'], ['Vie 6 nov, 10:00 am', '9:00 am tu hora (Miami)'], ['Sáb 7 nov, 9:00 am', '8:00 am tu hora (Miami)']]
  const [sel, setSel] = useState(horas[0][0])
  const campo = 'mt-1 min-h-14 w-full rounded-2xl border border-[var(--border-muted)] px-4 text-lg'
  return (
    <section className="mt-5 grid gap-4 rounded-3xl border border-[var(--border-muted)] bg-white p-5">
      <h2 className="text-lg font-extrabold">Horarios libres de María</h2>
      <div className="grid gap-2">
        {horas.map(([c, m]) => <button key={c} onClick={() => setSel(c)} aria-pressed={sel === c} className={`min-h-16 rounded-2xl border-2 px-4 text-left ${sel === c ? 'border-[var(--purple)] bg-[var(--purple)]/5' : 'border-[var(--border-muted)]'}`}><div className="text-lg font-extrabold">{c}</div><div className="text-sm text-[var(--text-mid)]">hora de Caracas · {m}</div></button>)}
      </div>
      <h2 className="text-lg font-extrabold">¿Dónde será esta visita?</h2>
      <p className="-mt-2 text-sm text-[var(--text-mid)]">Se pide por cada cita, y puedes guardar el lugar para la próxima. María recibe la dirección exacta 3 horas antes, por Telegram, nunca por el chat.</p>
      <p className="-mt-2 rounded-2xl bg-[#FEF3C7] p-3 text-sm font-bold text-[#92400E]">Está prohibido compartir teléfonos, correos u otros contactos directos por el chat. Es por seguridad, la tuya, la de tu familiar y la del compita: si lo intentas, el chat lo borra y se avisa al equipo.</p>
      <label className="text-base font-bold">Dirección o punto de encuentro<input defaultValue="Av. Francisco de Miranda, Edif. Sol, piso 3, apto 3B, Chacao" className={campo} /></label>
      <label className="text-base font-bold">Cómo entrar<input defaultValue="Avisar en conserjería" className={campo} /></label>
      <label className="text-base font-bold">Quién abre<input defaultValue="Rosa, la vecina" className={campo} /></label>
      <label className="text-base font-bold">Contacto en el sitio <span className="font-normal text-[var(--text-light)]">(solo lo ve el equipo de Compaz)</span><input defaultValue="Rosa · +58 414 555 0101" className={campo} /></label>
      <p className="rounded-2xl bg-[var(--warm-gray)] p-3 text-sm text-[var(--text-mid)]">Cambios y cancelaciones gratis hasta 24 horas antes. Después de eso la visita se cuenta como usada.</p>
    </section>
  )
}

function Llegada() {
  return (
    <section className="mt-5 rounded-3xl border border-[var(--border-muted)] bg-white p-4">
      <h2 className="text-lg font-extrabold">Foto de llegada</h2>
      <div className="mt-3 flex h-44 items-center justify-center rounded-2xl bg-[var(--border-muted)] text-[var(--text-mid)]">📷 Puerta del edificio · 9:58 am</div>
      <p className="mt-2 text-sm text-[var(--text-mid)]">La foto se guarda de forma privada y se borra 90 días después de cerrada la visita.</p>
    </section>
  )
}

function Nadie() {
  return (
    <>
      <Llegada />
      <section className="mt-5 rounded-3xl border-2 border-[#D93A3A] bg-[#FEF2F2] p-4">
        <h2 className="text-lg font-extrabold text-[#991B1B]">Quedan 18 de 30 minutos</h2>
        <p className="mt-1 text-base text-[#991B1B]">Ya le escribimos a Rosa, el contacto en el sitio. Tú no necesitas darle tu teléfono a nadie: Compaz hace de puente.</p>
      </section>
    </>
  )
}

function Video() {
  const [r, setR] = useState<string | null>(null)
  return (
    <section className="mt-5 rounded-3xl border border-[var(--border-muted)] bg-white p-4">
      <h2 className="text-lg font-extrabold">Habla con tu mamá y con María</h2>
      <p className="mt-1 text-base text-[var(--text-mid)]">Sin costo y sin descontar de tus visitas. Sin números de teléfono: todo pasa por Compaz.</p>
      {r ? <p className="mt-3 rounded-xl bg-[var(--warm-gray)] p-3 font-bold">✓ {r}</p> : (
        <div className="mt-3 grid gap-2">
          {[['🎬 Mensaje de video', 'Enviado. María lo recibe por Telegram.'], ['📞 Llamada de voz', 'Le preguntamos a María si puede ahora. Te avisamos.'], ['🎥 Videollamada', 'Le preguntamos a María a qué hora puede. Máximo 20 minutos, sin grabar.']].map(([t, m]) => <button key={t} onClick={() => setR(m)} className="min-h-12 rounded-xl border-2 border-[var(--purple)] font-extrabold text-[var(--purple)]">{t}</button>)}
        </div>
      )}
    </section>
  )
}

// Elegir la hora de la entrevista entre las horas LIBRES del compita (sus horarios guardados), sin escribir nada.
// Se muestra la hora del cliente (Miami) y la de Caracas. Al elegir, el horario queda reservado hasta que el compita confirme.
const HORAS_LIBRES: { dia: string; horas: [string, string][] }[] = [
  { dia: 'Mañana, miércoles 4 nov', horas: [['3:00 pm', '4:00 pm'], ['3:20 pm', '4:20 pm'], ['5:00 pm', '6:00 pm']] },
  { dia: 'Jueves 5 nov', horas: [['9:00 am', '10:00 am'], ['9:20 am', '10:20 am'], ['11:00 am', '12:00 m'], ['2:00 pm', '3:00 pm']] },
  { dia: 'Viernes 6 nov', horas: [['9:00 am', '10:00 am'], ['4:40 pm', '5:40 pm']] },
]
function Horarios({ otra }: { otra: boolean }) {
  const dias = otra ? HORAS_LIBRES.map((d, i) => (i === 0 ? { ...d, horas: d.horas.slice(1) } : d)) : HORAS_LIBRES
  const [sel, setSel] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [d, h] = sel ? sel.split('|') : ['', '']
  if (enviado) {
    return (
      <section className="mt-5 rounded-3xl border-2 border-[#1f9d6b] bg-white p-5">
        <div className="text-3xl">✓</div>
        <h2 className="text-xl font-extrabold">Pediste: {d.toLowerCase()}, {h.split(' (')[0]}</h2>
        <p className="mt-1 text-base text-[var(--text-mid)]">Ese horario queda reservado para ti. María debe confirmarlo y te avisamos. Si no puede, te mostramos las demás horas libres para que elijas otra, sin escribir nada.</p>
        <Link href="/prototipo/cliente?estado=horario_enviado" className="mt-3 flex min-h-12 items-center justify-center rounded-2xl border-2 border-[var(--purple)] font-extrabold text-[var(--purple)]">Ver mi solicitud</Link>
      </section>
    )
  }
  return (
    <section className="mt-5 rounded-3xl border border-[var(--border-muted)] bg-white p-4">
      <h2 className="text-lg font-extrabold">Horas libres de María</h2>
      <p className="text-sm text-[var(--text-mid)]">Cada hora aparece en tu ciudad (Miami) y en Caracas. Solo ves horas en las que ella puede.</p>
      {dias.map((x) => (
        <div key={x.dia} className="mt-4">
          <div className="text-sm font-extrabold uppercase tracking-wider text-[var(--text-light)]">{x.dia}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {x.horas.map(([mia, ccs]) => {
              const id = `${x.dia}|${mia} (${ccs} en Caracas)`
              return (
                <button key={id} onClick={() => setSel(id)} aria-pressed={sel === id} className={`min-h-16 rounded-2xl border-2 px-3 text-left ${sel === id ? 'border-[var(--purple)] bg-[var(--purple)]/5' : 'border-[var(--border-muted)]'}`}>
                  <div className="text-lg font-extrabold">{mia}</div>
                  <div className="text-xs text-[var(--text-mid)]">{ccs} en Caracas</div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <button disabled={!sel} onClick={() => setEnviado(true)} className="mt-5 min-h-14 w-full rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white disabled:opacity-40">{sel ? 'Pedir este horario' : 'Elige una hora'}</button>
    </section>
  )
}

// Al decir que no, el motivo es opcional y de un toque (decisión del punto 5). Cualquier salida lleva a elegir otro compita.
function MotivoNo() {
  const motivos = ['No conectamos', 'El precio', 'Prefiero otro compita', 'Necesito más tiempo', 'Otro motivo']
  return (
    <section className="mt-5 rounded-3xl border border-[var(--border-muted)] bg-white p-4">
      <div className="grid gap-2">
        {motivos.map((m) => <Link key={m} href="/prototipo/cliente/elegir" className="flex min-h-14 items-center rounded-2xl border-2 border-[var(--border-muted)] px-4 text-lg font-bold">{m}</Link>)}
      </div>
      <Link href="/prototipo/cliente/elegir" className="mt-3 flex min-h-12 items-center justify-center font-bold text-[var(--text-mid)] underline">Omitir y ver otros compitas</Link>
    </section>
  )
}

function Cabecera({ t }: { t: string }) {
  return (
    <>
      <header className="flex items-center justify-between"><div className="text-lg font-extrabold text-[var(--purple)]">Compaz</div><div className="text-base text-[var(--text-mid)]">Hola, Carolina</div></header>
      <h1 className="mt-5 text-2xl font-extrabold">{t}</h1>
    </>
  )
}

function QuienEstara() {
  const TIPOS = ['Familiar', 'Amigo o amiga', 'Vecino o vecina', 'Persona que cuida o ayuda', 'Otra persona']
  const [lista, setLista] = useState(['Familiar', 'Vecino o vecina'])
  const [avisado, setAvisado] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [enviado, setEnviado] = useState(false)
  const cambiar = (nueva: string[], texto: string) => { setLista(nueva); setAvisado(texto); setEnviado(false); setMsg('Hola María, te aviso que cambió quién estará en la visita. Cualquier duda me escribes por aquí.') }
  // Mismo criterio que el chat de la visita: nada de teléfonos ni correos.
  const hayContacto = /\d[\d\s.-]{6,}\d|@|whats|telegram/i.test(msg)
  return (
    <section className="mt-3 rounded-3xl border border-[var(--border-muted)] bg-white p-4">
      <h2 className="text-lg font-extrabold">Quién más estará en esa visita</h2>
      <p className="mt-1 text-sm text-[var(--text-mid)]">Además de tu mamá. Si cambias esta lista, le avisamos a María para que decida si sigue con la visita.</p>
      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Personas que estarán">
        {lista.map((q, i) => <li key={i}><button onClick={() => cambiar(lista.filter((_, k) => k !== i), `Quitaste a: ${q}. Le avisamos a María del cambio.`)} aria-label={`Quitar: ${q}`} className="min-h-10 rounded-full bg-[var(--purple)] px-3 text-sm font-bold text-white">{q} ✕</button></li>)}
        {lista.length === 0 && <li className="text-sm font-bold text-[var(--text-mid)]">Nadie más, solo tu mamá</li>}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {TIPOS.map((q) => <button key={q} onClick={() => cambiar([...lista, q], `Agregaste: ${q}. Le avisamos a María del cambio.`)} className="min-h-10 rounded-full border border-[var(--border-muted)] px-3 text-sm font-bold">+ {q}</button>)}
      </div>
      {avisado && <p role="status" className="mt-3 rounded-2xl bg-[#FEF3C7] p-3 text-sm font-bold text-[#92400E]">✓ {avisado} Si ella prefiere no ir, te ofrecemos otro horario u otro compita sin costo.</p>}
      {avisado && (
        <div className="mt-3 rounded-2xl bg-[var(--warm-gray)] p-3">
          <div className="text-sm font-bold">Para que lo vea más rápido, avísale también por el chat</div>
          {enviado ? <p className="mt-2 font-bold text-green-700">✓ Mensaje enviado por el chat de Compaz.</p> : (
            <>
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="Mensaje para María" className="mt-2 min-h-20 w-full rounded-xl border border-[var(--border-muted)] bg-white p-2 text-base" />
              {hayContacto && <p role="alert" className="mt-1 text-sm font-bold text-[#991B1B]">Por seguridad no se pueden compartir teléfonos ni correos. Compaz conecta todo dentro de la plataforma.</p>}
              <button disabled={!msg.trim() || hayContacto} onClick={() => setEnviado(true)} className="mt-2 min-h-12 w-full rounded-xl bg-[var(--orange)] font-extrabold text-white disabled:opacity-40">Enviar a María</button>
            </>
          )}
        </div>
      )}
    </section>
  )
}

// "Agendar otra visita": se abre el chat con el compita para ponerse de acuerdo. El recordatorio de no compartir
// contactos va SIEMPRE visible y, si lo intentan, el primer aviso lo dice y el segundo avisa al equipo.
const RECORDATORIO_CHAT = 'Recuerda: no se pueden compartir teléfonos, correos ni otros contactos directos. Es por seguridad y quien lo haga puede ser penalizado.'
function CoordinarVisita() {
  const [msgs, setMsgs] = useState<{ de: string; t: string }[]>([{ de: 'María', t: 'Hola Carolina, vi que quieres otra visita. ¿Qué día te queda bien?' }])
  const [txt, setTxt] = useState('')
  const [detecciones, setDetecciones] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const pausada = detecciones >= 2 // la segunda detección pausa la cuenta: ya no puede escribir
  const enviar = () => {
    if (!txt.trim() || pausada) return
    const contacto = /\d[\d\s.-]{6,}\d|@|whats|telegram/i.test(txt)
    if (contacto) {
      const n = detecciones + 1
      setDetecciones(n)
      setMsgs((m) => [...m, { de: 'Tú', t: '[contacto eliminado]' }])
      setAviso(n === 1
        ? 'Por seguridad no se pueden compartir contactos. Este es el primer aviso: si vuelve a pasar, avisaremos al equipo de Compaz y puedes ser penalizado.'
        : 'Ya habías recibido un aviso. Avisamos al equipo de Compaz y tu cuenta quedó en pausa. Compaz se comunicará contigo por correo.')
    } else {
      setMsgs((m) => [...m, { de: 'Tú', t: txt }])
      setAviso(null)
    }
    setTxt('')
  }
  return (
    <section className="mt-3 rounded-3xl border-2 border-[var(--purple)] bg-white p-4">
      <h2 className="text-lg font-extrabold">Ponte de acuerdo con María</h2>
      <p className="mt-1 text-sm text-[var(--text-mid)]">Abrimos este chat para que acuerden el día y la hora de la próxima visita.</p>
      <p role="note" className="mt-3 rounded-2xl border border-[#F5B800] bg-[#FFFBEB] p-3 text-sm font-bold text-[#92400E]">🛡️ {RECORDATORIO_CHAT}</p>
      <div className="mt-3 grid gap-2">
        {msgs.map((m, i) => <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-base ${m.de === 'Tú' ? 'justify-self-end bg-[var(--purple)] text-white' : 'bg-[var(--warm-gray)]'}`}>{m.t}</div>)}
      </div>
      {aviso && <p role="alert" className="mt-3 rounded-xl bg-[#FEF2F2] p-3 text-sm font-bold text-[#991B1B]">{aviso}</p>}
      {pausada ? (
        <Link href="/prototipo/cliente?estado=pausada" className="mt-3 flex min-h-12 items-center justify-center rounded-2xl bg-[#991B1B] font-extrabold text-white">Tu cuenta está en pausa: ver qué significa</Link>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') enviar() }} aria-label="Mensaje para María" placeholder="Escribe un mensaje" className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--border-muted)] px-3 text-base" />
            <button onClick={enviar} className="min-h-12 rounded-xl bg-[var(--orange)] px-4 font-extrabold text-white">Enviar</button>
          </div>
          <Link href="/prototipo/cliente?estado=agendar" className="mt-3 flex min-h-12 items-center justify-center rounded-2xl border-2 border-[var(--purple)] font-extrabold text-[var(--purple)]">Ya acordamos: elegir la fecha</Link>
        </>
      )}
    </section>
  )
}

// En qué momento está el cliente: decide qué muestran "Mis visitas" y "Mi plan" (un cliente nuevo no tiene historial).
const SIN_PAGO = ['enviada', 'enviada_recibida', 'directa_enviada', 'aceptada', 'horario_enviado', 'horario_rechazado', 'programada', 'ahora', 'decidir', 'motivo_no', 'directa_aceptada', 'pagar']
const PAGO_EN_REVISION = ['pago_revision', 'ficha_espera', 'pago_ficha_lista']
const RECURRENTE = ['fin', 'recurrente']
const momentoDe = (estado: string) => (SIN_PAGO.includes(estado) ? 'sin_pago' : PAGO_EN_REVISION.includes(estado) ? 'revision' : RECURRENTE.includes(estado) ? 'recurrente' : 'primera')

// Cómo ha estado el familiar a lo largo de las visitas: los mismos cuatro indicadores del reporte de cada visita, con la flecha respecto a la anterior.
const INDICADORES = [
  { n: 'Ánimo', e: '😊', v: [3, 4, 5] }, { n: 'Condición física', e: '💪', v: [3, 3, 4] },
  { n: 'Participación', e: '🤝', v: [3, 4, 5] }, { n: 'Ambiente y entorno', e: '🏠', v: [4, 4, 5] },
] as const
const ESCALA = ['', 'Muy bajo', 'Bajo', 'Regular', 'Bueno', 'Excelente']
function Tendencia() {
  return (
    <section className="mt-6 rounded-3xl border border-[var(--border-muted)] bg-white p-5">
      <h2 className="text-lg font-extrabold">Cómo ha estado tu mamá</h2>
      <p className="mt-1 text-sm text-[var(--text-mid)]">Lo que María anotó en sus últimas 3 visitas. La flecha compara con la visita anterior.</p>
      <ul className="mt-3 grid gap-3">
        {INDICADORES.map((i) => {
          const ahora = i.v[i.v.length - 1]; const antes = i.v[i.v.length - 2]
          return (
            <li key={i.n} className="flex items-center gap-3">
              <span aria-hidden className="text-2xl">{i.e}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{i.n}</div>
                <div className="mt-1 flex gap-1" aria-label={`Últimas visitas: ${i.v.join(', ')} de 5`}>{i.v.map((x, k) => <span key={k} className={`h-2 flex-1 rounded-full ${x >= 4 ? 'bg-green-600' : x === 3 ? 'bg-yellow-500' : 'bg-red-500'}`} />)}</div>
              </div>
              <div className="text-right"><div className="font-extrabold">{ESCALA[ahora]}</div><div className={`text-sm font-bold ${ahora > antes ? 'text-green-700' : ahora < antes ? 'text-red-700' : 'text-[var(--text-light)]'}`}>{ahora > antes ? '↑ mejor' : ahora < antes ? '↓ menos' : '→ igual'}</div></div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Visitas() {
  const estado = useParam('estado') ?? 'aceptada'
  const momento = momentoDe(estado)
  const pausada = estado === 'pausada'
  const [cambio, setCambio] = useState<'menu' | 'cancelar' | 'cancelada' | null>(null)
  const [coordinando, setCoordinando] = useState(false)
  const hist = [['mar 27 oct', 5], ['mar 20 oct', 5], ['mar 13 oct', 4]] as const
  if (momento === 'sin_pago' || momento === 'revision') {
    return (
      <>
        <Cabecera t="Mis visitas" />
        <section className="mt-4 rounded-3xl border border-dashed border-[var(--border-muted)] bg-white p-6 text-center">
          <div className="text-3xl" aria-hidden>📅</div>
          <h2 className="mt-2 text-xl font-extrabold">Aún no tienes visitas</h2>
          <p className="mt-1 text-base text-[var(--text-mid)]">{momento === 'revision' ? 'Apenas confirmemos tu pago podrás agendar tu primera visita.' : 'Cuando elijas a tu compita y confirmemos tu pago, podrás agendar tu primera visita aquí.'}</p>
          <Link href={`/prototipo/cliente?estado=${estado}`} className="mt-4 flex min-h-12 items-center justify-center rounded-2xl border-2 border-[var(--purple)] font-extrabold text-[var(--purple)]">Volver al inicio</Link>
        </section>
      </>
    )
  }
  const pendiente = estado === 'cita_pendiente'
  return (
    <>
      <Cabecera t="Mis visitas" />
      <section className="mt-4 rounded-3xl border-2 border-[var(--orange)] bg-white p-5">
        <div className="text-sm font-bold uppercase tracking-wider text-[var(--text-light)]">{estado === 'fin' ? 'Última visita' : 'Próxima visita'}</div>
        <div className="mt-1 text-xl font-extrabold">{estado === 'fin' ? 'Hoy, 9:00 am' : 'Jueves 5 nov, 9:00 am'}</div>
        <div className="text-base text-[var(--text-mid)]">María Pérez · Chacao · 1 hora · 10:00 am en Caracas</div>
        {pendiente && <div className="mt-2 inline-block rounded-full bg-[var(--yellow)] px-3 py-1 text-sm font-bold">Esperando que María confirme</div>}
        {estado === 'fin' ? null : cambio === 'cancelada' ? (
          <div role="status" className="mt-3 rounded-2xl bg-[var(--warm-gray)] p-3 font-bold">✓ Visita cancelada. Como faltaba más de 24 horas, no se cuenta como usada. Le avisamos a María.</div>
        ) : cambio === 'cancelar' ? (
          <div className="mt-3 grid gap-2">
            <p className="rounded-2xl bg-[#FEF3C7] p-3 text-sm font-bold text-[#92400E]">Faltan más de 24 horas: cancelar es gratis y no se cuenta como usada. Con menos tiempo, la visita se contaría como usada.</p>
            <button onClick={() => setCambio('cancelada')} className="min-h-12 rounded-2xl bg-[#991B1B] font-extrabold text-white">Sí, cancelar la visita</button>
            <button onClick={() => setCambio(null)} className="min-h-12 rounded-2xl border border-[var(--border-muted)] font-bold">No, mantenerla</button>
          </div>
        ) : cambio === 'menu' ? (
          <div className="mt-3 grid gap-2">
            <Link href="/prototipo/cliente?estado=agendar" className="flex min-h-12 items-center justify-center rounded-2xl border-2 border-[var(--purple)] font-extrabold text-[var(--purple)]">Cambiar la fecha</Link>
            <button onClick={() => setCambio('cancelar')} className="min-h-12 rounded-2xl border-2 border-[#991B1B] font-extrabold text-[#991B1B]">Cancelar la visita</button>
            <button onClick={() => setCambio(null)} className="min-h-12 font-bold text-[var(--text-mid)]">Volver</button>
          </div>
        ) : (
          <>
            <button onClick={() => setCambio('menu')} className="mt-3 min-h-12 w-full rounded-2xl border-2 border-[var(--purple)] bg-white text-base font-extrabold text-[var(--purple)]">Cambiar o cancelar</button>
            <p className="mt-2 text-sm text-[var(--text-mid)]">Gratis hasta 24 horas antes. Con menos tiempo, la visita se cuenta como usada. Si es María quien cancela, la reprogramamos sin costo para ti.</p>
          </>
        )}
      </section>
      {estado !== 'fin' && cambio !== 'cancelada' && <QuienEstara />}
      {pausada ? (
        <p role="note" className="mt-3 rounded-2xl bg-[#FEF2F2] p-4 font-bold text-[#991B1B]">Tu cuenta está en pausa: por ahora no puedes agendar otra visita ni escribir en el chat. Compaz se comunicará contigo por correo.</p>
      ) : coordinando ? <CoordinarVisita /> : (
        <button onClick={() => setCoordinando(true)} className="mt-3 min-h-14 w-full rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white">Agendar otra visita</button>
      )}
      {momento === 'recurrente' && (
        <>
          <h2 className="mt-6 text-lg font-extrabold">Visitas anteriores</h2>
          <ul className="mt-2 divide-y divide-[var(--border-muted)] overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-white">
            {hist.map(([f, r]) => (
              <li key={f} className="flex min-h-16 items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1"><div className="font-bold">{f}</div><div className="text-sm text-[var(--text-mid)]">María · Reporte de bienestar disponible</div></div>
                <div className="text-[var(--orange)]">{'★'.repeat(r)}</div>
              </li>
            ))}
          </ul>
          <Tendencia />
        </>
      )}
    </>
  )
}

function Familiar() {
  const [ok, setOk] = useState(false)
  const campo = 'mt-1 min-h-14 w-full rounded-2xl border border-[var(--border-muted)] px-4 text-lg'
  return (
    <>
      <Cabecera t="Mi familiar" />
      <p className="mt-1 text-lg text-[var(--text-mid)]">Esto le ayuda a María a conocer a tu mamá antes de visitarla. Solo lo ve tu compita.</p>
      <div className="mt-4 grid gap-4 rounded-3xl border border-[var(--border-muted)] bg-white p-5">
        <label className="text-base font-bold">Nombre<input defaultValue="Elena" onChange={() => setOk(false)} className={campo} /></label>
        <label className="text-base font-bold">Edad<input defaultValue="82" inputMode="numeric" onChange={() => setOk(false)} className={campo} /></label>
        <label className="text-base font-bold">Condición de salud<input defaultValue="Hipertensión, usa bastón" onChange={() => setOk(false)} className={campo} /></label>
        <label className="text-base font-bold">Qué le gusta o qué debemos saber<textarea defaultValue="Le encanta el jardín y las novelas. Se pone ansiosa si no desayuna temprano." onChange={() => setOk(false)} className={`${campo} min-h-28 py-3`} /></label>
        <button onClick={() => setOk(true)} className="min-h-14 rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white">Guardar</button>
        {ok && <div className="font-bold text-green-700">✓ Guardado</div>}
      </div>
    </>
  )
}

function Plan() {
  const estado = useParam('estado') ?? 'aceptada'
  const momento = momentoDe(estado)
  // Un cliente nuevo no tiene plan ni pagos todavía; solo aparecen cuando confirmamos su pago.
  const pagos = momento === 'recurrente' ? [['hoy', '$75', 'Compañía'], ['7 oct', '$22', 'A la carta']] : momento === 'primera' ? [['hoy', '$75', 'Compañía']] : []
  const visitasQuedan = momento === 'recurrente' ? '1 de 2' : '2 de 2'
  return (
    <>
      <Cabecera t="Mi plan" />
      {momento === 'sin_pago' || momento === 'revision' ? (
        <section className="mt-4 rounded-3xl border border-dashed border-[var(--border-muted)] bg-white p-6 text-center">
          <h2 className="text-xl font-extrabold">{momento === 'revision' ? 'Estamos confirmando tu pago' : 'Todavía no tienes un plan'}</h2>
          <p className="mt-1 text-base text-[var(--text-mid)]">{momento === 'revision' ? 'Tu plan aparecerá aquí apenas lo confirmemos.' : 'Tu plan aparece aquí cuando elijas a tu compita y confirmemos tu pago.'}</p>
        </section>
      ) : (
        <>
          <section className="mt-4 rounded-3xl border-2 border-[var(--orange)] bg-white p-5">
            <div className="text-sm font-bold uppercase tracking-wider text-[var(--text-light)]">Plan actual</div>
            <div className="mt-1 text-2xl font-extrabold">Compañía</div>
            <div className="mt-2 text-lg text-[var(--text-mid)]">Te quedan <b>{visitasQuedan} visitas</b> este ciclo.</div>
            <div className="text-base text-[var(--text-light)]">Se renueva el 18 de noviembre.</div>
            <Link href="/prototipo/cliente?estado=pagar" className="mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-[var(--purple)] bg-white text-lg font-extrabold text-[var(--purple)]">Cambiar o renovar plan</Link>
          </section>
          <h2 className="mt-6 text-lg font-extrabold">Mis pagos</h2>
          <p className="mt-1 text-sm text-[var(--text-mid)]">Compaz nunca te pedirá un pago por teléfono o mensaje. Si ves un cobro que no reconoces, avísanos.</p>
          <ul className="mt-2 divide-y divide-[var(--border-muted)] overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-white">
            {pagos.map(([f, m, pl]) => <li key={f} className="flex min-h-14 items-center justify-between px-4"><span className="font-bold">{f} · {pl}</span><b>{m}</b></li>)}
          </ul>
        </>
      )}
      <CuentaEliminar momento={momento} visitasQuedan={visitasQuedan} />
      <Link href="/prototipo/cliente/entrar" className="mt-6 flex min-h-12 w-full items-center justify-center rounded-2xl border border-[var(--border-muted)] bg-white text-base font-bold text-[var(--text-mid)]">Cerrar sesión</Link>
    </>
  )
}

function Otras({ sec }: { sec: string }) {
  return sec === 'visitas' ? <Visitas /> : sec === 'familiar' ? <Familiar /> : <Plan />
}

function Inner() {
  const embebido = useEmbedded()
  const [id, setId] = useUrlState('estado', 'aceptada')
  const [respuesta, setRespuesta] = useState<string | null>(null)
  const [sec, setSec] = useUrlState('sec', 'inicio')
  const e = ESTADOS.find((x) => x.id === id) ?? ESTADOS[1]

  const cambiar = (nuevo: string) => {
    setRespuesta(null)
    setId(nuevo)
  }

  return (
    <main className={`mx-auto max-w-xl px-4 pt-4 ${embebido ? 'flex min-h-full flex-col pb-0' : 'pb-28'}`}>
      {sec !== 'inicio' ? <Otras sec={sec} /> : (<>
      {!embebido && <div className="rounded-xl border border-dashed border-[var(--border-muted)] bg-white p-3">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-light)]">Simular estado del cliente</label>
        <select value={e.id} onChange={(ev) => cambiar(ev.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border-muted)] bg-white p-2 text-base">
          {ESTADOS.map((s) => <option key={s.id} value={s.id}>{s.etiqueta}</option>)}
        </select>
      </div>}

      <header className="mt-6 flex items-center justify-between">
        <div className="text-lg font-extrabold text-[var(--purple)]">Compaz</div>
        <div className="text-base text-[var(--text-mid)]">Hola, Carolina</div>
      </header>

      <ol className="mt-5 flex items-start" aria-label="Tu progreso">
        {PASOS.map((p, i) => {
          const hecho = i < e.paso
          const actual = i === e.paso
          return (
            <li key={p} className="flex flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <div className={`h-1 flex-1 ${i === 0 ? 'opacity-0' : hecho || actual ? 'bg-[var(--orange)]' : 'bg-[var(--border-muted)]'}`} />
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold ${hecho ? 'bg-[var(--orange)] text-white' : actual ? 'bg-[var(--purple)] text-white ring-4 ring-[var(--yellow)]' : 'bg-[var(--border-muted)] text-[var(--text-light)]'}`}>
                  {hecho ? '✓' : i + 1}
                </div>
                <div className={`h-1 flex-1 ${i === PASOS.length - 1 ? 'opacity-0' : hecho ? 'bg-[var(--orange)]' : 'bg-[var(--border-muted)]'}`} />
              </div>
              <span className={`mt-1 text-xs ${actual ? 'font-extrabold text-[var(--purple)]' : 'text-[var(--text-light)]'}`}>{p}</span>
            </li>
          )
        })}
      </ol>

      <section className="mt-6 rounded-3xl border-2 border-[var(--orange)] bg-white p-6 shadow-md">
        <div className="flex items-center gap-4">
          <Avatar nombre="María" />
          <div className="text-base text-[var(--text-mid)]">Tu compita<br /><b className="text-lg text-[var(--text-dark)]">{e.paso >= 4 ? 'María Pérez' : 'María P.'}</b></div>
        </div>
        <h1 className="mt-5 text-2xl font-extrabold leading-tight">{e.titulo}</h1>
        <p className="mt-2 text-lg leading-relaxed text-[var(--text-mid)]">{e.texto}</p>

        {(e.id === 'pagar' || e.id === 'directa_aceptada') && (
          <div className="mt-4 rounded-2xl bg-[var(--warm-gray)] p-4 text-base">
            <div>Zelle: <b>pagos@micompaz.com</b></div>
            <div className="mt-1">Referencia: <b className="tracking-wider">COMPAZ-4F7K2Q</b></div>
            <div className="mt-1">Monto: <b>$75</b> · plan Compañía</div>
            <p className="mt-3 text-sm font-bold text-[#991B1B]">Estos son los únicos datos de pago de Compaz. Nunca te los pediremos por teléfono ni por mensaje, y nunca te pediremos otro depósito o transferencia.</p>
          </div>
        )}

        {e.sinBoton ? null : respuesta ? (
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl bg-[var(--warm-gray)] p-4 text-lg font-bold">✓ {respuesta}</div>
            {e.secundario && e.secHref && <Link href={e.secHref} className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-[var(--purple)] bg-white px-5 text-lg font-extrabold text-[var(--purple)]">{e.secundario}</Link>}
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {e.href ? (
              <Link href={e.href} className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-[var(--purple)] bg-white px-5 text-lg font-extrabold text-[var(--purple)]">{e.boton}</Link>
            ) : (
              <button onClick={() => setRespuesta(e.respuesta ?? 'Listo, lo registramos.')} className={`min-h-14 rounded-2xl px-5 text-lg font-extrabold ${e.tono === 'espera' ? 'border-2 border-[var(--purple)] bg-white text-[var(--purple)]' : 'bg-[var(--orange)] text-white active:bg-[var(--orange-dark)]'}`}>
                {e.boton}
              </button>
            )}
            {e.secundario && e.secHref && (
              <Link href={e.secHref} className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-[var(--border-muted)] bg-white px-5 text-lg font-bold text-[var(--text-mid)]">{e.secundario}</Link>
            )}
            {e.secundario && !e.secHref && (
              <button onClick={() => setRespuesta(e.secRespuesta ?? 'Entendido, te mostramos otros compitas sin costo.')} className="min-h-14 rounded-2xl border-2 border-[var(--border-muted)] bg-white px-5 text-lg font-bold text-[var(--text-mid)]">
                {e.secundario}
              </button>
            )}
          </div>
        )}
      </section>

      {e.extra === 'horarios' && <Horarios otra={false} />}
      {e.extra === 'horarios_otra' && <Horarios otra />}
      {e.extra === 'chat' && <><Novedades /><ChatMock /></>}
      {e.extra === 'reporte' && <Reporte />}
      {e.extra === 'ayuda' && <Ayuda />}
      {e.extra === 'ficha' && (e.id === 'ficha_espera' ? <FichaForm siguiente="/prototipo/cliente?estado=pago_ficha_lista" etiqueta="Guardar la ficha" /> : <FichaForm siguiente="/prototipo/cliente?estado=agendar" etiqueta="Guardar y agendar" />)}
      {e.extra === 'motivo' && <MotivoNo />}
      {e.extra === 'cita' && <CitaForm />}
      {e.extra === 'llegada' && <Llegada />}
      {e.extra === 'nadie' && <Nadie />}
      {e.extra === 'video' && <Video />}
      </>)}

      <AvisoSeguridad />

      {embebido && <div className="min-h-6 flex-1" />}
      <nav className={`${embebido ? 'sticky -mx-4' : 'fixed inset-x-0'} bottom-0 z-30 grid grid-cols-4 border-t border-[var(--border-muted)] bg-white`} aria-label="Secciones del portal">
        {[['inicio', '🏠', 'Inicio'], ['visitas', '📅', 'Visitas'], ['familiar', '👵', 'Mi familiar'], ['plan', '💳', 'Mi plan']].map(([id, i, t]) => (
          <button key={id} onClick={() => setSec(id)} aria-current={sec === id ? 'page' : undefined} className={`flex min-h-16 flex-col items-center justify-center text-xs font-bold ${sec === id ? 'text-[var(--orange-dark)]' : 'text-[var(--text-mid)]'}`}>
            <span className="text-2xl">{i}</span>{t}
          </button>
        ))}
      </nav>
    </main>
  )
}

export default function Page() {
  return <Suspense><Inner /></Suspense>
}
