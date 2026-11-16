/* eslint-disable */
// Círculo rojo de mensajes sin leer del portal del cliente.
import { db, limpiar, session, mkCliente } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contarMensajesSinLeer, marcarChatLeido } from '@/lib/portal-mensajes'
import { POST as leido } from '@/app/api/portal/chat/leido/route'

beforeEach(limpiar)
const visita = (c: any, estado = 'programada') => db.seed('visitas', { usuario_id: c.id, estado, compita_id: 'x' })
const msg = (v: any, origen: string, cuando: string) => db.seed('mensajes', { visit_id: v.id, origen, tipo: 'texto', contenido: 'hola', created_at: cuando })
const t = (min: number) => new Date(Date.now() + min * 60_000).toISOString()

describe('mensajes sin leer', () => {
  test('cuenta lo del compita y del equipo, no lo que escribió el propio cliente', async () => {
    const c = mkCliente(); const v = visita(c)
    msg(v, 'compita', t(-5)); msg(v, 'admin', t(-4)); msg(v, 'cliente', t(-3))
    assert.equal(await contarMensajesSinLeer(c.id), 2)
  })
  test('al marcar leído queda en cero y solo cuentan los posteriores', async () => {
    const c = mkCliente(); const v = visita(c)
    msg(v, 'compita', t(-5)); await marcarChatLeido(c.id)
    assert.equal(await contarMensajesSinLeer(c.id), 0)
    msg(v, 'compita', t(5)); assert.equal(await contarMensajesSinLeer(c.id), 1)
  })
  test('no cuenta mensajes de otro cliente ni de una visita ya terminada', async () => {
    const a = mkCliente(), b = mkCliente(); msg(visita(b), 'compita', t(-1)); msg(visita(a, 'terminada'), 'compita', t(-1))
    assert.equal(await contarMensajesSinLeer(a.id), 0)
  })
  test('la ruta marca leído solo a quien llama y pide sesión', async () => {
    const a = mkCliente(), b = mkCliente()
    session.user = null; assert.equal((await leido()).status, 401)
    msg(visita(a), 'compita', t(-1)); msg(visita(b), 'compita', t(-1))
    session.user = { id: a.id, email: a.email }; assert.equal((await leido()).status, 200)
    assert.equal(await contarMensajesSinLeer(a.id), 0); assert.equal(await contarMensajesSinLeer(b.id), 1)
  })
  test('el portal suma mensajes y novedades, y Visitas lo marca todo leído', () => {
    const page = readFileSync('app/portal/page.tsx', 'utf8')
    assert.match(page, /marcarChatLeido\(uid\)/); assert.match(page, /contarMensajesSinLeer\(uid\)/)
    assert.match(readFileSync('components/ui/NovedadesEnVivo.tsx', 'utf8'), /table: 'mensajes'/)
    assert.match(readFileSync('components/ui/Chat.tsx', 'utf8'), /api\/portal\/chat\/leido/)
  })
})
