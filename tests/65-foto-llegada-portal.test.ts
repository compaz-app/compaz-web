import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { llevaFotoLlegada } from '../lib/portal-estados'

const tarjeta = readFileSync('components/portal/TarjetaEstado.tsx', 'utf8')

describe('foto de llegada en el portal', () => {
  test('solo las tarjetas de "llegó" y "nadie abre" llevan foto', () => {
    assert.ok(llevaFotoLlegada('compita_llego'))
    assert.ok(llevaFotoLlegada('nadie_abre'))
    for (const e of ['visita_en_curso', 'visita_programada', 'bienvenida', 'cita_pendiente']) assert.ok(!llevaFotoLlegada(e), e)
  })
  test('la tarjeta pide la foto solo al cliente real, no en vista previa del equipo', () => {
    assert.match(tarjeta, /estado && !vistaPrevia && llevaFotoLlegada\(estado\)/)
    assert.match(tarjeta, /\/api\/visita\/llegada-foto/)
  })
  test('la foto tiene texto alternativo', () => {
    assert.match(tarjeta, /alt="Foto que mandó tu compita al llegar"/)
  })
})
