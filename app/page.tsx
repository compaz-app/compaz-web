"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  ShoppingCart,
  Building2,
  Stethoscope,
  Dumbbell,
  Banknote,
  Wrench,
  Video,
  MessageCircle,
} from "lucide-react";

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav
      style={{ backgroundColor: "rgba(45, 20, 100, 0.85)", backdropFilter: "blur(12px)" }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Image
          src="/logo-nav.webp"
          alt="Compaz"
          width={200}
          height={63}
          className="h-9 w-auto object-contain flex-shrink-0"
        />
        <a
          href="#formulario"
          style={{ backgroundColor: "#FF6B2B" }}
          className="inline-flex items-center text-white font-semibold text-sm px-4 sm:px-5 rounded-full hover:opacity-90 transition-opacity whitespace-nowrap min-h-[44px]"
        >
          Únete
        </a>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <section className="relative w-full h-screen overflow-hidden flex items-center justify-center">
      {/* Video de fondo */}
      <video
        ref={videoRef}
        src="/video-hero.mp4"
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        onEnded={() => {
          if (videoRef.current) {
            videoRef.current.pause();
          }
        }}
      />

      {/* Overlay oscuro */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(10,4,30,0.55) 0%, rgba(10,4,30,0.72) 100%)" }}
      />

      {/* Contenido */}
      <div className="relative z-10 text-center px-6 max-w-3xl mx-auto flex flex-col items-center gap-8">
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight"
          style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
        >
          Tu papá se quedó sin con quién ir al banco, al médico, al mercado.
        </h1>
        <p
          className="text-lg sm:text-xl leading-relaxed max-w-xl"
          style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-inter)" }}
        >
          Un <strong className="text-white">Compa</strong> lo acompaña como lo haría un amigo de toda la vida. Tú recibes fotos y notas de cada visita, directo a tu WhatsApp.
        </p>
        <a
          href="#formulario"
          style={{ backgroundColor: "#FF6B2B" }}
          className="inline-flex items-center text-white font-bold text-base sm:text-lg px-8 py-4 rounded-full hover:opacity-90 transition-opacity"
        >
          Quiero un Compa para mi familiar
        </a>
      </div>

      {/* Flecha hacia abajo */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center animate-bounce">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </section>
  );
}

// ─── Qué hace un Compa ────────────────────────────────────────────────────────

const actividades = [
  { Icon: ShoppingCart, label: "Supermercado" },
  { Icon: Building2,   label: "Banco" },
  { Icon: Stethoscope, label: "Médico" },
  { Icon: Dumbbell,    label: "Ejercicio" },
  { Icon: Banknote,    label: "Cobrar pensión" },
  { Icon: Wrench,      label: "Cambiar un bombillo" },
  { Icon: Video,       label: "Videollamadas" },
  { Icon: MessageCircle, label: "Simplemente conversar" },
];

