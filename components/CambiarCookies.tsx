'use client'

import Boton from '@/components/ui/base/Boton'
import { guardarDecisionCookies, olvidarDecisionCookies, useDecisionCookies } from '@/lib/consentimiento-cliente'

/** En la página de privacidad: ver y cambiar la decisión de cookies en cualquier momento. */
export default function CambiarCookies() {
  const d = useDecisionCookies()
  const estado = d === 'si' ? 'Aceptaste las cookies de medición.' : d === 'no' ? 'Elegiste solo las cookies necesarias.' : d === 'pendiente' ? 'Todavía no has elegido.' : ''
  return (
    <div className="mt-4 rounded-2xl border border-borde bg-blanco p-4">
      <p role="status" className="text-sm font-bold text-morado-profundo">{estado}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Boton variante="secundario" info="Desactiva la medición y borra tu elección anterior: solo quedan las cookies necesarias para iniciar sesión." onClick={() => guardarDecisionCookies('no')}>Solo las necesarias</Boton>
        <Boton variante="primario" info="Activa Google Analytics, Microsoft Clarity y Meta para medir qué funciona en la página pública." onClick={() => guardarDecisionCookies('si')}>Aceptar la medición</Boton>
      </div>
      <button type="button" onClick={olvidarDecisionCookies} className="mt-3 text-sm font-bold text-morado-claro underline">Borrar mi elección y que me pregunten otra vez</button>
    </div>
  )
}
