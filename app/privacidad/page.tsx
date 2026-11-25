import type { Metadata } from "next";
import Link from "next/link";
import CambiarCookies from "@/components/CambiarCookies";

export const metadata: Metadata = {
  title: "Privacidad — Compaz",
  robots: { index: false, follow: false },
};

const secciones: { id?: string; titulo: string; cuerpo: string }[] = [
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
      "Tus datos se almacenan en Supabase, nuestro proveedor de base de datos, con acceso restringido al equipo de Compaz.",
  },
  {
    id: "cookies",
    titulo: "Cookies y medición",
    cuerpo:
      "Para iniciar sesión usamos cookies necesarias; no piden permiso. Para saber qué funciona en esta página pública usamos tres servicios de medición: Google Analytics, Microsoft Clarity (que puede registrar cómo se usa la pantalla) y Meta Pixel (Facebook), con el que además medimos la efectividad de nuestra publicidad. Esto implica compartir cierta información de tu navegación en esta página pública con esas empresas, conforme a sus propias políticas. Solo se activan si tú aceptas en el aviso de cookies, y no se usan en el portal, ni en las pantallas con enlaces privados. Aparte medimos, sin cookies y sin guardar quién eres, cuánto tarda en cargar cada pantalla para hacerla más rápida. Puedes cambiar tu decisión cuando quieras aquí abajo. Este texto es provisional, pendiente de revisión legal.",
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
          Última actualización: 18 de noviembre de 2026
        </p>

        <div className="flex flex-col gap-9">
          {secciones.map(({ id, titulo, cuerpo }) => (
            <section key={titulo} id={id}>
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
              {id === "cookies" && <CambiarCookies />}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
