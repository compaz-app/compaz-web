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
import { getAjuste, getAjustes } from '@/lib/ajustes'
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
  | 'entrevista_aceptada' | 'reserva_pedida' | 'reserva_rechazada' | 'reserva_vencida' | 'lugar_respuesta' | 'direccion_visita' | 'direccion_faltante_cliente' | 'compita_en_camino'
  | 'compita_llego' | 'nadie_abre_cliente' | 'visita_sin_acceso_cliente' | 'nadie_abre_cerrar'
  | 'salida_seguridad_cliente' | 'todo_bien' | 'recordatorio_cliente' | 'cancelacion_equipo_cliente' | 'pausa_cuenta_cliente' | 'pausa_cuenta_decision'

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

/** Entrevista del formulario nuevo: sin horarios propuestos; la hora se elige después entre las libres del compita. */
export const esEntrevistaConHoras = (s: Record<string, unknown>) => s.tipo === 'entrevista' && Array.isArray(s.slots_propuestos) && s.slots_propuestos.length === 0

/** Qué ve el compita sobre quién más estará: solo el TIPO de cada persona, nunca nombres. */
export function textoPersonas(personas: unknown): string | null {
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
  const esEntrevista = s.tipo === 'entrevista'
  const personas = textoPersonas(s.personas_en_lugar)
  const lineas = [
    esMandado ? `🧾 <b>Mandado</b>` : esEntrevista ? `🔔 <b>Quieren conocerte</b>` : `🤝 <b>Contratación directa</b>`,
    ``,
    esMandado ? `<b>${primero}</b> te pide un mandado (tarifa plana).` : esEntrevista ? `<b>${primero}</b> quiere hablar contigo primero, en una videollamada de 20 minutos.` : `<b>${primero}</b> quiere contratarte directamente, sin entrevista.`,
    ``,
    `<b>Qué se hará:</b> ${esc(String(s.mensaje ?? ''))}`,
    `<b>¿Lugar privado?</b> ${s.lugar_privado ? 'Sí' : 'No'}`,
    ...(personas ? [`<b>Personas en el lugar:</b> ${esc(personas)}`] : []),
    ``,
    esEntrevista
      ? `Si aceptas, el cliente elige una de tus horas libres y te pide que la confirmes. Si no puedes, no pasa nada.`
      : `Si aceptas, el cliente paga primero y te avisamos cuando el pago esté confirmado. Si no puedes, no pasa nada: el cliente elige a otro compita sin haber pagado.`,
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
      asunto: esMandado ? 'Un cliente te pide un mandado' : esEntrevista ? 'Un cliente quiere conocerte' : 'Un cliente quiere contratarte directamente',
      html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
        <h2 style="color:#2D1464;font-size:22px">${esMandado ? 'Tienes un mandado nuevo' : esEntrevista ? 'Alguien quiere conocerte' : 'Tienes una contratación directa'}</h2>
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
    if (s.tipo === 'directa' || s.tipo === 'mandado' || esEntrevistaConHoras(s)) return avisoSinHorario(s, clienteNombre)
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

const marco = (cuerpo: string) => `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">${cuerpo}</div>`
const boton = (href: string, texto: string) => `<a href="${href}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px;margin-top:8px">${texto}</a>`

// El compita aceptó hablar primero: el cliente elige una de sus horas libres.
const entrevistaAceptada: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const solicitudId = String(v.solicitudId ?? '')
    if (!solicitudId) return null
    const admin = createAdminSupabase()
    const { data: s } = await admin.from('solicitudes').select('id, cliente_id, compita_id, estado, slot_confirmado').eq('id', solicitudId).maybeSingle()
    if (!s || s.estado !== 'aceptada' || s.slot_confirmado) return null // ya eligió hora, o se canceló
    const [{ data: cli }, { data: cmp }] = await Promise.all([
      admin.from('usuarios').select('nombre').eq('id', s.cliente_id).maybeSingle(),
      admin.from('compitas').select('nombre').eq('id', s.compita_id).maybeSingle(),
    ])
    const primero = esc(String(cli?.nombre ?? '').split(' ')[0])
    const corto = esc(nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita')
    return { correo: { asunto: `${nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita'} aceptó hablar contigo. Elige la hora`, html: marco(`
      <h2 style="color:#2D1464;font-size:22px">${corto} aceptó hablar contigo</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${primero}. Elige una de sus horas libres para la videollamada de 20 minutos. La hora que elijas queda reservada hasta que ${corto} la confirme.</p>
      ${boton(`${SITE_URL}/solicitar/hora?solicitud=${encodeURIComponent(String(s.id))}`, 'Elegir la hora →')}`) } }
  },
}

// El cliente reservó una hora: el compita la confirma o dice "No puedo a esa hora".
const reservaPedida: Plantilla = {
  canales: ['telegram'],
  async render(v) {
    const reservaId = String(v.reservaId ?? '')
    if (!reservaId) return null
    const admin = createAdminSupabase()
    const { data: r } = await admin.from('reservas_horario').select('id, cliente_id, inicio, estado, vence_en').eq('id', reservaId).maybeSingle()
    if (!r || r.estado !== 'reservada' || new Date(r.vence_en).getTime() <= Date.now()) return null // ya respondió o venció
    const { data: cli } = await admin.from('usuarios').select('nombre').eq('id', r.cliente_id).maybeSingle()
    const primero = esc(String(cli?.nombre ?? 'El cliente').split(' ')[0])
    const hasta = new Date(r.vence_en).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit', hour12: true })
    return { telegram: {
      texto: [`📅 <b>${primero} eligió una hora para la videollamada</b>`, ``, `<b>${esc(etiquetaSlot(String(r.inicio)))}</b> (hora de Caracas)`, ``, `Confírmala o dinos que no puedes a esa hora. Si no respondes, la hora se libera sola a las ${esc(hasta)}.`].join('\n'),
      teclado: makeInlineKeyboard([[{ text: '✅ Confirmar', callback_data: `reserva:ok:${r.id}` }], [{ text: '❌ No puedo a esa hora', callback_data: `reserva:no:${r.id}` }]]),
    } }
  },
}

const reservaLiberada = (motivo: 'rechazada' | 'vencida'): Plantilla => ({
  canales: ['correo'],
  async render(v) {
    const solicitudId = String(v.solicitudId ?? '')
    if (!solicitudId) return null
    const admin = createAdminSupabase()
    const { data: s } = await admin.from('solicitudes').select('id, cliente_id, compita_id, estado, slot_confirmado').eq('id', solicitudId).maybeSingle()
    if (!s || s.estado !== 'aceptada' || s.slot_confirmado) return null // ya tiene hora confirmada, o se canceló
    const [{ data: cli }, { data: cmp }] = await Promise.all([
      admin.from('usuarios').select('nombre').eq('id', s.cliente_id).maybeSingle(),
      admin.from('compitas').select('nombre').eq('id', s.compita_id).maybeSingle(),
    ])
    const primero = esc(String(cli?.nombre ?? '').split(' ')[0])
    const corto = esc(nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita')
    const titulo = motivo === 'rechazada' ? `${corto} no puede a esa hora` : `La hora que reservaste ya se liberó`
    const detalle = motivo === 'rechazada' ? `No te preocupes: elige otra de sus horas libres.` : `${corto} no alcanzó a confirmarla. Elige otra de sus horas libres.`
    return { correo: { asunto: motivo === 'rechazada' ? `${nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita'} no puede a esa hora. Elige otra` : 'Tu hora reservada se liberó. Elige otra', html: marco(`
      <h2 style="color:#2D1464;font-size:22px">${titulo}</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${primero}. ${detalle}</p>
      ${boton(`${SITE_URL}/solicitar/hora?solicitud=${encodeURIComponent(String(s.id))}`, 'Elegir otra hora →')}`) } }
  },
})

// El compita respondió al cambio de quién estará en el lugar: el cliente se entera de qué decidió.
const lugarRespuesta: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const cambioId = String(v.cambioId ?? '')
    if (!cambioId) return null
    const admin = createAdminSupabase()
    const { data: c } = await admin.from('cambios_lugar').select('estado, cliente_id, compita_id').eq('id', cambioId).maybeSingle()
    if (!c || (c.estado !== 'sigue' && c.estado !== 'no_va')) return null
    const [{ data: cli }, { data: cmp }] = await Promise.all([
      admin.from('usuarios').select('nombre').eq('id', c.cliente_id).maybeSingle(),
      admin.from('compitas').select('nombre').eq('id', c.compita_id).maybeSingle(),
    ])
    const primero = esc(String(cli?.nombre ?? '').split(' ')[0])
    const corto = esc(nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita')
    const sigue = c.estado === 'sigue'
    return { correo: {
      asunto: sigue ? `${nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita'} confirmó que sigue con la visita` : `${nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita'} prefirió no ir a esta visita`,
      html: marco(`
        <h2 style="color:#2D1464;font-size:22px">${sigue ? `${corto} sigue con la visita` : `${corto} prefirió no ir`}</h2>
        <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${primero}. ${sigue
          ? `${corto} vio el cambio de quién estará en el lugar y confirmó que sigue con la visita.`
          : `${corto} vio el cambio de quién estará en el lugar y prefirió no ir. No pasa nada: tu visita no se pierde ni te cobramos nada por esto. Puedes elegir otro horario o a otro compita sin costo.`}</p>
        ${boton(`${SITE_URL}/dashboard`, sigue ? 'Ir a mi portal →' : 'Elegir otro horario o compita →')}`),
    } }
  },
}

// La dirección exacta llega al compita unas horas antes de la cita, por Telegram y NUNCA por el chat. El teléfono del
// contacto en el sitio no se incluye: solo lo ve el equipo.
const direccionVisita: Plantilla = {
  canales: ['telegram'],
  async render(v) {
    const visitaId = String(v.visitaId ?? '')
    if (!visitaId) return null
    const admin = createAdminSupabase()
    const { data: vis } = await admin.from('visitas').select('id, usuario_id, estado, fecha_programada, hora_inicio_programada, direccion, indicaciones, quien_abre, contacto_nombre, personas_en_lugar').eq('id', visitaId).maybeSingle()
    if (!vis || vis.estado !== 'programada' || !vis.direccion) return null // se canceló o se reagendó sin dirección
    const { data: cli } = await admin.from('usuarios').select('nombre').eq('id', vis.usuario_id).maybeSingle()
    const primero = esc(String(cli?.nombre ?? 'El cliente').split(' ')[0])
    const personas = textoPersonas(vis.personas_en_lugar)
    const antifraude = esc(String(await getAjuste('antifraude_compita')))
    const fecha = new Date(`${vis.fecha_programada}T12:00:00-04:00`).toLocaleDateString('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long' })
    return { telegram: {
      texto: [
        `📍 <b>Dirección de tu visita</b>`, ``,
        `Visita con <b>${primero}</b>: ${esc(fecha)}, ${esc(String(vis.hora_inicio_programada).slice(0, 5))}.`, ``,
        `<b>Dirección:</b> ${esc(String(vis.direccion))}`,
        ...(vis.indicaciones ? [`<b>Cómo entrar:</b> ${esc(String(vis.indicaciones))}`] : []),
        ...(vis.quien_abre ? [`<b>Quién abre:</b> ${esc(String(vis.quien_abre))}`] : []),
        ...(vis.contacto_nombre ? [`<b>Contacto en el sitio:</b> ${esc(String(vis.contacto_nombre))}`] : []),
        ...(personas ? [`<b>Quién más estará:</b> ${esc(personas)}`] : []),
        ``, `🔒 Esta dirección es solo para ti: no la compartas. Se entrega por aquí y nunca por el chat.`,
        ``, `⚠️ ${antifraude}`,
      ].join('\n'),
      teclado: makeInlineKeyboard([[{ text: '🚗 Voy en camino', callback_data: `camino:${vis.id}` }], [{ text: '🙋 Tengo una duda', callback_data: 'duda' }]]),
    } }
  },
}

