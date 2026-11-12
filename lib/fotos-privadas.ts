// Fotos privadas (llegada del compita, cliente, familiar) con retención limitada.
// Telegram NO permite borrar sus archivos: por eso la foto se COPIA a un bucket privado nuestro y se borra aquí.
// Jamás se guarda ni se muestra el `file_id` de Telegram ni una URL pública: se sirve con enlaces firmados de
// vida corta. El plazo de borrado sale de Ajustes (foto_retencion_dias, hoy 90). Ver docs/construccion-real.md.

import { randomUUID } from 'crypto'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjuste } from '@/lib/ajustes'
import { registrarEvento } from '@/lib/eventos'
import { descargarFotoTelegram } from '@/lib/telegram'

export const BUCKET_FOTOS = 'fotos-privadas'
export type TipoFoto = 'llegada' | 'cliente' | 'familiar'

const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MAX_BYTES = 8 * 1024 * 1024
const DIA_MS = 86_400_000

export interface DatosFoto {
  tipo: TipoFoto
  bytes: ArrayBuffer | Uint8Array
  contentType: string
  visitaId?: string | null
  solicitudId?: string | null
  usuarioId?: string | null
  ahora?: Date
}

/** Guarda una foto en el bucket privado y la registra con su fecha de borrado. Devuelve el id o null. */
export async function guardarFotoPrivada(f: DatosFoto): Promise<{ id: string } | null> {
  const ext = EXTENSION[f.contentType]
  if (!ext) { console.error('[fotos] tipo de archivo no permitido:', f.contentType); return null }
  const peso = f.bytes.byteLength
  if (peso === 0 || peso > MAX_BYTES) { console.error('[fotos] tamaño no permitido:', peso); return null }

  const admin = createAdminSupabase()
  const id = randomUUID()
  const ruta = `${f.tipo}/${id}.${ext}`
  try {
    const dias = Number(await getAjuste('foto_retencion_dias'))
    const ahora = f.ahora ?? new Date()
    const { error: eSube } = await admin.storage.from(BUCKET_FOTOS).upload(ruta, f.bytes, { contentType: f.contentType, upsert: false })
    if (eSube) { console.error('[fotos] no se pudo subir:', eSube.message); return null }

    const { error: eFila } = await admin.from('fotos_privadas').insert({
      id, tipo: f.tipo, ruta, visita_id: f.visitaId ?? null, solicitud_id: f.solicitudId ?? null, usuario_id: f.usuarioId ?? null,
      creado_en: ahora.toISOString(), borrar_en: new Date(ahora.getTime() + dias * DIA_MS).toISOString(),
    })
    if (eFila) {
      console.error('[fotos] no se pudo registrar, se retira el archivo:', eFila.message)
      await admin.storage.from(BUCKET_FOTOS).remove([ruta])
      return null
    }
    return { id }
  } catch (e) {
    console.error('[fotos] error guardando:', e)
    return null
  }
}

/** Copia una foto que el compita o el cliente mandó por Telegram al bucket privado (sin conservar el file_id). */
export async function copiarFotoDeTelegram(fileId: string, datos: Omit<DatosFoto, 'bytes' | 'contentType'>): Promise<{ id: string } | null> {
  try {
    const { buffer, contentType } = await descargarFotoTelegram(fileId)
    return await guardarFotoPrivada({ ...datos, bytes: buffer, contentType })
  } catch (e) {
    console.error('[fotos] no se pudo copiar de Telegram:', e instanceof Error ? e.message : e)
    return null
  }
}

/** Enlace firmado de vida corta para mostrar una foto. null si ya fue borrada o no existe. */
export async function urlFirmadaFoto(id: string, segundos = 300): Promise<string | null> {
  try {
    const admin = createAdminSupabase()
    const { data } = await admin.from('fotos_privadas').select('ruta, borrada_en').eq('id', id).maybeSingle()
    const fila = data as { ruta: string; borrada_en: string | null } | null
    if (!fila || fila.borrada_en) return null
    const { data: firma, error } = await admin.storage.from(BUCKET_FOTOS).createSignedUrl(fila.ruta, segundos)
    if (error || !firma) return null
    return firma.signedUrl
  } catch (e) {
    console.error('[fotos] error firmando:', e)
    return null
  }
}

/**
 * Las fotos de llegada se borran N días DESPUÉS de cerrar la visita (no desde que se tomaron).
 * Se llama al cerrar la visita: mueve la fecha de borrado de las fotos de llegada de esa visita.
 */
export async function programarBorradoVisita(visitaId: string, cierre: Date = new Date()): Promise<boolean> {
  try {
    const dias = Number(await getAjuste('foto_retencion_dias'))
    const { error } = await createAdminSupabase().from('fotos_privadas')
      .update({ borrar_en: new Date(cierre.getTime() + dias * DIA_MS).toISOString() })
      .eq('visita_id', visitaId).eq('tipo', 'llegada').is('borrada_en', null)
    if (error) { console.error('[fotos] programar borrado:', error.message); return false }
    return true
  } catch (e) {
    console.error('[fotos] error programando borrado:', e)
    return false
  }
}

