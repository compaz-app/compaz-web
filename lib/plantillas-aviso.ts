// Plantillas de aviso: un solo lugar para los textos que se envían a clientes, compitas y al admin.
// Cada plantilla recibe variables PLANAS (ids, nada de datos de contacto ni secretos) y arma el mensaje al
// enviar, leyendo los datos frescos de la base. Así un reintento nunca manda información vieja, y si el hecho
// ya no aplica (la persona ya actuó) la plantilla devuelve null y el aviso se cancela.
// Ver docs/ciclo-comunicaciones.md y docs/esquema-avisos-eventos.md.

import { createAdminSupabase } from '@/lib/supabase-server'
import { makeInlineKeyboard } from '@/lib/telegram'
import { esc } from '@/lib/html'
import { SITE_URL } from '@/lib/email'
import { qRol } from '@/lib/links'
import { armarSolicitudCompita } from '@/lib/resend'

export type Canal = 'telegram' | 'correo'

export type VariablesAviso = Record<string, string | number | boolean | null>

type Teclado = ReturnType<typeof makeInlineKeyboard>

export interface Contenido {
  telegram?: { texto: string; teclado?: Teclado }
  correo?: { asunto: string; html: string }
}

export interface Plantilla {
  canales: Canal[]
  /** Arma el contenido. Devuelve null si el aviso ya no aplica (se cancela, no se envía). */
  render: (variables: VariablesAviso) => Promise<Contenido | null>
}

/** Cada plantilla nueva se agrega aquí y en el tipo NombrePlantilla. */
export type NombrePlantilla = 'solicitud_nueva'

const etiquetaSlot = (iso: string) =>
  new Date(iso).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })

// Paso 5 del ciclo: el cliente pide una entrevista y el compita la recibe por Telegram con botones.
// El texto es el que ya usa hoy app/api/solicitudes/route.ts (se migra en el paso 1.4).
const solicitudNueva: Plantilla = {
  canales: ['telegram', 'correo'],
  async render(v) {
    const solicitudId = String(v.solicitudId ?? '')
    if (!solicitudId) return null
    const admin = createAdminSupabase()
    const { data: s } = await admin.from('solicitudes').select('*').eq('id', solicitudId).maybeSingle()
    if (!s || s.estado !== 'pendiente') return null // ya respondió, o se canceló

    const { data: cliente } = await admin.from('usuarios').select('nombre').eq('id', s.cliente_id).maybeSingle()
    const clienteNombre = cliente?.nombre ?? 'Un cliente'
    const slots: string[] = Array.isArray(s.slots_propuestos) ? s.slots_propuestos.slice(0, 3) : []
    const conEtiqueta = slots.map((iso, i) => ({ i, label: etiquetaSlot(iso) }))

    const partesSobre: string[] = []
    if (typeof s.sobre_cliente === 'string' && s.sobre_cliente.trim()) partesSobre.push(`<b>Sobre el cliente:</b>`, esc(s.sobre_cliente.trim()), ``)

    const texto = [
      `🔔 <b>Nueva solicitud de entrevista</b>`,
      ``,
      `<b>${esc(clienteNombre)}</b> quiere conocerte.`,
      ``,
      ...partesSobre,
      `<b>Sobre su familiar:</b>`,
      esc(String(s.mensaje ?? '')),
      ``,
      `<b>Horarios propuestos (llamada de 20 min):</b>`,
      conEtiqueta.map(({ i, label }) => `${['1️⃣', '2️⃣', '3️⃣'][i]} ${label}`).join('\n'),
      ``,
      `👇 <b>Toca el botón del horario que te funcione para confirmar.</b>`,
    ].join('\n')

    const teclado = makeInlineKeyboard([
      ...conEtiqueta.map(({ i, label }) => [{ text: `✅ ${label}`, callback_data: `slot:${i}:${s.token_respuesta}` }]),
      [{ text: '❌ No puedo atender', callback_data: `rechazar:${s.token_respuesta}` }],
    ])

    // Correo de respaldo: mismos horarios, con enlaces firmados que funcionan sin iniciar sesión.
    const { data: compita } = await admin.from('compitas').select('nombre').eq('id', s.compita_id).maybeSingle()
    const base = `${SITE_URL}/api/solicitud/responder?token=${s.token_respuesta}`
    const firma = qRol(String(s.token_respuesta), 'compita')
    const correo = armarSolicitudCompita(
      compita?.nombre ?? '',
      clienteNombre,
      conEtiqueta.map(({ i, label }) => ({ label, url: `${base}&slot=${i}&${firma}` })),
      `${base}&slot=-1&${firma}`,
    )
    return { telegram: { texto, teclado }, correo: { asunto: correo.asunto, html: correo.html } }
  },
}

export const PLANTILLAS: Record<NombrePlantilla, Plantilla> = {
  solicitud_nueva: solicitudNueva,
}
