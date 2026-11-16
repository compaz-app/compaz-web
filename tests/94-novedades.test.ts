/* eslint-disable */
// Novedades del cliente: se guardan una vez, el portal las ve en vivo y el sistema sabe si el cliente está mirando.
import { db, limpiar, session, mkCliente } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registrarNovedad, registrarLatido, clienteTienePortalAbierto, marcarNovedadesVistas } from '@/lib/novedades'
import { esperaDelCorreoMin, portalAbierto, nivelDe, tituloDe, NIVEL_POR_PLANTILLA, TITULO_NOVEDAD, ESPERA_PORTAL_ABIERTO_MIN, ESPERA_PORTAL_CERRADO_MIN, VENTANA_PORTAL_ABIERTO_SEG } from '@/lib/novedades-politica'
import { PLANTILLAS } from '@/lib/plantillas-aviso'
import { POST as latido } from '@/app/api/portal/latido/route'
import { POST as vistas } from '@/app/api/portal/novedades/vistas/route'

beforeEach(limpiar)
const como = (u: any) => { session.user = u ? { id: u.id, email: u.email } : null }
const nueva = (u: any, clave: string, o: any = {}) => ({ usuarioId: u.id, tipo: 'compita_llego', nivel: 'critico' as const, titulo: 'Tu compita llegó.', clave, ...o })

describe('la política de cuándo sale el correo', () => {
  test('lo crítico sale ya; lo demás espera según el portal esté abierto o cerrado', () => {
    assert.equal(esperaDelCorreoMin('critico', true), 0); assert.equal(esperaDelCorreoMin('critico', false), 0)
    assert.equal(esperaDelCorreoMin('accionable', true), ESPERA_PORTAL_ABIERTO_MIN); assert.equal(esperaDelCorreoMin('informativo', false), ESPERA_PORTAL_CERRADO_MIN)
    assert.ok(ESPERA_PORTAL_ABIERTO_MIN > ESPERA_PORTAL_CERRADO_MIN, 'con el portal abierto el respaldo espera más')
  })
  test('el portal cuenta como abierto solo si avisó hace menos de 90 segundos', () => {
    const ahora = new Date('2026-11-16T12:00:00Z')
    assert.equal(portalAbierto('2026-11-16T11:59:00Z', ahora), true); assert.equal(portalAbierto('2026-11-16T11:58:00Z', ahora), false)
    assert.equal(portalAbierto(null, ahora), false); assert.equal(portalAbierto('basura', ahora), false); assert.equal(VENTANA_PORTAL_ABIERTO_SEG, 90)
  })
  test('lo que toca la seguridad es crítico y lo que no está clasificado es accionable', () => {
    for (const p of ['compita_llego', 'nadie_abre_cliente', 'salida_seguridad_cliente', 'cancelacion_equipo_cliente', 'pausa_cuenta_cliente']) assert.equal(nivelDe(p), 'critico', p)
    assert.equal(nivelDe('plantilla_nueva_sin_clasificar'), 'accionable'); assert.match(tituloDe('plantilla_nueva_sin_clasificar'), /novedad/)
  })
  test('toda plantilla clasificada o con título existe de verdad (sin nombres inventados)', () => {
    for (const k of [...Object.keys(NIVEL_POR_PLANTILLA), ...Object.keys(TITULO_NOVEDAD)]) assert.ok((PLANTILLAS as any)[k], k)
  })
  test('los títulos no llevan emojis ni guiones de viñeta (regla de redacción)', () => {
    for (const t of Object.values(TITULO_NOVEDAD)) { assert.doesNotMatch(t!, /[\u{1F300}-\u{1FAFF}☀-➿]/u); assert.doesNotMatch(t!, /^\s*[-–—]/) }
  })
})

describe('registrar y marcar novedades', () => {
  test('se guarda una vez por clave (el mismo hecho no se duplica)', async () => {
    const u = mkCliente()
    assert.ok(await registrarNovedad(nueva(u, 'k1'))); assert.equal(await registrarNovedad(nueva(u, 'k1')), null)
    assert.equal(db.rows('novedades_cliente').length, 1); assert.equal(db.rows('novedades_cliente')[0].vista_en ?? null, null)
  })
  test('marcar vistas toca solo las del cliente y no repite', async () => {
    const a = mkCliente({ email: 'a@mail.test' } as any), b = mkCliente({ email: 'b@mail.test' } as any)
    await registrarNovedad(nueva(a, 'ka1')); await registrarNovedad(nueva(a, 'ka2')); await registrarNovedad(nueva(b, 'kb1'))
    assert.equal(await marcarNovedadesVistas(a.id), 2); assert.equal(await marcarNovedadesVistas(a.id), 0)
    assert.equal(db.rows('novedades_cliente').filter((x: any) => x.usuario_id === b.id)[0].vista_en ?? null, null, 'la de otro cliente no se tocó')
  })
  test('el latido marca el portal como abierto', async () => {
    const u = mkCliente(); assert.equal(await clienteTienePortalAbierto(u.id), false)
    assert.equal(await registrarLatido(u.id), true); assert.equal(await clienteTienePortalAbierto(u.id), true)
    assert.equal(await clienteTienePortalAbierto(u.id, undefined, new Date(Date.now() + 120_000)), false, 'dos minutos después ya no cuenta')
  })
})

describe('rutas del portal', () => {
  test('exigen sesión de cliente y solo tocan lo suyo', async () => {
    const u = mkCliente({ email: 'c@mail.test' } as any), otro = mkCliente({ email: 'o@mail.test' } as any)
    como(null); assert.equal((await latido()).status, 401); assert.equal((await vistas()).status, 401)
    await registrarNovedad(nueva(u, 'x1')); await registrarNovedad(nueva(otro, 'x2'))
    como(u); assert.equal((await latido()).status, 200); assert.ok(db.rows('usuarios').find((x: any) => x.id === u.id)!.portal_visto_en)
    assert.equal(db.rows('usuarios').find((x: any) => x.id === otro.id)!.portal_visto_en ?? null, null)
    const r = await vistas(); assert.equal((await r.json()).data.marcadas, 1)
    assert.equal(db.rows('novedades_cliente').find((x: any) => x.usuario_id === otro.id)!.vista_en ?? null, null)
  })
})

describe('la pantalla y la migración', () => {
  test('el portal y el dashboard viejo escuchan las novedades solo para clientes (no para el administrador)', () => {
    assert.match(readFileSync('app/portal/page.tsx', 'utf8'), /\{!esAdmin && <NovedadesEnVivo usuarioId=\{uid\} \/>\}/)
    assert.match(readFileSync('app/dashboard/page.tsx', 'utf8'), /\{!isAdmin && !previewUid && <NovedadesEnVivo/)
    const c = readFileSync('components/ui/NovedadesEnVivo.tsx', 'utf8'); assert.match(c, /postgres_changes/); assert.match(c, /usuario_id=eq\./); assert.match(c, /45_000/); assert.match(c, /visibilityState/)
  })
  test('la migración solo agrega, con lectura propia y tiempo real', () => {
    const m = readFileSync('supabase/migrations/20261116_novedades_cliente.sql', 'utf8')
    assert.match(m, /create table if not exists public\.novedades_cliente/); assert.match(m, /enable row level security/); assert.match(m, /usuario_id = auth\.uid\(\)/); assert.match(m, /supabase_realtime/)
    assert.match(m, /add column if not exists portal_visto_en/); assert.doesNotMatch(m, /drop table|delete from|alter table [a-z_.]+ drop|truncate/i)
  })
})
