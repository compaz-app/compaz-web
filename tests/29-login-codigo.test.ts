/* eslint-disable */
// Paso 3.1: ciclo de login. El correo trae un código numérico además del enlace (sirve si el enlace se abrió
// en otra app o teléfono), el límite de espera es visible (antes era silencioso), un enlace nuevo invalida el
// anterior (comprobado contra Supabase real) y quien ya tiene sesión entra directo.
import { db, net, session, limpiar, req, mkCliente, emailsA } from './harness'
import { otps } from './fake-supabase-server'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as solicitar } from '@/app/api/auth/solicitar-acceso/route'
import { POST as verificar } from '@/app/api/auth/verificar-codigo/route'
import { POST as confPost } from '@/app/auth/confirm/route'
import LoginPage from '@/app/login/page'

beforeEach(() => { limpiar(); otps.clear() })

const pedir = (email: string, ip = '1.1.1.1', returnTo?: string) =>
  solicitar(req('/api/auth/solicitar-acceso', { json: { email, ...(returnTo ? { returnTo } : {}) }, headers: { 'x-nf-client-connection-ip': ip } }))
const verifica = (body: any, ip = '2.2.2.2') =>
  verificar(req('/api/auth/verificar-codigo', { json: body, headers: { 'x-nf-client-connection-ip': ip } }))
