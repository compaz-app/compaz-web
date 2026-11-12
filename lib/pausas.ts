// Pausa de cuenta por compartir contactos. La PRIMERA detección en 30 días solo se censura y se avisa; la SEGUNDA pausa a la persona (cliente o
// compita) hasta que el equipo decida: reactivar, dar otra oportunidad (con advertencia por escrito) o bloquear. Si ya tuvo otra oportunidad y
// reincide, igual se pausa (reversible) pero se le marca al equipo que lo recomendable es bloquear: nunca se bloquea una cuenta sola.
// Mientras dura la pausa: no escribe en el chat, no crea solicitudes ni visitas nuevas, y el compita pausado no se ofrece. Una visita ya en
// curso NO se interrumpe (la seguridad de las personas va primero): el equipo decide sobre lo programado en la tarea.

import { createAdminSupabase } from '@/lib/supabase-server'
import { registrarEvento } from '@/lib/eventos'
import { alertaAdmin } from '@/lib/alertas-admin'
import { notificar } from '@/lib/avisos'
import { sendTelegramMessage } from '@/lib/telegram'
import { bloquearCompita } from '@/lib/compitas'
import { bloquearCliente } from '@/lib/usuarios'
import { esc } from '@/lib/html'
import { getAjustes } from '@/lib/ajustes'

export type RolPausa = 'cliente' | 'compita'
export const DECISIONES_PAUSA = ['reactivar', 'otra_oportunidad', 'bloquear'] as const
export type DecisionPausa = (typeof DECISIONES_PAUSA)[number]

/** Cuántas detecciones en la ventana pausan a la persona, y cuánto dura la ventana. */
/** Valores de fábrica; los que rigen son los de Ajustes (detecciones_umbral y detecciones_ventana_dias). */
export const DETECCIONES_PARA_PAUSA = 2
export const VENTANA_DIAS = 30
const DIA = 86_400_000

/** Cuenta detecciones separadas: varias seguidas en pocos minutos (un mensaje reenviado, un doble toque) valen como UNA, no como un reincidente. */
export const SEPARACION_MIN = 5
export function contarDetecciones(instantes: string[]): number {
  let n = 0; let ultima = -Infinity
  for (const t of [...instantes].sort()) { const ms = new Date(t).getTime(); if (ms - ultima >= SEPARACION_MIN * 60_000) { n++; ultima = ms } }
  return n
}

export async function personaPausada(rol: RolPausa, personaId: string): Promise<boolean> {
  const { data } = await createAdminSupabase().from('pausas_contacto').select('id').eq('rol', rol).eq('persona_id', personaId).eq('activa', true).maybeSingle()
  return !!data
}

/** Cuáles de estos compitas están pausados por contactos (una consulta, para el listado). */
export async function compitasPausadosPorContacto(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const { data } = await createAdminSupabase().from('pausas_contacto').select('persona_id').eq('rol', 'compita').eq('activa', true).in('persona_id', ids)
  return new Set(((data ?? []) as { persona_id: string }[]).map((p) => p.persona_id))
}

/**
 * Se detectó un dato de contacto de esta persona. Deja el evento y, si es la segunda vez en 30 días, la pausa.
 * Nunca lanza: reportar no debe romper el flujo que lo llama. Devuelve true si la dejó en pausa ahora.
 */
