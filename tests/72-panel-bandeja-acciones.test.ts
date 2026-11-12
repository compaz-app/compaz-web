/* eslint-disable */
// Bandeja: cada tipo de tarea tiene su botón (confirmar pago, decidir sobre una cuenta en pausa, registrar la llamada) con sus permisos.
import { db, limpiar, req, session, mkCliente, mkCompita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { POST as solicitar } from '@/app/api/pago/solicitar/route'
import { POST as confirmarPago } from '@/app/api/admin/confirmar-pago/route'
import { cargarBandeja } from '@/lib/panel-bandeja'
import { confirmarPagoDeTarea } from '@/lib/panel-bandeja-acciones'
import { tipoDeAccion, textoCerrar, idReporteDeNota, OPCIONES_DECISION, OPCIONES_LLAMADA } from '@/lib/panel-bandeja-tipos'
import { DECISIONES_PAUSA } from '@/lib/pausas'
import { RESULTADOS_LLAMADA } from '@/lib/bloqueos-compita'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'
import type { Actor } from '@/lib/permisos'

beforeEach(limpiar)
const actor = (rol: 'admin' | 'colaborador', p: any = {}): Actor => ({ id: 'u1', correo: rol === 'admin' ? 'admin@compaz.test' : 'luis@compaz.test', rol, permisos: rol === 'admin' ? { ...TODOS } : { ...NINGUNO, ...p } })
const flag = (o: any) => db.seed('admin_flags', { entidad_tipo: 'cliente', entidad_id: 'x', entidad_nombre: 'Ana', nota: 'algo', reportado_por: 'sistema', resuelto: false, tipo: 'alerta', prioridad: 2, created_at: new Date().toISOString(), ...o }) as any
const pedirPago = async (c: any) => {
  session.user = { id: c.id, email: c.email, user_metadata: { nombre: c.nombre } } as any
  assert.equal((await solicitar(req('/api/pago/solicitar', { json: { tipo: 'plan', plan: 'quincenal', metodo: 'zelle' } }))).status, 200)
  return db.rows('solicitudes_pago').find((s) => s.usuario_id === c.id)!
}

describe('qué botón lleva cada tipo (lógica pura)', () => {
  test('pago, cuenta en pausa y reporte tienen acción propia; lo demás se cierra con su texto', () => {
    assert.equal(tipoDeAccion('pago_insistido'), 'pago'); assert.equal(tipoDeAccion('pago_escalado'), 'pago'); assert.equal(tipoDeAccion('cuenta_pausada'), 'decidir')
    assert.equal(tipoDeAccion('reporte_cliente'), 'llamada'); assert.equal(tipoDeAccion('emergencia'), 'cerrar'); assert.equal(tipoDeAccion(null), 'cerrar')
    assert.equal(textoCerrar('contacto_externo').texto, 'Marcar revisada'); assert.equal(textoCerrar('emergencia').texto, 'Marcar atendida'); assert.equal(textoCerrar(undefined).texto, 'Marcar atendida')
  })
  test('las opciones de la pantalla son exactamente las que acepta el servidor', () => {
    assert.deepEqual(OPCIONES_DECISION.map((o) => o.id).sort(), [...DECISIONES_PAUSA].sort()); assert.deepEqual(OPCIONES_LLAMADA.map((o) => o.id).sort(), [...RESULTADOS_LLAMADA].sort())
  })
  test('el id del reporte sale de la marca de la nota', () => { assert.equal(idReporteDeNota('Hola\n[reporte:123e4567-e89b-12d3-a456-426614174000]'), '123e4567-e89b-12d3-a456-426614174000'); assert.equal(idReporteDeNota('sin marca'), null) })
})

describe('la Bandeja calcula la acción con datos reales y permisos', () => {
  test('pago pendiente: botón de confirmar con permiso de pagos, bloqueado sin él, y si ya no está pendiente solo se cierra', async () => {
    const c = mkCliente({ nombre: 'Ana' } as any); const s = await pedirPago(c)
    flag({ entidad_id: c.id, tipo: 'pago_insistido' })
    const a = (await cargarBandeja(actor('admin')))[0].accion!; assert.equal(a.tipo, 'pago'); assert.equal((a as any).monto, Number(s.monto_usd))
    assert.equal((await cargarBandeja(actor('colaborador', { atender: true })))[0].accion!.tipo, 'bloqueada')
    db.rows('solicitudes_pago')[0].estado = 'confirmado'
    assert.equal((await cargarBandeja(actor('admin')))[0].accion!.tipo, 'cerrar')
  })
  test('cuenta en pausa: decidir con permiso de cuentas; sin él, bloqueado; sin pausa activa, se cierra', async () => {
    const c = mkCliente({ nombre: 'Luz' } as any)
    db.seed('pausas_contacto', { rol: 'cliente', persona_id: c.id, activa: true })
    flag({ entidad_id: c.id, entidad_tipo: 'cliente', tipo: 'cuenta_pausada' })
    const a = (await cargarBandeja(actor('admin')))[0].accion! as any; assert.equal(a.tipo, 'decidir'); assert.equal(a.pausa.rol, 'cliente'); assert.equal(a.texto, 'Decidir sobre la cuenta')
    assert.equal((await cargarBandeja(actor('colaborador', { atender: true })))[0].accion!.tipo, 'bloqueada')
    db.rows('pausas_contacto')[0].activa = false
    assert.equal((await cargarBandeja(actor('admin')))[0].accion!.tipo, 'cerrar')
  })
  test('reporte de un compita: registrar la llamada con el reporte que dice su nota', async () => {
    const c = mkCompita({ nombre: 'Rosa' } as any), cli = mkCliente({ nombre: 'Ana' } as any)
    const rep = db.seed('reportes_compita', { compita_id: c.id, usuario_id: cli.id, motivo: 'pago', llamar: true, plazo_llamada: new Date(Date.now() + 3600_000).toISOString(), creado_en: new Date().toISOString() }) as any
    flag({ entidad_tipo: 'compita', entidad_id: c.id, tipo: 'reporte_cliente', nota: `Reporte\n[reporte:${rep.id}]` })
    const a = (await cargarBandeja(actor('colaborador', { atender: true })))[0].accion! as any
    assert.equal(a.tipo, 'llamada'); assert.equal(a.reporte.id, rep.id); assert.equal(a.reporte.cliente_nombre, 'Ana')
  })
  test('una emergencia solo se marca atendida', async () => { flag({ tipo: 'emergencia', entidad_tipo: 'compita' }); const a = (await cargarBandeja(actor('admin')))[0].accion! as any; assert.equal(a.tipo, 'cerrar'); assert.equal(a.texto, 'Marcar atendida') })
})

describe('confirmar el pago desde la Bandeja', () => {
  test('confirma el pago, cierra las tareas de pago de ese cliente y queda anotado', async () => {
    const c = mkCliente({ nombre: 'Ana', email: 'ana@mail.test' } as any); await pedirPago(c)
    const f1 = flag({ entidad_id: c.id, tipo: 'pago_insistido' }); flag({ entidad_id: c.id, tipo: 'pago_escalado' }); const otra = flag({ entidad_id: 'otro', tipo: 'emergencia' })
    const r = await confirmarPagoDeTarea(actor('admin'), f1.id); assert.equal(r.ok, true)
    assert.equal(db.rows('solicitudes_pago')[0].estado, 'confirmado'); assert.equal(db.rows('pagos_plan').length, 1)
    assert.equal(db.rows('admin_flags').filter((f) => f.resuelto).length, 2); assert.equal(db.rows('admin_flags').find((f) => f.id === otra.id)!.resuelto, false)
    assert.ok(db.rows('actividad_admin').some((a: any) => a.categoria === 'pago_confirmado_bandeja'))
    assert.equal((await confirmarPagoDeTarea(actor('admin'), f1.id)).ok, false)
  })
  test('sin el permiso de pagos no confirma nada', async () => {
    const c = mkCliente() as any; await pedirPago(c); const f = flag({ entidad_id: c.id, tipo: 'pago_insistido' })
    const r = await confirmarPagoDeTarea(actor('colaborador', { atender: true }), f.id); assert.equal((r as any).status, 403); assert.equal(db.rows('solicitudes_pago')[0].estado, 'pendiente')
  })
  test('el navegador no elige qué pago confirmar: una tarea que no es de pago no sirve', async () => {
    const c = mkCliente() as any; await pedirPago(c); const f = flag({ entidad_id: c.id, tipo: 'emergencia' })
    assert.equal((await confirmarPagoDeTarea(actor('admin'), f.id)).ok, false); assert.equal(db.rows('solicitudes_pago')[0].estado, 'pendiente')
  })
  test('la ruta exige sesión y el permiso de pagos', async () => {
    const c = mkCliente() as any; await pedirPago(c); const f = flag({ entidad_id: c.id, tipo: 'pago_insistido' })
    session.user = null as any; assert.equal((await confirmarPago(req('/api/admin/confirmar-pago', { method: 'POST', json: { flag_id: f.id } }))).status, 401)
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    assert.equal((await confirmarPago(req('/api/admin/confirmar-pago', { method: 'POST', json: { flag_id: "x' or 1=1" } }))).status, 400)
    assert.equal((await confirmarPago(req('/api/admin/confirmar-pago', { method: 'POST', json: { flag_id: f.id } }))).status, 200)
  })
})

describe('guardias de código', () => {
  test('los diálogos del navegador no importan código de servidor', () => {
    for (const f of ['components/panel/AccionTarea.tsx', 'components/panel/DialogoPanel.tsx', 'components/panel/Bandeja.tsx']) assert.doesNotMatch(readFileSync(f, 'utf8'), /supabase-server|lib\/panel-bandeja'|lib\/panel-bandeja-acciones|lib\/permisos'|lib\/pausas'|\.from\(/, f)
  })
})
