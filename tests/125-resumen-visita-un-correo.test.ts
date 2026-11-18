/* eslint-disable */
// El resumen de la visita llega en UN solo correo (con la recomendación de IA, lo que anotó el compita y la calificación), y se califica una sola vez.
import { db, net, limpiar, req, emailsA, mkCompita, mkCliente } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { PLANTILLAS } from '@/lib/plantillas-aviso'
import { enviarResumenesSinReporte, ESPERA_CUESTIONARIO_MIN } from '@/lib/resumen-visita'
import { GET as ratingGet } from '@/app/api/visita/rating/route'
import { tokenRating as ratingToken } from '@/lib/links'

beforeEach(limpiar)
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const terminada = (finHaceMin: number, o: Record<string, any> = {}) => {
  const compita = mkCompita({ nombre: 'María Pérez' }); const cliente = mkCliente({ email: 'cli@mail.test', nombre: 'Carlos Ruiz' })
  const v = db.seed('visitas', { usuario_id: cliente.id, compita_id: compita.id, estado: 'terminada', inicio: hace(finHaceMin + 60), fin: hace(finHaceMin), ...o })
  return { compita, cliente, v }
}
const reporte = (v: any, o: Record<string, any> = {}) => db.seed('reportes_visita', { visita_id: v.id, animo: 5, fisico: 4, participacion: 5, entorno: 4, novedad: 'Se tomó todas sus pastillas', resumen_ia: 'Hoy estuvo con muy buen ánimo.', ...o })
const resumenes = () => emailsA('cli@mail.test').filter((e) => /^(Resumen|Actualización)/.test(e.subject))

describe('el correo único: resumen completo', () => {
  test('lleva la recomendación de IA, lo que anotó el compita (con su nombre) y la calificación; el asunto es «Resumen», no «Actualización»', async () => {
    const { v } = terminada(10); const rep = reporte(v)
    const c = (await PLANTILLAS.visita_reporte.render({ reporteId: rep.id }))!.correo!
    assert.match(c.asunto, /^Resumen de la visita de hoy con María Pérez/)
    assert.match(c.html, /muy buen ánimo/); assert.match(c.html, /Lo que anotó María/); assert.match(c.html, /Se tomó todas sus pastillas/)
    assert.match(c.html, /¿Cómo estuvo la visita de hoy\?/); assert.equal((c.html.match(/api\/visita\/rating/g) ?? []).length, 5, 'las 5 estrellas')
  })
  test('si ya calificó, el correo NO vuelve a pedir la calificación (ni en el reporte ni en el resumen básico)', async () => {
    const { v } = terminada(10, { rating_cliente: 5 }); const rep = reporte(v)
    assert.doesNotMatch((await PLANTILLAS.visita_reporte.render({ reporteId: rep.id }))!.correo!.html, /api\/visita\/rating/)
    assert.doesNotMatch((await PLANTILLAS.visita_resumen.render({ visitaId: v.id }))!.correo!.html, /api\/visita\/rating/)
  })
})

describe('respaldo: el compita no completó el cuestionario', () => {
  test(`a los ${ESPERA_CUESTIONARIO_MIN} min de terminada sin reporte sale el resumen básico, UNA sola vez`, async () => {
    terminada(40)
    assert.equal(await enviarResumenesSinReporte(), 1); assert.equal(await enviarResumenesSinReporte(), 0)
    assert.equal(resumenes().length, 1)
  })
  test('antes de ese plazo no sale (el compita todavía puede completarlo), ni si ya hay reporte, ni si pasaron más de 48 h', async () => {
    terminada(20)                                   // muy reciente
    const { v } = terminada(60); reporte(v)         // ya tiene reporte
    terminada(49 * 60)                              // demasiado vieja
    assert.equal(await enviarResumenesSinReporte(), 0); assert.equal(resumenes().length, 0)
  })
  test('si el compita completa el cuestionario, hay UN solo correo en total (el del reporte) y el respaldo ya no sale', async () => {
    const { v, cliente } = terminada(40)
    reporte(v)
    const { notificar } = await import('@/lib/avisos')
    await notificar({ plantilla: 'visita_reporte', canal: 'correo', destinatario: { tipo: 'cliente', id: cliente.id }, variables: { reporteId: db.rows('reportes_visita')[0].id }, entidad: 'visita', entidadId: v.id, paso: 15 })
    await enviarResumenesSinReporte()
    assert.equal(resumenes().length, 1)
  })
})

describe('calificar una sola vez', () => {
  const enlace = (v: any, n = 4) => `/api/visita/rating?visita_id=${v.id}&valor=${n}&t=${ratingToken(v.id, n)}`
  test('si ya calificó, el enlace muestra «Ya calificaste» y no ofrece enviar otra vez', async () => {
    const { v } = terminada(10, { rating_cliente: 5 })
    const html = await (await ratingGet(req(enlace(v) as string))).text()
    assert.match(html, /Ya calificaste/); assert.doesNotMatch(html, /<form/)
  })
  test('si todavía no calificó, el enlace pide confirmar (los escáneres de correo no califican por error)', async () => {
    const { v } = terminada(10)
    assert.match(await (await ratingGet(req(enlace(v) as string))).text(), /<form method="POST"/)
  })
})
