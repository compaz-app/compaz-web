// Ayuda automática al compita y lo que esa ayuda le aporta al sistema.
//  1. "¿Qué me toca?" deja un evento con el código de su situación (nunca el texto) y, si cae en un estado que nadie previó,
//     abre una tarea para el admin: los huecos de cobertura se descubren solos.
//  2. Si el compita pregunta lo mismo `ayuda_intentos` veces en 30 minutos sin avanzar, se abre "Duda sin resolver".
//  3. "Tengo una duda": menú de un toque con respuestas automáticas; una persona entra solo tras `ayuda_intentos` intentos sin
//     resolver (o al instante si algo no está bien). Cada duda queda por tipo para que el admin arregle la CAUSA.
//  4. "Recordarle al cliente": un toque que manda un correo de Compaz (con límite) cuando el compita espera algo del cliente.
// Los contactos de nadie se revelan: todo sale de Compaz.

import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjustes } from '@/lib/ajustes'
import { registrarEvento } from '@/lib/eventos'
import { notificar } from '@/lib/avisos'
import { makeInlineKeyboard, type InlineKeyboard } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { detectarContacto } from '@/lib/detectar-contacto'
import { PLANTILLAS } from '@/lib/plantillas-aviso'
import { esc } from '@/lib/html'
import { explicarEspera, type Espera } from '@/lib/esperas'
import type { Situacion } from '@/lib/que-me-toca'

const VENTANA_ATASCO_MIN = 30
const BENIGNOS = new Set(['en_curso', 'nada'])

export const DUDAS = {
  dir: 'No encuentro la dirección', ent: 'No sé cómo entrar', hora: 'Necesito cambiar la hora', mal: 'Algo no está bien', otra: 'Otra duda',
} as const
export type TipoDuda = keyof typeof DUDAS
export const esTipoDuda = (t: unknown): t is TipoDuda => typeof t === 'string' && t in DUDAS

export function menuDudas(): InlineKeyboard {
  return makeInlineKeyboard([...(Object.keys(DUDAS) as TipoDuda[]).map((t) => [{ text: DUDAS[t], callback_data: `d:${t}` }]), [{ text: 'Reportar un problema con un cliente', callback_data: 'xp' }]])
}

type Compita = { id: string; nombre: string }

// ── Tareas para el admin (una abierta por tema y compita) ───────────────────────────────────────────────────────
async function abrirTarea(i: { compita: Compita; tipo: 'duda_sin_resolver' | 'estado_no_reconocido'; titulo: string; nota: string; prioridad: 1 | 2; aviso: string }): Promise<boolean> {
  const admin = createAdminSupabase()
  const { data: previa } = await admin.from('admin_flags').select('id').eq('tipo', i.tipo).eq('entidad_id', i.compita.id).eq('resuelto', false).like('entidad_nombre', `%${i.titulo}%`).maybeSingle()
  if (previa) return false // ya hay una abierta de este tema: no se duplica
  await admin.from('admin_flags').insert({
    entidad_tipo: 'compita', entidad_id: i.compita.id, entidad_nombre: `${i.titulo}: ${i.compita.nombre}`, nota: i.nota,
    reportado_por: 'ayuda automática', resuelto: false, tipo: i.tipo, prioridad: i.prioridad,
  })
  // Solo lo urgente suena por Telegram; lo demás vive en la bandeja del panel (la tarea ya está creada).
  if (i.prioridad === 1) await alertaAdmin('urgente', i.aviso, { critica: true, sinTarea: true, categoria: i.tipo, entidad: { tipo: 'compita', id: i.compita.id, nombre: i.compita.nombre } })
  else await alertaAdmin('actividad', i.aviso, { categoria: i.tipo, entidad: { tipo: 'compita', id: i.compita.id, nombre: i.compita.nombre } })
  return true
}

