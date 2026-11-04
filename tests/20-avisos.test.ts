/* eslint-disable */
// Avisos con registro (lib/avisos.ts): guarda, envía, reintenta, no duplica y nunca rompe el flujo.
import { db, net, limpiar, mkCompita, mkCliente, ahoraMas } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { notificar, reintentarAviso, registrarAccion, MAX_INTENTOS } from '@/lib/avisos'

beforeEach(limpiar)

function escenario(o: { telegram?: boolean } = {}) {
  const cliente = mkCliente({ nombre: 'Carolina Pérez' })
  const compita = mkCompita({ nombre: 'María Fuentes', ...(o.telegram === false ? { telegram_chat_id: null } : {}) })
  const solicitud = db.seed('solicitudes', {
    cliente_id: cliente.id, compita_id: compita.id, mensaje: 'Mi mamá vive sola en Chacao', estado: 'pendiente',
    slots_propuestos: [ahoraMas(120), ahoraMas(240), ahoraMas(360)],
  })
  const pedido = {
    plantilla: 'solicitud_nueva' as const, canal: 'telegram' as const,
    destinatario: { tipo: 'compita' as const, id: compita.id },
    variables: { solicitudId: solicitud.id },
    entidad: 'solicitud' as const, entidadId: solicitud.id, paso: 5, plazoAccionMin: 360,
  }
  return { cliente, compita, solicitud, pedido }
}

describe('notificar', () => {
  test('guarda el aviso, lo envía por Telegram con botones y anota el resultado', async () => {
    const { compita, pedido } = escenario()
    const r = await notificar(pedido)
    assert.equal(r.ok, true)
    assert.equal(r.estado, 'enviado')
    assert.equal(net.tg.length, 1)
    assert.equal(net.tg[0].chat, compita.telegram_chat_id)
    assert.match(net.tg[0].text, /Carolina Pérez/)
    assert.match(net.tg[0].text, /quiere conocerte/)
    assert.equal(net.tg[0].markup.inline_keyboard.length, 4) // 3 horarios + "No puedo atender"
    const fila = db.rows('avisos')[0]
    assert.equal(fila.estado, 'enviado')
    assert.equal(fila.intentos, 1)
    assert.ok(fila.ultimo_intento_en)
    assert.ok(fila.plazo_accion_hasta, 'guarda hasta cuándo se espera la acción')
    assert.equal(fila.accion_en, null)
    assert.equal(fila.paso, 5)
  })

  test('no guarda en el aviso datos de contacto ni el token de respuesta', async () => {
    const { compita, solicitud, pedido } = escenario()
    await notificar(pedido)
    const guardado = JSON.stringify(db.rows('avisos')[0])
    assert.ok(!guardado.includes(String(compita.telegram_chat_id)), 'el chat de Telegram no se guarda')
    assert.ok(!guardado.includes(String(solicitud.token_respuesta)), 'el token no se guarda')
  })

  test('idempotencia: el mismo hecho no se avisa dos veces', async () => {
    const { pedido } = escenario()
    await notificar(pedido)
    const r2 = await notificar(pedido)
    assert.equal(r2.estado, 'duplicado')
    assert.equal(net.tg.length, 1)
    assert.equal(db.rows('avisos').length, 1)
  })

  test('si Telegram falla: no lanza, queda fallido con el error; luego se reintenta y llega', async () => {
    const { compita, pedido } = escenario()
    net.tgFailFor.add(String(compita.telegram_chat_id))
    const r = await notificar(pedido)
    assert.equal(r.ok, false)
    assert.equal(r.estado, 'fallido')
    const fila = db.rows('avisos')[0]
    assert.equal(fila.estado, 'fallido')
    assert.equal(fila.intentos, 1)
    assert.ok(fila.error, 'guarda el motivo')

    net.tgFailFor.clear()
    const r2 = await reintentarAviso(fila.id)
    assert.equal(r2.estado, 'enviado')
    assert.equal(db.rows('avisos')[0].intentos, 2)
    assert.equal(net.tg.length, 1)
  })

  test('compita sin Telegram vinculado: queda fallido sin intentar enviar', async () => {
    const { pedido } = escenario({ telegram: false })
    const r = await notificar(pedido)
    assert.equal(r.estado, 'fallido')
    assert.equal(r.error, 'sin Telegram vinculado')
    assert.equal(net.tg.length, 0)
  })

  test('si la solicitud ya no está pendiente, el aviso se cancela y no se envía', async () => {
    const { solicitud, pedido } = escenario()
    solicitud.estado = 'aceptada'
    const r = await notificar(pedido)
    assert.equal(r.estado, 'cancelado')
    assert.equal(net.tg.length, 0)
    assert.equal(db.rows('avisos')[0].estado, 'cancelado')
  })

  test('si la base no deja guardar el registro, igual se envía', async () => {
    const { pedido } = escenario()
    db.fail['avisos:insert'] = 1
    const r = await notificar(pedido)
    assert.equal(r.ok, true)
    assert.equal(r.avisoId, undefined)
    assert.equal(net.tg.length, 1)
  })

  test('pedidos inválidos devuelven error sin lanzar ni enviar', async () => {
    const { pedido } = escenario()
    assert.equal((await notificar({ ...pedido, plantilla: 'no_existe' as any })).ok, false)
    assert.equal((await notificar({ ...pedido, canal: 'sms' as any })).ok, false) // canal que la plantilla no soporta
    assert.equal((await notificar({ ...pedido, destinatario: { tipo: 'compita' } })).ok, false)
    assert.equal((await notificar({ ...pedido, entidadId: 'sin-visita' })).ok, false)
    assert.equal(net.tg.length, 0)
  })
})

describe('reintentarAviso', () => {
  test('no reintenta un aviso ya enviado', async () => {
    const { pedido } = escenario()
    const r = await notificar(pedido)
    const r2 = await reintentarAviso(r.avisoId!)
    assert.equal(r2.ok, false)
    assert.equal(net.tg.length, 1)
  })

  test('respeta el máximo de intentos', async () => {
    const { compita, pedido } = escenario()
    net.tgFailFor.add(String(compita.telegram_chat_id))
    const r = await notificar(pedido)
    db.rows('avisos')[0].intentos = MAX_INTENTOS
    const r2 = await reintentarAviso(r.avisoId!)
    assert.equal(r2.ok, false)
    assert.match(r2.error!, /máximo/)
  })
})

describe('registrarAccion', () => {
  test('anota la acción en los avisos enviados de ese hecho', async () => {
    const { solicitud, pedido } = escenario()
    await notificar(pedido)
    assert.equal(await registrarAccion({ entidad: 'solicitud', entidadId: solicitud.id }), true)
    assert.ok(db.rows('avisos')[0].accion_en)
  })

  test('si la persona ya actuó, se cancelan los avisos fallidos de ese hecho', async () => {
    const { compita, solicitud, pedido } = escenario()
    net.tgFailFor.add(String(compita.telegram_chat_id))
    await notificar(pedido)
    await registrarAccion({ entidad: 'solicitud', entidadId: solicitud.id })
    const fila = db.rows('avisos')[0]
    assert.equal(fila.estado, 'cancelado')
    net.tgFailFor.clear()
    assert.equal((await reintentarAviso(fila.id)).ok, false, 'un aviso cancelado ya no se reintenta')
  })
})
