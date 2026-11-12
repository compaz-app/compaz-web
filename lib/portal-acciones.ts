// Lo del SERVIDOR de las acciones del portal: `avisarAlEquipo`. La parte pura (qué llamada hace cada botón) está en lib/portal-acciones-cliente.ts,
// para que el botón del navegador no arrastre código de servidor.

import { alertaAdmin } from '@/lib/alertas-admin'
import { registrarEvento } from '@/lib/eventos'
import { createAdminSupabase } from '@/lib/supabase-server'
import { explicarEspera, type Espera } from '@/lib/esperas'
import { estadoDelCliente } from '@/lib/estado-cliente'
import { esc } from '@/lib/html'

export type { AccionPortal, PeticionAccion } from '@/lib/portal-acciones-cliente'
export { peticionDeAccion } from '@/lib/portal-acciones-cliente'

const VENTANA_MIN = 60

/**
 * El cliente pide ayuda al equipo desde su portal. Una vez por hora (si repite, se le explica por qué y cuándo podrá). El equipo recibe UNA tarea
 * con en qué paso está el cliente para ayudarlo sin preguntarle. Nunca lleva datos de contacto de nadie.
 */
export async function avisarAlEquipo(c: { id: string; nombre: string }, ahora: Date = new Date()): Promise<{ avisado: true } | { avisado: false; espera: Espera }> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('eventos').select('creado_en').eq('entidad', 'cliente').eq('entidad_id', c.id).eq('tipo', 'ayuda_cliente').order('creado_en', { ascending: false }).limit(1).maybeSingle()
  const ultimo = (data as { creado_en: string } | null)?.creado_en
  if (ultimo && ahora.getTime() - new Date(ultimo).getTime() < VENTANA_MIN * 60_000) return { avisado: false, espera: explicarEspera('ayuda_cliente', { desde: ultimo, duracionMs: VENTANA_MIN * 60_000, ahora }) }
  const estado = await estadoDelCliente(c.id, ahora).catch(() => null)
  await registrarEvento({ entidad: 'cliente', entidadId: c.id, tipo: 'ayuda_cliente', actor: `cliente:${c.id}`, datos: { estado: estado?.codigo ?? null } })
  await alertaAdmin('tarea', `<b>${esc(c.nombre || 'Un cliente')} pide ayuda desde su portal</b>\n\n${estado ? `Está en el paso "${esc(estado.codigo.replace(/_/g, ' '))}".` : ''} Escríbele por correo (no llames para pedirle datos) y ayúdalo a seguir.`,
    { categoria: 'cliente_pide_ayuda', clave: `ayuda:${c.id}:${ahora.toISOString().slice(0, 13)}`, entidad: { tipo: 'cliente', id: c.id, nombre: `Pide ayuda: ${c.nombre || 'cliente'}` } })
  return { avisado: true }
}
