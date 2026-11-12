// Confirmación de un pago por el equipo (desde el panel o desde el botón de Telegram) y la insistencia del cliente.
// Una sola implementación para que los dos caminos hagan exactamente lo mismo.
import { explicarEspera, type Espera } from '@/lib/esperas'
import { confirmarSolicitudPago, type SolicitudPago } from '@/lib/solicitudes-pago'
import { cupoDelPlan } from '@/lib/visitas'
import { notificar } from '@/lib/avisos'
import { createAdminSupabase } from '@/lib/supabase-server'
import { emailAdminPago } from '@/lib/aviso-pago'
import { ETIQUETA_METODO, type MetodoPago } from '@/lib/planes'
import { avisarAdmin } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { registrarEvento } from '@/lib/eventos'
import { esc } from '@/lib/html'
import { getAjuste } from '@/lib/ajustes'
import type { PagoRow } from '@/lib/pagos'

export async function confirmarPagoYAvisar(solicitudId: string, quien: string): Promise<
  { ok: true; pago: PagoRow; usuarioId: string; cupo: unknown; correoEnviado: boolean; nombre: string } | { ok: false; error: string; status: number }
> {
  const r = await confirmarSolicitudPago(solicitudId, quien)
  if (!r.ok) return r
  const { data: cli } = await createAdminSupabase().from('usuarios').select('nombre').eq('id', r.usuarioId).maybeSingle()
  const nombre = (cli?.nombre as string | undefined) ?? 'un cliente'
  const aviso = await notificar({
    plantilla: 'pago_confirmado', canal: 'correo', destinatario: { tipo: 'cliente', id: r.usuarioId },
    variables: { pagoId: r.pago.id, origen: 'confirmacion' }, entidad: 'pago', entidadId: r.pago.id, paso: 12,
  })
  const correoEnviado = aviso.ok || aviso.error === 'sin correo registrado'
  await emailAdminPago('Pago confirmado en Compaz', `Confirmaste el pago de $${r.pago.monto_usd} de ${nombre} (${ETIQUETA_METODO[r.pago.metodo as MetodoPago]}).`)
  return { ok: true, pago: r.pago, usuarioId: r.usuarioId, cupo: await cupoDelPlan(r.usuarioId), correoEnviado, nombre }
}

/**
 * El cliente insiste en que ya pagó. Registra el evento `pago_insistido`; si pasaron al menos
 * `pago_insistencia_min` (Ajustes) minutos desde la última alerta, reenvía el aviso al equipo marcado URGENTE con el botón de confirmar.
 */
export async function registrarInsistenciaPago(s: SolicitudPago, nombreCliente: string): Promise<{ alertado: boolean; veces: number; espera: Espera | null }> {
  const supabase = createAdminSupabase()
  const { data: previos } = await supabase.from('eventos').select('creado_en, datos').eq('entidad', 'pago').eq('entidad_id', s.id).eq('tipo', 'pago_insistido')
  const filas = (previos ?? []) as { creado_en: string; datos: { alertado?: boolean } | null }[]
  const ultimaAlerta = filas.filter((f) => f.datos?.alertado === true).map((f) => new Date(f.creado_en).getTime()).sort((a, b) => b - a)[0]
  const ventanaMin = Number(await getAjuste('pago_insistencia_min'))
  const alertar = !ultimaAlerta || Date.now() - ultimaAlerta >= ventanaMin * 60_000
  await registrarEvento({ entidad: 'pago', entidadId: s.id, tipo: 'pago_insistido', actor: `cliente:${s.usuario_id}`, datos: { alertado: alertar, veces: filas.length + 1 } })
  if (alertar) {
    await alertaAdmin(
      'urgente', `<b>URGENTE</b>: ${esc(nombreCliente)} insiste en que ya pagó $${s.monto_usd}. Si el dinero ya llegó, confírmalo ahora.`,
      { categoria: 'pago_insistido', entidad: { tipo: 'cliente', id: s.usuario_id, nombre: nombreCliente }, teclado: { inline_keyboard: [[{ text: 'Confirmar pago recibido', callback_data: `pagoconf:${s.id}` }]] } },
    ).catch(() => false)
  }
  // Si no se alertó, se le explica al cliente por qué no hace falta insistir y cuándo podrá volver a avisar.
  const espera = alertar ? null : explicarEspera('pago_insistencia', { desde: new Date(ultimaAlerta), duracionMs: ventanaMin * 60_000 })
  return { alertado: alertar, veces: filas.length + 1, espera }
}

/** Resumen de insistencias de una solicitud de pago, para mostrar URGENTE en el panel. */
export async function resumenInsistencias(solicitudId: string): Promise<{ veces: number; ultima: string | null }> {
  const { data } = await createAdminSupabase().from('eventos').select('creado_en').eq('entidad', 'pago').eq('entidad_id', solicitudId).eq('tipo', 'pago_insistido')
  const t = ((data ?? []) as { creado_en: string }[]).map((f) => f.creado_en).sort()
  return { veces: t.length, ultima: t.at(-1) ?? null }
}

/**
 * Pagos pendientes que el cliente insistió hace más de `pago_escalada_horas` y siguen sin confirmar:
 * se avisa UNA vez a todos los administradores (correo) y de nuevo por Telegram. Lo llama la escalera cada 5 minutos.
 */
export async function escalarPagosInsistidos(): Promise<number> {
  const supabase = createAdminSupabase()
  const horas = Number(await getAjuste('pago_escalada_horas'))
  const limite = Date.now() - horas * 3600_000
  const { data: pendientes } = await supabase.from('solicitudes_pago').select('*').eq('estado', 'pendiente')
  let n = 0
  for (const s of (pendientes ?? []) as SolicitudPago[]) {
    const { data: evs } = await supabase.from('eventos').select('tipo, creado_en').eq('entidad', 'pago').eq('entidad_id', s.id)
    const filas = (evs ?? []) as { tipo: string; creado_en: string }[]
    if (filas.some((f) => f.tipo === 'pago_escalado')) continue
    const primera = filas.filter((f) => f.tipo === 'pago_insistido').map((f) => new Date(f.creado_en).getTime()).sort((a, b) => a - b)[0]
    if (!primera || primera > limite) continue
    if (!(await registrarEvento({ entidad: 'pago', entidadId: s.id, tipo: 'pago_escalado', datos: { horas } }))) continue
    const { data: cli } = await supabase.from('usuarios').select('nombre').eq('id', s.usuario_id).maybeSingle()
    const nombre = (cli?.nombre as string | undefined) ?? 'Un cliente'
    await emailAdminPago('URGENTE: pago sin confirmar', `${nombre} insistió hace más de ${horas} horas en que ya pagó $${s.monto_usd} y el pago sigue sin confirmar. Revisa si el dinero llegó.`)
    await alertaAdmin('urgente', `<b>URGENTE</b>: el pago de $${s.monto_usd} de ${esc(nombre)} lleva más de ${horas} h sin confirmar. Se avisó por correo a todos los administradores.`, { categoria: 'pago_escalado', entidad: { tipo: 'cliente', id: s.usuario_id, nombre }, teclado: { inline_keyboard: [[{ text: 'Confirmar pago recibido', callback_data: `pagoconf:${s.id}` }]] } }).catch(() => false)
    n++
  }
  return n
}
