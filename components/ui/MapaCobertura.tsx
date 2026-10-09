'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const ESTADO_ALIASES: Record<string, string[]> = {
  'Amazonas': ['amazonas'],
  'Anzoátegui': ['anzoategui', 'anzoátegui', 'barcelona', 'puerto la cruz'],
  'Apure': ['apure', 'san fernando'],
  'Aragua': ['aragua', 'maracay'],
  'Barinas': ['barinas'],
  'Bolívar': ['bolivar', 'bolívar', 'ciudad guayana', 'puerto ordaz'],
  'Carabobo': ['carabobo', 'valencia'],
  'Cojedes': ['cojedes', 'san carlos'],
  'Delta Amacuro': ['delta amacuro', 'tucupita'],
  'Distrito Capital': ['distrito capital', 'caracas', 'dtto capital'],
  'Falcón': ['falcon', 'falcón', 'coro'],
  'Guárico': ['guarico', 'guárico', 'calabozo'],
  'Lara': ['lara', 'barquisimeto'],
  'Mérida': ['merida', 'mérida'],
  'Miranda': ['miranda', 'los teques', 'guarenas', 'guatire', 'baruta', 'chacao', 'sucre'],
  'Monagas': ['monagas', 'maturin', 'maturín'],
  'Nueva Esparta': ['nueva esparta', 'margarita', 'porlamar'],
  'Portuguesa': ['portuguesa', 'guanare'],
  'Sucre': ['sucre', 'cumaná', 'cumana', 'carúpano'],
  'Táchira': ['tachira', 'táchira', 'san cristóbal', 'san cristobal'],
  'Trujillo': ['trujillo'],
  'La Guaira': ['la guaira', 'vargas'],
  'Yaracuy': ['yaracuy', 'san felipe'],
  'Zulia': ['zulia', 'maracaibo', 'cabimas'],
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// GeoJSON NAME_1/NAME_2 concatenates multi-word names (e.g. "ElHatillo", "DistritoCapital")
function splitGeoName(s: string): string {
  return s.replace(/([a-záéíóúüñ])([A-ZÁÉÍÓÚÜÑ])/g, '$1 $2')
}

function zonasAEstados(zonas: string[]): Set<string> {
  const estados = new Set<string>()
  for (const zona of zonas) {
    const n = norm(zona)
    for (const [estado, aliases] of Object.entries(ESTADO_ALIASES)) {
      if (aliases.some((a) => n.includes(a) || a.includes(n))) {
        estados.add(estado)
        break
      }
    }
  }
  return estados
}

function zonasAMunicipios(zonas: string[]): Set<string> {
  const municipios = new Set<string>()
  for (const zona of zonas) {
    municipios.add(norm(zona))
  }
  return municipios
}

interface Props {
  onEstadoSelect?: (estado: string) => void
  onMunicipioSelect?: (estado: string, municipio: string) => void
  hideToggle?: boolean
  selectedEstado?: string
  selectedMunicipio?: string
}

