// Cambio de quién estará en el lugar después de que el compita aceptó. REGLA: la lista nunca cambia sin que el compita
// se entere antes de ir. Al cambiarla, el compita recibe de inmediato el aviso con la lista nueva y decide "Sigo con la
// visita" o "Prefiero no ir" (sin penalización). Si no responde a tiempo, se abre la tarea "Cambio en el lugar" en la
// Bandeja. Todo queda como evento `lugar_personas_cambiadas` (quién, antes, después y la respuesta).

import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjustes } from '@/lib/ajustes'
import { registrarEvento } from '@/lib/eventos'
import { notificar } from '@/lib/avisos'
import { sendTelegramMessage, avisarAdmin, makeInlineKeyboard } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { esc } from '@/lib/html'
import { horasDeAviso, registrarCancelacion } from '@/lib/cancelaciones'
import { textoPersonas } from '@/lib/plantillas-aviso'
import { TIPOS_PERSONA, MAX_PERSONAS } from '@/lib/validar-solicitud'

export type ListaPersonas = string[] | null // null = no era un lugar privado; [] = nadie más

/** Valida la lista nueva con las mismas reglas del formulario. Devuelve la lista ([] si nadie más) o un error. */
export function validarListaPersonas(b: Record<string, unknown>): { ok: true; lista: string[] } | { ok: false; error: string } {
  const nadie = b.nadie_mas === true
  const personas = b.personas_en_lugar
  if (personas !== undefined && !Array.isArray(personas)) return { ok: false, error: 'Indica quién más estará en el lugar' }
  const lista = (personas ?? []) as unknown[]
  if (nadie) return lista.length > 0 ? { ok: false, error: 'Si no estará nadie más, la lista debe ir vacía' } : { ok: true, lista: [] }
  if (lista.length === 0) return { ok: false, error: 'Indica quién más estará en el lugar, o elige "Nadie más"' }
  if (lista.length > MAX_PERSONAS) return { ok: false, error: `Máximo ${MAX_PERSONAS} personas` }
  if (!lista.every((p) => typeof p === 'string' && (TIPOS_PERSONA as readonly string[]).includes(p))) return { ok: false, error: 'Tipo de persona inválido' }
  return { ok: true, lista: lista as string[] }
}

const igual = (a: ListaPersonas, b: ListaPersonas) =>
  a === null || b === null ? a === b : a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')

const SIN_DATO = 'No era un lugar privado'
const describir = (l: ListaPersonas) => (l === null ? SIN_DATO : textoPersonas(l) ?? SIN_DATO)

type VisitaLugar = {
  id: string; usuario_id: string; compita_id: string; estado: string
  fecha_programada: string | null; hora_inicio_programada: string | null; personas_en_lugar: ListaPersonas
  compitas: { nombre: string; telegram_chat_id: string | null } | null; usuarios: { nombre: string } | null
}

/** La visita que viene del cliente (en coordinación o programada) con sus datos para avisar. */
export async function visitaParaLugar(clienteId: string): Promise<VisitaLugar | null> {
  const { data } = await createAdminSupabase().from('visitas')
    .select('id, usuario_id, compita_id, estado, fecha_programada, hora_inicio_programada, personas_en_lugar, compitas(nombre, telegram_chat_id), usuarios(nombre)')
    .eq('usuario_id', clienteId).in('estado', ['pre_visita', 'programada']).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return (data as VisitaLugar | null) ?? null
}

/** La lista vigente: la de la visita si ya se editó; si no, la que el compita vio al aceptar la solicitud. */
export async function listaActual(v: VisitaLugar): Promise<ListaPersonas> {
  if (v.personas_en_lugar !== null && v.personas_en_lugar !== undefined) return v.personas_en_lugar
  const { data } = await createAdminSupabase().from('solicitudes').select('personas_en_lugar, lugar_privado')
    .eq('cliente_id', v.usuario_id).eq('compita_id', v.compita_id).in('estado', ['aceptada', 'completada', 'contratada'])
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  const s = data as { personas_en_lugar: ListaPersonas; lugar_privado: boolean | null } | null
  return s && s.lugar_privado && Array.isArray(s.personas_en_lugar) ? s.personas_en_lugar : null
}

