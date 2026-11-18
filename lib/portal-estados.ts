// Lo que el portal le dice al cliente en cada estado: título, texto, botón principal y secundario, y qué hace cada botón (el ⓘ).
// ÚNICO lugar con estos textos: cambiar una frase es tocar una línea aquí, y la prueba exige que cada estado tenga todo completo.
// Antes de pagar el cliente ve "María P." (nombre y la inicial); el nombre completo llega con el pago (decisión del punto 2).

import { pestanaDeSec, type PestanaPortal } from '@/lib/portal-secciones'
import { type CodigoEstado, type EstadoCliente, CODIGOS_ESTADO } from '@/lib/estado-cliente'
import { nombreCorto } from '@/lib/plantillas-aviso'
import { dosHoras } from '@/lib/zonas'

/** Adónde lleva un botón: una ruta del portal o una acción que el portal sabe hacer. */
export type Destino =
  | { ruta: string }
  | { accion: 'avisar_pago' | 'confirmar_inicio' | 'avisar_abrieron' | 'avisar_equipo' | 'confirmar_llamada' }

export interface BotonPortal { texto: string; destino: Destino; /** Qué hace y qué provoca (el ⓘ). Obligatorio. */ info: string }
export interface TarjetaPortal {
  titulo: string
  texto: string
  tono: 'accion' | 'espera' | 'alerta'
  /** Lo que viene después de este paso, en una frase. La tarjeta lo muestra debajo para que el cliente sepa qué sigue. */
  luego?: string
  principal?: BotonPortal
  secundario?: BotonPortal
}

export interface ContextoPortal {
  estado: EstadoCliente
  /** ¿Ya pagó? Si no, el compita se muestra como "María P." */
  pagado: boolean
  zonaCliente?: string | null
  /** Visitas que le quedan, para el plan. */
  restantes?: number
  /** Enlace de entrada a la sala de la entrevista (firmado), si hay una entrevista ahora. */
  rutaSala?: string
}

/** Cómo se ve el compita: antes de pagar solo "María P."; con el pago, su nombre (los dos primeros). */
export const nombreVisible = (nombreCompleto: string | null | undefined, pagado: boolean): string => (pagado ? (nombreCompleto ?? '').split(' ').slice(0, 2).join(' ') : nombreCorto(nombreCompleto ?? '')) || 'tu compita'
const nombre = (c: ContextoPortal) => nombreVisible(c.estado.compitaNombre, c.pagado)
const primero = (c: ContextoPortal) => (nombre(c).split(' ')[0] || 'tu compita')
const cuando = (c: ContextoPortal) => (c.estado.cuando ? dosHoras(c.estado.cuando, c.zonaCliente).texto : '')

const ELEGIR: BotonPortal = { texto: 'Ver compitas', destino: { ruta: '/compitas' }, info: 'Te muestra los compitas disponibles para que elijas con quién empezar. No cuesta nada ni te compromete.' }
const OTROS: BotonPortal = { texto: 'Ver otros compitas', destino: { ruta: '/compitas' }, info: 'Te muestra otros compitas disponibles. No cancela tu solicitud actual ni cuesta nada.' }

