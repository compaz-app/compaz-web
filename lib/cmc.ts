// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Lectura de postulaciones para el CMC (Centro de Mando, Google Sheets)
//
// El CMC sincroniza cada hora las altas de familias (02 · Leads & Clientes) y de
// Compitas (03 · Compitas). Hasta nov-2026 las leía de Airtable; este módulo le da
// las mismas postulaciones desde Supabase, CON EL MISMO FORMATO que devuelve la API
// de Airtable ({ records: [{ id, createdTime, fields }], offset }), para que el
// Apps Script reutilice sin cambios su lógica de altas, índices, IDs COM-/CLI- y
// controles fail-closed. Ver docs/cmc/fuente-supabase.md.
//
// Claves (columna «ID Airtable» de la hoja):
//   · «ID Airtable» = el rec… si la postulación llegó a Airtable (así coincide con la
//     fila que el CMC ya creó desde Airtable) o SB-<uuid> si no llegó.
//   · «ID Supabase» = siempre SB-<uuid>. El Apps Script busca primero «ID Airtable»
//     y después «ID Supabase»: una fila creada como SB-… sigue reconociéndose aunque
//     la postulación consiga después un rec… (sin duplicados).
//
// Qué NO se entrega:
//   · Postulaciones anteriores a CAPTACION_DESDE (el histórico ya está en el CMC).
//   · Repetidas (clasificacion = 'repetida'): tampoco se copian a Airtable.
//   · Resueltas en la bandeja como «no_procede».
//   Las resueltas como «registrada_en_cmc» SÍ se entregan: si la fila manual lleva
//   SB-<uuid> en «ID Airtable» se reconoce y no se duplica; si no lo lleva, el control
//   de duplicados del CMC la marca. Excluirlas podría dejar fuera del CMC a alguien
//   marcado en la bandeja antes de tener su fila (pérdida silenciosa).
//   · Tipo desconocido (sin rol).
// Solo lectura: este módulo no escribe nada.
// ══════════════════════════════════════════════════════════════════════════════
import { createAdminSupabase } from '@/lib/supabase-server'
import { contactoCanonico, rolParaAirtable, type TipoPostulacion } from '@/lib/captacion'

export const LIMITE_PAGINA_CMC = 100
const RESOLUCIONES_EXCLUIDAS = new Set(['no_procede'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type FilaCmc = {
  id: string
  tipo: TipoPostulacion
  clasificacion: string
  nombre_declarado: string
  telefono_declarado: string
  email_declarado: string
  ubicacion_declarada: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  recibida_en: string
  airtable_id: string | null
  resolucion: string | null
}

export type RegistroCmc = { id: string; createdTime: string; fields: Record<string, string> }
export type PaginaCmc = { records: RegistroCmc[]; offset: string }

export const claveSupabase = (id: string) => `SB-${id}`

/** Una postulación en el formato de un registro de Airtable «Lista de Espera». */
export function registroCmcDesdeFila(f: FilaCmc): RegistroCmc {
  const sb = claveSupabase(f.id)
  const fecha = new Date(f.recibida_en).toISOString()
  return {
    id: f.airtable_id || sb,
    createdTime: fecha,
    fields: {
      'ID Airtable': f.airtable_id || sb,
      'ID Supabase': sb,
      Rol: rolParaAirtable(f.tipo),
      Nombre: f.nombre_declarado,
      Fecha: fecha,
      Contacto: contactoCanonico(f.telefono_declarado, f.email_declarado, f.tipo),
      Telefono: f.telefono_declarado,
      Email: f.email_declarado,
      Ciudad: f.ubicacion_declarada,
      'UTM Source': f.utm_source ?? '',
      'UTM Medium': f.utm_medium ?? '',
      'UTM Campaign': f.utm_campaign ?? '',
    },
  }
}

/** ¿Se entrega al CMC? (repetidas, «no procede» y tipo desconocido, no) */
export function entraEnCmc(f: Pick<FilaCmc, 'tipo' | 'clasificacion' | 'resolucion'>): boolean {
  if (f.tipo !== 'familia' && f.tipo !== 'compita') return false
  if (f.clasificacion === 'repetida') return false
  if (f.resolucion && RESOLUCIONES_EXCLUIDAS.has(f.resolucion)) return false
  return true
}

/** Cursor opaco «recibida_en|id» de la última fila examinada. */
export function codificarCursor(recibidaEn: string, id: string): string {
  return Buffer.from(`${new Date(recibidaEn).toISOString()}|${id}`, 'utf8').toString('base64url')
}
export function decodificarCursor(cursor: string): { recibidaEn: string; id: string } | null {
  try {
    const [t, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
    if (!t || Number.isNaN(Date.parse(t)) || !UUID.test(id ?? '')) return null
    return { recibidaEn: new Date(t).toISOString(), id }
  } catch {
    return null
  }
}

const posterior = (f: FilaCmc, c: { recibidaEn: string; id: string }) => {
  const t = new Date(f.recibida_en).toISOString()
  return t > c.recibidaEn || (t === c.recibidaEn && f.id > c.id)
}

/**
 * Una página de postulaciones para el CMC, en orden de llegada (recibida_en, id).
 * desdeIso: inicio de la captación en Supabase (CAPTACION_DESDE). offset: cursor de la
 * página anterior ('' = primera). Devuelve offset '' cuando no quedan más.
 */
export async function paginaPostulacionesCmc(desdeIso: string, offset = '', limite = LIMITE_PAGINA_CMC): Promise<PaginaCmc> {
  const cursor = offset ? decodificarCursor(offset) : null
  if (offset && !cursor) throw new Error('offset no válido')
  const desde = new Date(desdeIso).toISOString()
  const inicio = cursor && cursor.recibidaEn > desde ? cursor.recibidaEn : desde
  // Margen sobre el límite para filas con el mismo instante que el cursor y filas excluidas.
  const pedir = limite + 50
  const { data, error } = await createAdminSupabase()
    .from('postulaciones')
    .select('id, tipo, clasificacion, nombre_declarado, telefono_declarado, email_declarado, ubicacion_declarada, utm_source, utm_medium, utm_campaign, recibida_en, airtable_id, resolucion')
    .gte('recibida_en', inicio)
    .order('recibida_en', { ascending: true })
    .order('id', { ascending: true })
    .limit(pedir)
  if (error) throw new Error(`postulaciones para el CMC: ${error.message}`)
  const filas = ((data ?? []) as FilaCmc[]).filter((f) => !cursor || posterior(f, cursor))

  const records: RegistroCmc[] = []
  let ultima: FilaCmc | null = null
  for (const f of filas) {
    if (records.length >= limite) break
    ultima = f
    if (entraEnCmc(f)) records.push(registroCmcDesdeFila(f))
  }
  // Quedan más si se cortó por el límite o si la consulta vino llena.
  const hayMas = !!ultima && (filas.indexOf(ultima) < filas.length - 1 || (data ?? []).length >= pedir)
  return { records, offset: hayMas && ultima ? codificarCursor(ultima.recibida_en, ultima.id) : '' }
}