export default function MapaCobertura({ onEstadoSelect, onMunicipioSelect, hideToggle, selectedEstado, selectedMunicipio }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const mapRef2 = useRef<unknown>(null)
  const boundsVenezuela = useRef<unknown>(null)
  const estadosLayerRef = useRef<unknown>(null)
  const muniLayerRef = useRef<unknown>(null)
  const muniGeoJsonRef = useRef<GeoJSON.FeatureCollection | null>(null)
  const zonasRawRef = useRef<string[]>([])
  const onEstadoSelectRef = useRef(onEstadoSelect)
  const onMunicipioSelectRef = useRef(onMunicipioSelect)
  // Track selected municipality layer to un-highlight it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedMuniLayerRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedMuniFeatureRef = useRef<any>(null)
  const estiloMuniRef = useRef<((f: GeoJSON.Feature | undefined) => object) | null>(null)

  useEffect(() => { onEstadoSelectRef.current = onEstadoSelect }, [onEstadoSelect])
  useEffect(() => { onMunicipioSelectRef.current = onMunicipioSelect }, [onMunicipioSelect])

  // Refs to track prop values inside async callbacks (for initial restoration from URL params)
  const selectedEstadoRef = useRef(selectedEstado ?? '')
  const selectedMunicipioRef = useRef(selectedMunicipio ?? '')
  useEffect(() => { selectedEstadoRef.current = selectedEstado ?? '' }, [selectedEstado])
  useEffect(() => { selectedMunicipioRef.current = selectedMunicipio ?? '' }, [selectedMunicipio])

  const [estadosConCobertura, setEstadosConCobertura] = useState<Set<string>>(new Set())
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState(!!hideToggle)
  const [mapReady, setMapReady] = useState(false)
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<string | null>(null)
  const [municipioSeleccionado, setMunicipioSeleccionado] = useState<string | null>(null)

  const fetchCobertura = useCallback(() => {
    fetch('/api/cobertura')
      .then((r) => r.json())
      .then((res: { ok: boolean; data: { zonas: string[] } }) => {
        const zonas = res.data?.zonas ?? []
        zonasRawRef.current = zonas
        setEstadosConCobertura(zonasAEstados(zonas))
        setCargando(false)
      })
      .catch(() => setCargando(false))
  }, [])

  useEffect(() => {
    fetchCobertura()
    // Sondeo en vez de Realtime: suscribirse a `compitas` con la anon key transmitiría filas completas
    // (email, telegram_chat_id) a cualquier visitante. /api/cobertura solo expone las zonas.
    const id = setInterval(fetchCobertura, 60_000)
    return () => clearInterval(id)
  }, [fetchCobertura])

  // Re-estilizar estados cuando cambian los datos
  useEffect(() => {
    if (!estadosLayerRef.current) return
    const layer = estadosLayerRef.current as { setStyle: (fn: (f: GeoJSON.Feature) => object) => void }
    layer.setStyle((feature) => {
      const nombre = splitGeoName((feature?.properties as Record<string, string>)?.NAME_1 ?? '')
      const tiene = estadosConCobertura.has(nombre)
      return { fillColor: tiene ? '#2D1464' : '#FDFAF6', fillOpacity: 1, color: '#2D1464', weight: 1.5 }
    })
  }, [estadosConCobertura])

  // Restore visual state from URL params after map initializes.
  // cargarMunicipios already has mapReady in its deps, so when this fires,
  // it triggers cargarMunicipios to re-run with the map ready.
  // This effect handles the edge case where estadoSeleccionado wasn't set yet.
  useEffect(() => {
    if (!mapReady || !selectedEstadoRef.current) return
    if (!estadoSeleccionado) {
      setEstadoSeleccionado(selectedEstadoRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady])

  // Limpiar municipio seleccionado cuando cambia el estado
  useEffect(() => {
    setMunicipioSeleccionado(null)
    selectedMuniLayerRef.current = null
    selectedMuniFeatureRef.current = null
  }, [estadoSeleccionado])

  // Sync dropdown → mapa: cuando selectedEstado cambia desde afuera
  useEffect(() => {
    if (!selectedEstado) {
      // Dropdown limpiado → volver a Venezuela
      if (estadoSeleccionado) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map = mapRef2.current as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bounds = boundsVenezuela.current as any
        if (map && bounds) map.fitBounds(bounds, { padding: [12, 12], animate: true, duration: 0.4 })
        setEstadoSeleccionado(null)
      }
      return
    }
    // Solo actualizar si es diferente al estado actual (evitar loop)
    if (selectedEstado !== estadoSeleccionado) {
      setEstadoSeleccionado(selectedEstado)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEstado])

  // Sync dropdown → mapa: cuando selectedMunicipio cambia desde afuera
  useEffect(() => {
    // Si no hay municipio externo, volver a ver todos los del estado
    if (!selectedMunicipio) {
      if (municipioSeleccionado && selectedMuniLayerRef.current && estiloMuniRef.current) {
        ;(selectedMuniLayerRef.current as { setStyle: (s: object) => void }).setStyle(
          estiloMuniRef.current(selectedMuniFeatureRef.current)
        )
        selectedMuniLayerRef.current = null
        selectedMuniFeatureRef.current = null
        setMunicipioSeleccionado(null)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map = mapRef2.current as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const muniLayer = muniLayerRef.current as any
        if (map && muniLayer) map.fitBounds(muniLayer.getBounds(), { padding: [32, 32], animate: true, duration: 0.4 })
      }
      return
    }
    // Evitar re-highlight si ya está seleccionado (viene del click en el mapa)
    if (selectedMunicipio === municipioSeleccionado) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const muniLayer = muniLayerRef.current as any
    if (!muniLayer) return
    muniLayer.eachLayer((layer: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const l = layer as any
      const nombre = splitGeoName(l.feature?.properties?.NAME_2 ?? '')
      if (nombre !== selectedMunicipio) return
      // Unhighlight previo
      if (selectedMuniLayerRef.current && selectedMuniLayerRef.current !== l && estiloMuniRef.current) {
        selectedMuniLayerRef.current.setStyle(estiloMuniRef.current(selectedMuniFeatureRef.current))
      }
      // Highlight + zoom
      l.setStyle({ fillColor: '#FF6B2B', fillOpacity: 1, color: '#FF6B2B', weight: 2 })
      selectedMuniLayerRef.current = l
      selectedMuniFeatureRef.current = l.feature
      setMunicipioSeleccionado(nombre)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = mapRef2.current as any
      if (map && l.getBounds) map.fitBounds(l.getBounds(), { padding: [40, 40], animate: true, duration: 0.4 })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMunicipio])

  // Cargar municipios cuando se selecciona un estado
  useEffect(() => {
    if (!mapInstanceRef.current) return

    async function cargarMunicipios() {
      const L = (await import('leaflet')).default
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = mapInstanceRef.current as any

      if (muniLayerRef.current) {
        map.removeLayer(muniLayerRef.current)
        muniLayerRef.current = null
      }

      if (!estadoSeleccionado) {
        if (estadosLayerRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.addLayer(estadosLayerRef.current as any)
        }
        return
      }

      if (!muniGeoJsonRef.current) {
        const res = await fetch('/venezuela-municipios.geojson')
        muniGeoJsonRef.current = await res.json()
      }

      const municipiosEstado = {
        type: 'FeatureCollection' as const,
        features: (muniGeoJsonRef.current!.features).filter(
          (f) => splitGeoName((f.properties as Record<string, string>).NAME_1) === estadoSeleccionado
        ),
      }

      const municipiosConCobertura = zonasAMunicipios(zonasRawRef.current)

      const estiloMuni = (feature: GeoJSON.Feature | undefined) => {
        const nombreMuni = norm(splitGeoName((feature?.properties as Record<string, string>)?.NAME_2 ?? ''))
        const tiene = [...municipiosConCobertura].some((z) => nombreMuni.includes(z) || z.includes(nombreMuni))
        return {
          fillColor: tiene ? '#2D1464' : '#F5F0E8',
          fillOpacity: 1,
          color: tiene ? '#ffffff' : '#6B5C90',
          weight: tiene ? 1.5 : 1,
        }
      }
      estiloMuniRef.current = estiloMuni

      const muniLayer = L.geoJSON(municipiosEstado, {
        style: estiloMuni,
        onEachFeature(feature, layer) {
          const nombre = splitGeoName((feature.properties as Record<string, string>)?.NAME_2 ?? '')
          const nombreNorm = norm(nombre)
          const tiene = [...municipiosConCobertura].some((z) => nombreNorm.includes(z) || z.includes(nombreNorm))

          layer.on('mouseover', function (this: L.Path) {
            if (selectedMuniLayerRef.current !== layer) {
              this.setStyle({ fillColor: '#FF6B2B', fillOpacity: 0.85, color: '#ffffff', weight: 1.5 })
            }
          })
          layer.on('mouseout', function (this: L.Path) {
            if (selectedMuniLayerRef.current !== layer) {
              this.setStyle(estiloMuni(feature))
            }
          })
          layer.on('click', () => {
            // Unhighlight previous selection
            if (selectedMuniLayerRef.current && selectedMuniLayerRef.current !== layer) {
              ;(selectedMuniLayerRef.current as L.Path).setStyle(estiloMuniRef.current!(selectedMuniFeatureRef.current))
            }
            // Highlight this one (persistent orange)
            ;(layer as L.Path).setStyle({ fillColor: '#FF6B2B', fillOpacity: 1, color: '#FF6B2B', weight: 2 })
            selectedMuniLayerRef.current = layer
            selectedMuniFeatureRef.current = feature

            // Zoom into the clicked municipality
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const layerWithBounds = layer as any
            if (map && layerWithBounds.getBounds) {
              map.fitBounds(layerWithBounds.getBounds(), { padding: [40, 40], animate: true, duration: 0.4 })
            }

            setMunicipioSeleccionado(nombre)
            onMunicipioSelectRef.current?.(estadoSeleccionado!, nombre)
          })
          layer.bindTooltip(
            `<div style="font-family:Bricolage Grotesque,sans-serif;font-weight:700;font-size:13px;color:#1A0A3C">
              ${nombre}${tiene ? '<br><span style="color:#2D1464;font-size:11px">✓ Cobertura</span>' : ''}
            </div>`,
            { sticky: true, className: 'compaz-tooltip' }
          )
        },
      }).addTo(map)

      muniLayerRef.current = muniLayer

      // Restore pre-selected municipality (e.g. from URL params on page load)
      const preSelectedMuni = selectedMunicipioRef.current
      let highlightedMuni = false
      if (preSelectedMuni) {
        muniLayer.eachLayer((layer: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const l = layer as any
          const nombre = splitGeoName(l.feature?.properties?.NAME_2 ?? '')
          if (nombre !== preSelectedMuni || highlightedMuni) return
          l.setStyle({ fillColor: '#FF6B2B', fillOpacity: 1, color: '#FF6B2B', weight: 2 })
          selectedMuniLayerRef.current = l
          selectedMuniFeatureRef.current = l.feature
          setMunicipioSeleccionado(nombre)
          if (map && l.getBounds) {
            map.fitBounds(l.getBounds(), { padding: [40, 40], animate: false })
          }
          highlightedMuni = true
        })
      }
      if (!highlightedMuni) {
        map.fitBounds(muniLayer.getBounds(), { padding: [32, 32], animate: true, duration: 0.4 })
      }
    }

    cargarMunicipios()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoSeleccionado, mapReady])

  useEffect(() => {
    if (!abierto || cargando || !mapRef.current || mapInstanceRef.current) return

    let cleanup: (() => void) | undefined

    async function initMap() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      if (!mapRef.current) return

      const map = L.map(mapRef.current, {
        center: [8.0, -66.0],
        zoom: 5,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
      })

      mapInstanceRef.current = map
      mapRef2.current = map

      const geoRes = await fetch('/venezuela-estados.geojson')
      const geojson = await geoRes.json() as GeoJSON.FeatureCollection

      function estiloEstado(feature: GeoJSON.Feature | undefined) {
        const nombre = splitGeoName((feature?.properties as Record<string, string>)?.NAME_1 ?? '')
        const tiene = estadosConCobertura.has(nombre)
        return { fillColor: tiene ? '#2D1464' : '#FDFAF6', fillOpacity: 1, color: '#2D1464', weight: 1.5 }
      }

      const estadosLayer = L.geoJSON(geojson, {
        style: estiloEstado,
        onEachFeature(feature, layer) {
          const nombre = splitGeoName((feature.properties as Record<string, string>)?.NAME_1 ?? '')
          const tiene = estadosConCobertura.has(nombre)
          layer.on('mouseover', function (this: L.Path) {
            this.setStyle({ fillColor: '#FF6B2B', fillOpacity: 0.85, color: '#FF6B2B' })
          })
          layer.on('mouseout', function (this: L.Path) { this.setStyle(estiloEstado(feature)) })
          layer.on('click', () => {
            setEstadoSeleccionado(nombre)
            onEstadoSelectRef.current?.(nombre)
          })
          layer.bindTooltip(
            `<div style="font-family:Bricolage Grotesque,sans-serif;font-weight:700;font-size:13px;color:#1A0A3C">
              ${nombre}${tiene ? '<br><span style="color:#2D1464;font-size:11px">✓ Cobertura disponible</span>' : '<br><span style="color:#9B8AB8;font-size:11px">Sin cobertura aún</span>'}
            </div>`,
            { sticky: true, className: 'compaz-tooltip' }
          )
        },
      }).addTo(map)

      estadosLayerRef.current = estadosLayer

      const boundsVen = L.latLngBounds(L.latLng(0.6, -73.4), L.latLng(12.2, -59.8))
      boundsVenezuela.current = boundsVen

      const fitVenezuela = () => {
        map.invalidateSize()
        map.fitBounds(boundsVen, { padding: [12, 12], animate: false })
        setMapReady(true)
      }

      if (mapRef.current!.clientHeight > 100) {
        fitVenezuela()
      } else {
        const observer = new ResizeObserver((entries) => {
          if (entries[0].contentRect.height > 100) {
            observer.disconnect()
            fitVenezuela()
          }
        })
        observer.observe(mapRef.current!)
      }

      cleanup = () => {
        map.remove()
        mapInstanceRef.current = null
        estadosLayerRef.current = null
        muniLayerRef.current = null
      }
    }

    initMap()
    return () => cleanup?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, cargando])

  // ── Navigation helpers ──────────────────────────────────────────────────────

  function irAVenezuela() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapRef2.current as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bounds = boundsVenezuela.current as any
    if (map && bounds) map.fitBounds(bounds, { padding: [12, 12], animate: true, duration: 0.4 })
    setEstadoSeleccionado(null)
    onEstadoSelectRef.current?.('')
  }

  function irAEstado() {
    // Unhighlight selected municipality
    if (selectedMuniLayerRef.current && estiloMuniRef.current) {
      ;(selectedMuniLayerRef.current as { setStyle: (s: object) => void }).setStyle(
        estiloMuniRef.current(selectedMuniFeatureRef.current)
      )
    }
    selectedMuniLayerRef.current = null
    selectedMuniFeatureRef.current = null
    setMunicipioSeleccionado(null)
    // Zoom back to show all municipalities of this state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapRef2.current as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const muniLayer = muniLayerRef.current as any
    if (map && muniLayer) {
      map.fitBounds(muniLayer.getBounds(), { padding: [32, 32], animate: true, duration: 0.4 })
    }
    // Clear municipio filter, keep estado
    onEstadoSelectRef.current?.(estadoSeleccionado!)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const total = estadosConCobertura.size
  const nivel = estadoSeleccionado ? (municipioSeleccionado ? 2 : 1) : 0

  return (
    <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', marginBottom: '24px', overflow: 'hidden' }}>
      {!hideToggle && (
        <button
          onClick={() => setAbierto((v) => !v)}
          style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>🗺️</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '15px', color: '#1A0A3C' }}>Mapa de cobertura</div>
              <div style={{ fontSize: '12px', color: '#6B5C90', marginTop: '2px' }}>
                {cargando ? 'Cargando...' : `${total} ${total === 1 ? 'estado' : 'estados'} con compitas disponibles`}
              </div>
            </div>
          </div>
          <span style={{ color: '#6B5C90', fontSize: '18px', transition: 'transform 0.2s', transform: abierto ? 'rotate(180deg)' : 'none' }}>▾</span>
        </button>
      )}

      {abierto && (
        <div style={{ borderTop: hideToggle ? undefined : '1px solid #E8E0D4' }}>

          {/* ── Breadcrumb ── */}
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #F0EAE0', minHeight: '42px', flexWrap: 'wrap' }}>
            {nivel === 0 && (
              <span style={{ fontSize: '12px', color: '#9B8AB8', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                Haz clic en un estado para explorar sus municipios
              </span>
            )}

            {nivel >= 1 && (
              <>
                <button
                  onClick={irAVenezuela}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8AB8', fontSize: '13px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 600, padding: '2px 4px', borderRadius: '6px', transition: 'color 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#2D1464')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#9B8AB8')}
                >
                  Venezuela
                </button>
                <span style={{ color: '#D4C9E8', fontSize: '12px' }}>›</span>

                {nivel === 1 && (
                  <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#1A0A3C' }}>
                    {estadoSeleccionado}
                    {estadosConCobertura.has(estadoSeleccionado!) && (
                      <span style={{ marginLeft: '8px', color: '#2D1464', fontSize: '11px', fontWeight: 600 }}>✓</span>
                    )}
                  </span>
                )}

                {nivel === 2 && (
                  <>
                    <button
                      onClick={irAEstado}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8AB8', fontSize: '13px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 600, padding: '2px 4px', borderRadius: '6px', transition: 'color 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#2D1464')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#9B8AB8')}
                    >
                      {estadoSeleccionado}
                    </button>
                    <span style={{ color: '#D4C9E8', fontSize: '12px' }}>›</span>
                    <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#FF6B2B' }}>
                      {municipioSeleccionado}
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          {/* ── Mapa con botón flotante ── */}
          <div style={{ position: 'relative' }}>
            <div ref={mapRef} style={{ height: '240px', width: '100%', cursor: 'pointer' }} />

            {/* Botón flotante de retroceso */}
            {nivel >= 1 && (
              <button
                onClick={nivel === 2 ? irAEstado : irAVenezuela}
                style={{
                  position: 'absolute', top: '12px', left: '12px', zIndex: 1000,
                  background: 'white', border: '2px solid #E8E0D4', borderRadius: '9999px',
                  padding: '7px 14px', cursor: 'pointer',
                  fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '12px',
                  color: '#2D1464', boxShadow: '0 2px 10px rgba(45,20,100,0.18)',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F5F0E8'; e.currentTarget.style.borderColor = '#2D1464' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E8E0D4' }}
              >
                ← {nivel === 2 ? estadoSeleccionado : 'Venezuela'}
              </button>
            )}
          </div>

          {/* ── Leyenda ── */}
          <div style={{ padding: '12px 20px', display: 'flex', gap: '20px', fontSize: '12px', color: '#6B5C90', borderTop: '1px solid #F0EAE0', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#2D1464', display: 'inline-block' }} />
              Con cobertura
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#F5F0E8', border: '1.5px solid #6B5C90', display: 'inline-block' }} />
              Sin cobertura aún
            </span>
            {nivel === 2 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#FF6B2B', display: 'inline-block' }} />
                Seleccionado
              </span>
            )}
          </div>
        </div>
      )}

      <style>{`
        .compaz-tooltip { background: white !important; border: 1.5px solid #E8E0D4 !important; border-radius: 8px !important; padding: 8px 12px !important; box-shadow: 0 2px 8px rgba(45,20,100,0.12) !important; }
        .compaz-tooltip::before { display: none !important; }
        .leaflet-container { font-family: Inter, sans-serif; background: #FDFAF6 !important; }
      `}</style>
    </div>
  )
}
