/* eslint-disable */
// Airtable ya no se usa: ningún código de la web llama a su API ni lee sus variables, y sus funciones programadas no existen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const buscar = (patron: string) => { try { return execSync(`git grep -n -I -E "${patron}" -- app components lib netlify`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean) } catch { return [] } }

test('ningún archivo llama a api.airtable.com ni lee AIRTABLE_* / POSTULACIONES_DESTINO', () => {
  assert.deepEqual(buscar('api\\.airtable\\.com|AIRTABLE_|POSTULACIONES_DESTINO'), [])
})
test('el cliente de Airtable, sus rutas de cron y sus funciones programadas ya no existen', () => {
  for (const f of ['lib/airtable.ts', 'app/api/cron/reintentar-airtable/route.ts', 'app/api/cron/conciliar-airtable/route.ts', 'netlify/functions/reintentar-airtable.mts', 'netlify/functions/conciliar-airtable.mts']) assert.equal(existsSync(f), false, f)
})
