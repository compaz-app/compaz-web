/* eslint-disable */
// Un botón de la tarjeta que lleva a la pestaña donde ya estás no se muestra (antes «Ver el reporte» daba vueltas sobre la misma página).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CODIGOS_CON_TARJETA, tarjetaDelEstado, tarjetaParaPestana, pestanaDelBoton } from '@/lib/portal-estados'

const tarjeta = (codigo: string) => tarjetaDelEstado({ estado: { codigo } as any, pagado: true } as any)

describe('botones que no dan vueltas', () => {
  test('«Ver el reporte» se quita en Visitas y se queda en Inicio', () => {
    const t = tarjeta('visita_terminada')
    assert.equal(pestanaDelBoton(t.principal), 'visitas')
    assert.equal(tarjetaParaPestana(t, 'visitas').principal, undefined)
    assert.equal(tarjetaParaPestana(t, 'inicio').principal?.texto, 'Ver el reporte')
  })
  test('los botones que van a otra parte (pago, compitas) o a otra pestaña no se tocan', () => {
    const pagar = tarjeta('plan_agotado'); assert.equal(pestanaDelBoton(pagar.principal), null); assert.deepEqual(tarjetaParaPestana(pagar, 'visitas'), pagar)
    const ficha = tarjeta('ficha'); assert.equal(pestanaDelBoton(ficha.principal), 'cuenta'); assert.equal(tarjetaParaPestana(ficha, 'visitas').principal?.texto, 'Completar la ficha')
  })
  test('en ninguna pestaña queda un botón que lleve a esa misma pestaña (para todos los estados)', () => {
    for (const codigo of CODIGOS_CON_TARJETA) for (const p of ['inicio', 'visitas', 'cuenta'] as const) {
      const t = tarjetaParaPestana(tarjeta(codigo), p)
      assert.notEqual(pestanaDelBoton(t.principal), p, `${codigo} en ${p}`); assert.notEqual(pestanaDelBoton(t.secundario), p, `${codigo} en ${p}`)
    }
  })
  test('el portal usa la tarjeta filtrada en Inicio y en las demás pestañas', () => {
    assert.equal((readFileSync('app/portal/page.tsx', 'utf8').match(/tarjetaParaPestana\(/g) ?? []).length, 2)
  })
})
