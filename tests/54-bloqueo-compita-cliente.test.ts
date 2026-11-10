/* eslint-disable */
// Reportar un problema con un cliente y "no volver con él": motivo de un toque, tarea para el equipo, bloqueo del par en
// solicitudes y visitas nuevas, el cliente nunca ve el motivo, y solo el equipo puede levantarlo.
import { db, net, session, limpiar, req, mkCompita, mkCliente, mkSolicitud, mkVisita, tgText, tgBtn, tgPara, avisosAdmin } from './harness'
import { emailsA } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { POST as crear } from '@/app/api/solicitudes/route'
import { GET as bloqGet, PATCH as bloqPatch } from '@/app/api/admin/bloqueos-compita/route'
import { GET as repGet, PATCH as repPatch, POST as repPost } from '@/app/api/admin/reportes-compita/route'
import { setAjuste, limpiarCacheAjustes } from '@/lib/ajustes'
import { crearSiguienteVisita } from '@/lib/visitas'
import { parBloqueado, reportarCliente, compitasBloqueadosPara, escalarLlamadasVencidas } from '@/lib/bloqueos-compita'

const CHAT = '9954'
beforeEach(limpiar)
const mundo = () => {
  const compita = mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez' })
  const cliente = mkCliente({ nombre: 'Carolina Rojas', email: 'caro@mail.test' })
  mkSolicitud(cliente, compita, { estado: 'aceptada' })
  return { compita, cliente }
}
const btn = (d: string) => webhook(tgBtn(CHAT, d))
const botones = (m: any) => (m?.markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data)
const ultimo = () => tgPara(CHAT).at(-1)!