export type ResultadoCambio =
  | { ok: true; cambio: false }
  | { ok: true; cambio: true; id: string; venceEn: string; avisado: boolean }
  | { ok: false; motivo: 'sin_visita' | 'invalido' | 'error'; error: string }

/** Cuánto esperar la respuesta del compita antes de abrir la tarea: % del tiempo que falta (tope en Ajustes); inmediato si falta muy poco. */
export async function esperaRespuesta(v: Pick<VisitaLugar, 'fecha_programada' | 'hora_inicio_programada'>, ahora: Date): Promise<Date> {
  const a = await getAjustes()
  const restantes = horasDeAviso(v.fecha_programada, v.hora_inicio_programada, ahora)
  const tope = Number(a.cambio_lugar_max_horas)
  // Falta menos de lo que tarda en entregarse la dirección (ajuste `direccion_horas_antes`): el equipo debe actuar ya.
  if (restantes !== null && restantes <= Number(a.direccion_horas_antes)) return ahora
  const horas = restantes === null ? tope : Math.min(tope, Math.max(0, (restantes * Number(a.cambio_lugar_pct)) / 100))
  return new Date(ahora.getTime() + horas * 3600_000)
}

export async function cambiarPersonasEnLugar(clienteId: string, body: Record<string, unknown>, ahora: Date = new Date()): Promise<ResultadoCambio> {
  const v = validarListaPersonas(body)
  if (!v.ok) return { ok: false, motivo: 'invalido', error: v.error }
  const visita = await visitaParaLugar(clienteId)
  if (!visita) return { ok: false, motivo: 'sin_visita', error: 'No tienes una visita próxima para cambiar.' }
  const antes = await listaActual(visita)
  if (igual(antes, v.lista)) return { ok: true, cambio: false }

  const admin = createAdminSupabase()
  // Primero queda guardado el cambio para que nunca haya una lista nueva sin su aviso registrado.
  const { error: eVisita } = await admin.from('visitas').update({ personas_en_lugar: v.lista }).eq('id', visita.id).in('estado', ['pre_visita', 'programada'])
  if (eVisita) { console.error('[lugar] no se pudo guardar:', eVisita.message); return { ok: false, motivo: 'error', error: 'No pudimos guardar el cambio. Intenta de nuevo.' } }
  await admin.from('cambios_lugar').update({ estado: 'sustituido', respondido_en: ahora.toISOString() }).eq('visita_id', visita.id).eq('estado', 'pendiente')

  const vence = await esperaRespuesta(visita, ahora)
  const { data: fila, error } = await admin.from('cambios_lugar').insert({
    visita_id: visita.id, compita_id: visita.compita_id, cliente_id: clienteId, antes, despues: v.lista, estado: 'pendiente', vence_en: vence.toISOString(),
  }).select('id').single()
  if (error || !fila) { console.error('[lugar] no se pudo registrar el cambio:', error?.message); return { ok: false, motivo: 'error', error: 'No pudimos avisar a tu compita. Intenta de nuevo.' } }
  const id = (fila as { id: string }).id

  await registrarEvento({
    entidad: 'visita', entidadId: visita.id, tipo: 'lugar_personas_cambiadas', actor: `cliente:${clienteId}`,
    datos: { cambio_id: id, antes: describir(antes), despues: describir(v.lista), respuesta: 'pendiente' },
  })

  // Aviso inmediato al compita con la lista nueva.
  const chat = visita.compitas?.telegram_chat_id
  let avisado = false
  if (chat) {
    const primero = esc((visita.usuarios?.nombre ?? 'El cliente').split(' ')[0])
    try {
      await sendTelegramMessage(chat, [
        `⚠️ <b>Cambió quién estará en el lugar</b>`, ``,
        `<b>${primero}</b> modificó la lista de personas de tu próxima visita.`, ``,
        `<b>Antes:</b> ${esc(describir(antes))}`, `<b>Ahora:</b> ${esc(describir(v.lista))}`, ``,
        `Por tu seguridad, decide si sigues con la visita. Si prefieres no ir, no hay ninguna penalización.`,
      ].join('\n'), makeInlineKeyboard([
        [{ text: '✅ Sigo con la visita', callback_data: `lugar:ok:${id}` }],
        [{ text: '🚫 Prefiero no ir', callback_data: `lugar:no:${id}` }],
      ]))
      avisado = true
    } catch (e) { console.error('[lugar] Telegram al compita:', e) }
  }
  // Si no se le pudo avisar, el equipo debe enterarse ya (no se espera a que venza).
  if (!avisado) await admin.from('cambios_lugar').update({ vence_en: ahora.toISOString() }).eq('id', id)
  return { ok: true, cambio: true, id, venceEn: avisado ? vence.toISOString() : ahora.toISOString(), avisado }
}

