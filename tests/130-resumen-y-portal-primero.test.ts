/* eslint-disable */
// Correos que esperan o se juntan (quinta parte de la reducción de textos): «va en camino» y «llegó» no mandan correo; el aviso de fin de entrevista espera 24 h y se cancela
// si el cliente lo ve en el portal; y el resumen diario (7 pm) recoge lo que no tuvo correo, solo si hay algo sin ver y el cliente no entró hoy.
import { db, limpiar, cron, emailsA, mkCompita, mkCliente, mkSolicitud, mkVisita, despacharDiferidos } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { notificar } from '@/lib/avisos'
import { marcarNovedadesVistas } from '@/lib/novedades'
import { enviarResumenesDiarios, armarResumenDiario } from '@/lib/resumen-diario'
import { POST as resumenCron } from '@/app/api/cron/resumen-diario/route'
import { debeCorreoDeMensaje } from '@/lib/portal-mensajes'

beforeEach(limpiar)
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const novedad = (cli: any, tipo: string, o: Record<string, any> = {}) => db.seed('novedades_cliente', { usuario_id: cli.id, tipo, nivel: 'informativo', titulo: `Titulo ${tipo}`, clave_unica: `${tipo}:${Math.random()}`, vista_en: null, created_at: hace(60), ...o })

