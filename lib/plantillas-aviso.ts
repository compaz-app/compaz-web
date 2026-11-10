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
import { getAjuste } from '@/lib/ajustes'
import { PLANES, ETIQUETA_METODO, TEXTO_REEMBOLSO, type PlanId, type MetodoPago } from '@/lib/planes'

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
export type NombrePlantilla = 'solicitud_nueva' | 'directa_aceptada' | 'pago_confirmado' | 'llamada_terminada_cliente' | 'llamada_terminada_compita'

const etiquetaSlot = (iso: string) =>
  new Date(iso).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })

/** "María Pérez" → "María P." Antes de pagar el cliente ve solo el primer nombre y la inicial del apellido. */
export function nombreCorto(nombre: string): string {
  const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  return partes.length === 1 ? partes[0] : `${partes[0]} ${partes[1][0].toUpperCase()}.`
}

/** Qué ve el compita sobre quién más estará: solo el TIPO de cada persona, nunca nombres. */
function textoPersonas(personas: unknown): string | null {
  if (!Array.isArray(personas)) return null // el lugar no es privado
  if (personas.length === 0) return 'Nadie más, solo su familiar'
  const cuenta = new Map<string, number>()
  for (const p of personas) cuenta.set(String(p), (cuenta.get(String(p)) ?? 0) + 1)
  return 'Además de su familiar estarán: ' + [...cuenta].map(([t, n]) => (n > 1 ? `${n} × ${t.toLowerCase()}` : `1 ${t.toLowerCase()}`)).join(', ')
}

