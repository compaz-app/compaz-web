/* eslint-disable */
// Lote 4 (tramo 3): seguridad del compita. "No me siento seguro" interrumpe la visita SIN penalización (aviso neutro al cliente,
// alerta urgente al equipo, sin descontar la visita). "¿Todo bien?" pasada la hora de fin; sin respuesta, alerta urgente.
import { db, limpiar, session, mkCliente, mkCompita, mkVisita, tgText, tgBtn, tgPara, emailsA, cron, hoyVEstr, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { POST as cronEscalera } from '@/app/api/cron/escalera-avisos/route'
import { preguntarTodoBien, escalarTodoBien } from '@/lib/seguridad'
import { cupoDelPlan } from '@/lib/visitas'
import { resumenCancelacionesCompita } from '@/lib/cancelaciones'
import { limpiarCacheAjustes, setAjuste } from '@/lib/ajustes'
import { TECLADO_SIN_VISITA, TECLADO_INICIO, TECLADO_DURANTE_VISITA } from '@/lib/telegram'

const CHAT = '9951'
beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const conPlan = (cli: any) => db.seed('pagos_plan', { usuario_id: cli.id, tipo: 'plan', plan: 'quincenal', visitas: 2, monto_usd: 60, metodo: 'zelle', inicio: new Date(Date.now() - 86400_000).toISOString(), vence: new Date(Date.now() + 40 * 86400_000).toISOString(), estado: 'activo' })
// Hora de Venezuela (HH:MM) de un instante a `min` minutos de ahora, y su fecha.
const ve = (min: number) => { const t = new Date(Date.now() + min * 60_000 - 4 * 3600_000).toISOString(); return { fecha: t.slice(0, 10), hora: t.slice(11, 16) } }
function mundo(estado = 'en_curso', finEnMin = -20) {
  const compita = mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez' }); const cliente = mkCliente({ nombre: 'Carolina Pérez', email: 'caro@mail.test', zona: 'Chacao' })
  conPlan(cliente)
  const fin = ve(finEnMin), ini = ve(finEnMin - 120)
  const visita = mkVisita(cliente, compita, { estado, fecha_programada: fin.fecha, hora_inicio_programada: ini.hora, hora_fin_programada: fin.hora, inicio: new Date(Date.now() - 100 * 60_000).toISOString(), contacto_nombre: 'Rosa Linares', contacto_tel: '+58 414 555 0101', created_at: new Date(Date.now() - 3600_000).toISOString() })
  return { compita, cliente, visita }
}
const seguro = () => webhook(tgText(CHAT, '🛡️ No me siento seguro'))
const flags = (tipo: string) => db.rows('admin_flags').filter((f) => f.tipo === tipo)
const botones = (m: any) => (m?.markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data)

describe('"No me siento seguro"', () => {
  test('está en los teclados de la visita, y la emergencia en TODOS los teclados', () => {
    const textos = (t: any) => t.keyboard.flat().map((b: any) => b.text)
    assert.ok(textos(TECLADO_INICIO).includes('🛡️ No me siento seguro')); assert.ok(textos(TECLADO_DURANTE_VISITA).includes('🛡️ No me siento seguro'))
    for (const t of [TECLADO_SIN_VISITA, TECLADO_INICIO, TECLADO_DURANTE_VISITA]) assert.ok(textos(t).includes('🚨 Emergencia'))
  })

  test('actúa de inmediato, sin pedir confirmación: la visita se interrumpe y el compita sabe qué sigue', async () => {
    const { compita } = mundo(); await seguro()
    assert.equal(db.rows('visitas').length, 0, 'la visita quedó interrumpida')
    const m = tgPara(CHAT).at(-1)!; assert.match(m.text, /Tu seguridad es lo primero/); assert.match(m.text, /911/); assert.match(m.text, /ninguna penalización/)
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'salida_por_seguridad' && e.actor === `compita:${compita.id}`))
  })

  test('SIN penalización: queda registrada como justificada y no cuenta para su semáforo ni su pausa', async () => {
    const { compita } = mundo(); await seguro()
    const c = db.rows('cancelaciones')[0]
    assert.equal(c.cancelado_por, 'compita'); assert.equal(c.justificada, true); assert.match(c.motivo, /seguridad/i); assert.equal(c.cuenta_como_usada, false)
    assert.equal((await resumenCancelacionesCompita(compita.id)).cuentanContra, 0)
    for (let i = 0; i < 4; i++) { mkVisita(db.rows('usuarios')[0], compita, { estado: 'en_curso' }); await seguro() }
    assert.equal((await resumenCancelacionesCompita(compita.id)).nivel, 'normal', 'aunque lo use varias veces nunca se pausa')
  })

  test('al cliente NO se le descuenta la visita y su aviso es neutro (sin culpas ni detalles)', async () => {
    const { cliente } = mundo()
    assert.equal((await cupoDelPlan(cliente.id))!.restantes, 1)
    await seguro()
    assert.equal((await cupoDelPlan(cliente.id))!.restantes, 2, 'el crédito vuelve')
    const c = emailsA('caro@mail.test').find((e) => /se interrumpió/.test(e.subject))!
    assert.ok(c); assert.match(c.html, /seguridad de todos/); assert.match(c.html, /no se te descuenta/)
    assert.ok(!/peligro|agred|riesgo|inseguro|culpa/i.test(c.html), 'sin alarmas ni acusaciones')
  })

  test('el equipo recibe una alerta URGENTE por Telegram y correo, con la tarea en la Bandeja (el teléfono solo por Telegram)', async () => {
    mundo(); await seguro()
    const a = avisosAdmin().find((m) => /NO ME SIENTO SEGURO/.test(m.text))!
    assert.ok(a); assert.match(a.text, /María Pérez/); assert.match(a.text, /Carolina Pérez/); assert.match(a.text, /Contacto en el sitio/); assert.match(a.text, /sin penalización/i)
    assert.ok(emailsA('admin@compaz.test').some((e) => /no se siente seguro/.test(e.subject)))
    const t = flags('salida_seguridad'); assert.equal(t.length, 1); assert.equal(t[0].prioridad, 1)
    assert.ok(!t[0].nota.includes('555'), 'el teléfono no queda escrito en la tarea')
  })

  test('funciona en cada momento de la visita: en curso, confirmando inicio y recién llegado (programada con llegada)', async () => {
    for (const [estado, extra] of [['en_curso', {}], ['confirmando_inicio', {}], ['programada', { llegada_en: new Date().toISOString() }]] as const) {
      limpiar(); limpiarCacheAjustes(); const { visita } = mundo(estado, 60); Object.assign(visita, extra)
      await seguro(); assert.equal(db.rows('visitas').length, 0, estado)
    }
  })

  test('sin visita registrada IGUAL se alerta al equipo (la seguridad no depende de la base)', async () => {
    mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez' }); await seguro()
    assert.ok(avisosAdmin().some((m) => /NO ME SIENTO SEGURO/.test(m.text) && /No hay una visita registrada/.test(m.text)))
    assert.match(tgPara(CHAT).at(-1)!.text, /911/)
  })

  test('también desde el botón de la llegada (callback "seguro")', async () => {
    mundo('programada', 60); db.rows('visitas')[0].llegada_en = new Date().toISOString()
    await webhook(tgBtn(CHAT, 'seguro'))
    assert.equal(db.rows('visitas').length, 0); assert.ok(flags('salida_seguridad').length === 1)
  })

  test('la emergencia ya funciona también con la visita confirmando inicio', async () => {
    mundo('confirmando_inicio', 60); await webhook(tgText(CHAT, '🚨 Emergencia'))
    assert.ok(avisosAdmin().some((m) => /EMERGENCIA/.test(m.text) && /Carolina Pérez/.test(m.text)))
  })
})

