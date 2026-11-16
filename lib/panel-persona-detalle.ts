// «Todo de esta persona»: lo que el equipo necesita para revisar la calidad de un compita o de un cliente sin salir de la ficha. Solo lectura y solo
// para quien tiene el permiso de cuentas. NUNCA incluye teléfono ni correo (esos salen solo por revelarContacto, con motivo). Los textos libres pasan
// por recortarTexto: quien no puede ver contactos no ve los que alguien haya escrito dentro de un texto. La condición y las notas del familiar son
// datos de salud: solo las ve un administrador.
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Actor } from '@/lib/permisos'
import { recortarTexto } from '@/lib/panel-datos'
import type { DetalleFicha, SeccionDetalle } from '@/lib/panel-personas-tipos'

const fecha = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Caracas' }) : 'sin fecha')
const estrellas = (n: number | null | undefined) => (n ? `${n} de 5` : 'sin calificar')
const MAX = 15

const TIPO_SOLICITUD: Record<string, string> = { entrevista: 'Entrevista', directa: 'Contratación directa', mandado: 'Mandado' }
const ESTADO_SOLICITUD: Record<string, string> = { pendiente: 'pendiente', aceptada: 'aceptada', rechazada: 'rechazada', completada: 'completada', contratada: 'contratada', cancelada: 'cancelada' }
const ESTADO_VISITA: Record<string, string> = { pre_visita: 'por agendar', programada: 'programada', confirmando_inicio: 'por iniciar', en_curso: 'en curso', terminada: 'terminada' }

const minutos = (ini: string | null, fin: string | null) => (ini && fin ? Math.max(0, Math.round((new Date(fin).getTime() - new Date(ini).getTime()) / 60000)) : null)

export async function detalleDeCompita(actor: Actor, id: string): Promise<DetalleFicha | null> {
  const db = createAdminSupabase()
  const { data: c } = await db.from('compitas').select('*').eq('id', id).maybeSingle()
  if (!c) return null
  const [res, sol, vis] = await Promise.all([
    db.from('resenas').select('estrellas, texto, publicada, created_at').eq('compita_id', id).order('created_at', { ascending: false }).limit(MAX),
    db.from('solicitudes').select('tipo, estado, created_at').eq('compita_id', id).order('created_at', { ascending: false }).limit(MAX),
    db.from('visitas').select('estado, fecha_programada, inicio, fin, rating_cliente, created_at').eq('compita_id', id).order('created_at', { ascending: false }).limit(MAX),
  ])
  const horarios = (Array.isArray(c.horarios_disponibles) ? c.horarios_disponibles : []) as { dia: string; inicio: string; fin: string }[]
  const secciones: SeccionDetalle[] = [
    { titulo: 'Cómo lo ve el cliente', info: 'Es el perfil que ve la familia en el listado: descripción, servicios y horarios. La foto y el video están arriba.', vacio: '', filas: [
      { etiqueta: 'Descripción', texto: recortarTexto(actor, String(c.descripcion ?? '')) || 'Sin descripción' },
      { etiqueta: 'Servicios', texto: Array.isArray(c.servicios) && c.servicios.length ? c.servicios.join(', ') : 'Ninguno marcado' },
      { etiqueta: 'Horarios', texto: horarios.length ? horarios.map((h) => `${h.dia} ${h.inicio} a ${h.fin}`).join(' · ') : 'Sin horarios' },
      { etiqueta: 'Zona', texto: String(c.zona ?? 'Sin zona') },
      ...(Array.isArray(c.intereses_futuros) && c.intereses_futuros.length ? [{ etiqueta: 'Quiere ofrecer más adelante', texto: c.intereses_futuros.map((i: string) => (i === 'mascotas' ? 'cuidado de mascotas' : i)).join(', ') }] : []),
    ] },
    { titulo: 'Calidad', info: 'Lo que dicen las familias: promedio, calificaciones y reseñas. Una reseña sin publicar todavía no la ve nadie fuera del equipo.', vacio: 'Todavía no tiene calificaciones.', filas: [
      ...(Number(c.total_ratings) > 0 ? [{ etiqueta: 'Promedio', texto: `${Number(c.rating_promedio).toFixed(1)} de 5 en ${c.total_ratings} calificaciones · ${c.visitas_realizadas ?? 0} visitas realizadas` }] : []),
      ...((res.data ?? []).map((r) => ({ texto: `${r.estrellas} de 5: ${recortarTexto(actor, String(r.texto ?? ''))}`, meta: `${fecha(r.created_at)} · ${r.publicada ? 'publicada' : 'sin publicar'}` }))),
    ] },
    { titulo: 'Solicitudes recibidas', vacio: 'No ha recibido solicitudes.', filas: (sol.data ?? []).map((s) => ({ texto: `${TIPO_SOLICITUD[String(s.tipo)] ?? 'Solicitud'}, ${ESTADO_SOLICITUD[String(s.estado)] ?? String(s.estado)}`, meta: fecha(s.created_at) })) },
    { titulo: 'Visitas', vacio: 'No ha hecho visitas.', filas: (vis.data ?? []).map((v) => {
      const m = minutos(v.inicio, v.fin)
      return { texto: `${ESTADO_VISITA[String(v.estado)] ?? String(v.estado)}${m !== null ? `, ${m} min` : ''}, calificación ${estrellas(v.rating_cliente)}`, meta: fecha(v.fecha_programada ?? v.created_at) }
    }) },
  ]
  return { fotoUrl: c.foto_url ? String(c.foto_url) : null, videoUrl: c.youtube_url ? String(c.youtube_url) : null, secciones }
}