export const CATALOGO_PORTAL: Record<CodigoEstado, (c: ContextoPortal) => TarjetaPortal> = {
  bienvenida: () => ({ titulo: 'Elige a tu compita', texto: 'Un compita es una persona de confianza que acompaña a tu familiar en Venezuela. Conoce a algunos y elige con quién empezar.', tono: 'accion', principal: ELEGIR }),
  solicitud_enviada: (c) => ({ titulo: `Enviamos tu solicitud a ${nombre(c)}`, texto: 'Se la estamos haciendo llegar. Te escribimos apenas responda, normalmente en pocas horas.', tono: 'espera', principal: OTROS }),
  solicitud_recibida: (c) => ({ titulo: `${nombre(c)} ya recibió tu solicitud`, texto: 'Le llegó el aviso a su Telegram. Normalmente responde en pocas horas. Si pasa un día sin respuesta, te ayudamos a elegir a otro compita sin que pagues nada.', tono: 'espera', principal: OTROS }),
  directa_enviada: (c) => ({ titulo: `Esperando que ${nombre(c)} acepte`, texto: 'Aún no pagas nada. Si acepta, pasas al pago. Si no puede, eliges a otro compita sin haber pagado.', tono: 'espera', principal: OTROS }),
  mandado_enviado: (c) => ({ titulo: `Esperando que ${nombre(c)} acepte tu mandado`, texto: 'Tarifa plana por mandado. Si acepta, pagas y lo hace. Si no puede, eliges a otro compita sin haber pagado.', tono: 'espera', principal: OTROS }),
  todas_rechazadas: () => ({ titulo: 'Busquemos a otro compita', texto: 'Esta vez no se pudo. No pagaste nada ni perdiste nada: elige a otro compita y vuelve a intentar.', tono: 'accion', principal: OTROS }),

  elegir_horario: (c) => ({ titulo: `${nombre(c)} aceptó. Elige tu horario`, texto: 'La entrevista dura 20 minutos, por video o solo con voz. Elige una de las horas que tiene libres.', tono: 'accion', principal: { texto: 'Elegir la hora', destino: { ruta: `/solicitar/hora?solicitud=${c.estado.solicitudId ?? ''}` }, info: 'Te muestra las horas libres del compita, en tu hora y en la de Caracas. Al elegir una, queda reservada para ti mientras ella confirma.' } }),
  horario_pedido: (c) => ({ titulo: `Esperando que ${primero(c)} confirme tu hora`, texto: `${c.estado.cuando ? `Elegiste: ${cuando(c)}. ` : ''}Pendiente de confirmar por ${primero(c)}. Tu hora queda reservada mientras responde y te avisamos por correo apenas lo haga.`, tono: 'espera', secundario: { texto: 'Cambiar de horario', destino: { ruta: `/solicitar/hora?solicitud=${c.estado.solicitudId ?? ''}` }, info: 'Te muestra las demás horas libres para elegir otra. Tu hora actual se libera cuando elijas.' } }),
  horario_rechazado: (c) => ({ titulo: `${primero(c)} no puede a esa hora`, texto: 'Le surgió un imprevisto. Elige otra de las horas que le quedan libres.', tono: 'accion', principal: { texto: 'Elegir otra hora', destino: { ruta: `/solicitar/hora?solicitud=${c.estado.solicitudId ?? ''}` }, info: 'Te muestra las horas que le quedan libres. No pierdes nada por cambiar.' } }),
  entrevista_programada: (c) => ({ titulo: 'Tu entrevista está confirmada', texto: `${cuando(c)}. Te mandamos un recordatorio una hora antes, con el botón para entrar.`, tono: 'espera', secundario: { texto: 'Cambiar horario', destino: { ruta: `/solicitar/hora?solicitud=${c.estado.solicitudId ?? ''}` }, info: 'Te muestra las demás horas libres del compita para elegir otra. Tu hora actual se libera cuando elijas.' } }),
  entrevista_ahora: (c) => ({ titulo: `Tu entrevista con ${nombre(c)} es ahora`, texto: 'Ya puedes entrar. Si se corta la conexión, vuelve a pulsar el mismo botón y sigues donde estabas.', tono: 'accion', principal: { texto: 'Entrar a la entrevista', destino: c.rutaSala ? { ruta: c.rutaSala } : { ruta: '/dashboard' }, info: 'Abre la videollamada de la entrevista. Si se corta, vuelve a tocarlo y sigues donde estabas.' } }),

  confirmar_llamada: (c) => ({ titulo: `¿Pudiste hablar con ${nombre(c)}?`, texto: 'Cuéntanos si la llamada se hizo. Si no se pudo, eliges otra hora sin costo.', tono: 'accion', principal: { texto: 'Sí, hablamos', destino: { accion: 'confirmar_llamada' }, info: 'Nos avisa que la llamada se hizo y te lleva a decidir si contratas. No se cobra nada.' }, secundario: { texto: 'No se pudo, elegir otra hora', destino: { ruta: `/reagendar/${c.estado.sala ?? ''}` }, info: 'Te deja elegir otra hora para la llamada y se lo avisamos a tu compita. No cuesta nada.' } }),
  decidir: (c) => ({ titulo: `¿Contratas a ${nombre(c)}?`, texto: 'Si dices que sí, pasamos al pago. Si dices que no, te mostramos otros compitas sin costo.', tono: 'accion', principal: { texto: 'Sí, quiero contratarla', destino: { ruta: '/pago' }, info: 'Te lleva al pago para empezar. Todavía no se cobra nada: primero ves los datos para pagar.' }, secundario: { texto: 'No, ver otras', destino: { ruta: '/compitas' }, info: 'Te muestra otros compitas sin costo. Tu compita actual no recibe ningún reproche.' } }),
  motivo_no: () => ({ titulo: 'Gracias por contarnos. ¿Qué pasó?', texto: 'Es opcional y de un toque: nos ayuda a mejorar. Después te mostramos otros compitas sin costo.', tono: 'accion', principal: OTROS }),

  directa_aceptada: (c) => ({ titulo: `${nombre(c)} aceptó. Un último paso: el pago`, texto: 'Envía el pago y escribe la referencia. Cuando lo confirmemos, completas la ficha de tu familiar y agendas.', tono: 'accion', principal: { texto: 'Ver cómo pagar', destino: { ruta: '/pago' }, info: 'Te muestra los datos para pagar y tu referencia. No se cobra nada desde aquí.' } }),
  pagar: () => ({ titulo: 'Un último paso: el pago', texto: 'Envía el pago y escribe la referencia. Cuando lo confirmemos, completas la ficha de tu familiar y agendas.', tono: 'accion', principal: { texto: 'Ya hice el pago', destino: { accion: 'avisar_pago' }, info: 'Avisa al equipo que enviaste el pago para que lo confirme. No se activa nada hasta que llegue el dinero.' } }),
  pago_revision: () => ({ titulo: 'Estamos confirmando tu pago', texto: 'Tarda unas horas. No tienes que quedarte esperando: aquí verás cuando esté confirmado. Mientras tanto ya puedes completar la ficha de tu familiar.', tono: 'espera', principal: { texto: 'Completar la ficha ahora', destino: { ruta: '/dashboard?sec=familiar' }, info: 'Abre la ficha de tu familiar. Es lo único que falta para agendar y solo la ve tu compita.' }, secundario: { texto: 'Avisar a Compaz', destino: { accion: 'avisar_equipo' }, info: 'Le avisa al equipo con urgencia. Te escriben por correo; nunca te piden dinero ni datos por teléfono.' } }),
  ficha_lista_espera: () => ({ titulo: 'Ficha lista. Solo falta confirmar tu pago', texto: 'Apenas lo confirmemos podrás agendar tu primera visita. Te avisamos por correo y aquí mismo.', tono: 'espera', secundario: { texto: 'Avisar a Compaz', destino: { accion: 'avisar_equipo' }, info: 'Le avisa al equipo con urgencia. Te escriben por correo; nunca te piden dinero ni datos por teléfono.' } }),

  ficha: () => ({ titulo: 'Pago confirmado. Cuéntanos de tu familiar', texto: 'Es lo único que falta para agendar tu primera visita. Solo lo ve tu compita, y la dirección exacta solo se le entrega 3 horas antes.', tono: 'accion', principal: { texto: 'Completar la ficha', destino: { ruta: '/dashboard?sec=familiar' }, info: 'Abre la ficha de tu familiar. Es obligatoria para agendar y solo la ve tu compita.' } }),

  agendar_visita: (c) => ({ titulo: `Elige cuándo visita ${nombre(c)}`, texto: 'Coordina la fecha y la hora con tu compita por el chat de Compaz, o elige directamente un horario.', tono: 'accion', principal: { texto: 'Elegir la fecha', destino: { ruta: '/dashboard?sec=visitas' }, info: 'Te lleva a escoger el día y la hora de la visita. Tu compita la ve apenas la guardes.' } }),
  cita_pendiente: (c) => ({ titulo: `Esperando que ${primero(c)} confirme tu cita`, texto: `Pediste ${cuando(c)}. Si no puede, te avisamos y eliges otra hora sin costo.`, tono: 'espera', secundario: { texto: 'Cambiar la fecha', destino: { ruta: '/dashboard?sec=visitas' }, info: 'Te deja elegir otra fecha y hora. La propuesta anterior se cancela y se le pide a tu compita que confirme la nueva.' } }),
  visita_programada: (c) => ({ titulo: `Próxima visita: ${cuando(c)}`, texto: `${nombre(c)} visitará a tu familiar. Puedes cambiarla gratis hasta 24 horas antes. Te avisamos cuando salga y cuando llegue.`, tono: 'espera', principal: { texto: 'Ver mis visitas', destino: { ruta: '/dashboard?sec=visitas' }, info: 'Abre la lista de tus visitas, próximas y anteriores.' } }),
  compita_llego: (c) => ({ titulo: `¡${primero(c)} llegó a casa de tu familiar!`, texto: 'Esta es la foto que mandó al llegar. Confirma que puede empezar la visita. Si no respondes, se confirma sola en 5 minutos.', tono: 'accion', principal: { texto: 'Confirmar y empezar', destino: { accion: 'confirmar_inicio' }, info: 'Confirma que el compita ya está con tu familiar y puede empezar la visita. Si no respondes, se confirma sola en 5 minutos.' } }),
  nadie_abre: (c) => ({ titulo: `${primero(c)} llegó y no le abren`, texto: 'Está en la puerta esperando. Avísale a quien pueda abrir. Si en 30 minutos nadie aparece, la visita se cuenta como usada.', tono: 'alerta', principal: { texto: 'Ya abrieron', destino: { accion: 'avisar_abrieron' }, info: 'Le avisa al compita que ya le abrieron para que empiece. Detiene la cuenta atrás de 30 minutos.' } }),
  visita_en_curso: (c) => ({ titulo: `${primero(c)} está con tu familiar`, texto: 'Aquí verás las fotos y notas que envíe durante la visita. También puedes escribirle.', tono: 'espera' }),
  visita_interrumpida: (c) => ({ titulo: 'La visita se interrumpió', texto: `${primero(c)} tuvo que retirarse antes de tiempo. No tienes que hacer nada: el equipo de Compaz te escribe hoy para organizar otra visita.`, tono: 'alerta', principal: { texto: 'Avisar a Compaz que recibí el aviso', destino: { accion: 'avisar_equipo' }, info: 'Le confirma al equipo que leíste el aviso. No cambia nada más: el equipo se comunica contigo.' } }),
  visita_cancelada_equipo: (c) => ({ titulo: `Tu visita con ${nombre(c)} ya no podrá realizarse`, texto: 'Lamentamos las molestias. No tienes que hacer nada: esta visita no se descuenta de tu plan y el equipo de Compaz te escribe para ayudarte a encontrar otra opción.', tono: 'alerta', principal: { texto: 'Elegir otro compita', destino: { ruta: '/compitas' }, info: 'Te lleva a ver otros compitas. No pagas nada por cambiar, y no se descuenta de tu plan.' } }),
  visita_terminada: (c) => ({ titulo: 'La visita terminó. ¿Cómo te fue?', texto: `Tu calificación ayuda a otras familias y a mejorar el servicio. Aquí tienes el reporte de ${primero(c)}.`, tono: 'accion', principal: { texto: 'Ver el reporte', destino: { ruta: '/dashboard?sec=visitas' }, info: 'Abre el reporte de bienestar de la visita y te deja calificarla. Solo toma un momento.' } }),
  agendar_otra: (c) => ({ titulo: 'Agenda tu próxima visita', texto: `${nombre(c)} volverá a visitar a tu familiar. Coordina el día y la hora por el chat.`, tono: 'accion', principal: { texto: 'Agendar otra visita', destino: { ruta: '/dashboard?sec=visitas' }, info: 'Abre el chat con tu compita para ponerse de acuerdo en el día y la hora. Tú eliges la fecha y ella la confirma.' } }),
  plan_agotado: () => ({ titulo: 'Tu plan se agotó', texto: 'Para agendar más visitas, recarga tu plan. Tu compita sigue siendo la misma.', tono: 'accion', principal: { texto: 'Recargar plan', destino: { ruta: '/pago' }, info: 'Te lleva a elegir un plan y a ver los datos para pagar. No se cobra nada hasta que envíes el pago.' } }),
  cuenta_pausada: () => ({ titulo: 'Tu cuenta está en pausa', texto: 'Por ahora no puedes escribir en el chat ni agendar visitas. Compaz se comunicará contigo por correo para resolverlo.', tono: 'alerta' }),
}

