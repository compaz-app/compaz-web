/* eslint-disable */
import { db, limpiar, req, mkCliente } from './harness'
import { otps } from './fake-supabase-server'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { GET as confGet, POST as confPost } from '@/app/auth/confirm/route'

beforeEach(() => { limpiar(); otps.clear() })
const loc = (r: Response) => new URL(r.headers.get('location')!).pathname + new URL(r.headers.get('location')!).search
const url = (t: string, extra = '', type = 'email') => `/auth/confirm?token_hash=${t}&type=${type}${extra}`

test('GET solo muestra el botón: un escáner de correo no consume el enlace', async () => {
  const cli = mkCliente(); otps.set('h1', { id: cli.id, email: cli.email, usado: false })
  const r = await confGet(req(url('h1')))
  assert.match(await r.text(), /<form method="POST"/)
  assert.equal(otps.get('h1')!.usado, false)
})

test('POST: cliente invitado entra a su dashboard con la sesión en cookies (sin depender del navegador)', async () => {
  const cli = mkCliente(); otps.set('h2', { id: cli.id, email: cli.email, usado: false })
  const r = await confPost(req(url('h2'), { method: 'POST' }))
  assert.equal(r.status, 303); assert.equal(loc(r), '/dashboard')
  assert.ok(r.headers.get('set-cookie')?.includes('sb-test-auth-token'))
})

test('POST: el admin va a /admin; el enlace es de un solo uso', async () => {
  otps.set('h3', { id: 'adm', email: 'admin@compaz.test', usado: false })
  assert.equal(loc(await confPost(req(url('h3'), { method: 'POST' }))), '/admin')
  const r2 = await confPost(req(url('h3'), { method: 'POST' }))
  assert.match(loc(r2), /^\/login\?error=auth&motivo=verificacion/)
})

test('POST: una cuenta que no fue invitada (sin fila en usuarios) no entra', async () => {
  otps.set('h4', { id: 'desconocido', email: 'intruso@mail.test', usado: false })
  const r = await confPost(req(url('h4'), { method: 'POST' }))
  assert.equal(loc(r), '/login?error=no-invitado')
  assert.ok(!r.headers.get('set-cookie')?.includes('sb-test-auth-token'), 'no se entrega sesión')
})

test('invitación (type=invite) funciona y "next" externo no permite open redirect', async () => {
  const cli = mkCliente(); otps.set('h5', { id: cli.id, email: cli.email, usado: false })
  assert.equal(loc(await confPost(req(url('h5', '&next=//evil.com', 'invite'), { method: 'POST' }))), '/dashboard')
  otps.set('h6', { id: cli.id, email: cli.email, usado: false })
  assert.equal(loc(await confPost(req(url('h6', '&next=/compitas'), { method: 'POST' }))), '/compitas')
})

test('parámetros inválidos (sin hash, tipo raro) → login con motivo, sin llamar a Supabase', async () => {
  assert.match(loc(await confGet(req('/auth/confirm?type=email'))), /motivo=enlace_invalido/)
  assert.match(loc(await confPost(req('/auth/confirm?token_hash=x&type=admin', { method: 'POST' }))), /motivo=enlace_invalido/)
})
