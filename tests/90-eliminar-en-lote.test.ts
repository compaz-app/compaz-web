/* eslint-disable */
// Eliminar varios perfiles de una vez (solo administrador raíz) y confirmación simple en la eliminación individual.
import { db, limpiar, session, req, mkCliente, mkCompita, mkVisita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DELETE as lote } from '@/app/api/admin/eliminar-lote/route'
import { eliminarEnLote, MAX_ELIMINAR_LOTE } from '@/lib/cuenta-eliminar'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'

beforeEach(limpiar)
const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }
const llamar = (json: unknown) => lote(req('/api/admin/eliminar-lote', { method: 'DELETE', json }))
const eliminada = (tabla: string, id: string) => { const f = db.rows(tabla).find((x: any) => x.id === id); return !f || !!f.eliminada_en || /cuenta eliminada/i.test(String(f.nombre ?? '')) }

describe('la ruta', () => {
  test('sin sesión o sin ser administrador raíz no elimina nada', async () => {
    const c = mkCompita(); session.user = null
    assert.notEqual((await llamar({ tipo: 'compita', ids: [c.id] })).status, 200)
    db.seed('equipo', { correo: 'colab@compaz.test', nombre: 'Colab', permisos: { ...NINGUNO, cuentas: true, atender: true }, activo: true, creado_por: 'admin@compaz.test' })
    session.user = { id: 'col', email: 'colab@compaz.test' }
    assert.equal((await llamar({ tipo: 'compita', ids: [c.id] })).status, 403)
    assert.equal(eliminada('compitas', c.id), false)
  })
  test('pide un tipo válido y una lista de identificadores, con tope', async () => {
    admin()
    assert.equal((await llamar({ tipo: 'otra', ids: ['a'] })).status, 400)
    assert.equal((await llamar({ tipo: 'cliente', ids: [] })).status, 400)
    assert.equal((await llamar({ tipo: 'cliente', ids: [1, 2] })).status, 400)
    const demasiados = Array.from({ length: MAX_ELIMINAR_LOTE + 1 }, (_, i) => `id-${i}`)
    const r = await llamar({ tipo: 'cliente', ids: demasiados })
    assert.equal(r.status, 400); assert.match((await r.json()).error, /Máximo 50/)
  })
  test('elimina varios compitas de una vez y la respuesta cuenta cuántos', async () => {
    admin()
    const a = mkCompita({ nombre: 'Ana' }), b = mkCompita({ nombre: 'Berta' }), c = mkCompita({ nombre: 'Carla' })
    const r = await llamar({ tipo: 'compita', ids: [a.id, b.id, c.id] })
    assert.equal(r.status, 200)
    const j = await r.json()
    assert.equal(j.data.eliminadas, 3); assert.deepEqual(j.data.fallidas, [])
    for (const x of [a, b, c]) assert.equal(eliminada('compitas', x.id), true)
  })
  test('elimina varios clientes de una vez', async () => {
    admin()
    const x = mkCliente({ nombre: 'Rosa', email: 'rosa@mail.test' }), y = mkCliente({ nombre: 'Pedro', email: 'pedro@mail.test' })
    const j = await (await llamar({ tipo: 'cliente', ids: [x.id, y.id] })).json()
    assert.equal(j.data.eliminadas, 2)
    for (const u of [x, y]) assert.equal(eliminada('usuarios', u.id), true)
  })
})

describe('si una no se puede, se sigue con las demás y se explica', () => {
  test('un compita con visita abierta se salta, las demás se eliminan, y el motivo queda en la respuesta', async () => {
    admin()
    const libre = mkCompita({ nombre: 'Libre' }), ocupada = mkCompita({ nombre: 'Ocupada' }), otra = mkCompita({ nombre: 'Otra' })
    mkVisita(mkCliente({ email: 'v@mail.test' }), ocupada, { estado: 'en_curso' })
    const r = await eliminarEnLote('compita', [libre.id, ocupada.id, otra.id], 'admin@compaz.test')
    assert.equal(r.eliminadas, 2); assert.equal(r.fallidas.length, 1)
    assert.equal(r.fallidas[0].id, ocupada.id); assert.match(r.fallidas[0].motivo, /visitas abiertas/)
    assert.equal(eliminada('compitas', libre.id), true); assert.equal(eliminada('compitas', ocupada.id), false); assert.equal(eliminada('compitas', otra.id), true)
  })
  test('un identificador que no existe o repetido no rompe el lote', async () => {
    const a = mkCompita()
    const r = await eliminarEnLote('compita', [a.id, a.id, '00000000-0000-0000-0000-000000000000'], 'admin@compaz.test')
    assert.equal(r.eliminadas, 1); assert.equal(r.fallidas.length, 1); assert.match(r.fallidas[0].motivo, /ya no existe/)
  })
})

describe('la pantalla', () => {
  test('eliminar una sola cuenta ya no pide escribir una palabra: solo confirmar', () => {
    const c = readFileSync('components/panel/CuentaPersona.tsx', 'utf8')
    assert.doesNotMatch(c, /escribir="ELIMINAR"/); assert.match(c, /¿De verdad quieres eliminar a/)
    assert.doesNotMatch(readFileSync('lib/manual.ts', 'utf8'), /escribiendo ELIMINAR/)
  })
  test('Personas ofrece marcar varias y eliminar en lote solo al administrador, con confirmación simple', () => {
    const p = readFileSync('app/panel/page.tsx', 'utf8')
    assert.equal((p.match(/puedeEliminar=\{actor\.rol === 'admin'\}/g) ?? []).length, 3) // ficha, lista de compitas y lista de clientes
    const i = readFileSync('components/panel/PersonasInteractivo.tsx', 'utf8')
    assert.match(i, /puedeEliminar && ids\.length > 0/); assert.match(i, /EliminarEnLote/)
    const e = readFileSync('components/panel/EliminarEnLote.tsx', 'utf8')
    assert.match(e, /\/api\/admin\/eliminar-lote/); assert.match(e, /¿De verdad quieres eliminar/); assert.doesNotMatch(e, /escribe/i)
  })
})
