// "¿Qué me toca?": le dice al compita en qué situación está AHORA, qué espera de otros y si tiene algo pendiente él.
// Se deriva del ESTADO REAL (visita, llegada, reserva, solicitud, cambio de lugar, y los pasos a medias del bot) en el momento de
// preguntar: no se guarda nada de lo último que tocó, así nunca puede responder algo viejo.
//
// REGLA: nunca deja al compita en el aire. Solo dice "nada pendiente" si de verdad no hay ni espera ni acción; y si existe algo
// activo que esta función no reconoce, responde con una guía general y cómo pedir ayuda (nunca se queda callada ni dice que no hay nada).

import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjustes } from '@/lib/ajustes'
import { inicioDeLaCita } from '@/lib/direccion'
import { compitaEnPausa } from '@/lib/cancelaciones'
import { formatFechaVE } from '@/lib/format'
import { versionCita } from '@/lib/citas'
import { qRol } from '@/lib/links'
import { esc } from '@/lib/html'
import { PLANTILLAS } from '@/lib/plantillas-aviso'
import type { InlineKeyboard } from '@/lib/telegram'

type Boton = { text: string; callback_data?: string; url?: string }
interface Item { tipo: 'turno' | 'espera'; orden: number; texto: string; botones?: Boton[][] }
export interface Situacion {
  texto: string; teclado: InlineKeyboard | null; hayAlgo: boolean
  /** Códigos estables de lo que se le explicó (para medir dónde se atascan los compitas; nunca el texto). */
  codigos: string[]
  /** Códigos de lo que LE TOCA a él (acciones pendientes). */
  codigosTurno: string[]
  /** true si cayó en la guía general: había algo activo que el sistema no supo explicar. */
  noReconocido: boolean
}

/** Código estable de cada explicación. Una prueba comprueba que cada situación tiene el suyo. */
const CODIGOS: [RegExp, string][] = [
  [/pregunta \d de 4/, 'cuestionario'], [/último paso/, 'cuestionario_novedad'], [/Dijiste que no podías/, 'sugerir_horarios'], [/Falta la foto de tu llegada/, 'foto_llegada'],
  [/confirmar que vas a empezar/, 'confirmar_iniciar'], [/confirmar que terminaste/, 'confirmar_terminar'], [/pasó la hora de fin/, 'todo_bien'], [/Estás en una visita/, 'en_curso'],
  [/confirme que llegaste/, 'confirmando_inicio'], [/Puedes cerrar la visita/, 'nadie_abre_cerrar'], [/espera de hasta/, 'nadie_abre_espera'], [/Ya registraste tu llegada/, 'llegada_sin_iniciar'],
  [/no la iniciaste/, 'visita_vencida'], [/Ya tienes la dirección/, 'direccion_entregada'], [/todavía no registró la dirección/, 'direccion_faltante'], [/La dirección te llega/, 'visita_futura'],
  [/te escribió por el chat/, 'chat_cliente_espera_respuesta'], [/Estás coordinando la fecha/, 'coordinacion'], [/cambió quién estará/, 'cambio_lugar'], [/eligió el horario de la visita/, 'cita_por_confirmar'], [/falta que la confirmes/, 'reserva_por_confirmar'],
  [/espera tu respuesta/, 'solicitud_por_responder'], [/eligiendo una de tus horas libres/, 'espera_cliente_hora'], [/Tienes una videollamada/, 'videollamada_proxima'], [/Cuéntanos cómo estuvo/, 'videollamada_feedback'],
  [/Esperamos su pago/, 'espera_pago'], [/en pausa por varias cancelaciones/, 'pausa'], [/no cargaste tus horas libres/, 'sin_horas'], [/no sabemos explicarte/, 'guia_general'],
]
const codigoDe = (texto: string) => CODIGOS.find(([r]) => r.test(texto))?.[1] ?? 'otro'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''
const primero = (n: unknown) => esc(String(n ?? '').split(' ')[0] || 'el cliente')
const hora = (hhmm: string | null) => (hhmm ? hhmm.slice(0, 5) : '')
const minutosDesde = (iso: string, ahora: Date) => Math.max(0, Math.floor((ahora.getTime() - new Date(iso).getTime()) / 60_000))
const vigente = (expira: string | null | undefined, ahora: Date) => !!expira && new Date(expira).getTime() > ahora.getTime()
const AYUDA = 'Si no sabes qué hacer, escríbenos a hola@micompaz.com y te ayudamos.'

