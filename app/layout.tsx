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
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${bricolage.variable} ${inter.variable}`}>
        {children}
        {/* Cloudflare Turnstile — carga solo cuando se necesita */}
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
