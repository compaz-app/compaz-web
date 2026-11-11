/* eslint-disable */
// El admin NO es un centro de ruido. Tres niveles: lo informativo solo queda en el registro de actividad; lo que hay que
// hacer va a la bandeja (sin Telegram); solo lo urgente suena, con un tope por hora (y la seguridad de personas nunca se suprime).
// El colaborador trabaja desde el panel: ve la bandeja y la actividad con los datos recortados por su permiso.
import { db, net, limpiar, req, session, mkCliente, mkCompita, mkVisita, mkSolicitud, tgText, tgBtn, hoyVEstr, confirmarLlegada } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { POST as solicitar } from '@/app/api/solicitudes/route'
import { POST as limpieza } from '@/app/api/cron/limpieza/route'
import { cron } from './harness'
import { GET as actividadGet } from '@/app/api/admin/actividad/route'
import { GET as flagsGet, PATCH as flagsPatch } from '@/app/api/admin/flags/route'
import { alertaAdmin } from '@/lib/alertas-admin'
import { limpiarCacheAjustes, setAjuste } from '@/lib/ajustes'

beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const telegramAlAdmin = () => net.tg.filter((m) => m.chat === '999')
const act = (nivel?: string) => db.rows('actividad_admin').filter((r) => !nivel || r.nivel === nivel)
const tareas = () => db.rows('admin_flags')
const colab = (correo: string, permisos: Record<string, unknown>) => db.seed('equipo', { correo, nombre: correo.split('@')[0], permisos, activo: true, creado_por: 'admin@compaz.test' })
const como = (correo: string) => { session.user = { id: 'u-' + correo, email: correo } }
const CHAT = '9931'

describe('lo informativo NO suena', () => {
  test('una visita completa (iniciar y terminar) no manda ni un Telegram al admin, pero queda todo registrado', async () => {
    const compita = mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez' }); const cliente = mkCliente({ nombre: 'Carolina Pérez', email: 'caro@mail.test' })
    mkVisita(cliente, compita, { estado: 'programada', fecha_programada: hoyVEstr(), hora_inicio_programada: '09:00', hora_fin_programada: '11:00' })
    await webhook(tgText(CHAT, '▶️ Iniciar visita')); await webhook(tgText(CHAT, '✅ Sí, iniciar')); await confirmarLlegada()
    await webhook(tgText(CHAT, '🔴 Terminar visita')); await webhook(tgText(CHAT, '✅ Sí, terminar'))
    assert.equal(telegramAlAdmin().length, 0, 'nada suena por eventos normales')
    const textos = act('actividad').map((r) => r.resumen)
    assert.ok(textos.some((t) => /Visita iniciada/.test(t))); assert.ok(textos.some((t) => /Visita terminada/.test(t)))
    assert.equal(tareas().length, 0, 'y tampoco son tareas')
  })

  test('muchos eventos normales seguidos: el admin sigue sin recibir nada', async () => {
    for (let i = 0; i < 30; i++) await alertaAdmin('actividad', `✅ <b>Visita terminada</b>\n\nCompita ${i}`, { categoria: 'prueba' })
    assert.equal(telegramAlAdmin().length, 0); assert.equal(act('actividad').length, 30)
  })

  test('el registro guarda texto plano (sin etiquetas HTML)', async () => {
    await alertaAdmin('actividad', '✅ <b>Visita</b> &amp; <i>otra</i>')
    assert.equal(act()[0].resumen, '✅ Visita & otra')
  })
})

describe('lo que hay que hacer va a la bandeja, sin Telegram', () => {
  test('una solicitud a un compita sin Telegram: queda una tarea agrupada por compita, no un mensaje', async () => {
    const compita = mkCompita({ telegram_chat_id: null, nombre: 'María Pérez', email: 'm@mail.test' }); const cliente = mkCliente({ nombre: 'Carolina', email: 'caro@mail.test' })
    session.user = { id: cliente.id, email: cliente.email }
    await solicitar(req('/api/solicitudes', { json: { compita_id: compita.id, tipo: 'directa', que: 'Compañía y conversación', lugar_privado: false } }))
    assert.equal(telegramAlAdmin().length, 0)
    assert.equal(tareas().length, 1); assert.equal(tareas()[0].resuelto, false); assert.equal(act('tarea').length, 1)
  })

  test('la misma tarea no se duplica mientras siga abierta; resuelta, vuelve a poder abrirse', async () => {
    const e = { tipo: 'compita' as const, id: 'c-1', nombre: 'María' }
    await alertaAdmin('tarea', '⚠️ No se pudo enviar el aviso', { entidad: e, categoria: 'x' }); await alertaAdmin('tarea', '⚠️ No se pudo enviar el aviso', { entidad: e, categoria: 'x' })
    assert.equal(tareas().length, 1); assert.equal(act('tarea').length, 2, 'cada vez queda en el registro')
    tareas()[0].resuelto = true
    await alertaAdmin('tarea', '⚠️ No se pudo enviar el aviso', { entidad: e, categoria: 'x' })
    assert.equal(tareas().length, 2)
  })

  test('las tareas del mismo compita se agrupan por su entidad', async () => {
    const e = { tipo: 'compita' as const, id: 'c-9', nombre: 'Rosa' }
    await alertaAdmin('tarea', 'Primera cosa', { entidad: e }); await alertaAdmin('tarea', 'Segunda cosa', { entidad: e })
    assert.deepEqual([...new Set(tareas().map((t) => t.entidad_id))], ['c-9'])
  })
})

