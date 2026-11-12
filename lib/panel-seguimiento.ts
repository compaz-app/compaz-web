// Datos de Seguimiento (servidor). La etapa sale del MISMO motor que el portal del cliente (cargarFoto + decidirEstado): así lo que ve el
// equipo nunca contradice lo que ve la familia. Se limita a los 150 clientes más recientes y se carga por tandas de 15 con consultas por
// lotes (cargarFotos): unas 12 consultas por tanda, no por cliente.
import { createAdminSupabase } from '@/lib/supabase-server'
import { cargarFotos, decidirEstado, pasoDe, type FotoCliente } from '@/lib/estado-cliente'
import { getAjustes } from '@/lib/ajustes'
import { etapaDePaso, umbralesDeAjustes, urgenciaDe, type FilaSeguimiento } from '@/lib/panel-seguimiento-tipos'
import { SITUACION } from '@/lib/panel-caso-tipos'
import { conCacheCorto } from '@/lib/cache-corto'

export const MAX_CLIENTES_SEGUIMIENTO = 150
export const CACHE_SEGUIMIENTO_MS = 30_000

/** Cuándo pasó lo último con este cliente (solicitud, visita o cancelación); si no hay nada, desde que se registró (el registro solo cuenta de respaldo: siempre es anterior a lo demás). */
export function ultimoMovimiento(f: FotoCliente, registrado: string): string {
  const fechas = [...f.solicitudes.map((s) => s.creadaEn), ...f.visitas.flatMap((v) => [v.creadaEn, v.llegadaEn, v.fin]), ...f.cancelaciones.map((c) => c.creadaEn)]
    .filter((x): x is string => !!x && !Number.isNaN(new Date(x).getTime()))
  return fechas.sort().at(-1) ?? registrado
}

/** Con memoria de 30 s: filtrar o paginar no vuelve a calcular la etapa de cada cliente. Lo que se ve puede tener hasta 30 s de retraso. */
export function listarSeguimiento(ahora: Date = new Date()): Promise<FilaSeguimiento[]> {
  return conCacheCorto('seguimiento', CACHE_SEGUIMIENTO_MS, () => calcularSeguimiento(ahora))
}

async function calcularSeguimiento(ahora: Date): Promise<FilaSeguimiento[]> {
  const { data, error } = await createAdminSupabase().from('usuarios').select('id, created_at, plan, eliminada_en').order('created_at', { ascending: false }).limit(MAX_CLIENTES_SEGUIMIENTO * 2)
  if (error) throw new Error(`No se pudo leer Seguimiento: ${error.message}`)
  const clientes = (data ?? []).filter((u) => !u.eliminada_en && u.plan !== 'bloqueado').slice(0, MAX_CLIENTES_SEGUIMIENTO)
  const filas: FilaSeguimiento[] = []
  const umbrales = umbralesDeAjustes(await getAjustes())
  // Una cantidad fija de consultas por cada 15 clientes (cargarFotos), no unas 12 por cliente.
  const fotos = await cargarFotos(clientes.map((u) => String(u.id)), ahora)
  for (const u of clientes) {
    try {
      const foto = fotos.get(String(u.id))
      if (!foto) continue
      const estado = decidirEstado(foto)
      // Quien aún no pidió nada no está "en una etapa": no hay nada que seguirle todavía.
      if (estado.codigo === 'bienvenida') continue
      const ultimo = ultimoMovimiento(foto, String(u.created_at))
      const etapa = etapaDePaso(pasoDe(estado.codigo))
      const horas = Math.max(0, Math.round((ahora.getTime() - new Date(ultimo).getTime()) / 3_600_000))
      const sol = [...foto.solicitudes].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))[0]
      const compitaId = foto.compitaAsignado?.id ?? sol?.compitaId ?? null
      const compita = foto.compitaAsignado?.nombre ?? sol?.compitaNombre ?? null
      filas.push({ id: String(u.id), nombre: foto.nombre, compitaId, compita, etapa, horas, urgencia: urgenciaDe(etapa, horas, umbrales), ultimo, espera: SITUACION[estado.codigo].espera } satisfies FilaSeguimiento)
    } catch (e) {
      console.error('[seguimiento] no se pudo calcular un cliente:', e instanceof Error ? e.message : e)
    }
  }
  return filas
}
