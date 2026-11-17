// ══════════════════════════════════════════════════════════════════════════════
// Sistema de Confianza — vista operativa (datos reales, SOLO LECTURA).
//
// Qué hay en Supabase y qué no:
//   · postulaciones (tipo compita) ...... quién se registró desde la web.
//   · compitas con código COM-NNNN ...... las que el CMC habilitó y publicó (cmc_permite).
//   · Las etapas intermedias (Preseleccionado, Entrevistado, En verificación),
//     las entrevistas, verificaciones y onboarding viven SOLO en el CMC. Esta
//     versión no las lee: la web no tiene hoy un canal de lectura del CMC, y
//     abrirlo exige cambiar el Apps Script de producción (pendiente de autorizar).
//
// Separación de las cifras: perfiles de prueba, demos y repetidos NO cuentan como
// aspirantes ni como Compitas habilitadas.
// ══════════════════════════════════════════════════════════════════════════════
import { createAdminSupabase } from '@/lib/supabase-server'
import { adminsDeEntorno } from '@/lib/admins'

/**
 * Perfiles internos de prueba conocidos (registro: docs de métricas «metricas-exclusiones»).
 * Se marcan a mano porque la base no tiene una columna «solo pruebas» (ver docs/confianza.md, propuesta C).
 */
export const CODIGOS_PRUEBA: Record<string, string> = {
  'COM-1064': 'Prueba integral interna (17-nov-2026). Sus verificaciones fueron simuladas.',
  'COM-1057': 'Probable registro de prueba anterior.',
  'COM-1062': 'Reservado para pruebas automáticas.',
}
/** Las mismas palabras que excluye el CMC al enviar la preentrevista. */
const PALABRAS_PRUEBA = /\b(test|prueba|ejemplo|asdf|demo)\b/i

export function esPerfilDePrueba(p: { codigo?: string | null; nombre?: string | null; email?: string | null }, internos: string[] = adminsDeEntorno()): string | null {
  if (p.codigo && CODIGOS_PRUEBA[p.codigo]) return CODIGOS_PRUEBA[p.codigo]
  if (PALABRAS_PRUEBA.test(p.nombre ?? '') || PALABRAS_PRUEBA.test(p.email ?? '')) return 'El nombre o el correo dicen que es una prueba.'
  if (p.email && internos.includes(p.email.trim().toLowerCase())) return 'Es una cuenta del equipo.'
  return null
}

export interface CompitaHabilitada {
  id: string; codigo: string; nombre: string
  enWeb: 'catalogo' | 'inactiva' | 'bloqueada'
  telegram: boolean
  /** Por qué es de prueba (null si es real). */
  prueba: string | null
  nota: string | null
}

export interface ResumenOperativo {
  postulaciones: { recibidas: number; porResolver: number; repetidas: number; pruebas: number }
  habilitadas: CompitaHabilitada[]
  demos: number
  ultimaSincronizacion: { cuando: string; estado: string } | null
  leidoEn: string
}

/** Notas que el equipo debe ver junto a una Compita concreta (hallazgos de auditoría). */
const NOTAS: Record<string, string> = {
  'COM-0187': 'Su verificación en el CMC tiene una evidencia sin contenido real: verificar de nuevo antes de activarla.',
  'COM-0025': 'Fue habilitada por «Habilitación directa», sin verificaciones: verificar antes de activarla.',
}

export function clasificarHabilitada(c: { id: string; codigo: string; nombre: string; email: string | null; estado: string; verificado: boolean; cmc_permite: boolean | null; telegram_chat_id: string | null }, internos?: string[]): CompitaHabilitada {
  const enWeb = c.cmc_permite === false ? 'bloqueada' : c.estado === 'activo' && c.verificado && c.telegram_chat_id ? 'catalogo' : 'inactiva'
  const prueba = esPerfilDePrueba(c, internos)
  const nota = prueba && enWeb === 'catalogo' ? 'Perfil de prueba visible en el catálogo público: una familia real podría contratarlo. Desactívalo al terminar la prueba.' : NOTAS[c.codigo] ?? null
  return { id: c.id, codigo: c.codigo, nombre: c.nombre, enWeb, telegram: !!c.telegram_chat_id, prueba, nota }
}

export async function cargarResumenOperativo(): Promise<ResumenOperativo> {
  const db = createAdminSupabase()
  const [post, comp, demos, sync] = await Promise.all([
    db.from('postulaciones').select('clasificacion, nombre_declarado, email_declarado, resolucion').eq('tipo', 'compita').limit(5000),
    db.from('compitas').select('id, codigo, nombre, email, estado, verificado, cmc_permite, telegram_chat_id').not('codigo', 'is', null).limit(2000),
    db.from('compitas').select('id', { count: 'exact', head: true }).eq('es_demo', true),
    db.from('cmc_sincronizaciones').select('recibida_en, estado').order('recibida_en', { ascending: false }).limit(1),
  ])
  if (post.error) throw new Error(`No se pudieron leer las postulaciones: ${post.error.message}`)
  if (comp.error) throw new Error(`No se pudieron leer las Compitas: ${comp.error.message}`)
  const internos = adminsDeEntorno()
  const filas = (post.data ?? []) as { clasificacion: string; nombre_declarado: string | null; email_declarado: string | null; resolucion: string | null }[]
  const pruebas = filas.filter((f) => esPerfilDePrueba({ nombre: f.nombre_declarado, email: f.email_declarado }, internos))
  const reales = filas.filter((f) => !pruebas.includes(f))
  const ultima = ((sync.data ?? []) as { recibida_en: string; estado: string }[])[0]
  return {
    postulaciones: {
      recibidas: reales.filter((f) => f.clasificacion !== 'repetida' && f.clasificacion !== 'spam').length,
      porResolver: reales.filter((f) => f.clasificacion === 'pendiente' && !f.resolucion).length,
      repetidas: reales.filter((f) => f.clasificacion === 'repetida').length,
      pruebas: pruebas.length,
    },
    habilitadas: ((comp.data ?? []) as Parameters<typeof clasificarHabilitada>[0][]).map((c) => clasificarHabilitada(c, internos)).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    demos: demos.count ?? 0,
    ultimaSincronizacion: ultima ? { cuando: ultima.recibida_en, estado: ultima.estado } : null,
    leidoEn: new Date().toISOString(),
  }
}
