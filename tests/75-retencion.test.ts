/* eslint-disable */
// Cuánto tiempo se guarda cada cosa: la limpieza conserva los accesos a datos sensibles más tiempo y el catálogo dice la verdad.
import { db, limpiar, cron, ahoraMas } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { POST as limpieza } from '@/app/api/cron/limpieza/route'
import { retencionDelSistema } from '@/lib/retencion'
import { getAjustes, setAjuste, limpiarCacheAjustes, CATALOGO } from '@/lib/ajustes'
import { CATEGORIAS_ACCESO } from '@/lib/panel-mas-tipos'
import { ENTRADAS } from '@/lib/manual'

beforeEach(limpiar)
const hace = (dias: number) => ahoraMas(-dias * 24 * 60)
const fila = (categoria: string | null, dias: number, resumen = 'x') => db.seed('actividad_admin', { nivel: 'actividad', resumen, categoria, creado_en: hace(dias) }) as any

describe('la limpieza diaria', () => {
  test('la actividad normal se borra a los 90 días y los accesos a datos sensibles se conservan hasta el año', async () => {
    const info = fila('tarea_resuelta', 100), sinCat = fila(null, 100), chat = fila('acceso_chat', 100), contacto = fila('acceso_contacto', 200), reciente = fila('tarea_resuelta', 10), viejo = fila('acceso_contacto', 400), viejoChat = fila('acceso_chat', 366)
    assert.equal((await limpieza(cron('l'))).status, 200)
    const quedan = db.rows('actividad_admin')
    assert.ok(!quedan.includes(info) && !quedan.includes(sinCat), 'lo informativo de más de 90 días se borra')
    assert.ok(quedan.includes(chat) && quedan.includes(contacto) && quedan.includes(reciente), 'los accesos de 100 y 200 días y lo reciente se conservan')
    assert.ok(!quedan.includes(viejo) && !quedan.includes(viejoChat), 'los accesos de más de un año se borran')
  })
  test('el plazo de los accesos se puede cambiar en Ajustes', async () => {
    await setAjuste({ clave: 'accesos_retencion_dias', valor: 120, actor: 'admin:a' }); limpiarCacheAjustes()
    const a = fila('acceso_chat', 100), b = fila('acceso_chat', 130)
    await limpieza(cron('l')); assert.ok(db.rows('actividad_admin').includes(a)); assert.ok(!db.rows('actividad_admin').includes(b))
  })
})

describe('el catálogo de plazos', () => {
  test('dice 1 año para accesos y 90 días para lo demás, con los valores reales de Ajustes', async () => {
    limpiarCacheAjustes()
    const r = retencionDelSistema(await getAjustes()); const por = Object.fromEntries(r.map((x) => [x.id, x]))
    assert.match(por.accesos.plazo, /1 año \(365 días\)/); assert.equal(por.actividad.plazo, '90 días'); assert.equal(por.avisos.plazo, '90 días'); assert.equal(por.fotos.plazo, '90 días')
    assert.equal(por.notas.plazo, 'No se borran solas'); assert.equal(por.cuentas.plazo, '7 días')
    await setAjuste({ clave: 'accesos_retencion_dias', valor: 730, actor: 'admin:a' }); limpiarCacheAjustes()
    assert.match(retencionDelSistema(await getAjustes()).find((x) => x.id === 'accesos')!.plazo, /2 años/)
  })
  test('las claves de Ajustes que usa existen y la limpieza las lee', () => {
    for (const k of ['avisos_retencion_dias', 'accesos_retencion_dias', 'foto_retencion_dias']) assert.ok((CATALOGO as readonly any[]).some((a) => a.clave === k), k)
    const c = readFileSync('app/api/cron/limpieza/route.ts', 'utf8'); assert.match(c, /accesos_retencion_dias/); assert.match(c, /CATEGORIAS_ACCESO/); assert.equal(CATEGORIAS_ACCESO.length, 2)
  })
  test('el manual y las pantallas muestran el plazo (no está escrito a mano en números)', () => {
    const act = readFileSync('components/panel/mas/Actividad.tsx', 'utf8'); assert.doesNotMatch(act, /90 días/); assert.match(act, /plazo/)
    assert.match(readFileSync('components/panel/mas/Manual.tsx', 'utf8'), /Cuánto tiempo se guarda cada cosa/)
    assert.ok(ENTRADAS.length > 0)
  })
})

describe('ver los registros guardados (un año completo, no solo los últimos 500)', () => {
  const { listarActividad } = require('@/lib/panel-actividad')
  const { TODOS, NINGUNO } = require('@/lib/permisos-catalogo')
  const adm = { id: 'a', correo: 'admin@compaz.test', rol: 'admin', permisos: { ...TODOS } }
  const col = { id: 'c', correo: 'c@compaz.test', rol: 'colaborador', permisos: { ...NINGUNO, monitorear: true } }
  test('con permiso de teléfonos la base busca y pagina: llega a registros de hace 11 meses aunque haya miles después', async () => {
    for (let i = 0; i < 700; i++) fila('acceso_chat', 1, `abrió el chat ${i}`)
    fila('acceso_contacto', 330, 'luis@compaz.test abrió el correo de Ana Gómez. Motivo: Reclamo del cliente')
    const r = await listarActividad(adm, { dias: 365, nivel: '', q: 'Ana Gómez', pagina: 0, categorias: CATEGORIAS_ACCESO })
    assert.equal(r.total, 1); assert.match(r.filas[0].resumen, /Reclamo del cliente/)
    const p = await listarActividad(adm, { dias: 365, nivel: '', q: '', pagina: 14, categorias: CATEGORIAS_ACCESO }); assert.equal(p.total, 701); assert.equal(p.filas.length, 1)
  })
  test('se busca por el correo de quien lo vio y la búsqueda con signos raros no rompe nada', async () => {
    fila('acceso_chat', 5, 'luis@compaz.test abrió el chat'); fila('acceso_chat', 5, 'otra@compaz.test abrió el chat')
    assert.equal((await listarActividad(adm, { dias: 30, nivel: '', q: 'luis@compaz.test', pagina: 0 })).total, 1)
    assert.doesNotMatch(JSON.stringify(await listarActividad(adm, { dias: 30, nivel: '', q: 'x),resumen.ilike.%', pagina: 0 })), /error/i)
  })
  test('sin permiso de teléfonos no se puede adivinar un teléfono tapado preguntando por él', async () => {
    fila('tarea_resuelta', 1, 'Llamó al +58 414 1234567')
    assert.equal((await listarActividad(col, { dias: 2, nivel: '', q: '1234567', pagina: 0 })).total, 0)
    assert.equal((await listarActividad(adm, { dias: 2, nivel: '', q: '1234567', pagina: 0 })).total, 1)
  })
  test('el manual dice la ruta: Registro de accesos, el periodo y cómo buscar, y no promete que no se borra', () => {
    const e = ENTRADAS.find((x) => x.id === 'cfg-registro')!; assert.equal(e.permiso, 'telefonos'); assert.match(JSON.stringify(e), /Registro de accesos/); assert.match(JSON.stringify(e), /1 año/); assert.doesNotMatch(JSON.stringify(e), /No se puede borrar ni editar: es la memoria/)
    assert.ok(ENTRADAS.some((x) => x.id === 'cfg-hizo-colaborador'))
  })
})
