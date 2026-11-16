/* eslint-disable */
// «Ya vio el reporte»: «¿cómo te fue?» termina cuando el cliente abre el reporte y el portal pasa a agendar la siguiente.
import { db, limpiar, mkCliente } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decidirEstado, type FotoCliente, type VisitaFoto } from '@/lib/estado-cliente'
import { marcarReporteVisto } from '@/lib/reporte-visto'

beforeEach(limpiar)
const AHORA = new Date('2026-11-10T15:00:00.000Z')
const min = (n: number) => new Date(AHORA.getTime() + n * 60_000).toISOString()
const foto = (v: Partial<VisitaFoto>): FotoCliente => ({ ahora: AHORA, pausada: false, fichaCompleta: true, zonaHoraria: null, nombre: 'Ana', compitaAsignado: { id: 'c1', nombre: 'María' }, solicitudes: [], pagoPendiente: null, cupo: { restantes: 2 }, cancelaciones: [],
  visitas: [{ id: 'v1', estado: 'terminada', compitaNombre: 'María', fechaProgramada: null, horaInicio: null, llegadaEn: null, sinAccesoEn: null, fin: min(-90), creadaEn: min(-5000), ...v }] })

describe('el estado evoluciona al ver el reporte', () => {
  test('sin ver el reporte: «¿cómo te fue?»; ya visto: agendar la siguiente', () => {
    assert.equal(decidirEstado(foto({})).codigo, 'visita_terminada')
    assert.equal(decidirEstado(foto({ reporteVistoEn: min(-30) })).codigo, 'agendar_otra')
  })
})

describe('marcarReporteVisto', () => {
  const terminada = (c: any, conReporte: boolean) => { const v = db.seed('visitas', { usuario_id: c.id, estado: 'terminada', compita_id: 'x' }); if (conReporte) db.seed('reportes_visita', { visita_id: v.id, animo: 'bien' }); return v }
  test('marca la visita terminada con reporte listo, y solo una vez', async () => {
    const c = mkCliente(); const v = terminada(c, true)
    assert.equal(await marcarReporteVisto(c.id), 1)
    assert.ok(db.rows('visitas').find((x: any) => x.id === v.id)!.reporte_visto_en)
    assert.equal(await marcarReporteVisto(c.id), 0)
  })
  test('si el reporte todavía no está, no lo da por visto (seguiría el aviso hasta que llegue)', async () => {
    const c = mkCliente(); const v = terminada(c, false)
    assert.equal(await marcarReporteVisto(c.id), 0); assert.equal(db.rows('visitas').find((x: any) => x.id === v.id)!.reporte_visto_en ?? null, null)
  })
  test('no toca las visitas de otro cliente', async () => {
    const a = mkCliente(), b = mkCliente(); terminada(a, true); const vb = terminada(b, true)
    await marcarReporteVisto(a.id); assert.equal(db.rows('visitas').find((x: any) => x.id === vb.id)!.reporte_visto_en ?? null, null)
  })
  test('el portal lo marca al abrir Visitas, antes de armar la tarjeta, y nunca en la vista previa del equipo', () => {
    const p = readFileSync('app/portal/page.tsx', 'utf8')
    assert.match(p, /!esAdmin && pestana === 'visitas'\) await marcarReporteVisto\(uid\)\s*\n\s*const portal = await cargarPortal/)
  })
})
