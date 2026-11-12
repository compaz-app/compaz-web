/* eslint-disable */
// Eliminar mi cuenta: enlace por correo (1 hora, un solo uso) → desactivada ya → borrado a los 7 días → pagos y visitas anonimizados.
import { db, net, limpiar, session, req, mkCliente, mkCompita, mkVisita, tgPara, emailsA, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { solicitarEliminacion, confirmarEliminacion, reactivarCuenta, estadoEliminacion, borrarCuentasVencidas, PLAZO_BORRADO_DIAS } from '@/lib/cuenta-eliminar'
import { getClienteActivo } from '@/lib/auth'
import { destinoTrasLogin } from '@/lib/login-destino'
import { POST as pedir } from '@/app/api/cuenta/eliminar/route'
import { POST as confirmar } from '@/app/api/cuenta/eliminar/confirmar/route'

beforeEach(limpiar)
const DIA = 86_400_000
const tokenDelCorreo = (email: string) => /eliminar\?t=([0-9a-f]{64})/.exec(emailsA(email).at(-1)?.html ?? '')?.[1] ?? ''
const comoCliente = (c: any) => { session.user = { id: c.id, email: c.email } as any }
const fila = (id: string): any => db.rows('usuarios').find((u: any) => u.id === id)

describe('pedir y confirmar', () => {
  test('pedir manda un enlace por correo y NO borra ni desactiva nada todavía', async () => {
    const c = mkCliente(); comoCliente(c)
    const r = await pedir(); assert.equal(r.status, 200)
    assert.match(tokenDelCorreo(c.email), /^[0-9a-f]{64}$/)
    assert.equal(fila(c.id).eliminacion_programada_en ?? null, null)
    assert.ok(await getClienteActivo())
  })
  test('en la base queda solo la HUELLA del enlace, nunca el enlace', async () => {
    const c = mkCliente(); comoCliente(c); await pedir()
    const t = tokenDelCorreo(c.email)
    assert.ok(fila(c.id).eliminar_enlace_hash && fila(c.id).eliminar_enlace_hash !== t)
    assert.ok(!JSON.stringify(db.rows('usuarios')).includes(t))
  })
  test('pedir otra vez enseguida se frena y explica por qué y cuándo (regla del catálogo)', async () => {
    const c = mkCliente(); comoCliente(c); await pedir()
    const r = await pedir(); assert.equal(r.status, 429)
    const d = await r.json(); assert.ok(d.error && d.porQue)
    assert.equal(emailsA(c.email).length, 1)
  })
  test('confirmar desactiva la cuenta ya, programa el borrado a los 7 días y avisa al equipo y al cliente', async () => {
    const c = mkCliente(); comoCliente(c); await pedir()
    const r = await confirmar(req('/api/cuenta/eliminar/confirmar', { method: 'POST', json: { token: tokenDelCorreo(c.email) } })); assert.equal(r.status, 200)
    const dias = (new Date(fila(c.id).eliminacion_programada_en).getTime() - Date.now()) / DIA
    assert.ok(Math.abs(dias - PLAZO_BORRADO_DIAS) < 0.01)
    assert.equal(await getClienteActivo(), null) // sin acceso mientras tanto
    assert.ok(avisosAdmin().some((a: any) => /pidió eliminar su cuenta/.test(a.text)))
    assert.ok(emailsA(c.email).some((e: any) => /se borrará en 7 días/.test(e.subject)))
  })
  test('el enlace se gasta: usarlo dos veces falla; uno inventado o corto también', async () => {
    const c = mkCliente(); comoCliente(c); await pedir(); const t = tokenDelCorreo(c.email)
    assert.equal((await confirmarEliminacion(t)).ok, true)
    assert.deepEqual(await confirmarEliminacion(t), { ok: false, motivo: 'enlace_invalido' })
    assert.deepEqual(await confirmarEliminacion('0'.repeat(64)), { ok: false, motivo: 'enlace_invalido' })
    assert.deepEqual(await confirmarEliminacion('abc'), { ok: false, motivo: 'enlace_invalido' })
  })
  test('el enlace vence a la hora', async () => {
    const c = mkCliente(); await solicitarEliminacion(c.id, new Date(Date.now() - 61 * 60_000))
    assert.deepEqual(await confirmarEliminacion(tokenDelCorreo(c.email)), { ok: false, motivo: 'enlace_vencido' })
    assert.equal(fila(c.id).eliminacion_programada_en ?? null, null)
  })
  test('con una visita en curso no se puede pedir ni confirmar', async () => {
    const c = mkCliente(); const m = mkCompita(); mkVisita(c, m, { estado: 'en_curso' })
    assert.deepEqual(await solicitarEliminacion(c.id), { ok: false, motivo: 'visita_en_vivo' })
    comoCliente(c); assert.equal((await pedir()).status, 409)
  })
  test('si la visita empezó después de pedir el enlace, confirmar tampoco la deja a medias', async () => {
    const c = mkCliente(); const m = mkCompita(); await solicitarEliminacion(c.id)
    mkVisita(c, m, { estado: 'en_curso' })
    assert.deepEqual(await confirmarEliminacion(tokenDelCorreo(c.email)), { ok: false, motivo: 'visita_en_vivo' })
    assert.equal(fila(c.id).eliminacion_programada_en ?? null, null)
  })
  test('sin sesión no se puede pedir', async () => { assert.equal((await pedir()).status, 401) })
})

describe('lo abierto se cancela sin costo', () => {
  test('la visita programada desaparece, queda justificada y el compita se entera sin saber por qué', async () => {
    const c = mkCliente(); const m = mkCompita(); mkVisita(c, m, { estado: 'programada', fecha_programada: '2099-01-01', hora_inicio_programada: '10:00' })
    await solicitarEliminacion(c.id); const r = await confirmarEliminacion(tokenDelCorreo(c.email))
    assert.equal((r as any).visitasCanceladas, 1)
    assert.equal(db.rows('visitas').filter((v: any) => v.usuario_id === c.id).length, 0)
    assert.ok(db.rows('cancelaciones').every((x: any) => x.justificada === true))
    const aviso = tgPara(m.telegram_chat_id).at(-1)?.text ?? ''
    assert.match(aviso, /Se canceló tu próxima visita/); assert.doesNotMatch(aviso, /elimin|tu cuenta/i)
  })
  test('las solicitudes pendientes se rechazan', async () => {
    const c = mkCliente(); const m = mkCompita(); db.seed('solicitudes', { cliente_id: c.id, compita_id: m.id, estado: 'pendiente', mensaje: 'x' })
    await solicitarEliminacion(c.id); await confirmarEliminacion(tokenDelCorreo(c.email))
    assert.equal(db.rows('solicitudes')[0].estado, 'rechazada')
  })
})

describe('reactivar y borrado definitivo', () => {
  test('entrar con su correo dentro del plazo reactiva la cuenta', async () => {
    const c = mkCliente(); await solicitarEliminacion(c.id); await confirmarEliminacion(tokenDelCorreo(c.email))
    assert.equal((await estadoEliminacion(c.id)).desactivada, true)
    assert.equal(await destinoTrasLogin(c.id, c.email, '/portal'), '/portal')
    assert.equal((await estadoEliminacion(c.id)).desactivada, false)
    comoCliente(c); assert.ok(await getClienteActivo())
  })
  test('antes del plazo la limpieza no borra nada', async () => {
    const c = mkCliente(); await solicitarEliminacion(c.id); await confirmarEliminacion(tokenDelCorreo(c.email))
    assert.deepEqual(await borrarCuentasVencidas(new Date(Date.now() + 6 * DIA)), { borradas: 0, fallos: 0 })
    assert.equal(fila(c.id).nombre, 'Carlos Ruiz')
  })
  test('al cumplirse el plazo se vacían los datos personales y se conservan pagos y visitas anónimos', async () => {
    const c = mkCliente({ familiar_notas: 'toma pastillas', zona: 'Madrid' }); const m = mkCompita()
    const v = mkVisita(c, m, { estado: 'terminada', direccion: 'Calle 1, casa 2' })
    db.seed('mensajes', { visit_id: v.id, contenido: 'hola, mi número es...' })
    db.seed('pagos_plan', { usuario_id: c.id, plan: 'quincenal', estado: 'activo' })
    db.seed('fotos_privadas', { usuario_id: c.id, tipo: 'cliente' })
    await solicitarEliminacion(c.id); await confirmarEliminacion(tokenDelCorreo(c.email))
    const r = await borrarCuentasVencidas(new Date(Date.now() + 8 * DIA)); assert.deepEqual(r, { borradas: 1, fallos: 0 })
    const u = fila(c.id)
    for (const k of ['telefono', 'zona', 'familiar_nombre', 'familiar_notas', 'familiar_condicion']) assert.equal(u[k], null, k)
    assert.equal(u.nombre, 'Cuenta eliminada'); assert.doesNotMatch(u.email, /@mail\.test/); assert.ok(u.eliminada_en)
    assert.equal(db.rows('mensajes').length, 0)
    assert.equal(db.rows('visitas')[0].direccion, null)
    assert.equal(db.rows('pagos_plan').length, 1) // la contabilidad se conserva
    assert.equal((db as any).bans[c.id], '876000h') // acceso cerrado para siempre (cien años)
    assert.doesNotMatch(JSON.stringify(db.rows('usuarios')), /Carlos|Madrid|pastillas|\+58 412/)
  })
  test('una cuenta ya borrada no se puede reactivar ni vuelve a procesarse', async () => {
    const c = mkCliente(); await solicitarEliminacion(c.id); await confirmarEliminacion(tokenDelCorreo(c.email))
    await borrarCuentasVencidas(new Date(Date.now() + 8 * DIA))
    assert.equal(await reactivarCuenta(c.id), false)
    assert.equal(await destinoTrasLogin(c.id, c.email, '/portal'), 'BLOQUEADO')
    assert.deepEqual(await borrarCuentasVencidas(new Date(Date.now() + 9 * DIA)), { borradas: 0, fallos: 0 })
  })
  test('la limpieza diaria llama al borrado', async () => {
    const { readFileSync } = await import('node:fs')
    assert.match(readFileSync('app/api/cron/limpieza/route.ts', 'utf8'), /borrarCuentasVencidas\(\)/)
  })
})