export async function registrarContactoBloqueado(p: { rol: RolPausa; personaId: string; nombre: string; donde: string }, ahora: Date = new Date()): Promise<boolean> {
  try {
    const admin = createAdminSupabase()
    const aj = await getAjustes()
    await registrarEvento({ entidad: p.rol, entidadId: p.personaId, tipo: 'contacto_bloqueado', actor: 'sistema', datos: { donde: p.donde } })
    // Lo que el equipo decidió antes cambia la cuenta: "reactivar" borra la cuenta de detecciones (empieza de cero); "otra oportunidad" deja
    // a la persona advertida, así que la PRÓXIMA detección ya la pausa (y se marca como reincidente).
    const { data: ultima } = await admin.from('pausas_contacto').select('decision, decidida_en').eq('rol', p.rol).eq('persona_id', p.personaId).not('decidida_en', 'is', null).order('decidida_en', { ascending: false }).limit(1).maybeSingle()
    const u = ultima as { decision: DecisionPausa; decidida_en: string } | null
    let desde = new Date(ahora.getTime() - Number(aj.detecciones_ventana_dias) * DIA).toISOString()
    let umbral = Number(aj.detecciones_umbral)
    if (u && u.decidida_en > desde) {
      if (u.decision === 'reactivar') desde = u.decidida_en
      else if (u.decision === 'otra_oportunidad') { desde = u.decidida_en; umbral = 1 }
    }
    const { data: evs } = await admin.from('eventos').select('creado_en').eq('entidad', p.rol).eq('entidad_id', p.personaId).eq('tipo', 'contacto_bloqueado').gte('creado_en', desde).order('creado_en', { ascending: true })
    if (contarDetecciones((evs ?? []).map((e) => String((e as { creado_en: string }).creado_en))) < umbral) return false
    return await pausarPersona(p, ahora)
  } catch (e) {
    console.error('[pausas] no se pudo registrar el contacto:', e)
    return false
  }
}

