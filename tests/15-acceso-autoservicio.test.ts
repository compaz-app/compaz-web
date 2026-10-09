/* eslint-disable */
import { NextRequest } from 'next/server'
import { db, net, session, limpiar, req, emailsA, ahoraMas, mkCliente, mkCompita } from './harness'
import { otps } from './fake-supabase-server'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { POST as solicitar } from '@/app/api/auth/solicitar-acceso/route'
import { POST as invitar } from '@/app/api/admin/invitar-cliente/route'
import { POST as confPost } from '@/app/auth/confirm/route'
import { POST as rapidoPost } from '@/app/api/admin/asignar-rapido/route'

beforeEach(() => { limpiar(); otps.clear() })
const pedir = (email: any, ip = '1.1.1.1') => solicitar(req('/api/auth/solicitar-acceso', { json: { email }, headers: { 'x-nf-client-connection-ip': ip } }))
const enlace = (to: string) => new URL(emailsA(to).at(-1)!.html.match(/href="([^"]*\/auth\/confirm\?[^"]+)"/)![1].replace(/&amp;/g, '&'))
const entrar = async (u: URL) => { session.user = null; const r = await confPost(req(u.pathname + u.search, { method: 'POST' })); return new URL(r.headers.get('location')!).pathname }

test('un correo desconocido recibe la MISMA respuesta y no se crea nada (no revela quién existe)', async () => {
  const r = await pedir('intruso@mail.test')
  assert.equal(r.status, 200); assert.deepEqual((await r.json()).data, { enviado: true })
  assert.equal(net.emails.length, 0); assert.equal(otps.size, 0, 'no se generó enlace ni se creó usuario')
})

test('cliente invitado: recibe un enlace nuevo que lo deja entrar, sin escribir a nadie', async () => {
  mkCliente({ email: 'carlos@mail.test', nombre: 'Carlos Ruiz' })
  assert.equal((await pedir('Carlos@Mail.test')).status, 200)
  const mail = emailsA('carlos@mail.test')[0]
  assert.ok(mail.html.includes('vence en 1 hora'))
  assert.equal(await entrar(enlace('carlos@mail.test')), '/dashboard')
})

test('INVITACIÓN VENCIDA o sin activar: el cliente pide otro enlace solo y entra', async () => {
  session.user = { id: 'adm', email: 'admin@compaz.test' }
  await invitar(req('/api/admin/invitar-cliente', { json: { nombre: 'Ana López', email: 'ana@mail.test' } }))
  const viejo = enlace('ana@mail.test')
  otps.forEach((o) => (o.usado = true)) // el enlace de la invitación venció / ya se gastó
  assert.match(await entrar(viejo), /^\/login/)
  net.emails = []
  await pedir('ana@mail.test', '2.2.2.2')
  assert.equal(await entrar(enlace('ana@mail.test')), '/dashboard')
})

test('el admin también puede pedir su acceso aunque no tenga fila de cliente', async () => {
  await pedir('admin@compaz.test')
  assert.equal(await entrar(enlace('admin@compaz.test')), '/admin')
})

test('límites: 1 correo por minuto por dirección y 10 solicitudes por hora por IP', async () => {
  mkCliente({ email: 'carlos@mail.test' })
  await pedir('carlos@mail.test'); await pedir('carlos@mail.test')
  assert.equal(emailsA('carlos@mail.test').length, 1)
  for (let i = 0; i < 8; i++) await pedir(`otro${i}@mail.test`, '3.3.3.3')
  assert.equal((await pedir('otro9@mail.test', '3.3.3.3')).status, 200)
  assert.equal((await pedir('otro10@mail.test', '3.3.3.3')).status, 200)
  assert.equal((await pedir('otro11@mail.test', '3.3.3.3')).status, 429)
  assert.equal((await pedir('otro12@mail.test', '4.4.4.4')).status, 200, 'otra IP no se ve afectada')
})

test('validaciones y Resend caído (respuesta genérica, sin filtrar el fallo)', async () => {
  assert.equal((await pedir('no-es-correo')).status, 400)
  assert.equal((await solicitar(req('/api/auth/solicitar-acceso', { json: {} }))).status, 400)
  mkCliente({ email: 'carlos@mail.test' }); net.resendFail = true
  const r = await pedir('carlos@mail.test', '5.5.5.5')
  assert.equal(r.status, 200); assert.deepEqual((await r.json()).data, { enviado: true })
})

test('REDIRECCIÓN: detrás de Netlify se usa la dirección pública, no la interna del despliegue', async () => {
  const cli = mkCliente({ email: 'carlos@mail.test' })
  otps.set('hx', { id: cli.id, email: cli.email, usado: false })
  const interno = new NextRequest('https://main--compaz-beta.netlify.app/auth/confirm?token_hash=hx&type=email', { method: 'POST' })
  const r = await confPost(interno)
  const loc = new URL(r.headers.get('location')!)
  assert.equal(loc.host, 'micompaz.test'); assert.equal(loc.pathname, '/dashboard')
  // el mismo error con enlace gastado también vuelve al dominio público
  const r2 = await confPost(new NextRequest('https://main--compaz-beta.netlify.app/auth/confirm?token_hash=hx&type=email', { method: 'POST' }))
  assert.equal(new URL(r2.headers.get('location')!).host, 'micompaz.test')
  // y la asignación rápida del admin
  const c = mkCompita({ telegram_chat_id: '9100' })
  db.seed('action_tokens', { token: 'tk', cliente_id: cli.id, compita_id: c.id, expires_at: ahoraMas(100) })
  const r3 = await rapidoPost(new NextRequest('https://main--compaz-beta.netlify.app/api/admin/asignar-rapido?token=tk', { method: 'POST' }))
  assert.equal(new URL(r3.headers.get('location')!).host, 'micompaz.test')
})
