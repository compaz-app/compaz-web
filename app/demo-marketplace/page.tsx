"use client";

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const zonas = ["Todas las zonas", "Chacao", "Baruta", "La Candelaria", "El Hatillo", "Los Palos Grandes"];

const compas = [
  {
    nombre: "Ana",
    zona: "Chacao",
    foto: "/images/compa-ana.jpg",
    rating: "4.9",
    visitas: 23,
    resena: "Muy puntual y cariñosa con mi mamá. Se quedó más de lo acordado porque ella quería seguir hablando.",
    familia: "Familia R.",
    disponible: true,
  },
  {
    nombre: "Carlos",
    zona: "Baruta",
    foto: "/images/compa-carlos.jpg",
    rating: "4.8",
    visitas: 17,
    resena: "Mi papá lo espera cada semana. Le ayuda con las pastillas y lo lleva al médico sin problema.",
    familia: "Familia M.",
    disponible: true,
  },
  {
    nombre: "María",
    zona: "Los Palos Grandes",
    foto: "/images/compa-maria.jpg",
    rating: "5.0",
    visitas: 31,
    resena: "Increíble. Mi abuela dice que es como tener una nieta en casa. Ya no se siente sola.",
    familia: "Familia G.",
    disponible: true,
  },
  {
    nombre: "José",
    zona: "La Candelaria",
    foto: "/images/compa-jose.jpg",
    rating: "4.7",
    visitas: 12,
    resena: "Muy responsable. Siempre manda el reporte con fotos el mismo día de la visita.",
    familia: "Familia S.",
    disponible: false,
  },
  {
    nombre: "Rosa",
    zona: "El Hatillo",
    foto: "/images/compa-ana.jpg",
    rating: "4.9",
    visitas: 28,
    resena: "Mi mamá le tiene mucha confianza. La acompañó al cardiólogo y tomó notas de todo lo que dijo el doctor.",
    familia: "Familia L.",
    disponible: true,
  },
];

export default function DemoMarketplace() {
  const [zona, setZona] = useState("Todas las zonas");

  const filtrados = zona === "Todas las zonas"
    ? compas
    : compas.filter((c) => c.zona === zona);

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
          <div className="flex items-center gap-4">
            <span
              className="text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ backgroundColor: "#FF6B2B", color: "white", fontFamily: "var(--font-plus-jakarta)" }}
            >
              Vista previa — proximamente
            </span>
            <Link
              href="/inversionistas"
              className="text-white/60 hover:text-white text-sm font-medium transition-colors"
            >
              Inversionistas
            </Link>
          </div>
        </div>
      </nav>

      <main style={{ backgroundColor: "#FDFAF6" }}>
        {/* Header */}
        <section style={{ backgroundColor: "#2D1464" }} className="py-16">
          <div className="max-w-5xl mx-auto px-6">
            <p
              className="text-sm font-bold tracking-widest uppercase mb-4"
              style={{ color: "#FFD23F", fontFamily: "var(--font-plus-jakarta)" }}
            >
              Demo — uso interno
            </p>
            <h1
              className="text-4xl lg:text-6xl font-extrabold text-white leading-tight mb-6"
              style={{ fontFamily: "var(--font-plus-jakarta)" }}
            >
              Conoce a
              <br />
              tu Compa.
            </h1>
            <p
              className="text-white/75 text-lg max-w-2xl leading-relaxed"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              Cada Compa pasa por verificacion de antecedentes, entrevista
              personal y validacion de referencias antes de su primera visita.
              Asi vas a poder elegir a tu Compa cuando el matching este
              disponible. Hoy lo hacemos manualmente, verificando cada
              asignacion uno por uno.
            </p>
          </div>
        </section>

        {/* Filtro */}
        <section style={{ backgroundColor: "#F5F0E8" }} className="py-6 sticky top-[64px] z-40">
          <div className="max-w-5xl mx-auto px-6 flex items-center gap-4 flex-wrap">
            <label
              className="text-sm font-semibold"
              style={{ color: "#2D1464", fontFamily: "var(--font-plus-jakarta)" }}
            >
              Buscar por zona:
            </label>
            <select
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              className="rounded-xl px-4 py-2 text-sm font-semibold outline-none cursor-pointer"
              style={{
                backgroundColor: "white",
                color: "#2D1464",
                border: "2px solid #E8E0D4",
                fontFamily: "var(--font-plus-jakarta)",
              }}
            >
              {zonas.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
            <span
              className="text-sm"
              style={{ color: "#8B7BAA", fontFamily: "var(--font-inter)" }}
            >
              {filtrados.length} Compas disponibles
            </span>
          </div>
        </section>

        {/* Grid de Compas */}
        <section className="py-12">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtrados.map((c) => (
                <div
                  key={c.nombre + c.zona}
                  className="rounded-2xl overflow-hidden"
                  style={{ backgroundColor: "white", border: "2px solid #E8E0D4" }}
                >
                  {/* Foto */}
                  <div className="relative">
                    <Image
                      src={c.foto}
                      alt={c.nombre}
                      width={400}
                      height={260}
                      className="w-full object-cover"
                      style={{ height: 220 }}
                    />
                    {/* Badge verificado */}
                    <div
                      className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                      style={{ backgroundColor: "white", color: "#2D1464" }}
                      title="Antecedentes verificados, entrevista y validacion de referencias"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#FF6B2B" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Verificado
                    </div>
                    {/* Disponibilidad */}
                    <div
                      className="absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: c.disponible ? "#2D1464" : "#8B7BAA",
                        color: "white",
                        fontFamily: "var(--font-inter)",
                      }}
                    >
                      {c.disponible ? "Disponible esta semana" : "Proxima semana"}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p
                          className="font-extrabold text-xl"
                          style={{ color: "#2D1464", fontFamily: "var(--font-plus-jakarta)" }}
                        >
                          {c.nombre}
                        </p>
                        <p
                          className="text-sm"
                          style={{ color: "#8B7BAA", fontFamily: "var(--font-inter)" }}
                        >
                          {c.zona}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className="font-bold text-lg"
                          style={{ color: "#2D1464", fontFamily: "var(--font-plus-jakarta)" }}
                        >
                          {c.rating} <span style={{ color: "#FF6B2B" }}>&#9733;</span>
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "#8B7BAA", fontFamily: "var(--font-inter)" }}
                        >
                          {c.visitas} visitas
                        </p>
                      </div>
                    </div>

                    {/* Resena */}
                    <blockquote
                      className="text-sm leading-relaxed mt-3 pt-3"
                      style={{
                        color: "#4A3B6B",
                        fontFamily: "var(--font-inter)",
                        borderTop: "1px solid #E8E0D4",
                      }}
                    >
                      "{c.resena}"
                      <footer
                        className="text-xs mt-1 font-semibold"
                        style={{ color: "#8B7BAA" }}
                      >
                        — {c.familia}
                      </footer>
                    </blockquote>

                    {/* CTA */}
                    <Link
                      href="/#lista-de-espera"
                      className="mt-4 block text-center text-sm font-bold py-3 rounded-xl transition-opacity hover:opacity-80"
                      style={{ backgroundColor: "#2D1464", color: "white", fontFamily: "var(--font-plus-jakarta)" }}
                    >
                      Unete a la lista para elegir tu Compa
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer del demo */}
        <section style={{ backgroundColor: "#1A0A3C" }} className="py-10">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <p
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-inter)" }}
            >
              Esta pagina es una demo interna. No esta disponible al publico ni
              indexada por buscadores.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
