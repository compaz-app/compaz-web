'use client'

import { useState } from 'react'
import { colors, fonts, spacing, radius } from '@/lib/design'
import InfoBoton from '@/components/ui/InfoBoton'

export interface ReportePendiente {
  id: string; compita_nombre: string; cliente_nombre: string; motivo: string; plazo_llamada: string; vencido: boolean
  abiertas: { visitas: { id: string; estado: string; fecha: string | null; cancelable: boolean }[]; solicitudes: { id: string; estado: string }[] }
}

const RESULTADOS = [
  { v: 'resuelto', t: 'Resuelto', info: 'Ya hablaste con el compita y no hace falta nada más. Se cierra la tarea y queda anotado quién llamó y cuándo.' },
  { v: 'hablar_cliente', t: 'Hablar con el cliente', info: 'Tras hablar con el compita, falta llamar o escribirle al cliente. Se cierra esta tarea y queda anotado; el seguimiento con el cliente lo haces tú.' },
  { v: 'mantener_bloqueo', t: 'Mantener el bloqueo', info: 'Decides que el compita no vuelve con este cliente. El bloqueo sigue y ese cliente no podrá pedirle más visitas. Se cierra la tarea.' },
  { v: 'levantar_bloqueo', t: 'Levantar el bloqueo', info: 'Decides que no hacía falta separarlos. El cliente vuelve a poder pedirle visitas a este compita. Se cierra la tarea.' },
] as const

const hora = (iso: string) => new Date(iso).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
const boton = (color: string, relleno = false) => ({ minHeight: '44px', padding: `0 ${spacing.md}`, borderRadius: radius.pill, border: `1.5px solid ${color}`, background: relleno ? color : colors.blanco, color: relleno ? colors.blanco : color, fontWeight: 700, cursor: 'pointer', fontFamily: fonts.body, fontSize: '14px' }) as const

/** La llamada al compita que reportó un problema: el plazo, lo que sigue abierto con ese cliente y las cuatro decisiones. */
export default function LlamadaReporte({ reporte, onHecho }: { reporte: ReportePendiente; onHecho: (id: string) => void }) {
  const [ocupado, setOcupado] = useState(false); const [msg, setMsg] = useState(''); const [abiertas, setAbiertas] = useState(reporte.abiertas)
  const cancelables = abiertas.visitas.filter((v) => v.cancelable).length + abiertas.solicitudes.length
  const enVivo = abiertas.visitas.filter((v) => !v.cancelable).length

  async function cancelar() {
    if (!confirm('Se cancelarán las visitas y solicitudes abiertas entre este compita y este cliente. Al cliente se le devuelve el crédito y se le avisa, sin decirle el motivo. ¿Continuar?')) return
    setOcupado(true); setMsg('')
    const r = await fetch('/api/admin/reportes-compita', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: reporte.id }) }).then((x) => x.json()).catch(() => null)
    setOcupado(false)
    if (!r?.ok) { setMsg('No se pudo cancelar. Intenta de nuevo.'); return }
    setAbiertas({ visitas: abiertas.visitas.filter((v) => !v.cancelable), solicitudes: [] })
    setMsg(`Listo: ${r.data.visitas} visita(s) y ${r.data.solicitudes} solicitud(es) canceladas y el cliente avisado.`)
  }
  async function registrar(resultado: string) {
    setOcupado(true); setMsg('')
    const r = await fetch('/api/admin/reportes-compita', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: reporte.id, resultado }) }).then((x) => x.json()).catch(() => null)
    setOcupado(false)
    if (!r?.ok) { setMsg('No se pudo registrar. Intenta de nuevo.'); return }
    onHecho(reporte.id)
  }

  return (
    <div style={{ marginTop: spacing.sm, padding: spacing.sm, background: reporte.vencido ? colors.rojoClaro : colors.amarilloClaro, borderRadius: radius.md, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
      <div style={{ fontWeight: 800, fontSize: '14px', color: reporte.vencido ? colors.rojo : colors.textoOscuro }}>
        📞 Llamar a {reporte.compita_nombre} {reporte.vencido ? '(plazo vencido, era antes del ' : 'antes del '}{hora(reporte.plazo_llamada)}{reporte.vencido ? ')' : ''}
      </div>
      {(cancelables > 0 || enVivo > 0) && (
        <div style={{ fontSize: '13px', color: colors.textoOscuro, lineHeight: 1.5 }}>
          Sigue abierto con {reporte.cliente_nombre}: {abiertas.visitas.length} visita(s) y {abiertas.solicitudes.length} solicitud(es).
          {enVivo > 0 && ' Una visita ya empezó: esa se atiende aparte, no se cancela desde aquí.'}
          {cancelables > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: spacing.xs }}>
              <button type="button" disabled={ocupado} onClick={cancelar} style={boton(colors.rojo)}>Cancelar y avisar al cliente</button>
              <InfoBoton que="Cancelar y avisar al cliente" texto="Cancela las visitas y solicitudes que siguen abiertas entre este compita y este cliente. Al cliente se le devuelve el crédito y recibe un aviso neutro, sin el motivo. Al compita no le cuenta como cancelación tardía. No se puede deshacer." />
            </span>
          )}
        </div>
      )}
      <div style={{ fontSize: '13px', color: colors.textoMedio }}>Después de llamar, registra qué decidiste:</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
        {RESULTADOS.map((r) => (
          <span key={r.v} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <button type="button" disabled={ocupado} onClick={() => registrar(r.v)} style={boton(r.v === 'levantar_bloqueo' ? colors.moradoProfundo : colors.verde)}>{r.t}</button>
            <InfoBoton que={r.t} texto={r.info} />
          </span>
        ))}
      </div>
      {msg && <div role="status" style={{ fontSize: '13px', fontWeight: 700, color: colors.textoOscuro }}>{msg}</div>}
    </div>
  )
}
