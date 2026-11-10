// Llegada del compita: foto obligatoria al llegar, y "nadie abre" con cronómetro. La foto se copia al almacenamiento privado
// (Telegram no permite borrar lo que entrega) y el cliente la ve desde nuestro servidor. Si nadie abre en 30 minutos, el compita
// puede cerrar la visita: queda como SIN ACCESO (cuenta como usada, la cancelación queda registrada y el cliente puede pedir que
// el equipo la justifique). Los pasos de los 5 y 15 minutos son tareas automáticas para el equipo.
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjustes } from '@/lib/ajustes'
import { registrarEvento } from '@/lib/eventos'
import { notificar } from '@/lib/avisos'
import { sendTelegramMessage, avisarAdmin, makeInlineKeyboard } from '@/lib/telegram'
import { copiarFotoDeTelegram, programarBorradoVisita } from '@/lib/fotos-privadas'
import { registrarCancelacion } from '@/lib/cancelaciones'
import { esc } from '@/lib/html'

export async function llegadaConFotoObligatoria(): Promise<boolean> {
  return Number((await getAjustes()).llegada_foto_obligatoria) === 1
}

type VisitaLlegada = {
  id: string; usuario_id: string; compita_id: string; estado: string; created_at: string
  fecha_programada: string | null; hora_inicio_programada: string | null
  llegada_en: string | null; llegada_foto_id: string | null; sin_acceso_en: string | null
}
const COLS = 'id, usuario_id, compita_id, estado, created_at, fecha_programada, hora_inicio_programada, llegada_en, llegada_foto_id, sin_acceso_en'

export async function visitaDeLlegada(visitaId: string, compitaId?: string): Promise<VisitaLlegada | null> {
  let q = createAdminSupabase().from('visitas').select(COLS).eq('id', visitaId)
  if (compitaId) q = q.eq('compita_id', compitaId)
  const { data } = await q.maybeSingle()
  return (data as VisitaLlegada | null) ?? null
}

/** El compita mandó la foto de la fachada o la puerta: queda registrada la llegada y el cliente se entera. */
export async function registrarLlegada(i: { visitaId: string; compitaId: string; fileId: string; ahora?: Date }): Promise<{ ok: true } | { ok: false; motivo: 'no_aplica' | 'foto' }> {
  const v = await visitaDeLlegada(i.visitaId, i.compitaId)
  if (!v || v.estado !== 'programada') return { ok: false, motivo: 'no_aplica' }
  const foto = await copiarFotoDeTelegram(i.fileId, { tipo: 'llegada', visitaId: v.id })
  if (!foto) return { ok: false, motivo: 'foto' }
  const ahora = (i.ahora ?? new Date()).toISOString()
  const { error } = await createAdminSupabase().from('visitas').update({ llegada_en: ahora, llegada_foto_id: foto.id }).eq('id', v.id).eq('estado', 'programada')
  if (error) { console.error('[llegada] no se pudo registrar:', error.message); return { ok: false, motivo: 'no_aplica' } }
  await registrarEvento({ entidad: 'visita', entidadId: v.id, tipo: 'llegada_registrada', actor: `compita:${i.compitaId}` })
  await notificar({
    plantilla: 'compita_llego', canal: 'correo', destinatario: { tipo: 'cliente', id: v.usuario_id },
    variables: { visitaId: v.id }, entidad: 'visita', entidadId: v.id, paso: 11, claveUnica: `compita_llego:${v.id}:${ahora}`,
  })
  return { ok: true }
}

export type ResultadoNadieAbre = { ok: true; espera: number } | { ok: false; motivo: 'sin_llegada' | 'no_aplica' }

/** "Llegué y nadie abre": empieza la cuenta atrás. El cliente se entera al instante y el equipo recibe el primer paso. */
export async function declararNadieAbre(visitaId: string, compitaId: string, ahora: Date = new Date()): Promise<ResultadoNadieAbre> {
  const v = await visitaDeLlegada(visitaId, compitaId)
  if (!v || v.estado !== 'programada') return { ok: false, motivo: 'no_aplica' }
  if (!v.llegada_en) return { ok: false, motivo: 'sin_llegada' } // sin la foto no se puede reportar
  const a = await getAjustes()
  const espera = Number(a.nadie_abre_espera_min)
  if (v.sin_acceso_en) return { ok: true, espera } // ya estaba contando: no se reinicia
  await createAdminSupabase().from('visitas').update({ sin_acceso_en: ahora.toISOString() }).eq('id', v.id).is('sin_acceso_en', null)
  await registrarEvento({ entidad: 'visita', entidadId: v.id, tipo: 'llegada_sin_acceso', actor: `compita:${compitaId}`, datos: { espera_min: espera } })
  await notificar({
    plantilla: 'nadie_abre_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: v.usuario_id },
    variables: { visitaId: v.id }, entidad: 'visita', entidadId: v.id, paso: 11, claveUnica: `nadie_abre_cliente:${v.id}:${ahora.toISOString()}`,
  })
  return { ok: true, espera }
}

