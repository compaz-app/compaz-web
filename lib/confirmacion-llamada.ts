// Registrar la respuesta de «¿ocurrió la llamada?». La usan dos puertas: el enlace del correo del cliente (/api/solicitud/confirmacion-llamada, con su página
// intermedia) y el botón de Telegram del compita (callback `ll:`), que NO pasa por ninguna página web. Devuelve qué mostrar; quien llama decide cómo.
import { createAdminSupabase } from '@/lib/supabase-server'
import { getSolicitudPorToken, registrarConfirmacion } from '@/lib/solicitudes'
import { alertaAdmin } from '@/lib/alertas-admin'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { registrarNovedad } from '@/lib/novedades'

export type ResultadoRespuestaLlamada =
  | { tipo: 'pagina'; titulo: string; texto: string; status?: number }
  /** El cliente dijo que no: va a elegir nuevos horarios. */
  | { tipo: 'redirigir'; destino: string }

export async function registrarRespuestaLlamada(token: string, quien: 'cliente' | 'compita', respuesta: 'si' | 'no'): Promise<ResultadoRespuestaLlamada> {

  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud) return { tipo: 'pagina', titulo: 'Enlace inválido', texto: 'No encontramos esta solicitud.', status: 404 }
  if (solicitud.estado !== 'aceptada') {
    return { tipo: 'pagina', titulo: 'Ya registramos tu respuesta', texto: 'Esta llamada ya fue procesada. ¡Gracias!' }
  }

  const ocurrio = respuesta === 'si'
  const resultado = await registrarConfirmacion(solicitud.id, quien, ocurrio)
  if (!resultado) return { tipo: 'pagina', titulo: 'Error', texto: 'No pudimos registrar tu respuesta. Intenta de nuevo.', status: 500 }

  const { solicitud: sol, escrita } = resultado

  // Segundo clic o reintento: ya estaba registrado, no re-notificar
  if (!escrita) {
    if (!ocurrio) {
      if (quien === 'cliente') return { tipo: 'redirigir', destino: `${SITE_URL}/reagendar/${encodeURIComponent(token)}` }
      return { tipo: 'pagina', titulo: 'Gracias por avisarnos', texto: 'Ya habíamos registrado tu respuesta.' }
    }
    return { tipo: 'pagina', titulo: 'Ya registramos tu respuesta', texto: '¡Gracias! Ya habíamos registrado tu confirmación.' }
  }

  const admin = createAdminSupabase()
  const { data: cliente } = await admin.from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()

  // Detectar conflicto: una parte dice sí y la otra dice no
  const cc = sol.confirmacion_cliente
  const cp = sol.confirmacion_compita
  if (cc !== null && cp !== null && cc !== cp) {
    await alertaAdmin('tarea', [
      `⚠️ <b>Conflicto en confirmación de llamada</b>`, ``,
      `<b>Compita:</b> ${esc(solicitud.compita_nombre)} dice <b>${cp ? 'SÍ ocurrió' : 'NO ocurrió'}</b>`,
      `<b>Cliente:</b> ${esc(cliente?.nombre ?? '')} dice <b>${cc ? 'SÍ ocurrió' : 'NO ocurrió'}</b>`, ``,
      `Revisar manualmente qué pasó.`,
    ].join('\n'))
    return { tipo: 'pagina', titulo: 'Gracias por avisarnos', texto: 'Recibimos tu respuesta. Nuestro equipo revisará lo que pasó y se pondrá en contacto contigo pronto.' }
  }

  if (!ocurrio) {
    await alertaAdmin('actividad', [
      `⚠️ <b>Llamada no ocurrió</b>`, ``,
      `<b>${quien === 'cliente' ? 'El cliente' : 'La compita'}</b> reportó que la llamada con <b>${esc(solicitud.compita_nombre)}</b>${quien === 'compita' ? ` y <b>${esc(cliente?.nombre ?? 'el cliente')}</b>` : ''} no se realizó.`, ``,
      `El cliente recibirá un link para proponer nuevos horarios.`,
    ].join('\n'))

    // El cliente se entera también DENTRO del portal (campana de avisos), no solo por correo, y el aviso lo lleva directo a elegir otra hora.
    if (quien === 'compita') {
      await registrarNovedad({ usuarioId: solicitud.cliente_id, tipo: 'llamada_no_ocurrio', nivel: 'accionable', titulo: `La llamada con ${solicitud.compita_nombre ?? 'tu compita'} no se pudo. Elige otra hora.`,
        ruta: `/reagendar/${encodeURIComponent(token)}`, entidad: 'solicitud', entidadId: solicitud.id, clave: `novedad:llamada_no_ocurrio:${solicitud.id}` })
    }
    if (quien === 'compita' && cliente?.email) {
      try {
        await sendEmail({
          to: cliente.email,
          subject: `${solicitud.compita_nombre} propone reagendar la llamada`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">Reagendar con ${esc(solicitud.compita_nombre)}</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                Parece que la llamada no pudo realizarse. Elige nuevos horarios y ${esc(solicitud.compita_nombre)} confirmará el que mejor le quede.
              </p>
              <a href="${SITE_URL}/reagendar/${encodeURIComponent(token)}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:16px">
                Proponer nuevos horarios →
              </a>
</div>`,
        })
      } catch (e) {
        console.error('Email reagendar al cliente:', e)
        await alertaAdmin('tarea', `⚠️ No se pudo enviar al cliente <b>${esc(cliente?.nombre ?? '')}</b> el enlace para reagendar. Avísale manualmente.`)
      }
    }

    if (quien === 'cliente') return { tipo: 'redirigir', destino: `${SITE_URL}/reagendar/${encodeURIComponent(token)}` }
    return { tipo: 'pagina', titulo: 'Gracias por avisarnos', texto: 'Entendemos. Le enviaremos al cliente un enlace para que proponga nuevos horarios.' }
  }

  return {
    tipo: 'pagina',
    titulo: '¡Confirmado!',
    texto: quien === 'cliente'
      ? `¡Perfecto! Ya registramos que la llamada fue bien. En un momento te preguntaremos si quieres contratar a ${solicitud.compita_nombre ?? 'tu compita'}.`
      : '¡Gracias! Ya registramos tu confirmación. Seguimos en contacto.',
  }
}
