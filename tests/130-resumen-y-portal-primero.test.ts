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
