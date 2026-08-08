import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Compaz — Para inversionistas",
  description: "Información para inversionistas sobre Compaz.",
  robots: { index: false, follow: false },
};

const fases = [
  {
    n: "1",
    titulo: "Validación",
    copy: "Familias individuales, Caracas y 2–3 ciudades. Demostrar retención, NPS, y el modelo de Compas verificados.",
  },
  {
    n: "2",
    titulo: "Escala",
    copy: "1 o 2 alianzas B2B2C piloto con una fintech de remesas o un empleador grande. De familias individuales a miles en un contrato.",
  },
  {
    n: "3",
    titulo: "Expansión regional",
    copy: "Mismo patrón en otros corredores de migración LATAM: Colombia, Honduras, El Salvador.",
  },
];

export default function Inversionistas() {
  return (
    <>
      <nav
        style={{ backgroundColor: "#2D1464" }}
        className="sticky top-0 z-50"
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <Image
              src="/logo-nav.webp"
              alt="Compaz"
              width={160}
              height={50}
              className="h-9 w-auto object-contain"
            />
          </Link>
          <Link
            href="/"
            className="text-white/70 hover:text-white text-sm font-medium transition-colors"
          >
            ← Volver al sitio
          </Link>
        </div>
      </nav>

      <main style={{ backgroundColor: "#FDFAF6" }}>
        {/* Hero */}
        <section style={{ backgroundColor: "#2D1464" }} className="py-24">
          <div className="max-w-5xl mx-auto px-6">
            <p
              className="text-sm font-bold tracking-widest uppercase mb-6"
              style={{ color: "#FFD23F", fontFamily: "var(--font-display)" }}
            >
              Para inversionistas. Confidencial.
            </p>
            <h1
              className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white leading-[1.05] mb-8"
              style={{ fontFamily: "var(--font-display)" }}
            >
              El modelo que
              <br />
              convirtió a Papa en
              <br />
              <span style={{ color: "#FF6B2B" }}>$1.4 mil millones</span>
              <br />
              replicado en LATAM.
            </h1>
            <p
              className="text-xl text-white/75 max-w-2xl leading-relaxed"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              Compaz es la primera plataforma de cuidado por compañía para
              adultos mayores en Venezuela, diseñada para escalar vía alianzas
              B2B2C con fintechs de remesas, aseguradoras, y empleadores.
            </p>
          </div>
        </section>

        {/* Por qué escala */}
        <section className="py-24">
          <div className="max-w-5xl mx-auto px-6">
            <h2
              className="text-4xl font-extrabold mb-8"
              style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
            >
              Por qué esto escala
            </h2>
            <div className="prose-custom space-y-6 text-lg leading-relaxed max-w-3xl"
              style={{ color: "#4A3B6B", fontFamily: "var(--font-inter)" }}>
              <p>
                No vendemos visitas una por una. Papa.com, la referencia de
                este modelo en EE.UU., no creció familia por familia. Creció
                firmando contratos con aseguradoras de salud (Medicare
                Advantage, Medicaid) y empleadores, que de un solo contrato le
                dieron acceso a miles de miembros. Hoy Papa está valorada en{" "}
                <strong style={{ color: "#2D1464" }}>$1.4 mil millones</strong>,
                con $24M de ingresos reportados en 2021 (~58× múltiplo
                ingresos/valoración).
              </p>
              <p>
                Venezuela no tiene un sistema de seguros que cubra esto, pero
                tiene el mismo tipo de institución en otros tres lugares:
              </p>
            </div>

            {/* Por qué ahora */}
            <div
              className="mt-10 rounded-2xl p-8 max-w-3xl"
              style={{ backgroundColor: "#2D1464" }}
            >
              <p
                className="text-sm font-bold tracking-widest uppercase mb-3"
                style={{ color: "#FFD23F", fontFamily: "var(--font-display)" }}
              >
                Por qué ahora
              </p>
              <p
                className="text-white/85 leading-relaxed"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                La migración venezolana está en su punto más alto de la
                historia reciente del país, y sigue creciendo. Las remesas
                hacia Venezuela superan los $3–5 mil millones de dólares
                anuales, y la adopción de fintechs de remesas entre la
                diáspora crece cada año. La infraestructura de pago y
                confianza que Compaz necesita para escalar ya existe y ya está
                siendo usada masivamente. El momento para construir la capa de
                cuidado sobre esa infraestructura es ahora, antes de que otro
                lo haga.
              </p>
              <p
                className="text-xs mt-4"
                style={{ color: "rgba(255,255,255,0.65)", fontFamily: "var(--font-inter)" }}
              >
                Nota: verificar cifra de remesas con fuente antes de publicar.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-10">
              {[
                {
                  titulo: "Fintechs y remesadoras",
                  copy: "Zelle, Western Union, Zinli, Reserve, Airtm. Millones de usuarios venezolanos en el exterior enviando dinero cada mes. Compaz se integra como una opción más: enviar cuidado, no solo enviar dinero.",
                },
                {
                  titulo: "Empleadores",
                  copy: "Alta concentración de empleados venezolanos migrantes. Compaz como beneficio de bienestar familiar: un contrato que trae cientos o miles de familias.",
                },
                {
                  titulo: "Fundaciones y ONGs",
                  copy: "Organizaciones venezolanas en el exterior con redes de alcance masivo y misión alineada al bienestar de las familias que quedaron.",
                },
              ].map((c) => (
                <div
                  key={c.titulo}
                  className="rounded-2xl p-6"
                  style={{ backgroundColor: "#F5F0E8" }}
                >
                  <h3
                    className="font-bold text-lg mb-3"
                    style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
                  >
                    {c.titulo}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "#4A3B6B", fontFamily: "var(--font-inter)" }}
                  >
                    {c.copy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ventaja de datos */}
        <section style={{ backgroundColor: "#FF6B2B" }} className="py-20">
          <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2
                className="text-4xl font-extrabold text-white mb-6 leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Por qué los datos son
                una ventaja que crece sola.
              </h2>
              <p
                className="text-white/85 text-lg leading-relaxed"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                Cada visita genera información: qué necesita cada adulto
                mayor, qué Compas tienen mejor desempeño, qué patrones de
                cuidado funcionan mejor. Cuantas más visitas se acumulan, más
                difícil es para un nuevo competidor alcanzar el mismo nivel de
                calidad y confianza.
              </p>
            </div>
            <div className="space-y-4">
              {[
                "Verificación digital de Compas",
                "Sistema de scoring de calidad por visita",
                "Matching automatizado por ubicación y necesidad",
                "Panel familiar con historial completo",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-4 rounded-xl px-5 py-4"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                >
                  <span className="text-white font-bold text-xl">→</span>
                  <span
                    className="text-white font-semibold"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Métricas */}
        <section style={{ backgroundColor: "#FDFAF6" }} className="py-20">
          <div className="max-w-5xl mx-auto px-6">
            <h2
              className="text-4xl font-extrabold mb-4"
              style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
            >
              Lo que medimos desde el día uno
            </h2>
            <p
              className="text-lg max-w-2xl mb-10"
              style={{ color: "#4A3B6B", fontFamily: "var(--font-inter)" }}
            >
              Aún no tenemos volumen, pero desde la primera visita estamos
              armando la disciplina de medir esto, que es lo que nos va a permitir
              mostrar tracción real en los próximos meses.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                "Retención mensual de familias",
                "NPS familiar post-visita",
                "Costo de adquisición y verificación por Compa",
                "Frecuencia de uso por familia",
              ].map((m) => (
                <div
                  key={m}
                  className="flex items-center gap-4 rounded-xl px-6 py-4"
                  style={{ backgroundColor: "#F5F0E8", border: "2px solid #E8E0D4" }}
                >
                  <span style={{ color: "#FF6B2B", fontWeight: 700, fontSize: "1.25rem", lineHeight: 1 }}>→</span>
                  <span
                    className="font-semibold"
                    style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
                  >
                    {m}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section className="py-24">
          <div className="max-w-5xl mx-auto px-6">
            <h2
              className="text-4xl font-extrabold mb-12"
              style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
            >
              Fases de crecimiento
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {fases.map((f) => (
                <div
                  key={f.n}
                  className="rounded-2xl p-6"
                  style={{ backgroundColor: "#2D1464" }}
                >
                  <span
                    className="text-5xl font-extrabold mb-4 block"
                    style={{ color: "#FF6B2B", fontFamily: "var(--font-display)" }}
                  >
                    {f.n}
                  </span>
                  <h3
                    className="font-bold text-xl text-white mb-3"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {f.titulo}
                  </h3>
                  <p
                    className="text-white/70 text-sm leading-relaxed"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    {f.copy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contacto */}
        <section style={{ backgroundColor: "#1A0A3C" }} className="py-16">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <p
              className="text-white/60 text-sm mb-4"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              Esta página es confidencial y no está indexada por buscadores.
            </p>
            <h2
              className="text-3xl font-extrabold text-white mb-8"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Hablemos.
            </h2>
            <a
              href="https://wa.me/message/compaz"
              target="_blank"
              rel="noopener noreferrer"
              style={{ backgroundColor: "#FF6B2B" }}
              className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-full hover:opacity-90 transition-opacity"
            >
              Contactar al equipo de Compaz
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
