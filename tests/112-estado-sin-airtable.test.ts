/* eslint-disable */
// Estado del sistema ya no muestra nada de Airtable (ya no se usa).
import { limpiar } from './harness'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { estadoDelSistema } from '@/lib/panel-estado'
import { ESPERADOS } from '@/lib/cron'

beforeEach(limpiar)
test('los procesos vigilados no incluyen los de Airtable y el estado no trae el contador', async () => {
  assert.ok(!Object.keys(ESPERADOS).some((k) => /airtable/i.test(k)))
  const e = await estadoDelSistema(); assert.ok(!e.procesos.some((p) => /airtable/i.test(p.nombre))); assert.ok(!('airtablePendientes' in e))
})
test('la pantalla Estado no dice Airtable en ninguna parte', () => assert.doesNotMatch(readFileSync('components/panel/mas/Estado.tsx', 'utf8'), /airtable/i))
