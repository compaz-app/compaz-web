import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Compaz — Cuidado y compañía para tu familiar en Venezuela [v2]",
  description:
    "Compaz conecta a hijos e hijas en el exterior con su familia en Venezuela. Un Compa los visita, los acompaña, y tú recibes fotos y notas de cada visita.",
  keywords: [
    "cuidado adultos mayores Venezuela",
    "compañía para mi mamá en Venezuela desde el exterior",
    "visitas a domicilio Venezuela",
    "cuidado venezolanos migrantes",
    "Compaz",
  ],
  metadataBase: new URL("https://micompaz.com"),
  openGraph: {
    title: "Compaz — Cuidado y compañía para tu familiar en Venezuela",
    description:
      "Un Compa visita a tu familiar, los acompaña, y tú recibes fotos y notas de cada visita.",
    url: "https://micompaz.com",
    siteName: "Compaz",
    locale: "es_VE",
    type: "website",
    images: [{ url: "https://micompaz.com/images/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["https://micompaz.com/images/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  return (
    <html lang="es">
      <body className={`${bricolage.variable} ${inter.variable}`}>
        {children}
        {/* Cloudflare Turnstile — carga solo cuando se necesita */}
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="lazyOnload"
        />
        {/* Meta Pixel — solo se activa si hay un Pixel ID configurado */}
        {metaPixelId && (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${metaPixelId}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
      </body>
    </html>
  );
}