describe('"¿Todo bien?" después de la hora de fin', () => {
  test('antes de los 15 minutos no pregunta; pasados, pregunta UNA sola vez con sus dos botones', async () => {
    const { visita } = mundo('en_curso', -10)
    assert.equal(await preguntarTodoBien(), 0, 'a los 10 minutos de la hora de fin todavía no')
    Object.assign(visita, { fecha_programada: ve(-16).fecha, hora_fin_programada: ve(-16).hora }) // fecha y hora juntas (cerca de medianoche cambian de día)
    assert.equal(await preguntarTodoBien(), 1); assert.equal(await preguntarTodoBien(), 0, 'una sola vez')
    const m = tgPara(CHAT).at(-1)!; assert.match(m.text, /¿Todo bien\?/)
    assert.deepEqual(botones(m), [`tb:ok:${visita.id}`, `tb:ayuda:${visita.id}`])
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'visita_alargada' && e.datos.respuesta === 'pendiente'))
  })

  test('el ajuste manda: con 30 minutos de margen, a los 20 todavía no', async () => {
    await setAjuste({ clave: 'todo_bien_min', valor: 30, actor: 'admin:a' }); limpiarCacheAjustes()
    mundo('en_curso', -20); assert.equal(await preguntarTodoBien(), 0)
  })

  test('no pregunta si la visita ya terminó, ni a visitas que no están en curso', async () => {
    mundo('terminada', -30); mundo('programada', -30)
    assert.equal(await preguntarTodoBien(), 0)
  })

  test('"Todo bien": cierra la pregunta y NO se alerta a nadie aunque pase el plazo', async () => {
    const { visita } = mundo('en_curso', -20); await preguntarTodoBien()
    await webhook(tgBtn(CHAT, `tb:ok:${visita.id}`))
    assert.match(tgPara(CHAT).at(-1)!.text, /Gracias por avisar/)
    db.rows('avisos').find((a) => a.plantilla === 'todo_bien')!.creado_en = new Date(Date.now() - 30 * 60_000).toISOString()
    assert.equal(await escalarTodoBien(), 0); assert.equal(flags('visita_alargada').length, 0)
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'visita_alargada' && e.datos.respuesta === 'ok'))
  })

  test('"Necesito ayuda": alerta urgente al equipo AL INSTANTE', async () => {
    const { visita } = mundo('en_curso', -20); await preguntarTodoBien()
    await webhook(tgBtn(CHAT, `tb:ayuda:${visita.id}`))
    assert.ok(avisosAdmin().some((m) => /VISITA ALARGADA/.test(m.text) && /pidió ayuda/.test(m.text)))
    const t = flags('visita_alargada'); assert.equal(t.length, 1); assert.equal(t[0].prioridad, 1)
    assert.match(tgPara(CHAT).at(-1)!.text, /911/)
  })

  test('SIN respuesta en 10 minutos: alerta urgente, una sola vez; antes de los 10 no', async () => {
    mundo('en_curso', -20); await preguntarTodoBien()
    const aviso = db.rows('avisos').find((a) => a.plantilla === 'todo_bien')!
    aviso.creado_en = new Date(Date.now() - 9 * 60_000).toISOString(); assert.equal(await escalarTodoBien(), 0)
    aviso.creado_en = new Date(Date.now() - 11 * 60_000).toISOString()
    assert.equal(await escalarTodoBien(), 1); assert.equal(await escalarTodoBien(), 0, 'no se repite')
    const a = avisosAdmin().find((m) => /VISITA ALARGADA/.test(m.text))!
    assert.match(a.text, /no respondió/); assert.match(a.text, /Rosa Linares/)
    assert.equal(flags('visita_alargada').length, 1)
    assert.ok(emailsA('admin@compaz.test').some((e) => /visita alargada/.test(e.subject)))
  })

  test('si el compita termina la visita antes de que venza el plazo, no se alerta', async () => {
    const { visita } = mundo('en_curso', -20); await preguntarTodoBien()
    visita.estado = 'terminada'
    db.rows('avisos').find((a) => a.plantilla === 'todo_bien')!.creado_en = new Date(Date.now() - 30 * 60_000).toISOString()
    assert.equal(await escalarTodoBien(), 0); assert.equal(flags('visita_alargada').length, 0)
  })

  test('solo responde el compita de esa visita', async () => {
    const { visita } = mundo('en_curso', -20); await preguntarTodoBien(); mkCompita({ telegram_chat_id: '9961' })
    await webhook(tgBtn('9961', `tb:ayuda:${visita.id}`))
    assert.equal(flags('visita_alargada').length, 0)
  })

  test('la escalera real (el cron) hace la pregunta y la alerta', async () => {
    mundo('en_curso', -20)
    const r1 = await cronEscalera(cron('/api/cron/escalera-avisos')); assert.equal((await r1.json()).data.todoBien.preguntas, 1)
    db.rows('avisos').find((a) => a.plantilla === 'todo_bien')!.creado_en = new Date(Date.now() - 30 * 60_000).toISOString()
    const r2 = await cronEscalera(cron('/api/cron/escalera-avisos')); assert.equal((await r2.json()).data.todoBien.alertas, 1)
  })
})
