// Segundo factor (autenticador) para quien entra al panel: administradores y colaboradores. El código del correo prueba que controlas el correo; el autenticador (una
// app como Google Authenticator, que muestra un código de 6 dígitos cada 30 segundos) prueba que además tienes TU teléfono. Sin esto, quien tome el correo de un
// administrador entra al panel completo: salud de las familias, pagos, cuentas.
//
// Cómo funciona: Supabase marca la sesión con un nivel (`aal1` = solo correo, `aal2` = correo y autenticador) y apunta cuándo se verificó el autenticador por última vez
// (`amr`). Aquí solo se LEE eso del token que Supabase firmó; todo lo demás (crear el autenticador, pedir el código) lo hace Supabase desde la página de seguridad.
//
// Interruptor: la variable ADMIN_MFA = «obligatorio» (en Netlify) lo vuelve obligatorio. Sin ella, el panel funciona como siempre y la página de seguridad deja
// registrar el autenticador. Así se activa en este orden: (1) cada persona registra el suyo, (2) se enciende la variable. Encenderla antes deja fuera a quien no lo tenga.
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'

/** Minutos que vale una confirmación reciente para las acciones peligrosas (anular un pago, borrar una cuenta, cambiar el equipo). */
export const MINUTOS_CONFIRMACION_RECIENTE = 15

export const mfaObligatorio = (): boolean => process.env.ADMIN_MFA === 'obligatorio'

export interface NivelSegundoFactor {
  /** 'aal2' = verificó su autenticador en esta sesión; 'aal1' = solo el correo; null = no hay sesión legible. */
  aal: 'aal1' | 'aal2' | null
  /** Cuándo (epoch en segundos) verificó el autenticador por última vez, o null. */
  ultimaVerificacion: number | null
}

/** La parte del token que Supabase firmó, ya decodificada. NUNCA lanza. Pura: se prueba sin red. */
export function decodificarJwt(token: string | null | undefined): Record<string, unknown> | null {
  try {
    const parte = (token ?? '').split('.')[1]
    if (!parte) return null
    const json = typeof atob === 'function' ? decodeURIComponent(escape(atob(parte.replace(/-/g, '+').replace(/_/g, '/')))) : Buffer.from(parte, 'base64url').toString('utf8')
    const x = JSON.parse(json)
    return x && typeof x === 'object' ? (x as Record<string, unknown>) : null
  } catch { return null }
}

/** El nivel de la sesión a partir de lo que dice el token (`aal` y `amr`). Pura. */
export function nivelDesdeToken(payload: Record<string, unknown> | null): NivelSegundoFactor {
  if (!payload) return { aal: null, ultimaVerificacion: null }
  const aal = payload.aal === 'aal2' ? 'aal2' : payload.aal === 'aal1' ? 'aal1' : null
  const amr = Array.isArray(payload.amr) ? (payload.amr as { method?: unknown; timestamp?: unknown }[]) : []
  const tiempos = amr.filter((m) => m?.method === 'totp' && typeof m.timestamp === 'number').map((m) => m.timestamp as number)
  return { aal, ultimaVerificacion: tiempos.length ? Math.max(...tiempos) : null }
}

export const esReciente = (n: NivelSegundoFactor, ahoraMs: number = Date.now(), minutos: number = MINUTOS_CONFIRMACION_RECIENTE): boolean =>
  n.aal === 'aal2' && n.ultimaVerificacion !== null && ahoraMs / 1000 - n.ultimaVerificacion <= minutos * 60

/** El nivel de la sesión de esta visita. Si no se puede leer, se devuelve «sin nivel» (que se trata como NO confirmado: nunca se deja pasar por error). */
export async function nivelSegundoFactor(): Promise<NivelSegundoFactor> {
  try {
    const supabase = await createServerSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    return nivelDesdeToken(decodificarJwt((session as { access_token?: string } | null)?.access_token))
  } catch { return { aal: null, ultimaVerificacion: null } }
}

export type ResultadoMfa = { ok: true } | { ok: false; motivo: 'falta_segundo_factor' | 'falta_confirmacion_reciente'; mensaje: string }

/** ¿Esta sesión cumple lo que se exige? Con el interruptor apagado siempre cumple. `reciente` = acción peligrosa: pide una confirmación de hace poco. */
export function evaluarMfa(nivel: NivelSegundoFactor, opciones: { reciente?: boolean; ahoraMs?: number; obligatorio?: boolean } = {}): ResultadoMfa {
  if (!(opciones.obligatorio ?? mfaObligatorio())) return { ok: true }
  if (nivel.aal !== 'aal2') return { ok: false, motivo: 'falta_segundo_factor', mensaje: 'Falta confirmar con tu autenticador. Hazlo en /seguridad/segundo-factor y vuelve a intentar.' }
  if (opciones.reciente && !esReciente(nivel, opciones.ahoraMs)) {
    return { ok: false, motivo: 'falta_confirmacion_reciente', mensaje: `Por seguridad, esta acción pide confirmar tu autenticador de nuevo (vale ${MINUTOS_CONFIRMACION_RECIENTE} minutos). Hazlo en /seguridad/segundo-factor?reconfirmar=1 y vuelve a intentar.` }
  }
  return { ok: true }
}

/** Para las páginas del servidor: si falta el segundo factor, manda a la página de seguridad (con el interruptor apagado no hace nada). */
export async function exigirSegundoFactorEnPagina(volverA: string): Promise<void> {
  if (!mfaObligatorio()) return
  const r = evaluarMfa(await nivelSegundoFactor())
  if (!r.ok) redirect(`/seguridad/segundo-factor?returnTo=${encodeURIComponent(volverA)}`)
}
