/* eslint-disable */
// Fase 1 del portal unificado: círculo rojo en Visitas (novedades sin abrir) y la línea «Después» de la tarjeta.
import { limpiar, mkCliente } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registrarNovedad, contarNovedadesSinAbrir, marcarNovedadesAbiertas, marcarNovedadesVistas } from '@/lib/novedades'
import { CODIGOS_CON_TARJETA, tarjetaDelEstado } from '@/lib/portal-estados'

beforeEach(limpiar)
const nueva = (u: any, clave: string) => ({ usuarioId: u.id, tipo: 'compita_llego', nivel: 'critico' as const, titulo: 'Tu compita llegó.', clave })

describe('círculo rojo de Visitas', () => {
  test('cuenta lo que no se abrió; abrir Visitas lo deja en cero y no afecta a otro cliente', async () => {
    const a = mkCliente(), b = mkCliente()
    await registrarNovedad(nueva(a, 'novedad:1')); await registrarNovedad(nueva(a, 'novedad:2')); await registrarNovedad(nueva(b, 'novedad:3'))
    assert.equal(await contarNovedadesSinAbrir(a.id), 2)
    assert.equal(await marcarNovedadesAbiertas(a.id), 2)
    assert.equal(await contarNovedadesSinAbrir(a.id), 0); assert.equal(await contarNovedadesSinAbrir(b.id), 1)
  })
  test('que el portal estuviera abierto («vista») no quita el círculo: solo abrir Visitas lo quita', async () => {
    const a = mkCliente()
    await registrarNovedad(nueva(a, 'novedad:1')); await marcarNovedadesVistas(a.id)
    assert.equal(await contarNovedadesSinAbrir(a.id), 1)
  })
})

describe('tarjeta de siguiente paso', () => {
  test('los estados con un paso siguiente claro llevan la línea «Después», y ninguna es vacía', () => {
    const textos = CODIGOS_CON_TARJETA.map((codigo) => tarjetaDelEstado({ estado: { codigo } as any, pagado: true } as any)).filter((t) => t.luego)
    assert.ok(textos.length >= 10); for (const t of textos) assert.match(t.luego!, /^Después: .+\.$/)
  })
  test('la pantalla muestra la tarjeta en todas las pestañas y el círculo no se marca en la vista previa del equipo', () => {
    const page = readFileSync('app/portal/page.tsx', 'utf8')
    assert.match(page, /pestana !== 'inicio' && <TarjetaEstado/)
    assert.match(page, /if \(!esAdmin\) \{[\s\S]*marcarNovedadesAbiertas/)
  })
})
