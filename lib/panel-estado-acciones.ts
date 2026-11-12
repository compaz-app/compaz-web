// Acciones del Estado del sistema (servidor): reintentar un aviso que falló.
import type { Actor } from '@/lib/permisos'
import { puede } from '@/lib/permisos'
import { reintentarAviso, MAX_INTENTOS } from '@/lib/avisos'
import { alertaAdmin } from '@/lib/alertas-admin'

export type ResultadoReintento = { ok: true; estado: string } | { ok: false; error: string; status: number }

/** Reintenta un aviso FALLIDO. Si falla otra vez, devuelve el motivo para que se vea y el aviso sigue en la lista. */
export async function reintentarAvisoDelEquipo(actor: Actor, avisoId: string): Promise<ResultadoReintento> {
  if (!puede(actor, 'atender')) return { ok: false, error: 'Acceso denegado', status: 403 }
  const r = await reintentarAviso(avisoId)
  if (!r.ok) {
    if (r.error === 'aviso no encontrado') return { ok: false, error: 'Ese aviso ya no existe', status: 404 }
    if (r.error === 'máximo de intentos alcanzado') return { ok: false, error: `Ya se intentó ${MAX_INTENTOS} veces. Hay que arreglar la causa (por ejemplo, el Telegram o el correo de la persona) y escribirle directamente.`, status: 409 }
    if (r.estado === 'enviado' || r.estado === 'cancelado') return { ok: false, error: 'Ese aviso ya no está pendiente', status: 409 }
    return { ok: false, error: `Volvió a fallar: ${r.error ?? 'error desconocido'}`, status: 502 }
  }
  await alertaAdmin('actividad', `${actor.correo} reintentó un aviso fallido: ${r.estado === 'enviado' ? 'ahora sí llegó' : r.estado}.`, { categoria: 'aviso_reintentado' })
  return { ok: true, estado: r.estado }
}
