/* eslint-disable */
// «Insistir al compita» en una tarea de «cita sin confirmar»: le llega la cita pendiente, no un aviso cualquiera; si la cita ya se resolvió no se manda nada y no se cuenta como reenvío.
import { db, net, limpiar, req, session, mkCliente, mkCompita, mkSolicitud, mkVisita, conDireccion, tgPara } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { PUT as fecha } from '@/app/api/visita/fecha/route'
import { escalarCitasSinRespuesta } from '@/lib/citas'
import { insistirDeTarea, MIN_ENTRE_REENVIOS_MIN } from '@/lib/insistir-aviso'
import { cargarBandeja } from '@/lib/panel-bandeja'
import { limpiarCacheAjustes } from '@/lib/ajustes'
import { TODOS } from '@/lib/permisos-catalogo'

const CHAT = '9962'
beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const dia = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10)
const admin = { id: 'a1', correo: 'admin@compaz.test', rol: 'admin' as const, permisos: { ...TODOS } }

async function conTarea(telegram: string | null = CHAT) {
  const cliente = mkCliente({ nombre: 'Carolina Rojas', email: 'caro@mail.test' }) as any, compita = mkCompita({ telegram_chat_id: telegram, nombre: 'María Pérez' } as any) as any
  const v = mkVisita(cliente, compita, { estado: 'pre_visita', fecha_programada: null }) as any; conDireccion(v.id)
  session.user = { id: cliente.id, email: cliente.email } as any
  assert.equal((await fecha(req('/api/visita/fecha', { method: 'PUT', json: { visita_id: v.id, fecha_programada: dia(5), hora_inicio: '09:00', hora_fin: '10:00' } }))).status, 200)
  await escalarCitasSinRespuesta(new Date(Date.now() + 25 * 3600_000))
  const tarea = db.rows('admin_flags').find((f: any) => f.tipo === 'cita_sin_confirmar')!; assert.ok(tarea)
  net.tg.length = 0
  return { cliente, compita, v, tarea }
}
const accion = async (id: string) => (await cargarBandeja(admin as any)).find((t) => t.id === id)!.accion!