/** El cliente avisa que ya abre (o ya llegó): se detiene la cuenta atrás y el compita lo sabe. */
export async function clienteYaAbre(visitaId: string, clienteId: string, ahora: Date = new Date()): Promise<boolean> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('visitas').select('id, compita_id, sin_acceso_en').eq('id', visitaId).eq('usuario_id', clienteId).eq('estado', 'programada').maybeSingle()
  const v = data as { id: string; compita_id: string; sin_acceso_en: string | null } | null
  if (!v || !v.sin_acceso_en) return false
  const { data: act } = await admin.from('visitas').update({ sin_acceso_en: null }).eq('id', v.id).not('sin_acceso_en', 'is', null).select('id').maybeSingle()
  if (!act) return false
  await registrarEvento({ entidad: 'visita', entidadId: v.id, tipo: 'llegada_registrada', actor: `cliente:${clienteId}`, datos: { accion: 'ya_abre' } })
  await admin.from('admin_flags').update({ resuelto: true, resuelto_at: ahora.toISOString() }).eq('tipo', 'nadie_abre').eq('entidad_id', v.id).eq('resuelto', false)
  const { data: cmp } = await admin.from('compitas').select('telegram_chat_id').eq('id', v.compita_id).maybeSingle()
  const chat = (cmp as { telegram_chat_id: string | null } | null)?.telegram_chat_id
  if (chat) { try { await sendTelegramMessage(chat, `🚪 <b>El cliente avisó que ya abren.</b>\n\nToca ▶️ Iniciar visita cuando estés adentro.`) } catch (e) { console.error('[llegada] Telegram al compita:', e) } }
  return true
}

export type ResultadoCierre = { ok: true } | { ok: false; motivo: 'no_aplica' | 'aun_no' | 'sin_cuenta'; faltan?: number }

/** Pasaron los 30 minutos y nadie abrió: el compita cierra la visita como SIN ACCESO (cuenta como usada). */
export async function cerrarSinAcceso(visitaId: string, compitaId: string, ahora: Date = new Date()): Promise<ResultadoCierre> {
  const v = await visitaDeLlegada(visitaId, compitaId)
  if (!v || v.estado !== 'programada') return { ok: false, motivo: 'no_aplica' }
  if (!v.sin_acceso_en) return { ok: false, motivo: 'sin_cuenta' }
  const espera = Number((await getAjustes()).nadie_abre_espera_min)
  const faltan = Math.ceil(espera - (ahora.getTime() - new Date(v.sin_acceso_en).getTime()) / 60_000)
  if (faltan > 0) return { ok: false, motivo: 'aun_no', faltan }

  const admin = createAdminSupabase()
  // La cancelación se registra ANTES de borrar la visita y cuenta como usada (salvo que el equipo la justifique).
  const idCanc = await registrarCancelacion({
    visitaId: v.id, compitaId, usuarioId: v.usuario_id, canceladoPor: 'sistema', fechaProgramada: v.fecha_programada, horaInicioProgramada: v.hora_inicio_programada,
    motivo: 'Sin acceso: nadie abrió', visitaCreadaEn: v.created_at, cuentaComoUsada: true, ahora,
  })
  if (!idCanc) return { ok: false, motivo: 'no_aplica' } // si no se pudo registrar no se borra nada
  await programarBorradoVisita(v.id, ahora) // la foto de llegada se borra N días después del cierre
  const { error } = await admin.from('visitas').delete().eq('id', v.id).eq('estado', 'programada')
  if (error) { console.error('[llegada] no se pudo cerrar la visita:', error.message); return { ok: false, motivo: 'no_aplica' } }
  await registrarEvento({ entidad: 'cliente', entidadId: v.usuario_id, tipo: 'visita_sin_acceso', actor: `compita:${compitaId}`, datos: { visita_id: v.id, cancelacion_id: idCanc } })
  await admin.from('admin_flags').update({ resuelto: true, resuelto_at: ahora.toISOString() }).eq('tipo', 'nadie_abre').eq('entidad_id', v.id).eq('resuelto', false)
  await notificar({
    plantilla: 'visita_sin_acceso_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: v.usuario_id },
    variables: { cancelacionId: idCanc }, entidad: 'cliente', entidadId: v.usuario_id, paso: 11, claveUnica: `visita_sin_acceso:${idCanc}`,
  })
  const [{ data: cmp }, { data: cli }] = await Promise.all([
    admin.from('compitas').select('nombre').eq('id', compitaId).maybeSingle(), admin.from('usuarios').select('nombre').eq('id', v.usuario_id).maybeSingle(),
  ])
  await avisarAdmin(`🚪 <b>Visita sin acceso</b>\n\n<b>${esc(String((cmp as { nombre: string } | null)?.nombre ?? ''))}</b> esperó ${espera} minutos y nadie abrió a <b>${esc(String((cli as { nombre: string } | null)?.nombre ?? ''))}</b>. La visita cuenta como usada. Si hubo una causa justificada, puedes devolverla desde Personas.`)
  return { ok: true }
}

