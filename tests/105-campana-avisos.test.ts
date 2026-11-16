/* eslint-disable */
// Campana de avisos del portal: lista, círculo rojo y apertura.
import { db, limpiar, session, mkCliente } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registrarNovedad, listarAvisosPortal, contarNovedadesSinAbrir } from '@/lib/novedades'
import { POST as abiertas } from '@/app/api/portal/novedades/abiertas/route'

beforeEach(limpiar)
const nueva = (u: any, clave: string, o: any = {}) => ({ usuarioId: u.id, tipo: 'compita_llego', nivel: 'critico' as const, titulo: `Aviso ${clave}`, clave, ...o })

describe('campana de avisos', () => {
  test('lista los avisos del cliente, los más nuevos primero, con la marca de nuevo, y no los de otro', async () => {
    const a = mkCliente(), b = mkCliente()
    await registrarNovedad(nueva(a, 'novedad:1')); await registrarNovedad(nueva(a, 'novedad:2')); await registrarNovedad(nueva(b, 'novedad:3'))
    const l = await listarAvisosPortal(a.id)
    assert.equal(l.length, 2); assert.ok(l.every((x) => x.nueva && x.ruta === '/portal'))
    assert.equal((await listarAvisosPortal(b.id)).length, 1)
  })
  test('el límite se respeta y una ruta que no es del sitio cae a /portal', async () => {
    const a = mkCliente()
    for (let i = 0; i < 4; i++) await registrarNovedad(nueva(a, `novedad:${i}`, { ruta: i === 0 ? 'https://malo.test' : '/portal?sec=visitas' }))
    assert.equal((await listarAvisosPortal(a.id, 3)).length, 3)
    const todos = await listarAvisosPortal(a.id); assert.ok(todos.every((x) => x.ruta.startsWith('/'))); assert.ok(todos.some((x) => x.ruta === '/portal'))
  })
  test('abrir la campana deja todo atendido: el número pasa a cero y la lista conserva los avisos sin marca', async () => {
    const a = mkCliente(), b = mkCliente()
    await registrarNovedad(nueva(a, 'novedad:1')); await registrarNovedad(nueva(b, 'novedad:2'))
    session.user = null; assert.equal((await abiertas()).status, 401)
    session.user = { id: a.id, email: a.email }; assert.equal((await abiertas()).status, 200)
    assert.equal(await contarNovedadesSinAbrir(a.id), 0); assert.equal(await contarNovedadesSinAbrir(b.id), 1)
    const l = await listarAvisosPortal(a.id); assert.equal(l.length, 1); assert.equal(l[0].nueva, false)
  })
  test('la pantalla dibuja la campana solo al cliente, y Visitas cuenta los mensajes (no los avisos)', () => {
    const page = readFileSync('app/portal/page.tsx', 'utf8')
    assert.match(page, /!esAdmin && <CampanaAvisos/); assert.match(page, /insignias=\{\{ visitas: mensajesNuevos \}\}/)
    assert.match(readFileSync('components/portal/CampanaAvisos.tsx', 'utf8'), /api\/portal\/novedades\/abiertas/)
  })
})
