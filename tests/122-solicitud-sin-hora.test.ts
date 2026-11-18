/* eslint-disable */
// Una entrevista que se queda sin hora no se pierde: el «No se pudo» se anota al abrir la página, el cliente recibe recordatorio a las 24 h y el equipo una tarea a las 48 h.
import { db, limpiar, req, cron, emailsA, tgPara, mkCompita, mkCliente, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as llamadaNoOcurrio } from '@/app/api/solicitud/llamada-no-ocurrio/route'
import { POST as seguimiento } from '@/app/api/cron/seguimiento/route'
import { procesarSolicitudesSinHora } from '@/lib/sin-hora'
import { readFileSync } from 'node:fs'

beforeEach(limpiar)
const hace = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
const sinHora = (horas: number, o: Record<string, any> = {}) => {
  const compita = mkCompita({ telegram_chat_id: '710', nombre: 'Ana Pérez' }); const cli = mkCliente({ email: 'cli@mail.test', nombre: 'Carlos Ruiz' })
  const sol = mkSolicitud(cli, compita, { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [], slot_confirmado: null, respondido_at: hace(horas), token_respuesta: 'tok-sh', ...o })
  return { compita, cli, sol }
}
const banderas = () => db.rows('admin_flags').filter((f: any) => String(f.nota).includes('[sin_hora:'))

describe('anotar el «no se pudo» al abrir la página', () => {
  const post = (token: string) => llamadaNoOcurrio(req('/api/solicitud/llamada-no-ocurrio', { json: { token } }))
  test('si la llamada ya debió terminar, queda anotado que no ocurrió, una sola vez', async () => {
    const compita = mkCompita(); const cli = mkCliente({ email: 'cli@mail.test' })
    const sol = mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: hace(1), token_respuesta: 'tok-1' })
    assert.equal((await (await post('tok-1')).json()).data.registrada, true)
    assert.equal(db.rows('solicitudes').find((s: any) => s.id === sol.id)!.confirmacion_cliente, false)
    await post('tok-1'); assert.equal(db.rows('actividad_admin').filter((a: any) => /Llamada no ocurrió/.test(a.resumen)).length, 1, 'no se repite el aviso')
  })
  test('antes de la hora de la llamada NO cuenta (pedir otra hora antes es un cambio normal)', async () => {
    const compita = mkCompita(); const cli = mkCliente()
    const sol = mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: new Date(Date.now() + 3_600_000).toISOString(), token_respuesta: 'tok-2' })
    assert.equal((await (await post('tok-2')).json()).data.registrada, false)
    assert.equal(db.rows('solicitudes').find((s: any) => s.id === sol.id)!.confirmacion_cliente ?? null, null)
  })
  test('token inválido: 404; sin token: 400; y la página lo dispara al abrirse', async () => {
    assert.equal((await post('no-existe')).status, 404); assert.equal((await llamadaNoOcurrio(req('/api/solicitud/llamada-no-ocurrio', { json: {} }))).status, 400)
    assert.match(readFileSync('app/reagendar/[token]/page.tsx', 'utf8'), /llamada-no-ocurrio/)
  })
})

describe('escalera de entrevistas sin hora', () => {
  test('antes de 24 h no pasa nada', async () => {
    sinHora(10); const r = await procesarSolicitudesSinHora()
    assert.deepEqual(r, { recordatorios: 0, tareas: 0, cerradas: 0 }); assert.equal(emailsA('cli@mail.test').length, 0)
  })
  test('a las 24 h: recordatorio al cliente (correo con su enlace y aviso en el portal), una sola vez', async () => {
    const { cli } = sinHora(26)
    await procesarSolicitudesSinHora(); await procesarSolicitudesSinHora()
    const mails = emailsA('cli@mail.test'); assert.equal(mails.length, 1); assert.match(mails[0].html, /\/reagendar\/tok-sh/)
    assert.equal(db.rows('novedades_cliente').filter((n: any) => n.usuario_id === cli.id && n.tipo === 'sin_hora_recordatorio').length, 1)
    assert.equal(banderas().length, 0, 'todavía no hay tarea para el equipo')
  })
  test('a las 48 h: tarea en la Bandeja con el nombre del cliente y aviso al compita sin enlaces ni contactos', async () => {
    sinHora(50); const r = await procesarSolicitudesSinHora()
    assert.equal(r.recordatorios, 1); assert.equal(r.tareas, 1)
    assert.equal(banderas().length, 1); assert.match(String(banderas()[0].nota), /Carlos Ruiz/)
    const t = tgPara(710).at(-1)!; assert.match(t.text, /pendiente/); assert.doesNotMatch(t.text, /@|https?:|cli@mail/)
    await procesarSolicitudesSinHora(); assert.equal(banderas().length, 1, 'no se duplica'); assert.equal(emailsA('cli@mail.test').length, 1)
  })
  test('cuando la solicitud vuelve a tener hora, la tarea se cierra sola', async () => {
    const { sol } = sinHora(50); await procesarSolicitudesSinHora()
    db.rows('solicitudes').find((s: any) => s.id === sol.id)!.slot_confirmado = new Date(Date.now() + 86_400_000).toISOString()
    const r = await procesarSolicitudesSinHora(); assert.equal(r.cerradas, 1); assert.ok(banderas().every((f: any) => f.resuelto === true))
  })
  test('cada vez que se vuelve a quedar sin hora (nuevo reagendado) la escalera empieza de nuevo; no toca otras solicitudes', async () => {
    const { sol } = sinHora(60)
    db.rows('eventos').push({ entidad: 'solicitud', entidad_id: sol.id, tipo: 'entrevista_reagendada', creado_en: hace(2), actor: 'cliente:x', datos: {} })
    const r = await procesarSolicitudesSinHora(); assert.equal(r.recordatorios, 0, 'se soltó hace 2 h: aún no toca')
    mkSolicitud(mkCliente(), mkCompita(), { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [1], slot_confirmado: null, respondido_at: hace(99), token_respuesta: 'otra' })
    assert.equal((await procesarSolicitudesSinHora()).recordatorios, 0, 'una con horas propuestas (otro flujo) no entra')
  })
  test('el cron de seguimiento la corre y sigue respondiendo bien', async () => {
    sinHora(26); const r = await seguimiento(cron('s')); assert.equal(r.status, 200)
    assert.equal(emailsA('cli@mail.test').filter((m: any) => /Falta elegir la hora/.test(m.subject)).length, 1)
  })
})
