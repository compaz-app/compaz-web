/* eslint-disable */
// Cuando el compita llama durante la visita, el portal lo muestra al cargar («te está llamando» + botón), no solo con el timbre en vivo: el cliente que entra desde el correo la ve.
import { db, limpiar, mkCompita, mkCliente, mkVisita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { estadoDelCliente } from '@/lib/estado-cliente'
import { tarjetaDelEstado } from '@/lib/portal-estados'

beforeEach(limpiar)
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

describe('llamada del compita durante la visita', () => {
  const armar = (o: Record<string, any>) => { const cli = mkCliente({ email: 'caro@mail.test' }); const cmp = mkCompita(); mkVisita(cli, cmp, { estado: 'en_curso', ...o }); return cli }

  test('con la llamada reciente y la sala abierta, el portal ofrece contestarla', async () => {
    const cli = armar({ llamada_solicitada_at: hace(2), room_url: 'https://compaz.daily.co/cmp-abc12345' })
    const e = await estadoDelCliente(cli.id)
    assert.equal(e.codigo, 'compita_llamando')
    const t = tarjetaDelEstado({ estado: e, pagado: true } as any)
    assert.equal((t.principal!.destino as any).ruta, '/llamada/cmp-abc12345')
  })
  test('pasados 15 minutos, o si ya colgaron (sin sala), vuelve a la visita en curso', async () => {
    assert.equal((await estadoDelCliente(armar({ llamada_solicitada_at: hace(20), room_url: 'https://compaz.daily.co/cmp-abc12345' }).id)).codigo, 'visita_en_curso')
    limpiar()
    assert.equal((await estadoDelCliente(armar({ llamada_solicitada_at: hace(2), room_url: null }).id)).codigo, 'visita_en_curso')
  })
  test('el aviso en vivo también refresca el portal', () => {
    assert.match(readFileSync('components/ui/VisitaWatcher.tsx', 'utf8'), /sonarTimbre\(\)\s*\n\s*router\.refresh\(\)/)
  })
})
