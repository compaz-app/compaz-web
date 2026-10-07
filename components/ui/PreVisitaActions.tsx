'use client'

interface Props {
  compitaNombre: string
  tieneFecha: boolean
}

// Muestra una advertencia si el cliente aún no ha confirmado la fecha.
// Una vez que confirma, el dashboard transiciona a 'programada' automáticamente.
export default function PreVisitaActions({ compitaNombre, tieneFecha }: Props) {
  if (tieneFecha) return null

  function scrollAFecha() {
    document.getElementById('fecha-programada')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div style={{ marginTop: '16px', background: '#FFFBF0', border: '2px solid #FCD34D', borderRadius: '16px', padding: '20px' }}>
      <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, color: '#92400E', fontSize: '15px', margin: '0 0 6px' }}>
        ⚠️ Falta registrar la fecha en el sistema
      </p>
      <p style={{ color: '#78350F', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 }}>
        Acuerda la fecha con {compitaNombre} en el chat y luego ingrésala arriba. No basta con hablar de la fecha en el chat — tiene que quedar registrada para que Compaz active el seguimiento y te mande el recordatorio.
      </p>
      <button
        onClick={scrollAFecha}
        style={{
          background: '#D97706',
          color: 'white',
          border: 'none',
          borderRadius: '9999px',
          padding: '12px 24px',
          fontFamily: 'Bricolage Grotesque, sans-serif',
          fontWeight: 800,
          fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        📅 Ingresar la fecha →
      </button>
    </div>
  )
}
