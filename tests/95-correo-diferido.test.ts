/* eslint-disable */
// El correo al cliente como RESPALDO del portal: espera según la urgencia y si el portal está abierto, se cancela si el cliente ya lo vio y se junta si hay varios.
import { db, limpiar, mkCliente, mkCompita, emailsA } from './harness'
import { beforeEach, afterEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { notificar } from '@/lib/avisos'
import { registrarLatido, marcarNovedadesVistas } from '@/lib/novedades'
import { procesarCorreosDiferidos, armarCorreoAgrupado, NOTA_VISTO, NOTA_AGRUPADO } from '@/lib/correos-diferidos'
import { procesarEscalera } from '@/lib/escalera'
import { ESPERA_PORTAL_ABIERTO_MIN, ESPERA_PORTAL_CERRADO_MIN } from '@/lib/novedades-politica'

beforeEach(() => { limpiar(); process.env.CORREO_RESPALDO = 'diferido' })
afterEach(() => { delete process.env.CORREO_RESPALDO })

const cita = (cliente: any, compita: any, extra = '') => notificar({ plantilla: 'cita_propuesta_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: cliente.id }, variables: { compitaId: compita.id, cuando: `jueves ${extra}` }, entidad: 'visita', entidadId: crypto.randomUUID() })
const aviso = (i = 0) => db.rows('avisos').filter((a: any) => a.destinatario_tipo === 'cliente')[i]
const minutos = (min: number) => new Date(Date.now() + min * 60_000)
/** Adelanta el reloj: todo aviso pendiente pasa a estar «vencido» hace X minutos. */
const vencer = () => { for (const a of db.rows('avisos')) if (a.estado === 'pendiente') a.programado_para = new Date(Date.now() - 1000).toISOString() }

describe('con el interruptor apagado todo sale como antes', () => {
  test('el correo sale al instante, y aun así queda la novedad para el portal', async () => {
    delete process.env.CORREO_RESPALDO
    const c = mkCliente({ email: 'c@mail.test' } as any), k = mkCompita({ nombre: 'María Pérez' } as any)
    await cita(c, k); assert.equal(emailsA('c@mail.test').length, 1); assert.equal(aviso().estado, 'enviado'); assert.equal(db.rows('novedades_cliente').length, 1)
  })
})

describe('con el correo diferido', () => {
  test('portal cerrado: no sale ahora, queda programado a los 3 minutos y con su novedad', async () => {
    const c = mkCliente({ email: 'c@mail.test' } as any), k = mkCompita({ nombre: 'María Pérez' } as any)
    const r = await cita(c, k)
    assert.equal(r.estado, 'pendiente'); assert.equal(emailsA('c@mail.test').length, 0)
    const espera = (new Date(aviso().programado_para).getTime() - Date.now()) / 60_000
    assert.ok(Math.abs(espera - ESPERA_PORTAL_CERRADO_MIN) < 0.5, `espera ${espera}`)
    const n = db.rows('novedades_cliente')[0]; assert.equal(n.tipo, 'cita_propuesta_cliente'); assert.equal(n.nivel, 'informativo'); assert.match(n.titulo, /Esperando a tu compita/)
  })
  test('portal abierto: espera 15 minutos', async () => {
    const c = mkCliente({ email: 'c@mail.test' } as any), k = mkCompita({} as any)
    await registrarLatido(c.id); await cita(c, k)
    const espera = (new Date(aviso().programado_para).getTime() - Date.now()) / 60_000
    assert.ok(Math.abs(espera - ESPERA_PORTAL_ABIERTO_MIN) < 0.5, `espera ${espera}`)
  })
  test('lo crítico sale al instante aunque el portal esté abierto', async () => {
    const c = mkCliente({ email: 'c@mail.test' } as any); await registrarLatido(c.id)
    const r = await notificar({ plantilla: 'pausa_cuenta_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: c.id }, variables: {}, entidad: 'cliente', entidadId: c.id })
    assert.equal(r.estado, 'enviado'); assert.equal(emailsA('c@mail.test').length, 1); assert.equal(db.rows('novedades_cliente')[0].nivel, 'critico')
  })
  test('un respaldo o reenvío (respaldoDe) no se difiere', async () => {
    const c = mkCliente({ email: 'c@mail.test' } as any), k = mkCompita({} as any)
    const r = await notificar({ plantilla: 'cita_propuesta_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: c.id }, variables: { compitaId: k.id, cuando: 'x' }, entidad: 'visita', entidadId: crypto.randomUUID(), respaldoDe: crypto.randomUUID(), claveUnica: 'reenvio:x' })
    assert.equal(r.estado, 'enviado'); assert.equal(emailsA('c@mail.test').length, 1)
  })
})

describe('cuando llega la hora', () => {
  test('sin haberlo visto, sale (un solo aviso sale tal cual)', async () => {
    const c = mkCliente({ email: 'c@mail.test' } as any), k = mkCompita({ nombre: 'María Pérez' } as any)
    await cita(c, k); assert.equal((await procesarCorreosDiferidos()).enviados, 0, 'todavía no es la hora')
    vencer(); const r = await procesarCorreosDiferidos(); assert.equal(r.enviados, 1); assert.equal(emailsA('c@mail.test').length, 1); assert.equal(aviso().estado, 'enviado')
  })
  test('si el cliente ya lo vio en el portal, se cancela y no sale nada', async () => {
    const c = mkCliente({ email: 'c@mail.test' } as any), k = mkCompita({} as any)
    await cita(c, k); assert.equal(await marcarNovedadesVistas(c.id), 1)
    assert.equal(aviso().estado, 'cancelado'); assert.equal(aviso().error, NOTA_VISTO)
    vencer(); await procesarCorreosDiferidos(); assert.equal(emailsA('c@mail.test').length, 0)
  })
  test('lo visto después de programarse pero antes de la hora también se cancela (la escalera lo comprueba)', async () => {
    const c = mkCliente({ email: 'c@mail.test' } as any), k = mkCompita({} as any)
    await cita(c, k); db.rows('novedades_cliente')[0].vista_en = new Date().toISOString(); vencer()
    const r = await procesarCorreosDiferidos(); assert.equal(r.cancelados, 1); assert.equal(emailsA('c@mail.test').length, 0)
  })
  test('varios avisos del mismo cliente salen juntos en UN correo', async () => {
    const c = mkCliente({ email: 'c@mail.test' } as any), k = mkCompita({ nombre: 'María Pérez' } as any)
    await cita(c, k, 'a'); await cita(c, k, 'b'); await cita(c, k, 'c')
    vencer(); const r = await procesarCorreosDiferidos()
    assert.equal(r.agrupados, 3); assert.equal(r.enviados, 1)
    const enviados = emailsA('c@mail.test'); assert.equal(enviados.length, 1); assert.match((enviados[0] as any).subject, /Tienes 3 novedades/)
    assert.ok(db.rows('avisos').filter((a: any) => a.destinatario_tipo === 'cliente').every((a: any) => a.estado === 'enviado' && a.error === NOTA_AGRUPADO))
  })
  test('los de otro cliente no se mezclan', async () => {
    const a = mkCliente({ email: 'a@mail.test' } as any), b = mkCliente({ email: 'b@mail.test' } as any), k = mkCompita({} as any)
    await cita(a, k); await cita(b, k); vencer(); await procesarCorreosDiferidos()
    assert.equal(emailsA('a@mail.test').length, 1); assert.equal(emailsA('b@mail.test').length, 1)
  })
  test('se juntan también los que van a salir en los próximos 5 minutos, pero solo si hay uno ya en hora', async () => {
    const c = mkCliente({ email: 'c@mail.test' } as any), k = mkCompita({} as any)
    await cita(c, k, 'a'); await cita(c, k, 'b')
    const [x, y] = db.rows('avisos').filter((a: any) => a.destinatario_tipo === 'cliente')
    x.programado_para = new Date(Date.now() + 4 * 60_000).toISOString(); y.programado_para = new Date(Date.now() + 4 * 60_000).toISOString()
    assert.equal((await procesarCorreosDiferidos()).enviados, 0, 'ninguno está en hora todavía')
    x.programado_para = new Date(Date.now() - 1000).toISOString()
    const r = await procesarCorreosDiferidos(); assert.equal(r.agrupados, 2); assert.equal(emailsA('c@mail.test').length, 1)
  })
  test('un aviso pendiente sin novedad (de antes) no lo toca: sigue siendo de la escalera de siempre', async () => {
    const c = mkCliente({ email: 'c@mail.test' } as any)
    db.seed('avisos', { destinatario_tipo: 'cliente', destinatario_id: c.id, canal: 'correo', plantilla: 'pausa_cuenta_cliente', variables: {}, estado: 'pendiente', clave_unica: 'viejo:1', programado_para: new Date(Date.now() - 60_000).toISOString() })
    const r = await procesarCorreosDiferidos(); assert.deepEqual(r, { enviados: 0, agrupados: 0, cancelados: 0 }); assert.equal(db.rows('avisos')[0].estado, 'pendiente')
  })
  test('la escalera corre este paso primero y lo informa', async () => {
    const c = mkCliente({ email: 'c@mail.test' } as any), k = mkCompita({} as any)
    await cita(c, k); vencer(); const r = await procesarEscalera(); assert.equal(r.diferidos?.enviados, 1); assert.equal(emailsA('c@mail.test').length, 1)
  })
})

describe('el correo agrupado', () => {
  test('lista cada asunto, escapa el texto y lleva el botón al portal', () => {
    const c = armarCorreoAgrupado(['Primero <b>', 'Segundo'])
    assert.match(c.asunto, /2 novedades/); assert.match(c.html, /<li>Primero &lt;b&gt;<\/li>/); assert.match(c.html, /\/portal/); assert.doesNotMatch(c.html, /[\u{1F300}-\u{1FAFF}]/u)
  })
})