type VisitaQ = {
  id: string; usuario_id: string; estado: string; fecha_programada: string | null; hora_inicio_programada: string | null; hora_fin_programada: string | null
  llegada_en: string | null; sin_acceso_en: string | null; direccion: string | null; usuario: { nombre: string } | null
  cita_propuesta_fecha: string | null; cita_propuesta_inicio: string | null; cita_propuesta_fin: string | null; cita_propuesta_en: string | null
}
type Sol = { id: string; estado: string; tipo: string | null; slot_confirmado: string | null; slots_propuestos: string[] | null; cliente_id: string; token_respuesta: string; usuarios: { nombre: string } | null }
type Estado = { chat_id: string; pendiente_accion: string | null; pendiente_expira: string | null }

export async function situacionDelCompita(compitaId: string, ahora: Date = new Date(), chatId?: string): Promise<Situacion> {
  const admin = createAdminSupabase()
  const a = await getAjustes()
  const espera = Number(a.nadie_abre_espera_min); const horasDir = Number(a.direccion_horas_antes)
  const filasEstado = chatId ? [chatId, `conf:${chatId}`, `lleg:${chatId}`] : []
  const [{ data: vs }, { data: cambios }, { data: reservas }, { data: sols }, { data: cmp }, { data: estados }] = await Promise.all([
    admin.from('visitas').select('id, usuario_id, estado, fecha_programada, hora_inicio_programada, hora_fin_programada, llegada_en, sin_acceso_en, direccion, cita_propuesta_fecha, cita_propuesta_inicio, cita_propuesta_fin, cita_propuesta_en, usuario:usuarios(nombre)')
      .eq('compita_id', compitaId).in('estado', ['pre_visita', 'programada', 'confirmando_inicio', 'en_curso']),
    admin.from('cambios_lugar').select('id, visita_id').eq('compita_id', compitaId).eq('estado', 'pendiente'),
    admin.from('reservas_horario').select('id, cliente_id, inicio, vence_en').eq('compita_id', compitaId).eq('estado', 'reservada').gt('vence_en', ahora.toISOString()),
    admin.from('solicitudes').select('id, cliente_id, estado, tipo, slot_confirmado, slots_propuestos, token_respuesta, created_at, usuarios(nombre)').eq('compita_id', compitaId).in('estado', ['pendiente', 'aceptada']),
    admin.from('compitas').select('horarios_disponibles').eq('id', compitaId).maybeSingle(),
    filasEstado.length ? admin.from('telegram_estados').select('chat_id, pendiente_accion, pendiente_expira').in('chat_id', filasEstado) : Promise.resolve({ data: [] }),
  ])
  const visitas = (vs ?? []) as unknown as VisitaQ[]
  const solicitudes = (sols ?? []) as unknown as Sol[]
  const items: Item[] = []
  const manejadas = new Set<string>() // lo activo que sí supimos explicar; lo demás cae en la guía general

  // ── Pasos a medias en el bot (lo que está esperando que el compita haga AHORA) ─────────────────────────────────
  for (const e of (estados ?? []) as Estado[]) {
    if (!vigente(e.pendiente_expira, ahora) || !e.pendiente_accion) continue
    const acc = e.pendiente_accion
    if (e.chat_id === chatId) {
      if (acc.startsWith('reporte:') || acc.startsWith('reporte_r:')) {
        const paso = Math.min(4, Number(acc.split(':')[2] ?? 0) + 1)
        items.push({ tipo: 'turno', orden: 0, texto: `Te falta registrar cómo estuvo tu última visita (pregunta ${paso} de 4). Le llega a la familia como una actualización y toma un minuto.`, botones: [[{ text: 'Continuar el cuestionario', callback_data: 'reanudar_reporte' }]] })
      } else if (acc.startsWith('reporte_novedad:')) {
        items.push({ tipo: 'turno', orden: 0, texto: `Solo te falta un último paso: contarle a la familia algo de la visita (una anécdota o un avance). Es opcional: puedes saltarlo.`, botones: [[{ text: 'Escribirlo', callback_data: 'reanudar_reporte' }], [{ text: 'Saltar', callback_data: 'rn:skip' }]] })
      } else if (acc.startsWith('sugerir_horarios:') || acc.startsWith('sugerir_r:')) {
        items.push({ tipo: 'turno', orden: 0, texto: `Dijiste que no podías en los horarios del cliente. Para ayudarlo, responde al mensaje del bot escribiendo los días y horas que sí te funcionan (por ejemplo: lunes 6 de octubre a las 3:00 pm). Se los hacemos llegar por correo.` })
      }
    } else if (e.chat_id === `lleg:${chatId}` && acc.startsWith('llegada:')) {
      items.push({ tipo: 'turno', orden: 0, texto: `Falta la foto de tu llegada: tómale una foto a la fachada o a la puerta y envíala aquí. Sin ella no podemos avisar a la familia ni iniciar la visita.` })
    } else if (e.chat_id === `conf:${chatId}`) {
      if (acc.startsWith('iniciar:')) items.push({ tipo: 'turno', orden: 0, texto: `Tienes pendiente confirmar que vas a empezar la visita.`, botones: [[{ text: 'Sí, iniciar', callback_data: 'Sí, iniciar' }]] })
      else if (acc.startsWith('terminar:')) items.push({ tipo: 'turno', orden: 0, texto: `Tienes pendiente confirmar que terminaste la visita.`, botones: [[{ text: 'Sí, terminar', callback_data: 'Sí, terminar' }]] })
    }
  }

  // ── Visitas: lo más urgente primero ─────────────────────────────────────────────────────────────────────────
  for (const v of visitas) {
    const cli = primero(v.usuario?.nombre)
    const inicio = inicioDeLaCita(v.fecha_programada, v.hora_inicio_programada); const fin = inicioDeLaCita(v.fecha_programada, v.hora_fin_programada)
    const antes = items.length
    if (v.cita_propuesta_en && v.cita_propuesta_fecha && v.cita_propuesta_inicio && v.cita_propuesta_fin && ['pre_visita', 'programada'].includes(v.estado)) {
      // El cliente eligió una hora y falta que ella la confirme: es lo que le toca ahora.
      const v6 = versionCita(v.cita_propuesta_en)
      items.push({ tipo: 'turno', orden: 1, texto: `<b>${cli}</b> eligió el horario de la visita (${esc(formatFechaVE(v.cita_propuesta_fecha, true))}, ${hora(v.cita_propuesta_inicio)} a ${hora(v.cita_propuesta_fin)}, hora de Caracas) y falta que lo confirmes.`, botones: [[{ text: 'Confirmo la cita', callback_data: `cita:ok:${v.id}:${v6}` }], [{ text: 'No puedo a esa hora', callback_data: `cita:no:${v.id}:${v6}` }]] })
      manejadas.add(v.id)
    } else if (v.estado === 'en_curso') {
      const pasado = fin && ahora.getTime() > fin.getTime() + Number(a.todo_bien_min) * 60_000
      if (pasado) items.push({ tipo: 'turno', orden: 1, texto: `Tu visita con <b>${cli}</b> ya pasó la hora de fin (${hora(v.hora_fin_programada)}). Responde: ¿todo bien? Si ya terminaste, toca Terminar visita.`, botones: [[{ text: 'Todo bien', callback_data: `tb:ok:${v.id}` }], [{ text: 'Necesito ayuda', callback_data: `tb:ayuda:${v.id}` }]] })
      else items.push({ tipo: 'turno', orden: 2, texto: `Estás en una visita con <b>${cli}</b>${v.hora_fin_programada ? ` que termina a las ${hora(v.hora_fin_programada)}` : ''}. Cuando termines toca Terminar visita. Si algo no está bien, toca No me siento seguro o Emergencia.` })
    } else if (v.estado === 'confirmando_inicio') {
      items.push({ tipo: 'espera', orden: 3, texto: `Estás esperando que <b>${cli}</b> confirme que llegaste. Se confirma sola en unos minutos; no tienes nada que hacer. Si algo no está bien, toca No me siento seguro.` })
    } else if (v.estado === 'programada' && v.sin_acceso_en) {
      // El caso clave: nadie abre. Qué pasa, que su tiempo se paga y qué esperar.
      const min = minutosDesde(v.sin_acceso_en, ahora); const faltan = Math.max(0, espera - min)
      if (faltan === 0) items.push({ tipo: 'turno', orden: 0, texto: `Ya pasaron ${espera} minutos y nadie abrió a <b>${cli}</b>. Puedes cerrar la visita: se cuenta como usada y cobras el viaje. Si el cliente aparece antes, toca Iniciar visita.`, botones: [[{ text: 'Cerrar visita sin acceso', callback_data: `sinacceso:${v.id}` }]] })
      else items.push({ tipo: 'espera', orden: 0, texto: `Estás en una espera de hasta ${espera} minutos porque nadie abre a <b>${cli}</b> (van ${min}, faltan ${faltan}). Tu tiempo se paga: la visita cuenta como usada y cobras el viaje. Solo espera cerca: Compaz avisa al cliente y al contacto en el sitio (a los ${Number(a.nadie_abre_contacto1_min)} y a los ${Number(a.nadie_abre_contacto2_min)} minutos). A los ${espera} minutos te avisamos para cerrar. Si el cliente aparece, toca Iniciar visita.` })
    } else if (v.estado === 'programada' && v.llegada_en) {
      items.push({ tipo: 'turno', orden: 1, texto: `Ya registraste tu llegada con <b>${cli}</b>. ¿Te abrieron? Toca Iniciar visita. Si nadie abre, toca Llegué y nadie abre.`, botones: [[{ text: 'Llegué y nadie abre', callback_data: `nadie:${v.id}` }]] })
    } else if (v.estado === 'programada' && inicio) {
      const faltaMs = inicio.getTime() - ahora.getTime()
      const cuando = `${formatFechaVE(v.fecha_programada!)} a las ${hora(v.hora_inicio_programada)}`
      if (faltaMs < -2 * 3600_000) items.push({ tipo: 'turno', orden: 4, texto: `Tu visita con <b>${cli}</b> estaba pautada para el ${cuando} y no la iniciaste. Si todavía vas, toca Iniciar visita; si no, toca Necesito reagendar o escríbenos.` })
      else if (faltaMs <= horasDir * 3600_000) {
        items.push(v.direccion
          ? { tipo: 'turno', orden: 3, texto: `Tu visita con <b>${cli}</b> es ${cuando}. Ya tienes la dirección: te la enviamos en un mensaje anterior. Cuando llegues, toca Iniciar visita y manda la foto de la llegada.`, botones: [[{ text: 'Voy en camino', callback_data: `camino:${v.id}` }]] }
          : { tipo: 'espera', orden: 3, texto: `Tu visita con <b>${cli}</b> es ${cuando}, pero el cliente todavía no registró la dirección. Ya le avisamos. Apenas la registre te la enviamos por aquí; tú no tienes nada que hacer.`, botones: [[{ text: 'Recordarle al cliente la dirección', callback_data: `rc:dir:${v.id}` }]] })
      } else {
        const llega = new Date(inicio.getTime() - horasDir * 3600_000)
        const hh = llega.toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: false })
        items.push({ tipo: 'espera', orden: 6, texto: `Tu próxima visita es con <b>${cli}</b>, ${cuando}. La dirección te llega ${horasDir} horas antes (a las ${hh}). Por ahora no tienes nada que hacer.` })
      }
    } else if (v.estado === 'pre_visita') {
      // ¿Quién tiene la pelota en el chat de coordinación?
      const { data: ult } = await admin.from('mensajes').select('origen').eq('visit_id', v.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if ((ult as { origen: string } | null)?.origen === 'cliente') items.push({ tipo: 'turno', orden: 3, texto: `<b>${cli}</b> te escribió por el chat de la visita y espera tu respuesta. Respóndele desde este mismo chat para ponerse de acuerdo en la fecha.` })
      else items.push({ tipo: 'espera', orden: 6, texto: `Estás coordinando la fecha de la visita con <b>${cli}</b>. Él la registra en el sistema; puedes escribirle por este chat para ponerse de acuerdo. Nada más por ahora.`, botones: [[{ text: 'Recordarle que registre la fecha', callback_data: `rc:fecha:${v.id}` }]] })
    }
    // ¿Cambió quién estará en el lugar? Esto le toca decidirlo a él.
    for (const c of (cambios ?? []) as { id: string; visita_id: string }[]) if (c.visita_id === v.id) {
      items.push({ tipo: 'turno', orden: 0, texto: `<b>${cli}</b> cambió quién estará en el lugar y necesitas decidir si sigues con la visita. Sin penalización si prefieres no ir.`, botones: [[{ text: 'Sigo con la visita', callback_data: `lugar:ok:${c.id}` }], [{ text: 'Prefiero no ir', callback_data: `lugar:no:${c.id}` }]] })
    }
    if (items.length > antes) manejadas.add(v.id)
  }

  // ── Horas reservadas que debe confirmar ───────────────────────────────────────────────────────────────────────
  for (const r of (reservas ?? []) as { id: string }[]) {
    const c = await PLANTILLAS.reserva_pedida.render({ reservaId: r.id }).catch(() => null)
    if (c?.telegram) items.push({ tipo: 'turno', orden: 1, texto: `Un cliente eligió una hora para la videollamada y falta que la confirmes.`, botones: c.telegram.teclado?.inline_keyboard })
  }

  // ── Solicitudes ─────────────────────────────────────────────────────────────────────────────────────────────
  const conVisita = new Set(visitas.map((v) => v.usuario_id))
  const tieneReservaViva = (clienteId: string) => ((reservas ?? []) as { cliente_id: string }[]).some((r) => r.cliente_id === clienteId)
  for (const s of solicitudes) {
    const cli = primero(s.usuarios?.nombre)
    const antes = items.length
    if (s.estado === 'pendiente') {
      const c = await PLANTILLAS.solicitud_nueva.render({ solicitudId: s.id }).catch(() => null)
      const que = s.tipo === 'mandado' ? 'te pide un mandado' : s.tipo === 'directa' ? 'quiere contratarte directamente' : 'quiere conocerte'
      items.push({ tipo: 'turno', orden: 2, texto: `<b>${cli}</b> ${que} y espera tu respuesta.`, botones: c?.telegram?.teclado?.inline_keyboard })
    } else if (s.estado === 'aceptada' && s.tipo === 'entrevista' && !s.slot_confirmado && (s.slots_propuestos ?? []).length === 0) {
      if (!tieneReservaViva(s.cliente_id)) items.push({ tipo: 'espera', orden: 5, texto: `Aceptaste hablar con <b>${cli}</b>. Está eligiendo una de tus horas libres; apenas elija te pedimos que la confirmes. No tienes nada que hacer.`, botones: [[{ text: 'Recordarle que elija la hora', callback_data: `rc:hora:${s.id}` }]] })
    } else if (s.estado === 'aceptada' && s.slot_confirmado && new Date(s.slot_confirmado).getTime() > ahora.getTime()) {
      const f = new Date(s.slot_confirmado).toLocaleString('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true })
      items.push({ tipo: 'espera', orden: 5, texto: `Tienes una videollamada con <b>${cli}</b>: ${esc(f)} (hora de Caracas). El enlace de la sala te llega 1 hora antes. Por ahora no tienes nada que hacer.` })
    } else if (s.estado === 'aceptada' && s.slot_confirmado && new Date(s.slot_confirmado).getTime() <= ahora.getTime() && ahora.getTime() - new Date(s.slot_confirmado).getTime() < 3 * 86_400_000) {
      // La videollamada ya pasó y la solicitud sigue abierta: falta que el compita diga cómo estuvo (o el cliente decida).
      const t = s.token_respuesta; const base = `${SITE_URL}/api/solicitud/resultado-llamada?token=${t}`
      items.push({ tipo: 'turno', orden: 2, texto: `Ya pasó tu videollamada con <b>${cli}</b>. Cuéntanos cómo estuvo: si todo salió bien, o si necesitan repetirla. El cliente también decide si quiere contratarte.`, botones: [[{ text: 'Estuvo bien', url: `${base}&resultado=bien&${qRol(t, 'compita')}` }], [{ text: 'Necesitamos reagendar', url: `${base}&resultado=reagendar&${qRol(t, 'compita')}` }]] })
    } else if (s.estado === 'aceptada' && (s.tipo === 'directa' || s.tipo === 'mandado') && !conVisita.has(s.cliente_id)) {
      items.push({ tipo: 'espera', orden: 5, texto: `Aceptaste a <b>${cli}</b>. Esperamos su pago; te avisamos apenas esté confirmado. No tienes nada que hacer.`, botones: [[{ text: 'Recordarle el pago', callback_data: `rc:pago:${s.id}` }]] })
    }
    if (items.length > antes) manejadas.add(s.id)
  }

  // ── Lo que le impide recibir clientes: que lo sepa y sepa cómo arreglarlo ──────────────────────────────────────
  if (await compitaEnPausa(compitaId)) {
    items.push({ tipo: 'espera', orden: 4, texto: `Tus solicitudes nuevas están en pausa por varias cancelaciones con poco aviso. El equipo de Compaz hablará contigo. Mientras tanto no recibirás clientes nuevos; las visitas que ya tienes siguen igual. Por ahora no tienes nada que hacer; si hubo una causa justificada, cuéntanosla en hola@micompaz.com.` })
  }
  const horarios = (cmp as { horarios_disponibles: unknown[] | null } | null)?.horarios_disponibles
  if (!horarios || horarios.length === 0) {
    items.push({ tipo: 'turno', orden: 7, texto: `Todavía no cargaste tus horas libres. Sin ellas los clientes no pueden elegir una hora para hablar contigo. Toca /perfil y agrégalas: toma un minuto.` })
  }

  // ── Algo activo que no supimos explicar: nunca se queda callada ────────────────────────────────────────────────
  const sinExplicar = [...visitas.map((v) => v.id), ...solicitudes.filter((s) => s.estado === 'pendiente' || s.slot_confirmado || s.tipo).map((s) => s.id)].filter((id) => !manejadas.has(id))
  const hayActivoSinExplicar = visitas.some((v) => !manejadas.has(v.id)) || solicitudes.some((s) => s.estado === 'pendiente' && !manejadas.has(s.id))
  if (hayActivoSinExplicar && sinExplicar.length > 0) {
    items.push({ tipo: 'turno', orden: 8, texto: `Tienes una visita o solicitud en proceso que no sabemos explicarte con claridad desde aquí. Revisa los últimos mensajes del bot. ${AYUDA}` })
  }

  if (items.length === 0) {
    return {
      texto: `<b>Nada pendiente.</b>\n\nNo tienes ninguna visita, solicitud ni respuesta por dar, y no estás esperando a nadie. Si te toca algo, te avisamos por aquí.\n\nMientras tanto, para recibir más solicitudes mantén tu perfil al día con /perfil. ${AYUDA}`,
      teclado: null, hayAlgo: false, codigos: ['nada'], codigosTurno: [], noReconocido: false,
    }
  }

  items.sort((x, y) => (x.tipo === y.tipo ? x.orden - y.orden : x.tipo === 'turno' ? -1 : 1))
  const turno = items.filter((i) => i.tipo === 'turno'); const esperando = items.filter((i) => i.tipo === 'espera')
  const bloques: string[] = []
  if (turno.length) bloques.push(`<b>Te toca a ti</b>\n\n${turno.map((i, n) => `${turno.length > 1 ? `${n + 1}. ` : ''}${i.texto}`).join('\n\n')}`)
  if (esperando.length) bloques.push(`<b>${turno.length ? 'Y estás esperando' : 'Estás esperando'}</b>\n\n${esperando.map((i, n) => `${esperando.length > 1 ? `${n + 1}. ` : ''}${i.texto}`).join('\n\n')}`)
  const filas = items.flatMap((i) => i.botones ?? []).slice(0, 8)
  const conCodigo = items.map((i) => ({ ...i, codigo: codigoDe(i.texto) }))
  return {
    texto: bloques.join('\n\n━━━━━━━━━━━━━━━━━━━\n\n'), teclado: filas.length ? { inline_keyboard: filas } : null, hayAlgo: true,
    codigos: conCodigo.map((i) => i.codigo), codigosTurno: conCodigo.filter((i) => i.tipo === 'turno').map((i) => i.codigo), noReconocido: conCodigo.some((i) => i.codigo === 'guia_general'),
  }
}
