/* eslint-disable */
// Lote 4 (tramo 1): dirección por cita. El cliente la registra; el compita la recibe 3 horas antes por Telegram, nunca el
// teléfono del contacto; si falta, se avisa y se abre una tarea; "Voy en camino" avisa al cliente.
import { db, net, limpiar, req, session, mkCliente, mkCompita, mkVisita, tgBtn, tgPara, emailsA, cron, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { GET as dirGet, PUT as dirPut } from '@/app/api/visita/direccion/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { POST as cronEscalera } from '@/app/api/cron/escalera-avisos/route'
import { validarDireccion, entregarDirecciones, entregarDireccionDeVisita } from '@/lib/direccion'
import { limpiarCacheAjustes, setAjuste } from '@/lib/ajustes'

beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const CHAT = '9801'
const como = (u: any) => { session.user = { id: u.id, email: u.email } }
function en(h: number) {
  const ve = new Date(Date.now() + h * 3600_000 - 4 * 3600_000)
  return { fecha_programada: ve.toISOString().slice(0, 10), hora_inicio_programada: ve.toISOString().slice(11, 16) }
}
const buena = (o: any = {}) => ({ direccion: 'Av. Francisco de Miranda, Edif. Sol, piso 3, apto 3B, Chacao', indicaciones: 'Avisar en conserjería', quien_abre: 'Rosa, la vecina', contacto_nombre: 'Rosa Linares', contacto_tel: '+58 414 555 0101', ...o })
function mundo(horas = 48) {
  const compita = mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez' }); const cliente = mkCliente({ nombre: 'Carolina Pérez', email: 'caro@mail.test' })
  const visita = mkVisita(cliente, compita, { estado: 'programada', ...en(horas), personas_en_lugar: ['Familiar'] })
  return { compita, cliente, visita }
}
const guardar = (cli: any, json: any) => { como(cli); return dirPut(req('/api/visita/direccion', { method: 'PUT', json })) }
const mensajesDireccion = () => tgPara(CHAT).filter((m) => /Dirección de tu visita/.test(m.text))

describe('validar la dirección en el servidor', () => {
  test('acepta una dirección completa', () => assert.equal(validarDireccion(buena()).ok, true))
  test('exige dirección, nombre y teléfono del contacto', () => {
    for (const mala of [{ direccion: '' }, { direccion: 'corta' }, { contacto_nombre: '' }, { contacto_tel: '' }, { contacto_tel: '12' }, { contacto_tel: 'abc defg hij' }])
      assert.equal(validarDireccion(buena(mala)).ok, false, JSON.stringify(mala))
  })
  test('teléfonos y correos NO van en la dirección, cómo entrar ni quién abre (tienen su campo)', () => {
    for (const campo of ['direccion', 'indicaciones', 'quien_abre'])
      for (const sucio of ['Llama al +58 414 555 0101 al llegar', 'escríbeme a rosa@mail.com', 'mi whatsapp'])
        { const r = validarDireccion(buena({ [campo]: campo === 'direccion' ? `Av. Miranda, edificio Sol ${sucio}` : sucio })); assert.equal(r.ok, false, `${campo}: ${sucio}`) }
  })
  test('el número del apartamento y del piso no se toma por teléfono', () => assert.equal(validarDireccion(buena({ direccion: 'Calle 5, Edif. Sol, Torre B, piso 12, apto 12-B, Urb. Los Palos Grandes' })).ok, true))
  test('límites de largo', () => { assert.equal(validarDireccion(buena({ direccion: 'x'.repeat(301) })).ok, false); assert.equal(validarDireccion(buena({ indicaciones: 'x'.repeat(201) })).ok, false) })
})

describe('el cliente registra la dirección', () => {
  test('se guarda en SU visita y se puede reutilizar en la siguiente', async () => {
    const { cliente } = mundo()
    assert.equal((await guardar(cliente, buena())).status, 200)
    assert.equal(db.rows('visitas')[0].direccion, buena().direccion); assert.equal(db.rows('visitas')[0].contacto_tel, '+58 414 555 0101')
    como(cliente); assert.equal((await (await dirGet()).json()).data.registrada, true)
    // Siguiente visita: puede reutilizar la anterior
    Object.assign(db.rows('visitas')[0], { estado: 'terminada' }); mkVisita(cliente, db.rows('compitas')[0], { estado: 'pre_visita' })
    const g = (await (await dirGet()).json()).data
    assert.equal(g.registrada, false); assert.equal(g.anterior.direccion, buena().direccion)
  })
  test('validación, sesión y visita ajena', async () => {
    const { cliente } = mundo()
    assert.equal((await guardar(cliente, buena({ contacto_tel: '' }))).status, 400)
    session.user = null; assert.equal((await dirPut(req('/api/visita/direccion', { method: 'PUT', json: buena() }))).status, 401)
    const otro = mkCliente({ email: 'otro@mail.test' }); assert.equal((await guardar(otro, buena())).status, 404, 'sin visita propia no hay nada que guardar')
    assert.equal(db.rows('visitas')[0].direccion ?? null, null, 'la visita de otro no se tocó')
  })
  test('el evento de registro no lleva ni la dirección ni el teléfono', async () => {
    const { cliente } = mundo(); await guardar(cliente, buena())
    const ev = db.rows('eventos').find((e) => e.tipo === 'direccion_registrada')!
    assert.ok(ev); assert.ok(!JSON.stringify(ev.datos ?? {}).includes('Miranda') && !JSON.stringify(ev.datos ?? {}).includes('555'))
  })
})

describe('el compita recibe la dirección 3 horas antes', () => {
  test('antes de la ventana NO la recibe; el chat y la aceptación tampoco la llevan', async () => {
    const { cliente } = mundo(48); await guardar(cliente, buena())
    await entregarDirecciones()
    assert.equal(mensajesDireccion().length, 0)
    assert.equal(tgPara(CHAT).length, 0, 'ni un solo mensaje al compita con la dirección antes de tiempo')
  })

  test('dentro de las 3 horas la recibe por Telegram con su botón, y SIN el teléfono del contacto', async () => {
    const { cliente, visita } = mundo(48); await guardar(cliente, buena()) // la registró con tiempo
    Object.assign(visita, en(2.5)) // y ahora la cita ya está dentro de las 3 horas
    const r = await cronEscalera(cron('/api/cron/escalera-avisos'))
    assert.equal((await r.json()).data.direcciones.enviadas, 1)
    const m = mensajesDireccion()[0]
    assert.ok(m, 'recibió la dirección')
    assert.match(m.text, /Av\. Francisco de Miranda/); assert.match(m.text, /conserjería/); assert.match(m.text, /Rosa, la vecina/); assert.match(m.text, /Rosa Linares/)
    assert.ok(!m.text.includes('555') && !m.text.includes('+58'), 'el teléfono del contacto NUNCA llega al compita')
    assert.match(m.text, /nunca por el chat/); assert.match(m.text, /Compaz nunca te pedirá/, 'lleva la advertencia antifraude')
    assert.match(m.text, /Quién más estará/)
    assert.deepEqual((m.markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data), [`camino:${db.rows('visitas')[0].id}`, 'duda'])
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'direccion_entregada'))
  })

  test('se entrega UNA sola vez aunque el cron corra muchas veces', async () => {
    const { cliente } = mundo(2); await guardar(cliente, buena())
    await entregarDirecciones(); await entregarDirecciones(); await entregarDirecciones()
    assert.equal(mensajesDireccion().length, 1)
  })

  test('si la cita se reagenda a otra hora, la dirección se entrega de nuevo para la nueva', async () => {
    const { cliente } = mundo(2); await guardar(cliente, buena()); await entregarDirecciones()
    Object.assign(db.rows('visitas')[0], en(1))
    await entregarDirecciones()
    assert.equal(mensajesDireccion().length, 2)
  })

  test('el ajuste manda: con 6 horas, a las 5 horas ya se entrega', async () => {
    await setAjuste({ clave: 'direccion_horas_antes', valor: 6, actor: 'admin:a' })
    const { cliente } = mundo(5); await guardar(cliente, buena())
    assert.equal(mensajesDireccion().length, 1)
  })

  test('registrar la dirección cuando la cita ya está dentro de la ventana la entrega en ese momento', async () => {
    const { cliente } = mundo(1)
    const r = await guardar(cliente, buena())
    assert.equal((await r.json()).data.entregada, true); assert.equal(mensajesDireccion().length, 1)
  })

  test('una cita cancelada o ya pasada no recibe una dirección vieja', async () => {
    const { cliente, visita } = mundo(48); await guardar(cliente, buena())
    Object.assign(visita, en(2))
    visita.estado = 'pre_visita'; assert.equal(await entregarDireccionDeVisita(visita.id), 'no_aplica')
    Object.assign(visita, { estado: 'programada', ...en(-5) }); assert.equal(await entregarDireccionDeVisita(visita.id), 'no_aplica')
    assert.equal(mensajesDireccion().length, 0)
  })
})

