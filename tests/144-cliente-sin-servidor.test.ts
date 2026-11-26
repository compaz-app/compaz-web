/* eslint-disable */
// Guardia de INC-003 (24-nov-2026): un componente del navegador ('use client') no puede arrastrar, ni directa ni indirectamente,
// módulos solo de servidor (lib/supabase-server.ts usa next/headers). tsc y las pruebas no lo detectan; la compilación de producción sí,
// y entonces main deja de desplegarse sin que nadie se entere. Los `import type` no cuentan: se borran al compilar.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'

const SOLO_SERVIDOR = ['lib/supabase-server.ts']
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = `${d}/${n}`; return statSync(p).isDirectory() ? (n === 'node_modules' ? [] : walk(p)) : [p] })
const resolver = (spec: string): string | null => {
  if (!spec.startsWith('@/')) return null
  const base = spec.slice(2)
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (existsSync(c) && statSync(c).isFile()) return c
  return null
}
/** Importaciones de valores (no `import type`, tampoco `export type`) con alias @/. */
const importaciones = (f: string): string[] => {
  const s = readFileSync(f, 'utf8')
  const out: string[] = []
  for (const m of s.matchAll(/^\s*(import|export)\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm)) if (!m[2]) out.push(m[3])
  for (const m of s.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) out.push(m[1])
  return out.map(resolver).filter((x): x is string => !!x)
}

test('ningún componente del navegador arrastra módulos solo de servidor', () => {
  const clientes = [...walk('app'), ...walk('components'), ...walk('lib')].filter((f) => /\.tsx?$/.test(f) && /^\s*['"]use client['"]/.test(readFileSync(f, 'utf8')))
  assert.ok(clientes.length > 20, 'debería encontrar componentes del navegador')
  const fallos: string[] = []
  for (const c of clientes) {
    const visto = new Set<string>(); const pila: [string, string[]][] = [[c, [c]]]
    while (pila.length) {
      const [f, ruta] = pila.pop()!
      for (const d of importaciones(f)) {
        if (SOLO_SERVIDOR.includes(d)) { fallos.push([...ruta, d].join(' → ')); continue }
        if (!visto.has(d)) { visto.add(d); pila.push([d, [...ruta, d]]) }
      }
    }
  }
  assert.deepEqual(fallos, [], 'Separa las constantes puras en un módulo sin servidor (como lib/velocidad-real.ts, pura, y lib/velocidad-real-servidor.ts) o usa `import type`.')
})
