/* eslint-disable */
// Lote 4 (tramo 2): llegada con foto obligatoria y "nadie abre". La foto solo vale si llega después de que el bot la pidió; el
// cliente la ve desde Compaz; si nadie abre empieza la cuenta atrás (tareas a los 5 y 15 min, cierre a los 30) y la visita
// sin acceso cuenta como usada.
import { db, net, limpiar, req, session, mkCliente, mkCompita, mkVisita, tgText, tgBtn, tgFoto, tgPara, emailsA, cron, hoyVEstr, confirmarLlegada, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { POST as cronEscalera } from '@/app/api/cron/escalera-avisos/route'
import { GET as llegadaGet, POST as llegadaPost } from '@/app/api/visita/llegada/route'
import { GET as fotoGet } from '@/app/api/visita/llegada-foto/route'
import { cupoDelPlan } from '@/lib/visitas'
import { marcarJustificada } from '@/lib/cancelaciones'
import { procesarNadieAbre } from '@/lib/llegada'
import { limpiarCacheAjustes, setAjuste } from '@/lib/ajustes'

const CHAT = '9901'
beforeEach(async () => { limpiar(); limpiarCacheAjustes(); await setAjuste({ clave: 'llegada_foto_obligatoria', valor: 1, actor: 'admin:a' }); limpiarCacheAjustes() })
const como = (u: any) => { session.user = { id: u.id, email: u.email } }
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const conPlan = (cli: any) => db.seed('pagos_plan', { usuario_id: cli.id, tipo: 'plan', plan: 'quincenal', visitas: 2, monto_usd: 60, metodo: 'zelle', inicio: new Date(Date.now() - 86400_000).toISOString(), vence: new Date(Date.now() + 40 * 86400_000).toISOString(), estado: 'activo' })
function mundo() {
  const compita = mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez' }); const cliente = mkCliente({ nombre: 'Carolina Pérez', email: 'caro@mail.test' })
  conPlan(cliente)
  const visita = mkVisita(cliente, compita, { estado: 'programada', fecha_programada: hoyVEstr(), hora_inicio_programada: '09:00', hora_fin_programada: '11:00', contacto_nombre: 'Rosa Linares', contacto_tel: '+58 414 555 0101', created_at: new Date(Date.now() - 3600_000).toISOString() })
  return { compita, cliente, visita }
}
const fila = () => db.rows('visitas')[0]
const botones = (m: any) => (m?.markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data)
const iniciar = () => webhook(tgText(CHAT, 'Iniciar visita'))
async function conLlegada() {
  const m = mundo(); await iniciar(); await webhook(tgFoto(CHAT))
  assert.ok(fila().llegada_en, 'quedó registrada la llegada')
  return m
}
const cronear = () => cronEscalera(cron('/api/cron/escalera-avisos'))
const tareas = () => db.rows('admin_flags').filter((f) => f.tipo === 'nadie_abre')

describe('llegada con foto obligatoria', () => {
  test('al tocar Iniciar el bot pide la foto y no avanza; un "Sí, iniciar" viejo tampoco inicia sin foto', async () => {
    mundo()
    await iniciar()
    assert.match(tgPara(CHAT).at(-1)!.text, /envía una foto/); assert.match(tgPara(CHAT).at(-1)!.text, /obligatoria/)
    assert.equal(fila().estado, 'programada')
    // Una confirmación que ya estaba pendiente (el compita tocó Iniciar antes de que la foto fuera obligatoria):
    db.seed('telegram_estados', { chat_id: `conf:${CHAT}`, pendiente_accion: `iniciar:${fila().id}`, pendiente_expira: new Date(Date.now() + 300_000).toISOString() })
    await webhook(tgText(CHAT, 'Sí, iniciar'))
    assert.equal(fila().estado, 'programada', 'sin foto no se inicia')
    assert.match(tgPara(CHAT).at(-1)!.text, /envía una foto/)
    // Y sin ninguna confirmación pendiente tampoco hace nada:
    await webhook(tgText(CHAT, 'Sí, iniciar')); assert.equal(fila().estado, 'programada')
  })

  test('con la foto: se copia al almacenamiento privado, queda la llegada, el cliente se entera y el compita elige qué pasó', async () => {
    const { cliente } = mundo(); await iniciar(); await webhook(tgFoto(CHAT))
    assert.ok(fila().llegada_en); assert.ok(fila().llegada_foto_id)
    const f = db.rows('fotos_privadas')[0]
    assert.equal(f.tipo, 'llegada'); assert.equal(f.visita_id, fila().id); assert.equal(f.id, fila().llegada_foto_id)
    assert.equal(db.objetos.size, 1, 'la foto quedó en nuestro almacenamiento')
    assert.ok(!JSON.stringify(db.rows('visitas')).includes('ABC'), 'no se guarda el file_id de Telegram')
    assert.ok(emailsA('caro@mail.test').some((e) => /llegó/.test(e.subject) && /dashboard/.test(e.html)))
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'llegada_registrada'))
    const m = tgPara(CHAT).at(-1)!; assert.match(m.text, /Llegada registrada/)
    assert.deepEqual(botones(m), ['Sí, iniciar', `nadie:${fila().id}`, 'seguro', 'reagendar_visita'])
  })

  test('una foto que NO se pidió no cuenta como llegada (tiene que ser después de tocar Iniciar)', async () => {
    mundo(); await webhook(tgFoto(CHAT))
    assert.equal(fila().llegada_en ?? null, null); assert.equal(db.rows('fotos_privadas').length, 0)
  })

  test('una foto que tarda más de 20 minutos en llegar ya no vale', async () => {
    mundo(); await iniciar()
    db.rows('telegram_estados').find((e) => e.chat_id === `lleg:${CHAT}`)!.pendiente_expira = hace(1)
    await webhook(tgFoto(CHAT))
    assert.equal(fila().llegada_en ?? null, null)
  })

  test('si no se pudo guardar la foto, se pide de nuevo y la visita no queda a medias', async () => {
    mundo(); await iniciar(); db.fail['storage:upload'] = 1
    await webhook(tgFoto(CHAT))
    assert.equal(fila().llegada_en ?? null, null); assert.match(tgPara(CHAT).at(-1)!.text, /Envíala de nuevo/)
    await webhook(tgFoto(CHAT)); assert.ok(fila().llegada_en, 'el segundo intento sí')
  })

  test('después de la foto: "Sí, iniciar" arranca la visita como siempre', async () => {
    mundo(); await iniciar(); await webhook(tgFoto(CHAT))
    await webhook(tgBtn(CHAT, 'Sí, iniciar')); await confirmarLlegada()
    assert.equal(fila().estado, 'en_curso')
  })

  test('el ajuste en 0 devuelve el flujo anterior (sin foto)', async () => {
    await setAjuste({ clave: 'llegada_foto_obligatoria', valor: 0, actor: 'admin:a' }); limpiarCacheAjustes()
    mundo(); await iniciar(); await webhook(tgText(CHAT, 'Sí, iniciar')); await confirmarLlegada()
    assert.equal(fila().estado, 'en_curso')
  })

  test('el cliente ve la foto de SU compita; nadie más; y sin guardarla en caché', async () => {
    const { cliente } = await conLlegada()
    como(cliente); const r = await fotoGet()
    assert.equal(r.status, 200); assert.match(r.headers.get('Cache-Control')!, /no-store/)
    const otro = mkCliente({ email: 'otro@mail.test' }); como(otro); assert.equal((await fotoGet()).status, 404)
    session.user = null; assert.equal((await fotoGet()).status, 401)
    como(cliente); const info = (await (await llegadaGet()).json()).data
    assert.equal(info.llego, true); assert.equal(info.tiene_foto, true); assert.equal(info.nadie_abre, false)
  })
})