describe('el flujo en el bot', () => {
  test('Tengo una duda ofrece reportar un problema con un cliente', async () => {
    mundo(); await webhook(tgText(CHAT, '🙋 Tengo una duda'))
    assert.ok(botones(ultimo()).includes('xp'))
  })
  test('paso a paso con un motivo de riesgo: cliente, motivo, cuándo, ¿estás bien?, ¿antes?, no volver; llamada AUTOMÁTICA con plazo', async () => {
    const { compita, cliente } = mundo(); const u = cliente.id
    await btn('xp'); assert.ok(botones(ultimo()).includes(`xp1:${u}`))
    await btn(`xp1:${u}`); assert.ok(botones(ultimo()).includes(`xpm:${u}:pago`))
    await btn(`xpm:${u}:pago`); assert.deepEqual(botones(ultimo()), [`xpw:${u}:pago:d`, `xpw:${u}:pago:l`, `xpw:${u}:pago:p`])
    await btn(`xpw:${u}:pago:d`); assert.deepEqual(botones(ultimo()), [`xpb:${u}:pago:d:s`, `xpb:${u}:pago:d:n`])
    await btn(`xpb:${u}:pago:d:s`); assert.deepEqual(botones(ultimo()), [`xpr:${u}:pago:d:s:s`, `xpr:${u}:pago:d:s:n`])
    await btn(`xpr:${u}:pago:d:s:s`); assert.deepEqual(botones(ultimo()), [`xpn:${u}:pago:d:s:s:s`, `xpn:${u}:pago:d:s:s:n`])
    await btn(`xpn:${u}:pago:d:s:s:s`)   // riesgo: no pregunta si quiere llamada, la lleva siempre
    assert.match(ultimo().text, /No se te volverá a asignar/); assert.match(ultimo().text, /Te llamaremos en las próximas 24 horas/)
    assert.equal(await parBloqueado(compita.id, u), true)
    const r = db.rows('reportes_compita')[0]
    assert.equal(r.motivo, 'pago'); assert.equal(r.cuando, 'durante'); assert.equal(r.esta_bien, true); assert.equal(r.reincidente, true); assert.equal(r.llamar, true)
    const horas = (new Date(r.plazo_llamada).getTime() - new Date(r.creado_en).getTime()) / 3600_000; assert.ok(horas >= 23.9 && horas <= 24.1, `plazo de ${horas} h`)
    const t = db.rows('admin_flags').find((f) => f.entidad_id === compita.id)!
    assert.equal(t.entidad_tipo, 'compita'); assert.match(t.nota, /Llamar al compita antes de/); assert.match(t.nota, /Ya le había pasado antes/); assert.match(t.nota, /Durante la visita/)
  })
  test('un motivo LEVE le pregunta si quiere llamada; si dice que no, NO hay tarea ni llamada, solo queda en Actividad', async () => {
    const { compita, cliente } = mundo(); const u = cliente.id
    await btn(`xpn:${u}:fuera:l:s:n:n`); assert.deepEqual(botones(ultimo()), [`xpv:${u}:fuera:l:s:n:n:s`, `xpv:${u}:fuera:l:s:n:n:n`])
    await btn(`xpv:${u}:fuera:l:s:n:n:n`)
    assert.doesNotMatch(ultimo().text, /llamaremos/)
    assert.equal(db.rows('admin_flags').length, 0, 'sin trabajo para el equipo'); assert.equal(db.rows('reportes_compita')[0].llamar, false)
    assert.ok(db.rows('actividad_admin').some((a) => a.nivel === 'actividad' && /Reporte de María/.test(a.resumen)))
    assert.equal(await parBloqueado(compita.id, u), false)
  })
  test('un motivo leve CON llamada pedida abre la tarea con plazo', async () => {
    const { cliente } = mundo(); const u = cliente.id
    await btn(`xpv:${u}:trato:p:s:n:n:s`)
    assert.match(ultimo().text, /próximas 24 horas/); assert.equal(db.rows('admin_flags').length, 1); assert.equal(db.rows('reportes_compita')[0].llamar, true)
  })
  test('"Necesito ayuda" sube a urgente al instante (sin tope) y lleva llamada aunque el motivo sea leve', async () => {
    const { cliente } = mundo(); const u = cliente.id
    await btn(`xpb:${u}:trato:d:n`); assert.match(tgPara(CHAT).map((m: any) => m.text).join(' '), /Emergencia/)
    await btn(`xpn:${u}:trato:d:n:n:n`)
    assert.ok(net.tg.some((m) => m.chat === '999' && /necesita ayuda/.test(m.text))); assert.equal(db.rows('reportes_compita')[0].llamar, true)
  })
  test('un compita sin trato con nadie no tiene a quién reportar', async () => {
    mkCompita({ telegram_chat_id: CHAT }); await btn('xp')
    assert.match(ultimo().text, /no hay a quién reportar/)
  })
  test('no se puede reportar ni bloquear a un cliente con el que no hubo trato (datos forzados)', async () => {
    const { compita } = mundo(); const ajeno = mkCliente({ email: 'otro@mail.test' })
    await btn(`xpv:${ajeno.id}:fuera:d:s:n:s:s`)
    assert.equal(await parBloqueado(compita.id, ajeno.id), false); assert.equal(db.rows('eventos').filter((x) => x.tipo === 'reporte_cliente').length, 0); assert.equal(db.rows('reportes_compita').length, 0)
    assert.match(ultimo().text, /No pude registrar/)
  })
  test('un motivo inventado se rechaza', async () => {
    const { compita, cliente } = mundo()
    assert.equal((await reportarCliente({ id: compita.id, nombre: 'M' }, cliente.id, { motivo: 'inventado', noVolver: true })).resultado, 'invalido')
    assert.equal(await parBloqueado(compita.id, cliente.id), false)
  })
  test('reportar dos veces no duplica el bloqueo', async () => {
    const { compita, cliente } = mundo()
    await reportarCliente({ id: compita.id, nombre: 'M' }, cliente.id, { motivo: 'trato', noVolver: true }); await reportarCliente({ id: compita.id, nombre: 'M' }, cliente.id, { motivo: 'fuera', noVolver: true })
    assert.equal(db.rows('bloqueos_compita_cliente').length, 1)
  })
  test('"el lugar no era seguro" es urgente para el equipo', async () => {
    const { compita, cliente } = mundo()
    await reportarCliente({ id: compita.id, nombre: 'María Pérez' }, cliente.id, { motivo: 'inseguro', noVolver: false })
    assert.ok(net.tg.some((m) => m.chat === '999' && /Reporte de María/.test(m.text)))
  })
})

