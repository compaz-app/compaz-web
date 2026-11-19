// Carga de la vista «Operación real» del CMC (servidor). Decide la fuente y nunca mezcla fuentes:
//   · «cmc»: la API de lectura del CMC (fuente autorizada).
//   · «sintetica»: datos inventados, SOLO en un deploy preview sin la API configurada (para probar la pantalla).
//   · sin ninguna de las dos: «no_configurado» y el panel muestra la vista anterior (habilitadas desde Supabase).
// Los errores salen como códigos cortos: nunca se muestra el contenido de la respuesta del CMC.
import { CmcError, CmcNoConfigurado, configuracionCmc, leerFichaCmc, leerListaCmc, leerReglasCmc, type EstadoReglas, type FichaCmc } from '@/lib/cmc-api'
import { construirFilas, resumenReal, type EnWeb, type FilaReal } from '@/lib/confianza/real'
import { fichaSintetica, fuenteSinteticaPermitida, listaSintetica } from '@/lib/confianza/real-sintetico'
import type { CompitaHabilitada } from '@/lib/confianza/operativo'

export type FuenteReal = 'cmc' | 'sintetica'
export type ListaReal =
  | { estado: 'ok'; fuente: FuenteReal; filas: FilaReal[]; resumen: ReturnType<typeof resumenReal>; generado: string; descartadas: number }
  | { estado: 'no_configurado' }
  | { estado: 'error'; codigo: string }

export function fuenteDisponible(): FuenteReal | null {
  if (configuracionCmc()) return 'cmc'
  return fuenteSinteticaPermitida() ? 'sintetica' : null
}

const mapaWeb = (habilitadas: CompitaHabilitada[]) => new Map<string, Exclude<EnWeb, null>>(habilitadas.map((h) => [h.codigo, h.enWeb]))

export async function cargarListaReal(habilitadasWeb: CompitaHabilitada[]): Promise<ListaReal> {
  const fuente = fuenteDisponible()
  if (!fuente) return { estado: 'no_configurado' }
  try {
    const { lista, descartadas, generado } = fuente === 'cmc'
      ? await leerListaCmc()
      : { lista: { filas: listaSintetica(), filasLeidas: listaSintetica().length }, descartadas: 0, generado: new Date().toISOString() }
    const filas = construirFilas(lista.filas, mapaWeb(habilitadasWeb))
    return { estado: 'ok', fuente, filas, resumen: resumenReal(filas), generado, descartadas }
  } catch (e) {
    if (e instanceof CmcNoConfigurado) return { estado: 'no_configurado' }
    const codigo = e instanceof CmcError ? e.codigo : 'error_inesperado'
    console.error('[cmc/lectura] lista:', codigo)
    return { estado: 'error', codigo }
  }
}

export type FichaReal = { estado: 'ok'; fuente: FuenteReal; datos: FichaCmc; generado: string; reglas: EstadoReglas } | { estado: 'no_existe' } | { estado: 'error'; codigo: string } | { estado: 'no_configurado' }

export async function cargarFichaReal(id: string): Promise<FichaReal> {
  const fuente = fuenteDisponible()
  if (!fuente) return { estado: 'no_configurado' }
  if (fuente === 'sintetica') {
    const datos = fichaSintetica(id)
    return datos ? { estado: 'ok', fuente, datos, generado: new Date().toISOString(), reglas: 'sin_comprobar' } : { estado: 'no_existe' }
  }
  try {
    const [r, reglas] = await Promise.all([leerFichaCmc(id), leerReglasCmc()])
    return { estado: 'ok', fuente, ...r, reglas: reglas.estado }
  } catch (e) {
    const codigo = e instanceof CmcError ? e.codigo : 'error_inesperado'
    if (codigo === 'no_existe' || codigo === 'id_invalido') return { estado: 'no_existe' }
    console.error('[cmc/lectura] ficha:', codigo)
    return { estado: 'error', codigo }
  }
}
