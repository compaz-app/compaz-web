// Envío de avisos con registro. Punto único para avisar a clientes, compitas y al admin.
// Guarda cada aviso en public.avisos, lo envía por Telegram o correo y anota el resultado.
// NUNCA lanza: un fallo de Telegram o del correo no debe cortar el flujo que lo origina (hoy ocurre en
// muchos de los envíos sueltos). Un fallo queda registrado y se puede reintentar.
// Reglas del ciclo (docs/ciclo-comunicaciones.md): se mide la acción, no la entrega; si la persona ya actuó el
// aviso muere; el mismo hecho no se envía dos veces.

import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { sendEmail } from '@/lib/email'
import { PLANTILLAS, type Canal, type NombrePlantilla, type VariablesAviso } from '@/lib/plantillas-aviso'
import type { EntidadEvento } from '@/lib/eventos'

export type DestinatarioTipo = 'cliente' | 'compita' | 'admin'
export type EstadoAviso = 'pendiente' | 'enviado' | 'fallido' | 'cancelado'

export const MAX_INTENTOS = 5
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface PedidoAviso {
  plantilla: NombrePlantilla
  destinatario: { tipo: DestinatarioTipo; id?: string }
  canal: Canal
  /** Variables planas (ids). Sin teléfonos, correos ni secretos: la plantilla lee lo demás de la base. */
  variables: VariablesAviso
  entidad?: EntidadEvento
  entidadId?: string
  /** Paso del ciclo (1 a 16), para medir dónde se pierde la gente. */
  paso?: number
  /** Minutos que se espera una acción antes de pasar a la escalera de respaldo. */
  plazoAccionMin?: number
  /** Idempotencia. Por defecto: plantilla + entidad + destinatario + canal. */
  claveUnica?: string
}

export interface ResultadoAviso {
  ok: boolean
  estado: EstadoAviso | 'duplicado'
  avisoId?: string
  error?: string
}

interface FilaAviso {
  id: string
  destinatario_tipo: DestinatarioTipo
  destinatario_id: string | null
  canal: Canal
  plantilla: string
  variables: VariablesAviso
  estado: EstadoAviso
  intentos: number
}

type Admin = ReturnType<typeof createAdminSupabase>

function recortar(texto: string): string {
  return texto.length > 480 ? texto.slice(0, 480) : texto
}

/** Dónde se envía. Quien llama nunca pasa direcciones: se leen de la base en el momento del envío. */
async function resolverDireccion(admin: Admin, tipo: DestinatarioTipo, id: string | null, canal: Canal): Promise<string | string[] | null> {
  if (tipo === 'admin') {
    if (canal === 'telegram') return process.env.TELEGRAM_ADMIN_CHAT_ID || null
    const correos = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean)
    return correos.length ? correos : null
  }
  if (!id) return null
  if (tipo === 'cliente') {
    if (canal === 'telegram') return null // los clientes no usan Telegram
    const { data } = await admin.from('usuarios').select('email').eq('id', id).maybeSingle()
    return data?.email ?? null
  }
  const { data } = await admin.from('compitas').select('telegram_chat_id, email').eq('id', id).maybeSingle()
  return (canal === 'telegram' ? data?.telegram_chat_id : data?.email) ?? null
}

async function marcar(admin: Admin, id: string, estado: EstadoAviso, error: string | null, intentos: number): Promise<void> {
  const { error: e } = await admin.from('avisos').update({
    estado, error: error ? recortar(error) : null, intentos, ultimo_intento_en: new Date().toISOString(),
  }).eq('id', id)
  if (e) console.error('[avisos] no se pudo anotar el resultado', id, e.message)
}