describe('el plazo de la llamada: se promete y se cumple', () => {
  const nuevo = async (o: any = {}) => { const { compita, cliente } = mundo(); const t0 = new Date(); await reportarCliente({ id: compita.id, nombre: 'María Pérez' }, cliente.id, { motivo: 'pago', noVolver: false, ...o }, t0); return { compita, cliente, t0 } }
  test('antes del plazo no se alerta; pasado el plazo, UNA alerta urgente aunque el cron corra muchas veces', async () => {
    const { t0 } = await nuevo(); net.tg.length = 0
    assert.equal(await escalarLlamadasVencidas(new Date(t0.getTime() + 23 * 3600_000)), 0); assert.equal(net.tg.filter((m) => m.chat === '999').length, 0)
    assert.equal(await escalarLlamadasVencidas(new Date(t0.getTime() + 25 * 3600_000)), 1)
    assert.equal(await escalarLlamadasVencidas(new Date(t0.getTime() + 26 * 3600_000)), 0)
    assert.equal(net.tg.filter((m) => m.chat === '999' && /Llamada vencida/.test(m.text)).length, 1)
  })
  test('si ya se llamó, no se alerta aunque pase el plazo', async () => {
    const { t0 } = await nuevo(); session.user = { id: 'adm', email: 'admin@compaz.test' }
    const lista = (await (await repGet()).json()).data; assert.equal(lista.length, 1)
    assert.equal((await repPatch(req('/api/admin/reportes-compita', { method: 'PATCH', json: { id: lista[0].id, resultado: 'resuelto' } }))).status, 200)
    net.tg.length = 0; assert.equal(await escalarLlamadasVencidas(new Date(t0.getTime() + 30 * 3600_000)), 0)
  })
  test('el plazo nunca baja de 24 horas: Ajustes rechaza 12 y acepta 48', async () => {
    const bajo = await setAjuste({ clave: 'reporte_llamada_horas', valor: 12, actor: 'admin@compaz.test' }); assert.equal(bajo.ok, false)
    assert.equal((await setAjuste({ clave: 'reporte_llamada_horas', valor: 48, actor: 'admin@compaz.test' })).ok, true)
    const { compita, cliente } = mundo(); limpiarCacheAjustes()
    const r = await reportarCliente({ id: compita.id, nombre: 'M' }, cliente.id, { motivo: 'pago', noVolver: false }); assert.ok(r.plazo && r.plazo.getTime() - Date.now() > 47 * 3600_000)
  })
  test('registrar la llamada guarda quién y qué decidió, cierra la tarea y, si se decidió, levanta el bloqueo', async () => {
    const { compita, cliente } = await nuevo({ noVolver: true }); session.user = { id: 'adm', email: 'admin@compaz.test' }
    assert.equal(await parBloqueado(compita.id, cliente.id), true)
    const id = (await (await repGet()).json()).data[0].id
    assert.equal((await repPatch(req('/api/admin/reportes-compita', { method: 'PATCH', json: { id, resultado: 'levantar_bloqueo' } }))).status, 200)
    const r = db.rows('reportes_compita')[0]; assert.equal(r.llamada_por, 'admin@compaz.test'); assert.equal(r.resultado, 'levantar_bloqueo'); assert.ok(r.llamada_en)
    assert.equal(await parBloqueado(compita.id, cliente.id), false); assert.ok(db.rows('admin_flags').every((f) => f.resuelto))
    assert.equal((await repPatch(req('/api/admin/reportes-compita', { method: 'PATCH', json: { id, resultado: 'resuelto' } }))).status, 404, 'no se registra dos veces')
    assert.equal((await repPatch(req('/api/admin/reportes-compita', { method: 'PATCH', json: { id, resultado: 'inventado' } }))).status, 400)
  })
  test('sin el permiso de atender no se ve ni se registra la llamada', async () => {
    await nuevo(); db.seed('equipo', { correo: 'c@mail.test', nombre: 'c', permisos: { monitorear: true }, activo: true, creado_por: 'admin@compaz.test' })
    session.user = { id: 'u-c', email: 'c@mail.test' }; assert.equal((await repGet()).status, 403)
  })
})

