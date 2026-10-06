'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// ── Datos geográficos Venezuela ───────────────────────────────────────────────

const ZONAS: Record<string, string[]> = {
  'Distrito Capital': ['Libertador'],
  'Miranda': ['Baruta', 'Chacao', 'El Hatillo', 'Sucre', 'Guaicaipuro', 'Carrizal', 'Los Salias', 'Cristóbal Rojas', 'Lander', 'Paz Castillo', 'Urdaneta', 'Acevedo', 'Brión', 'Buroz', 'Páez', 'Pedro Gual', 'Independencia', 'Simón Bolívar', 'Zamora'],
  'Aragua': ['Girardot', 'Mario Briceño Iragorry', 'Ocumare de la Costa de Oro', 'Costa de Oro', 'Libertador', 'Sucre', 'Linares Alcántara', 'Francisco Linares Alcántara', 'Bolívar', 'Ribas', 'Santos Michelena', 'Zamora', 'Camatagua', 'San Casimiro', 'San Sebastián', 'Urdaneta'],
  'Carabobo': ['Valencia', 'Naguanagua', 'San Diego', 'Libertador', 'Los Guayos', 'Miranda', 'Montalbán', 'Puerto Cabello', 'Juan José Mora', 'Guacara', 'Diego Ibarra', 'Carlos Arvelo', 'Bejuma'],
  'Zulia': ['Maracaibo', 'San Francisco', 'Cabimas', 'Ciudad Ojeda', 'Lagunillas', 'Jesús Enrique Lossada', 'La Cañada de Urdaneta', 'Miranda', 'Mara', 'Páez', 'Rosario de Perijá', 'Machiques de Perijá', 'Colón', 'Catatumbo', 'Jesús María Semprún', 'Sucre', 'Valmore Rodríguez', 'Simón Bolívar', 'Santa Rita', 'Baralt'],
  'Lara': ['Iribarren', 'Andrés Eloy Blanco', 'Crespo', 'Jiménez', 'Morán', 'Palavecino', 'Simón Planas', 'Torres', 'Urdaneta'],
  'Mérida': ['Libertador', 'Campo Elías', 'Santos Marquina', 'Sucre', 'Rangel', 'Cardenal Quintero', 'Guaraque', 'Justo Briceño', 'Miranda', 'Obispo Ramos de Lora', 'Padre Noguera', 'Pueblo Llano', 'Rivas Dávila', 'Tovar', 'Tulio Febres Cordero', 'Arzobispo Chacón', 'Antonio Pinto Salinas', 'Aricagua', 'Zea', 'Caracciolo Parra Olmedo'],
  'Táchira': ['San Cristóbal', 'Torbes', 'Cárdenas', 'Guásimos', 'Fernández Feo', 'Libertad', 'Lobatera', 'Michelena', 'Panamericano', 'Junín', 'Bolívar', 'Pedro María Ureña', 'García de Hevia', 'Seboruco', 'Ayacucho', 'Córdoba', 'Sucre', 'Uribante', 'Libertador', 'Andrés Bello', 'Antonio Rómulo Costa', 'Francisco de Miranda', 'Jáuregui', 'Montes', 'Samuel Darío Maldonado', 'Simón Rodríguez'],
  'Bolívar': ['Caroní', 'Heres', 'Cedeño', 'El Callao', 'Gran Sabana', 'Padre Pedro Chien', 'Piar', 'Raúl Leoni', 'Roscio', 'Sifontes', 'Sucre'],
  'Anzoátegui': ['Simón Bolívar', 'Sotillo', 'Diego Bautista Urbaneja', 'Bruzual', 'Cajigal', 'Fernando de Peñalver', 'Francisco del Carmen Carvajal', 'Francisco Javier Freites', 'Guanipa', 'Guanta', 'Independencia', 'Juan Antonio Sotillo', 'Juan Manuel Cajigal', 'Libertad', 'McGregor', 'Miranda', 'Monagas', 'Peñalver', 'Píritu', 'Sir Arthur McGregor', 'Simón Rodríguez'],
  'Monagas': ['Maturín', 'Acosta', 'Aguasay', 'Bolívar', 'Caripe', 'Cedeño', 'Libertador', 'Piar', 'Punceres', 'Santa Bárbara', 'Sotillo', 'Uracoa', 'Ezequiel Zamora'],
  'Sucre': ['Sucre', 'Arismendi', 'Benítez', 'Bermúdez', 'Bolívar', 'Cajigal', 'Cruz Salmerón Acosta', 'Libertador', 'Mariño', 'Mejías', 'Montes', 'Ribero', 'Valdez'],
  'Falcón': ['Miranda', 'Acosta', 'Bolívar', 'Buchivacoa', 'Carirubana', 'Colina', 'Dabajuro', 'Democracia', 'Federación', 'Iturriza', 'Jacura', 'Los Taques', 'Mauroa', 'Palmasola', 'Petit', 'Piritu', 'San Francisco', 'Silva', 'Sucre', 'Tocópero', 'Unión', 'Urumaco', 'Zamora'],
  'Barinas': ['Barinas', 'Alberto Arvelo Torrealba', 'Andrés Eloy Blanco', 'Antonio José de Sucre', 'Arismendi', 'Bolívar', 'Cruz Paredes', 'Ezequiel Zamora', 'Obispos', 'Pedraza', 'Rojas', 'Sosa', 'Ticoporo'],
  'Portuguesa': ['Guanare', 'Araure', 'Acarigua', 'Esteller', 'Guanarito', 'José Vicente de Unda', 'Ospino', 'Páez', 'Papelón', 'San Genaro de Boconoíto', 'San Rafael de Onoto', 'Santa Rosalía', 'Sucre', 'Turén'],
  'Yaracuy': ['San Felipe', 'Bolívar', 'Bruzual', 'Cocorote', 'Independencia', 'La Trinidad', 'Manuel Monge', 'Nirgua', 'Páez', 'Peña', 'Sucre', 'Urachiche'],
  'Guárico': ['Juan Germán Roscio', 'Camaguán', 'Chaguaramas', 'El Socorro', 'Francisco de Miranda', 'José Félix Ribas', 'José Tadeo Monagas', 'Julian Mellado', 'Las Mercedes', 'Leonardo Infante', 'Mellado', 'Ortiz', 'San Gerónimo de Guayabal', 'San José de Guaribe', 'Santa María de Ipire', 'Zaraza'],
  'Cojedes': ['Tinaco', 'Anzoátegui', 'Girardot', 'Lima Blanco', 'Pao de San Juan Bautista', 'Ricaurte', 'Rómulo Gallegos', 'San Carlos', 'Tinaquillo'],
  'Apure': ['San Fernando', 'Achaguas', 'Biruaca', 'Muñoz', 'Páez', 'Pedro Camejo', 'Rómulo Gallegos'],
  'Trujillo': ['Trujillo', 'Andrés Bello', 'Bolívar', 'Boconó', 'Candelaria', 'Carache', 'Escuque', 'José Felipe Márquez Cañizales', 'La Ceiba', 'Miranda', 'Motatán', 'Monte Carmelo', 'Pampán', 'Pampanito', 'Rafael Rangel', 'San Rafael de Carvajal', 'Sucre', 'Urdaneta', 'Valera'],
  'Amazonas': ['Atures', 'Alto Orinoco', 'Autana', 'Manapiare', 'Maroa', 'Negro', 'Río Negro', 'Sipapo'],
  'Delta Amacuro': ['Tucupita', 'Antonio Díaz', 'Casacoima', 'Pedernales'],
  'Nueva Esparta': ['Mariño', 'Antolín del Campo', 'Arismendi', 'Díaz', 'García', 'Gómez', 'Macanao', 'Maneiro', 'Marcano', 'Tubores', 'Villalba'],
  'Vargas': ['Vargas'],
}