// El cliente no registró la dirección y la cita está cerca.
const direccionFaltanteCliente: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const visitaId = String(v.visitaId ?? '')
    if (!visitaId) return null
    const admin = createAdminSupabase()
    const { data: vis } = await admin.from('visitas').select('usuario_id, compita_id, estado, direccion').eq('id', visitaId).maybeSingle()
    if (!vis || vis.estado !== 'programada' || vis.direccion) return null // ya la registró, o se canceló
    const [{ data: cli }, { data: cmp }] = await Promise.all([
      admin.from('usuarios').select('nombre').eq('id', vis.usuario_id).maybeSingle(),
      admin.from('compitas').select('nombre').eq('id', vis.compita_id).maybeSingle(),
    ])
    const primero = esc(String(cli?.nombre ?? '').split(' ')[0])
    const corto = esc(nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita')
    return { correo: { asunto: 'Falta la dirección de tu visita', html: marco(`
      <h2 style="color:#2D1464;font-size:22px">Falta la dirección de tu visita</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${primero}. ${corto} visita a tu familiar muy pronto y todavía no registraste dónde será. Regístrala ahora en tu portal para que ${corto} la reciba a tiempo.</p>
      ${boton(`${SITE_URL}/dashboard`, 'Registrar la dirección →')}`) } }
  },
}

