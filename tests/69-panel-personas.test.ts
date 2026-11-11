/* eslint-disable */
// Panel nuevo, Personas: lista de compitas, clientes, ficha sin contactos y contacto con motivo anotado.
import { db, limpiar, session, req, mkCliente, mkCompita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { estadosDeZona, estadosConGente, consultarCompitas, consultarClientes, leerPersonaUrl, hrefPersona, motivoValido, urgCompita, type FilaCompita } from '@/lib/panel-personas-tipos'
import { listarCompitas, listarClientes, fichaDePersona, revelarContacto } from '@/lib/panel-personas'
import { POST } from '@/app/api/admin/contacto/route'
import { POST as notas } from '@/app/api/admin/notas/route'
import { agregarNota } from '@/lib/panel-notas'
import { POST as registrar } from '@/app/api/onboarding/registrar/route'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'
import type { Actor } from '@/lib/permisos'

beforeEach(limpiar)
const actor = (rol: 'admin' | 'colaborador', p: any = {}): Actor => ({ id: 'u1', correo: rol === 'admin' ? 'admin@compaz.test' : 'luis@compaz.test', rol, permisos: rol === 'admin' ? { ...TODOS } : { ...NINGUNO, ...p } })
const fila = (o: Partial<FilaCompita> = {}): FilaCompita => ({ id: Math.random().toString(36).slice(2), nombre: 'Ana', zona: 'Chacao', estado: 'Disponible', activos: 0, visitas: 0, rating: 4.8, respuesta: 90, inactivoH: 2, canc: 0, tardias: 0, ...o })
const q = (o: any = {}) => ({ q: '', vista: 'todas', orden: '', dir: 'asc', pag: 1, ...o })

describe('lista de compitas (lógica pura)', () => {
  test('por defecto, rojos primero, luego amarillos y verdes', () => {
    const v = fila({ nombre: 'V' }), a = fila({ nombre: 'A', respuesta: 60 }), r = fila({ nombre: 'R', tardias: 3 })
    assert.deepEqual(consultarCompitas([v, a, r], q()).fila.map((x) => x.nombre), ['R', 'A', 'V'])
    assert.equal(urgCompita(fila({ estado: 'En pausa', respuesta: 0 })), 'verde')
  })
  test('las vistas filtran y cuentan; una vista inventada cae en Todos', () => {
    const l = [fila({ estado: 'Nuevo' }), fila({ estado: 'En pausa' }), fila({ tardias: 1 }), fila({ inactivoH: 30 })]
    const c = consultarCompitas(l, q({ vista: 'nuevas' }))
    assert.equal(c.total, 1); assert.equal(c.conteos.pausa, 1); assert.equal(c.conteos.sinrespuesta, 1); assert.equal(c.conteos.cancel, 1)
    assert.equal(consultarCompitas(l, q({ vista: '<script>' })).total, 4)
  })
  test('la búsqueda, el orden y la página se sanean', () => {
    const l = Array.from({ length: 60 }, (_, i) => fila({ nombre: `C${String(i).padStart(2, '0')}`, rating: i }))
    assert.equal(consultarCompitas(l, q({ pag: '99' })).pag, 3); assert.equal(consultarCompitas(l, q({ pag: '-4' })).pag, 1)
    assert.equal(consultarCompitas(l, q({ orden: 'rating', dir: 'desc' })).fila[0].nombre, 'C59')
    assert.equal(consultarCompitas(l, q({ q: 'c07' })).total, 1)
    assert.equal(consultarCompitas(l, q({ orden: 'x; drop' })).fila.length, 25)
  })
  test('clientes: búsqueda y páginas', () => {
    const l = Array.from({ length: 30 }, (_, i) => ({ id: String(i), nombre: i === 3 ? 'Luisa' : `Cli${i}`, zona: 'Miami', compita: null, plan: null, alta: '2026-11-01T00:00:00Z', bloqueado: false }))
    assert.equal(consultarClientes(l, 'luisa', 1).total, 1); assert.equal(consultarClientes(l, '', 2).fila.length, 5)
  })
  test('la persona de la dirección solo acepta tipo e id válidos; el motivo, uno de la lista o "Otro" explicado', () => {
    assert.deepEqual(leerPersonaUrl('compita:123e4567-e89b-12d3-a456-426614174000'), { tipo: 'compita', id: '123e4567-e89b-12d3-a456-426614174000' })
    assert.equal(leerPersonaUrl('admin:123e4567-e89b'), null); assert.equal(leerPersonaUrl("cliente:1' or '1'='1"), null); assert.equal(leerPersonaUrl(undefined), null)
    assert.equal(motivoValido('Reclamo del cliente'), 'Reclamo del cliente'); assert.equal(motivoValido('Otro (explicar)'), null)
    assert.equal(motivoValido('Otro: x'), null); assert.equal(motivoValido('Otro: para confirmar la dirección'), 'Otro: para confirmar la dirección'); assert.equal(motivoValido('porque sí'), null)
  })
})

describe('filtro por estado', () => {
  const z = (zona: string, o: Partial<FilaCompita> = {}) => fila({ zona, ...o })
  test('el estado sale de "Estado — Municipio"; un compita con varias zonas cuenta en cada estado; sin zona no cuenta', () => {
    assert.deepEqual(estadosDeZona('Zulia — Maracaibo'), ['Zulia'])
    assert.deepEqual(estadosDeZona('Zulia — Maracaibo, Zulia — San Francisco, Lara — Iribarren'), ['Zulia', 'Lara'])
    assert.deepEqual(estadosDeZona('Sin zona'), []); assert.deepEqual(estadosDeZona(''), []); assert.deepEqual(estadosDeZona(null), [])
  })
  test('solo se ofrecen estados donde hay gente, con su conteo y en orden alfabético', () => {
    const e = estadosConGente(['Zulia — Maracaibo', 'Zulia — Cabimas', 'Bolívar — Caroní', 'Sin zona'])
    assert.deepEqual(e, [{ estado: 'Bolívar', n: 1 }, { estado: 'Zulia', n: 2 }])
  })
  test('filtrar por estado deja solo a los de ese estado y la lista de estados sigue la vista elegida', () => {
    const l = [z('Zulia — Maracaibo', { estado: 'Disponible' }), z('Bolívar — Caroní', { estado: 'Con cupo' }), z('Zulia — Cabimas', { estado: 'Con cupo' }), z('Lara — Iribarren', { estado: 'Disponible' })]
    const todos = consultarCompitas(l, q())
    assert.deepEqual(todos.estados.map((e) => e.estado), ['Bolívar', 'Lara', 'Zulia'])
    const zulia = consultarCompitas(l, q({ estado: 'zulia' })); assert.equal(zulia.total, 2); assert.equal(zulia.estado, 'Zulia'); assert.equal(zulia.conteos.disponibles, 1)
    // En "Disponibles" Bolívar no aparece: allí no hay ningún compita disponible.
    const disp = consultarCompitas(l, q({ vista: 'disponibles' })); assert.deepEqual(disp.estados.map((e) => e.estado), ['Lara', 'Zulia'])
  })
  test('un estado que ya no tiene gente se ignora en vez de dejar la lista vacía', () => {
    const l = [z('Zulia — Maracaibo', { estado: 'Disponible' }), z('Bolívar — Caroní', { estado: 'Con cupo' })]
    const r = consultarCompitas(l, q({ vista: 'cupo', estado: 'Zulia' })); assert.equal(r.estado, ''); assert.equal(r.total, 1)
    assert.equal(consultarCompitas(l, q({ estado: "x' or 1=1" })).total, 2)
  })
  test('clientes: mismo filtro, solo estados con gente', () => {
    const c = (zona: string) => ({ id: zona, nombre: 'C', zona, compita: null, plan: null, alta: '2026-11-01T00:00:00Z', bloqueado: false })
    const r = consultarClientes([c('Bolívar — Caroní'), c('Bolívar — Heres'), c('Zulia — Maracaibo'), c('')], '', 1, 'bolivar')
    assert.equal(r.total, 2); assert.deepEqual(r.estados, [{ estado: 'Bolívar', n: 2 }, { estado: 'Zulia', n: 1 }])
    assert.equal(consultarClientes([c('Zulia — Maracaibo')], '', 1, 'Inventado').total, 1)
  })
})

describe('datos reales', () => {
  test('listarCompitas calcula los números de los últimos 30 días y no trae contactos', async () => {
    const c = mkCompita({ nombre: 'Rosa', verificado: true, email: 'rosa@correo.com' } as any); const cli = mkCliente({ compita_id: c.id } as any)
    const hoy = new Date().toISOString()
    db.seed('solicitudes', { id: 's1', cliente_id: cli.id, compita_id: c.id, estado: 'aceptada', created_at: hoy, respondido_at: hoy })
    db.seed('solicitudes', { id: 's2', cliente_id: cli.id, compita_id: c.id, estado: 'pendiente', created_at: hoy, respondido_at: null })
    const [f] = await listarCompitas()
    assert.equal(f.nombre.startsWith('Rosa'), true); assert.equal(f.activos, 1); assert.equal(f.respuesta, 50); assert.equal(f.estado, 'Con cupo')
    assert.doesNotMatch(JSON.stringify(f), /rosa@correo/)
  })
  test('un compita sin verificar es "Nuevo"', async () => { mkCompita({ verificado: false } as any); assert.equal((await listarCompitas())[0].estado, 'Nuevo') })
  test('la ficha dice si hay contacto pero nunca lo trae', async () => {
    const cli = mkCliente({ email: 'cli@correo.com', telefono: '+13055551234' } as any)
    const f = (await fichaDePersona(actor('admin'), 'cliente', cli.id))!
    assert.deepEqual(f.contacto, { correo: true, telefono: true }); assert.doesNotMatch(JSON.stringify(f), /cli@correo|3055551234/)
    assert.equal((await listarClientes()).length >= 1, true)
    assert.equal(await fichaDePersona(actor('admin'), 'cliente', '00000000-0000-0000-0000-000000000000'), null)
  })
})

describe('contacto con motivo', () => {
  test('un colaborador sin motivo no recibe nada y no queda anotado nada', async () => {
    const cli = mkCliente({ telefono: '+13055551234' } as any)
    const r = await revelarContacto(actor('colaborador', { telefonos: true }), { tipo: 'cliente', id: cli.id, canal: 'telefono', motivo: undefined })
    assert.equal(r.ok, false); assert.equal(db.rows('actividad_admin').length, 0)
  })
  test('con motivo recibe el dato y queda anotado quién, qué y por qué', async () => {
    const cli = mkCliente({ nombre: 'Ana Gómez', telefono: '+13055551234' } as any)
    const r = await revelarContacto(actor('colaborador', { telefonos: true }), { tipo: 'cliente', id: cli.id, canal: 'whatsapp', motivo: 'Reclamo del cliente' })
    assert.deepEqual(r, { ok: true, valor: '+13055551234' })
    const a = db.rows('actividad_admin').find((x: any) => x.categoria === 'acceso_contacto')!
    assert.match(a.resumen, /luis@compaz\.test/); assert.match(a.resumen, /Reclamo del cliente/); assert.match(a.resumen, /Ana Gómez/)
  })
  test('el administrador no necesita motivo, pero también queda anotado', async () => {
    const cli = mkCliente({ email: 'cli@correo.com' } as any)
    assert.equal((await revelarContacto(actor('admin'), { tipo: 'cliente', id: cli.id, canal: 'correo', motivo: undefined })).ok, true)
    assert.match(db.rows('actividad_admin')[0].resumen, /Sin motivo requerido/)
  })
  test('sin el permiso de teléfonos se niega, aunque dé motivo', async () => {
    const cli = mkCliente({ telefono: '+13055551234' } as any)
    const r = await revelarContacto(actor('colaborador', { monitorear: true }), { tipo: 'cliente', id: cli.id, canal: 'telefono', motivo: 'Reclamo del cliente' })
    assert.equal(r.ok, false); assert.equal((r as any).status, 403)
  })
  test('del compita se entrega el teléfono si lo guardó en el formulario, y WhatsApp usa el mismo dato', async () => {
    const c = mkCompita({ email: 'c@correo.com', telefono: '+584121234567' } as any)
    assert.deepEqual(await revelarContacto(actor('admin'), { tipo: 'compita', id: c.id, canal: 'whatsapp', motivo: null }), { ok: true, valor: '+584121234567' })
    assert.deepEqual((await fichaDePersona(actor('admin'), 'compita', c.id))!.contacto, { correo: true, telefono: true })
    const sin = mkCompita({ email: 'd@correo.com' } as any)
    assert.equal((await revelarContacto(actor('admin'), { tipo: 'compita', id: sin.id, canal: 'telefono', motivo: null })).ok, false)
  })
  test('la ruta valida el cuerpo y exige sesión del equipo', async () => {
    const cli = mkCliente({ email: 'cli@correo.com' } as any)
    session.user = null as any
    assert.equal((await POST(req('/api/admin/contacto', { method: 'POST', json: { tipo: 'cliente', id: cli.id, canal: 'correo' } }))).status, 401)
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    assert.equal((await POST(req('/api/admin/contacto', { method: 'POST', json: { tipo: 'otro', id: cli.id, canal: 'correo' } }))).status, 400)
    assert.equal((await POST(req('/api/admin/contacto', { method: 'POST', json: { tipo: 'cliente', id: cli.id, canal: 'correo' } }))).status, 200)
  })
})

describe('el formulario de registro pide el teléfono', () => {
  const invitar = (t: string) => db.seed('onboarding_tokens', { id: 'o-' + t, token: t, usado: false, expires_at: new Date(Date.now() + 3600_000).toISOString() })
  const cuerpo = (t: string, o: any = {}) => ({ token: t, nombre: 'Rosa Díaz', email: 'rosa@mail.test', zona: 'Zulia', descripcion: 'Cuidadora', servicios: ['Compañía'], ...o })
  test('sin teléfono no se registra y la invitación no se gasta', async () => {
    invitar('t1'); session.user = null as any
    assert.equal((await registrar(req('/api/onboarding/registrar', { json: cuerpo('t1') }))).status, 400)
    assert.equal(db.rows('compitas').length, 0); assert.equal(db.rows('onboarding_tokens')[0].usado, false)
  })
  test('un teléfono inválido se rechaza', async () => {
    invitar('t2'); session.user = null as any
    assert.equal((await registrar(req('/api/onboarding/registrar', { json: cuerpo('t2', { telefono: 'abc' }) }))).status, 400)
  })
  test('con teléfono se guarda normalizado', async () => {
    invitar('t3'); session.user = null as any
    assert.equal((await registrar(req('/api/onboarding/registrar', { json: cuerpo('t3', { telefono: '0412 123 4567' }) }))).status, 200)
    assert.equal(db.rows('compitas')[0].telefono, '+584121234567')
  })
})

describe('guardias de código', () => {
  test('la ficha del navegador no importa código de servidor ni toca la base', () => {
    const f = readFileSync('components/panel/FichaPersona.tsx', 'utf8')
    assert.doesNotMatch(f, /supabase-server|lib\/panel-personas'|lib\/permisos'|\.from\(/)
  })
})

describe('notas internas y enlaces de la Bandeja', () => {
  const colab = () => actor('colaborador', { atender: true, monitorear: true })
  test('una nota queda con quién y cuándo, y aparece en la ficha', async () => {
    const cli = mkCliente({ nombre: 'Ana' } as any)
    const r = await agregarNota(colab(), { tipo: 'cliente', id: cli.id, texto: '  Prefiere el correo.  ' })
    assert.equal(r.ok, true); assert.equal((r as any).nota.autor, 'luis@compaz.test'); assert.equal((r as any).nota.texto, 'Prefiere el correo.')
    const f = (await fichaDePersona(colab(), 'cliente', cli.id))!
    assert.equal(f.notas.length, 1); assert.equal(f.notas[0].texto, 'Prefiere el correo.')
  })
  test('vacía, demasiado larga o de una persona que no existe: se rechaza', async () => {
    const cli = mkCliente() as any
    assert.equal((await agregarNota(colab(), { tipo: 'cliente', id: cli.id, texto: '   ' })).ok, false)
    assert.equal((await agregarNota(colab(), { tipo: 'cliente', id: cli.id, texto: 'x'.repeat(1001) })).ok, false)
    const r = await agregarNota(colab(), { tipo: 'cliente', id: '00000000-0000-0000-0000-000000000000', texto: 'hola' }); assert.equal((r as any).status, 404)
    assert.equal(db.rows('notas_persona').length, 0)
  })
  test('sin el permiso de teléfonos, la nota llega sin teléfonos ni correos', async () => {
    const cli = mkCliente() as any
    db.seed('notas_persona', { id: 'n1', persona_tipo: 'cliente', persona_id: cli.id, texto: 'Su número es +58 414 1234567', autor: 'admin@compaz.test', creado_en: new Date().toISOString() })
    const f = (await fichaDePersona(colab(), 'cliente', cli.id))!
    assert.doesNotMatch(f.notas[0].texto, /414 1234567/)
    assert.match((await fichaDePersona(actor('admin'), 'cliente', cli.id))!.notas[0].texto, /414 1234567/)
  })
  test('la ruta de notas exige el permiso de atender', async () => {
    const cli = mkCliente() as any
    session.user = null as any
    assert.equal((await notas(req('/api/admin/notas', { method: 'POST', json: { tipo: 'cliente', id: cli.id, texto: 'hola' } }))).status, 401)
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    assert.equal((await notas(req('/api/admin/notas', { method: 'POST', json: { tipo: 'cliente', id: cli.id, texto: 'hola' } }))).status, 200)
    assert.equal((await notas(req('/api/admin/notas', { method: 'POST', json: { tipo: 'otro', id: cli.id, texto: 'hola' } }))).status, 400)
  })
  test('los nombres de la Bandeja enlazan a la ficha solo si es cliente o compita con id válido', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000'
    assert.equal(hrefPersona('cliente', id), `/panel?sec=personas&lista=clientes&persona=cliente%3A${id}`)
    assert.match(hrefPersona('compita', id, true)!, /lista=compitas.*como=colaborador/)
    assert.equal(hrefPersona('visita', id), null); assert.equal(hrefPersona('cliente', 'sistema'), null); assert.equal(hrefPersona('cliente', "x' or 1=1"), null)
  })
  test('la Bandeja usa ese enlace', () => { assert.match(readFileSync('components/panel/Bandeja.tsx', 'utf8'), /hrefPersona\(t\.entidad_tipo, t\.entidad_id/) })
})
