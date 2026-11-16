'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import Boton from '@/components/ui/base/Boton'
import Tarjeta from '@/components/ui/base/Tarjeta'
import Aviso from '@/components/ui/base/Aviso'
import Pasos from '@/components/ui/base/Pasos'
import InfoBoton from '@/components/ui/InfoBoton'
import { useEmbedded, useUrlState } from '../useUrlState'

// PROTOTIPO del portal del cliente con UNA sola lógica y el ciclo completo de una visita (y el arranque de la siguiente):
//  1. «Tu siguiente paso» arriba en todas las pestañas, con lo que viene después.
//  2. En Visitas, un recorrido donde cada paso está hecho, ahora o después (lo que no toca está apagado y dice cuándo se activa).
//  3. El chat con el compita SIEMPRE visible y activo (no se pliega).
//  4. Iconos y círculos rojos con número, como en el panel del equipo: cada pestaña, los mensajes y los avisos.
// Datos falsos; el estado vive en la dirección (?momento= y ?tab=) para que un refresh conserve la pantalla.

const MOMENTOS = ['direccion', 'fecha', 'esperando', 'confirmada', 'llego', 'curso', 'terminada', 'siguiente', 'cita2'] as const
type Momento = (typeof MOMENTOS)[number]
const ETIQUETA_MOMENTO: Record<Momento, string> = {
  direccion: '1. Falta la dirección', fecha: '2. Dirección lista, elegir fecha', esperando: '3. Fecha pedida, esperando a María',
  confirmada: '4. Cita confirmada', llego: '5. María llegó a la casa', curso: '6. Visita en curso', terminada: '7. Visita terminada, calificar',
  siguiente: '8. Agendar la próxima visita', cita2: '9. Próxima visita confirmada',
}
const PASOS_GENERALES = ['Elegir', 'Entrevista', 'Decidir', 'Pagar', 'Ficha', 'Visitas']

const PASOS_VISITA = [
  { id: 'direccion', titulo: 'Dirección y contacto en el sitio' },
  { id: 'fecha', titulo: 'Día y hora' },
  { id: 'confirma', titulo: 'María confirma' },
  { id: 'dia', titulo: 'El día de la visita' },
  { id: 'resena', titulo: 'Cómo te fue' },
] as const
// En qué paso del recorrido está cada momento. La segunda visita (siguiente, cita2) reutiliza la dirección: arranca en «Día y hora».
const AHORA: Record<Momento, number> = { direccion: 0, fecha: 1, esperando: 2, confirmada: 3, llego: 3, curso: 3, terminada: 4, siguiente: 1, cita2: 3 }
const ES_SEGUNDA = (m: Momento) => m === 'siguiente' || m === 'cita2'

