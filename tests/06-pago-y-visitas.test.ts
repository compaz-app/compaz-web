/* eslint-disable */
import { db, net, session, limpiar, req, tgText, tgBtn, tgFoto, ultimoTg, tgPara, emailsA, ahoraMas, hoyVEstr, mkCompita, mkCliente, mkSolicitud, mkVisita } from './harness'
import { beforeEach, test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { POST as pagoConfirmar } from '@/app/api/pago/confirmar/route'
import { GET as pagoInfo } from '@/app/api/pago/info/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { PUT as fechaPut } from '@/app/api/visita/fecha/route'
import { POST as reagendarCliente } from '@/app/api/visita/reagendar/route'
import { GET as fotoGet } from '@/app/api/foto/[id]/route'
import { POST as sendMessage } from '@/app/api/send-message/route'
import { POST as bloquearCompita } from '@/app/api/admin/bloquear-compita/route'
import { urlFotoFirmada } from '@/lib/links'

beforeEach(limpiar)
const NODE_ENV0 = process.env.NODE_ENV
afterEach(() => { (process.env as any).NODE_ENV = NODE_ENV0; delete process.env.PAGO_SIMULADO })

const comoCliente = (c: any) => { session.user = { id: c.id, email: c.email } }
const contratar = (cli: any, sol: any, plan = 'semanal') => { comoCliente(cli); return pagoConfirmar(req('/api/pago/confirmar', { json: { solicitud_id: sol.id, plan } })) }

describe('Pago / contratación (Stripe aún no contratado)', () => {
  const mundo = () => {
    const compita = mkCompita({ telegram_chat_id: '900' }); const cli = mkCliente({ email: 'cli@mail.test' })
    const sol = mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: ahoraMas(-60) })
    return { compita, cli, sol }
  }

  test('pago/info acepta solicitudes "aceptada" (antes solo "completada" → callejón sin salida)', async () => {
    const { cli, sol } = mundo(); comoCliente(cli)
    const r = await pagoInfo(req(`/api/pago/info?solicitud=${sol.id}`))
    assert.equal(r.status, 200)
    // otro usuario no puede verla
    comoCliente(mkCliente())
    assert.equal((await pagoInfo(req(`/api/pago/info?solicitud=${sol.id}`))).status, 401)
  })

  test('PRODUCCIÓN sin pasarela: NO contrata gratis; avisa al admin y la solicitud no cambia', async () => {
    (process.env as any).NODE_ENV = 'production'
    const { cli, sol } = mundo()
    const r = await contratar(cli, sol)
    assert.equal((await r.json()).data.pendiente, true)
    assert.equal(db.rows('solicitudes')[0].estado, 'aceptada')
    assert.equal(db.rows('visitas').length, 0)
    assert.ok(tgPara(999).some((m) => m.text.includes('pago pendiente')))
  })

  test('modo simulado/dev: contrata, crea visita, ASIGNA la compita al cliente y avisa a la compita', async () => {
    const { cli, compita, sol } = mundo()
    const r = await contratar(cli, sol)
    assert.equal(r.status, 200)
    assert.equal(db.rows('solicitudes')[0].estado, 'contratada')
    assert.equal(db.rows('visitas')[0].estado, 'pre_visita')
    assert.equal(db.rows('usuarios').find((u) => u.id === cli.id)!.compita_id, compita.id, 'sin esto el bot no encuentra al cliente')
    assert.ok(db.rows('mensajes').some((m) => m.contenido === 'plan:semanal'))
    assert.match(ultimoTg(900)!.text, /Te contrataron/)
    assert.equal(emailsA('cli@mail.test').length, 1)
  })

  test('doble clic no crea dos visitas', async () => {
    const { cli, sol } = mundo()
    await Promise.all([contratar(cli, sol), contratar(cli, sol)])
    assert.equal(db.rows('visitas').length, 1)
  })

  test('si falla la creación de la visita, la solicitud vuelve a su estado (no queda "contratada" a medias)', async () => {
    const { cli, sol } = mundo()
    db.fail['visitas:insert'] = 1
    const r = await contratar(cli, sol)
    assert.equal(r.status, 500)
    assert.equal(db.rows('solicitudes')[0].estado, 'aceptada')
  })

  test('cliente bloqueado, compita no verificada, solicitud ajena, plan inválido', async () => {
    const { cli, compita, sol } = mundo()
    assert.equal((await contratar(cli, sol, 'gratis')).status, 400)
    comoCliente(mkCliente()); assert.equal((await pagoConfirmar(req('/api/pago/confirmar', { json: { solicitud_id: sol.id, plan: 'carta' } }))).status, 401)
    compita.verificado = false; assert.equal((await contratar(cli, sol)).status, 409); compita.verificado = true
    db.rows('usuarios').find((u) => u.id === cli.id)!.plan = 'bloqueado'
    assert.equal((await contratar(cli, sol)).status, 403)
  })
})