describe('solo lo urgente suena, con tope', () => {
  test('una urgencia: Telegram al dueño, tarea de prioridad 1 y registro', async () => {
    await alertaAdmin('urgente', '🚨 <b>Algo grave</b>', { categoria: 'x' })
    assert.equal(telegramAlAdmin().length, 1); assert.equal(tareas()[0].prioridad, 1); assert.equal(act('urgente').length, 1)
  })

  test('una emergencia real (botón del compita) suena y su tarea no se duplica', async () => {
    const compita = mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez' }); const cliente = mkCliente({ nombre: 'Carolina', email: 'c@mail.test' })
    mkVisita(cliente, compita, { estado: 'en_curso' })
    await webhook(tgText(CHAT, '🚨 Emergencia'))
    assert.ok(telegramAlAdmin().some((m) => /EMERGENCIA/.test(m.text))); assert.equal(tareas().filter((t) => /EMERGENCIA/.test(t.entidad_nombre)).length, 1)
  })

  test('pasado el tope por hora, el resto se resume en UN solo mensaje que remite a la bandeja; todo queda registrado', async () => {
    await setAjuste({ clave: 'timbre_max_hora', valor: 3, actor: 'admin:a' }); limpiarCacheAjustes()
    for (let i = 0; i < 12; i++) await alertaAdmin('urgente', `🔴 Urgencia número ${i}`, { categoria: 'x', entidad: { tipo: 'compita', id: `c-${i}`, nombre: `C${i}` } })
    const t = telegramAlAdmin()
    assert.ok(t.length <= 3 + 1, `como máximo 3 + el resumen (hubo ${t.length})`); assert.equal(t.filter((m) => /varias urgencias/.test(m.text)).length, 1)
    assert.match(t.find((m) => /varias urgencias/.test(m.text))!.text, /bandeja/)
    assert.equal(act('urgente').length, 12); assert.equal(tareas().length, 12, 'ninguna se pierde: están en la bandeja')
  })

  test('la seguridad de personas NUNCA se suprime por el tope', async () => {
    await setAjuste({ clave: 'timbre_max_hora', valor: 1, actor: 'admin:a' }); limpiarCacheAjustes()
    for (let i = 0; i < 6; i++) await alertaAdmin('urgente', `🚨 Emergencia ${i}`, { critica: true, sinTarea: true })
    assert.equal(telegramAlAdmin().length, 6)
  })

  test('si el registro falla, el aviso NO se pierde: sale por Telegram como antes', async () => {
    db.fail['actividad_admin:insert'] = 1
    await alertaAdmin('actividad', 'ℹ️ Algo que no debe perderse')
    assert.ok(telegramAlAdmin().some((m) => /no debe perderse/.test(m.text)))
  })

  test('una alerta nunca lanza aunque la base falle', async () => {
    db.fail['actividad_admin:insert'] = 1; net.tgFailAll = true
    assert.equal(await alertaAdmin('urgente', 'x').catch(() => 'lanzó'), false)
  })
})

