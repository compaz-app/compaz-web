/* eslint-disable */
// Un cliente invitado NO cuenta como cliente hasta abrir el correo y activar su cuenta: no sale en Clientes ni en Seguimiento, se ve en Más, Invitar y se le puede reenviar.
import { db, net, session, limpiar, req, emailsA, mkCliente } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as invitar } from '@/app/api/admin/invitar-cliente/route'
import { POST as confPost } from '@/app/auth/confirm/route'
import { listarClientes } from '@/lib/panel-personas'
import { listarSeguimiento } from '@/lib/panel-seguimiento'
import { listarInvitadosPendientes } from '@/lib/panel-invitaciones'

beforeEach(limpiar)
const invitarA = (nombre: string, email: string) => { session.user = { id: 'adm', email: 'admin@compaz.test' }; return invitar(req('/api/admin/invitar-cliente', { json: { nombre, email } })) }
const enlaceDe = (to: string) => new URL(emailsA(to).at(-1)!.html.match(/href="([^"]*\/auth\/confirm\?[^"]+)"/)![1].replace(/&amp;/g, '&'))

describe('invitado pendiente', () => {
  test('al invitar queda como invitado (activado = false): no es cliente ni sale en Seguimiento, sí en la lista de invitados', async () => {
    assert.equal((await invitarA('Carlos Ruiz', 'carlos@mail.test')).status, 200)
    assert.equal(db.rows('usuarios')[0].activado, false)
    assert.equal((await listarClientes()).length, 0)
    assert.equal((await listarSeguimiento(new Date(Date.now() + 99 * 86_400_000))).length, 0)
    const inv = await listarInvitadosPendientes()
    assert.equal(inv.length, 1); assert.equal(inv[0].nombre, 'Carlos Ruiz'); assert.equal(inv[0].correo, 'carlos@mail.test')
  })
  test('al abrir el correo y activar su cuenta pasa a ser cliente y deja de ser invitado', async () => {
    await invitarA('Carlos Ruiz', 'carlos@mail.test')
    const url = enlaceDe('carlos@mail.test'); session.user = null
    assert.equal((await confPost(req(url.pathname + url.search, { method: 'POST' }))).status, 303)
    assert.equal(db.rows('usuarios')[0].activado, true)
    assert.equal((await listarClientes()).length, 1); assert.equal((await listarInvitadosPendientes()).length, 0)
  })
  test('los clientes que ya existían (sin la marca) y los activados siguen apareciendo', async () => {
    mkCliente({ activado: true }); mkCliente()
    assert.equal((await listarClientes()).length, 2)
  })
})

describe('reenviar la invitación', () => {
  test('invitar otra vez a un invitado sin activar le manda un enlace nuevo (200, reenviada); el anterior deja de servir; sigue siendo una sola fila', async () => {
    await invitarA('Carlos Ruiz', 'carlos@mail.test')
    const viejo = enlaceDe('carlos@mail.test')
    net.emails = []
    const r = await invitarA('Carlos Ruiz', 'CARLOS@mail.test')
    assert.equal(r.status, 200); assert.equal((await r.json()).data.reenviada, true)
    assert.equal(emailsA('carlos@mail.test').length, 1, 'un correo'); assert.equal(db.rows('usuarios').length, 1)
    session.user = null
    assert.match(new URL((await confPost(req(viejo.pathname + viejo.search, { method: 'POST' }))).headers.get('location')!).search, /error=auth/, 'el enlace viejo ya no sirve')
    const nuevo = enlaceDe('carlos@mail.test')
    assert.equal((await confPost(req(nuevo.pathname + nuevo.search, { method: 'POST' }))).status, 303)
    assert.equal(db.rows('usuarios')[0].activado, true)
  })
  test('quien ya activó su cuenta sigue sin poder reinvitarse (409), y si el correo del reenvío falla se dice sin tocar la cuenta', async () => {
    await invitarA('Carlos Ruiz', 'carlos@mail.test')
    net.resendFail = true
    const falla = await invitarA('Carlos Ruiz', 'carlos@mail.test'); assert.equal(falla.status, 502); assert.equal(db.rows('usuarios').length, 1, 'no se borra al invitado')
    net.resendFail = false
    db.rows('usuarios')[0].activado = true
    assert.equal((await invitarA('Carlos Ruiz', 'carlos@mail.test')).status, 409)
  })
  test('la pantalla Invitar muestra los invitados sin activar con su botón Reenviar', () => {
    const { readFileSync } = require('node:fs')
    const f = readFileSync('components/panel/mas/Invitar.tsx', 'utf8'); assert.match(f, /Invitados sin activar/); assert.match(f, /Reenviar/)
    assert.match(readFileSync('app/panel/page.tsx', 'utf8'), /<Invitar pendientes=\{await listarInvitadosPendientes\(\)\}/)
  })
})
