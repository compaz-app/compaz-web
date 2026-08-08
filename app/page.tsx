"use client";

import Image from "next/image";
import { useState } from "react";

// ─── Nav ────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav
      style={{ backgroundColor: "#2D1464" }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Image
          src="/logo-nav.webp"
          alt="Compaz"
          width={200}
          height={63}
          className="h-9 w-auto object-contain flex-shrink-0"
        />
        <div className="flex items-center gap-2 sm:gap-4">
          <a
            href="#lista-de-espera"
            style={{ backgroundColor: "#FF6B2B" }}
            className="inline-flex items-center text-white font-semibold text-sm px-4 sm:px-5 rounded-full hover:opacity-90 transition-opacity whitespace-nowrap min-h-[44px]"
          >
            Únete
          </a>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section
      style={{ backgroundColor: "#2D1464" }}
      className="relative min-h-screen flex items-center pt-20 overflow-hidden"
    >
      {/* Background texture */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 50%, #FF6B2B 0%, transparent 50%), radial-gradient(circle at 80% 20%, #FFD23F 0%, transparent 40%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 py-14 lg:py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p
            className="text-sm font-semibold tracking-widest uppercase mb-6"
            style={{ color: "#FFD23F", fontFamily: "var(--font-display)" }}
          >
            Cuidamos con amistad
          </p>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.05] text-white mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="wavy-underline" style={{ color: "#FF6B2B" }}>
              Presente,
            </span>
            <br />
            aunque tú
            <br />
            no puedas
            <br />
            estarlo.
          </h1>
          <p
            className="text-lg text-white/75 leading-relaxed mb-10 max-w-lg"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            Compaz conecta a hijos e hijas en el exterior con su familia en
            Venezuela. Un <strong className="text-white font-semibold">Compa</strong> los visita, los acompaña, y tú
            recibes fotos y notas de cada visita. Para saber que están bien,
            no solo imaginarlo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#lista-de-espera"
              style={{ backgroundColor: "#FF6B2B" }}
              className="inline-flex items-center justify-center text-white font-bold text-base px-8 py-4 rounded-full hover:opacity-90 transition-opacity shadow-lg shadow-orange-900/30"
            >
              Únete a la lista de espera
            </a>
            <a
              href="https://wa.me/message/compaz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 font-semibold text-base px-8 py-4 rounded-full border-2 transition-all hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,0.3)", color: "white" }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Habla con nosotros
            </a>
          </div>

          {/* Proof card — visible on mobile only (desktop sees the floating card over the image) */}
          <div
            className="mt-8 flex items-start gap-3 rounded-2xl p-4 lg:hidden"
            style={{ backgroundColor: "#FF6B2B" }}
          >
            <div className="shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg">💬</div>
            <div>
              <p className="text-white font-bold text-sm mb-0.5">Última visita</p>
              <p className="text-white/90 text-xs leading-snug">"Tu mamá está muy bien. Hicimos las compras juntos."</p>
            </div>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              background:
                "linear-gradient(135deg, #FF6B2B22 0%, transparent 60%)",
            }}
          />
          <Image
            src="/images/hero-v3.jpg"
            alt="Familia venezolana unida a distancia"
            width={600}
            height={680}
            className="rounded-3xl object-cover w-full h-[580px]"
            style={{ filter: "saturate(1.1)" }}
            priority
          />
          {/* Floating card */}
          <div
            className="absolute bottom-8 -left-8 rounded-2xl p-5 shadow-2xl"
            style={{ backgroundColor: "#FF6B2B" }}
          >
            <p className="text-white font-bold text-sm mb-1">Última visita</p>
            <p className="text-white/90 text-xs leading-snug">
              "Tu mamá está muy bien. <br />
              Hicimos las compras juntos."
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Problema ────────────────────────────────────────────────────────────────