// ── Servicios ─────────────────────────────────────────────────────────────────

const SERVICIOS_GRUPOS = [
  {
    grupo: 'Compañía y ocio',
    items: [
      'Conversación y compañía',
      'Juegos de mesa y entretenimiento',
      'Lectura en voz alta',
      'Manualidades y actividades creativas',
      'Apoyo emocional',
      'Acompañamiento espiritual o religioso',
      'Ir a la iglesia o actividades de fe',
    ],
  },
  {
    grupo: 'Salidas y movilidad',
    items: [
      'Acompañamiento a citas y consultas',
      'Paseos y caminatas',
      'Compras y mandados',
      'Trámites y diligencias',
    ],
  },
  {
    grupo: 'Actividad física y bienestar',
    items: [
      'Ejercicio y movilidad adaptada',
      'Caminatas terapéuticas',
      'Yoga o meditación',
      'Fisioterapia (si tienes formación)',
      'Artes marciales o deporte adaptado (si tienes formación)',
    ],
  },
  {
    grupo: 'Alimentación',
    items: [
      'Preparación de comidas simples',
      'Acompañamiento a comer',
    ],
  },
]

// ── Componente ────────────────────────────────────────────────────────────────

function OnboardingForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const preview = searchParams.get('preview') === '1'

  const [step, setStep] = useState<'form' | 'telegram'>('form')
  const [tokenValido, setTokenValido] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const fotoRef = useRef<HTMLInputElement>(null)

  const [estado, setEstado] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [zonas, setZonas] = useState<string[]>([])
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    descripcion: '',
    servicios: [] as string[],
    habilidades: '',
    youtube_url: '',
  })

  // Disponibilidad horaria: día + rango en bloques de 1 hora (8:00–20:00 VE)
  type HorarioItem = { dia: string; inicio: string; fin: string }
  const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
  const BLOQUES_HORA = Array.from({ length: 13 }, (_, i) => {
    const h = 8 + i  // 08:00 … 20:00
    return `${String(h).padStart(2, '0')}:00`
  })

  const [horarios, setHorarios] = useState<HorarioItem[]>([])
  const [horarioDia, setHorarioDia] = useState('')
  const [horarioInicio, setHorarioInicio] = useState('08:00')
  const [horarioFin, setHorarioFin] = useState('17:00')

  const ORDEN_DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

  function agregarHorario() {
    if (!horarioDia || horarioInicio >= horarioFin) return
    setHorarios((prev) => {
      const nuevo = [...prev, { dia: horarioDia, inicio: horarioInicio, fin: horarioFin }]
      return nuevo.sort((a, b) => {
        const di = ORDEN_DIAS.indexOf(a.dia) - ORDEN_DIAS.indexOf(b.dia)
        return di !== 0 ? di : a.inicio.localeCompare(b.inicio)
      })
    })
    setHorarioDia('')
  }

  function aplicarATodos() {
    if (horarioInicio >= horarioFin) return
    setHorarios((prev) => {
      const nuevos = ORDEN_DIAS.filter((dia) =>
        !prev.some((h) => h.dia === dia && h.inicio === horarioInicio && h.fin === horarioFin)
      ).map((dia) => ({ dia, inicio: horarioInicio, fin: horarioFin }))
      const combinado = [...prev, ...nuevos]
      return combinado.sort((a, b) => {
        const di = ORDEN_DIAS.indexOf(a.dia) - ORDEN_DIAS.indexOf(b.dia)
        return di !== 0 ? di : a.inicio.localeCompare(b.inicio)
      })
    })
    setHorarioDia('')
  }

  function quitarHorario(idx: number) {
    setHorarios((prev) => prev.filter((_, i) => i !== idx))
  }

  function agregarZona() {
    if (!estado || !municipio) return
    const nueva = `${estado} — ${municipio}`
    if (!zonas.includes(nueva)) setZonas((prev) => [...prev, nueva])
    setMunicipio('')
  }

  function quitarZona(z: string) {
    setZonas((prev) => prev.filter((x) => x !== z))
  }

  useEffect(() => {
    if (preview) { setTokenValido(true); return }
    if (!token) { setTokenValido(false); return }
    fetch(`/api/onboarding/validar-token?token=${token}`)
      .then((r) => r.json())
      .then((d) => setTokenValido(d.valido ?? false))
      .catch(() => setTokenValido(false))
  }, [token, preview])

  function toggleServicio(s: string) {
    setForm((prev) => ({
      ...prev,
      servicios: prev.servicios.includes(s)
        ? prev.servicios.filter((x) => x !== s)
        : [...prev.servicios, s],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const faltantes: string[] = []
    if (!form.nombre) faltantes.push('nombre completo')
    if (!form.email) faltantes.push('correo electrónico')
    if (zonas.length === 0) faltantes.push('zona de cobertura')
    if (!form.descripcion) faltantes.push('descripción')
    if (form.servicios.length === 0) faltantes.push('al menos un servicio')
    if (faltantes.length > 0) {
      setErrorForm(`Faltan campos: ${faltantes.join(', ')}`)
      return
    }
    setErrorForm(null)
    setLoading(true)

    try {
      const zona = zonas.join(', ')
      const fotoFile = fotoRef.current?.files?.[0]
      let foto_url: string | null = null

      if (fotoFile) {
        const fd = new FormData()
        fd.append('foto', fotoFile)
        fd.append('nombre', form.nombre)
        fd.append('token', token)
        const uploadRes = await fetch('/api/onboarding/upload-foto', { method: 'POST', body: fd })
        const uploadData = await uploadRes.json()
        if (uploadData.url) foto_url = uploadData.url
      }

      const res = await fetch('/api/onboarding/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: form.nombre, email: form.email, descripcion: form.descripcion, servicios: form.servicios, habilidades: form.habilidades, youtube_url: form.youtube_url, zona, foto_url, token, horarios_disponibles: horarios }),
      })

      if (res.ok) {
        setStep('telegram')
      } else {
        const d = await res.json()
        setErrorForm(d.error ?? 'Error al registrar')
      }
    } finally {
      setLoading(false)
    }
  }

  if (tokenValido === null) {
    return <div style={s.center}><p style={{ color: '#6B5C90', fontFamily: 'Inter, sans-serif' }}>Verificando invitación…</p></div>
  }

  if (tokenValido === false) {
    return (
      <div style={s.center}>
        <div style={s.card}>
          <h2 style={s.h2}>Enlace inválido o expirado</h2>
          <p style={{ color: '#6B5C90', marginTop: '8px' }}>Este enlace no es válido o ya fue utilizado. Pídele al equipo Compaz un nuevo enlace.</p>
        </div>
      </div>
    )
  }

  if (step === 'telegram') {
    return (
      <div style={s.center}>
        <div style={{ ...s.card, maxWidth: '520px' }}>
          <h2 style={s.h2}>¡Ya eres parte de Compaz!</h2>
          <p style={{ color: '#6B5C90', marginTop: '8px', marginBottom: '16px', lineHeight: '1.7' }}>
            Tu perfil fue creado exitosamente. Falta un paso importante:
          </p>
          <div style={{ background: '#FFF3E8', border: '2px solid #FF6B2B', borderRadius: '14px', padding: '16px 20px', marginBottom: '24px' }}>
            <p style={{ color: '#C84B0E', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: '15px', margin: '0 0 6px' }}>
              ⚠️ Tu perfil no aparece para los clientes todavía
            </p>
            <p style={{ color: '#7A3A0A', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
              Para que los clientes puedan encontrarte y contactarte, debes conectar Telegram. Sin eso, tu perfil permanece invisible en el sistema.
            </p>
          </div>

          <div style={{ ...s.infoBox, marginBottom: '16px' }}>
            <p style={{ fontWeight: 700, color: '#1A0A3C', marginBottom: '16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: '15px' }}>Paso 1 — Descarga Telegram (si aún no lo tienes)</p>
            <p style={{ color: '#4A3B6B', fontSize: '13px', lineHeight: '1.7', marginBottom: '12px' }}>
              Telegram es una aplicación gratuita de mensajería, como WhatsApp. Si ya la tienes instalada, pasa al paso 2.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a href="https://apps.apple.com/app/telegram-messenger/id686449807" target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, minWidth: '140px', background: '#1A0A3C', color: 'white', borderRadius: '10px', padding: '10px 14px', textDecoration: 'none', fontSize: '13px', fontWeight: 600, textAlign: 'center' as const }}>
                Descargar en iPhone (App Store)
              </a>
              <a href="https://play.google.com/store/apps/details?id=org.telegram.messenger" target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, minWidth: '140px', background: '#1A0A3C', color: 'white', borderRadius: '10px', padding: '10px 14px', textDecoration: 'none', fontSize: '13px', fontWeight: 600, textAlign: 'center' as const }}>
                Descargar en Android (Play Store)
              </a>
            </div>
          </div>

          <div style={{ ...s.infoBox, marginBottom: '24px' }}>
            <p style={{ fontWeight: 700, color: '#1A0A3C', marginBottom: '16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: '15px' }}>Paso 2 — Abre el bot de Compaz</p>
            <ol style={{ paddingLeft: '20px', color: '#4A3B6B', lineHeight: '1', margin: 0 }}>
              <li style={{ marginBottom: '14px' }}>
                <strong>Toca el botón naranja de abajo</strong> — te abrirá directamente el chat del bot dentro de Telegram.
              </li>
              <li style={{ marginBottom: '14px' }}>
                Cuando abra el chat, toca el botón verde que dice <strong>«Iniciar»</strong> (o escribe <code style={s.code}>/start</code> y envíalo).
              </li>
              <li style={{ marginBottom: '14px' }}>
                El bot te preguntará tu nombre. Escríbelo <strong>exactamente igual</strong> a como lo pusiste en el formulario y envíalo.
              </li>
              <li>
                Listo — recibirás un mensaje de confirmación y ya estarás conectada.
              </li>
            </ol>
          </div>

          <a href="https://t.me/CompazVisitasBot?start=onboarding" target="_blank" rel="noopener noreferrer" style={s.btnPrimary}>
            Abrir bot en Telegram
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', fontFamily: 'Inter, sans-serif' }}>
      <nav style={s.nav}>
        <span style={s.logo}>Compaz</span>
        <span style={s.badge}>Registro de Compita</span>
      </nav>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 20px 80px' }}>
        <h1 style={s.h1}>Bienvenida a Compaz</h1>
        <p style={{ color: '#6B5C90', marginBottom: '32px', lineHeight: '1.6' }}>
          Completa tu perfil para empezar a recibir visitas. Solo toma unos minutos.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Nombre */}
          <div>
            <label style={s.label}>Nombre completo *</label>
            <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} style={s.input} placeholder="Tu nombre y apellido" />
          </div>

          {/* Email */}
          <div>
            <label style={s.label}>Correo electrónico *</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={s.input} placeholder="tu@correo.com" />
            <p style={s.hint}>Lo usaremos para enviarte el código de verificación al activar tu cuenta en Telegram.</p>
          </div>

          {/* Zonas — múltiples */}
          <div>
            <label style={s.label}>Zonas que puedes cubrir *</label>
            <p style={s.hint}>Agrega todos los municipios donde puedes ir. Los clientes verán si cubres su zona antes de contactarte.</p>

            {/* Chips de zonas agregadas */}
            {zonas.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {zonas.map((z) => (
                  <span key={z} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2D1464', color: 'white', borderRadius: '9999px', padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}>
                    {z}
                    <button type="button" onClick={() => quitarZona(z)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
              <div>
                <label style={{ ...s.label, fontSize: '12px', marginBottom: '4px' }}>Estado</label>
                <select value={estado} onChange={(e) => { setEstado(e.target.value); setMunicipio('') }} style={s.input}>
                  <option value="">Seleccionar…</option>
                  {Object.keys(ZONAS).sort().map((est) => (
                    <option key={est} value={est}>{est}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ ...s.label, fontSize: '12px', marginBottom: '4px' }}>Municipio</label>
                <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} disabled={!estado} style={{ ...s.input, opacity: estado ? 1 : 0.5 }}>
                  <option value="">Seleccionar…</option>
                  {(ZONAS[estado] ?? []).sort().map((mun) => (
                    <option key={mun} value={mun}>{mun}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={agregarZona}
                disabled={!estado || !municipio}
                style={{ background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: estado && municipio ? 'pointer' : 'not-allowed', opacity: estado && municipio ? 1 : 0.4, whiteSpace: 'nowrap' }}
              >
                + Agregar
              </button>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label style={s.label}>Sobre ti *</label>
            <textarea
              required
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              style={{ ...s.input, minHeight: '110px', resize: 'vertical' }}
              placeholder="Cuéntanos quién eres: a qué te dedicas, qué has hecho, qué te mueve, qué disfrutas hacer…"
            />
          </div>

          {/* Servicios */}
          <div>
            <label style={s.label}>Servicios que ofreces * <span style={{ fontWeight: 400, color: '#6B5C90' }}>(selecciona todos los que apliquen)</span></label>
            <p style={s.hint}>Cuantos más servicios marques de forma honesta, más visitas podrás recibir.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
              {SERVICIOS_GRUPOS.map(({ grupo, items }) => (
                <div key={grupo}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#4A3B6B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{grupo}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {items.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleServicio(item)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '9999px',
                          border: `2px solid ${form.servicios.includes(item) ? '#FF6B2B' : 'rgba(45,20,100,0.2)'}`,
                          background: form.servicios.includes(item) ? '#FF6B2B' : 'white',
                          color: form.servicios.includes(item) ? 'white' : '#4A3B6B',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '13px',
                          cursor: 'pointer',
                          fontWeight: form.servicios.includes(item) ? 700 : 400,
                          transition: 'all 0.15s',
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Habilidades especiales */}
          <div>
            <label style={s.label}>¿Tienes alguna habilidad o formación especial? <span style={{ fontWeight: 400, color: '#6B5C90' }}>(opcional)</span></label>
            <p style={s.hint}>Por ejemplo: fisioterapeuta, maestra, músico, cocinera, hablas otro idioma, conoces artes marciales… Lo que te hace única.</p>
            <textarea
              value={form.habilidades}
              onChange={(e) => setForm({ ...form, habilidades: e.target.value })}
              style={{ ...s.input, minHeight: '80px', resize: 'vertical' }}
              placeholder="Soy licenciada en educación, toco guitarra y hablo inglés básico…"
            />
          </div>

          {/* Foto */}
          <div>
            <label style={s.label}>Foto de perfil</label>
            <p style={s.hint}>Una foto clara de tu rostro genera más confianza en las familias. Usa buena iluminación y fondo simple.</p>

            {/* Ejemplo visual foto */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', marginTop: '8px' }}>
              <div style={{ flex: 1, background: 'white', border: '2px solid #D4EDDA', borderRadius: '12px', overflow: 'hidden' as const }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/ejemplo-foto-perfil.webp" alt="Ejemplo foto buena" style={{ width: '100%', maxHeight: '160px', objectFit: 'contain', display: 'block', background: '#f5f5f5' }} />
                <div style={{ padding: '8px 10px' }}>
                  <p style={{ fontSize: '11px', color: '#2E7D32', fontWeight: 700, margin: '0 0 2px' }}>✅ Así sí</p>
                  <p style={{ fontSize: '11px', color: '#4A3B6B', margin: 0, lineHeight: '1.4' }}>Rostro centrado, fondo claro, buena luz</p>
                </div>
              </div>
              <div style={{ flex: 1, background: 'white', border: '2px solid #FFCDD2', borderRadius: '12px', overflow: 'hidden' as const }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/ejemplo-foto-perfil.webp" alt="Ejemplo foto mala" style={{ width: '100%', maxHeight: '160px', objectFit: 'contain', display: 'block', background: '#111', filter: 'brightness(0.25) contrast(0.8)' }} />
                <div style={{ padding: '8px 10px' }}>
                  <p style={{ fontSize: '11px', color: '#C62828', fontWeight: 700, margin: '0 0 2px' }}>❌ Así no</p>
                  <p style={{ fontSize: '11px', color: '#4A3B6B', margin: 0, lineHeight: '1.4' }}>Oscura, cara sin ver, fondo desordenado</p>
                </div>
              </div>
            </div>

            <div
              onClick={() => fotoRef.current?.click()}
              style={{
                border: '2px dashed rgba(45,20,100,0.3)',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'white',
                marginTop: '8px',
              }}
            >
              {fotoPreview
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={fotoPreview} alt="preview" style={{ maxHeight: '160px', borderRadius: '12px', margin: '0 auto', display: 'block' }} />
                : <p style={{ color: '#6B5C90', fontSize: '14px', margin: 0 }}>Haz clic para subir tu foto (JPG, PNG)</p>
              }
            </div>
            <input ref={fotoRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const reader = new FileReader()
                reader.onload = (ev) => setFotoPreview(ev.target?.result as string)
                reader.readAsDataURL(f)
              }}
            />
          </div>

          {/* Disponibilidad horaria */}
          <div>
            <label style={s.label}>¿Cuándo puedes recibir llamadas de presentación? *</label>
            <p style={s.hint}>Los clientes elegirán una hora dentro de tu disponibilidad para coordinar una llamada de 20 minutos. Horario Venezuela (hora local). Bloques de 20 min, hasta las 8:00 PM.</p>

            {horarios.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {horarios.map((h, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#EDE8FF', borderRadius: '10px', padding: '10px 14px' }}>
                    <span style={{ flex: 1, color: '#2D1464', fontWeight: 700, textTransform: 'capitalize', fontSize: '14px' }}>{h.dia}</span>
                    <span style={{ color: '#4A3B6B', fontSize: '13px' }}>{h.inicio} – {h.fin}</span>
                    <button type="button" onClick={() => quitarHorario(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B5C90', fontSize: '18px', lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
              <div>
                <label style={{ ...s.label, fontSize: '12px', marginBottom: '4px' }}>Día</label>
                <select value={horarioDia} onChange={(e) => setHorarioDia(e.target.value)} style={s.input}>
                  <option value="">Seleccionar…</option>
                  {DIAS_SEMANA.map((d) => (
                    <option key={d} value={d} style={{ textTransform: 'capitalize' }}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ ...s.label, fontSize: '12px', marginBottom: '4px' }}>Desde</label>
                <select value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} style={s.input}>
                  {BLOQUES_HORA.slice(0, -1).map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...s.label, fontSize: '12px', marginBottom: '4px' }}>Hasta</label>
                <select value={horarioFin} onChange={(e) => setHorarioFin(e.target.value)} style={s.input}>
                  {BLOQUES_HORA.filter((h) => h > horarioInicio).map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={agregarHorario}
                disabled={!horarioDia || horarioInicio >= horarioFin}
                style={{ background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: horarioDia ? 'pointer' : 'not-allowed', opacity: horarioDia ? 1 : 0.4, whiteSpace: 'nowrap' }}
              >
                + Agregar
              </button>
            </div>
            {horarioInicio < horarioFin && (
              <button
                type="button"
                onClick={aplicarATodos}
                style={{ marginTop: '8px', background: 'none', border: '2px solid rgba(45,20,100,0.25)', borderRadius: '10px', padding: '8px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 600, fontSize: '13px', color: '#4A3B6B', cursor: 'pointer' }}
              >
                Aplicar este horario a todos los días
              </button>
            )}
          </div>

          {/* YouTube */}
          <div style={{ background: '#F5F0FF', border: '2px solid rgba(45,20,100,0.12)', borderRadius: '16px', padding: '20px' }}>
            <label style={{ ...s.label, marginBottom: '4px' }}>Video de presentación en YouTube <span style={{ fontWeight: 400, color: '#6B5C90' }}>(opcional pero muy recomendado)</span></label>
            <p style={{ color: '#4A3B6B', fontSize: '13px', lineHeight: '1.6', marginBottom: '12px' }}>
              Este video es lo primero que ve el cliente antes de elegirte. Preséntate, cuenta quién eres y muestra tu personalidad. Entre <strong>1 y 1:30 minutos</strong> es suficiente — máximo 2:30. Un buen video puede <strong>triplicar</strong> las probabilidades de que una familia te elija.
            </p>
            {/* Ejemplo visual video */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1, background: 'white', border: '2px solid #D4EDDA', borderRadius: '12px', overflow: 'hidden' as const }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/ejemplo-video.webp" alt="Ejemplo video vertical" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', display: 'block', background: '#f0ece8' }} />
                <div style={{ padding: '8px 10px' }}>
                  <p style={{ fontSize: '11px', color: '#2E7D32', fontWeight: 700, margin: '0 0 2px' }}>✅ Así sí — vertical, buena luz</p>
                  <p style={{ fontSize: '11px', color: '#4A3B6B', margin: 0, lineHeight: '1.4' }}>Teléfono parado, cara visible, fondo simple</p>
                </div>
              </div>
              <div style={{ flex: 1, background: '#F8F8F8', border: '2px solid #FFCDD2', borderRadius: '12px', overflow: 'hidden' as const }}>
                <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222' }}>
                  <div style={{ width: '140px', height: '80px', background: '#444', borderRadius: '6px', border: '2px solid #666', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' as const }}>
                    <span style={{ fontSize: '28px' }}>😊</span>
                    <div style={{ position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: 'white', fontSize: '24px' }}>❌</span>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <p style={{ fontSize: '11px', color: '#C62828', fontWeight: 700, margin: '0 0 2px' }}>❌ Así no — horizontal</p>
                  <p style={{ fontSize: '11px', color: '#4A3B6B', margin: 0, lineHeight: '1.4' }}>Sale con barras negras arriba y abajo</p>
                </div>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '12px', padding: '14px 16px', marginBottom: '14px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#1A0A3C', marginBottom: '8px' }}>Tips para grabar tu video:</p>
              <ul style={{ fontSize: '13px', color: '#4A3B6B', paddingLeft: '18px', lineHeight: '1.9', margin: 0 }}>
                <li>Graba en una zona bien iluminada, preferiblemente con luz natural</li>
                <li>Habla con calma, mira directo a la cámara y sonríe</li>
                <li>Evita ruido de fondo: apaga el televisor y cierra puertas</li>
                <li>Viste ropa limpia y ordenada, como si fuera a una entrevista</li>
                <li>Di tu nombre, cuéntanos quién eres y por qué serías una buena compañía</li>
                <li>Sube el video a YouTube como «No listado» <span style={{ color: '#6B5C90', fontWeight: 400 }}>(significa que solo quien tenga el link puede verlo — no aparece en búsquedas)</span> y pega el enlace aquí</li>
              </ul>
            </div>
            <input
              value={form.youtube_url}
              onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
              style={s.input}
              placeholder="https://youtube.com/watch?v=..."
              type="url"
            />
          </div>

          {!loading && (form.servicios.length === 0 || zonas.length === 0) && (
            <div style={{ background: '#FFF3CD', border: '1px solid #FFCC00', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: '#7A5800', lineHeight: '1.6' }}>
              Para continuar necesitas:
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                {zonas.length === 0 && <li>Agregar al menos una <strong>zona de trabajo</strong></li>}
                {form.servicios.length === 0 && <li>Seleccionar al menos un <strong>servicio</strong></li>}
              </ul>
            </div>
          )}
          {errorForm && (
            <div style={{ background: '#FEF2F2', border: '2px solid #FCA5A5', borderRadius: '12px', padding: '12px 16px', color: '#B91C1C', fontSize: '14px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
              ⚠️ {errorForm}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || form.servicios.length === 0 || zonas.length === 0}
            style={{
              ...s.btnPrimary,
              opacity: (loading || form.servicios.length === 0 || zonas.length === 0) ? 0.5 : 1,
              cursor: (loading || form.servicios.length === 0 || zonas.length === 0) ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Registrando…' : 'Crear mi perfil'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div style={s.center}><p style={{ color: '#6B5C90', fontFamily: 'Inter, sans-serif' }}>Cargando…</p></div>}>
      <OnboardingForm />
    </Suspense>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = {
  center: { minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
  card: { background: 'white', border: '2px solid #E8E0D4', borderRadius: '24px', padding: '40px', textAlign: 'center' as const },
  nav: { background: '#1A0A3C', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  logo: { color: 'white', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '20px' } as React.CSSProperties,
  badge: { background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '4px 12px', fontSize: '13px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif' } as React.CSSProperties,
  h1: { fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '28px', color: '#1A0A3C' } as React.CSSProperties,
  h2: { fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px', color: '#1A0A3C' } as React.CSSProperties,
  label: { display: 'block', fontWeight: 600, fontSize: '14px', color: '#1A0A3C', marginBottom: '6px' } as React.CSSProperties,
  hint: { color: '#6B5C90', fontSize: '13px', marginBottom: '10px', lineHeight: '1.5', marginTop: '2px' } as React.CSSProperties,
  input: { width: '100%', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '12px 14px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', boxSizing: 'border-box' as const, outline: 'none' },
  btnPrimary: { display: 'block', width: '100%', background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', cursor: 'pointer', textDecoration: 'none', textAlign: 'center' as const } as React.CSSProperties,
  infoBox: { background: '#F5F0FF', border: '2px solid rgba(45,20,100,0.15)', borderRadius: '16px', padding: '20px', marginBottom: '24px', textAlign: 'left' as const } as React.CSSProperties,
  code: { background: '#1A0A3C', color: 'white', borderRadius: '6px', padding: '2px 8px', fontFamily: 'monospace', fontSize: '14px' } as React.CSSProperties,
}
