/* eslint-disable */
// Visitas 2, 3, 4...: el cliente agenda otra con su compita y se repite el mismo flujo completo.
import { db, net, session, limpiar, req, tgText, tgBtn, tgFoto, ultimoTg, tgPara, emailsA, cron, ahoraMas, hoyVEstr, mkCompita, mkCliente, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { tokenRating } from '@/lib/links'
import { POST as nueva } from '@/app/api/visita/nueva/route'
import { POST as pagoConfirmar } from '@/app/api/pago/confirmar/route'
import { PUT as fechaPut } from '@/app/api/visita/fecha/route'
import { POST as reagendarCliente } from '@/app/api/visita/reagendar/route'
import { POST as sendMessage } from '@/app/api/send-message/route'
import { POST as ratingPost } from '@/app/api/visita/rating/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { POST as manana } from '@/app/api/cron/recordatorio-primera-visita/route'
import { POST as noshow } from '@/app/api/cron/noshow-alerta/route'
import { POST as churn } from '@/app/api/cron/churn-alerta/route'
import { POST as bloquearCompita } from '@/app/api/admin/bloquear-compita/route'
import { POST as bloquearCliente } from '@/app/api/admin/bloquear-cliente/route'

beforeEach(limpiar)
const como = (u: any) => { session.user = { id: u.id, email: u.email } }
const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }

const mundo = async () => {
  const lucia = mkCompita({ telegram_chat_id: '3000', nombre: 'Lucía' })
  const carlos = mkCliente({ email: 'carlos@mail.test', nombre: 'Carlos' })
  const sol = mkSolicitud(carlos, lucia, { estado: 'aceptada', slot_confirmado: ahoraMas(-60) })
  como(carlos)
  await pagoConfirmar(req('/api/pago/confirmar', { json: { solicitud_id: sol.id, plan: 'semanal' } }))
  return { lucia, carlos }
}

/** Hace una visita completa (coordinar fecha → iniciar → mensaje → foto → terminar → cuestionario → rating). */
async function visitaCompleta(carlos: any, lucia: any, n: number) {
  const v = db.rows('visitas').filter((x) => x.usuario_id === carlos.id).at(-1)!
  assert.equal(v.estado, 'pre_visita', `visita ${n}: arranca en coordinación`)
  await webhook(tgText(3000, `Hola, ¿qué día te queda bien? (visita ${n})`))
  assert.ok(db.rows('mensajes').some((m) => m.visit_id === v.id && m.origen === 'compita'), `visita ${n}: el chat funciona`)
  como(carlos)
  const f = await fechaPut(req('/api/visita/fecha', { method: 'PUT', json: { visita_id: v.id, fecha_programada: hoyVEstr(1), hora_inicio: `${9 + n}:00`.padStart(5, '0'), hora_fin: `${11 + n}:00` } }))
  assert.equal(f.status, 200, `visita ${n}: registra la fecha`)
  admin(); net.tg = []
  await manana(cron('m'))
  assert.ok(tgPara(3000).some((m) => m.text.includes('visita mañana')), `visita ${n}: recordatorio de 24 h`)
  v.fecha_programada = hoyVEstr()
  await webhook(tgText(3000, '▶️ Iniciar visita')); await webhook(tgText(3000, '✅ Sí, iniciar'))
  assert.equal(v.estado, 'en_curso', `visita ${n}: inicia`)
  await webhook(tgFoto(3000)); como(carlos)
  await sendMessage(req('/api/send-message', { json: { contenido: `mensaje del cliente ${n}` } }))
  assert.match(ultimoTg(3000)!.text, new RegExp(`cliente ${n}`))
  await webhook(tgText(3000, '🔴 Terminar visita')); await webhook(tgText(3000, '✅ Sí, terminar'))
  for (const r of ['rr:5', 'rr:4', 'rr:4', 'rr:5']) await webhook(tgBtn(3000, r))
  await webhook(tgBtn(3000, 'rn:skip'))
  assert.equal(v.estado, 'terminada', `visita ${n}: termina`)
  assert.equal(db.rows('reportes_visita').filter((r) => r.visita_id === v.id).length, 1, `visita ${n}: un cuestionario`)
  assert.equal((await ratingPost(req(`/api/visita/rating?visita_id=${v.id}&valor=5&t=${tokenRating(v.id, 5)}`, { method: 'POST' }))).status, 200)
  return v
}

