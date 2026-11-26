'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { esRutaConAnalitica } from '@/lib/analitica-rutas'
import { useDecisionCookies } from '@/lib/consentimiento-cliente'

// Los scripts de medición de terceros (Clarity, Google Analytics, Meta) viven aquí y SOLO se cargan en las páginas públicas (lib/analitica-rutas.ts) y con el permiso de la persona (lib/consentimiento.ts). Si alguien entra a
// una pantalla pública y luego navega a una privada, o retira el permiso, sin recargar, los scripts ya cargados siguen vivos: se les pide que paren (mejor esfuerzo; al
// iniciar sesión el servidor redirige y la página se carga de nuevo, sin ellos).
type Ventana = Window & { clarity?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void; [k: string]: unknown }

export default function ScriptsAnaliticos({ gaId, metaPixelId, clarityId }: { gaId?: string; metaPixelId?: string; clarityId?: string }) {
  const pathname = usePathname()
  // Se mide solo en las páginas públicas Y solo si la persona aceptó. Sin decisión (o rechazando) no se carga nada.
  const decision = useDecisionCookies() // el hook se llama siempre, antes de cualquier condición
  const permitido = esRutaConAnalitica(pathname) && decision === 'si'
  const cargados = useRef(false)
  if (permitido) cargados.current = true
  const anterior = useRef<string | null>(null)

  // Meta no sigue sola la navegación interna (fbq.disablePushState): si lo hiciera, contaría una visita a /panel o /portal
  // antes de que el efecto de abajo la frene. Las visitas entre páginas públicas se cuentan aquí, a mano.
  useEffect(() => {
    if (!permitido) { anterior.current = null; return }
    if (anterior.current !== null && anterior.current !== pathname) { try { (window as unknown as Ventana).fbq?.('track', 'PageView') } catch { /* nada */ } }
    anterior.current = pathname
  }, [permitido, pathname])

  useEffect(() => {
    if (permitido || !cargados.current) return
    const w = window as unknown as Ventana
    try { w.clarity?.('stop') } catch { /* el script puede no estar */ }
    try { if (gaId) w[`ga-disable-${gaId}`] = true } catch { /* nada */ }
    try { w.fbq?.('consent', 'revoke') } catch { /* nada */ }
  }, [permitido, gaId])

  if (!permitido) return null
  return (
    <>
      {clarityId && (
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${clarityId}");`}
        </Script>
      )}
      {gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="google-analytics" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');`}
          </Script>
        </>
      )}
      {metaPixelId && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq.disablePushState = true;
              fbq('init', '${metaPixelId}');
              fbq('track', 'PageView');`}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img height="1" width="1" style={{ display: 'none' }} src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`} alt="" />
          </noscript>
        </>
      )}
    </>
  )
}
