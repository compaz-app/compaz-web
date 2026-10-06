'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Compita, HorarioDisponible } from '@/types'
import LogoutButton from '@/components/ui/LogoutButton'
import MapaCoberturaWrapper from '@/components/ui/MapaCoberturaWrapper'

const ZONAS: Record<string, string[]> = {
  'Amazonas': ['Atures', 'Alto Orinoco', 'Autana', 'Manapiare', 'Maroa', 'Negro', 'Río Negro', 'Sipapo'],
  'Anzoátegui': ['Simón Bolívar', 'Sotillo', 'Diego Bautista Urbaneja', 'Bruzual', 'Cajigal', 'Fernando de Peñalver', 'Francisco del Carmen Carvajal', 'Francisco Javier Freites', 'Guanipa', 'Guanta', 'Independencia', 'Juan Antonio Sotillo', 'Juan Manuel Cajigal', 'Libertad', 'McGregor', 'Miranda', 'Monagas', 'Peñalver', 'Píritu', 'Sir Arthur McGregor', 'Simón Rodríguez'],
  'Apure': ['San Fernando', 'Achaguas', 'Biruaca', 'Muñoz', 'Páez', 'Pedro Camejo', 'Rómulo Gallegos'],
  'Aragua': ['Girardot', 'Mario Briceño Iragorry', 'Ocumare de la Costa de Oro', 'Costa de Oro', 'Libertador', 'Sucre', 'Linares Alcántara', 'Francisco Linares Alcántara', 'Bolívar', 'Ribas', 'Santos Michelena', 'Zamora', 'Camatagua', 'San Casimiro', 'San Sebastián', 'Urdaneta'],
  'Barinas': ['Barinas', 'Alberto Arvelo Torrealba', 'Andrés Eloy Blanco', 'Antonio José de Sucre', 'Arismendi', 'Bolívar', 'Cruz Paredes', 'Ezequiel Zamora', 'Obispos', 'Pedraza', 'Rojas', 'Sosa', 'Ticoporo'],
  'Bolívar': ['Caroní', 'Heres', 'Cedeño', 'El Callao', 'Gran Sabana', 'Padre Pedro Chien', 'Piar', 'Raúl Leoni', 'Roscio', 'Sifontes', 'Sucre'],
  'Carabobo': ['Valencia', 'Naguanagua', 'San Diego', 'Libertador', 'Los Guayos', 'Miranda', 'Montalbán', 'Puerto Cabello', 'Juan José Mora', 'Guacara', 'Diego Ibarra', 'Carlos Arvelo', 'Bejuma'],
  'Cojedes': ['Tinaco', 'Anzoátegui', 'Girardot', 'Lima Blanco', 'Pao de San Juan Bautista', 'Ricaurte', 'Rómulo Gallegos', 'San Carlos', 'Tinaquillo'],
  'Delta Amacuro': ['Tucupita', 'Antonio Díaz', 'Casacoima', 'Pedernales'],
  'Distrito Capital': ['Libertador'],
  'Falcón': ['Miranda', 'Acosta', 'Bolívar', 'Buchivacoa', 'Carirubana', 'Colina', 'Dabajuro', 'Democracia', 'Federación', 'Iturriza', 'Jacura', 'Los Taques', 'Mauroa', 'Palmasola', 'Petit', 'Piritu', 'San Francisco', 'Silva', 'Sucre', 'Tocópero', 'Unión', 'Urumaco', 'Zamora'],
  'Guárico': ['Juan Germán Roscio', 'Camaguán', 'Chaguaramas', 'El Socorro', 'Francisco de Miranda', 'José Félix Ribas', 'José Tadeo Monagas', 'Julian Mellado', 'Las Mercedes', 'Leonardo Infante', 'Mellado', 'Ortiz', 'San Gerónimo de Guayabal', 'San José de Guaribe', 'Santa María de Ipire', 'Zaraza'],
  'Lara': ['Iribarren', 'Andrés Eloy Blanco', 'Crespo', 'Jiménez', 'Morán', 'Palavecino', 'Simón Planas', 'Torres', 'Urdaneta'],
  'Mérida': ['Libertador', 'Campo Elías', 'Santos Marquina', 'Sucre', 'Rangel', 'Cardenal Quintero', 'Guaraque', 'Justo Briceño', 'Miranda', 'Obispo Ramos de Lora', 'Padre Noguera', 'Pueblo Llano', 'Rivas Dávila', 'Tovar', 'Tulio Febres Cordero', 'Arzobispo Chacón', 'Antonio Pinto Salinas', 'Aricagua', 'Zea', 'Caracciolo Parra Olmedo'],
  'Miranda': ['Baruta', 'Chacao', 'El Hatillo', 'Sucre', 'Guaicaipuro', 'Carrizal', 'Los Salias', 'Cristóbal Rojas', 'Lander', 'Paz Castillo', 'Urdaneta', 'Acevedo', 'Brión', 'Buroz', 'Páez', 'Pedro Gual', 'Independencia', 'Simón Bolívar', 'Zamora'],
  'Monagas': ['Maturín', 'Acosta', 'Aguasay', 'Bolívar', 'Caripe', 'Cedeño', 'Libertador', 'Piar', 'Punceres', 'Santa Bárbara', 'Sotillo', 'Uracoa', 'Ezequiel Zamora'],
  'Nueva Esparta': ['Mariño', 'Antolín del Campo', 'Arismendi', 'Díaz', 'García', 'Gómez', 'Macanao', 'Maneiro', 'Marcano', 'Tubores', 'Villalba'],
  'Portuguesa': ['Guanare', 'Araure', 'Acarigua', 'Esteller', 'Guanarito', 'José Vicente de Unda', 'Ospino', 'Páez', 'Papelón', 'San Genaro de Boconoíto', 'San Rafael de Onoto', 'Santa Rosalía', 'Sucre', 'Turén'],
  'Sucre': ['Sucre', 'Arismendi', 'Benítez', 'Bermúdez', 'Bolívar', 'Cajigal', 'Cruz Salmerón Acosta', 'Libertador', 'Mariño', 'Mejías', 'Montes', 'Ribero', 'Valdez'],
  'Táchira': ['San Cristóbal', 'Torbes', 'Cárdenas', 'Guásimos', 'Fernández Feo', 'Libertad', 'Lobatera', 'Michelena', 'Panamericano', 'Junín', 'Bolívar', 'Pedro María Ureña', 'García de Hevia', 'Seboruco', 'Ayacucho', 'Córdoba', 'Sucre', 'Uribante', 'Libertador', 'Andrés Bello', 'Antonio Rómulo Costa', 'Francisco de Miranda', 'Jáuregui', 'Montes', 'Samuel Darío Maldonado', 'Simón Rodríguez'],
  'Trujillo': ['Trujillo', 'Andrés Bello', 'Bolívar', 'Boconó', 'Candelaria', 'Carache', 'Escuque', 'José Felipe Márquez Cañizales', 'La Ceiba', 'Miranda', 'Motatán', 'Monte Carmelo', 'Pampán', 'Pampanito', 'Rafael Rangel', 'San Rafael de Carvajal', 'Sucre', 'Urdaneta', 'Valera'],
  'Vargas': ['Vargas'],
  'Yaracuy': ['San Felipe', 'Bolívar', 'Bruzual', 'Cocorote', 'Independencia', 'La Trinidad', 'Manuel Monge', 'Nirgua', 'Páez', 'Peña', 'Sucre', 'Urachiche'],
  'Zulia': ['Maracaibo', 'San Francisco', 'Cabimas', 'Ciudad Ojeda', 'Lagunillas', 'Jesús Enrique Lossada', 'La Cañada de Urdaneta', 'Miranda', 'Mara', 'Páez', 'Rosario de Perijá', 'Machiques de Perijá', 'Colón', 'Catatumbo', 'Jesús María Semprún', 'Sucre', 'Valmore Rodríguez', 'Simón Bolívar', 'Santa Rita', 'Baralt'],
}

