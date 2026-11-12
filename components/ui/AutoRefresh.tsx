'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Componente invisible que vuelve a pedir la página al servidor para que se actualice sola. Cada refresco ejecuta de nuevo toda la página en el
 * servidor, así que cuesta dinero: por eso
 *  1. NO refresca mientras la pestaña está oculta o en segundo plano (nadie lo está viendo);
 *  2. al volver a la pestaña refresca de inmediato si ya tocaba, para no mostrar algo viejo;
 *  3. solo refresca rápido (`intervaloSeg`) cuando se espera algo de verdad (`rapido`); en reposo espera `reposoSeg`.
 */
export default function AutoRefresh({ intervaloSeg = 30, rapido = true, reposoSeg = 120 }: { intervaloSeg?: number; rapido?: boolean; reposoSeg?: number }) {
  const router = useRouter()
  const seg = rapido ? intervaloSeg : Math.max(reposoSeg, intervaloSeg)

  useEffect(() => {
    let ultimo = Date.now()
    const refrescar = () => { ultimo = Date.now(); router.refresh() }
    const t = setInterval(() => { if (document.visibilityState === 'visible') refrescar() }, seg * 1000)
    const alVolver = () => { if (document.visibilityState === 'visible' && Date.now() - ultimo >= seg * 1000) refrescar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver) }
  }, [router, seg])

  return null
}
