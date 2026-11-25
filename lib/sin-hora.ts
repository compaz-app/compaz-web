// Solicitudes de entrevista aceptadas que se quedaron SIN HORA (el cliente soltó la hora para cambiarla, o nunca llegó a elegir una) y nadie lo notó.
// Escalera de aviso: a las 24 h un recordatorio al cliente (correo y campana del portal); a las 48 h una tarea en la Bandeja del equipo y un aviso al compita para que
// no espere sin saber. La tarea se cierra sola cuando la solicitud vuelve a tener hora (o se cierra). Cada peldaño se manda UNA vez por cada vez que se quedó sin hora.
// Lo corre el cron `seguimiento` (cada 5 minutos). NUNCA lanza hacia afuera: un fallo en una solicitud no frena las demás.
import { createAdminSupabase } from '@/lib/supabase-server'
import { reclamarUnaVez } from '@/lib/cron'
import { alertaAdmin } from '@/lib/alertas-admin'
import { sendEmail, SITE_URL } from '@/lib/email'
import { sendTelegramMessage } from '@/lib/telegram'
import { registrarNovedad } from '@/lib/novedades'
import { esc } from '@/lib/html'

export const RECORDATORIO_SIN_HORA_H = 24
export const TAREA_SIN_HORA_H = 48
const HORA = 3_600_000

export interface ResumenSinHora { recordatorios: number; tareas: number; cerradas: number }

type Fila = { id: string; cliente_id: string; compita_id: string | null; token_respuesta: string; respondido_at: string | null; created_at: string; slots_propuestos: unknown }

export async function procesarSolicitudesSinHora(ahora: Date = new Date()): Promise<ResumenSinHora> {
  const r: ResumenSinHora = { recordatorios: 0, tareas: 0, cerradas: 0 }
  try {
    const admin = createAdminSupabase()
    const { data } = await admin.from('solicitudes').select('id, cliente_id, compita_id, token_respuesta, respondido_at, created_at, slots_propuestos')
      .eq('estado', 'aceptada').eq('tipo', 'entrevista').is('slot_confirmado', null).limit(200)
    // Entrevista con horas libres: sin propuestas de horario (es la que se agenda eligiendo una hora libre del compita).
    const sinHora = ((data ?? []) as Fila[]).filter((s) => Array.isArray(s.slots_propuestos) && s.slots_propuestos.length === 0)
    const vigentes = new Set(sinHora.map((s) => String(s.id)))
    const idsCompita = [...new Set(sinHora.map((s) => s.compita_id).filter((x): x is string => !!x))]
    const { data: compitas } = idsCompita.length ? await admin.from('compitas').select('id, nombre, telegram_chat_id').in('id', idsCompita) : { data: [] }
    const compitaDe = new Map(((compitas ?? []) as { id: string; nombre: string; telegram_chat_id: string | null }[]).map((c) => [String(c.id), c]))

    for (const s of sinHora) {
      try {
        // Desde cuándo está sin hora: la última vez que se soltó la hora; si nunca, desde que el compita aceptó.
        const { data: ev } = await admin.from('eventos').select('creado_en').eq('entidad', 'solicitud').eq('entidad_id', s.id).eq('tipo', 'entrevista_reagendada').order('creado_en', { ascending: false }).limit(1)
        const desde = String((ev?.[0] as { creado_en?: string } | undefined)?.creado_en ?? s.respondido_at ?? s.created_at)
        const horas = (ahora.getTime() - new Date(desde).getTime()) / HORA
        if (horas < RECORDATORIO_SIN_HORA_H) continue
        const { data: cli } = await admin.from('usuarios').select('nombre, email').eq('id', s.cliente_id).maybeSingle()
        const cmp = s.compita_id ? compitaDe.get(String(s.compita_id)) : undefined
        const nombreCompita = cmp?.nombre ?? 'tu compita'
        const enlace = `${SITE_URL}/reagendar/${encodeURIComponent(s.token_respuesta)}`

        if (await reclamarUnaVez(`sin_hora_24:${s.id}:${desde}`)) {
          await registrarNovedad({ usuarioId: s.cliente_id, tipo: 'sin_hora_recordatorio', nivel: 'accionable', titulo: `Falta elegir la hora de tu llamada con ${nombreCompita}.`, ruta: `/reagendar/${encodeURIComponent(s.token_respuesta)}`, entidad: 'solicitud', entidadId: s.id, clave: `novedad:sin_hora_24:${s.id}:${desde}` })
          if (cli?.email) {
            try {
              await sendEmail({
                to: cli.email, subject: `Falta elegir la hora de tu llamada con ${nombreCompita}`,
                html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
                  <h2 style="color:#2D1464;font-size:22px">Elige la hora de tu llamada</h2>
                  <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Tu llamada con <strong>${esc(nombreCompita)}</strong> sigue sin hora. Elige una de las horas libres y ella la confirma.</p>
                  <a href="${enlace}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:8px">Elegir la hora →</a>
</div>`,
              })
            } catch (e) { console.error('[sin-hora] correo:', e) }
          }
          r.recordatorios++
        }

        if (horas >= TAREA_SIN_HORA_H && (await reclamarUnaVez(`sin_hora_48:${s.id}:${desde}`))) {
          await alertaAdmin('tarea', `Cliente sin elegir hora: ${esc(cli?.nombre ?? 'un cliente')} lleva más de 2 días sin hora para su llamada con ${esc(nombreCompita)}. Ya recibió un recordatorio. Escríbele para ayudarle a elegirla.`,
            { clave: `sin_hora:${s.id}`, categoria: 'sin_hora', entidad: { tipo: 'cliente', id: s.cliente_id, nombre: cli?.nombre ?? undefined } })
          if (cmp?.telegram_chat_id) {
            try { await sendTelegramMessage(cmp.telegram_chat_id, `${esc(cli?.nombre?.split(' ')[0] ?? 'El cliente')} todavía no elige una hora para la llamada. El equipo de Compaz está pendiente y te avisamos apenas la elija.`) } catch (e) { console.error('[sin-hora] telegram compita:', e) }
          }
          r.tareas++
        }
      } catch (e) { console.error(`[sin-hora] falló ${s.id}:`, e) }
    }

    // Las tareas abiertas de solicitudes que ya tienen hora (o se cerraron) se cierran solas.
    const { data: abiertas } = await admin.from('admin_flags').select('id, nota').eq('resuelto', false).like('nota', '%[sin_hora:%').limit(200)
    for (const f of (abiertas ?? []) as { id: string; nota: string }[]) {
      const id = /\[sin_hora:([0-9a-f-]{36})\]/i.exec(f.nota)?.[1]
      if (id && !vigentes.has(id)) { await admin.from('admin_flags').update({ resuelto: true }).eq('id', f.id); r.cerradas++ }
    }
  } catch (e) { console.error('[sin-hora] error general:', e) }
  return r
}
