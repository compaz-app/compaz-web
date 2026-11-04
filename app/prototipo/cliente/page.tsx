'use client'
import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useUrlState } from '../useUrlState'

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
  extra?: 'chat' | 'reporte' | 'ficha' | 'cita' | 'llegada' | 'ayuda' | 'video' | 'nadie'
  sinBoton?: boolean
}

// Antes de pagar el cliente ve "María P."; el nombre completo llega con el pago (decisión del punto 2).
const ESTADOS: Estado[] = [
  { id: 'enviada', etiqueta: '1. Solicitud enviada (hablar primero)', paso: 0, titulo: 'Esperando a María P.', texto: 'Le avisamos que quieres conocerla. Te escribimos apenas responda, normalmente en pocas horas.', boton: 'Ver otros compitas', href: '/prototipo/cliente/elegir', tono: 'espera' },
  { id: 'directa_enviada', etiqueta: '1b. Solicitud enviada (contratar directo)', paso: 0, titulo: 'Esperando que María P. acepte', texto: 'Aún no pagas nada. Si María acepta, pasas al pago. Si no puede, eliges a otro compita sin haber pagado.', boton: 'Ver otros compitas', href: '/prototipo/cliente/elegir', tono: 'espera' },
  { id: 'aceptada', etiqueta: '2. Aceptó, elegir horario', paso: 1, titulo: 'María P. aceptó. Elige tu horario', texto: 'La entrevista dura 20 minutos, por video o solo con voz. Escoge entre los horarios que María tiene libres.', boton: 'Elegir horario' },
  { id: 'programada', etiqueta: '3. Entrevista programada', paso: 1, titulo: 'Entrevista mañana a las 4:00 pm', texto: 'Tu hora (Miami). En Caracas son las 4:00 pm. Te mandamos un recordatorio una hora antes, con el botón para entrar.', boton: 'Cambiar horario', tono: 'espera' },
  { id: 'ahora', etiqueta: '4. Entrevista ahora', paso: 1, titulo: 'Tu entrevista con María P. es ahora', texto: 'Ya puedes entrar. Si se corta la conexión, vuelve a pulsar el mismo botón y sigues donde estabas.', boton: 'Entrar a la entrevista' },
  { id: 'decidir', etiqueta: '5. Decidir', paso: 2, titulo: '¿Contratas a María P.?', texto: 'Si dices que sí, pasamos al pago. Si dices que no, te mostramos otros compitas sin costo.', boton: 'Sí, quiero contratarla', secundario: 'No, ver otras', secHref: '/prototipo/cliente/elegir' },
  { id: 'directa_aceptada', etiqueta: '5b. Aceptó la contratación directa', paso: 3, titulo: 'María P. aceptó. Un último paso: el pago', texto: 'Envía el pago y escribe esta referencia. Cuando lo confirmemos, completas la ficha de tu familiar y agendas.', boton: 'Ya hice el pago' },
  { id: 'pagar', etiqueta: '6. Pagar', paso: 3, titulo: 'Un último paso: el pago', texto: 'Envía el pago y escribe esta referencia. Cuando lo confirmemos, completas la ficha de tu familiar y agendas.', boton: 'Ya hice el pago' },
  { id: 'pago_revision', etiqueta: '7. Pago en revisión', paso: 3, titulo: 'Estamos confirmando tu pago', texto: 'Tarda unas horas. No tienes que quedarte esperando: aquí verás cuando esté confirmado. Mientras tanto ya puedes completar la ficha de tu familiar.', boton: 'Completar la ficha ahora', href: '/prototipo/cliente?estado=ficha', tono: 'espera', extra: 'ayuda' },
  { id: 'ficha', etiqueta: '8. Ficha del familiar (obligatoria)', paso: 4, titulo: 'Pago confirmado. Cuéntanos de tu familiar', texto: 'Es lo único que falta para agendar tu primera visita. Solo lo ve tu compita, y la dirección exacta solo se le entrega 3 horas antes.', boton: 'Guardar y agendar', href: '/prototipo/cliente?estado=agendar', extra: 'ficha' },
  { id: 'agendar', etiqueta: '9. Agendar la primera visita', paso: 4, titulo: 'Elige cuándo visita María Pérez', texto: 'Estos son los horarios que ella tiene libres. María debe confirmar tu elección.', boton: 'Pedir esta cita', href: '/prototipo/cliente?estado=cita_pendiente', extra: 'cita' },
  { id: 'cita_pendiente', etiqueta: '10. Esperando que el compita confirme', paso: 5, titulo: 'Esperando que María confirme tu cita', texto: 'Jueves 5 nov, 10:00 am. Si no puede, te avisamos y te ofrecemos otros horarios, sin costo.', boton: 'Ver mis visitas', href: '/prototipo/cliente?sec=visitas', tono: 'espera' },
  { id: 'activo', etiqueta: '11. Visitas activas', paso: 5, titulo: 'Próxima visita: jueves 10:00 am', texto: 'María Pérez visitará a tu mamá en Chacao. Puedes cambiarla gratis hasta 24 horas antes. Te avisamos cuando llegue y cuando termine.', boton: 'Ver mis visitas', href: '/prototipo/cliente?sec=visitas', tono: 'espera', extra: 'video' },
  { id: 'llego', etiqueta: '12. El compita llegó (con foto)', paso: 5, titulo: '¡María llegó a casa de tu mamá!', texto: 'Esta es la foto que mandó al llegar. Confirma que puede empezar la visita. Si no respondes, se confirma sola en 5 minutos.', boton: 'Confirmar y empezar', extra: 'llegada' },
  { id: 'nadie_abre', etiqueta: '13. Llegó y nadie abre', paso: 5, titulo: 'María llegó y no le abren', texto: 'Está en la puerta esperando. Avísale a quien pueda abrir. Si en 30 minutos nadie aparece, la visita se cuenta como usada.', boton: 'Ya van a abrir', respuesta: 'Gracias. Le avisamos a María que esperen la puerta.', secundario: 'Hablar con Compaz', secRespuesta: 'Avisamos al equipo con urgencia. Te escriben ahora mismo.', extra: 'nadie' },
  { id: 'curso', etiqueta: '14. Visita en curso', paso: 5, titulo: 'María está con tu mamá', texto: 'Aquí verás las fotos y notas que María envíe durante la visita. También puedes escribirle.', boton: '', sinBoton: true, extra: 'chat' },
  { id: 'interrumpida', etiqueta: '15. Visita interrumpida (seguridad)', paso: 5, titulo: 'La visita se interrumpió', texto: 'María tuvo que retirarse antes de tiempo. No tienes que hacer nada: el equipo de Compaz te escribe hoy para organizar otra visita.', boton: 'Hablar con Compaz', respuesta: 'Avisamos al equipo. Te escriben hoy para organizar otra visita.', tono: 'espera' },
  { id: 'fin', etiqueta: '16. Visita terminada', paso: 5, titulo: 'La visita terminó. ¿Cómo te fue?', texto: 'Tu calificación ayuda a otras familias y a mejorar el servicio. Aquí tienes el reporte de María.', boton: 'Enviar calificación', extra: 'reporte' },
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
      <div className="mt-3 flex gap-2">
        <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') enviar() }} placeholder="Escribe un mensaje" className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--border-muted)] px-3 text-base" />
        <button onClick={enviar} className="min-h-12 rounded-xl bg-[var(--orange)] px-4 font-extrabold text-white">Enviar</button>
      </div>
    </section>
  )
}

