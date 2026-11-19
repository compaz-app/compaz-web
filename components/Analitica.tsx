'use client'

// Analítica de la web pública (Clarity, Google Analytics y Meta Pixel), solo en las rutas de lib/analitica.ts.
// · Si la primera página es privada, no se carga ningún script de terceros.
// · Si alguien llega a una página privada navegando dentro de la web (sin recargar), se detiene Clarity,
//   se bloquea el envío a Google Analytics y Meta no registra la visita (Meta no sigue la navegación interna solo).
// · Al volver a una página pública, todo se reanuda y se cuenta la visita como antes.
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useLayoutEffect, useRef } from 'react'
import { CLARITY_ID, rutaConAnalitica } from '@/lib/analitica'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
const META_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

type Ventana = Window & { clarity?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void } & Record<string, unknown>

export default function Analitica() {
  const ruta = usePathname()
  const publica = rutaConAnalitica(ruta)
  const anterior = useRef<string | null>(null)
  const detenida = useRef(false)

  // useLayoutEffect: corre antes de pintar la página nueva, para cortar la medición lo antes posible.
  useLayoutEffect(() => {
    const w = window as unknown as Ventana
    if (GA_ID) w[`ga-disable-${GA_ID}`] = !publica
    if (!publica) { if (w.clarity) { w.clarity('stop'); detenida.current = true } anterior.current = ruta; return }
    if (detenida.current) { w.clarity?.('start'); detenida.current = false }
    // La primera visita la cuenta el propio píxel al iniciarse; las navegaciones internas, aquí.
    if (anterior.current !== null && anterior.current !== ruta) w.fbq?.('track', 'PageView')
    anterior.current = ruta
  }, [ruta, publica])

  if (!publica) return null
  return (
    <>
      <Script id="clarity-init" strategy="afterInteractive">
        {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${CLARITY_ID}");`}
      </Script>
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="google-analytics" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
          </Script>
        </>
      )}
      {META_ID && (
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
fbq('init', '${META_ID}');
fbq('track', 'PageView');`}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img height="1" width="1" style={{ display: 'none' }} src={`https://www.facebook.com/tr?id=${META_ID}&ev=PageView&noscript=1`} alt="" />
          </noscript>
        </>
      )}
    </>
  )
}
