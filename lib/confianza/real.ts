// ══════════════════════════════════════════════════════════════════════════════
// CMC · Operación real — modelo de la lista (fase 2A, solo lectura). Función PURA: sin base, sin red.
//
// Fuente autorizada: el CMC (hoja 03 a través de la API de lectura). Esta capa NO decide nada:
//   · Clasifica para las cifras: válidos, duplicados (según la clasificación del propio CMC) y perfiles de prueba.
//   · Calcula la «próxima acción» SOLO como orientación según la etapa. La elegibilidad real (los 7 controles)
//     la calcula el CMC y se muestra en la ficha tal como llega.
//   · Cruza por código COM con la web (Supabase) solo para saber si una habilitada ya está en el catálogo:
//     es la misma Compita, no una segunda fuente de aspirantes.
// ══════════════════════════════════════════════════════════════════════════════
import type { FilaCmc } from '@/lib/cmc-api'
import { esPerfilDePrueba } from '@/lib/confianza/operativo'

export const ETAPAS_REALES = ['Registrado', 'Preseleccionado', 'Entrevistado', 'En verificación', 'Habilitado', 'Descartado', 'Sin etapa'] as const
export type EtapaReal = (typeof ETAPAS_REALES)[number]

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
export function normalizarEtapa(e: string): EtapaReal {
  const n = sinTildes(e)
  const m = ETAPAS_REALES.find((x) => sinTildes(x) === n)
  return m && m !== 'Sin etapa' ? m : 'Sin etapa'
}

export type EnWeb = 'catalogo' | 'inactiva' | 'bloqueada' | null
export interface FilaReal {
  id: string; nombre: string; zona: string; registro: string | null
  etapa: EtapaReal; etapaOriginal: string; estadoOperativo: string; preentrevista: string
  duplicadoDe: string | null; duplicado: boolean; prueba: string | null
  alertasAbiertas: number; alertasBloquean: number
  enWeb: EnWeb
  proxima: string
  atencion: 'accion' | 'bloqueado' | 'espera' | 'al-dia' | 'cerrado' | 'excluido'
}

/** El CMC solo da por duplicado lo que está marcado «Duplicado confirmado» (mismo criterio que el envío de la preentrevista). */
export const esDuplicadoConfirmado = (clasificacion: string) => /duplicado confirmado/i.test(clasificacion)
const preentrevistaRespondida = (estado: string) => /respond/i.test(estado)

function proximaYAtencion(f: Omit<FilaReal, 'proxima' | 'atencion'>): Pick<FilaReal, 'proxima' | 'atencion'> {
  if (f.duplicado) return { proxima: `Duplicado de ${f.duplicadoDe ?? 'otra ficha'}: no se gestiona aparte.`, atencion: 'excluido' }
  if (f.prueba) return { proxima: 'Perfil de prueba: no se gestiona como aspirante.', atencion: 'excluido' }
  if (f.alertasBloquean > 0) return { proxima: 'Resolver la alerta que bloquea (ver ficha).', atencion: 'bloqueado' }
  switch (f.etapa) {
    case 'Sin etapa': return { proxima: 'Asignar la etapa en el CMC (normalización pendiente).', atencion: 'accion' }
    case 'Registrado': return preentrevistaRespondida(f.preentrevista)
      ? { proxima: 'Revisar la preentrevista y decidir si se preselecciona.', atencion: 'accion' }
      : { proxima: 'Esperando la respuesta de la preentrevista.', atencion: 'espera' }
    case 'Preseleccionado': return { proxima: 'Programar o registrar la entrevista.', atencion: 'accion' }
    case 'Entrevistado': return { proxima: 'Registrar la decisión de la entrevista.', atencion: 'accion' }
    case 'En verificación': return { proxima: 'Completar los requisitos de habilitación (ver ficha).', atencion: 'accion' }
    case 'Habilitado': return f.enWeb === 'catalogo'
      ? { proxima: 'Disponible para recibir solicitudes.', atencion: 'al-dia' }
      : { proxima: 'Habilitada: falta activarla en el panel (perfil, Telegram y verificación).', atencion: 'accion' }
    case 'Descartado': return { proxima: 'Sin acciones pendientes.', atencion: 'cerrado' }
  }
}

export function construirFilas(filas: FilaCmc[], enWeb: Map<string, Exclude<EnWeb, null>>): FilaReal[] {
  return filas.map((c) => {
    const base = {
      id: c.id, nombre: c.nombre, zona: c.zona, registro: c.registro || null,
      etapa: normalizarEtapa(c.etapa), etapaOriginal: c.etapa, estadoOperativo: c.estadoOperativo, preentrevista: c.preentrevista,
      duplicadoDe: c.duplicadoDe || null, duplicado: esDuplicadoConfirmado(c.clasificacionDuplicado),
      prueba: esPerfilDePrueba({ codigo: c.id, nombre: c.nombre }, []),
      alertasAbiertas: c.alertasAbiertas, alertasBloquean: c.alertasBloquean,
      enWeb: enWeb.get(c.id) ?? null,
    }
    return { ...base, ...proximaYAtencion(base) }
  })
}

export const cuentaComoAspirante = (f: FilaReal) => !f.duplicado && !f.prueba

export function resumenReal(filas: FilaReal[]) {
  const validas = filas.filter(cuentaComoAspirante)
  const por = (e: EtapaReal) => validas.filter((f) => f.etapa === e).length
  return {
    total: filas.length,
    aspirantes: validas.length,
    enEvaluacion: por('Preseleccionado') + por('Entrevistado') + por('En verificación'),
    habilitados: por('Habilitado'),
    enCatalogo: validas.filter((f) => f.etapa === 'Habilitado' && f.enWeb === 'catalogo').length,
    requierenAtencion: validas.filter((f) => f.atencion === 'accion' || f.atencion === 'bloqueado').length,
    sinEtapa: por('Sin etapa'),
    descartados: por('Descartado'),
    duplicados: filas.filter((f) => f.duplicado).length,
    pruebas: filas.filter((f) => !f.duplicado && f.prueba).length,
    porEtapa: Object.fromEntries(ETAPAS_REALES.map((e) => [e, por(e)])) as Record<EtapaReal, number>,
  }
}
