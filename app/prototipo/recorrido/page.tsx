'use client'
import { Suspense, useEffect } from 'react'
import { EmbedProvider, useUrlState } from '../useUrlState'
import Cliente from '../cliente/page'
import Elegir from '../cliente/elegir/page'
import Entrar from '../cliente/entrar/page'
import Compita from '../compita/page'
import Admin from '../admin/page'
import { CICLO } from '../ciclo-data'

type Paso = {
  fase: string
  titulo: string
  que: string          // qué pasa en este paso
  dato: string         // qué se registra (alimenta el CRM)
  cliente: string
  compita?: string
  admin?: string
}

const PASOS: Paso[] = [
  { fase: '1. Llegar', titulo: 'Ve el anuncio y deja su teléfono', que: 'Una familia en el exterior llega desde un anuncio a micompaz.com, elige el estado donde vive su familiar y deja su teléfono.', dato: 'Postulación con fuente y campaña (utm). Sirve para saber qué anuncio trae clientes que contratan.', cliente: '/', admin: '/prototipo/admin?tab=herramientas&mas=postulaciones' },
  { fase: '2. Entrar', titulo: 'Entra con su correo', que: 'Recibe un enlace, o un código de 8 números si abrió el correo en otra app. Si ya tenía sesión, entra directo.', dato: 'Inicio de sesión y, si falla, el motivo. Cuenta atrás visible para pedir otro enlace.', cliente: '/prototipo/cliente/entrar' },
  { fase: '2. Entrar', titulo: 'Cuenta de quién es su familiar', que: 'Primer acceso: nombre, edad, condición y gustos del adulto mayor. Solo lo ve el compita que contrate.', dato: 'Perfil del familiar (ya existe).', cliente: '/prototipo/cliente?sec=familiar' },
  { fase: '3. Elegir', titulo: 'Busca y compara compitas', que: 'Filtra por zona, calificación y video. Ve foto, visitas y reseñas. Puede pedir hasta 3 entrevistas.', dato: 'Visitas al perfil de cada compita (dato nuevo a registrar).', cliente: '/prototipo/cliente/elegir' },
  { fase: '3. Elegir', titulo: 'Pide una entrevista', que: 'Toca "Hablar primero" y llena el formulario corto: qué necesitan, una nota opcional de 300 caracteres, si es un lugar privado y su foto (opcional). No elige horarios aquí: los elige después, entre los libres del compita. El compita recibe la solicitud por Telegram con dos botones.', dato: 'Solicitud con fecha de envío. Clic en solicitar (dato nuevo).', cliente: '/prototipo/cliente/solicitar?modo=entrevista', compita: '/prototipo/compita?hasta=0', admin: '/prototipo/admin?tab=seguimiento&etapa=Solicitud' },
  { fase: '3. Elegir', titulo: 'Espera la respuesta', que: 'Su portal dice "Esperando a María". Si el compita tarda, el admin lo ve en la Bandeja y puede insistir.', dato: 'Tiempo sin respuesta. Alimenta el semáforo y la tarea "Insistir al compita".', cliente: '/prototipo/cliente?estado=enviada', compita: '/prototipo/compita?hasta=0', admin: '/prototipo/admin?tab=bandeja&tipo=Sin%20respuesta' },
  { fase: '3. Elegir', titulo: 'Alternativa: lo contrata directo', que: 'Sin entrevista. El cliente llena el formulario corto (qué necesitan, nota de 300 caracteres, lugar privado, foto opcional). El compita acepta primero; el cliente paga después. Se saltan unos 7 pasos.', dato: 'Tipo de solicitud (directa) y quién aceptó antes de pagar. Mide cuántos eligen cada camino.', cliente: '/prototipo/cliente/solicitar?modo=directa', compita: '/prototipo/compita?hasta=5', admin: '/prototipo/admin?tab=bandeja&tipo=Sin%20respuesta' },
  { fase: '4. Entrevista', titulo: 'El compita acepta, el cliente elige horario', que: 'María acepta; el cliente escoge el horario de la entrevista de 20 minutos.', dato: 'Respuesta del compita y horario confirmado.', cliente: '/prototipo/cliente?estado=aceptada', compita: '/prototipo/compita?hasta=1', admin: '/prototipo/admin?tab=seguimiento&etapa=Entrevista' },
  { fase: '4. Entrevista', titulo: 'Entrevista programada', que: 'Ambos reciben un recordatorio una hora antes, con el botón para entrar.', dato: 'Aviso enviado y su resultado (tabla de avisos).', cliente: '/prototipo/cliente?estado=programada', compita: '/prototipo/compita?hasta=2' },
  { fase: '4. Entrevista', titulo: 'La entrevista', que: 'Un solo enlace por persona. Si se corta, vuelven a tocar el mismo botón y siguen donde estaban.', dato: 'Quién entró y cuándo. La pregunta de contratar sale por reloj, no solo por el aviso de Daily.', cliente: '/prototipo/cliente?estado=ahora', compita: '/prototipo/compita?hasta=2' },
  { fase: '4. Entrevista', titulo: 'Decide si la contrata', que: 'Al terminar, el cliente ve una pregunta con dos botones. Si no responde, el admin lo ve en la Bandeja.', dato: 'Decisión y, si dice que no, el motivo (dato nuevo).', cliente: '/prototipo/cliente?estado=decidir', admin: '/prototipo/admin?tab=bandeja&tipo=Decisi%C3%B3n' },
  { fase: '5. Pagar', titulo: 'Paga', que: 'Ve los datos de pago y su referencia. Toca "Ya hice el pago".', dato: 'Solicitud de pago con referencia.', cliente: '/prototipo/cliente?estado=pagar', admin: '/prototipo/admin?tab=bandeja&tipo=Pago' },
  { fase: '5. Pagar', titulo: 'Su pago queda en revisión', que: 'El portal dice "Estamos confirmando tu pago" y no promete una hora. Si no le llega el correo, puede reenviarlo o contactar a Compaz; eso sube el pago a urgente en la Bandeja. Mientras espera ya puede llenar la ficha.', dato: 'Insistencias del cliente y tiempo en espera. Con Stripe este paso desaparece.', cliente: '/prototipo/cliente?estado=pago_revision', admin: '/prototipo/admin?tab=bandeja&tipo=Pago' },
  { fase: '5. Pagar', titulo: 'Confirmamos el pago y empieza', que: 'El admin confirma desde la Bandeja. El cliente recibe el aviso y entra directo a su portal. El compita recibe que fue contratada.', dato: 'Pago registrado, etapa "Activo" y su fecha.', cliente: '/prototipo/cliente?estado=activo', compita: '/prototipo/compita?hasta=3', admin: '/prototipo/admin?tab=seguimiento&etapa=Activo' },
  { fase: '6. Ficha y cita', titulo: 'Completa la ficha de su familiar', que: 'Una sola vez: teléfono (solo lo ve el equipo), relación, nombre y edad del familiar, si el lugar es privado y consentimiento. Es obligatoria antes de la primera cita; el equipo puede llenarla por teléfono.', dato: 'Ficha, consentimiento con versión y fecha. Sin ella no se agenda.', cliente: '/prototipo/cliente?estado=ficha', admin: '/prototipo/admin?tab=bandeja&tipo=Ficha%20incompleta' },
  { fase: '6. Ficha y cita', titulo: 'Agenda y el compita confirma', que: 'El cliente elige entre los horarios libres del compita, viendo su hora y la de Caracas, y da la dirección de esa cita. El compita debe confirmar. Cambiar o cancelar es gratis hasta 24 horas antes.', dato: 'Cita, dirección y contacto en el sitio. Cada cancelación queda registrada.', cliente: '/prototipo/cliente?estado=agendar', compita: '/prototipo/compita?hasta=6', admin: '/prototipo/admin?tab=herramientas&mas=cancelaciones' },
  { fase: '7. Visitas', titulo: 'Tres horas antes: la dirección', que: 'El compita recibe la dirección exacta por Telegram, no por el chat. El teléfono del contacto en el sitio lo tiene solo el equipo.', dato: 'Dirección liberada y hora de salida.', cliente: '/prototipo/cliente?estado=activo', compita: '/prototipo/compita?hasta=7' },
  { fase: '7. Visitas', titulo: 'El compita llega, con foto', que: 'El compita toca "Llegué" y manda una foto de la puerta. El cliente ve la foto y confirma el inicio (o se confirma sola a los 5 minutos).', dato: 'Foto de llegada y hora real de inicio, para medir puntualidad.', cliente: '/prototipo/cliente?estado=llego', compita: '/prototipo/compita?hasta=8', admin: '/prototipo/admin?tab=visitas&vv=curso' },
  { fase: '7. Visitas', titulo: 'Llegó y nadie abre', que: 'El compita toca "Llegué y no hay nadie". El cliente ve la foto y una cuenta atrás de 30 minutos. Compaz escribe al contacto en el sitio a los 5 y 15 minutos. A los 30 se cierra: la visita cuenta como usada.', dato: 'Llegada sin acceso y cronómetro. Mide cuántas veces pasa para decidir si automatizar el puente.', cliente: '/prototipo/cliente?estado=nadie_abre', compita: '/prototipo/compita?hasta=9', admin: '/prototipo/admin?tab=bandeja&tipo=Nadie%20abre' },
  { fase: '7. Visitas', titulo: 'El compita no se siente seguro', que: 'Un botón siempre disponible en Telegram. Detiene la visita sin penalización, avisa al cliente con un texto neutro y manda una alerta urgente al admin. El compita puede contar el motivo y marcar "no quiero volver con este cliente".', dato: 'Salida por seguridad y reporte del compita.', cliente: '/prototipo/cliente?estado=interrumpida', compita: '/prototipo/compita?hasta=11', admin: '/prototipo/admin?tab=bandeja&tipo=No%20me%20siento%20seguro' },
  { fase: '7. Visitas', titulo: 'La visita se alarga', que: 'Si pasan 15 minutos de la hora de fin, el bot pregunta "¿Todo bien?". Sin respuesta en 10 minutos, alerta urgente al admin.', dato: 'Visita alargada y respuesta.', cliente: '/prototipo/cliente?estado=curso', compita: '/prototipo/compita?hasta=11', admin: '/prototipo/admin?tab=bandeja&tipo=Visita%20alargada' },
  { fase: '7. Visitas', titulo: 'Videollamada con el familiar', que: 'Después de pagar, el cliente puede pedir un mensaje de video, una llamada de voz o una videollamada. Sin costo y sin descontar visitas. El compita acepta o propone otra hora.', dato: 'Solicitudes de llamada, para vigilar el costo y el abuso.', cliente: '/prototipo/cliente?estado=activo', compita: '/prototipo/compita?hasta=12' },
  { fase: '7. Visitas', titulo: 'Visita en curso', que: 'El cliente ve las fotos y notas que va enviando el compita y puede escribirle. El chat censura teléfonos y correos. El compita tiene el botón de emergencia.', dato: 'Fotos, notas y mensajes; contactos bloqueados (alerta al admin); emergencias con su atención.', cliente: '/prototipo/cliente?estado=curso', compita: '/prototipo/compita?hasta=4', admin: '/prototipo/admin?tab=bandeja&tipo=Emergencia' },
  { fase: '7. Visitas', titulo: 'Visita terminada', que: 'Reporte de bienestar del compita y calificación del cliente.', dato: 'Reporte, calificación y comentario. Alimenta el perfil del compita y "Con problema".', cliente: '/prototipo/cliente?estado=fin', admin: '/prototipo/admin?tab=visitas&vv=terminadas' },
  { fase: '8. Después', titulo: 'Sigue o renueva su plan', que: 'Ve sus visitas restantes, su historial de pagos y puede agendar otra visita o renovar.', dato: 'Renovaciones y abandono. Alimenta el aviso de riesgo de pérdida.', cliente: '/prototipo/cliente?sec=plan', admin: '/prototipo/admin?tab=herramientas&mas=pagos' },
]