/**
 * Escalera de "nadie abre" (la llama el cron cada 5 minutos): a los N1 minutos abre la tarea "contactar al contacto en el
 * sitio" (el teléfono le llega al administrador por Telegram, no queda en la tarea); a los N2, la tarea de llamar al cliente;
 * a los 30, el compita recibe el botón para cerrar. Cada paso ocurre una sola vez por espera.
 */
export async function procesarNadieAbre(ahora: Date = new Date()): Promise<{ tareas: number; cierres: number }> {
  const admin = createAdminSupabase()
  const a = await getAjustes()
  const [m1, m2, m30] = [Number(a.nadie_abre_contacto1_min), Number(a.nadie_abre_contacto2_min), Number(a.nadie_abre_espera_min)]
  const { data } = await admin.from('visitas').select(`${COLS}, contacto_nombre, contacto_tel`).eq('estado', 'programada').not('sin_acceso_en', 'is', null)
  const r = { tareas: 0, cierres: 0 }
  for (const v of (data ?? []) as (VisitaLlegada & { contacto_nombre: string | null; contacto_tel: string | null })[]) {
    const min = (ahora.getTime() - new Date(v.sin_acceso_en!).getTime()) / 60_000
    const [{ data: cmp }, { data: cli }] = await Promise.all([
      admin.from('compitas').select('nombre, telegram_chat_id').eq('id', v.compita_id).maybeSingle(), admin.from('usuarios').select('nombre').eq('id', v.usuario_id).maybeSingle(),
    ])
    const nombreCmp = String((cmp as { nombre: string } | null)?.nombre ?? 'El compita'); const nombreCli = String((cli as { nombre: string } | null)?.nombre ?? 'el cliente')
    const paso = async (n: 1 | 2, titulo: string, cuerpo: string, telegram: string) => {
      const clave = `nadie_abre:${v.id}:${v.sin_acceso_en}:${n}`
      const { data: previa } = await admin.from('admin_flags').select('id').eq('tipo', 'nadie_abre').eq('entidad_id', v.id).like('nota', `%[${clave}]%`).maybeSingle()
      if (previa) return
      await admin.from('admin_flags').insert({ entidad_tipo: 'visita', entidad_id: v.id, entidad_nombre: `🚪 ${titulo}: ${nombreCmp} / ${nombreCli}`, nota: `${cuerpo}\n[${clave}]`, reportado_por: 'nadie abre', resuelto: false, tipo: 'nadie_abre', prioridad: 1 })
      await avisarAdmin(telegram)
      r.tareas++
    }
    if (min >= m1) await paso(1, 'Nadie abre (contactar al contacto en el sitio)', `${nombreCmp} lleva ${Math.floor(min)} minutos en la puerta de ${nombreCli} y nadie abre. Contacta a la persona de contacto en el sitio.`,
      `🚪 <b>Nadie abre (${Math.floor(min)} min)</b>\n\n<b>${esc(nombreCmp)}</b> está en la puerta de <b>${esc(nombreCli)}</b>.\n<b>Contacto en el sitio:</b> ${esc(v.contacto_nombre ?? 'sin nombre')} ${esc(v.contacto_tel ?? '')}\n\nContáctalo para que abra.`)
    if (min >= m2) await paso(2, 'Nadie abre (segundo intento: llamar al cliente)', `Siguen sin abrir tras ${Math.floor(min)} minutos. Intenta contactar al cliente directamente. Si no aparece, a los ${m30} minutos el compita puede cerrar y la visita cuenta como usada.`,
      `🚪 <b>Siguen sin abrir (${Math.floor(min)} min)</b>\n\nIntenta con el cliente <b>${esc(nombreCli)}</b>. A los ${m30} minutos <b>${esc(nombreCmp)}</b> puede cerrar la visita.`)
    if (min >= m30 && (cmp as { telegram_chat_id: string | null } | null)?.telegram_chat_id) {
      const res = await notificar({
        plantilla: 'nadie_abre_cerrar', canal: 'telegram', destinatario: { tipo: 'compita', id: v.compita_id },
        variables: { visitaId: v.id }, entidad: 'visita', entidadId: v.id, paso: 11, claveUnica: `nadie_abre_cerrar:${v.id}:${v.sin_acceso_en}`,
      })
      if (res.ok && res.estado !== 'duplicado') r.cierres++
    }
  }
  return r
}

export const tecladoLlegada = (visitaId: string) => makeInlineKeyboard([
  [{ text: '✅ Sí, iniciar', callback_data: '✅ Sí, iniciar' }],
  [{ text: '🚪 Llegué y nadie abre', callback_data: `nadie:${visitaId}` }],
  [{ text: '🔄 Necesito reagendar', callback_data: 'reagendar_visita' }],
])