export async function pausarPersona(p: { rol: RolPausa; personaId: string; nombre: string; donde?: string }, ahora: Date = new Date()): Promise<boolean> {
  const admin = createAdminSupabase()
  const aj = await getAjustes()
  if (await personaPausada(p.rol, p.personaId)) return false // ya está en pausa: no se duplica
  // ¿Ya había recibido otra oportunidad en los últimos 90 días?
  const { data: previa } = await admin.from('pausas_contacto').select('id').eq('rol', p.rol).eq('persona_id', p.personaId).eq('decision', 'otra_oportunidad').gte('decidida_en', new Date(ahora.getTime() - 90 * DIA).toISOString()).limit(1).maybeSingle()
  const reincidente = !!previa
  const { error } = await admin.from('pausas_contacto').insert({ rol: p.rol, persona_id: p.personaId, reincidente })
  if (error) { if (error.code !== '23505') console.error('[pausas] no se pudo pausar:', error.message); return false }
  await registrarEvento({ entidad: p.rol, entidadId: p.personaId, tipo: 'cuenta_pausada', actor: 'sistema', datos: { reincidente } })

  // Aviso a la persona (claro y sin acusar).
  if (p.rol === 'cliente') await notificar({ plantilla: 'pausa_cuenta_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: p.personaId }, variables: {}, entidad: 'cliente', entidadId: p.personaId, paso: 14, claveUnica: `pausa_cuenta:${p.personaId}:${ahora.toISOString().slice(0, 10)}` })
  else {
    const { data: c } = await admin.from('compitas').select('telegram_chat_id').eq('id', p.personaId).maybeSingle()
    const chat = (c as { telegram_chat_id: string | null } | null)?.telegram_chat_id
    if (chat) await sendTelegramMessage(chat, `⏸️ <b>Tu cuenta está en pausa</b>\n\nDetectamos varios intentos de compartir datos de contacto. Mientras el equipo lo revisa no recibirás solicitudes nuevas ni podrás escribir en el chat. El equipo se comunica contigo por aquí. Si estás en una visita, sigue con normalidad.`).catch(() => {})
  }

  // Lo programado con esta persona, para que el equipo decida con la información completa.
  const { data: vs } = await admin.from('visitas').select('id').eq(p.rol === 'cliente' ? 'usuario_id' : 'compita_id', p.personaId).in('estado', ['pre_visita', 'programada'])
  const n = (vs ?? []).length
  await alertaAdmin('tarea',
    `⏸️ <b>Cuenta en pausa por compartir contactos</b>\n\n<b>${esc(p.nombre)}</b> (${p.rol}) compartió datos de contacto por ${Number(aj.detecciones_umbral)}.ª vez en ${Number(aj.detecciones_ventana_dias)} días${p.donde ? ` (último: ${esc(p.donde)})` : ''}. Quedó en pausa y no tiene fecha de fin hasta que decidas: reactivar, dar otra oportunidad o bloquear.${reincidente ? '\n\n⚠️ Ya había recibido otra oportunidad: lo recomendable es bloquear.' : ''}${n ? `\n\nTiene ${n} visita(s) programada(s) o por agendar con esta persona.` : ''}`,
    { categoria: 'cuenta_pausada', clave: `pausa:${p.rol}:${p.personaId}`, entidad: { tipo: p.rol, id: p.personaId, nombre: `⏸️ Cuenta en pausa: ${p.nombre}` } },
  )
  return true
}

export interface PausaPendiente { id: string; rol: RolPausa; persona_id: string; nombre: string; creada_en: string; reincidente: boolean; visitas_abiertas: number }

export async function pausasActivas(): Promise<PausaPendiente[]> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('pausas_contacto').select('id, rol, persona_id, creada_en, reincidente').eq('activa', true).order('creada_en', { ascending: true })
  const filas = (data ?? []) as { id: string; rol: RolPausa; persona_id: string; creada_en: string; reincidente: boolean }[]
  const salida: PausaPendiente[] = []
  for (const f of filas) {
    const tabla = f.rol === 'cliente' ? 'usuarios' : 'compitas'
    const [{ data: p }, { data: vs }] = await Promise.all([
      admin.from(tabla).select('nombre').eq('id', f.persona_id).maybeSingle(),
      admin.from('visitas').select('id').eq(f.rol === 'cliente' ? 'usuario_id' : 'compita_id', f.persona_id).in('estado', ['pre_visita', 'programada']),
    ])
    salida.push({ ...f, nombre: (p as { nombre: string } | null)?.nombre ?? '', visitas_abiertas: (vs ?? []).length })
  }
  return salida
}

/** El equipo decide. Queda quién, cuándo y qué; se cierra la tarea; la persona recibe su aviso; y si se bloquea, se aplica el bloqueo real. */
export async function decidirPausa(pausaId: string, decision: DecisionPausa, por: string, ahora: Date = new Date()): Promise<boolean> {
  const admin = createAdminSupabase()
  const { data: p } = await admin.from('pausas_contacto').update({ activa: false, decision, decidida_por: por, decidida_en: ahora.toISOString() }).eq('id', pausaId).eq('activa', true).select('rol, persona_id').maybeSingle()
  if (!p) return false
  const x = p as { rol: RolPausa; persona_id: string }
  if (decision === 'bloquear') { if (x.rol === 'cliente') await bloquearCliente(x.persona_id, true); else await bloquearCompita(x.persona_id) }
  else if (x.rol === 'cliente') await notificar({ plantilla: 'pausa_cuenta_decision', canal: 'correo', destinatario: { tipo: 'cliente', id: x.persona_id }, variables: { decision }, entidad: 'cliente', entidadId: x.persona_id, paso: 14, claveUnica: `pausa_decision:${pausaId}` })
  else {
    const { data: c } = await admin.from('compitas').select('telegram_chat_id').eq('id', x.persona_id).maybeSingle()
    const chat = (c as { telegram_chat_id: string | null } | null)?.telegram_chat_id
    if (chat) await sendTelegramMessage(chat, decision === 'reactivar' ? '▶️ <b>Tu cuenta se reactivó.</b> Ya vuelves a recibir solicitudes y puedes usar el chat con normalidad.' : '▶️ <b>Tu cuenta se reactivó, con una advertencia.</b> Compartir datos de contacto fuera de Compaz va contra las reglas: si vuelve a ocurrir, tu cuenta se bloqueará.').catch(() => {})
  }
  await admin.from('admin_flags').update({ resuelto: true }).eq('tipo', 'cuenta_pausada').eq('entidad_id', x.persona_id).eq('resuelto', false)
  await registrarEvento({ entidad: x.rol, entidadId: x.persona_id, tipo: 'cuenta_pausa_decidida', actor: `admin:${por}`.slice(0, 120) as `admin:${string}`, datos: { decision } })
  await alertaAdmin('actividad', `${por} decidió sobre una cuenta en pausa (${x.rol}): ${decision.replace(/_/g, ' ')}`, { categoria: 'pausa_decidida', entidad: { tipo: x.rol, id: x.persona_id } })
  return true
}