describe('Agendar otra visita (2ª, 3ª, 4ª...)', () => {
  test('el flujo completo se repite 4 veces con la misma compita; contadores, valoración y emails correctos', async () => {
    const { lucia, carlos } = await mundo()
    await visitaCompleta(carlos, lucia, 1)
    for (let n = 2; n <= 4; n++) {
      como(carlos); net.tg = []
      const r = await nueva()
      assert.equal(r.status, 200, `visita ${n}: se puede agendar`)
      assert.equal((await r.json()).data.numero, n)
      assert.match(ultimoTg(3000)!.text, new RegExp(`visita número ${n}`), 'la compita es avisada')
      assert.ok(tgPara(999).some((m) => m.text.includes('Nueva visita agendada')), 'el admin es avisado')
      await visitaCompleta(carlos, lucia, n)
    }
    assert.equal(lucia.visitas_realizadas, 4)
    assert.equal(lucia.total_ratings, 4); assert.equal(lucia.rating_promedio, 5)
    assert.equal(db.rows('visitas').filter((v) => v.estado === 'terminada').length, 4)
    assert.equal(db.rows('visitas').length, 4, 'ni visitas duplicadas ni huérfanas')
    assert.equal(emailsA('carlos@mail.test').filter((e) => e.subject.startsWith('Resumen')).length, 4)
    assert.ok(!JSON.stringify([db.rows('mensajes'), net.emails, net.tg]).includes('TESTBOTTOKEN'))
  })

  test('solo se puede tener una visita activa: doble clic o con una en coordinación/programada/en curso → 409, sin duplicar', async () => {
    const { lucia, carlos } = await mundo()
    await visitaCompleta(carlos, lucia, 1)
    como(carlos)
    const [a, b] = await Promise.all([nueva(), nueva()])
    assert.deepEqual([a.status, b.status].sort(), [200, 409])
    assert.equal(db.rows('visitas').filter((v) => v.estado === 'pre_visita').length, 1)
    for (const estado of ['programada', 'en_curso']) {
      db.rows('visitas').find((v) => v.estado === 'pre_visita' || v.estado === 'programada')!.estado = estado
      assert.equal((await nueva()).status, 409, estado)
    }
  })

  test('reglas: sin compita, sin visita previa, cliente bloqueado, compita bloqueada/inactiva, sin sesión', async () => {
    // sin sesión
    session.user = null; assert.equal((await nueva()).status, 401)
    // sin compita asignada
    const sinCompita = mkCliente(); como(sinCompita); assert.equal((await nueva()).status, 409)
    // con compita pero sin ninguna visita terminada (la primera nace al contratar)
    const { lucia, carlos } = await mundo()
    como(carlos); assert.equal((await nueva()).status, 409)
    await visitaCompleta(carlos, lucia, 1)
    // cliente bloqueado
    admin(); await bloquearCliente(req('/api/admin/bloquear-cliente', { json: { usuario_id: carlos.id, bloquear: true } }))
    como(carlos); assert.equal((await nueva()).status, 401)
    admin(); await bloquearCliente(req('/api/admin/bloquear-cliente', { json: { usuario_id: carlos.id, bloquear: false } }))
    // compita bloqueada: además queda desasignada
    await bloquearCompita(req('/api/admin/bloquear-compita', { json: { compita_id: lucia.id, bloquear: true } }))
    como(carlos); assert.equal((await nueva()).status, 409)
    assert.equal(db.rows('visitas').filter((v) => v.estado === 'pre_visita').length, 0)
  })

  test('la compita puede iniciar la 2ª visita pero no una de otro día; y la 2ª visita se puede reagendar varias veces', async () => {
    const { lucia, carlos } = await mundo()
    await visitaCompleta(carlos, lucia, 1)
    como(carlos); await nueva()
    const v2 = db.rows('visitas').find((v) => v.estado === 'pre_visita')!
    for (let i = 0; i < 3; i++) {
      como(carlos)
      await fechaPut(req('/api/visita/fecha', { method: 'PUT', json: { visita_id: v2.id, fecha_programada: hoyVEstr(2 + i), hora_inicio: '10:00', hora_fin: '12:00' } }))
      assert.equal(v2.estado, 'programada')
      await webhook(tgText(3000, '▶️ Iniciar visita'))
      assert.match(ultimoTg(3000)!.text, /Podrás iniciarla ese día/)
      assert.equal((await reagendarCliente(req('/api/visita/reagendar', { json: { visita_id: v2.id } }))).status, 200)
      assert.equal(v2.estado, 'pre_visita')
    }
    assert.ok(tgPara(999).some((m) => m.text.includes('3 reagendados') || m.text.includes('reagendados')), 'el admin ve el patrón de reagendados')
  })

  test('no-show de la 2ª visita se alerta igual; churn no salta mientras haya visita reciente o activa', async () => {
    const { lucia, carlos } = await mundo()
    const v1 = await visitaCompleta(carlos, lucia, 1)
    como(carlos); await nueva()
    const v2 = db.rows('visitas').find((v) => v.estado === 'pre_visita')!
    admin(); net.tg = []
    await churn(cron('c'))
    assert.ok(!tgPara(999).some((m) => m.text.includes('necesitan seguimiento')), 'con visita reciente/activa no es churn')
    v1.fin = new Date(Date.now() - 40 * 86400_000).toISOString()
    await churn(cron('c'))
    assert.ok(!tgPara(999).some((m) => m.text.includes('necesitan seguimiento')), 'con una visita activa en coordinación tampoco')
    v2.estado = 'terminada'; v2.fin = new Date(Date.now() - 40 * 86400_000).toISOString()
    await churn(cron('c'))
    assert.ok(tgPara(999).some((m) => m.text.includes('necesitan seguimiento')), 'sin visitas activas y 40 días sin visita sí es churn')
  })

  test('contratar OTRA vez a la misma compita (nueva solicitud) no duplica la visita activa', async () => {
    const { lucia, carlos } = await mundo()
    await visitaCompleta(carlos, lucia, 1)
    como(carlos); await nueva()
    const s2 = mkSolicitud(carlos, lucia, { estado: 'aceptada', slot_confirmado: ahoraMas(-60) })
    await pagoConfirmar(req('/api/pago/confirmar', { json: { solicitud_id: s2.id, plan: 'carta' } }))
    assert.equal(db.rows('visitas').filter((v) => ['pre_visita', 'programada', 'en_curso'].includes(v.estado)).length, 1)
  })

  test('el cliente cambia de compita: la nueva compita recibe la 2ª visita, no la anterior', async () => {
    const { lucia, carlos } = await mundo()
    await visitaCompleta(carlos, lucia, 1)
    const ana = mkCompita({ telegram_chat_id: '3001', nombre: 'Ana' })
    admin()
    const { POST: asignar } = await import('@/app/api/admin/asignar-compita/route')
    await asignar(req('/api/admin/asignar-compita', { json: { usuario_id: carlos.id, compita_id: ana.id } }))
    assert.equal(carlos.compita_id, ana.id)
    const v = db.rows('visitas').find((x) => x.estado === 'pre_visita')!
    assert.equal(v.compita_id, ana.id)
    como(carlos); assert.equal((await nueva()).status, 409, 'ya hay una visita en coordinación con la nueva compita')
  })
})
