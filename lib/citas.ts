// Citas de las visitas. El cliente PROPONE fecha y hora y la visita NO queda programada hasta que el compita confirma por Telegram ("Confirmo la cita" o "No puedo a esa hora"). Mientras tanto la propuesta vive en columnas
// aparte y la visita conserva su estado y su fecha de siempre: nada de lo demás (direcciones, recordatorios, llegada) se entera hasta confirmar.
// Si el compita no tiene Telegram para avisarle, la visita se programa al elegir como antes y se abre una tarea (nunca se deja al cliente esperando a nadie).

import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjustes } from '@/lib/ajustes'
import { registrarEvento } from '@/lib/eventos'
import { notificar } from '@/lib/avisos'
import { alertaAdmin } from '@/lib/alertas-admin'
import { sendTelegramMessage, TECLADO_INICIO, makeInlineKeyboard } from '@/lib/telegram'
import { reclamarUnaVez } from '@/lib/cron'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { hoyVE, horaVE, formatFechaVE } from '@/lib/format'

export interface Propuesta { fecha: string; inicio: string; fin: string }
const HORA = 3_600_000

/** Marca de la propuesta vigente: va en los botones para que un botón viejo nunca confirme una propuesta nueva sin que el compita la vea. */
export const versionCita = (propuestaEn: string | null | undefined) => (propuestaEn ? Math.floor(new Date(propuestaEn).getTime() / 1000).toString(36).slice(-6) : '')
const inicioDe = (p: Propuesta) => new Date(`${p.fecha}T${p.inicio.slice(0, 5)}:00-04:00`)
const textoCita = (p: Propuesta) => `${formatFechaVE(p.fecha, true)}, ${p.inicio.slice(0, 5)} a ${p.fin.slice(0, 5)} (hora de Caracas)`

/** El aviso de "visita confirmada": al compita por Telegram y al cliente por correo. Es el mismo de siempre, ahora reutilizable. */
export async function anunciarCitaConfirmada(visitaId: string, usuarioId: string, compitaId: string, fecha: string, hora_inicio: string, hora_fin: string): Promise<void> {
  const admin = createAdminSupabase()
  const fechaFormateada = formatFechaVE(fecha, true)
  const horarioLabel = `${hora_inicio} – ${hora_fin}`

  const [{ data: compita }, { data: cliente }] = await Promise.all([
    admin.from('compitas').select('telegram_chat_id, nombre').eq('id', compitaId).single(),
    admin.from('usuarios').select('nombre, email').eq('id', usuarioId).single(),
  ])

  // Si la visita es hoy en menos de 30 min, el cron no llegará a tiempo — avisar ahora mismo.
  const minutosParaInicio = fecha === hoyVE()
    ? (hora_inicio.split(':').map(Number).reduce((h, m) => h * 60 + m) - horaVE().split(':').map(Number).reduce((h, m) => h * 60 + m))
    : Infinity
  const esInminente = minutosParaInicio <= 30 && minutosParaInicio >= 0

  if (compita?.telegram_chat_id) {
    try {
      const mensajeConfirmacion = esInminente
        ? [
            `<b>¡Visita agendada para ahora!</b>`,
            ``,
            `${esc(cliente?.nombre ?? 'El cliente')} registró el horario:`,
            ``,
            `<b>${esc(fechaFormateada)}</b>`,
            `<b>${esc(horarioLabel)}</b>`,
            ``,
            `La visita empieza pronto. Cuando llegues, toca el botón de tu teclado.`,
          ].join('\n')
        : [
            `<b>¡Visita confirmada!</b>`,
            ``,
            `${esc(cliente?.nombre ?? 'El cliente')} registró el horario de la visita:`,
            ``,
            `<b>${esc(fechaFormateada)}</b>`,
            `<b>${esc(horarioLabel)}</b>`,
            ``,
            `Recibirás un recordatorio antes de la visita. Si necesitas reagendar, escríbenos.`,
          ].join('\n')

      await sendTelegramMessage(compita.telegram_chat_id, mensajeConfirmacion, TECLADO_INICIO)

      // Marcar el flag del cron para que no duplique el aviso si la visita es inminente
      if (esInminente) await reclamarUnaVez(`aviso_inicio:${visitaId}`).catch(() => null)
    } catch (e) { console.error('Telegram fecha/confirmar compita:', e) }
  }

  if (cliente?.email) {
    try {
      await sendEmail({
        to: cliente.email,
        subject: `Visita confirmada: ${fechaFormateada}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px;margin-bottom:12px">Visita confirmada</h2>
            <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
              La visita de <strong>${esc(compita?.nombre ?? 'tu compita')}</strong> con tu familiar está agendada.
            </p>
            <div style="background:#F5F0FF;border:2px solid #7C4DFF;border-radius:12px;padding:16px 20px;margin:20px 0;text-align:center">
              <p style="color:#6B5C90;font-size:13px;margin:0 0 4px">Fecha y horario</p>
              <p style="color:#2D1464;font-size:18px;font-weight:800;margin:0 0 4px;text-transform:capitalize">${esc(fechaFormateada)}</p>
              <p style="color:#2D1464;font-size:16px;font-weight:700;margin:0">${esc(horarioLabel)}</p>
            </div>
            <p style="color:#4A3B6B;font-size:14px;line-height:1.6">
              Te enviaremos un recordatorio el día anterior. Si necesitas cambiar la fecha puedes reagendar desde tu dashboard.
            </p>
            <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:14px;margin-top:8px">
              Ver en el dashboard →
            </a>
            <p style="color:#9990A8;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>
        `,
      })
    } catch (e) { console.error('Email confirmar visita cliente:', e) }
  }

}

