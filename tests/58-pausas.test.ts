/* eslint-disable */
// Pausa de cuenta por compartir contactos: la 1.ª detección solo se censura; la 2.ª en 30 días pausa a la persona hasta que el equipo decida.
import { db, net, limpiar, req, session, mkCliente, mkCompita, mkVisita, tgText, tgPara, emailsA, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { registrarContactoBloqueado, personaPausada, decidirPausa, contarDetecciones, compitasPausadosPorContacto, pausasActivas } from '@/lib/pausas'
import { POST as chat } from '@/app/api/send-message/route'
import { POST as solicitar } from '@/app/api/solicitudes/route'
import { PUT as fecha } from '@/app/api/visita/fecha/route'
import { GET as pausasGet, PATCH as pausasPatch } from '@/app/api/admin/pausas/route'
import { GET as flagsGet } from '@/app/api/admin/flags/route'
import { GET as actividadGet } from '@/app/api/admin/actividad/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { crearSiguienteVisita } from '@/lib/visitas'
import { estadoDelCliente } from '@/lib/estado-cliente'

beforeEach(limpiar)
const CHAT = '9958'
const ahora = new Date()
// Registra una detección y la "envejece" haceMin minutos (los eventos nacen con la hora real).
const detectar = async (rol: 'cliente' | 'compita', id: string, nombre: string, haceMin = 0) => {
  const r = await registrarContactoBloqueado({ rol, personaId: id, nombre, donde: 'el chat' })
  const ev = db.rows('eventos').filter((e) => e.tipo === 'contacto_bloqueado').at(-1)!; ev.creado_en = new Date(Date.now() - haceMin * 60_000).toISOString(); return r
}
const dos = async (rol: 'cliente' | 'compita', id: string, nombre = 'Carlos') => { await detectar(rol, id, nombre, 60); return detectar(rol, id, nombre, 0) }
const eventos = (t: string) => db.rows('eventos').filter((e) => e.tipo === t)
const mundo = () => { const cliente = mkCliente({ nombre: 'Carolina Rojas', email: 'caro@mail.test' }); const compita = mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez' }); return { cliente, compita } }

describe('cuándo se pausa', () => {
  test('la PRIMERA detección solo deja el evento: nada se pausa', async () => {
    const { cliente } = mundo(); assert.equal(await detectar('cliente', cliente.id, 'Carolina'), false)
    assert.equal(await personaPausada('cliente', cliente.id), false); assert.equal(eventos('contacto_bloqueado').length, 1)
  })
  test('la SEGUNDA, separada por más de 5 minutos, pausa a la persona', async () => {
    const { cliente } = mundo(); assert.equal(await dos('cliente', cliente.id), true); assert.equal(await personaPausada('cliente', cliente.id), true)
  })
  test('varias detecciones seguidas (menos de 5 minutos) cuentan como UNA: un mensaje reenviado no pausa', async () => {
    const { cliente } = mundo(); await detectar('cliente', cliente.id, 'C', 3); assert.equal(await detectar('cliente', cliente.id, 'C', 1), false)
    assert.equal(await personaPausada('cliente', cliente.id), false)
  })
  test('una detección de hace más de 30 días ya no cuenta', async () => {
    const { cliente } = mundo(); await detectar('cliente', cliente.id, 'C', 31 * 1440); assert.equal(await detectar('cliente', cliente.id, 'C'), false)
  })
  test('contarDetecciones: separación mínima exacta', () => { assert.equal(contarDetecciones(['2026-11-10T10:00:00Z', '2026-11-10T10:04:59Z']), 1); assert.equal(contarDetecciones(['2026-11-10T10:00:00Z', '2026-11-10T10:05:00Z']), 2) })
  test('el cliente y el compita se cuentan por separado y no se mezclan', async () => {
    const { cliente, compita } = mundo(); await detectar('cliente', cliente.id, 'C', 60); assert.equal(await detectar('compita', compita.id, 'M'), false)
  })
  test('ya en pausa no se duplica la pausa ni la tarea', async () => {
    const { cliente } = mundo(); await dos('cliente', cliente.id); await detectar('cliente', cliente.id, 'C', 0)
    assert.equal(db.rows('pausas_contacto').length, 1); assert.equal(db.rows('admin_flags').filter((f) => f.tipo === 'cuenta_pausada').length, 1)
  })
})

describe('qué pasa con el cliente en pausa', () => {
  test('recibe un correo claro y el equipo una tarea, sin bloquearlo', async () => {
    const { cliente } = mundo(); await dos('cliente', cliente.id)
    assert.ok(emailsA('caro@mail.test').some((e) => /en pausa/.test(e.subject)))
    const t = db.rows('admin_flags').find((f) => f.tipo === 'cuenta_pausada')!; assert.match(t.nota, /segunda|2\.ª vez/i); assert.match(t.nota, /reactivar, dar otra oportunidad o bloquear/)
    assert.notEqual(db.rows('usuarios').find((u) => u.id === cliente.id)!.plan, 'bloqueado', 'no se bloquea sola')
  })
  test('no puede escribir en el chat (403 con explicación) ni se guarda el mensaje', async () => {
    const { cliente, compita } = mundo(); mkVisita(cliente, compita, { estado: 'pre_visita' }); await dos('cliente', cliente.id)
    session.user = { id: cliente.id, email: cliente.email } as any
    const r = await chat(req('/api/send-message', { json: { contenido: 'Hola, ¿cómo va todo?' } })); assert.equal(r.status, 403); assert.match((await r.json()).error, /en pausa/)
    assert.equal(db.rows('mensajes').length, 0)
  })
  test('no puede enviar solicitudes ni agendar visitas, y el portal lo dice', async () => {
    const { cliente, compita } = mundo(); await dos('cliente', cliente.id); session.user = { id: cliente.id, email: cliente.email } as any
    const r = await solicitar(req('/api/solicitudes', { json: { compita_id: compita.id, tipo: 'directa', que: 'Compañía y conversación', lugar_privado: false } })); const jr = await r.json(); assert.equal(r.status, 403, JSON.stringify(jr)); assert.match(jr.error, /en pausa/)
    assert.equal(db.rows('solicitudes').length, 0)
    const v = mkVisita(cliente, compita, { estado: 'pre_visita' })
    const rf = await fecha(req('/api/visita/fecha', { method: 'PUT', json: { visita_id: v.id, fecha_programada: new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10), hora_inicio: '09:00', hora_fin: '10:00' } })); assert.equal(rf.status, 403)
    assert.equal((await estadoDelCliente(cliente.id, ahora)).codigo, 'cuenta_pausada')
  })
  test('crear la siguiente visita se rechaza con su mensaje', async () => {
    const { cliente, compita } = mundo(); Object.assign(cliente, { compita_id: compita.id }); mkVisita(cliente, compita, { estado: 'terminada' }); await dos('cliente', cliente.id)
    const r: any = await crearSiguienteVisita(cliente.id); assert.equal(r.ok, false); assert.equal(r.motivo, 'cuenta_pausada'); assert.match(r.mensaje, /en pausa/)
  })
  test('una visita EN CURSO no se interrumpe por la pausa (la seguridad va primero)', async () => {
    const { cliente, compita } = mundo(); const v = mkVisita(cliente, compita, { estado: 'en_curso' }); await dos('cliente', cliente.id)
    assert.equal(db.rows('visitas').find((x) => x.id === v.id)!.estado, 'en_curso')
  })
  test('la tarea avisa cuántas visitas programadas o por agendar tiene', async () => {
    const { cliente, compita } = mundo(); mkVisita(cliente, compita, { estado: 'programada', fecha_programada: '2099-01-10' }); await dos('cliente', cliente.id)
    assert.match(db.rows('admin_flags').find((f) => f.tipo === 'cuenta_pausada')!.nota, /1 visita\(s\)/)
  })
})

describe('el equipo se entera en el panel de administración', () => {
  const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } as any }
  test('al pausar a alguien aparece una TAREA en Atención con su nombre, el motivo y qué decidir', async () => {
    const { cliente } = mundo(); await dos('cliente', cliente.id, 'Carolina Rojas'); admin()
    const tareas = (await (await flagsGet(req('/api/admin/flags'))).json()).data as any[]
    const t = tareas.find((x) => x.tipo === 'cuenta_pausada'); assert.ok(t, 'la tarea llega a la bandeja')
    assert.match(t.entidad_nombre, /Cuenta en pausa: Carolina Rojas/); assert.equal(t.entidad_id, cliente.id); assert.equal(t.resuelto, false)
    assert.match(t.nota, /Carolina Rojas/); assert.match(t.nota, /reactivar, dar otra oportunidad o bloquear/)
  })
  test('y queda en el registro de Actividad (lo que pasó, en orden)', async () => {
    const { cliente } = mundo(); await dos('cliente', cliente.id, 'Carolina Rojas'); admin()
    const filas = (await (await actividadGet(req('/api/admin/actividad?dias=1'))).json()).data.filas as any[]
    assert.ok(filas.some((f) => f.nivel === 'tarea' && /Cuenta en pausa por compartir contactos/.test(f.resumen)))
  })
  test('lo mismo cuando se pausa a un compita; y al decidir queda anotado en Actividad quién decidió', async () => {
    const { compita } = mundo(); await dos('compita', compita.id, 'María Pérez'); admin()
    assert.ok(((await (await flagsGet(req('/api/admin/flags'))).json()).data as any[]).some((x) => x.tipo === 'cuenta_pausada' && x.entidad_tipo === 'compita'))
    await pausasPatch(req('/api/admin/pausas', { method: 'PATCH', json: { id: db.rows('pausas_contacto')[0].id, decision: 'reactivar' } }))
    const filas = (await (await actividadGet(req('/api/admin/actividad?dias=1'))).json()).data.filas as any[]
    assert.ok(filas.some((f) => /decidió sobre una cuenta en pausa \(compita\): reactivar/.test(f.resumen)))
  })
  test('el equipo ve el aviso aunque nadie lo esté mirando en Telegram: no depende del timbre', async () => {
    const { cliente } = mundo(); net.tg.length = 0; await dos('cliente', cliente.id)
    assert.ok(db.rows('actividad_admin').some((a) => a.categoria === 'cuenta_pausada' && a.nivel === 'tarea'))
  })
})

