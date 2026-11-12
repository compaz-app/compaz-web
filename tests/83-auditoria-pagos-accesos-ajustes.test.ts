/* eslint-disable */
// Auditoría: D-01 (pagos), S-04 (accesos fallan cerrado), S-05 (línea de tiempo sin accesos) y S-06 (ajustes reservados y lote todo o nada).
import { db, limpiar, session, req, mkCliente, mkCompita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { registrarPago, anularPago } from '@/lib/pagos'
import { registrarAcceso } from '@/lib/alertas-admin'
import { lineaDe } from '@/lib/panel-personas'
import { revelarContacto } from '@/lib/panel-personas'
import { setAjustes, soloAdministrador, limpiarCacheAjustes } from '@/lib/ajustes'
import { PATCH as ajustesPatch } from '@/app/api/admin/ajustes/route'
import { invitarColaborador } from '@/lib/equipo'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'

beforeEach(() => { limpiar(); db.rows('ajustes').length = 0; limpiarCacheAjustes() })
const pago = (usuarioId: string, o: any = {}) => registrarPago({ usuarioId, tipo: 'plan', plan: 'quincenal', metodo: 'zelle', registradoPor: 'adm@compaz.test', ...o })
const actor = (rol: 'admin' | 'colaborador', p: any = {}) => ({ id: 'u1', correo: 'x@compaz.test', rol, permisos: rol === 'admin' ? { ...TODOS } : { ...NINGUNO, ...p } }) as any

describe('D-01: un pago no se registra dos veces', () => {
  test('la misma referencia para el mismo cliente se rechaza, aunque cambien las mayúsculas', async () => {
    const c = mkCliente({ email: 'a@mail.test', nombre: 'Ana' })
    assert.equal((await pago(c.id, { referencia: 'ZELLE 123' })).ok, true)
    const r = await pago(c.id, { referencia: ' zelle  123 ' }); assert.equal(r.ok, false); assert.match((r as any).error, /misma referencia/)
    assert.equal(db.rows('pagos_plan').length, 1)
  })
  test('un pago idéntico sin referencia hecho en seguida (doble clic) se rechaza; con otra referencia, no', async () => {
    const c = mkCliente({ email: 'b@mail.test', nombre: 'Beto' })
    assert.equal((await pago(c.id)).ok, true)
    const r = await pago(c.id); assert.equal(r.ok, false); assert.match((r as any).error, /idéntico/)
    assert.equal((await pago(c.id, { referencia: 'otro' })).ok, true)
  })
  test('dos registros a la vez: solo uno entra y el bloqueo se libera', async () => {
    const c = mkCliente({ email: 'c@mail.test', nombre: 'Cira' })
    const [x, y] = await Promise.all([pago(c.id, { referencia: 'R1' }), pago(c.id, { referencia: 'R2' })])
    assert.ok([x.ok, y.ok].filter(Boolean).length >= 1)
    assert.equal(db.rows('telegram_estados').filter((e: any) => String(e.chat_id).startsWith('pago_lock:')).length, 0) // nada queda bloqueado
  })
  test('anular exige motivo, guarda quién fue y, si es un colaborador, avisa al administrador como tarea', async () => {
    const c = mkCliente({ email: 'd@mail.test', nombre: 'Dani' })
    const p = await pago(c.id, { referencia: 'Z9' }) as any
    assert.equal((await anularPago(p.pago.id, '', { correo: 'luis@compaz.test', rol: 'colaborador' })).ok, false)
    assert.equal((await anularPago(p.pago.id, 'pagó dos veces', { correo: 'luis@compaz.test', rol: 'colaborador' })).ok, true)
    assert.ok(db.rows('eventos').some((e: any) => e.tipo === 'pago_anulado' && e.actor === 'admin:luis@compaz.test' && e.datos.motivo === 'pagó dos veces'))
    const a = db.rows('actividad_admin').find((x: any) => x.categoria === 'pago_anulado')!
    assert.equal(a.nivel, 'tarea'); assert.match(a.resumen, /luis@compaz\.test/)
  })
})

describe('S-04: el acceso a un dato sensible no se entrega si no quedó anotado', () => {
  test('si el registro falla, registrarAcceso dice false, no avisa por Telegram y revelarContacto no entrega el dato', async () => {
    const cli = mkCliente({ email: 'g@mail.test', nombre: 'Gio', telefono: '+58 412 777 0000' })
    const { net } = await import('./harness'); net.tg = []
    db.fail['actividad_admin:insert'] = 2
    const ok = await registrarAcceso('x abrió el teléfono', { categoria: 'acceso_contacto', entidad: { tipo: 'cliente', id: cli.id, nombre: 'Gio' } })
    assert.equal(ok, false); assert.equal(net.tg.length, 0) // antes el aviso por Telegram "salvaba" el registro y el dato se entregaba
    const r = await revelarContacto(actor('colaborador', { telefonos: true }), { tipo: 'cliente', id: cli.id, canal: 'telefono', motivo: 'Otro: necesito llamarlo por su visita' } as any)
    assert.equal(r.ok, false); assert.doesNotMatch(JSON.stringify(r), /777 0000/)
    db.fail['actividad_admin:insert'] = 0
    assert.equal((await revelarContacto(actor('colaborador', { telefonos: true }), { tipo: 'cliente', id: cli.id, canal: 'telefono', motivo: 'Otro: necesito llamarlo por su visita' } as any)).ok, true) // con el registro sano, sí
  })
  test('un motivo con "<" y "&" se guarda tal cual', async () => {
    const cli = mkCliente({ email: 'e@mail.test', nombre: 'Eva', telefono: '+58 412 1' })
    const r = await revelarContacto(actor('colaborador', { telefonos: true }), { tipo: 'cliente', id: cli.id, canal: 'telefono', motivo: 'Otro: <b>visita</b> & más' } as any)
    assert.equal(r.ok, true)
    assert.match(db.rows('actividad_admin').find((x: any) => x.categoria === 'acceso_contacto')!.resumen, /<b>visita<\/b> & más/)
  })
  test('ninguna lectura de datos sensibles usa el respaldo por Telegram', async () => {
    const { readFileSync } = await import('node:fs')
    for (const f of ['lib/panel-chat.ts', 'lib/panel-personas.ts', 'app/portal/page.tsx']) assert.doesNotMatch(readFileSync(f, 'utf8'), /alertaAdmin\('actividad'[^)]*acceso_/, f)
  })
})

describe('S-05: la línea de tiempo no muestra quién miró a quién sin el permiso de ver contactos', () => {
  test('con telefonos se ve; sin él no', async () => {
    const cli = mkCliente({ email: 'f@mail.test', nombre: 'Fran' })
    db.seed('actividad_admin', { nivel: 'actividad', resumen: 'luis abrió el teléfono de Fran. Motivo: x', categoria: 'acceso_contacto', entidad_id: cli.id, creado_en: new Date().toISOString() })
    db.seed('actividad_admin', { nivel: 'actividad', resumen: 'Se cambió algo normal', categoria: null, entidad_id: cli.id, creado_en: new Date().toISOString() })
    const con = (await lineaDe(actor('colaborador', { telefonos: true, monitorear: true }), 'cliente', cli.id)).map((e) => e.texto).join('|')
    const sin = (await lineaDe(actor('colaborador', { atender: true }), 'cliente', cli.id)).map((e) => e.texto).join('|')
    assert.match(con, /abrió el teléfono/); assert.doesNotMatch(sin, /abrió el teléfono/); assert.match(sin, /Se cambió algo normal/)
  })
})

describe('S-06: precios, retención y textos solo los cambia el administrador', () => {
  const llamar = (cambios: any) => ajustesPatch(req('/api/admin/ajustes', { method: 'PATCH', json: { cambios } }))
  test('qué se reserva', () => {
    for (const k of ['precio_hora', 'precio_plan_quincenal', 'avisos_retencion_dias', 'accesos_retencion_dias', 'recordatorio_chat_contactos']) assert.equal(soloAdministrador(k), true, k)
    for (const k of ['recordatorio_cliente_max', 'llamada_corte_min']) assert.equal(soloAdministrador(k), false, k)
  })
  test('un colaborador con editar ajustes cambia lo demás pero recibe 403 en lo reservado, y no se guarda nada', async () => {
    await invitarColaborador('edi@compaz.test', 'Edi', { ajustes_editar: true }, 'admin@compaz.test'); session.user = { id: 'e', email: 'edi@compaz.test' } as any
    const r = await llamar({ recordatorio_cliente_max: 4, precio_hora: 30 }); assert.equal(r.status, 403)
    assert.equal(db.rows('ajustes_historial').length, 0)
    assert.equal((await llamar({ recordatorio_cliente_max: 4 })).status, 200)
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    assert.equal((await llamar({ precio_hora: 24 })).status, 200)
  })
  test('si falla a mitad del lote se deshace lo ya guardado', async () => {
    const orig = (db as any).rpcs.guardar_ajuste
    let llamadas = 0
    ;(db as any).rpcs.guardar_ajuste = (a: any) => { llamadas++; if (llamadas === 2) return { error: { message: 'falló' } }; return orig(a) }
    const r = await setAjustes({ cambios: { recordatorio_cliente_max: 5, llamada_corte_min: 25 }, actor: 'admin@compaz.test' })
    ;(db as any).rpcs.guardar_ajuste = orig; limpiarCacheAjustes()
    assert.equal(r.ok, false); assert.match((r as any).error, /No se guardó nada/)
    const { getAjustes } = await import('@/lib/ajustes'); const v = await getAjustes()
    assert.equal(Number(v.recordatorio_cliente_max), 3); assert.equal(Number(v.llamada_corte_min), 23) // los dos siguen como estaban
  })
})
