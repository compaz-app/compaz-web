/* eslint-disable */
// Más, Ajustes y Ajustes del semáforo: leer, guardar en bloque (todo o nada), historial, permisos y umbrales reales.
import { db, limpiar, req, session, mkCliente, mkCompita, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CATALOGO, getAjustes, setAjustes, limpiarCacheAjustes, conflictoEntreAjustes, ajustesPorDefecto } from '@/lib/ajustes'
import { datosDeAjustes, esDelSemaforo } from '@/lib/panel-ajustes'
import { umbralesDeAjustes, urgenciaDe, UMBRALES, ETAPAS } from '@/lib/panel-seguimiento-tipos'
import { listarSeguimiento } from '@/lib/panel-seguimiento'
import { PATCH } from '@/app/api/admin/ajustes/route'
import { invitarColaborador } from '@/lib/equipo'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'
import { ahoraMas } from './harness'

beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const adm = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } as any }
const llamar = (cambios: any, extra: any = {}) => PATCH(req('/api/admin/ajustes', { method: 'PATCH', json: { cambios, ...extra } }))

describe('el semáforo vive en Ajustes', () => {
  test('hay 12 ajustes del semáforo con los mismos valores de fábrica que antes', () => {
    const s = CATALOGO.filter((a) => a.grupo === 'Semáforo de Seguimiento'); assert.equal(s.length, 12)
    const v = ajustesPorDefecto() as any, u = umbralesDeAjustes(v)
    for (const e of ETAPAS) assert.deepEqual(u[e], UMBRALES[e], e)
  })
  test('cambiar un umbral cambia el color: con 100 horas "Pago" es rojo, y con el rojo en 200 pasa a amarillo', () => {
    assert.equal(urgenciaDe('Pago', 100), 'rojo'); const u = umbralesDeAjustes({ ...(ajustesPorDefecto() as any), semaforo_pago_rojo: 200 }); assert.equal(urgenciaDe('Pago', 100, u), 'amarillo')
  })
  test('Seguimiento usa los ajustes de verdad', async () => {
    const c = mkCompita({} as any), cli = mkCliente({ nombre: 'Ana' } as any); mkSolicitud(cli, c, { estado: 'pendiente', created_at: ahoraMas(-30 * 60) })
    assert.equal((await listarSeguimiento())[0].urgencia, 'rojo')
    adm(); assert.equal((await llamar({ semaforo_solicitud_rojo: 100, semaforo_solicitud_amarillo: 50 })).status, 200); limpiarCacheAjustes()
    assert.equal((await listarSeguimiento())[0].urgencia, 'verde')
  })
  test('el rojo debe llegar después del amarillo', () => { assert.match(conflictoEntreAjustes({ ...(ajustesPorDefecto() as any), semaforo_ficha_rojo: 10, semaforo_ficha_amarillo: 20 })!, /rojo de ficha/); assert.equal(conflictoEntreAjustes(ajustesPorDefecto() as any), null) })
})

