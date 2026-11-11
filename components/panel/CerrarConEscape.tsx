'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** No dibuja nada: con la tecla Escape vuelve a la dirección dada (cierra el panel lateral que la use). */
export default function CerrarConEscape({ href }: { href: string }) {
  const router = useRouter()
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') router.replace(href, { scroll: false }) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [router, href])
  return null
}