type Siguiente = { etiqueta?: string; titulo: string; texto: string; luego: string | null; boton: string; infoBoton: string; secundario?: { texto: string; info: string }; espera?: boolean }
const SIGUIENTE: Record<Momento, Siguiente> = {
  direccion: { titulo: 'Registra la dirección de la visita', texto: 'Sin la dirección no se puede pedir la cita: María tiene que saber a dónde ir. Ella la recibe unas horas antes, por Telegram.', luego: 'Después: elegir el día y la hora.', boton: 'Registrar la dirección', infoBoton: 'Te lleva al formulario de la dirección, justo aquí abajo. Todavía no se envía nada a María.' },
  fecha: { titulo: 'Elige el día y la hora', texto: 'Estas son las horas que María tiene libres. Ella tiene que confirmar la que elijas, y si no puede, te avisamos para que elijas otra sin costo.', luego: 'Después: María confirma la hora.', boton: 'Elegir el día y la hora', infoBoton: 'Te lleva a las horas libres de María. Elegir una solo la pide: no queda agendada hasta que ella confirme.' },
  esperando: { titulo: 'Esperando que María confirme', texto: 'Pediste el jueves 5 de noviembre, 9:00 am (10:00 am en Caracas). María tiene hasta mañana para responder. No tienes que hacer nada: aquí verás cuando confirme.', luego: 'Después: te recordamos la visita un día antes.', boton: 'Cambiar la hora', infoBoton: 'Te muestra las demás horas libres de María para elegir otra. La hora actual se libera cuando elijas.', espera: true },
  confirmada: { titulo: 'Cita confirmada: jueves 5 de noviembre, 9:00 am', texto: 'Es tu hora de Miami; en Caracas son las 10:00 am. Te mandamos un recordatorio un día antes. María recibe la dirección 3 horas antes de llegar.', luego: 'Después: el día de la visita, María te avisa cuando llegue.', boton: 'Ver los datos de la visita', infoBoton: 'Te muestra la dirección y el contacto que registraste, por si quieres revisarlos o cambiarlos.', secundario: { texto: 'Cambiar la hora', info: 'Te deja elegir otra hora sin costo mientras falten más de 24 horas. Con menos aviso queda registrado.' }, espera: true },
  llego: { titulo: 'María llegó a casa de tu mamá', texto: 'Esta es la foto que mandó al llegar. Confirma que puede empezar la visita. Si no respondes, se confirma sola en 5 minutos.', luego: 'Después: durante la visita ves las fotos y notas que María envíe.', boton: 'Sí, puede empezar', infoBoton: 'Le confirma a María que la persona correcta le abrió la puerta y empieza la visita.', secundario: { texto: 'No es mi mamá ni su casa', info: 'Avisa al equipo de Compaz ahora mismo y detiene el inicio. Úsalo solo si la foto no corresponde.' } },
  curso: { etiqueta: 'Visita en curso', titulo: 'María está con tu mamá', texto: 'Aquí abajo ves las fotos y notas que María envía durante la visita. También puedes escribirle en el chat.', luego: 'Después: cuando termine, te pedimos tu calificación.', boton: 'Ver las fotos y notas', infoBoton: 'Te lleva a lo que María ha enviado durante la visita. No interrumpe la visita.', espera: true },
  terminada: { titulo: 'La visita terminó. ¿Cómo te fue?', texto: 'Tu calificación ayuda a otras familias y a mejorar el servicio. Abajo tienes el reporte de María.', luego: 'Después: puedes agendar la próxima visita. Te quedan 3 en tu plan.', boton: 'Calificar la visita', infoBoton: 'Te lleva a las estrellas para calificar la visita. Tu calificación no la ve María antes de que la envíes.' },
  siguiente: { titulo: 'Agenda tu próxima visita con María', texto: 'Ya conoces el proceso. Usamos la misma dirección de la visita anterior. Elige el día y la hora; María tiene que confirmarla.', luego: 'Después: María confirma la hora.', boton: 'Elegir el día y la hora', infoBoton: 'Te lleva a las horas libres de María. Elegir una solo la pide: no queda agendada hasta que ella confirme.' },
  cita2: { titulo: 'Próxima visita: jueves 12 de noviembre, 9:00 am', texto: 'Es tu hora de Miami; en Caracas son las 10:00 am. María ya confirmó. Te recordamos un día antes.', luego: 'Después: el día de la visita, María te avisa cuando llegue.', boton: 'Ver los datos de la visita', infoBoton: 'Te muestra la dirección y el contacto que usaremos, por si quieres cambiarlos.', secundario: { texto: 'Cambiar la hora', info: 'Te deja elegir otra hora sin costo mientras falten más de 24 horas.' }, espera: true },
}

// Lo que llega de FUERA (María, el equipo) y el cliente todavía no ha visto. Lo que el cliente hace él mismo no genera avisos.
const NOVEDADES: Partial<Record<Momento, string[]>> = {
  confirmada: ['María confirmó tu cita del jueves 5 de noviembre.'],
  llego: ['María llegó a casa de tu mamá. Confirma que puede empezar.'],
  curso: ['María empezó la visita. Ya puedes ver sus fotos y notas.'],
  terminada: ['La visita terminó. El reporte de María está listo.'],
  cita2: ['María confirmó tu próxima visita del jueves 12 de noviembre.'],
}
const AVISOS_ANTERIORES = ['Bienvenida a Compaz: tu pago fue confirmado.', 'Ya puedes agendar tu primera visita.']

