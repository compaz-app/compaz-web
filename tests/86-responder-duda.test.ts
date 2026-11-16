/* eslint-disable */
// Responder una "Duda sin resolver" desde la Bandeja: el texto sale por Telegram al compita y la tarea se cierra.
import { db, net, limpiar, mkCompita, tgPara } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { responderDudaDeTarea } from '@/lib/responder-duda'
import { cargarBandeja } from '@/lib/panel-bandeja'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'
import type { Actor } from '@/lib/permisos'

beforeEach(limpiar)
const actor = (rol: 'admin' | 'colaborador', p: any = {}): Actor => ({ id: 'u1', correo: rol === 'admin' ? 'admin@compaz.test' : 'luis@compaz.test', rol, permisos: rol === 'admin' ? { ...TODOS } : { ...NINGUNO, ...p } })
const duda = (compita: any, o: any = {}) => db.seed('admin_flags', { entidad_tipo: 'compita', entidad_id: compita.id, entidad_nombre: `Duda sin resolver (Otra duda): ${compita.nombre}`, nota: 'Dijo: no me llega la dirección', reportado_por: 'ayuda automática', resuelto: false, tipo: 'duda_sin_resolver', prioridad: 2, created_at: new Date().toISOString(), ...o })

describe('responder una duda desde el panel', () => {
  test('el bot le escribe al compita, la tarea se cierra y queda quién respondió', async () => {
    const k = mkCompita({ telegram_chat_id: '970', nombre: 'Lucía' } as any); const t = duda(k)
    const r = await responderDudaDeTarea(actor('colaborador', { atender: true }), t.id, 'Ya le recordamos al cliente. Te llega la dirección en cuanto la registre.')
    assert.equal(r.ok, true)
    const m = tgPara(970)
    assert.equal(m.length, 1); assert.match(m[0].text, /Respuesta del equipo de Compaz/); assert.match(m[0].text, /Te llega la dirección/)
    assert.equal(db.rows('admin_flags').find((f: any) => f.id === t.id)!.resuelto, true)
    const e = db.rows('eventos').find((x: any) => x.tipo === 'duda_compita' && x.datos?.resultado === 'respondida')!
    assert.equal(e.actor, 'admin:luis@compaz.test')
  })
  test('rechaza texto vacío, muy largo o con contactos, y no manda nada ni cierra la tarea', async () => {
    const k = mkCompita({ telegram_chat_id: '971' } as any); const t = duda(k)
    for (const mal of ['', '   ', 'x'.repeat(801), 'Escríbele al 0412 123 45 67', 'Mándame un correo a ana@gmail.com']) {
      const r = await responderDudaDeTarea(actor('admin'), t.id, mal); assert.equal(r.ok, false, mal.slice(0, 20))
    }
    assert.equal(tgPara(971).length, 0); assert.equal(db.rows('admin_flags')[0].resuelto, false)
  })
  test('sin Telegram vinculado explica por qué; solo vale para dudas abiertas de un compita', async () => {
    const sin = mkCompita({ telegram_chat_id: null } as any); const t = duda(sin)
    const r = await responderDudaDeTarea(actor('admin'), t.id, 'Hola'); assert.equal(r.ok, false); assert.match((r as any).error, /no tiene Telegram/)
    const otra = db.seed('admin_flags', { entidad_tipo: 'compita', entidad_id: sin.id, entidad_nombre: 'x', nota: 'x', resuelto: false, tipo: 'emergencia', reportado_por: 'x', created_at: new Date().toISOString() })
    assert.equal((await responderDudaDeTarea(actor('admin'), otra.id, 'Hola') as any).status, 404)
    const k = mkCompita({ telegram_chat_id: '972' } as any); const cerrada = duda(k, { resuelto: true })
    assert.equal((await responderDudaDeTarea(actor('admin'), cerrada.id, 'Hola') as any).status, 409)
  })
  test('la Bandeja ofrece "Responder por Telegram" solo a quien puede atender', async () => {
    const k = mkCompita({ telegram_chat_id: '973' } as any); duda(k)
    const con = (await cargarBandeja(actor('colaborador', { atender: true })))[0]
    assert.equal(con.accion?.tipo, 'responder')
    const sin = (await cargarBandeja(actor('colaborador', { monitorear: true })))
    assert.ok(sin.every((t) => t.accion?.tipo !== 'responder'))
  })
  test('la ruta pide el permiso "atender"', () => {
    assert.match(readFileSync('app/api/admin/responder-duda/route.ts', 'utf8'), /requierePermiso\('atender'\)/)
  })
})