export type ResultadoRespuestaLugar = { ok: true; cambio: { id: string; visita_id: string; cliente_id: string; compita_id: string } } | { ok: false; motivo: 'no_encontrado' | 'ya_resuelto' }

/** El compita responde: sigue con la visita o prefiere no ir (sin penalización). */
export async function responderCambioLugar(id: string, compitaId: string, respuesta: 'sigue' | 'no_va', ahora: Date = new Date()): Promise<ResultadoRespuestaLugar> {
  const admin = createAdminSupabase()
  const { data: previo } = await admin.from('cambios_lugar').select('id, estado, compita_id').eq('id', id).eq('compita_id', compitaId).maybeSingle()
  if (!previo) return { ok: false, motivo: 'no_encontrado' }
  if ((previo as { estado: string }).estado !== 'pendiente') return { ok: false, motivo: 'ya_resuelto' }
  // Atómico: solo una respuesta pasa de 'pendiente' a su estado final.
  const { data } = await admin.from('cambios_lugar').update({ estado: respuesta, respondido_en: ahora.toISOString() })
    .eq('id', id).eq('compita_id', compitaId).eq('estado', 'pendiente').select('id, visita_id, cliente_id, compita_id, antes, despues').maybeSingle()
  if (!data) return { ok: false, motivo: 'ya_resuelto' }
  const c = data as { id: string; visita_id: string; cliente_id: string; compita_id: string; antes: ListaPersonas; despues: string[] }
  await registrarEvento({
    entidad: 'visita', entidadId: c.visita_id, tipo: 'lugar_personas_cambiadas', actor: `compita:${compitaId}`,
    datos: { cambio_id: id, antes: describir(c.antes), despues: describir(c.despues), respuesta },
  })
  // La tarea del equipo (si ya se había abierto) deja de hacer falta.
  await admin.from('admin_flags').update({ resuelto: true, resuelto_at: ahora.toISOString() }).eq('tipo', 'cambio_lugar').eq('entidad_id', c.visita_id).eq('resuelto', false)

  if (respuesta === 'no_va') {
    // Sin penalización: la visita vuelve a coordinación (no se pierde el crédito) y la cancelación queda registrada como justificada.
    const { data: v } = await admin.from('visitas').select('fecha_programada, hora_inicio_programada').eq('id', c.visita_id).maybeSingle()
    const cancel = await registrarCancelacion({
      visitaId: c.visita_id, compitaId, usuarioId: c.cliente_id, canceladoPor: 'compita',
      fechaProgramada: (v as { fecha_programada: string | null } | null)?.fecha_programada ?? null,
      horaInicioProgramada: (v as { hora_inicio_programada: string | null } | null)?.hora_inicio_programada ?? null,
      motivo: 'Cambio en quién estará en el lugar',
    })
    if (cancel) await admin.from('cancelaciones').update({ justificada: true, justificada_por: 'sistema: cambio en el lugar', justificada_en: ahora.toISOString() }).eq('id', cancel)
    await admin.from('visitas').update({ estado: 'pre_visita', fecha_programada: null }).eq('id', c.visita_id).in('estado', ['pre_visita', 'programada'])
  }
  await notificar({
    plantilla: 'lugar_respuesta', canal: 'correo', destinatario: { tipo: 'cliente', id: c.cliente_id },
    variables: { cambioId: id }, entidad: 'visita', entidadId: c.visita_id, paso: 9, claveUnica: `lugar_respuesta:${id}`,
  })
  return { ok: true, cambio: { id: c.id, visita_id: c.visita_id, cliente_id: c.cliente_id, compita_id: c.compita_id } }
}

