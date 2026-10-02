'use client'

import { useState, useRef } from 'react'

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

// ── Tipos ─────────────────────────────────────────────────────────────────────

type HorarioItem = { dia: string; inicio: string; fin: string }

const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const BLOQUES_HORA = Array.from({ length: 43 }, (_, i) => {
  const totalMin = 6 * 60 + i * 20
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

interface Props {
  token: string
  inicial: {
    nombre: string
    zona: string
    descripcion: string
    servicios: string[]
    youtube_url: string
    foto_url: string
    horarios_disponibles: HorarioItem[]
  }
}

// Convierte "Estado — Municipio, Estado — Municipio" → array de chips
function zonaStringToChips(zona: string): string[] {
  if (!zona) return []
  return zona.split(',').map(z => z.trim()).filter(Boolean)
}

export default function EditarPerfil({ token, inicial }: Props) {
  const fotoRef = useRef<HTMLInputElement>(null)

  const [zonas, setZonas] = useState<string[]>(zonaStringToChips(inicial.zona))
  const [estadoSel, setEstadoSel] = useState('')
  const [municipioSel, setMunicipioSel] = useState('')

  const [descripcion, setDescripcion] = useState(inicial.descripcion)
  const [servicios, setServicios] = useState<string[]>(inicial.servicios)
  const [habilidades, setHabilidades] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState(inicial.youtube_url)
  const [fotoUrl, setFotoUrl] = useState(inicial.foto_url)
  const [fotoPreview, setFotoPreview] = useState<string | null>(inicial.foto_url || null)

  const [horarios, setHorarios] = useState<HorarioItem[]>(inicial.horarios_disponibles)
  const [horarioDia, setHorarioDia] = useState('')
  const [horarioInicio, setHorarioInicio] = useState('09:00')
  const [horarioFin, setHorarioFin] = useState('17:00')

  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  // ── Zonas ──────────────────────────────────────────────────────────────────

  function agregarZona() {
    if (!estadoSel || !municipioSel) return
    const nueva = `${estadoSel} — ${municipioSel}`
    if (!zonas.includes(nueva)) setZonas(prev => [...prev, nueva])
    setMunicipioSel('')
  }

  function quitarZona(z: string) {
    setZonas(prev => prev.filter(x => x !== z))
  }

  // ── Servicios ──────────────────────────────────────────────────────────────

  function toggleServicio(s: string) {
    setServicios(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  // ── Horarios ───────────────────────────────────────────────────────────────

  function agregarHorario() {
    if (!horarioDia || horarioInicio >= horarioFin) return
    setHorarios(prev => {
      const nuevo = [...prev, { dia: horarioDia, inicio: horarioInicio, fin: horarioFin }]
      return nuevo.sort((a, b) => {
        const di = DIAS_SEMANA.indexOf(a.dia) - DIAS_SEMANA.indexOf(b.dia)
        return di !== 0 ? di : a.inicio.localeCompare(b.inicio)
      })
    })
    setHorarioDia('')
  }

  function aplicarATodos() {
    if (horarioInicio >= horarioFin) return
    setHorarios(prev => {
      const nuevos = DIAS_SEMANA.filter(dia =>
        !prev.some(h => h.dia === dia && h.inicio === horarioInicio && h.fin === horarioFin)
      ).map(dia => ({ dia, inicio: horarioInicio, fin: horarioFin }))
      return [...prev, ...nuevos].sort((a, b) => {
        const di = DIAS_SEMANA.indexOf(a.dia) - DIAS_SEMANA.indexOf(b.dia)
        return di !== 0 ? di : a.inicio.localeCompare(b.inicio)
      })
    })
    setHorarioDia('')
  }

  function quitarHorario(idx: number) {
    setHorarios(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Foto ───────────────────────────────────────────────────────────────────

  async function subirFoto(file: File) {
    setSubiendo(true)
    setErrorForm(null)
    try {
      const fd = new FormData()
      fd.append('foto', file)
      fd.append('token', token)
      const res = await fetch('/api/compita/upload-foto', { method: 'POST', body: fd })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Error al subir foto')
      setFotoUrl(data.url)
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : 'Error al subir foto')
    } finally {
      setSubiendo(false)
    }
  }

  // ── Guardar ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const faltantes: string[] = []
    if (zonas.length === 0) faltantes.push('zona de cobertura')
    if (!descripcion) faltantes.push('descripción')
    if (servicios.length === 0) faltantes.push('al menos un servicio')
    if (faltantes.length > 0) {
      setErrorForm(`Faltan campos: ${faltantes.join(', ')}`)
      return
    }
    setErrorForm(null)
    setGuardando(true)
    try {
      const zona = zonas.join(', ')
      const res = await fetch('/api/compita/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, zona, descripcion, servicios, habilidades: habilidades || null, youtube_url: youtubeUrl || null, foto_url: fotoUrl || null, horarios_disponibles: horarios }),
      })
      const data = await res.json() as { guardado?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      setGuardado(true)
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // ── Pantalla de éxito ──────────────────────────────────────────────────────

  if (guardado) {
    return (
      <div style={{ ...s.card, textAlign: 'center', padding: '40px 24px' }}>
        <h2 style={s.h2}>¡Perfil actualizado!</h2>
        <p style={{ color: '#6B5C90', marginTop: '8px', lineHeight: 1.6 }}>
          Tus cambios ya están publicados. Si necesitas editar de nuevo, escribe <strong>/perfil</strong> en Telegram para obtener un nuevo enlace.
        </p>
      </div>
    )
  }

  // ── Formulario ─────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Nombre (solo lectura) */}
      <div>
        <label style={s.label}>Nombre completo</label>
        <input value={inicial.nombre} readOnly style={{ ...s.input, background: '#F5F0E8', color: '#6B5C90', cursor: 'not-allowed' }} />
        <p style={s.hint}>Para cambiar tu nombre contacta al equipo de Compaz.</p>
      </div>

      {/* Zonas */}
      <div>
        <label style={s.label}>Zonas que puedes cubrir *</label>
        <p style={s.hint}>Agrega todos los municipios donde puedes ir. Los clientes verán si cubres su zona antes de contactarte.</p>

        {zonas.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {zonas.map(z => (
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
            <select value={estadoSel} onChange={e => { setEstadoSel(e.target.value); setMunicipioSel('') }} style={s.input}>
              <option value="">Seleccionar…</option>
              {Object.keys(ZONAS).sort().map(est => <option key={est} value={est}>{est}</option>)}
            </select>
          </div>
          <div>
            <label style={{ ...s.label, fontSize: '12px', marginBottom: '4px' }}>Municipio</label>
            <select value={municipioSel} onChange={e => setMunicipioSel(e.target.value)} disabled={!estadoSel} style={{ ...s.input, opacity: estadoSel ? 1 : 0.5 }}>
              <option value="">Seleccionar…</option>
              {(ZONAS[estadoSel] ?? []).sort().map(mun => <option key={mun} value={mun}>{mun}</option>)}
            </select>
          </div>
          <button type="button" onClick={agregarZona} disabled={!estadoSel || !municipioSel}
            style={{ background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: estadoSel && municipioSel ? 'pointer' : 'not-allowed', opacity: estadoSel && municipioSel ? 1 : 0.4, whiteSpace: 'nowrap' }}>
            + Agregar
          </button>
        </div>
      </div>

      {/* Descripción */}
      <div>
        <label style={s.label}>Sobre ti *</label>
        <textarea required value={descripcion} onChange={e => setDescripcion(e.target.value)}
          style={{ ...s.input, minHeight: '110px', resize: 'vertical' }}
          placeholder="Cuéntanos tu experiencia, cuánto tiempo llevas en el cuidado, qué es lo que más te apasiona de este trabajo…" />
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
                {items.map(item => (
                  <button key={item} type="button" onClick={() => toggleServicio(item)}
                    style={{
                      padding: '7px 14px', borderRadius: '9999px',
                      border: `2px solid ${servicios.includes(item) ? '#FF6B2B' : 'rgba(45,20,100,0.2)'}`,
                      background: servicios.includes(item) ? '#FF6B2B' : 'white',
                      color: servicios.includes(item) ? 'white' : '#4A3B6B',
                      fontFamily: 'Inter, sans-serif', fontSize: '13px', cursor: 'pointer',
                      fontWeight: servicios.includes(item) ? 700 : 400,
                    }}>
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
        <textarea value={habilidades} onChange={e => setHabilidades(e.target.value)}
          style={{ ...s.input, minHeight: '80px', resize: 'vertical' }}
          placeholder="Soy licenciada en educación, toco guitarra y hablo inglés básico…" />
      </div>

      {/* Foto */}
      <div>
        <label style={s.label}>Foto de perfil</label>
        <p style={s.hint}>Una foto clara de tu rostro genera más confianza en las familias. Usa buena iluminación y fondo simple.</p>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', marginTop: '8px' }}>
          <div style={{ flex: 1, background: 'white', border: '2px solid #D4EDDA', borderRadius: '12px', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/ejemplo-foto-perfil.webp" alt="Ejemplo foto buena" style={{ width: '100%', maxHeight: '160px', objectFit: 'contain', display: 'block', background: '#f5f5f5' }} />
            <div style={{ padding: '8px 10px' }}>
              <p style={{ fontSize: '11px', color: '#2E7D32', fontWeight: 700, margin: '0 0 2px' }}>✅ Así sí</p>
              <p style={{ fontSize: '11px', color: '#4A3B6B', margin: 0, lineHeight: '1.4' }}>Rostro centrado, fondo claro, buena luz</p>
            </div>
          </div>
          <div style={{ flex: 1, background: 'white', border: '2px solid #FFCDD2', borderRadius: '12px', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/ejemplo-foto-perfil.webp" alt="Ejemplo foto mala" style={{ width: '100%', maxHeight: '160px', objectFit: 'contain', display: 'block', background: '#111', filter: 'brightness(0.25) contrast(0.8)' }} />
            <div style={{ padding: '8px 10px' }}>
              <p style={{ fontSize: '11px', color: '#C62828', fontWeight: 700, margin: '0 0 2px' }}>❌ Así no</p>
              <p style={{ fontSize: '11px', color: '#4A3B6B', margin: 0, lineHeight: '1.4' }}>Oscura, cara sin ver, fondo desordenado</p>
            </div>
          </div>
        </div>

        <div onClick={() => fotoRef.current?.click()}
          style={{ border: '2px dashed rgba(45,20,100,0.3)', borderRadius: '16px', padding: '24px', textAlign: 'center', cursor: 'pointer', background: 'white', marginTop: '8px' }}>
          {fotoPreview
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={fotoPreview} alt="preview" style={{ maxHeight: '160px', borderRadius: '12px', margin: '0 auto', display: 'block' }} />
            : <p style={{ color: '#6B5C90', fontSize: '14px', margin: 0 }}>{subiendo ? 'Subiendo…' : 'Haz clic para subir tu foto (JPG, PNG)'}</p>
          }
        </div>
        <input ref={fotoRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (!f) return
            const reader = new FileReader()
            reader.onload = ev => setFotoPreview(ev.target?.result as string)
            reader.readAsDataURL(f)
            subirFoto(f)
          }} />
      </div>

      {/* Horarios */}
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
            <select value={horarioDia} onChange={e => setHorarioDia(e.target.value)} style={s.input}>
              <option value="">Seleccionar…</option>
              {DIAS_SEMANA.map(d => <option key={d} value={d} style={{ textTransform: 'capitalize' }}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ ...s.label, fontSize: '12px', marginBottom: '4px' }}>Desde</label>
            <select value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} style={s.input}>
              {BLOQUES_HORA.slice(0, -1).map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label style={{ ...s.label, fontSize: '12px', marginBottom: '4px' }}>Hasta</label>
            <select value={horarioFin} onChange={e => setHorarioFin(e.target.value)} style={s.input}>
              {BLOQUES_HORA.filter(h => h > horarioInicio).map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <button type="button" onClick={agregarHorario} disabled={!horarioDia || horarioInicio >= horarioFin}
            style={{ background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: horarioDia ? 'pointer' : 'not-allowed', opacity: horarioDia ? 1 : 0.4, whiteSpace: 'nowrap' }}>
            + Agregar
          </button>
        </div>
        {horarioInicio < horarioFin && (
          <button type="button" onClick={aplicarATodos}
            style={{ marginTop: '8px', background: 'none', border: '2px solid rgba(45,20,100,0.25)', borderRadius: '10px', padding: '8px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 600, fontSize: '13px', color: '#4A3B6B', cursor: 'pointer' }}>
            Aplicar este horario a todos los días
          </button>
        )}
      </div>

      {/* YouTube */}
      <div style={{ background: '#F5F0FF', border: '2px solid rgba(45,20,100,0.12)', borderRadius: '16px', padding: '20px' }}>
        <label style={{ ...s.label, marginBottom: '4px' }}>Video de presentación en YouTube <span style={{ fontWeight: 400, color: '#6B5C90' }}>(opcional pero muy recomendado)</span></label>
        <p style={{ color: '#4A3B6B', fontSize: '13px', lineHeight: '1.6', marginBottom: '12px' }}>
          Un video de máximo <strong>60 segundos</strong> donde te presentas y hablas de tu experiencia puede <strong>triplicar</strong> las probabilidades de que una familia te elija.
        </p>
        <div style={{ background: 'white', borderRadius: '12px', padding: '14px 16px', marginBottom: '14px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#1A0A3C', marginBottom: '8px' }}>Tips para grabar tu video:</p>
          <ul style={{ fontSize: '13px', color: '#4A3B6B', paddingLeft: '18px', lineHeight: '1.9', margin: 0 }}>
            <li>Graba en una zona bien iluminada, preferiblemente con luz natural</li>
            <li>Habla con calma, mira directo a la cámara y sonríe</li>
            <li>Evita ruido de fondo: apaga el televisor y cierra puertas</li>
            <li>Viste ropa limpia y ordenada, como si fuera a una entrevista</li>
            <li>Di tu nombre, tu experiencia y por qué te apasiona el cuidado</li>
            <li>Sube el video a YouTube como «No listado» <span style={{ color: '#6B5C90', fontWeight: 400 }}>(solo quien tenga el link puede verlo)</span> y pega el enlace aquí</li>
          </ul>
        </div>
        <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
          style={s.input} placeholder="https://youtube.com/watch?v=..." type="url" />
      </div>

      {/* Validación visible */}
      {!guardando && (servicios.length === 0 || zonas.length === 0) && (
        <div style={{ background: '#FFF3CD', border: '1px solid #FFCC00', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: '#7A5800', lineHeight: '1.6' }}>
          Para continuar necesitas:
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            {zonas.length === 0 && <li>Agregar al menos una <strong>zona de trabajo</strong></li>}
            {servicios.length === 0 && <li>Seleccionar al menos un <strong>servicio</strong></li>}
          </ul>
        </div>
      )}

      {errorForm && (
        <div style={{ background: '#FEF2F2', border: '2px solid #FCA5A5', borderRadius: '12px', padding: '12px 16px', color: '#B91C1C', fontSize: '14px', fontWeight: 600 }}>
          ⚠️ {errorForm}
        </div>
      )}

      <button type="submit" disabled={guardando || subiendo || servicios.length === 0 || zonas.length === 0}
        style={{
          ...s.btnPrimary,
          opacity: (guardando || subiendo || servicios.length === 0 || zonas.length === 0) ? 0.5 : 1,
          cursor: (guardando || subiendo || servicios.length === 0 || zonas.length === 0) ? 'not-allowed' : 'pointer',
        }}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = {
  card: { background: 'white', border: '2px solid #E8E0D4', borderRadius: '24px', padding: '40px' } as React.CSSProperties,
  h2: { fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px', color: '#1A0A3C', margin: 0 } as React.CSSProperties,
  label: { display: 'block', fontWeight: 600, fontSize: '14px', color: '#1A0A3C', marginBottom: '6px' } as React.CSSProperties,
  hint: { color: '#6B5C90', fontSize: '13px', marginBottom: '10px', lineHeight: '1.5', marginTop: '2px' } as React.CSSProperties,
  input: { width: '100%', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '12px 14px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', boxSizing: 'border-box' as const, outline: 'none' },
  btnPrimary: { display: 'block', width: '100%', background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', cursor: 'pointer', textAlign: 'center' as const } as React.CSSProperties,
}
