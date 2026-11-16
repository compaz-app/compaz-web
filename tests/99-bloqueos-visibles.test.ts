/* eslint-disable */
// El bloqueo «este compita no vuelve con este cliente» se ve y se levanta desde la ficha, y la llamada no se puede cerrar como «Resuelto» dejándolo escondido.
import { db, limpiar, req, session, mkCompita, mkCliente, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PATCH as repPatch } from '@/app/api/admin/reportes-compita/route'
import { PATCH as bloqPatch } from '@/app/api/admin/bloqueos-compita/route'
import { reportarCliente, parBloqueado, DECISIONES_CON_BLOQUEO } from '@/lib/bloqueos-compita'
import { fichaDePersona } from '@/lib/panel-personas'
import { cargarBandeja } from '@/lib/panel-bandeja'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'

beforeEach(limpiar)
const admin = { id: 'a1', correo: 'admin@compaz.test', rol: 'admin' as const, permisos: { ...TODOS } }
const soloMirar = { id: 'm1', correo: 'm@compaz.test', rol: 'colaborador' as const, permisos: { ...NINGUNO, monitorear: true, cuentas: true } }
const comoAdmin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }

async function conBloqueo(noVolver = true) {
  const compita = mkCompita({ telegram_chat_id: '9970', nombre: 'Juan Compita' } as any) as any, cliente = mkCliente({ nombre: 'Juan Cliente' } as any) as any
  mkSolicitud(cliente, compita, { estado: 'aceptada' }) // el compita solo puede reportar a un cliente con el que ya tuvo trato
  await reportarCliente(compita, cliente.id, { motivo: 'otro', cuando: 'despues', estaBien: true, reincidente: false, noVolver, llamar: true })
  return { compita, cliente, reporte: db.rows('reportes_compita')[0] }
}
const llamada = (id: string, resultado: string) => repPatch(req('/api/admin/reportes-compita', { method: 'PATCH', json: { id, resultado } }))

describe('ver el bloqueo en la ficha', () => {
  test('la ficha del compita y la del cliente muestran el bloqueo, con el nombre del otro', async () => {
    const { compita, cliente } = await conBloqueo()
    const fc = (await fichaDePersona(admin as any, 'compita', compita.id))!, fu = (await fichaDePersona(admin as any, 'cliente', cliente.id))!
    assert.equal(fc.bloqueos!.length, 1); assert.equal(fc.bloqueos![0].otro, 'Juan Cliente')
    assert.equal(fu.bloqueos!.length, 1); assert.equal(fu.bloqueos![0].otro, 'Juan Compita')
  })
  test('sin el permiso de atender no viaja (solo quien puede levantarlo lo ve)', async () => {
    const { compita } = await conBloqueo(); assert.deepEqual((await fichaDePersona(soloMirar as any, 'compita', compita.id))!.bloqueos, [])
  })
  test('sin bloqueo no hay sección', async () => {
    const { compita } = await conBloqueo(false); assert.equal((await fichaDePersona(admin as any, 'compita', compita.id))!.bloqueos!.length, 0)
  })
  test('el botón de la ficha levanta el bloqueo y el cliente vuelve a poder contratar', async () => {
    const { compita, cliente } = await conBloqueo(); assert.equal(await parBloqueado(compita.id, cliente.id), true)
    comoAdmin(); const b = (await fichaDePersona(admin as any, 'compita', compita.id))!.bloqueos![0]
    assert.equal((await bloqPatch(req('/api/admin/bloqueos-compita', { method: 'PATCH', json: { id: b.id } }))).status, 200)
    assert.equal(await parBloqueado(compita.id, cliente.id), false); assert.equal(db.rows('bloqueos_compita_cliente')[0].levantado_por, 'admin@compaz.test')
  })
  test('la pantalla lo muestra en las dos fichas, con confirmación y ⓘ', () => {
    const f = readFileSync('components/panel/FichaPersona.tsx', 'utf8'); assert.match(f, /<BloqueosPersona tipo=\{ficha\.tipo\}/)
    const c = readFileSync('components/panel/BloqueosPersona.tsx', 'utf8'); assert.match(c, /No vuelven a trabajar juntos/); assert.match(c, /¿Levantar el bloqueo\?/); assert.match(c, /api\/admin\/bloqueos-compita/); assert.match(c, /Este compita no está disponible/)
  })
})

describe('la llamada con un bloqueo activo', () => {
  test('no se puede cerrar como «Resuelto» ni «Hablar con el cliente»: hay que mantenerlo o levantarlo (el servidor lo exige)', async () => {
    const { compita, cliente, reporte } = await conBloqueo(); comoAdmin()
    for (const r of ['resuelto', 'hablar_cliente']) { const x = await llamada(reporte.id, r); assert.equal(x.status, 409, r); assert.match((await x.json()).error, /bloqueo activo/) }
    assert.equal(db.rows('reportes_compita')[0].llamada_en, null, 'la llamada sigue pendiente'); assert.equal(await parBloqueado(compita.id, cliente.id), true)
    assert.deepEqual([...DECISIONES_CON_BLOQUEO], ['mantener_bloqueo', 'levantar_bloqueo'])
  })
  test('mantener o levantar sí la cierran', async () => {
    const a = await conBloqueo(); comoAdmin(); assert.equal((await llamada(a.reporte.id, 'mantener_bloqueo')).status, 200); assert.equal(await parBloqueado(a.compita.id, a.cliente.id), true)
    limpiar(); const b = await conBloqueo(); comoAdmin(); assert.equal((await llamada(b.reporte.id, 'levantar_bloqueo')).status, 200); assert.equal(await parBloqueado(b.compita.id, b.cliente.id), false)
  })
  test('sin bloqueo, «Resuelto» sigue funcionando', async () => {
    const { reporte } = await conBloqueo(false); comoAdmin(); assert.equal((await llamada(reporte.id, 'resuelto')).status, 200)
  })
  test('la Bandeja avisa que hay bloqueo y la ventana de la llamada solo ofrece mantener o levantar', async () => {
    await conBloqueo()
    const t = (await cargarBandeja(admin as any)).find((x) => x.accion?.tipo === 'llamada')!; assert.equal((t.accion as any).reporte.bloqueo, true)
    const a = readFileSync('components/panel/AccionTarea.tsx', 'utf8'); assert.match(a, /reporte\.bloqueo/); assert.match(a, /Hay un bloqueo activo entre ellos/)
  })
})
