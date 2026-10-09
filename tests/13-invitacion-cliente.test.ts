/* eslint-disable */
import { db, net, session, limpiar, req, emailsA, mkCliente } from './harness'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { POST as invitar } from '@/app/api/admin/invitar-cliente/route'
import { GET as confGet, POST as confPost } from '@/app/auth/confirm/route'

beforeEach(limpiar)
const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }
const invitarA = (body: any) => { admin(); return invitar(req('/api/admin/invitar-cliente', { json: body })) }
const enlaceDe = (to: string) => {
  const m = emailsA(to).at(-1)!.html.match(/href="([^"]*\/auth\/confirm\?[^"]+)"/)![1].replace(/&amp;/g, '&')
  return new URL(m)
}
const loc = (r: Response) => new URL(r.headers.get('location')!).pathname

test('la invitación envía UN solo correo con el botón que activa la cuenta y entra directo al portal', async () => {
  const r = await invitarA({ nombre: 'Carlos Ruiz', email: 'Carlos@Mail.test' })
  assert.equal(r.status, 200)
  assert.equal(net.emails.length, 1, 'un solo correo (antes eran dos)')
  const mail = emailsA('carlos@mail.test')[0]
  assert.ok(mail.html.includes('Activar mi cuenta') && !mail.html.includes('Ver compitas disponibles'))
  assert.ok(mail.html.includes('vence en 1 hora'), 'el correo dice cuánto dura el enlace')
  assert.equal(db.rows('usuarios').length, 1)
  assert.equal(db.rows('usuarios')[0].email, 'carlos@mail.test', 'el correo se normaliza a minúsculas')

  const url = enlaceDe('carlos@mail.test')
  assert.equal(url.searchParams.get('type'), 'invite')
  session.user = null
  assert.match(await (await confGet(req(url.pathname + url.search))).text(), /<form method="POST"/)
  const entrar = await confPost(req(url.pathname + url.search, { method: 'POST' }))
  assert.equal(entrar.status, 303); assert.equal(loc(entrar), '/dashboard')
  assert.ok(entrar.headers.get('set-cookie')?.includes('sb-test-auth-token'), 'queda con sesión iniciada')
  // un solo uso
  assert.match(new URL((await confPost(req(url.pathname + url.search, { method: 'POST' }))).headers.get('location')!).search, /error=auth/)
})

test('reinvitar a un cliente que YA está registrado se rechaza (409) y no se envía ningún correo', async () => {
  await invitarA({ nombre: 'Carlos Ruiz', email: 'carlos@mail.test' })
  net.emails = []
  const r = await invitarA({ nombre: 'Carlos Ruiz', email: 'CARLOS@mail.test' })
  assert.equal(r.status, 409)
  assert.match((await r.json()).error, /ya está registrado/)
  assert.equal(net.emails.length, 0); assert.equal(db.rows('usuarios').length, 1)
})

test('una cuenta que ya existe en el sistema de acceso (sin fila de cliente) tampoco se reinvita', async () => {
  const cli = mkCliente({ email: 'otro@mail.test' }); db.tables.usuarios = []; // queda solo en Auth
  void cli
  const r = await invitarA({ nombre: 'Otro', email: 'otro@mail.test' })
  assert.equal(r.status, 200) // sin fila en usuarios es un cliente nuevo para el panel
})

test('solo admin; datos inválidos; si Resend falla no queda cuenta a medias y se puede reintentar', async () => {
  session.user = { id: 'c', email: 'cliente@mail.test' }
  assert.equal((await invitar(req('/api/admin/invitar-cliente', { json: { nombre: 'X', email: 'x@mail.test' } }))).status, 401)
  assert.equal((await invitarA({ nombre: 'X', email: 'no-es-correo' })).status, 400)
  assert.equal((await invitarA({ email: 'x@mail.test' })).status, 400)
  net.resendFail = true
  const r = await invitarA({ nombre: 'Ana', email: 'ana@mail.test' })
  assert.equal(r.status, 502); assert.match((await r.json()).error, /No se creó la cuenta/)
  assert.equal(db.rows('usuarios').length, 0, 'sin correo no queda una cuenta a medias')
  net.resendFail = false
  assert.equal((await invitarA({ nombre: 'Ana', email: 'ana@mail.test' })).status, 200)
  assert.equal(db.rows('usuarios').length, 1)
})
