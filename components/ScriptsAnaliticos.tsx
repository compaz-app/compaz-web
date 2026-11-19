'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { esRutaConAnalitica } from '@/lib/analitica-rutas'

// Los scripts de medición de terceros (Clarity, Google Analytics, Meta) viven aquí y SOLO se cargan en las páginas públicas (lib/analitica-rutas.ts). Si alguien entra a
// una pantalla pública y luego navega dentro de la misma sesión a una privada, los scripts ya cargados siguen vivos: se les pide que paren (mejor esfuerzo; al
// iniciar sesión el servidor redirige y la página se carga de nuevo, sin ellos).
type Ventana = Window & { clarity?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void; [k: string]: unknown }

export default function ScriptsAnaliticos({ gaId, metaPixelId, clarityId }: { gaId?: string; metaPixelId?: string; clarityId?: string }) {
  const pathname = usePathname()
  const permitido = esRutaConAnalitica(pathname)
  const cargados = useRef(false)
  if (permitido) cargados.current = true

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