describe('qué pasa con el par bloqueado', () => {
  test('el cliente no puede pedirle una solicitud nueva y NO ve el motivo', async () => {
    const { compita, cliente } = mundo(); await reportarCliente({ id: compita.id, nombre: 'M' }, cliente.id, { motivo: 'trato', noVolver: true })
    session.user = { id: cliente.id, email: cliente.email }
    const antes = db.rows('solicitudes').length
    const r = await crear(req('/api/solicitudes', { json: { compita_id: compita.id, tipo: 'directa', que: 'Compañía y conversación', lugar_privado: false } }))
    assert.equal(r.status, 400); const txt = JSON.stringify(await r.json()); assert.match(txt, /no está disponible/); assert.doesNotMatch(txt, /fuera|trato|reporte|bloque/i)
    assert.equal(db.rows('solicitudes').length, antes)
  })
  test('otro cliente sí puede pedirle, y el bloqueado sí puede pedirle a otro compita', async () => {
    const { compita, cliente } = mundo(); await reportarCliente({ id: compita.id, nombre: 'M' }, cliente.id, { motivo: 'trato', noVolver: true })
    assert.equal((await compitasBloqueadosPara(cliente.id)).has(compita.id), true)
    const otro = mkCliente({ email: 'o@mail.test' }); assert.equal(await parBloqueado(compita.id, otro.id), false)
    assert.equal((await compitasBloqueadosPara(otro.id)).size, 0)
  })
  test('no se le crea una visita siguiente con ese compita', async () => {
    const { compita, cliente } = mundo(); Object.assign(cliente, { compita_id: compita.id })
    mkVisita(cliente, compita, { estado: 'terminada' })
    await reportarCliente({ id: compita.id, nombre: 'M' }, cliente.id, { motivo: 'trato', noVolver: true })
    const r: any = await crearSiguienteVisita(cliente.id)
    assert.equal(r.ok, false); assert.equal(r.motivo, 'compita_no_disponible')
  })
})

describe('el equipo lo levanta', () => {
  test('lista y levanta; después el cliente puede volver a pedir; queda en la actividad', async () => {
    const { compita, cliente } = mundo(); await reportarCliente({ id: compita.id, nombre: 'María Pérez' }, cliente.id, { motivo: 'fuera', noVolver: true })
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    const lista = await (await bloqGet()).json(); assert.equal(lista.data.length, 1)
    assert.equal(lista.data[0].compita_nombre, 'María Pérez'); assert.equal(lista.data[0].motivo, 'Me pidió algo fuera del servicio')
    const r = await bloqPatch(req('/api/admin/bloqueos-compita', { method: 'PATCH', json: { id: lista.data[0].id } })); assert.equal(r.status, 200)
    assert.equal(await parBloqueado(compita.id, cliente.id), false)
    assert.ok(db.rows('actividad_admin').some((a) => /levantado/.test(a.resumen)))
    assert.equal((await bloqPatch(req('/api/admin/bloqueos-compita', { method: 'PATCH', json: { id: lista.data[0].id } }))).status, 404)
  })
  test('un colaborador sin el permiso de atender no puede ni ver ni levantar', async () => {
    const { compita, cliente } = mundo(); await reportarCliente({ id: compita.id, nombre: 'M' }, cliente.id, { motivo: 'fuera', noVolver: true })
    db.seed('equipo', { correo: 'c@mail.test', nombre: 'c', permisos: { monitorear: true }, activo: true, creado_por: 'admin@compaz.test' })
    session.user = { id: 'u-c', email: 'c@mail.test' }
    assert.equal((await bloqGet()).status, 403)
    assert.equal((await bloqPatch(req('/api/admin/bloqueos-compita', { method: 'PATCH', json: { id: 'x' } }))).status, 403)
  })
  test('un cliente cualquiera no entra', async () => {
    session.user = { id: 'cli', email: 'cli@mail.test' }; assert.ok([401, 403].includes((await bloqGet()).status))
  })
})

