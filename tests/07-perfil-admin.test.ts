/* eslint-disable */
import { db, net, session, limpiar, req, tgText, ultimoTg, tgPara, emailsA, ahoraMas, mkCompita, mkCliente, mkSolicitud, mkVisita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { GET as perfilGet, PUT as perfilPut } from '@/app/api/compita/perfil/route'
import { POST as registrar } from '@/app/api/onboarding/registrar/route'
import { POST as asignarCompita } from '@/app/api/admin/asignar-compita/route'
import { GET as rapidoGet, POST as rapidoPost } from '@/app/api/admin/asignar-rapido/route'
import { POST as toggleVerificado } from '@/app/api/admin/toggle-verificado/route'
import { POST as toggleEstado } from '@/app/api/admin/toggle-estado/route'
import { POST as bloquearCliente } from '@/app/api/admin/bloquear-cliente/route'
import { POST as registrarCompita } from '@/app/api/admin/registrar-compita/route'
import { PUT as adminCompita } from '@/app/api/admin/compita/route'
import { POST as flagsPost } from '@/app/api/admin/flags/route'
import { POST as meInteresa } from '@/app/api/me-interesa/route'
import { POST as solicitudes } from '@/app/api/solicitudes/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { generarTokenPerfil } from '@/lib/compita-tokens'
import { actualizarCompita } from '@/lib/compitas'

beforeEach(limpiar)
const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }
const noAdmin = () => { session.user = { id: 'cli', email: 'cliente@mail.test' } }
const foto = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fotos/compitas/a.jpg`

describe('Edición de perfil de la compita (enlace de Telegram)', () => {
  test('ASIGNACIÓN MASIVA bloqueada: verificado/estado/rating/chat NO se pueden auto-asignar', async () => {
    const c = mkCompita({ verificado: false, estado: 'activo', telegram_chat_id: '1000', nombre: 'Original' })
    const token = await generarTokenPerfil(c.id)
    const r = await perfilPut(req('/api/compita/perfil', { method: 'PUT', json: {
      token, descripcion: 'Nueva descripción', verificado: true, estado: 'bloqueado', rating_promedio: 5, total_ratings: 99,
      visitas_realizadas: 500, telegram_chat_id: 'robado', nombre: 'Hack', codigo: 'X', email: 'x@y.z',
    } }))
    assert.equal(r.status, 200)
    assert.equal(c.descripcion, 'Nueva descripción')
    assert.equal(c.verificado, false); assert.equal(c.estado, 'activo'); assert.equal(c.rating_promedio, null)
    assert.equal(c.total_ratings, 0); assert.equal(c.visitas_realizadas, 0); assert.equal(c.telegram_chat_id, '1000')
    assert.equal(c.nombre, 'Original', 'el nombre solo lo cambia el admin')
    assert.ok(tgPara(1000).some((m) => m.text.includes('perfil fue actualizado')))
  })

  test('datos inválidos NO queman el enlace; un fallo de BD lo restaura; un enlace usado/expirado no sirve', async () => {
    const c = mkCompita(); const token = await generarTokenPerfil(c.id)
    assert.equal((await perfilPut(req('/api/compita/perfil', { method: 'PUT', json: { token, youtube_url: 'https://evil.com/x' } }))).status, 400)
    assert.equal((await perfilPut(req('/api/compita/perfil', { method: 'PUT', json: { token, foto_url: 'https://tracker.evil/p.png' } }))).status, 400)
    assert.equal(db.rows('compita_edit_tokens')[0].usado, false)
    db.fail['compitas:update'] = 1
    assert.equal((await perfilPut(req('/api/compita/perfil', { method: 'PUT', json: { token, descripcion: 'x' } }))).status, 500)
    assert.equal(db.rows('compita_edit_tokens')[0].usado, false, 'la compita conserva su enlace tras un fallo nuestro')
    assert.equal((await perfilPut(req('/api/compita/perfil', { method: 'PUT', json: { token, descripcion: 'ok', foto_url: foto } }))).status, 200)
    assert.equal((await perfilPut(req('/api/compita/perfil', { method: 'PUT', json: { token, descripcion: 'otra' } }))).status, 401, 'un solo uso')
    const t2 = await generarTokenPerfil(c.id)
    db.rows('compita_edit_tokens').find((t) => t.token === t2)!.expires_at = new Date(Date.now() - 1000).toISOString()
    assert.equal((await perfilPut(req('/api/compita/perfil', { method: 'PUT', json: { token: t2, descripcion: 'x' } }))).status, 401, 'expirado')
  })

  test('GET perfil con token inválido → 401', async () => {
    assert.equal((await perfilGet(req('/api/compita/perfil?token=nope'))).status, 401)
  })
})

describe('Capa de datos', () => {
  test('actualizarCompita aplica whitelist aunque la ruta falle en validar (defensa en profundidad)', async () => {
    const c = mkCompita({ verificado: false })
    await actualizarCompita(c.id, { descripcion: 'ok', verificado: true, estado: 'bloqueado', rating_promedio: 5 } as any)
    assert.equal(c.descripcion, 'ok'); assert.equal(c.verificado, false); assert.equal(c.estado, 'activo'); assert.equal(c.rating_promedio, null)
    await assert.rejects(() => actualizarCompita(c.id, { verificado: true } as any), /Sin campos válidos/)
  })
})

describe('Onboarding de compita (invitación del admin)', () => {
  const invitacion = () => db.seed('onboarding_tokens', { token: 'tok-inv', expires_at: ahoraMas(60 * 24) })
  const cuerpo = (o: any = {}) => ({ token: 'tok-inv', nombre: 'Rosa <b>Díaz', email: 'rosa@mail.test', zona: 'Zulia', descripcion: 'Cuidadora con 10 años', servicios: ['Compañía'], ...o })

  test('registro OK: queda activa SIN verificar; el token es de un solo uso; el nombre con HTML se escapa en el correo', async () => {
    invitacion()
    assert.equal((await registrar(req('/api/onboarding/registrar', { json: cuerpo() }))).status, 200)
    const c = db.rows('compitas')[0]
    assert.equal(c.verificado, false); assert.equal(c.estado, 'activo')
    assert.ok(!emailsA('rosa@mail.test')[0].html.includes('<b>Díaz'))
    assert.equal((await registrar(req('/api/onboarding/registrar', { json: cuerpo({ nombre: 'Otra' }) }))).status, 400)
    assert.equal(db.rows('compitas').length, 1)
  })

  test('validaciones y fallo de BD (el token se libera para reintentar)', async () => {
    invitacion()
    assert.equal((await registrar(req('/api/onboarding/registrar', { json: cuerpo({ youtube_url: 'https://evil.com' }) }))).status, 400)
    assert.equal((await registrar(req('/api/onboarding/registrar', { json: cuerpo({ email: 'no-es-email' }) }))).status, 400)
    assert.equal((await registrar(req('/api/onboarding/registrar', { json: cuerpo({ token: 'inventado' }) }))).status, 400)
    assert.equal(db.rows('onboarding_tokens')[0].usado, false, 'validar primero: no se quema')
    db.fail['compitas:insert'] = 1
    assert.equal((await registrar(req('/api/onboarding/registrar', { json: cuerpo() }))).status, 500)
    assert.equal(db.rows('onboarding_tokens')[0].usado, false, 'token liberado tras fallo')
    assert.equal((await registrar(req('/api/onboarding/registrar', { json: cuerpo() }))).status, 200)
  })
})

describe('Panel admin', () => {
  test('rutas protegidas: sin sesión o como cliente → 401', async () => {
    const c = mkCompita(); const cli = mkCliente()
    for (const tryAs of [() => { session.user = null }, noAdmin]) {
      tryAs()
      assert.equal((await toggleVerificado(req('/api/admin/toggle-verificado', { json: { compita_id: c.id, verificado: true } }))).status, 401)
      assert.equal((await toggleEstado(req('/api/admin/toggle-estado', { json: { compita_id: c.id, estado: 'activo' } }))).status, 401)
      assert.equal((await bloquearCliente(req('/api/admin/bloquear-cliente', { json: { usuario_id: cli.id, bloquear: true } }))).status, 401)
      assert.equal((await asignarCompita(req('/api/admin/asignar-compita', { json: { usuario_id: cli.id, compita_id: c.id } }))).status, 401)
      assert.equal((await registrarCompita(req('/api/admin/registrar-compita', { json: {} }))).status, 401)
      assert.equal((await adminCompita(req('/api/admin/compita', { method: 'PUT', json: { id: c.id, verificado: true } }))).status, 401)
      assert.equal((await flagsPost(req('/api/admin/flags', { json: {} }))).status, 401)
    }
  })

  test('verificar una compita nueva la deja visible (activa + verificada); verificar NO desbloquea a una bloqueada', async () => {
    const c = mkCompita({ estado: 'inactivo', verificado: false }); admin()
    await toggleVerificado(req('/api/admin/toggle-verificado', { json: { compita_id: c.id, verificado: true } }))
    assert.equal(c.estado, 'activo'); assert.equal(c.verificado, true)
    const b = mkCompita({ estado: 'bloqueado', verificado: false })
    await toggleVerificado(req('/api/admin/toggle-verificado', { json: { compita_id: b.id, verificado: true } }))
    assert.equal(b.estado, 'bloqueado'); assert.equal(b.verificado, false)
    await toggleEstado(req('/api/admin/toggle-estado', { json: { compita_id: b.id, estado: 'activo' } }))
    assert.equal(b.estado, 'bloqueado', 'reactivar tampoco desbloquea')
  })

  test('asignar compita: exige compita activa y verificada; crea la visita de coordinación; se puede desasignar', async () => {
    const cli = mkCliente(); const mala = mkCompita({ verificado: false }); const buena = mkCompita(); admin()
    assert.equal((await asignarCompita(req('/api/admin/asignar-compita', { json: { usuario_id: cli.id, compita_id: mala.id } }))).status, 409)
    assert.equal(cli.compita_id, null)
    assert.equal((await asignarCompita(req('/api/admin/asignar-compita', { json: { usuario_id: cli.id, compita_id: buena.id } }))).status, 200)
    assert.equal(cli.compita_id, buena.id)
    assert.equal(db.rows('visitas').filter((v) => v.estado === 'pre_visita').length, 1)
    await asignarCompita(req('/api/admin/asignar-compita', { json: { usuario_id: cli.id, compita_id: buena.id } }))
    assert.equal(db.rows('visitas').length, 1, 'idempotente: no duplica la visita')
    await asignarCompita(req('/api/admin/asignar-compita', { json: { usuario_id: cli.id, compita_id: '' } }))
    assert.equal(cli.compita_id, null)
  })

  test('asignar-rapido: el GET (previsualizador de Telegram/correo) NO consume el token; el POST asigna una sola vez', async () => {
    const cli = mkCliente({ email: 'cli@mail.test' }); const c = mkCompita({ telegram_chat_id: '1100' })
    db.seed('action_tokens', { token: 'abc', cliente_id: cli.id, compita_id: c.id, expires_at: ahoraMas(1000) })
    const u = '/api/admin/asignar-rapido?token=abc'
    const g = await rapidoGet(req(u)); assert.match(await g.text(), /<form method="POST"/)
    assert.equal(db.rows('action_tokens')[0].usado, false); assert.equal(cli.compita_id, null)
    const r = await rapidoPost(req(u, { method: 'POST' })); assert.equal(r.status, 303)
    assert.equal(cli.compita_id, c.id); assert.equal(emailsA('cli@mail.test').length, 1)
    assert.equal((await rapidoPost(req(u, { method: 'POST' }))).status, 410)
  })

  test('asignar-rapido: si la asignación falla, el token se libera (el admin puede reintentar)', async () => {
    const cli = mkCliente(); const c = mkCompita({ verificado: false })
    db.seed('action_tokens', { token: 'zzz', cliente_id: cli.id, compita_id: c.id, expires_at: ahoraMas(1000) })
    assert.equal((await rapidoPost(req('/api/admin/asignar-rapido?token=zzz', { method: 'POST' }))).status, 409)
    assert.equal(db.rows('action_tokens')[0].usado, false)
  })

  test('bloquear cliente impide pedir entrevistas; desbloquear lo restablece', async () => {
    const cli = mkCliente(); const c = mkCompita(); admin()
    await bloquearCliente(req('/api/admin/bloquear-cliente', { json: { usuario_id: cli.id, bloquear: true } }))
    session.user = { id: cli.id, email: cli.email }
    const body = { compita_id: c.id, mensaje: 'hola', slots_propuestos: [ahoraMas(120)] }
    assert.equal((await solicitudes(req('/api/solicitudes', { json: body }))).status, 403)
    admin(); await bloquearCliente(req('/api/admin/bloquear-cliente', { json: { usuario_id: cli.id, bloquear: false } }))
    session.user = { id: cli.id, email: cli.email }
    assert.equal((await solicitudes(req('/api/solicitudes', { json: body }))).status, 200)
  })

  test('registrar compita (admin): valida y no permite URLs externas de foto/video', async () => {
    admin()
    const ok = { nombre: 'Nora', zona: 'Lara', descripcion: 'x', servicios: ['a'], email: 'nora@mail.test' }
    assert.equal((await registrarCompita(req('/api/admin/registrar-compita', { json: { ...ok, foto_url: 'https://evil/p.png' } }))).status, 400)
    assert.equal((await registrarCompita(req('/api/admin/registrar-compita', { json: { ...ok, email: 'malo' } }))).status, 400)
    assert.equal((await registrarCompita(req('/api/admin/registrar-compita', { json: ok }))).status, 200)
    assert.equal(db.rows('compitas')[0].verificado, false)
  })

  test('flags: el autor sale de la sesión, no del body', async () => {
    admin()
    await flagsPost(req('/api/admin/flags', { json: { entidad_tipo: 'compita', entidad_id: 'x', nota: 'ojo', reportado_por: 'Otra Persona' } }))
    assert.equal(db.rows('admin_flags')[0].reportado_por, 'admin@compaz.test')
  })

  test('me-interesa: usa el nombre de la compita desde la BD (no del body) y no inyecta HTML al admin', async () => {
    const c = mkCompita({ nombre: 'María' }); const cli = mkCliente({ nombre: 'Pepe <b>x' })
    session.user = { id: cli.id, email: cli.email }
    const r = await meInteresa(req('/api/me-interesa', { json: { compita_id: c.id, compita_nombre: '<script>alert(1)</script>' } }))
    assert.equal(r.status, 200)
    const tg = tgPara(999)[0].text
    assert.ok(tg.includes('María') && !tg.includes('<script>'))
    assert.ok(!net.emails[0].html.includes('<script>'))
  })
})

describe('Cuestionario/fuga: casos de Telegram restantes', () => {
  test('dos compitas con el mismo nombre → desambiguación por correo; no se revela cuál es cuál', async () => {
    mkCompita({ nombre: 'Ana López', email: 'ana.uno@mail.test', telegram_chat_id: null }); mkCompita({ nombre: 'Ana López', email: 'ana.dos@mail.test', telegram_chat_id: null })
    await webhook(tgText(1200, '/start')); await webhook(tgText(1200, 'Ana López'))
    assert.match(ultimoTg(1200)!.text, /primeras letras de tu correo/)
    await webhook(tgText(1200, 'ana.dos'))
    assert.equal(emailsA('ana.dos@mail.test').length, 1); assert.equal(emailsA('ana.uno@mail.test').length, 0)
  })
})
