import EditarPerfil from '../EditarPerfil'

export default function PerfilPreview() {
  return (
    <main style={{ minHeight: '100vh', background: '#FDFAF6', padding: '24px 16px 64px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <p style={{ color: '#6B5C90', fontSize: 14, margin: '0 0 4px' }}>Compaz</p>
          <h1 style={{ color: '#1A0A3C', fontSize: 26, fontWeight: 800, margin: 0 }}>Mi perfil</h1>
          <p style={{ color: '#4A3B6B', fontSize: 15, margin: '8px 0 0' }}>
            Edita tu información. Los cambios se publican de inmediato.
          </p>
        </div>
        <EditarPerfil
          token="preview"
          inicial={{
            nombre: 'María González',
            zona: 'Caracas, Baruta',
            descripcion: 'Soy enfermera con 8 años de experiencia cuidando adultos mayores. Me caracterizo por ser paciente, cariñosa y muy responsable.',
            servicios: ['Acompañamiento', 'Cuidado de adultos mayores', 'Preparación de comida'],
            youtube_url: '',
            foto_url: '',
            horarios_disponibles: [
              { dia: 'lunes', inicio: '08:00', fin: '16:00' },
              { dia: 'miércoles', inicio: '08:00', fin: '16:00' },
              { dia: 'viernes', inicio: '08:00', fin: '14:00' },
            ],
          }}
        />
      </div>
    </main>
  )
}
