'use client'

import { usePathname } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import { esRutaConAnalitica } from '@/lib/analitica-rutas'
import { guardarDecisionCookies, useDecisionCookies } from '@/lib/consentimiento-cliente'

// Aviso de cookies de medición. Solo aparece en las páginas públicas donde se mide, y solo si la persona aún no decidió. Aceptar y rechazar pesan lo mismo y están a la
// misma altura (rechazar no debe costar más esfuerzo que aceptar). Sin decisión no se carga ninguna cookie de medición. Texto pendiente de revisión legal.
export default function AvisoCookies() {
  const pathname = usePathname()
  const decision = useDecisionCookies()
  if (!esRutaConAnalitica(pathname) || decision !== 'pendiente') return null
  return (
    <div role="dialog" aria-label="Cookies" className="fixed inset-x-0 bottom-0 z-50 border-t border-borde bg-blanco p-4 shadow-lg sm:p-5">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <p className="text-sm leading-snug text-texto sm:flex-1">
          Usamos cookies de medición (Google Analytics, Microsoft Clarity y Meta) para saber qué funciona y mejorar la página. Solo se activan si aceptas.
          Las necesarias para iniciar sesión no piden permiso. <a href="/privacidad#cookies" className="font-bold underline">Más información</a>
        </p>
        <div className="grid grid-cols-2 gap-2 sm:w-96 sm:shrink-0">
          <Boton variante="secundario" info="Solo se usan las cookies necesarias para iniciar sesión. No se activa ninguna medición. Puedes cambiarlo cuando quieras desde la página de privacidad." onClick={() => guardarDecisionCookies('no')}>Solo las necesarias</Boton>
          <Boton variante="primario" info="Se activan Google Analytics, Microsoft Clarity y Meta para medir qué funciona en esta página. Puedes cambiarlo cuando quieras desde la página de privacidad." onClick={() => guardarDecisionCookies('si')}>Aceptar</Boton>
        </div>
      </div>
    </div>
  )
}
