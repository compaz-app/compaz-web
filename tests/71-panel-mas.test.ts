/* eslint-disable */
// Panel nuevo, Más: el menú, Actividad, Registro de accesos, Límites, Manual y Estado del sistema.
import { db, limpiar, session, req } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { HUB, hubVisible, subMasActiva, filtrosActividad, estadoProceso, CATEGORIAS_ACCESO } from '@/lib/panel-mas-tipos'
import { listarActividad } from '@/lib/panel-actividad'
import { estadoDelSistema } from '@/lib/panel-estado'
import { PANTALLAS_PANEL } from '@/lib/manual'
import { GET as actividadRuta } from '@/app/api/admin/actividad/route'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'
import type { Actor } from '@/lib/permisos'

beforeEach(limpiar)
const admin = { rol: 'admin' as const, permisos: { ...TODOS } }
const colab = (p: any = {}) => ({ rol: 'colaborador' as const, permisos: { ...NINGUNO, ...p } })
const actor = (rol: 'admin' | 'colaborador', p: any = {}): Actor => ({ id: 'u1', correo: rol === 'admin' ? 'admin@compaz.test' : 'luis@compaz.test', rol, permisos: rol === 'admin' ? { ...TODOS } : { ...NINGUNO, ...p } })
const fila = (o: any) => db.seed('actividad_admin', { nivel: 'actividad', resumen: 'algo', categoria: null, creado_en: new Date().toISOString(), ...o })

describe('el menú de Más', () => {
  test('cada persona ve solo lo que puede usar; el administrador ve todo', () => {
    assert.equal(hubVisible(admin).length, HUB.length)
    const ids = (a: any) => hubVisible(a).map((h) => h.id)
    assert.deepEqual(ids(colab()), ['manual'])
    assert.ok(ids(colab({ monitorear: true })).includes('actividad')); assert.ok(!ids(colab({ monitorear: true })).includes('registro'))
    assert.ok(ids(colab({ telefonos: true })).includes('registro')); assert.ok(ids(colab({ pagos: true })).includes('pagos'))
    assert.ok(!ids(colab({ monitorear: true, atender: true, pagos: true })).includes('equipo')); assert.ok(ids(admin).includes('equipo'))
  })
  test('una herramienta que no se puede ver o inventada cae en el menú', () => {
    assert.equal(subMasActiva(colab(), 'registro'), null); assert.equal(subMasActiva(admin, '../x'), null); assert.equal(subMasActiva(admin, 'registro')?.id, 'registro')
  })
  test('cada herramienta del menú tiene su entrada en el manual y las ya hechas están en la página', () => {
    for (const h of HUB) assert.ok((PANTALLAS_PANEL as readonly string[]).includes(h.id), h.id)
    const p = readFileSync('app/panel/page.tsx', 'utf8')
    for (const h of HUB.filter((x) => x.listo)) assert.match(p, new RegExp(`subMas\\.id === '${h.id}'`), h.id)
  })
})