interface Props {
  compitas: Compita[]
  usuarioNombre: string
  usuarioEmail: string
  backHref?: string
  backLabel?: string
}

import type { Solicitud } from '@/types'

export default function CompitasMarketplace({ compitas, usuarioNombre, usuarioEmail, backHref = '/dashboard', backLabel = '← Mi portal' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [estado, setEstadoState] = useState(searchParams.get('estado') ?? '')
  const [municipio, setMunicipioState] = useState(searchParams.get('municipio') ?? '')
  const [seleccionada, setSeleccionada] = useState<Compita | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState<string | null>(null)
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [formMensaje, setFormMensaje] = useState('')
  const [formSobreCliente, setFormSobreCliente] = useState('')
  const [slotsElegidos, setSlotsElegidos] = useState<string[]>([])
  const reagendarId = searchParams.get('reagendar')
  const [reagendando, setReagendando] = useState(false)
  const [diasAbiertos, setDiasAbiertos] = useState<Record<string, boolean>>({})
  const resultadosRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/mis-solicitudes')
      .then((r) => r.json())
      .then((d) => {
        if (d.solicitudes) {
          setSolicitudes(d.solicitudes)
          if (reagendarId) {
            const sol = (d.solicitudes as Solicitud[]).find((s) => s.id === reagendarId)
            if (sol) {
              setFormMensaje(sol.mensaje)
              setFormSobreCliente('')
              setReagendando(true)
              setMostrarFormulario(true)
            }
          }
        }
      })
      .catch(() => {})
  }, [reagendarId])

  useEffect(() => { history.scrollRestoration = 'auto' }, [])

  // Abrir modal directamente si viene ?compita=<id> en la URL (ej: link desde email de rechazo)
  useEffect(() => {
    const id = searchParams.get('compita')
    if (!id) return
    const encontrada = compitas.find((c) => c.id === id)
    if (encontrada) setSeleccionada(encontrada)
  }, [compitas, searchParams])

  // Auto-scroll a resultados cuando se selecciona un municipio
  useEffect(() => {
    if (!municipio) return
    const el = resultadosRef.current
    if (!el) return
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }, [municipio])

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

  function setZona(nuevoEstado: string, nuevoMunicipio: string) {
    setEstadoState(nuevoEstado)
    setMunicipioState(nuevoMunicipio)
    const p = new URLSearchParams(searchParams.toString())
    p.set('estado', nuevoEstado)
    if (nuevoMunicipio) p.set('municipio', nuevoMunicipio)
    else p.delete('municipio')
    router.replace(`/compitas?${p.toString()}`, { scroll: false })
  }

  const zonaFiltro = estado && municipio ? `${estado} — ${municipio}` : ''

  const lista = zonaFiltro
    ? compitas.filter((c) => c.zona?.includes(zonaFiltro))
    : compitas

  const solicitudesActivas = solicitudes.filter((s) => s.estado === 'pendiente' || s.estado === 'aceptada')
  const idsYaSolicitados = new Set(solicitudesActivas.map((s) => s.compita_id))
  const MAX_SOLICITUDES = 3

  // Genera todos los slots de 20 min en los próximos 14 días (8am-8pm VE) sin restricciones de disponibilidad
  // Usado cuando el cliente reagenda tras una contrapropuesta del compita
  function generarSlotsSinLimite(): { diaLabel: string; slots: { iso: string; hora: string }[] }[] {
    const ahora = new Date()
    const porDia: { diaLabel: string; slots: { iso: string; hora: string }[] }[] = []
    for (let d = 0; d < 14; d++) {
      // Calcular la fecha en timezone Venezuela para no depender del browser del cliente
      const refVE = new Date(ahora.getTime() + d * 24 * 60 * 60 * 1000)
      const partsVE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(refVE)
      const anoVE = Number(partsVE.find(p => p.type === 'year')!.value)
      const mesVE = Number(partsVE.find(p => p.type === 'month')!.value) - 1
      const diaVE = Number(partsVE.find(p => p.type === 'day')!.value)
      const slotsDelDia: { iso: string; hora: string }[] = []
      for (let hVE = 8; hVE < 20; hVE++) {
        for (const m of [0, 20, 40]) {
          // VE es UTC-4: construir UTC explícitamente
          const slotUTC = new Date(Date.UTC(anoVE, mesVE, diaVE, hVE + 4, m, 0))
          if (slotUTC > ahora) {
            const hora = slotUTC.toLocaleTimeString('es-VE', {
              timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: true,
            })
            slotsDelDia.push({ iso: slotUTC.toISOString(), hora })
          }
        }
      }
      if (slotsDelDia.length > 0) {
        const diaLabel = refVE.toLocaleDateString('es-VE', {
          timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'short',
        })
        porDia.push({ diaLabel, slots: slotsDelDia })
      }
    }
    return porDia
  }

  // Genera slots de 20 min disponibles en los próximos 7 días según horarios del compita
  // Retorna agrupados por día para mostrar como chips
  function generarSlotsPorDia(horarios: HorarioDisponible[] | null): { diaLabel: string; slots: { iso: string; hora: string }[] }[] {
    if (!horarios || horarios.length === 0) return []
    const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
    const ahora = new Date()
    const porDia: { diaLabel: string; slots: { iso: string; hora: string }[] }[] = []

    for (let d = 0; d < 7; d++) {
      const fecha = new Date(ahora)
      fecha.setDate(ahora.getDate() + d)
      const diaSemana = DIAS[fecha.getDay()] as HorarioDisponible['dia']
      const horariosDelDia = horarios.filter((h) => h.dia === diaSemana)
      if (horariosDelDia.length === 0) continue

      const partsVE2 = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(fecha)
      const anoVE2 = Number(partsVE2.find(p => p.type === 'year')!.value)
      const mesVE2 = Number(partsVE2.find(p => p.type === 'month')!.value) - 1
      const diaVE2 = Number(partsVE2.find(p => p.type === 'day')!.value)
      const slotsDelDia: { iso: string; hora: string }[] = []
      for (const horario of horariosDelDia) {
        const [iH, iM] = horario.inicio.split(':').map(Number)
        const [fH, fM] = horario.fin.split(':').map(Number)
        let cH = iH, cM = iM

        while (cH * 60 + cM + 20 <= fH * 60 + fM) {
          // VE es UTC-4: construir UTC explícitamente
          const slotUTC = new Date(Date.UTC(anoVE2, mesVE2, diaVE2, cH + 4, cM, 0))
          if (slotUTC > ahora) {
            const hora = slotUTC.toLocaleTimeString('es-VE', {
              timeZone: 'America/Caracas',
              hour: '2-digit', minute: '2-digit', hour12: true,
            })
            slotsDelDia.push({ iso: slotUTC.toISOString(), hora })
          }
          cM += 20
          if (cM >= 60) { cM -= 60; cH++ }
        }
      }

      if (slotsDelDia.length > 0) {
        const diaLabel = fecha.toLocaleDateString('es-VE', {
          timeZone: 'America/Caracas',
          weekday: 'long', day: 'numeric', month: 'short',
        })
        porDia.push({ diaLabel, slots: slotsDelDia })
      }
    }
    return porDia
  }

  function toggleSlot(iso: string) {
    setSlotsElegidos((prev) =>
      prev.includes(iso) ? prev.filter((s) => s !== iso) : prev.length < 3 ? [...prev, iso] : prev,
    )
  }

  async function enviarSolicitud(compita: Compita) {
    if (!formMensaje.trim() || slotsElegidos.length === 0) return
    setEnviando(true)
    try {
      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compita_id: compita.id,
          mensaje: formMensaje,
          sobre_cliente: formSobreCliente.trim() || null,
          slots_propuestos: slotsElegidos,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSolicitudes((prev) => [{
          id: data.data?.solicitud_id ?? crypto.randomUUID(),
          cliente_id: '',
          compita_id: compita.id,
          compita_nombre: compita.nombre,
          compita_foto: compita.foto_url ?? null,
          compita_zona: compita.zona ?? '',
          mensaje: formMensaje,
          estado: 'pendiente' as const,
          franja_horaria: null,
          slots_propuestos: slotsElegidos,
          slot_confirmado: null,
          room_url: null,
          recordatorio_enviado: false,
          seguimiento_enviado: false,
          seguimiento2_enviado: false,
          confirmacion_llamada_enviada: false,
          confirmacion_cliente: null,
          confirmacion_compita: null,
          reagendado_slots: [],
          token_respuesta: '',
          created_at: new Date().toISOString(),
          respondido_at: null,
        }, ...prev])
        setEnviado(compita.id)
        setSeleccionada(null)
        setMostrarFormulario(false)
        setFormMensaje('')
        setFormSobreCliente('')
        setSlotsElegidos([])
        setReagendando(false)
      } else {
        alert(data?.error ?? 'No se pudo enviar la solicitud. Intenta de nuevo.')
      }
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
          Selecciona la zona donde está tu familiar y te mostramos los compitas disponibles en esa área.
        </p>

        {/* Mapa de cobertura */}
        <MapaCoberturaWrapper
          hideToggle
          selectedEstado={estado}
          selectedMunicipio={municipio}
          onEstadoSelect={(est) => setZona(est, '')}
          onMunicipioSelect={(est, mun) => setZona(est, mun)}
        />

        {/* Selector de zona — barra compacta */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: '#9B8AB8', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}>O busca por nombre:</span>
          <select value={estado} onChange={(e) => { setEstado(e.target.value); setMunicipioState('') }} style={{ ...s.selectCompact, flex: 1, minWidth: '140px' }}>
            <option value="">Estado…</option>
            {Object.keys(ZONAS).sort().map((est) => (
              <option key={est} value={est}>{est}</option>
            ))}
          </select>
          <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} disabled={!estado} style={{ ...s.selectCompact, flex: 1, minWidth: '140px', opacity: estado ? 1 : 0.4 }}>
            <option value="">Municipio…</option>
            {(ZONAS[estado] ?? []).sort().map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {(estado || municipio) && (
            <button
              onClick={() => setZona('', '')}
              style={{ background: 'none', border: '1.5px solid #D4C9E8', borderRadius: '9999px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: '#6B5C90', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Limpiar ×
            </button>
          )}
        </div>

        {/* Carrito de solicitudes */}
        {solicitudesActivas.length > 0 && (
          <div style={{ background: '#1A0A3C', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ color: 'white', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px' }}>
                  Mis solicitudes
                </span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginLeft: '10px' }}>
                  {solicitudesActivas.length}/{MAX_SOLICITUDES} — esperando respuesta del compita
                </span>
              </div>
              {solicitudesActivas.length >= MAX_SOLICITUDES && (
                <span style={{ background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '4px 12px', fontSize: '12px', fontWeight: 800, fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                  Límite alcanzado
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {solicitudesActivas.map((s) => (
                <div key={s.id} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {s.compita_foto
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={s.compita_foto} alt={s.compita_nombre} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>👤</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'white', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '15px' }}>{s.compita_nombre}</div>
                    {s.compita_zona && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.compita_zona}</div>}
                  </div>
                  <span style={{ background: 'rgba(255,107,43,0.2)', color: '#FF9E6B', borderRadius: '9999px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    ⏳ En revisión
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resultados */}
        <div ref={resultadosRef} />
        {!zonaFiltro && !estado && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#6B5C90' }}>
            Selecciona un estado en el mapa o en el menú para ver los compitas disponibles.
          </div>
        )}
        {estado && !municipio && (
          <div style={{ textAlign: 'center', padding: '32px', color: '#6B5C90' }}>
            Ahora selecciona un municipio de {estado} para ver los compitas disponibles.
          </div>
        )}

        {zonaFiltro && lista.length === 0 && (
          <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#6B5C90', fontSize: '16px' }}>No hay compitas disponibles en {zonaFiltro} por ahora.</p>
            <p style={{ color: '#4A3B6B', fontSize: '14px', marginTop: '8px' }}>Pronto habrá más Compitas en esta zona.</p>
            <a
              href={`mailto:hola@micompaz.com?subject=Quiero%20una%20Compita%20en%20${encodeURIComponent(zonaFiltro)}&body=Hola%2C%20me%20interesa%20una%20Compita%20en%20${encodeURIComponent(zonaFiltro)}%20para%20acompañar%20a%20mi%20familiar.%20Quiero%20que%20me%20avisen%20cuando%20haya%20disponibilidad.`}
              style={{ display: 'inline-block', marginTop: '16px', background: '#2D1464', color: 'white', borderRadius: '9999px', padding: '12px 24px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', textDecoration: 'none' }}
            >
              Escríbenos a hola@micompaz.com
            </a>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#6B5C90', fontSize: '13px' }}>{compita.visitas_realizadas} visitas</span>
                    {compita.tasa_aceptacion != null && (
                      <span style={{
                        fontSize: '11px', fontWeight: 700, borderRadius: '9999px', padding: '2px 8px',
                        fontFamily: 'Bricolage Grotesque, sans-serif',
                        background: compita.tasa_aceptacion >= 80 ? '#DCFCE7' : compita.tasa_aceptacion >= 60 ? '#FEF9C3' : '#FEE2E2',
                        color: compita.tasa_aceptacion >= 80 ? '#166534' : compita.tasa_aceptacion >= 60 ? '#854D0E' : '#991B1B',
                      }}>
                        {compita.tasa_aceptacion}% acepta
                      </span>
                    )}
                  </div>
                  {idsYaSolicitados.has(compita.id)
                    ? <span style={{ color: '#FF6B2B', fontSize: '12px', fontWeight: 700, background: 'rgba(255,107,43,0.08)', borderRadius: '9999px', padding: '3px 10px' }}>⏳ En revisión</span>
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
          style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,60,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 2000 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setSeleccionada(null); setMostrarFormulario(false) } }}
        >
          <div style={{ background: '#FDFAF6', borderRadius: '24px', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => { setSeleccionada(null); setMostrarFormulario(false); setSlotsElegidos([]); setFormMensaje(''); setFormSobreCliente(''); setReagendando(false) }} style={{ position: 'absolute', top: '16px', right: '16px', background: 'white', border: '2px solid #E8E0D4', borderRadius: '9999px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', zIndex: 10 }}>×</button>

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

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <span style={{ color: '#6B5C90', fontSize: '13px' }}>{seleccionada.visitas_realizadas} visitas realizadas</span>
                {seleccionada.tasa_aceptacion != null && (
                  <span style={{
                    fontSize: '12px', fontWeight: 700, borderRadius: '9999px', padding: '3px 10px',
                    fontFamily: 'Bricolage Grotesque, sans-serif',
                    background: seleccionada.tasa_aceptacion >= 80 ? '#DCFCE7' : seleccionada.tasa_aceptacion >= 60 ? '#FEF9C3' : '#FEE2E2',
                    color: seleccionada.tasa_aceptacion >= 80 ? '#166534' : seleccionada.tasa_aceptacion >= 60 ? '#854D0E' : '#991B1B',
                  }}>
                    {seleccionada.tasa_aceptacion}% de aceptación
                  </span>
                )}
              </div>

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

              {seleccionada.horarios_disponibles && seleccionada.horarios_disponibles.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontWeight: 700, color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: '10px' }}>Disponibilidad</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {['lunes','martes','miércoles','jueves','viernes','sábado','domingo'].map((dia) => {
                      const bloques = seleccionada.horarios_disponibles!.filter((h) => h.dia === dia)
                      if (bloques.length === 0) return null
                      return (
                        <div key={dia} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px' }}>
                          <span style={{ color: '#6B5C90', minWidth: '80px', textTransform: 'capitalize', fontWeight: 600 }}>{dia}</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {bloques.map((b, i) => (
                              <span key={i} style={{ background: '#F5F0FF', color: '#2D1464', borderRadius: '9999px', padding: '2px 10px', fontSize: '13px' }}>
                                {b.inicio} – {b.fin}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
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

              {!reagendando && idsYaSolicitados.has(seleccionada.id) ? (
                <div style={{ background: '#FFF3E8', border: '2px solid #FF6B2B', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <p style={{ color: '#C84B0E', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', margin: '0 0 6px' }}>⏳ Solicitud enviada</p>
                  <p style={{ color: '#6B5C90', fontSize: '13px', margin: 0 }}>Ya solicitaste conocer a {seleccionada.nombre}. Te avisaremos cuando confirme un horario.</p>
                </div>
              ) : !reagendando && solicitudesActivas.length >= MAX_SOLICITUDES ? (
                <div style={{ background: '#F5F0E8', border: '2px solid #D4C9E8', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <p style={{ color: '#4A3B6B', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', margin: '0 0 6px' }}>Límite de solicitudes alcanzado</p>
                  <p style={{ color: '#6B5C90', fontSize: '13px', margin: 0 }}>Ya tienes {MAX_SOLICITUDES} solicitudes pendientes.</p>
                </div>
              ) : !mostrarFormulario ? (
                <button
                  onClick={() => setMostrarFormulario(true)}
                  style={{ width: '100%', background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', cursor: 'pointer' }}
                >
                  Solicitar entrevista
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Banner reagendando */}
                  {reagendando && (
                    <div style={{ background: '#F0FDF4', border: '2px solid #86EFAC', borderRadius: '12px', padding: '12px 16px' }}>
                      <p style={{ color: '#15803d', fontWeight: 700, fontSize: '13px', margin: '0 0 4px', fontFamily: 'Bricolage Grotesque, sans-serif' }}>↩️ Reagendando con {seleccionada.nombre}</p>
                      <p style={{ color: '#166534', fontSize: '12px', margin: 0 }}>Tu descripción ya está guardada. Solo elige nuevos horarios para proponer.</p>
                    </div>
                  )}

                  {/* Aviso llamada 20 min */}
                  {!reagendando && (
                    <div style={{ background: '#FFF3E8', border: '2px solid #FF6B2B', borderRadius: '12px', padding: '12px 16px' }}>
                      <p style={{ color: '#C84B0E', fontWeight: 700, fontSize: '13px', margin: '0 0 4px', fontFamily: 'Bricolage Grotesque, sans-serif' }}>⏱️ La llamada de presentación es de 20 minutos</p>
                      <p style={{ color: '#6B5C90', fontSize: '12px', margin: 0 }}>La sala se cierra automáticamente a los 23 min. Úsalos bien.</p>
                    </div>
                  )}

                  {/* Sobre el cliente */}
                  {!reagendando && (
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#1A0A3C', marginBottom: '4px' }}>
                        Cuéntanos sobre ti
                      </label>
                      <p style={{ color: '#6B5C90', fontSize: '12px', marginBottom: '8px' }}>
                        Opcional — los compitas aceptan más cuando saben con quién están hablando.
                      </p>
                      <textarea
                        value={formSobreCliente}
                        onChange={(e) => setFormSobreCliente(e.target.value)}
                        placeholder="Soy la hija de Rosa, vivo cerca y estoy buscando acompañamiento para ella…"
                        rows={3}
                        style={{ width: '100%', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '12px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', resize: 'vertical', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}

                  {/* Mensaje sobre el familiar */}
                  <div>
                    {reagendando ? (
                      <div style={{ background: '#F5F0FF', border: '2px solid rgba(45,20,100,0.15)', borderRadius: '12px', padding: '14px 16px' }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: '#6B5C90', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tu descripción original</p>
                        <p style={{ fontSize: '14px', color: '#1A0A3C', margin: 0, lineHeight: '1.6' }}>{formMensaje}</p>
                      </div>
                    ) : (
                      <>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#1A0A3C', marginBottom: '6px' }}>
                          Cuéntale a {seleccionada.nombre} sobre tu familiar *
                        </label>
                        <textarea
                          value={formMensaje}
                          onChange={(e) => setFormMensaje(e.target.value)}
                          placeholder="Edad, condición de salud, qué tipo de acompañamiento necesita y en qué zona vive…"
                          rows={4}
                          style={{ width: '100%', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '12px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', resize: 'vertical', boxSizing: 'border-box' }}
                        />
                      </>
                    )}
                  </div>

                  {/* Slot picker — sin límite de disponibilidad del compita */}
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#1A0A3C', marginBottom: '4px' }}>
                      Elige uno o varios horarios *
                    </label>
                    <p style={{ color: '#6B5C90', fontSize: '12px', marginBottom: '10px' }}>
                      {seleccionada.nombre} confirmará uno. Puedes proponer hasta 3 para darle más opciones. La llamada es de 20 minutos.
                    </p>
                    {(() => {
                      const diasConSlots = generarSlotsSinLimite()
                      if (diasConSlots.length === 0) {
                        return <p style={{ color: '#9B8AB8', fontSize: '13px', textAlign: 'center', padding: '12px' }}>No hay horarios disponibles.</p>
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {diasConSlots.map(({ diaLabel, slots }) => {
                            const tieneElegido = slots.some((s) => slotsElegidos.includes(s.iso))
                            const abierto = diasAbiertos[diaLabel] ?? tieneElegido
                            return (
                              <div key={diaLabel} style={{ border: '2px solid rgba(45,20,100,0.12)', borderRadius: '12px', overflow: 'hidden' }}>
                                <button
                                  type="button"
                                  onClick={() => setDiasAbiertos((prev) => ({ ...prev, [diaLabel]: !abierto }))}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: tieneElegido ? '#FFF3E8' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                                >
                                  <span style={{ fontSize: '13px', fontWeight: 700, color: tieneElegido ? '#C84B0E' : '#1A0A3C', textTransform: 'capitalize' }}>
                                    {tieneElegido ? '✓ ' : ''}{diaLabel}
                                  </span>
                                  <span style={{ fontSize: '12px', color: '#6B5C90' }}>{abierto ? '▲' : '▼'}</span>
                                </button>
                                {abierto && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px 14px', borderTop: '1px solid rgba(45,20,100,0.08)' }}>
                                    {slots.map((slot) => {
                                      const elegido = slotsElegidos.includes(slot.iso)
                                      return (
                                        <button
                                          key={slot.iso}
                                          type="button"
                                          onClick={() => toggleSlot(slot.iso)}
                                          disabled={!elegido && slotsElegidos.length >= 3}
                                          style={{
                                            background: elegido ? '#FF6B2B' : 'white',
                                            color: elegido ? 'white' : '#1A0A3C',
                                            border: `2px solid ${elegido ? '#FF6B2B' : 'rgba(45,20,100,0.2)'}`,
                                            borderRadius: '9999px', padding: '6px 12px', cursor: (!elegido && slotsElegidos.length >= 3) ? 'not-allowed' : 'pointer',
                                            fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: elegido ? 700 : 400,
                                            opacity: (!elegido && slotsElegidos.length >= 3) ? 0.35 : 1,
                                            transition: 'all 0.15s',
                                          }}
                                        >
                                          {elegido ? '✓ ' : ''}{slot.hora}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                    {slotsElegidos.length > 0 && (
                      <p style={{ color: '#FF6B2B', fontSize: '12px', fontWeight: 700, marginTop: '8px' }}>
                        {slotsElegidos.length === 3 ? '3/3 — máximo alcanzado' : `${slotsElegidos.length}/3 horarios seleccionados`}
                      </p>
                    )}
                  </div>

                  {/* Validación visible */}
                  {(() => {
                    const falta = []
                    if (!formMensaje.trim()) falta.push('la descripción de tu familiar')
                    if (slotsElegidos.length === 0) falta.push('al menos un horario')
                    if (falta.length === 0) return null
                    return (
                      <div style={{ background: '#FFF3E8', border: '2px solid #FF6B2B', borderRadius: '12px', padding: '10px 14px' }}>
                        <p style={{ color: '#C84B0E', fontSize: '13px', fontWeight: 700, margin: '0 0 4px', fontFamily: 'Bricolage Grotesque, sans-serif' }}>Para enviar la solicitud falta:</p>
                        <ul style={{ margin: 0, paddingLeft: '18px', color: '#C84B0E', fontSize: '13px', lineHeight: '1.8' }}>
                          {falta.map((f) => <li key={f}>{f}</li>)}
                        </ul>
                      </div>
                    )
                  })()}

                  {/* Botones */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => { setMostrarFormulario(false); setSlotsElegidos([]); setFormMensaje(''); setFormSobreCliente(''); setReagendando(false) }}
                      style={{ flex: 1, background: 'white', color: '#4A3B6B', border: '2px solid #D4C9E8', borderRadius: '9999px', padding: '14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => enviarSolicitud(seleccionada)}
                      disabled={enviando || !formMensaje.trim() || slotsElegidos.length === 0}
                      style={{ flex: 2, background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '15px', cursor: (enviando || !formMensaje.trim() || slotsElegidos.length === 0) ? 'not-allowed' : 'pointer', opacity: (enviando || !formMensaje.trim() || slotsElegidos.length === 0) ? 0.6 : 1 }}
                    >
                      {enviando ? 'Enviando…' : 'Enviar solicitud'}
                    </button>
                  </div>
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
  select: { width: '100%', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '10px 12px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', boxSizing: 'border-box' as const },
  selectCompact: { border: '1.5px solid #D4C9E8', borderRadius: '9999px', padding: '7px 14px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', cursor: 'pointer' } as React.CSSProperties,
  badge: { background: 'white', border: '2px solid #E8E0D4', borderRadius: '9999px', padding: '2px 8px', fontSize: '11px', color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: '3px' },
  chip: { background: '#F5F0E8', color: '#4A3B6B', borderRadius: '9999px', padding: '4px 10px', fontSize: '12px', fontFamily: 'Bricolage Grotesque, sans-serif' } as React.CSSProperties,
}