describe('Ciclo de la visita (cliente ↔ compita)', () => {
  const mundo = (opts: { notas?: string } = {}) => {
    const compita = mkCompita({ telegram_chat_id: '910', nombre: 'Lucía' })
    const cli = mkCliente({ email: 'cli@mail.test', nombre: 'Carlos', familiar_nombre: 'Rosa', familiar_condicion: 'Parkinson & demencia', familiar_notas: opts.notas ?? 'Pastillas <8am, no sal' })
    cli.compita_id = compita.id
    const v = mkVisita(cli, compita, { estado: 'programada', fecha_programada: hoyVEstr(), hora_inicio_programada: '10:00', hora_fin_programada: '12:00' })
    return { compita, cli, v }
  }
  const iniciar = async () => { await webhook(tgText(910, '▶️ Iniciar visita')); await webhook(tgText(910, '✅ Sí, iniciar')) }

  test('iniciar: confirma, pasa a en_curso, avisa a la familia; HTML en notas del familiar NO rompe el mensaje', async () => {
    const { v } = mundo()
    await webhook(tgText(910, '▶️ Iniciar visita'))
    assert.match(ultimoTg(910)!.text, /¿Vas a empezar la visita con <b>Carlos/)
    await webhook(tgText(910, '✅ Sí, iniciar'))
    assert.equal(v.estado, 'en_curso')
    assert.match(tgPara(910).at(-1)!.text, /Visita iniciada/)
    assert.match(tgPara(910).at(-1)!.text, /&lt;8am/, 'el "<" del familiar llega escapado')
    assert.equal(emailsA('cli@mail.test').filter((e) => e.subject.includes('llegó')).length, 1)
    assert.ok(tgPara(999).some((m) => m.text.includes('Visita iniciada')))
  })

  test('doble toque en "Sí, iniciar": una sola visita en curso y un solo correo', async () => {
    const { v } = mundo()
    await webhook(tgText(910, '▶️ Iniciar visita'))
    await Promise.all([webhook(tgText(910, '✅ Sí, iniciar')), webhook(tgText(910, '✅ Sí, iniciar'))])
    assert.equal(db.rows('visitas').filter((x) => x.estado === 'en_curso').length, 1)
    assert.equal(emailsA('cli@mail.test').filter((e) => e.subject.includes('llegó')).length, 1)
    void v
  })

  test('visita pautada para mañana: no se puede iniciar hoy; ofrece reagendar', async () => {
    const { v } = mundo(); v.fecha_programada = hoyVEstr(1)
    await webhook(tgText(910, '▶️ Iniciar visita'))
    assert.match(ultimoTg(910)!.text, /Podrás iniciarla ese día/)
    assert.equal(db.rows('telegram_estados').filter((e) => e.chat_id.startsWith('conf:')).length, 0)
  })

  test('sin fecha confirmada no se puede iniciar (candado), ni siquiera por la vía de "confirmar"', async () => {
    const { v } = mundo(); v.fecha_programada = null; v.estado = 'pre_visita'
    await webhook(tgText(910, '▶️ Iniciar visita'))
    assert.match(ultimoTg(910)!.text, /fecha de la visita aún no está confirmada/)
    // forzar la confirmación igualmente
    db.seed('telegram_estados', { chat_id: 'conf:910', pendiente_accion: `iniciar:${v.id}`, pendiente_expira: ahoraMas(5) })
    await webhook(tgText(910, '✅ Sí, iniciar'))
    assert.notEqual(v.estado, 'en_curso')
  })

  test('CRUCE: compita con dos clientes → inicia el de HOY, no uno arbitrario', async () => {
    const { compita, v } = mundo(); v.fecha_programada = hoyVEstr(2) // este es de pasado mañana
    const otro = mkCliente({ email: 'otro@mail.test', nombre: 'Otro', compita_id: compita.id })
    const v2 = mkVisita(otro, compita, { estado: 'programada', fecha_programada: hoyVEstr(), hora_inicio_programada: '15:00', hora_fin_programada: '17:00' })
    await iniciar()
    assert.equal(v2.estado, 'en_curso'); assert.equal(v.estado, 'programada')
    assert.equal(emailsA('otro@mail.test').length, 1); assert.equal(emailsA('cli@mail.test').length, 0)
  })

  test('mensajes: se guardan, se limita el email a 1 cada 10 min, y si Resend falla el siguiente reintenta', async () => {
    const { v } = mundo(); await iniciar(); net.emails = []
    net.resendFail = true
    await webhook(tgText(910, 'Ya almorzó'))
    net.resendFail = false
    await webhook(tgText(910, 'Está contenta')); await webhook(tgText(910, 'Hizo su caminata'))
    assert.equal(db.rows('mensajes').filter((m) => m.origen === 'compita').length, 3)
    assert.equal(emailsA('cli@mail.test').filter((e) => e.subject.includes('te escribió')).length, 1)
    void v
  })

  test('FOTO: se guarda tg:<file_id>, el token del bot NUNCA aparece en BD ni correos; /api/foto autoriza bien', async () => {
    const { cli, v } = mundo(); await iniciar()
    await webhook(tgFoto(910, { caption: 'Su almuerzo' }))
    const foto = db.rows('mensajes').find((m) => m.tipo === 'foto')!
    assert.equal(foto.contenido, 'tg:ABC')
    assert.ok(db.rows('mensajes').some((m) => m.contenido === 'Su almuerzo'), 'la caption no se pierde')

    const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
    session.user = null
    assert.equal((await fotoGet(req(`/api/foto/${foto.id}`), ctx(foto.id))).status, 401)
    comoCliente(mkCliente()); assert.equal((await fotoGet(req(`/api/foto/${foto.id}`), ctx(foto.id))).status, 401, 'otro cliente no ve la foto')
    comoCliente(cli)
    const ok = await fotoGet(req(`/api/foto/${foto.id}`), ctx(foto.id))
    assert.equal(ok.status, 200); assert.equal(ok.headers.get('content-type'), 'image/jpeg')
    assert.equal((await ok.arrayBuffer()).byteLength, 7)
    session.user = { id: 'admin-id', email: 'admin@compaz.test' }
    assert.equal((await fotoGet(req(`/api/foto/${foto.id}`), ctx(foto.id))).status, 200)
    // enlace firmado (emails) sin sesión
    session.user = null
    const firmada = new URL(urlFotoFirmada('https://micompaz.test', foto.id))
    assert.equal((await fotoGet(req(firmada.pathname + firmada.search), ctx(foto.id))).status, 200)
    assert.equal((await fotoGet(req(`/api/foto/${foto.id}?e=1&s=${firmada.searchParams.get('s')}`), ctx(foto.id))).status, 401)

    // El token del bot no se filtra en ningún lado
    const todo = JSON.stringify([db.rows('mensajes'), net.emails, net.tg])
    assert.ok(!todo.includes('TESTBOTTOKEN'), 'el token del bot no debe aparecer en datos persistidos ni notificaciones')

    // terminar → correo resumen con foto firmada
    await webhook(tgText(910, '🔴 Terminar visita')); await webhook(tgText(910, '✅ Sí, terminar'))
    const resumen = emailsA('cli@mail.test').find((e) => e.subject.startsWith('Resumen'))!
    assert.match(resumen.html, /\/api\/foto\/[0-9a-f-]+\?e=\d+&amp;s=[0-9a-f]+/)
    assert.ok(!JSON.stringify(net.emails).includes('TESTBOTTOKEN'))
    void v
  })

  test('terminar: doble toque → un correo, +1 visita, cuestionario; luego cuestionario completo y sin duplicar', async () => {
    const { compita, v } = mundo(); await iniciar(); net.emails = []
    await webhook(tgText(910, '🔴 Terminar visita'))
    await Promise.all([webhook(tgText(910, '✅ Sí, terminar')), webhook(tgText(910, '✅ Sí, terminar'))])
    assert.equal(v.estado, 'terminada')
    assert.equal(emailsA('cli@mail.test').filter((e) => e.subject.startsWith('Resumen')).length, 1)
    assert.equal(compita.visitas_realizadas, 1)
    assert.match(tgPara(910).at(-1)!.text, /1 de 4/)
    for (const r of ['rr:5', 'rr:4', 'rr:N', 'rr:3']) await webhook(tgBtn(910, r))
    await Promise.all([webhook(tgBtn(910, 'rn:skip')), webhook(tgBtn(910, 'rn:skip'))])
    assert.equal(db.rows('reportes_visita').length, 1)
    const rep = db.rows('reportes_visita')[0]
    assert.deepEqual([rep.animo, rep.fisico, rep.participacion, rep.entorno], [5, 4, null, 3])
    assert.equal(emailsA('cli@mail.test').filter((e) => e.subject.startsWith('Actualización')).length, 1)
  })

  test('CRUCE: iniciar OTRA visita con el cuestionario pendiente NO borra el cuestionario', async () => {
    const { compita, v } = mundo(); await iniciar()
    await webhook(tgText(910, '🔴 Terminar visita')); await webhook(tgText(910, '✅ Sí, terminar'))
    await webhook(tgBtn(910, 'rr:5'))
    const otro = mkCliente({ email: 'otro@mail.test', compita_id: compita.id })
    mkVisita(otro, compita, { estado: 'programada', fecha_programada: hoyVEstr(), hora_inicio_programada: '15:00', hora_fin_programada: '17:00' })
    await webhook(tgText(910, '▶️ Iniciar visita'))
    const principal = db.rows('telegram_estados').find((e) => e.chat_id === '910')!
    assert.match(principal.pendiente_accion, /^reporte:/, 'el cuestionario sigue vivo')
    await webhook(tgText(910, '✅ Sí, iniciar'))
    await webhook(tgBtn(910, 'rr:4'))
    assert.match(db.rows('telegram_estados').find((e) => e.chat_id === '910')!.pendiente_accion, /^reporte:.*:2:5,4$/)
    void v
  })

  test('EMERGENCIA: respaldo por email si Telegram al admin falla; si todo falla, la compita lo SABE', async () => {
    mundo(); await iniciar(); net.tg = []; net.emails = []
    net.tgFailFor.add('999')
    await webhook(tgBtn(910, 'emergencia'))
    assert.ok(net.emails.some((e) => e.subject.includes('EMERGENCIA')), 'se avisó al admin por email')
    assert.match(ultimoTg(910)!.text, /Alerta enviada/)
    net.emails = []; net.resendFail = true
    await webhook(tgBtn(910, 'emergencia'))
    assert.match(ultimoTg(910)!.text, /No pudimos avisar al equipo/)
  })

  test('EMERGENCIA con datos del familiar con HTML: el aviso al admin llega', async () => {
    mundo(); await iniciar(); net.tg = []
    await webhook(tgBtn(910, 'emergencia'))
    const aviso = tgPara(999).find((m) => m.text.includes('EMERGENCIA'))!
    assert.ok(aviso, 'el admin recibió la emergencia aunque la condición tenga "&"')
    assert.match(aviso.text, /Parkinson &amp; demencia/)
  })

  test('reagendar desde Telegram: pasa a pre_visita, avisa al cliente; si el correo falla, la compita lo sabe', async () => {
    const { v } = mundo()
    await webhook(tgBtn(910, 'reagendar_visita'))
    assert.equal(v.estado, 'pre_visita'); assert.equal(v.fecha_programada, null)
    assert.equal(emailsA('cli@mail.test').length, 1)
    v.estado = 'programada'; v.fecha_programada = hoyVEstr(); net.resendFail = true
    await webhook(tgBtn(910, 'reagendar_visita'))
    assert.match(ultimoTg(910)!.text, /no pudimos enviar el correo/)
  })

  test('bloquear compita en pleno servicio: se desvincula de Telegram y de sus clientes; ya no puede operar', async () => {
    const { compita, cli, v } = mundo()
    session.user = { id: 'a', email: 'admin@compaz.test' }
    const r = await bloquearCompita(req('/api/admin/bloquear-compita', { json: { compita_id: compita.id, bloquear: true } }))
    assert.equal(r.status, 200)
    assert.equal(compita.telegram_chat_id, null); assert.equal(compita.estado, 'bloqueado')
    assert.equal(db.rows('usuarios').find((u) => u.id === cli.id)!.compita_id, null)
    await webhook(tgText(910, '▶️ Iniciar visita'))
    assert.match(ultimoTg(910)!.text, /no está vinculada|Comenzar/i)
    assert.equal(v.estado, 'programada')
  })
})

