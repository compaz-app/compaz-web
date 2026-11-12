// Estado de un compita respecto al CMC (Centro de Mando), para la ficha del panel. Lógica PURA: sin base de datos.
// El CMC decide si PUEDE trabajar (cmc_permite); el panel decide si YA recibe solicitudes. Ver docs/cmc/compitas-desde-cmc.md.
import type { Compita } from '@/types'

export interface PasoActivacion { listo: boolean; texto: string }
export interface EstadoCmc {
  /** ID del CMC (COM-NNNN). */ codigo: string
  /** El CMC permite que tome clientes nuevos. */ permite: boolean
  /** Estado operativo que dice el CMC (null si no lo trae). */ estado: string | null
  /** Último cambio recibido del CMC. */ actualizado: string | null
  /** Lo que falta para que reciba solicitudes. */ pasos: PasoActivacion[]
}

type DatosCmc = Pick<Compita, 'codigo' | 'cmc_permite' | 'cmc_estado' | 'cmc_actualizado_en' | 'telegram_chat_id' | 'foto_url' | 'descripcion' | 'servicios' | 'horarios_disponibles' | 'estado' | 'verificado'>

/** Pasos que faltan para que un compita del CMC reciba solicitudes. */
export function pasosActivacion(c: DatosCmc): PasoActivacion[] {
  return [
    { listo: c.cmc_permite === true, texto: 'Permitida por el CMC' },
    { listo: !!c.telegram_chat_id, texto: 'Telegram vinculado' },
    { listo: !!c.foto_url, texto: 'Foto' },
    { listo: !!c.descripcion?.trim(), texto: 'Descripción' },
    { listo: (c.servicios ?? []).length > 0, texto: 'Servicios' },
    { listo: (c.horarios_disponibles ?? []).length > 0, texto: 'Horarios' },
    { listo: c.estado === 'activo' && c.verificado, texto: 'Verificada por el equipo' },
  ]
}

/** null si el compita es anterior al CMC o de demostración: para ellos todo sigue igual que antes. */
export function estadoCmc(c: DatosCmc): EstadoCmc | null {
  if (!c.codigo || c.cmc_permite == null) return null
  return { codigo: c.codigo, permite: c.cmc_permite === true, estado: c.cmc_estado ?? null, actualizado: c.cmc_actualizado_en ?? null, pasos: pasosActivacion(c) }
}

/** ¿Se puede verificar o activar? Solo restringe cuando el CMC dice que NO; quitar la verificación o desactivar siempre se puede. */
export const cmcPermiteActivar = (cmc: EstadoCmc | null | undefined): boolean => cmc?.permite !== false
