/* eslint-disable */
// Lo que la ayuda automática le aporta al sistema: cada consulta deja un dato, los atascos y los estados no previstos
// abren tareas, "Tengo una duda" responde solo y escala a una persona tras N intentos, y el compita puede recordarle al
// cliente lo que espera (con límites). Nada revela contactos de nadie.
import { db, limpiar, session, req, mkCliente, mkCompita, mkVisita, mkSolicitud, tgText, tgBtn, tgPara, emailsA, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { GET as dudasGet } from '@/app/api/admin/dudas/route'
import { limpiarCacheAjustes, setAjuste } from '@/lib/ajustes'
import { TECLADO_SIN_VISITA, TECLADO_INICIO, TECLADO_DURANTE_VISITA } from '@/lib/telegram'

const CHAT = '9961'
const HORAS = [{ dia: 'lunes', inicio: '09:00', fin: '10:00' }]
beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const ve = (min: number) => { const t = new Date(Date.now() + min * 60_000 - 4 * 3600_000).toISOString(); return { fecha: t.slice(0, 10), hora: t.slice(11, 16) } }
function mundo() {
  const compita = mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez', email: 'maria@mail.test', horarios_disponibles: HORAS })
  const cliente = mkCliente({ nombre: 'Carolina Pérez', email: 'caro@mail.test', telefono: '+58 412 000 0000' })
  return { compita, cliente }
}
const visita = (compita: any, cliente: any, min: number, o: any = {}) => { const i = ve(min); return mkVisita(cliente, compita, { estado: 'programada', fecha_programada: i.fecha, hora_inicio_programada: i.hora, hora_fin_programada: ve(min + 120).hora, direccion: 'Av. Miranda, Edif. Sol', indicaciones: 'Avisar en conserjería', quien_abre: 'Rosa, la vecina', contacto_nombre: 'Rosa Linares', contacto_tel: '+58 414 555 0101', ...o }) }
const qmt = () => webhook(tgText(CHAT, '❓ ¿Qué me toca?'))
const btn = (data: string) => webhook(tgBtn(CHAT, data))
const ultimo = () => tgPara(CHAT).at(-1)!
const botones = (m: any) => (m?.markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data)
const tareas = (tipo: string) => db.rows('admin_flags').filter((f) => f.tipo === tipo)
const eventos = (tipo: string) => db.rows('eventos').filter((e) => e.tipo === tipo)

describe('cada consulta de "¿Qué me toca?" deja un dato (sin el texto)', () => {
  test('queda el evento con el código de la situación', async () => {
    const { compita, cliente } = mundo(); mkSolicitud(cliente, compita, { tipo: 'directa', slots_propuestos: [] })
    await qmt()
    const e = eventos('que_me_toca')[0]; assert.equal(e.entidad, 'compita'); assert.equal(e.actor, `compita:${compita.id}`)
    assert.equal(e.datos.firma, 'solicitud_por_responder'); assert.equal(e.datos.no_reconocido, false)
    assert.ok(!JSON.stringify(e).includes('Carolina'), 'nunca el texto ni nombres')
  })
  test('sin nada pendiente también se registra', async () => { mundo(); await qmt(); assert.equal(eventos('que_me_toca')[0].datos.firma, 'nada') })
})

describe('estado que nadie previó: se descubre solo', () => {
  test('abre UNA tarea para el admin y lo avisa; repetir no duplica', async () => {
    const { compita, cliente } = mundo(); mkVisita(cliente, compita, { estado: 'programada', fecha_programada: null })
    await qmt(); await qmt()
    assert.equal(tareas('estado_no_reconocido').length, 1); assert.match(tareas('estado_no_reconocido')[0].nota, /no supo explicar/)
    assert.ok(avisosAdmin().some((m) => /Estado no reconocido/.test(m.text)))
    assert.equal(eventos('que_me_toca')[0].datos.no_reconocido, true)
  })
})

describe('el compita atascado', () => {
  const pendiente = () => { const { compita, cliente } = mundo(); mkSolicitud(cliente, compita, { tipo: 'directa', slots_propuestos: [] }); return compita }
  test('preguntar lo mismo 2 veces seguidas abre "Duda sin resolver" y se lo dice; una tercera no duplica', async () => {
    pendiente(); await qmt()
    assert.equal(tareas('duda_sin_resolver').length, 0, 'la primera vez no')
    await qmt()
    assert.equal(tareas('duda_sin_resolver').length, 1); assert.match(tareas('duda_sin_resolver')[0].nota, /no llames/i)
    assert.match(ultimo().text, /sigues con esto/); assert.ok(avisosAdmin().some((m) => /parece atascado/.test(m.text)))
    await qmt(); assert.equal(tareas('duda_sin_resolver').length, 1)
  })
  test('si pasó más de 30 minutos entre una y otra no cuenta como atasco', async () => {
    pendiente(); await qmt(); eventos('que_me_toca')[0].creado_en = hace(45); await qmt()
    assert.equal(tareas('duda_sin_resolver').length, 0)
  })
  test('esperar no es atascarse: preguntar varias veces durante una espera normal no abre nada', async () => {
    const { compita, cliente } = mundo(); visita(compita, cliente, -10, { llegada_en: hace(12), sin_acceso_en: hace(7) })
    for (let i = 0; i < 4; i++) await qmt()
    assert.equal(tareas('duda_sin_resolver').length, 0)
  })
  test('estar en la visita (en curso) tampoco', async () => {
    const { compita, cliente } = mundo(); visita(compita, cliente, -30, { estado: 'en_curso', fecha_programada: ve(60).fecha, hora_fin_programada: ve(60).hora })
    for (let i = 0; i < 4; i++) await qmt(); assert.equal(tareas('duda_sin_resolver').length, 0)
  })
  test('el ajuste manda: con 3 intentos hace falta la tercera', async () => {
    await setAjuste({ clave: 'ayuda_intentos', valor: 3, actor: 'admin:a' }); limpiarCacheAjustes()
    pendiente(); await qmt(); await qmt(); assert.equal(tareas('duda_sin_resolver').length, 0); await qmt(); assert.equal(tareas('duda_sin_resolver').length, 1)
  })
})

describe('"Tengo una duda"', () => {
  test('el botón está en todos los teclados y en el aviso de la dirección; abre el menú de 6 opciones', async () => {
    for (const t of [TECLADO_SIN_VISITA, TECLADO_INICIO, TECLADO_DURANTE_VISITA]) assert.ok(t.keyboard.flat().some((b: any) => b.text === '🙋 Tengo una duda'))
    mundo(); await webhook(tgText(CHAT, '🙋 Tengo una duda'))
    assert.deepEqual(botones(ultimo()), ['d:dir', 'd:ent', 'd:hora', 'd:mal', 'd:otra', 'xp']); await btn('duda'); assert.equal(botones(ultimo()).length, 6)
  })
  test('"No encuentro la dirección" con dirección: se la vuelve a dar (sin teléfono) y pregunta si se resolvió', async () => {
    const { compita, cliente } = mundo(); visita(compita, cliente, 90); await btn('d:dir')
    const m = ultimo(); assert.match(m.text, /Av\. Miranda/); assert.ok(!m.text.includes('555'), 'el teléfono nunca')
    assert.deepEqual(botones(m).filter((b: string) => b.startsWith('dr:')), ['dr:ok:dir', 'dr:no:dir'])
    assert.equal(eventos('duda_compita')[0].datos.tipo, 'dir')
  })
  test('"No encuentro la dirección" SIN dirección: le recuerda al cliente por correo y se lo dice', async () => {
    const { compita, cliente } = mundo(); visita(compita, cliente, 90, { direccion: null }); await btn('d:dir')
    assert.match(ultimo().text, /todavía no registró la dirección/); assert.match(ultimo().text, /Ya se lo recordamos/)
    assert.ok(emailsA('caro@mail.test').some((e) => /Falta la dirección/.test(e.subject)))
  })
  test('"No sé cómo entrar": le muestra lo que dejó el cliente (sin teléfono) y cómo avisar si nadie abre', async () => {
    const { compita, cliente } = mundo(); visita(compita, cliente, 90); await btn('d:ent')
    const t = ultimo().text; assert.match(t, /conserjería/); assert.match(t, /Rosa, la vecina/); assert.match(t, /Rosa Linares/); assert.ok(!t.includes('555')); assert.match(t, /nadie abre/)
  })
  test('"Necesito cambiar la hora": explica y da el botón de reagendar', async () => {
    const { compita, cliente } = mundo(); visita(compita, cliente, 90); await btn('d:hora')
    assert.match(ultimo().text, /24 horas/); assert.ok(botones(ultimo()).includes('reagendar_visita'))
  })
  test('"Algo no está bien": NO espera intentos: tarea urgente al instante y los botones de seguridad', async () => {
    const { compita, cliente } = mundo(); visita(compita, cliente, 90); await btn('d:mal')
    const t = tareas('duda_sin_resolver'); assert.equal(t.length, 1); assert.equal(t[0].prioridad, 1)
    assert.deepEqual(botones(ultimo()), ['seguro', 'emergencia']); assert.ok(avisosAdmin().some((m) => /URGENTE/.test(m.text)))
  })
  test('"Otra duda": pide el texto y el siguiente mensaje pasa a una persona, sin teléfonos ni correos', async () => {
    mundo(); await btn('d:otra'); assert.match(ultimo().text, /un solo mensaje/)
    await webhook(tgText(CHAT, 'No sé qué hacer, llámame al +58 414 555 0101 o a maria@mail.test'))
    const t = tareas('duda_sin_resolver'); assert.equal(t.length, 1)
    assert.ok(!t[0].nota.includes('555') && !t[0].nota.includes('maria@'), 'se censuran los contactos'); assert.match(t[0].nota, /Otra duda/)
    assert.match(ultimo().text, /Recibimos tu duda/)
    await webhook(tgText(CHAT, 'otro mensaje cualquiera')); assert.equal(tareas('duda_sin_resolver').length, 1, 'solo se captura el primero')
  })
  test('sin visita próxima, responde algo útil en vez de callar', async () => { mundo(); await btn('d:dir'); assert.match(ultimo().text, /No encontré una visita/) })
  test('"Se resolvió" queda registrado; "Sigo con la duda": 1.º otro intento, 2.º pasa a una persona, y no se duplica', async () => {
    const { compita, cliente } = mundo(); visita(compita, cliente, 90, { direccion: null })
    await btn('d:dir'); await btn('dr:ok:dir'); assert.equal(eventos('duda_compita').at(-1)!.datos.resultado, 'resuelta'); assert.equal(tareas('duda_sin_resolver').length, 0)
    await btn('dr:no:dir'); assert.equal(tareas('duda_sin_resolver').length, 0, 'el primer "no" aún no escala'); assert.deepEqual(botones(ultimo()), ['d:dir', 'd:ent', 'd:hora', 'd:mal', 'd:otra', 'xp'])
    await btn('dr:no:dir'); assert.equal(tareas('duda_sin_resolver').length, 1); assert.match(ultimo().text, /persona del equipo/); assert.match(ultimo().text, /por Telegram/)
    await btn('dr:no:dir'); assert.equal(tareas('duda_sin_resolver').length, 1)
  })
  test('el ajuste manda y cada tipo cuenta aparte', async () => {
    await setAjuste({ clave: 'ayuda_intentos', valor: 1, actor: 'admin:a' }); limpiarCacheAjustes()
    const { compita, cliente } = mundo(); visita(compita, cliente, 90); await btn('d:hora'); await btn('dr:no:hora')
    assert.equal(tareas('duda_sin_resolver').length, 1)
    await btn('d:ent'); await btn('dr:no:ent'); assert.equal(tareas('duda_sin_resolver').length, 2, 'otro tipo, otra tarea')
  })
})

describe('"Recordarle al cliente"', () => {
  const rc = (tipo: string, id: string) => btn(`rc:${tipo}:${id}`)
  const correos = (re: RegExp) => emailsA('caro@mail.test').filter((e) => re.test(e.subject))
  test('hora: manda un correo desde Compaz con el enlace correcto y SIN datos del compita', async () => {
    const { compita, cliente } = mundo(); const s = mkSolicitud(cliente, compita, { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [] })
    assert.match(botones((await (async () => { await qmt(); return ultimo() })())).join(','), new RegExp(`rc:hora:${s.id}`))
    await rc('hora', s.id)
    const c = correos(/elijas la hora/)[0]; assert.ok(c); assert.match(c.html, new RegExp(`/solicitar/hora\\?solicitud=${s.id}`))
    assert.ok(!c.html.includes('maria@mail.test') && !/\+58|555/.test(c.html), 'ni el correo ni el teléfono del compita')
    assert.match(ultimo().text, /Le recordamos al cliente/); assert.equal(eventos('recordatorio_al_cliente')[0].actor, `compita:${compita.id}`)
  })
  test('pago: con el enlace al pago y la advertencia antifraude', async () => {
    const { compita, cliente } = mundo(); const s = mkSolicitud(cliente, compita, { estado: 'aceptada', tipo: 'directa', slots_propuestos: [] }); await rc('pago', s.id)
    const c = correos(/Falta tu pago/)[0]; assert.ok(c); assert.match(c.html, /\/pago\?solicitud=/); assert.match(c.html, /Cuidado con los fraudes/); assert.ok(!/maria@mail\.test|\+58|555/.test(c.html))
  })
  test('dirección y fecha de la visita', async () => {
    const { compita, cliente } = mundo(); const v = visita(compita, cliente, 90, { direccion: null }); await rc('dir', v.id)
    assert.equal(correos(/Falta la dirección/).length, 1)
    v.estado = 'pre_visita'; v.fecha_programada = null; await rc('fecha', v.id); assert.equal(correos(/Falta registrar la fecha/).length, 1)
    for (const e of emailsA('caro@mail.test')) assert.ok(!/maria@mail\.test|\+58|555/.test(e.html), `el correo "${e.subject}" no debe traer datos del compita`)
  })
  test('con límite: dentro de 12 horas no repite, después sí, y hay un máximo de 3', async () => {
    const { compita, cliente } = mundo(); const s = mkSolicitud(cliente, compita, { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [] })
    await rc('hora', s.id); await rc('hora', s.id)
    assert.equal(correos(/elijas la hora/).length, 1); assert.match(ultimo().text, /Ya se lo recordaste hace un momento/); assert.match(ultimo().text, /no llenarle el correo/); assert.match(ultimo().text, /Podrás volver a hacerlo/)
    for (const n of [1, 2]) { eventos('recordatorio_al_cliente').at(-1)!.creado_en = hace(13 * 60); await rc('hora', s.id); assert.equal(correos(/elijas la hora/).length, 1 + n) }
    eventos('recordatorio_al_cliente').at(-1)!.creado_en = hace(13 * 60); await rc('hora', s.id)
    assert.equal(correos(/elijas la hora/).length, 3, 'tope de 3'); assert.match(ultimo().text, /Ya llegaste al máximo de recordatorios \(3\)/); assert.match(ultimo().text, /El equipo se encarga desde aquí/)
    // y es verdad: el equipo recibe UNA tarea, aunque el compita vuelva a tocar el botón
    await rc('hora', s.id); assert.equal(db.rows('admin_flags').filter((f) => f.tipo === 'cliente_sin_respuesta').length, 1)
  })
  test('si el cliente ya hizo lo que faltaba, o no es de ese compita, no se manda nada', async () => {
    const { compita, cliente } = mundo(); const s = mkSolicitud(cliente, compita, { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [], slot_confirmado: new Date(Date.now() + 3600_000).toISOString() })
    await rc('hora', s.id); assert.equal(correos(/elijas la hora/).length, 0); assert.match(ultimo().text, /ya no está pendiente/)
    const otra = mkCompita({ telegram_chat_id: '9971' }); const s2 = mkSolicitud(cliente, otra, { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [] })
    await rc('hora', s2.id); assert.equal(correos(/elijas la hora/).length, 0)
  })
})

describe('lo que ve el admin', () => {
  test('el resumen cuenta dudas por tipo, resultados, situaciones y recordatorios; con permiso y sin sesión 401', async () => {
    const { compita, cliente } = mundo(); visita(compita, cliente, 90, { direccion: null }); mkSolicitud(cliente, compita, { tipo: 'directa', slots_propuestos: [] })
    await btn('d:dir'); await btn('dr:no:dir'); await btn('dr:no:dir'); await qmt()
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    const r = await dudasGet(req('/api/admin/dudas?dias=7')); assert.equal(r.status, 200); const d = (await r.json()).data
    assert.equal(d.dudas.dir.total, 1); assert.equal(d.dudas.dir.no_resueltas, 2); assert.ok(d.dudas.dir.escaladas >= 1)
    assert.ok(d.topSituaciones.some((x: any) => x.firma.includes('solicitud_por_responder'))); assert.equal(d.recordatorios.dir, 1); assert.ok(d.tareasAbiertas >= 1)
    session.user = null; assert.equal((await dudasGet(req('/api/admin/dudas'))).status, 401)
  })
})
