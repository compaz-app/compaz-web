/* eslint-disable */
import { db, net, limpiar, mkCliente, mkCompita, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { setAjustes, limpiarCacheAjustes } from '@/lib/ajustes'
import { registrarContactoBloqueado, personaPausada } from '@/lib/pausas'
import { createEntrevistaRoom } from '@/lib/daily'
import { moderarMensaje } from '@/lib/chat-moderacion'

beforeEach(() => { limpiar(); db.rows('ajustes').length = 0; limpiarCacheAjustes() })
const cambiar = (cambios: Record<string, number | string>) => setAjustes({ cambios, actor: 'admin@compaz.test' })

describe('detecciones de contacto: umbral y ventana de Ajustes', () => {
  const detectar = async (id: string, haceMin: number) => {
    const r = await registrarContactoBloqueado({ rol: 'cliente', personaId: id, nombre: 'Carlos', donde: 'el chat' })
    const ev = db.rows('eventos').filter((e) => e.tipo === 'contacto_bloqueado').at(-1)!; ev.creado_en = new Date(Date.now() - haceMin * 60_000).toISOString(); return r
  }
  test('con umbral 3 dos detecciones no pausan y la tercera sí', async () => {
    assert.equal((await cambiar({ detecciones_umbral: 3 })).ok, true)
    const c = mkCliente({ email: 'c@mail.test', nombre: 'Carlos' })
    await detectar(c.id, 120); await detectar(c.id, 60)
    assert.equal(await personaPausada('cliente', c.id), false)
    assert.equal(await detectar(c.id, 0), true)
    assert.equal(await personaPausada('cliente', c.id), true)
  })
  test('con ventana de 1 día una detección de hace 2 días ya no suma', async () => {
    assert.equal((await cambiar({ detecciones_ventana_dias: 1 })).ok, true)
    const c = mkCliente({ email: 'd@mail.test', nombre: 'Dani' })
    await detectar(c.id, 2 * 24 * 60)
    assert.equal(await detectar(c.id, 0), false)
  })
})

describe('corte de la llamada de presentación', () => {
  test('la sala de Daily expira al corte configurado, contado desde la hora de la llamada', async () => {
    assert.equal((await cambiar({ llamada_corte_min: 30 })).ok, true)
    const slot = new Date(Date.now() + 3600_000)
    await createEntrevistaRoom('abcdef123456', slot)
    const sala = net.rooms.at(-1)!
    assert.equal(sala.props.exp, Math.floor(slot.getTime() / 1000) + 30 * 60)
  })
  test('de fábrica sigue siendo a los 23 minutos', async () => {
    const slot = new Date(Date.now() + 3600_000)
    await createEntrevistaRoom('abcdef123456', slot)
    assert.equal(net.rooms.at(-1)!.props.exp, Math.floor(slot.getTime() / 1000) + 23 * 60)
  })
})

describe('mensaje del chat al detectar un contacto', () => {
  test('escribe el texto de Ajustes', async () => {
    assert.equal((await cambiar({ recordatorio_chat_contactos: 'Texto nuevo del equipo.' })).ok, true)
    const lucia = mkCompita({ telegram_chat_id: '5000', nombre: 'Lucía' }); const cli = mkCliente({ email: 'e@mail.test', nombre: 'Eva', compita_id: lucia.id })
    const vis = db.seed('visitas', { usuario_id: cli.id, compita_id: lucia.id, estado: 'en_curso' })
    await moderarMensaje({ visitaId: vis.id, compitaNombre: 'Lucía', clienteNombre: 'Eva', origen: 'cliente', textoOriginal: 'mi cel es 0414', clienteId: cli.id, compitaId: lucia.id })
    assert.ok(db.rows('mensajes').some((m) => m.origen === 'admin' && m.contenido === 'Texto nuevo del equipo.'))
  })
})

import { getOrCreateDailyRoom } from '@/lib/daily'
import { segundosDeAviso, infoDeSala } from '@/lib/llamada'
import { rutaLlamada, nombreDeSala, nombreDeSalaValido } from '@/lib/llamada-ruta'

describe('llamada durante una visita', () => {
  test('la sala nueva dura lo que dice Ajustes (5 de fábrica) y expulsa al cumplirse', async () => {
    const antes = Math.floor(Date.now() / 1000)
    await getOrCreateDailyRoom('abcdef123456')
    let p = net.rooms.at(-1)!.props
    assert.ok(p.exp - antes >= 5 * 60 - 2 && p.exp - antes <= 5 * 60 + 2); assert.equal(p.eject_at_room_exp, true)
    assert.equal((await cambiar({ llamada_visita_min: 8 })).ok, true)
    await getOrCreateDailyRoom('abcdef123456')
    p = net.rooms.at(-1)!.props
    assert.ok(Math.abs(p.exp - antes - 8 * 60) <= 3)
  })
  test('una sala ya cerrada no se reutiliza: se crea otra', async () => {
    const n = net.rooms.length
    await getOrCreateDailyRoom('abcdef123456', 'https://compaz.daily.co/cmp-viejo-123')
    assert.equal(net.rooms.length, n + 1)
  })
})

describe('aviso de fin dentro de la sala', () => {
  test('entrevista: avisa cuando falta (corte − aviso) minutos; visita: a la mitad de un minuto o un minuto', async () => {
    assert.equal(await segundosDeAviso('entrevista'), 3 * 60) // 23 − 20
    assert.equal(await segundosDeAviso('visita'), 60)
    assert.equal((await cambiar({ llamada_aviso_min: 15 })).ok, true)
    assert.equal(await segundosDeAviso('entrevista'), 8 * 60)
    assert.equal((await cambiar({ llamada_visita_min: 1 })).ok, true)
    assert.equal(await segundosDeAviso('visita'), 30)
  })
  test('el aviso debe ir antes del corte', async () => {
    assert.equal((await cambiar({ llamada_aviso_min: 25 })).ok, false)
  })
  test('la ruta de llamada sale del nombre de la sala y rechaza salas que no son de Compaz', async () => {
    assert.equal(rutaLlamada('https://compaz.daily.co/cmp-abc12345-99?lang=es'), '/llamada/cmp-abc12345-99')
    assert.equal(nombreDeSala('https://compaz.daily.co/ent-x1y2z3w4-1/'), 'ent-x1y2z3w4-1')
    assert.equal(nombreDeSalaValido('otra-sala'), false); assert.equal(nombreDeSalaValido('ent-../x'), false)
    assert.equal(await infoDeSala('otra-sala'), null)
  })
})

import { enlaceDeLlamada, autorizarLlamada, pedirPase } from '@/lib/llamada-acceso'
import { firmaLlamada } from '@/lib/links'
import { session } from './harness'

describe('salas privadas y pase por participante (S-03)', () => {
  test('las salas se crean privadas y con un nombre que no se puede adivinar', async () => {
    await getOrCreateDailyRoom('abcdef123456'); await createEntrevistaRoom('abcdef123456', new Date(Date.now() + 3600_000))
    const [v, e] = net.rooms.slice(-2)
    assert.equal(v.privacy, 'private'); assert.equal(e.privacy, 'private')
    assert.match(v.name, /^cmp-abcdef12-[0-9a-f]{16}$/); assert.match(e.name, /^ent-abcdef12-[0-9a-f]{16}$/)
    assert.notEqual(v.name, (await (async () => { await getOrCreateDailyRoom('abcdef123456'); return net.rooms.at(-1)!.name })()))
  })

  test('el enlace firmado deja entrar a su rol y a nadie más', async () => {
    const sala = 'cmp-abcdef12-0123456789abcdef'
    const h = enlaceDeLlamada(`https://compaz.daily.co/${sala}`, 'compita')
    assert.match(h, new RegExp(`^/llamada/${sala}\\?r=compita&s=[0-9a-f]{24}$`))
    const s = firmaLlamada(sala, 'compita')
    assert.deepEqual(await autorizarLlamada(sala, { rol: 'compita', s }), { ok: true, rol: 'compita' })
    assert.deepEqual(await autorizarLlamada(sala, { rol: 'cliente', s }), { ok: false })            // la firma del compita no vale para el cliente
    assert.deepEqual(await autorizarLlamada(sala, { rol: 'compita', s: 'x'.repeat(24) }), { ok: false })
    assert.deepEqual(await autorizarLlamada('cmp-otrasala-0123456789abcdef', { rol: 'compita', s }), { ok: false }) // ni para otra sala
    assert.deepEqual(await autorizarLlamada(sala, { rol: null, s: null }), { ok: false })
  })

  test('sin sesión ni firma no hay acceso; el administrador y el cliente de la visita sí entran', async () => {
    const sala = 'cmp-abcdef12-0123456789abcdef'
    session.user = null
    assert.deepEqual(await autorizarLlamada(sala, { rol: null, s: null }), { ok: false })
    const lucia = mkCompita({ nombre: 'Lucía' }); const cli = mkCliente({ email: 'z@mail.test', nombre: 'Zoe', compita_id: lucia.id }); const otro = mkCliente({ email: 'o@mail.test', nombre: 'Otro' })
    db.seed('visitas', { usuario_id: cli.id, compita_id: lucia.id, estado: 'en_curso', room_url: `https://compaz.daily.co/${sala}` })
    session.user = { id: cli.id, email: cli.email }
    assert.deepEqual(await autorizarLlamada(sala, { rol: null, s: null }), { ok: true, rol: 'cliente' })
    session.user = { id: otro.id, email: otro.email }
    assert.deepEqual(await autorizarLlamada(sala, { rol: null, s: null }), { ok: false }) // otro cliente no entra a una visita ajena
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    assert.deepEqual(await autorizarLlamada(sala, { rol: null, s: null }), { ok: true, rol: 'admin' })
  })

  test('el pase vence con la sala, expulsa al vencer y solo el administrador es dueño', async () => {
    const fin = Math.floor(Date.now() / 1000) + 600
    assert.match((await pedirPase('cmp-abcdef12-0123456789abcdef', 'compita', fin))!, /^pase-/)
    await pedirPase('cmp-abcdef12-0123456789abcdef', 'admin', fin)
    const [p1, p2] = net.pases.slice(-2)
    assert.equal(p1.exp, fin); assert.equal(p1.eject_at_token_exp, true); assert.equal(p1.is_owner, false); assert.equal(p2.is_owner, true)
  })

  test('el nombre de la sala solo se acepta con la forma de Compaz', async () => {
    assert.deepEqual(await autorizarLlamada('../etc', { rol: 'compita', s: firmaLlamada('../etc', 'compita') }), { ok: false })
  })
})