// ── 1 y 2. "¿Qué me toca?": evento, estado no reconocido y atasco ───────────────────────────────────────────────
export async function registrarConsultaQueMeToca(compita: Compita, sit: Situacion, ahora: Date = new Date()): Promise<{ atascado: boolean }> {
  const admin = createAdminSupabase()
  const intentos = Number((await getAjustes()).ayuda_intentos)
  const firma = [...sit.codigosTurno].filter((c) => !BENIGNOS.has(c)).sort().join('+')
  let atascado = false
  if (firma) {
    const desde = new Date(ahora.getTime() - VENTANA_ATASCO_MIN * 60_000).toISOString()
    const { data } = await admin.from('eventos').select('datos').eq('entidad', 'compita').eq('entidad_id', compita.id).eq('tipo', 'que_me_toca').gte('creado_en', desde)
    const iguales = ((data ?? []) as { datos: { firma?: string } | null }[]).filter((e) => e.datos?.firma === firma).length
    // Esta consulta es una más: con `ayuda_intentos` seguidas sobre lo mismo y sin avanzar, el compita está atascado.
    if (iguales + 1 >= intentos) {
      atascado = await abrirTarea({
        compita, tipo: 'duda_sin_resolver', titulo: 'Duda sin resolver (atascado)', prioridad: 2,
        nota: `${compita.nombre} preguntó "¿Qué me toca?" ${iguales + 1} veces en ${VENTANA_ATASCO_MIN} minutos y su situación no cambió (${firma}). Escríbele por Telegram para ayudarlo: no llames. Sirve también para mejorar el texto o el paso que no entiende.`,
        aviso: `<b>Un compita parece atascado</b>\n\n<b>${esc(compita.nombre)}</b> preguntó "¿Qué me toca?" ${iguales + 1} veces seguidas sin avanzar.\n<b>Situación:</b> ${esc(firma)}\nEscríbele por Telegram.`,
      })
    }
  }
  await registrarEvento({ entidad: 'compita', entidadId: compita.id, tipo: 'que_me_toca', actor: `compita:${compita.id}`, datos: { firma: firma || sit.codigos.join('+'), turno: sit.codigosTurno.length, no_reconocido: sit.noReconocido } })
  if (sit.noReconocido) {
    await abrirTarea({
      compita, tipo: 'estado_no_reconocido', titulo: 'Estado no reconocido', prioridad: 2,
      nota: `${compita.nombre} tiene una visita o solicitud activa que "¿Qué me toca?" no supo explicar (códigos: ${sit.codigos.join(', ')}). Revisa el estado de sus visitas y solicitudes, y agrega esa situación a la guía del bot.`,
      aviso: `<b>Estado no reconocido</b>\n\n"¿Qué me toca?" no supo explicarle su situación a <b>${esc(compita.nombre)}</b>. Revisa sus visitas y solicitudes.`,
    })
  }
  return { atascado }
}

// ── 3. Tengo una duda ──────────────────────────────────────────────────────────────────────────────────────────
type VisitaD = { id: string; usuario_id: string; estado: string; fecha_programada: string | null; direccion: string | null; indicaciones: string | null; quien_abre: string | null; contacto_nombre: string | null }
const PRIORIDAD = ['en_curso', 'confirmando_inicio', 'programada', 'pre_visita']

async function visitaParaDuda(compitaId: string): Promise<VisitaD | null> {
  const { data } = await createAdminSupabase().from('visitas').select('id, usuario_id, estado, fecha_programada, direccion, indicaciones, quien_abre, contacto_nombre').eq('compita_id', compitaId).in('estado', PRIORIDAD)
  const l = ((data ?? []) as VisitaD[]).sort((a, b) => PRIORIDAD.indexOf(a.estado) - PRIORIDAD.indexOf(b.estado) || String(a.fecha_programada).localeCompare(String(b.fecha_programada)))
  return l[0] ?? null
}

