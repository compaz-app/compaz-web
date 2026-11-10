/* eslint-disable */
// Una sola lista de administradores: ADMIN_EMAILS manda y la tabla admin_emails (tiempo real) se mantiene igual.
import { db, net, limpiar, req } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { sincronizarAdmins, adminsDeEntorno } from '@/lib/admins'
import { POST as limpieza } from '@/app/api/cron/limpieza/route'

beforeEach(limpiar)
const lista = () => db.rows('admin_emails').map((r) => r.email).sort()
const conEntorno = async (valor: string, f: () => Promise<void>) => {
  const antes = process.env.ADMIN_EMAILS
  process.env.ADMIN_EMAILS = valor
  try { await f() } finally { process.env.ADMIN_EMAILS = antes }
}

describe('sincronizarAdmins', () => {
  test('agrega los que faltan, quita los que sobran y deja la tabla igual a ADMIN_EMAILS', async () => {
    db.seed('admin_emails', { email: 'viejo@x.test' })
    db.seed('admin_emails', { email: 'a@x.test' })
    await conEntorno('A@x.test, b@x.test ,a@x.test', async () => {
      const r = await sincronizarAdmins()
      assert.deepEqual(r, { ok: true, agregados: ['b@x.test'], quitados: ['viejo@x.test'] })
      assert.deepEqual(lista(), ['a@x.test', 'b@x.test'])
    })
  })

  test('es idempotente: la segunda vez no cambia nada', async () => {
    await conEntorno('a@x.test,b@x.test', async () => {
      await sincronizarAdmins()
      assert.deepEqual(await sincronizarAdmins(), { ok: true, agregados: [], quitados: [] })
      assert.equal(db.rows('admin_emails').length, 2)
    })
  })

  test('con ADMIN_EMAILS vacío NO borra a nadie (error de configuración)', async () => {
    db.seed('admin_emails', { email: 'a@x.test' })
    for (const v of ['', '  ,  ']) {
      await conEntorno(v, async () => {
        const r = await sincronizarAdmins()
        assert.equal(r.ok, false)
        assert.deepEqual(lista(), ['a@x.test'])
      })
    }
  })

  test('si la base falla, no lanza: devuelve el error', async () => {
    delete (db.tables as any).admin_emails
    const r = await sincronizarAdmins()
    assert.equal(r.ok, false)
  })

  test('adminsDeEntorno normaliza mayúsculas, espacios y repetidos', async () => {
    await conEntorno(' A@x.test,a@x.test,,B@X.test ', async () => assert.deepEqual(adminsDeEntorno(), ['a@x.test', 'b@x.test']))
  })
})

describe('el cron de limpieza mantiene la lista', () => {
  const cron = () => req('/api/cron/limpieza', { method: 'POST', headers: { 'x-cron-secret': 'cronsecret' } })

  test('la sincroniza cada día', async () => {
    db.seed('admin_emails', { email: 'viejo@x.test' })
    const r = await limpieza(cron())
    assert.equal(r.status, 200)
    assert.deepEqual(lista(), ['admin@compaz.test'])
  })

  test('si la lista no se puede sincronizar, la limpieza lo reporta (no lo esconde)', async () => {
    delete (db.tables as any).admin_emails
    const r = await limpieza(cron())
    assert.equal(r.status, 500)
    assert.match(JSON.stringify(await r.json()), /administradores/)
    void net
  })
})