/** Borra de verdad (archivo y marca) las fotos cuya fecha de borrado ya pasó. La llama la limpieza diaria. */
export async function borrarFotosVencidas(ahora: Date = new Date()): Promise<{ borradas: number; fallos: number }> {
  const resultado = { borradas: 0, fallos: 0 }
  try {
    const admin = createAdminSupabase()
    const { data, error } = await admin.from('fotos_privadas')
      .select('id, tipo, ruta, visita_id, solicitud_id, usuario_id')
      .is('borrada_en', null).lte('borrar_en', ahora.toISOString()).limit(200)
    if (error) { console.error('[fotos] no se pudo leer las vencidas:', error.message); resultado.fallos++; return resultado }

    for (const f of (data ?? []) as { id: string; tipo: TipoFoto; ruta: string; visita_id: string | null; solicitud_id: string | null; usuario_id: string | null }[]) {
      const { error: eBorra } = await admin.storage.from(BUCKET_FOTOS).remove([f.ruta])
      if (eBorra) { console.error('[fotos] no se pudo borrar el archivo:', f.id, eBorra.message); resultado.fallos++; continue }
      const { error: eMarca } = await admin.from('fotos_privadas').update({ borrada_en: ahora.toISOString() }).eq('id', f.id)
      if (eMarca) { console.error('[fotos] archivo borrado pero sin marcar:', f.id, eMarca.message); resultado.fallos++; continue }
      resultado.borradas++
      // Evento con la entidad a la que pertenece la foto (el contenido de la foto nunca va en el evento).
      const [entidad, entidadId] = f.visita_id ? (['visita', f.visita_id] as const) : f.solicitud_id ? (['solicitud', f.solicitud_id] as const) : f.usuario_id ? (['cliente', f.usuario_id] as const) : [null, null]
      if (entidad && entidadId) await registrarEvento({ entidad, entidadId, tipo: 'foto_borrada', datos: { tipo: f.tipo } })
    }
  } catch (e) {
    console.error('[fotos] error borrando vencidas:', e)
    resultado.fallos++
  }
  return resultado
}

/** La foto del cliente vigente (la más reciente sin borrar), o null. Una persona tiene como máximo una. */
export async function fotoClienteVigente(usuarioId: string): Promise<{ id: string; ruta: string } | null> {
  try {
    const { data } = await createAdminSupabase().from('fotos_privadas').select('id, ruta, creado_en')
      .eq('tipo', 'cliente').eq('usuario_id', usuarioId).is('borrada_en', null).order('creado_en', { ascending: false }).limit(1)
    const f = (data ?? [])[0] as { id: string; ruta: string } | undefined
    return f ?? null
  } catch (e) {
    console.error('[fotos] no se pudo leer la foto del cliente:', e)
    return null
  }
}

/** Borra de verdad (archivo y marca) una foto concreta. true si quedó borrada. */
export async function borrarFotoPrivada(id: string): Promise<boolean> {
  try {
    const admin = createAdminSupabase()
    const { data } = await admin.from('fotos_privadas').select('id, tipo, ruta, visita_id, solicitud_id, usuario_id, borrada_en').eq('id', id).maybeSingle()
    const f = data as { id: string; tipo: TipoFoto; ruta: string; usuario_id: string | null; borrada_en: string | null } | null
    if (!f || f.borrada_en) return true
    const { error: eBorra } = await admin.storage.from(BUCKET_FOTOS).remove([f.ruta])
    if (eBorra) { console.error('[fotos] no se pudo borrar el archivo:', id, eBorra.message); return false }
    const { error: eMarca } = await admin.from('fotos_privadas').update({ borrada_en: new Date().toISOString() }).eq('id', id)
    if (eMarca) { console.error('[fotos] archivo borrado pero sin marcar:', id, eMarca.message); return false }
    if (f.usuario_id) await registrarEvento({ entidad: 'cliente', entidadId: f.usuario_id, tipo: 'foto_borrada', datos: { tipo: f.tipo } })
    return true
  } catch (e) {
    console.error('[fotos] error borrando:', e)
    return false
  }
}

/** Borra todas las fotos de una persona (al eliminar su cuenta). Devuelve cuántas no se pudieron borrar. */
export async function borrarFotosDeUsuario(usuarioId: string): Promise<number> {
  const { data } = await createAdminSupabase().from('fotos_privadas').select('id').eq('usuario_id', usuarioId).is('borrada_en', null)
  let fallos = 0
  for (const f of (data ?? []) as { id: string }[]) if (!(await borrarFotoPrivada(f.id))) fallos++
  return fallos
}

/** Descarga los bytes de una foto privada (para servirla desde nuestro servidor, sin enlaces que se puedan guardar). */
export async function descargarFotoPrivada(id: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const admin = createAdminSupabase()
    const { data } = await admin.from('fotos_privadas').select('ruta, borrada_en').eq('id', id).maybeSingle()
    const f = data as { ruta: string; borrada_en: string | null } | null
    if (!f || f.borrada_en) return null
    const { data: blob, error } = await admin.storage.from(BUCKET_FOTOS).download(f.ruta)
    if (error || !blob) return null
    const ext = f.ruta.split('.').pop() ?? ''
    const contentType = Object.entries(EXTENSION).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream'
    return { bytes: await blob.arrayBuffer(), contentType }
  } catch (e) {
    console.error('[fotos] error descargando:', e)
    return null
  }
}
