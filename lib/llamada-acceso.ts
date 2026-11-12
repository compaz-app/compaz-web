// Quién puede entrar a una llamada. Las salas de Daily son PRIVADAS: sin un pase (token de reunión) no se entra ni con el enlace. El pase lo pide el
// servidor solo después de comprobar a la persona, y vale hasta que la sala se cierre. Tres formas de ser aceptado:
//   1. Enlace firmado de Compaz (?r=<rol>&s=<firma>): el que reciben el compita (Telegram) y los participantes de la entrevista.
//   2. Sesión de administrador, o de colaborador con permiso de atender (supervisa llamadas).
//   3. Sesión de cliente cuya visita o solicitud tiene esa sala.
import { firmaLlamada, llamadaFirmaValida } from '@/lib/links'
import { nombreDeSala, nombreDeSalaValido } from '@/lib/llamada-ruta'
import { createAdminSupabase } from '@/lib/supabase-server'
import { usuarioVerificado } from '@/lib/auth'
import { actorDePagina, puede } from '@/lib/permisos'

export type RolLlamada = 'cliente' | 'compita' | 'admin' | 'supervisor'
export type AccesoLlamada = { ok: true; rol: RolLlamada } | { ok: false }

/** Ruta firmada de la llamada para un rol (cliente o compita): /llamada/<sala>?r=<rol>&s=<firma>. */
export function enlaceDeLlamada(roomUrl: string, rol: 'cliente' | 'compita'): string {
  const sala = nombreDeSala(roomUrl)
  return `/llamada/${encodeURIComponent(sala)}?r=${rol}&s=${firmaLlamada(sala, rol)}`
}

/** ¿Es el cliente (con sesión) de esta sala? Mira su visita en curso y sus solicitudes. */
async function clienteDeLaSala(userId: string, sala: string): Promise<boolean> {
  const db = createAdminSupabase()
  const [v, s] = await Promise.all([
    db.from('visitas').select('id').eq('usuario_id', userId).like('room_url', `%/${sala}`).limit(1),
    db.from('solicitudes').select('id').eq('cliente_id', userId).like('room_url', `%/${sala}`).limit(1),
  ])
  return ((v.data ?? []) as unknown[]).length > 0 || ((s.data ?? []) as unknown[]).length > 0
}

export async function autorizarLlamada(sala: string, firmado: { rol: string | null; s: string | null }): Promise<AccesoLlamada> {
  if (!nombreDeSalaValido(sala)) return { ok: false }
  if ((firmado.rol === 'cliente' || firmado.rol === 'compita') && llamadaFirmaValida(sala, firmado.rol, firmado.s)) return { ok: true, rol: firmado.rol }
  try {
    const actor = await actorDePagina()
    // El administrador entra como dueño de la reunión; el colaborador que atiende entra como supervisor (puede ver y hablar, no expulsar a nadie).
    if (actor && actor.rol === 'admin') return { ok: true, rol: 'admin' }
    if (actor && puede(actor, 'atender')) return { ok: true, rol: 'supervisor' }
    const { data: { user } } = await usuarioVerificado()
    if (user?.id && await clienteDeLaSala(user.id, sala)) return { ok: true, rol: 'cliente' }
  } catch (e) { console.error('[llamada] no se pudo comprobar el acceso:', e) }
  return { ok: false }
}

/**
 * Pase de Daily para entrar a una sala privada. Vence cuando la sala se cierra. El administrador (o el colaborador que supervisa) entra como dueño de la reunión; el cliente y el compita, no.
 * null si Daily no lo entregó (quien llama debe decir que no se pudo abrir la llamada).
 */
export async function pedirPase(sala: string, rol: RolLlamada, finEpoch: number | null): Promise<string | null> {
  try {
    const exp = finEpoch ?? Math.floor(Date.now() / 1000) + 3600
    const res = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST', signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
      body: JSON.stringify({ properties: { room_name: sala, exp, is_owner: rol === 'admin', eject_at_token_exp: true } }),
    })
    if (!res.ok) { console.error('[llamada] Daily no entregó el pase:', res.status); return null }
    const j = await res.json() as { token?: string }
    return j.token ?? null
  } catch (e) { console.error('[llamada] error pidiendo el pase:', e); return null }
}
