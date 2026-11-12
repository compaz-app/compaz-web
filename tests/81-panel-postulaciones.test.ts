/* eslint-disable */
// Panel nuevo, Más: Postulaciones y origen.
import { db, limpiar } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { HUB, hubVisible } from '@/lib/panel-mas-tipos'
import { resumenPorOrigen, consultarPostulaciones } from '@/lib/panel-postulaciones-tipos'
import { listarPostulaciones, pendientesDeAirtable } from '@/lib/panel-postulaciones'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'

beforeEach(limpiar)
const f = (o: any = {}) => ({ id: Math.random().toString(36).slice(2), tipo: 'familia', clasificacion: 'pendiente', fuente: 'home', campana: null, origen: null, nombre: 'Ana', ubicacion: 'Caracas', recibida: new Date().toISOString(), ...o })
const sembrar = (o: any = {}) => db.seed('postulaciones', { tipo: 'familia', clasificacion: 'pendiente', fuente: 'home', nombre_declarado: 'Ana', telefono_declarado: '04141234567', email_declarado: 'a@mail.test', ubicacion_declarada: 'Caracas', recibida_en: new Date().toISOString(), ...o })

describe('postulaciones y origen', () => {
  test('la herramienta está lista y solo la ve el administrador', () => {
    const h = HUB.find((x) => x.id === 'postulaciones')!
    assert.equal(h.listo, true)
    assert.ok(hubVisible({ rol: 'admin', permisos: { ...TODOS } } as any).some((x) => x.id === 'postulaciones'))
    assert.ok(!hubVisible({ rol: 'colaborador', permisos: { ...NINGUNO, cuentas: true, telefonos: true, atender: true } } as any).some((x) => x.id === 'postulaciones'))
  })

  test('el resumen cuenta por campaña (o por página si no hay) y cuántas calificaron', () => {
    const r = resumenPorOrigen([f({ campana: 'abuelos', clasificacion: 'calificada' }), f({ campana: 'abuelos' }), f({ campana: 'abuelos' }), f({ fuente: 'se_compita' }), f({ fuente: 'home', clasificacion: 'calificada' })])
    assert.deepEqual(r[0], { origen: 'Campaña abuelos', total: 3, calificadas: 1, porcentaje: 33 })
    assert.ok(r.some((x) => x.origen === 'Página "Sé compita"' && x.total === 1))
    assert.ok(r.some((x) => x.origen === 'Página principal' && x.calificadas === 1 && x.porcentaje === 100))
  })

  test('los filtros ignoran valores inventados, paginan, y el resumen cuenta todo aunque se filtre', () => {
    const todas = [...Array.from({ length: 30 }, () => f({ tipo: 'familia' })), ...Array.from({ length: 5 }, () => f({ tipo: 'compita', clasificacion: 'calificada' }))]
    assert.equal(consultarPostulaciones(todas, 'inventado', 'x', undefined).total, 35)
    const c = consultarPostulaciones(todas, 'compita', 'calificada', undefined)
    assert.equal(c.total, 5); assert.equal(c.resumen.reduce((s, r) => s + r.total, 0), 35)
    const p1 = consultarPostulaciones(todas, '', '', undefined); assert.ok(p1.paginas >= 2 && p1.filas.length < 35)
  })

  test('la lectura trae el origen y NUNCA el teléfono ni el correo', async () => {
    sembrar({ utm_campaign: 'abuelos', utm_source: 'meta', clasificacion: 'calificada' })
    const filas = await listarPostulaciones()
    assert.equal(filas.length, 1); assert.equal(filas[0].campana, 'abuelos'); assert.equal(filas[0].clasificacion, 'calificada')
    assert.doesNotMatch(JSON.stringify(filas), /04141234567|a@mail\.test/)
  })

  test('sin CAPTACION_DESDE no hay nada por resolver (y se dice)', async () => {
    const antes = process.env.CAPTACION_DESDE; delete process.env.CAPTACION_DESDE
    try { assert.deepEqual(await pendientesDeAirtable(), { activa: false, error: false, filas: [] }) } finally { if (antes) process.env.CAPTACION_DESDE = antes }
  })

  test('la pantalla está conectada en el panel y la resolución sigue protegida por permiso', () => {
    const p = readFileSync('app/panel/page.tsx', 'utf8'); assert.match(p, /subMas\.id === 'postulaciones'/); assert.match(p, /'po_tipo', 'po_clasif', 'po_pag'/)
    assert.match(readFileSync('app/api/admin/postulaciones/resolver/route.ts', 'utf8'), /requierePermiso\('cuentas'\)/)
  })
})

describe('la sesión del panel no se corta', () => {
  test('el proxy (antes middleware) renueva la sesión también en /panel (si no, el acceso caduca al cumplirse la hora del token)', () => {
    const m = readFileSync('proxy.ts', 'utf8')
    assert.match(m, /pathname\.startsWith\('\/panel'\)/); assert.match(m, /'\/panel\/:path\*'/)
  })
})