describe('solo portal y espera de 24 h', () => {
  test('«va en camino» y «llegó» no mandan correo, pero dejan su novedad', async () => {
    const compita = mkCompita(); const cli = mkCliente({ email: 'cli@mail.test' }); const v = mkVisita(cli, compita, { estado: 'programada' })
    for (const plantilla of ['compita_en_camino', 'compita_llego'] as const) {
      const r = await notificar({ plantilla, canal: 'correo', destinatario: { tipo: 'cliente', id: cli.id }, variables: { visitaId: v.id }, entidad: 'visita', entidadId: v.id })
      assert.equal(r.ok, true)
    }
    assert.equal(emailsA('cli@mail.test').length, 0)
    assert.deepEqual(db.rows('novedades_cliente').map((n) => n.tipo).sort(), ['compita_en_camino', 'compita_llego'])
  })

  test('fin de entrevista: el correo espera; si el cliente lo ve en el portal, nunca sale', async () => {
    const compita = mkCompita(); const cli = mkCliente({ email: 'cli@mail.test' }); const sol = mkSolicitud(cli, compita, { estado: 'aceptada' })
    const r = await notificar({ plantilla: 'llamada_terminada_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: cli.id }, variables: { solicitudId: sol.id, corta: false }, entidad: 'solicitud', entidadId: sol.id })
    assert.equal(r.estado, 'pendiente')
    assert.equal(emailsA('cli@mail.test').length, 0)
    await marcarNovedadesVistas(cli.id)
    await despacharDiferidos()
    assert.equal(emailsA('cli@mail.test').length, 0)
  })

  test('llamada muy corta: el correo sale al instante (hubo un problema)', async () => {
    const compita = mkCompita(); const cli = mkCliente({ email: 'cli@mail.test' }); const sol = mkSolicitud(cli, compita, { estado: 'aceptada' })
    await notificar({ plantilla: 'llamada_terminada_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: cli.id }, variables: { solicitudId: sol.id, corta: true }, entidad: 'solicitud', entidadId: sol.id })
    assert.equal(emailsA('cli@mail.test').length, 1)
  })
})

describe('resumen diario', () => {
  test('un solo correo con lo que pasó, una vez por día', async () => {
    const cli = mkCliente({ email: 'cli@mail.test', nombre: 'Carlos Ruiz' })
    novedad(cli, 'compita_en_camino'); novedad(cli, 'compita_llego')
    assert.equal((await enviarResumenesDiarios()).enviados, 1)
    assert.equal((await enviarResumenesDiarios()).enviados, 0)
    const m = emailsA('cli@mail.test')
    assert.equal(m.length, 1)
    assert.match(m[0].html, /Titulo compita_en_camino/); assert.match(m[0].html, /Titulo compita_llego/); assert.match(m[0].html, /\/portal/)
  })
  test('sin novedades, o ya vistas, o con el portal abierto hoy: no sale nada', async () => {
    const a = mkCliente({ email: 'a@mail.test' }); const b = mkCliente({ email: 'b@mail.test' }); mkCliente({ email: 'c@mail.test' })
    novedad(b, 'compita_en_camino', { vista_en: hace(5) })
    const d = mkCliente({ email: 'd@mail.test' }); novedad(d, 'compita_en_camino'); db.rows('usuarios').find((u) => u.id === d.id)!.portal_visto_en = new Date().toISOString()
    novedad(a, 'pago_confirmado') // tuvo su correo propio: no se repite
    assert.equal((await enviarResumenesDiarios()).enviados, 0)
    assert.equal(emailsA('a@mail.test').length + emailsA('b@mail.test').length + emailsA('c@mail.test').length + emailsA('d@mail.test').length, 0)
  })
  test('el correo es breve y sin repeticiones', () => {
    const m = armarResumenDiario('Carlos Ruiz', ['Tu compita va en camino.', 'Tu compita va en camino.'])
    assert.equal((m.html.match(/<li>/g) ?? []).length, 1)
    assert.ok((m.html.replace(/<[^>]+>/g, ' ').match(/\S+/g) ?? []).length <= 40)
  })
  test('el cron exige el secreto y responde con lo enviado', async () => {
    assert.equal((await resumenCron(cron('resumen-diario', null))).status, 401)
    assert.equal((await resumenCron(cron('resumen-diario'))).status, 200)
    assert.ok(db.rows('telegram_estados').some((e) => e.chat_id === 'cron:resumen-diario'))
  })
})

describe('chat: otro correo solo si pasan 30 minutos sin leer', () => {
  test('la regla', async () => {
    const cli = mkCliente({ email: 'cli@mail.test' })
    assert.equal(await debeCorreoDeMensaje(cli.id, null), true)
    assert.equal(await debeCorreoDeMensaje(cli.id, hace(10)), false)
    assert.equal(await debeCorreoDeMensaje(cli.id, hace(40)), true)
    db.rows('usuarios').find((u) => u.id === cli.id)!.chat_leido_en = hace(5)
    assert.equal(await debeCorreoDeMensaje(cli.id, hace(40)), false)
  })
})

// ── «¿Pudiste hablar?»: correo Y portal, y contestar en cualquier lado lo cierra en todos ─────────────────────────────────────────────────────────────────────
import { POST as seguimiento } from '@/app/api/cron/seguimiento/route'
import { POST as portalLlamada } from '@/app/api/portal/llamada/route'
import { POST as resultadoPost } from '@/app/api/solicitud/resultado-llamada/route'
import { registrarRespuestaLlamada } from '@/lib/confirmacion-llamada'
import { estadoDelCliente } from '@/lib/estado-cliente'
import { session, req } from './harness'
import { qRol } from '@/lib/links'

describe('«¿Pudiste hablar?» en todos los canales', () => {
  const armar = async () => {
    const compita = mkCompita({ telegram_chat_id: '710', nombre: 'Lucía Pérez' }); const cli = mkCliente({ email: 'cli@mail.test' })
    const sol = mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: hace(30), token_respuesta: 'tok-9' })
    await seguimiento(cron('s'))
    return { cli, sol }
  }
  const novedadesAbiertas = () => db.rows('novedades_cliente').filter((n) => n.tipo === 'seguimiento_llamada' && !n.vista_en)

  test('llega por correo y el portal la muestra con sus dos botones', async () => {
    const { cli } = await armar()
    assert.equal(emailsA('cli@mail.test').length, 1)
    const e = await estadoDelCliente(cli.id)
    assert.equal(e.codigo, 'confirmar_llamada')
  })

  test('contestar «sí» en el portal: queda registrado, la novedad se cierra y el portal pasa a «¿contratas?»', async () => {
    const { cli, sol } = await armar()
    session.user = { id: cli.id, email: cli.email }
    const r = await portalLlamada(req('/api/portal/llamada', { json: { solicitudId: sol.id } }))
    assert.equal(r.status, 200)
    assert.equal(db.rows('solicitudes').find((s) => s.id === sol.id)!.confirmacion_cliente, true)
    assert.equal(novedadesAbiertas().length, 0)
    assert.notEqual((await estadoDelCliente(cli.id)).codigo, 'confirmar_llamada')
  })

  test('contestar desde el correo cierra la pregunta del portal; y el portal rechaza una solicitud ajena', async () => {
    const { cli, sol } = await armar()
    await registrarRespuestaLlamada('tok-9', 'cliente', 'si')
    assert.equal(novedadesAbiertas().length, 0)
    const otro = mkCliente({ email: 'otro@mail.test' }); session.user = { id: otro.id, email: otro.email }
    assert.equal((await portalLlamada(req('/api/portal/llamada', { json: { solicitudId: sol.id } }))).status, 404)
    void cli
  })

  test('el compita dice «no se pudo» en Telegram: la pregunta al cliente se cierra (ya tiene su aviso de reagendar)', async () => {
    await armar()
    await registrarRespuestaLlamada('tok-9', 'compita', 'no')
    assert.equal(novedadesAbiertas().length, 0)
  })

  test('decidir (contratar) desde el correo cierra también la pregunta de decisión', async () => {
    const { cli, sol } = await armar()
    db.seed('novedades_cliente', { usuario_id: cli.id, tipo: 'seguimiento_decision', nivel: 'accionable', titulo: 'x', entidad: 'solicitud', entidad_id: sol.id, clave_unica: `seguimiento_decision:${sol.id}`, vista_en: null })
    await resultadoPost(req(`/api/solicitud/resultado-llamada?token=tok-9&resultado=contratar&${qRol('tok-9', 'cliente')}`, { method: 'POST' }))
    assert.equal(db.rows('novedades_cliente').filter((n) => !n.vista_en).length, 0)
  })
})
