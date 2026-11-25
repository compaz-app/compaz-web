'use client'

import { useEffect, useRef } from 'react'
import { useReportWebVitals } from 'next/web-vitals'

// Mide, en el navegador de cada persona, cuánto tarda en verse y responder la pantalla, y lo manda a /api/vitals. Es lo único que dice la verdad sobre la velocidad:
// las pruebas en la oficina no se parecen a un celular con datos lentos. Junta las señales y las envía una sola vez cuando la persona se va de la pantalla
// (sendBeacon no frena nada ni se pierde al cerrar). No manda IP, usuario ni la dirección completa; el servidor además la reduce a su primer tramo.
type Medicion = { nombre: string; valor: number; ruta: string; conexion: string | null; movil: boolean }

export default function MedirVelocidadReal() {
  const cola = useRef<Medicion[]>([])

  useReportWebVitals((m) => {
    const conexion = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? null
    cola.current.push({ nombre: m.name, valor: m.value, ruta: window.location.pathname, conexion, movil: window.innerWidth < 768 })
  })

  useEffect(() => {
    const enviar = () => {
      if (cola.current.length === 0) return
      const cuerpo = JSON.stringify({ m: cola.current.splice(0, 20) })
      try { if (!navigator.sendBeacon('/api/vitals', new Blob([cuerpo], { type: 'text/plain' }))) void fetch('/api/vitals', { method: 'POST', body: cuerpo, keepalive: true }) } catch { /* medir nunca debe romper la pantalla */ }
    }
    const alOcultar = () => { if (document.visibilityState === 'hidden') enviar() }
    document.addEventListener('visibilitychange', alOcultar)
    window.addEventListener('pagehide', enviar)
    return () => { document.removeEventListener('visibilitychange', alOcultar); window.removeEventListener('pagehide', enviar) }
  }, [])

  return null
}
