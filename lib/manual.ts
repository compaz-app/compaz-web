// Manual del equipo (administradores y colaboradores). Se organiza por PREGUNTAS ("¿qué hago cuando...?"), no por pantallas.
// Es un módulo PURO (sin base de datos): lo usan igual el panel real y el prototipo.
//
// Para que no se desactualice, tiene dos tipos de contenido:
//   ENTRADAS      escritas a mano: el recorrido completo, las situaciones y cómo se hace cada cosa.
//   AUTOMÁTICAS   se arman desde los catálogos del sistema (permisos y límites): nunca pueden quedar viejas.
// Una prueba (tests/60-manual.test.ts) exige que cada pantalla del panel y cada permiso tengan su explicación, y que nada esté vacío.
//
// Estilo: frases cortas, pasos numerados, sin guiones como viñetas (regla del proyecto).

import { PERMISOS, ETIQUETA_PERMISO, type Permiso, type PermisoRequerido } from '@/lib/permisos-catalogo'
import { CATALOGO as ESPERAS, type ClaveEspera } from '@/lib/esperas'

export type SeccionManual = 'empezar' | 'dia_a_dia' | 'situaciones' | 'cuentas' | 'configuracion'

export const SECCIONES: { id: SeccionManual; titulo: string; descripcion: string }[] = [
  { id: 'empezar', titulo: 'Para empezar', descripcion: 'Cómo funciona Compaz y qué ves al entrar.' },
  { id: 'dia_a_dia', titulo: 'El día a día', descripcion: 'Lo que haces todos los días.' },
  { id: 'situaciones', titulo: 'Qué hago cuando…', descripcion: 'Cada situación que puede pasar y cómo resolverla.' },
  { id: 'cuentas', titulo: 'Cuentas y personas', descripcion: 'Pausar, bloquear, invitar y dar permisos.' },
  { id: 'configuracion', titulo: 'Configuración y control', descripcion: 'Precios, plazos, pagos y cómo revisar que todo funciona.' },
]

/** Las pantallas del panel. Cada una debe tener al menos una entrada del manual (lo comprueba una prueba). */
export const PANTALLAS_PANEL = ['bandeja', 'seguimiento', 'personas', 'visitas', 'resenas', 'invitar', 'postulaciones', 'pagos', 'avisos', 'cobertura', 'umbrales', 'equipo', 'ajustes', 'actividad', 'limites', 'registro', 'estado', 'manual'] as const
export type PantallaPanel = (typeof PANTALLAS_PANEL)[number]

export interface EntradaManual {
  id: string
  seccion: SeccionManual
  /** La pregunta que la persona se hace. */
  titulo: string
  /** Una frase: para qué sirve o qué es. */
  paraQue: string
  /** Pasos cortos y numerados (la pantalla los numera). */
  pasos: string[]
  /** Qué pasa después o qué hay que saber. */
  despues?: string
  /** Permiso necesario; sin él, la entrada se muestra apagada con la explicación. */
  permiso?: PermisoRequerido
  /** Pantalla del panel a la que se refiere. */
  pantalla?: PantallaPanel
  /** Palabras extra para el buscador. */
  busca?: string[]
}

