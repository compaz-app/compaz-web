/* eslint-disable */
// El panel recorta en el servidor lo que cada persona puede ver: contactos con 'telefonos', salas con 'atender'.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { recortarParaActor } from '@/lib/panel-datos'
import { resolverActor } from '@/lib/permisos'

const datos = {
  usuarios: [{ id: 'u1', nombre: 'Ana', email: 'ana@x.test', telefono: '+58412', compita: { nombre: 'Rosa' } }],
  compitas: [{ id: 'c1', nombre: 'Rosa', email: 'rosa@x.test', codigo: 'ABC123', telegram_chat_id: '999', telefono: null }],
  solicitudes: [{ id: 's1', room_url: 'https://sala/x', usuarios: { nombre: 'Ana', email: 'ana@x.test' } }],
}
const colab = (permisos: Record<string, boolean>) => resolverActor('id', 'c@x.test', { correo: 'c@x.test', activo: true, permisos })!
const raiz = () => { process.env.ADMIN_EMAILS = 'root@x.test'; return resolverActor('id', 'root@x.test', null)! }

describe('recortarParaActor', () => {
  test('la raíz lo ve todo', () => {
    assert.deepEqual(recortarParaActor(raiz(), datos), datos)
  })
  test('sin telefonos: no viaja correo, teléfono, código ni Telegram, pero sí si tiene o no', () => {
    process.env.ADMIN_EMAILS = 'root@x.test'
    const r = recortarParaActor(colab({ monitorear: true, atender: true }), datos)
    const s = JSON.stringify(r)
    for (const secreto of ['ana@x.test', '+58412', 'rosa@x.test', 'ABC123', '999']) assert.ok(!s.includes(secreto), secreto)
    assert.ok(r.compitas[0].telegram_chat_id)       // sigue "vinculado" para el estado
    assert.equal(r.compitas[0].telefono, null)
    assert.equal(r.usuarios[0].nombre, 'Ana')
  })
  test('con telefonos: ve contactos pero sin atender no ve el enlace de sala', () => {
    process.env.ADMIN_EMAILS = 'root@x.test'
    const r = recortarParaActor(colab({ monitorear: true, telefonos: true }), datos)
    assert.equal(r.usuarios[0].email, 'ana@x.test')
    assert.equal(r.solicitudes[0].room_url, null)
  })
  test('no modifica el original', () => {
    process.env.ADMIN_EMAILS = 'root@x.test'
    recortarParaActor(colab({ monitorear: true }), datos)
    assert.equal(datos.usuarios[0].email, 'ana@x.test')
  })
})
