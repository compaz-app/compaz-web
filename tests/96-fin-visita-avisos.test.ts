/* eslint-disable */
// Fin de la visita: el resumen y el reporte de bienestar salen por el sistema de avisos (portal en vivo, correo de respaldo).
import { db, limpiar, mkCliente, mkCompita, mkVisita, emailsA } from './harness'
import { beforeEach, afterEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { notificar } from '@/lib/avisos'
import { PLANTILLAS } from '@/lib/plantillas-aviso'
import { procesarCorreosDiferidos } from '@/lib/correos-diferidos'
import { marcarNovedadesVistas } from '@/lib/novedades'
import { sendVisitaResumen } from '@/lib/resend'

beforeEach(limpiar)
afterEach(() => { delete process.env.CORREO_RESPALDO })

function terminada(o: any = {}) {
  const compita = mkCompita({ nombre: 'María Pérez', telegram_chat_id: '9500' } as any), cliente = mkCliente({ nombre: 'Carolina Pérez', email: 'caro@mail.test' } as any)
  const inicio = new Date(Date.now() - 2 * 3600_000).toISOString(), fin = new Date().toISOString()
  const v = mkVisita(cliente, compita, { estado: 'terminada', inicio, fin, ...o }) as any
  db.seed('mensajes', { visit_id: v.id, origen: 'compita', tipo: 'texto', contenido: 'Ya almorzó', created_at: new Date(Date.now() - 3600_000).toISOString() })
  return { compita: compita as any, cliente: cliente as any, v }
}
const resumen = (cliente: any, v: any) => notificar({ plantilla: 'visita_resumen', canal: 'correo', destinatario: { tipo: 'cliente', id: cliente.id }, variables: { visitaId: v.id }, entidad: 'visita', entidadId: v.id, paso: 14 })

describe('el resumen de la visita', () => {
  test('se arma con lo que hay en la base: duración, mensajes y los botones de calificación', async () => {
    const { v } = terminada()
    const c = await PLANTILLAS.visita_resumen.render({ visitaId: v.id })
    assert.match(c!.correo!.asunto, /Resumen de la visita de hoy con María Pérez/); assert.match(c!.correo!.html, /2h 0min|120 minutos|2h/); assert.match(c!.correo!.html, /Ya almorzó/); assert.match(c!.correo!.html, /visita\/rating/)
  })
  test('no se manda de una visita que no terminó o no existe', async () => {
    const { v } = terminada({ estado: 'en_curso' }); assert.equal(await PLANTILLAS.visita_resumen.render({ visitaId: v.id }), null)
    assert.equal(await PLANTILLAS.visita_resumen.render({ visitaId: crypto.randomUUID() }), null)
  })
  test('con el interruptor apagado sale al instante, como antes', async () => {
    const { cliente, v } = terminada(); await resumen(cliente, v)
    assert.equal(emailsA('caro@mail.test').length, 1); assert.equal(db.rows('novedades_cliente')[0].tipo, 'visita_resumen')
  })
  test('con el correo diferido: el portal la tiene en vivo y el correo espera; si el cliente la ve, no sale', async () => {
    process.env.CORREO_RESPALDO = 'diferido'
    const { cliente, v } = terminada(); const r = await resumen(cliente, v)
    assert.equal(r.estado, 'pendiente'); assert.equal(emailsA('caro@mail.test').length, 0)
    assert.match(db.rows('novedades_cliente')[0].titulo, /La visita terminó/); assert.equal(await marcarNovedadesVistas(cliente.id), 1)
    for (const a of db.rows('avisos')) if (a.estado === 'pendiente') a.programado_para = new Date(Date.now() - 1000).toISOString()
    await procesarCorreosDiferidos(); assert.equal(emailsA('caro@mail.test').length, 0)
  })
  test('el mismo resumen no se manda dos veces por la misma visita', async () => {
    const { cliente, v } = terminada(); await resumen(cliente, v); assert.equal((await resumen(cliente, v)).estado, 'duplicado'); assert.equal(emailsA('caro@mail.test').length, 1)
  })
  test('el envío directo de siempre (sendVisitaResumen) sigue funcionando', async () => {
    const { compita, cliente, v } = terminada(); await sendVisitaResumen(cliente, compita, v, [], false); assert.equal(emailsA('caro@mail.test').length, 1)
  })
})

describe('el reporte de bienestar', () => {
  const reporte = (v: any, o: any = {}) => db.seed('reportes_visita', { visita_id: v.id, animo: 5, fisico: 4, participacion: 4, entorno: 5, novedad: null, resumen_ia: 'Tu mamá estuvo de muy buen ánimo hoy.', ...o })
  test('usa el resumen ya guardado (no llama a la IA al enviar) y es EL resumen de la visita (no una «actualización»)', async () => {
    const { v } = terminada(); const rep = reporte(v)
    const c = await PLANTILLAS.visita_reporte.render({ reporteId: rep.id })
    assert.match(c!.correo!.asunto, /^Resumen de la visita de hoy con María Pérez/); assert.match(c!.correo!.html, /muy buen ánimo/); assert.match(c!.correo!.html, /Indicadores de la visita/)
  })
  test('sin reporte no se manda; y sin resumen de IA igual sale con los indicadores', async () => {
    assert.equal(await PLANTILLAS.visita_reporte.render({ reporteId: crypto.randomUUID() }), null)
    const { v } = terminada(); const rep = reporte(v, { resumen_ia: null }); assert.match((await PLANTILLAS.visita_reporte.render({ reporteId: rep.id }))!.correo!.html, /Indicadores/)
  })
  test('el reporte y el resumen del mismo cliente se juntan en un solo correo cuando llega su hora', async () => {
    process.env.CORREO_RESPALDO = 'diferido'
    const { cliente, v } = terminada(); const rep = reporte(v)
    await resumen(cliente, v)
    await notificar({ plantilla: 'visita_reporte', canal: 'correo', destinatario: { tipo: 'cliente', id: cliente.id }, variables: { reporteId: rep.id }, entidad: 'visita', entidadId: v.id, paso: 15 })
    for (const a of db.rows('avisos')) if (a.estado === 'pendiente') a.programado_para = new Date(Date.now() - 1000).toISOString()
    const r = await procesarCorreosDiferidos(); assert.equal(r.agrupados, 2); assert.equal(emailsA('caro@mail.test').length, 1); assert.match((emailsA('caro@mail.test')[0] as any).subject, /2 novedades/)
  })
})

describe('Telegram usa el sistema de avisos', () => {
  test('al terminar y al guardar el reporte se llama a notificar, no al envío directo, y el compita sabe que la familia lo ve en su portal', () => {
    const w = readFileSync('app/api/telegram-webhook/route.ts', 'utf8')
    assert.match(w, /plantilla: 'visita_reporte'/); assert.doesNotMatch(w, /plantilla: 'visita_resumen'/, 'al terminar la visita ya no sale el resumen básico'); assert.doesNotMatch(w, /sendVisitaResumen\(|sendResumenConReporte\(/)
    assert.match(w, /en su portal/); assert.match(w, /tipo: 'visita_terminada'/)
  })
})
