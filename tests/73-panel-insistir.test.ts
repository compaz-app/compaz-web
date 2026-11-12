/* eslint-disable */
// Bandeja: insistir con un aviso, contactar al sitio de una visita, reintentar un aviso fallido y las etiquetas de las tareas reales.
import { db, net, limpiar, req, session, mkCliente, mkCompita, mkSolicitud, mkVisita, tgPara, ahoraMas } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { claseInsistir, etiquetaDeTarea, ETIQUETA_TIPO, tiposConConteo } from '@/lib/panel-bandeja-tipos'
import { insistirDeTarea, esperaDeReenvio, MAX_REENVIOS } from '@/lib/insistir-aviso'
import { cargarBandeja } from '@/lib/panel-bandeja'
import { revelarContacto } from '@/lib/panel-personas'
import { reintentarAvisoDelEquipo } from '@/lib/panel-estado-acciones'
import { POST as insistirRuta } from '@/app/api/admin/insistir-aviso/route'
import { POST as reintentarRuta } from '@/app/api/admin/reintentar-aviso/route'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'
import type { Actor } from '@/lib/permisos'

beforeEach(limpiar)
const actor = (rol: 'admin' | 'colaborador', p: any = {}): Actor => ({ id: 'u1', correo: rol === 'admin' ? 'admin@compaz.test' : 'luis@compaz.test', rol, permisos: rol === 'admin' ? { ...TODOS } : { ...NINGUNO, ...p } })
const flag = (o: any) => db.seed('admin_flags', { entidad_tipo: 'compita', entidad_id: 'x', entidad_nombre: 'Ana', nota: 'algo', reportado_por: 'escalera automática', resuelto: false, tipo: null, prioridad: 2, created_at: new Date().toISOString(), ...o }) as any
const hace = (min: number) => ahoraMas(-min)
function escenario() {
  const compita = mkCompita({ telegram_chat_id: '960', nombre: 'Lucía' } as any), cli = mkCliente({ nombre: 'Carolina' } as any), sol = mkSolicitud(cli, compita, { estado: 'pendiente' })
  const aviso = db.seed('avisos', { destinatario_tipo: 'compita', destinatario_id: compita.id, canal: 'telegram', plantilla: 'solicitud_nueva', variables: { solicitudId: sol.id }, entidad: 'solicitud', entidad_id: sol.id, paso: 5, estado: 'enviado', intentos: 1, programado_para: hace(300), clave_unica: 'solicitud_nueva:' + sol.id } as any) as any
  return { compita, cli, sol, aviso, tarea: flag({ entidad_id: compita.id }) }
}

describe('qué tareas se pueden insistir y cómo se llaman', () => {
  test('escalera, cambio en el lugar, cita sin confirmar y dirección faltante; lo demás no', () => {
    const t = (o: any) => claseInsistir({ tipo: null, reportado_por: 'x', entidad_tipo: 'cliente', ...o })
    assert.equal(t({ reportado_por: 'escalera automática', entidad_tipo: 'compita' })!.texto, 'Insistir al compita'); assert.equal(t({ reportado_por: 'escalera automática' })!.texto, 'Recordar al cliente')
    assert.equal(t({ tipo: 'cambio_lugar', entidad_tipo: 'visita' })!.destinatario, 'compita'); assert.equal(t({ tipo: 'cita_sin_confirmar' })!.destinatario, 'compita')
    const d = t({ tipo: 'direccion_faltante', entidad_tipo: 'visita' })!; assert.equal(d.texto, 'Recordarle por correo'); assert.equal(d.destinatario, 'cliente')
    assert.equal(t({ tipo: 'emergencia' }), null); assert.equal(t({}), null)
  })
  test('los tipos reales que guardan las otras partes del sistema ya no caen en "Otras"', () => {
    for (const k of ['cambio_lugar', 'cancelacion_tardia', 'direccion_faltante', 'duda_sin_resolver', 'estado_no_reconocido']) assert.ok(ETIQUETA_TIPO[k], k)
    assert.equal(etiquetaDeTarea({ tipo: null, reportado_por: 'escalera automática' }), 'Sin respuesta'); assert.equal(etiquetaDeTarea({ tipo: null, reportado_por: 'otro' }), 'Otras')
    const l = [flag({}), flag({ tipo: 'cambio_lugar', reportado_por: 'x' })]; assert.deepEqual(tiposConConteo(l as any, 'Todas').map((x) => x.tipo).sort(), ['Cambio en el lugar', 'Sin respuesta', 'Todas'])
  })
})