/** Arma el mensaje, lo envía y anota el resultado. Sirve para el primer envío y para los reintentos. */
async function despachar(admin: Admin, fila: FilaAviso): Promise<ResultadoAviso> {
  const intentos = fila.intentos + 1
  const plantilla = PLANTILLAS[fila.plantilla as NombrePlantilla]
  if (!plantilla || !plantilla.canales.includes(fila.canal)) {
    await marcar(admin, fila.id, 'fallido', `plantilla o canal no soportado: ${fila.plantilla}/${fila.canal}`, intentos)
    return { ok: false, estado: 'fallido', avisoId: fila.id, error: 'plantilla o canal no soportado' }
  }

  let contenido
  try {
    contenido = await plantilla.render(fila.variables)
  } catch (e) {
    const msg = `no se pudo armar el mensaje: ${e instanceof Error ? e.message : String(e)}`
    await marcar(admin, fila.id, 'fallido', msg, intentos)
    return { ok: false, estado: 'fallido', avisoId: fila.id, error: msg }
  }
  if (!contenido) {
    await marcar(admin, fila.id, 'cancelado', 'ya no aplica', intentos - 1)
    return { ok: true, estado: 'cancelado', avisoId: fila.id }
  }

  const parte = fila.canal === 'telegram' ? contenido.telegram : contenido.correo
  if (!parte) {
    await marcar(admin, fila.id, 'fallido', `la plantilla no tiene contenido para ${fila.canal}`, intentos)
    return { ok: false, estado: 'fallido', avisoId: fila.id, error: 'sin contenido para el canal' }
  }

  const direccion = await resolverDireccion(admin, fila.destinatario_tipo, fila.destinatario_id, fila.canal)
  if (!direccion) {
    const msg = fila.canal === 'telegram' ? 'sin Telegram vinculado' : 'sin correo registrado'
    await marcar(admin, fila.id, 'fallido', msg, intentos)
    return { ok: false, estado: 'fallido', avisoId: fila.id, error: msg }
  }

  try {
    if (fila.canal === 'telegram' && contenido.telegram) {
      await sendTelegramMessage(String(direccion), contenido.telegram.texto, contenido.telegram.teclado)
    } else if (contenido.correo) {
      await sendEmail({ to: direccion, subject: contenido.correo.asunto, html: contenido.correo.html })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await marcar(admin, fila.id, 'fallido', msg, intentos)
    return { ok: false, estado: 'fallido', avisoId: fila.id, error: msg }
  }
  await marcar(admin, fila.id, 'enviado', null, intentos)
  return { ok: true, estado: 'enviado', avisoId: fila.id }
}

/**
 * Registra y envía un aviso. Devuelve el resultado; nunca lanza.
 * Si la base no deja guardar el registro, igual se intenta enviar (entregar importa más que anotar).
 */
export async function notificar(p: PedidoAviso, admin: Admin = createAdminSupabase()): Promise<ResultadoAviso> {
  try {
    const plantilla = PLANTILLAS[p.plantilla]
    if (!plantilla) return { ok: false, estado: 'fallido', error: `plantilla desconocida: ${p.plantilla}` }
    if (!plantilla.canales.includes(p.canal)) return { ok: false, estado: 'fallido', error: `la plantilla ${p.plantilla} no soporta ${p.canal}` }
    if (p.destinatario.tipo !== 'admin' && !(p.destinatario.id && UUID.test(p.destinatario.id))) {
      return { ok: false, estado: 'fallido', error: 'destinatario sin id válido' }
    }
    if (p.entidadId && !UUID.test(p.entidadId)) return { ok: false, estado: 'fallido', error: 'entidadId no es un uuid' }

    const clave = p.claveUnica ?? [p.plantilla, p.entidadId ?? 'sin-entidad', p.destinatario.id ?? p.destinatario.tipo, p.canal].join(':')
    const ahora = new Date()
    const { data, error } = await admin.from('avisos').insert({
      destinatario_tipo: p.destinatario.tipo,
      destinatario_id: p.destinatario.id ?? null,
      canal: p.canal,
      plantilla: p.plantilla,
      variables: p.variables,
      entidad: p.entidad ?? null,
      entidad_id: p.entidadId ?? null,
      paso: p.paso ?? null,
      programado_para: ahora.toISOString(),
      plazo_accion_hasta: p.plazoAccionMin ? new Date(ahora.getTime() + p.plazoAccionMin * 60_000).toISOString() : null,
      clave_unica: clave,
    }).select('id').single()

    if (error?.code === '23505') return { ok: true, estado: 'duplicado' } // el mismo hecho ya se avisó
    if (error || !data) {
      console.error('[avisos] no se pudo guardar el aviso; se envía sin registro:', error?.message)
      return await enviarSinRegistro(admin, p)
    }
    return await despachar(admin, {
      id: data.id, destinatario_tipo: p.destinatario.tipo, destinatario_id: p.destinatario.id ?? null,
      canal: p.canal, plantilla: p.plantilla, variables: p.variables, estado: 'pendiente', intentos: 0,
    })
  } catch (e) {
    console.error('[avisos] error inesperado en notificar:', e)
    return { ok: false, estado: 'fallido', error: e instanceof Error ? e.message : String(e) }
  }
}

/** Último recurso cuando el registro falla: se envía igual, sin dejar rastro en la tabla. */
async function enviarSinRegistro(admin: Admin, p: PedidoAviso): Promise<ResultadoAviso> {
  const r = await despachar(admin, {
    id: '', destinatario_tipo: p.destinatario.tipo, destinatario_id: p.destinatario.id ?? null,
    canal: p.canal, plantilla: p.plantilla, variables: p.variables, estado: 'pendiente', intentos: 0,
  })
  return { ...r, avisoId: undefined }
}

/** Reenvía un aviso que falló (o quedó pendiente). Respeta el máximo de intentos. */
export async function reintentarAviso(avisoId: string, admin: Admin = createAdminSupabase()): Promise<ResultadoAviso> {
  try {
    const { data } = await admin.from('avisos').select('id, destinatario_tipo, destinatario_id, canal, plantilla, variables, estado, intentos').eq('id', avisoId).maybeSingle()
    if (!data) return { ok: false, estado: 'fallido', error: 'aviso no encontrado' }
    const fila = data as FilaAviso
    if (fila.estado !== 'fallido' && fila.estado !== 'pendiente') return { ok: false, estado: fila.estado, avisoId, error: `no se puede reintentar un aviso ${fila.estado}` }
    if (fila.intentos >= MAX_INTENTOS) return { ok: false, estado: fila.estado, avisoId, error: 'máximo de intentos alcanzado' }
    return await despachar(admin, fila)
  } catch (e) {
    console.error('[avisos] error inesperado al reintentar:', e)
    return { ok: false, estado: 'fallido', avisoId, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * La persona actuó (tocó el botón o completó el paso): se anota la acción y se cancelan los avisos
 * pendientes o fallidos de ese mismo hecho, para que no lleguen recordatorios de algo ya hecho.
 */
export async function registrarAccion(p: { entidad: EntidadEvento; entidadId: string; paso?: number }, admin: Admin = createAdminSupabase()): Promise<boolean> {
  try {
    const ahora = new Date().toISOString()
    let acc = admin.from('avisos').update({ accion_en: ahora }).eq('entidad', p.entidad).eq('entidad_id', p.entidadId).is('accion_en', null).eq('estado', 'enviado')
    if (p.paso != null) acc = acc.eq('paso', p.paso)
    const { error: e1 } = await acc
    let can = admin.from('avisos').update({ estado: 'cancelado', error: 'la persona ya actuó' }).eq('entidad', p.entidad).eq('entidad_id', p.entidadId).in('estado', ['pendiente', 'fallido'])
    if (p.paso != null) can = can.eq('paso', p.paso)
    const { error: e2 } = await can
    if (e1 || e2) { console.error('[avisos] registrarAccion:', e1?.message ?? e2?.message); return false }
    return true
  } catch (e) {
    console.error('[avisos] error inesperado en registrarAccion:', e)
    return false
  }
}
