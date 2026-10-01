'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Compita } from '@/types'
import LogoutButton from '@/components/ui/LogoutButton'

const ZONAS: Record<string, string[]> = {
  'Distrito Capital': ['Libertador'],
  'Miranda': ['Baruta', 'Chacao', 'El Hatillo', 'Sucre', 'Guaicaipuro', 'Carrizal', 'Los Salias', 'Cristóbal Rojas', 'Lander', 'Paz Castillo', 'Urdaneta', 'Acevedo', 'Brión', 'Buroz', 'Páez', 'Pedro Gual', 'Independencia', 'Simón Bolívar', 'Zamora'],
  'Aragua': ['Girardot', 'Mario Briceño Iragorry', 'Costa de Oro', 'Libertador', 'Sucre', 'Linares Alcántara', 'Bolívar', 'Ribas', 'Santos Michelena', 'Zamora', 'Camatagua', 'San Casimiro', 'San Sebastián', 'Urdaneta'],
  'Carabobo': ['Valencia', 'Naguanagua', 'San Diego', 'Libertador', 'Los Guayos', 'Miranda', 'Montalbán', 'Puerto Cabello', 'Juan José Mora', 'Guacara', 'Diego Ibarra', 'Carlos Arvelo', 'Bejuma'],
  'Zulia': ['Maracaibo', 'San Francisco', 'Cabimas', 'Ciudad Ojeda', 'Lagunillas', 'Jesús Enrique Lossada', 'La Cañada de Urdaneta', 'Miranda', 'Mara', 'Páez', 'Rosario de Perijá', 'Machiques de Perijá', 'Colón', 'Sucre', 'Valmore Rodríguez', 'Simón Bolívar', 'Santa Rita', 'Baralt'],
  'Lara': ['Iribarren', 'Andrés Eloy Blanco', 'Crespo', 'Jiménez', 'Morán', 'Palavecino', 'Simón Planas', 'Torres', 'Urdaneta'],
  'Mérida': ['Libertador', 'Campo Elías', 'Santos Marquina', 'Sucre', 'Rangel', 'Guaraque', 'Justo Briceño', 'Miranda', 'Obispo Ramos de Lora', 'Padre Noguera', 'Pueblo Llano', 'Rivas Dávila', 'Tovar', 'Tulio Febres Cordero', 'Arzobispo Chacón', 'Antonio Pinto Salinas', 'Aricagua', 'Zea'],
  'Táchira': ['San Cristóbal', 'Torbes', 'Cárdenas', 'Guásimos', 'Fernández Feo', 'Libertad', 'Lobatera', 'Michelena', 'Panamericano', 'Junín', 'Bolívar', 'Pedro María Ureña', 'García de Hevia', 'Ayacucho', 'Córdoba', 'Sucre', 'Uribante', 'Libertador', 'Andrés Bello', 'Jáuregui', 'Montes', 'Samuel Darío Maldonado'],
  'Bolívar': ['Caroní', 'Heres', 'Cedeño', 'El Callao', 'Gran Sabana', 'Piar', 'Raúl Leoni', 'Roscio', 'Sifontes', 'Sucre'],
  'Anzoátegui': ['Simón Bolívar', 'Sotillo', 'Diego Bautista Urbaneja', 'Bruzual', 'Cajigal', 'Fernando de Peñalver', 'Guanipa', 'Guanta', 'Independencia', 'Juan Antonio Sotillo', 'Libertad', 'Miranda', 'Monagas', 'Píritu', 'Simón Rodríguez'],
  'Monagas': ['Maturín', 'Acosta', 'Aguasay', 'Bolívar', 'Caripe', 'Cedeño', 'Libertador', 'Piar', 'Santa Bárbara', 'Sotillo', 'Uracoa'],
  'Nueva Esparta': ['Mariño', 'Antolín del Campo', 'Arismendi', 'Díaz', 'García', 'Gómez', 'Macanao', 'Maneiro', 'Marcano', 'Tubores', 'Villalba'],
  'Vargas': ['Vargas'],
  'Falcón': ['Miranda', 'Bolívar', 'Carirubana', 'Colina', 'Democracia', 'Federación', 'Los Taques', 'Mauroa', 'Silva', 'Sucre', 'Zamora'],
  'Yaracuy': ['San Felipe', 'Bolívar', 'Cocorote', 'Independencia', 'Manuel Monge', 'Nirgua', 'Páez', 'Peña', 'Sucre', 'Urachiche'],
}