describe('qué pasa con el compita en pausa', () => {
  test('recibe un aviso por Telegram, no se ofrece en el listado y no recibe solicitudes', async () => {
    const { cliente, compita } = mundo(); await dos('compita', compita.id, 'María')
    assert.ok(tgPara(CHAT).some((m) => /Tu cuenta está en pausa/.test(m.text)))
    assert.ok((await compitasPausadosPorContacto([compita.id])).has(compita.id))
    session.user = { id: cliente.id, email: cliente.email } as any
    const r = await solicitar(req('/api/solicitudes', { json: { compita_id: compita.id, tipo: 'directa', que: 'Compañía y conversación', lugar_privado: false } })); assert.equal(r.status, 400); assert.equal((await r.json()).error, 'Este compita no está disponible', 'sin dar detalles')
  })
  test('el chat se cierra para el cliente sin revelar el motivo, y el compita tampoco puede escribir por Telegram', async () => {
    const { cliente, compita } = mundo(); mkVisita(cliente, compita, { estado: 'programada', fecha_programada: '2099-01-10' }); await dos('compita', compita.id, 'María')
    session.user = { id: cliente.id, email: cliente.email } as any
    const r = await chat(req('/api/send-message', { json: { contenido: 'Hola María' } })); assert.equal(r.status, 403); const m = (await r.json()).error; assert.match(m, /no está disponible/); assert.doesNotMatch(m, /pausa|contacto|compart/i)
    net.tg.length = 0; await webhook(tgText(CHAT, 'Ya voy para allá')); assert.match(tgPara(CHAT).at(-1)!.text, /en pausa/); assert.equal(db.rows('mensajes').length, 0)
  })
  test('si el CLIENTE está pausado, el compita ve que el chat no está disponible (sin el motivo)', async () => {
    const { cliente, compita } = mundo(); mkVisita(cliente, compita, { estado: 'programada', fecha_programada: '2099-01-10' }); await dos('cliente', cliente.id)
    net.tg.length = 0; await webhook(tgText(CHAT, 'Ya voy para allá')); const t = tgPara(CHAT).at(-1)!.text; assert.match(t, /no está disponible/); assert.doesNotMatch(t, /pausa|contacto/i)
  })
})

