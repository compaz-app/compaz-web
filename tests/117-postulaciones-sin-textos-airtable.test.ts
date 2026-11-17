/* eslint-disable */
// La pantalla Postulaciones y el manual hablan de «por resolver», no de Airtable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('la pantalla Postulaciones, sus textos y el manual del equipo no dicen Airtable al equipo', () => {
  for (const f of ['components/panel/mas/Postulaciones.tsx', 'components/panel/mas/ResolverPostulacion.tsx', 'lib/panel-postulaciones-tipos.ts']) {
    const t = readFileSync(f, 'utf8').replace(/airtable_(estado|intentos|ultimo_error)/g, '')
    // En estos archivos solo se permiten las etiquetas de datos históricos de la columna «fuente».
    const sobran = t.split('\n').filter((l) => /airtable/i.test(l) && !/respaldo_airtable|importacion_airtable/.test(l))
    assert.deepEqual(sobran, [], f)
  }
  const manual = readFileSync('lib/manual.ts', 'utf8').split('\n').filter((l) => /airtable/i.test(l))
  assert.deepEqual(manual, [])
})
test('la bandeja se llama «Por resolver»', () => {
  const t = readFileSync('components/panel/mas/Postulaciones.tsx', 'utf8')
  assert.match(t, /Por resolver \(\{pend\.filas\.length\}\)/); assert.doesNotMatch(t, /Sin llegar a/)
})