// Contratación directa y mandado: sin horarios ni sala. El compita acepta ANTES de que el cliente pague.
function avisoSinHorario(s: Record<string, unknown>, clienteNombre: string): Contenido {
  const primero = esc(clienteNombre.split(' ')[0])
  const esMandado = s.tipo === 'mandado'
  const personas = textoPersonas(s.personas_en_lugar)
  const lineas = [
    esMandado ? `🧾 <b>Mandado</b>` : `🤝 <b>Contratación directa</b>`,
    ``,
    esMandado ? `<b>${primero}</b> te pide un mandado (tarifa plana).` : `<b>${primero}</b> quiere contratarte directamente, sin entrevista.`,
    ``,
    `<b>Qué se hará:</b> ${esc(String(s.mensaje ?? ''))}`,
    `<b>¿Lugar privado?</b> ${s.lugar_privado ? 'Sí' : 'No'}`,
    ...(personas ? [`<b>Personas en el lugar:</b> ${esc(personas)}`] : []),
    ``,
    `Si aceptas, el cliente paga primero y te avisamos cuando el pago esté confirmado. Si no puedes, no pasa nada: el cliente elige a otro compita sin haber pagado.`,
  ]
  const token = String(s.token_respuesta)
  const bot = process.env.TELEGRAM_BOT_USERNAME ? `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}` : SITE_URL
  return {
    telegram: {
      texto: lineas.join('\n'),
      teclado: makeInlineKeyboard([
        // La foto del cliente se abre desde nuestro servidor mientras decides; no se manda por Telegram para poder borrarla.
        ...(s.foto_cliente_id ? [[{ text: `📷 Ver la foto de ${clienteNombre.split(' ')[0]}`, url: `${SITE_URL}/api/solicitud-foto/${token}` }]] : []),
        [{ text: '✅ Aceptar', callback_data: `directa:${token}` }],
        [{ text: '❌ No puedo', callback_data: `rechazar:${token}` }],
      ]),
    },
    correo: {
      asunto: esMandado ? 'Un cliente te pide un mandado' : 'Un cliente quiere contratarte directamente',
      html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
        <h2 style="color:#2D1464;font-size:22px">${esMandado ? 'Tienes un mandado nuevo' : 'Tienes una contratación directa'}</h2>
        <p style="color:#4A3B6B;font-size:16px;line-height:1.6"><strong>${primero}</strong> quiere contratarte. Para aceptar o rechazar, abre el bot de Compaz en Telegram y toca el botón del aviso.</p>
        <a href="${bot}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px;margin-top:8px">Abrir Telegram</a>
      </div>`,
    },
  }
}

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
    if (s.tipo === 'directa' || s.tipo === 'mandado') return avisoSinHorario(s, clienteNombre)
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
    // Variable `recordatorio`: el aviso es el respaldo de uno anterior sin respuesta (lo manda la escalera).
    const asunto = v.recordatorio === true ? `Recordatorio: ${correo.asunto}` : correo.asunto
    return { telegram: { texto, teclado }, correo: { asunto, html: correo.html } }
  },
}

// El compita aceptó una contratación directa: el cliente recibe el correo con el único paso que le falta, pagar.
const directaAceptada: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const solicitudId = String(v.solicitudId ?? '')
    if (!solicitudId) return null
    const admin = createAdminSupabase()
    const { data: s } = await admin.from('solicitudes').select('id, cliente_id, compita_id, estado, tipo').eq('id', solicitudId).maybeSingle()
    if (!s || s.estado !== 'aceptada') return null // ya pagó, o se canceló
    const [{ data: cli }, { data: cmp }] = await Promise.all([
      admin.from('usuarios').select('nombre').eq('id', s.cliente_id).maybeSingle(),
      admin.from('compitas').select('nombre').eq('id', s.compita_id).maybeSingle(),
    ])
    const primero = esc(String(cli?.nombre ?? '').split(' ')[0])
    const corto = esc(nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita')
    const antifraude = esc(String(await getAjuste('antifraude_cliente')))
    return {
      correo: {
        asunto: `${nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita'} aceptó tu solicitud. Un último paso: el pago`,
        html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h2 style="color:#2D1464;font-size:22px">${corto} aceptó tu solicitud</h2>
          <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${primero}. Solo falta el pago. Cuando lo confirmemos, completas la ficha de tu familiar y agendas la primera visita.</p>
          <a href="${SITE_URL}/pago?solicitud=${encodeURIComponent(String(s.id))}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px;margin-top:8px">Ir al pago →</a>
          <p style="color:#92400E;background:#FFFBEB;border:1px solid #F5B800;border-radius:12px;padding:12px;font-size:13px;line-height:1.5;margin-top:24px"><strong>Cuidado con los fraudes.</strong> ${antifraude}</p>
        </div>`,
      },
    }
  },
}

// Paso 12 del ciclo: se confirmó el pago y el cliente recibe el correo. Dos variantes de texto, las mismas que
// ya usaban app/api/admin/confirmar-solicitud ('confirmacion') y app/api/admin/registrar-pago ('registro').
// El botón sigue llevando a /dashboard sin llave de acceso: el ciclo de login se arregla en el paso 3.1.
const pagoConfirmado: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const pagoId = String(v.pagoId ?? '')
    if (!pagoId) return null
    const admin = createAdminSupabase()
    const { data: p } = await admin.from('pagos_plan').select('*').eq('id', pagoId).maybeSingle()
    if (!p || p.estado !== 'activo') return null // el pago se anuló: no se confirma lo que ya no vale
    const { data: cli } = await admin.from('usuarios').select('nombre').eq('id', p.usuario_id).maybeSingle()
    const primero = esc(String(cli?.nombre ?? '').split(' ')[0])
    const que = p.tipo === 'plan' ? `plan ${PLANES[p.plan as PlanId].nombre}` : `visita extra de ${p.horas} horas`
    const vence = new Date(p.vence).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Caracas' })
    const visitas = `${p.visitas} ${p.visitas === 1 ? 'visita' : 'visitas'}`
    const metodo = esc(ETIQUETA_METODO[p.metodo as MetodoPago])
    const boton = `<a href="${SITE_URL}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px;margin-top:8px">Ir a mi portal →</a>`
    const reembolso = `<p style="color:#9990A8;font-size:12px;margin-top:28px">${esc(TEXTO_REEMBOLSO)}</p>`
    const monto = `<strong>$${p.monto_usd}</strong>`
    const cuerpo = v.origen === 'registro'
      ? `<p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${primero}. Registramos tu pago de ${monto} por ${metodo} correspondiente a: <strong>${esc(que)}</strong> (${visitas}).</p>
          <p style="color:#4A3B6B;font-size:15px;line-height:1.6">Las visitas que no uses este mes siguen disponibles hasta el <strong>${esc(vence)}</strong>.</p>`
      : `<p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${primero}. Confirmamos tu pago de ${monto} por ${metodo}: <strong>${esc(que)}</strong> (${visitas}), disponibles hasta el <strong>${esc(vence)}</strong>.</p>`
    return {
      correo: {
        asunto: 'Recibimos tu pago en Compaz',
        html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h2 style="color:#2D1464;font-size:22px">¡Recibimos tu pago!</h2>
          ${cuerpo}
          ${boton}
          ${reembolso}</div>`,
      },
    }
  },
}

