/* eslint-disable */
// Guardia de permisos del panel (lib/permisos.ts). Ocultar botones no protege nada: esto prueba que el SERVIDOR niega.
import { db, session, limpiar, req } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { resolverActor, normalizarPermisos, puede, PERMISOS, PERMISOS_BASE } from '@/lib/permisos'
import { GET as pagosGet } from '@/app/api/admin/pagos/route'
import { POST as registrarPago } from '@/app/api/admin/registrar-pago/route'
import { DELETE as eliminarCliente } from '@/app/api/admin/eliminar-cliente/route'
import { POST as demoReset } from '@/app/api/admin/demo/reset/route'
import { GET as previewGet } from '@/app/api/admin/cliente-preview/route'
import { GET as flagsGet } from '@/app/api/admin/flags/route'
import { POST as invitarCliente } from '@/app/api/admin/invitar-cliente/route'
import { POST as bloquearCliente } from '@/app/api/admin/bloquear-cliente/route'
import { GET as equipoGet, POST as equipoPost, PATCH as equipoPatch } from '@/app/api/admin/equipo/route'

beforeEach(limpiar)

const como = (correo: string | null) => { session.user = correo ? { id: `id-${correo}`, email: correo } : null }
const colab = (correo: string, permisos: Record<string, unknown>, activo = true) =>
  db.seed('equipo', { correo, nombre: correo.split('@')[0], permisos, activo, creado_por: 'admin@compaz.test' })
const j = (path: string, method: string, json: unknown = {}) => req(path, { method, json })

// ── Rutas y el permiso que cada una exige. Una ruta nueva que no esté aquí hace fallar la prueba estática. ──
const ESPERADO: Record<string, string> = {
  'anular-pago': 'pagos', 'pagos': 'pagos', 'registrar-pago': 'pagos',
  'bloquear-cliente': 'cuentas', 'bloquear-compita': 'cuentas', 'toggle-estado': 'cuentas', 'toggle-verificado': 'cuentas',
  'compita': 'cuentas', 'upload-foto': 'cuentas', 'postulaciones/resolver': 'cuentas',
  'eliminar-cliente': 'raiz', 'eliminar-compita': 'raiz', 'equipo': 'raiz',
  'demo/aceptar-entrevista': 'raiz', 'demo/cerrar-visita': 'raiz', 'demo/crear-visita': 'raiz', 'demo/estado': 'raiz',
  'demo/iniciar-visita': 'raiz', 'demo/reset': 'raiz',
  'flags': 'atender', 'resenas': 'atender', 'asignar-compita': 'atender', 'confirmar-solicitud': 'atender',
  'completar-solicitud': 'atender', 'forzar-cierre-visita': 'atender', 'enviar-link-llamada': 'atender',
  'cliente-preview': 'monitorear', 'dudas': 'monitorear', 'actividad': 'monitorear',
  'generar-invite': 'invitar', 'invitar-cliente': 'invitar', 'registrar-compita': 'invitar',
}
// Rutas que NO usan sesión de panel sino un enlace de un solo uso (token) enviado al administrador.
const POR_TOKEN = ['asignar-rapido']

function rutas(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return rutas(p, base)
    return n === 'route.ts' ? [p.slice(base.length + 1, -'/route.ts'.length)] : []
  })
}

describe('inventario de rutas del panel (prueba estática)', () => {
  const dir = join(process.cwd(), 'app/api/admin')
  const todas = rutas(dir)

  test('toda ruta de /api/admin está en el inventario: ninguna queda sin decidir', () => {
    const sinDecidir = todas.filter((r) => !(r in ESPERADO) && !POR_TOKEN.includes(r))
    assert.deepEqual(sinDecidir, [], `Rutas nuevas sin permiso asignado: ${sinDecidir.join(', ')}`)
    const fantasma = Object.keys(ESPERADO).filter((r) => !todas.includes(r))
    assert.deepEqual(fantasma, [], `El inventario menciona rutas que ya no existen: ${fantasma.join(', ')}`)
  })

  test('cada ruta llama a requierePermiso con EXACTAMENTE el permiso del inventario y no usa la comprobación vieja', () => {
    for (const r of todas.filter((x) => x in ESPERADO)) {
      const src = readFileSync(join(dir, r, 'route.ts'), 'utf8')
      const usados = [...src.matchAll(/requierePermiso\('([a-z_]+)'\)/g)].map((m) => m[1])
      assert.ok(usados.length > 0, `${r}: no llama a requierePermiso`)
      assert.ok(usados.every((u) => u === ESPERADO[r]), `${r}: pide ${usados.join('/')} y debería pedir ${ESPERADO[r]}`)
      assert.ok(!/getAdminUser|isAdminEmail/.test(src), `${r}: sigue usando la comprobación vieja`)
      const metodos = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].length
      assert.ok(usados.length >= metodos, `${r}: hay ${metodos} métodos y solo ${usados.length} llamadas a la guardia`)
    }
  })

  test('las rutas por token no aceptan una sesión: siguen exigiendo el token', () => {
    for (const r of POR_TOKEN) {
      const src = readFileSync(join(dir, r, 'route.ts'), 'utf8')
      assert.match(src, /action_tokens/, `${r} debe validar un token de un solo uso`)
    }
  })

  test('los permisos pedidos por el inventario existen en el catálogo', () => {
    for (const p of new Set(Object.values(ESPERADO))) assert.ok(p === 'raiz' || (PERMISOS as readonly string[]).includes(p), `permiso desconocido: ${p}`)
  })
})

