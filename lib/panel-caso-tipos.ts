// El "caso" de un cliente: su situación explicada al equipo (lógica PURA). Cada uno de los 30 estados del motor del portal
// (lib/estado-cliente.ts) tiene aquí su frase y quién tiene que moverse. Al ser un Record exhaustivo, un estado nuevo no compila sin su frase.
import type { CodigoEstado } from '@/lib/estado-cliente'
import type { Urgencia, EventoLinea } from '@/lib/panel-personas-tipos'
import type { Etapa } from '@/lib/panel-seguimiento-tipos'

export type Espera = 'cliente' | 'compita' | 'equipo' | 'nadie'
export const ETIQUETA_ESPERA: Record<Espera, string> = { cliente: 'Espera al cliente', compita: 'Espera al compita', equipo: 'Te toca a ti', nadie: 'Nada pendiente' }

export const SITUACION: Record<CodigoEstado, { que: string; espera: Espera }> = {
  bienvenida: { que: 'Aún no ha pedido nada.', espera: 'cliente' },
  solicitud_enviada: { que: 'Pidió una entrevista. El aviso al compita todavía no consta como entregado.', espera: 'compita' },
  solicitud_recibida: { que: 'Pidió una entrevista y el compita ya recibió el aviso. Falta que responda.', espera: 'compita' },
  directa_enviada: { que: 'Pidió una visita directa y el compita aún no responde.', espera: 'compita' },
  mandado_enviado: { que: 'Pidió un mandado y el compita aún no responde.', espera: 'compita' },
  todas_rechazadas: { que: 'Todos los compitas a los que escribió dijeron que no. Debe elegir a otro.', espera: 'cliente' },
  elegir_horario: { que: 'El compita aceptó. Falta que el cliente elija la hora de la entrevista.', espera: 'cliente' },
  horario_pedido: { que: 'El cliente pidió una hora de entrevista. Falta que el compita la confirme.', espera: 'compita' },
  horario_rechazado: { que: 'El compita no puede en la hora pedida. El cliente debe elegir otra.', espera: 'cliente' },
  entrevista_programada: { que: 'Entrevista confirmada. Todavía no llega la hora.', espera: 'nadie' },
  entrevista_ahora: { que: 'La entrevista es ahora o está por empezar.', espera: 'nadie' },
  decidir: { que: 'Terminó la entrevista. El cliente debe decidir si contrata.', espera: 'cliente' },
  motivo_no: { que: 'Dijo que no contrata. Falta que cuente el motivo.', espera: 'cliente' },
  directa_aceptada: { que: 'El compita aceptó la visita directa. Falta que el cliente pague.', espera: 'cliente' },
  pagar: { que: 'Decidió contratar. Falta que pague.', espera: 'cliente' },
  pago_revision: { que: 'Dice que ya pagó. El equipo debe confirmar el pago y aún falta su ficha.', espera: 'equipo' },
  ficha_lista_espera: { que: 'Dice que ya pagó y su ficha está completa. Solo falta que el equipo confirme el pago.', espera: 'equipo' },
  ficha: { que: 'Falta que complete la ficha de su familiar para poder agendar.', espera: 'cliente' },
  agendar_visita: { que: 'Todo listo. Falta que agende su visita.', espera: 'cliente' },
  cita_pendiente: { que: 'El cliente propuso una hora de visita. Falta que el compita la confirme.', espera: 'compita' },
  visita_programada: { que: 'Visita programada. Todavía no llega la hora.', espera: 'nadie' },
  compita_llego: { que: 'El compita llegó. Falta que la visita empiece.', espera: 'cliente' },
  nadie_abre: { que: 'El compita llegó y nadie abre la puerta. Hay que actuar.', espera: 'equipo' },
  visita_en_curso: { que: 'Hay una visita en curso ahora.', espera: 'nadie' },
  visita_interrumpida: { que: 'La visita se interrumpió por seguridad. Hay que revisarla.', espera: 'equipo' },
  visita_cancelada_equipo: { que: 'El equipo canceló una visita hace poco.', espera: 'nadie' },
  visita_terminada: { que: 'Terminó una visita hace poco. Se espera su valoración.', espera: 'cliente' },
  agendar_otra: { que: 'Tiene plan y compita. Puede agendar otra visita.', espera: 'cliente' },
  plan_agotado: { que: 'Se le acabaron las visitas del plan. Debe renovar.', espera: 'cliente' },
  cuenta_pausada: { que: 'La cuenta está en pausa por compartir contactos. El equipo debe decidir.', espera: 'equipo' },
}

export interface CasoCliente {
  id: string; nombre: string; compitaId: string | null; compita: string | null
  etapa: Etapa; urgencia: Urgencia; horas: number
  que: string; espera: Espera
  linea: EventoLinea[]
  /** La solicitud más reciente: sobre ella actúan los botones del caso. */
  solicitud: { id: string; estado: string; conLlamada: boolean } | null
}

/** El id del caso en la dirección (?caso=). Solo un id válido de cliente. */
export const leerCasoUrl = (v: unknown): string | null => (typeof v === 'string' && /^[0-9a-zA-Z-]{8,64}$/.test(v) ? v : null)