// Datos que comparten los avisos posteriores a la entrevista (pasos 9 y 10 del ciclo).
async function datosLlamada(solicitudId: string) {
  const admin = createAdminSupabase()
  const { data: s } = await admin.from('solicitudes').select('*').eq('id', solicitudId).maybeSingle()
  if (!s) return null
  const [{ data: cliente }, { data: compita }] = await Promise.all([
    admin.from('usuarios').select('nombre').eq('id', s.cliente_id).maybeSingle(),
    admin.from('compitas').select('nombre').eq('id', s.compita_id).maybeSingle(),
  ])
  const token = String(s.token_respuesta)
  const base = `${SITE_URL}/api/solicitud/resultado-llamada?token=${token}`
  return {
    estado: String(s.estado),
    clienteNombre: String(cliente?.nombre ?? 'Cliente'),
    compitaNombre: String(compita?.nombre ?? 'tu compita'),
    contratarUrl: `${base}&resultado=contratar`,
    reagendarUrl: `${base}&resultado=reagendar`,
    noUrl: `${base}&resultado=no_contratar&${qRol(token, 'cliente')}`,
    compitaReagendarUrl: `${base}&resultado=reagendar&${qRol(token, 'compita')}`,
    compitaBienUrl: `${base}&resultado=bien&${qRol(token, 'compita')}`,
  }
}

// Paso 10: terminó la entrevista y el cliente decide. Mismo texto que usaba app/api/webhooks/daily/route.ts.
// Variable `corta`: la llamada duró menos de 3 minutos (se pregunta qué pasó en lugar de si contrata).
const llamadaTerminadaCliente: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const d = await datosLlamada(String(v.solicitudId ?? ''))
    if (!d) return null
    if (d.estado === 'contratada' || d.estado === 'rechazada') return null // ya decidió: no se le vuelve a preguntar
    const corta = v.corta === true
    const nombre = esc(d.clienteNombre.split(' ')[0])
    const titulo = corta ? `¿Pudiste hablar con ${d.compitaNombre}?` : `¿Qué decidiste sobre ${d.compitaNombre}?`
    const intro = corta
      ? `Parece que la llamada fue muy corta o tuvo problemas técnicos. ¿Qué pasó?`
      : `Tu llamada con <strong>${esc(d.compitaNombre)}</strong> acaba de terminar. ¿Qué decides?`
    const botonContratar = corta ? '' : `<a href="${d.contratarUrl}" style="display:block;background:#22C55E;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;text-align:center;margin-bottom:12px">✅ Sí, quiero contratar a ${esc(d.compitaNombre)}</a>`
    return {
      correo: {
        asunto: v.recordatorio === true ? `Recordatorio: ${titulo}` : titulo,
        html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">${esc(titulo)}</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, <strong>${nombre}</strong>. ${intro}</p>
              <div style="margin-top:24px">
                ${botonContratar}
                <a href="${d.reagendarUrl}" style="display:block;background:#6B5C90;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:15px;text-align:center;margin-bottom:12px">🔄 ${corta ? 'La llamada se cortó — quiero reagendar' : 'Quiero reagendar para hablar más'}</a>
                <a href="${d.noUrl}" style="display:block;background:#E8E0D4;color:#1A0A3C;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:15px;text-align:center">❌ ${corta ? 'No pude hablar — ver otros compitas' : 'No es lo que busco — ver otros perfiles'}</a>
              </div>
              <p style="color:#6B5C90;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>`,
      },
    }
  },
}

// Paso 10, lado del compita: agradecimiento (o pregunta si hubo problemas, si la llamada fue corta).
const llamadaTerminadaCompita: Plantilla = {
  canales: ['telegram'],
  async render(v) {
    const d = await datosLlamada(String(v.solicitudId ?? ''))
    if (!d) return null
    const nombre = esc(d.clienteNombre)
    if (v.corta === true) {
      return {
        telegram: {
          texto: `📞 La llamada con <b>${nombre}</b> parece que tuvo problemas técnicos.\n\n¿Qué pasó?`,
          teclado: { inline_keyboard: [[{ text: '✅ Estuvo bien', url: d.compitaBienUrl }, { text: '🔄 Necesitamos reagendar', url: d.compitaReagendarUrl }]] },
        },
      }
    }
    return {
      telegram: {
        texto: `✅ <b>¡Gracias por la llamada!</b>\n\nLa entrevista con <b>${nombre}</b> terminó.\n\nEstaremos en contacto según lo que decida la familia. Si tuviste algún problema técnico, avísanos.`,
        teclado: { inline_keyboard: [[{ text: '🔄 Tuvimos problemas — reagendar', url: d.compitaReagendarUrl }]] },
      },
    }
  },
}

export const PLANTILLAS: Record<NombrePlantilla, Plantilla> = {
  solicitud_nueva: solicitudNueva,
  directa_aceptada: directaAceptada,
  pago_confirmado: pagoConfirmado,
  llamada_terminada_cliente: llamadaTerminadaCliente,
  llamada_terminada_compita: llamadaTerminadaCompita,
}
