// Ajustes: fuente única con respaldo en el código, validación, coherencia, historial y caché.
import { db, limpiar } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  CATALOGO, getAjustes, getAjuste, setAjuste, validarValor, conflictoEntreAjustes, planesIncoherentes,
  ajustesPorDefecto, limpiarCacheAjustes,
} from '@/lib/ajustes'
import { PLANES, PRECIO_HORA_EXTRA_USD, PRECIO_MANDADO_USD } from '@/lib/planes'

// Estas pruebas miran la tabla de ajustes tal cual: empiezan sin la fila que el arnés pone para las pruebas del flujo anterior.
beforeEach(() => { limpiar(); db.rows('ajustes').length = 0; limpiarCacheAjustes() })

const guardar = (clave: string, valor: unknown, extra: Record<string, unknown> = {}) =>
  db.seed('ajustes', { clave, valor, ...extra })

describe('catálogo', () => {
  test('cada valor por defecto es válido, coherente y coincide con lib/planes.ts', () => {
    for (const d of CATALOGO) assert.equal(validarValor(d.clave, d.defecto).ok, true, `por defecto de ${d.clave}`)
    const v = ajustesPorDefecto()
    assert.equal(conflictoEntreAjustes(v), null)
    assert.equal(planesIncoherentes(v), null)
    assert.equal(v.precio_hora, PRECIO_HORA_EXTRA_USD)
    assert.equal(v.precio_mandado, PRECIO_MANDADO_USD)
    assert.equal(v.precio_plan_quincenal, PLANES.quincenal.precioUsd)
    assert.equal(v.precio_plan_semanal, PLANES.semanal.precioUsd)
  })

  test('las claves no se repiten', () => {
    const claves = CATALOGO.map((d) => d.clave)
    assert.equal(new Set(claves).size, claves.length)
  })

  test('decisiones del dueño reflejadas: llamadas sin límite de cantidad, aviso a 20 y corte a 23; 2 detecciones', () => {
    const v = ajustesPorDefecto()
    assert.equal(v.llamada_aviso_min, 20)
    assert.equal(v.llamada_corte_min, 23)
    assert.equal(v.llamada_visita_min, 5)
    assert.equal(v.detecciones_umbral, 2)
    assert.equal(v.foto_retencion_dias, 90)
    assert.ok(!CATALOGO.some((d) => /por (día|semana)|al día|a la semana/i.test(d.etiqueta)), 'no hay tope de cantidad de llamadas')
  })
})

describe('lectura con respaldo', () => {
  test('sin filas devuelve los valores por defecto', async () => {
    assert.equal(await getAjuste('precio_hora'), 22)
    assert.deepEqual(await getAjustes(), ajustesPorDefecto())
  })

  test('un valor guardado y vigente reemplaza al predeterminado; el resto sigue igual', async () => {
    guardar('precio_hora', 25)
    const a = await getAjustes()
    assert.equal(a.precio_hora, 25)
    assert.equal(a.precio_mandado, 22)
  })

  test('un valor guardado inválido se ignora (nunca se rompe el sistema) y un cambio futuro aún no rige', async () => {
    guardar('precio_hora', 0)
    guardar('precio_mandado', 'abc')
    guardar('cancelacion_gratis_horas', 48, { vigente_desde: new Date(Date.now() + 3_600_000).toISOString() })
    guardar('clave_que_no_existe', 5)
    const a = await getAjustes()
    assert.equal(a.precio_hora, 22)
    assert.equal(a.precio_mandado, 22)
    assert.equal(a.cancelacion_gratis_horas, 24)
  })

  test('si la base falla se usan los valores por defecto y se reintenta en la siguiente lectura', async () => {
    guardar('precio_hora', 30)
    db.fail['ajustes:select'] = 1
    assert.equal(await getAjuste('precio_hora'), 22, 'respaldo mientras la base falla')
    assert.equal(await getAjuste('precio_hora'), 30, 'se recupera sin quedarse con el respaldo en caché')
  })

  test('la lectura se guarda en caché unos segundos y limpiarCache la renueva', async () => {
    guardar('precio_hora', 25)
    assert.equal(await getAjuste('precio_hora'), 25)
    db.rows('ajustes')[0].valor = 40
    assert.equal(await getAjuste('precio_hora'), 25, 'sigue en caché')
    limpiarCacheAjustes()
    assert.equal(await getAjuste('precio_hora'), 40)
  })
})

