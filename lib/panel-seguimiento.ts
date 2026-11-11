// Datos de Seguimiento (servidor). La etapa sale del MISMO motor que el portal del cliente (cargarFoto + decidirEstado): así lo que ve el
// equipo nunca contradice lo que ve la familia. Cuesta varias consultas por cliente, por eso se limita a los 150 más recientes y se
// procesan de 8 en 8. Si algún día hay cientos de clientes activos, hay que pasar a una consulta por lotes.
import { createAdminSupabase } from '@/lib/supabase-server'
import { cargarFoto, decidirEstado, pasoDe, type FotoCliente } from '@/lib/estado-cliente'
import { getAjustes } from '@/lib/ajustes'
import { etapaDePaso, umbralesDeAjustes, urgenciaDe, type FilaSeguimiento } from '@/lib/panel-seguimiento-tipos'
import { SITUACION } from '@/lib/panel-caso-tipos'

export const MAX_CLIENTES_SEGUIMIENTO = 150
const LOTE = 8

/** Cuándo pasó lo último con este cliente (solicitud, visita o cancelación); si no hay nada, desde que se registró (el registro solo cuenta de respaldo: siempre es anterior a lo demás). */
export function ultimoMovimiento(f: FotoCliente, registrado: string): string {
  const fechas = [...f.solicitudes.map((s) => s.creadaEn), ...f.visitas.flatMap((v) => [v.creadaEn, v.llegadaEn, v.fin]), ...f.cancelaciones.map((c) => c.creadaEn)]
    .filter((x): x is string => !!x && !Number.isNaN(new Date(x).getTime()))
  return fechas.sort().at(-1) ?? registrado
}

export async function listarSeguimiento(ahora: Date = new Date()): Promise<FilaSeguimiento[]> {
  const { data, error } = await createAdminSupabase().from('usuarios').select('id, created_at, plan, eliminada_en').order('created_at', { ascending: false }).limit(MAX_CLIENTES_SEGUIMIENTO * 2)
  if (error) throw new Error(`No se pudo leer Seguimiento: ${error.message}`)
  const clientes = (data ?? []).filter((u) => !u.eliminada_en && u.plan !== 'bloqueado').slice(0, MAX_CLIENTES_SEGUIMIENTO)
  const filas: FilaSeguimiento[] = []
  const umbrales = umbralesDeAjustes(await getAjustes())
  for (let i = 0; i < clientes.length; i += LOTE) {
    const lote = await Promise.all(clientes.slice(i, i + LOTE).map(async (u) => {
      try {
        const foto = await cargarFoto(String(u.id), ahora)
        const estado = decidirEstado(foto)
        // Quien aún no pidió nada no está "en una etapa": no hay nada que seguirle todavía.
        if (estado.codigo === 'bienvenida') return null
        const ultimo = ultimoMovimiento(foto, String(u.created_at))
        const etapa = etapaDePaso(pasoDe(estado.codigo))
        const horas = Math.max(0, Math.round((ahora.getTime() - new Date(ultimo).getTime()) / 3_600_000))
        const sol = [...foto.solicitudes].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))[0]
        const compitaId = foto.compitaAsignado?.id ?? sol?.compitaId ?? null
        const compita = foto.compitaAsignado?.nombre ?? sol?.compitaNombre ?? null
        return { id: String(u.id), nombre: foto.nombre, compitaId, compita, etapa, horas, urgencia: urgenciaDe(etapa, horas, umbrales), ultimo, espera: SITUACION[estado.codigo].espera } satisfies FilaSeguimiento
      } catch (e) {
        console.error('[seguimiento] no se pudo calcular un cliente:', e instanceof Error ? e.message : e)
        return null
      }
    }))
    for (const f of lote) if (f) filas.push(f)
  }
  return filas
}