/** ¿El compita ya tiene otra visita que se cruce con este horario? */
export async function hayChoque(compitaId: string, fecha: string, inicio: string, fin: string, excluirVisitaId: string): Promise<boolean> {
  const { data } = await createAdminSupabase().from('visitas').select('id, hora_inicio_programada, hora_fin_programada').eq('compita_id', compitaId).eq('fecha_programada', fecha).in('estado', ['programada', 'en_curso']).neq('id', excluirVisitaId)
  return ((data ?? []) as { hora_inicio_programada: string | null; hora_fin_programada: string | null }[]).some((v) => !!v.hora_inicio_programada && !!v.hora_fin_programada && v.hora_inicio_programada < fin && v.hora_fin_programada > inicio)
}

const tecladoCita = (visitaId: string, propuestaEn: string) => makeInlineKeyboard([
  [{ text: 'Confirmo la cita', callback_data: `cita:ok:${visitaId}:${versionCita(propuestaEn)}` }],
  [{ text: 'No puedo a esa hora', callback_data: `cita:no:${visitaId}:${versionCita(propuestaEn)}` }],
])

export type ResultadoPropuesta = 'pendiente' | 'sin_telegram'

/**
 * Guarda la propuesta del cliente y le pide al compita que confirme. Si no hay cómo avisarle por Telegram devuelve 'sin_telegram' SIN guardar
 * nada: quien llama programa la visita al instante (como antes) y se abre una tarea.
 */
