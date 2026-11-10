/* eslint-disable */
// Lote 2: ficha obligatoria con consentimiento. La validación vive en el servidor y sin ficha no se agenda.
import { db, limpiar, req, session, mkCliente, mkCompita, mkVisita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { PUT as fichaPut, GET as terminosGet } from '@/app/api/usuario/ficha/route'
import { POST as nueva } from '@/app/api/visita/nueva/route'
import { validarFicha, fichaCompleta } from '@/lib/ficha'
import { setAjuste } from '@/lib/ajustes'
import { TERMINOS_VERSION } from '@/lib/terminos'

beforeEach(limpiar)
const como = (u: any) => { session.user = { id: u.id, email: u.email } }
const buena = (o: Record<string, any> = {}) => ({
  telefono: '+1 305 555 0142', pais: 'Estados Unidos', parentesco: 'Hija', familiar_nombre: 'Elena', familiar_edad: 82,
  lugar_privado: true, ficha_personas: 'Rosa (vecina)', acepto: true, ...o,
})
const enviar = (c: any, cuerpo: any) => { como(c); return fichaPut(req('/api/usuario/ficha', { method: 'PUT', json: cuerpo })) }
const nuevoSinFicha = () => mkCliente({ familiar_nombre: null, telefono: null, terminos_aceptados_en: null })

describe('validarFicha', () => {
  test('acepta una ficha completa', () => assert.equal(validarFicha(buena()).ok, true))
  test('sin aceptar los términos no pasa', () => assert.equal(validarFicha(buena({ acepto: false })).ok, false))
  test('exige teléfono, país, parentesco válido y nombre', () => {
    for (const mala of [{ telefono: '12' }, { telefono: '' }, { pais: '' }, { parentesco: 'Vecino' }, { familiar_nombre: '  ' }, { familiar_edad: 200 }])
      assert.equal(validarFicha(buena(mala)).ok, false, JSON.stringify(mala))
  })
  test('en lugar privado exige quién más estará, o que marque que nadie más', () => {
    assert.equal(validarFicha(buena({ ficha_personas: '' })).ok, false)
    const r = validarFicha(buena({ ficha_personas: '', ficha_sin_nadie: true }))
    assert.ok(r.ok && r.datos.ficha_sin_nadie === true && r.datos.ficha_personas === null)
  })
  test('en un lugar no privado no pide personas', () => assert.equal(validarFicha(buena({ lugar_privado: false, ficha_personas: '' })).ok, true))
  test('lugar_privado debe ser verdadero o falso', () => assert.equal(validarFicha(buena({ lugar_privado: undefined })).ok, false))
})

describe('PUT /api/usuario/ficha', () => {
  test('guarda la ficha, la versión de los términos y deja el evento', async () => {
    const c = nuevoSinFicha()
    const r = await enviar(c, buena())
    assert.equal(r.status, 200)
    const u = db.rows('usuarios').find((x) => x.id === c.id)!
    assert.equal(u.familiar_nombre, 'Elena'); assert.equal(u.parentesco, 'Hija'); assert.equal(u.pais, 'Estados Unidos')
    assert.equal(u.terminos_version, TERMINOS_VERSION)
    assert.ok(u.terminos_aceptados_en)
    assert.equal(fichaCompleta(u), true)
    const ev = db.rows('eventos').find((e) => e.tipo === 'terminos_aceptados')!
    assert.equal(ev.entidad_id, c.id); assert.equal(ev.datos.version, TERMINOS_VERSION)
  })

  test('sin aceptar no guarda nada', async () => {
    const c = nuevoSinFicha()
    const r = await enviar(c, buena({ acepto: false }))
    assert.equal(r.status, 400)
    const u = db.rows('usuarios').find((x) => x.id === c.id)!
    assert.equal(u.familiar_nombre, null); assert.equal(u.terminos_aceptados_en, null)
  })

  test('sin sesión da 401', async () => {
    session.user = null
    assert.equal((await fichaPut(req('/api/usuario/ficha', { method: 'PUT', json: buena() }))).status, 401)
  })

  test('los términos salen de Ajustes y están marcados como provisionales', async () => {
    const c = mkCliente(); como(c)
    await setAjuste({ clave: 'cancelacion_gratis_horas', valor: 12, actor: 'admin:a' })
    const t = (await (await terminosGet()).json()).data
    assert.equal(t.provisional, true)
    assert.ok(t.puntos.some((p: string) => p.includes('12 horas')))
  })
})

describe('sin ficha no se agenda', () => {
  test('crear la siguiente visita con la ficha incompleta da 409; con la ficha completa funciona', async () => {
    const compita = mkCompita({ telegram_chat_id: '9701' })
    const c = mkCliente({ compita_id: compita.id, terminos_aceptados_en: null })
    mkVisita(c, compita, { estado: 'terminada', fin: new Date().toISOString() })
    como(c)
    const r = await nueva()
    assert.equal(r.status, 409)
    assert.match((await r.json()).error, /ficha/)
    db.rows('usuarios').find((x) => x.id === c.id)!.terminos_aceptados_en = new Date().toISOString()
    assert.equal((await nueva()).status, 200)
  })
})