// El compita avisa que va en camino: el cliente se entera.
const compitaEnCamino: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const visitaId = String(v.visitaId ?? '')
    if (!visitaId) return null
    const admin = createAdminSupabase()
    const { data: vis } = await admin.from('visitas').select('usuario_id, compita_id, estado').eq('id', visitaId).maybeSingle()
    if (!vis || vis.estado !== 'programada') return null
    const [{ data: cli }, { data: cmp }] = await Promise.all([
      admin.from('usuarios').select('nombre').eq('id', vis.usuario_id).maybeSingle(),
      admin.from('compitas').select('nombre').eq('id', vis.compita_id).maybeSingle(),
    ])
    const primero = esc(String(cli?.nombre ?? '').split(' ')[0])
    const corto = esc(nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita')
    return { correo: { asunto: `${nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita'} va en camino`, html: marco(`
      <h2 style="color:#2D1464;font-size:22px">${corto} va en camino</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${primero}. ${corto} salió hacia donde está tu familiar. Avisa a quien debe abrir la puerta.</p>
      ${boton(`${SITE_URL}/dashboard`, 'Ir a mi portal →')}`) } }
  },
}

const datosVisitaCliente = async (visitaId: string) => {
  const admin = createAdminSupabase()
  const { data: vis } = await admin.from('visitas').select('usuario_id, compita_id, estado, sin_acceso_en').eq('id', visitaId).maybeSingle()
  if (!vis) return null
  const [{ data: cli }, { data: cmp }] = await Promise.all([
    admin.from('usuarios').select('nombre').eq('id', vis.usuario_id).maybeSingle(), admin.from('compitas').select('nombre').eq('id', vis.compita_id).maybeSingle(),
  ])
  return { vis, primero: esc(String(cli?.nombre ?? '').split(' ')[0]), corto: esc(nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita'), cortoTxt: nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita' }
}

// El compita mandó la foto de llegada: el cliente la ve en su portal (no se manda adjunta: se sirve desde Compaz y se borra).
const compitaLlego: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const d = await datosVisitaCliente(String(v.visitaId ?? ''))
    if (!d || d.vis.estado !== 'programada') return null
    return { correo: { asunto: `${d.cortoTxt} llegó`, html: marco(`
      <h2 style="color:#2D1464;font-size:22px">${d.corto} llegó</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${d.primero}. ${d.corto} ya está en el lugar y mandó una foto de la llegada, que puedes ver en tu portal. Avisa a quien debe abrir la puerta.</p>
      ${boton(`${SITE_URL}/dashboard`, 'Ver la foto y abrir →')}`) } }
  },
}