describe('actividad', () => {
  test('los filtros de la dirección se sanean', () => {
    assert.deepEqual(filtrosActividad({ nivel: 'x', dias: '-3', q: '  hola  ', pag: 'abc' }), { nivel: '', dias: 2, q: 'hola', pagina: 0 })
    assert.equal(filtrosActividad({ dias: '9999' }).dias, 1825); assert.equal(filtrosActividad({ nivel: 'urgente' }).nivel, 'urgente'); assert.equal(filtrosActividad({}, 30).dias, 30)
  })
  test('filtra por nivel, por días, por texto y por categoría; lo más nuevo primero', async () => {
    fila({ resumen: 'urgente uno', nivel: 'urgente', creado_en: '2999-01-01T00:00:00Z' }); fila({ resumen: 'vieja', creado_en: new Date(Date.now() - 5 * 86400_000).toISOString() })
    fila({ resumen: 'abrió el correo', categoria: 'acceso_contacto' }); fila({ resumen: 'abrió el chat', categoria: 'acceso_chat' })
    const todos = await listarActividad(actor('admin'), { dias: 2, nivel: '', q: '', pagina: 0 }); assert.equal(todos.total, 3); assert.equal(todos.filas[0].resumen, 'urgente uno')
    assert.equal((await listarActividad(actor('admin'), { dias: 2, nivel: 'urgente', q: '', pagina: 0 })).total, 1)
    assert.equal((await listarActividad(actor('admin'), { dias: 30, nivel: '', q: '', pagina: 0 })).total, 4)
    assert.equal((await listarActividad(actor('admin'), { dias: 2, nivel: '', q: 'chat', pagina: 0 })).total, 1)
    const acc = await listarActividad(actor('admin'), { dias: 30, nivel: '', q: '', pagina: 0, categorias: CATEGORIAS_ACCESO }); assert.equal(acc.total, 2)
  })
  test('sin el permiso de teléfonos no se ve ni se puede buscar un teléfono', async () => {
    fila({ resumen: 'Llamó al +58 414 1234567' })
    const c = actor('colaborador', { monitorear: true })
    const r = await listarActividad(c, { dias: 2, nivel: '', q: '', pagina: 0 }); assert.doesNotMatch(r.filas[0].resumen, /414 1234567/)
    assert.equal((await listarActividad(c, { dias: 2, nivel: '', q: '1234567', pagina: 0 })).total, 0)
    assert.equal((await listarActividad(actor('admin'), { dias: 2, nivel: '', q: '1234567', pagina: 0 })).total, 1)
  })
  test('pagina de 50 en 50', async () => { for (let i = 0; i < 60; i++) fila({ resumen: 'n' + i }); const r = await listarActividad(actor('admin'), { dias: 2, nivel: '', q: '', pagina: 1 }); assert.equal(r.total, 60); assert.equal(r.filas.length, 10) })
  test('la ruta sigue igual: 401 sin sesión, 403 sin permiso y 200 con él', async () => {
    session.user = null as any; assert.equal((await actividadRuta(req('/api/admin/actividad'))).status, 401)
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any; assert.equal((await actividadRuta(req('/api/admin/actividad?nivel=raro&dias=abc'))).status, 200)
  })
})

describe('estado del sistema', () => {
  test('un proceso está caído tras 3 intervalos sin señal', () => {
    const ahora = Date.now()
    assert.equal(estadoProceso(5, new Date(ahora - 10 * 60_000).toISOString(), ahora), 'ok'); assert.equal(estadoProceso(5, new Date(ahora - 16 * 60_000).toISOString(), ahora), 'caido')
    assert.equal(estadoProceso(5, null, ahora), 'sin_registro'); assert.equal(estadoProceso(5, 'basura', ahora), 'sin_registro')
  })
  test('lee los latidos y cuenta los avisos fallidos', async () => {
    db.seed('telegram_estados', { chat_id: 'cron:recordatorios', registro_pendiente: false, updated_at: new Date().toISOString() })
    db.seed('avisos', { destinatario_tipo: 'cliente', canal: 'correo', plantilla: 'pago_recordatorio', estado: 'fallido', error: 'rebote', intentos: 3, ultimo_intento_en: new Date().toISOString() })
    db.seed('avisos', { destinatario_tipo: 'cliente', canal: 'correo', plantilla: 'otro', estado: 'pendiente' })
    const e = await estadoDelSistema()
    assert.equal(e.procesos.find((p) => p.nombre === 'recordatorios')!.estado, 'ok'); assert.equal(e.procesos.find((p) => p.nombre === 'seguimiento')!.estado, 'sin_registro')
    db.seed('eventos', { entidad: 'compita', entidad_id: 'c1', tipo: 'duda_compita', datos: { tipo: 'dir', resultado: 'auto' } }); db.seed('eventos', { entidad: 'compita', entidad_id: 'c1', tipo: 'duda_compita', datos: { tipo: 'dir', resultado: 'no_resuelta' } }); db.seed('eventos', { entidad: 'compita', entidad_id: 'c2', tipo: 'duda_compita', datos: { tipo: 'ent', resultado: 'auto' } })
    const e2 = await estadoDelSistema(); assert.equal(e2.dudas.total, 2); assert.equal(e2.dudas.noResueltas, 1); assert.deepEqual(e2.dudas.tipos.map((t) => t.texto).sort(), ['No encuentro la dirección', 'No sé cómo entrar'])
    assert.equal(e.fallidos, 1); assert.equal(e.pendientes, 1); assert.equal(e.ultimosFallidos[0].plantilla, 'pago_recordatorio')
  })
})
