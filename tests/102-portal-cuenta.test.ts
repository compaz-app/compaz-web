/* eslint-disable */
// Fase 3 del portal unificado: Mi cuenta (Mi familiar + Mi plan), enlaces viejos vivos y Pronto en Compaz plegado.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pestanaDeSec, esParteCuenta, PESTANAS } from '@/lib/portal-secciones'
import { parteAbierta } from '@/components/portal/SeccionCuenta'

describe('Mi cuenta', () => {
  test('quedan 3 pestañas y los enlaces viejos de familiar y plan llevan a Mi cuenta', () => {
    assert.equal(PESTANAS.length, 3)
    assert.equal(pestanaDeSec('familiar'), 'cuenta'); assert.equal(pestanaDeSec('plan'), 'cuenta'); assert.equal(pestanaDeSec('cuenta'), 'cuenta')
    for (const x of [undefined, '', 'admin', 3, null]) assert.equal(pestanaDeSec(x), 'inicio')
    assert.equal(esParteCuenta('plan'), true); assert.equal(esParteCuenta('visitas'), false)
  })
  test('empieza abierta la parte pedida; sin pedir, la ficha si falta y si no el plan', () => {
    assert.equal(parteAbierta('plan', false), 'plan'); assert.equal(parteAbierta('familiar', true), 'familiar')
    assert.equal(parteAbierta(null, false), 'familiar'); assert.equal(parteAbierta(null, true), 'plan')
  })
  test('la pantalla usa Mi cuenta y pliega Pronto en Compaz', () => {
    const page = readFileSync('app/portal/page.tsx', 'utf8')
    assert.match(page, /<SeccionCuenta/); assert.doesNotMatch(page, /<SeccionPlan|<SeccionFamiliar/)
    assert.match(page, /<details[\s\S]*Pronto en Compaz/)
  })
})

describe('enlaces viejos', () => {
  test('/dashboard conserva la parte (?sec=) al llevar al cliente al portal nuevo', () => {
    assert.match(readFileSync('app/dashboard/page.tsx', 'utf8'), /pestanaDeSec\(params\.sec\)/)
  })
})
