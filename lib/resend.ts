import Anthropic from '@anthropic-ai/sdk'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc as escapeHtml } from '@/lib/html'
import { tokenRating, urlFotoFirmada } from '@/lib/links'
import type { Visita, Compita, Usuario, Mensaje, ReporteVisita } from '@/types'

function ratingToken(visita_id: string, valor: number): string {
  return tokenRating(visita_id, valor)
}

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null
const MODELO_RESUMEN = process.env.ANTHROPIC_MODEL_RESUMEN ?? 'claude-haiku-4-5-20251001'

/** src seguro de una foto para email: enlace firmado temporal; nunca URLs con token del bot. */
function fotoParaEmail(m: Mensaje): string | null {
  const c = m.contenido ?? ''
  if (c.startsWith('tg:')) return urlFotoFirmada(SITE_URL, m.id)
  return null
}

const ESCALA: Record<number, string> = { 1: 'Muy bajo', 2: 'Bajo', 3: 'Regular', 4: 'Bueno', 5: 'Excelente' }

function indicadorLabel(v: number | null): string {
  if (v === null) return 'No aplica'
  return `${v}/5 — ${ESCALA[v] ?? ''}`
}

async function generarResumenIA(
  compita: Compita,
  usuario: Usuario,
  reporte: Pick<ReporteVisita, 'animo' | 'fisico' | 'participacion' | 'entorno' | 'novedad'>,
  historial: Pick<ReporteVisita, 'animo' | 'fisico' | 'participacion' | 'entorno' | 'created_at'>[],
): Promise<string> {
  if (!anthropic) return ''

  const nVisitas = historial.length
  const historialTexto = nVisitas > 0
    ? historial.slice(-5).map((r, i) => {
        const fecha = new Date(r.created_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })
        return `Visita ${i + 1} (${fecha}): Ánimo ${r.animo ?? 'N/A'}, Físico ${r.fisico ?? 'N/A'}, Participación ${r.participacion ?? 'N/A'}, Entorno ${r.entorno ?? 'N/A'}`
      }).join('\n')
    : 'Esta es la primera visita registrada.'

  const prompt = `Eres el asistente de Compaz, servicio venezolano de cuidado de personas mayores.
La compita ${compita.nombre} terminó una visita con el familiar de ${usuario.nombre}.

Indicadores de esta visita (escala 1-5, 5 = excelente, null = no aplica):
Ánimo: ${reporte.animo ?? 'N/A'}
Condición física: ${reporte.fisico ?? 'N/A'}
Participación: ${reporte.participacion ?? 'N/A'}
Ambiente y entorno: ${reporte.entorno ?? 'N/A'}
${reporte.novedad ? `Novedad: ${reporte.novedad}` : ''}

Historial de visitas previas:
${historialTexto}

Escribe un párrafo de 2 a 3 oraciones en español, en tono cálido y profesional, dirigido a la familia. No uses guiones como viñetas. No inventes datos. Si hay novedades, menciónalas con tacto. Si hay 3 o más visitas y ves una tendencia clara (positiva o negativa), menciona brevemente. Si solo hay una visita, describe el estado observado.`

  try {
    const msg = await anthropic.messages.create({
      model: MODELO_RESUMEN,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = msg.content[0]
    return block.type === 'text' ? block.text.trim() : ''
  } catch (e) {
    console.error('Error generando resumen IA:', e)
    return ''
  }
}

export async function sendCodigoTelegram(email: string, nombre: string, codigo: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Tu código de verificación Compaz: ${codigo}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <p style="font-size: 16px; color: #1A0A3C;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
        <p style="font-size: 16px; color: #1A0A3C;">Tu código para activar tu cuenta en el bot de Telegram es:</p>
        <div style="font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #FF6B2B; text-align: center; padding: 24px 0;">${codigo}</div>
        <p style="font-size: 14px; color: #6B5C90;">Expira en 15 minutos. Ingrésalo en el chat de Telegram con el bot de Compaz.</p>
      </div>
    `,
  })
}

export async function sendBienvenidaCompita(
  email: string,
  nombre: string,
  telegramBotUsername: string,
): Promise<void> {
  const botUrl = `https://t.me/${encodeURIComponent(telegramBotUsername)}`
  await sendEmail({
    to: email,
    subject: `¡Bienvenido a Compaz, ${nombre}! Así funciona todo`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#FDFAF6">
        <img src="${SITE_URL}/logo.png" alt="Compaz" style="height:40px;margin-bottom:24px" />

        <h1 style="color:#2D1464;font-size:26px;margin-bottom:8px">¡Hola, ${escapeHtml(nombre)}! 👋</h1>
        <p style="color:#4A3B6B;font-size:16px;line-height:1.6;margin-bottom:24px">
          Ya eres parte de la familia Compaz. Aquí te explicamos todo lo que necesitas saber para comenzar.
        </p>

        <!-- Paso 1 -->
        <div style="background:white;border:2px solid #E8E0D4;border-radius:16px;padding:24px;margin-bottom:16px">
          <p style="color:#FF6B2B;font-weight:800;font-size:13px;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:1px">Paso 1</p>
          <h2 style="color:#2D1464;font-size:18px;margin:0 0 12px 0">Conecta tu Telegram 📱</h2>
          <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin:0 0 16px 0">
            Toda la comunicación con Compaz es a través de Telegram. Así recibirás solicitudes de clientes, confirmaciones de llamadas y mucho más.
          </p>
          <ol style="color:#4A3B6B;font-size:15px;line-height:2;padding-left:20px;margin:0 0 16px 0">
            <li>Abre Telegram y busca <strong>@${escapeHtml(telegramBotUsername)}</strong></li>
            <li>Pulsa <strong>Iniciar</strong> o escribe <strong>/start</strong></li>
            <li>El bot te pedirá tu nombre completo. Escríbelo tal como apareces aquí.</li>
            <li>Te enviará un código de 6 dígitos a este correo.</li>
            <li>Ingresa ese código en el chat para activar tu cuenta.</li>
          </ol>
          <a href="${botUrl}" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px">
            Abrir bot de Telegram →
          </a>
        </div>

        <!-- Paso 2 -->
        <div style="background:white;border:2px solid #E8E0D4;border-radius:16px;padding:24px;margin-bottom:16px">
          <p style="color:#FF6B2B;font-weight:800;font-size:13px;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:1px">Paso 2</p>
          <h2 style="color:#2D1464;font-size:18px;margin:0 0 12px 0">Completa tu perfil ✏️</h2>
          <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin:0 0 12px 0">
            Un perfil completo atrae más familias. Desde Telegram puedes escribir <strong>/perfil</strong> para obtener un enlace directo a tu página de edición.
          </p>
          <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin:0">
            Desde ahí puedes actualizar tu foto 📸, tu descripción personal ✍️, los servicios que ofreces 🛎️, tus horarios disponibles 🕐 y agregar un video de presentación en YouTube 🎥. Mientras más completo esté tu perfil, más fácil será que las familias te escojan.
          </p>
        </div>

        <!-- Paso 3 -->
        <div style="background:white;border:2px solid #E8E0D4;border-radius:16px;padding:24px;margin-bottom:24px">
          <p style="color:#FF6B2B;font-weight:800;font-size:13px;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:1px">Paso 3</p>
          <h2 style="color:#2D1464;font-size:18px;margin:0 0 12px 0">¡Listo! Ahora espera a que lleguen las familias 🤝</h2>
          <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin:0 0 12px 0">
            Cuando una familia quiera conocerte, recibirás un mensaje de Telegram con todos los detalles. Desde ahí puedes <strong>aceptar o rechazar</strong> la solicitud y coordinar el horario de la videollamada.
          </p>
          <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin:0">
            Antes de aparecer ante las familias, nuestro equipo revisa y verifica tu perfil. Te avisaremos por Telegram y por correo en cuanto esté listo. Mientras tanto, recuerda que las familias comparan varios perfiles antes de elegir. Una foto clara, una descripción que transmita tu personalidad y un video de presentación pueden ser lo que te haga destacar. Mientras más cuidado esté tu perfil, más probabilidades tienes de que te escojan a ti.
          </p>
        </div>

        <!-- Comandos útiles -->
        <div style="background:#F5F0FF;border-radius:16px;padding:20px;margin-bottom:24px">
          <h3 style="color:#2D1464;font-size:16px;margin:0 0 12px 0">Comandos útiles en Telegram</h3>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#FF6B2B;font-weight:700;font-size:14px;padding:4px 8px;white-space:nowrap">/menu</td><td style="color:#4A3B6B;font-size:14px;padding:4px 8px">Ver todas las opciones disponibles</td></tr>
            <tr><td style="color:#FF6B2B;font-weight:700;font-size:14px;padding:4px 8px;white-space:nowrap">/perfil</td><td style="color:#4A3B6B;font-size:14px;padding:4px 8px">Obtener tu enlace para editar tu perfil</td></tr>
            <tr><td style="color:#FF6B2B;font-weight:700;font-size:14px;padding:4px 8px;white-space:nowrap">/ayuda</td><td style="color:#4A3B6B;font-size:14px;padding:4px 8px">Ver comandos y guía de uso</td></tr>
          </table>
        </div>

        <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin-bottom:8px">
          Cualquier duda, escríbenos directamente en Telegram o responde a este correo. ¡Estamos para ayudarte!
        </p>
        <p style="color:#2D1464;font-size:15px;font-weight:700;margin-bottom:32px">El equipo Compaz 💙</p>
        <p style="color:#9990A8;font-size:13px;margin:0">Compaz — <em>Cerca aunque estés lejos</em></p>
      </div>
    `,
  })
}

export async function sendBienvenidaCliente(email: string, nombre: string, enlaceAcceso: string, reenvio = false): Promise<void> {
  const primero = escapeHtml(nombre.split(' ')[0])
  await sendEmail({
    to: email,
    subject: reenvio ? 'Tu acceso a Compaz' : `Bienvenido a Compaz, ${nombre.split(' ')[0]}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#FDFAF6">
        <h1 style="color:#2D1464;font-size:26px;margin-bottom:8px">¡Hola, ${primero}! 👋</h1>
        <p style="color:#4A3B6B;font-size:16px;line-height:1.6;margin-bottom:20px">
          ${reenvio ? 'Aquí tienes un nuevo enlace para entrar a tu portal de Compaz.' : 'Te damos la bienvenida a Compaz. Pulsa el botón para activar tu cuenta y entrar a tu portal.'}
        </p>

        <a href="${escapeHtml(enlaceAcceso)}" style="display:inline-block;background:#FF6B2B;color:white;padding:16px 32px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:17px">
          ${reenvio ? 'Entrar a mi portal →' : 'Activar mi cuenta y entrar →'}
        </a>
        <p style="color:#6B5C90;font-size:13px;line-height:1.6;margin:12px 0 28px">
          Este enlace es personal, funciona una sola vez y <strong>vence en 1 hora</strong>. Después podrás entrar siempre desde micompaz.com/login: escribes tu correo y te enviamos un enlace nuevo. Si este enlace venció, escríbenos a hola@micompaz.com y te mandamos otro.
        </p>

        <div style="background:white;border:2px solid #E8E0D4;border-radius:16px;padding:24px;margin-bottom:16px">
          <p style="color:#FF6B2B;font-weight:800;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Paso 1</p>
          <h2 style="color:#2D1464;font-size:18px;margin:0 0 10px">Explora los compitas disponibles</h2>
          <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin:0">
            Desde tu portal puedes ver perfiles, leer descripciones y elegir quién mejor se adapta a las necesidades de tu familiar.
          </p>
        </div>

        <div style="background:white;border:2px solid #E8E0D4;border-radius:16px;padding:24px;margin-bottom:16px">
          <p style="color:#FF6B2B;font-weight:800;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Paso 2</p>
          <h2 style="color:#2D1464;font-size:18px;margin:0 0 10px">Solicita una entrevista</h2>
          <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin:0">
            Cuando encuentres un compita que te interese, propón tres horarios para una videollamada de 20 minutos. El compita confirmará el que mejor le funcione.
          </p>
        </div>

        <div style="background:white;border:2px solid #E8E0D4;border-radius:16px;padding:24px;margin-bottom:24px">
          <p style="color:#FF6B2B;font-weight:800;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Paso 3</p>
          <h2 style="color:#2D1464;font-size:18px;margin:0 0 10px">Agenda la primera visita</h2>
          <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin:0">
            Después de la entrevista, coordina directamente con el compita y agenda el primer día de visita. Recibirás actualizaciones en tiempo real.
          </p>
        </div>

        <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin-top:8px">
          Cualquier duda, responde este correo o escríbenos a <a href="mailto:hola@micompaz.com" style="color:#FF6B2B">hola@micompaz.com</a>.
        </p>
        <p style="color:#9990A8;font-size:13px;margin-top:8px">Compaz — <em>Cerca aunque estés lejos</em></p>
      </div>
    `,
  })
}

export async function sendVisitaInicio(
  usuario: Usuario,
  compita: Compita,
  visita: Visita
): Promise<void> {
  const hora = new Date(visita.inicio!).toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Caracas',
  })

  await sendEmail({
    to: usuario.email,
    subject: `${compita.nombre} llegó con tu familiar`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <img src="${SITE_URL}/logo.png" alt="Compaz" style="height: 40px; margin-bottom: 24px;" />
        <h2 style="color: #2D1464; font-size: 24px; margin-bottom: 16px;">
          ${escapeHtml(compita.nombre)} comenzó la visita
        </h2>
        <p style="color: #4A3B6B; font-size: 16px; line-height: 1.6;">
          ${escapeHtml(compita.nombre)} llegó a las <strong>${hora}</strong> y la visita ya está en curso.
        </p>
        <p style="color: #4A3B6B; font-size: 16px; line-height: 1.6;">
          Puedes seguirla en tiempo real desde tu portal:
        </p>
        <a href="${SITE_URL}/dashboard"
           style="display: inline-block; background: #FF6B2B; color: white; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; margin-top: 8px;">
          Ver visita en vivo
        </a>
        <p style="color: #6B5C90; font-size: 14px; margin-top: 32px;">
          Compaz — <em>Cerca aunque estés lejos</em>
        </p>
      </div>
    `,
  })
}

export async function sendVisitaResumen(
  usuario: Usuario,
  compita: Compita,
  visita: Visita,
  mensajes: Mensaje[]
): Promise<void> {
  const inicio = new Date(visita.inicio!)
  const fin = new Date(visita.fin!)
  const duracionMs = fin.getTime() - inicio.getTime()
  const duracionMin = Math.round(duracionMs / 60000)
  const horas = Math.floor(duracionMin / 60)
  const minutos = duracionMin % 60
  const duracion = horas > 0 ? `${horas}h ${minutos}min` : `${minutos} minutos`

  const mensajesTexto = mensajes
    .filter((m) => m.tipo === 'texto' && m.origen !== 'admin')
    .map((m) => {
      const hora = new Date(m.created_at).toLocaleTimeString('es-VE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Caracas',
      })
      const quien = m.origen === 'compita' ? escapeHtml(compita.nombre) : 'Tú'
      return `<tr>
        <td style="color: #6B5C90; font-size: 13px; padding: 4px 8px; white-space: nowrap;">${hora}</td>
        <td style="color: #4A3B6B; font-size: 14px; padding: 4px 8px;"><strong>${quien}:</strong> ${escapeHtml(m.contenido ?? '')}</td>
      </tr>`
    })
    .join('')

  const fotoUrls = mensajes.filter((m) => m.tipo === 'foto').map(fotoParaEmail).filter((u): u is string => !!u)
  const fotosHtml = fotoUrls.length > 0
    ? `<div style="margin-top: 24px;">
        <p style="color: #4A3B6B; font-size: 15px; font-weight: 600; margin-bottom: 12px;">Fotos de la visita</p>
        ${fotoUrls.map((u) => `<img src="${escapeHtml(u)}" alt="Foto de la visita" style="max-width: 100%; border-radius: 12px; margin-bottom: 12px; display: block;" />`).join('')}
       </div>`
    : ''

  await sendEmail({
    to: usuario.email,
    subject: `Resumen de la visita de hoy con ${compita.nombre}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <img src="${SITE_URL}/logo.png" alt="Compaz" style="height: 40px; margin-bottom: 24px;" />
        <h2 style="color: #2D1464; font-size: 24px; margin-bottom: 8px;">
          Resumen de la visita
        </h2>
        <p style="color: #6B5C90; font-size: 15px; margin-bottom: 24px;">
          La visita de ${escapeHtml(compita.nombre)} duró <strong>${duracion}</strong>.
        </p>
        ${mensajesTexto ? `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          ${mensajesTexto}
        </table>` : ''}
        ${fotosHtml}
        <a href="${SITE_URL}/dashboard"
           style="display: inline-block; background: #2D1464; color: white; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; margin-top: 16px;">
          Ver historial completo
        </a>
        <div style="margin-top:28px;padding-top:24px;border-top:1.5px solid #E8E0D4">
          <p style="color:#4A3B6B;font-size:14px;font-weight:600;margin:0 0 12px">¿Cómo estuvo la visita de hoy?</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${[1,2,3,4,5].map(n => `<a href="${SITE_URL}/api/visita/rating?visita_id=${visita.id}&valor=${n}&t=${ratingToken(visita.id, n)}" style="display:inline-block;background:#F5F0FF;border:2px solid #D4C9E8;color:#2D1464;padding:8px 14px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:16px">${'⭐'.repeat(n)}</a>`).join('')}
          </div>
        </div>
        <div style="margin-top:20px">
          <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:14px">
            Agendar otra visita →
          </a>
        </div>
        <p style="color: #6B5C90; font-size: 14px; margin-top: 32px;">
          Compaz — <em>Cerca aunque estés lejos</em>
        </p>
      </div>
    `,
  })
}