export interface Respuesta { texto: string; teclado?: InlineKeyboard; escalada?: boolean }
const preguntaResuelta = (t: TipoDuda): InlineKeyboard => makeInlineKeyboard([[{ text: 'Se resolvió', callback_data: `dr:ok:${t}` }], [{ text: 'Sigo con la duda', callback_data: `dr:no:${t}` }]])
const unir = (a: InlineKeyboard | undefined, b: InlineKeyboard): InlineKeyboard => ({ inline_keyboard: [...(a?.inline_keyboard ?? []), ...b.inline_keyboard] })

/** Toque en una opción del menú: respuesta automática según SU situación real, y queda registrada por tipo. */
export async function responderDuda(tipo: TipoDuda, compita: Compita, ahora: Date = new Date()): Promise<Respuesta> {
  const v = await visitaParaDuda(compita.id)
  await registrarEvento({ entidad: 'compita', entidadId: compita.id, tipo: 'duda_compita', actor: `compita:${compita.id}`, datos: { tipo, resultado: 'auto', con_visita: !!v } })
  if (tipo === 'mal') {
    // Algo no está bien puede ser serio: no se espera a ningún intento. Una persona lo ve ya.
    await escalarDuda(compita, 'mal', 'Algo no está bien', true, v)
    return { escalada: true, texto: `Lamento que algo no esté bien. Ya avisamos al equipo con urgencia y te escribirá por aquí.\n\nSi te sientes en riesgo, no esperes: usa estos botones.`, teclado: makeInlineKeyboard([[{ text: 'No me siento seguro', callback_data: 'seguro' }], [{ text: 'Emergencia', callback_data: 'emergencia' }]]) }
  }
  if (tipo === 'otra') return { texto: `Cuéntanos tu duda en un solo mensaje de texto, ahora. Un miembro del equipo la leerá y te responderá por aquí, por Telegram.\n\nNo escribas teléfonos ni correos: no los podemos pasar.` }

  if (!v) return { texto: `No encontré una visita próxima tuya. Toca ¿Qué me toca? para ver en qué estás.` }
  if (tipo === 'dir') {
    if (v.direccion && v.estado === 'programada') {
      const c = await PLANTILLAS.direccion_visita.render({ visitaId: v.id }).catch(() => null)
      if (c?.telegram) return { texto: `Aquí está otra vez la dirección de tu visita:\n\n${c.telegram.texto}\n\nSi estás en el lugar y no lo encuentras, escríbele al cliente desde el chat de la visita: es la forma más rápida. ¿Se resolvió?`, teclado: preguntaResuelta('dir') }
    }
    if (!v.direccion) {
      const r = await recordarAlCliente({ tipo: 'dir', id: v.id, compita, ahora })
      return { texto: `El cliente todavía no registró la dirección. ${r.ok ? 'Ya se lo recordamos por correo.' : r.motivo === 'reciente' ? 'Ya se lo recordamos hace poco.' : 'Lo estamos avisando.'} Apenas la registre te la enviamos por aquí. ¿Se resolvió?`, teclado: preguntaResuelta('dir') }
    }
    return { texto: `Tu visita todavía no es hoy: la dirección llega unas horas antes. Toca ¿Qué me toca? para ver cuándo. ¿Se resolvió?`, teclado: preguntaResuelta('dir') }
  }
  if (tipo === 'ent') {
    const dato = [v.indicaciones && `<b>Cómo entrar:</b> ${esc(v.indicaciones)}`, v.quien_abre && `<b>Quién abre:</b> ${esc(v.quien_abre)}`, v.contacto_nombre && `<b>Contacto en el sitio:</b> ${esc(v.contacto_nombre)}`].filter(Boolean)
    return { texto: `${dato.length ? `Esto dejó el cliente para entrar:\n\n${dato.join('\n')}` : 'El cliente no dejó indicaciones para entrar.'}\n\nSi llegas y nadie abre, toca "Llegué y nadie abre" (primero envías la foto de llegada) y nosotros avisamos al cliente y al contacto. ¿Se resolvió?`, teclado: unir(undefined, preguntaResuelta('ent')) }
  }
  // hora
  return { texto: `Si necesitas cambiar la hora de la visita toca el botón: le avisamos al cliente y se coordina otra. Si es con menos de 24 horas de aviso queda registrado. ¿Se resolvió?`, teclado: unir(makeInlineKeyboard([[{ text: 'Necesito reagendar', callback_data: 'reagendar_visita' }]]), preguntaResuelta('hora')) }
}