function Reporte() {
  const [estrellas, setEstrellas] = useState(0)
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
        <textarea placeholder="Comentario opcional (se publica en el perfil solo si el equipo lo aprueba)" className="mt-3 min-h-20 w-full rounded-xl border border-[var(--border-muted)] p-3 text-base" />
      </section>
    </>
  )
}

function Ayuda() {
  const [r, setR] = useState<string | null>(null)
  return (
    <section className="mt-5 rounded-3xl border border-[var(--border-muted)] bg-white p-4">
      <h2 className="text-lg font-extrabold">¿No te llega el correo?</h2>
      <p className="mt-1 text-base text-[var(--text-mid)]">No dependes de él: esta pantalla siempre muestra tu estado real.</p>
      {r ? <p className="mt-3 rounded-xl bg-[var(--warm-gray)] p-3 font-bold">✓ {r}</p> : (
        <div className="mt-3 grid gap-2">
          <button onClick={() => setR('Te reenviamos la confirmación. Revisa también la carpeta de spam.')} className="min-h-12 rounded-xl border-2 border-[var(--purple)] font-extrabold text-[var(--purple)]">Reenviar la confirmación</button>
          <button onClick={() => setR('Avisamos al equipo de Compaz con urgencia. Te responden por el teléfono que dejaste.')} className="min-h-12 rounded-xl bg-[var(--orange)] font-extrabold text-white">Contactar a Compaz</button>
        </div>
      )}
    </section>
  )
}