const nadieAbreCliente: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const d = await datosVisitaCliente(String(v.visitaId ?? ''))
    if (!d || d.vis.estado !== 'programada' || !d.vis.sin_acceso_en) return null // ya abrieron, o se cerró
    const espera = Number((await getAjustes()).nadie_abre_espera_min)
    return { correo: { asunto: `URGENTE: ${d.cortoTxt} está en la puerta y nadie abre`, html: marco(`
      <h2 style="color:#991B1B;font-size:22px">${d.corto} está en la puerta y nadie abre</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${d.primero}. ${d.corto} llegó y nadie le abre. Tienes <strong>${espera} minutos</strong>: abre la puerta o avisa a quien deba hacerlo. Pasado ese tiempo la visita se cuenta como usada.</p>
      ${boton(`${SITE_URL}/dashboard`, 'Ya abrí / Ver mi portal →')}
      <p style="color:#92400E;background:#FFFBEB;border:1px solid #F5B800;border-radius:12px;padding:12px;font-size:13px;line-height:1.5;margin-top:24px">El equipo de Compaz intentará comunicarse con la persona de contacto que registraste.</p>`) } }
  },
}

const visitaSinAccesoCliente: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const id = String(v.cancelacionId ?? '')
    if (!id) return null
    const admin = createAdminSupabase()
    const { data: c } = await admin.from('cancelaciones').select('usuario_id, compita_id, justificada').eq('id', id).maybeSingle()
    if (!c || c.justificada) return null // si el equipo la justificó antes de enviarse, ya no aplica
    const [{ data: cli }, { data: cmp }] = await Promise.all([
      admin.from('usuarios').select('nombre').eq('id', c.usuario_id).maybeSingle(), admin.from('compitas').select('nombre').eq('id', c.compita_id).maybeSingle(),
    ])
    const primero = esc(String(cli?.nombre ?? '').split(' ')[0]); const corto = esc(nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita')
    return { correo: { asunto: 'Tu visita se cerró: nadie abrió', html: marco(`
      <h2 style="color:#2D1464;font-size:22px">Tu visita se cerró por falta de acceso</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${primero}. ${corto} esperó en la puerta y nadie abrió, así que la visita se cerró y <strong>se cuenta como usada</strong>. Si hubo una causa justificada (una emergencia, por ejemplo), escríbenos a hola@micompaz.com y el equipo la revisa.</p>
      ${boton(`${SITE_URL}/dashboard`, 'Ir a mi portal →')}`) } }
  },
}