interface Props {
  compitas: Compita[]
  usuarioNombre: string
  usuarioEmail: string
  backHref?: string
  backLabel?: string
}

export default function CompitasMarketplace({ compitas, usuarioNombre, usuarioEmail, backHref = '/dashboard', backLabel = '← Mi portal' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [estado, setEstadoState] = useState(searchParams.get('estado') ?? '')
  const [municipio, setMunicipioState] = useState(searchParams.get('municipio') ?? '')
  const [seleccionada, setSeleccionada] = useState<Compita | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState<string | null>(null)

  useEffect(() => { history.scrollRestoration = 'auto' }, [])

  function setEstado(v: string) {
    setEstadoState(v)
    const p = new URLSearchParams(searchParams.toString())
    p.set('estado', v)
    p.delete('municipio')
    router.replace(`/compitas?${p.toString()}`, { scroll: false })
  }

  function setMunicipio(v: string) {
    setMunicipioState(v)
    const p = new URLSearchParams(searchParams.toString())
    p.set('municipio', v)
    router.replace(`/compitas?${p.toString()}`, { scroll: false })
  }

  const zonaFiltro = estado && municipio ? `${estado} — ${municipio}` : ''

  const lista = zonaFiltro
    ? compitas.filter((c) => c.zona?.includes(zonaFiltro))
    : compitas

  async function meInteresa(compita: Compita) {
    setEnviando(true)
    try {
      await fetch('/api/me-interesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compita_id: compita.id, compita_nombre: compita.nombre }),
      })
      setEnviado(compita.id)
      setSeleccionada(null)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', fontFamily: 'Inter, sans-serif' }}>
      <nav style={{ background: '#2D1464', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'white', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '20px' }}>Compaz</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href={backHref} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', textDecoration: 'none' }}>{backLabel}</a>
          <LogoutButton />
        </div>
      </nav>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '28px', color: '#1A0A3C', marginBottom: '8px' }}>
          Encuentra tu Compita
        </h1>
        <p style={{ color: '#6B5C90', marginBottom: '32px', lineHeight: '1.6' }}>
          Selecciona la zona donde está tu familiar y te mostramos las Compitas disponibles en esa área.
        </p>

        {/* Selector de zona */}
        <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
          <p style={{ fontWeight: 700, color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: '16px' }}>
            ¿En qué zona está tu familiar?
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={s.label}>Estado</label>
              <select value={estado} onChange={(e) => { setEstado(e.target.value); setMunicipioState('') }} style={s.select}>
                <option value="">Seleccionar estado…</option>
                {Object.keys(ZONAS).sort().map((est) => (
                  <option key={est} value={est}>{est}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={s.label}>Municipio</label>
              <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} disabled={!estado} style={{ ...s.select, opacity: estado ? 1 : 0.5 }}>
                <option value="">Seleccionar municipio…</option>
                {(ZONAS[estado] ?? []).sort().map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Resultados */}
        {!zonaFiltro && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#6B5C90' }}>
            Selecciona un estado y municipio para ver las Compitas disponibles.
          </div>
        )}

        {zonaFiltro && lista.length === 0 && (
          <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#6B5C90', fontSize: '16px' }}>No hay Compitas disponibles en {zonaFiltro} por ahora.</p>
            <p style={{ color: '#4A3B6B', fontSize: '14px', marginTop: '8px' }}>Pronto habrá más Compitas en esta zona. Contáctanos para que te avisemos.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {lista.map((compita) => (
            <div
              key={compita.id}
              onClick={() => setSeleccionada(compita)}
              style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#FF6B2B')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E8E0D4')}
            >
              {compita.foto_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={compita.foto_url} alt={compita.nombre} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '200px', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>👤</div>
              }
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '18px', color: '#1A0A3C', margin: 0 }}>{compita.nombre}</h3>
                  {compita.verificado && <span style={s.badge}>✓ Verificada</span>}
                </div>
                {compita.descripcion && (
                  <p style={{ color: '#4A3B6B', fontSize: '14px', lineHeight: '1.5', marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {compita.descripcion}
                  </p>
                )}
                {compita.servicios && compita.servicios.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px' }}>
                    {compita.servicios.slice(0, 4).map((sv) => (
                      <span key={sv} style={s.chip}>{sv}</span>
                    ))}
                    {compita.servicios.length > 4 && <span style={s.chip}>+{compita.servicios.length - 4} más</span>}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6B5C90', fontSize: '13px' }}>{compita.visitas_realizadas} visitas</span>
                  {enviado === compita.id
                    ? <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: 700 }}>✓ Enviado</span>
                    : <span style={{ color: '#FF6B2B', fontSize: '13px', fontWeight: 700 }}>Ver perfil →</span>
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de perfil */}
      {seleccionada && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,60,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 100 }}
          onClick={(e) => { if (e.target === e.currentTarget) setSeleccionada(null) }}
        >
          <div style={{ background: '#FDFAF6', borderRadius: '24px', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setSeleccionada(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'white', border: '2px solid #E8E0D4', borderRadius: '9999px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', zIndex: 10 }}>×</button>

            {seleccionada.foto_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={seleccionada.foto_url} alt={seleccionada.nombre} style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '24px 24px 0 0' }} />
              : <div style={{ width: '100%', height: '180px', background: '#F5F0E8', borderRadius: '24px 24px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px' }}>👤</div>
            }

            <div style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '24px', color: '#1A0A3C', margin: 0 }}>{seleccionada.nombre}</h2>
                {seleccionada.verificado && <span style={s.badge}>✓ Verificada</span>}
              </div>

              <p style={{ color: '#6B5C90', fontSize: '13px', marginBottom: '20px' }}>
                {seleccionada.visitas_realizadas} visitas realizadas
              </p>

              {seleccionada.descripcion && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontWeight: 700, color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: '8px' }}>Sobre mí</p>
                  <p style={{ color: '#4A3B6B', fontSize: '15px', lineHeight: '1.7', whiteSpace: 'pre-line' }}>{seleccionada.descripcion}</p>
                </div>
              )}

              {seleccionada.servicios && seleccionada.servicios.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontWeight: 700, color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: '10px' }}>Servicios</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {seleccionada.servicios.map((sv) => (
                      <span key={sv} style={s.chip}>{sv}</span>
                    ))}
                  </div>
                </div>
              )}

              {seleccionada.zona && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontWeight: 700, color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: '10px' }}>Zonas que cubre</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {seleccionada.zona.split(',').map((z) => (
                      <span key={z} style={{ ...s.chip, background: '#EDE8FF', color: '#2D1464' }}>{z.trim()}</span>
                    ))}
                  </div>
                </div>
              )}

              {seleccionada.youtube_url && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontWeight: 700, color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: '10px' }}>Video de presentación</p>
                  <iframe
                    src={seleccionada.youtube_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                    style={{ width: '100%', height: '200px', borderRadius: '12px', border: 'none' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              {enviado === seleccionada.id ? (
                <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <p style={{ color: '#15803d', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', margin: 0 }}>
                    ✓ ¡Listo! El equipo de Compaz te contactará pronto para coordinar una llamada de presentación.
                  </p>
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => meInteresa(seleccionada)}
                    disabled={enviando}
                    style={{ width: '100%', background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', cursor: enviando ? 'not-allowed' : 'pointer', opacity: enviando ? 0.7 : 1 }}
                  >
                    {enviando ? 'Enviando…' : 'Me interesa esta Compita'}
                  </button>
                  <p style={{ color: '#6B5C90', fontSize: '13px', textAlign: 'center', marginTop: '10px' }}>
                    Te contactaremos para coordinar una llamada de presentación entre tú y {seleccionada.nombre}.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  label: { display: 'block', fontWeight: 600, fontSize: '13px', color: '#1A0A3C', marginBottom: '6px' } as React.CSSProperties,
  select: { width: '100%', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '10px 12px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1A0A3C', background: 'white', boxSizing: 'border-box' as const },
  badge: { background: 'white', border: '2px solid #E8E0D4', borderRadius: '9999px', padding: '2px 8px', fontSize: '11px', color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: '3px' },
  chip: { background: '#F5F0E8', color: '#4A3B6B', borderRadius: '9999px', padding: '4px 10px', fontSize: '12px', fontFamily: 'Bricolage Grotesque, sans-serif' } as React.CSSProperties,
}