function Problema() {
  return (
    <section style={{ backgroundColor: "#FF6B2B" }} className="py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="flex items-end gap-4 mb-8">
              <span
                className="text-6xl sm:text-8xl xl:text-9xl font-extrabold text-white leading-none"
                style={{ fontFamily: "var(--font-display)" }}
              >
                7.7M
              </span>
              <span
                className="text-xl text-white/80 font-medium mb-4 leading-tight max-w-[140px]"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                venezolanos migraron
              </span>
            </div>
            <h2
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-6 leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Un vacío que no existe
              <br />
              en ningún otro país
            </h2>
            <p
              className="text-white text-lg leading-relaxed"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              Su familia se quedó. Una llamada telefónica no alcanza para saber
              cómo están de verdad, y no siempre hay alguien de confianza que
              pueda visitarlos.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Image
              src="/images/problema-videollamada-v3.jpg"
              alt="Videollamada a distancia"
              width={300}
              height={360}
              className="rounded-2xl object-cover w-full h-60 lg:h-72"
            />
            <Image
              src="/images/problema-distancia-v2.jpg"
              alt="Familiar solo en Venezuela"
              width={300}
              height={360}
              className="rounded-2xl object-cover w-full h-60 lg:h-72 mt-8"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Solución ────────────────────────────────────────────────────────────────

function Solucion() {
  return (
    <section style={{ backgroundColor: "#FDFAF6" }} className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <Image
              src="/images/telefono-v2.jpg"
              alt="Compa acompañando a adulto mayor"
              width={560}
              height={560}
              className="rounded-3xl object-cover w-full h-64 sm:h-[480px]"
            />
            <div
              className="absolute bottom-4 right-4 rounded-2xl px-5 py-3 shadow-xl"
              style={{ backgroundColor: "#2D1464" }}
            >
              <p className="text-white font-bold text-sm">Reporte enviado</p>
              <p className="text-white/70 text-xs mt-1">Directo a tu WhatsApp</p>
            </div>
          </div>

          <div>
            <h2
              className="text-4xl lg:text-5xl font-extrabold leading-tight mb-6"
              style={{
                color: "#2D1464",
                fontFamily: "var(--font-display)",
              }}
            >
              Un Compa, cerca de ellos.
              <br />
              Un reporte,
              <br />
              <span style={{ color: "#FF6B2B" }}>cerca de ti.</span>
            </h2>
            <p
              className="text-lg leading-relaxed mb-8"
              style={{
                color: "#4A3B6B",
                fontFamily: "var(--font-inter)",
              }}
            >
              Un Compa verificado visita a tu familiar: compañía,
              acompañamiento a citas médicas, mandados, ayuda con
              videollamadas (y más). Cada visita termina en un reporte con
              fotos y notas, directo a tu WhatsApp.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Compañía real" },
                { label: "Citas médicas" },
                { label: "Mandados" },
                { label: "Videollamadas" },
                { label: "Llamadas telefónicas" },
                { label: "Recados y compras" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ backgroundColor: "#F5F0E8" }}
                >
                  <span
                    className="font-semibold text-sm"
                    style={{
                      color: "#2D1464",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Cómo funciona ──────────────────────────────────────────────────────────

const pasos = [
  {
    n: "1",
    titulo: "Eliges un plan",
    detalle:
      "Según la frecuencia de visitas que necesita tu familiar: quincenal, semanal, o dos veces por semana con acompañamiento médico.",
  },
  {
    n: "2",
    titulo: "Un Compa verificado es asignado",
    detalle:
      "Cada Compa pasa por verificación de identidad, revisión de referencias personales, entrevista presencial, y una primera visita supervisada antes de trabajar de forma independiente. Recibes su perfil completo antes de la primera visita.",
  },
  {
    n: "3",
    titulo: "Recibes fotos y notas después de cada visita",
    detalle:
      "Directo a tu WhatsApp. Sabes cómo estuvo la visita, qué hicieron juntos y cómo se sintió tu familiar.",
  },
  {
    n: "4",
    titulo: "Ajustas cuando quieras",
    detalle:
      "Más visitas, acompañamiento médico, o pausar el servicio. Sin contratos largos, sin penalidades.",
  },
];

function ComoFunciona() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="como-funciona" style={{ backgroundColor: "#2D1464" }} className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <p
              className="text-sm font-bold tracking-widest uppercase mb-4"
              style={{ color: "#FFD23F", fontFamily: "var(--font-display)" }}
            >
              Cómo funciona
            </p>
            <h2
              className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Simple para ti.
              <br />
              Significativo
              <br />
              para ellos.
            </h2>
            <Image
              src="/images/plaza-v2.jpg"
              alt="Compañía y actividad compartida"
              width={480}
              height={320}
              className="rounded-2xl object-cover w-full h-56 mt-8 hidden lg:block"
              style={{ filter: "brightness(0.85) saturate(1.2)" }}
            />
          </div>

          <div className="space-y-3">
            {pasos.map((paso, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: open === i ? "#FF6B2B" : "rgba(255,255,255,0.07)" }}
              >
                <button
                  type="button"
                  id={`paso-btn-${i}`}
                  aria-expanded={open === i}
                  aria-controls={`paso-detalle-${i}`}
                  className="w-full flex items-center gap-4 px-6 py-5 text-left bg-transparent border-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-1"
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  <span
                    className="text-2xl font-extrabold w-10 shrink-0"
                    aria-hidden="true"
                    style={{
                      color: open === i ? "white" : "#FFD23F",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {paso.n}
                  </span>
                  <span
                    className="font-bold text-lg flex-1"
                    style={{
                      color: "white",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {paso.titulo}
                  </span>
                  <span
                    className="text-2xl transition-transform duration-300 shrink-0"
                    aria-hidden="true"
                    style={{
                      color: open === i ? "white" : "rgba(255,255,255,0.5)",
                      transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    +
                  </span>
                </button>
                <div
                  id={`paso-detalle-${i}`}
                  role="region"
                  aria-labelledby={`paso-btn-${i}`}
                  style={{
                    display: "grid",
                    gridTemplateRows: open === i ? "1fr" : "0fr",
                    transition: "grid-template-rows 0.3s ease",
                  }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <p
                      className="px-6 pb-5 text-white leading-relaxed"
                      style={{ fontFamily: "var(--font-inter)" }}
                    >
                      {paso.detalle}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Lista de espera ──────────────────────────────────────────────────────────

function ListaDeEspera() {
  const [form, setForm] = useState({ nombre: "", contacto: "", ciudad: "", website: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");

    // Obtener token de Cloudflare Turnstile (si está configurado)
    const turnstileToken =
      (e.currentTarget.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null)
        ?.value ?? "";

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, turnstileToken }),
      });
      if (!res.ok) throw new Error("Error");
      setStatus("ok");
      setForm({ nombre: "", contacto: "", ciudad: "", website: "" });
    } catch {
      setStatus("error");
    }
  }

  return (
    <section
      id="lista-de-espera"
      style={{ backgroundColor: "#FFD23F" }}
      className="py-24"
    >
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2
          className="text-4xl lg:text-5xl font-extrabold leading-tight mb-4"
          style={{ color: "#1A0A3C", fontFamily: "var(--font-display)" }}
        >
          Recién empezamos, y queremos
          que seas parte desde el día uno.
        </h2>
        <p
          className="text-lg mb-12 leading-relaxed"
          style={{ color: "#2D1464", fontFamily: "var(--font-inter)" }}
        >
          Estamos armando la primera red de Compas en Caracas. Únete y accede
          primero, con condiciones de lanzamiento.
        </p>

        {status === "ok" ? (
          <div
            className="rounded-2xl p-10"
            style={{ backgroundColor: "rgba(45,20,100,0.1)" }}
          >
            <p
              className="font-bold text-2xl mb-2"
              style={{ color: "#1A0A3C", fontFamily: "var(--font-display)" }}
            >
              ¡Ya estás en la lista!
            </p>
            <p style={{ color: "#2D1464", fontFamily: "var(--font-inter)" }}>
              Te contactamos muy pronto con los detalles de lanzamiento.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot — invisible para humanos, los bots lo llenan */}
            <input
              type="text"
              name="website"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              tabIndex={-1}
              aria-hidden="true"
              autoComplete="off"
              style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="form-nombre" className="sr-only">Tu nombre</label>
                <input
                  id="form-nombre"
                  type="text"
                  placeholder="Tu nombre"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full rounded-xl px-5 py-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    backgroundColor: "white",
                    color: "#1A0A3C",
                    fontFamily: "var(--font-inter)",
                    border: "2px solid rgba(45,20,100,0.2)",
                    outlineColor: "#2D1464",
                  }}
                />
              </div>
              <div>
                <label htmlFor="form-contacto" className="sr-only">WhatsApp o email</label>
                <input
                  id="form-contacto"
                  type="email"
                  inputMode="email"
                  placeholder="WhatsApp o email"
                  required
                  aria-invalid={status === "error" || undefined}
                  aria-describedby={status === "error" ? "form-error" : undefined}
                  value={form.contacto}
                  onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                  className="w-full rounded-xl px-5 py-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    backgroundColor: "white",
                    color: "#1A0A3C",
                    fontFamily: "var(--font-inter)",
                    border: "2px solid rgba(45,20,100,0.2)",
                    outlineColor: "#2D1464",
                  }}
                />
              </div>
            </div>
            <div>
              <label htmlFor="form-ciudad" className="sr-only">Ciudad donde vive tu familiar</label>
              <input
                id="form-ciudad"
                type="text"
                placeholder="Ciudad donde vive tu familiar (ej: Caracas)"
                required
                value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                className="w-full rounded-xl px-5 py-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  backgroundColor: "white",
                  color: "#1A0A3C",
                  fontFamily: "var(--font-inter)",
                  border: "2px solid rgba(45,20,100,0.2)",
                  outlineColor: "#2D1464",
                }}
              />
            </div>
            {/* Cloudflare Turnstile — verificación humana invisible */}
            {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
              <div
                className="cf-turnstile"
                data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                data-theme="light"
                data-language="es"
              />
            )}

            {status === "error" && (
              <p id="form-error" role="alert" aria-live="assertive" className="text-sm font-semibold" style={{ color: "#1A0A3C" }}>
                Hubo un error al enviar. Escríbenos directamente por{" "}
                <a href="https://wa.me/message/compaz" className="underline">WhatsApp</a>.
              </p>
            )}
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full font-bold text-base py-4 rounded-full transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                backgroundColor: "#2D1464",
                color: "white",
                fontFamily: "var(--font-display)",
                outlineColor: "#1A0A3C",
              }}
            >
              {status === "loading" ? "Enviando…" : "Únete a la lista de espera →"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

// ─── Equipo ───────────────────────────────────────────────────────────────────

const equipo = [
  {
    nombre: "Juan Tenreiro",
    rol: "Founder",
    foto: "/images/juan-tenreiro.jpg",
    bio: "Juan fundó Compaz después de vivir en carne propia la distancia entre cuidar a la familia y estar lejos de Venezuela. Antes de Compaz, trabajó en construir productos y operaciones en etapas tempranas, con foco en resolver problemas reales de comunidades latinoamericanas. Cree que la tecnología puede devolverle presencia a quienes la distancia les quitó.",
  },
  {
    nombre: "Luis Mendoza",
    rol: "Co-Founder",
    foto: "/images/luis-mendoza.jpg",
    bio: "Luis se sumó a Compaz para construir la capa operativa y de confianza que el modelo necesita: verificación, calidad de servicio, y relación con las familias. Su experiencia en operaciones y logística lo llevó a ver de cerca cómo la distancia afecta a las familias migrantes, y decidió que quería ser parte de la solución.",
  },
];

function Equipo() {
  return (
    <section style={{ backgroundColor: "#FDFAF6" }} className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2
            className="text-4xl lg:text-5xl font-extrabold"
            style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
          >
            El equipo
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-10">
          {equipo.map((p) => (
            <div
              key={p.nombre}
              className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-start rounded-2xl p-6 sm:p-8"
              style={{ backgroundColor: "#F5F0E8" }}
            >
              <Image
                src={p.foto}
                alt={p.nombre}
                width={80}
                height={80}
                className="rounded-full object-cover shrink-0"
                style={{ width: 80, height: 80 }}
              />
              <div>
                <p
                  className="font-extrabold text-xl mb-0.5"
                  style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
                >
                  {p.nombre}
                </p>
                <p
                  className="text-sm font-semibold mb-3"
                  style={{ color: "#FF6B2B", fontFamily: "var(--font-display)" }}
                >
                  {p.rol}
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#4A3B6B", fontFamily: "var(--font-inter)" }}
                >
                  {p.bio}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ backgroundColor: "#1A0A3C" }} className="py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
          <div>
            <Image
              src="/logo-mono.png"
              alt="Compaz"
              width={320}
              height={100}
              className="h-[72px] w-[230px] object-contain object-left mb-4 block"
            />
            <p
              className="text-sm max-w-xs leading-relaxed"
              style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-inter)" }}
            >
              Amistad presente. Cuidado para adultos mayores en Venezuela.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 md:gap-x-16 gap-y-3">
            {[
              { label: "Cómo funciona", href: "#como-funciona" },
              { label: "Lista de espera", href: "#lista-de-espera" },
              { label: "@elcompaz", href: "https://instagram.com/elcompaz" },
              { label: "Privacidad", href: "/privacidad" },
            ].map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm transition-colors hover:text-white"
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontFamily: "var(--font-inter)",
                }}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>

        <div
          className="border-t pt-6 flex items-center justify-center"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <p
            className="text-xs"
            style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-inter)" }}
          >
            © 2026 Compaz. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Wave dividers ────────────────────────────────────────────────────────────

const WAVE_PATHS: Record<number, string> = {
  // Onda suave, una sola curva simétrica
  1: "M0,40 C480,80 960,0 1440,40 L1440,80 L0,80 Z",
  // Doble onda asimétrica
  2: "M0,60 C240,20 480,80 720,38 C960,0 1200,65 1440,35 L1440,80 L0,80 Z",
  // Inclinada — alta a la izquierda, baja a la derecha
  3: "M0,20 C360,80 1080,10 1440,65 L1440,80 L0,80 Z",
  // Triple ondulación orgánica
  4: "M0,55 C180,80 360,20 540,60 C720,95 900,15 1080,55 C1200,78 1380,40 1440,52 L1440,80 L0,80 Z",
  // Plana con caída pronunciada a un lado
  5: "M0,25 C280,25 420,75 640,68 C820,62 1100,18 1440,45 L1440,80 L0,80 Z",
};

function WaveDivider({
  from,
  to,
  shape,
  flip = false,
}: {
  from: string;
  to: string;
  shape: 1 | 2 | 3 | 4 | 5;
  flip?: boolean;
}) {
  return (
    <div style={{ backgroundColor: from, lineHeight: 0, fontSize: 0 }}>
      <svg
        viewBox="0 0 1440 80"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="w-full block h-10 sm:h-14 lg:h-16"
        style={flip ? { transform: "scaleX(-1)" } : undefined}
        aria-hidden="true"
      >
        <path d={WAVE_PATHS[shape]} fill={to} />
      </svg>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <WaveDivider from="#2D1464" to="#FF6B2B" shape={1} />
        <Problema />
        <WaveDivider from="#FF6B2B" to="#FDFAF6" shape={2} />
        <Solucion />
        <ComoFunciona />
        <Equipo />
        <WaveDivider from="#FDFAF6" to="#FFD23F" shape={1} flip />
        <ListaDeEspera />
      </main>
      <Footer />
    </>
  );
}