// A los 30 minutos sin acceso, el compita recibe el botón para cerrar.
const nadieAbreCerrar: Plantilla = {
  canales: ['telegram'],
  async render(v) {
    const visitaId = String(v.visitaId ?? '')
    const admin = createAdminSupabase()
    const { data: vis } = await admin.from('visitas').select('estado, sin_acceso_en').eq('id', visitaId).maybeSingle()
    if (!vis || vis.estado !== 'programada' || !vis.sin_acceso_en) return null
    const espera = Number((await getAjustes()).nadie_abre_espera_min)
    return { telegram: {
      texto: [`⏱️ <b>Ya pasaron ${espera} minutos</b>`, ``, `Nadie abrió. Si ya no puedes esperar, cierra la visita: se cuenta como usada y tu tiempo queda registrado. Si el cliente aparece antes, toca ▶️ Iniciar visita.`].join('\n'),
      teclado: makeInlineKeyboard([[{ text: '🚪 Cerrar visita sin acceso', callback_data: `sinacceso:${visitaId}` }]]),
    } }
  },
}

// El equipo canceló una visita o solicitud abierta (p. ej. tras un reporte del compita): aviso NEUTRO, sin motivo y sin costo para el cliente.
const cancelacionEquipoCliente: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const { data: cmp } = await createAdminSupabase().from('compitas').select('nombre').eq('id', String(v.compitaId ?? '')).maybeSingle()
    const corto = esc(nombreCorto(String(cmp?.nombre ?? '')) || 'tu compita')
    const que = v.tipo === 'solicitud' ? 'tu solicitud' : 'tu visita'
    return { correo: { asunto: `Ya no podremos continuar con ${que}`, html: marco(`
      <h2 style="color:#2D1464;font-size:22px">Ya no podremos continuar con ${que}</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Con ${corto} ya no podremos continuar. Lamentamos las molestias: el equipo de Compaz se comunicará contigo para ayudarte a encontrar otra opción.</p>
      <p style="color:#4A3B6B;font-size:15px;line-height:1.6">Esto no se te descuenta de tu plan.</p>
      ${boton(`${SITE_URL}/dashboard`, 'Ir a mi portal →')}`) } }
  },
}

// Cuenta en pausa por compartir contactos por segunda vez: aviso claro, sin acusar y sin datos de nadie.
const pausaCuentaCliente: Plantilla = {
  canales: ['correo'],
  async render() {
    return { correo: { asunto: 'Tu cuenta de Compaz está en pausa', html: marco(`
      <h2 style="color:#2D1464;font-size:22px">Tu cuenta está en pausa</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Detectamos por segunda vez un intento de compartir datos de contacto. Por la seguridad de todos, toda la comunicación debe ocurrir dentro de Compaz.</p>
      <p style="color:#4A3B6B;font-size:15px;line-height:1.6">Mientras el equipo lo revisa no puedes escribir en el chat ni agendar visitas nuevas. Te escribimos por este correo para resolverlo.</p>`) } }
  },
}

