/* eslint-disable */
// Más, Equipo y permisos: la lista, los cambios y el historial.
import { db, limpiar, req, session } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describirCambioEquipo, cambiosDePermisos, contarPermisos, DETALLE_PERMISO } from '@/lib/panel-equipo-tipos'
import { datosDeEquipo } from '@/lib/panel-equipo'
import { invitarColaborador, cambiarPermisos, cambiarActivo, eliminarColaborador } from '@/lib/equipo'
import { PERMISOS, PERMISOS_BASE, ETIQUETA_PERMISO } from '@/lib/permisos-catalogo'
import { PATCH, POST, DELETE } from '@/app/api/admin/equipo/route'
import { subMasActiva } from '@/lib/panel-mas-tipos'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'

beforeEach(limpiar)

describe('lógica pura', () => {
  test('cada permiso tiene su explicación', () => { for (const p of PERMISOS) assert.ok(DETALLE_PERMISO[p] && DETALLE_PERMISO[p].length > 20, p); assert.equal(Object.keys(DETALLE_PERMISO).length, PERMISOS.length) })
  test('qué cambió entre dos juegos de permisos y cuántos hay activos', () => {
    assert.deepEqual(cambiosDePermisos({ chats: true, pagos: true }, { chats: true, cuentas: true }), { activo: ['cuentas'], quito: ['pagos'] })
    assert.deepEqual(cambiosDePermisos(null, { a: true }), { activo: ['a'], quito: [] }); assert.equal(contarPermisos({ ...PERMISOS_BASE }), 5); assert.equal(contarPermisos({}), 0)
  })
  test('el historial se cuenta en palabras llanas', () => {
    assert.match(describirCambioEquipo('alta', { permisos: { chats: true, atender: true } }), /con 2 permisos/); assert.match(describirCambioEquipo('desactivado', {}), /ya no puede entrar/); assert.match(describirCambioEquipo('reactivado', {}), /vuelve a entrar/)
    const t = describirCambioEquipo('permisos', { antes: { pagos: true }, despues: { cuentas: true } }); assert.ok(t.includes(`Activó: ${ETIQUETA_PERMISO.cuentas}.`)); assert.ok(t.includes(`Quitó: ${ETIQUETA_PERMISO.pagos}.`))
    assert.match(describirCambioEquipo('permisos', { antes: {}, despues: {} }), /sin cambios/); assert.equal(describirCambioEquipo('rara', {}), 'rara')
  })
  test('Equipo solo lo ve un administrador', () => {
    assert.equal(subMasActiva({ rol: 'admin', permisos: { ...TODOS } }, 'equipo')?.id, 'equipo'); assert.equal(subMasActiva({ rol: 'colaborador', permisos: { ...NINGUNO, monitorear: true, atender: true, pagos: true } }, 'equipo'), null)
  })
})

describe('datos reales', () => {
  test('lista a los administradores de ADMIN_EMAILS, a los colaboradores y el historial con quién y qué', async () => {
    await invitarColaborador('luis@compaz.test', 'Luis', { chats: true, atender: true }, 'admin@compaz.test')
    await cambiarPermisos('luis@compaz.test', { chats: true, pagos: true }, 'admin@compaz.test'); await cambiarActivo('luis@compaz.test', false, 'admin@compaz.test')
    const d = await datosDeEquipo()
    assert.deepEqual(d.admins, ['admin@compaz.test']); assert.equal(d.colaboradores.length, 1); const c = d.colaboradores[0]
    assert.equal(c.nombre, 'Luis'); assert.equal(c.activo, false); assert.equal(c.permisos.pagos, true); assert.equal(c.permisos.atender, false); assert.equal(c.creadoPor, 'admin@compaz.test')
    assert.equal(d.historial.length, 3); assert.ok(d.historial.some((h) => /desactivó/.test(h.texto)) && d.historial.some((h) => /Se agregó al equipo/.test(h.texto))); assert.ok(d.historial.some((h) => /Activó: .*pagos|Activó: Registrar y anular pagos/.test(h.texto) && h.por === 'admin@compaz.test'))
  })
})

