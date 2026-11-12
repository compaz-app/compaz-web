/* eslint-disable */
// Manual del equipo: que no se quede atrás. Cada pantalla y cada permiso tienen su explicación, nada está vacío, la búsqueda funciona,
// y los NÚMEROS que dice el manual (plazos, topes) coinciden con los valores reales de Ajustes: si alguien cambia un valor, esta prueba avisa.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ENTRADAS, SECCIONES, PANTALLAS_PANEL, permisosDelManual, limitesDelManual, buscarEnManual, puedeLaEntrada } from '@/lib/manual'
import { PERMISOS } from '@/lib/permisos-catalogo'
import { CATALOGO as ESPERAS } from '@/lib/esperas'
import { CATALOGO as AJUSTES } from '@/lib/ajustes'

const entrada = (id: string) => ENTRADAS.find((e) => e.id === id)!
const defecto = (clave: string) => Number((AJUSTES as readonly any[]).find((a) => a.clave === clave)!.defecto)

describe('integridad', () => {
  test('los ids son únicos y cada entrada pertenece a una sección que existe', () => {
    assert.equal(new Set(ENTRADAS.map((e) => e.id)).size, ENTRADAS.length)
    for (const e of ENTRADAS) assert.ok(SECCIONES.some((s) => s.id === e.seccion), e.id)
  })
  test('toda sección tiene al menos una entrada', () => { for (const s of SECCIONES) assert.ok(ENTRADAS.some((e) => e.seccion === s.id), s.id) })
  test('ninguna entrada está vacía: pregunta, para qué sirve y pasos reales', () => {
    for (const e of ENTRADAS) {
      assert.ok(e.titulo.length >= 12 && e.titulo.length <= 90, `${e.id}: título`)
      assert.ok(e.paraQue.length >= 25 && e.paraQue.length <= 260, `${e.id}: para qué sirve (${e.paraQue.length})`)
      assert.ok(e.pasos.length >= 2 && e.pasos.length <= 8, `${e.id}: ${e.pasos.length} pasos`)
      for (const p of e.pasos) assert.ok(p.length >= 12 && p.length <= 300, `${e.id}: paso de ${p.length}`)
      assert.doesNotMatch(JSON.stringify(e), /undefined|NaN|\[object|\bTODO\b|lorem ipsum/, e.id)
    }
  })
  test('estilo del proyecto: sin guiones como viñetas ni al empezar un paso', () => {
    for (const e of ENTRADAS) for (const t of [e.paraQue, e.despues ?? '', ...e.pasos]) assert.doesNotMatch(t, /^\s*[-–—•]\s/, `${e.id}: "${t.slice(0, 40)}"`)
  })
  test('los permisos que menciona una entrada existen', () => {
    for (const e of ENTRADAS) if (e.permiso && e.permiso !== 'raiz') assert.ok((PERMISOS as readonly string[]).includes(e.permiso), e.id)
  })
})

describe('cobertura: nada del sistema queda sin explicar', () => {
  test('CADA pantalla del panel tiene al menos una entrada', () => {
    const sin = PANTALLAS_PANEL.filter((p) => !ENTRADAS.some((e) => e.pantalla === p))
    assert.deepEqual(sin, [], `Pantallas sin manual: ${sin.join(', ')}`)
  })
  test('las pantallas de Más del prototipo están todas en la lista oficial (si agregas una, agrégala también al manual)', () => {
    const src = readFileSync(join(process.cwd(), 'app/prototipo/admin/page.tsx'), 'utf8')
    const hub = src.slice(src.indexOf('const HUB'), src.indexOf(']\n', src.indexOf('const HUB')))
    const ids = [...hub.matchAll(/\{ id: '([a-z_]+)'[^}]*sub: true/g)].map((m) => m[1])
    assert.ok(ids.length >= 10)
    const fuera = ids.filter((i) => !(PANTALLAS_PANEL as readonly string[]).includes(i))
    assert.deepEqual(fuera, [], `Pantallas del prototipo que el manual no conoce: ${fuera.join(', ')}`)
  })
  test('CADA permiso aparece explicado (se arma solo desde el catálogo de permisos)', () => {
    assert.deepEqual(permisosDelManual().map((p) => p.id).sort(), [...PERMISOS].sort()); assert.ok(permisosDelManual().every((p) => p.titulo.length > 5))
  })
  test('CADA límite y espera del sistema aparece con su razón (se arma solo desde el catálogo de esperas)', () => {
    assert.deepEqual(limitesDelManual().map((l) => l.id).sort(), Object.keys(ESPERAS).sort()); assert.ok(limitesDelManual().every((l) => l.texto.length > 20))
  })
  test('las situaciones más importantes están: emergencia, seguridad, nadie abre, pago, reporte, pausa y cita', () => {
    for (const id of ['sit-emergencia', 'sit-inseguro', 'sit-nadie-abre', 'sit-pago', 'sit-reporte-compita', 'sit-cuenta-pausada', 'sit-cita-sin-confirmar']) assert.ok(entrada(id), id)
  })
})

describe('el manual dice lo mismo que el sistema (los números)', () => {
  const dice = (id: string, re: RegExp) => { const e = entrada(id); const t = [e.paraQue, e.despues ?? '', ...e.pasos].join(' '); const m = t.match(re); assert.ok(m, `${id}: no encontré ${re}`); return Number(m![1]) }
  test('plazo de la llamada al compita que reportó: 24 horas', () => assert.equal(dice('sit-reporte-compita', /plazo \((\d+) horas\)/), defecto('reporte_llamada_horas')))
  test('cita sin confirmar: recordatorio a las 6 horas y aviso a las 24', () => {
    assert.equal(dice('sit-cita-sin-confirmar', /A las (\d+) horas sin respuesta/), defecto('cita_recordatorio_horas')); assert.equal(dice('sit-cita-sin-confirmar', /A las (\d+) horas \(o si/), defecto('cita_escalada_horas'))
  })
  test('nadie abre: 30 minutos de espera', () => assert.equal(dice('sit-nadie-abre', /Si pasan los (\d+) minutos/), defecto('nadie_abre_espera_min')))
  test('visita alargada: "¿todo bien?" a los 15 minutos y alerta a los 10 sin respuesta', () => {
    assert.equal(dice('sit-alargada', /cuando pasan (\d+) minutos de la hora de fin/), defecto('todo_bien_min')); assert.equal(dice('sit-alargada', /no responde en (\d+) minutos/), defecto('todo_bien_respuesta_min'))
  })
  test('pago: una alerta cada 30 minutos y aviso a todos a las 6 horas', () => {
    assert.equal(dice('sit-pago', /una alerta cada (\d+) minutos/), defecto('pago_insistencia_min')); assert.equal(dice('sit-pago', /Si pasan (\d+) horas sin confirmar/), defecto('pago_escalada_horas'))
  })
  test('cancelaciones tardías: revisión a las 2 y pausa a las 3', () => {
    assert.equal(dice('sit-cancelaciones', /A las (\d+) cancelaciones tardías se abre/), defecto('canc_revision')); assert.equal(dice('sit-cancelaciones', /A las (\d+) queda en pausa/), defecto('canc_pausa'))
  })
  test('contactos compartidos: la segunda vez en 30 días', async () => {
    const { DETECCIONES_PARA_PAUSA, VENTANA_DIAS } = await import('@/lib/pausas')
    assert.equal(DETECCIONES_PARA_PAUSA, 2); assert.equal(dice('sit-cuenta-pausada', /(\d+) días/), VENTANA_DIAS)
  })
})

describe('búsqueda y permisos', () => {
  test('sin texto devuelve todo; sin coincidencias, nada', () => { assert.equal(buscarEnManual('').length, ENTRADAS.length); assert.equal(buscarEnManual('zzzqqq').length, 0) })
  test('ignora mayúsculas y tildes, y pide TODAS las palabras', () => {
    assert.ok(buscarEnManual('EMERGENCIA').some((e) => e.id === 'sit-emergencia')); assert.ok(buscarEnManual('cancelacion tardia').some((e) => e.id === 'sit-cancelaciones'))
    assert.ok(buscarEnManual('pago referencia').some((e) => e.id === 'sit-pago')); assert.equal(buscarEnManual('pago zzzqqq').length, 0)
  })
  test('ordena por relevancia: lo que habla DE pago va antes que lo que solo lo menciona', () => {
    const r = buscarEnManual('pago').map((e) => e.id); assert.deepEqual(r.slice(0, 2), ['sit-pago', 'cfg-pagos'])
    assert.ok(r.indexOf('como-funciona') > r.indexOf('cfg-pagos'), 'una mención de pasada va después')
    assert.equal(buscarEnManual('emergencia')[0].id, 'sit-emergencia')
  })
  test('encuentra con las palabras de la gente, no solo las del título', () => {
    for (const [q, id] of [['no abre', 'sit-nadie-abre'], ['sos', 'sit-emergencia'], ['zelle', 'sit-pago'], ['bloqueo', 'sit-reporte-compita'], ['que paso', 'actividad']] as const) assert.ok(buscarEnManual(q).some((e) => e.id === id), `${q} → ${id}`)
  })
  test('permisos: el administrador puede todo; el colaborador solo lo suyo; "raiz" solo del administrador', () => {
    const colab = { atender: true, monitorear: true }
    assert.equal(puedeLaEntrada(entrada('sit-pago'), colab, false), false); assert.equal(puedeLaEntrada(entrada('sit-pago'), colab, true), true)
    assert.equal(puedeLaEntrada(entrada('bandeja'), colab, false), true); assert.equal(puedeLaEntrada(entrada('cta-equipo'), { ...colab, cuentas: true, ajustes_editar: true }, false), false)
    assert.equal(puedeLaEntrada(entrada('cta-equipo'), {}, true), true); assert.equal(puedeLaEntrada(entrada('como-funciona'), {}, false), true)
  })
})