/** La tarjeta del estado, lista para dibujar. Falla en tiempo de prueba si falta un estado: el catálogo debe cubrirlos todos. */
export function tarjetaDelEstado(c: ContextoPortal): TarjetaPortal {
  const t = (CATALOGO_PORTAL[c.estado.codigo] ?? CATALOGO_PORTAL.bienvenida)(c)
  const luego = LUEGO[c.estado.codigo]
  return luego ? { ...t, luego } : t
}

/** Qué viene después de cada paso, en una frase. Los estados sin entrada no muestran la línea (no hay un siguiente claro o es el final). */
const LUEGO: Partial<Record<CodigoEstado, string>> = {
  bienvenida: 'Después: tu compita recibe la solicitud y responde.',
  solicitud_enviada: 'Después: tu compita responde y eliges la hora de la entrevista.',
  solicitud_recibida: 'Después: tu compita responde y eliges la hora de la entrevista.',
  elegir_horario: 'Después: tu compita confirma la hora.',
  horario_pedido: 'Después: la entrevista por video.',
  entrevista_programada: 'Después: la entrevista y tu decisión.',
  entrevista_ahora: 'Después: decides si la contratas.',
  confirmar_llamada: 'Después: decides si la contratas.',
  decidir: 'Después: el pago.',
  directa_aceptada: 'Después: confirmamos el pago y completas la ficha.',
  pagar: 'Después: confirmamos el pago y completas la ficha.',
  pago_revision: 'Después: agendas tu primera visita.',
  ficha: 'Después: eliges el día y la hora de la visita.',
  agendar_visita: 'Después: tu compita confirma la hora.',
  cita_pendiente: 'Después: la visita en la fecha acordada.',
  visita_programada: 'Después: tu compita llega y empieza la visita.',
  compita_llego: 'Después: la visita.',
  visita_en_curso: 'Después: el reporte de bienestar.',
  visita_terminada: 'Después: agendas la próxima visita.',
}
export const CODIGOS_CON_TARJETA = CODIGOS_ESTADO