describe('si el cliente no registró la dirección', () => {
  test('dentro de la ventana: el compita sabe que falta, el cliente recibe un correo y se abre UNA tarea urgente', async () => {
    mundo(2)
    await entregarDirecciones(); await entregarDirecciones()
    assert.match(tgPara(CHAT).at(-1)!.text, /Aún falta la dirección/)
    assert.equal(emailsA('caro@mail.test').filter((e) => /Falta la dirección/.test(e.subject)).length, 1)
    const t = db.rows('admin_flags').filter((f) => f.tipo === 'direccion_faltante')
    assert.equal(t.length, 1); assert.equal(t[0].prioridad, 1)
    assert.ok(avisosAdmin().some((m) => /Falta la dirección/.test(m.text)))
    assert.equal(mensajesDireccion().length, 0)
  })
  test('cuando por fin la registra: se entrega ya y la tarea se resuelve sola', async () => {
    const { cliente } = mundo(2); await entregarDirecciones()
    await guardar(cliente, buena())
    assert.equal(mensajesDireccion().length, 1)
    assert.equal(db.rows('admin_flags').find((f) => f.tipo === 'direccion_faltante')!.resuelto, true)
  })
})

describe('"Voy en camino"', () => {
  test('avisa al cliente por correo una sola vez y deja el evento', async () => {
    const { cliente, visita } = mundo(2); await guardar(cliente, buena())
    await webhook(tgBtn(CHAT, `camino:${visita.id}`)); await webhook(tgBtn(CHAT, `camino:${visita.id}`))
    assert.equal(emailsA('caro@mail.test').filter((e) => /va en camino/.test(e.subject)).length, 1)
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'compita_en_camino'))
    assert.match(tgPara(CHAT).at(-1)!.text, /vas en camino/)
  })
  test('solo el compita de esa visita', async () => {
    const { visita } = mundo(2); mkCompita({ telegram_chat_id: '9811' })
    await webhook(tgBtn('9811', `camino:${visita.id}`))
    assert.equal(emailsA('caro@mail.test').filter((e) => /va en camino/.test(e.subject)).length, 0)
  })
})
