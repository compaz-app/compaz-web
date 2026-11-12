// Estado del sistema (servidor): qué procesos automáticos siguen corriendo y qué avisos fallaron. Solo muestra lo que se puede saber
// de la base de datos; no hace llamadas de prueba a Telegram, al correo ni a las videollamadas.
import { createAdminSupabase } from '@/lib/supabase-server'
import { ESPERADOS } from '@/lib/cron'
import type { Actor } from '@/lib/permisos'
import { recortarTexto } from '@/lib/panel-datos'
import { detectarContacto } from '@/lib/chat-moderacion'
import { estadoProceso, type FilaProceso } from '@/lib/panel-mas-tipos'
import { DUDAS, resumenAyuda, type TipoDuda } from '@/lib/ayuda'

export interface AvisoFallido { id: string; plantilla: string; canal: string; error: string | null; intentos: number; ultimo: string | null }
export interface ResumenDudas { dias: number; total: number; noResueltas: number; escaladas: number; tareasAbiertas: number; tipos: { tipo: string; texto: string; n: number }[] }
export interface EstadoSistema { procesos: FilaProceso[]; fallidos: number; pendientes: number; ultimosFallidos: AvisoFallido[]; airtablePendientes: number; dudas: ResumenDudas }

/** Lo que preguntan los compitas en "Tengo una duda" en la última semana. Si un tipo domina, el problema está en el formulario o en el aviso. */
async function dudasDeLaSemana(ahora: Date): Promise<ResumenDudas> {
  const r = await resumenAyuda(7, ahora)
  const tipos = Object.entries(r.dudas).map(([tipo, d]) => ({ tipo, texto: DUDAS[tipo as TipoDuda] ?? 'Otra duda', n: d.total })).filter((t) => t.n > 0).sort((a, b) => b.n - a.n)
  const vals = Object.values(r.dudas)
  return { dias: r.dias, total: tipos.reduce((s, t) => s + t.n, 0), noResueltas: vals.reduce((s, d) => s + d.no_resueltas, 0), escaladas: vals.reduce((s, d) => s + d.escaladas, 0), tareasAbiertas: r.tareasAbiertas, tipos }
}

export async function estadoDelSistema(ahora: number = Date.now(), actor?: Actor): Promise<EstadoSistema> {
  const db = createAdminSupabase()
  const [latidos, fallidos, pendientes, lista, airtable, dudas] = await Promise.all([
    db.from('telegram_estados').select('chat_id, updated_at').like('chat_id', 'cron:%'),
    db.from('avisos').select('id', { count: 'exact', head: true }).eq('estado', 'fallido'),
    db.from('avisos').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    db.from('avisos').select('id, plantilla, canal, error, intentos, ultimo_intento_en').eq('estado', 'fallido').order('ultimo_intento_en', { ascending: false }).limit(10),
    db.from('postulaciones').select('id', { count: 'exact', head: true }).in('airtable_estado', ['pendiente', 'error']),
    dudasDeLaSemana(new Date(ahora)),
  ])
  const visto = new Map((latidos.data ?? []).map((r) => [String(r.chat_id), String(r.updated_at)]))
  const procesos = Object.entries(ESPERADOS).map(([nombre, cadaMin]): FilaProceso => {
    const ultimo = visto.get(`cron:${nombre}`) ?? null
    return { nombre, cadaMin, ultimo, estado: estadoProceso(cadaMin, ultimo, ahora) }
  })
  return {
    dudas, procesos, fallidos: fallidos.count ?? 0, pendientes: pendientes.count ?? 0, airtablePendientes: airtable.count ?? 0,
    ultimosFallidos: (lista.data ?? []).map((a) => ({ id: String(a.id), plantilla: String(a.plantilla), canal: String(a.canal), error: a.error ? (actor ? recortarTexto(actor, String(a.error)) : detectarContacto(String(a.error)).textoCensurado) : null, intentos: Number(a.intentos ?? 0), ultimo: a.ultimo_intento_en ?? null })),
  }
}
