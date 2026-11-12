/* eslint-disable */
// Panel nuevo: Seguimiento por etapas, Visitas y el chat del equipo.
import { db, limpiar, session, req, mkCliente, mkCompita, mkSolicitud, mkVisita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { urgenciaDe, consultarSeguimiento, etapaDePaso, UMBRALES, type FilaSeguimiento } from '@/lib/panel-seguimiento-tipos'
import { listarSeguimiento } from '@/lib/panel-seguimiento'
import { clasificarVisita, consultarVisitas, diaVE, type VisitaCruda } from '@/lib/panel-visitas-tipos'
import { listarVisitas, detalleDeVisita } from '@/lib/panel-visitas'
import { queHacerConVisita, leerVisitaUrl } from '@/lib/panel-visitas-tipos'
import { verChat } from '@/lib/panel-chat'
import { POST as chatRuta } from '@/app/api/admin/chat/route'
import { agruparChat, esMarcaInterna, etiquetaDia } from '@/lib/panel-chat-tipos'
import { SITUACION, ETIQUETA_ESPERA, leerCasoUrl } from '@/lib/panel-caso-tipos'
import { CODIGOS_ESTADO } from '@/lib/estado-cliente'
import { casoDeCliente } from '@/lib/panel-caso'
import { leerChatUrl } from '@/lib/panel-personas-tipos'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'
import type { Actor } from '@/lib/permisos'

beforeEach(limpiar)
const actor = (rol: 'admin' | 'colaborador', p: any = {}): Actor => ({ id: 'u1', correo: rol === 'admin' ? 'admin@compaz.test' : 'luis@compaz.test', rol, permisos: rol === 'admin' ? { ...TODOS } : { ...NINGUNO, ...p } })
const fila = (o: Partial<FilaSeguimiento> = {}): FilaSeguimiento => ({ id: Math.random().toString(36).slice(2), nombre: 'Ana', compitaId: null, compita: null, etapa: 'Pago', horas: 1, urgencia: 'verde', ultimo: '2026-11-10T00:00:00Z', espera: 'cliente', ...o })

describe('seguimiento (lógica pura)', () => {
  test('el color sale de las horas sin movimiento y de la etapa', () => {
    assert.equal(urgenciaDe('Pago', 1), 'verde'); assert.equal(urgenciaDe('Pago', 2), 'amarillo'); assert.equal(urgenciaDe('Pago', 12), 'rojo')
    assert.equal(urgenciaDe('Entrevista', 3), 'rojo'); assert.equal(urgenciaDe('Activo', 100), 'verde'); assert.equal(urgenciaDe('Activo', UMBRALES.Activo[1]), 'rojo')
  })
  test('los pasos del portal caen en las etapas del prototipo', () => { assert.deepEqual([0, 1, 2, 3, 4, 5].map(etapaDePaso), ['Solicitud', 'Entrevista', 'Decisión', 'Pago', 'Ficha', 'Activo']); assert.equal(etapaDePaso(99), 'Activo') })
  test('más atascado primero; la etapa y la página de la dirección se sanean', () => {
    const l = [fila({ nombre: 'V', urgencia: 'verde', horas: 50 }), fila({ nombre: 'R1', urgencia: 'rojo', horas: 30 }), fila({ nombre: 'R2', urgencia: 'rojo', horas: 90 }), fila({ nombre: 'A', etapa: 'Ficha', urgencia: 'amarillo' })]
    assert.deepEqual(consultarSeguimiento(l, undefined, 1).fila.map((x) => x.nombre), ['R2', 'R1', 'A', 'V'])
    const f = consultarSeguimiento(l, 'Ficha', 1); assert.equal(f.total, 1); assert.equal(f.conteos.Todos, 4); assert.equal(f.conteos.Pago, 3)
    assert.equal(consultarSeguimiento(l, '<x>', '-3').etapa, 'Todos'); assert.equal(consultarSeguimiento(l, 'Todos', 99).pag, 1)
  })
})

describe('seguimiento (datos reales)', () => {
  test('usa el mismo motor que el portal: quien pidió entrevista aparece en Solicitud/Entrevista y quien no pidió nada, no', async () => {
    const c = mkCompita({ nombre: 'Rosa' } as any), cli = mkCliente({ nombre: 'Ana' } as any); mkCliente({ nombre: 'Sin pedir' } as any)
    mkSolicitud(cli, c, { estado: 'pendiente', created_at: new Date(Date.now() - 30 * 3600_000).toISOString() })
    const l = await listarSeguimiento()
    assert.equal(l.length, 1); assert.equal(l[0].nombre, 'Ana'); assert.equal(l[0].etapa, 'Solicitud'); assert.equal(l[0].urgencia, 'rojo'); assert.equal(l[0].compita?.startsWith('Rosa'), true)
    assert.ok(l[0].horas >= 29 && l[0].horas <= 31)
  })
  test('un cliente bloqueado no aparece', async () => {
    const c = mkCompita(), cli = mkCliente({ plan: 'bloqueado' } as any); mkSolicitud(cli, c, { estado: 'pendiente' })
    assert.equal((await listarSeguimiento()).length, 0)
  })
})

describe('visitas', () => {
  const ahora = new Date('2026-11-10T15:00:00Z').getTime() // 11:00 en Caracas
  const cruda = (o: Partial<VisitaCruda> = {}): VisitaCruda => ({ id: 'v' + Math.random().toString(36).slice(2), estado: 'programada', fecha_programada: '2026-11-10', hora_inicio_programada: '14:00:00', inicio: null, fin: null, created_at: '2026-11-01T00:00:00Z', sin_acceso_en: null, rating_cliente: null, usuario_id: 'u', compita_id: 'c', cliente: 'Ana', compita: 'Rosa', zona: 'Chacao', ...o })
  test('cada estado sale de un dato real', () => {
    assert.equal(clasificarVisita(cruda(), ahora).estado, 'Programada')
    const tarde = clasificarVisita(cruda({ hora_inicio_programada: '09:00:00' }), ahora); assert.equal(tarde.estado, 'No se presentó'); assert.match(tarde.motivo!, /30 min/)
    assert.equal(clasificarVisita(cruda({ hora_inicio_programada: '10:45:00' }), ahora).estado, 'Programada')
    assert.equal(clasificarVisita(cruda({ estado: 'en_curso', inicio: '2026-11-10T14:00:00Z' }), ahora).estado, 'En curso')
    assert.equal(clasificarVisita(cruda({ estado: 'confirmando_inicio' }), ahora).estado, 'En curso')
    assert.equal(clasificarVisita(cruda({ sin_acceso_en: '2026-11-10T14:30:00Z' }), ahora).estado, 'Sin acceso')
    assert.equal(clasificarVisita(cruda({ estado: 'pre_visita', fecha_programada: null, hora_inicio_programada: null }), ahora).estado, 'Por coordinar')
    const t = clasificarVisita(cruda({ estado: 'terminada', fin: '2026-11-09T20:00:00Z', rating_cliente: 2 }), ahora); assert.equal(t.estado, 'Terminada'); assert.match(t.motivo!, /2 estrellas/)
    assert.equal(clasificarVisita(cruda({ estado: 'terminada', rating_cliente: 5 }), ahora).motivo, null)
  })
  test('la hora de la cita es la de Venezuela: 14:00 allá son las 18:00 UTC', () => { assert.equal(clasificarVisita(cruda(), ahora).ts, '2026-11-10T18:00:00.000Z'); assert.equal(diaVE('2026-11-10T03:00:00Z'), '2026-11-09') })
  test('las vistas filtran, cuentan y ordenan; una vista inventada cae en Hoy', () => {
    const l = [cruda(), cruda({ hora_inicio_programada: '09:00:00' }), cruda({ estado: 'terminada', fin: '2026-11-01T12:00:00Z', rating_cliente: 5 }), cruda({ estado: 'terminada', fin: '2026-11-02T12:00:00Z', rating_cliente: 1 })].map((c) => clasificarVisita(c, ahora))
    const hoy = consultarVisitas(l, 'hoy', 1, ahora); assert.equal(hoy.total, 2)
    assert.equal(consultarVisitas(l, 'problemas', 1, ahora).total, 2); assert.equal(consultarVisitas(l, 'terminadas', 1, ahora).fila[0].ts.slice(0, 10), '2026-11-02')
    assert.equal(consultarVisitas(l, '<x>', 'abc', ahora).vista, 'hoy'); assert.equal(consultarVisitas(l, 'todas', 1, ahora).conteos.todas, 4)
  })
  test('listarVisitas une los nombres', async () => {
    const c = mkCompita({ nombre: 'Rosa', zona: 'Chacao' } as any), cli = mkCliente({ nombre: 'Ana' } as any)
    mkVisita(cli, c, { estado: 'programada', fecha_programada: '2026-12-31', hora_inicio_programada: '10:00:00' })
    const [v] = await listarVisitas(); assert.equal(v.cliente, 'Ana'); assert.equal(v.compita.startsWith('Rosa'), true); assert.equal(v.zona, 'Chacao'); assert.equal(v.estado, 'Programada')
  })
})

describe('el detalle de una visita', () => {
  test('dice qué hacer según cómo va, y solo da recomendaciones donde hay algo que hacer', () => {
    assert.match(queHacerConVisita({ estado: 'No se presentó', rating: null })!, /Escríbele por Telegram/); assert.match(queHacerConVisita({ estado: 'Sin acceso', rating: null })!, /Bandeja/)
    assert.match(queHacerConVisita({ estado: 'Terminada', rating: 2 })!, /2 estrellas/); assert.equal(queHacerConVisita({ estado: 'Terminada', rating: 5 }), null); assert.equal(queHacerConVisita({ estado: 'Programada', rating: null }), null)
  })
  test('trae quiénes participan y su historia ordenada, sin dirección ni teléfonos', async () => {
    const c = mkCompita({ nombre: 'Rosa' } as any), cli = mkCliente({ nombre: 'Ana' } as any)
    const v = mkVisita(cli, c, { estado: 'programada', fecha_programada: '2020-01-01', hora_inicio_programada: '10:00:00', created_at: '2019-12-20T10:00:00Z', llegada_en: '2020-01-01T14:05:00Z', sin_acceso_en: '2020-01-01T14:40:00Z', direccion: 'Calle secreta 12', contacto_tel: '+58 412 0001111' } as any) as any
    db.seed('cancelaciones', { visita_id: v.id, cancelado_por: 'cliente', tardia: true, justificada: false, creado_en: '2019-12-25T10:00:00Z' })
    const d = (await detalleDeVisita(actor('admin'), v.id))!
    assert.equal(d.fila.cliente, 'Ana'); assert.equal(d.fila.estado, 'Sin acceso'); assert.deepEqual(d.linea.map((l) => l.texto), ['Nadie abrió la puerta', 'El compita llegó', 'Cancelación por el cliente, con poco aviso', 'Se agendó la visita'])
    assert.doesNotMatch(JSON.stringify(d), /Calle secreta|0001111/); assert.equal(await detalleDeVisita(actor('admin'), '00000000-0000-0000-0000-000000000000'), null)
  })
  test('la fila de Visitas tiene un destino (el detalle) y la dirección acepta solo ids válidos', () => {
    const f = readFileSync('components/panel/Visitas.tsx', 'utf8'); assert.match(f, /enlace\(\{ visita: v\.id \}\)/); assert.doesNotMatch(f, /persona: `/); assert.match(f, /DESCRIPCION_VISITAS/)
    assert.equal(leerVisitaUrl("x' or 1=1"), null); assert.equal(leerVisitaUrl('12345678-abcd'), '12345678-abcd')
  })
})

describe('chat del equipo', () => {
  const montar = () => {
    const c = mkCompita({ nombre: 'Rosa' } as any), cli = mkCliente({ nombre: 'Ana' } as any), v = mkVisita(cli, c) as any
    db.seed('mensajes', { visit_id: v.id, origen: 'cliente', tipo: 'texto', contenido: 'Hola, mi número es +58 414 1234567', created_at: '2026-11-10T10:00:00Z' })
    db.seed('mensajes', { visit_id: v.id, origen: 'compita', tipo: 'foto', contenido: 'ruta/foto.jpg', created_at: '2026-11-10T10:05:00Z' })
    return { c: c as any, cli: cli as any }
  }
  test('un colaborador sin motivo no recibe nada y no queda nada anotado', async () => {
    const { c, cli } = montar()
    const r = await verChat(actor('colaborador', { chats: true }), { clienteId: cli.id, compitaId: c.id, motivo: undefined })
    assert.equal(r.ok, false); assert.equal(db.rows('actividad_admin').length, 0)
  })
  test('con motivo recibe la conversación, sin contactos, y queda anotado quién y por qué', async () => {
    const { c, cli } = montar()
    const r = await verChat(actor('colaborador', { chats: true }), { clienteId: cli.id, compitaId: c.id, motivo: 'Reclamo del cliente' })
    assert.equal(r.ok, true); const m = (r as any).mensajes
    assert.equal(m.length, 2); assert.equal(m[0].de, 'Cliente'); assert.doesNotMatch(m[0].texto, /414 1234567/); assert.equal(m[1].esFoto, true); assert.equal(m[1].texto, '')
    const a = db.rows('actividad_admin').find((x: any) => x.categoria === 'acceso_chat')!
    assert.match(a.resumen, /luis@compaz\.test/); assert.match(a.resumen, /Reclamo del cliente/)
  })
  test('el administrador entra sin motivo y ve el texto completo, y también queda anotado', async () => {
    const { c, cli } = montar()
    const r = await verChat(actor('admin'), { clienteId: cli.id, compitaId: c.id, motivo: null })
    assert.match((r as any).mensajes[0].texto, /414 1234567/); assert.match(db.rows('actividad_admin')[0].resumen, /Sin motivo requerido/)
  })
  test('sin el permiso de chats se niega aunque dé motivo', async () => {
    const { c, cli } = montar()
    const r = await verChat(actor('colaborador', { monitorear: true }), { clienteId: cli.id, compitaId: c.id, motivo: 'Reclamo del cliente' })
    assert.equal((r as any).status, 403); assert.equal(db.rows('actividad_admin').length, 0)
  })
  test('la ruta exige sesión del equipo y valida el cuerpo', async () => {
    const { c, cli } = montar()
    session.user = null as any
    assert.equal((await chatRuta(req('/api/admin/chat', { method: 'POST', json: { clienteId: cli.id, compitaId: c.id } }))).status, 401)
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    assert.equal((await chatRuta(req('/api/admin/chat', { method: 'POST', json: { clienteId: "x' or 1=1", compitaId: c.id } }))).status, 400)
    assert.equal((await chatRuta(req('/api/admin/chat', { method: 'POST', json: { clienteId: cli.id, compitaId: c.id } }))).status, 200)
  })
  test('la dirección del chat solo acepta dos ids válidos', () => {
    assert.deepEqual(leerChatUrl('12345678-aaaa:87654321-bbbb'), { clienteId: '12345678-aaaa', compitaId: '87654321-bbbb' })
    assert.equal(leerChatUrl('a:b'), null); assert.equal(leerChatUrl('12345678:87654321:99999999'), null); assert.equal(leerChatUrl(undefined), null)
  })
})

describe('chat día por día', () => {
  const m = (de: any, cuando: string, texto: string, esFoto = false) => ({ de, cuando, texto, esFoto })
  const ahora = new Date('2026-11-10T15:00:00Z').getTime()
  test('separa por día de Venezuela (la medianoche de allá es a las 04:00 UTC) y junta mensajes seguidos de la misma persona', () => {
    const d = agruparChat([
      m('Compita', '2026-11-03T14:00:00Z', 'Hola'), m('Cliente', '2026-11-02T20:00:00Z', 'a'), m('Cliente', '2026-11-02T20:05:00Z', 'b'),
      m('Cliente', '2026-11-03T03:30:00Z', 'tarde'), m('Compita', '2026-11-03T04:30:00Z', 'ya es otro día'),
    ], ahora)
    assert.deepEqual(d.map((x) => x.dia), ['2026-11-02', '2026-11-03'])
    assert.equal(d[0].bloques.length, 1); assert.deepEqual(d[0].bloques[0].lineas.map((l) => l.texto), ['a', 'b', 'tarde'])
    assert.deepEqual(d[1].bloques.map((b) => b.de), ['Compita']); assert.equal(d[1].bloques[0].lineas.length, 2)
  })
  test('las marcas internas del sistema no se muestran, pero un mensaje real de Compaz sí', () => {
    assert.equal(esMarcaInterna(m('Compaz', 'x', 'plan:quincenal')), true); assert.equal(esMarcaInterna(m('Compaz', 'x', 'email_notif_mensaje')), true)
    assert.equal(esMarcaInterna(m('Cliente', 'x', 'hola')), false); assert.equal(esMarcaInterna(m('Compaz', 'x', 'Se abrió el chat para coordinar')), false)
    const d = agruparChat([m('Compaz', '2026-11-10T15:00:00Z', 'plan:quincenal'), m('Compaz', '2026-11-10T15:01:00Z', 'Se abrió el chat')], ahora)
    assert.equal(d[0].bloques[0].lineas.length, 1)
  })
  test('las etiquetas dicen Hoy, Ayer o el día escrito', () => {
    assert.equal(etiquetaDia('2026-11-10', ahora), 'Hoy'); assert.equal(etiquetaDia('2026-11-09', ahora), 'Ayer'); assert.match(etiquetaDia('2026-11-02', ahora), /lunes.*2.*noviembre/)
  })
})

describe('el caso de un cliente', () => {
  test('los 30 estados del portal tienen su frase y a quién le toca', () => {
    for (const c of CODIGOS_ESTADO) { const x = SITUACION[c]; assert.ok(x && x.que.length >= 15 && x.que.length <= 120, c); assert.ok(x.espera in ETIQUETA_ESPERA, c) }
    assert.equal(Object.keys(SITUACION).length, CODIGOS_ESTADO.length)
  })
  test('el caso dice la situación, quién se mueve, la etapa y la línea de tiempo', async () => {
    const c = mkCompita({ nombre: 'Rosa' } as any), cli = mkCliente({ nombre: 'Ana' } as any)
    mkSolicitud(cli, c, { estado: 'pendiente', created_at: new Date(Date.now() - 30 * 3600_000).toISOString() })
    const k = (await casoDeCliente(actor('admin'), cli.id))!
    assert.equal(k.nombre, 'Ana'); assert.equal(k.etapa, 'Solicitud'); assert.equal(k.urgencia, 'rojo'); assert.equal(k.espera, 'compita'); assert.match(k.que, /entrevista/)
    assert.equal(k.compita?.startsWith('Rosa'), true); assert.ok(k.linea.length >= 1)
    assert.equal(await casoDeCliente(actor('admin'), '00000000-0000-0000-0000-000000000000'), null)
  })
  test('la fila de Seguimiento tiene un solo destino (el caso) y no enlaces anidados', () => {
    const f = readFileSync('components/panel/Seguimiento.tsx', 'utf8'); assert.match(f, /enlace\(\{ caso: p\.id \}\)/); assert.doesNotMatch(f, /persona: `/)
  })
  test('el id del caso de la dirección se sanea', () => { assert.equal(leerCasoUrl("x' or 1=1"), null); assert.equal(leerCasoUrl(undefined), null); assert.equal(leerCasoUrl('12345678-aaaa'), '12345678-aaaa') })
})

describe('guardias de código', () => {
  test('el visor de chat y el diálogo del navegador no importan código de servidor', () => {
    for (const f of ['components/panel/VerChat.tsx', 'components/panel/MotivoDialog.tsx']) {
      const src = readFileSync(f, 'utf8'); assert.doesNotMatch(src, /supabase-server|lib\/panel-chat'|lib\/permisos'|\.from\(/, f)
    }
  })
  test('la página conecta Seguimiento, Visitas y el chat con su permiso', () => {
    const p = readFileSync('app/panel/page.tsx', 'utf8'); assert.match(p, /listarSeguimiento/); assert.match(p, /listarVisitas/); assert.match(p, /permisos\.chats === true/)
  })
})