describe('validación', () => {
  test('rangos, tipos y textos', () => {
    assert.equal(validarValor('precio_hora', 0).ok, false)
    assert.equal(validarValor('precio_hora', 501).ok, false)
    assert.equal(validarValor('precio_hora', 'abc').ok, false)
    assert.equal(validarValor('precio_hora', NaN).ok, false)
    assert.deepEqual(validarValor('precio_hora', '30'), { ok: true, valor: 30 })
    assert.equal(validarValor('nadie_abre_espera_min', 5).ok, false)
    assert.equal(validarValor('desconocido', 1).ok, false)
    assert.equal(validarValor('antifraude_cliente', '   ').ok, false)
    assert.equal(validarValor('antifraude_cliente', 'a'.repeat(601)).ok, false)
    assert.deepEqual(validarValor('antifraude_cliente', '  Texto nuevo  '), { ok: true, valor: 'Texto nuevo' })
    assert.equal(validarValor('antifraude_cliente', 12).ok, false)
  })

  test('reglas entre ajustes: corte posterior al aviso, pausa mayor que revisión, contactos en orden', () => {
    const v = ajustesPorDefecto()
    assert.ok(conflictoEntreAjustes({ ...v, llamada_corte_min: 20 }))
    assert.ok(conflictoEntreAjustes({ ...v, canc_pausa: 2 }))
    assert.ok(conflictoEntreAjustes({ ...v, nadie_abre_contacto1_min: 15 }))
    assert.ok(conflictoEntreAjustes({ ...v, nadie_abre_contacto2_min: 30 }))
  })

  test('planes incoherentes: el plan sale más caro que las horas sueltas', () => {
    const v = ajustesPorDefecto()
    assert.deepEqual(planesIncoherentes({ ...v, precio_hora: 15 }), { quincenal: -15, semanal: -20 })
    assert.equal(planesIncoherentes({ ...v, precio_hora: 19 }), null)
  })
})

describe('guardar un cambio', () => {
  test('guarda el valor, deja historial con valor anterior, nuevo y quién, y se ve de inmediato', async () => {
    const r = await setAjuste({ clave: 'precio_hora', valor: 25, actor: 'admin:juan@compaz.test' })
    assert.deepEqual(r, { ok: true })
    assert.equal(await getAjuste('precio_hora'), 25)
    const h = db.rows('ajustes_historial')
    assert.equal(h.length, 1)
    assert.equal(h[0].clave, 'precio_hora')
    assert.equal(h[0].valor_anterior, 22)
    assert.equal(h[0].valor_nuevo, 25)
    assert.equal(h[0].cambiado_por, 'admin:juan@compaz.test')
    assert.equal(db.rows('ajustes')[0].actualizado_por, 'admin:juan@compaz.test')
  })

  test('el mismo valor no ensucia el historial y un segundo cambio guarda el anterior real', async () => {
    await setAjuste({ clave: 'precio_hora', valor: 22, actor: 'admin:a' })
    assert.equal(db.rows('ajustes_historial').length, 0)
    await setAjuste({ clave: 'precio_hora', valor: 25, actor: 'admin:a' })
    await setAjuste({ clave: 'precio_hora', valor: 26, actor: 'admin:b' })
    const h = db.rows('ajustes_historial')
    assert.deepEqual(h.map((x) => [x.valor_anterior, x.valor_nuevo]), [[22, 25], [25, 26]])
    assert.equal(db.rows('ajustes').length, 1, 'una sola fila vigente por ajuste')
  })

  test('rechaza valores fuera de rango, claves desconocidas y conflictos entre ajustes, sin guardar nada', async () => {
    const malo = await setAjuste({ clave: 'precio_hora', valor: 0, actor: 'admin:a' })
    assert.equal(malo.ok === false && malo.codigo, 'invalido')
    const raro = await setAjuste({ clave: 'inventada', valor: 1, actor: 'admin:a' })
    assert.equal(raro.ok === false && raro.codigo, 'invalido')
    const conflicto = await setAjuste({ clave: 'llamada_corte_min', valor: 20, actor: 'admin:a' })
    assert.equal(conflicto.ok === false && conflicto.codigo, 'conflicto')
    assert.equal(db.rows('ajustes').length, 0)
    assert.equal(db.rows('ajustes_historial').length, 0)
  })

  test('un plan más caro que las horas sueltas pide confirmación explícita', async () => {
    const sin = await setAjuste({ clave: 'precio_hora', valor: 15, actor: 'admin:a' })
    assert.equal(sin.ok === false && sin.codigo, 'incoherente')
    assert.equal(await getAjuste('precio_hora'), 22)
    const con = await setAjuste({ clave: 'precio_hora', valor: 15, actor: 'admin:a', confirmarIncoherente: true })
    assert.deepEqual(con, { ok: true })
    assert.equal(await getAjuste('precio_hora'), 15)
    // ya incoherente: seguir ajustando otros valores no se bloquea
    assert.deepEqual(await setAjuste({ clave: 'precio_mandado', valor: 20, actor: 'admin:a' }), { ok: true })
  })

  test('si la base falla al guardar devuelve error y no deja medio cambio', async () => {
    db.fail['guardar_ajuste:rpc'] = 1
    const r = await setAjuste({ clave: 'precio_hora', valor: 25, actor: 'admin:a' })
    assert.equal(r.ok === false && r.codigo, 'base')
    assert.equal(await getAjuste('precio_hora'), 22)
    assert.equal(db.rows('ajustes').length, 0, 'no quedó el valor')
    assert.equal(db.rows('ajustes_historial').length, 0, 'ni un historial de un cambio que no ocurrió')
  })

  test('el texto antifraude se puede cambiar pero nunca dejar vacío', async () => {
    assert.equal((await setAjuste({ clave: 'antifraude_cliente', valor: '', actor: 'admin:a' })).ok, false)
    assert.deepEqual(await setAjuste({ clave: 'antifraude_cliente', valor: 'Nunca pedimos dinero por mensaje.', actor: 'admin:a' }), { ok: true })
    assert.equal(await getAjuste('antifraude_cliente'), 'Nunca pedimos dinero por mensaje.')
  })
})
