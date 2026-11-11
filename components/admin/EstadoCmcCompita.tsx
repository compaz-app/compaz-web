// Estado de una Compita respecto al CMC y lista de pasos para activarla (dashboard admin).
// El CMC decide si PUEDE trabajar (cmc_permite); la web decide si YA recibe solicitudes.
import type { Compita } from '@/types'
import { colors, radius, spacing, fonts } from '@/lib/design'

type Paso = { listo: boolean; texto: string }

/** Pasos que faltan para que una Compita del CMC reciba solicitudes. */
export function pasosActivacion(c: Compita): Paso[] {
  return [
    { listo: c.cmc_permite === true, texto: 'Permitida por el CMC' },
    { listo: !!c.telegram_chat_id, texto: 'Telegram vinculado' },
    { listo: !!c.foto_url, texto: 'Foto' },
    { listo: !!c.descripcion?.trim(), texto: 'Descripción' },
    { listo: (c.servicios ?? []).length > 0, texto: 'Servicios' },
    { listo: (c.horarios_disponibles ?? []).length > 0, texto: 'Horarios' },
    { listo: c.estado === 'activo' && c.verificado, texto: 'Verificada por Juan' },
  ]
}

export default function EstadoCmcCompita({ c }: { c: Compita }) {
  // Compitas anteriores al CMC y demos: sin cambios en el dashboard
  if (!c.codigo || c.cmc_permite == null) return null

  const permite = c.cmc_permite === true
  const pasos = pasosActivacion(c)
  const pendientes = pasos.filter((p) => !p.listo)

  return (
    <div style={{ marginTop: spacing.sm, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
      <span
        title={c.cmc_actualizado_en ? `Último cambio desde el CMC: ${new Date(c.cmc_actualizado_en).toLocaleString('es-VE')}` : undefined}
        style={{
          alignSelf: 'flex-start', maxWidth: '100%', fontSize: '12px', fontWeight: 700, fontFamily: fonts.base,
          borderRadius: radius.pill, padding: `2px ${spacing.sm}`, overflowWrap: 'anywhere',
          background: permite ? colors.verdeClaro : colors.rojoClaro,
          color: permite ? colors.verde : colors.rojo,
          border: `1px solid ${permite ? colors.verde : colors.rojo}`,
        }}>
        {permite ? '✓ CMC permite' : '⛔ CMC no permite'} · {c.cmc_estado ?? '—'}
      </span>
      {pendientes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
          {pasos.map((p) => (
            <span key={p.texto} style={{
              fontSize: '11px', fontFamily: fonts.base, borderRadius: radius.sm, padding: `1px ${spacing.xs}`,
              background: p.listo ? colors.fondoClaro : colors.amarilloClaro,
              color: p.listo ? colors.textoSutil : colors.amarillo,
            }}>
              {p.listo ? '✓' : '○'} {p.texto}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