const codigoDe = (to: string) => emailsA(to).at(-1)!.html.match(/letter-spacing:6px;margin:0">(\d+)</)![1]
const enlaceDe = (to: string) => new URL(emailsA(to).at(-1)!.html.match(/href="([^"]*\/auth\/confirm\?[^"]+)"/)![1].replace(/&amp;/g, '&'))
const sinThrottle = (email: string) => { const f = db.rows('telegram_estados').find((e) => e.chat_id === `acc_mail:${email}`); if (f) f.updated_at = new Date(Date.now() - 120_000).toISOString() }

describe('el correo de acceso', () => {
  test('trae el enlace y un código de 8 dígitos, y pide usar siempre el correo más reciente', async () => {
    mkCliente({ email: 'carlos@mail.test', nombre: 'Carlos Ruiz' })
    await pedir('carlos@mail.test')
    const html = emailsA('carlos@mail.test')[0].html
    assert.match(html, /\/auth\/confirm\?token_hash=/)
    assert.match(codigoDe('carlos@mail.test'), /^\d{8}$/)
    assert.match(html, /otra app o en otro teléfono/)
    assert.match(html, /usa siempre el correo más reciente/)
  })

  test('un enlace nuevo invalida el anterior: el viejo ya no entra y el nuevo sí', async () => {
    mkCliente({ email: 'carlos@mail.test' })
    await pedir('carlos@mail.test')
    const viejo = enlaceDe('carlos@mail.test'); const codigoViejo = codigoDe('carlos@mail.test')
    sinThrottle('carlos@mail.test')
    await pedir('carlos@mail.test')
    const nuevo = enlaceDe('carlos@mail.test')
    session.user = null
    const rViejo = await confPost(req(viejo.pathname + viejo.search, { method: 'POST' }))
    assert.match(rViejo.headers.get('location')!, /\/login\?error=auth&motivo=verificacion/)
    assert.equal((await verifica({ email: 'carlos@mail.test', codigo: codigoViejo })).status, 400, 'el código viejo tampoco sirve')
    const rNuevo = await confPost(req(nuevo.pathname + nuevo.search, { method: 'POST' }))
    assert.equal(new URL(rNuevo.headers.get('location')!).pathname, '/dashboard')
  })
})

describe('espera visible para pedir otro correo', () => {
  test('el primer envío informa 60 segundos', async () => {
    mkCliente({ email: 'carlos@mail.test' })
    assert.deepEqual((await (await pedir('carlos@mail.test')).json()).data, { enviado: true, espera: 60 })
  })

  test('repetir antes de tiempo no manda otro correo y dice cuánto falta', async () => {
    mkCliente({ email: 'carlos@mail.test' })
    await pedir('carlos@mail.test')
    const d = (await (await pedir('carlos@mail.test')).json()).data
    assert.equal(d.enviado, true)
    assert.ok(d.espera >= 1 && d.espera <= 60, `espera=${d.espera}`)
    assert.equal(emailsA('carlos@mail.test').length, 1, 'no se mandó otro')
  })

  test('un correo desconocido también recibe una espera, así no se revela quién existe', async () => {
    const d = (await (await pedir('intruso@mail.test')).json()).data
    assert.deepEqual(d, { enviado: true, espera: 60 })
    assert.equal(net.emails.length, 0)
  })
})

describe('entrar con el código', () => {
  const clienteConCodigo = async (email = 'carlos@mail.test') => {
    const cli = mkCliente({ email, activado: false })
    await pedir(email)
    return { cli, codigo: codigoDe(email) }
  }

  test('el código correcto crea la sesión, activa la cuenta y lleva al portal', async () => {
    const { cli, codigo } = await clienteConCodigo()
    const r = await verifica({ email: 'carlos@mail.test', codigo })
    assert.equal(r.status, 200)
    assert.equal((await r.json()).data.destino, '/dashboard')
    assert.ok(r.headers.get('set-cookie')?.includes('sb-test-auth-token'), 'deja la sesión en cookies')
    assert.equal(db.rows('usuarios').find((u) => u.id === cli.id)!.activado, true)
  })

  test('lleva a donde iba (returnTo) y nunca a un sitio externo', async () => {
    const { codigo } = await clienteConCodigo()
    const r = await verifica({ email: 'carlos@mail.test', codigo, returnTo: '/pago?solicitud=abc' })
    assert.equal((await r.json()).data.destino, '/pago?solicitud=abc')
    const { codigo: otro } = await clienteConCodigo('ana@mail.test')
    const r2 = await verifica({ email: 'ana@mail.test', codigo: otro, returnTo: '//evil.com' })
    assert.equal((await r2.json()).data.destino, '/dashboard')
  })

  test('el admin entra a /admin', async () => {
    await pedir('admin@compaz.test')
    const r = await verifica({ email: 'admin@compaz.test', codigo: codigoDe('admin@compaz.test') })
    assert.equal((await r.json()).data.destino, '/admin')
  })

  test('acepta el código escrito con espacios', async () => {
    const { codigo } = await clienteConCodigo()
    const r = await verifica({ email: 'carlos@mail.test', codigo: `${codigo.slice(0, 4)} ${codigo.slice(4)}` })
    assert.equal(r.status, 200)
  })

  test('un código incorrecto o ya usado se rechaza con un mensaje genérico', async () => {
    const { codigo } = await clienteConCodigo()
    const mal = await verifica({ email: 'carlos@mail.test', codigo: codigo === '11111111' ? '22222222' : '11111111' })
    assert.equal(mal.status, 400)
    assert.match((await mal.json()).error, /no es válido o ya venció/)
    assert.equal((await verifica({ email: 'carlos@mail.test', codigo })).status, 200)
    assert.equal((await verifica({ email: 'carlos@mail.test', codigo })).status, 400, 'un código sirve una sola vez')
  })

  test('formatos inválidos se rechazan sin consultar nada', async () => {
    for (const codigo of ['', 'abcdefgh', '123', '12345678901234']) assert.equal((await verifica({ email: 'carlos@mail.test', codigo })).status, 400, codigo)
    assert.equal((await verifica({ email: 'no-es-correo', codigo: '12345678' })).status, 400)
  })

  test('tras 5 fallos se bloquea el correo, aunque después llegue el código correcto', async () => {
    const { codigo } = await clienteConCodigo()
    for (let i = 0; i < 5; i++) assert.equal((await verifica({ email: 'carlos@mail.test', codigo: '00000000' })).status, 400)
    const r = await verifica({ email: 'carlos@mail.test', codigo })
    assert.equal(r.status, 429)
    assert.equal(db.rows('usuarios')[0].activado, false, 'no entró')
  })

  test('el límite por IP frena probar muchos correos', async () => {
    for (let i = 0; i < 30; i++) await verifica({ email: `x${i}@mail.test`, codigo: '00000000' }, '9.9.9.9')
    assert.equal((await verifica({ email: 'y@mail.test', codigo: '00000000' }, '9.9.9.9')).status, 429)
  })

  test('una cuenta suspendida no entra con código', async () => {
    mkCliente({ email: 'carlos@mail.test', plan: 'bloqueado' })
    otps.set('hx', { id: db.rows('usuarios')[0].id, email: 'carlos@mail.test', usado: false, codigo: '12345678' })
    const r = await verifica({ email: 'carlos@mail.test', codigo: '12345678' })
    assert.equal(r.status, 403)
  })

  test('una persona sin invitación (sin fila en usuarios) no entra con código', async () => {
    otps.set('hy', { id: 'sin-fila', email: 'intruso@mail.test', usado: false, codigo: '12345678' })
    assert.equal((await verifica({ email: 'intruso@mail.test', codigo: '12345678' })).status, 403)
  })
})

describe('quien ya tiene sesión entra directo desde /login', () => {
  const destinoDe = async (params: any) => {
    try { await LoginPage({ searchParams: Promise.resolve(params) }) } catch (e: any) { return String(e.digest).split(';')[2] }
    return null
  }

  test('un cliente con sesión va a su portal, o a donde iba', async () => {
    const cli = mkCliente({ email: 'carlos@mail.test' })
    session.user = { id: cli.id, email: cli.email }
    assert.equal(await destinoDe({}), '/dashboard')
    assert.equal(await destinoDe({ returnTo: '/pago?solicitud=abc' }), '/pago?solicitud=abc')
    assert.equal(await destinoDe({ returnTo: '//evil.com' }), '/dashboard')
  })

  test('el admin con sesión va a /admin', async () => {
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    assert.equal(await destinoDe({ returnTo: '/dashboard' }), '/admin')
  })
})