// El equipo decidió sobre una cuenta en pausa: reactivada, otra oportunidad (con advertencia por escrito) o bloqueada.
const pausaCuentaDecision: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const d = String(v.decision ?? '')
    if (d === 'reactivar') return { correo: { asunto: 'Tu cuenta de Compaz se reactivó', html: marco(`
      <h2 style="color:#2D1464;font-size:22px">Tu cuenta se reactivó</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Ya puedes usar el chat y agendar visitas con normalidad. Gracias por tu paciencia.</p>
      ${boton(`${SITE_URL}/dashboard`, 'Ir a mi portal →')}`) } }
    if (d === 'otra_oportunidad') return { correo: { asunto: 'Tu cuenta de Compaz se reactivó, con una advertencia', html: marco(`
      <h2 style="color:#2D1464;font-size:22px">Tu cuenta se reactivó, con una advertencia</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Te damos otra oportunidad. Compartir datos de contacto fuera de Compaz va contra las reglas de seguridad: si vuelve a ocurrir, tu cuenta se bloqueará.</p>
      ${boton(`${SITE_URL}/dashboard`, 'Ir a mi portal →')}`) } }
    return null
  },
}

// El compita interrumpió la visita por seguridad: el cliente recibe un aviso NEUTRO (sin culpas ni detalles).
const salidaSeguridadCliente: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const compitaId = String(v.compitaId ?? '')
    const { data: cmp } = await createAdminSupabase().from('compitas').select('nombre').eq('id', compitaId).maybeSingle()
    const corto = esc(nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita')
    return { correo: { asunto: 'Tu visita se interrumpió', html: marco(`
      <h2 style="color:#2D1464;font-size:22px">Tu visita se interrumpió</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">${corto} tuvo que interrumpir la visita. Lo más importante es la seguridad de todos, y el equipo de Compaz se comunicará contigo muy pronto.</p>
      <p style="color:#4A3B6B;font-size:15px;line-height:1.6">Esta visita no se te descuenta de tu plan. Cuando quieras, puedes agendar otra.</p>
      ${boton(`${SITE_URL}/dashboard`, 'Ir a mi portal →')}`) } }
  },
}

// Pasó la hora de fin y la visita sigue abierta: el bot le pregunta al compita si todo está bien.
const todoBien: Plantilla = {
  canales: ['telegram'],
  async render(v) {
    const visitaId = String(v.visitaId ?? '')
    const admin = createAdminSupabase()
    const { data: vis } = await admin.from('visitas').select('estado').eq('id', visitaId).maybeSingle()
    if (!vis || vis.estado !== 'en_curso') return null // ya terminó: no hace falta preguntar
    return { telegram: {
      texto: [`⏱️ <b>¿Todo bien?</b>`, ``, `La hora de fin de la visita ya pasó. Cuéntanos cómo estás:`].join('\n'),
      teclado: makeInlineKeyboard([[{ text: '✅ Todo bien', callback_data: `tb:ok:${visitaId}` }], [{ text: '🆘 Necesito ayuda', callback_data: `tb:ayuda:${visitaId}` }]]),
    } }
  },
}