describe('permisos de la ruta', () => {
  test('un colaborador con todos los permisos menos el de raíz no puede invitar ni cambiar permisos, ni a sí mismo', async () => {
    await invitarColaborador('luis@compaz.test', 'Luis', { ...TODOS }, 'admin@compaz.test')
    session.user = { id: 'u', email: 'luis@compaz.test' } as any
    assert.equal((await POST(req('/api/admin/equipo', { method: 'POST', json: { correo: 'otro@compaz.test', nombre: 'Otro' } }))).status, 403)
    assert.equal((await PATCH(req('/api/admin/equipo', { method: 'PATCH', json: { correo: 'luis@compaz.test', permisos: { ...TODOS } } }))).status, 403)
    assert.equal(db.rows('equipo').length, 1)
  })
  test('el administrador invita con los permisos recomendados y queda en el historial', async () => {
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    assert.equal((await POST(req('/api/admin/equipo', { method: 'POST', json: { correo: 'ana@compaz.test', nombre: 'Ana', permisos: PERMISOS_BASE } }))).status, 201)
    const f = db.rows('equipo')[0]; assert.equal(f.permisos.chats, true); assert.equal(f.permisos.pagos, undefined); assert.equal(db.rows('equipo_historial')[0].accion, 'alta')
  })
})

describe('quitar a un colaborador del equipo', () => {
  test('borra su fila, le corta el acceso, y el historial conserva quién era y qué permisos tenía', async () => {
    await invitarColaborador('luis@compaz.test', 'Luis', { chats: true, atender: true }, 'admin@compaz.test')
    const r = await eliminarColaborador('LUIS@compaz.test', 'admin@compaz.test'); assert.equal(r.ok, true); assert.equal(db.rows('equipo').length, 0)
    const h = db.rows('equipo_historial').find((x: any) => x.accion === 'eliminado')!; assert.equal(h.hecho_por, 'admin@compaz.test'); assert.equal(h.detalle.nombre, 'Luis'); assert.deepEqual(Object.keys(h.detalle.permisos).sort(), ['atender', 'chats'])
    assert.match(describirCambioEquipo('eliminado', h.detalle), /Se quitó del equipo/); assert.equal(db.rows('equipo_historial').length, 2)
    assert.equal(((await eliminarColaborador('luis@compaz.test', 'admin@compaz.test')) as any).status, 404)
  })
  test('solo el administrador raíz puede: un colaborador con todo lo demás recibe 403 y nadie sale del equipo', async () => {
    await invitarColaborador('luis@compaz.test', 'Luis', { ...TODOS }, 'admin@compaz.test'); await invitarColaborador('ana@compaz.test', 'Ana', {}, 'admin@compaz.test')
    session.user = { id: 'u', email: 'luis@compaz.test' } as any
    assert.equal((await DELETE(req('/api/admin/equipo', { method: 'DELETE', json: { correo: 'ana@compaz.test' } }))).status, 403)
    assert.equal((await DELETE(req('/api/admin/equipo', { method: 'DELETE', json: { correo: 'luis@compaz.test' } }))).status, 403); assert.equal(db.rows('equipo').length, 2)
    session.user = null as any; assert.equal((await DELETE(req('/api/admin/equipo', { method: 'DELETE', json: { correo: 'ana@compaz.test' } }))).status, 401)
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    assert.equal((await DELETE(req('/api/admin/equipo', { method: 'DELETE', json: {} }))).status, 400)
    assert.equal((await DELETE(req('/api/admin/equipo', { method: 'DELETE', json: { correo: 'ana@compaz.test' } }))).status, 200); assert.deepEqual(db.rows('equipo').map((x: any) => x.correo), ['luis@compaz.test'])
  })
  test('un administrador no se puede quitar por aquí: no está en la tabla del equipo', async () => {
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    assert.equal((await DELETE(req('/api/admin/equipo', { method: 'DELETE', json: { correo: 'admin@compaz.test' } }))).status, 404)
  })
  test('la pantalla tiene su botón con confirmación', () => { const s = readFileSync('components/panel/mas/EquipoAcciones.tsx', 'utf8'); assert.match(s, /Quitar del equipo/); assert.match(s, /enviar\('DELETE'/); assert.match(s, /setConfirmarQuitar/) })
})

describe('guardias de código', () => {
  test('las acciones del navegador no importan código de servidor, y la página y el manual hablan de lo mismo', () => {
    assert.doesNotMatch(readFileSync('components/panel/mas/EquipoAcciones.tsx', 'utf8'), /supabase-server|lib\/panel-equipo'|lib\/equipo'|lib\/admins|lib\/permisos'|\.from\(/)
    assert.match(readFileSync('app/panel/page.tsx', 'utf8'), /datosDeEquipo/)
    assert.doesNotMatch(JSON.stringify(readFileSync('lib/manual.ts', 'utf8').match(/id: 'cta-equipo'[\s\S]*?busca/)), /manda un correo|Volver a lo recomendado/)
  })
})
