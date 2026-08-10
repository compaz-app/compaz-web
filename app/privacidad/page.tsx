import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidad — Compaz",
  robots: { index: false, follow: false },
};

const secciones = [
  {
    titulo: "Qué datos recolectamos",
    cuerpo:
      "Cuando llenas el formulario de lista de espera en esta página, recolectamos tu nombre, tu número de WhatsApp, tu email y la ciudad donde vive tu familiar en Venezuela.",
  },
  {
    titulo: "Para qué los usamos",
    cuerpo:
      "Usamos estos datos únicamente para contactarte sobre el servicio Compaz y gestionar tu lugar en la lista de espera del piloto. No los vendemos.",
  },
  {
    titulo: "Dónde se guardan",
    cuerpo:
      "Tus datos se almacenan en Airtable, nuestro proveedor de base de datos, con acceso restringido al equipo de Compaz.",
  },
  {
    titulo: "Publicidad y Meta Pixel",
    cuerpo:
      "Usamos Meta Pixel (Facebook) para medir la efectividad de nuestra publicidad. Esto implica compartir cierta información de tu navegación en este sitio con Meta, conforme a sus propias políticas de privacidad.",
  },
  {
    titulo: "Cómo pedir que borremos tus datos",
    cuerpo:
      "Puedes escribirnos en cualquier momento a hola@micompaz.com para solicitar que eliminemos tu información de nuestra lista de espera.",
  },
];

export default function PrivacidadPage() {
  return (
    <main style={{ backgroundColor: "#FDFAF6" }} className="min-h-screen px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold mb-10 hover:opacity-70 transition-opacity"
          style={{ color: "#2D1464", fontFamily: "var(--font-inter)" }}
        >
          ← Volver al inicio
        </Link>

        <h1
          className="text-3xl sm:text-4xl font-extrabold mb-2 leading-tight"
          style={{ color: "#2D1464", fontFamily: "var(--font-display)", textWrap: "balance" }}
        >
          Política de privacidad
        </h1>
        <p
          className="text-sm mb-12"
          style={{ color: "#6B5C90", fontFamily: "var(--font-inter)" }}
        >
          Última actualización: 10 de agosto de 2026
        </p>

        <div className="flex flex-col gap-9">
          {secciones.map(({ titulo, cuerpo }) => (
            <section key={titulo}>
              <h2
                className="text-lg sm:text-xl font-bold mb-2"
                style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
              >
                {titulo}
              </h2>
              <p
                className="text-base leading-relaxed"
                style={{ color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
              >
                {cuerpo}
              </p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