export const ENTRADAS: EntradaManual[] = [
  // ── Para empezar ───────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'como-funciona', seccion: 'empezar', titulo: '¿Cómo funciona Compaz de principio a fin?',
    paraQue: 'Compaz conecta a familias en el extranjero con compitas, personas de confianza que acompañan a su familiar en Venezuela.',
    pasos: [
      'La familia elige a un compita y le pide conocerlo, contratarlo directo o un mandado.',
      'El compita acepta por Telegram.',
      'Se hace una videollamada de 20 minutos para conocerse.',
      'La familia decide si contrata y paga. El equipo confirma el pago.',
      'La familia completa la ficha de su familiar y elige la hora de la primera visita.',
      'El compita confirma la hora por Telegram.',
      'El día de la visita el compita llega con foto, la inicia, la termina y manda su reporte.',
      'La familia ve el reporte y califica la visita.',
    ],
    despues: 'No tienes que vigilar todo esto: el sistema te avisa solo cuando algo necesita a una persona.',
    busca: ['ciclo', 'proceso', 'flujo', 'empezar'],
  },
  {
    id: 'que-ves-al-entrar', seccion: 'empezar', titulo: '¿Qué es cada pantalla del panel?',
    paraQue: 'El panel tiene cinco secciones principales; el resto está en Más.',
    pasos: [
      'Bandeja: lo que tienes que hacer ahora, con lo urgente primero.',
      'Seguimiento: en qué etapa está cada cliente, para detectar a quien se atascó.',
      'Personas: la lista de compitas y clientes, con su estado y sus métricas.',
      'Visitas: las visitas de hoy, las que tienen problema y las ya terminadas.',
      'Más: las herramientas que no usas todos los días (pagos, ajustes, actividad y este manual).',
    ],
    pantalla: 'bandeja', busca: ['menu', 'pantallas', 'navegar'],
  },
  {
    id: 'regla-contactos', seccion: 'empezar', titulo: '¿Cuál es la regla que nunca se rompe?',
    paraQue: 'Protege a las familias y a los compitas, y es lo que hace confiable a Compaz.',
    pasos: [
      'El cliente y el compita nunca ven el teléfono, el correo ni el Telegram del otro.',
      'Todo se habla por el chat de Compaz, y el sistema censura teléfonos y correos.',
      'Compaz nunca pide datos, códigos, depósitos ni transferencias por teléfono o mensaje. Si te lo piden diciendo ser de Compaz, es un fraude.',
      'Tú tampoco pidas datos por teléfono: si llamas a alguien, es para escuchar y decidir.',
    ],
    despues: 'Si alguien comparte un contacto dos veces en 30 días, su cuenta queda en pausa hasta que decidas qué hacer.',
    busca: ['seguridad', 'privacidad', 'fraude', 'contactos', 'telefono'],
  },
  {
    id: 'permisos', seccion: 'empezar', titulo: '¿Por qué no puedo ver o hacer algunas cosas?',
    paraQue: 'Cada persona del equipo tiene solo los permisos que necesita.',
    pasos: [
      'Los administradores pueden todo. Los colaboradores tienen los permisos que un administrador les dio.',
      'Lo que no puedes hacer se ve apagado y dice qué permiso hace falta.',
      'Si necesitas uno, pídeselo a un administrador: él lo activa en Más, Equipo y permisos.',
    ],
    despues: 'Los permisos se revisan también en el servidor: aunque alguien lograra ver un botón, la acción no se ejecutaría.',
    pantalla: 'equipo', busca: ['acceso', 'colaborador', 'rol'],
  },

  // ── El día a día ───────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'bandeja', seccion: 'dia_a_dia', titulo: '¿Cómo trabajo la Bandeja?',
    paraQue: 'Es la lista de lo que necesita a una persona. Lo urgente va arriba y todo viene agrupado por compita o cliente.',
    pasos: [
      'Empieza por lo rojo: Urgente, actúa ya.',
      'Toca el nombre de la persona para abrir su ficha y entender qué pasa.',
      'Haz lo que pide la tarea (cada una explica qué hacer).',
      'Cada tarea trae su botón: Confirmar pago (permiso de pagos), Decidir sobre una cuenta en pausa (permiso de cuentas), Registrar la llamada a un compita que reportó un problema, Contactar al sitio (permiso de teléfonos), o Marcar atendida o revisada. Pasa el cursor por el ⓘ para ver qué hace.',
      'Insistir al compita, Recordar al cliente y Recordarle por correo reenvían el aviso que no atendió. La tarea sigue abierta y hay un tope: uno cada 30 minutos y 3 por aviso. Si lo alcanzas, el botón se apaga y el ⓘ explica por qué.',
      'Toca el botón cuando ya hiciste lo que pide la tarea. Queda anotado quién la resolvió. Si no tienes el permiso, el botón sale apagado y el ⓘ lo explica.',
    ],
    despues: 'Si no hay nada, dice "Todo en orden". Una tarea que se resuelve sola (por ejemplo, un pago confirmado) desaparece sin que hagas nada.',
    permiso: 'atender', pantalla: 'bandeja', busca: ['atencion', 'tareas', 'pendientes', 'resolver'],
  },
  {
    id: 'actividad', seccion: 'dia_a_dia', titulo: '¿Qué es la Actividad y cuándo la miro?',
    paraQue: 'Es el registro de todo lo que pasó en el sistema, en orden. Aquí no suena nada: se consulta cuando hace falta.',
    pasos: [
      'Filtra por tipo: Urgentes, Tareas o Informativo.',
      'Elige cuánto tiempo atrás mirar: hoy, 2, 7, 30 o 90 días.',
      'Busca por el nombre de un compita o un cliente, o por el correo de alguien del equipo para ver qué hizo.',
    ],
    despues: 'Sirve para saber qué pasó con una visita o una persona sin preguntarle a nadie. Cuánto tiempo se guarda está en Más, Manual, "Cuánto tiempo se guarda cada cosa".',
    permiso: 'monitorear', pantalla: 'actividad', busca: ['historial', 'registro', 'que paso'],
  },
  {
    id: 'telegram-timbre', seccion: 'dia_a_dia', titulo: '¿Por qué me llega (o no) un Telegram?',
    paraQue: 'Telegram es el timbre para lo urgente. Todo lo demás vive en el panel, para no llenarte de ruido.',
    pasos: [
      'Solo suenan las urgencias: una emergencia, un pago que insiste, una visita que no se cerró.',
      'Hay un tope de urgencias por hora. Pasado el tope, llega un solo mensaje que dice "hay varias urgencias, mira la Bandeja".',
      'Lo que tiene que ver con la seguridad de las personas nunca se suprime por el tope.',
      'Lo informativo y las tareas no suenan: las ves en la Bandeja y en Actividad.',
    ],
    despues: 'El tope se cambia en Ajustes. Si algo urgente no te llegó por Telegram, mira la Bandeja: ahí siempre queda.',
    busca: ['notificaciones', 'ruido', 'avisos', 'timbre'],
  },
  {
    id: 'ver-chat-telefono', seccion: 'dia_a_dia', titulo: '¿Cómo veo un chat o un teléfono?',
    paraQue: 'Son datos privados: verlos requiere permiso y queda anotado.',
    pasos: [
      'Abre la ficha de la persona (en Personas, Visitas o desde una tarea).',
      'Toca "Ver el chat" o "Ver teléfono".',
      'Si eres colaborador, elige un motivo: es obligatorio.',
    ],
    despues: 'Cada vez que abres uno queda anotado en Más, Registro de accesos: quién, cuándo y por qué.',
    permiso: 'telefonos', pantalla: 'registro', busca: ['privacidad', 'sensible', 'datos'],
  },
  {
    id: 'seguimiento', seccion: 'dia_a_dia', titulo: '¿Cómo uso Seguimiento?',
    paraQue: 'Muestra en qué etapa está cada cliente (solicitud, entrevista, decisión, pago, ficha, activo) para ver a quién se le atascó el proceso.',
    pasos: [
      'Toca una etapa para ver solo los clientes que están ahí. Quien aún no ha pedido nada no aparece.',
      'Fíjate en el color: amarillo y rojo significan que lleva más tiempo del normal sin moverse en esa etapa. El ⓘ de la leyenda dice desde cuántas horas.',
      'Cada fila dice a quién le toca moverse: al cliente, al compita o a ti. Los primeros de la lista son los más atascados.',
      'Toca la fila para abrir el caso completo: qué pasa, quién tiene que moverse y la línea de tiempo. Desde ahí abres la ficha del cliente, la del compita o el chat.',
    ],
    permiso: 'monitorear', pantalla: 'seguimiento', busca: ['etapas', 'semaforo', 'atascado'],
  },
  {
    id: 'personas', seccion: 'dia_a_dia', titulo: '¿Cómo uso Personas?',
    paraQue: 'La lista de compitas y clientes, para encontrar a alguien, ver su estado y escribir notas.',
    pasos: [
      'Elige Compitas o Clientes arriba. En compitas, elige una vista: por ejemplo los que no responden, los que cancelaron tarde o los que están en pausa.',
      'Busca por nombre o zona, o filtra por Estado: el desplegable solo lista los estados donde hay gente. Toca un título de columna para ordenar. Rojo y amarillo piden atención; gris es nuevo o en pausa.',
      '"Con familias" es un compita activo que ya atiende al menos una familia; no hay un tope de cupo. "Respuesta" es el porcentaje de solicitudes respondidas en 30 días, y "Sin actividad" el tiempo desde su última respuesta o visita.',
      'Toca a la persona para abrir su ficha: paso o estado, cancelaciones, línea de tiempo y notas internas.',
      'Si el compita viene del CMC (el Centro de Mando de selección), la ficha muestra su ID COM-, si el CMC lo permite y lo que le falta para recibir solicitudes. Lo que dice el CMC no se cambia desde aquí: si no lo permite, no se puede verificar ni activar hasta que el CMC lo habilite.',
      'Para ver un correo o teléfono, toca el botón en Contacto. Si no eres administrador te pide un motivo, y queda anotado en Actividad con tu nombre.',
      'Las notas internas las ve solo el equipo. Cada una guarda quién la escribió y cuándo, y no se puede editar ni borrar.',
    ],
    permiso: 'monitorear', pantalla: 'personas', busca: ['compitas', 'clientes', 'buscar', 'ficha'],
  },
  {
    id: 'chats', seccion: 'dia_a_dia', titulo: '¿Cómo veo el chat entre un cliente y su compita?',
    paraQue: 'Para revisar un reclamo o una alerta de contacto compartido leyendo la conversación. Es solo lectura.',
    pasos: [
      'Abre el chat con el botón Chat de una visita, o con "Ver el chat" en la ficha del cliente.',
      'Si no eres administrador, elige un motivo. Si eliges Otro, explícalo en una frase.',
      'Lee la conversación. Los teléfonos y correos que intentaron compartir ya vienen borrados.',
    ],
    despues: 'Cada vez que abres un chat queda anotado en Actividad: quién, cuándo y por qué. Si no se pudo anotar, el chat no se muestra.',
    permiso: 'chats', pantalla: 'visitas', busca: ['conversacion', 'mensajes', 'reclamo', 'privado'],
  },
  {
    id: 'visitas', seccion: 'dia_a_dia', titulo: '¿Cómo uso Visitas?',
    paraQue: 'Vigilar las visitas: cuáles hay hoy, cuáles van en curso y cuáles tuvieron un problema. Aquí no se resuelve: lo que pide acción llega a la Bandeja.',
    pasos: [
      'Elige la vista: Hoy, En curso, Próximas, Terminadas, Con problema o Todas. El número es cuántas hay.',
      '"Con problema" muestra el motivo de cada fila: no inició 30 minutos después de su hora, nadie abrió la puerta, o el cliente la calificó con 3 estrellas o menos.',
      'Toca una fila para ver el detalle de la visita: su historia, quiénes participan y qué conviene hacer si tuvo un problema.',
      'Desde el detalle abres la ficha del cliente, la del compita o el chat (con el permiso de chats). El botón Chat de cada fila también abre la conversación directo.',
    ],
    permiso: 'monitorear', pantalla: 'visitas', busca: ['hoy', 'problema', 'terminadas'],
  },

  // ── Qué hago cuando… ───────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'sit-emergencia', seccion: 'situaciones', titulo: 'Un compita pulsó la emergencia',
    paraQue: 'Es lo más urgente de todo: puede haber una persona en peligro.',
    pasos: [
      'Atiéndela antes que cualquier otra tarea. Suena por Telegram sin tope.',
      'Escríbele al compita por Telegram. Si es una emergencia médica, que llame también a emergencias de su zona.',
      'Mira su visita en curso y el contacto en el sitio, para saber dónde está.',
      'Cuando ya esté atendida, márcala como atendida.',
    ],
    despues: 'El botón de emergencia está siempre disponible para el compita, aunque no tenga una visita.',
    permiso: 'atender', pantalla: 'bandeja', busca: ['peligro', 'urgente', 'sos'],
  },
  {
    id: 'sit-inseguro', seccion: 'situaciones', titulo: 'Un compita dijo "no me siento seguro"',
    paraQue: 'El compita sale de la visita al instante, sin penalización: nunca se le pide confirmar.',
    pasos: [
      'Llega una alerta urgente con el nombre del cliente y la zona.',
      'Contacta al compita por Telegram y confirma que está bien.',
      'Contacta al cliente: ya recibió un correo neutro, sin culpas ni detalles.',
      'Decide, caso por caso, si se le paga la visita al compita. El crédito del cliente no se descuenta.',
    ],
    despues: 'La cancelación queda justificada: no cuenta contra el compita.',
    permiso: 'atender', pantalla: 'bandeja', busca: ['seguridad', 'salida', 'interrumpida'],
  },
  {
    id: 'sit-nadie-abre', seccion: 'situaciones', titulo: 'El compita llegó y nadie abre',
    paraQue: 'Se abre una tarea con cuenta atrás de 30 minutos.',
    pasos: [
      'A los 5 y a los 15 minutos aparece una tarea para escribirle al contacto en el sitio (hoy se hace a mano).',
      'Escríbele sin dar datos del compita. El contacto en el sitio es el que dejó el cliente al agendar.',
      'Si alguien abre, el compita toca "Iniciar visita" y todo sigue normal.',
      'Si pasan los 30 minutos, el compita puede cerrar la visita: se cuenta como usada y el compita cobra el viaje.',
    ],
    permiso: 'atender', pantalla: 'bandeja', busca: ['puerta', 'sin acceso', 'contacto en el sitio'],
  },
  {
    id: 'sit-pago', seccion: 'situaciones', titulo: 'Un cliente dice que ya pagó',
    paraQue: 'Hasta que confirmes que llegó el dinero, el cliente no puede avanzar.',
    pasos: [
      'Llega un aviso con la referencia del pago y un botón "Confirmar pago recibido".',
      'Revisa que el dinero llegó con esa referencia.',
      'Si llegó, toca Confirmar pago en la Bandeja, o el botón del aviso de Telegram. El cliente recibe un correo y puede completar su ficha.',
      'Si no llegó, no confirmes: escríbele por correo.',
    ],
    despues: 'Si el cliente insiste, el pago se marca urgente (una alerta cada 30 minutos). Si pasan 6 horas sin confirmar, se avisa a todos los administradores.',
    permiso: 'pagos', pantalla: 'pagos', busca: ['zelle', 'transferencia', 'confirmar', 'referencia'],
  },
  {
    id: 'sit-reporte-compita', seccion: 'situaciones', titulo: 'Un compita reportó un problema con un cliente',
    paraQue: 'El compita te cuenta con unos toques qué pasó y, si hace falta, pide que lo llames.',
    pasos: [
      'Mira el resumen de la tarea: motivo, cuándo pasó, si el compita está bien y si ya había pasado antes.',
      'Llámalo antes del plazo (24 horas). Escucha y decide: no le pidas datos por teléfono.',
      'Toca "Registrar la llamada" y elige: Resuelto, Hablar con el cliente, Mantener el bloqueo o Levantar el bloqueo.',
      'Si hay visitas o solicitudes abiertas entre los dos, puedes tocar "Cancelar y avisar al cliente": se cancelan sin costo y al cliente no se le dice el motivo.',
    ],
    despues: 'Si marcó "no volver con este cliente", ese cliente ya no puede pedirle nada a ese compita hasta que levantes el bloqueo. Si pasa el plazo sin llamar, el sistema te vuelve a avisar.',
    permiso: 'atender', pantalla: 'bandeja', busca: ['reporte', 'bloqueo', 'llamada', 'no volver'],
  },
  {
    id: 'sit-cuenta-pausada', seccion: 'situaciones', titulo: 'Una cuenta quedó en pausa por compartir contactos',
    paraQue: 'La segunda vez que alguien comparte un contacto en 30 días, su cuenta queda en pausa hasta que decidas.',
    pasos: [
      'Llega una tarea con el nombre, si ya había tenido otra oportunidad y cuántas visitas tiene abiertas.',
      'Mientras está en pausa no escribe en el chat, ni crea solicitudes o visitas; si es compita, no recibe solicitudes. Una visita en curso sigue normal.',
      'Revisa el chat si necesitas contexto (requiere permiso).',
      'Decide: Reactivar, Dar otra oportunidad o Bloquear.',
    ],
    despues: 'Otra oportunidad reactiva la cuenta con una advertencia por escrito: si vuelve a pasar, se pausa de nuevo y se te recomienda bloquear. El sistema nunca bloquea una cuenta por sí solo.',
    permiso: 'cuentas', pantalla: 'personas', busca: ['pausa', 'bloquear', 'contacto externo', 'reactivar'],
  },
  {
    id: 'sit-cita-sin-confirmar', seccion: 'situaciones', titulo: 'Un compita no confirma la hora de una visita',
    paraQue: 'El cliente propuso una hora y la visita no queda agendada hasta que el compita confirme.',
    pasos: [
      'A las 6 horas sin respuesta, el compita recibe un recordatorio con los botones.',
      'A las 24 horas (o si la hora está a menos de 12 horas) se abre esta tarea y el cliente recibe un correo.',
      'Escríbele al compita por Telegram, sin llamar.',
      'Si no puede, ayuda al cliente a elegir otra hora desde su portal.',
    ],
    permiso: 'atender', pantalla: 'bandeja', busca: ['cita', 'confirmar', 'hora', 'agenda'],
  },
  {
    id: 'sit-duda', seccion: 'situaciones', titulo: 'Un compita tiene una duda que el bot no resolvió',
    paraQue: 'El bot responde solo a las dudas comunes. Pasa a una persona después de dos intentos sin resolver.',
    pasos: [
      'Lee la tarea: dice qué preguntó y por qué no se resolvió.',
      'Respóndele por Telegram. Nunca por llamada.',
      'Mira en Más, Estado del sistema, qué dudas son las más comunes: si una domina, arregla la causa (por ejemplo, el campo de indicaciones de la dirección).',
    ],
    permiso: 'atender', pantalla: 'estado', busca: ['ayuda', 'bot', 'duda sin resolver', 'atascado'],
  },
  {
    id: 'sit-cancelaciones', seccion: 'situaciones', titulo: 'Un compita cancela con poco aviso',
    paraQue: 'Las cancelaciones del compita con menos de 24 horas de aviso suman en su historial.',
    pasos: [
      'A las 2 cancelaciones tardías se abre una tarea de revisión: habla con el compita.',
      'A las 3 queda en pausa: no recibe solicitudes nuevas hasta que lo resuelvas.',
      'Si tuvo una razón válida, abre su ficha y marca la cancelación como justificada: deja de contar y la pausa se levanta sola.',
    ],
    despues: 'Las cancelaciones por seguridad o cambio de lugar ya vienen justificadas. Los umbrales se cambian en Ajustes.',
    permiso: 'cuentas', pantalla: 'personas', busca: ['cancelacion', 'tardia', 'pausa', 'justificada'],
  },
  {
    id: 'sit-aviso-fallido', seccion: 'situaciones', titulo: 'Un aviso no llegó',
    paraQue: 'Cada aviso queda guardado con su resultado.',
    pasos: [
      'Abre Más, Avisos enviados y filtra por Fallidos.',
      'Mira el motivo: por ejemplo, el compita bloqueó el bot o el correo rebotó.',
      'Toca Reintentar. Si falla otra vez, el aviso sigue en la lista con el motivo; tras 5 intentos ya no deja y hay que escribirle a la persona directamente.',
    ],
    despues: 'Un compita sin Telegram vinculado no puede trabajar en Compaz: pídele que vuelva a vincularlo.',
    pantalla: 'avisos', busca: ['fallido', 'correo', 'telegram', 'reintentar'],
  },
  {
    id: 'sit-cambio-lugar', seccion: 'situaciones', titulo: 'Un cliente cambió quién estará en la visita',
    paraQue: 'El compita decide si sigue con la visita. Sin penalización si prefiere no ir.',
    pasos: [
      'El compita recibe al instante un aviso con "antes" y "ahora".',
      'Si no responde, se abre una tarea; es urgente si faltan menos de 24 horas.',
      'Escríbele por Telegram y mira si el cliente ya le escribió por el chat.',
      'Si el compita prefiere no ir, la visita vuelve a coordinación y el cliente elige otra hora o compita sin costo.',
    ],
    permiso: 'atender', pantalla: 'bandeja', busca: ['personas presentes', 'lugar'],
  },
  {
    id: 'sit-alargada', seccion: 'situaciones', titulo: 'Una visita se pasó de su hora',
    paraQue: 'El sistema le pregunta al compita "¿todo bien?" cuando pasan 15 minutos de la hora de fin.',
    pasos: [
      'Si responde que todo bien, no hay nada que hacer.',
      'Si pide ayuda, o no responde en 10 minutos, llega una alerta urgente y una tarea.',
      'Contacta al compita por Telegram para saber cómo está.',
    ],
    permiso: 'atender', pantalla: 'bandeja', busca: ['todo bien', 'alargada', 'fin de visita'],
  },
  {
    id: 'sit-resenas', seccion: 'situaciones', titulo: 'Hay reseñas por aprobar',
    paraQue: 'Lo que el cliente escribe no se ve en el perfil del compita hasta que lo apruebes.',
    pasos: [
      'Abre Más, Reseñas por aprobar.',
      'Aprobar publica la reseña y cuenta en la calificación.',
      'Ocultar una reseña ya publicada la devuelve a Por aprobar: deja de verse en el perfil y el cliente no recibe ningún aviso.',
    ],
    permiso: 'atender', pantalla: 'resenas', busca: ['calificacion', 'comentario', 'rating'],
  },

  // ── Cuentas y personas ─────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'cta-bloquear', seccion: 'cuentas', titulo: '¿Cómo pauso o bloqueo una cuenta?',
    paraQue: 'Pausar es reversible; bloquear quita el acceso.',
    pasos: [
      'Abre la ficha de la persona en Personas.',
      'Elige la acción. Bloquear a un cliente le impide entrar; bloquear a un compita lo saca del listado y le desvincula Telegram.',
      'La acción queda anotada con tu nombre.',
    ],
    despues: 'Eliminar la cuenta (solo el administrador, escribiendo ELIMINAR) cierra el acceso para siempre y conserva todo el historial con el nombre y la marca "(cuenta eliminada)". Si la persona pidió que se borren sus datos, marca esa casilla y se anonimiza: se borran nombre, contacto, ficha, fotos y mensajes, y quedan solo pagos y visitas sin datos que la identifiquen. Una visita en curso o, en un compita, visitas abiertas, impiden eliminar.',
    permiso: 'cuentas', pantalla: 'personas', busca: ['bloqueo', 'suspender', 'eliminar'],
  },
  {
    id: 'cta-compita-perfil', seccion: 'cuentas', titulo: '¿Cómo registro a un compita a mano o corrijo su perfil?',
    paraQue: 'Para dar de alta a un compita sin esperar a que llene el formulario, o arreglar su zona, descripción, servicios, video o foto.',
    pasos: [
      'Para registrarlo: abre Más, Invitar y baja a "Registrar un compita a mano". Llena nombre, zona, descripción y al menos un servicio.',
      'Para corregir un perfil: abre su ficha en Personas y toca "Editar perfil".',
      'Un compita registrado a mano queda inactivo y sin verificar: verifícalo y actívalo desde su ficha.',
    ],
    despues: 'Si pusiste correo al registrarlo, recibe la bienvenida. La foto debe ser JPG, PNG o WEBP de máximo 5 MB.',
    permiso: 'cuentas', pantalla: 'personas', busca: ['registrar compita', 'perfil', 'foto', 'editar'],
  },
  {
    id: 'cta-destrabar', seccion: 'cuentas', titulo: '¿Cómo destrabo una visita o una solicitud a mano?',
    paraQue: 'Para casos que quedaron a medias y nadie puede cerrar solo.',
    pasos: [
      'Visita que quedó abierta: ábrela en Visitas y toca "Cerrar la visita ahora". Se le avisa al compita por Telegram.',
      'Solicitud con llamada: en Seguimiento abre el caso. "Reenviar enlace de llamada" vuelve a mandar el enlace a la familia y al compita; "Marcar como completada" cierra la solicitud cuando la llamada ya ocurrió.',
    ],
    despues: 'Cada acción pide confirmar y queda anotada con tu nombre. El enlace de una llamada se puede reenviar como máximo una vez cada 5 minutos por solicitud, y solo mientras la solicitud siga aceptada.',
    permiso: 'atender', pantalla: 'visitas', busca: ['cerrar visita', 'enlace de llamada', 'completar solicitud', 'forzar'],
  },
  {
    id: 'cta-invitar', seccion: 'cuentas', titulo: '¿Cómo invito a un cliente o registro a un compita?',
    paraQue: 'Para sumar personas sin que tengan que registrarse solas.',
    pasos: [
      'Abre Más, Invitar.',
      'Para un cliente: escribe su nombre y correo y toca "Enviar invitación". Recibe un correo con su enlace para entrar, sin contraseña.',
      'Para un compita: toca "Generar enlace", cópialo y mándaselo. Lleva al formulario de registro y vale 7 días.',
    ],
    despues: 'Si el cliente ya estaba registrado no se le reinvita: que pida un enlace nuevo en la página de entrada. Los postulantes que llegan por la página se ven en Más, Postulaciones y origen, con la campaña desde la que llegaron.',
    permiso: 'invitar', pantalla: 'invitar', busca: ['invitacion', 'registro', 'postulacion', 'reclutar'],
  },
  {
    id: 'cta-postulaciones', seccion: 'cuentas', titulo: '¿Cómo veo de dónde llegan las postulaciones y resuelvo las que no llegaron a Airtable?',
    paraQue: 'Para saber qué campañas traen gente que califica y para que ninguna postulación quede invisible para el equipo de selección.',
    pasos: [
      'Abre Más, Postulaciones y origen.',
      'Arriba, si hay postulaciones "Sin llegar a Airtable", elige cómo resolver cada una: ya está en Airtable (pega el ID que empieza por "rec"), la registraste directo en el CMC (escribe el ID COM-) o no procede (escribe el motivo). Toca Resolver.',
      'Más abajo, "De dónde llegan" cuenta cuántas postulaciones trajo cada campaña y cuántas calificaron. Usa los filtros para ver solo familias o aspirantes a compita, o solo las calificadas.',
    ],
    despues: 'La resolución queda guardada con tu correo, la nota y la fecha, y la postulación sale de la lista. Teléfono y correo solo aparecen en las que están por resolver, y esta pantalla es solo para administradores.',
    permiso: 'cuentas', pantalla: 'postulaciones', busca: ['postulaciones', 'campana', 'origen', 'airtable', 'calificada'],
  },
  {
    id: 'cta-equipo', seccion: 'cuentas', titulo: '¿Cómo agrego a alguien al equipo y le doy permisos?',
    paraQue: 'Cada colaborador tiene solo lo que necesita. Solo los administradores pueden hacerlo.',
    pasos: [
      'Abre Más, Equipo y permisos. Escribe el nombre y el correo de la persona y toca Invitar: entra con los permisos recomendados. No se le manda ningún correo, así que avísale tú.',
      'Toca su nombre para abrir sus permisos y enciende o apaga cada uno con su interruptor. El cambio rige al instante.',
      'Si te equivocas, toca "Restablecer a lo recomendado". Para pausarlo, "Desactivar" (se puede reactivar). Para sacarlo del todo, "Quitar del equipo": hay que invitarlo de nuevo si vuelve.',
      'Para agregar o quitar un administrador no se usa esta pantalla: se cambia la variable ADMIN_EMAILS en Netlify y se vuelve a desplegar.',
    ],
    despues: 'Un colaborador nunca puede dar permisos, ni a sí mismo. Cada alta, cambio y desactivación queda en el historial de esta pantalla, que nadie puede editar ni borrar.',
    permiso: 'raiz', pantalla: 'equipo', busca: ['colaborador', 'permisos', 'administrador'],
  },

  // ── Configuración y control ────────────────────────────────────────────────────────────────────────────────
  {
    id: 'cfg-ajustes', seccion: 'configuracion', titulo: '¿Cómo cambio un precio, un plazo o un tope?',
    paraQue: 'Todo lo configurable vive en Ajustes: no hay que tocar el código.',
    pasos: [
      'Abre Más, Ajustes y busca el valor. Pasa el cursor por el ⓘ de cada uno para ver dónde se usa y cuál es su valor de fábrica.',
      'Cámbialo. Puedes cambiar varios a la vez. Si algo no tiene sentido (por ejemplo, un plan más caro que las horas sueltas), el sistema te lo avisa y pide confirmación.',
      'Toca "Guardar y aplicar". Se guarda todo o nada: si un valor no sirve, no se guarda ningún cambio.',
    ],
    despues: 'El cambio rige desde ese momento en todo el sistema y queda anotado quién lo hizo y cuándo (abajo, en Cambios recientes). Lo que ya se pagó no cambia. Los ajustes marcados "Aún no conectado" se ven pero no se pueden cambiar, porque el sistema todavía no los lee. Los precios, los plazos de retención de datos y todos los textos solo los cambia el administrador (a un colaborador le salen bloqueados, marcados "Solo administrador"). Sin el permiso de cambiar ajustes, los campos se ven pero no se pueden editar. Si algo falla a mitad de guardar varios cambios, se deshace todo lo aplicado.',
    permiso: 'ajustes_editar', pantalla: 'ajustes', busca: ['precios', 'plazos', 'topes', 'configuracion'],
  },
  {
    id: 'cfg-umbrales', seccion: 'configuracion', titulo: '¿Qué es el semáforo y cómo lo ajusto?',
    paraQue: 'Define cuántas horas son normales en cada etapa antes de pasar a amarillo y a rojo.',
    pasos: [
      'Abre Más, Ajustes del semáforo.',
      'Cambia las horas de cada etapa. El rojo siempre debe llegar después del amarillo.',
      'Toca "Guardar y aplicar".',
    ],
    despues: 'No cambia nada ya registrado: solo cómo se colorea desde ahora en Seguimiento y en el detalle de cada caso.',
    permiso: 'ajustes_editar', pantalla: 'umbrales', busca: ['semaforo', 'amarillo', 'rojo', 'etapas'],
  },
  {
    id: 'cfg-pagos', seccion: 'configuracion', titulo: '¿Cómo registro o anulo un pago?',
    paraQue: 'Los pagos activan las visitas del cliente.',
    pasos: [
      'Abre Más, Pagos. Verás los pagos registrados, el más reciente primero, con filtros Activos y Anulados.',
      'Anular: solo si hubo un error. Escribe el motivo; las visitas que no se habían usado se liberan y el cupo del cliente se recalcula.',
      'Un pago nuevo entra por la confirmación de la Bandeja (Zelle o transferencia) o, mientras no esté Stripe, como pago simulado. Registrar un pago a mano no está en este panel a propósito.',
    ],
    permiso: 'pagos', pantalla: 'pagos', busca: ['zelle', 'plan', 'anular', 'registrar'],
  },
  {
    id: 'cfg-cobertura', seccion: 'configuracion', titulo: '¿Para qué sirve Cobertura y demanda?',
    paraQue: 'Por estado, compara los compitas disponibles con las solicitudes del último mes.',
    pasos: [
      'Abre Más, Cobertura y demanda.',
      'Busca los estados en rojo: ahí no hay compitas o la demanda duplica a la oferta.',
      'Ahí es donde conviene reclutar.',
    ],
    permiso: 'monitorear', pantalla: 'cobertura', busca: ['zonas', 'reclutar', 'demanda'],
  },
  {
    id: 'cfg-estado', seccion: 'configuracion', titulo: '¿Cómo sé si todo está funcionando?',
    paraQue: 'Estado del sistema muestra si los procesos automáticos corren, qué avisos fallaron y qué preguntan los compitas.',
    pasos: [
      'Abre Más, Estado del sistema.',
      'Los procesos deben verse en verde. Si uno pasa 3 veces su intervalo sin dar señal, se pone en rojo y llega una alerta por Telegram.',
      'Si hay avisos fallidos, lee el motivo y toca Reintentar. Tras 5 intentos ya no deja: arregla la causa y escríbele a la persona directamente.',
      'Mira las dudas de los compitas de la semana: sirven para mejorar los textos y los formularios. Telegram, correo y videollamadas no se prueban desde aquí.',
    ],
    permiso: 'monitorear', pantalla: 'estado', busca: ['salud', 'procesos', 'automaticos', 'dudas'],
  },
  {
    id: 'cfg-limites', seccion: 'configuracion', titulo: '¿Por qué el sistema no me deja repetir algo enseguida?',
    paraQue: 'Hay plazos y máximos a propósito. Cuando alguien se topa con uno, el mensaje le explica por qué y cuándo puede seguir.',
    pasos: [
      'Abre Más, Límites y esperas.',
      'Filtra por quién se topa con cada regla: compitas, clientes o equipo.',
      'Toca el ⓘ de una regla para ver por qué existe.',
    ],
    despues: 'Los valores que se pueden cambiar (como las horas entre recordatorios) están en Ajustes.',
    permiso: 'monitorear', pantalla: 'limites', busca: ['espera', 'plazo', 'restriccion', 'maximo', 'no puedo'],
  },
  {
    id: 'cfg-hizo-colaborador', seccion: 'configuracion', titulo: '¿Cómo sé qué hizo un colaborador?',
    paraQue: 'Para revisar el trabajo de alguien del equipo o aclarar quién resolvió, confirmó o decidió algo.',
    pasos: [
      'Abre Más, Actividad y busca el correo de la persona.',
      'Verás lo que dejó anotado: tareas que resolvió, pagos que confirmó, decisiones sobre cuentas en pausa, avisos que reenvió y llamadas que registró.',
      'Para saber qué datos sensibles consultó, abre Más, Registro de accesos y busca su correo.',
    ],
    despues: 'No todo queda en Actividad con su nombre: las notas internas llevan el correo de quien las escribió en la ficha, y los cambios de permisos quedan en un historial aparte del equipo.',
    permiso: 'monitorear', pantalla: 'actividad', busca: ['colaborador', 'quien hizo', 'auditoria', 'equipo', 'correo'],
  },
  {
    id: 'cfg-registro', seccion: 'configuracion', titulo: '¿Cómo veo quién consultó datos sensibles?',
    paraQue: 'Quién del equipo vio un teléfono, un correo o un chat, de quién, cuándo y por qué. Protege a las familias, a los compitas y a ti.',
    pasos: [
      'Abre Más, Registro de accesos. Necesitas el permiso de teléfonos.',
      'Elige el periodo: hoy, 7, 30, 90 días o 1 año.',
      'Busca por el nombre de la persona consultada, por el correo de quien lo vio o por el motivo.',
      'Cada línea dice quién abrió qué (correo, teléfono o chat), de quién, cuándo y con qué motivo.',
    ],
    despues: 'No se puede editar ni borrar a mano. Se borra sola pasado el plazo de Más, Manual, "Cuánto tiempo se guarda cada cosa": hoy es un año, más que el resto de la actividad.',
    permiso: 'telefonos', pantalla: 'registro', busca: ['auditoria', 'quien vio', 'privacidad'],
  },
  {
    id: 'cfg-manual', seccion: 'configuracion', titulo: '¿Cómo uso este manual?',
    paraQue: 'Responde las preguntas más comunes del equipo y se mantiene al día con el sistema.',
    pasos: [
      'Busca con tus propias palabras (por ejemplo "no abre", "pago" o "pausa").',
      'O elige una sección y abre la pregunta.',
      'Las entradas apagadas necesitan un permiso que no tienes.',
    ],
    despues: 'Los permisos y los límites de abajo se arman solos desde el sistema, así que nunca quedan viejos.',
    pantalla: 'manual', busca: ['ayuda', 'como se usa', 'manual'],
  },
]