describe('Fecha de la visita (cliente)', () => {
  const mundo = () => { const compita = mkCompita({ telegram_chat_id: '920' }); const cli = mkCliente({ email: 'cli@mail.test' }); const v = mkVisita(cli, compita); comoCliente(cli); return { compita, cli, v } }
  const put = (v: any, f: string, i = '10:00', fin = '12:00') => fechaPut(req('/api/visita/fecha', { method: 'PUT', json: { visita_id: v.id, fecha_programada: f, hora_inicio: i, hora_fin: fin } }))

  test('validaciones: pasado, 30 feb, hora 99:99, fin<inicio, hoy a hora pasada, muy lejana', async () => {
    const { v } = mundo()
    for (const [f, i, fin, n] of [
      [hoyVEstr(-1), '10:00', '12:00', 'ayer'], ['2027-02-30', '10:00', '12:00', '30 de febrero'], [hoyVEstr(2), '99:99', '12:00', 'hora inválida'],
      [hoyVEstr(2), '12:00', '10:00', 'fin antes que inicio'], [hoyVEstr(400), '10:00', '12:00', 'muy lejana'],
    ] as const) assert.equal((await put(v, f, i, fin)).status, 400, n)
    assert.equal(v.estado, 'pre_visita')
  })

  test('OK: queda programada y se avisa a compita y cliente; otro cliente no puede modificarla', async () => {
    const { v } = mundo()
    assert.equal((await put(v, hoyVEstr(2))).status, 200)
    assert.equal(v.estado, 'programada')
    assert.match(ultimoTg(920)!.text, /Visita confirmada/)
    comoCliente(mkCliente()); assert.equal((await put(v, hoyVEstr(3))).status, 403)
  })

  test('no permite solapar dos visitas de la misma compita', async () => {
    const { compita, v } = mundo()
    await put(v, hoyVEstr(2), '10:00', '12:00')
    const cli2 = mkCliente(); const v2 = mkVisita(cli2, compita); comoCliente(cli2)
    assert.equal((await put(v2, hoyVEstr(2), '11:00', '13:00')).status, 400)
    assert.equal((await put(v2, hoyVEstr(2), '12:00', '14:00')).status, 200)
  })

  test('el cliente reagenda: vuelve a pre_visita; no se puede reagendar una visita en curso', async () => {
    const { v } = mundo(); await put(v, hoyVEstr(2))
    assert.equal((await reagendarCliente(req('/api/visita/reagendar', { json: { visita_id: v.id } }))).status, 200)
    assert.equal(v.estado, 'pre_visita')
    v.estado = 'en_curso'
    assert.equal((await reagendarCliente(req('/api/visita/reagendar', { json: { visita_id: v.id } }))).status, 400)
  })

  test('chat del cliente: el mensaje llega a la compita y su HTML va escapado', async () => {
    const { compita, cli, v } = mundo(); v.estado = 'en_curso'
    cli.nombre = 'Ana <b>x'
    const r = await sendMessage(req('/api/send-message', { json: { contenido: 'Hola <i>Lucía</i> & gracias' } }))
    assert.equal(r.status, 200)
    assert.match(ultimoTg(920)!.text, /Hola &lt;i&gt;Lucía&lt;\/i&gt; &amp; gracias/)
    void compita
  })
})
