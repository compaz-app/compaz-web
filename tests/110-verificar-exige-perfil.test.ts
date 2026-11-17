/* eslint-disable */
// El equipo no puede verificar ni activar a un compita que no llenó su perfil público.
import { db, session, limpiar, req, mkCompita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as toggleVerificado } from '@/app/api/admin/toggle-verificado/route'
import { POST as toggleEstado } from '@/app/api/admin/toggle-estado/route'

beforeEach(() => { limpiar(); session.user = { id: 'adm', email: 'admin@compaz.test' } })
const verificar = (id: string) => toggleVerificado(req('/api/admin/toggle-verificado', { json: { compita_id: id, verificado: true } }))
const activar = (id: string) => toggleEstado(req('/api/admin/toggle-estado', { json: { compita_id: id, estado: 'activo' } }))
const vacio = { estado: 'inactivo', verificado: false, descripcion: null, servicios: [] }

describe('verificar y activar exigen el perfil', () => {
  test('perfil vacío: verificar responde 409 con el motivo y no cambia nada', async () => {
    const c = mkCompita(vacio)
    const r = await verificar(c.id); assert.equal(r.status, 409)
    assert.match((await r.json()).error, /perfil público/)
    const fila = db.rows('compitas').find((x: any) => x.id === c.id)!; assert.equal(fila.verificado, false); assert.equal(fila.estado, 'inactivo')
  })
  test('perfil vacío: activar también responde 409', async () => {
    const c = mkCompita(vacio); assert.equal((await activar(c.id)).status, 409)
    assert.equal(db.rows('compitas').find((x: any) => x.id === c.id)!.estado, 'inactivo')
  })
  test('falta solo los servicios o solo la descripción: sigue sin poder', async () => {
    assert.equal((await verificar(mkCompita({ ...vacio, descripcion: 'Cuido con cariño' }).id)).status, 409)
    assert.equal((await verificar(mkCompita({ ...vacio, servicios: ['Compañía'] }).id)).status, 409)
  })
  test('perfil lleno (sin foto): se verifica y se activa normal', async () => {
    const c = mkCompita({ estado: 'inactivo', verificado: false, foto_url: null })
    assert.equal((await verificar(c.id)).status, 200)
    const fila = db.rows('compitas').find((x: any) => x.id === c.id)!; assert.equal(fila.verificado, true); assert.equal(fila.estado, 'activo')
  })
  test('quitar la verificación no pide perfil (siempre se puede)', async () => {
    const c = mkCompita(vacio)
    assert.equal((await toggleVerificado(req('/api/admin/toggle-verificado', { json: { compita_id: c.id, verificado: false } }))).status, 200)
  })
})