function Landing() {
  // Texto tomado de micompaz.com (no es copy nuevo).
  return (
    <main className="px-4 pb-10 pt-6">
      <div className="text-xl font-extrabold text-[var(--purple)]">Compaz</div>
      <div className="text-sm italic text-[var(--text-light)]">Cerca aunque estés lejos</div>
      <h1 className="mt-4 text-3xl font-extrabold leading-tight">Para que tu familiar no esté solo, aunque tú estés lejos.</h1>
      <p className="mt-2 text-lg font-bold text-[var(--text-dark)]">Nuestro equipo va a donde tú no puedes ir.</p>
      <p className="mt-1 text-lg text-[var(--text-mid)]">Un Compita verificado por nosotros acompaña a tu familiar, y tú recibes fotos y notas directamente después de cada visita.</p>
      <div className="mt-5 grid gap-3 rounded-3xl border border-[var(--border-muted)] bg-white p-4">
        <label className="text-base font-bold">Estado donde vive tu familiar
          <select className="mt-1 min-h-14 w-full rounded-2xl border border-[var(--border-muted)] bg-white px-3 text-lg font-normal"><option>Distrito Capital</option><option>Miranda</option><option>Zulia</option></select>
        </label>
        <div className="flex gap-2">
          <select aria-label="País" className="min-h-14 rounded-2xl border border-[var(--border-muted)] bg-white px-2 text-base"><option>+1 🇺🇸</option><option>+58 🇻🇪</option></select>
          <input aria-label="Teléfono" inputMode="tel" className="min-h-14 min-w-0 flex-1 rounded-2xl border border-[var(--border-muted)] px-4 text-lg" />
        </div>
        <button className="min-h-14 rounded-2xl bg-[var(--orange)] px-3 text-lg font-extrabold text-white">Quiero contratar el servicio para mi familiar</button>
      </div>
      <p className="mt-3 text-sm text-[var(--text-light)]">Página de inicio actual: no se rediseña. Cada formulario guarda su fuente y campaña.</p>
    </main>
  )
}