/** Estados cuya tarjeta muestra la foto que el compita mandó al llegar (se sirve desde /api/visita/llegada-foto, solo al dueño de la visita). */
export const ESTADOS_CON_FOTO_LLEGADA: readonly string[] = ['compita_llego', 'nadie_abre']
export const llevaFotoLlegada = (estado: string): boolean => ESTADOS_CON_FOTO_LLEGADA.includes(estado)

/** La pestaña a la que lleva un botón de ruta (/dashboard?sec=... o /portal?sec=...), o null si lleva a otra parte (pago, compitas, solicitar...). */
export function pestanaDelBoton(b: BotonPortal | undefined): PestanaPortal | null {
  if (!b || !('ruta' in b.destino)) return null
  const u = new URL(b.destino.ruta, 'https://compaz.local')
  return u.pathname === '/dashboard' || u.pathname === '/portal' ? pestanaDeSec(u.searchParams.get('sec')) : null
}

/**
 * La tarjeta tal como se muestra en una pestaña: un botón que lleva a ESTA misma pestaña se quita, porque ya estás ahí (antes «Ver el reporte» seguía
 * visible dentro del reporte y volvía a la misma página sin hacer nada). Los demás botones se quedan.
 */
export function tarjetaParaPestana(t: TarjetaPortal, pestana: PestanaPortal): TarjetaPortal {
  const ya = (b: BotonPortal | undefined) => pestanaDelBoton(b) === pestana
  const { principal, secundario, ...resto } = t
  return { ...resto, ...(principal && !ya(principal) ? { principal } : {}), ...(secundario && !ya(secundario) ? { secundario } : {}) }
}