describe('guardar en bloque (todo o nada)', () => {
  test('guarda varios cambios, cada uno con su fila de historial, y un valor igual no ensucia el historial', async () => {
    const r = await setAjustes({ cambios: { precio_hora: 25, recordatorio_cliente_max: 4, precio_mandado: ajustesPorDefecto().precio_mandado as number }, actor: 'admin@compaz.test', confirmarIncoherente: true })
    assert.deepEqual((r as any).cambiados.sort(), ['precio_hora', 'recordatorio_cliente_max']); limpiarCacheAjustes()
    const a = await getAjustes(); assert.equal(a.precio_hora, 25); assert.equal(a.recordatorio_cliente_max, 4)
    const h = db.rows('ajustes_historial'); assert.equal(h.length, 2); assert.ok(h.every((x: any) => x.cambiado_por === 'admin@compaz.test'))
  })
  test('si un valor no sirve no se guarda NADA, ni los buenos', async () => {
    const r = await setAjustes({ cambios: { precio_hora: 30, recordatorio_cliente_max: -5 }, actor: 'x' }); assert.equal(r.ok, false); assert.equal((r as any).codigo, 'invalido')
    limpiarCacheAjustes(); assert.equal((await getAjustes()).precio_hora, ajustesPorDefecto().precio_hora); assert.equal(db.rows('ajustes_historial').length, 0)
  })
  test('las reglas entre ajustes se miran con el conjunto: bajar el rojo y subir el amarillo a la vez se rechaza', async () => {
    const r = await setAjustes({ cambios: { semaforo_pago_amarillo: 20, semaforo_pago_rojo: 10 }, actor: 'x' }); assert.equal((r as any).codigo, 'conflicto'); assert.equal(db.rows('ajustes_historial').length, 0)
    assert.equal((await setAjustes({ cambios: { semaforo_pago_amarillo: 20, semaforo_pago_rojo: 40 }, actor: 'x' })).ok, true)
  })
  test('un plan más caro que las horas sueltas pide confirmación', async () => {
    const r = await setAjustes({ cambios: { precio_hora: 10 }, actor: 'x' }); assert.equal((r as any).codigo, 'incoherente'); assert.equal(db.rows('ajustes_historial').length, 0)
    assert.equal((await setAjustes({ cambios: { precio_hora: 10 }, actor: 'x', confirmarIncoherente: true })).ok, true)
  })
})

describe('la ruta', () => {
  test('401 sin sesión, 403 con solo el permiso de ver, 400 con cuerpo malo y 200 para quien puede editar', async () => {
    session.user = null as any; assert.equal((await llamar({ recordatorio_cliente_max: 4 })).status, 401)
    await invitarColaborador('ver@compaz.test', 'Ver', { ajustes_ver: true, monitorear: true }, 'admin@compaz.test'); session.user = { id: 'u', email: 'ver@compaz.test' } as any
    assert.equal((await llamar({ recordatorio_cliente_max: 4 })).status, 403)
    await invitarColaborador('edi@compaz.test', 'Edi', { ajustes_editar: true }, 'admin@compaz.test'); session.user = { id: 'e', email: 'edi@compaz.test' } as any
    assert.equal((await llamar({})).status, 400); assert.equal((await llamar({ no_existe: 1 })).status, 400); assert.equal((await llamar({ precio_hora: 'abc' })).status, 400)
    assert.equal((await llamar({ recordatorio_cliente_max: 4 })).status, 200); assert.ok(db.rows('actividad_admin').some((x: any) => x.categoria === 'ajustes_cambiados' && /edi@compaz\.test/.test(x.resumen)))
  })
  
})

describe('los datos de la pantalla', () => {
  test('trae todos los ajustes con su valor vigente y el historial con etiquetas legibles', async () => {
    adm(); await llamar({ canc_ventana_dias: 45 }); limpiarCacheAjustes()
    const d = await datosDeAjustes(); assert.equal(d.ajustes.length, CATALOGO.length); assert.equal(d.ajustes.find((a) => a.clave === 'canc_ventana_dias')!.valor, 45)
    assert.ok(d.ajustes.filter(esDelSemaforo).length === 12); assert.ok(d.ajustes.every((a) => a.usa.length > 0))
    assert.match(d.historial[0].etiqueta, /Ventana para contar las cancelaciones/); assert.equal(d.historial[0].nuevo, '45 días'); assert.equal(d.historial[0].por, 'admin@compaz.test')
  })
})

