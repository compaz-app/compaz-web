// Punto ÚNICO por el que el sistema le avisa al equipo. Tres niveles:
//   'actividad'  lo que PASÓ (informativo): solo queda en el registro de actividad del panel. Nadie suena.
//   'tarea'      algo que una persona debe HACER: queda en el registro y en la bandeja del panel (Atención). Sin Telegram.
//   'urgente'    hay que actuar YA: bandeja + registro + Telegram al dueño, con tope por hora para no inundarlo.
// El panel es el lugar de trabajo del equipo (los colaboradores NO reciben Telegram del dueño); Telegram es solo el timbre.
// Nunca lanza: un fallo aquí no debe romper el flujo que lo llama.

import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjustes } from '@/lib/ajustes'
import { avisarAdmin, type InlineKeyboard } from '@/lib/telegram'
import { reclamarUnaVez } from '@/lib/cron'

export type NivelAlerta = 'actividad' | 'tarea' | 'urgente'

export interface OpcionesAlerta {
  /** Para qué sirve la clave: no abrir dos tareas iguales mientras la primera siga abierta. */
  clave?: string
  categoria?: string
  /** A qué se refiere (agrupa la tarea por compita, cliente o visita en el panel). */
  entidad?: { tipo: 'visita' | 'compita' | 'cliente'; id: string; nombre?: string }
  /** Botones de Telegram (solo en urgentes). */
  teclado?: InlineKeyboard
  /** El que llama ya abrió su propia tarea: no abrir otra (solo en urgentes). */
  sinTarea?: boolean
  /** Seguridad de personas (emergencia, no me siento seguro, nadie abre): NUNCA se suprime por el tope de la hora. */
  critica?: boolean
}

const aTexto = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+\n/g, '\n').trim()
const primeraLinea = (t: string) => t.split('\n').map((x) => x.trim()).find(Boolean) ?? ''

/** Devuelve true si quedó registrado (y, en urgentes, si se pudo avisar por Telegram o quedó colapsado en el resumen). */
export async function alertaAdmin(nivel: NivelAlerta, textoHtml: string, opc: OpcionesAlerta = {}): Promise<boolean> {
  const plano = aTexto(textoHtml)
  const admin = createAdminSupabase()
  try {
    const { error } = await admin.from('actividad_admin').insert({
      nivel, resumen: plano.slice(0, 1200), categoria: opc.categoria ?? null,
      entidad_tipo: opc.entidad?.tipo ?? null, entidad_id: opc.entidad?.id ?? null, entidad_nombre: opc.entidad?.nombre ?? null,
    })
    if (error) throw new Error(error.message)
  } catch (e) {
    // Si el registro no está disponible (por ejemplo la migración aún no se aplicó) no se pierde el aviso: sale como antes.
    console.error('[alertas] no se pudo registrar la actividad; se avisa por Telegram como antes:', e instanceof Error ? e.message : e)
    return avisarAdmin(textoHtml, opc.teclado).catch(() => false)
  }

  if (nivel === 'tarea' || (nivel === 'urgente' && !opc.sinTarea)) await abrirTarea(plano, nivel, opc)
  if (nivel !== 'urgente') return true

  // Urgente: Telegram al dueño, con tope por hora. Pasado el tope, un solo mensaje que remite a la bandeja.
  // Lo crítico (seguridad de personas) nunca se suprime.
  if (opc.critica) return avisarAdmin(textoHtml, opc.teclado)
  try {
    const max = Number((await getAjustes()).timbre_max_hora)
    const desde = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await admin.from('actividad_admin').select('id', { count: 'exact', head: true }).eq('nivel', 'urgente').gte('creado_en', desde)
    if ((count ?? 0) <= max) return avisarAdmin(textoHtml, opc.teclado)
    if (await reclamarUnaVez(`timbre_colapsado:${new Date().toISOString().slice(0, 13)}`)) {
      await avisarAdmin(`<b>Hay varias urgencias seguidas</b>\n\nPara no llenarte de mensajes, el resto las ves en la bandeja del panel (pestaña Atención).`)
    }
    return true
  } catch (e) {
    console.error('[alertas] error en el timbre:', e)
    return avisarAdmin(textoHtml, opc.teclado).catch(() => false)
  }
}

/**
 * Anota un ACCESO a datos sensibles (contacto, chat, vista previa del portal) en el registro oficial y dice si quedó anotado. A diferencia de
 * alertaAdmin, NO tiene respaldo por Telegram: si el registro falla devuelve false y quien llama NO entrega el dato (S-04). El texto se guarda tal
 * cual (es texto plano, no HTML), así un motivo con "<" o "&" no se mutila.
 */
export async function registrarAcceso(resumen: string, opc: { categoria: 'acceso_contacto' | 'acceso_chat'; entidad: { tipo: 'visita' | 'compita' | 'cliente'; id: string; nombre?: string } }): Promise<boolean> {
  try {
    const { error } = await createAdminSupabase().from('actividad_admin').insert({
      nivel: 'actividad', resumen: resumen.slice(0, 1200), categoria: opc.categoria,
      entidad_tipo: opc.entidad.tipo, entidad_id: opc.entidad.id, entidad_nombre: opc.entidad.nombre ?? null,
    })
    if (error) { console.error('[acceso] no se pudo anotar el acceso:', error.message); return false }
    return true
  } catch (e) {
    console.error('[acceso] error anotando el acceso:', e instanceof Error ? e.message : e)
    return false
  }
}

/** Abre una tarea en la bandeja, sin duplicar una igual que siga abierta. */
async function abrirTarea(plano: string, nivel: NivelAlerta, opc: OpcionesAlerta): Promise<void> {
  const admin = createAdminSupabase()
  const entidadTipo = opc.entidad?.tipo ?? 'compita'
  const entidadId = opc.entidad?.id ?? 'sistema'
  const titulo = primeraLinea(plano).slice(0, 120)
  const clave = opc.clave ?? `${opc.categoria ?? 'alerta'}:${entidadId}:${titulo}`.slice(0, 200)
  try {
    const { data: previa } = await admin.from('admin_flags').select('id').eq('resuelto', false).eq('entidad_id', entidadId).like('nota', `%[${clave}]%`).maybeSingle()
    if (previa) return
    await admin.from('admin_flags').insert({
      entidad_tipo: entidadTipo, entidad_id: entidadId, entidad_nombre: opc.entidad?.nombre ?? titulo,
      nota: `${plano}\n[${clave}]`.slice(0, 1900), reportado_por: 'sistema', resuelto: false,
      tipo: opc.categoria ?? 'alerta', prioridad: nivel === 'urgente' ? 1 : 2,
    })
  } catch (e) {
    console.error('[alertas] no se pudo abrir la tarea:', e)
  }
}
