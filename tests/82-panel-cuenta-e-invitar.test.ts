/* eslint-disable */
// Panel nuevo: acciones de cuenta en la ficha (bloquear, verificar, activar, asignar, portal nuevo) e Invitar.
import { db, limpiar, mkCompita, mkCliente } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fichaDePersona } from '@/lib/panel-personas'
import { HUB, hubVisible } from '@/lib/panel-mas-tipos'
import { PANTALLAS_PANEL } from '@/lib/manual'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'

beforeEach(limpiar)
const actor = (rol: 'admin' | 'colaborador', p: any = {}) => ({ id: 'u1', correo: 'a@compaz.test', rol, permisos: rol === 'admin' ? { ...TODOS } : { ...NINGUNO, ...p } }) as any

describe('la ficha trae el estado de la cuenta para sus botones', () => {
  test('compita: bloqueado, verificado y activo salen de su estado', async () => {
    const c = mkCompita({ nombre: 'Lucía', estado: 'activo', verificado: true })
    const f = await fichaDePersona(actor('admin'), 'compita', c.id)
    assert.deepEqual(f!.cuenta, { bloqueado: false, verificado: true, activo: true })
    db.rows('compitas').find((x) => x.id === c.id)!.estado = 'bloqueado'
    assert.equal((await fichaDePersona(actor('admin'), 'compita', c.id))!.cuenta!.bloqueado, true)
  })
  test('cliente: bloqueado por plan y portal nuevo por familia', async () => {
    const cli = mkCliente({ email: 'x@mail.test', nombre: 'Ana', plan: 'bloqueado', portal_nuevo: true })
    const f = await fichaDePersona(actor('admin'), 'cliente', cli.id)
    assert.deepEqual(f!.cuenta, { bloqueado: true, portalNuevo: true })
  })
  test('la lista de compitas para asignar solo viaja a quien puede atender, y sin demos ni bloqueados', async () => {
    mkCompita({ nombre: 'Buena', estado: 'activo', verificado: true }); mkCompita({ nombre: 'Demo', estado: 'activo', verificado: true, es_demo: true }); mkCompita({ nombre: 'Mala', estado: 'bloqueado', verificado: false })
    const cli = mkCliente({ email: 'y@mail.test', nombre: 'Beto' })
    const con = await fichaDePersona(actor('colaborador', { atender: true }), 'cliente', cli.id)
    assert.deepEqual(con!.asignables!.map((x) => x.nombre), ['Buena'])
    assert.equal((await fichaDePersona(actor('colaborador', { monitorear: true }), 'cliente', cli.id))!.asignables, undefined)
  })
})

describe('invitar y acciones de cuenta', () => {
  test('Invitar está en Más, solo con el permiso invitar, y explicado en el manual', () => {
    assert.ok(HUB.some((h) => h.id === 'invitar' && h.listo))
    assert.ok(hubVisible(actor('colaborador', { invitar: true })).some((h) => h.id === 'invitar'))
    assert.ok(!hubVisible(actor('colaborador', { cuentas: true })).some((h) => h.id === 'invitar'))
    assert.ok((PANTALLAS_PANEL as readonly string[]).includes('invitar'))
  })
  test('los botones de cuenta usan rutas que piden permiso y la ficha los muestra solo a quien puede', () => {
    const c = readFileSync('components/panel/CuentaPersona.tsx', 'utf8')
    for (const r of ['bloquear-cliente', 'bloquear-compita', 'toggle-verificado', 'toggle-estado', 'portal-nuevo', 'asignar-compita']) assert.match(c, new RegExp(`/api/admin/${r}`))
    assert.match(c, /if \(!puedeCuentas && !hayAsignar\) return null/)
    assert.doesNotMatch(c, /eliminar/i)
  })
  test('la ruta insegura de vista previa ya no existe', () => {
    assert.throws(() => readFileSync('app/api/admin/cliente-preview/route.ts', 'utf8'))
  })
})