describe('cada ajuste se explica de verdad en su ⓘ', () => {
  test('todos tienen una explicación propia: qué es, para qué sirve y qué pasa al cambiarlo', () => {
    const vistas = new Set<string>()
    for (const a of CATALOGO as readonly any[]) {
      assert.ok(typeof a.explica === 'string' && a.explica.length >= 90 && a.explica.length <= 420, `${a.clave}: la explicación mide ${a.explica?.length}`)
      assert.match(a.explica, /[.)]$/, `${a.clave}: debe terminar en punto`); assert.doesNotMatch(a.explica, /^Se usa en|Se usa en:/, `${a.clave}: dónde se usa va aparte`)
      assert.ok(!vistas.has(a.explica), `${a.clave}: explicación repetida`); vistas.add(a.explica)
    }
  })
  test('la explicación sale primero en el ⓘ, antes de dónde se usa y del valor de fábrica', () => {
    const f = readFileSync('components/panel/mas/AjustesForm.tsx', 'utf8'); assert.match(f, /\$\{f\.explica\} Se usa en:/)
  })
  test('las explicaciones numéricas dicen la verdad sobre los valores de fábrica que citan', () => {
    const e = (k: string) => (CATALOGO as readonly any[]).find((a) => a.clave === k)!
    assert.match(e('canc_revision').explica, /Con 2/); assert.equal(e('canc_revision').defecto, 2)
    assert.match(e('canc_ventana_dias').explica, /Con 30/); assert.equal(e('canc_ventana_dias').defecto, 30)
    assert.match(e('cambio_lugar_pct').explica, /25 %/); assert.equal(e('cambio_lugar_pct').defecto, 25)
    assert.match(e('detecciones_ventana_dias').explica, /Con 30/); assert.equal(e('detecciones_ventana_dias').defecto, 30)
  })
})

describe('ningún ajuste promete lo que el sistema no hace', () => {
  const codigo = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? codigo(p) : /\.tsx?$/.test(p) ? [p] : [] })
  const PROPIOS = /lib\/ajustes\.ts|lib\/panel-ajustes|lib\/panel-mas|lib\/manual\.ts|lib\/esperas-catalogo|lib\/retencion\.ts|AjustesForm|app\/prototipo/
  const fuentes = ['lib', 'app', 'components'].flatMap(codigo).filter((f) => !PROPIOS.test(f))
  test('todo ajuste que NO está marcado "aún no conectado" lo lee de verdad alguna parte del sistema', () => {
    const textos = fuentes.map((f) => readFileSync(f, 'utf8'))
    for (const a of CATALOGO as readonly any[]) {
      if (a.conectado === false || a.clave.startsWith('semaforo_')) continue // el semáforo se lee con la plantilla `semaforo_${etapa}_...`
      assert.ok(textos.some((t) => t.includes(a.clave)), `${a.clave} no lo lee nadie: o se conecta o se marca conectado: false`)
    }
    assert.ok(readFileSync('lib/panel-seguimiento-tipos.ts', 'utf8').includes('semaforo_${CLAVE_ETAPA'))
  })
  test('lo marcado "aún no conectado" no se puede cambiar por la ruta (y no se guarda NADA, ni lo demás que venga con ello)', async () => {
    const no = (CATALOGO as readonly any[]).filter((a) => a.conectado === false); if (!no.length) return // hoy todos están conectados: el mecanismo sigue en la ruta para el próximo que se agregue
    adm()
    for (const a of no) { const r = await llamar({ [a.clave]: a.min ?? 5 }); assert.equal(r.status, 400, a.clave); assert.match((await r.json()).error, /no está conectado/, a.clave) }
    assert.equal(db.rows('ajustes_historial').length, 0); assert.equal((await llamar({ recordatorio_cliente_max: 4, [no[0].clave]: 5 })).status, 400); limpiarCacheAjustes(); assert.equal((await getAjustes()).recordatorio_cliente_max, ajustesPorDefecto().recordatorio_cliente_max)
  })
  test('la pantalla los marca y los deja en solo lectura', () => { const f = readFileSync('components/panel/mas/AjustesForm.tsx', 'utf8'); assert.match(f, /Aún no conectado/); assert.match(f, /disabled=\{!puedeEditar \|\| !f\.conectado\}/) })
})

describe('guardias de código', () => {
  test('el formulario no importa código de servidor, y la página conecta las dos herramientas', () => {
    assert.doesNotMatch(readFileSync('components/panel/mas/AjustesForm.tsx', 'utf8'), /supabase-server|lib\/ajustes'|lib\/panel-ajustes'|lib\/permisos'|\.from\(/)
    const p = readFileSync('app/panel/page.tsx', 'utf8'); assert.match(p, /subMas\.id === 'ajustes' \|\| subMas\.id === 'umbrales'/); assert.match(p, /datosDeAjustes/)
  })
})