describe('insistir con un aviso', () => {
  test('reenvía el aviso al compita como un aviso nuevo ligado al original, y la tarea sigue abierta', async () => {
    const { aviso, tarea } = escenario()
    const r = await insistirDeTarea(actor('colaborador', { atender: true }), tarea.id); assert.deepEqual(r, { ok: true, reenvios: 1 })
    assert.equal(tgPara(960).length, 1)
    const nuevo = db.rows('avisos').find((a: any) => a.clave_unica === `reenvio:${aviso.id}:1`)!; assert.equal(nuevo.respaldo_de, aviso.id); assert.equal(nuevo.plantilla, 'solicitud_nueva')
    assert.equal(db.rows('admin_flags').find((f: any) => f.id === tarea.id)!.resuelto, false)
    assert.ok(db.rows('actividad_admin').some((a: any) => a.categoria === 'aviso_reenviado'))
  })
  test('tope: no antes de 30 minutos y máximo 3, con la explicación de por qué', async () => {
    const { aviso, tarea } = escenario(); const c = actor('admin')
    assert.equal((await insistirDeTarea(c, tarea.id)).ok, true)
    const pronto = await insistirDeTarea(c, tarea.id); assert.equal(pronto.ok, false); assert.equal((pronto as any).status, 429); assert.match((pronto as any).espera.porQue, /llena el Telegram/)
    for (let n = 1; n <= 3; n++) { const r = db.rows('avisos').find((a: any) => a.clave_unica === `reenvio:${aviso.id}:${n}`); if (r) r.programado_para = hace(60 * n) }
    assert.equal((await insistirDeTarea(c, tarea.id)).ok, true); for (const r of db.rows('avisos').filter((a: any) => a.respaldo_de === aviso.id)) r.programado_para = hace(120)
    assert.equal((await insistirDeTarea(c, tarea.id)).ok, true)
    const cuarto = await insistirDeTarea(c, tarea.id); assert.equal((cuarto as any).status, 429); assert.match((cuarto as any).error, /máximo/); assert.equal(db.rows('avisos').filter((a: any) => a.respaldo_de === aviso.id).length, MAX_REENVIOS)
  })
  test('sin aviso que reenviar, sin permiso o con una tarea que no es de este tipo: no hace nada', async () => {
    const compita = mkCompita({ telegram_chat_id: '961' } as any); const t = flag({ entidad_id: compita.id })
    assert.equal((await insistirDeTarea(actor('admin'), t.id) as any).status, 404)
    const { tarea } = escenario(); assert.equal((await insistirDeTarea(actor('colaborador', { monitorear: true }), tarea.id) as any).status, 403)
    const e = flag({ tipo: 'emergencia', reportado_por: 'sistema' }); assert.equal((await insistirDeTarea(actor('admin'), e.id) as any).status, 404)
    assert.equal(tgPara(960).length, 0)
  })
  test('un compita sin Telegram vinculado: dice que no se pudo entregar', async () => {
    const { compita, tarea } = escenario(); compita.telegram_chat_id = null
    const r = await insistirDeTarea(actor('admin'), tarea.id); assert.equal(r.ok, false); assert.match((r as any).error, /Telegram vinculado/)
  })
  test('la espera se calcula con lógica pura', () => { assert.equal(esperaDeReenvio({ usados: 0, ultimo: null }), null); assert.ok(esperaDeReenvio({ usados: 1, ultimo: new Date().toISOString() })); assert.ok(esperaDeReenvio({ usados: 3, ultimo: null })) })
  test('la Bandeja ofrece el botón con los reenvíos usados y lo apaga con el tope', async () => {
    const { aviso, tarea } = escenario()
    const a1 = (await cargarBandeja(actor('colaborador', { atender: true })))[0].accion! as any; assert.equal(a1.tipo, 'insistir'); assert.equal(a1.texto, 'Insistir al compita'); assert.equal(a1.reenvios, 0)
    await insistirDeTarea(actor('admin'), tarea.id)
    const a2 = (await cargarBandeja(actor('admin')))[0].accion! as any; assert.equal(a2.tipo, 'bloqueada'); assert.match(a2.motivo, /Ya insististe/)
    db.rows('avisos').forEach((a: any) => { if (a.respaldo_de === aviso.id) a.programado_para = hace(90) })
    assert.equal(((await cargarBandeja(actor('admin')))[0].accion as any).reenvios, 1)
  })
  test('la ruta: 401 sin sesión, 400 con cuerpo malo, 429 con la razón y 200 al reenviar', async () => {
    const { tarea } = escenario(); session.user = null as any
    assert.equal((await insistirRuta(req('/api/admin/insistir-aviso', { method: 'POST', json: { flag_id: tarea.id } }))).status, 401)
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    assert.equal((await insistirRuta(req('/api/admin/insistir-aviso', { method: 'POST', json: { flag_id: "x' or 1=1" } }))).status, 400)
    assert.equal((await insistirRuta(req('/api/admin/insistir-aviso', { method: 'POST', json: { flag_id: tarea.id } }))).status, 200)
    const r = await insistirRuta(req('/api/admin/insistir-aviso', { method: 'POST', json: { flag_id: tarea.id } })); assert.equal(r.status, 429); assert.ok((await r.json()).porQue)
  })
})

