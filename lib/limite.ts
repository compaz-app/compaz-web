// Contadores de intentos con ventana de tiempo (para frenar adivinar códigos). Se guardan en `telegram_estados`
// con una clave propia, igual que los límites de solicitar-acceso (no hace falta una tabla nueva).

import { createAdminSupabase } from '@/lib/supabase-server'

/** Intentos acumulados en la ventana vigente (0 si no hay o ya venció). */
export async function intentosActuales(clave: string): Promise<number> {
  const { data } = await createAdminSupabase().from('telegram_estados').select('pendiente_accion, pendiente_expira').eq('chat_id', clave).maybeSingle()
  if (!data?.pendiente_expira || new Date(data.pendiente_expira).getTime() < Date.now()) return 0
  return parseInt(data.pendiente_accion ?? '0', 10) || 0
}

/** Cuándo termina la ventana vigente de intentos (para decirle a la persona cuándo podrá volver a intentar). Null si no hay ventana vigente. */
export async function vencimientoIntentos(clave: string): Promise<Date | null> {
  const { data } = await createAdminSupabase().from('telegram_estados').select('pendiente_expira').eq('chat_id', clave).maybeSingle()
  const t = data?.pendiente_expira ? new Date(data.pendiente_expira) : null
  return t && t.getTime() > Date.now() ? t : null
}

/** Suma un intento. La ventana empieza con el primero y no se renueva con los siguientes. */
export async function sumarIntento(clave: string, ventanaMin: number): Promise<number> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('telegram_estados').select('pendiente_accion, pendiente_expira').eq('chat_id', clave).maybeSingle()
  const vigente = !!data?.pendiente_expira && new Date(data.pendiente_expira).getTime() >= Date.now()
  const n = vigente ? (parseInt(data!.pendiente_accion ?? '0', 10) || 0) + 1 : 1
  await admin.from('telegram_estados').upsert(
    {
      chat_id: clave, registro_pendiente: false, pendiente_accion: String(n),
      pendiente_expira: vigente ? data!.pendiente_expira : new Date(Date.now() + ventanaMin * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'chat_id' },
  )
  return n
}

export async function reiniciarIntentos(clave: string): Promise<void> {
  await createAdminSupabase().from('telegram_estados').delete().eq('chat_id', clave)
}