describe('el equipo decide', () => {
  const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } as any }
  const decidir = (id: string, decision: string) => pausasPatch(req('/api/admin/pausas', { method: 'PATCH', json: { id, decision } }))
  test('la lista trae a quien está en pausa con su nombre y sus visitas abiertas', async () => {
    const { cliente, compita } = mundo(); mkVisita(cliente, compita, { estado: 'pre_visita' }); await dos('cliente', cliente.id, 'Carolina Rojas'); admin()
    const l = (await (await pausasGet()).json()).data; assert.equal(l.length, 1); assert.equal(l[0].nombre, 'Carolina Rojas'); assert.equal(l[0].visitas_abiertas, 1); assert.equal(l[0].rol, 'cliente')
  })
  test('REACTIVAR: vuelve a poder usar todo, recibe un correo, se cierra la tarea y queda registrado quién', async () => {
    const { cliente } = mundo(); await dos('cliente', cliente.id); admin(); const id = db.rows('pausas_contacto')[0].id
    assert.equal((await decidir(id, 'reactivar')).status, 200)
    assert.equal(await personaPausada('cliente', cliente.id), false); assert.ok(emailsA('caro@mail.test').some((e) => /se reactivó/.test(e.subject)))
    assert.ok(db.rows('admin_flags').filter((f) => f.tipo === 'cuenta_pausada').every((f) => f.resuelto))
    const p = db.rows('pausas_contacto')[0]; assert.equal(p.decision, 'reactivar'); assert.equal(p.decidida_por, 'admin@compaz.test'); assert.ok(p.decidida_en)
    assert.equal((await decidir(id, 'reactivar')).status, 404, 'no se decide dos veces')
  })
  test('OTRA OPORTUNIDAD: se reactiva con advertencia por escrito; si reincide, se pausa de nuevo MARCADO como reincidente (no se bloquea sola)', async () => {
    const { cliente } = mundo(); await dos('cliente', cliente.id); admin(); await decidir(db.rows('pausas_contacto')[0].id, 'otra_oportunidad')
    assert.ok(emailsA('caro@mail.test').some((e) => /con una advertencia/.test(e.subject) && /se bloqueará/.test(e.html)))
    assert.equal(await personaPausada('cliente', cliente.id), false)
    // advertida: la PRÓXIMA detección ya la pausa, aunque sea una sola
    assert.equal(await detectar('cliente', cliente.id, 'C', 0), true)
    const nueva = db.rows('pausas_contacto').find((p) => p.activa)!; assert.equal(nueva.reincidente, true)
    assert.match(db.rows('admin_flags').filter((f) => f.tipo === 'cuenta_pausada').at(-1)!.nota, /lo recomendable es bloquear/)
    assert.notEqual(db.rows('usuarios').find((u) => u.id === cliente.id)!.plan, 'bloqueado')
  })
  test('REACTIVAR borra la cuenta: una sola detección nueva no la vuelve a pausar', async () => {
    const { cliente } = mundo(); await dos('cliente', cliente.id); admin(); await decidir(db.rows('pausas_contacto')[0].id, 'reactivar')
    db.rows('pausas_contacto')[0].decidida_en = new Date(Date.now() - 1000).toISOString()
    assert.equal(await detectar('cliente', cliente.id, 'C', 0), false); assert.equal(await personaPausada('cliente', cliente.id), false)
  })
  test('BLOQUEAR a un cliente: queda bloqueado de verdad', async () => {
    const { cliente } = mundo(); await dos('cliente', cliente.id); admin(); await decidir(db.rows('pausas_contacto')[0].id, 'bloquear')
    assert.equal(db.rows('usuarios').find((u) => u.id === cliente.id)!.plan, 'bloqueado'); assert.equal(await personaPausada('cliente', cliente.id), false)
  })
  test('BLOQUEAR a un compita: sale del sistema', async () => {
    const { compita } = mundo(); await dos('compita', compita.id, 'María'); admin(); await decidir(db.rows('pausas_contacto')[0].id, 'bloquear')
    assert.equal(db.rows('compitas').find((c) => c.id === compita.id)!.estado, 'bloqueado')
  })
  test('REACTIVAR a un compita le avisa por Telegram', async () => {
    const { compita } = mundo(); await dos('compita', compita.id, 'María'); admin(); net.tg.length = 0; await decidir(db.rows('pausas_contacto')[0].id, 'reactivar')
    assert.ok(tgPara(CHAT).some((m) => /se reactivó/.test(m.text)))
  })
  test('una decisión inventada se rechaza (400)', async () => {
    const { cliente } = mundo(); await dos('cliente', cliente.id); admin(); assert.equal((await decidir(db.rows('pausas_contacto')[0].id, 'borrar')).status, 400); assert.equal(await personaPausada('cliente', cliente.id), true)
  })
  test('sin el permiso de cuentas no se ve ni se decide; un cliente no entra', async () => {
    const { cliente } = mundo(); await dos('cliente', cliente.id)
    db.seed('equipo', { correo: 'c@mail.test', nombre: 'c', permisos: { monitorear: true }, activo: true, creado_por: 'admin@compaz.test' }); session.user = { id: 'u-c', email: 'c@mail.test' } as any
    assert.equal((await pausasGet()).status, 403); assert.equal((await decidir(db.rows('pausas_contacto')[0].id, 'reactivar')).status, 403); assert.equal(await personaPausada('cliente', cliente.id), true)
    session.user = { id: 'x', email: 'cli@mail.test' } as any; assert.ok([401, 403].includes((await pausasGet()).status))
  })
})

describe('de punta a punta por el chat web', () => {
  test('dos mensajes con teléfono (separados por 10 minutos) pausan al cliente', async () => {
    const { cliente, compita } = mundo(); mkVisita(cliente, compita, { estado: 'pre_visita' }); session.user = { id: cliente.id, email: cliente.email } as any
    const enviar = () => chat(req('/api/send-message', { json: { contenido: 'Llámame al 305 555 1234 mejor' } }))
    assert.equal((await enviar()).status, 200); await new Promise((r) => setTimeout(r, 60))
    // el segundo intento, 10 minutos después: se envejece el primer evento
    db.rows('eventos').find((e) => e.tipo === 'contacto_bloqueado')!.creado_en = new Date(Date.now() - 10 * 60_000).toISOString()
    assert.equal((await enviar()).status, 200); await new Promise((r) => setTimeout(r, 80))
    assert.equal(await personaPausada('cliente', cliente.id), true)
    assert.equal((await enviar()).status, 403, 'el tercero ya no pasa')
  })
})
