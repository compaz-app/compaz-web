/* eslint-disable */
// Cambio de quién estará en el lugar DESPUÉS de que el compita aceptó: el compita se entera de inmediato y decide
// (sigue / prefiere no ir sin penalización); si no responde a tiempo se abre la tarea "Cambio en el lugar".
import { db, limpiar, req, session, mkCliente, mkCompita, mkVisita, tgBtn, tgPara, emailsA, cron, ahoraMas, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { GET as lugarGet, PUT as lugarPut } from '@/app/api/visita/lugar/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { POST as cronEscalera } from '@/app/api/cron/escalera-avisos/route'
import { POST as enviarMensaje } from '@/app/api/send-message/route'
import { esperaRespuesta, escalarCambiosLugar } from '@/lib/lugar'
import { limpiarCacheAjustes, setAjuste } from '@/lib/ajustes'

beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const CHAT = '9701'
const como = (u: any) => { session.user = { id: u.id, email: u.email } }
function en(h: number) {
  const ve = new Date(Date.now() + h * 3600_000 - 4 * 3600_000)
  return { fecha_programada: ve.toISOString().slice(0, 10), hora_inicio_programada: ve.toISOString().slice(11, 16) }
}
// Una visita programada de un lugar privado donde el compita vio "1 familiar y 1 vecino" al aceptar.
function mundo(horas = 48, personasSolicitud: string[] | null = ['Familiar', 'Vecino o vecina']) {
  const compita = mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez' }); const cliente = mkCliente({ nombre: 'Carolina Pérez', email: 'caro@mail.test' })
  db.seed('solicitudes', { cliente_id: cliente.id, compita_id: compita.id, mensaje: 'x', estado: 'aceptada', tipo: 'directa', lugar_privado: personasSolicitud !== null, personas_en_lugar: personasSolicitud })
  const visita = mkVisita(cliente, compita, { estado: 'programada', ...en(horas) })
  return { compita, cliente, visita }
}
const cambiar = (cli: any, json: any) => { como(cli); return lugarPut(req('/api/visita/lugar', { method: 'PUT', json })) }
const filaVisita = () => db.rows('visitas')[0]
const botones = (m: any) => (m?.markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data)

describe('el cliente cambia quién estará', () => {
  test('lo que ve el cliente: la lista que el compita vio al aceptar', async () => {
    const { cliente } = mundo(); como(cliente)
    const d = (await (await lugarGet()).json()).data
    assert.deepEqual(d.personas_en_lugar, ['Familiar', 'Vecino o vecina']); assert.equal(d.ultimo_cambio, null)
  })

  test('el compita recibe AL INSTANTE el aviso con la lista de antes y la de ahora, con sus dos botones', async () => {
    const { cliente } = mundo()
    const r = await cambiar(cliente, { personas_en_lugar: ['Familiar', 'Vecino o vecina', 'Amigo o amiga'] })
    assert.equal(r.status, 200); const d = (await r.json()).data; assert.equal(d.cambio, true); assert.equal(d.avisado, true)
    const m = tgPara(CHAT).at(-1)!
    assert.match(m.text, /Cambió quién estará/); assert.match(m.text, /Antes:/); assert.match(m.text, /Ahora:/)
    assert.match(m.text, /1 amigo o amiga/i)
    const c = db.rows('cambios_lugar')[0]
    assert.deepEqual(botones(m), [`lugar:ok:${c.id}`, `lugar:no:${c.id}`])
    assert.deepEqual(filaVisita().personas_en_lugar, ['Familiar', 'Vecino o vecina', 'Amigo o amiga'])
    assert.equal(c.estado, 'pendiente')
    const ev = db.rows('eventos').find((e) => e.tipo === 'lugar_personas_cambiadas')!
    assert.equal(ev.actor, `cliente:${cliente.id}`); assert.equal(ev.datos.respuesta, 'pendiente'); assert.match(ev.datos.antes, /vecino/i)
  })

  test('"Nadie más" también se avisa, y repetir la misma lista no avisa de nuevo', async () => {
    const { cliente } = mundo()
    assert.equal((await (await cambiar(cliente, { nadie_mas: true })).json()).data.cambio, true)
    assert.match(tgPara(CHAT).at(-1)!.text, /Nadie más/)
    const antes = tgPara(CHAT).length
    assert.equal((await (await cambiar(cliente, { nadie_mas: true })).json()).data.cambio, false)
    assert.equal(tgPara(CHAT).length, antes, 'sin cambio no hay aviso')
    assert.equal(db.rows('cambios_lugar').length, 1)
  })

  test('el orden de la lista no es un cambio', async () => {
    const { cliente } = mundo()
    assert.equal((await (await cambiar(cliente, { personas_en_lugar: ['Vecino o vecina', 'Familiar'] })).json()).data.cambio, false)
  })

  test('validación en el servidor: sin lista, tipos inventados, o lista y "nadie más" a la vez', async () => {
    const { cliente } = mundo()
    for (const mala of [{}, { personas_en_lugar: [] }, { personas_en_lugar: ['Un extraño'] }, { personas_en_lugar: ['Familiar'], nadie_mas: true }, { personas_en_lugar: 'Familiar' }])
      assert.equal((await cambiar(cliente, mala)).status, 400, JSON.stringify(mala))
    assert.equal(db.rows('cambios_lugar').length, 0)
    assert.deepEqual(filaVisita().personas_en_lugar ?? null, null, 'la visita no se tocó')
  })

  test('un segundo cambio mientras el primero espera lo sustituye: el compita decide sobre la lista MÁS reciente', async () => {
    const { cliente } = mundo()
    await cambiar(cliente, { nadie_mas: true })
    await cambiar(cliente, { personas_en_lugar: ['Familiar', 'Familiar'] })
    const estados = db.rows('cambios_lugar').map((c) => c.estado).sort()
    assert.deepEqual(estados, ['pendiente', 'sustituido'])
    const viva = db.rows('cambios_lugar').find((c) => c.estado === 'pendiente')!
    assert.deepEqual(botones(tgPara(CHAT).at(-1)), [`lugar:ok:${viva.id}`, `lugar:no:${viva.id}`])
  })

  test('sin visita próxima, 404; sin sesión, 401; y un lugar no privado no muestra nada que cambiar', async () => {
    const solo = mkCliente(); como(solo)
    assert.equal((await cambiar(solo, { nadie_mas: true })).status, 404)
    session.user = null; assert.equal((await lugarGet()).status, 401)
    limpiar(); const { cliente } = mundo(48, null); como(cliente)
    assert.equal((await (await lugarGet()).json()).data.personas_en_lugar, null)
  })

  test('si no se le puede avisar al compita por Telegram, el cambio igual queda y el equipo debe verlo ya', async () => {
    const { cliente } = mundo(); const { net } = await import('./harness'); net.tgFailFor.add(CHAT)
    const d = (await (await cambiar(cliente, { nadie_mas: true })).json()).data
    assert.equal(d.cambio, true); assert.equal(d.avisado, false)
    assert.equal(await escalarCambiosLugar(), 1, 'se escala sin esperar')
    assert.ok(db.rows('admin_flags').some((f) => f.tipo === 'cambio_lugar'))
  })
})

describe('el compita responde', () => {
  async function conCambio(horas = 48) {
    const m = mundo(horas); await cambiar(m.cliente, { nadie_mas: true })
    return { ...m, cambio: db.rows('cambios_lugar')[0] }
  }

  test('"Sigo con la visita": queda registrado, el cliente se entera y la visita no se toca', async () => {
    const { cliente, cambio } = await conCambio()
    await webhook(tgBtn(CHAT, `lugar:ok:${cambio.id}`))
    assert.equal(db.rows('cambios_lugar')[0].estado, 'sigue')
    assert.equal(filaVisita().estado, 'programada')
    assert.ok(emailsA('caro@mail.test').some((e) => /confirmó que sigue/.test(e.subject)))
    assert.match(tgPara(CHAT).at(-1)!.text, /Seguimos con la visita/)
    const ev = db.rows('eventos').filter((e) => e.tipo === 'lugar_personas_cambiadas')
    assert.deepEqual(ev.map((e) => e.datos.respuesta), ['pendiente', 'sigue'])
    assert.equal(ev[1].actor, `compita:${cambio.compita_id}`)
    como(cliente); assert.equal((await (await lugarGet()).json()).data.ultimo_cambio.estado, 'sigue')
  })

  test('"Prefiero no ir": SIN penalización, la visita vuelve a coordinación y el cliente puede elegir otro horario o compita sin costo', async () => {
    const { compita, cambio } = await conCambio()
    await webhook(tgBtn(CHAT, `lugar:no:${cambio.id}`))
    assert.equal(db.rows('cambios_lugar')[0].estado, 'no_va')
    assert.equal(filaVisita().estado, 'pre_visita'); assert.equal(filaVisita().fecha_programada ?? null, null)
    const c = db.rows('cancelaciones')[0]
    assert.equal(c.cancelado_por, 'compita'); assert.equal(c.justificada, true, 'queda justificada: no cuenta en su contra')
    const { resumenCancelacionesCompita } = await import('@/lib/cancelaciones')
    assert.equal((await resumenCancelacionesCompita(compita.id)).cuentanContra, 0)
    const correo = emailsA('caro@mail.test').find((e) => /prefirió no ir/.test(e.subject))!
    assert.ok(correo); assert.match(correo.html, /sin costo/)
    assert.ok(avisosAdmin().some((m) => /prefirió no ir/.test(m.text)))
  })

  test('muchos "prefiero no ir" nunca la llevan a pausa (no es una cancelación tardía suya)', async () => {
    const { compita } = mundo(2)
    const { resumenCancelacionesCompita } = await import('@/lib/cancelaciones')
    for (let i = 0; i < 4; i++) {
      await cambiar(db.rows('usuarios')[0], i % 2 ? { nadie_mas: true } : { personas_en_lugar: ['Familiar'] })
      const c = db.rows('cambios_lugar').find((x) => x.estado === 'pendiente')!
      await webhook(tgBtn(CHAT, `lugar:no:${c.id}`))
      Object.assign(filaVisita(), { estado: 'programada', ...en(2) })
    }
    assert.equal((await resumenCancelacionesCompita(compita.id)).nivel, 'normal')
  })

  test('solo responde el compita dueño, una sola vez', async () => {
    const { cambio } = await conCambio()
    mkCompita({ telegram_chat_id: '9711' })
    await webhook(tgBtn('9711', `lugar:ok:${cambio.id}`))
    assert.equal(db.rows('cambios_lugar')[0].estado, 'pendiente')
    await webhook(tgBtn(CHAT, `lugar:ok:${cambio.id}`))
    await webhook(tgBtn(CHAT, `lugar:no:${cambio.id}`))
    assert.equal(db.rows('cambios_lugar')[0].estado, 'sigue')
    assert.equal(filaVisita().estado, 'programada', 'el segundo toque no cancela nada')
    assert.match(tgPara(CHAT).at(-1)!.text, /Ya respondiste/)
  })
})

describe('si el compita no responde: la tarea "Cambio en el lugar"', () => {
  test('la espera es el 25 % del tiempo que falta, con tope de 6 horas', async () => {
    const ahora = new Date()
    const espera = async (h: number) => Math.round(((await esperaRespuesta(en(h), ahora)).getTime() - ahora.getTime()) / 36e5 * 10) / 10
    assert.ok(Math.abs((await espera(12)) - 3) < 0.2, '12 h → 3 h')
    assert.ok(Math.abs((await espera(100)) - 6) < 0.01, '100 h → tope de 6 h')
    assert.equal(await espera(2), 0, 'falta muy poco (menos de 3 h): el equipo debe actuar ya')
  })

  test('los ajustes mandan', async () => {
    await setAjuste({ clave: 'cambio_lugar_pct', valor: 50, actor: 'admin:a' }); await setAjuste({ clave: 'cambio_lugar_max_horas', valor: 2, actor: 'admin:a' })
    const ahora = new Date()
    assert.ok(Math.abs(((await esperaRespuesta(en(100), ahora)).getTime() - ahora.getTime()) / 36e5 - 2) < 0.01)
  })

  test('antes de que venza no se abre nada; al vencer, UNA tarea con el cambio y si el cliente ya le escribió por el chat', async () => {
    const { cliente } = mundo(48); await cambiar(cliente, { nadie_mas: true })
    assert.equal(await escalarCambiosLugar(), 0)
    assert.equal(db.rows('admin_flags').filter((f) => f.tipo === 'cambio_lugar').length, 0)
    db.rows('cambios_lugar')[0].vence_en = new Date(Date.now() - 1000).toISOString()
    assert.equal(await escalarCambiosLugar(), 1)
    const t = db.rows('admin_flags').filter((f) => f.tipo === 'cambio_lugar')
    assert.equal(t.length, 1); assert.match(t[0].nota, /todavía no le ha escrito/); assert.match(t[0].nota, /Antes:/); assert.equal(t[0].prioridad, 2)
    assert.ok(avisosAdmin().some((m) => /sin respuesta/.test(m.text)))
    assert.equal(await escalarCambiosLugar(), 0, 'no se repite')
    assert.equal(db.rows('admin_flags').filter((f) => f.tipo === 'cambio_lugar').length, 1)
  })

  test('si el cliente escribió por el chat, la tarea lo dice; y con menos de 24 h para la visita es urgente', async () => {
    const { cliente, visita } = mundo(10); await cambiar(cliente, { nadie_mas: true })
    como(cliente)
    const r = await enviarMensaje(req('/api/send-message', { json: { contenido: 'Hola, cambié quién estará' } }))
    assert.equal(r.status, 200)
    db.rows('cambios_lugar')[0].vence_en = new Date(Date.now() - 1000).toISOString()
    await escalarCambiosLugar()
    const t = db.rows('admin_flags').find((f) => f.tipo === 'cambio_lugar')!
    assert.match(t.nota, /YA le escribió/); assert.equal(t.prioridad, 1)
  })

  test('el compita responde tarde, después de la tarea: la tarea se resuelve sola', async () => {
    const { cliente } = mundo(48); await cambiar(cliente, { nadie_mas: true })
    db.rows('cambios_lugar')[0].vence_en = new Date(Date.now() - 1000).toISOString()
    await escalarCambiosLugar()
    await webhook(tgBtn(CHAT, `lugar:ok:${db.rows('cambios_lugar')[0].id}`))
    assert.equal(db.rows('admin_flags').find((f) => f.tipo === 'cambio_lugar')!.resuelto, true)
  })

  test('la escalera real (el cron) también la abre', async () => {
    const { cliente } = mundo(48); await cambiar(cliente, { nadie_mas: true })
    db.rows('cambios_lugar')[0].vence_en = new Date(Date.now() - 1000).toISOString()
    const r = await cronEscalera(cron('/api/cron/escalera-avisos'))
    assert.equal((await r.json()).data.cambiosLugarEscalados, 1)
  })
})
