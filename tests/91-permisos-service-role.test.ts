/* eslint-disable */
// La migración 20261113c solo QUITA permisos a service_role en 5 tablas, nunca da ninguno, y la comprobación SQL cubre las mismas tablas.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = (f: string) => readFileSync(f, 'utf8')
const sinComentarios = (t: string) => t.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
const TABLAS = ['eventos', 'personas', 'postulaciones', 'chat_requests', 'admin_emails']
const MIGRACION = 'supabase/migrations/20261113c_restaurar_permisos_service_role.sql'
const COMPROBACION = 'tests/sql/permisos_service_role_5_tablas.sql'

describe('migración de permisos de service_role', () => {
  const m = sinComentarios(sql(MIGRACION))
  test('solo revoca (nunca concede), solo a service_role, en una transacción', () => {
    assert.match(m, /revoke %s%s on table public\.%I from service_role/)
    assert.doesNotMatch(m, /\bgrant\b/i)
    assert.doesNotMatch(m, /\b(anon|authenticated)\b/i) // esos roles ya coinciden con el diseño: no se tocan
    assert.doesNotMatch(m, /\b(drop|delete from|truncate table|alter table|update public)\b/i) // no toca datos, columnas ni RLS
    assert.match(m, /^begin;$/m); assert.match(m, /^commit;$/m)
  })
  test('cubre exactamente las 5 tablas y no falla si alguna no existe', () => {
    for (const t of TABLAS) assert.match(m, new RegExp(`'${t}'`), t)
    assert.match(m, /to_regclass\('public\.' \|\| v\.tabla\) is null/); assert.match(m, /continue/)
  })
  test('MAINTAIN solo se quita en Postgres 17 o superior', () => {
    assert.match(m, /server_version_num'\)::int >= 170000/); assert.match(m, /', maintain'/)
  })
  test('la comprobación SQL es de solo lectura y cubre las mismas 5 tablas', () => {
    const c = sinComentarios(sql(COMPROBACION))
    for (const t of TABLAS) assert.match(c, new RegExp(t), t)
    assert.doesNotMatch(c, /\b(grant|revoke|insert into|update public|delete from|drop|alter)\b/i)
    assert.match(c, /has_table_privilege\('service_role'/)
  })
  test('es posterior a la migración de Luis (20261113b) y no repite su número', () => {
    const { readdirSync } = require('node:fs')
    const nombres: string[] = readdirSync('supabase/migrations')
    assert.ok(nombres.indexOf('20261113c_restaurar_permisos_service_role.sql') > nombres.indexOf('20261113b_cmc_sincronizaciones_permisos.sql'))
    assert.equal(nombres.filter((n) => n.startsWith('20261113c')).length, 1)
  })
})