function QueHaceUnCompa() {
  return (
    <section style={{ backgroundColor: "#FDFAF6" }} className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-center mb-14 leading-tight"
          style={{ color: "#2D1464", fontFamily: "var(--font-display)", textWrap: "balance" }}
        >
          No es un cuidador. Es un amigo de confianza.
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {actividades.map(({ Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-3 rounded-2xl py-7 px-4"
              style={{ backgroundColor: "white", border: "1.5px solid #E8E0D4" }}
            >
              <Icon
                size={32}
                strokeWidth={1.6}
                style={{ color: "#FF6B2B" }}
              />
              <span
                className="text-sm font-semibold text-center leading-snug"
                style={{ color: "#2D1464", fontFamily: "var(--font-inter)" }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <p
          className="mt-10 text-center text-sm font-medium"
          style={{ color: "#6B5C90", fontFamily: "var(--font-inter)" }}
        >
          Cada Compa pasa por verificación de identidad y antecedentes antes de su primera visita.
        </p>
      </div>
    </section>
  );
}

// ─── Cómo funciona ────────────────────────────────────────────────────────────

const pasos = [
  {
    num: "01",
    titulo: "Tú eliges la frecuencia",
    desc: "Dinos con qué frecuencia necesitas visitas: semanal, quincenal o mensual.",
  },
  {
    num: "02",
    titulo: "Te asignamos un Compa",
    desc: "Te conectamos con un Compa verificado cerca de tu familiar en Venezuela.",
  },
  {
    num: "03",
    titulo: "Recibes el reporte",
    desc: "Después de cada visita, recibes fotos y notas directo a tu WhatsApp.",
  },
];

function ComoFunciona() {
  return (
    <section style={{ backgroundColor: "#2D1464" }} className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-center mb-16 text-white leading-tight"
          style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
        >
          Simple para ti. Significativo para ellos.
        </h2>

        <div className="grid sm:grid-cols-3 gap-8">
          {pasos.map(({ num, titulo, desc }) => (
            <div key={num} className="flex flex-col items-center text-center gap-4">
              <span
                className="text-5xl font-extrabold leading-none"
                style={{ color: "#FF6B2B", fontFamily: "var(--font-display)" }}
              >
                {num}
              </span>
              <h3
                className="text-lg font-bold text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {titulo}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.70)", fontFamily: "var(--font-inter)" }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Formulario ───────────────────────────────────────────────────────────────

function Formulario() {
  const [form, setForm] = useState({
    nombre: "",
    whatsapp: "",
    email: "",
    ciudad: "",
    rol: "",
    website: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    const turnstileToken =
      (e.currentTarget.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null)
        ?.value ?? "";
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          contacto: `WA: ${form.whatsapp} | Email: ${form.email} | Rol: ${form.rol}`,
          ciudad: form.ciudad,
          website: form.website,
          turnstileToken,
        }),
      });
      if (!res.ok) throw new Error("Error");
      setStatus("ok");
      setForm({ nombre: "", whatsapp: "", email: "", ciudad: "", rol: "", website: "" });
    } catch {
      setStatus("error");
    }
  }

  return (
    <section
      id="formulario"
      style={{ backgroundColor: "#FFD23F" }}
      className="py-24 px-6"
    >
      <div className="max-w-xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl font-extrabold text-center mb-4 leading-tight"
          style={{ color: "#1A0A3C", fontFamily: "var(--font-display)", textWrap: "balance" }}
        >
          Arrancamos en Caracas en septiembre. Estamos seleccionando las primeras 50 familias del piloto.
        </h2>
        <p
          className="text-center text-lg font-semibold mb-10"
          style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
        >
          El primer mes es nuestro regalo.
        </p>

        {status === "ok" ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: "white" }}
          >
            <p
              className="text-xl font-extrabold mb-2"
              style={{ color: "#2D1464", fontFamily: "var(--font-display)" }}
            >
              ¡Ya estás en la lista!
            </p>
            <p
              className="text-sm"
              style={{ color: "#6B5C90", fontFamily: "var(--font-inter)" }}
            >
              Te escribimos antes del lanzamiento con todos los detalles.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Honeypot */}
            <input
              type="text"
              name="website"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              tabIndex={-1}
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }}
            />

            <input
              type="text"
              required
              placeholder="Tu nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full rounded-xl px-5 py-4 text-base outline-none"
              style={{ backgroundColor: "white", color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
            />
            <input
              type="tel"
              required
              placeholder="Tu WhatsApp (con código de país)"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              className="w-full rounded-xl px-5 py-4 text-base outline-none"
              style={{ backgroundColor: "white", color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
            />
            <input
              type="email"
              required
              placeholder="Tu email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl px-5 py-4 text-base outline-none"
              style={{ backgroundColor: "white", color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
            />
            <input
              type="text"
              required
              placeholder="Ciudad donde vive tu familiar en Venezuela"
              value={form.ciudad}
              onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
              className="w-full rounded-xl px-5 py-4 text-base outline-none"
              style={{ backgroundColor: "white", color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
            />

            {/* Selector de rol */}
            <div className="flex flex-col gap-2">
              <p
                className="text-sm font-semibold px-1"
                style={{ color: "#1A0A3C", fontFamily: "var(--font-inter)" }}
              >
                ¿Cómo quieres participar?
              </p>
              {[
                { value: "familia", label: "Quiero contratar el servicio para mi familiar" },
                { value: "compa", label: "Quiero ser Compa (trabajo en Venezuela)" },
              ].map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-3 rounded-xl px-5 py-4 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: form.rol === value ? "#2D1464" : "white",
                    color: form.rol === value ? "white" : "#1A0A3C",
                    fontFamily: "var(--font-inter)",
                    fontSize: "0.9rem",
                  }}
                >
                  <input
                    type="radio"
                    name="rol"
                    value={value}
                    required
                    checked={form.rol === value}
                    onChange={() => setForm({ ...form, rol: value })}
                    className="accent-current"
                    style={{ accentColor: form.rol === value ? "white" : "#2D1464" }}
                  />
                  {label}
                </label>
              ))}
            </div>

            {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
              <div
                className="cf-turnstile"
                data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                data-theme="light"
                data-language="es"
              />
            )}

            {status === "error" && (
              <p className="text-sm text-center font-medium" style={{ color: "#7f1d1d" }}>
                Algo salió mal. Intenta de nuevo.
              </p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full font-bold text-base py-4 rounded-full transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{
                backgroundColor: "#2D1464",
                color: "white",
                fontFamily: "var(--font-display)",
              }}
            >
              {status === "loading" ? "Enviando…" : "Quiero ser parte del piloto"}
            </button>

            <p
              className="text-xs text-center mt-1"
              style={{ color: "#4A3B6B", fontFamily: "var(--font-inter)" }}
            >
              Cada suscripción crea trabajo digno en Venezuela.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ backgroundColor: "#1A0A3C" }} className="py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Image
          src="/logo-mono.png"
          alt="Compaz"
          width={160}
          height={50}
          className="h-10 w-auto object-contain object-left"
        />
        <div className="flex items-center gap-6">
          <a
            href="https://instagram.com/elcompaz"
            className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-inter)" }}
          >
            @elcompaz
          </a>
          <a
            href="/privacidad"
            className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-inter)" }}
          >
            Privacidad
          </a>
        </div>
        <p
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-inter)" }}
        >
          © 2026 Compaz. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <QueHaceUnCompa />
        <ComoFunciona />
        <Formulario />
      </main>
      <Footer />
    </>
  );
}
