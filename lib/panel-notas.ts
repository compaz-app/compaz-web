// Notas internas de la ficha (servidor). Solo se agregan; cada una guarda quién y cuándo.
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Actor } from '@/lib/permisos'
import { recortarTexto } from '@/lib/panel-datos'
import { notaValida, type NotaPersona, type TipoPersona } from '@/lib/panel-personas-tipos'

/** Las últimas 50 notas. Sin el permiso de teléfonos se les tapan teléfonos y correos. Si la tabla aún no existe devuelve vacío (la ficha sigue abriendo). */
export async function listarNotas(actor: Actor, tipo: TipoPersona, id: string): Promise<NotaPersona[]> {
  const { data, error } = await createAdminSupabase().from('notas_persona').select('id, texto, autor, creado_en').eq('persona_tipo', tipo).eq('persona_id', id).order('creado_en', { ascending: false }).limit(50)
  if (error) { console.error('[notas] no se pudieron leer:', error.message); return [] }
  return (data ?? []).map((n) => ({ id: String(n.id), texto: recortarTexto(actor, String(n.texto)), autor: String(n.autor), creado_en: String(n.creado_en) }))
}

export type ResultadoNota = { ok: true; nota: NotaPersona } | { ok: false; error: string; status: number }

export async function agregarNota(actor: Actor, p: { tipo: TipoPersona; id: string; texto: unknown }): Promise<ResultadoNota> {
  const texto = notaValida(p.texto)
  if (!texto) return { ok: false, error: 'La nota no puede estar vacía ni pasar de 1000 letras', status: 400 }
  const db = createAdminSupabase()
  const { data: existe } = await db.from(p.tipo === 'compita' ? 'compitas' : 'usuarios').select('id').eq('id', p.id).maybeSingle()
  if (!existe) return { ok: false, error: 'Persona no encontrada', status: 404 }
  const { data, error } = await db.from('notas_persona').insert({ persona_tipo: p.tipo, persona_id: p.id, texto, autor: actor.correo }).select('id, texto, autor, creado_en').single()
  if (error || !data) { console.error('[notas] no se pudo guardar:', error?.message); return { ok: false, error: 'No se pudo guardar la nota. Inténtalo otra vez.', status: 503 } }
  return { ok: true, nota: { id: String(data.id), texto: recortarTexto(actor, String(data.texto)), autor: String(data.autor), creado_en: String(data.creado_en) } }
}
