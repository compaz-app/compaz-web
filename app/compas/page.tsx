"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const zonas = ["Todas las zonas", "Chacao", "Baruta", "Los Palos Grandes", "El Hatillo", "La Candelaria", "Altamira", "San Bernardino", "Chacaíto"];

const compas = [
  {
    nombre: "Ana R.",
    zona: "Chacao",
    foto: "/images/compa-mujer4.jpg",
    rating: 5.0,
    visitas: 34,
    resena: "Muy puntual y cariñosa con mi mamá. Se quedó más de lo acordado porque ella quería seguir hablando.",
    familia: "Familia R.",
    especialidades: ["Compañía", "Mandados"],
    disponible: true,
  },
  {
    nombre: "Rosa M.",
    zona: "El Hatillo",
    foto: "/images/compa-mujer7.jpg",
    rating: 4.9,
    visitas: 28,
    resena: "Acompañó a mi mamá al cardiólogo y tomó notas de todo lo que dijo el doctor.",
    familia: "Familia L.",
    especialidades: ["Médico", "Compañía"],
    disponible: true,
  },
  {
    nombre: "María G.",
    zona: "Los Palos Grandes",
    foto: "/images/compa-mujer3.jpg",
    rating: 4.9,
    visitas: 24,
    resena: "Mi abuela dice que es como tener una nieta en casa. Ya no se siente sola.",
    familia: "Familia G.",
    especialidades: ["Compañía", "Médico", "Mandados"],
    disponible: true,
  },
  {
    nombre: "Carlos P.",
    zona: "Baruta",
    foto: "/images/compa-carlos.jpg",
    rating: 4.8,
    visitas: 17,
    resena: "Mi papá lo espera cada semana. Le ayuda con las pastillas y lo lleva al médico sin problema.",
    familia: "Familia M.",
    especialidades: ["Médico", "Mandados", "Compañía"],
    disponible: true,
  },
  {
    nombre: "Elena V.",
    zona: "Altamira",
    foto: "/images/compa-mujer1.jpg",
    rating: 4.8,
    visitas: 15,
    resena: "Muy organizada. Siempre llega a tiempo y mi abuela la adora. Ya la considera parte de la familia.",
    familia: "Familia V.",
    especialidades: ["Compañía", "Mandados"],
    disponible: true,
  },
  {
    nombre: "José A.",
    zona: "La Candelaria",
    foto: "/images/compa-jose.jpg",
    rating: 4.7,
    visitas: 12,
    resena: "Muy responsable. Siempre manda el reporte con fotos el mismo día de la visita.",
    familia: "Familia S.",
    especialidades: ["Compañía", "Mandados"],
    disponible: false,
  },
  {
    nombre: "Laura C.",
    zona: "San Bernardino",
    foto: "/images/compa-mujer2.jpg",
    rating: 4.7,
    visitas: 10,
    resena: "Paciente y atenta. Mi mamá le tiene mucha confianza y me llama cada vez que viene.",
    familia: "Familia C.",
    especialidades: ["Compañía", "Médico"],
    disponible: true,
  },
  {
    nombre: "Miguel T.",
    zona: "Chacaíto",
    foto: "/images/compa-hombre5.jpg",
    rating: 4.6,
    visitas: 9,
    resena: "Muy serio y comprometido. Mi papá dice que con él se siente acompañado de verdad.",
    familia: "Familia T.",
    especialidades: ["Compañía", "Mandados"],
    disponible: true,
  },
  {
    nombre: "Valentina O.",
    zona: "Los Palos Grandes",
    foto: "/images/compa-mujer5.jpg",
    rating: 4.6,
    visitas: 8,
    resena: "Muy detallista. Manda fotos y un resumen escrito de cada visita. Da mucha tranquilidad.",
    familia: "Familia O.",
    especialidades: ["Compañía", "Mandados"],
    disponible: true,
  },
  {
    nombre: "Pedro R.",
    zona: "Chacao",
    foto: "/images/compa-maria.jpg",
    rating: 4.6,
    visitas: 7,
    resena: "Cumplido y amable. A mi abuelito le encanta conversar con él sobre béisbol.",
    familia: "Familia R.",
    especialidades: ["Compañía"],
    disponible: true,
  },
  {
    nombre: "Gabriela F.",
    zona: "Baruta",
    foto: "/images/compa-mujer6.jpg",
    rating: 4.5,
    visitas: 6,
    resena: "Recién empezó pero ya se nota su vocación. Mi mamá se alegra cuando sabe que viene.",
    familia: "Familia F.",
    especialidades: ["Compañía", "Mandados"],
    disponible: true,
  },
  {
    nombre: "Luis B.",
    zona: "Altamira",
    foto: "/images/compa-ana.jpg",
    rating: 4.5,
    visitas: 5,
    resena: "Muy tranquilo y respetuoso. Mi papá valora que llegue siempre puntual y sin excusas.",
    familia: "Familia B.",
    especialidades: ["Compañía"],
    disponible: false,
  },
];

