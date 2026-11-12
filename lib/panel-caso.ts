// El caso de un cliente para el equipo (servidor): su situación explicada, quién tiene que moverse y su línea de tiempo.
// Usa el mismo motor que el portal (cargarFoto + decidirEstado) y que Seguimiento, así los tres dicen siempre lo mismo.
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Actor } from '@/lib/permisos'
import { cargarFoto, decidirEstado, pasoDe } from '@/lib/estado-cliente'
import { lineaDe } from '@/lib/panel-personas'
import { ultimoMovimiento } from '@/lib/panel-seguimiento'
import { getAjustes } from '@/lib/ajustes'
import { etapaDePaso, umbralesDeAjustes, urgenciaDe } from '@/lib/panel-seguimiento-tipos'
import { SITUACION, type CasoCliente } from '@/lib/panel-caso-tipos'

export async function casoDeCliente(actor: Actor, clienteId: string, ahora: Date = new Date()): Promise<CasoCliente | null> {
  const { data: u } = await createAdminSupabase().from('usuarios').select('id, created_at, eliminada_en').eq('id', clienteId).maybeSingle()
  if (!u || u.eliminada_en) return null
  const [foto, linea] = await Promise.all([cargarFoto(clienteId, ahora), lineaDe(actor, 'cliente', clienteId)])
  const estado = decidirEstado(foto)
  const etapa = etapaDePaso(pasoDe(estado.codigo))
  const horas = Math.max(0, Math.round((ahora.getTime() - new Date(ultimoMovimiento(foto, String(u.created_at))).getTime()) / 3_600_000))
  const sol = [...foto.solicitudes].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))[0]
  return {
    id: clienteId, nombre: foto.nombre, compitaId: foto.compitaAsignado?.id ?? sol?.compitaId ?? null, compita: foto.compitaAsignado?.nombre ?? sol?.compitaNombre ?? null,
    etapa, horas, urgencia: urgenciaDe(etapa, horas, umbralesDeAjustes(await getAjustes())), ...SITUACION[estado.codigo], linea,
    solicitud: sol ? { id: sol.id, estado: sol.estado, conLlamada: !!sol.slotConfirmado } : null,
  }
}