describe('el colaborador trabaja desde el panel', () => {
  const sembrar = async () => {
    await alertaAdmin('tarea', '⚠️ Falta la dirección de Carolina (caro@mail.com) tel +58 414 555 0101', { categoria: 'dir', entidad: { tipo: 'compita', id: 'c-1', nombre: 'María' } })
    await alertaAdmin('actividad', '▶️ Visita iniciada\nCliente: Carolina (caro@mail.com)', { categoria: 'v' })
    await alertaAdmin('urgente', '🚪 Nadie abre', { categoria: 'n', entidad: { tipo: 'visita', id: 'v-1', nombre: 'María / Carolina' } })
  }

  test('con permiso de atender ve la bandeja SIN teléfonos ni correos, y el administrador sí los ve', async () => {
    await sembrar(); colab('c@x.test', { atender: true })
    como('c@x.test'); const r = await flagsGet(req('/api/admin/flags')); assert.equal(r.status, 200)
    const filas = (await r.json()).data; const notas = filas.map((f: any) => `${f.nota} ${f.entidad_nombre}`).join(' ')  // solo los textos: un id o una hora al azar podía traer "555"
    assert.ok(!/caro@mail|555/.test(notas), 'el colaborador no ve contactos'); assert.match(notas, /Falta la dirección/)
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    assert.match(JSON.stringify((await (await flagsGet(req('/api/admin/flags'))).json()).data), /caro@mail\.com/)
  })

  test('con el permiso de teléfonos sí los ve', async () => {
    await sembrar(); colab('t@x.test', { atender: true, telefonos: true }); como('t@x.test')
    assert.match(JSON.stringify((await (await flagsGet(req('/api/admin/flags'))).json()).data), /555/)
  })

  test('puede resolver una tarea y queda anotado QUIÉN la resolvió', async () => {
    await sembrar(); colab('c@x.test', { atender: true }); como('c@x.test')
    const id = tareas()[0].id
    const r = await flagsPatch(req('/api/admin/flags', { method: 'PATCH', json: { flag_id: id } })); assert.equal(r.status, 200)
    assert.equal(tareas().find((t) => t.id === id)!.resuelto, true)
    assert.ok(act('actividad').some((a) => /Tarea resuelta por c@x\.test/.test(a.resumen)))
  })

  test('sin el permiso de atender: 403 en la bandeja y en resolver', async () => {
    await sembrar(); colab('m@x.test', { monitorear: true }); como('m@x.test')
    assert.equal((await flagsGet(req('/api/admin/flags'))).status, 403)
    assert.equal((await flagsPatch(req('/api/admin/flags', { method: 'PATCH', json: { flag_id: tareas()[0].id } }))).status, 403)
  })

  test('la actividad: con monitorear se ve recortada; sin sesión 401; sin permiso 403; los filtros funcionan', async () => {
    await sembrar(); colab('m@x.test', { monitorear: true }); colab('s@x.test', { atender: true }); como('m@x.test')
    const todo = (await (await actividadGet(req('/api/admin/actividad?dias=2'))).json()).data
    assert.equal(todo.total, 3); assert.ok(!/caro@mail|555/.test(todo.filas.map((f: any) => f.resumen).join(' ')))  // solo los textos: un id o una hora al azar podía traer "555" y fallar sin motivo
    const urg = (await (await actividadGet(req('/api/admin/actividad?nivel=urgente'))).json()).data; assert.equal(urg.total, 1); assert.match(urg.filas[0].resumen, /Nadie abre/)
    const q = (await (await actividadGet(req('/api/admin/actividad?q=iniciada'))).json()).data; assert.equal(q.total, 1)
    como('s@x.test'); assert.equal((await actividadGet(req('/api/admin/actividad'))).status, 403)
    session.user = null; assert.equal((await actividadGet(req('/api/admin/actividad'))).status, 401)
  })

  test('el administrador ve todo sin recortar; lo viejo queda fuera del rango pedido', async () => {
    await sembrar(); db.rows('actividad_admin')[1].creado_en = new Date(Date.now() - 5 * 86400_000).toISOString()
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    assert.equal((await (await actividadGet(req('/api/admin/actividad?dias=2'))).json()).data.total, 2)
    const d = (await (await actividadGet(req('/api/admin/actividad?dias=7'))).json()).data; assert.equal(d.total, 3); assert.match(JSON.stringify(d.filas), /caro@mail\.com/)
  })

  test('paginación', async () => {
    for (let i = 0; i < 120; i++) await alertaAdmin('actividad', `Evento ${i}`)
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    const p0 = (await (await actividadGet(req('/api/admin/actividad?pagina=0'))).json()).data; const p2 = (await (await actividadGet(req('/api/admin/actividad?pagina=2'))).json()).data
    assert.equal(p0.filas.length, 50); assert.equal(p0.total, 120); assert.equal(p2.filas.length, 20)
  })
})

describe('el registro no crece sin límite', () => {
  test('la limpieza diaria borra la actividad de más de 90 días y conserva lo reciente', async () => {
    await alertaAdmin('actividad', 'Reciente'); await alertaAdmin('actividad', 'Vieja')
    db.rows('actividad_admin')[1].creado_en = new Date(Date.now() - 100 * 86400_000).toISOString()
    const r = await limpieza(cron('/api/cron/limpieza')); assert.equal(r.status, 200)
    assert.deepEqual(db.rows('actividad_admin').map((x) => x.resumen), ['Reciente'])
  })
})