const PER_PAGE = 6;

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="font-bold tabular-nums" style={{ color: "#2D1464", fontFamily: "var(--font-plus-jakarta)" }}>
      {rating.toFixed(1)} <span style={{ color: "#FF6B2B" }}>★</span>
    </span>
  );
}

export default function CompasPage() {
  const [zona, setZona] = useState("Todas las zonas");
  const [page, setPage] = useState(1);

  const filtrados = zona === "Todas las zonas"
    ? compas
    : compas.filter((c) => c.zona === zona);

  const totalPages = Math.ceil(filtrados.length / PER_PAGE);
  const pagina = filtrados.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const top = compas[0];

  const cambiarZona = (z: string) => {
    setZona(z);
    setPage(1);
  };

  return (
    <>
      <nav style={{ backgroundColor: "#2D1464" }} className="sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo-nav.webp" alt="Compaz" width={160} height={50} className="h-9 w-auto object-contain" />
          </Link>
          <Link href="/#lista-de-espera"
            style={{ backgroundColor: "#FF6B2B" }}
            className="text-white font-bold text-sm px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity">
            Únete a la lista
          </Link>
        </div>
      </nav>

      <main style={{ backgroundColor: "#FDFAF6" }}>

        {/* Header */}
        <section style={{ backgroundColor: "#2D1464" }} className="py-16">
          <div className="max-w-5xl mx-auto px-6">
            <p className="text-sm font-bold tracking-widest uppercase mb-4"
              style={{ color: "#FFD23F", fontFamily: "var(--font-plus-jakarta)" }}>
              Red de Compas
            </p>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4"
              style={{ fontFamily: "var(--font-plus-jakarta)" }}>
              Los Compas activos<br />en Caracas.
            </h1>
            <p className="text-white/70 text-lg max-w-xl leading-relaxed"
              style={{ fontFamily: "var(--font-inter)" }}>
              Cada Compa pasa por verificación de antecedentes, entrevista personal y validación de referencias. Ordenados por calificación y visitas realizadas.
            </p>
          </div>
        </section>

        {/* Compa destacada */}
        <section className="py-12 border-b" style={{ borderColor: "#E8E0D4" }}>
          <div className="max-w-5xl mx-auto px-6">
            <p className="text-xs font-bold tracking-widest uppercase mb-6"
              style={{ color: "#FF6B2B", fontFamily: "var(--font-plus-jakarta)" }}>
              Mejor calificada este mes
            </p>
            <div className="flex flex-col sm:flex-row gap-6 items-start rounded-2xl p-6"
              style={{ backgroundColor: "white", border: "2px solid #E8E0D4" }}>
              <div className="relative shrink-0 w-28 h-36 rounded-xl overflow-hidden"
                style={{ border: "3px solid #FFD23F" }}>
                <Image src={top.foto} alt={top.nombre} fill className="object-cover object-top" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h2 className="text-2xl font-extrabold"
                    style={{ color: "#2D1464", fontFamily: "var(--font-plus-jakarta)" }}>
                    {top.nombre}
                  </h2>
                  <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "#F5F0E8", color: "#2D1464" }}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#FF6B2B" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Verificada
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                    style={{ backgroundColor: "#2D1464" }}>
                    Disponible esta semana
                  </span>
                </div>
                <p className="text-sm mb-3" style={{ color: "#8B7BAA", fontFamily: "var(--font-inter)" }}>
                  {top.zona}, Caracas
                </p>
                <div className="flex items-center gap-4 mb-3">
                  <StarRating rating={top.rating} />
                  <span className="text-sm" style={{ color: "#4A3B6B", fontFamily: "var(--font-inter)" }}>
                    {top.visitas} visitas realizadas
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap mb-4">
                  {top.especialidades.map(e => (
                    <span key={e} className="text-xs font-semibold px-3 py-1 rounded-full"
                      style={{ backgroundColor: "#F5F0E8", color: "#2D1464", fontFamily: "var(--font-plus-jakarta)" }}>
                      {e}
                    </span>
                  ))}
                </div>
                <blockquote className="text-sm italic leading-relaxed"
                  style={{ color: "#4A3B6B", fontFamily: "var(--font-inter)" }}>
                  "{top.resena}"
                  <footer className="text-xs mt-1 font-semibold not-italic" style={{ color: "#8B7BAA" }}>
                    {top.familia}
                  </footer>
                </blockquote>
              </div>
            </div>
          </div>
        </section>

        {/* Filtro + grid */}
        <section className="py-10">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
              <p className="text-sm font-semibold" style={{ color: "#4A3B6B", fontFamily: "var(--font-inter)" }}>
                {filtrados.length} Compas verificados
              </p>
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold" style={{ color: "#2D1464", fontFamily: "var(--font-plus-jakarta)" }}>
                  Zona:
                </label>
                <select value={zona} onChange={e => cambiarZona(e.target.value)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold outline-none cursor-pointer"
                  style={{ backgroundColor: "white", color: "#2D1464", border: "2px solid #E8E0D4", fontFamily: "var(--font-plus-jakarta)" }}>
                  {zonas.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {pagina.map((c, i) => {
                const rankGlobal = compas.indexOf(c);
                return (
                  <div key={c.nombre} className="rounded-2xl overflow-hidden flex flex-col"
                    style={{ backgroundColor: "white", border: "2px solid #E8E0D4" }}>

                    {/* Foto carnet + datos */}
                    <div className="flex items-start gap-4 p-5 pb-3">
                      <div className="relative shrink-0 w-16 h-20 rounded-lg overflow-hidden"
                        style={{ border: rankGlobal === 0 ? "2px solid #FFD23F" : "2px solid #E8E0D4" }}>
                        <Image src={c.foto} alt={c.nombre} fill className="object-cover object-top" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-extrabold text-base leading-tight"
                            style={{ color: "#2D1464", fontFamily: "var(--font-plus-jakarta)" }}>
                            {c.nombre}
                          </p>
                          {rankGlobal < 3 && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: rankGlobal === 0 ? "#FFD23F" : "#F5F0E8", color: "#2D1464" }}>
                              #{rankGlobal + 1}
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "#8B7BAA", fontFamily: "var(--font-inter)" }}>
                          {c.zona}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <StarRating rating={c.rating} />
                          <span className="text-xs" style={{ color: "#8B7BAA", fontFamily: "var(--font-inter)" }}>
                            {c.visitas} visitas
                          </span>
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-bold shrink-0"
                        style={{ color: "#FF6B2B", fontFamily: "var(--font-plus-jakarta)" }}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Verificado
                      </span>
                    </div>

                    {/* Especialidades */}
                    <div className="flex gap-1.5 flex-wrap px-5 pb-3">
                      {c.especialidades.map(e => (
                        <span key={e} className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: "#F5F0E8", color: "#4A3B6B", fontFamily: "var(--font-inter)" }}>
                          {e}
                        </span>
                      ))}
                    </div>

                    {/* Reseña */}
                    <blockquote className="text-xs leading-relaxed mx-5 mb-3 pt-3 flex-1"
                      style={{ color: "#4A3B6B", fontFamily: "var(--font-inter)", borderTop: "1px solid #E8E0D4" }}>
                      "{c.resena}"
                      <footer className="text-xs mt-1.5 font-semibold not-italic" style={{ color: "#8B7BAA" }}>
                        {c.familia}
                      </footer>
                    </blockquote>

                    {/* Disponibilidad */}
                    <div className="px-5 pb-5">
                      <span className="text-xs font-semibold" style={{ color: c.disponible ? "#2D9D6E" : "#8B7BAA", fontFamily: "var(--font-inter)" }}>
                        {c.disponible ? "Disponible esta semana" : "Próxima semana"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity disabled:opacity-30"
                  style={{ backgroundColor: "#F5F0E8", color: "#2D1464", fontFamily: "var(--font-plus-jakarta)" }}>
                  Anterior
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setPage(n)}
                    className="w-9 h-9 rounded-full text-sm font-bold transition-all"
                    style={{
                      backgroundColor: n === page ? "#2D1464" : "#F5F0E8",
                      color: n === page ? "white" : "#2D1464",
                      fontFamily: "var(--font-plus-jakarta)",
                    }}>
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity disabled:opacity-30"
                  style={{ backgroundColor: "#F5F0E8", color: "#2D1464", fontFamily: "var(--font-plus-jakarta)" }}>
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 text-center">
          <div className="max-w-xl mx-auto px-6">
            <h2 className="text-2xl font-extrabold mb-3"
              style={{ color: "#2D1464", fontFamily: "var(--font-plus-jakarta)" }}>
              Únete a la lista para elegir tu Compa.
            </h2>
            <p className="text-sm mb-6" style={{ color: "#4A3B6B", fontFamily: "var(--font-inter)" }}>
              Cuando tu zona esté disponible, te avisamos y puedes seleccionar a quien quieras.
            </p>
            <Link href="/#lista-de-espera"
              style={{ backgroundColor: "#FF6B2B" }}
              className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-full hover:opacity-90 transition-opacity">
              Únete a la lista de espera
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