describe('cancelar lo que sigue abierto entre el par (lo decide el equipo en la llamada)', () => {
  const conAbiertas = async () => {
    const { compita, cliente } = mundo()
    const prog = mkVisita(cliente, compita, { estado: 'programada', fecha_programada: '2099-01-10', hora_inicio_programada: '09:00', hora_fin_programada: '11:00' })
    await reportarCliente({ id: compita.id, nombre: 'María Pérez' }, cliente.id, { motivo: 'pago', noVolver: true })
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    return { compita, cliente, prog, rid: db.rows('reportes_compita')[0].id as string }
  }
  const cancelar = (id: string) => repPost(req('/api/admin/reportes-compita', { json: { id } }))

  test('la lista de llamadas pendientes trae lo abierto con ese cliente', async () => {
    const { prog } = await conAbiertas()
    const d = (await (await repGet()).json()).data[0]
    assert.equal(d.abiertas.visitas[0].id, prog.id); assert.equal(d.abiertas.visitas[0].cancelable, true); assert.equal(d.abiertas.solicitudes.length, 1)
  })
  test('cancela visita programada y solicitud: cancelación justificada, crédito intacto (visita borrada), cliente avisado sin el motivo', async () => {
    const { prog, rid, cliente } = await conAbiertas()
    const r = await cancelar(rid); assert.equal(r.status, 200); assert.deepEqual((await r.json()).data, { visitas: 1, solicitudes: 1 })
    assert.equal(db.rows('visitas').find((v) => v.id === prog.id), undefined)
    assert.equal(db.rows('solicitudes').some((x) => x.estado === 'aceptada' || x.estado === 'pendiente'), false)
    const c = db.rows('cancelaciones')[0]; assert.equal(c.justificada, true); assert.match(c.justificada_por, /admin: admin@compaz.test/); assert.equal(c.cuenta_como_usada, false)
    const correos = emailsA(cliente.email); assert.ok(JSON.stringify(correos).includes('Ya no podremos continuar con tu visita'), 'aviso de la visita'); assert.ok(JSON.stringify(correos).includes('Ya no podremos continuar con tu solicitud'), 'aviso de la solicitud')
    const html = JSON.stringify(correos); assert.doesNotMatch(html, /reporte|pago|bloque|problema|inseguro/i, 'nunca el motivo')
  })
  test('una visita que ya está en curso NO se cancela desde aquí y se avisa que es aparte', async () => {
    const { compita, cliente } = mundo(); mkVisita(cliente, compita, { estado: 'en_curso' })
    await reportarCliente({ id: compita.id, nombre: 'M' }, cliente.id, { motivo: 'pago', noVolver: true }); session.user = { id: 'adm', email: 'admin@compaz.test' }
    const rid = db.rows('reportes_compita')[0].id
    assert.deepEqual((await (await cancelar(rid)).json()).data, { visitas: 0, solicitudes: 1 }); assert.equal(db.rows('visitas').length, 1)
    assert.equal((await (await repGet()).json()).data[0].abiertas.visitas[0].cancelable, false)
  })
  test('una visita de otro cliente con el mismo compita no se toca', async () => {
    const { compita } = mundo(); const otro = mkCliente({ email: 'otro@mail.test' }); const vOtro = mkVisita(otro, compita, { estado: 'programada', fecha_programada: '2099-01-10', hora_inicio_programada: '09:00' })
    const { cliente } = { cliente: db.rows('usuarios')[0] }
    await reportarCliente({ id: compita.id, nombre: 'M' }, cliente.id, { motivo: 'pago', noVolver: true }); session.user = { id: 'adm', email: 'admin@compaz.test' }
    await cancelar(db.rows('reportes_compita')[0].id); assert.ok(db.rows('visitas').some((v) => v.id === vOtro.id))
  })
  test('sin el permiso de atender no se puede cancelar; un reporte inexistente da 404', async () => {
    const { rid } = await conAbiertas()
    assert.equal((await cancelar('00000000-0000-0000-0000-000000000000')).status, 404)
    db.seed('equipo', { correo: 'c@mail.test', nombre: 'c', permisos: { monitorear: true }, activo: true, creado_por: 'admin@compaz.test' }); session.user = { id: 'u-c', email: 'c@mail.test' }
    assert.equal((await cancelar(rid)).status, 403); assert.equal(db.rows('visitas').length, 1)
  })
})