describe('resolverActor y permisos (función pura)', () => {
  test('el administrador raíz de ADMIN_EMAILS tiene todo, aunque exista una fila que diga lo contrario', () => {
    const a = resolverActor('1', 'ADMIN@compaz.test', { correo: 'admin@compaz.test', activo: false, permisos: {} })!
    assert.equal(a.rol, 'admin')
    for (const p of PERMISOS) assert.ok(puede(a, p))
    assert.ok(puede(a, 'raiz'))
  })

  test('un colaborador solo tiene lo activado expresamente; nunca "raiz"', () => {
    const a = resolverActor('2', 'luis@x.test', { correo: 'luis@x.test', activo: true, permisos: { atender: true, pagos: false } })!
    assert.equal(a.rol, 'colaborador')
    assert.ok(puede(a, 'atender'))
    assert.ok(!puede(a, 'pagos'))
    assert.ok(!puede(a, 'cuentas'))
    assert.ok(!puede(a, 'raiz'))
  })

  test('negar por defecto: valores raros, claves desconocidas o formatos erróneos no dan permisos', () => {
    const n = normalizarPermisos({ pagos: 'true', cuentas: 1, atender: 'sí', chats: {}, invitar: true, admin: true, raiz: true })
    assert.deepEqual(Object.entries(n).filter(([, v]) => v).map(([k]) => k), ['invitar'])
    for (const raro of [null, undefined, 'x', 5, [], [true]]) assert.ok(Object.values(normalizarPermisos(raro)).every((v) => v === false))
  })

  test('un colaborador desactivado, ajeno o con la fila de otra persona no es nadie', () => {
    assert.equal(resolverActor('3', 'a@x.test', { correo: 'a@x.test', activo: false, permisos: { atender: true } }), null)
    assert.equal(resolverActor('3', 'a@x.test', null), null)
    assert.equal(resolverActor('3', 'a@x.test', { correo: 'otra@x.test', activo: true, permisos: { atender: true } }), null)
    assert.equal(resolverActor('3', '', null), null)
  })

  test('el catálogo base coincide con el prototipo aprobado', () => {
    assert.deepEqual(Object.entries(PERMISOS_BASE).filter(([, v]) => v).map(([k]) => k).sort(), ['ajustes_ver', 'atender', 'chats', 'monitorear', 'telefonos'])
  })
})

