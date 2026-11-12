/* eslint-disable */
// Velocidad del panel: una sola comprobación de sesión por pantalla y un diagnóstico para ver si la lentitud viene de la distancia a la base.
import { db, limpiar, session, req } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { leerLatencia, medirLatencia } from '@/lib/latencia'
import { GET } from '@/app/api/admin/latencia/route'

beforeEach(limpiar)

describe('diagnóstico de latencia', () => {
  test('la lectura dice si el servidor está lejos, algo lejos o cerca de la base', () => {
    assert.match(leerLatencia([150, 160, 170], 180, 200), /lejos de la base/)
    assert.match(leerLatencia([60, 70, 65], 80, 100), /la distancia pesa/)
    assert.match(leerLatencia([5, 6, 7], 8, 20), /cerca/)
  })
  test('mide sin escribir nada y entrega los números', async () => {
    const r = await medirLatencia()
    assert.equal(r.consultasEnSerie.length, 3); assert.ok(r.cincoEnParalelo >= 0); assert.ok(typeof r.lectura === 'string')
  })
  test('solo el administrador raíz puede pedirlo', async () => {
    session.user = null
    assert.notEqual((await GET()).status, 200)
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    assert.equal((await GET()).status, 200)
  })
})

describe('una sola comprobación de sesión', () => {
  test('el proxy del panel solo renueva la sesión; la verificación real la hace la página', () => {
    const p = readFileSync('proxy.ts', 'utf8')
    const parteAdmin = p.slice(p.indexOf("const { data: { session } }"))
    assert.match(parteAdmin, /auth\.getSession\(\)/)
    assert.doesNotMatch(parteAdmin, /auth\.getUser\(\)/)
    assert.match(readFileSync('lib/auth.ts', 'utf8'), /export const usuarioVerificado = cache\(/)
  })
})