/** Cambios sin respuesta cuyo plazo venció: abre UNA tarea "Cambio en el lugar" por cada uno. Lo llama la escalera. */
export async function escalarCambiosLugar(ahora: Date = new Date()): Promise<number> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('cambios_lugar').select('id, visita_id, compita_id, cliente_id, antes, despues, creado_en')
    .eq('estado', 'pendiente').is('escalado_en', null).lte('vence_en', ahora.toISOString())
  let n = 0
  for (const c of (data ?? []) as { id: string; visita_id: string; compita_id: string; cliente_id: string; antes: ListaPersonas; despues: string[]; creado_en: string }[]) {
    // Se marca primero: si dos ejecuciones coinciden, solo una abre la tarea.
    const { data: reclamo } = await admin.from('cambios_lugar').update({ escalado_en: ahora.toISOString() }).eq('id', c.id).eq('estado', 'pendiente').is('escalado_en', null).select('id').maybeSingle()
    if (!reclamo) continue
    const [{ data: cmp }, { data: cli }, { data: vis }, { data: msgs }] = await Promise.all([
      admin.from('compitas').select('nombre').eq('id', c.compita_id).maybeSingle(),
      admin.from('usuarios').select('nombre').eq('id', c.cliente_id).maybeSingle(),
      admin.from('visitas').select('fecha_programada, hora_inicio_programada').eq('id', c.visita_id).maybeSingle(),
      admin.from('mensajes').select('id').eq('visit_id', c.visita_id).eq('origen', 'cliente').gte('created_at', c.creado_en).limit(1),
    ])
    const escribio = (msgs ?? []).length > 0
    const restantes = horasDeAviso((vis as { fecha_programada: string | null } | null)?.fecha_programada, (vis as { hora_inicio_programada: string | null } | null)?.hora_inicio_programada, ahora)
    const urgente = restantes !== null && restantes <= 24
    const nombreCmp = String((cmp as { nombre: string } | null)?.nombre ?? 'el compita'); const nombreCli = String((cli as { nombre: string } | null)?.nombre ?? 'el cliente')
    await admin.from('admin_flags').insert({
      entidad_tipo: 'visita', entidad_id: c.visita_id, entidad_nombre: `⚠️ Cambio en el lugar: ${nombreCmp} / ${nombreCli}`,
      nota: `${nombreCli} cambió quién estará en el lugar y ${nombreCmp} no ha respondido.\nAntes: ${describir(c.antes)}\nAhora: ${describir(c.despues)}\n${escribio ? 'El cliente YA le escribió por el chat.' : 'El cliente todavía no le ha escrito por el chat.'}${restantes !== null ? `\nFaltan ${Math.max(0, Math.round(restantes))} h para la visita.` : ''}\nContacta al compita antes de la visita: nunca debe ir sin saber quién estará.`,
      reportado_por: 'cambio en el lugar', resuelto: false, tipo: 'cambio_lugar', prioridad: urgente ? 1 : 2,
    })
    await alertaAdmin('actividad', `⚠️ <b>Cambio en el lugar sin respuesta</b>\n\n<b>${esc(nombreCmp)}</b> no ha respondido al cambio de personas de <b>${esc(nombreCli)}</b>.${escribio ? ' El cliente ya le escribió por el chat.' : ''}\n\nAbrimos una tarea en la Bandeja.`)
    n++
  }
  return n
}

/** Estado del último cambio de la visita, para mostrarle al cliente que se le avisó al compita y qué respondió. */
export async function estadoCambioLugar(visitaId: string): Promise<{ estado: 'pendiente' | 'sigue' | 'no_va'; creado_en: string } | null> {
  const { data } = await createAdminSupabase().from('cambios_lugar').select('estado, creado_en').eq('visita_id', visitaId).neq('estado', 'sustituido').order('creado_en', { ascending: false }).limit(1).maybeSingle()
  return (data as { estado: 'pendiente' | 'sigue' | 'no_va'; creado_en: string } | null) ?? null
}