// El compita le recuerda al cliente un paso que está esperando. Sale de Compaz: el cliente nunca ve datos del compita.
// Solo se envía si el paso sigue pendiente; si ya lo hizo, no se manda.
const recordatorioCliente: Plantilla = {
  canales: ['correo'],
  async render(v) {
    const tipo = String(v.tipo ?? ''); const id = String(v.id ?? ''); const compitaId = String(v.compitaId ?? '')
    const admin = createAdminSupabase()
    const { data: cmp } = await admin.from('compitas').select('nombre').eq('id', compitaId).maybeSingle()
    const corto = esc(nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita'); const cortoTxt = nombreCorto(String(cmp?.nombre ?? '')) || 'Tu compita'
    let clienteId = ''; let asunto = ''; let cuerpo = ''; let enlace = `${SITE_URL}/dashboard`; let boton_ = 'Ir a mi portal →'; let extra = ''
    if (tipo === 'hora' || tipo === 'pago') {
      const { data: s } = await admin.from('solicitudes').select('cliente_id, estado, tipo, slot_confirmado').eq('id', id).maybeSingle()
      if (!s || s.estado !== 'aceptada') return null
      clienteId = String(s.cliente_id)
      if (tipo === 'hora') {
        if (s.slot_confirmado) return null
        asunto = `${cortoTxt} está esperando que elijas la hora`; cuerpo = `${corto} aceptó hablar contigo y está esperando que elijas una de sus horas libres para la videollamada.`; enlace = `${SITE_URL}/solicitar/hora?solicitud=${encodeURIComponent(id)}`; boton_ = 'Elegir la hora →'
      } else {
        const { data: vis } = await admin.from('visitas').select('id').eq('compita_id', compitaId).eq('usuario_id', clienteId).limit(1).maybeSingle()
        if (vis) return null // ya pagó y hay visita
        asunto = `${cortoTxt} aceptó. Falta tu pago`; cuerpo = `${corto} aceptó tu solicitud y está esperando que completes el pago para empezar.`; enlace = `${SITE_URL}/pago?solicitud=${encodeURIComponent(id)}`; boton_ = 'Ir al pago →'
        extra = `<p style="color:#92400E;background:#FFFBEB;border:1px solid #F5B800;border-radius:12px;padding:12px;font-size:13px;line-height:1.5;margin-top:24px"><strong>Cuidado con los fraudes.</strong> ${esc(String(await getAjuste('antifraude_cliente')))}</p>`
      }
    } else {
      const { data: vis } = await admin.from('visitas').select('usuario_id, estado, fecha_programada, direccion').eq('id', id).maybeSingle()
      if (!vis) return null
      clienteId = String(vis.usuario_id)
      if (tipo === 'dir') { if (vis.estado !== 'programada' || vis.direccion) return null; asunto = 'Falta la dirección de tu visita'; cuerpo = `${corto} necesita la dirección de la visita para poder llegar. Regístrala en tu portal.`; boton_ = 'Registrar la dirección →' }
      else if (tipo === 'fecha') { if (vis.estado !== 'pre_visita' || vis.fecha_programada) return null; asunto = 'Falta registrar la fecha de tu visita'; cuerpo = `${corto} está esperando que registres la fecha y la hora de la visita en tu portal.`; boton_ = 'Registrar la fecha →' }
      else return null
    }
    const { data: cli } = await admin.from('usuarios').select('nombre').eq('id', clienteId).maybeSingle()
    const primero = esc(String(cli?.nombre ?? '').split(' ')[0])
    return { correo: { asunto, html: marco(`
      <h2 style="color:#2D1464;font-size:22px">${esc(asunto)}</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${primero}. ${cuerpo}</p>
      ${boton(enlace, boton_)}${extra}`) } }
  },
}

export const PLANTILLAS: Record<NombrePlantilla, Plantilla> = {
  solicitud_nueva: solicitudNueva,
  directa_aceptada: directaAceptada,
  pago_confirmado: pagoConfirmado,
  llamada_terminada_cliente: llamadaTerminadaCliente,
  llamada_terminada_compita: llamadaTerminadaCompita,
  entrevista_aceptada: entrevistaAceptada,
  reserva_pedida: reservaPedida,
  reserva_rechazada: reservaLiberada('rechazada'),
  reserva_vencida: reservaLiberada('vencida'),
  lugar_respuesta: lugarRespuesta,
  direccion_visita: direccionVisita,
  direccion_faltante_cliente: direccionFaltanteCliente,
  compita_en_camino: compitaEnCamino,
  compita_llego: compitaLlego,
  nadie_abre_cliente: nadieAbreCliente,
  visita_sin_acceso_cliente: visitaSinAccesoCliente,
  nadie_abre_cerrar: nadieAbreCerrar,
  salida_seguridad_cliente: salidaSeguridadCliente,
  cancelacion_equipo_cliente: cancelacionEquipoCliente,
  pausa_cuenta_cliente: pausaCuentaCliente,
  pausa_cuenta_decision: pausaCuentaDecision,
  todo_bien: todoBien,
  recordatorio_cliente: recordatorioCliente,
}