/** "Sigo con la duda": cuenta como intento sin resolver; al llegar a `ayuda_intentos`, pasa a una persona. */
export async function dudaNoResuelta(tipo: TipoDuda, compita: Compita, ahora: Date = new Date()): Promise<Respuesta> {
  const intentos = Number((await getAjustes()).ayuda_intentos)
  const v = await visitaParaDuda(compita.id)
  await registrarEvento({ entidad: 'compita', entidadId: compita.id, tipo: 'duda_compita', actor: `compita:${compita.id}`, datos: { tipo, resultado: 'no_resuelta' } })
  const desde = new Date(ahora.getTime() - 24 * 3600_000).toISOString()
  const { data } = await createAdminSupabase().from('eventos').select('datos').eq('entidad', 'compita').eq('entidad_id', compita.id).eq('tipo', 'duda_compita').gte('creado_en', desde)
  const noResueltas = ((data ?? []) as { datos: { tipo?: string; resultado?: string } | null }[]).filter((e) => e.datos?.tipo === tipo && e.datos?.resultado === 'no_resuelta').length
  if (noResueltas >= intentos) {
    await escalarDuda(compita, tipo, DUDAS[tipo], false, v)
    return { escalada: true, texto: `Lo sentimos, no pudimos resolverlo solos. Ya pasamos tu duda a una persona del equipo: te escribirá por aquí, por Telegram, lo antes posible. No hace falta que hagas nada más.` }
  }
  return { texto: `Intentemos de otra forma. Elige otra opción o cuéntanos tu duda con detalle:`, teclado: menuDudas() }
}

export function dudaResuelta(tipo: TipoDuda, compita: Compita): Promise<void> {
  return registrarEvento({ entidad: 'compita', entidadId: compita.id, tipo: 'duda_compita', actor: `compita:${compita.id}`, datos: { tipo, resultado: 'resuelta' } }).then(() => undefined)
}

/** El texto de "Otra duda": se filtra de contactos y pasa directo a una persona (no hay respuesta automática posible). */
export async function dudaConTexto(compita: Compita, textoCrudo: string): Promise<void> {
  const limpio = detectarContacto(textoCrudo.slice(0, 600)).textoCensurado
  await registrarEvento({ entidad: 'compita', entidadId: compita.id, tipo: 'duda_compita', actor: `compita:${compita.id}`, datos: { tipo: 'otra', resultado: 'escalada' } })
  await escalarDuda(compita, 'otra', 'Otra duda', false, await visitaParaDuda(compita.id), limpio)
}

async function escalarDuda(compita: Compita, tipo: TipoDuda, etiqueta: string, urgente: boolean, v: VisitaD | null, texto?: string): Promise<void> {
  if (tipo !== 'mal') await registrarEvento({ entidad: 'compita', entidadId: compita.id, tipo: 'duda_compita', actor: 'sistema', datos: { tipo, resultado: 'escalada' } }).catch(() => undefined)
  await abrirTarea({
    compita, tipo: 'duda_sin_resolver', titulo: `Duda sin resolver (${etiqueta})`, prioridad: urgente ? 1 : 2,
    nota: `${compita.nombre} tiene una duda: "${etiqueta}".${texto ? `\nDijo: ${texto}` : ''}${v ? `\nSu visita está en estado "${v.estado}".` : '\nNo tiene una visita próxima.'}\nRespóndele por Telegram, nunca por llamada. Si se repite por el mismo motivo, conviene arreglar la causa (por ejemplo, mejorar el campo de indicaciones).`,
    aviso: `<b>${urgente ? 'URGENTE: ' : ''}Duda sin resolver</b>\n\n<b>${esc(compita.nombre)}</b>: ${esc(etiqueta)}.${texto ? `\n"${esc(texto)}"` : ''}\n\nRespóndele por Telegram.`,
  })
}