describe('contactar al sitio de una visita', () => {
  const visita = () => { const c = mkCompita({} as any), cli = mkCliente({} as any); return mkVisita(cli, c, { estado: 'programada', contacto_nombre: 'Doña Marta', contacto_tel: '+58 412 000 1111' }) as any }
  test('un colaborador necesita motivo; con él recibe el teléfono y queda anotado', async () => {
    const v = visita(); const c = actor('colaborador', { telefonos: true, atender: true })
    assert.equal((await revelarContacto(c, { tipo: 'visita', id: v.id, canal: 'telefono', motivo: undefined })).ok, false); assert.equal(db.rows('actividad_admin').length, 0)
    const r = await revelarContacto(c, { tipo: 'visita', id: v.id, canal: 'telefono', motivo: 'Revisión de calidad de la visita' }) as any
    assert.equal(r.ok, true); assert.equal(r.valor, '+58 412 000 1111'); assert.equal(r.detalle, 'Doña Marta'); assert.match(db.rows('actividad_admin')[0].resumen, /contacto en el sitio/)
  })
  test('la tarea "Nadie abre" ofrece el botón con el permiso de teléfonos y lo apaga sin él', async () => {
    const v = visita(); flag({ entidad_tipo: 'visita', entidad_id: v.id, tipo: 'nadie_abre', reportado_por: 'nadie abre' })
    assert.equal(((await cargarBandeja(actor('admin')))[0].accion as any).tipo, 'sitio'); assert.equal(((await cargarBandeja(actor('colaborador', { atender: true })))[0].accion as any).tipo, 'bloqueada')
  })
})

describe('reintentar un aviso fallido', () => {
  const fallido = (o: any = {}) => { const c = mkCompita({ telegram_chat_id: '970' } as any), cli = mkCliente({} as any), s = mkSolicitud(cli, c, {}); return db.seed('avisos', { destinatario_tipo: 'compita', destinatario_id: c.id, canal: 'telegram', plantilla: 'solicitud_nueva', variables: { solicitudId: s.id }, entidad: 'solicitud', entidad_id: s.id, estado: 'fallido', intentos: 1, error: 'bot bloqueado', programado_para: hace(10), ...o } as any) as any }
  test('un aviso fallido se reenvía y queda anotado', async () => {
    const a = fallido(); const r = await reintentarAvisoDelEquipo(actor('colaborador', { atender: true }), a.id); assert.deepEqual(r, { ok: true, estado: 'enviado' })
    assert.equal(db.rows('avisos')[0].estado, 'enviado'); assert.equal(tgPara(970).length, 1); assert.ok(db.rows('actividad_admin').some((x: any) => x.categoria === 'aviso_reintentado'))
  })
  test('con el máximo de intentos o ya enviado, dice por qué y no manda nada', async () => {
    const a = fallido({ intentos: 5 }); const r = await reintentarAvisoDelEquipo(actor('admin'), a.id); assert.equal((r as any).status, 409); assert.match((r as any).error, /5 veces/)
    const b = fallido({ estado: 'enviado' }); assert.equal((await reintentarAvisoDelEquipo(actor('admin'), b.id) as any).status, 409); assert.equal(tgPara(970).length, 0)
  })
  test('sin permiso se niega y la ruta valida el cuerpo', async () => {
    const a = fallido(); assert.equal((await reintentarAvisoDelEquipo(actor('colaborador', { monitorear: true }), a.id) as any).status, 403)
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    assert.equal((await reintentarRuta(req('/api/admin/reintentar-aviso', { method: 'POST', json: { aviso_id: 'raro' } }))).status, 400)
    assert.equal((await reintentarRuta(req('/api/admin/reintentar-aviso', { method: 'POST', json: { aviso_id: a.id } }))).status, 200)
  })
})

describe('guardias de código', () => {
  test('la pantalla de reintentar no importa código de servidor', () => { assert.doesNotMatch(readFileSync('components/panel/mas/BotonReintentar.tsx', 'utf8'), /supabase-server|lib\/avisos'|lib\/permisos'|\.from\(/) })
})