function FichaForm() {
  const campo = 'mt-1 min-h-14 w-full rounded-2xl border border-[var(--border-muted)] px-4 text-lg'
  const [ok, setOk] = useState(false)
  const [privado, setPrivado] = useState(true)
  return (
    <section className="mt-5 grid gap-4 rounded-3xl border border-[var(--border-muted)] bg-white p-5">
      <h2 className="text-lg font-extrabold">Ficha de tu familiar</h2>
      <p className="-mt-2 text-sm text-[var(--text-mid)]">Una sola vez. Lo que ya pusiste antes no se repite. No pedimos medicinas ni historial médico. Si prefieres, el equipo la llena contigo por teléfono.</p>
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
        <label className="text-base font-bold">¿Quién más estará en casa?<input defaultValue="Rosa, una vecina que ayuda" className={campo} /></label>
      </>}
      <button className="min-h-14 rounded-2xl border-2 border-dashed border-[var(--border-muted)] text-base font-bold text-[var(--text-mid)]">📷 Foto de tu familiar (opcional)</button>
      <label className="flex items-start gap-3 text-base"><input type="checkbox" onChange={(e) => setOk(e.target.checked)} className="mt-1 h-6 w-6 shrink-0" /><span>Acepto que Compaz guarde estos datos y se los entregue solo al compita que me visita. Las fotos se borran a los 90 días de cerrada la visita. No contactaré al compita fuera de Compaz, y una visita en la que nadie abre se cuenta como usada. <Link href="/prototipo/cliente?sec=plan" className="font-bold underline">Leer los términos</Link></span></label>
      <p className={`text-sm ${ok ? 'font-bold text-green-700' : 'text-[var(--text-light)]'}`}>{ok ? '✓ Listo para guardar' : 'Para continuar tienes que aceptar.'}</p>
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

function Cabecera({ t }: { t: string }) {
  return (
    <>
      <header className="flex items-center justify-between"><div className="text-lg font-extrabold text-[var(--purple)]">Compaz</div><div className="text-base text-[var(--text-mid)]">Hola, Carolina</div></header>
      <h1 className="mt-5 text-2xl font-extrabold">{t}</h1>
    </>
  )
}

function Visitas() {
  const [rea, setRea] = useState(false)
  const hist = [['mar 27 oct', 5], ['mar 20 oct', 5], ['mar 13 oct', 4]] as const
  return (
    <>
      <Cabecera t="Mis visitas" />
      <section className="mt-4 rounded-3xl border-2 border-[var(--orange)] bg-white p-5">
        <div className="text-sm font-bold uppercase tracking-wider text-[var(--text-light)]">Próxima visita</div>
        <div className="mt-1 text-xl font-extrabold">Jueves 5 nov, 10:00 am</div>
        <div className="text-base text-[var(--text-mid)]">María Pérez · Chacao · 1 hora</div>
        {rea ? <div className="mt-3 rounded-2xl bg-[var(--warm-gray)] p-3 font-bold">✓ Pedimos el cambio. Te avisamos cuando María confirme.</div> : (
          <>
          <button onClick={() => setRea(true)} className="mt-3 min-h-12 w-full rounded-2xl border-2 border-[var(--purple)] bg-white text-base font-extrabold text-[var(--purple)]">Cambiar o cancelar</button>
          <p className="mt-2 text-sm text-[var(--text-mid)]">Gratis hasta 24 horas antes. Con menos tiempo, la visita se cuenta como usada. Si es María quien cancela, la reprogramamos sin costo para ti.</p>
        </>
        )}
      </section>
      <button className="mt-3 min-h-14 w-full rounded-2xl bg-[var(--orange)] text-lg font-extrabold text-white">Agendar otra visita</button>
      <h2 className="mt-6 text-lg font-extrabold">Visitas anteriores</h2>
      <ul className="mt-2 divide-y divide-[var(--border-muted)] overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-white">
        {hist.map(([f, r]) => (
          <li key={f} className="flex min-h-16 items-center gap-3 px-4 py-2">
            <div className="min-w-0 flex-1"><div className="font-bold">{f}</div><div className="text-sm text-[var(--text-mid)]">María · Reporte de bienestar disponible</div></div>
            <div className="text-[var(--orange)]">{'★'.repeat(r)}</div>
          </li>
        ))}
      </ul>
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
  const pagos = [['hoy', '$75', 'Compañía'], ['21 oct', '$75', 'Compañía'], ['7 oct', '$22', 'A la carta']]
  return (
    <>
      <Cabecera t="Mi plan" />
      <section className="mt-4 rounded-3xl border-2 border-[var(--orange)] bg-white p-5">
        <div className="text-sm font-bold uppercase tracking-wider text-[var(--text-light)]">Plan actual</div>
        <div className="mt-1 text-2xl font-extrabold">Compañía</div>
        <div className="mt-2 text-lg text-[var(--text-mid)]">Te quedan <b>2 de 2 visitas</b> este ciclo.</div>
        <div className="text-base text-[var(--text-light)]">Se renueva el 18 de noviembre.</div>
        <button className="mt-4 min-h-14 w-full rounded-2xl border-2 border-[var(--purple)] bg-white text-lg font-extrabold text-[var(--purple)]">Cambiar o renovar plan</button>
      </section>
      <h2 className="mt-6 text-lg font-extrabold">Mis pagos</h2>
      <ul className="mt-2 divide-y divide-[var(--border-muted)] overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-white">
        {pagos.map(([f, m, p]) => <li key={f} className="flex min-h-14 items-center justify-between px-4"><span className="font-bold">{f} · {p}</span><b>{m}</b></li>)}
      </ul>
      <button className="mt-6 min-h-12 w-full rounded-2xl border border-[var(--border-muted)] bg-white text-base font-bold text-[var(--text-mid)]">Cerrar sesión</button>
    </>
  )
}

function Otras({ sec }: { sec: string }) {
  return sec === 'visitas' ? <Visitas /> : sec === 'familiar' ? <Familiar /> : <Plan />
}

function Inner() {
  const [id, setId] = useUrlState('estado', 'aceptada')
  const [respuesta, setRespuesta] = useState<string | null>(null)
  const [sec, setSec] = useUrlState('sec', 'inicio')
  const e = ESTADOS.find((x) => x.id === id) ?? ESTADOS[1]

  const cambiar = (nuevo: string) => {
    setRespuesta(null)
    setId(nuevo)
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-28 pt-4">
      {sec !== 'inicio' ? <Otras sec={sec} /> : (<>
      <div className="rounded-xl border border-dashed border-[var(--border-muted)] bg-white p-3">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-light)]">Simular estado del cliente</label>
        <select value={e.id} onChange={(ev) => cambiar(ev.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border-muted)] bg-white p-2 text-base">
          {ESTADOS.map((s) => <option key={s.id} value={s.id}>{s.etiqueta}</option>)}
        </select>
      </div>

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
          </div>
        )}

        {e.sinBoton ? null : respuesta ? (
          <div className="mt-5 rounded-2xl bg-[var(--warm-gray)] p-4 text-lg font-bold">✓ {respuesta}</div>
        ) : (
          <div className="mt-5 grid gap-3">
            {e.href ? (
              <Link href={e.href} className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-[var(--purple)] bg-white px-5 text-lg font-extrabold text-[var(--purple)]">{e.boton}</Link>
            ) : (
              <button onClick={() => setRespuesta(e.respuesta ?? 'Listo, lo registramos. En el sistema real esto avanzaría al siguiente paso.')} className={`min-h-14 rounded-2xl px-5 text-lg font-extrabold ${e.tono === 'espera' ? 'border-2 border-[var(--purple)] bg-white text-[var(--purple)]' : 'bg-[var(--orange)] text-white active:bg-[var(--orange-dark)]'}`}>
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

      {e.extra === 'chat' && <><Novedades /><ChatMock /></>}
      {e.extra === 'reporte' && <Reporte />}
      {e.extra === 'ayuda' && <Ayuda />}
      {e.extra === 'ficha' && <FichaForm />}
      {e.extra === 'cita' && <CitaForm />}
      {e.extra === 'llegada' && <Llegada />}
      {e.extra === 'nadie' && <Nadie />}
      {e.extra === 'video' && <Video />}
      </>)}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[var(--border-muted)] bg-white" aria-label="Secciones del portal">
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