describe('insistir con una cita pendiente', () => {
  test('le llega al compita LA CITA con sus botones, aunque tenga otros avisos sin atender (antes se reenviaba cualquier otro)', async () => {
    const { compita, cliente, v, tarea } = await conTarea()
    const sol = mkSolicitud(cliente, compita, { estado: 'pendiente' }) as any
    db.seed('avisos', { destinatario_tipo: 'compita', destinatario_id: compita.id, canal: 'telegram', plantilla: 'solicitud_nueva', variables: { solicitudId: sol.id }, entidad: 'solicitud', entidad_id: sol.id, estado: 'enviado', accion_en: null, clave_unica: 'x', programado_para: new Date().toISOString() })
    const r = await insistirDeTarea(admin as any, tarea.id); assert.deepEqual(r, { ok: true, reenvios: 1 })
    const m = tgPara(CHAT); assert.equal(m.length, 1); assert.match(m[0].text, /Falta tu respuesta/); assert.match(m[0].text, /El cliente espera que confirmes/)
    const botones = m[0].markup.inline_keyboard.flat().map((b: any) => b.callback_data); assert.ok(botones.some((b: string) => b.startsWith(`cita:ok:${v.id}:`)) && botones.some((b: string) => b.startsWith(`cita:no:${v.id}:`)))
    assert.equal(db.rows('eventos').filter((e: any) => e.tipo === 'cita_insistida').length, 1); assert.equal(db.rows('admin_flags').find((f: any) => f.id === tarea.id)!.resuelto, false, 'la tarea sigue abierta hasta que la cita se resuelva')
  })
  test('hay tope: uno cada 30 minutos y 3 por propuesta, y la Bandeja muestra el botón apagado con la razón visible', async () => {
    const { tarea } = await conTarea()
    assert.equal((await accion(tarea.id)).tipo, 'insistir')
    await insistirDeTarea(admin as any, tarea.id)
    const otra = await insistirDeTarea(admin as any, tarea.id); assert.equal(otra.ok, false); assert.equal((otra as any).status, 429); assert.equal(tgPara(CHAT).length, 1, 'no se mandó otra vez')
    const a = await accion(tarea.id) as any; assert.equal(a.tipo, 'bloqueada'); assert.ok(a.resumen && a.resumen.length < 160)
    for (const e of db.rows('eventos')) if (e.tipo === 'cita_insistida') e.creado_en = new Date(Date.now() - (MIN_ENTRE_REENVIOS_MIN + 1) * 60_000).toISOString()
    assert.equal((await insistirDeTarea(admin as any, tarea.id)).ok, true)
  })
  test('si la cita ya se dio (la visita se programó o terminó), no se manda nada y la tarea se cierra', async () => {
    const { v, tarea } = await conTarea()
    Object.assign(db.rows('visitas').find((x: any) => x.id === v.id)!, { estado: 'terminada', cita_propuesta_en: null })
    assert.equal((await accion(tarea.id)).tipo, 'cerrar', 'la Bandeja ya no ofrece insistir')
    const r = await insistirDeTarea(admin as any, tarea.id); assert.equal(r.ok, false); assert.equal((r as any).status, 409); assert.match((r as any).error, /ya se resolvió/)
    assert.equal(tgPara(CHAT).length, 0); assert.equal(db.rows('admin_flags').find((f: any) => f.id === tarea.id)!.resuelto, true); assert.equal(db.rows('eventos').filter((e: any) => e.tipo === 'cita_insistida').length, 0)
  })
  test('si el cliente cambió la propuesta, la tarea vieja no manda nada del pasado', async () => {
    const { v, tarea } = await conTarea(); db.rows('visitas').find((x: any) => x.id === v.id)!.cita_propuesta_en = new Date(Date.now() + 3 * 3600_000).toISOString()
    assert.equal((await insistirDeTarea(admin as any, tarea.id) as any).status, 409); assert.equal(tgPara(CHAT).length, 0)
  })
  test('sin Telegram vinculado lo dice claro y no cuenta como reenvío', async () => {
    const { compita, tarea } = await conTarea(); compita.telegram_chat_id = null
    const r = await insistirDeTarea(admin as any, tarea.id); assert.equal(r.ok, false); assert.match((r as any).error, /no tiene Telegram/); assert.equal(db.rows('eventos').filter((e: any) => e.tipo === 'cita_insistida').length, 0)
  })
  test('si Telegram falla lo dice y no cuenta como reenvío', async () => {
    const { tarea } = await conTarea(); net.tgFailFor.add(CHAT)
    const r = await insistirDeTarea(admin as any, tarea.id); assert.equal(r.ok, false); assert.equal((r as any).status, 502); assert.equal(db.rows('eventos').filter((e: any) => e.tipo === 'cita_insistida').length, 0)
  })
})

describe('un aviso que ya no aplica no cuenta como reenviado (el bug general)', () => {
  test('insistir con una solicitud que el compita ya respondió: no sale nada, la tarea se cierra y se dice claro', async () => {
    const compita = mkCompita({ telegram_chat_id: '9963', nombre: 'Lucía' } as any) as any, cliente = mkCliente({}) as any, sol = mkSolicitud(cliente, compita, { estado: 'pendiente' }) as any
    const raiz = db.seed('avisos', { destinatario_tipo: 'compita', destinatario_id: compita.id, canal: 'telegram', plantilla: 'solicitud_nueva', variables: { solicitudId: sol.id }, entidad: 'solicitud', entidad_id: sol.id, estado: 'enviado', accion_en: null, clave_unica: 'raiz:1', programado_para: new Date().toISOString() })
    const tarea = db.seed('admin_flags', { entidad_tipo: 'compita', entidad_id: compita.id, entidad_nombre: 'Lucía', nota: 'x', resuelto: false, tipo: null, reportado_por: 'escalera automática', prioridad: 2, created_at: new Date().toISOString() })
    sol.estado = 'rechazada'; net.tg.length = 0
    const r = await insistirDeTarea(admin as any, tarea.id); assert.equal(r.ok, false); assert.equal((r as any).status, 409); assert.match((r as any).error, /ya se resolvió/)
    assert.equal(tgPara('9963').length, 0); assert.equal(db.rows('admin_flags').find((f: any) => f.id === tarea.id)!.resuelto, true)
  })
})
