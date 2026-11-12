/* eslint-disable */
// Activación por etapas del portal nuevo: por cliente (true/false) o siguiendo el interruptor general (null).
import { db, limpiar, session, req, mkCliente, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { portalNuevoParaCliente, clienteVePortalNuevo, fijarPortalNuevo } from '@/lib/portal-activacion'
import { limpiarCacheAjustes } from '@/lib/ajustes'
import { PATCH } from '@/app/api/admin/portal-nuevo/route'
import { readFileSync } from 'node:fs'

beforeEach(limpiar)
const general = (v: number) => { db.seed('ajustes', { clave: 'portal_nuevo', valor: v, actualizado_por: 'pruebas' }); limpiarCacheAjustes() }
const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } as any }

describe('quién ve el portal nuevo', () => {
  test('lo que diga el cliente manda; si no dice nada, manda el interruptor general', () => {
    assert.equal(portalNuevoParaCliente(false, true), true)
    assert.equal(portalNuevoParaCliente(true, false), false)
    assert.equal(portalNuevoParaCliente(false, null), false)
    assert.equal(portalNuevoParaCliente(true, undefined), true)
  })
  test('con el interruptor apagado solo lo ven los clientes activados uno por uno', async () => {
    general(0); const a = mkCliente({ portal_nuevo: true }); const b = mkCliente(); const c = mkCliente({ portal_nuevo: false })
    assert.equal(await clienteVePortalNuevo(a.id), true)
    assert.equal(await clienteVePortalNuevo(b.id), false)
    assert.equal(await clienteVePortalNuevo(c.id), false)
  })
  test('con el interruptor encendido lo ven todos menos quien se dejó en el viejo', async () => {
    general(1); const a = mkCliente(); const c = mkCliente({ portal_nuevo: false })
    assert.equal(await clienteVePortalNuevo(a.id), true)
    assert.equal(await clienteVePortalNuevo(c.id), false)
  })
})

describe('el equipo activa o desactiva por cliente', () => {
  test('PATCH activa a un cliente, lo registra y avisa al equipo', async () => {
    general(0); const c = mkCliente(); admin()
    const r = await PATCH(req('/api/admin/portal-nuevo', { method: 'PATCH', json: { usuario_id: c.id, activo: true } })); assert.equal(r.status, 200)
    assert.equal(await clienteVePortalNuevo(c.id), true)
    assert.ok(db.rows('eventos').some((e: any) => e.tipo === 'portal_nuevo_cambiado') || avisosAdmin().some((a: any) => /portal nuevo/.test(a.text)))
    assert.ok(avisosAdmin().some((a: any) => /en el portal nuevo/.test(a.text)))
  })
  test('null devuelve al cliente al interruptor general', async () => {
    general(0); const c = mkCliente({ portal_nuevo: true })
    assert.equal(await fijarPortalNuevo(c.id, null, 'admin'), true)
    assert.equal(await clienteVePortalNuevo(c.id), false)
  })
  test('datos inválidos 400; cliente inexistente 404; sin sesión 401', async () => {
    admin()
    assert.equal((await PATCH(req('/api/admin/portal-nuevo', { method: 'PATCH', json: { usuario_id: 'x', activo: 'si' } }))).status, 400)
    assert.equal((await PATCH(req('/api/admin/portal-nuevo', { method: 'PATCH', json: { usuario_id: 'no-existe', activo: true } }))).status, 404)
    session.user = null
    assert.equal((await PATCH(req('/api/admin/portal-nuevo', { method: 'PATCH', json: { usuario_id: 'x', activo: true } }))).status, 401)
  })
})

describe('los dos portales no se mandan en círculo', () => {
  test('el portal viejo manda al nuevo y el nuevo manda al viejo con la MISMA decisión', () => {
    assert.match(readFileSync('app/dashboard/page.tsx', 'utf8'), /clienteVePortalNuevo\(session\.user\.id\)\)\) redirect\('\/portal'\)/)
    assert.match(readFileSync('app/portal/page.tsx', 'utf8'), /clienteVePortalNuevo\(session\.user\.id\)/)
  })
})