// Convierte la dirección de un paso en la pantalla y el estado con que se muestra.
function Pantalla({ url }: { url: string }) {
  const [ruta, qs = ''] = url.split('?')
  const params = Object.fromEntries(new URLSearchParams(qs))
  const Comp = ruta === '/' ? Landing : ruta.endsWith('/elegir') ? Elegir : ruta.endsWith('/entrar') ? Entrar : ruta.endsWith('/cliente') ? Cliente : ruta.endsWith('/compita') ? Compita : Admin
  return <EmbedProvider params={params}><Comp /></EmbedProvider>
}

// Recuadro con su propio desplazamiento. El transform hace que los elementos "fixed" de dentro
// (barra inferior, paneles) se queden dentro del recuadro y no se escapen a la página.
function Recuadro({ url, borde, ancho }: { url: string; borde: string; ancho?: boolean }) {
  return (
    <div
      className={`relative h-[720px] w-full overflow-y-auto rounded-3xl border-4 bg-[var(--warm-white)] ${borde} ${ancho ? '' : 'max-w-[390px]'}`}
      style={{ transform: 'translateZ(0)' }}
      onClickCapture={(e) => { if ((e.target as HTMLElement).closest('a')) { e.preventDefault(); e.stopPropagation() } }}
    >
      <Pantalla url={url} />
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <div className="flex h-full min-h-40 items-center justify-center rounded-3xl border-2 border-dashed border-[var(--border-muted)] bg-white p-6 text-center text-[var(--text-light)]">{texto}</div>
}

function Marco({ titulo, color, children }: { titulo: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider"><span className={`h-3 w-3 rounded-full ${color}`} />{titulo}</div>
      {children}
    </div>
  )
}

function Inner() {
  const [pStr, setP] = useUrlState('paso', '1')
  const [vista, setVista] = useUrlState('ver', 'cliente')
  const i = Math.min(Math.max(Number(pStr) || 1, 1), PASOS.length) - 1
  const paso = PASOS[i]
  const ir = (n: number) => setP(String(Math.min(Math.max(n, 1), PASOS.length)))

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (e.key === 'ArrowRight') ir(i + 2)
      if (e.key === 'ArrowLeft') ir(i)
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  })

  const frameCliente = <Recuadro key={`c${i}`} url={paso.cliente} borde="border-[var(--purple-dark)]" />
  const frameCompita = paso.compita ? <Recuadro key={`m${i}`} url={paso.compita} borde="border-[#517da2]" /> : <Vacio texto="En este paso el compita no recibe ni hace nada." />
  const frameAdmin = paso.admin ? <Recuadro key={`a${i}`} url={paso.admin} borde="border-[var(--orange)]" ancho /> : <Vacio texto="En este paso el admin no tiene que hacer nada." />

  return (
    <main className="mx-auto max-w-[1700px] px-4 pb-16 pt-4">
      <h1 className="text-2xl font-extrabold">Recorrido de un cliente nuevo</h1>
      <p className="text-[var(--text-mid)]">Sigue el flujo completo, paso a paso. En cada paso ves lo que ve el cliente, lo que recibe el compita y lo que ve el admin. Usa las flechas del teclado o los botones.</p>

      <div className="mt-4 flex flex-wrap gap-1" role="tablist" aria-label="Pasos">
        {PASOS.map((p, k) => (
          <button key={k} onClick={() => ir(k + 1)} aria-label={`Paso ${k + 1}: ${p.titulo}`} aria-current={k === i ? 'step' : undefined} className={`h-9 w-9 rounded-full text-sm font-extrabold ${k === i ? 'bg-[var(--purple)] text-white ring-4 ring-[var(--yellow)]' : k < i ? 'bg-[var(--orange)] text-white' : 'border border-[var(--border-muted)] bg-white text-[var(--text-mid)]'}`}>{k + 1}</button>
        ))}
      </div>

      <section className="mt-4 rounded-3xl border border-[var(--border-muted)] bg-white p-5">
        <div className="text-sm font-extrabold uppercase tracking-wider text-[var(--orange-dark)]">{paso.fase} · Paso {i + 1} de {PASOS.length}</div>
        <h2 className="mt-1 text-2xl font-extrabold">{paso.titulo}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <p className="text-lg text-[var(--text-mid)]"><b className="text-[var(--text-dark)]">Qué pasa:</b> {paso.que}</p>
          <p className="rounded-2xl bg-[var(--warm-gray)] p-3 text-base text-[var(--text-mid)]"><b className="text-[var(--text-dark)]">Qué se registra:</b> {paso.dato}</p>
        </div>
        <div className="mt-3 grid gap-3 rounded-2xl border border-[var(--border-muted)] p-3 md:grid-cols-3">
          <p className="text-base text-[var(--text-mid)]"><b className="text-[var(--text-dark)]">Aviso:</b> {CICLO[i].aviso}</p>
          <p className="text-base text-[var(--text-mid)]"><b className="text-[var(--text-dark)]">Botón:</b> {CICLO[i].boton}. Lleva a: {CICLO[i].aterriza}.</p>
          <p className="text-base text-[var(--text-mid)]"><b className="text-[var(--text-dark)]">Si no actúa:</b> {CICLO[i].siNo}</p>
        </div>
        <div className="mt-4 flex gap-3">
          <button disabled={i === 0} onClick={() => ir(i)} className="min-h-12 rounded-2xl border border-[var(--border-muted)] bg-white px-5 font-bold disabled:opacity-40">‹ Anterior</button>
          <button disabled={i === PASOS.length - 1} onClick={() => ir(i + 2)} className="min-h-12 rounded-2xl bg-[var(--orange)] px-6 font-extrabold text-white disabled:opacity-40">Siguiente ›</button>
        </div>
      </section>

      <div className="mt-4 flex gap-2 xl:hidden">
        {[['cliente', 'Cliente'], ['compita', 'Compita'], ['admin', 'Admin']].map(([id, t]) => (
          <button key={id} onClick={() => setVista(id)} aria-pressed={vista === id} className={`min-h-11 flex-1 rounded-full text-sm font-bold ${vista === id ? 'bg-[var(--purple)] text-white' : 'border border-[var(--border-muted)] bg-white'}`}>{t}</button>
        ))}
      </div>

      <div className="mt-4 hidden gap-6 xl:grid xl:grid-cols-[390px_390px_minmax(0,1fr)]">
        <Marco titulo="Cliente" color="bg-[var(--purple)]">{frameCliente}</Marco>
        <Marco titulo="Compita (Telegram)" color="bg-[#517da2]">{frameCompita}</Marco>
        <Marco titulo="Admin" color="bg-[var(--orange)]">{frameAdmin}</Marco>
      </div>
      <div className="mt-4 xl:hidden">
        {vista === 'cliente' && <Marco titulo="Cliente" color="bg-[var(--purple)]">{frameCliente}</Marco>}
        {vista === 'compita' && <Marco titulo="Compita (Telegram)" color="bg-[#517da2]">{frameCompita}</Marco>}
        {vista === 'admin' && <Marco titulo="Admin" color="bg-[var(--orange)]">{frameAdmin}</Marco>}
      </div>
    </main>
  )
}

export default function Page() {
  return <Suspense><Inner /></Suspense>
}
