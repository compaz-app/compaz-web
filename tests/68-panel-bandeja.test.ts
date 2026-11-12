/* eslint-disable */
// Panel nuevo: esqueleto (secciones, permisos, "ver como") y Bandeja (orden, filtros, recorte de contactos).
import { db, limpiar, mkCliente } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { seccionesVisibles, seccionActiva, actorComo, puedeEntrarAlPanel, hrefSeccion, esSeccionPanel } from '@/lib/panel-secciones'
import { ordenarTareas, tiposConConteo, filtrarPorTipo, cuantasMostrar, limpiarNota, etiquetaDeTipo, type TareaBandeja } from '@/lib/panel-bandeja-tipos'
import { cargarBandeja } from '@/lib/panel-bandeja'
import { TODOS, NINGUNO, PERMISOS_BASE } from '@/lib/permisos-catalogo'
import type { Actor } from '@/lib/permisos'

beforeEach(limpiar)
const admin = { rol: 'admin' as const, permisos: { ...TODOS } }
const colab = (p: Partial<typeof TODOS> = {}) => ({ rol: 'colaborador' as const, permisos: { ...NINGUNO, ...p } })
const tarea = (o: Partial<TareaBandeja> = {}): TareaBandeja => ({ id: Math.random().toString(36).slice(2), entidad_tipo: 'cliente', entidad_id: 'c1', entidad_nombre: 'Ana', nota: 'x', reportado_por: 'sistema', created_at: '2026-11-10T10:00:00Z', tipo: null, prioridad: 2, ...o })

describe('secciones y permisos', () => {
  test('el administrador ve todo; un colaborador solo lo que su permiso abre', () => {
    assert.equal(seccionesVisibles(admin).length, 5)
    assert.deepEqual(seccionesVisibles(colab({ atender: true })).map((s) => s.id), ['bandeja', 'mas'])
    assert.deepEqual(seccionesVisibles(colab({ monitorear: true })).map((s) => s.id), ['seguimiento', 'personas', 'visitas', 'mas'])
  })
  test('sin monitorear ni atender no se entra al panel', () => {
    assert.equal(puedeEntrarAlPanel(colab({ pagos: true })), false)
    assert.equal(puedeEntrarAlPanel(colab({ atender: true })), true)
    assert.equal(puedeEntrarAlPanel(admin), true)
  })
  test('una sección sin permiso o inventada cae en la primera visible', () => {
    assert.equal(seccionActiva(colab({ monitorear: true }), 'bandeja'), 'seguimiento')
    assert.equal(seccionActiva(admin, '../../etc'), 'bandeja')
    assert.equal(seccionActiva(admin, 'visitas'), 'visitas')
    assert.equal(esSeccionPanel('mas'), true)
  })
  test('"ver como" solo funciona para el administrador y usa los permisos base', () => {
    const v = actorComo(admin, 'colaborador')
    assert.equal(v.comoColaborador, true); assert.equal(v.actor.rol, 'colaborador'); assert.deepEqual(v.actor.permisos, { ...NINGUNO, ...PERMISOS_BASE })
    const c = actorComo(colab({ atender: true, pagos: true }), 'colaborador')
    assert.equal(c.comoColaborador, false); assert.equal(c.actor.permisos.pagos, true)
    assert.equal(actorComo(admin, undefined).comoColaborador, false)
  })
  test('los enlaces conservan "ver como"', () => {
    assert.equal(hrefSeccion('visitas', true), '/panel?sec=visitas&como=colaborador')
    assert.equal(hrefSeccion('bandeja', false), '/panel?sec=bandeja')
  })
})

describe('bandeja: orden y filtros', () => {
  test('emergencia primero, luego prioridad 1, 2, 3; empate: la más antigua', () => {
    const a = tarea({ id: 'a', prioridad: 3 }), b = tarea({ id: 'b', prioridad: 1, created_at: '2026-11-10T12:00:00Z' }), c = tarea({ id: 'c', prioridad: 1 }), d = tarea({ id: 'd', tipo: 'emergencia', prioridad: 2 })
    assert.deepEqual(ordenarTareas([a, b, c, d]).map((t) => t.id), ['d', 'c', 'b', 'a'])
  })
  test('los tipos se cuentan, "Todas" va primero y un filtro vacío se conserva', () => {
    const l = [tarea({ tipo: 'pago_escalado' }), tarea({ tipo: 'pago_insistido' }), tarea({ tipo: 'emergencia' }), tarea({ tipo: 'algo_raro' })]
    const t = tiposConConteo(l, 'Todas')
    assert.deepEqual(t[0], { tipo: 'Todas', n: 4 }); assert.equal(t.find((x) => x.tipo === 'Pago')!.n, 2); assert.equal(t.find((x) => x.tipo === 'Otras')!.n, 1)
    assert.equal(tiposConConteo(l, 'Nadie abre').at(-1)!.n, 0)
    assert.equal(filtrarPorTipo(l, 'Pago').length, 2); assert.equal(filtrarPorTipo(l, 'Todas').length, 4)
    assert.equal(etiquetaDeTipo(null), 'Otras')
  })
  test('cuántas mostrar viene de la dirección: se sanea', () => {
    assert.equal(cuantasMostrar(undefined), 10); assert.equal(cuantasMostrar('-5'), 10); assert.equal(cuantasMostrar('abc'), 10)
    assert.equal(cuantasMostrar('25'), 30); assert.equal(cuantasMostrar('999999'), 500)
  })
  test('se quita la marca interna de la nota', () => { assert.equal(limpiarNota('Algo pasó\n[pago:abc]'), 'Algo pasó') })
})

describe('bandeja: datos', () => {
  const actor = (permisos: any): Actor => ({ id: 'u', correo: 'x@compaz.test', rol: 'colaborador', permisos })
  test('trae solo lo abierto, sin teléfonos ni correos si no tiene el permiso', async () => {
    db.seed('admin_flags', { id: 'f1', entidad_tipo: 'cliente', entidad_id: 'c1', entidad_nombre: 'Ana', nota: 'Llámala al +58 414 1234567 o ana@correo.com', reportado_por: 'sistema', resuelto: false, tipo: 'pago_escalado', prioridad: 2, created_at: '2026-11-10T10:00:00Z' })
    db.seed('admin_flags', { id: 'f2', entidad_tipo: 'cliente', entidad_id: 'c2', entidad_nombre: 'Luz', nota: 'ya resuelta', reportado_por: 'sistema', resuelto: true, tipo: null, prioridad: 2, created_at: '2026-11-10T10:00:00Z' })
    const sin = await cargarBandeja(actor({ ...NINGUNO, atender: true }))
    assert.equal(sin.length, 1); assert.doesNotMatch(sin[0].nota, /414|ana@correo/)
    const con = await cargarBandeja(actor({ ...NINGUNO, atender: true, telefonos: true }))
    assert.match(con[0].nota, /414 1234567/)
  })
})

describe('guardias de código', () => {
  test('la página del panel comprueba al actor y el cliente no importa código de servidor', () => {
    const pagina = readFileSync('app/panel/page.tsx', 'utf8'), bandeja = readFileSync('components/panel/Bandeja.tsx', 'utf8')
    assert.match(pagina, /actorDePagina/); assert.match(pagina, /puedeEntrarAlPanel/)
    assert.doesNotMatch(bandeja, /supabase-server|lib\/panel-bandeja'|lib\/permisos'/)
    assert.doesNotMatch(bandeja, /\.from\(/)
  })
})