// ── Contenido automático (siempre al día) ──────────────────────────────────────────────────────────────────────
export interface FilaAutomatica { id: string; titulo: string; texto: string }

/** Qué puede hacer cada permiso: sale directo del catálogo de permisos. */
export function permisosDelManual(): FilaAutomatica[] {
  return PERMISOS.map((p) => ({ id: p, titulo: ETIQUETA_PERMISO[p], texto: `Permiso "${p}".` }))
}

/** Los límites y esperas del sistema con su razón: salen del catálogo de esperas. */
export function limitesDelManual(): FilaAutomatica[] {
  return (Object.keys(ESPERAS) as ClaveEspera[]).map((k) => ({ id: k, titulo: ESPERAS[k].limita, texto: ESPERAS[k].porQue }))
}

/**
 * Búsqueda simple y tolerante: sin tildes ni mayúsculas, y todas las palabras deben aparecer. Los resultados salen ORDENADOS por relevancia:
 * primero donde la palabra está en el título o en las palabras clave, y al final donde solo se menciona de pasada en un paso.
 */
const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function buscarEnManual(consulta: string, entradas: EntradaManual[] = ENTRADAS): EntradaManual[] {
  const palabras = norm(consulta).split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return entradas
  const puntuadas = entradas.map((e, orden) => {
    const campos = { titulo: norm(e.titulo), clave: norm((e.busca ?? []).join(' ')), paraQue: norm(e.paraQue), resto: norm([...e.pasos, e.despues ?? ''].join(' ')) }
    let puntos = 0
    for (const p of palabras) {
      const en = campos.titulo.includes(p) ? 5 : campos.clave.includes(p) ? 4 : campos.paraQue.includes(p) ? 2 : campos.resto.includes(p) ? 1 : 0
      if (en === 0) return { e, orden, puntos: -1 } // falta una palabra: no coincide
      puntos += en
    }
    return { e, orden, puntos }
  })
  return puntuadas.filter((x) => x.puntos >= 0).sort((a, b) => b.puntos - a.puntos || a.orden - b.orden).map((x) => x.e)
}

/** ¿Esta persona puede hacer lo que explica la entrada? (la entrada igual se muestra, apagada) */
export function puedeLaEntrada(e: EntradaManual, permisos: Partial<Record<Permiso, boolean>>, esAdmin: boolean): boolean {
  if (!e.permiso) return true
  if (esAdmin) return true
  if (e.permiso === 'raiz') return false
  return permisos[e.permiso] === true
}