describe('el servidor niega: matriz de personas por ruta', () => {
  const llamadas: Record<string, () => Promise<Response>> = {
    pagos: () => pagosGet(req('/api/admin/pagos?usuario_id=x')),
    'registrar-pago': () => registrarPago(j('/api/admin/registrar-pago', 'POST')),
    'bloquear-cliente': () => bloquearCliente(j('/api/admin/bloquear-cliente', 'POST')),
    'eliminar-cliente': () => eliminarCliente(j('/api/admin/eliminar-cliente', 'DELETE')),
    'demo/reset': () => demoReset(j('/api/admin/demo/reset', 'POST')),
    'cliente-preview': () => previewGet(req('/api/admin/cliente-preview')),
    flags: () => flagsGet(req('/api/admin/flags')),
    'invitar-cliente': () => invitarCliente(j('/api/admin/invitar-cliente', 'POST')),
  }

  test('sin sesión y con una sesión que no es del equipo: 401 en todas', async () => {
    for (const quien of [null, 'cliente@mail.test']) {
      como(quien)
      for (const [r, f] of Object.entries(llamadas)) assert.equal((await f()).status, 401, `${r} con ${quien ?? 'nadie'}`)
    }
  })

  test('un colaborador con TODOS los permisos activados sigue sin poder hacer lo de "raíz" (403)', async () => {
    colab('todo@x.test', Object.fromEntries(PERMISOS.map((p) => [p, true])))
    como('todo@x.test')
    for (const r of ['eliminar-cliente', 'demo/reset']) assert.equal((await llamadas[r]()).status, 403, r)
  })

  test('cada permiso abre solo lo suyo: con el permiso pasa (ni 401 ni 403), sin él recibe 403', async () => {
    const porRuta: Record<string, string> = { pagos: 'pagos', 'registrar-pago': 'pagos', 'bloquear-cliente': 'cuentas', 'cliente-preview': 'monitorear', flags: 'atender', 'invitar-cliente': 'invitar' }
    for (const [ruta, permiso] of Object.entries(porRuta)) {
      limpiar()
      colab('c@x.test', { [permiso]: true })
      como('c@x.test')
      const con = (await llamadas[ruta]()).status
      assert.ok(con !== 401 && con !== 403, `${ruta} con ${permiso} no debería bloquearse (dio ${con})`)
      limpiar()
      colab('c@x.test', Object.fromEntries(PERMISOS.filter((p) => p !== permiso).map((p) => [p, true])))
      como('c@x.test')
      assert.equal((await llamadas[ruta]()).status, 403, `${ruta} sin ${permiso}`)
    }
  })

  test('el administrador raíz pasa en todas', async () => {
    como('admin@compaz.test')
    for (const [r, f] of Object.entries(llamadas)) {
      const s = (await f()).status
      assert.ok(s !== 401 && s !== 403, `${r} dio ${s}`)
    }
  })

  test('un colaborador desactivado pierde el acceso en la siguiente petición', async () => {
    colab('c@x.test', { pagos: true })
    como('c@x.test')
    assert.notEqual((await llamadas.pagos()).status, 403)
    db.rows('equipo')[0].activo = false
    assert.equal((await llamadas.pagos()).status, 401)
  })

  test('quitar un permiso se nota en la siguiente petición', async () => {
    colab('c@x.test', { pagos: true })
    como('c@x.test')
    assert.notEqual((await llamadas.pagos()).status, 403)
    db.rows('equipo')[0].permisos = {}
    assert.equal((await llamadas.pagos()).status, 403)
  })

  test('si no se puede leer el equipo, se NIEGA (nunca se deja pasar por error)', async () => {
    colab('c@x.test', { pagos: true })
    como('c@x.test')
    delete (db.tables as any).equipo
    const r = await llamadas.pagos()
    assert.equal(r.status, 503)
    como('admin@compaz.test') // el administrador raíz no depende de la tabla
    const sAdmin = (await llamadas.pagos()).status
    assert.ok(![401, 403, 503].includes(sAdmin), `el administrador dio ${sAdmin}`)
  })

  test('la respuesta de rechazo no filtra el permiso que faltaba ni quién es del equipo', async () => {
    colab('c@x.test', {})
    como('c@x.test')
    const r = await llamadas.pagos()
    const t = JSON.stringify(await r.json())
    assert.ok(!/pagos|permiso|equipo/i.test(t), t)
  })
})