describe('"Llegué y nadie abre"', () => {
  test('sin la foto de llegada no se puede reportar', async () => {
    const { visita } = mundo()
    await webhook(tgBtn(CHAT, `nadie:${visita.id}`))
    assert.equal(fila().sin_acceso_en ?? null, null); assert.match(tgPara(CHAT).at(-1)!.text, /Primero envía la foto/)
  })

  test('empieza la cuenta atrás: el cliente lo sabe al instante y el compita sabe qué esperar', async () => {
    const { cliente } = await conLlegada()
    await webhook(tgBtn(CHAT, `nadie:${fila().id}`))
    assert.ok(fila().sin_acceso_en)
    const c = emailsA('caro@mail.test').find((e) => /nadie abre/.test(e.subject))!
    assert.ok(c); assert.match(c.subject, /URGENTE/); assert.match(c.html, /30 minutos/)
    const m = tgPara(CHAT).at(-1)!; assert.match(m.text, /nadie abre/); assert.match(m.text, /5 y 15 minutos/); assert.match(m.text, /cobras el viaje/)
    como(cliente); const info = (await (await llegadaGet()).json()).data
    assert.equal(info.nadie_abre, true); assert.ok(info.minutos_restantes >= 29 && info.minutos_restantes <= 30)
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'llegada_sin_acceso'))
    const t0 = fila().sin_acceso_en; await webhook(tgBtn(CHAT, `nadie:${fila().id}`))
    assert.equal(fila().sin_acceso_en, t0, 'tocar de nuevo no reinicia el cronómetro')
  })

  // El cronómetro se prueba con el reloj controlado: la hora de inicio de la espera no se toca (de ella depende "una sola vez").
  const en = (min: number) => new Date(new Date(fila().sin_acceso_en).getTime() + min * 60_000)

  test('a los 5 minutos: tarea de contactar al contacto en el sitio; el teléfono va al administrador por Telegram y NO a la tarea', async () => {
    await conLlegada(); await webhook(tgBtn(CHAT, `nadie:${fila().id}`))
    await procesarNadieAbre(en(4)); assert.equal(tareas().length, 0, 'a los 4 minutos todavía no')
    await procesarNadieAbre(en(6)); await procesarNadieAbre(en(7))
    assert.equal(tareas().length, 1, 'una sola vez aunque el cron corra varias veces'); assert.equal(tareas()[0].prioridad, 1)
    assert.ok(!tareas()[0].nota.includes('555'), 'el teléfono no queda en la tarea')
    const aviso = avisosAdmin().find((m) => /Nadie abre/.test(m.text))!
    assert.match(aviso.text, /Rosa Linares/); assert.match(aviso.text, /\+58 414 555 0101/)
  })

  test('a los 15 minutos: segunda tarea (llamar al cliente); a los 30: el compita recibe el botón de cerrar, una sola vez', async () => {
    await conLlegada(); await webhook(tgBtn(CHAT, `nadie:${fila().id}`))
    await procesarNadieAbre(en(16))
    assert.equal(tareas().length, 2); assert.ok(tareas().some((t) => /segundo intento/.test(t.entidad_nombre)))
    assert.ok(!tgPara(CHAT).some((m) => /Ya pasaron 30/.test(m.text)))
    await procesarNadieAbre(en(31)); await procesarNadieAbre(en(32))
    const cierres = tgPara(CHAT).filter((m) => /Ya pasaron 30 minutos/.test(m.text))
    assert.equal(cierres.length, 1); assert.deepEqual(botones(cierres[0]), [`sinacceso:${fila().id}`])
    assert.equal(tareas().length, 2, 'no se duplican')
  })

  test('la escalera real (el cron) también corre estos pasos', async () => {
    await conLlegada(); await webhook(tgBtn(CHAT, `nadie:${fila().id}`))
    fila().sin_acceso_en = hace(31); const r = await cronear()
    const d = (await r.json()).data.nadieAbre; assert.equal(d.tareas, 2); assert.equal(d.cierres, 1)
  })

  test('el ajuste manda: con 20 minutos de espera, a los 21 ya se puede cerrar', async () => {
    await setAjuste({ clave: 'nadie_abre_espera_min', valor: 20, actor: 'admin:a' }); limpiarCacheAjustes()
    await conLlegada(); await webhook(tgBtn(CHAT, `nadie:${fila().id}`))
    await procesarNadieAbre(en(21))
    assert.ok(tgPara(CHAT).some((m) => /Ya pasaron 20 minutos/.test(m.text)))
  })

  test('"Ya abrí": el cliente detiene la cuenta atrás, el compita lo sabe y las tareas se resuelven', async () => {
    const { cliente } = await conLlegada(); await webhook(tgBtn(CHAT, `nadie:${fila().id}`))
    await procesarNadieAbre(en(6)); assert.equal(tareas().length, 1)
    como(cliente); const r = await llegadaPost(req('/api/visita/llegada', { json: { accion: 'ya_abro' } }))
    assert.equal(r.status, 200); assert.equal(fila().sin_acceso_en ?? null, null)
    assert.match(tgPara(CHAT).at(-1)!.text, /ya abren/); assert.ok(tareas().every((t) => t.resuelto))
    await cronear(); assert.equal(tareas().length, 1, 'ya no abre tareas nuevas')
    como(cliente); assert.equal((await llegadaPost(req('/api/visita/llegada', { json: { accion: 'ya_abro' } }))).status, 409, 'sin espera en curso no hay nada que detener')
  })

  test('otro cliente no puede detener la cuenta atrás', async () => {
    await conLlegada(); await webhook(tgBtn(CHAT, `nadie:${fila().id}`))
    como(mkCliente({ email: 'otro@mail.test' }))
    assert.equal((await llegadaPost(req('/api/visita/llegada', { json: { accion: 'ya_abro' } }))).status, 404)
    assert.ok(fila().sin_acceso_en)
  })
})

