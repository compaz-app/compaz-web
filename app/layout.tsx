import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import JsonLd from "@/components/JsonLd";
import ScrollRestoration from "@/components/ScrollRestoration";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// ─── Schema: LocalBusiness ────────────────────────────────────────────────────
const schemaLocalBusiness = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Compaz",
  description:
    "Servicio de visitas verificadas y compañía para adultos mayores en Venezuela, para familias venezolanas en el exterior",
  url: "https://micompaz.com",
  logo: "https://micompaz.com/logo-nav.webp",
  email: "hola@micompaz.com",
  areaServed: {
    "@type": "Country",
    name: "Venezuela",
  },
  serviceType: "Compañía y visitas a domicilio para adultos mayores",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "hola@micompaz.com",
    availableLanguage: "Spanish",
  },
  sameAs: ["https://www.instagram.com/elcompaz"],
};

// ─── Schema: Organization ─────────────────────────────────────────────────────
const schemaOrganization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Compaz",
  url: "https://micompaz.com",
  logo: "https://micompaz.com/logo-nav.webp",
  foundingDate: "2025",
  founders: [
    { "@type": "Person", name: "Juan Tenreiro" },
    { "@type": "Person", name: "Luis Mendoza" },
  ],
  sameAs: ["https://www.instagram.com/elcompaz"],
};

// ─── Schema: FAQPage (preguntas de la sección "¿Tienes dudas?") ───────────────
const schemaFAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "¿Compaz es un servicio de enfermería, limpieza o cuidado asistencial?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. El Compita no es enfermero, ni asistente de higiene, ni servicio de limpieza del hogar. Es un acompañante: alguien que visita a tu familiar, comparte tiempo con él, lo lleva a donde necesite y te mantiene informado. Si tu familiar requiere atención médica o asistencia personal, Compaz no reemplaza eso. Puede ser un complemento, pero no un sustituto. Si tienes dudas sobre si Compaz es lo que necesitas, escríbenos y te orientamos.",
      },
    },
    {
      "@type": "Question",
      name: "¿Cómo sé que el Compita es confiable?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Antes de su primera visita, cada Compita pasa por tres filtros: verificación de identidad con cédula, revisión de antecedentes penales, y una entrevista personal con nuestro equipo. No trabajamos con personas que no conocemos. Si en algún momento no te sientes cómodo con tu Compita asignado, lo cambiamos sin costo.",
      },
    },
    {
      "@type": "Question",
      name: "¿El Compita trabaja por su cuenta o trabaja con ustedes?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Con nosotros. No somos una aplicación que conecta a desconocidos. Somos un equipo. Cada Compita fue seleccionado, entrenado y es supervisado por Compaz.",
      },
    },
    {
      "@type": "Question",
      name: "¿Qué pasa si algo sale mal durante una visita?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tienes nuestro contacto directo durante cada visita. Si ocurre cualquier situación, activamos nuestro protocolo de seguimiento y te mantenemos informado en todo momento. No eres un ticket de soporte: somos personas reales al otro lado.",
      },
    },
    {
      "@type": "Question",
      name: "¿Mi familiar tiene que dejar entrar al Compita solo?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No necesariamente. Las primeras visitas pueden hacerse con un familiar o vecino de confianza presente, hasta que tu familiar se sienta cómodo. Nosotros acompañamos ese proceso. La confianza se construye, no se exige.",
      },
    },
    {
      "@type": "Question",
      name: "¿Puedo hablar con ustedes antes de inscribirme?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí, y lo recomendamos. Escríbenos a hola@micompaz.com y cuéntanos la situación de tu familiar. Te respondemos personalmente.",
      },
    },
    {
      "@type": "Question",
      name: "¿El cuidado a domicilio está regulado en Venezuela?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí. La Ley Orgánica para la Atención y Desarrollo Integral de las Personas Adultas Mayores (Gaceta Oficial N° 6.641, 2021) reconoce el derecho de todo adulto mayor a recibir atención digna, incluyendo atención domiciliaria. Compaz opera dentro de ese marco: los Compitas son acompañantes verificados que respetan la autonomía y dignidad de la persona que visitan.",
      },
    },
    {
      "@type": "Question",
      name: "¿En qué ciudades de Venezuela operan?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Estamos comenzando en Caracas. Si tu familiar está en otra ciudad, inscríbete igualmente — estamos expandiendo y queremos saber dónde hay más necesidad.",
      },
    },
  ],
};

// ─── Schema: Service ──────────────────────────────────────────────────────────
const schemaService = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Visitas verificadas a adultos mayores en Venezuela",
  serviceType: "Compañía a domicilio",
  description:
    "Un Compita verificado visita a tu familiar en Venezuela, lo acompaña, y tú recibes fotos y notas directamente después de cada visita.",
  provider: {
    "@type": "LocalBusiness",
    name: "Compaz",
    url: "https://micompaz.com",
  },
  areaServed: {
    "@type": "Country",
    name: "Venezuela",
  },
  url: "https://micompaz.com",
};

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Compaz — Cuidado y compañía para tu familiar en Venezuela",
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
    other: { "facebook-domain-verification": "o9x9mlpmzzo8egcdn345ehqwfjc2w" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  return (
    <html lang="es">
      <head>
        {process.env.NEXT_PUBLIC_GSC_VERIFICATION && (
          <meta name="google-site-verification" content={process.env.NEXT_PUBLIC_GSC_VERIFICATION} />
        )}
        <JsonLd data={schemaLocalBusiness} />
        <JsonLd data={schemaOrganization} />
        <JsonLd data={schemaFAQ} />
        <JsonLd data={schemaService} />
      </head>
      <body className={`${bricolage.variable} ${inter.variable}`}>
        <ScrollRestoration />
        {children}
        {/* Microsoft Clarity — strategy afterInteractive evita conflicto con hidratación de React */}
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","y62sqpjuto");`}
        </Script>
        {/* Cloudflare Turnstile — carga solo cuando se necesita */}
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="lazyOnload"
        />
        {/* Google Analytics */}
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `}
            </Script>
          </>
        )}
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