export async function sendResumenConReporte(
  usuario: Usuario,
  compita: Compita,
  visita: Visita,
  mensajes: Mensaje[],
  reporte: Pick<ReporteVisita, 'animo' | 'fisico' | 'participacion' | 'entorno' | 'novedad'>,
  historial: Pick<ReporteVisita, 'animo' | 'fisico' | 'participacion' | 'entorno' | 'created_at'>[],
  esActualizacion = false,
): Promise<string> {
  const inicio = new Date(visita.inicio!)
  const fin = new Date(visita.fin!)
  const duracionMin = Math.round((fin.getTime() - inicio.getTime()) / 60000)
  const horas = Math.floor(duracionMin / 60)
  const minutos = duracionMin % 60
  const duracion = horas > 0 ? `${horas}h ${minutos}min` : `${minutos} minutos`

  const resumenIA = await generarResumenIA(compita, usuario, reporte, historial)

  const fotoUrls = mensajes.filter((m) => m.tipo === 'foto').map(fotoParaEmail).filter((u): u is string => !!u)
  const fotosHtml = fotoUrls.length > 0
    ? `<div style="margin-top:20px">${fotoUrls.map((u) => `<img src="${escapeHtml(u)}" alt="Foto de la visita" style="max-width:100%;border-radius:12px;margin-bottom:12px;display:block" />`).join('')}</div>`
    : ''

  const indicadoresHtml = `
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      ${reporte.animo !== null ? `<tr><td style="color:#6B5C90;font-size:13px;padding:6px 8px;white-space:nowrap;width:180px">Ánimo</td><td style="font-size:14px;color:#1A0A3C;padding:6px 8px">${indicadorLabel(reporte.animo)}</td></tr>` : ''}
      ${reporte.fisico !== null ? `<tr><td style="color:#6B5C90;font-size:13px;padding:6px 8px">Condición física</td><td style="font-size:14px;color:#1A0A3C;padding:6px 8px">${indicadorLabel(reporte.fisico)}</td></tr>` : ''}
      ${reporte.participacion !== null ? `<tr><td style="color:#6B5C90;font-size:13px;padding:6px 8px">Participación</td><td style="font-size:14px;color:#1A0A3C;padding:6px 8px">${indicadorLabel(reporte.participacion)}</td></tr>` : ''}
      ${reporte.entorno !== null ? `<tr><td style="color:#6B5C90;font-size:13px;padding:6px 8px">Ambiente y entorno</td><td style="font-size:14px;color:#1A0A3C;padding:6px 8px">${indicadorLabel(reporte.entorno)}</td></tr>` : ''}
    </table>`

  await sendEmail({
    to: usuario.email,
    subject: esActualizacion ? `Actualización de la visita de hoy con ${escapeHtml(compita.nombre)}` : `Resumen de la visita de hoy con ${escapeHtml(compita.nombre)}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
        <img src="${SITE_URL}/logo.png" alt="Compaz" style="height:40px;margin-bottom:24px" />
        <h2 style="color:#2D1464;font-size:24px;margin-bottom:4px">${esActualizacion ? 'Actualización de la visita' : 'Resumen de la visita'}</h2>
        <p style="color:#6B5C90;font-size:14px;margin-bottom:20px">La visita de <strong>${escapeHtml(compita.nombre)}</strong> duró <strong>${duracion}</strong>.</p>
        ${resumenIA ? `<div style="background:#F5F0FF;border-left:4px solid #7C4DFF;border-radius:8px;padding:16px 20px;margin-bottom:20px"><p style="color:#1A0A3C;font-size:15px;line-height:1.7;margin:0">${escapeHtml(resumenIA)}</p></div>` : ''}
        <h3 style="color:#2D1464;font-size:15px;margin-bottom:4px">Indicadores de la visita</h3>
        ${indicadoresHtml}
        ${reporte.novedad ? `<div style="background:#FFF3E8;border:1.5px solid #FF6B2B;border-radius:10px;padding:14px 18px;margin-bottom:16px"><p style="color:#C84B0E;font-size:13px;font-weight:700;margin:0 0 4px">Novedad reportada</p><p style="color:#1A0A3C;font-size:14px;margin:0;line-height:1.6">${escapeHtml(reporte.novedad)}</p></div>` : ''}
        ${fotosHtml}
        <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#2D1464;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:600;margin-top:16px">Ver historial completo</a>
        <div style="margin-top:28px;padding-top:24px;border-top:1.5px solid #E8E0D4">
          <p style="color:#4A3B6B;font-size:14px;font-weight:600;margin:0 0 12px">¿Cómo estuvo la visita de hoy?</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${[1,2,3,4,5].map(n => `<a href="${SITE_URL}/api/visita/rating?visita_id=${visita.id}&valor=${n}&t=${ratingToken(visita.id, n)}" style="display:inline-block;background:#F5F0FF;border:2px solid #D4C9E8;color:#2D1464;padding:8px 14px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:16px">${'⭐'.repeat(n)}</a>`).join('')}
          </div>
        </div>
        <div style="margin-top:20px">
          <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:14px">
            Agendar otra visita →
          </a>
        </div>
        <p style="color:#6B5C90;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
      </div>
    `,
  })

  return resumenIA
}