describe('cerrar la visita sin acceso', () => {
  test('antes de los 30 minutos no se puede cerrar; sin haber reportado nada tampoco', async () => {
    const { visita } = await conLlegada()
    await webhook(tgBtn(CHAT, `sinacceso:${visita.id}`)); assert.match(tgPara(CHAT).at(-1)!.text, /Primero reporta/)
    await webhook(tgBtn(CHAT, `nadie:${visita.id}`)); fila().sin_acceso_en = hace(10)
    await webhook(tgBtn(CHAT, `sinacceso:${visita.id}`))
    assert.match(tgPara(CHAT).at(-1)!.text, /faltan 2\d minutos/i); assert.equal(db.rows('visitas').length, 1)
  })

  test('a los 30 minutos: la visita se cierra, cuenta como usada, queda registrada y el cliente y el equipo lo saben', async () => {
    const { cliente, compita, visita } = await conLlegada()
    assert.equal((await cupoDelPlan(cliente.id))!.restantes, 1, 'la visita programada ya descuenta un crédito')
    await webhook(tgBtn(CHAT, `nadie:${visita.id}`)); fila().sin_acceso_en = hace(31); await cronear()
    await webhook(tgBtn(CHAT, `sinacceso:${visita.id}`))
    assert.equal(db.rows('visitas').length, 0, 'la visita ya no está activa')
    const c = db.rows('cancelaciones')[0]
    assert.equal(c.cancelado_por, 'sistema'); assert.equal(c.cuenta_como_usada, true); assert.match(c.motivo, /Sin acceso/); assert.equal(c.compita_id, compita.id)
    assert.equal((await cupoDelPlan(cliente.id))!.restantes, 1, 'SIGUE contando como usada: el crédito no vuelve')
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'visita_sin_acceso'))
    assert.ok(emailsA('caro@mail.test').some((e) => /nadie abrió/.test(e.subject) && /se cuenta como usada/.test(e.html)))
    assert.ok(avisosAdmin().some((m) => /Visita sin acceso/.test(m.text)))
    assert.match(tgPara(CHAT).at(-1)!.text, /Visita cerrada sin acceso/)
    assert.ok(tareas().every((t) => t.resuelto), 'las tareas se resuelven')
    const foto = db.rows('fotos_privadas')[0]; assert.ok(new Date(foto.borrar_en).getTime() > Date.now() + 80 * 86400_000, 'la foto se borra 90 días después del cierre')
  })

  test('si el equipo la justifica (había una causa), el crédito vuelve', async () => {
    const { cliente, visita } = await conLlegada()
    await webhook(tgBtn(CHAT, `nadie:${visita.id}`)); fila().sin_acceso_en = hace(31)
    await webhook(tgBtn(CHAT, `sinacceso:${visita.id}`))
    assert.equal((await cupoDelPlan(cliente.id))!.restantes, 1)
    await marcarJustificada({ id: db.rows('cancelaciones')[0].id, justificada: true, actor: 'admin:admin@compaz.test' })
    assert.equal((await cupoDelPlan(cliente.id))!.restantes, 2)
  })

  test('solo cierra el compita de esa visita', async () => {
    const { visita } = await conLlegada(); mkCompita({ telegram_chat_id: '9911' })
    await webhook(tgBtn(CHAT, `nadie:${visita.id}`)); fila().sin_acceso_en = hace(31)
    await webhook(tgBtn('9911', `sinacceso:${visita.id}`))
    assert.equal(db.rows('visitas').length, 1)
  })
})
