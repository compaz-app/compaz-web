/* eslint-disable */
// Las acciones del portal nuevo: cada botón hace una llamada REAL que ya existía (o la nueva de avisar al equipo), y el portal cambia de estado solo.
import { db, net, limpiar, req, session, mkCliente, mkCompita, mkVisita, mkSolicitud, emailsA, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { peticionDeAccion, type AccionPortal } from '@/lib/portal-acciones-cliente'
import { estadoDelCliente } from '@/lib/estado-cliente'
import { cargarPortal } from '@/lib/portal'
import { rolValido } from '@/lib/links'
import { POST as avisarEquipo } from '@/app/api/portal/avisar-equipo/route'
import { POST as insistir } from '@/app/api/pago/insistir/route'
import { POST as pagoSolicitar } from '@/app/api/pago/solicitar/route'
import { POST as confirmarInicio } from '@/app/api/visita/confirmar-inicio/route'
import { POST as llegada } from '@/app/api/visita/llegada/route'

beforeEach(limpiar)
const como = (c: any) => { session.user = { id: c.id, email: c.email, user_metadata: { nombre: c.nombre } } as any }
const ACCIONES: AccionPortal[] = ['avisar_pago', 'confirmar_inicio', 'avisar_abrieron', 'avisar_equipo']

describe('qué llamada hace cada botón', () => {
  test('cada acción apunta a una ruta que EXISTE y exporta POST', () => {
    for (const a of ACCIONES) {
      const p = peticionDeAccion(a, { visitaId: 'v1', estado: 'pagar' })!; assert.ok(p, a); assert.equal(p.metodo, 'POST')
      const ruta = join(process.cwd(), 'app', p.url.replace(/^\//, ''), 'route.ts'); assert.ok(existsSync(ruta), `${a}: falta ${ruta}`); assert.match(readFileSync(ruta, 'utf8'), /export async function POST/, a)
    }
  })
  test('el detalle de cada llamada', () => {
    assert.deepEqual(peticionDeAccion('avisar_pago', {}), { url: '/api/pago/insistir', metodo: 'POST', cuerpo: {} })
    assert.deepEqual(peticionDeAccion('confirmar_inicio', { visitaId: 'v9' }), { url: '/api/visita/confirmar-inicio', metodo: 'POST', cuerpo: { visitaId: 'v9' } })
    assert.deepEqual(peticionDeAccion('avisar_abrieron', {}), { url: '/api/visita/llegada', metodo: 'POST', cuerpo: { accion: 'ya_abro' } })
    assert.deepEqual(peticionDeAccion('avisar_equipo', { estado: 'pago_revision' }), { url: '/api/portal/avisar-equipo', metodo: 'POST', cuerpo: { estado: 'pago_revision' } })
  })
  test('confirmar el inicio sin saber de qué visita se trata NO hace ninguna llamada (nunca a ciegas)', () => assert.equal(peticionDeAccion('confirmar_inicio', {}), null))
  test('el botón del navegador usa esta función y refresca el portal al terminar', () => {
    const src = readFileSync(join(process.cwd(), 'components/portal/AccionPortal.tsx'), 'utf8'); assert.match(src, /peticionDeAccion\(/); assert.match(src, /router\.refresh\(\)/); assert.match(src, /porQue/)
  })
})

describe('guardia del build: el navegador no arrastra código de servidor', () => {
  test('todo componente "use client" de components/portal y components/ui/base importa solo módulos puros', () => {
    const { readdirSync } = require('node:fs')
    const dirs = ['components/portal', 'components/ui/base']; const serv = /@\/lib\/(supabase-server|alertas-admin|portal-acciones'|estado-cliente|portal'|avisos|eventos|ajustes|permisos'|auth)/
    for (const d of dirs) for (const f of readdirSync(join(process.cwd(), d)).filter((x: string) => x.endsWith('.tsx'))) {
      const src = readFileSync(join(process.cwd(), d, f), 'utf8'); if (!/^'use client'/.test(src)) continue
      assert.doesNotMatch(src, serv, `${d}/${f} es un componente del navegador y no puede importar código de servidor`)
    }
  })
})

describe('"Avisar a Compaz": pedir ayuda al equipo', () => {
  test('sin sesión no entra, y un cliente bloqueado tampoco', async () => {
    session.user = null; assert.equal((await avisarEquipo()).status, 401)
    const c = mkCliente({ plan: 'bloqueado' }); como(c); assert.equal((await avisarEquipo()).status, 401)
  })
  test('crea UNA tarea para el equipo con el paso en que está el cliente, y deja el evento', async () => {
    const c = mkCliente({ nombre: 'Carolina Rojas' }); como(c); const r = await avisarEquipo(); assert.equal(r.status, 200)
    const t = db.rows('admin_flags').find((f) => f.tipo === 'cliente_pide_ayuda')!; assert.ok(t); assert.match(t.nota, /Carolina Rojas/); assert.match(t.nota, /bienvenida/); assert.equal(t.entidad_id, c.id)
    assert.equal(db.rows('eventos').filter((e) => e.tipo === 'ayuda_cliente').length, 1); assert.equal(db.rows('eventos').find((e) => e.tipo === 'ayuda_cliente')!.datos.estado, 'bienvenida')
  })
  test('la tarea no lleva teléfonos ni correos, y le pide al equipo no llamar para pedir datos', async () => {
    const c = mkCliente({ nombre: 'Carolina Rojas', email: 'caro@mail.test', telefono: '+58 412 000 0000' }); como(c); await avisarEquipo()
    const t = JSON.stringify(db.rows('admin_flags')); assert.doesNotMatch(t, /caro@mail|412 000/); assert.match(t, /no llames para pedirle datos/)
  })
  test('una segunda vez dentro de la hora se frena (429) con frase corta y la razón aparte; no abre otra tarea', async () => {
    const c = mkCliente(); como(c); await avisarEquipo(); const r = await avisarEquipo(); assert.equal(r.status, 429)
    const j = await r.json(); assert.match(j.error, /Ya avisamos al equipo hace un momento/); assert.ok(j.error.length < 125); assert.match(j.porQue, /ya recibió tu aviso/)
    assert.equal(db.rows('admin_flags').filter((f) => f.tipo === 'cliente_pide_ayuda').length, 1)
  })
  test('pasada la hora vuelve a poder avisar; y cada cliente tiene su propia cuenta', async () => {
    const a = mkCliente({ email: 'a@mail.test' }); const b = mkCliente({ email: 'b@mail.test' })
    como(a); await avisarEquipo(); db.rows('eventos').find((e) => e.tipo === 'ayuda_cliente')!.creado_en = new Date(Date.now() - 61 * 60_000).toISOString(); assert.equal((await avisarEquipo()).status, 200)
    como(b); assert.equal((await avisarEquipo()).status, 200)
  })
})

describe('el portal cambia de estado solo cuando el cliente actúa', () => {
  test('"Ya hice el pago": de "pagar" a "pago en revisión" (con la ficha pendiente) y luego lo explica si repite', async () => {
    const c = mkCliente({ familiar_nombre: null, nombre: 'Carolina Rojas' }); como(c); await pagoSolicitar(req('/api/pago/solicitar', { json: { tipo: 'plan', plan: 'quincenal', metodo: 'zelle' } }))
    assert.equal((await estadoDelCliente(c.id)).codigo, 'pagar')
    const r1 = await insistir(); assert.equal(r1.status, 200); assert.equal((await estadoDelCliente(c.id)).codigo, 'pago_revision')
    const j = await (await insistir()).json(); assert.match(j.data.resumen, /Ya avisamos al equipo/); assert.ok(j.data.porQue)
  })
  test('con la ficha completa, el pago avisado queda "solo falta confirmar"', async () => {
    const c = mkCliente(); como(c); await pagoSolicitar(req('/api/pago/solicitar', { json: { tipo: 'plan', plan: 'quincenal', metodo: 'zelle' } })); await insistir()
    assert.equal((await estadoDelCliente(c.id)).codigo, 'ficha_lista_espera')
  })
  test('"Confirmar y empezar": la visita pasa a en curso y el portal lo muestra', async () => {
    const c = mkCliente(); const k = mkCompita({ telegram_chat_id: '9970' }); const v = mkVisita(c, k, { estado: 'confirmando_inicio', llegada_en: new Date().toISOString() }); como(c)
    assert.equal((await estadoDelCliente(c.id)).codigo, 'compita_llego')
    const r = await confirmarInicio(req('/api/visita/confirmar-inicio', { json: { visitaId: v.id } })); assert.equal(r.status, 200)
    assert.equal((await estadoDelCliente(c.id)).codigo, 'visita_en_curso')
  })
  test('un cliente NO puede confirmar el inicio de la visita de otro', async () => {
    const dueno = mkCliente(); const otro = mkCliente({ email: 'otro@mail.test' }); const k = mkCompita({ telegram_chat_id: '9971' }); const v = mkVisita(dueno, k, { estado: 'confirmando_inicio' }); como(otro)
    await confirmarInicio(req('/api/visita/confirmar-inicio', { json: { visitaId: v.id } })); assert.equal(db.rows('visitas').find((x) => x.id === v.id)!.estado, 'confirmando_inicio')
  })
  test('"Ya abrieron": se detiene la espera y el estado "nadie abre" desaparece', async () => {
    const c = mkCliente(); const k = mkCompita({ telegram_chat_id: '9972' }); mkVisita(c, k, { estado: 'programada', fecha_programada: new Date().toISOString().slice(0, 10), hora_inicio_programada: '09:00', llegada_en: new Date(Date.now() - 10 * 60_000).toISOString(), sin_acceso_en: new Date(Date.now() - 9 * 60_000).toISOString() }); como(c)
    assert.equal((await estadoDelCliente(c.id)).codigo, 'nadie_abre')
    const r = await llegada(req('/api/visita/llegada', { json: { accion: 'ya_abro' } })); assert.equal(r.status, 200)
    assert.notEqual((await estadoDelCliente(c.id)).codigo, 'nadie_abre')
  })
  test('"Entrar a la entrevista": el enlace lleva a la sala con la firma de CLIENTE válida', async () => {
    const c = mkCliente(); const k = mkCompita(); const s = mkSolicitud(c, k, { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [], slot_confirmado: new Date(Date.now() + 20 * 60_000).toISOString(), token_respuesta: 'tok-123' })
    const p = await cargarPortal(c.id); assert.equal(p.estado.codigo, 'entrevista_ahora')
    const ruta = (p.tarjeta.principal!.destino as any).ruta as string; assert.match(ruta, /^\/sala\/tok-123\?quien=cliente&s=/)
    const sig = new URL(ruta, 'http://x').searchParams.get('s'); assert.equal(rolValido('tok-123', 'cliente', sig), true); assert.equal(rolValido('tok-123', 'compita', sig), false)
  })
})