// ── 4. Recordarle al cliente ───────────────────────────────────────────────────────────────────────────────────
export type TipoRecordatorio = 'hora' | 'dir' | 'pago' | 'fecha'
export const esTipoRecordatorio = (t: unknown): t is TipoRecordatorio => t === 'hora' || t === 'dir' || t === 'pago' || t === 'fecha'
export type ResultadoRecordatorio = { ok: true } | { ok: false; motivo: 'no_aplica' } | { ok: false; motivo: 'reciente' | 'limite'; espera: Espera }

/** ¿Sigue esperando el compita ese paso del cliente? Devuelve el id del cliente o null. */
async function clienteQueEspera(tipo: TipoRecordatorio, id: string, compitaId: string): Promise<string | null> {
  const admin = createAdminSupabase()
  if (tipo === 'hora' || tipo === 'pago') {
    const { data } = await admin.from('solicitudes').select('cliente_id, estado, tipo, slot_confirmado').eq('id', id).eq('compita_id', compitaId).maybeSingle()
    const s = data as { cliente_id: string; estado: string; tipo: string; slot_confirmado: string | null } | null
    if (!s || s.estado !== 'aceptada') return null
    if (tipo === 'hora') {
      if (s.tipo !== 'entrevista' || s.slot_confirmado) return null
      const { data: r } = await admin.from('reservas_horario').select('id').eq('compita_id', compitaId).eq('cliente_id', s.cliente_id).eq('estado', 'reservada').gt('vence_en', new Date().toISOString()).maybeSingle()
      return r ? null : s.cliente_id
    }
    if (s.tipo !== 'directa' && s.tipo !== 'mandado') return null
    const { data: vis } = await admin.from('visitas').select('id').eq('compita_id', compitaId).eq('usuario_id', s.cliente_id).limit(1).maybeSingle()
    return vis ? null : s.cliente_id
  }
  const { data } = await admin.from('visitas').select('usuario_id, estado, fecha_programada, direccion').eq('id', id).eq('compita_id', compitaId).maybeSingle()
  const v = data as { usuario_id: string; estado: string; fecha_programada: string | null; direccion: string | null } | null
  if (!v) return null
  if (tipo === 'dir') return v.estado === 'programada' && !v.direccion ? v.usuario_id : null
  return v.estado === 'pre_visita' && !v.fecha_programada ? v.usuario_id : null
}