export async function detalleDeCliente(actor: Actor, id: string): Promise<DetalleFicha | null> {
  const db = createAdminSupabase()
  const { data: u } = await db.from('usuarios').select('*').eq('id', id).maybeSingle()
  if (!u) return null
  const [sol, vis, res] = await Promise.all([
    db.from('solicitudes').select('tipo, estado, created_at, compita_id').eq('cliente_id', id).order('created_at', { ascending: false }).limit(MAX),
    db.from('visitas').select('estado, fecha_programada, inicio, fin, rating_cliente, created_at, compita_id').eq('usuario_id', id).order('created_at', { ascending: false }).limit(MAX),
    db.from('resenas').select('estrellas, texto, publicada, created_at').eq('cliente_id', id).order('created_at', { ascending: false }).limit(MAX),
  ])
  const ids = [...new Set([...(sol.data ?? []), ...(vis.data ?? [])].map((x) => String(x.compita_id)).filter(Boolean))]
  const nombres = new Map<string, string>()
  if (ids.length) for (const k of (await db.from('compitas').select('id, nombre, apellido').in('id', ids)).data ?? []) nombres.set(String(k.id), [k.nombre, k.apellido].filter(Boolean).join(' '))
  const con = (id: unknown) => nombres.get(String(id)) ?? 'un compita'
  const esAdmin = actor.rol === 'admin'
  const tieneFicha = !!u.familiar_nombre
  const secciones: SeccionDetalle[] = [
    { titulo: 'Su familiar', info: 'Lo que el cliente llenó en la ficha. La condición y las notas son datos de salud: solo las ve un administrador.', vacio: 'Todavía no ha llenado la ficha.', filas: tieneFicha ? [
      { etiqueta: 'Familiar', texto: `${recortarTexto(actor, String(u.familiar_nombre))}${u.familiar_edad ? `, ${u.familiar_edad} años` : ''}${u.parentesco ? ` (cliente: ${u.parentesco})` : ''}` },
      { etiqueta: 'País del cliente', texto: String(u.pais ?? 'Sin dato') },
      { etiqueta: 'Lugar', texto: u.lugar_privado ? `Privado${u.ficha_sin_nadie ? ', sin nadie más' : u.ficha_personas ? `, con ${recortarTexto(actor, String(u.ficha_personas))}` : ''}` : 'No privado' },
      ...(esAdmin && u.familiar_condicion ? [{ etiqueta: 'Condición', texto: String(u.familiar_condicion) }] : []),
      ...(esAdmin && u.familiar_notas ? [{ etiqueta: 'Notas', texto: String(u.familiar_notas) }] : []),
      ...(u.terminos_aceptados_en ? [{ etiqueta: 'Términos', texto: `Aceptados el ${fecha(u.terminos_aceptados_en)} (${u.terminos_version ?? 'sin versión'})` }] : []),
    ] : [] },
    { titulo: 'Plan', vacio: '', filas: [{ etiqueta: 'Plan', texto: u.plan_contratado ? `${u.plan_contratado}${u.plan_inicio ? `, desde ${fecha(u.plan_inicio)}` : ''}` : 'Sin plan contratado' }, { etiqueta: 'Alta', texto: fecha(u.created_at) }] },
    { titulo: 'Solicitudes', vacio: 'No ha enviado solicitudes.', filas: (sol.data ?? []).map((s) => ({ texto: `${TIPO_SOLICITUD[String(s.tipo)] ?? 'Solicitud'} a ${con(s.compita_id)}, ${ESTADO_SOLICITUD[String(s.estado)] ?? String(s.estado)}`, meta: fecha(s.created_at) })) },
    { titulo: 'Visitas', vacio: 'No ha tenido visitas.', filas: (vis.data ?? []).map((v) => {
      const m = minutos(v.inicio, v.fin)
      return { texto: `Con ${con(v.compita_id)}, ${ESTADO_VISITA[String(v.estado)] ?? String(v.estado)}${m !== null ? `, ${m} min` : ''}, la calificó ${estrellas(v.rating_cliente)}`, meta: fecha(v.fecha_programada ?? v.created_at) }
    }) },
    { titulo: 'Reseñas que escribió', vacio: 'No ha escrito reseñas.', filas: (res.data ?? []).map((r) => ({ texto: `${r.estrellas} de 5: ${recortarTexto(actor, String(r.texto ?? ''))}`, meta: `${fecha(r.created_at)} · ${r.publicada ? 'publicada' : 'sin publicar'}` })) },
  ]
  return { secciones }
}
