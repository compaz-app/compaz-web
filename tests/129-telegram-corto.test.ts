/* eslint-disable */
// Mensajes de Telegram largos: ninguno de los textos de las rutas pasa de 70 palabras (antes llegaban a 129), y las advertencias repetidas salen de un solo lugar.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AVISO_FRAUDE, AVISO_FUERA } from '@/lib/avisos-seguridad'

const pal = (t: string) => (t.replace(/\$\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, ' ').replace(/<[^>]+>/g, ' ').match(/[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡0-9$%]+/g) ?? []).length
const rutas = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? rutas(p) : f === 'route.ts' ? [p] : [] })

test('ningún texto de Telegram en las rutas pasa de 70 palabras', () => {
  const largos: string[] = []
  for (const f of rutas('app/api')) {
    const s = readFileSync(f, 'utf8')
    for (const m of s.matchAll(/`((?:[^`\\]|\\.)*)`/g)) {
      const raw = m[1]
      if (!/<b>|🎉|👋|🔒|📋/.test(raw)) continue
      if (/<(div|table|h1|h2|img)/.test(raw)) continue
      if (pal(raw) > 70) largos.push(`${f}: ${raw.slice(0, 50)}`)
    }
  }
  assert.deepEqual(largos, [])
})

test('las advertencias repetidas son breves', () => {
  assert.ok(pal(AVISO_FRAUDE) <= 12)
  assert.ok(pal(AVISO_FUERA) <= 20)
})