export async function recordarAlCliente(i: { tipo: TipoRecordatorio; id: string; compita: Compita; ahora?: Date }): Promise<ResultadoRecordatorio> {
  const ahora = i.ahora ?? new Date()
  const clienteId = await clienteQueEspera(i.tipo, i.id, i.compita.id)
  if (!clienteId) return { ok: false, motivo: 'no_aplica' }
  const a = await getAjustes()
  const { data } = await createAdminSupabase().from('eventos').select('creado_en, datos').eq('entidad', i.tipo === 'hora' || i.tipo === 'pago' ? 'solicitud' : 'visita').eq('entidad_id', i.id).eq('tipo', 'recordatorio_al_cliente')
  const previos = ((data ?? []) as { creado_en: string; datos: { tipo?: string } | null }[]).filter((e) => e.datos?.tipo === i.tipo)
  const max = Number(a.recordatorio_cliente_max)
  if (previos.length >= max) {
    // Se le dice al compita que el equipo se entera, así que de verdad se abre UNA tarea (una por paso pendiente).
    const { data: cli } = await createAdminSupabase().from('usuarios').select('nombre').eq('id', clienteId).maybeSingle()
    const nombreCli = (cli as { nombre: string } | null)?.nombre ?? 'El cliente'
    await alertaAdmin('tarea', `<b>${esc(nombreCli)} no responde a los recordatorios</b>\n\n${esc(i.compita.nombre)} le recordó ${previos.length} veces (el máximo) y sigue sin completar su paso: ${i.tipo}. Conviene que el equipo lo contacte por correo.`,
      { categoria: 'cliente_sin_respuesta', clave: `recordatorio_limite:${i.tipo}:${i.id}`, entidad: { tipo: 'cliente', id: clienteId, nombre: `Sin respuesta a recordatorios: ${nombreCli}` } })
    return { ok: false, motivo: 'limite', espera: explicarEspera('recordatorio_limite', { usados: previos.length, max, ahora }) }
  }
  const ultimo = previos.map((e) => new Date(e.creado_en).getTime()).sort((x, y) => y - x)[0]
  const cadaMs = Number(a.recordatorio_cliente_horas) * 3600_000
  if (ultimo && ahora.getTime() - ultimo < cadaMs) return { ok: false, motivo: 'reciente', espera: explicarEspera('recordatorio_reciente', { desde: new Date(ultimo), duracionMs: cadaMs, ahora }) }

  const r = await notificar({
    plantilla: 'recordatorio_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: clienteId },
    variables: { tipo: i.tipo, id: i.id, compitaId: i.compita.id }, entidad: i.tipo === 'hora' || i.tipo === 'pago' ? 'solicitud' : 'visita', entidadId: i.id, paso: 13,
    claveUnica: `recordatorio_cliente:${i.tipo}:${i.id}:${previos.length + 1}`,
  })
  if (!r.ok) return { ok: false, motivo: 'no_aplica' }
  await registrarEvento({ entidad: i.tipo === 'hora' || i.tipo === 'pago' ? 'solicitud' : 'visita', entidadId: i.id, tipo: 'recordatorio_al_cliente', actor: `compita:${i.compita.id}`, datos: { tipo: i.tipo, numero: previos.length + 1 } })
  return { ok: true }
}

// ── Resumen para el admin (Estado del sistema) ─────────────────────────────────────────────────────────────────
export async function resumenAyuda(dias = 7, ahora: Date = new Date()) {
  const desde = new Date(ahora.getTime() - dias * 86_400_000).toISOString()
  const admin = createAdminSupabase()
  const { data } = await admin.from('eventos').select('tipo, datos').in('tipo', ['duda_compita', 'que_me_toca', 'recordatorio_al_cliente']).gte('creado_en', desde)
  const filas = (data ?? []) as { tipo: string; datos: Record<string, unknown> | null }[]
  const dudas: Record<string, { total: number; resueltas: number; no_resueltas: number; escaladas: number }> = {}
  const situaciones: Record<string, number> = {}; const recordatorios: Record<string, number> = {}
  let noReconocidos = 0
  for (const f of filas) {
    if (f.tipo === 'duda_compita') {
      const t = String(f.datos?.tipo ?? 'otra'); const d = (dudas[t] ??= { total: 0, resueltas: 0, no_resueltas: 0, escaladas: 0 }); const res = f.datos?.resultado
      if (res === 'auto') d.total++; else if (res === 'resuelta') d.resueltas++; else if (res === 'no_resuelta') d.no_resueltas++; else if (res === 'escalada') d.escaladas++
    } else if (f.tipo === 'que_me_toca') { const k = String(f.datos?.firma ?? ''); if (k) situaciones[k] = (situaciones[k] ?? 0) + 1; if (f.datos?.no_reconocido === true) noReconocidos++ }
    else { const t = String(f.datos?.tipo ?? ''); recordatorios[t] = (recordatorios[t] ?? 0) + 1 }
  }
  const { data: abiertas } = await admin.from('admin_flags').select('tipo').in('tipo', ['duda_sin_resolver', 'estado_no_reconocido']).eq('resuelto', false)
  const topSituaciones = Object.entries(situaciones).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([firma, veces]) => ({ firma, veces }))
  return { dias, dudas, topSituaciones, noReconocidos, recordatorios, tareasAbiertas: (abiertas ?? []).length }
}
