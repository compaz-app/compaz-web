/* eslint-disable */
// Freno de tráfico del servidor para las consultas del panel (INC-002): pasado el tope por minuto responde 429 explicado y avisa una vez por hora.
import { db, limpiar, session } from './harness'
import { NextRequest } from 'next/server'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { limitarConsultas, TOPE_CONSULTAS_PANEL } from '@/lib/guardia-trafico'
import { GET as bandeja } from '@/app/api/admin/pendientes-bandeja/route'
import { GET as pagos } from '@/app/api/admin/pendientes-pagos/route'

beforeEach(limpiar)
const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }
const get = () => new NextRequest('http://localhost/api/admin/pendientes-bandeja')

describe('limitarConsultas', () => {
  test('deja pasar hasta el tope; la siguiente recibe la espera explicada', async () => {
    for (let i = 0; i < TOPE_CONSULTAS_PANEL.max; i++) assert.equal(await limitarConsultas('a@b.test', 'x'), null, `consulta ${i + 1}`)
    const e = await limitarConsultas('a@b.test', 'x')
    assert.ok(e); assert.equal(e!.clave, 'panel_consultas'); assert.match(e!.resumen, /demasiadas consultas/); assert.ok(e!.porQue.length > 20)
  })
  test('el tope es por persona y por ruta: otra persona y otra ruta no se ven afectadas', async () => {
    for (let i = 0; i <= TOPE_CONSULTAS_PANEL.max; i++) await limitarConsultas('a@b.test', 'x')
    assert.equal(await limitarConsultas('otra@b.test', 'x'), null); assert.equal(await limitarConsultas('a@b.test', 'y'), null)
  })
  test('avisa al equipo UNA vez por hora, no por cada consulta de más', async () => {
    for (let i = 0; i < TOPE_CONSULTAS_PANEL.max + 25; i++) await limitarConsultas('a@b.test', 'x')
    const avisos = db.rows('actividad_admin').filter((r: any) => r.categoria === 'trafico')
    assert.equal(avisos.length, 1); assert.match(avisos[0].resumen, /Tráfico anormal/); assert.match(avisos[0].resumen, /a@b\.test/)
  })
  test('el conteo vence al pasar la ventana: pasado el minuto vuelve a dejar pasar', async () => {
    for (let i = 0; i <= TOPE_CONSULTAS_PANEL.max; i++) await limitarConsultas('a@b.test', 'x')
    db.rows('telegram_estados').filter((r: any) => String(r.chat_id).startsWith('trafico:')).forEach((r: any) => { r.pendiente_expira = new Date(Date.now() - 1000).toISOString() })
    assert.equal(await limitarConsultas('a@b.test', 'x'), null)
  })
})

describe('las rutas del punto rojo', () => {
  test('una pantalla descontrolada recibe 429 con la razón, y las normales siguen con 200', async () => {
    admin()
    const estados: number[] = []
    for (let i = 0; i < TOPE_CONSULTAS_PANEL.max + 5; i++) estados.push((await bandeja(get())).status)
    assert.equal(estados.filter((s) => s === 200).length, TOPE_CONSULTAS_PANEL.max); assert.equal(estados.filter((s) => s === 429).length, 5)
    const r = await bandeja(get()); const j = await r.json(); assert.equal(r.status, 429); assert.ok(j.error && j.porQue)
    assert.equal((await pagos()).status, 200, 'la otra ruta tiene su propio conteo')
  })
  test('sin permiso sigue siendo 401/403 y no gasta conteo', async () => {
    session.user = null; assert.equal((await bandeja(get())).status, 401)
    assert.equal(db.rows('telegram_estados').filter((r: any) => String(r.chat_id).startsWith('trafico:')).length, 0)
  })
})

describe('el navegador respeta el 429', () => {
  test('el almacén se calla un minuto al recibir 429', () => {
    const s = readFileSync('components/panel/pendientes-store.ts', 'utf8')
    assert.equal((s.match(/r\.status === 429\) \{ pausaHasta/g) ?? []).length, 2); assert.match(s, /Date\.now\(\) < pausaHasta/)
  })
})
