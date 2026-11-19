/* eslint-disable */
// Medición de la velocidad que viven los usuarios reales: se valida todo lo que llega del navegador, no se guarda nada personal y el resumen usa el percentil 75.
import { db, limpiar, req } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validarMediciones, rutaGrupo, percentil, valorar, resumir } from '@/lib/velocidad-real'
import { POST as vitals } from '@/app/api/vitals/route'

beforeEach(limpiar)
const envia = (cuerpo: unknown, extra: Record<string, string> = {}) => vitals(req('/api/vitals', { body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), method: 'POST', headers: { 'content-type': 'text/plain', ...extra } }) as any)

describe('qué se acepta', () => {
  test('la ruta se reduce a su primer tramo: nunca se guardan enlaces con token ni identificadores', () => {
    assert.equal(rutaGrupo('/portal?sec=visitas'), '/portal')
    assert.equal(rutaGrupo('/sala/abcdef123456?s=firma'), '/sala')
    assert.equal(rutaGrupo('/'), '/')
    assert.equal(rutaGrupo('/a/b/c'), '/a')
    assert.equal(rutaGrupo('/<script>'), '/otra')
    assert.equal(rutaGrupo(42), '/')
  })
  test('solo las 5 métricas conocidas, con números sanos; lo demás se descarta; máximo 20 por envío', () => {
    const m = validarMediciones({ m: [
      { nombre: 'LCP', valor: 1800, ruta: '/portal', conexion: '4g', movil: true },
      { nombre: 'XSS', valor: 5 }, { nombre: 'CLS', valor: -1 }, { nombre: 'INP', valor: 'rapido' }, { nombre: 'TTFB', valor: Infinity }, { nombre: 'FCP', valor: 9e9 },
      { nombre: 'CLS', valor: 0.05, conexion: 'wifi' },
    ] })
    assert.deepEqual(m.map((x) => x.nombre), ['LCP', 'CLS'])
    assert.equal(m[1].conexion, null, 'una conexión desconocida no se guarda')
    assert.equal(validarMediciones({ m: Array.from({ length: 50 }, () => ({ nombre: 'LCP', valor: 1 })) }).length, 20)
    assert.deepEqual(validarMediciones('basura'), []); assert.deepEqual(validarMediciones(null), [])
  })
  test('los umbrales son los de Google', () => {
    assert.equal(valorar('LCP', 2500), 'good'); assert.equal(valorar('LCP', 2501), 'needs-improvement'); assert.equal(valorar('LCP', 4001), 'poor')
    assert.equal(valorar('CLS', 0.1), 'good'); assert.equal(valorar('INP', 501), 'poor')
  })
})

describe('el resumen', () => {
  test('el percentil 75 (así lo mide Google) y el caso vacío', () => {
    assert.equal(percentil([], 0.75), null)
    assert.equal(percentil([100, 200, 300, 400], 0.75), 300)
    assert.equal(percentil([5], 0.75), 5)
  })
  test('separa las conexiones lentas y lista solo las pantallas con 5 o más mediciones, de la más lenta a la más rápida', () => {
    const f: any[] = []
    for (let i = 0; i < 6; i++) f.push({ nombre: 'LCP', valor: 5000, ruta: '/compitas', conexion: '3g' })
    for (let i = 0; i < 6; i++) f.push({ nombre: 'LCP', valor: 1000, ruta: '/portal', conexion: '4g' })
    f.push({ nombre: 'LCP', valor: 9000, ruta: '/rara', conexion: '4g' }) // una sola medición: no cuenta como pantalla
    const r = resumir(f, 7)
    assert.equal(r.total, 13)
    assert.deepEqual(r.paginasLentas.map((p) => p.ruta), ['/compitas', '/portal'])
    assert.equal(r.paginasLentas[0].valoracion, 'poor')
    assert.equal(r.lentas.find((x) => x.metrica === 'LCP')!.muestras, 6)
  })
})

describe('el punto de entrada', () => {
  test('guarda las mediciones válidas sin IP ni usuario y responde siempre 204', async () => {
    const r = await envia({ m: [{ nombre: 'LCP', valor: 2100, ruta: '/portal/x?t=secreto', conexion: '3g', movil: true }] }, { 'x-nf-client-connection-ip': '1.2.3.4' })
    assert.equal(r.status, 204)
    const fila = db.rows('web_vitals')[0]
    assert.equal(fila.nombre, 'LCP'); assert.equal(fila.ruta, '/portal'); assert.equal(fila.valoracion, 'good'); assert.equal(fila.conexion, '3g')
    assert.ok(!JSON.stringify(fila).includes('1.2.3.4') && !JSON.stringify(fila).includes('secreto'))
  })
  test('basura, cuerpo gigante o vacío: se ignora sin error y sin guardar nada', async () => {
    for (const c of ['no es json', '{"m":[]}', '', 'x'.repeat(5000)]) assert.equal((await envia(c)).status, 204)
    assert.equal(db.rows('web_vitals').length, 0)
  })
  test('quien manda de más no llena la tabla: pasadas 120 señales por hora, se ignoran', async () => {
    for (let i = 0; i < 125; i++) await envia({ m: [{ nombre: 'LCP', valor: 1000 }] }, { 'x-nf-client-connection-ip': '9.9.9.9' })
    assert.equal(db.rows('web_vitals').length, 120)
  })
})

describe('está conectado', () => {
  test('el diseño y la migración: sin datos personales, solo el servidor, y el navegador envía al ocultarse la página', () => {
    const sql = readFileSync('supabase/migrations/20261118_web_vitals.sql', 'utf8').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n') // sin los comentarios
    assert.match(sql, /enable row level security/); assert.doesNotMatch(sql, /\bip\b|usuario_id|email/i)
    assert.match(sql, /create table if not exists/); assert.doesNotMatch(sql, /drop |alter table public\.(?!web_vitals)/i)
    const c = readFileSync('components/MedirVelocidadReal.tsx', 'utf8')
    assert.match(c, /sendBeacon\('\/api\/vitals'/); assert.match(c, /visibilitychange/); assert.match(c, /pagehide/)
    assert.match(readFileSync('app/layout.tsx', 'utf8'), /<MedirVelocidadReal \/>/)
    assert.match(readFileSync('components/panel/mas/Estado.tsx', 'utf8'), /<VelocidadReal \/>/)
  })
})
