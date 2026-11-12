/* eslint-disable */
// Personas en el navegador: ordenar, filtrar, buscar y paginar sin pedirle nada al servidor, con el estado en la dirección.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { datosClientes, datosCompitas, direccionCon, esMovimientoDeLista, leerParamsLista } from '@/lib/panel-personas-cliente'
import { consultarCompitas, type FilaCliente, type FilaCompita } from '@/lib/panel-personas-tipos'

const fila = (o: Partial<FilaCompita> = {}): FilaCompita => ({ id: Math.random().toString(36).slice(2), nombre: 'Ana', zona: 'Miranda — Chacao', estado: 'Disponible', activos: 0, visitas: 0, rating: 0, respuesta: null, inactivoH: null, canc: 0, tardias: 0, ...o })
const cli = (o: Partial<FilaCliente> = {}): FilaCliente => ({ id: Math.random().toString(36).slice(2), nombre: 'Luis', zona: 'Zulia — Maracaibo', compita: null, plan: null, alta: '2026-10-01T00:00:00Z', bloqueado: false, ...o })

describe('parámetros y direcciones', () => {
  test('lee de la dirección lo que mueve la lista', () => {
    assert.deepEqual(leerParamsLista('sec=personas&q=ana&orden=rating&dir=desc&pag=2&vista=nuevas&estado=Zulia'), { q: 'ana', vista: 'nuevas', orden: 'rating', dir: 'desc', pag: '2', estado: 'Zulia' })
    assert.deepEqual(leerParamsLista(''), { q: '', vista: '', orden: '', dir: '', pag: '', estado: '' })
  })
  test('aplica cambios, quita con null y conserva lo demás (como, persona...)', () => {
    const u = new URL(direccionCon('sec=personas&como=colaborador&q=ana&pag=3', { q: null, orden: 'zona', pag: null }), 'https://x.local')
    assert.equal(u.pathname, '/panel'); assert.equal(u.searchParams.get('sec'), 'personas'); assert.equal(u.searchParams.get('como'), 'colaborador')
    assert.equal(u.searchParams.get('orden'), 'zona'); assert.equal(u.searchParams.has('q'), false); assert.equal(u.searchParams.has('pag'), false)
  })
})

describe('qué se resuelve en el navegador y qué va al servidor', () => {
  test('ordenar, filtrar, buscar y paginar se quedan en el navegador', () => {
    for (const h of ['/panel?sec=personas&orden=zona&dir=asc', '/panel?sec=personas&vista=pausa', '/panel?sec=personas&pag=2&q=ana', '/panel?sec=personas&estado=Zulia']) assert.equal(esMovimientoDeLista(h, 'compitas'), true, h)
  })
  test('abrir una ficha, un chat u otra pantalla sigue yendo al servidor', () => {
    for (const h of ['/panel?sec=personas&persona=compita:abc', '/panel?sec=personas&chat=a:b', '/panel?sec=seguimiento', '/panel?sec=personas&lista=clientes', '/dashboard']) assert.equal(esMovimientoDeLista(h, 'compitas'), false, h)
    assert.equal(esMovimientoDeLista('/panel?sec=personas&lista=clientes&q=x', 'clientes'), true)
  })
})

describe('los datos salen igual que los armaba el servidor', () => {
  test('compitas: mismo orden, filtro, páginas y conteos que consultarCompitas', () => {
    const todas = Array.from({ length: 60 }, (_, i) => fila({ nombre: `C${String(i).padStart(2, '0')}`, rating: i % 5, zona: i % 2 ? 'Zulia — Maracaibo' : 'Miranda — Chacao' }))
    const p = { q: 'c1', vista: '', orden: 'rating', dir: 'desc', pag: '1', estado: '' }
    const d = datosCompitas(todas, p), c = consultarCompitas(todas, p)
    assert.deepEqual(d.fila, c.fila); assert.equal(d.total, c.total); assert.equal(d.paginas, c.paginas); assert.deepEqual(d.conteos, c.conteos)
    assert.equal(d.enTotal, 60); assert.equal(d.dir, 'desc'); assert.equal(d.orden, 'rating')
    assert.equal(datosCompitas(todas, { ...p, q: '', pag: '99' }).pag, 3) // una página inventada cae en la última
  })
  test('clientes: búsqueda por nombre, zona o compita y totales', () => {
    const todos = [cli({ nombre: 'Rosa', compita: 'Ana Pérez' }), cli({ nombre: 'Pedro' }), cli({ nombre: 'Juan', zona: 'Zulia — Maracaibo' })]
    const d = datosClientes(todos, { q: 'ana', vista: '', orden: '', dir: '', pag: '', estado: '' })
    assert.equal(d.total, 1); assert.equal(d.enTotal, 3); assert.equal(d.fila[0].nombre, 'Rosa')
  })
})

describe('cableado', () => {
  test('la página usa el componente del navegador y este no pide nada al servidor al ordenar o filtrar', () => {
    assert.match(readFileSync('app/panel/page.tsx', 'utf8'), /<PersonasInteractivo lista="compitas"/)
    const c = readFileSync('components/panel/PersonasInteractivo.tsx', 'utf8')
    assert.match(c, /^'use client'/); assert.match(c, /history\.replaceState/); assert.match(c, /esMovimientoDeLista\(href, lista\)/)
    assert.doesNotMatch(c, /router\.(push|replace)|useRouter/) // la lista no navega: no hay viaje al servidor
    assert.match(c, /setTimeout\(\(\) => window\.history\.replaceState/) // con retraso: Safari limita el historial a 100 cambios por 30 s
  })
})
