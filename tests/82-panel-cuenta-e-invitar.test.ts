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
    assert.match(c, /if \(!puedeCuentas && !hayAsignar && !puedeEliminar\) return null/)
    assert.match(c, /\/api\/admin\/eliminar-cliente/); assert.match(c, /\/api\/admin\/eliminar-compita/); assert.match(c, /puedeEliminar/) // eliminar: solo el administrador y escribiendo ELIMINAR
  })
  test('la ruta insegura de vista previa ya no existe', () => {
    assert.throws(() => readFileSync('app/api/admin/cliente-preview/route.ts', 'utf8'))
  })
})

import { DELETE as eliminarCliente } from '@/app/api/admin/eliminar-cliente/route'
import { DELETE as eliminarCompita } from '@/app/api/admin/eliminar-compita/route'
import { session, req } from './harness'

describe('eliminar cuenta: se anonimiza solo si la persona pidió borrar sus datos', () => {
  const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }
  const del = (url: string, json: any) => req(url, { method: 'DELETE', json })
  test('cliente sin pedido: se conserva la información, el nombre lleva la marca y se cierra el acceso', async () => {
    const lucia = mkCompita({ nombre: 'Lucía' })
    const c = mkCliente({ email: 'ana@mail.test', nombre: 'Ana Pérez', telefono: '+58 412 1', familiar_nombre: 'Doña Rosa', compita_id: lucia.id })
    const v = db.seed('visitas', { usuario_id: c.id, compita_id: lucia.id, estado: 'terminada', direccion: 'Calle 1' })
    db.seed('mensajes', { visita_id: v.id, contenido: 'hola' }); db.seed('pagos_plan', { usuario_id: c.id, plan: 'quincenal', estado: 'activo' })
    admin(); assert.equal((await eliminarCliente(del('/api/admin/eliminar-cliente', { usuario_id: c.id }))).status, 200)
    const u = db.rows('usuarios').find((x) => x.id === c.id)!
    assert.equal(u.nombre, 'Ana Pérez (cuenta eliminada)'); assert.equal(u.telefono, '+58 412 1'); assert.equal(u.familiar_nombre, 'Doña Rosa')
    assert.ok(u.eliminada_en); assert.doesNotMatch(u.email, /ana@mail/)
    assert.equal(db.rows('visitas')[0].direccion, 'Calle 1'); assert.equal(db.rows('mensajes').length, 1); assert.equal(db.rows('pagos_plan').length, 1)
    assert.equal(db.rows('eventos').find((e) => e.tipo === 'cuenta_eliminada')!.datos.correo_anterior, 'ana@mail.test') // el correo no se pierde: queda en el registro
  })
  test('cliente que pidió borrar sus datos: se anonimiza', async () => {
    const c = mkCliente({ email: 'beto@mail.test', nombre: 'Beto Gil', telefono: '+58 412 2', familiar_nombre: 'Don Luis' })
    admin(); assert.equal((await eliminarCliente(del('/api/admin/eliminar-cliente', { usuario_id: c.id, borrar_datos: true }))).status, 200)
    const u = db.rows('usuarios').find((x) => x.id === c.id)!
    assert.equal(u.nombre, 'Cuenta eliminada'); assert.equal(u.telefono, null); assert.equal(u.familiar_nombre, null)
  })
  test('compita sin pedido conserva su perfil; con pedido se borra; con visitas abiertas no se puede', async () => {
    const a = mkCompita({ nombre: 'Marta', telefono: '+58 414 9', descripcion: 'Perfil de Marta' })
    admin(); assert.equal((await eliminarCompita(del('/api/admin/eliminar-compita', { compita_id: a.id }))).status, 200)
    const ra = db.rows('compitas').find((x) => x.id === a.id)!
    assert.equal(ra.nombre, 'Marta (cuenta eliminada)'); assert.equal(ra.telefono, '+58 414 9'); assert.equal(ra.descripcion, 'Perfil de Marta'); assert.equal(ra.estado, 'bloqueado')
    const b = mkCompita({ nombre: 'Nora', telefono: '+58 414 8', descripcion: 'Perfil de Nora' })
    assert.equal((await eliminarCompita(del('/api/admin/eliminar-compita', { compita_id: b.id, borrar_datos: true }))).status, 200)
    const rb = db.rows('compitas').find((x) => x.id === b.id)!; assert.equal(rb.telefono, null); assert.equal(rb.descripcion, null)
    const c = mkCompita({ nombre: 'Olga' }); db.seed('visitas', { compita_id: c.id, usuario_id: 'x', estado: 'programada' })
    assert.equal((await eliminarCompita(del('/api/admin/eliminar-compita', { compita_id: c.id }))).status, 409)
  })
})
