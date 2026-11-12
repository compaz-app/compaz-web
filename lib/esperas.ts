// REGLA: cuando el sistema frena algo (un plazo entre envíos, un máximo de intentos, un límite diario) SIEMPRE se explica solo: qué pasó, por qué
// existe la regla y cuándo o cómo seguir. Nunca "espera un momento" a secas. Este módulo es puro (sin base de datos) para poder usarse igual desde
// el servidor, el bot y las pantallas. Cada restricción nueva se agrega al CATALOGO: la prueba exige que tenga su razón y su siguiente paso.

export type ClaveEspera =
  | 'recordatorio_reciente' | 'recordatorio_limite' | 'pago_insistencia' | 'solicitudes_dia' | 'solicitud_mismo_compita'
  | 'codigo_fallos' | 'codigo_conexion' | 'acceso_conexion' | 'acceso_correo' | 'reconexion_llamada'
  | 'chat_limite' | 'postulacion_conexion' | 'postulacion_correo' | 'ayuda_cliente' | 'eliminar_cuenta_enlace' | 'insistir_aviso' | 'enlace_llamada_equipo'

export interface Espera {
  clave: ClaveEspera
  /** Mensaje completo, listo para mostrar: situación, razón y siguiente paso. */
  texto: string
  /** Solo lo esencial: qué pasó y cuándo o cómo seguir. Las pantallas lo muestran siempre y esconden la razón tras "¿Por qué?". */
  resumen: string
  /** La razón por la que existe la regla (lo que va detrás de "¿Por qué?"). */
  porQue: string
  /** Cuándo se podrá volver a intentar (ISO), o null si no es cuestión de tiempo. */
  vuelveEn: string | null
  /** Segundos que faltan (null si no aplica). */
  segundos: number | null
}

export interface ParamsEspera {
  /** Cuándo ocurrió la última vez (o la primera de la ventana, según la regla). */
  desde?: Date | string | null
  /** Cuánto dura la espera o la ventana, en milisegundos. */
  duracionMs?: number
  usados?: number
  max?: number
  ahora?: Date
}

/** Para cada restricción: quién la ve, qué limita y por qué existe. La pantalla "Límites del sistema" del panel lista esto con sus valores reales. */
export const CATALOGO: Record<ClaveEspera, { quien: 'compita' | 'cliente' | 'equipo'; limita: string; porQue: string }> = {
  recordatorio_reciente: { quien: 'compita', limita: 'Recordarle al cliente que falta un paso: un mínimo de horas entre un recordatorio y el siguiente', porQue: 'Esperamos entre recordatorios para no llenarle el correo: así los toma en serio.' },
  recordatorio_limite: { quien: 'compita', limita: 'Recordarle al cliente: un máximo de recordatorios por paso', porQue: 'Más correos no ayudan: terminan en la carpeta de spam. Como no responde, el equipo recibió una tarea para contactarlo.' },
  pago_insistencia: { quien: 'cliente', limita: 'Avisar al equipo que ya pagó: una alerta por ventana de tiempo', porQue: 'Tu pago ya está marcado como urgente. Avisar más seguido no acelera la confirmación: el equipo recibe una sola alerta urgente por ventana para que no se pierda entre mensajes. Te escribimos por correo apenas lo confirmemos.' },
  solicitudes_dia: { quien: 'cliente', limita: 'Enviar solicitudes: un máximo cada 24 horas', porQue: 'Así cada compita recibe pocas solicitudes y puede responder cada una con atención. Mientras tanto, revisa las respuestas en tu portal.' },
  solicitud_mismo_compita: { quien: 'cliente', limita: 'Pedirle de nuevo al mismo compita: una vez cada 24 horas', porQue: 'Así no se llena el Telegram del compita con la misma solicitud repetida.' },
  codigo_fallos: { quien: 'cliente', limita: 'Escribir el código de acceso: un máximo de intentos fallidos por correo', porQue: 'Es una medida de seguridad para que nadie pueda adivinar tu código. Pide uno nuevo por correo o espera a que termine la ventana de 15 minutos.' },
  codigo_conexion: { quien: 'cliente', limita: 'Escribir códigos de acceso: un máximo de intentos por conexión', porQue: 'Es una medida de seguridad contra quien intenta adivinar códigos desde una misma conexión.' },
  acceso_conexion: { quien: 'cliente', limita: 'Pedir enlaces de acceso: un máximo por hora desde una misma conexión', porQue: 'Protege las cuentas y evita que se use el envío de correos para molestar a alguien.' },
  acceso_correo: { quien: 'cliente', limita: 'Pedir el enlace de acceso: uno por minuto y correo', porQue: 'Así no se mezclan varios enlaces y siempre usas el más reciente.' },
  ayuda_cliente: { quien: 'cliente', limita: 'Avisar al equipo que necesitas ayuda desde el portal: una vez por hora', porQue: 'El equipo ya recibió tu aviso y te escribe por correo. Avisar más seguido no lo acelera y hace que se pierda entre otros mensajes.' },
  eliminar_cuenta_enlace: { quien: 'cliente', limita: 'Pedir el enlace para eliminar la cuenta: uno cada 10 minutos', porQue: 'El enlace es lo que evita que alguien más borre tu cuenta por error. Así no se mezclan varios enlaces y siempre usas el más reciente.' },
  chat_limite: { quien: 'cliente', limita: 'Mensajes al asistente de la página: 10 por hora y 50 por día desde una conexión', porQue: 'Así todas las familias pueden usarlo y se evita el abuso.' },
  postulacion_conexion: { quien: 'compita', limita: 'Postulaciones de compitas: un máximo por hora desde una misma conexión', porQue: 'Es una medida contra envíos automáticos que llenarían la bandeja de postulaciones falsas.' },
  postulacion_correo: { quien: 'compita', limita: 'Postulaciones de compitas: una por correo', porQue: 'Evita postulaciones duplicadas de la misma persona.' },
  insistir_aviso: { quien: 'equipo', limita: 'Insistir con un aviso desde la Bandeja: uno cada 30 minutos y un máximo de 3 por aviso', porQue: 'Mandar el mismo aviso muchas veces llena el Telegram o el correo de la persona y deja de leerse. Si ya insististe y sigue sin responder, conviene escribirle tú directamente o ofrecerle al cliente otro compita.' },
  enlace_llamada_equipo: { quien: 'equipo', limita: 'Reenviar el enlace de la llamada de una solicitud: uno cada 5 minutos', porQue: 'Cada envío manda dos correos y un Telegram a la familia y al compita; repetirlo seguido solo los satura y puede confundirlos.' },
  reconexion_llamada: { quien: 'cliente', limita: 'Reconectar la sala de la entrevista: una cada 2 minutos', porQue: 'Cada reconexión crea una sala nueva de videollamada; limitarlas evita salas duplicadas y gastos innecesarios.' },
}

