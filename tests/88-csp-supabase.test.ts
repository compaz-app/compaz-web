/* eslint-disable */
// La política de seguridad del navegador (CSP) toma la dirección de Supabase de NEXT_PUBLIC_SUPABASE_URL: cambiar de proyecto es cambiar la variable.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

describe('CSP y Supabase', () => {
  test('ningún proyecto de Supabase queda escrito a mano en la configuración', () => {
    const c = readFileSync('next.config.ts', 'utf8')
    assert.doesNotMatch(c, /[a-z0-9]{20}\.supabase\.co/, 'la dirección de Supabase debe salir de NEXT_PUBLIC_SUPABASE_URL')
    assert.match(c, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/)
    assert.match(c, /\$\{SUPABASE_CONEXIONES\}/)
  })
  test('con la variable puesta, connect-src trae https y wss de ESA dirección', async () => {
    const url = 'https://jizckcfuemgfbmopbhbh.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_URL = url
    const mod = await import('../next.config')
    const cabeceras = await mod.default.headers!()
    const csp = cabeceras[0].headers.find((h) => h.key === 'Content-Security-Policy')!.value
    const connect = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('connect-src'))!
    assert.ok(connect.includes(url), 'https')
    assert.ok(connect.includes(url.replace('https:', 'wss:')), 'wss')
    assert.ok(!/qrhkzlzblaknzsxqfney/.test(csp), 'el proyecto viejo no debe quedar escrito')
  })
})
