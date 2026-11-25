/* eslint-disable */
// Segundo factor (autenticador) del panel: lo que se lee del token de Supabase, cuándo se exige y qué acciones piden una confirmación reciente.
import { db, session, limpiar, req } from './harness'
import { beforeEach, afterEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { decodificarJwt, nivelDesdeToken, esReciente, evaluarMfa, MINUTOS_CONFIRMACION_RECIENTE, mfaObligatorio } from '@/lib/mfa'
import { requierePermiso } from '@/lib/permisos'
import { POST as anularPago } from '@/app/api/admin/anular-pago/route'

const jwt = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`
const ahora = Math.floor(Date.now() / 1000)
const aal2 = (hace = 60) => jwt({ aal: 'aal2', amr: [{ method: 'otp', timestamp: ahora - 5000 }, { method: 'totp', timestamp: ahora - hace }] })
const aal1 = jwt({ aal: 'aal1', amr: [{ method: 'otp', timestamp: ahora - 60 }] })
const ADMIN = 'admin@compaz.test'

beforeEach(() => { limpiar(); delete process.env.ADMIN_MFA })
afterEach(() => { delete process.env.ADMIN_MFA })

describe('lo que se lee del token', () => {
  test('el nivel y la última confirmación del autenticador; lo roto no rompe nada y cuenta como sin confirmar', () => {
    assert.deepEqual(nivelDesdeToken(decodificarJwt(aal2(120))), { aal: 'aal2', ultimaVerificacion: ahora - 120 })
    assert.deepEqual(nivelDesdeToken(decodificarJwt(aal1)), { aal: 'aal1', ultimaVerificacion: null })
    for (const malo of [null, undefined, '', 'basura', 'a.b.c', 'a.eyJ4.c']) assert.deepEqual(nivelDesdeToken(decodificarJwt(malo as any)), { aal: null, ultimaVerificacion: null })
    assert.equal(nivelDesdeToken({ aal: 'aal2', amr: 'no es lista' }).ultimaVerificacion, null)
  })
  test('«reciente»: dentro de 15 minutos y solo con aal2', () => {
    const n = (hace: number) => nivelDesdeToken(decodificarJwt(aal2(hace)))
    assert.equal(MINUTOS_CONFIRMACION_RECIENTE, 15)
    assert.equal(esReciente(n(14 * 60)), true); assert.equal(esReciente(n(16 * 60)), false)
    assert.equal(esReciente(nivelDesdeToken(decodificarJwt(aal1))), false)
  })
})

describe('cuándo se exige', () => {
  test('apagado (sin ADMIN_MFA) todo pasa, para poder registrar el autenticador antes de exigirlo', () => {
    assert.equal(mfaObligatorio(), false)
    assert.equal(evaluarMfa({ aal: 'aal1', ultimaVerificacion: null }).ok, true)
  })
  test('obligatorio: sin aal2 no pasa; en acciones peligrosas pide además confirmación reciente, y el mensaje dice qué hacer', () => {
    const viejo = nivelDesdeToken(decodificarJwt(aal2(30 * 60))), nuevo = nivelDesdeToken(decodificarJwt(aal2(60))), solo = nivelDesdeToken(decodificarJwt(aal1))
    const o = { obligatorio: true }
    const a = evaluarMfa(solo, o); assert.equal(a.ok, false); assert.match((a as any).mensaje, /\/seguridad\/segundo-factor/)
    assert.equal(evaluarMfa(viejo, o).ok, true, 'una acción normal no pide confirmación reciente')
    const b = evaluarMfa(viejo, { ...o, reciente: true }); assert.equal(b.ok, false); assert.equal((b as any).motivo, 'falta_confirmacion_reciente'); assert.match((b as any).mensaje, /reconfirmar=1/)
    assert.equal(evaluarMfa(nuevo, { ...o, reciente: true }).ok, true)
    assert.equal(evaluarMfa({ aal: null, ultimaVerificacion: null }, o).ok, false, 'un token ilegible se trata como no confirmado')
  })
})

describe('en las rutas del panel', () => {
  const comoAdmin = () => { session.user = { id: 'a1', email: ADMIN } }
  test('apagado: el administrador entra como siempre', async () => {
    comoAdmin(); assert.equal((await requierePermiso('pagos')).ok, true)
  })
  test('obligatorio: con solo el correo (aal1) se niega con 403 y un mensaje que explica; con el autenticador pasa', async () => {
    process.env.ADMIN_MFA = 'obligatorio'; comoAdmin()
    db.tokenSesion = aal1
    const g = await requierePermiso('pagos'); assert.equal(g.ok, false); assert.equal((g as any).res.status, 403)
    assert.match((await (g as any).res.json()).error, /autenticador/)
    db.tokenSesion = aal2(60); assert.equal((await requierePermiso('pagos')).ok, true)
    db.tokenSesion = null; assert.equal((await requierePermiso('pagos')).ok, false, 'sin token legible no se deja pasar')
  })
  test('las acciones que no se pueden deshacer piden una confirmación de hace poco', async () => {
    process.env.ADMIN_MFA = 'obligatorio'; comoAdmin()
    db.tokenSesion = aal2(30 * 60)
    assert.equal((await requierePermiso('pagos')).ok, true)
    assert.equal((await requierePermiso('pagos', { peligrosa: true })).ok, false)
    const r = await anularPago(req('/api/admin/anular-pago', { json: { pago_id: 'x', motivo: 'prueba de motivo' } }))
    assert.equal(r.status, 403); assert.match((await r.json()).error, /reconfirmar=1/)
    db.tokenSesion = aal2(60); assert.notEqual((await anularPago(req('/api/admin/anular-pago', { json: { pago_id: 'x', motivo: 'prueba de motivo' } }))).status, 403)
  })
  test('estas rutas están marcadas como peligrosas', () => {
    for (const [f, n] of [['anular-pago', 1], ['eliminar-cliente', 1], ['eliminar-compita', 1], ['equipo', 3]] as const) {
      const s = readFileSync(`app/api/admin/${f}/route.ts`, 'utf8')
      assert.equal((s.match(/peligrosa: true/g) ?? []).length, n, f)
    }
  })
})

describe('la página y el acceso', () => {
  test('existe la página de seguridad, solo para el equipo, y el panel enlaza a ella', () => {
    assert.equal(existsSync('app/seguridad/segundo-factor/page.tsx'), true)
    const p = readFileSync('app/seguridad/segundo-factor/page.tsx', 'utf8')
    assert.match(p, /actorDeSesion\(\)/); assert.match(p, /redirect\(`\/login/); assert.doesNotMatch(p, /actorDePagina/, 'no puede exigir el segundo factor a la página donde se confirma')
    const c = readFileSync('app/seguridad/segundo-factor/SegundoFactor.tsx', 'utf8')
    for (const x of ['mfa.enroll', 'challengeAndVerify', 'listFactors', 'unenroll']) assert.match(c, new RegExp(x))
    assert.match(readFileSync('components/panel/mas/Estado.tsx', 'utf8'), /href="\/seguridad\/segundo-factor"/)
  })
  test('las páginas del panel mandan a confirmar si falta el segundo factor, sin tragarse la redirección', () => {
    const s = readFileSync('lib/permisos.ts', 'utf8')
    assert.match(s, /exigirSegundoFactorEnPagina\('\/panel'\)/)
    assert.ok(s.indexOf('exigirSegundoFactorEnPagina(\'/panel\')') > s.indexOf('export async function actorDePagina'))
    assert.doesNotMatch(readFileSync('lib/mfa.ts', 'utf8').split('exigirSegundoFactorEnPagina')[1] ?? '', /catch/, 'redirect() lanza una excepción: no puede ir dentro de un try')
  })
  test('la migración que cierra las invitaciones: quita la política abierta y los permisos del acceso anónimo', () => {
    const sql = readFileSync('supabase/migrations/20261124_cerrar_tokens_anon.sql', 'utf8').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    assert.match(sql, /drop policy if exists service_role_full_access on public\.onboarding_tokens/)
    assert.match(sql, /revoke all on table public\.onboarding_tokens from anon, authenticated/); assert.match(sql, /revoke all on table public\.compita_edit_tokens from anon, authenticated/)
    assert.doesNotMatch(sql, /drop table|delete from|truncate/i)
  })
})