const ZONA = 'America/Caracas'
const MIN = 60_000; const HORA = 3_600_000; const DIA = 86_400_000

/** "unos segundos", "5 minutos", "3 horas", "2 días" (siempre redondeando hacia arriba: nunca promete menos de lo que falta). */
export function duracionTexto(ms: number): string {
  if (ms < MIN) return 'unos segundos'
  if (ms < HORA) { const m = Math.ceil(ms / MIN); return `${m} ${m === 1 ? 'minuto' : 'minutos'}` }
  if (ms < 2 * DIA) { const h = Math.ceil(ms / HORA); return `${h} ${h === 1 ? 'hora' : 'horas'}` }
  const d = Math.ceil(ms / DIA); return `${d} días`
}

/** "hace un momento", "hace 10 minutos", "hace 3 horas". */
export function haceTexto(ms: number): string {
  if (ms < MIN) return 'hace un momento'
  if (ms < HORA) { const m = Math.floor(ms / MIN); return `hace ${m} ${m === 1 ? 'minuto' : 'minutos'}` }
  if (ms < 2 * DIA) { const h = Math.floor(ms / HORA); return `hace ${h} ${h === 1 ? 'hora' : 'horas'}` }
  return `hace ${Math.floor(ms / DIA)} días`
}

const dia = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: ZONA })
const horaLocal = (d: Date) => d.toLocaleTimeString('es-VE', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s*([ap])\.?\s*m\.?/i, ' $1m')
/** "hoy a las 9:40 pm", "mañana a las 9:40 am" o "el 12 nov a las 9:40 am" (hora de Venezuela). Si falta poco, "en 5 minutos". */
export function cuandoTexto(cuando: Date, ahora: Date): string {
  const falta = cuando.getTime() - ahora.getTime()
  if (falta < HORA) return `en ${duracionTexto(Math.max(falta, 0))}`
  const hoy = dia(ahora); const manana = dia(new Date(ahora.getTime() + DIA))
  const d = dia(cuando)
  if (d === hoy) return `hoy a las ${horaLocal(cuando)}`
  if (d === manana) return `mañana a las ${horaLocal(cuando)}`
  return `el ${cuando.toLocaleDateString('es-VE', { timeZone: ZONA, day: 'numeric', month: 'short' }).replace('.', '')} a las ${horaLocal(cuando)}`
}