export async function proponerCita(p: { visitaId: string; usuarioId: string; compitaId: string } & Propuesta, ahora: Date = new Date()): Promise<ResultadoPropuesta> {
  const admin = createAdminSupabase()
  const [{ data: c }, { data: u }] = await Promise.all([
    admin.from('compitas').select('telegram_chat_id, nombre').eq('id', p.compitaId).maybeSingle(),
    admin.from('usuarios').select('nombre').eq('id', p.usuarioId).maybeSingle(),
  ])
  const chat = (c as { telegram_chat_id: string | null } | null)?.telegram_chat_id
  if (!chat) return 'sin_telegram'
  const propuestaEn = ahora.toISOString()
  const { error } = await admin.from('visitas').update({ cita_propuesta_fecha: p.fecha, cita_propuesta_inicio: p.inicio, cita_propuesta_fin: p.fin, cita_propuesta_en: propuestaEn, cita_recordada_en: null, cita_escalada_en: null }).eq('id', p.visitaId)
  if (error) { console.error('[citas] no se pudo guardar la propuesta:', error.message); return 'sin_telegram' }
  try {
    await sendTelegramMessage(chat, `<b>${esc((u as { nombre: string } | null)?.nombre ?? 'El cliente')} eligió el horario de la visita</b>\n\n${esc(textoCita(p))}\n\nConfirma si puedes. Si no puedes a esa hora, el cliente elige otra sin costo.`, tecladoCita(p.visitaId, propuestaEn))
  } catch (e) {
    // No se pudo avisar al compita: no se deja una propuesta que nadie vio.
    await admin.from('visitas').update({ cita_propuesta_fecha: null, cita_propuesta_inicio: null, cita_propuesta_fin: null, cita_propuesta_en: null }).eq('id', p.visitaId)
    console.error('[citas] Telegram no entregó la propuesta:', e)
    return 'sin_telegram'
  }
  await registrarEvento({ entidad: 'visita', entidadId: p.visitaId, tipo: 'cita_propuesta', actor: `cliente:${p.usuarioId}`, datos: { fecha: p.fecha, inicio: p.inicio } })
  await notificar({ plantilla: 'cita_propuesta_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: p.usuarioId }, variables: { compitaId: p.compitaId, cuando: textoCita(p) }, entidad: 'visita', entidadId: p.visitaId, paso: 11, claveUnica: `cita_propuesta:${p.visitaId}:${versionCita(propuestaEn)}` })
  return 'pendiente'
}

type VisitaCita = { id: string; usuario_id: string; compita_id: string; estado: string; cita_propuesta_fecha: string | null; cita_propuesta_inicio: string | null; cita_propuesta_fin: string | null; cita_propuesta_en: string | null }
const COLS = 'id, usuario_id, compita_id, estado, cita_propuesta_fecha, cita_propuesta_inicio, cita_propuesta_fin, cita_propuesta_en'
const propuestaDe = (v: VisitaCita): Propuesta | null => (v.cita_propuesta_fecha && v.cita_propuesta_inicio && v.cita_propuesta_fin ? { fecha: v.cita_propuesta_fecha, inicio: v.cita_propuesta_inicio, fin: v.cita_propuesta_fin } : null)

export type ResultadoRespuesta = 'ok' | 'cambio' | 'ya_no_hay' | 'choque'

/** El compita confirma: la visita queda programada y se avisa a los dos. `version` evita confirmar a ciegas una propuesta que ya cambió. */
export async function confirmarCita(visitaId: string, compitaId: string, version: string): Promise<ResultadoRespuesta> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('visitas').select(COLS).eq('id', visitaId).eq('compita_id', compitaId).maybeSingle()
  const v = data as VisitaCita | null
  const p = v ? propuestaDe(v) : null
  if (!v || !p) return 'ya_no_hay'
  if (version !== versionCita(v.cita_propuesta_en)) return 'cambio'
  if (await hayChoque(compitaId, p.fecha, p.inicio, p.fin, v.id)) return 'choque'
  const { data: ok } = await admin.from('visitas').update({ fecha_programada: p.fecha, hora_inicio_programada: p.inicio, hora_fin_programada: p.fin, estado: 'programada', cita_propuesta_fecha: null, cita_propuesta_inicio: null, cita_propuesta_fin: null, cita_propuesta_en: null }).eq('id', visitaId).eq('cita_propuesta_en', v.cita_propuesta_en!).in('estado', ['pre_visita', 'programada']).select('id').maybeSingle()
  if (!ok) return 'cambio'
  await registrarEvento({ entidad: 'visita', entidadId: visitaId, tipo: 'cita_confirmada', actor: `compita:${compitaId}`, datos: { fecha: p.fecha, inicio: p.inicio } })
  await anunciarCitaConfirmada(visitaId, v.usuario_id, v.compita_id, p.fecha, p.inicio, p.fin)
  return 'ok'
}

/** El compita no puede a esa hora: se borra la propuesta, la visita sigue como estaba y el cliente elige otra. */
export async function rechazarCita(visitaId: string, compitaId: string, version: string): Promise<ResultadoRespuesta> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('visitas').select(COLS).eq('id', visitaId).eq('compita_id', compitaId).maybeSingle()
  const v = data as VisitaCita | null
  const p = v ? propuestaDe(v) : null
  if (!v || !p) return 'ya_no_hay'
  if (version !== versionCita(v.cita_propuesta_en)) return 'cambio'
  const { data: ok } = await admin.from('visitas').update({ cita_propuesta_fecha: null, cita_propuesta_inicio: null, cita_propuesta_fin: null, cita_propuesta_en: null }).eq('id', visitaId).eq('cita_propuesta_en', v.cita_propuesta_en!).select('id').maybeSingle()
  if (!ok) return 'cambio'
  await registrarEvento({ entidad: 'visita', entidadId: visitaId, tipo: 'cita_rechazada', actor: `compita:${compitaId}`, datos: { fecha: p.fecha, inicio: p.inicio } })
  await notificar({ plantilla: 'cita_rechazada_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: v.usuario_id }, variables: { compitaId, cuando: textoCita(p) }, entidad: 'visita', entidadId: visitaId, paso: 11, claveUnica: `cita_rechazada:${visitaId}:${versionCita(v.cita_propuesta_en)}` })
  return 'ok'
}

/** El cliente cambió de idea o reagendó: la propuesta pendiente ya no vale. */
export async function descartarPropuesta(visitaId: string): Promise<void> {
  await createAdminSupabase().from('visitas').update({ cita_propuesta_fecha: null, cita_propuesta_inicio: null, cita_propuesta_fin: null, cita_propuesta_en: null }).eq('id', visitaId)
}

/**
 * Propuestas sin respuesta (la escalera la llama cada 5 minutos): tras `cita_recordatorio_horas` se le recuerda al compita UNA vez; tras
 * `cita_escalada_horas` (o si la hora propuesta está a menos de 12 horas) se abre UNA tarea para el equipo y se avisa al cliente.
 */
export async function escalarCitasSinRespuesta(ahora: Date = new Date()): Promise<{ recordadas: number; escaladas: number }> {
  const admin = createAdminSupabase()
  const a = await getAjustes()
  const { data } = await admin.from('visitas').select(`${COLS}, cita_recordada_en, cita_escalada_en`).not('cita_propuesta_en', 'is', null)
  let recordadas = 0; let escaladas = 0
  for (const v of (data ?? []) as (VisitaCita & { cita_recordada_en: string | null; cita_escalada_en: string | null })[]) {
    const p = propuestaDe(v); if (!p || !v.cita_propuesta_en) continue
    const horas = (ahora.getTime() - new Date(v.cita_propuesta_en).getTime()) / HORA
    const cercana = inicioDe(p).getTime() - ahora.getTime() < 12 * HORA
    if (!v.cita_escalada_en && (horas >= Number(a.cita_escalada_horas) || cercana)) {
      const { data: rec } = await admin.from('visitas').update({ cita_escalada_en: ahora.toISOString() }).eq('id', v.id).is('cita_escalada_en', null).select('id').maybeSingle()
      if (!rec) continue
      const [{ data: c }, { data: u }] = await Promise.all([admin.from('compitas').select('nombre').eq('id', v.compita_id).maybeSingle(), admin.from('usuarios').select('nombre').eq('id', v.usuario_id).maybeSingle()])
      const nc = (c as { nombre: string } | null)?.nombre ?? 'El compita'; const nu = (u as { nombre: string } | null)?.nombre ?? 'el cliente'
      await alertaAdmin('tarea', `<b>${esc(nc)} no confirma la cita</b>\n\n${esc(nu)} propuso ${esc(textoCita(p))} hace ${Math.floor(horas)} horas y ${esc(nc)} no responde. Escríbele por Telegram (no llames) o ayuda al cliente a elegir otra hora.`, { categoria: 'cita_sin_confirmar', clave: `cita:${v.id}:${versionCita(v.cita_propuesta_en)}`, entidad: { tipo: 'compita', id: v.compita_id, nombre: `Cita sin confirmar: ${nc} / ${nu}` } })
      await notificar({ plantilla: 'cita_sin_respuesta_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: v.usuario_id }, variables: { compitaId: v.compita_id, cuando: textoCita(p) }, entidad: 'visita', entidadId: v.id, paso: 11, claveUnica: `cita_sin_respuesta:${v.id}:${versionCita(v.cita_propuesta_en)}` })
      escaladas++
    } else if (!v.cita_recordada_en && horas >= Number(a.cita_recordatorio_horas)) {
      const { data: rec } = await admin.from('visitas').update({ cita_recordada_en: ahora.toISOString() }).eq('id', v.id).is('cita_recordada_en', null).select('id').maybeSingle()
      if (!rec) continue
      const { data: c } = await admin.from('compitas').select('telegram_chat_id').eq('id', v.compita_id).maybeSingle()
      const chat = (c as { telegram_chat_id: string | null } | null)?.telegram_chat_id
      if (chat) await sendTelegramMessage(chat, `<b>Falta tu respuesta</b>\n\nEl cliente espera que confirmes: ${esc(textoCita(p))}.`, tecladoCita(v.id, v.cita_propuesta_en)).catch(() => {})
      recordadas++
    }
  }
  return { recordadas, escaladas }
}