describe('gestión del equipo: solo el administrador raíz', () => {
  test('un colaborador, aun con todos los permisos, no puede ver, invitar ni cambiar el equipo (403)', async () => {
    colab('todo@x.test', Object.fromEntries(PERMISOS.map((p) => [p, true])))
    como('todo@x.test')
    assert.equal((await equipoGet()).status, 403)
    assert.equal((await equipoPost(j('/api/admin/equipo', 'POST', { correo: 'otro@x.test', nombre: 'Otro', permisos: { pagos: true } }))).status, 403)
    assert.equal((await equipoPatch(j('/api/admin/equipo', 'PATCH', { correo: 'todo@x.test', permisos: { pagos: true } }))).status, 403)
    assert.equal(db.rows('equipo').length, 1, 'no se creó a nadie')
  })

  test('el administrador invita con permisos mínimos por defecto y queda en el historial', async () => {
    como('admin@compaz.test')
    const r = await equipoPost(j('/api/admin/equipo', 'POST', { correo: ' Nuevo@X.test ', nombre: 'Nuevo' }))
    assert.equal(r.status, 201)
    const fila = db.rows('equipo')[0]
    assert.equal(fila.correo, 'nuevo@x.test')
    assert.deepEqual(fila.permisos, {})
    assert.equal(fila.creado_por, 'admin@compaz.test')
    assert.equal(db.rows('equipo_historial').filter((h) => h.accion === 'alta').length, 1)
  })

  test('al invitar o cambiar solo se guardan permisos conocidos y activados', async () => {
    como('admin@compaz.test')
    await equipoPost(j('/api/admin/equipo', 'POST', { correo: 'a@x.test', nombre: 'A', permisos: { atender: true, pagos: false, raiz: true, hack: true, cuentas: 'true' } }))
    assert.deepEqual(db.rows('equipo')[0].permisos, { atender: true })
    const r = await equipoPatch(j('/api/admin/equipo', 'PATCH', { correo: 'a@x.test', permisos: { chats: true, admin: true } }))
    assert.equal(r.status, 200)
    assert.deepEqual(db.rows('equipo')[0].permisos, { chats: true })
    const h = db.rows('equipo_historial').find((x) => x.accion === 'permisos')!
    assert.deepEqual(h.detalle, { antes: { atender: true }, despues: { chats: true } })
    assert.equal(h.hecho_por, 'admin@compaz.test')
  })

  test('validaciones: correo inválido, duplicado, el propio administrador, sin nombre', async () => {
    como('admin@compaz.test')
    const malos = [
      { correo: 'sin-arroba', nombre: 'X' },
      { correo: 'admin@compaz.test', nombre: 'Yo' },
      { correo: 'ok@x.test', nombre: '   ' },
    ]
    for (const b of malos) assert.ok((await equipoPost(j('/api/admin/equipo', 'POST', b))).status >= 400, JSON.stringify(b))
    assert.equal((await equipoPost(j('/api/admin/equipo', 'POST', { correo: 'ok@x.test', nombre: 'Ok' }))).status, 201)
    assert.equal((await equipoPost(j('/api/admin/equipo', 'POST', { correo: 'OK@x.test', nombre: 'Ok otra vez' }))).status, 409)
    assert.equal(db.rows('equipo').length, 1)
  })

  test('desactivar y reactivar corta y devuelve el acceso, con historial; cambiar a alguien que no existe da 404', async () => {
    como('admin@compaz.test')
    await equipoPost(j('/api/admin/equipo', 'POST', { correo: 'a@x.test', nombre: 'A', permisos: { pagos: true } }))
    assert.equal((await equipoPatch(j('/api/admin/equipo', 'PATCH', { correo: 'a@x.test', activo: false }))).status, 200)
    como('a@x.test')
    assert.equal((await pagosGet(req('/api/admin/pagos?usuario_id=x'))).status, 401)
    como('admin@compaz.test')
    assert.equal((await equipoPatch(j('/api/admin/equipo', 'PATCH', { correo: 'a@x.test', activo: true }))).status, 200)
    como('a@x.test')
    assert.notEqual((await pagosGet(req('/api/admin/pagos?usuario_id=x'))).status, 401)
    como('admin@compaz.test')
    assert.equal((await equipoPatch(j('/api/admin/equipo', 'PATCH', { correo: 'nadie@x.test', activo: false }))).status, 404)
    assert.deepEqual(db.rows('equipo_historial').map((h) => h.accion).filter((a) => a !== 'alta'), ['desactivado', 'reactivado'])
  })

  test('PATCH sin nada que cambiar o con tipos erróneos se rechaza', async () => {
    como('admin@compaz.test')
    await equipoPost(j('/api/admin/equipo', 'POST', { correo: 'a@x.test', nombre: 'A' }))
    for (const b of [{ correo: 'a@x.test' }, { correo: 'a@x.test', activo: 'no' }, { correo: 'a@x.test', permisos: [1] }, {}]) {
      assert.equal((await equipoPatch(j('/api/admin/equipo', 'PATCH', b))).status, 400, JSON.stringify(b))
    }
  })

  test('el GET lista al equipo para el administrador', async () => {
    como('admin@compaz.test')
    await equipoPost(j('/api/admin/equipo', 'POST', { correo: 'a@x.test', nombre: 'A' }))
    const r = await equipoGet()
    assert.equal(r.status, 200)
    assert.equal((await r.json()).data.length, 1)
  })
})