const aFecha = (v: Date | string | null | undefined): Date | null => { if (!v) return null; const d = v instanceof Date ? v : new Date(v); return Number.isNaN(d.getTime()) ? null : d }

/** Arma la explicación de una restricción: qué pasó, por qué existe y cuándo o cómo seguir. */
export function explicarEspera(clave: ClaveEspera, p: ParamsEspera = {}): Espera {
  const ahora = p.ahora ?? new Date()
  const desde = aFecha(p.desde)
  const vuelve = desde && p.duracionMs ? new Date(desde.getTime() + p.duracionMs) : null
  const falta = vuelve ? Math.max(0, vuelve.getTime() - ahora.getTime()) : null
  const hace = desde ? haceTexto(ahora.getTime() - desde.getTime()) : 'hace poco'
  const cuando = vuelve ? cuandoTexto(vuelve, ahora) : 'más tarde'
  const porQue = CATALOGO[clave].porQue
  const faltaTxt = falta === null ? 'un rato' : duracionTexto(falta)
  const partes: Record<ClaveEspera, [string, string]> = {
    recordatorio_reciente: [`Ya se lo recordaste ${hace}.`, `Podrás volver a hacerlo ${cuando}.`],
    recordatorio_limite: [`Ya llegaste al máximo de recordatorios (${p.usados ?? p.max ?? 'varios'}).`, 'El equipo se encarga desde aquí.'],
    pago_insistencia: [`Ya avisamos al equipo ${hace}.`, `Podrás avisar de nuevo ${cuando}.`],
    solicitudes_dia: [`Llegaste al máximo de ${p.usados ?? p.max} solicitudes por día.`, `Podrás enviar otra ${cuando}.`],
    solicitud_mismo_compita: [`Ya le enviaste una solicitud ${hace}.`, `Podrás enviar otra ${cuando}.`],
    codigo_fallos: [`Fallaste el código ${p.usados ?? p.max} veces.`, `Pide uno nuevo o espera ${faltaTxt}.`],
    codigo_conexion: ['Demasiados intentos desde tu conexión.', `Espera ${faltaTxt} o pide un enlace nuevo.`],
    acceso_conexion: ['Pediste muchos enlaces en la última hora.', `Espera ${faltaTxt}. Revisa también tu spam.`],
    acceso_correo: [`Ya te enviamos un correo ${hace}.`, `Úsalo, o pide otro en ${faltaTxt}.`],
    enlace_llamada_equipo: [`Ya reenviaste el enlace de esta llamada ${hace}.`, `Podrás reenviarlo ${cuando}.`],
    reconexion_llamada: [`Acabas de reconectar la sala ${hace}.`, `Entra con el mismo enlace o espera ${faltaTxt}.`],
    ayuda_cliente: [`Ya avisamos al equipo ${hace}.`, `Te escribimos por correo. Podrás avisar de nuevo ${cuando}.`],
    eliminar_cuenta_enlace: [`Ya te enviamos el enlace ${hace}.`, `Revisa tu correo o pide otro en ${faltaTxt}.`],
    chat_limite: ['Llegaste al límite de mensajes.', 'Vuelve a escribir en un rato o escríbenos a hola@micompaz.com.'],
    postulacion_conexion: ['Hubo muchas postulaciones desde tu conexión.', 'Espera un rato o escríbenos a hola@micompaz.com.'],
    postulacion_correo: ['Ya recibimos una postulación con este correo.', 'Te escribimos por WhatsApp y correo.'],
    insistir_aviso: [p.max !== undefined && (p.usados ?? 0) >= p.max ? `Ya insististe ${p.usados} veces con este aviso (el máximo).` : `Ya insististe con este aviso ${hace}.`, p.max !== undefined && (p.usados ?? 0) >= p.max ? 'Escríbele tú directamente o ofrece otra opción.' : `Podrás volver a insistir ${cuando}.`],
  }
  const [situacion, siguiente] = partes[clave]
  return { clave, texto: `${situacion} ${porQue} ${siguiente}`, resumen: `${situacion} ${siguiente}`, porQue, vuelveEn: vuelve?.toISOString() ?? null, segundos: falta === null ? null : Math.ceil(falta / 1000) }
}

const escHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Para Telegram: lo esencial a la vista y la razón en un bloque que se despliega con un toque (así el chat no se llena de texto). */
export function esperaTelegram(e: Espera): string {
  return `${escHtml(e.resumen)}\n<blockquote expandable>¿Por qué? ${escHtml(e.porQue)}</blockquote>`
}