// ── Iconos de línea (sin emojis), del color del texto ────────────────────────────────
type NombreIcono = 'casa' | 'calendario' | 'persona' | 'burbuja' | 'campana'
function Icono({ nombre, className = 'h-6 w-6' }: { nombre: NombreIcono; className?: string }) {
  const t = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...t}>
      {nombre === 'casa' && <path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5" />}
      {nombre === 'calendario' && <><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>}
      {nombre === 'persona' && <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>}
      {nombre === 'burbuja' && <path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4 20l1.4-4.3A7.5 7.5 0 1 1 20 12Z" />}
      {nombre === 'campana' && <><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15L6 16.5Z" /><path d="M10 21h4" /></>}
    </svg>
  )
}

/** El círculo rojo con el número, igual que en el panel del equipo. No dibuja nada si no hay nada nuevo. */
function Insignia({ n, etiqueta, className = '' }: { n: number; etiqueta: string; className?: string }) {
  if (n <= 0) return null
  return <span role="status" aria-label={`${n} ${etiqueta}`} title={`${n} ${etiqueta}`} className={`inline-flex min-w-5 items-center justify-center rounded-full bg-rojo px-1.5 text-[11px] font-extrabold leading-5 text-blanco ${className}`}>{n > 99 ? '99+' : n}</span>
}

function Campo({ etiqueta, nota, children }: { etiqueta: string; nota?: string; children: React.ReactNode }) {
  return <label className="mt-3 block text-base font-bold text-morado-profundo">{etiqueta}{nota && <span className="font-normal text-texto-sutil"> {nota}</span>}{children}</label>
}
const entrada = 'mt-1 block min-h-12 w-full rounded-xl border border-borde bg-blanco px-3 text-base font-normal text-morado-profundo'

/** «Tu siguiente paso»: la misma tarjeta en TODAS las pestañas. Una frase, un botón, y lo que viene después. */
function TarjetaSiguiente({ m, onPrincipal, onSecundario }: { m: Momento; onPrincipal: () => void; onSecundario: () => void }) {
  const s = SIGUIENTE[m]
  return (
    <Tarjeta className="border-l-8 border-naranja">
      <p className="text-sm font-extrabold uppercase tracking-wide text-naranja-oscuro">{s.etiqueta ?? (s.espera ? 'Ahora toca esperar' : 'Tu siguiente paso')}</p>
      <h2 className="mt-1 text-2xl font-extrabold text-morado-profundo">{s.titulo}</h2>
      <p className="mt-2 text-lg text-morado-claro">{s.texto}</p>
      {s.luego && <p className="mt-2 text-base font-bold text-morado-sutil">{s.luego}</p>}
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <Boton variante={s.espera ? 'secundario' : 'primario'} info={s.infoBoton} onClick={onPrincipal}>{s.boton}</Boton>
        {s.secundario && <Boton variante="secundario" info={s.secundario.info} onClick={onSecundario}>{s.secundario.texto}</Boton>}
      </div>
    </Tarjeta>
  )
}

type EstadoPaso = 'hecho' | 'ahora' | 'despues'

function Paso({ n, titulo, estado, resumen, apagado, id, children }: { n: number; titulo: string; estado: EstadoPaso; resumen?: string; apagado?: string; id?: string; children?: React.ReactNode }) {
  // Un paso terminado se pliega: queda solo el título con su ✓. Se toca para ver lo que se guardó o para cambiarlo.
  const [abierto, setAbierto] = useState(false)
  const circulo = (
    <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${estado === 'hecho' ? 'bg-verde-oscuro text-blanco' : estado === 'ahora' ? 'bg-morado-medio text-blanco' : 'border-2 border-borde text-morado-sutil'}`}>{estado === 'hecho' ? '✓' : n}</span>
  )
  return (
    <li id={id} className={`rounded-2xl border-2 ${estado === 'ahora' ? 'border-morado-medio bg-blanco p-4' : estado === 'hecho' ? 'border-borde bg-blanco px-3 py-1' : 'border-borde bg-fondo-claro px-3 py-1'}`} aria-current={estado === 'ahora' ? 'step' : undefined}>
      {estado === 'hecho' && (
        <>
          <button type="button" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto} aria-label={`${titulo}, listo. ${abierto ? 'Ocultar' : 'Ver o cambiar'}`} className="flex min-h-14 w-full items-center gap-3 text-left">
            {circulo}<h3 className="flex-1 text-lg font-extrabold text-morado-profundo">{titulo}</h3><span aria-hidden className="text-morado-sutil">{abierto ? '▾' : '▸'}</span>
          </button>
          {abierto && <div className="pb-3 pl-12">{resumen && <p className="text-base text-morado-claro">{resumen}</p>}{children && <div className="mt-2">{children}</div>}</div>}
        </>
      )}
      {estado === 'ahora' && (
        <div className="flex items-start gap-3">
          {circulo}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2"><h3 className="text-lg font-extrabold text-morado-profundo">{titulo}</h3><span className="text-sm font-bold text-morado-medio">Ahora</span></div>
            {children && <div className="mt-2">{children}</div>}
          </div>
        </div>
      )}
      {estado === 'despues' && (
        <div className="flex min-h-14 items-center gap-3">
          {circulo}<h3 className="flex-1 text-lg font-extrabold text-morado-sutil">{titulo}</h3>
          <span className="text-sm font-bold text-morado-sutil">Después</span>
          {apagado && <InfoBoton que={`Cuándo se activa: ${titulo}`} texto={apagado} />}
        </div>
      )}
    </li>
  )
}

const REPORTE = 'María estuvo 2 horas con tu mamá. Almorzó bien y tomó sus medicinas a la hora. Caminaron 15 minutos por el pasillo y vieron un programa de música. Se mostró tranquila y de buen ánimo.'

function Reporte() {
  return (
    <div className="mt-2 rounded-2xl bg-fondo-lavanda p-3">
      <p className="text-base font-bold text-morado-profundo">Reporte de María</p>
      <p className="mt-1 text-base text-morado-claro">{REPORTE}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">{[1, 2, 3].map((n) => <div key={n} className="grid h-20 place-items-center rounded-xl bg-blanco text-sm text-texto-sutil">Foto {n}</div>)}</div>
    </div>
  )
}

type Mensaje = { de: 'maria' | 'yo'; texto: string; hora: string }
const MENSAJES_INICIALES: Mensaje[] = [
  { de: 'maria', texto: 'Hola Carolina, quedo atenta a la hora que elijas.', hora: '9:12 am' },
  { de: 'maria', texto: 'Cualquier duda sobre tu mamá me escribes aquí.', hora: '9:13 am' },
]

function Portal() {
  const embebido = useEmbedded()
  const [momentoUrl, setMomentoUrl] = useUrlState('momento', 'direccion')
  const [tab, setTab] = useUrlState('tab', 'inicio')
  const m = (MOMENTOS as readonly string[]).includes(momentoUrl) ? (momentoUrl as Momento) : 'direccion'
  const ahora = AHORA[m]
  const segunda = ES_SEGUNDA(m)
  const estadoDe = (i: number): EstadoPaso => (i < ahora ? 'hecho' : i === ahora ? 'ahora' : 'despues')
  const idx = MOMENTOS.indexOf(m)

  // Avisos nuevos (los que llegan de fuera) y mensajes del chat sin leer: los dos alimentan los círculos rojos.
  const [avisosSinVer, setAvisosSinVer] = useState((NOVEDADES[m] ?? []).length)
  const [abiertaCampana, setAbiertaCampana] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>(MENSAJES_INICIALES)
  const [sinLeer, setSinLeer] = useState(2)
  const [borrador, setBorrador] = useState('')
  const [ayuda, setAyuda] = useState(false)
  const [estrellas, setEstrellas] = useState(5)
  const chatRef = useRef<HTMLElement | null>(null)
  const listaChat = useRef<HTMLDivElement | null>(null)

  // Cambiar de momento por una acción del propio cliente no genera avisos; cambiarlo por algo que hace María o el equipo, sí.
  const irA = (nuevo: Momento, externo = false) => { setMomentoUrl(nuevo); if (externo) setAvisosSinVer((NOVEDADES[nuevo] ?? []).length) }
  const avanzar = (externo = false) => idx < MOMENTOS.length - 1 && irA(MOMENTOS[idx + 1], externo)
  const irAVisitas = () => { setTab('visitas'); setAvisosSinVer(0) }

  // El chat está siempre a la vista: los mensajes se marcan como leídos cuando el chat entra en pantalla (como WhatsApp).
  useEffect(() => {
    const el = chatRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    let t: ReturnType<typeof setTimeout> | undefined
    const o = new IntersectionObserver(([e]) => { clearTimeout(t); if (e.isIntersecting) t = setTimeout(() => setSinLeer(0), 1200) }, { threshold: 0.4 })
    o.observe(el)
    return () => { clearTimeout(t); o.disconnect() }
  }, [tab])
  useEffect(() => { listaChat.current?.scrollTo({ top: listaChat.current.scrollHeight }) }, [mensajes])
  // El número también va en el título de la pestaña del navegador, como en el panel.
  const total = avisosSinVer + sinLeer
  useEffect(() => { document.title = `${total > 0 ? `(${total}) ` : ''}Prototipo Compaz` }, [total])

  const enviar = () => { const t = borrador.trim(); if (!t) return; setMensajes((l) => [...l, { de: 'yo', texto: t, hora: 'ahora' }]); setBorrador('') }
  const simularMensaje = () => { setMensajes((l) => [...l, { de: 'maria', texto: 'Tu mamá ya almorzó y está tranquila.', hora: 'ahora' }]); setSinLeer((n) => n + 1) }
  const verChat = () => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const siguiente = (
    <TarjetaSiguiente m={m}
      onPrincipal={() => { irAVisitas(); setTimeout(() => document.getElementById('paso-ahora')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}
      onSecundario={() => irA('fecha')} />
  )

  const TABS: { id: string; texto: string; icono: NombreIcono }[] = [{ id: 'inicio', texto: 'Inicio', icono: 'casa' }, { id: 'visitas', texto: 'Visitas', icono: 'calendario' }, { id: 'cuenta', texto: 'Mi cuenta', icono: 'persona' }]

  return (
    <main className="mx-auto max-w-xl px-4 pb-24 pt-4 lg:max-w-5xl lg:pb-12">
      {!embebido && (
        <section className="mb-4 rounded-2xl border-2 border-dashed border-borde-lavanda bg-fondo-lavanda p-3">
          <p className="text-sm font-extrabold text-morado-profundo">Controles del prototipo (no existen en el portal real)</p>
          <label className="mt-1 block text-sm text-morado-claro" htmlFor="momento">Momento del cliente
            <select id="momento" value={m} onChange={(e) => irA(e.target.value as Momento, true)} className="mt-1 block min-h-12 w-full rounded-xl border border-borde bg-blanco px-3 text-base text-morado-profundo">
              {MOMENTOS.map((x) => <option key={x} value={x}>{ETIQUETA_MOMENTO[x]}</option>)}
            </select>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Boton tamano="compacto" variante="secundario" info="Solo del prototipo: simula que María te escribe un mensaje nuevo. Verás el círculo rojo en Mensajes y en el título de la pestaña." onClick={simularMensaje}>Simular mensaje de María</Boton>
            <Boton tamano="compacto" variante="secundario" info="Solo del prototipo: marca otra vez como nuevos los avisos de este momento, para ver los círculos rojos." onClick={() => setAvisosSinVer((NOVEDADES[m] ?? []).length)}>Repetir los avisos de este momento</Boton>
          </div>
          <p className="mt-2 text-sm text-morado-claro">Los círculos rojos se quitan solos al abrir la campana, entrar a Visitas o ver el chat. Lo que haces tú (guardar, pedir una hora) no genera avisos.</p>
        </section>
      )}

      <header className="relative flex items-center justify-between">
        <span className="text-lg font-extrabold text-morado-medio">Compaz</span>
        <div className="flex items-center gap-1">
          <span className="mr-2 hidden text-base text-morado-claro sm:inline">Hola, Carolina</span>
          <button type="button" onClick={verChat} aria-label={`Mensajes con María${sinLeer ? `, ${sinLeer} sin leer` : ''}`} className="relative grid h-12 w-12 place-items-center rounded-full text-morado-medio hover:bg-fondo-lavanda">
            <Icono nombre="burbuja" /><Insignia n={sinLeer} etiqueta="mensajes sin leer" className="absolute right-0.5 top-0.5" />
          </button>
          <button type="button" aria-expanded={abiertaCampana} onClick={() => { setAbiertaCampana((a) => !a); setAvisosSinVer(0) }} aria-label={`Avisos${avisosSinVer ? `, ${avisosSinVer} nuevos` : ''}`} className="relative grid h-12 w-12 place-items-center rounded-full text-morado-medio hover:bg-fondo-lavanda">
            <Icono nombre="campana" /><Insignia n={avisosSinVer} etiqueta="avisos nuevos" className="absolute right-0.5 top-0.5" />
          </button>
        </div>
        {abiertaCampana && (
          <div role="dialog" aria-label="Avisos" className="absolute right-0 top-14 z-20 w-full max-w-sm rounded-2xl border border-borde bg-blanco p-4 shadow-xl">
            <h2 className="text-lg font-extrabold text-morado-profundo">Avisos</h2>
            <ul className="mt-2 space-y-2 text-base">
              {[...(NOVEDADES[m] ?? []), ...AVISOS_ANTERIORES].map((t, i) => <li key={t} className={i < (NOVEDADES[m] ?? []).length ? 'font-bold text-morado-profundo' : 'text-morado-sutil'}>{t}</li>)}
            </ul>
            <div className="mt-3"><Boton variante="secundario" info="Cierra la lista de avisos. Los avisos ya quedaron como vistos." onClick={() => setAbiertaCampana(false)}>Cerrar</Boton></div>
          </div>
        )}
      </header>

      <nav aria-label="Secciones del portal" className="mt-3 flex gap-1 rounded-2xl border border-borde bg-blanco p-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => { setTab(t.id); if (t.id === 'visitas') setAvisosSinVer(0) }}
            className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-sm font-bold sm:flex-row sm:gap-2 sm:text-base ${tab === t.id ? 'bg-morado-medio text-blanco' : 'text-morado-claro'}`}>
            <Icono nombre={t.icono} className="h-5 w-5" /><span>{t.texto}</span>
            {t.id === 'visitas' && <Insignia n={avisosSinVer} etiqueta="avisos nuevos" className="absolute right-1.5 top-1" />}
          </button>
        ))}
      </nav>

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
        <div className="space-y-5">
          {siguiente}

          {tab === 'inicio' && (
            <>
              <section aria-label="Tu progreso general" className="rounded-3xl bg-blanco p-4"><Pasos pasos={PASOS_GENERALES} actual={5} /></section>
              <details className="rounded-2xl border border-borde bg-blanco p-4">
                <summary className="min-h-11 cursor-pointer text-lg font-extrabold text-morado-profundo">Pronto en Compaz</summary>
                <p className="mt-2 text-base text-morado-claro">Voluntariado y cuidado de mascotas. Lo guardamos aquí abajo, plegado, para que no compita con lo que sí tienes que hacer hoy.</p>
              </details>
            </>
          )}

          {tab === 'visitas' && (
            <section aria-label="Recorrido de la visita">
              <div className="flex items-center gap-1"><h2 className="text-xl font-extrabold text-morado-profundo">{segunda ? 'Tu segunda visita con María' : 'Tu primera visita con María'}</h2><InfoBoton que="Cómo leer los pasos" texto="Cinco pasos, uno por uno. El paso de ahora está abierto; los que ya hiciste se pliegan con su ✓ (tócalos para ver o cambiar lo que guardaste); los que todavía no tocan están apagados y su ⓘ dice cuándo se activan." /></div>
              <ol className="mt-3 space-y-3">
                <Paso n={1} titulo={PASOS_VISITA[0].titulo} estado={estadoDe(0)} id={estadoDe(0) === 'ahora' ? 'paso-ahora' : undefined}
                  resumen={segunda ? 'La misma de la visita anterior: Av. Francisco de Miranda, Edif. Sol, piso 3, Chacao.' : 'Av. Francisco de Miranda, Edif. Sol, piso 3, Chacao. Contacto: Rosa Linares, +58 414 555 0101.'}>
                  <Campo etiqueta="Dirección o punto de encuentro"><input className={entrada} defaultValue={m === 'direccion' ? '' : 'Av. Francisco de Miranda, Edif. Sol, piso 3, Chacao'} /></Campo>
                  <Campo etiqueta="Cómo entrar" nota="(opcional)"><input className={entrada} placeholder="Avisar en conserjería" /></Campo>
                  <Campo etiqueta="Nombre del contacto en el sitio"><input className={entrada} defaultValue={m === 'direccion' ? '' : 'Rosa Linares'} /></Campo>
                  <Campo etiqueta="Teléfono del contacto" nota="(solo lo ve el equipo de Compaz, nunca María)">
                    <span className="mt-1 flex flex-wrap gap-2"><select aria-label="País del teléfono" className={`${entrada} !mt-0 flex-[1_1_150px]`} defaultValue="ve"><option value="ve">Venezuela (+58)</option><option>EE. UU. y Caribe (+1)</option><option>Colombia (+57)</option></select><input inputMode="numeric" placeholder="Ej. 414 555 0101" className={`${entrada} !mt-0 flex-[2_1_170px]`} defaultValue={m === 'direccion' ? '' : '414 555 0101'} /></span>
                  </Campo>
                  {estadoDe(0) === 'ahora' && <div className="mt-4"><Boton info="Guarda la dirección y el contacto. María la recibe unas horas antes de la visita, por Telegram, nunca por el chat." onClick={() => avanzar()}>Guardar la dirección</Boton></div>}
                </Paso>

                <Paso n={2} titulo={PASOS_VISITA[1].titulo} estado={estadoDe(1)} id={estadoDe(1) === 'ahora' ? 'paso-ahora' : undefined} apagado="Se activa cuando registres la dirección."
                  resumen={segunda ? 'Jueves 12 de noviembre, 9:00 am a 11:00 am (10:00 am en Caracas).' : 'Jueves 5 de noviembre, 9:00 am a 11:00 am (10:00 am en Caracas).'}>
                  <p className="text-base text-morado-claro">Horas libres de María, en tu hora de Miami:</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {['Mié 4 nov, 3:00 pm', 'Jue 5 nov, 9:00 am', 'Jue 5 nov, 2:00 pm', 'Vie 6 nov, 9:00 am'].map((h, i) => (
                      <label key={h} className="flex min-h-14 items-center gap-3 rounded-xl border-2 border-borde px-3 text-base font-bold text-morado-profundo has-[:checked]:border-morado-medio has-[:checked]:bg-fondo-lavanda"><input type="radio" name="hora" defaultChecked={i === 1} className="h-5 w-5" />{h}</label>
                    ))}
                  </div>
                  {estadoDe(1) === 'ahora' && <div className="mt-4"><Boton info="Le pide esta hora a María. No queda agendada hasta que ella confirme; si no puede, eliges otra sin costo." onClick={() => (segunda ? irA('cita2', true) : avanzar())}>Pedir esta cita</Boton></div>}
                </Paso>

                <Paso n={3} titulo={PASOS_VISITA[2].titulo} estado={estadoDe(2)} id={estadoDe(2) === 'ahora' ? 'paso-ahora' : undefined} resumen="María confirmó la cita." apagado="Se activa cuando pidas la hora.">
                  <Aviso tono="info">María recibió tu pedido por Telegram. Tiene hasta mañana para responder. Si no puede a esa hora, te avisamos aquí y por correo para que elijas otra.</Aviso>
                  <div className="mt-3"><Boton variante="fantasma" info="Solo del prototipo: simula que María toca «Confirmo la cita» en su Telegram." onClick={() => avanzar(true)}>(Prototipo) María confirma</Boton></div>
                </Paso>

                <Paso n={4} titulo={PASOS_VISITA[3].titulo} estado={estadoDe(3)} id={estadoDe(3) === 'ahora' ? 'paso-ahora' : undefined} apagado="Se activa cuando María confirme la hora." resumen="La visita se hizo: 2 horas, con foto de llegada y notas de María.">
                  {(m === 'confirmada' || m === 'cita2') && (
                    <>
                      <Aviso tono="exito">Todo listo para el {m === 'cita2' ? 'jueves 12' : 'jueves 5'}. Te recordamos un día antes. Si necesitas cambiar la hora, puedes hacerlo sin costo hasta 24 horas antes.</Aviso>
                      <div className="mt-3"><Boton variante="fantasma" info="Solo del prototipo: simula que llega el día de la visita y María avisa que llegó." onClick={() => irA('llego', true)}>(Prototipo) Llega el día</Boton></div>
                    </>
                  )}
                  {m === 'llego' && (
                    <>
                      <Aviso tono="advertencia">María está en la puerta. Esta es su foto de llegada: confirma que es tu mamá y su casa para que empiece la visita.</Aviso>
                      <div className="mt-2 grid h-32 place-items-center rounded-2xl bg-fondo-lavanda text-base text-texto-sutil">Foto de llegada de María</div>
                      <div className="mt-3"><Boton info="Le confirma a María que la persona correcta le abrió la puerta y empieza la visita." onClick={() => irA('curso', true)}>Sí, puede empezar</Boton></div>
                    </>
                  )}
                  {m === 'curso' && (
                    <>
                      <Aviso tono="exito">La visita empezó hace 40 minutos. María envía fotos y notas mientras está con tu mamá.</Aviso>
                      <ul className="mt-2 space-y-2 text-base text-morado-profundo">
                        <li className="rounded-2xl bg-fondo-lavanda p-3"><b>10:05 am.</b> Tu mamá desayunó y está de buen ánimo.</li>
                        <li className="rounded-2xl bg-fondo-lavanda p-3"><b>10:30 am.</b> Dimos una caminata corta por el pasillo.</li>
                        <li className="grid h-24 place-items-center rounded-2xl bg-fondo-lavanda text-sm text-texto-sutil">Foto de las 10:30 am</li>
                      </ul>
                      <div className="mt-3"><Boton variante="fantasma" info="Solo del prototipo: simula que María termina la visita." onClick={() => irA('terminada', true)}>(Prototipo) La visita termina</Boton></div>
                    </>
                  )}
                </Paso>

                <Paso n={5} titulo={PASOS_VISITA[4].titulo} estado={estadoDe(4)} id={estadoDe(4) === 'ahora' ? 'paso-ahora' : undefined} apagado="Se activa cuando termine la visita." resumen="La calificaste 5 de 5.">
                  <p className="text-base text-morado-claro">¿Cómo estuvo la visita de María?</p>
                  <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Calificación">
                    {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={estrellas === n} aria-label={`${n} de 5`} onClick={() => setEstrellas(n)} className={`grid h-12 w-12 place-items-center rounded-xl text-2xl ${n <= estrellas ? 'text-amarillo-marca' : 'text-borde'}`}>★</button>)}
                  </div>
                  <Reporte />
                  <div className="mt-3"><Boton info="Envía tu calificación. María no la ve antes de recibirla y te ayuda a ti y a otras familias. Después puedes agendar la próxima visita." onClick={() => irA('siguiente')}>Enviar mi calificación</Boton></div>
                </Paso>
              </ol>

              {segunda && (
                <details className="mt-4 rounded-2xl border border-borde bg-blanco p-4">
                  <summary className="min-h-11 cursor-pointer text-lg font-extrabold text-morado-profundo">Visitas anteriores (1)</summary>
                  <p className="mt-2 text-base text-morado-claro">Jueves 29 de octubre, 9:00 am. 2 horas con María. La calificaste 5 de 5.</p>
                  <Reporte />
                </details>
              )}
            </section>
          )}

          {tab === 'cuenta' && (
            <section className="space-y-3" aria-label="Mi cuenta">
              <Tarjeta><h2 className="text-xl font-extrabold text-morado-profundo">Mi familiar</h2><p className="mt-1 text-lg text-morado-claro">Rosa, 82 años. Chacao, Caracas. Ficha completa.</p><div className="mt-3"><Boton variante="secundario" info="Abre la ficha de tu familiar para corregir sus datos. Tu compita ve el cambio al instante." onClick={() => {}}>Editar la ficha</Boton></div></Tarjeta>
              <Tarjeta><h2 className="text-xl font-extrabold text-morado-profundo">Mi plan</h2><p className="mt-1 text-lg text-morado-claro">Plan semanal. Te quedan {segunda ? 2 : 3} visitas hasta el 30 de noviembre.</p></Tarjeta>
              <Aviso tono="info">Mi familiar y Mi plan se juntan en una sola pestaña de configuración: no son pasos del día a día, así que ya no compiten con Visitas.</Aviso>
            </section>
          )}
        </div>

        {/* Columna lateral en escritorio; en el teléfono va debajo. El chat nunca se pliega. */}
        <aside className="mt-5 space-y-4 lg:mt-0" aria-label="Chat y ayuda">
          <Tarjeta>
            <h2 className="text-xl font-extrabold text-morado-profundo">Tu visita</h2>
            <p className="mt-1 text-base font-bold text-morado-profundo">
              {m === 'direccion' || m === 'fecha' || m === 'siguiente' ? 'Fecha por elegir' : m === 'esperando' ? 'Pedida: jueves 5 de noviembre, 9:00 am' : m === 'cita2' ? 'Jueves 12 de noviembre, 9:00 am' : m === 'terminada' ? 'Terminó hoy' : m === 'curso' ? 'En curso ahora' : 'Jueves 5 de noviembre, 9:00 am'}
            </p>
            <p className="text-base text-morado-claro">María Pérez · Rosa, Chacao</p>
          </Tarjeta>

          <section ref={chatRef} aria-label="Chat con María" className="rounded-3xl border border-borde bg-blanco p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-morado-profundo"><Icono nombre="burbuja" className="h-6 w-6 text-morado-medio" />Chat con María<InfoBoton que="Reglas del chat" texto="Mantén toda la coordinación aquí. Compaz nunca te pedirá contraseñas ni datos bancarios por este medio, y los teléfonos y correos que se intenten compartir se borran." /></h2>
              <Insignia n={sinLeer} etiqueta="mensajes sin leer" />
            </div>
            <div ref={listaChat} role="log" aria-live="polite" className="mt-3 max-h-64 space-y-2 overflow-y-auto text-base">
              {mensajes.map((x, i) => (
                <p key={i} className={`max-w-[85%] rounded-2xl p-3 text-morado-profundo ${x.de === 'yo' ? 'ml-auto bg-fondo-lavanda' : 'bg-fondo-claro'}`}>{x.texto}<span className="mt-0.5 block text-xs text-texto-sutil">{x.de === 'yo' ? 'Tú' : 'María'} · {x.hora}</span></p>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); enviar() }} className="mt-3 flex flex-wrap gap-2">
              <input aria-label="Escribe un mensaje" value={borrador} onChange={(e) => setBorrador(e.target.value)} placeholder="Escribe un mensaje" className="min-h-12 min-w-0 flex-[1_1_160px] rounded-xl border border-borde bg-blanco px-3 text-base text-morado-profundo" />
              <div className="flex-[0_1_130px]"><Boton info="Envía tu mensaje a María. Compaz nunca te pedirá contraseñas ni datos bancarios por aquí, y los teléfonos y correos se borran." disabled={!borrador.trim()} onClick={enviar}>Enviar</Boton></div>
            </form>
          </section>

          <section className="rounded-3xl border border-borde bg-blanco p-4">
            <button type="button" aria-expanded={ayuda} onClick={() => setAyuda((a) => !a)} className="flex min-h-12 w-full items-center justify-between text-left text-lg font-extrabold text-morado-profundo"><span>¿Necesitas ayuda?</span><span aria-hidden>{ayuda ? '▾' : '▸'}</span></button>
            {ayuda && (
              <ul className="mt-2 grid gap-2">
                {['No puedo agendar la visita', 'Quiero cambiar la hora', 'Algo no está bien', 'Otra cosa'].map((t) => (
                  <li key={t}><Boton variante="secundario" info={`Te lleva a una respuesta sobre «${t}». Si no se resuelve, una persona del equipo te escribe.`} onClick={() => {}}>{t}</Boton></li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {!embebido && (
        <details className="mt-8 rounded-2xl border-2 border-dashed border-borde-lavanda bg-fondo-lavanda p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold text-morado-profundo">Qué cambia frente al portal de hoy</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-base text-morado-claro">
            <li>La tarjeta «Tu siguiente paso» va arriba en TODAS las pestañas, con una frase, un botón y lo que viene después. Hoy solo está en Inicio.</li>
            <li>Visitas deja de ser seis bloques sueltos: es un recorrido de cinco pasos. El de ahora está abierto; los hechos se pliegan con su ✓ (se tocan para ver o cambiar); los que no tocan están apagados y su ⓘ dice cuándo se activan. La segunda visita reutiliza la dirección y arranca en «Día y hora».</li>
            <li>El ciclo completo: dirección, fecha, confirmación, llegada, visita en curso, calificar, y de nuevo a agendar la siguiente.</li>
            <li>El chat con el compita está SIEMPRE a la vista y activo (con su caja para escribir), en todas las pestañas. Pronto en Compaz baja al final de Inicio, plegado.</li>
            <li>Iconos y círculos rojos con número, igual que en el panel: en cada pestaña (Visitas), en Mensajes y en Avisos (la campana). Se quitan al verlos y el número también va en el título de la pestaña del navegador. Lo que haces tú no genera avisos.</li>
            <li>Mi familiar y Mi plan se juntan en Mi cuenta: son configuración, no pasos del día a día. «¿Necesitas ayuda?» siempre a mano.</li>
          </ol>
        </details>
      )}
    </main>
  )
}

export default function PortalUnicoPrototipo() {
  return <Suspense><Portal /></Suspense>
}
