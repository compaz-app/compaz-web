'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Componente invisible que llama a router.refresh() cada `intervaloSeg` segundos.
 * Úsalo en cualquier Server Component para que se actualice solo sin recargar la página.
 */
export default function AutoRefresh({ intervaloSeg = 30 }: { intervaloSeg?: number }) {
  const router = useRouter()

  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervaloSeg * 1000)
    return () => clearInterval(t)
  }, [router, intervaloSeg])

  return null
}
